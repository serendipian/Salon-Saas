# Supplier Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings page for suppliers with dynamic category management and general settings (default payment terms, PO numbering, default view), following the exact same pattern as services and products.

**Architecture:** New `supplier_categories` table + `save_supplier_categories` RPC (mirrors service/product pattern). New `salons.supplier_settings` JSONB column for general settings. New settings page at `/suppliers/settings` with two tabs (Catégories, Général). Replace the hardcoded category string field on suppliers with a FK to `supplier_categories`.

**Tech Stack:** Supabase (PostgreSQL migration, RPC, RLS), React, TypeScript, TanStack Query, Tailwind CSS, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-08-supplier-settings-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260408200000_supplier_categories.sql` | DB table, RLS, index, audit, RPC, backfill |
| Modify | `lib/database.types.ts` | Regenerate types after migration |
| Modify | `types.ts` | Add `SupplierCategory`, `SupplierSettings`, update `Supplier` |
| Modify | `modules/suppliers/mappers.ts` | Add `toSupplierCategory`, update `toSupplier`/`toSupplierInsert` for `categoryId` |
| Modify | `modules/suppliers/schemas.ts` | Update validation for `categoryId` |
| Modify | `modules/suppliers/hooks/useSuppliers.ts` | Add `supplierCategories` query + `updateSupplierCategories` mutation |
| Create | `modules/suppliers/hooks/useSupplierSettings.ts` | Read/write `salons.supplier_settings` JSONB |
| Create | `modules/suppliers/SupplierSettingsPage.tsx` | Tab container (Catégories, Général) |
| Create | `modules/suppliers/components/SupplierCategoriesTab.tsx` | Category CRUD UI |
| Create | `modules/suppliers/components/SupplierGeneralTab.tsx` | General settings form |
| Modify | `modules/suppliers/components/SupplierForm.tsx` | Dynamic categories + default payment terms |
| Modify | `modules/suppliers/components/SupplierList.tsx` | Settings gear button + category filter pills |
| Modify | `App.tsx` | Add `/suppliers/settings` route |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260408200000_supplier_categories.sql`

This single migration creates the `supplier_categories` table, adds `category_id` FK to suppliers, backfills existing string categories, adds the `supplier_settings` JSONB column to salons, creates RLS policies, index, audit trigger, and the `save_supplier_categories` RPC.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260408200000_supplier_categories.sql`:

```sql
-- ============================================================
-- supplier_categories table
-- ============================================================
CREATE TABLE supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-800 border-slate-200',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at trigger
CREATE TRIGGER supplier_categories_updated_at
  BEFORE UPDATE ON supplier_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index
CREATE INDEX idx_supplier_categories_salon ON supplier_categories(salon_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_categories_select ON supplier_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY supplier_categories_insert ON supplier_categories FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY supplier_categories_update ON supplier_categories FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY supplier_categories_delete ON supplier_categories FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Audit trigger (re-use existing audit function)
CREATE TRIGGER supplier_categories_audit
  AFTER INSERT OR UPDATE OR DELETE ON supplier_categories
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- ============================================================
-- Add category_id FK to suppliers + backfill from string field
-- ============================================================
ALTER TABLE suppliers ADD COLUMN category_id UUID REFERENCES supplier_categories(id) ON DELETE SET NULL;

-- Backfill: create one supplier_categories row per distinct (salon_id, category) string,
-- then set category_id on existing suppliers.
DO $$
DECLARE
  r RECORD;
  v_cat_id UUID;
  v_sort INTEGER := 0;
  v_prev_salon UUID := NULL;
  v_colors TEXT[] := ARRAY[
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-slate-100 text-slate-800 border-slate-200'
  ];
BEGIN
  FOR r IN
    SELECT DISTINCT salon_id, category
    FROM suppliers
    WHERE category IS NOT NULL AND category != '' AND deleted_at IS NULL
    ORDER BY salon_id, category
  LOOP
    IF v_prev_salon IS DISTINCT FROM r.salon_id THEN
      v_sort := 0;
      v_prev_salon := r.salon_id;
    END IF;

    v_cat_id := gen_random_uuid();

    INSERT INTO supplier_categories (id, salon_id, name, color, sort_order)
    VALUES (v_cat_id, r.salon_id, r.category, v_colors[1 + (v_sort % array_length(v_colors, 1))], v_sort);

    UPDATE suppliers
    SET category_id = v_cat_id
    WHERE salon_id = r.salon_id AND category = r.category AND deleted_at IS NULL;

    v_sort := v_sort + 1;
  END LOOP;
END;
$$;

-- Drop old string column
ALTER TABLE suppliers DROP COLUMN category;

-- ============================================================
-- supplier_settings JSONB on salons
-- ============================================================
ALTER TABLE salons ADD COLUMN IF NOT EXISTS supplier_settings JSONB DEFAULT '{}';

-- ============================================================
-- RPC: save_supplier_categories
-- ============================================================
CREATE OR REPLACE FUNCTION save_supplier_categories(
  p_salon_id UUID,
  p_categories JSONB,
  p_assignments JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cat JSONB;
  v_cat_id UUID;
  v_supplier_id TEXT;
  v_category_id UUID;
  v_existing_ids UUID[];
  v_new_ids UUID[];
  v_to_delete UUID[];
BEGIN
  -- Must be owner or manager
  IF p_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get existing category IDs
  SELECT array_agg(id) INTO v_existing_ids
  FROM supplier_categories
  WHERE salon_id = p_salon_id AND deleted_at IS NULL;

  v_existing_ids := COALESCE(v_existing_ids, ARRAY[]::UUID[]);

  -- Collect new category IDs
  SELECT array_agg((cat->>'id')::uuid)
  INTO v_new_ids
  FROM jsonb_array_elements(p_categories) AS cat;

  v_new_ids := COALESCE(v_new_ids, ARRAY[]::UUID[]);

  -- Soft-delete removed categories
  v_to_delete := ARRAY(
    SELECT unnest(v_existing_ids)
    EXCEPT
    SELECT unnest(v_new_ids)
  );

  IF array_length(v_to_delete, 1) > 0 THEN
    UPDATE supplier_categories
    SET deleted_at = now(), updated_at = now()
    WHERE id = ANY(v_to_delete) AND salon_id = p_salon_id;

    -- Unassign suppliers from deleted categories
    UPDATE suppliers
    SET category_id = NULL, updated_at = now()
    WHERE category_id = ANY(v_to_delete) AND salon_id = p_salon_id;
  END IF;

  -- Upsert categories
  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    v_cat_id := (v_cat->>'id')::uuid;

    IF v_cat_id = ANY(v_existing_ids) THEN
      UPDATE supplier_categories
      SET name = v_cat->>'name',
          color = v_cat->>'color',
          sort_order = (v_cat->>'sort_order')::int,
          updated_at = now()
      WHERE id = v_cat_id AND salon_id = p_salon_id;
    ELSE
      INSERT INTO supplier_categories (id, salon_id, name, color, sort_order)
      VALUES (v_cat_id, p_salon_id, v_cat->>'name', v_cat->>'color', (v_cat->>'sort_order')::int);
    END IF;
  END LOOP;

  -- Apply supplier assignments
  IF p_assignments IS NOT NULL THEN
    FOR v_supplier_id, v_category_id IN
      SELECT key, NULLIF(value::text, 'null')::uuid
      FROM jsonb_each_text(p_assignments)
    LOOP
      UPDATE suppliers
      SET category_id = v_category_id, updated_at = now()
      WHERE id = v_supplier_id::uuid AND salon_id = p_salon_id;
    END LOOP;
  END IF;
END;
$$;
```

- [ ] **Step 2: Deploy migration to remote Supabase**

Run:
```bash
npx supabase db push --linked
```

Expected: Migration applies successfully.

- [ ] **Step 3: Regenerate TypeScript types**

Run:
```bash
npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts
```

Expected: `lib/database.types.ts` now includes `supplier_categories` table and `category_id` on `suppliers` (no more `category` string), plus `supplier_settings` on `salons`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260408200000_supplier_categories.sql lib/database.types.ts
git commit -m "feat: add supplier_categories table, RPC, and backfill migration"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `types.ts` — add `SupplierCategory`, `SupplierSettings`, update `Supplier`

- [ ] **Step 1: Add SupplierCategory and SupplierSettings types**

In `types.ts`, add these interfaces right after the `Supplier` interface (around line 139):

```typescript
export interface SupplierCategory {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
}

export interface SupplierSettings {
  defaultPaymentTerms: string;
  poPrefix: string;
  poNextNumber: number;
  defaultView: 'card' | 'table';
}
```

- [ ] **Step 2: Update Supplier interface**

In `types.ts`, change the `Supplier` interface (around line 127-139). Replace:

```typescript
  category: string; // e.g. 'Produits', 'Matériel', 'Charges'
```

with:

```typescript
  categoryId: string | null;
```

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add SupplierCategory and SupplierSettings types, update Supplier"
```

---

### Task 3: Mappers & Schema

**Files:**
- Modify: `modules/suppliers/mappers.ts`
- Modify: `modules/suppliers/schemas.ts`

- [ ] **Step 1: Update mappers.ts**

Replace the entire file `modules/suppliers/mappers.ts` with:

```typescript
import type { Supplier, SupplierCategory } from '../../types';

interface SupplierRow {
  id: string;
  salon_id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string | null;
  address: string | null;
  category_id: string | null;
  payment_terms: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface SupplierCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
    categoryId: row.category_id,
    paymentTerms: row.payment_terms ?? undefined,
    active: row.active,
    notes: row.notes ?? undefined,
  };
}

export function toSupplierInsert(data: Supplier, salonId: string) {
  return {
    id: data.id || undefined,
    salon_id: salonId,
    name: data.name,
    contact_name: data.contactName,
    email: data.email,
    phone: data.phone,
    website: data.website ?? null,
    address: data.address ?? null,
    category_id: data.categoryId ?? null,
    payment_terms: data.paymentTerms ?? null,
    active: data.active ?? true,
    notes: data.notes ?? null,
  };
}

export function toSupplierCategory(row: SupplierCategoryRow): SupplierCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order ?? undefined,
  };
}
```

- [ ] **Step 2: Update schemas.ts**

Replace `modules/suppliers/schemas.ts` with:

```typescript
import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom du fournisseur est requis'),
  email: z.union([
    z.string().email("L'email n'est pas valide"),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
  contactName: z.string().optional().default(''),
  categoryId: z.string().nullable().optional(),
});
```

- [ ] **Step 3: Commit**

```bash
git add modules/suppliers/mappers.ts modules/suppliers/schemas.ts
git commit -m "feat: update supplier mappers and schema for categoryId"
```

---

### Task 4: useSuppliers Hook — Add Categories

**Files:**
- Modify: `modules/suppliers/hooks/useSuppliers.ts`

- [ ] **Step 1: Add category query and mutation to useSuppliers**

Replace the entire file `modules/suppliers/hooks/useSuppliers.ts` with:

```typescript
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toSupplier, toSupplierInsert, toSupplierCategory } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Supplier, SupplierCategory } from '../../../types';

export interface SupplierCategoryUpdatePayload {
  categories: SupplierCategory[];
  assignments?: Record<string, string | null>;
}

export const useSuppliers = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const { toastOnError, toastOnSuccess } = useMutationToast();
  useRealtimeSync('suppliers');
  useRealtimeSync('supplier_categories');

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['suppliers', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toSupplier);
    },
    enabled: !!salonId,
  });

  const { data: supplierCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['supplier_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toSupplierCategory);
    },
    enabled: !!salonId,
  });

  const addSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { error } = await supabase
        .from('suppliers')
        .insert(toSupplierInsert(supplier, salonId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le fournisseur"),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { id, salon_id, ...updateData } = toSupplierInsert(supplier, salonId);
      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', supplier.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: toastOnError("Impossible de modifier le fournisseur"),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', supplierId)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
      toastOnSuccess('Fournisseur supprimé')();
    },
    onError: toastOnError('Impossible de supprimer le fournisseur'),
  });

  const updateSupplierCategoriesMutation = useMutation({
    mutationFn: async ({ categories, assignments }: SupplierCategoryUpdatePayload) => {
      const p_categories = categories.map((cat, i) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        sort_order: i,
      }));

      const { error } = await supabase.rpc('save_supplier_categories', {
        p_salon_id: salonId,
        p_categories: p_categories,
        p_assignments: assignments ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError("Impossible de modifier les catégories de fournisseurs"),
  });

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(term) ||
      (s.contactName ?? '').toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  return {
    suppliers: filteredSuppliers,
    allSuppliers: suppliers,
    supplierCategories,
    isLoading: isLoadingSuppliers || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addSupplier: (supplier: Supplier) => addSupplierMutation.mutate(supplier),
    updateSupplier: (supplier: Supplier) => updateSupplierMutation.mutate(supplier),
    deleteSupplier: (supplierId: string) => deleteSupplierMutation.mutate(supplierId),
    updateSupplierCategories: (payload: SupplierCategoryUpdatePayload) =>
      updateSupplierCategoriesMutation.mutate(payload),
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/hooks/useSuppliers.ts
git commit -m "feat: add supplier categories query and mutation to useSuppliers"
```

---

### Task 5: useSupplierSettings Hook

**Files:**
- Create: `modules/suppliers/hooks/useSupplierSettings.ts`

- [ ] **Step 1: Create the hook**

Create `modules/suppliers/hooks/useSupplierSettings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { SupplierSettings } from '../../../types';

const DEFAULTS: SupplierSettings = {
  defaultPaymentTerms: '30 jours',
  poPrefix: 'BC-',
  poNextNumber: 1,
  defaultView: 'table',
};

export function useSupplierSettings() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  const { data: supplierSettings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['supplier_settings', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('supplier_settings')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      const raw = data?.supplier_settings as Record<string, unknown> | null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        defaultPaymentTerms: typeof raw.defaultPaymentTerms === 'string' ? raw.defaultPaymentTerms : DEFAULTS.defaultPaymentTerms,
        poPrefix: typeof raw.poPrefix === 'string' ? raw.poPrefix : DEFAULTS.poPrefix,
        poNextNumber: typeof raw.poNextNumber === 'number' ? raw.poNextNumber : DEFAULTS.poNextNumber,
        defaultView: raw.defaultView === 'card' || raw.defaultView === 'table' ? raw.defaultView : DEFAULTS.defaultView,
      } satisfies SupplierSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SupplierSettings) => {
      const { error } = await supabase
        .from('salons')
        .update({ supplier_settings: settings as any })
        .eq('id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_settings', salonId] });
      toastOnSuccess('Paramètres des fournisseurs enregistrés')();
    },
    onError: toastOnError('Impossible de modifier les paramètres des fournisseurs'),
  });

  return {
    supplierSettings,
    isLoading,
    updateSupplierSettings: (settings: SupplierSettings) => updateSettingsMutation.mutate(settings),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/hooks/useSupplierSettings.ts
git commit -m "feat: add useSupplierSettings hook"
```

---

### Task 6: SupplierCategoriesTab Component

**Files:**
- Create: `modules/suppliers/components/SupplierCategoriesTab.tsx`

This follows the exact same pattern as `modules/services/components/CategoriesTab.tsx` but without the IconPicker.

- [ ] **Step 1: Create SupplierCategoriesTab**

Create `modules/suppliers/components/SupplierCategoriesTab.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Save, Search } from 'lucide-react';
import { ColorPicker } from '../../services/components/ColorPicker';
import { useSuppliers } from '../hooks/useSuppliers';
import type { SupplierCategory, Supplier } from '../../../types';

export function SupplierCategoriesTab() {
  const { allSuppliers, supplierCategories, updateSupplierCategories } = useSuppliers();

  const [localCategories, setLocalCategories] = useState<SupplierCategory[]>(supplierCategories);
  const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setSearchTerm('');
  };

  useEffect(() => {
    setLocalCategories(supplierCategories);
    setLocalAssignments({});
  }, [supplierCategories]);

  const getEffectiveCategoryId = (supplier: Supplier): string | null => {
    if (supplier.id in localAssignments) return localAssignments[supplier.id];
    return supplier.categoryId || null;
  };

  const suppliersForCategory = (categoryId: string) =>
    allSuppliers.filter((s) => getEffectiveCategoryId(s) === categoryId);

  const unassignedSuppliers = allSuppliers.filter((s) => getEffectiveCategoryId(s) === null);

  const filteredSuppliers = (suppliers: Supplier[]) => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter((s) => s.name.toLowerCase().includes(term));
  };

  const handleAddCategory = () => {
    const newCat: SupplierCategory = {
      id: crypto.randomUUID(),
      name: '',
      color: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    setLocalCategories([...localCategories, newCat]);
    setExpandedId(newCat.id);
  };

  const handleDeleteCategory = (id: string) => {
    const affected = allSuppliers.filter((s) => getEffectiveCategoryId(s) === id);
    const newAssignments = { ...localAssignments };
    affected.forEach((s) => { newAssignments[s.id] = null; });
    setLocalAssignments(newAssignments);
    setLocalCategories(localCategories.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateCategory = (id: string, updates: Partial<SupplierCategory>) => {
    setLocalCategories(localCategories.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCategories.length) return;
    const updated = [...localCategories];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalCategories(updated);
  };

  const handleToggleSupplier = (supplierId: string, categoryId: string) => {
    const current = getEffectiveCategoryId(allSuppliers.find((s) => s.id === supplierId)!);
    setLocalAssignments({
      ...localAssignments,
      [supplierId]: current === categoryId ? null : categoryId,
    });
  };

  const hasChanges =
    JSON.stringify(localCategories) !== JSON.stringify(supplierCategories) ||
    Object.keys(localAssignments).length > 0;

  const handleSave = () => {
    updateSupplierCategories({
      categories: localCategories,
      assignments: Object.keys(localAssignments).length > 0 ? localAssignments : undefined,
    });
  };

  const findPreviousCategory = (supplierId: string): string | null => {
    const supplier = allSuppliers.find((s) => s.id === supplierId);
    if (!supplier?.categoryId) return null;
    if (supplier.id in localAssignments && localAssignments[supplier.id] !== supplier.categoryId) {
      return supplierCategories.find((c) => c.id === supplier.categoryId)?.name ?? null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {localCategories.map((cat, index) => (
        <div key={cat.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Category row header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'down')}
                disabled={index === localCategories.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <ColorPicker
              selectedColor={cat.color}
              onSelect={(color) => handleUpdateCategory(cat.id, { color })}
            />

            <input
              type="text"
              value={cat.name}
              onChange={(e) => handleUpdateCategory(cat.id, { name: e.target.value })}
              placeholder="Nom de la catégorie"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />

            {(() => {
              const count = suppliersForCategory(cat.id).length;
              return <span className="text-xs text-slate-500 whitespace-nowrap">
                {count} fournisseur{count !== 1 ? 's' : ''}
              </span>;
            })()}

            <button
              type="button"
              onClick={() => handleDeleteCategory(cat.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expandedId === cat.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Expanded: supplier assignment */}
          {expandedId === cat.id && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un fournisseur..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredSuppliers(allSuppliers).map((supplier) => {
                  const isAssigned = getEffectiveCategoryId(supplier) === cat.id;
                  const prevCat = !isAssigned ? null : findPreviousCategory(supplier.id);
                  return (
                    <label
                      key={supplier.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleSupplier(supplier.id, cat.id)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm text-slate-700">{supplier.name}</span>
                      {prevCat && (
                        <span className="text-xs text-slate-400 italic">(depuis {prevCat})</span>
                      )}
                    </label>
                  );
                })}
                {filteredSuppliers(allSuppliers).length === 0 && (
                  <p className="text-sm text-slate-400 py-2 text-center">Aucun fournisseur trouvé</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Unassigned suppliers section */}
      {unassignedSuppliers.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Fournisseurs non classés ({unassignedSuppliers.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedSuppliers.map((s) => (
              <span key={s.id} className="text-xs bg-white px-2 py-1 rounded border border-amber-200 text-amber-700">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddCategory}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Plus size={16} />
          Ajouter une catégorie
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/components/SupplierCategoriesTab.tsx
git commit -m "feat: add SupplierCategoriesTab component"
```

---

### Task 7: SupplierGeneralTab Component

**Files:**
- Create: `modules/suppliers/components/SupplierGeneralTab.tsx`

- [ ] **Step 1: Create SupplierGeneralTab**

Create `modules/suppliers/components/SupplierGeneralTab.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useSupplierSettings } from '../hooks/useSupplierSettings';
import type { SupplierSettings } from '../../../types';

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Comptant', label: 'Comptant' },
  { value: '15 jours', label: '15 jours' },
  { value: '30 jours', label: '30 jours' },
  { value: '45 jours', label: '45 jours' },
  { value: '60 jours', label: '60 jours' },
  { value: '90 jours', label: '90 jours' },
];

export function SupplierGeneralTab() {
  const { supplierSettings, updateSupplierSettings } = useSupplierSettings();
  const [form, setForm] = useState<SupplierSettings>(supplierSettings);

  useEffect(() => {
    setForm(supplierSettings);
  }, [supplierSettings]);

  const handleSave = () => {
    updateSupplierSettings(form);
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(supplierSettings);

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Paramètres généraux
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Conditions de paiement par défaut
            </label>
            <select
              value={form.defaultPaymentTerms}
              onChange={(e) => setForm({ ...form, defaultPaymentTerms: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            >
              {PAYMENT_TERMS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Préfixe bon de commande
            </label>
            <input
              type="text"
              value={form.poPrefix}
              onChange={(e) => setForm({ ...form, poPrefix: e.target.value })}
              placeholder="BC-"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prochain numéro
            </label>
            <input
              type="number"
              min={1}
              value={form.poNextNumber}
              onChange={(e) => setForm({ ...form, poNextNumber: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            />
            <p className="text-xs text-slate-500 mt-1">
              Prochain bon de commande : {form.poPrefix}{String(form.poNextNumber).padStart(4, '0')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Vue par défaut</p>
              <p className="text-xs text-slate-500">Mode d'affichage par défaut de la liste des fournisseurs</p>
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultView: 'card' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.defaultView === 'card'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Cartes
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultView: 'table' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.defaultView === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tableau
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/components/SupplierGeneralTab.tsx
git commit -m "feat: add SupplierGeneralTab component"
```

---

### Task 8: SupplierSettingsPage

**Files:**
- Create: `modules/suppliers/SupplierSettingsPage.tsx`

- [ ] **Step 1: Create the settings page**

Create `modules/suppliers/SupplierSettingsPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Settings } from 'lucide-react';
import { SupplierCategoriesTab } from './components/SupplierCategoriesTab';
import { SupplierGeneralTab } from './components/SupplierGeneralTab';

type Tab = 'categories' | 'general';

export function SupplierSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <button
          onClick={() => navigate('/suppliers')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Fournisseurs
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres des fournisseurs</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
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

      {/* Tab content */}
      {activeTab === 'categories' ? <SupplierCategoriesTab /> : <SupplierGeneralTab />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/SupplierSettingsPage.tsx
git commit -m "feat: add SupplierSettingsPage with tabs"
```

---

### Task 9: Route & App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add import for SupplierSettingsPage**

In `App.tsx`, add the import after the `SuppliersModule` import (line 55):

```typescript
import { SupplierSettingsPage } from './modules/suppliers/SupplierSettingsPage';
```

- [ ] **Step 2: Add the route**

In `App.tsx`, add the `/suppliers/settings` route right after the `/suppliers` route (after line 134). Insert:

```tsx
        <Route path="/suppliers/settings" element={
          <ProtectedRoute action="edit" resource="suppliers">
            <ErrorBoundary moduleName="Paramètres des fournisseurs"><SupplierSettingsPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
```

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: add /suppliers/settings route"
```

---

### Task 10: Update SupplierList — Settings Button & Category Pills

**Files:**
- Modify: `modules/suppliers/components/SupplierList.tsx`

- [ ] **Step 1: Replace SupplierList.tsx**

Replace `modules/suppliers/components/SupplierList.tsx` with:

```tsx
import React, { useState } from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Supplier, SupplierCategory } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useViewMode } from '../../../hooks/useViewMode';
import { useSupplierSettings } from '../hooks/useSupplierSettings';
import { ViewToggle } from '../../../components/ViewToggle';
import { SupplierTable } from './SupplierTable';
import { SupplierCard } from './SupplierCard';

interface SupplierListProps {
  suppliers: Supplier[];
  categories: SupplierCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const SupplierList: React.FC<SupplierListProps> = ({
  suppliers,
  categories,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
}) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditSuppliers = can('edit', 'suppliers');
  const { supplierSettings } = useSupplierSettings();
  const { viewMode, setViewMode } = useViewMode('suppliers', supplierSettings.defaultView);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const displayedSuppliers = selectedCategoryId
    ? suppliers.filter(s => s.categoryId === selectedCategoryId)
    : suppliers;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Fournisseurs</h1>
        <div className="flex gap-3">
          {canEditSuppliers && (
            <button
              onClick={() => navigate('/suppliers/settings')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              title="Paramètres des fournisseurs"
            >
              <Settings size={18} className="text-slate-600" />
            </button>
          )}
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Fournisseur
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher un fournisseur..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-none bg-slate-50">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategoryId === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous ({suppliers.length})
            </button>
            {categories.map(cat => {
              const count = suppliers.filter(s => s.categoryId === cat.id).length;
              if (count === 0) return null;
              const isActive = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(isActive ? null : cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : `${cat.color} hover:opacity-80`
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {viewMode === 'table' ? (
          <SupplierTable suppliers={displayedSuppliers} onEdit={onEdit} />
        ) : (
          <SupplierCard suppliers={displayedSuppliers} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/components/SupplierList.tsx
git commit -m "feat: add settings button and category filter pills to SupplierList"
```

---

### Task 11: Update SuppliersModule — Pass Categories

**Files:**
- Modify: `modules/suppliers/SuppliersModule.tsx`

- [ ] **Step 1: Update SuppliersModule to pass categories to SupplierList**

Replace `modules/suppliers/SuppliersModule.tsx` with:

```tsx
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Supplier, ViewState } from '../../types';
import { useSuppliers } from './hooks/useSuppliers';
import { SupplierList } from './components/SupplierList';
import { SupplierForm } from './components/SupplierForm';

export const SuppliersModule: React.FC = () => {
  const {
    suppliers,
    supplierCategories,
    isLoading,
    searchTerm,
    setSearchTerm,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  } = useSuppliers();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedSupplierId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedSupplierId(id);
    setView('EDIT');
  };

  const handleSave = (supplier: Supplier) => {
    if (selectedSupplierId) {
      updateSupplier(supplier);
    } else {
      addSupplier(supplier);
    }
    setView('LIST');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {view === 'LIST' && (
        <SupplierList
          suppliers={suppliers}
          categories={supplierCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <SupplierForm
          existingSupplier={suppliers.find(s => s.id === selectedSupplierId)}
          categories={supplierCategories}
          onSave={handleSave}
          onCancel={() => setView('LIST')}
          onDelete={selectedSupplierId ? (id) => { deleteSupplier(id); setView('LIST'); } : undefined}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/SuppliersModule.tsx
git commit -m "feat: pass categories to SupplierList, add loading state"
```

---

### Task 12: Update SupplierForm — Dynamic Categories & Default Payment Terms

**Files:**
- Modify: `modules/suppliers/components/SupplierForm.tsx`

- [ ] **Step 1: Replace SupplierForm.tsx**

Replace `modules/suppliers/components/SupplierForm.tsx` with:

```tsx
import React, { useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Supplier, SupplierCategory } from '../../../types';
import { Section, Input, TextArea, Select } from '../../../components/FormElements';
import { PhoneInput } from '../../../components/PhoneInput';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { useSupplierSettings } from '../hooks/useSupplierSettings';
import { supplierSchema } from '../schemas';

interface SupplierFormProps {
  existingSupplier?: Supplier;
  categories: SupplierCategory[];
  onSave: (s: Supplier) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({ existingSupplier, categories, onSave, onCancel, onDelete }) => {
  const { errors, validate, clearFieldError } = useFormValidation(supplierSchema);
  const { supplierSettings } = useSupplierSettings();
  const [formData, setFormData] = useState<Supplier>(existingSupplier || {
    id: '',
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    categoryId: null,
    paymentTerms: supplierSettings.defaultPaymentTerms,
    active: true,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validate(formData);
    if (!validated) return;
    onSave(formData);
  };

  const categoryOptions = [
    { value: '', label: '— Aucune catégorie —' },
    ...categories.map(c => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

           <Section title="Informations Entreprise">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Nom de l'entreprise"
                  required
                  value={formData.name}
                  onChange={e => { clearFieldError('name'); setFormData({...formData, name: e.target.value}); }}
                  placeholder="Ex: L'Oréal Pro"
                  error={errors.name}
                />
                <Input
                  label="Site Web"
                  value={formData.website}
                  onChange={e => setFormData({...formData, website: e.target.value})}
                  placeholder="www.exemple.com"
                />
              </div>
              <TextArea
                label="Adresse"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                rows={2}
                placeholder="Adresse postale complète..."
              />
           </Section>

           <Section title="Contact Principal">
              <Input
                label="Nom du contact"
                value={formData.contactName}
                onChange={e => setFormData({...formData, contactName: e.target.value})}
                placeholder="Ex: Jean Dupont"
              />
              <div className="grid grid-cols-2 gap-5">
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={e => { clearFieldError('email'); setFormData({...formData, email: e.target.value}); }}
                  placeholder="contact@email.com"
                  error={errors.email}
                />
                <PhoneInput
                  label="Téléphone"
                  value={formData.phone}
                  onChange={phone => setFormData({...formData, phone})}
                />
              </div>
           </Section>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="flex flex-col gap-3 sticky top-6 z-10">
             <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
            >
               <Save size={16} />
               Enregistrer
             </button>
             <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
             {existingSupplier && onDelete && (
               <button
                 type="button"
                 onClick={() => {
                   if (window.confirm('Supprimer ce fournisseur ? Cette action est irréversible.')) {
                     onDelete(existingSupplier.id);
                   }
                 }}
                 className="w-full py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium transition-all text-sm flex justify-center items-center gap-2"
               >
                 <Trash2 size={16} />
                 Supprimer
               </button>
             )}
           </div>

           <Section title="Paramètres">
              <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-700 font-medium">Fournisseur Actif</span>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.active ? 'left-5' : 'left-0.5'}`} />
                  </button>
              </div>

              <Select
                 label="Catégorie"
                 value={formData.categoryId ?? ''}
                 onChange={(val) => { clearFieldError('categoryId'); setFormData({...formData, categoryId: val ? val as string : null}); }}
                 options={categoryOptions}
              />

              <Input
                 label="Conditions de Paiement"
                 value={formData.paymentTerms}
                 onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                 placeholder="Ex: 30 jours"
              />
           </Section>

           <Section title="Notes Internes">
              <TextArea
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                rows={4}
                placeholder="Notes sur le fournisseur..."
              />
           </Section>
        </div>
      </form>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/suppliers/components/SupplierForm.tsx
git commit -m "feat: use dynamic categories and default payment terms in SupplierForm"
```

---

### Task 13: Verify & Build

- [ ] **Step 1: Run the dev server to check for TypeScript errors**

Run:
```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Manual smoke test**

Run:
```bash
npm run dev
```

Verify:
1. Navigate to `/suppliers` — settings gear icon visible, category pills show (if categories exist from backfill)
2. Click gear icon — `/suppliers/settings` loads with Catégories and Général tabs
3. Catégories tab: add a category, name it, pick a color, expand and assign suppliers, save — toast confirms
4. Général tab: change default payment terms, PO prefix, save — toast confirms
5. Go back to suppliers, create a new supplier — category dropdown shows dynamic categories, payment terms pre-filled
6. Category filter pills work on the supplier list

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address build/runtime issues from supplier settings"
```
