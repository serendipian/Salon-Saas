# Supplier Settings Page — Design Spec

## Overview

Add a settings page for the suppliers module, following the same pattern as services (`/services/settings`) and products (`/products/settings`). Enables managing supplier categories dynamically (replacing hardcoded strings) and configuring general supplier defaults.

## Route & Navigation

- **Route**: `/suppliers/settings`
- **Guard**: `ProtectedRoute action="edit" resource="suppliers"`
- **Entry point**: Settings gear icon button in `SupplierList.tsx` header (same pattern as services/products)
- **Back link**: Arrow + "Fournisseurs" linking to `/suppliers`

## Page Structure

`SupplierSettingsPage.tsx` — two-tab layout (same pattern as `ServiceSettingsPage.tsx`):

| Tab | Component | Description |
|-----|-----------|-------------|
| Catégories | `SupplierCategoriesTab.tsx` | CRUD for supplier categories with color, reorder, supplier assignment |
| Général | `SupplierGeneralTab.tsx` | Default payment terms, PO numbering, default view |

## Database Changes

### 1. New table: `supplier_categories`

Same schema as `service_categories`:

```sql
CREATE TABLE supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-800 border-slate-200',
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

- RLS: same membership-based policies as other category tables
- `updated_at` trigger
- Audit logging trigger
- Index on `(salon_id)` where `deleted_at IS NULL`

### 2. New column: `suppliers.category_id`

```sql
ALTER TABLE suppliers ADD COLUMN category_id UUID REFERENCES supplier_categories(id) ON DELETE SET NULL;
```

Migration backfills existing string `category` values:
- For each distinct `category` string per salon, create a `supplier_categories` row
- Set `category_id` on existing suppliers to match
- Drop the old `category` text column after backfill

### 3. New RPC: `save_supplier_categories`

Same pattern as `save_service_categories`:

```sql
CREATE OR REPLACE FUNCTION save_supplier_categories(
  p_salon_id UUID,
  p_categories JSONB,
  p_assignments JSONB DEFAULT NULL
) RETURNS void
```

- Upserts categories (insert new, update existing, soft-delete removed)
- Optionally reassigns suppliers to categories via `p_assignments` (supplier_id -> category_id map)
- SECURITY DEFINER with membership check

### 4. New JSONB column: `salons.supplier_settings`

```sql
ALTER TABLE salons ADD COLUMN supplier_settings JSONB DEFAULT '{}';
```

Stores:
```typescript
interface SupplierSettings {
  defaultPaymentTerms: string;  // e.g., "30 jours"
  poPrefix: string;             // e.g., "BC-"
  poNextNumber: number;         // e.g., 1
  defaultView: 'card' | 'table';
}
```

## Frontend Changes

### New Files

| File | Description |
|------|-------------|
| `modules/suppliers/SupplierSettingsPage.tsx` | Tab container (Catégories, Général) — mirrors `ServiceSettingsPage.tsx` |
| `modules/suppliers/components/SupplierCategoriesTab.tsx` | Category CRUD: add/edit/delete/reorder categories, color picker, expandable supplier assignment. Adapted from `CategoriesTab.tsx` (no IconPicker). |
| `modules/suppliers/components/SupplierGeneralTab.tsx` | General settings form. Adapted from `GeneralTab.tsx`. |
| `modules/suppliers/hooks/useSupplierSettings.ts` | Reads/writes `salons.supplier_settings` JSONB. Same pattern as `useServiceSettings.ts`. |

### Modified Files

| File | Change |
|------|--------|
| `modules/suppliers/hooks/useSuppliers.ts` | Add `supplierCategories` query (from `supplier_categories` table) + `updateSupplierCategories` mutation (calls `save_supplier_categories` RPC) |
| `modules/suppliers/components/SupplierForm.tsx` | Replace hardcoded category Select with dynamic categories from `useSuppliers().supplierCategories` |
| `modules/suppliers/components/SupplierList.tsx` | Add settings gear button + category filter pills (same pattern as `ServiceList.tsx`) |
| `modules/suppliers/mappers.ts` | Add `toSupplierCategory` mapper + update `toSupplier`/`toSupplierInsert` for `categoryId` instead of `category` string |
| `types.ts` | Add `SupplierCategory` type + `SupplierSettings` type + update `Supplier.category` -> `Supplier.categoryId` |
| `App.tsx` | Add `/suppliers/settings` route with ProtectedRoute + ErrorBoundary |
| `lib/database.types.ts` | Regenerate after migration |

### Catégories Tab — UI Behavior

Same as services CategoriesTab:
- Accordion rows per category: color picker, inline name input, supplier count badge, delete button, expand/collapse chevron
- Reorder via arrow up/down buttons
- Expanded view: search + checkbox list to assign/unassign suppliers
- Unassigned suppliers section (amber alert box)
- Save button with change detection (disabled when no changes)
- No IconPicker (suppliers don't need icons, unlike services)

### Général Tab — UI Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Conditions de paiement par défaut | Select | "30 jours" | Options: Comptant, 15 jours, 30 jours, 45 jours, 60 jours, 90 jours |
| Préfixe bon de commande | Text input | "BC-" | Prefix for purchase order numbers |
| Prochain numéro | Number input | 1 | Next auto-increment number for POs |
| Vue par défaut | Card/Table toggle | "table" | Default list view mode |

### SupplierForm Integration

- Category dropdown populated from `supplierCategories` array
- Default payment terms pre-filled from `supplierSettings.defaultPaymentTerms`
- If no categories exist yet, show a hint linking to settings page

## Type Definitions

```typescript
// types.ts
interface SupplierCategory {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
}

interface SupplierSettings {
  defaultPaymentTerms: string;
  poPrefix: string;
  poNextNumber: number;
  defaultView: 'card' | 'table';
}

// Update Supplier interface
interface Supplier {
  // ... existing fields ...
  categoryId: string | null;  // replaces `category: string`
}
```
