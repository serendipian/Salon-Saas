# Packs / Bundles Feature — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Approach:** Pack as Cart Template (Approach 1)

## Problem

Discounted service bundles (e.g., "Pack Manu Russe Biab") are currently created as standalone services under a "Packs Promos" category. This breaks category-level stats and accounting — a nail pack isn't counted as "Onglerie" revenue, staff performance misses the real service attribution, and accounting by service line is inaccurate.

## Solution

A **Packs** system where bundles are defined as compositions of existing services/variants with a fixed discounted price. When selected in POS or Appointments, a pack **expands** into individual service items with pro-rata discounted prices. No changes to transactions, stats, or accounting — they work automatically because each item is a real service.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Price distribution | Pro-rata by original price | Industry standard (Stripe, Square, Shopify). Fair margins, accurate commissions, tax-safe |
| Staff assignment | Flexible (per-service) | Multi-specialist packs (bridal: nails + hair + makeup) are common |
| Cart behavior | Shortcut/alias — expands into individual items | Transparent, editable, staff can adjust per item |
| Management location | "Packs" tab inside Services module | Packs are composed of services — natural cohesion |

---

## 1. Data Model

### New Tables

```sql
-- packs: bundle definitions
CREATE TABLE packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    favorite_sort_order INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- pack_items: services/variants included in a pack
CREATE TABLE pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id),
    service_id UUID NOT NULL REFERENCES services(id),
    service_variant_id UUID NOT NULL REFERENCES service_variants(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS:** Same membership-based pattern as all other tables (`salon_id IN user_salon_ids()`).
**Soft delete:** `deleted_at` on `packs` only. `pack_items` are hard-deleted during pack edits (delete all + re-insert). The `ON DELETE CASCADE` on `pack_items.pack_id` only fires on hard delete of a pack row, which won't happen in normal use (packs are soft-deleted). CASCADE is a safety net for orphan cleanup only.
**Triggers:** `updated_at` auto-set trigger on both tables. Audit logging trigger on `packs`.
**No changes** to `transactions`, `transaction_items`, or `appointments` tables.

### Indexes

```sql
CREATE INDEX idx_packs_salon_id ON packs(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pack_items_pack_id ON pack_items(pack_id);
CREATE INDEX idx_pack_items_service_variant_id ON pack_items(service_variant_id);
```

---

## 2. Frontend Types

```typescript
interface Pack {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  isFavorite: boolean;
  favoriteSortOrder: number | null;
  sortOrder: number;
  items: PackItem[];
}

interface PackItem {
  id: string;
  serviceId: string;
  serviceVariantId: string;
  serviceName: string;       // joined from services.name
  variantName: string;        // joined from service_variants.name
  originalPrice: number;      // variant's full price
  durationMinutes: number;    // variant's duration (needed for appointments)
  sortOrder: number;
}
```

Add to `types.ts`. No changes to existing types except:

```typescript
// CartItem — add optional pack fields
interface CartItem {
  // ... all existing fields unchanged
  packId?: string;     // present if expanded from a pack
  packName?: string;   // for visual grouping in cart UI
}

// FavoriteItem — add pack variant
type FavoriteItem =
  | { type: 'service'; service: Service; sortOrder: number }
  | { type: 'variant'; variant: ServiceVariant; parentService: Service; sortOrder: number }
  | { type: 'pack'; pack: Pack; sortOrder: number }
```

---

## 3. Pro-Rata Price Expansion

When a pack is selected, each item receives a discounted price proportional to its original price:

```
item_discounted_price = (variant.price / sum_of_all_variant_prices) * pack.price
```

**Rounding strategy:**
1. Round each item to 2 decimal places
2. Compute the difference: `pack.price - sum(rounded_prices)`
3. Apply the cent difference to the item with the highest original price

This ensures `sum(item_discounted_prices) === pack.price` exactly.

**Implementation:** Pure utility function `expandPack(pack: Pack): CartItem[]` in a shared location (e.g., `modules/services/utils/packExpansion.ts`), consumed by both POS and Appointments.

---

## 4. Cart Deduplication Fix

**Problem:** `addToCart` in `usePOS.ts` merges items with the same `referenceId` + `variantName` by incrementing quantity. Pack-expanded items sharing a variant with an existing cart item would merge and lose their pro-rata pricing.

**Solution:** When `packId` is present on a CartItem, skip the merge logic and always append as a new item. The merge check becomes:

```
// Existing logic (simplified):
if (existing.referenceId === new.referenceId && existing.variantName === new.variantName && !new.packId) {
  // merge (increment quantity)
} else {
  // append new item
}
```

---

## 5. Pack Validity

A pack is **valid** when all its items reference active, non-deleted services and variants.

**Computed client-side** in the `usePacks` hook by joining pack_items against services/variants. No DB column needed.

**Invalid pack behavior:**
- **POS & Appointments:** Hidden from selection (not shown in Packs tab)
- **Services management UI:** Shown with a warning badge and message listing which items are inactive/deleted
- **Favorites:** Hidden if invalid (same as POS)

---

## 6. Services Module — "Packs" Tab

### Pack List View
- Rendered as a tab inside the existing Services module (alongside category management)
- Columns: name, price, item count, total original price, discount %, active toggle
- Sort by `sort_order`
- Search by pack name

### Pack Form (Create/Edit)
- **Fields:** name, description (optional), price
- **Item picker:** Multi-select from existing services/variants, grouped by category
  - Shows category → service → variant hierarchy
  - Each selected variant shows: name, price, duration
  - Running total: original price sum vs. pack price (displays discount amount and %)
- **Validation:**
  - Name required
  - Price required, > 0
  - At least 1 item required
  - Soft warning if price >= sum of original prices (not blocking)
- **Save:** Upsert `packs` row + replace `pack_items` (delete all + insert new)

### CRUD Hooks
`modules/services/hooks/usePacks.ts` — follows existing TanStack Query pattern:
- `useQuery(['packs', salonId])` — fetch packs with joined items. Query: `supabase.from('packs').select('*, pack_items(*, services(name), service_variants(name, price, duration_minutes))')` to denormalize `serviceName`, `variantName`, `originalPrice`, and `durationMinutes` onto `PackItem`
- `useMutation` for create, update, delete (soft), toggle active, toggle favorite
- `useRealtimeSync('packs')` for live updates

---

## 7. POS Integration

### Packs Tab in POSCatalog
- New tab alongside "Favoris" and category tabs in `POSCatalog.tsx`
- Tab label: "Packs" (or "Promos" — to be decided during implementation)
- Displays valid, active packs as cards: name, price, item count, discount badge (e.g., "-20%")
- Click → `expandPack(pack)` → adds N CartItems to cart via `addToCart` (each with `packId` + `packName`)

### Cart Visual Grouping
Items sharing the same `packId` are visually grouped in `POSCart.tsx`:
- Small header above the group: "Pack: {packName}" with a subtle left border or background tint
- Each item shows: service name, variant name, discounted price, ~~original price~~ (strikethrough)
- "Remove pack" action on the group header removes all items with that `packId`
- Individual items remain independently editable (price override, staff assignment, removal)
- Removing individual items is allowed — the remaining pack items keep their prices

### Favorites
Packs with `is_favorite: true` appear in the Favorites tab. Clicking a favorited pack expands it the same way.

---

## 8. Appointment Integration

### Appointment Service Picker
Both desktop (`AppointmentBuilder.tsx`) and mobile (`AppointmentBuilderMobile.tsx`):
- New "Packs" tab in the category selector (same position as in POS)
- Selecting a pack creates **N appointment service entries** (one per pack item)
- Each entry has: `serviceId`, `serviceVariantId`, `durationMinutes`, pro-rata `price`, and defaults for staff/time

### Appointment Records
Each pack item becomes a separate `appointments` row sharing the same `group_id`:
- `service_id` = pack_item.service_id
- `service_variant_id` = pack_item.service_variant_id
- `price` = pro-rata discounted price
- `duration_minutes` = variant's duration
- `group_id` = shared UUID for the pack expansion
- `staff_id` = assigned per-appointment (flexible)

This is identical to how multi-service appointments already work — no schema changes needed.

### Appointment → Transaction
`importAppointment` in `usePOS.ts` already handles grouped appointments. Pack-expanded appointments flow into the POS as individual cart items, each with their pro-rata price. No changes to the import flow needed.

---

## 9. Stats & Accounting Impact

**None.** Each transaction_item references a real service variant via `reference_id`. All existing stat computations work:

- **Dashboard top services:** Counts by service name — pack items appear as their real services
- **Category-level stats:** If added later, join through `services.category_id` works naturally
- **Staff performance:** Attributed to whoever is assigned per service item
- **Accounting revenue:** Attributed to real services, not a fake "Packs Promos" category
- **Refunds:** Work normally — each pack-expanded item is an independent transaction_item with its own `id`, refundable individually

---

## 10. Migration Path

After the feature is built:
1. Create packs in the Services module matching existing "Packs Promos" services
2. Deactivate or delete the old "Packs Promos" category and its services
3. Historical transactions under the old approach remain unchanged (immutable snapshots)
4. Future transactions use the new pack expansion, correctly attributing revenue

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/XXXXXX_create_packs.sql` | DB migration: tables, RLS, indexes, triggers |
| `modules/services/hooks/usePacks.ts` | TanStack Query hooks for pack CRUD |
| `modules/services/components/PackList.tsx` | Pack list view in Services module |
| `modules/services/components/PackForm.tsx` | Pack create/edit form with item picker |
| `modules/services/utils/packExpansion.ts` | `expandPack()` pro-rata price logic |
| `modules/services/packMappers.ts` | DB Row ↔ Pack type translation |

## Files to Modify

| File | Change |
|------|--------|
| `types.ts` | Add `Pack`, `PackItem` types. Add `packId?`, `packName?` to `CartItem`. Extend `FavoriteItem` union |
| `modules/services/ServicesModule.tsx` | Add "Packs" tab |
| `modules/services/hooks/useServices.ts` | Include packs in favorites derivation |
| `modules/pos/components/POSCatalog.tsx` | Add "Packs" tab, pack card rendering |
| `modules/pos/components/POSCart.tsx` | Visual grouping for pack items |
| `modules/pos/hooks/usePOS.ts` | Skip merge for pack items in `addToCart` |
| `modules/pos/POSModule.tsx` | Wire pack expansion to cart |
| `modules/appointments/components/AppointmentBuilder.tsx` | Add "Packs" tab in service picker |
| `modules/appointments/components/AppointmentBuilderMobile.tsx` | Add "Packs" tab in mobile service picker |
