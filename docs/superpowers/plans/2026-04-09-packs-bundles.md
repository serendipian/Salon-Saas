# Packs / Bundles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Packs system where discounted bundles of existing services expand into individual cart/appointment items with pro-rata pricing, preserving accurate category-level stats.

**Architecture:** New `packs` + `pack_items` tables with RLS. Frontend `usePacks` hook fetches packs with joined service/variant data. A pure `expandPack()` utility generates CartItems with pro-rata prices. Packs surface as a tab in Services module (management), POS catalog (selection), and appointment builders (selection). No changes to transactions, dashboard, or accounting.

**Tech Stack:** Supabase (PostgreSQL, RLS), React 19, TypeScript, TanStack Query, Tailwind CSS, Zod, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-09-packs-bundles-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260409150000_create_packs.sql` | DB tables, RLS policies, indexes, triggers |
| `modules/services/packMappers.ts` | DB Row → Pack/PackItem type conversion |
| `modules/services/hooks/usePacks.ts` | TanStack Query hooks for pack CRUD + realtime |
| `modules/services/utils/packExpansion.ts` | `expandPack()` pro-rata price logic |
| `modules/services/packSchemas.ts` | Zod validation for pack form |
| `modules/services/components/PackList.tsx` | Pack list view with search, active toggle |
| `modules/services/components/PackForm.tsx` | Pack create/edit form with service picker |

### Modified Files
| File | Change |
|------|--------|
| `types.ts` | Add `Pack`, `PackItem` types. Add `packId?`, `packName?` to `CartItem`. Extend `FavoriteItem` |
| `modules/services/ServicesModule.tsx` | Add tab state toggling between services list and packs list |
| `modules/services/hooks/useServices.ts` | Include packs in favorites derivation |
| `modules/pos/components/POSCatalog.tsx` | Add "Packs" category tab, pack card rendering |
| `modules/pos/hooks/usePOS.ts` | Skip merge for pack items in `addToCart` |
| `modules/pos/POSModule.tsx` | Wire pack expansion, pass packs to catalog |
| `modules/pos/components/POSCart.tsx` | Visual grouping for pack items |
| `modules/appointments/components/ServiceBlock.tsx` | Add "Packs" category pill |
| `modules/appointments/components/MobileServicePicker.tsx` | Add "Packs" category pill |
| `modules/appointments/hooks/useAppointmentForm.ts` | Add `addPackBlocks()` action |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260409150000_create_packs.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Create packs table
CREATE TABLE packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
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

-- Create pack_items table
CREATE TABLE pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    service_variant_id UUID NOT NULL REFERENCES service_variants(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_packs_salon_id ON packs(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pack_items_pack_id ON pack_items(pack_id);
CREATE INDEX idx_pack_items_service_variant_id ON pack_items(service_variant_id);

-- updated_at triggers
CREATE TRIGGER packs_updated_at
  BEFORE UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pack_items_updated_at
  BEFORE UPDATE ON pack_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_items ENABLE ROW LEVEL SECURITY;

-- packs policies
CREATE POLICY packs_select ON packs FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);

CREATE POLICY packs_select_admin ON packs FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY packs_insert ON packs FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY packs_update ON packs FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY packs_delete ON packs FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- pack_items policies
CREATE POLICY pack_items_select ON pack_items FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()));

CREATE POLICY pack_items_insert ON pack_items FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY pack_items_update ON pack_items FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY pack_items_delete ON pack_items FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Audit logging for packs (same pattern as other business tables)
CREATE TRIGGER packs_audit
  AFTER INSERT OR UPDATE OR DELETE ON packs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

- [ ] **Step 2: Apply migration to remote database**

Run: `npx supabase db push --linked`
Expected: Migration applies successfully.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts`
Expected: `lib/database.types.ts` now includes `packs` and `pack_items` table types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260409150000_create_packs.sql lib/database.types.ts
git commit -m "feat(packs): add packs and pack_items tables with RLS"
```

---

## Task 2: Frontend Types

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add Pack and PackItem types**

Add after the `FavoriteItem` type (after line 89):

```typescript
export interface PackItem {
  id: string;
  serviceId: string;
  serviceVariantId: string;
  serviceName: string;
  variantName: string;
  originalPrice: number;
  durationMinutes: number;
  sortOrder: number;
}

export interface Pack {
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
```

- [ ] **Step 2: Add pack fields to CartItem**

Add after the `originalItemId` field in the `CartItem` interface (after line 372):

```typescript
  packId?: string;
  packName?: string;
```

- [ ] **Step 3: Extend FavoriteItem union**

Change the `FavoriteItem` type (line 87-89) from:

```typescript
export type FavoriteItem =
  | { type: 'service'; service: Service; sortOrder: number }
  | { type: 'variant'; variant: ServiceVariant; parentService: Service; sortOrder: number };
```

To:

```typescript
export type FavoriteItem =
  | { type: 'service'; service: Service; sortOrder: number }
  | { type: 'variant'; variant: ServiceVariant; parentService: Service; sortOrder: number }
  | { type: 'pack'; pack: Pack; sortOrder: number };
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds (unused types are fine).

- [ ] **Step 5: Commit**

```bash
git add types.ts
git commit -m "feat(packs): add Pack, PackItem types and extend CartItem/FavoriteItem"
```

---

## Task 3: Pack Mappers

**Files:**
- Create: `modules/services/packMappers.ts`

- [ ] **Step 1: Create mappers file**

```typescript
import type { Pack, PackItem } from '../../types';

// Row shape returned by supabase query with joins
export interface PackRow {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  is_favorite: boolean;
  favorite_sort_order: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  pack_items: PackItemRow[];
}

export interface PackItemRow {
  id: string;
  pack_id: string;
  salon_id: string;
  service_id: string;
  service_variant_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  services: { name: string } | null;
  service_variants: {
    name: string;
    price: number;
    duration_minutes: number;
    deleted_at: string | null;
  } | null;
}

export function toPackItem(row: PackItemRow): PackItem {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceVariantId: row.service_variant_id,
    serviceName: row.services?.name ?? '',
    variantName: row.service_variants?.name ?? '',
    originalPrice: row.service_variants?.price ?? 0,
    durationMinutes: row.service_variants?.duration_minutes ?? 0,
    sortOrder: row.sort_order,
  };
}

export function toPack(row: PackRow): Pack {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: row.price,
    active: row.active,
    isFavorite: row.is_favorite,
    favoriteSortOrder: row.favorite_sort_order,
    sortOrder: row.sort_order,
    items: (row.pack_items ?? [])
      .map(toPackItem)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/packMappers.ts
git commit -m "feat(packs): add pack mappers for DB row to frontend type conversion"
```

---

## Task 4: Pack Expansion Utility

**Files:**
- Create: `modules/services/utils/packExpansion.ts`

- [ ] **Step 1: Create expandPack utility**

```typescript
import type { Pack, CartItem } from '../../../types';

/**
 * Expands a pack into individual CartItems with pro-rata discounted prices.
 * Each item gets: price = (variant.originalPrice / totalOriginal) * pack.price
 * Rounding remainder is applied to the most expensive item.
 */
export function expandPack(pack: Pack): CartItem[] {
  const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);

  if (totalOriginal === 0 || pack.items.length === 0) return [];

  const packId = crypto.randomUUID();

  // Calculate pro-rata prices, rounded to 2 decimals
  const items: CartItem[] = pack.items.map((item) => ({
    id: crypto.randomUUID(),
    referenceId: item.serviceVariantId,
    type: 'SERVICE' as const,
    name: item.serviceName,
    variantName: item.variantName,
    price: Math.round((item.originalPrice / totalOriginal) * pack.price * 100) / 100,
    originalPrice: item.originalPrice,
    quantity: 1,
    packId,
    packName: pack.name,
  }));

  // Fix rounding: apply cent difference to the most expensive item
  const roundedSum = items.reduce((sum, item) => sum + item.price, 0);
  const diff = Math.round((pack.price - roundedSum) * 100) / 100;

  if (diff !== 0) {
    // Find the item with the highest original price
    let maxIndex = 0;
    let maxPrice = 0;
    for (let i = 0; i < items.length; i++) {
      if (pack.items[i].originalPrice > maxPrice) {
        maxPrice = pack.items[i].originalPrice;
        maxIndex = i;
      }
    }
    items[maxIndex].price = Math.round((items[maxIndex].price + diff) * 100) / 100;
  }

  return items;
}

/**
 * Checks if a pack is valid (all items reference active, non-deleted services/variants).
 * Uses the joined data already present on PackItem (from the query).
 */
export function isPackValid(pack: Pack): boolean {
  return pack.items.length > 0 && pack.items.every(
    (item) => item.serviceName !== '' && item.variantName !== '' && item.originalPrice > 0
  );
}

/**
 * Calculates the discount percentage for display.
 */
export function getPackDiscount(pack: Pack): number {
  const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);
  if (totalOriginal === 0) return 0;
  return Math.round(((totalOriginal - pack.price) / totalOriginal) * 100);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/utils/packExpansion.ts
git commit -m "feat(packs): add expandPack utility with pro-rata pricing and rounding"
```

---

## Task 5: Zod Schema for Pack Form

**Files:**
- Create: `modules/services/packSchemas.ts`

- [ ] **Step 1: Create pack validation schema**

```typescript
import { z } from 'zod';

export const packSchema = z.object({
  name: z.string().min(1, 'Le nom du pack est requis'),
  description: z.string().optional(),
  price: z.number().gt(0, 'Le prix doit être supérieur à 0'),
  items: z.array(z.object({
    serviceId: z.string().min(1),
    serviceVariantId: z.string().min(1),
  })).min(1, 'Au moins un service est requis'),
});
```

- [ ] **Step 2: Commit**

```bash
git add modules/services/packSchemas.ts
git commit -m "feat(packs): add Zod validation schema for pack form"
```

---

## Task 6: usePacks Hook

**Files:**
- Create: `modules/services/hooks/usePacks.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useToast } from '../../../context/ToastContext';
import { toastOnError, toastOnSuccess } from '../../../hooks/useMutationToast';
import { toPack } from '../packMappers';
import { isPackValid } from '../utils/packExpansion';
import type { Pack } from '../../../types';

export function usePacks() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  useRealtimeSync('packs');
  useRealtimeSync('pack_items');

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ['packs', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data, error } = await supabase
        .from('packs')
        .select('*, pack_items(*, services(name), service_variants(name, price, duration_minutes, deleted_at))')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order');

      if (error) throw error;
      return (data ?? []).map(toPack);
    },
    enabled: !!salonId,
  });

  // Valid packs: all items reference active services/variants
  const validPacks = useMemo(
    () => packs.filter((p) => p.active && isPackValid(p)),
    [packs],
  );

  const addPackMutation = useMutation({
    mutationFn: async (pack: { name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
      if (!salonId) throw new Error('No salon');

      // Insert pack
      const { data: packRow, error: packError } = await supabase
        .from('packs')
        .insert({
          salon_id: salonId,
          name: pack.name,
          description: pack.description || null,
          price: pack.price,
        })
        .select('id')
        .single();

      if (packError) throw packError;

      // Insert pack items
      const itemRows = pack.items.map((item, i) => ({
        pack_id: packRow.id,
        salon_id: salonId,
        service_id: item.serviceId,
        service_variant_id: item.serviceVariantId,
        sort_order: i,
      }));

      const { error: itemsError } = await supabase
        .from('pack_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack créé avec succès')({ addToast });
    },
    onError: toastOnError('Erreur lors de la création du pack', addToast),
  });

  const updatePackMutation = useMutation({
    mutationFn: async (pack: { id: string; name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
      if (!salonId) throw new Error('No salon');

      // Update pack row
      const { error: packError } = await supabase
        .from('packs')
        .update({
          name: pack.name,
          description: pack.description || null,
          price: pack.price,
        })
        .eq('id', pack.id)
        .eq('salon_id', salonId);

      if (packError) throw packError;

      // Replace items: delete all then insert new
      const { error: deleteError } = await supabase
        .from('pack_items')
        .delete()
        .eq('pack_id', pack.id)
        .eq('salon_id', salonId);

      if (deleteError) throw deleteError;

      const itemRows = pack.items.map((item, i) => ({
        pack_id: pack.id,
        salon_id: salonId,
        service_id: item.serviceId,
        service_variant_id: item.serviceVariantId,
        sort_order: i,
      }));

      const { error: itemsError } = await supabase
        .from('pack_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack mis à jour')({ addToast });
    },
    onError: toastOnError('Erreur lors de la mise à jour du pack', addToast),
  });

  const deletePackMutation = useMutation({
    mutationFn: async (packId: string) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase
        .from('packs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', packId)
        .eq('salon_id', salonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack supprimé')({ addToast });
    },
    onError: toastOnError('Erreur lors de la suppression du pack', addToast),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ packId, active }: { packId: string; active: boolean }) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase
        .from('packs')
        .update({ active })
        .eq('id', packId)
        .eq('salon_id', salonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour', addToast),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ packId, isFavorite }: { packId: string; isFavorite: boolean }) => {
      if (!salonId) throw new Error('No salon');

      let favoriteOrder: number | null = null;
      if (isFavorite) {
        // Get max sort order across all favorite types
        const { data: maxPack } = await supabase
          .from('packs')
          .select('favorite_sort_order')
          .eq('salon_id', salonId)
          .eq('is_favorite', true)
          .order('favorite_sort_order', { ascending: false })
          .limit(1)
          .single();

        favoriteOrder = (maxPack?.favorite_sort_order ?? 0) + 1;
      }

      const { error } = await supabase
        .from('packs')
        .update({
          is_favorite: isFavorite,
          favorite_sort_order: isFavorite ? favoriteOrder : null,
        })
        .eq('id', packId)
        .eq('salon_id', salonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour', addToast),
  });

  return {
    packs,
    validPacks,
    isLoading,
    addPack: addPackMutation.mutate,
    updatePack: updatePackMutation.mutate,
    deletePack: deletePackMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    toggleFavorite: toggleFavoriteMutation.mutate,
    isAdding: addPackMutation.isPending,
    isUpdating: updatePackMutation.isPending,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. Note: if `toastOnSuccess`/`toastOnError` signatures don't match exactly, adapt to the pattern used in `useServices.ts`. Check `hooks/useMutationToast.ts` for the exact signature.

- [ ] **Step 3: Commit**

```bash
git add modules/services/hooks/usePacks.ts
git commit -m "feat(packs): add usePacks hook with CRUD, favorites, and realtime sync"
```

---

## Task 7: PackList Component

**Files:**
- Create: `modules/services/components/PackList.tsx`

- [ ] **Step 1: Create pack list component**

```typescript
import React from 'react';
import { Plus, Package, AlertTriangle, Star, Trash2, Edit3 } from 'lucide-react';
import type { Pack } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { isPackValid, getPackDiscount } from '../utils/packExpansion';

interface PackListProps {
  packs: Pack[];
  onAdd: () => void;
  onEdit: (pack: Pack) => void;
  onDelete: (packId: string) => void;
  onToggleActive: (packId: string, active: boolean) => void;
  onToggleFavorite?: (packId: string, isFavorite: boolean) => void;
}

export const PackList: React.FC<PackListProps> = ({
  packs,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFavorite,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Packs</h2>
          <p className="text-sm text-slate-500">{packs.length} pack{packs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Nouveau Pack
        </button>
      </div>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 mb-2">Aucun pack créé</p>
          <p className="text-sm text-slate-400">Créez des packs pour regrouper vos services avec un prix réduit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => {
            const valid = isPackValid(pack);
            const discount = getPackDiscount(pack);
            const totalOriginal = pack.items.reduce((s, i) => s + i.originalPrice, 0);

            return (
              <div
                key={pack.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  !pack.active ? 'opacity-60 border-slate-200' : valid ? 'border-slate-200 hover:border-slate-300' : 'border-amber-300 bg-amber-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{pack.name}</h3>
                      {!valid && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                          <AlertTriangle size={12} />
                          Invalide
                        </span>
                      )}
                      {discount > 0 && valid && (
                        <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                          -{discount}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {pack.items.length} service{pack.items.length !== 1 ? 's' : ''} · {formatPrice(totalOriginal)} → <span className="font-semibold text-slate-800">{formatPrice(pack.price)}</span>
                    </p>
                    {pack.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{pack.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {onToggleFavorite && (
                      <button
                        onClick={() => onToggleFavorite(pack.id, !pack.isFavorite)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        title={pack.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      >
                        <Star
                          size={16}
                          className={pack.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}
                        />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(pack)}
                      className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Edit3 size={16} className="text-slate-500" />
                    </button>
                    <button
                      onClick={() => onDelete(pack.id)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                    </button>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pack.active}
                        onChange={() => onToggleActive(pack.id, !pack.active)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/components/PackList.tsx
git commit -m "feat(packs): add PackList component for pack management UI"
```

---

## Task 8: PackForm Component

**Files:**
- Create: `modules/services/components/PackForm.tsx`

- [ ] **Step 1: Create pack form component**

```typescript
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Check, X, AlertTriangle } from 'lucide-react';
import type { Pack, Service, ServiceCategory } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { packSchema } from '../packSchemas';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { CategoryIcon } from '../../../lib/categoryIcons';

interface PackFormProps {
  existingPack?: Pack;
  services: Service[];
  categories: ServiceCategory[];
  onSave: (data: { id?: string; name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const PackForm: React.FC<PackFormProps> = ({
  existingPack,
  services,
  categories,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  const [name, setName] = useState(existingPack?.name ?? '');
  const [description, setDescription] = useState(existingPack?.description ?? '');
  const [price, setPrice] = useState(existingPack?.price?.toString() ?? '');
  const [selectedItems, setSelectedItems] = useState<Array<{ serviceId: string; serviceVariantId: string }>>(
    existingPack?.items.map((i) => ({ serviceId: i.serviceId, serviceVariantId: i.serviceVariantId })) ?? []
  );
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const { errors, validate, clearFieldError } = useFormValidation(packSchema);

  const activeServices = useMemo(
    () => services.filter((s) => s.active && s.variants.length > 0),
    [services],
  );

  const servicesByCategory = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const svc of activeServices) {
      const list = map.get(svc.categoryId) ?? [];
      list.push(svc);
      map.set(svc.categoryId, list);
    }
    return map;
  }, [activeServices]);

  const totalOriginal = useMemo(() => {
    let total = 0;
    for (const item of selectedItems) {
      const svc = services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.serviceVariantId);
      total += variant?.price ?? 0;
    }
    return total;
  }, [selectedItems, services]);

  const priceNum = parseFloat(price) || 0;
  const discountPercent = totalOriginal > 0 ? Math.round(((totalOriginal - priceNum) / totalOriginal) * 100) : 0;

  const isVariantSelected = (variantId: string) =>
    selectedItems.some((i) => i.serviceVariantId === variantId);

  const toggleVariant = (serviceId: string, variantId: string) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.serviceVariantId === variantId);
      if (exists) {
        return prev.filter((i) => i.serviceVariantId !== variantId);
      }
      return [...prev, { serviceId, serviceVariantId: variantId }];
    });
    clearFieldError('items');
  };

  const handleSubmit = () => {
    const formData = {
      name,
      description,
      price: priceNum,
      items: selectedItems,
    };
    const result = validate(formData);
    if (!result) return;

    onSave({
      id: existingPack?.id,
      name,
      description,
      price: priceNum,
      items: selectedItems,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-semibold text-slate-900">
          {existingPack ? 'Modifier le pack' : 'Nouveau pack'}
        </h2>
      </div>

      {/* Name & Description */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
            placeholder="Ex: Pack Mariée Complet"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optionnelle..."
            rows={2}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prix du pack *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => { setPrice(e.target.value); clearFieldError('price'); }}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.price ? 'border-red-400' : 'border-slate-200'}`}
          />
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
        </div>
      </div>

      {/* Price summary */}
      {selectedItems.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Prix original total</span>
            <span className="text-slate-700">{formatPrice(totalOriginal)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Prix du pack</span>
            <span className="font-semibold text-slate-900">{formatPrice(priceNum)}</span>
          </div>
          {priceNum > 0 && totalOriginal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Réduction</span>
              <span className={`font-semibold ${discountPercent > 0 ? 'text-emerald-600' : discountPercent < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                {discountPercent > 0 ? `-${discountPercent}%` : discountPercent < 0 ? `+${Math.abs(discountPercent)}%` : '0%'}
              </span>
            </div>
          )}
          {priceNum >= totalOriginal && priceNum > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
              <AlertTriangle size={12} />
              Le prix du pack est supérieur ou égal au prix total des services
            </div>
          )}
        </div>
      )}

      {/* Service picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Services inclus * <span className="text-slate-400 font-normal">({selectedItems.length} sélectionné{selectedItems.length !== 1 ? 's' : ''})</span>
        </label>
        {errors.items && <p className="text-xs text-red-500 mb-2">{errors.items}</p>}

        <div className="space-y-2">
          {categories.map((cat) => {
            const catServices = servicesByCategory.get(cat.id) ?? [];
            if (catServices.length === 0) return null;
            const isExpanded = expandedCategoryId === cat.id;
            const selectedInCat = selectedItems.filter((i) =>
              catServices.some((s) => s.id === i.serviceId)
            ).length;

            return (
              <div key={cat.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={16} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-900">{cat.name}</span>
                    {selectedInCat > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{selectedInCat}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{catServices.length} service{catServices.length > 1 ? 's' : ''}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
                    {catServices.map((svc) => (
                      <div key={svc.id}>
                        <p className="text-xs font-medium text-slate-600 mb-1.5 px-1">{svc.name}</p>
                        <div className="space-y-1">
                          {svc.variants.map((variant) => {
                            const selected = isVariantSelected(variant.id);
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() => toggleVariant(svc.id, variant.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                  selected
                                    ? 'bg-blue-50 border border-blue-300 text-blue-900'
                                    : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    selected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                                  }`}>
                                    {selected && <Check size={12} className="text-white" />}
                                  </div>
                                  <span>{variant.name}</span>
                                  <span className="text-xs text-slate-400">{formatDuration(variant.durationMinutes)}</span>
                                </div>
                                <span className="font-medium">{formatPrice(variant.price)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement...' : existingPack ? 'Mettre à jour' : 'Créer le pack'}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/components/PackForm.tsx
git commit -m "feat(packs): add PackForm component with service picker and discount preview"
```

---

## Task 9: Wire Packs into ServicesModule

**Files:**
- Modify: `modules/services/ServicesModule.tsx`

- [ ] **Step 1: Add packs tab and state management**

Replace the entire content of `ServicesModule.tsx` with:

```typescript
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ViewState, Service, Pack } from '../../types';
import { useServices } from './hooks/useServices';
import { usePacks } from './hooks/usePacks';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ServiceList } from './components/ServiceList';
import { ServiceForm } from './components/ServiceForm';
import { PackList } from './components/PackList';
import { PackForm } from './components/PackForm';

type ServicesTab = 'SERVICES' | 'PACKS';

export const ServicesModule: React.FC = () => {
  const {
    services,
    serviceCategories,
    isLoading: servicesLoading,
    searchTerm,
    setSearchTerm,
    addService,
    updateService,
    deleteService,
    toggleFavorite,
  } = useServices();
  const {
    packs,
    isLoading: packsLoading,
    addPack,
    updatePack,
    deletePack,
    toggleActive,
    toggleFavorite: togglePackFavorite,
    isAdding,
    isUpdating,
  } = usePacks();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditServices = can('edit', 'services');

  const [activeTab, setActiveTab] = useState<ServicesTab>('SERVICES');
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const handleEdit = (id: string) => {
    setSelectedServiceId(id);
    setView('EDIT');
  };

  const handleAdd = () => {
    setSelectedServiceId(null);
    setView('ADD');
  };

  const handleSaveService = (service: Service) => {
    if (selectedServiceId) {
      updateService(service);
    } else {
      addService(service);
    }
    setView('LIST');
  };

  const handleAddPack = () => {
    setSelectedPack(null);
    setView('ADD');
  };

  const handleEditPack = (pack: Pack) => {
    setSelectedPack(pack);
    setView('EDIT');
  };

  const handleSavePack = (data: { id?: string; name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
    if (data.id) {
      updatePack({ id: data.id, ...data });
    } else {
      addPack(data);
    }
    setView('LIST');
  };

  if (servicesLoading || packsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  // Show form views (no tabs)
  if (view !== 'LIST') {
    if (activeTab === 'PACKS') {
      return (
        <div className="w-full">
          <PackForm
            existingPack={selectedPack ?? undefined}
            services={services}
            categories={serviceCategories}
            onSave={handleSavePack}
            onCancel={() => setView('LIST')}
            isSaving={isAdding || isUpdating}
          />
        </div>
      );
    }
    return (
      <div className="w-full">
        <ServiceForm
          existingService={services.find(s => s.id === selectedServiceId)}
          categories={serviceCategories}
          onSave={handleSaveService}
          onDelete={(id) => { deleteService(id); setView('LIST'); }}
          onCancel={() => setView('LIST')}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => { setActiveTab('SERVICES'); setView('LIST'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Services
        </button>
        <button
          onClick={() => { setActiveTab('PACKS'); setView('LIST'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'PACKS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Packs
        </button>
      </div>

      {activeTab === 'SERVICES' && (
        <ServiceList
          services={services}
          categories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onToggleFavorite={canEditServices ? (type, id, isFavorite) => toggleFavorite({ type, id, isFavorite }) : undefined}
        />
      )}

      {activeTab === 'PACKS' && (
        <PackList
          packs={packs}
          onAdd={handleAddPack}
          onEdit={handleEditPack}
          onDelete={(id) => deletePack(id)}
          onToggleActive={(id, active) => toggleActive({ packId: id, active })}
          onToggleFavorite={canEditServices ? (id, isFavorite) => togglePackFavorite({ packId: id, isFavorite }) : undefined}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Verify dev server**

Run: `npm run dev`
Navigate to Services page. The Services/Packs tab switcher should appear. Clicking Packs should show empty state.

- [ ] **Step 4: Commit**

```bash
git add modules/services/ServicesModule.tsx
git commit -m "feat(packs): wire packs tab into ServicesModule with CRUD flow"
```

---

## Task 10: POS — Add Packs Tab and Cart Expansion

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`
- Modify: `modules/pos/POSModule.tsx`
- Modify: `modules/pos/components/POSCatalog.tsx`

- [ ] **Step 1: Fix addToCart deduplication in usePOS.ts**

In `modules/pos/hooks/usePOS.ts`, replace the `addToCart` function (lines 60-78) with:

```typescript
const addToCart = (item: CartItem) => {
  const itemWithMeta = {
    ...item,
    originalPrice: item.originalPrice ?? item.price // Store reference for discounts
  };

  setCart(prev => {
    // Pack items always append (never merge) to preserve pro-rata pricing
    if (item.packId) {
      return [...prev, itemWithMeta];
    }

    const existingItemIndex = prev.findIndex(
      i => i.referenceId === item.referenceId && i.variantName === item.variantName && !i.packId
    );

    if (existingItemIndex >= 0) {
      return prev.map((existing, i) =>
        i === existingItemIndex ? { ...existing, quantity: existing.quantity + 1 } : existing
      );
    }
    return [...prev, itemWithMeta];
  });
};
```

- [ ] **Step 2: Add pack expansion handler in POSModule.tsx**

In `modules/pos/POSModule.tsx`, add imports at the top:

```typescript
import { usePacks } from '../services/hooks/usePacks';
import { expandPack } from '../services/utils/packExpansion';
import type { Pack } from '../../types';
```

Inside the component, after the existing hooks, add:

```typescript
const { validPacks } = usePacks();
```

Add a handler for pack selection (after `handleProductClick`):

```typescript
const handlePackClick = (pack: Pack) => {
  const items = expandPack(pack);
  items.forEach((item) => addToCart(item));
};
```

In the `POSCatalog` render, add the new props:

```typescript
packs={validPacks}
onPackClick={handlePackClick}
```

- [ ] **Step 3: Add Packs tab to POSCatalog.tsx**

In `modules/pos/components/POSCatalog.tsx`:

Add to the interface `POSCatalogProps`:

```typescript
packs: import('../../../types').Pack[];
onPackClick: (pack: import('../../../types').Pack) => void;
```

Add to the destructured props:

```typescript
packs,
onPackClick,
```

Add the import at top:

```typescript
import { getPackDiscount } from '../../services/utils/packExpansion';
import { Package } from 'lucide-react';
```

In the category tabs area (after the Favorites button, before the ALL button, around line 141), add:

```typescript
{viewMode === 'SERVICES' && packs.length > 0 && (
  <button
    onClick={() => setSelectedCategory('PACKS')}
    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border shrink-0 ${
      selectedCategory === 'PACKS'
        ? 'bg-emerald-500 text-white border-emerald-500'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`}
    style={{ scrollSnapAlign: 'start' }}
  >
    <Package size={14} />
    Packs
  </button>
)}
```

In the content area (inside the grid div, before `{selectedCategory !== 'FAVORITES' && filteredItems.map(...)}`), add pack card rendering:

```typescript
{selectedCategory === 'PACKS' && packs.map((pack) => {
  const discount = getPackDiscount(pack);
  return (
    <button
      key={`pack-${pack.id}`}
      onClick={() => onPackClick(pack)}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
      <div className="flex-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-emerald-100 text-emerald-800 border-emerald-200">
          <Package size={10} />
          Pack
        </span>
        <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
          {pack.name}
        </h3>
        <span className="text-xs text-slate-400">
          {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-auto flex justify-between items-end">
        <div>
          <span className="text-lg font-bold text-slate-800">{formatPrice(pack.price)}</span>
          {discount > 0 && (
            <span className="ml-1.5 text-xs text-emerald-600 font-medium">-{discount}%</span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
          <Plus size={18} />
        </div>
      </div>
    </button>
  );
})}
```

Also, hide the regular items grid when PACKS is selected by changing the condition from:

```typescript
{selectedCategory !== 'FAVORITES' && filteredItems.map((item) => {
```

To:

```typescript
{selectedCategory !== 'FAVORITES' && selectedCategory !== 'PACKS' && filteredItems.map((item) => {
```

- [ ] **Step 4: Verify build and test in browser**

Run: `npm run build`
Expected: Build succeeds.

Test in browser: Create a pack in Services > Packs, then go to POS. "Packs" tab should appear. Clicking a pack should add expanded items to the cart.

- [ ] **Step 5: Commit**

```bash
git add modules/pos/hooks/usePOS.ts modules/pos/POSModule.tsx modules/pos/components/POSCatalog.tsx
git commit -m "feat(packs): add Packs tab to POS catalog with cart expansion"
```

---

## Task 11: POS Cart — Visual Pack Grouping

**Files:**
- Modify: `modules/pos/components/POSCart.tsx`

- [ ] **Step 1: Add visual grouping for pack items**

This task modifies the cart rendering loop to group items sharing the same `packId`. Read the current `POSCart.tsx` fully before editing.

In the cart items rendering section, wrap the existing `cart.map(...)` with grouping logic. Before the map, compute groups:

```typescript
// Group pack items together for visual grouping
const cartWithGroups = useMemo(() => {
  const groups: Array<{ packId?: string; packName?: string; items: typeof cart }> = [];
  const packMap = new Map<string, typeof cart>();
  const standalone: typeof cart = [];

  for (const item of cart) {
    if (item.packId) {
      const existing = packMap.get(item.packId) ?? [];
      existing.push(item);
      packMap.set(item.packId, existing);
    } else {
      standalone.push(item);
    }
  }

  // Interleave: maintain original order, group pack items at first occurrence
  const seenPacks = new Set<string>();
  for (const item of cart) {
    if (item.packId) {
      if (!seenPacks.has(item.packId)) {
        seenPacks.add(item.packId);
        groups.push({
          packId: item.packId,
          packName: item.packName,
          items: packMap.get(item.packId) ?? [],
        });
      }
    } else {
      groups.push({ items: [item] });
    }
  }
  return groups;
}, [cart]);
```

Then replace the `cart.map(item => ...)` rendering with:

```typescript
{cartWithGroups.map((group) => (
  <div key={group.packId ?? group.items[0]?.id}>
    {group.packId && (
      <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 border-l-2 border-emerald-400 rounded-t-lg">
        <span className="text-xs font-medium text-emerald-700">Pack: {group.packName}</span>
        <button
          onClick={() => {
            // Remove all items in this pack
            group.items.forEach((item) => onRemoveFromCart(item.id));
          }}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
        >
          Supprimer le pack
        </button>
      </div>
    )}
    {group.items.map((item) => (
      // ... existing item rendering code, unchanged
    ))}
  </div>
))}
```

Import `useMemo` if not already imported.

- [ ] **Step 2: Verify build and test**

Run: `npm run build`
Test: Add a pack in POS. Items should appear grouped with a green "Pack: {name}" header.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/POSCart.tsx
git commit -m "feat(packs): add visual pack grouping with remove-pack action in POS cart"
```

---

## Task 12: Favorites — Include Packs

**Files:**
- Modify: `modules/services/hooks/useServices.ts`

- [ ] **Step 1: Extend favorites derivation to include packs**

In `modules/services/hooks/useServices.ts`, the `favorites` useMemo (around line 265) currently only includes services and variants. It needs an additional parameter: `packs`.

Add a parameter to the hook's return or accept packs externally. Since `useServices` doesn't own packs data, the simplest approach is to compute pack favorites in `usePOS.ts` and merge them when building the favorites list.

In `modules/pos/POSModule.tsx`, where `favorites` is passed to `POSCatalog`, merge pack favorites:

```typescript
const allFavorites = useMemo(() => {
  const packFavs: FavoriteItem[] = validPacks
    .filter((p) => p.isFavorite)
    .map((p) => ({ type: 'pack' as const, pack: p, sortOrder: p.favoriteSortOrder ?? 0 }));

  return [...favorites, ...packFavs].sort((a, b) => a.sortOrder - b.sortOrder);
}, [favorites, validPacks]);
```

Pass `allFavorites` instead of `favorites` to `POSCatalog`.

- [ ] **Step 2: Handle pack favorites in POSCatalog rendering**

In `modules/pos/components/POSCatalog.tsx`, in the favorites rendering section (inside `{selectedCategory === 'FAVORITES' && favorites.map(fav => {...})}`), add a case for pack favorites:

After the variant and service favorite cases, add:

```typescript
if (fav.type === 'pack') {
  const pack = fav.pack;
  const discount = getPackDiscount(pack);
  return (
    <button
      key={`fav-pack-${pack.id}`}
      onClick={() => onPackClick(pack)}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
      <div className="flex-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-emerald-100 text-emerald-800 border-emerald-200">
          <Package size={10} />
          Pack
        </span>
        <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
          {pack.name}
        </h3>
        <span className="text-xs text-slate-400">
          {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-auto flex justify-between items-end">
        <div>
          <span className="text-lg font-bold text-slate-800">{formatPrice(pack.price)}</span>
          {discount > 0 && (
            <span className="ml-1.5 text-xs text-emerald-600 font-medium">-{discount}%</span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
          <Plus size={18} />
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Verify build and test**

Run: `npm run build`
Test: Mark a pack as favorite in Services > Packs. Go to POS. Favorites tab should show the pack alongside service favorites.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/POSModule.tsx modules/pos/components/POSCatalog.tsx
git commit -m "feat(packs): include packs in POS favorites tab"
```

---

## Task 13: Appointments — Add Packs Tab to Desktop Builder

**Files:**
- Modify: `types.ts` (add `priceOverride` to `ServiceBlockState`)
- Modify: `modules/appointments/hooks/useAppointmentForm.ts`
- Modify: `modules/appointments/components/ServiceBlock.tsx`

- [ ] **Step 1: Add priceOverride to ServiceBlockState**

In `types.ts`, add `priceOverride` to the `ServiceBlockState` interface (around line 347):

```typescript
export interface ServiceBlockState {
  id: string;
  categoryId: string | null;
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
  priceOverride?: number; // Used by pack items for pro-rata discounted price
}
```

- [ ] **Step 2: Add addPackBlocks to useAppointmentForm**

In `modules/appointments/hooks/useAppointmentForm.ts`, add to imports:

```typescript
import type { Pack } from '../../../types';
```

Add a new action `addPackBlocks` after the `addBlock` callback (around line 221):

```typescript
const addPackBlocks = useCallback((pack: Pack) => {
  const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);
  if (totalOriginal === 0 || pack.items.length === 0) return;

  // Compute pro-rata prices with rounding fix
  const proRataPrices = pack.items.map((item) =>
    Math.round((item.originalPrice / totalOriginal) * pack.price * 100) / 100
  );
  const roundedSum = proRataPrices.reduce((s, p) => s + p, 0);
  const diff = Math.round((pack.price - roundedSum) * 100) / 100;
  if (diff !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < pack.items.length; i++) {
      if (pack.items[i].originalPrice > pack.items[maxIdx].originalPrice) maxIdx = i;
    }
    proRataPrices[maxIdx] = Math.round((proRataPrices[maxIdx] + diff) * 100) / 100;
  }

  setServiceBlocks((prev) => {
    // Remove the last empty block if it's the only one and hasn't been filled
    const base = prev.length === 1 && !prev[0].serviceId ? [] : prev;
    const lastBlock = base[base.length - 1];
    const lastDate = lastBlock?.date ?? null;

    const newBlocks: ServiceBlockState[] = pack.items.map((item, i) => ({
      id: crypto.randomUUID(),
      categoryId: null,
      serviceId: item.serviceId,
      variantId: item.serviceVariantId,
      staffId: null,
      date: lastDate,
      hour: null,
      minute: 0,
      priceOverride: proRataPrices[i],
    }));

    setActiveBlockIndex(base.length);
    return [...base, ...newBlocks];
  });
}, []);
```

Add `addPackBlocks` to the return object (in the Actions section):

```typescript
addPackBlocks,
```

Add it to the `AppointmentFormReturn` interface:

```typescript
addPackBlocks: (pack: Pack) => void;
```

Also update the `totalPrice` useMemo to respect `priceOverride` (around line 180):

Change:
```typescript
return sum + (variant?.price ?? svc?.price ?? 0);
```
To:
```typescript
return sum + (b.priceOverride ?? variant?.price ?? svc?.price ?? 0);
```

And update the save payload in `handleSubmit` (around line 297):

Change:
```typescript
price: variant?.price ?? svc?.price ?? 0,
```
To:
```typescript
price: b.priceOverride ?? variant?.price ?? svc?.price ?? 0,
```

- [ ] **Step 2: Add Packs tab to ServiceBlock**

In `modules/appointments/components/ServiceBlock.tsx`, add props for packs:

```typescript
import type { Pack } from '../../../types';
import { formatPrice as fmtPrice } from '../../../lib/format';
import { getPackDiscount } from '../../services/utils/packExpansion';
import { Package } from 'lucide-react';
```

Add to `ServiceBlockProps`:

```typescript
packs?: Pack[];
onAddPackBlocks?: (pack: Pack) => void;
```

Add destructured props:

```typescript
packs = [],
onAddPackBlocks,
```

In the category pills area (where Favorites and category buttons are rendered), add a Packs pill after Favorites:

```typescript
{packs.length > 0 && (
  <button
    type="button"
    onClick={() => handleCategoryChange('PACKS')}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
      activeCategoryId === 'PACKS'
        ? 'bg-emerald-500 text-white'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}
  >
    <Package size={12} />
    Packs
  </button>
)}
```

Add a packs grid section (when `activeCategoryId === 'PACKS'`), alongside the existing favorites and service rendering:

```typescript
{activeCategoryId === 'PACKS' && (
  <div className="grid grid-cols-2 gap-2 mt-3">
    {packs.map((pack) => {
      const discount = getPackDiscount(pack);
      return (
        <button
          key={pack.id}
          type="button"
          onClick={() => onAddPackBlocks?.(pack)}
          className="bg-white p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
        >
          <div className="text-xs text-emerald-600 font-medium mb-1">
            {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
            {discount > 0 && ` · -${discount}%`}
          </div>
          <div className="text-sm font-medium text-slate-900 truncate">{pack.name}</div>
          <div className="text-sm font-semibold text-slate-700 mt-1">{fmtPrice(pack.price)}</div>
        </button>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Pass packs props through AppointmentBuilder**

In `modules/appointments/components/AppointmentBuilder.tsx`, where `ServiceBlock` is rendered (around line 75), add the packs props:

```typescript
packs={hookProps.packs ?? []}
onAddPackBlocks={form.addPackBlocks}
```

The `hookProps` will need `packs` — this comes from the page component that provides the hook props. Check where `AppointmentBuilder` receives its props and add `packs` from `usePacks().validPacks`.

In the appointment new/edit pages, add:

```typescript
import { usePacks } from '../../services/hooks/usePacks';
// ...
const { validPacks } = usePacks();
```

And pass `packs: validPacks` in the hookProps.

- [ ] **Step 4: Verify build and test**

Run: `npm run build`
Test: Go to new appointment. "Packs" pill should appear in the service selector. Clicking a pack should add all its services as separate blocks.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/components/ServiceBlock.tsx modules/appointments/components/AppointmentBuilder.tsx modules/appointments/hooks/useAppointmentForm.ts
git commit -m "feat(packs): add Packs tab to desktop appointment builder"
```

---

## Task 14: Appointments — Add Packs Tab to Mobile Builder

**Files:**
- Modify: `modules/appointments/components/MobileServicePicker.tsx`
- Modify: `modules/appointments/components/AppointmentBuilderMobile.tsx`

- [ ] **Step 1: Add Packs pill to MobileServicePicker**

In `modules/appointments/components/MobileServicePicker.tsx`, add to imports:

```typescript
import type { Pack } from '../../../types';
import { getPackDiscount } from '../../services/utils/packExpansion';
import { Package } from 'lucide-react';
```

Add to `MobileServicePickerProps`:

```typescript
packs?: Pack[];
onPackSelect?: (pack: Pack) => void;
```

Add to destructured props:

```typescript
packs = [],
onPackSelect,
```

Add Packs pill after Favorites pill in category pills section (after line 93):

```typescript
{packs.length > 0 && (
  <button
    type="button"
    onClick={() => handleCategoryTap('PACKS')}
    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
      activeCategoryId === 'PACKS'
        ? 'bg-emerald-500 text-white shadow-sm'
        : 'bg-slate-100 text-slate-600'
    }`}
  >
    <Package size={14} className={activeCategoryId === 'PACKS' ? 'text-white' : 'text-slate-500'} />
    Packs
  </button>
)}
```

Add packs list rendering (after the favorites list section, before the service list section):

```typescript
{activeCategoryId === 'PACKS' && (
  <div className="flex flex-col gap-2">
    {packs.map((pack) => {
      const discount = getPackDiscount(pack);
      return (
        <button
          key={pack.id}
          type="button"
          onClick={() => {
            onPackSelect?.(pack);
            onClose();
          }}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-slate-200 min-h-[52px] transition-colors active:bg-emerald-50"
        >
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">{pack.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
              {discount > 0 && ` · -${discount}%`}
            </div>
          </div>
          <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">
            {formatPrice(pack.price)}
          </span>
        </button>
      );
    })}
  </div>
)}
```

- [ ] **Step 2: Wire packs in AppointmentBuilderMobile**

In `modules/appointments/components/AppointmentBuilderMobile.tsx`, where `MobileServicePicker` is rendered, add:

```typescript
packs={hookProps.packs ?? []}
onPackSelect={(pack) => {
  form.addPackBlocks(pack);
  setServiceSheetOpen(false);
}}
```

- [ ] **Step 3: Verify build and test on mobile viewport**

Run: `npm run build`
Test: On mobile viewport, create new appointment. Open service picker. "Packs" pill should appear. Selecting a pack should add all its services as blocks.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/MobileServicePicker.tsx modules/appointments/components/AppointmentBuilderMobile.tsx
git commit -m "feat(packs): add Packs tab to mobile appointment builder"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 2: End-to-end manual test checklist**

1. Services > Packs: Create a pack with 2-3 services, verify discount calculation displays
2. Services > Packs: Edit the pack, change items and price, verify update
3. Services > Packs: Toggle active off/on, toggle favorite
4. POS: "Packs" tab appears, shows the pack with discount badge
5. POS: Click pack → items expand into cart with pro-rata prices, grouped visually
6. POS: Verify pack sum equals pack price exactly (rounding)
7. POS: Add same variant individually AND via pack → separate cart entries (no merge)
8. POS: "Remove pack" button removes all pack items
9. POS: Complete a transaction with a pack → items appear as real services in transaction history
10. POS Favorites: Mark pack as favorite → appears in Favorites tab
11. Appointments (desktop): "Packs" pill appears in service selector, clicking adds blocks
12. Appointments (mobile): Same as above in mobile viewport
13. Dashboard: Transaction from pack shows real service names, not "Pack Promos"

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(packs): complete packs/bundles feature implementation"
```
