# Service Favorites Feature — Design Spec

## Overview

Add a "favorites" feature to services, allowing salon owners/managers to mark services or individual variants as favorites. Favorites appear as a prioritized shortlist ("Favoris" tab) in the appointment builder and POS catalog, so staff can quickly select the most commonly requested services without browsing all categories.

## Data Layer

### Approach: Columns on existing tables

Add two columns to both `services` and `service_variants`:

```sql
ALTER TABLE services ADD COLUMN is_favorite BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN favorite_sort_order INTEGER DEFAULT 0;

ALTER TABLE service_variants ADD COLUMN is_favorite BOOLEAN DEFAULT false;
ALTER TABLE service_variants ADD COLUMN favorite_sort_order INTEGER DEFAULT 0;
```

No new RLS policies needed — existing UPDATE policies (owner/manager) govern toggling favorites.

### Favorite semantics

- **Service-level favorite:** The entire service appears in the favorites shortlist. User still picks a variant on click (same as category view).
- **Variant-level favorite:** A single variant appears as a standalone card in the favorites shortlist. Clicking it selects that variant directly (skips variant picker).
- **Dedup rule:** If a service is favorited, its individually-favorited variants are suppressed in the favorites list (service-level takes precedence).
- **Sort order:** `favorite_sort_order` is a unified namespace across both tables. When reordering in the settings tab, sequential values are reassigned across all favorited services and variants.

### RPC: `reorder_favorites`

New SECURITY DEFINER function for atomic reordering across both tables:

- **Parameters:** `p_salon_id UUID`, `p_items JSONB` (array of `{ type: 'service' | 'variant', id: UUID, sort_order: INTEGER }`)
- **Behavior:** Updates `favorite_sort_order` on each referenced row. Validates user has owner/manager role.
- Consistent with existing RPC patterns (`save_service_categories`, `soft_delete_service`).

## Types

Extend existing types in `types.ts`:

```typescript
// Add to ServiceVariant
isFavorite: boolean;
favoriteSortOrder: number;

// Add to Service
isFavorite: boolean;
favoriteSortOrder: number;
```

New discriminated union for the merged favorites list:

```typescript
type FavoriteItem =
  | { type: 'service'; service: Service; sortOrder: number }
  | { type: 'variant'; variant: ServiceVariant; parentService: Service; sortOrder: number }
```

## Mappers

- **Read mappers** (`toService`, `toServiceVariant`): Map `is_favorite` and `favorite_sort_order` to camelCase.
- **Write mappers** (`toServiceInsert`, `toVariantInsert`): **Not modified.** Favorites are managed through dedicated mutations, not through the service CRUD flow. This prevents accidental favorite state reset when editing a service.

## Hooks

### Extend `useServices`

**Derived data:**

- `favorites: FavoriteItem[]` — computed via `useMemo` from `allServices`:
  1. Collect all services where `isFavorite === true`
  2. Collect all variants where `isFavorite === true` AND parent service is NOT favorited (dedup rule)
  3. Merge into `FavoriteItem[]`, sort by `sortOrder`

**New mutations:**

- `toggleFavorite({ type: 'service' | 'variant', id: string, isFavorite: boolean })` — single UPDATE on the appropriate table. When favoriting, assigns `favorite_sort_order` = current max + 1 (computed from loaded data, no extra query). Invalidates `['services', salonId]`.
- `reorderFavorites(items: { type: 'service' | 'variant', id: string, sortOrder: number }[])` — calls `reorder_favorites` RPC. Invalidates cache.

**Realtime:** Already covered — `useServices` subscribes to `services` and `service_variants` tables.

## Services Module UI

### Star icon on service cards and variant rows

- Lucide `Star` icon on each service card and variant row in the services list.
- Filled/yellow when favorited, outline when not.
- Click calls `toggleFavorite` — instant, no confirmation.
- **Hidden for non-owner/manager roles** (they can't toggle anyway, avoids clutter).

### "Favoris" tab in service settings

Lives alongside the existing categories management tab.

**Content:** Shows ALL services and variants grouped by category, each with a checkbox. Checked = favorited. This allows both adding and removing favorites from a single view.

**Ordering section:** Checked (favorited) items also appear in a reorderable list at the top, with drag handles for setting display order. Reorder saves via `reorderFavorites` mutation.

**Empty state:** "Aucun favori sélectionné — utilisez les étoiles sur les services ou cochez-les ici."

## Consumption UIs

### Appointments — Desktop (ServiceBlock / ServiceGrid)

- "Favoris" appears as the **first tab** in the category pills, before "Tous" and individual categories.
- When active, ServiceGrid renders the `favorites` list:
  - Service-type favorites: normal service cards (click expands variant picker).
  - Variant-type favorites: standalone cards showing "Service Name - Variant Name" with price/duration. Click selects the variant directly (sets both `serviceId` and `variantId`).
- **Pre-selected by default** when opening the service picker.

### Appointments — Mobile (MobileServicePicker)

- Same logic: "Favoris" as the first pill in the horizontal scrollable category bar.
- Same rendering distinction (service cards vs variant cards).
- Pre-selected on open.

### POS (POSCatalog)

- In the SERVICES view, "Favoris" is the first filter button before "Tous" and categories.
- Service favorites: open variant modal as usual.
- Variant favorites: **add directly to cart** without staff assignment (staff can be assigned on the cart item after). Consistent with product click behavior and the "quick access" intent.
- Pre-selected by default.

### Shared behavior

- If no favorites exist, the "Favoris" tab is **hidden** (no empty state in the picker — the tab simply doesn't appear).
- User can always switch to "Tous" or a specific category.

## Permissions

- **Toggle/reorder favorites:** Owner and manager only (enforced by existing UPDATE RLS policies).
- **View favorites in appointments/POS:** All roles (favorites are just a filter on data they can already read).
- **Star icon in services list:** Hidden for stylist/receptionist roles.
- **Favoris settings tab:** Only visible to owner/manager (consistent with category management access).

## Out of scope

- Auto-favorites based on booking frequency (analytics-driven) — potential future enhancement.
- Per-user favorites (current design is salon-wide).
- Favorite products (services only for now).
