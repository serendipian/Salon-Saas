# Service Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a favorites feature to services/variants so staff can quickly select commonly requested services in appointments and POS.

**Architecture:** New `is_favorite` + `favorite_sort_order` columns on `services` and `service_variants` tables. A `reorder_favorites` RPC for atomic reordering. Frontend extends existing `useServices` hook with derived `favorites` list and new mutations. Consumption UIs (appointments, POS) add a "Favoris" tab as the first filter option.

**Tech Stack:** Supabase (PostgreSQL migration + RPC), React, TypeScript, TanStack Query, Tailwind CSS, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-09-service-favorites-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260409100000_service_favorites.sql` | Add columns + RPC |
| Modify | `types.ts:48-81` | Add `isFavorite`/`favoriteSortOrder` to `Service` and `ServiceVariant`, add `FavoriteItem` type |
| Modify | `modules/services/mappers.ts:3-16,45-67` | Extend row interfaces + read mappers |
| Modify | `modules/services/hooks/useServices.ts` | Add `favorites` derived data, `toggleFavorite`, `reorderFavorites` mutations |
| Create | `modules/services/components/FavoritesTab.tsx` | Settings tab for managing favorites + ordering |
| Modify | `modules/services/ServiceSettingsPage.tsx` | Add "Favoris" tab alongside Categories/General |
| Modify | `modules/services/components/ServiceCard.tsx` | Add star toggle icon on cards |
| Modify | `modules/services/components/ServiceList.tsx` | Pass `toggleFavorite` + permission down to cards |
| Modify | `modules/services/ServicesModule.tsx` | Pass `toggleFavorite` through to ServiceList |
| Modify | `modules/appointments/components/ServiceBlock.tsx:35-40,154-173` | Add Favoris tab, handle FavoriteItem selection |
| Modify | `modules/appointments/components/ServiceGrid.tsx` | Render FavoriteItem variant cards |
| Modify | `modules/appointments/components/MobileServicePicker.tsx:22-29,77-99` | Add Favoris pill + rendering |
| Modify | `modules/pos/hooks/usePOS.ts:29,106-123` | Expose favorites, add FAVORITES filter |
| Modify | `modules/pos/components/POSCatalog.tsx:158-181` | Add Favoris filter button + rendering |

---

### Task 1: Database Migration — Columns + RPC

**Files:**
- Create: `supabase/migrations/20260409100000_service_favorites.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add favorite columns to services
ALTER TABLE services
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN favorite_sort_order INTEGER NOT NULL DEFAULT 0;

-- Add favorite columns to service_variants
ALTER TABLE service_variants
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN favorite_sort_order INTEGER NOT NULL DEFAULT 0;

-- RPC: Atomically reorder favorites across both tables
CREATE OR REPLACE FUNCTION reorder_favorites(
  p_salon_id UUID,
  p_items JSONB  -- array of { "type": "service"|"variant", "id": UUID, "sort_order": int }
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- Permission check: caller must be owner or manager of this salon
  IF p_salon_id NOT IN (SELECT unnest(user_salon_ids_with_role(ARRAY['owner', 'manager']))) THEN
    RAISE EXCEPTION 'Permission denied: owner or manager role required';
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'type') = 'service' THEN
      UPDATE services
      SET favorite_sort_order = (v_item->>'sort_order')::INTEGER,
          updated_at = now()
      WHERE id = (v_item->>'id')::UUID
        AND salon_id = p_salon_id;
    ELSIF (v_item->>'type') = 'variant' THEN
      UPDATE service_variants
      SET favorite_sort_order = (v_item->>'sort_order')::INTEGER,
          updated_at = now()
      WHERE id = (v_item->>'id')::UUID
        AND salon_id = p_salon_id;
    END IF;
  END LOOP;
END;
$$;
```

- [ ] **Step 2: Apply the migration to the remote database**

Run: `npx supabase db push --linked`

Expected: Migration applied successfully. Both tables now have `is_favorite` and `favorite_sort_order` columns.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts`

Expected: `database.types.ts` updated with new columns on both tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260409100000_service_favorites.sql lib/database.types.ts
git commit -m "feat: add favorite columns and reorder_favorites RPC for services"
```

---

### Task 2: Types + Mappers

**Files:**
- Modify: `types.ts:48-55` (ServiceVariant), `types.ts:72-81` (Service)
- Modify: `modules/services/mappers.ts:3-16,45-67`

- [ ] **Step 1: Extend ServiceVariant type**

In `types.ts`, add two fields to `ServiceVariant` (after `additionalCost`):

```typescript
export interface ServiceVariant {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  cost: number;
  additionalCost: number;
  isFavorite: boolean;
  favoriteSortOrder: number;
}
```

- [ ] **Step 2: Extend Service type**

In `types.ts`, add two fields to `Service` (after `active`):

```typescript
export interface Service {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  variants: ServiceVariant[];
  active: boolean;
  isFavorite: boolean;
  favoriteSortOrder: number;
  price?: number;
  durationMinutes?: number;
}
```

- [ ] **Step 3: Add FavoriteItem type**

In `types.ts`, after the `Service` interface (after `durationMinutes?: number; }`), add:

```typescript
export type FavoriteItem =
  | { type: 'service'; service: Service; sortOrder: number }
  | { type: 'variant'; variant: ServiceVariant; parentService: Service; sortOrder: number };
```

- [ ] **Step 4: Extend mapper row interfaces**

In `modules/services/mappers.ts`, add to `ServiceVariantRow` (after `deleted_at`):

```typescript
interface ServiceVariantRow {
  id: string;
  service_id: string;
  salon_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  cost: number;
  additional_cost: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_favorite: boolean;
  favorite_sort_order: number;
}
```

Add to `ServiceRow` (after `deleted_at`, before `service_variants?`):

```typescript
interface ServiceRow {
  id: string;
  salon_id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  is_favorite: boolean;
  favorite_sort_order: number;
  service_variants?: ServiceVariantRow[];
}
```

- [ ] **Step 5: Extend read mappers**

In `toServiceVariant()`, add the two new fields:

```typescript
export function toServiceVariant(row: ServiceVariantRow): ServiceVariant {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    price: row.price,
    cost: row.cost,
    additionalCost: row.additional_cost,
    isFavorite: row.is_favorite,
    favoriteSortOrder: row.favorite_sort_order,
  };
}
```

In `toService()`, add the two new fields:

```typescript
export function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id ?? '',
    description: row.description ?? '',
    variants: (row.service_variants ?? [])
      .filter(v => !v.deleted_at)
      .map(toServiceVariant),
    active: row.active,
    isFavorite: row.is_favorite,
    favoriteSortOrder: row.favorite_sort_order,
  };
}
```

**Note:** `toServiceInsert` and `toVariantInsert` are NOT modified — favorites are managed through dedicated mutations.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build 2>&1 | head -50`

Expected: TypeScript compilation errors in downstream components that now need to provide `isFavorite`/`favoriteSortOrder` when constructing Service/ServiceVariant objects. Note which files need fixing — these will be addressed in Task 3.

- [ ] **Step 7: Fix compilation — default values for new required fields**

Any place that constructs a `Service` or `ServiceVariant` object manually (e.g., in form defaults, tests, or seed data) must now include `isFavorite: false` and `favoriteSortOrder: 0`. Check the build errors from Step 6 and add defaults where needed. Common locations:

- `modules/services/components/ServiceForm.tsx` — new service/variant defaults
- Any other component constructing Service/ServiceVariant objects directly

For each location, add `isFavorite: false, favoriteSortOrder: 0` to the object literal.

- [ ] **Step 8: Verify build passes**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add types.ts modules/services/mappers.ts
git add -u  # any files fixed in step 7
git commit -m "feat: add favorite fields to Service/ServiceVariant types and mappers"
```

---

### Task 3: Hook — Derived Favorites + Mutations

**Files:**
- Modify: `modules/services/hooks/useServices.ts`

- [ ] **Step 1: Add FavoriteItem import and favorites derived data**

At the top of `useServices.ts`, update the type import:

```typescript
import type { Service, ServiceCategory, FavoriteItem } from '../../../types';
```

After the `filteredServices` useMemo (line 209), add the `favorites` computation:

```typescript
  const favorites = useMemo<FavoriteItem[]>(() => {
    const items: FavoriteItem[] = [];
    const favoritedServiceIds = new Set<string>();

    // 1. Collect favorited services
    for (const service of services) {
      if (service.isFavorite) {
        favoritedServiceIds.add(service.id);
        items.push({ type: 'service', service, sortOrder: service.favoriteSortOrder });
      }
    }

    // 2. Collect favorited variants (dedup: skip if parent service is favorited)
    for (const service of services) {
      if (favoritedServiceIds.has(service.id)) continue;
      for (const variant of service.variants) {
        if (variant.isFavorite) {
          items.push({ type: 'variant', variant, parentService: service, sortOrder: variant.favoriteSortOrder });
        }
      }
    }

    // 3. Sort by sortOrder
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    return items;
  }, [services]);
```

- [ ] **Step 2: Add toggleFavorite mutation**

After the `updateServiceCategoriesMutation`, add:

```typescript
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ type, id, isFavorite }: { type: 'service' | 'variant'; id: string; isFavorite: boolean }) => {
      const table = type === 'service' ? 'services' : 'service_variants';

      // Compute next sort order when favoriting
      let sortOrder = 0;
      if (isFavorite) {
        let maxOrder = 0;
        for (const s of services) {
          if (s.isFavorite) maxOrder = Math.max(maxOrder, s.favoriteSortOrder);
          for (const v of s.variants) {
            if (v.isFavorite) maxOrder = Math.max(maxOrder, v.favoriteSortOrder);
          }
        }
        sortOrder = maxOrder + 1;
      }

      const { error } = await supabase
        .from(table)
        .update({
          is_favorite: isFavorite,
          favorite_sort_order: isFavorite ? sortOrder : 0,
        })
        .eq('id', id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
    },
    onError: toastOnError('Impossible de modifier le favori'),
  });
```

- [ ] **Step 3: Add reorderFavorites mutation**

After the `toggleFavoriteMutation`, add:

```typescript
  const reorderFavoritesMutation = useMutation({
    mutationFn: async (items: { type: 'service' | 'variant'; id: string; sortOrder: number }[]) => {
      const p_items = items.map(item => ({
        type: item.type,
        id: item.id,
        sort_order: item.sortOrder,
      }));
      const { error } = await supabase.rpc('reorder_favorites', {
        p_salon_id: salonId,
        p_items: p_items,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Ordre des favoris enregistré')();
    },
    onError: toastOnError("Impossible de réordonner les favoris"),
  });
```

- [ ] **Step 4: Expose new data and mutations in the return object**

Update the return statement to include:

```typescript
  return {
    services: filteredServices,
    allServices: services,
    serviceCategories,
    favorites,
    isLoading: isLoadingServices || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addService: (service: Service) => addServiceMutation.mutate(service),
    updateService: (service: Service) => updateServiceMutation.mutate(service),
    deleteService: (serviceId: string) => deleteServiceMutation.mutate(serviceId),
    updateServiceCategories: (payload: CategoryUpdatePayload) =>
      updateServiceCategoriesMutation.mutate(payload),
    toggleFavorite: (params: { type: 'service' | 'variant'; id: string; isFavorite: boolean }) =>
      toggleFavoriteMutation.mutate(params),
    reorderFavorites: (items: { type: 'service' | 'variant'; id: string; sortOrder: number }[]) =>
      reorderFavoritesMutation.mutate(items),
  };
```

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: Build succeeds (no consumers use `favorites` yet, so no downstream breaks).

- [ ] **Step 6: Commit**

```bash
git add modules/services/hooks/useServices.ts
git commit -m "feat: add favorites derived data and toggle/reorder mutations to useServices"
```

---

### Task 4: Star Icon on Service Cards

**Files:**
- Modify: `modules/services/components/ServiceCard.tsx`
- Modify: `modules/services/components/ServiceList.tsx`
- Modify: `modules/services/ServicesModule.tsx`

- [ ] **Step 1: Add star toggle to ServiceCard**

In `modules/services/components/ServiceCard.tsx`, update the imports:

```typescript
import { Layers, Star } from 'lucide-react';
```

Add props for favorite toggling:

```typescript
interface ServiceCardProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
  groupByCategory?: boolean;
  canToggleFavorite?: boolean;
  onToggleFavorite?: (type: 'service' | 'variant', id: string, isFavorite: boolean) => void;
}
```

Update the component signature to accept new props:

```typescript
export const ServiceCard: React.FC<ServiceCardProps> = ({
  services,
  categories,
  onEdit,
  groupByCategory = false,
  canToggleFavorite = false,
  onToggleFavorite,
}) => {
```

Inside `renderCard`, add a star icon button in the card header area. Replace the `<div className="flex items-start justify-between gap-2 mb-2">` block (lines 45-57) with:

```typescript
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-semibold text-slate-900 text-sm truncate">
            {service.name}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canToggleFavorite && onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite('service', service.id, !service.isFavorite);
                }}
                className="p-0.5 transition-colors hover:scale-110"
                title={service.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star
                  size={14}
                  className={service.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}
                />
              </button>
            )}
            {showCategory && (category ? (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border shrink-0 ${category.color}`}>
                <CategoryIcon categoryName={category.name} iconName={category.icon} size={12} />
                {category.name}
              </span>
            ) : (
              <span className="text-slate-400 text-xs italic shrink-0">Non classé</span>
            ))}
          </div>
        </div>
```

- [ ] **Step 2: Pass favorite props through ServiceList**

In `modules/services/components/ServiceList.tsx`, update the interface:

```typescript
interface ServiceListProps {
  services: Service[];
  categories: ServiceCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleFavorite?: (type: 'service' | 'variant', id: string, isFavorite: boolean) => void;
}
```

Update the destructured props:

```typescript
export const ServiceList: React.FC<ServiceListProps> = ({
  services,
  categories,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
  onToggleFavorite,
}) => {
```

Pass the props to ServiceCard (and ServiceTable if it exists). In the ServiceCard render (line 128-134):

```typescript
          <ServiceCard
            services={displayedServices}
            categories={categories}
            onEdit={onEdit}
            groupByCategory={groupByCategory}
            canToggleFavorite={!!onToggleFavorite}
            onToggleFavorite={onToggleFavorite}
          />
```

And similarly for ServiceTable if it accepts these props (line 121-126):

```typescript
          <ServiceTable
            services={displayedServices}
            categories={categories}
            onEdit={onEdit}
            groupByCategory={groupByCategory}
            canToggleFavorite={!!onToggleFavorite}
            onToggleFavorite={onToggleFavorite}
          />
```

- [ ] **Step 3: Pass toggleFavorite from ServicesModule**

In `modules/services/ServicesModule.tsx`, destructure `toggleFavorite` from `useServices()`, and conditionally pass it based on permissions:

Add the necessary imports and permission check:

```typescript
import { usePermissions } from '../../hooks/usePermissions';
```

Inside the component, after the existing hook calls:

```typescript
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditServices = can('edit', 'services');
```

Note: `useAuth` is already imported via `useServices` context, but check if `ServicesModule` imports it. If not, add the import. Also destructure `toggleFavorite` from useServices:

```typescript
  const {
    services,
    serviceCategories,
    isLoading,
    searchTerm,
    setSearchTerm,
    addService,
    updateService,
    deleteService,
    toggleFavorite,
  } = useServices();
```

Pass it to ServiceList:

```typescript
        <ServiceList
          services={services}
          categories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onToggleFavorite={canEditServices ? (type, id, isFavorite) => toggleFavorite({ type, id, isFavorite }) : undefined}
        />
```

- [ ] **Step 4: Verify build and test visually**

Run: `npm run build`

Expected: Build succeeds. When running `npm run dev`, star icons appear on service cards for owner/manager roles. Clicking toggles filled/outline state.

- [ ] **Step 5: Commit**

```bash
git add modules/services/components/ServiceCard.tsx modules/services/components/ServiceList.tsx modules/services/ServicesModule.tsx
git add -u  # catch ServiceTable.tsx if modified
git commit -m "feat: add star icon toggle for favorites on service cards"
```

---

### Task 5: Favorites Settings Tab

**Files:**
- Create: `modules/services/components/FavoritesTab.tsx`
- Modify: `modules/services/ServiceSettingsPage.tsx`

- [ ] **Step 1: Create FavoritesTab component**

Create `modules/services/components/FavoritesTab.tsx`:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Star, GripVertical, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { useServices } from '../hooks/useServices';
import { CategoryIcon } from '../../../lib/categoryIcons';
import type { FavoriteItem } from '../../../types';

export function FavoritesTab() {
  const { allServices, serviceCategories, favorites, toggleFavorite, reorderFavorites } = useServices();

  // Local copy of favorites order for drag-and-drop
  const [localOrder, setLocalOrder] = useState<FavoriteItem[]>(favorites);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalOrder(favorites);
  }, [favorites]);

  const hasOrderChanged = JSON.stringify(localOrder.map(f => {
    const id = f.type === 'service' ? f.service.id : f.variant.id;
    return `${f.type}:${id}`;
  })) !== JSON.stringify(favorites.map(f => {
    const id = f.type === 'service' ? f.service.id : f.variant.id;
    return `${f.type}:${id}`;
  }));

  const handleSaveOrder = () => {
    const items = localOrder.map((item, index) => ({
      type: item.type,
      id: item.type === 'service' ? item.service.id : item.variant.id,
      sortOrder: index,
    }));
    reorderFavorites(items);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...localOrder];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setLocalOrder(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const getFavoriteLabel = (item: FavoriteItem): string => {
    if (item.type === 'service') return item.service.name;
    return `${item.parentService.name} — ${item.variant.name}`;
  };

  const getFavoriteCategory = (item: FavoriteItem) => {
    const categoryId = item.type === 'service' ? item.service.categoryId : item.parentService.categoryId;
    return serviceCategories.find(c => c.id === categoryId);
  };

  // Check if a service or variant is favorited
  const isServiceFavorited = useCallback((serviceId: string) => {
    return allServices.find(s => s.id === serviceId)?.isFavorite ?? false;
  }, [allServices]);

  const isVariantFavorited = useCallback((variantId: string) => {
    for (const s of allServices) {
      for (const v of s.variants) {
        if (v.id === variantId) return v.isFavorite;
      }
    }
    return false;
  }, [allServices]);

  return (
    <div className="space-y-6">
      {/* Ordered favorites list */}
      {localOrder.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Ordre d'affichage</h3>
          <div className="space-y-1">
            {localOrder.map((item, index) => {
              const category = getFavoriteCategory(item);
              return (
                <div
                  key={`${item.type}-${item.type === 'service' ? item.service.id : item.variant.id}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-slate-200 cursor-grab active:cursor-grabbing transition-colors ${
                    dragIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical size={14} className="text-slate-400 shrink-0" />
                  <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                  <span className="text-sm text-slate-800 flex-1 truncate">
                    {getFavoriteLabel(item)}
                  </span>
                  {item.type === 'variant' && (
                    <span className="text-xs text-slate-400 shrink-0">variante</span>
                  )}
                  {category && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${category.color}`}>
                      <CategoryIcon categoryName={category.name} iconName={category.icon} size={10} />
                      {category.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {localOrder.length === 0 && (
        <div className="text-center py-8 text-sm text-slate-400">
          Aucun favori sélectionné — utilisez les étoiles sur les services ou cochez-les ci-dessous.
        </div>
      )}

      {/* All services checklist */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Sélectionner les favoris</h3>
        <div className="space-y-3">
          {serviceCategories.map(cat => {
            const catServices = allServices.filter(s => s.categoryId === cat.id && s.active);
            if (catServices.length === 0) return null;
            return (
              <CategorySection
                key={cat.id}
                category={cat}
                services={catServices}
                isServiceFavorited={isServiceFavorited}
                isVariantFavorited={isVariantFavorited}
                onToggle={toggleFavorite}
              />
            );
          })}
        </div>
      </div>

      {/* Save order button */}
      {hasOrderChanged && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveOrder}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <Save size={16} />
            Enregistrer l'ordre
          </button>
        </div>
      )}
    </div>
  );
}

// Collapsible category section with service + variant checkboxes
function CategorySection({
  category,
  services,
  isServiceFavorited,
  isVariantFavorited,
  onToggle,
}: {
  category: { id: string; name: string; color: string; icon?: string };
  services: { id: string; name: string; variants: { id: string; name: string; isFavorite: boolean }[] ; isFavorite: boolean }[];
  isServiceFavorited: (id: string) => boolean;
  isVariantFavorited: (id: string) => boolean;
  onToggle: (params: { type: 'service' | 'variant'; id: string; isFavorite: boolean }) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${category.color}`}>
          <CategoryIcon categoryName={category.name} iconName={category.icon} size={12} />
          {category.name}
        </span>
        <span className="text-xs text-slate-400">{services.length} services</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {services.map(service => (
            <div key={service.id}>
              {/* Service-level checkbox */}
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isServiceFavorited(service.id)}
                  onChange={() => onToggle({ type: 'service', id: service.id, isFavorite: !isServiceFavorited(service.id) })}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <Star size={12} className={isServiceFavorited(service.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                <span className="text-sm font-medium text-slate-700">{service.name}</span>
                {service.variants.length > 1 && (
                  <span className="text-xs text-slate-400">({service.variants.length} variantes)</span>
                )}
              </label>

              {/* Variant-level checkboxes (only for multi-variant services) */}
              {service.variants.length > 1 && (
                <div className="ml-8 space-y-0.5">
                  {service.variants.map(variant => (
                    <label key={variant.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVariantFavorited(variant.id)}
                        disabled={isServiceFavorited(service.id)}
                        onChange={() => onToggle({ type: 'variant', id: variant.id, isFavorite: !isVariantFavorited(variant.id) })}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:opacity-40"
                      />
                      <span className={`text-xs ${isServiceFavorited(service.id) ? 'text-slate-400' : 'text-slate-600'}`}>
                        {variant.name}
                      </span>
                      {isServiceFavorited(service.id) && (
                        <span className="text-xs text-slate-400 italic">(inclus via service)</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Favoris tab to ServiceSettingsPage**

In `modules/services/ServiceSettingsPage.tsx`, update imports:

```typescript
import { ArrowLeft, Layers, Settings, Star } from 'lucide-react';
import { CategoriesTab } from './components/CategoriesTab';
import { GeneralTab } from './components/GeneralTab';
import { FavoritesTab } from './components/FavoritesTab';
```

Update the tab type and default:

```typescript
type Tab = 'favorites' | 'categories' | 'general';

export function ServiceSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('favorites');
```

Add the Favoris tab button as the first tab in the `<nav>` (before the Catégories button):

```typescript
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'favorites'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Star size={16} />
            Favoris
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers size={16} />
            Catégories
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={16} />
            Général
          </button>
        </nav>
      </div>
```

Update the tab content rendering:

```typescript
      {activeTab === 'favorites' && <FavoritesTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'general' && <GeneralTab />}
```

- [ ] **Step 3: Verify build and test visually**

Run: `npm run build`

Expected: Build succeeds. At `/services/settings`, the "Favoris" tab appears first. Checking/unchecking services works, drag-to-reorder works.

- [ ] **Step 4: Commit**

```bash
git add modules/services/components/FavoritesTab.tsx modules/services/ServiceSettingsPage.tsx
git commit -m "feat: add Favoris settings tab for managing and ordering favorites"
```

---

### Task 6: Appointments Desktop — Favoris Tab

**Files:**
- Modify: `modules/appointments/components/ServiceBlock.tsx`
- Modify: `modules/appointments/components/ServiceGrid.tsx`

- [ ] **Step 1: Add Favoris tab to ServiceBlock category pills**

In `modules/appointments/components/ServiceBlock.tsx`, update the useServices import to include favorites:

The `ServiceBlock` receives `services` and `categories` as props but doesn't call `useServices` directly. The favorites data needs to come from the parent. Update the props interface:

```typescript
import type { FavoriteItem } from '../../../types';

interface ServiceBlockProps {
  block: ServiceBlockState;
  index: number;
  isActive: boolean;
  services: Service[];
  categories: ServiceCategory[];
  favorites: FavoriteItem[];
  team: StaffMember[];
  onActivate: () => void;
  onRemove: () => void;
  onChange: (updates: Partial<ServiceBlockState>) => void;
  summaryText?: string;
}
```

Add a `FAVORITES` sentinel for the active category state. Replace the category logic near line 35:

```typescript
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    favorites.length > 0 ? 'FAVORITES' : categories[0]?.id || null
  );

  const filteredServices = useMemo(
    () => activeCategoryId === 'FAVORITES'
      ? [] // favorites are rendered directly, not through filteredServices
      : services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId, favorites],
  );
```

Update `handleCategoryChange` to support the FAVORITES sentinel:

```typescript
  const handleCategoryChange = (catId: string) => {
    setActiveCategoryId(catId);
    onChange({ categoryId: catId === 'FAVORITES' ? null : catId, serviceId: null, variantId: null });
  };
```

Add the Favoris tab button before the category buttons in the category tabs JSX (lines 154-173). Replace the entire category tabs `<div>`:

```typescript
{/* Category tabs */}
<div className="flex gap-0 border-b border-slate-200 mb-0 overflow-x-auto">
  {favorites.length > 0 && (
    <button
      type="button"
      onClick={() => handleCategoryChange('FAVORITES')}
      className={`
        px-3 py-2 text-xs whitespace-nowrap transition-colors flex items-center gap-1.5
        ${activeCategoryId === 'FAVORITES'
          ? 'text-amber-600 border-b-2 border-amber-500 -mb-[1px] font-semibold'
          : 'text-slate-500 hover:text-slate-700'
        }
      `}
    >
      <Star size={13} className={activeCategoryId === 'FAVORITES' ? 'fill-amber-400 text-amber-400' : ''} />
      Favoris
    </button>
  )}
  {categories.map((cat) => (
    <button
      key={cat.id}
      type="button"
      onClick={() => handleCategoryChange(cat.id)}
      className={`
        px-3 py-2 text-xs whitespace-nowrap transition-colors flex items-center gap-1.5
        ${cat.id === activeCategoryId
          ? 'text-blue-600 border-b-2 border-blue-500 -mb-[1px] font-semibold'
          : 'text-slate-500 hover:text-slate-700'
        }
      `}
    >
      <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={13} className="shrink-0" />
      {cat.name}
    </button>
  ))}
</div>
```

Add the `Star` import at the top:

```typescript
import { Star } from 'lucide-react';
```

In the content area, conditionally render favorites or the normal ServiceGrid. Replace the ServiceGrid render section with:

```typescript
{activeCategoryId === 'FAVORITES' ? (
  <ServiceGrid
    services={[]}
    favorites={favorites}
    selectedServiceId={block.serviceId}
    selectedVariantId={block.variantId}
    onSelectService={(serviceId) => onChange({ serviceId, variantId: null })}
    onSelectVariant={(variantId, serviceId) => onChange({ variantId, serviceId: serviceId ?? block.serviceId })}
  />
) : (
  <ServiceGrid
    services={filteredServices}
    favorites={[]}
    selectedServiceId={block.serviceId}
    selectedVariantId={block.variantId}
    onSelectService={(serviceId) => onChange({ serviceId, variantId: null })}
    onSelectVariant={(variantId) => onChange({ variantId })}
  />
)}
```

- [ ] **Step 2: Update ServiceGrid to render FavoriteItem cards**

In `modules/appointments/components/ServiceGrid.tsx`, update the props:

```typescript
import type { FavoriteItem } from '../../../types';

interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  selectedServiceId: string | null;
  selectedVariantId: string | null;
  onSelectService: (serviceId: string) => void;
  onSelectVariant: (variantId: string, serviceId?: string) => void;
}
```

In the component body, render favorites when provided. If `favorites` is non-empty, render favorite items instead of (or in addition to) regular services. Add a section before the regular services grid:

```typescript
export const ServiceGrid: React.FC<ServiceGridProps> = ({
  services,
  favorites = [],
  selectedServiceId,
  selectedVariantId,
  onSelectService,
  onSelectVariant,
}) => {
  const itemsToRender = favorites.length > 0 ? [] : services; // When showing favorites, don't show regular services

  return (
    <div className="p-3 space-y-3">
      {/* Favorite items */}
      {favorites.map((fav) => {
        if (fav.type === 'service') {
          const service = fav.service;
          const isSelected = selectedServiceId === service.id;
          return (
            <div key={`fav-svc-${service.id}`}>
              <button
                type="button"
                onClick={() => onSelectService(service.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{service.name}</span>
                  <span className="text-xs text-slate-500">
                    {service.variants.length} variante{service.variants.length > 1 ? 's' : ''}
                  </span>
                </div>
              </button>
              {isSelected && (
                <div className="mt-1 ml-3 space-y-1">
                  {service.variants.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectVariant(v.id, service.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        selectedVariantId === v.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>{v.name}</span>
                        <span>{v.durationMinutes}min — {v.price}€</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        } else {
          // Variant-type favorite — standalone card
          const { variant, parentService } = fav;
          const isSelected = selectedVariantId === variant.id;
          return (
            <button
              key={`fav-var-${variant.id}`}
              type="button"
              onClick={() => onSelectVariant(variant.id, parentService.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-800">{parentService.name}</span>
                  <span className="text-sm text-slate-500"> — {variant.name}</span>
                </div>
                <span className="text-xs text-slate-500">{variant.durationMinutes}min — {variant.price}€</span>
              </div>
            </button>
          );
        }
      })}

      {/* Regular services grid */}
      {itemsToRender.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {/* ... keep existing service grid rendering ... */}
        </div>
      )}
    </div>
  );
};
```

**Important:** Keep the existing grid rendering code for `itemsToRender` — just wrap it in the conditional. The existing code handles regular service cards with variant expansion.

- [ ] **Step 3: Pass favorites to ServiceBlock from parent**

Find where `ServiceBlock` is rendered (in the appointment form / `useAppointmentForm` consumer). The parent component needs to pass `favorites` from `useServices()`. Check the appointment form component that renders ServiceBlock and add:

```typescript
const { favorites } = useServices();
```

Then pass `favorites={favorites}` to each `<ServiceBlock>`.

- [ ] **Step 4: Verify build and test**

Run: `npm run build`

Expected: Build succeeds. In the appointment form, "Favoris" tab appears first when favorites exist.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/components/ServiceBlock.tsx modules/appointments/components/ServiceGrid.tsx
git add -u  # parent component changes
git commit -m "feat: add Favoris tab to desktop appointment service picker"
```

---

### Task 7: Appointments Mobile — Favoris Pill

**Files:**
- Modify: `modules/appointments/components/MobileServicePicker.tsx`

- [ ] **Step 1: Add favorites prop and Favoris pill**

Update props interface:

```typescript
import { Star } from 'lucide-react';
import type { FavoriteItem } from '../../../types';

interface MobileServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  favorites: FavoriteItem[];
  initialCategoryId: string | null;
  onSelect: (selection: { serviceId: string; variantId: string; categoryId: string }) => void;
  onClose: () => void;
}
```

Update the initial category state to default to FAVORITES when favorites exist:

```typescript
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    favorites.length > 0 ? 'FAVORITES' : initialCategoryId ?? categories[0]?.id ?? null
  );
```

Update the filtered services to handle FAVORITES:

```typescript
  const filteredServices = activeCategoryId === 'FAVORITES'
    ? [] // favorites rendered separately
    : services.filter((s) => s.active && s.categoryId === activeCategoryId);
```

Add the Favoris pill before category pills in the JSX (before `{categories.map(...)}`):

```typescript
{/* Category pills */}
<div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-5 px-5 scrollbar-hide">
  {favorites.length > 0 && (
    <button
      type="button"
      onClick={() => { setActiveCategoryId('FAVORITES'); setExpandedServiceId(null); }}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
        activeCategoryId === 'FAVORITES'
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      <Star size={14} className={activeCategoryId === 'FAVORITES' ? 'text-white fill-white' : 'text-slate-500'} />
      Favoris
    </button>
  )}
  {categories.map((cat) => (
    /* ... existing category pills ... */
  ))}
</div>
```

Add favorites rendering in the content area. Before the existing service list, add a conditional block:

```typescript
{activeCategoryId === 'FAVORITES' && (
  <div className="space-y-2">
    {favorites.map((fav) => {
      if (fav.type === 'service') {
        const service = fav.service;
        const isExpanded = expandedServiceId === service.id;
        return (
          <div key={`fav-svc-${service.id}`}>
            <button
              type="button"
              onClick={() => {
                if (service.variants.length === 1) {
                  onSelect({ serviceId: service.id, variantId: service.variants[0].id, categoryId: service.categoryId });
                } else {
                  setExpandedServiceId(isExpanded ? null : service.id);
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200"
            >
              <div>
                <div className="font-medium text-sm text-slate-800">{service.name}</div>
                <div className="text-xs text-slate-500">
                  {service.variants.length > 1
                    ? `${service.variants.length} variantes`
                    : `${service.variants[0]?.durationMinutes}min — ${service.variants[0]?.price}€`}
                </div>
              </div>
            </button>
            {isExpanded && service.variants.length > 1 && (
              <div className="mt-1 ml-4 space-y-1">
                {service.variants.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelect({ serviceId: service.id, variantId: v.id, categoryId: service.categoryId })}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="text-slate-700">{v.name}</span>
                      <span className="text-slate-500">{v.durationMinutes}min — {v.price}€</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      } else {
        // Variant-type favorite — direct select
        const { variant, parentService } = fav;
        return (
          <button
            key={`fav-var-${variant.id}`}
            type="button"
            onClick={() => onSelect({ serviceId: parentService.id, variantId: variant.id, categoryId: parentService.categoryId })}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200"
          >
            <div>
              <div className="font-medium text-sm text-slate-800">{parentService.name} — {variant.name}</div>
              <div className="text-xs text-slate-500">{variant.durationMinutes}min — {variant.price}€</div>
            </div>
          </button>
        );
      }
    })}
  </div>
)}
```

- [ ] **Step 2: Pass favorites from parent**

Find where `MobileServicePicker` is rendered and pass `favorites={favorites}` from `useServices()`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/MobileServicePicker.tsx
git add -u  # parent changes
git commit -m "feat: add Favoris pill to mobile appointment service picker"
```

---

### Task 8: POS — Favoris Filter

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`
- Modify: `modules/pos/components/POSCatalog.tsx`

- [ ] **Step 1: Expose favorites from usePOS**

In `modules/pos/hooks/usePOS.ts`, update the useServices destructuring (line 29):

```typescript
  const { allServices: services, serviceCategories, favorites } = useServices();
```

Add `'FAVORITES'` to the selectedCategory default when favorites exist. Change the initial state (line 36):

```typescript
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
```

Add an effect to default to FAVORITES when favorites load and viewMode is SERVICES:

```typescript
  // Default to FAVORITES filter when favorites exist and on SERVICES view
  const hasDefaultedToFavorites = useRef(false);
  useEffect(() => {
    if (!hasDefaultedToFavorites.current && favorites.length > 0 && viewMode === 'SERVICES') {
      setSelectedCategory('FAVORITES');
      hasDefaultedToFavorites.current = true;
    }
  }, [favorites, viewMode]);
```

Add `useRef` to the imports if not already present.

Update the `filteredItems` memo (line 106-123) to handle FAVORITES:

```typescript
  const filteredItems = useMemo(() => {
    if (viewMode === 'SERVICES') {
      if (selectedCategory === 'FAVORITES') {
        // Return favorite services only (variant favorites handled separately in POSCatalog)
        return favorites
          .filter((f): f is Extract<typeof f, { type: 'service' }> => f.type === 'service')
          .map(f => f.service)
          .filter(s => s.active && s.variants.length > 0);
      }
      return services.filter(s => {
        if (!s.active || s.variants.length === 0) return false;
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || s.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    } else if (viewMode === 'PRODUCTS') {
      return products.filter(p => {
        if (p.usageType === 'internal') return false;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    }
    return [];
  }, [viewMode, searchTerm, selectedCategory, services, products, favorites]);
```

Expose `favorites` in the return object:

```typescript
  return {
    // State
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory,
    selectedClient, setSelectedClient,
    cart,

    // Data
    services, serviceCategories,
    favorites,
    products, productCategories,
    clients, allStaff,
    transactions,
    filteredItems,
    totals,
    pendingAppointments,
    linkedAppointmentId,

    // Actions
    addToCart,
    updateCartItem,
    updateQuantity,
    removeFromCart,
    processTransaction,
    importAppointment,
    voidTransaction,
    refundTransaction,
    isVoiding,
    isRefunding,
  };
```

- [ ] **Step 2: Add Favoris button to POSCatalog**

In `modules/pos/components/POSCatalog.tsx`, add `favorites` to the props (it's passed from the parent POS component):

```typescript
import { Star } from 'lucide-react';
import type { FavoriteItem } from '../../../types';
```

Add `favorites` to the destructured props:

```typescript
interface POSCatalogProps {
  // ... existing props ...
  favorites: FavoriteItem[];
}
```

In the category filter buttons section (around lines 158-181), add the Favoris button before the "Tout" button. Inside the `<div className="flex gap-2 overflow-x-auto ...">`:

```typescript
    {viewMode === 'SERVICES' && favorites.length > 0 && (
      <button
        onClick={() => setSelectedCategory('FAVORITES')}
        className={`flex items-center gap-1.5 px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${
          selectedCategory === 'FAVORITES'
            ? 'bg-amber-500 text-white border-amber-500'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
        style={{ scrollSnapAlign: 'start' }}
      >
        <Star size={12} className={selectedCategory === 'FAVORITES' ? 'fill-white' : ''} />
        Favoris
      </button>
    )}
    <button
      onClick={() => setSelectedCategory('ALL')}
      className={`px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium ...`}
      /* ... existing Tout button ... */
    >
      Tout
    </button>
```

For variant-type favorites in the service grid, add handling when `selectedCategory === 'FAVORITES'`. In the service grid rendering section, add variant favorite cards alongside the service cards. When a variant favorite is clicked, add it directly to the cart:

```typescript
{/* Render variant-type favorites as standalone cards when in FAVORITES filter */}
{selectedCategory === 'FAVORITES' && favorites
  .filter((f): f is Extract<typeof f, { type: 'variant' }> => f.type === 'variant')
  .map(fav => (
    <button
      key={`fav-var-${fav.variant.id}`}
      onClick={() => {
        onAddToCart({
          id: crypto.randomUUID(),
          referenceId: fav.variant.id,
          type: 'SERVICE',
          name: fav.parentService.name,
          variantName: fav.variant.name,
          price: fav.variant.price,
          originalPrice: fav.variant.price,
          quantity: 1,
        });
      }}
      className="bg-white rounded-xl border border-slate-200 p-3 text-left transition-all hover:shadow-md hover:border-slate-300"
    >
      <div className="font-medium text-sm text-slate-800 truncate">{fav.parentService.name}</div>
      <div className="text-xs text-slate-500 mt-0.5">{fav.variant.name}</div>
      <div className="text-sm font-semibold text-slate-900 mt-2">{fav.variant.price}€</div>
    </button>
  ))
}
```

- [ ] **Step 3: Pass favorites from POS parent component to POSCatalog**

Find where `POSCatalog` is rendered (likely in `modules/pos/POSModule.tsx` or similar) and pass `favorites={favorites}` from the `usePOS()` return value.

- [ ] **Step 4: Verify build and test**

Run: `npm run build`

Expected: Build succeeds. In the POS, "Favoris" filter appears first in SERVICES view when favorites exist.

- [ ] **Step 5: Commit**

```bash
git add modules/pos/hooks/usePOS.ts modules/pos/components/POSCatalog.tsx
git add -u  # parent component changes
git commit -m "feat: add Favoris filter to POS catalog with direct cart add for variant favorites"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Full build check**

Run: `npm run build`

Expected: Clean build, no errors.

- [ ] **Step 2: Manual smoke test checklist**

Run: `npm run dev`

Verify:
1. Services list: star icons appear on cards (owner/manager only)
2. Clicking star toggles favorite state (filled amber / outline)
3. Service Settings → Favoris tab: shows all services with checkboxes, reorder drag works
4. Appointment builder (desktop): "Favoris" tab appears first, service favorites expand variants, variant favorites select directly
5. Appointment builder (mobile): "Favoris" pill appears first, same behavior
6. POS (SERVICES view): "Favoris" filter button appears first, service favorites open variant modal, variant favorites add to cart directly
7. When no favorites exist, "Favoris" tab/pill/button is hidden everywhere
8. Stylist/receptionist roles: no star icons in services list, but can see/use Favoris tab in appointments and POS

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -u
git commit -m "fix: address any remaining issues from favorites smoke test"
```
