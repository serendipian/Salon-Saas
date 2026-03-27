# Plan 2A: Core Data Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Suppliers, Products, Services, and Clients from in-memory AppContext mock data to real Supabase queries via TanStack Query, establishing reusable patterns for Plans 2B/2C.

**Architecture:** Each module hook is rewritten to use TanStack Query (`useQuery` for reads, `useMutation` for writes) calling Supabase directly. Co-located mapper files handle DB row ↔ frontend type translation (snake_case ↔ camelCase). RLS via `set_session_context()` scopes reads automatically; writes include `salon_id` explicitly. Query keys include `salonId` to auto-refetch on salon switch.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Supabase JS v2, Vite 6

**Spec:** `docs/superpowers/specs/2026-03-27-plan-2a-core-data-migration-design.md`

---

## File Structure

```
lib/
  format.ts                                    # CREATE — formatPrice standalone utility

modules/
  suppliers/
    mappers.ts                                 # CREATE — DB Row ↔ Supplier type mappers
    hooks/useSuppliers.ts                      # REWRITE — TanStack Query + Supabase

  products/
    mappers.ts                                 # CREATE — DB Row ↔ Product type mappers
    hooks/useProducts.ts                       # REWRITE — TanStack Query + Supabase
    components/ProductForm.tsx                  # MODIFY — supplier text → dropdown

  services/
    mappers.ts                                 # CREATE — DB Row ↔ Service type mappers
    hooks/useServices.ts                       # REWRITE — TanStack Query + Supabase

  clients/
    mappers.ts                                 # CREATE — DB Row ↔ Client type mappers
    hooks/useClients.ts                        # REWRITE — TanStack Query + Supabase

  pos/
    hooks/usePOS.ts                            # MODIFY — switch from AppContext to module hooks

  dashboard/
    DashboardModule.tsx                        # MODIFY — replace formatPrice import

context/
  AppContext.tsx                                # MODIFY — remove migrated state + formatPrice
  AuthContext.tsx                               # MODIFY — make switchSalon async

types.ts                                       # MODIFY — add sortOrder to category types
```

---

### Task 1: Extract `formatPrice` to Standalone Utility

**Why:** Multiple components import `useAppContext()` solely for `formatPrice`, coupling them to AppContext unnecessarily. Extracting it first unblocks AppContext cleanup later.

**Files:**
- Create: `lib/format.ts`
- Modify: `modules/clients/components/ClientList.tsx`
- Modify: `modules/products/components/ProductList.tsx`
- Modify: `modules/services/components/ServiceList.tsx`
- Modify: `modules/dashboard/DashboardModule.tsx` (MetricCard component)
- Modify: `context/AppContext.tsx` (remove formatPrice from context)

- [ ] **Step 1: Create `lib/format.ts`**

```typescript
// lib/format.ts
export function formatPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}
```

- [ ] **Step 2: Update `ClientList.tsx` — replace AppContext import**

In `modules/clients/components/ClientList.tsx`, replace:
```typescript
import { useAppContext } from '../../../context/AppContext';
```
with:
```typescript
import { formatPrice } from '../../../lib/format';
```

And remove this line from inside the component:
```typescript
const { formatPrice } = useAppContext();
```

- [ ] **Step 3: Update `ProductList.tsx` — replace AppContext import**

In `modules/products/components/ProductList.tsx`, replace:
```typescript
import { useAppContext } from '../../../context/AppContext';
```
with:
```typescript
import { formatPrice } from '../../../lib/format';
```

And remove this line from inside the component:
```typescript
const { formatPrice } = useAppContext();
```

- [ ] **Step 4: Update `ServiceList.tsx` — replace AppContext import**

In `modules/services/components/ServiceList.tsx`, replace:
```typescript
import { useAppContext } from '../../../context/AppContext';
```
with:
```typescript
import { formatPrice } from '../../../lib/format';
```

And remove this line from inside the component:
```typescript
const { formatPrice } = useAppContext();
```

- [ ] **Step 5: Update `DashboardModule.tsx` — replace AppContext formatPrice usage**

In `modules/dashboard/DashboardModule.tsx`, add this import at top:
```typescript
import { formatPrice } from '../../lib/format';
```

In the `MetricCard` component (line ~19-20), remove the line:
```typescript
const { formatPrice } = useAppContext();
```

In the main `DashboardModule` component, the existing destructuring:
```typescript
const { transactions, appointments, clients, formatPrice } = useAppContext();
```
becomes:
```typescript
const { transactions, appointments, clients } = useAppContext();
```

- [ ] **Step 6: Remove `formatPrice` from AppContext**

In `context/AppContext.tsx`:

Remove from the `AppContextType` interface:
```typescript
  // Helper
  formatPrice: (amount: number) => string;
```

Remove the `formatPrice` function (lines 187-200):
```typescript
  const formatPrice = (amount: number) => {
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: salonSettings.currency
      }).format(amount);
    } catch (error) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    }
  };
```

Remove `formatPrice` from the `value` object (line 284).

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add lib/format.ts modules/clients/components/ClientList.tsx modules/products/components/ProductList.tsx modules/services/components/ServiceList.tsx modules/dashboard/DashboardModule.tsx context/AppContext.tsx
git commit -m "refactor: extract formatPrice to standalone lib/format.ts utility"
```

---

### Task 2: Fix `switchSalon` Race Condition

**Why:** `switchSalon` calls `setSalonContext` (Supabase RPC) as fire-and-forget. When TanStack Query keys include `salonId`, queries will fire immediately on state change — but the PostgreSQL session variable may still have the old salon context, returning stale/wrong data cached under the new key.

**Files:**
- Modify: `context/AuthContext.tsx`

- [ ] **Step 1: Make `switchSalon` async and await `setSalonContext`**

In `context/AuthContext.tsx`, find the `switchSalon` function (lines 105-117):

```typescript
  const switchSalon = useCallback((salonId: string) => {
    const membership = memberships.find(m => m.salon_id === salonId);
    if (!membership) {
      console.error('No membership found for salon:', salonId);
      return;
    }
    setActiveSalon(membership.salon);
    setRole(membership.role);
    // Persist last salon choice
    localStorage.setItem('lastSalonId', salonId);
    // Set RLS context (fire-and-forget, next query will use it)
    setSalonContext(salonId, membership.role);
  }, [memberships, setSalonContext]);
```

Replace with:

```typescript
  const switchSalon = useCallback(async (salonId: string) => {
    const membership = memberships.find(m => m.salon_id === salonId);
    if (!membership) {
      console.error('No membership found for salon:', salonId);
      return;
    }
    // Set RLS context BEFORE updating state — ensures Supabase session
    // is ready before TanStack Query refetches on the new salonId key
    await setSalonContext(salonId, membership.role);
    setActiveSalon(membership.salon);
    setRole(membership.role);
    localStorage.setItem('lastSalonId', salonId);
  }, [memberships, setSalonContext]);
```

- [ ] **Step 2: Update `switchSalon` type signature in `AuthContextType`**

In `context/AuthContext.tsx`, update the interface (line 29):

```typescript
  switchSalon: (salonId: string) => void;
```

Replace with:

```typescript
  switchSalon: (salonId: string) => Promise<void>;
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. No callers need updating because the return value is not used — they just call `switchSalon(id)` without awaiting.

- [ ] **Step 4: Commit**

```bash
git add context/AuthContext.tsx
git commit -m "fix: make switchSalon await setSalonContext to prevent stale RLS data"
```

---

### Task 3: Add `sortOrder` to Category Frontend Types

**Why:** The DB tables `product_categories` and `service_categories` have `sort_order`. Without this field in the frontend types, saving categories back would silently lose ordering.

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add `sortOrder` to `ServiceCategory`**

In `types.ts`, find (lines 38-42):

```typescript
export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
}
```

Replace with:

```typescript
export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
}
```

- [ ] **Step 2: Add `sortOrder` to `ProductCategory`**

In `types.ts`, find (lines 54-58):

```typescript
export interface ProductCategory {
  id: string;
  name: string;
  color: string;
}
```

Replace with:

```typescript
export interface ProductCategory {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Adding an optional field is backward-compatible.

- [ ] **Step 4: Commit**

```bash
git add types.ts
git commit -m "feat: add sortOrder to ServiceCategory and ProductCategory types"
```

---

### Task 4: Migrate Suppliers

**Why first:** Zero dependencies on other modules. No joins. Simplest CRUD. Validates the entire TanStack Query + Supabase pattern.

**Files:**
- Create: `modules/suppliers/mappers.ts`
- Rewrite: `modules/suppliers/hooks/useSuppliers.ts`
- Modify: `context/AppContext.tsx` (remove suppliers state)

- [ ] **Step 1: Create `modules/suppliers/mappers.ts`**

```typescript
// modules/suppliers/mappers.ts
import type { Supplier } from '../../types';

// DB row type from Supabase
interface SupplierRow {
  id: string;
  salon_id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string | null;
  address: string | null;
  category: string;
  payment_terms: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
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
    category: row.category,
    paymentTerms: row.payment_terms ?? undefined,
    active: row.active,
    notes: row.notes ?? undefined,
  };
}

export function toSupplierInsert(data: Partial<Supplier>, salonId: string) {
  return {
    id: data.id || undefined,
    salon_id: salonId,
    name: data.name!,
    contact_name: data.contactName!,
    email: data.email!,
    phone: data.phone!,
    website: data.website ?? null,
    address: data.address ?? null,
    category: data.category!,
    payment_terms: data.paymentTerms ?? null,
    active: data.active ?? true,
    notes: data.notes ?? null,
  };
}
```

- [ ] **Step 2: Rewrite `modules/suppliers/hooks/useSuppliers.ts`**

Replace the entire file with:

```typescript
// modules/suppliers/hooks/useSuppliers.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toSupplier, toSupplierInsert } from '../mappers';
import type { Supplier } from '../../../types';

export const useSuppliers = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .is('deleted_at', null);

      if (error) throw error;
      return (data ?? []).map(toSupplier);
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
    onError: (error) => console.error('Failed to add supplier:', error.message),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { error } = await supabase
        .from('suppliers')
        .update(toSupplierInsert(supplier, salonId))
        .eq('id', supplier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: (error) => console.error('Failed to update supplier:', error.message),
  });

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.contactName.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  return {
    suppliers: filteredSuppliers,
    allSuppliers: suppliers,
    isLoading,
    searchTerm,
    setSearchTerm,
    addSupplier: (supplier: Supplier) => addSupplierMutation.mutate(supplier),
    updateSupplier: (supplier: Supplier) => updateSupplierMutation.mutate(supplier),
  };
};
```

**Note:** `allSuppliers` is exported unfiltered — this will be needed by `ProductForm` (Task 6) for the supplier dropdown.

- [ ] **Step 3: Remove suppliers from AppContext**

In `context/AppContext.tsx`:

1. Remove the import: `import { MOCK_SUPPLIERS } from '../modules/suppliers/data';`

2. Remove from `AppContextType` interface (lines 104-107):
```typescript
  // Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
```

3. Remove the `Supplier` type from the imports at the top (line 12):
```typescript
  Supplier,
```

4. Remove state initialization (line 142):
```typescript
  const [suppliers, setSuppliers] = useState<Supplier[]>(MOCK_SUPPLIERS);
```

5. Remove action functions (lines 224-225):
```typescript
  const addSupplier = (s: Supplier) => setSuppliers(prev => [...prev, { ...s, id: s.id || `sup${Date.now()}` }]);
  const updateSupplier = (s: Supplier) => setSuppliers(prev => prev.map(item => item.id === s.id ? s : item));
```

6. Remove from value object (line 279):
```typescript
    suppliers, addSupplier, updateSupplier,
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. No other files import suppliers from AppContext (only `useSuppliers` hook did, which is now rewritten).

- [ ] **Step 5: Commit**

```bash
git add modules/suppliers/mappers.ts modules/suppliers/hooks/useSuppliers.ts context/AppContext.tsx
git commit -m "feat: migrate suppliers from AppContext to Supabase + TanStack Query"
```

---

### Task 5: Migrate Products + Product Categories

**Why second:** Depends on Suppliers being live (supplier_id FK). Products query uses a Supabase relation JOIN to get supplier name.

**Files:**
- Create: `modules/products/mappers.ts`
- Rewrite: `modules/products/hooks/useProducts.ts`
- Modify: `context/AppContext.tsx` (remove products + productCategories state)

- [ ] **Step 1: Create `modules/products/mappers.ts`**

```typescript
// modules/products/mappers.ts
import type { Product, ProductCategory } from '../../types';

// DB row type — includes joined supplier name from relation query
interface ProductRow {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  sku: string | null;
  barcode: string | null;
  stock: number;
  supplier_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  suppliers?: { name: string } | null;
}

interface ProductCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    categoryId: row.category_id ?? '',
    price: row.price,
    cost: row.cost,
    sku: row.sku ?? '',
    barcode: row.barcode ?? undefined,
    stock: row.stock,
    supplier: row.suppliers?.name ?? undefined,
    active: row.active,
  };
}

export function toProductInsert(data: Partial<Product>, salonId: string, supplierId?: string | null) {
  return {
    id: data.id || undefined,
    salon_id: salonId,
    name: data.name!,
    description: data.description || null,
    category_id: data.categoryId || null,
    price: data.price ?? 0,
    cost: data.cost ?? 0,
    sku: data.sku || null,
    barcode: data.barcode || null,
    stock: data.stock ?? 0,
    supplier_id: supplierId ?? null,
    active: data.active ?? true,
  };
}

export function toProductCategory(row: ProductCategoryRow): ProductCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order ?? undefined,
  };
}

export function toProductCategoryInsert(cat: ProductCategory, salonId: string) {
  return {
    id: cat.id || undefined,
    salon_id: salonId,
    name: cat.name,
    color: cat.color,
    sort_order: cat.sortOrder ?? null,
  };
}
```

- [ ] **Step 2: Rewrite `modules/products/hooks/useProducts.ts`**

Replace the entire file with:

```typescript
// modules/products/hooks/useProducts.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toProduct, toProductInsert, toProductCategory, toProductCategoryInsert } from '../mappers';
import type { Product, ProductCategory } from '../../../types';

export const useProducts = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // --- Products query (with supplier name via relation) ---
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, suppliers(name)')
        .is('deleted_at', null);

      if (error) throw error;
      return (data ?? []).map(toProduct);
    },
    enabled: !!salonId,
  });

  // --- Product Categories query ---
  const { data: productCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['product_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []).map(toProductCategory);
    },
    enabled: !!salonId,
  });

  // --- Mutations ---
  const addProductMutation = useMutation({
    mutationFn: async ({ product, supplierId }: { product: Product; supplierId?: string | null }) => {
      const { error } = await supabase
        .from('products')
        .insert(toProductInsert(product, salonId, supplierId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: (error) => console.error('Failed to add product:', error.message),
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ product, supplierId }: { product: Product; supplierId?: string | null }) => {
      const { error } = await supabase
        .from('products')
        .update(toProductInsert(product, salonId, supplierId))
        .eq('id', product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: (error) => console.error('Failed to update product:', error.message),
  });

  const updateProductCategoriesMutation = useMutation({
    mutationFn: async (categories: ProductCategory[]) => {
      // Fetch current categories for comparison
      const { data: existing, error: fetchErr } = await supabase
        .from('product_categories')
        .select('id')
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(c => c.id));
      const newIds = new Set(categories.map(c => c.id));

      // Soft-delete removed categories
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('product_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining categories
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toProductCategoryInsert({ ...cat, sortOrder: i }, salonId);
        if (existingIds.has(cat.id)) {
          const { error } = await supabase
            .from('product_categories')
            .update({ name: row.name, color: row.color, sort_order: row.sort_order })
            .eq('id', cat.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('product_categories')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_categories', salonId] });
    },
    onError: (error) => console.error('Failed to update product categories:', error.message),
  });

  // --- Filtering ---
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  return {
    products: filteredProducts,
    productCategories,
    isLoading: isLoadingProducts || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addProduct: (product: Product, supplierId?: string | null) =>
      addProductMutation.mutate({ product, supplierId }),
    updateProduct: (product: Product, supplierId?: string | null) =>
      updateProductMutation.mutate({ product, supplierId }),
    updateProductCategories: (categories: ProductCategory[]) =>
      updateProductCategoriesMutation.mutate(categories),
  };
};
```

- [ ] **Step 3: Remove products and productCategories from AppContext**

In `context/AppContext.tsx`:

1. Remove the imports at top:
```typescript
import { INITIAL_PRODUCTS, INITIAL_PRODUCT_CATEGORIES } from '../modules/products/data';
```

2. Remove from `AppContextType` interface:
```typescript
  // Products
  products: Product[];
  productCategories: ProductCategory[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  updateProductCategories: (categories: ProductCategory[]) => void;
```

3. Remove `Product` and `ProductCategory` from type imports at top.

4. Remove state:
```typescript
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(INITIAL_PRODUCT_CATEGORIES);
```

5. Remove action functions:
```typescript
  const addProduct = (p: Product) => setProducts(prev => [...prev, { ...p, id: p.id || `prd${Date.now()}` }]);
  const updateProduct = (p: Product) => setProducts(prev => prev.map(item => item.id === p.id ? p : item));
  const updateProductCategories = (cats: ProductCategory[]) => setProductCategories(cats);
```

6. Remove from value object:
```typescript
    products, productCategories, addProduct, updateProduct, updateProductCategories,
```

7. **Important:** The `addTransaction` function references `setProducts` for stock updates (lines 236-246). Since products now live in Supabase, replace that block with a TanStack Query invalidation. Import `useQueryClient` is not available here (AppContext is not a hook consumer in the same way). Instead, simply **remove the stock-update block entirely** — stock updates will be handled in Plan 2C when transactions are migrated. For now, leave a comment:

Replace lines 236-246:
```typescript
    // Logic: Update Stock if products sold
    t.items.forEach(item => {
      if (item.type === 'PRODUCT') {
        setProducts(currentProducts =>
          currentProducts.map(p => {
            if (p.id === item.referenceId) {
              return { ...p, stock: Math.max(0, p.stock - item.quantity) };
            }
            return p;
          })
        );
      }
    });
```

With:
```typescript
    // Note: Product stock updates moved to Supabase in Plan 2C (transaction migration)
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Check that `ProductForm.tsx` still works (it still uses the `supplier` string field — Task 6 will change it to a dropdown).

- [ ] **Step 5: Commit**

```bash
git add modules/products/mappers.ts modules/products/hooks/useProducts.ts context/AppContext.tsx
git commit -m "feat: migrate products and product categories to Supabase + TanStack Query"
```

---

### Task 6: Update ProductForm — Supplier Dropdown

**Why:** The DB stores `supplier_id` (UUID FK to suppliers table), but the form currently has a free-text input. This must become a dropdown populated from `useSuppliers()`.

**Files:**
- Modify: `modules/products/components/ProductForm.tsx`
- Modify: `modules/products/ProductsModule.tsx` (pass supplierId through save flow)

- [ ] **Step 1: Read `ProductsModule.tsx` to understand save flow**

Before editing, read `modules/products/ProductsModule.tsx` to see how `onSave` is wired from `ProductForm` to `addProduct`/`updateProduct`. This determines how to pass `supplierId` through.

- [ ] **Step 2: Update `ProductForm.tsx` — add supplier dropdown**

In `modules/products/components/ProductForm.tsx`:

1. Add import for `useSuppliers`:
```typescript
import { useSuppliers } from '../hooks/useSuppliers';
```

2. Add `supplierId` to form state. Replace the default state initialization:

```typescript
  const [formData, setFormData] = useState<Product>(existingProduct || {
    id: '',
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    price: 0,
    cost: 0,
    sku: '',
    barcode: '',
    stock: 0,
    supplier: '',
    active: true
  });
```

With:

```typescript
  const { allSuppliers } = useSuppliers();
  const [formData, setFormData] = useState<Product>(existingProduct || {
    id: '',
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    price: 0,
    cost: 0,
    sku: '',
    barcode: '',
    stock: 0,
    supplier: '',
    active: true
  });
  const [supplierId, setSupplierId] = useState<string>(
    // If editing, try to find the supplier ID by matching the supplier name
    existingProduct?.supplier
      ? allSuppliers.find(s => s.name === existingProduct.supplier)?.id ?? ''
      : ''
  );
```

3. Replace the supplier `<Input>` field (lines 159-163):

```typescript
             <Input
               label="Fournisseur"
               value={formData.supplier || ''}
               onChange={e => setFormData({...formData, supplier: e.target.value})}
             />
```

With:

```typescript
             <Select
               label="Fournisseur"
               value={supplierId}
               onChange={(val) => {
                 setSupplierId(val as string);
                 const supplierName = allSuppliers.find(s => s.id === val)?.name ?? '';
                 setFormData({...formData, supplier: supplierName});
               }}
               options={[
                 { value: '', label: 'Aucun fournisseur', initials: '--' },
                 ...allSuppliers.map(s => ({ value: s.id, label: s.name, initials: s.name.substring(0, 2).toUpperCase() }))
               ]}
             />
```

- [ ] **Step 3: Update `ProductsModule.tsx` save handler to pass `supplierId`**

In `modules/products/ProductsModule.tsx`, update the `onSave` handler in `ProductForm` to pass `supplierId`:

The current pattern is something like:
```typescript
onSave={(product) => {
  if (editingId) {
    updateProduct(product);
  } else {
    addProduct(product);
  }
}}
```

Since `ProductForm` now tracks `supplierId` internally but needs to pass it to the hook, modify the `ProductForm` interface and `onSave`:

In `ProductForm.tsx`, update the `onSave` prop type and the save button handler:

Find the interface:
```typescript
interface ProductFormProps {
  existingProduct?: Product;
  categories: ProductCategory[];
  onSave: (p: Product) => void;
  onCancel: () => void;
}
```

Replace with:
```typescript
interface ProductFormProps {
  existingProduct?: Product;
  categories: ProductCategory[];
  onSave: (p: Product, supplierId?: string | null) => void;
  onCancel: () => void;
}
```

Then update the save button's onClick to pass supplierId:

Find:
```typescript
onSave({...formData, id: formData.id || crypto.randomUUID()});
```

Replace with:
```typescript
onSave({...formData, id: formData.id || crypto.randomUUID()}, supplierId || null);
```

In `ProductsModule.tsx`, update the `onSave` handler to pass through:
```typescript
onSave={(product, supplierId) => {
  if (editingId) {
    updateProduct(product, supplierId);
  } else {
    addProduct(product, supplierId);
  }
}}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/products/components/ProductForm.tsx modules/products/ProductsModule.tsx
git commit -m "feat: replace product supplier text input with dropdown from Supabase"
```

---

### Task 7: Migrate Services + Service Categories + Service Variants

**Why third:** Similar pattern to Products but with a 3-table JOIN (services + service_variants + service_categories).

**Files:**
- Create: `modules/services/mappers.ts`
- Rewrite: `modules/services/hooks/useServices.ts`
- Modify: `context/AppContext.tsx` (remove services + serviceCategories state)

- [ ] **Step 1: Create `modules/services/mappers.ts`**

```typescript
// modules/services/mappers.ts
import type { Service, ServiceVariant, ServiceCategory } from '../../types';

// DB row types
interface ServiceVariantRow {
  id: string;
  service_id: string;
  salon_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  cost: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

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
  service_variants?: ServiceVariantRow[];
}

interface ServiceCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toServiceVariant(row: ServiceVariantRow): ServiceVariant {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    price: row.price,
    cost: row.cost,
  };
}

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
  };
}

export function toServiceInsert(data: Partial<Service>, salonId: string) {
  return {
    id: data.id || undefined,
    salon_id: salonId,
    name: data.name!,
    category_id: data.categoryId || null,
    description: data.description || null,
    active: data.active ?? true,
  };
}

export function toVariantInsert(variant: ServiceVariant, serviceId: string, salonId: string, sortOrder: number) {
  return {
    id: variant.id || undefined,
    service_id: serviceId,
    salon_id: salonId,
    name: variant.name,
    duration_minutes: variant.durationMinutes,
    price: variant.price,
    cost: variant.cost,
    sort_order: sortOrder,
  };
}

export function toServiceCategory(row: ServiceCategoryRow): ServiceCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order ?? undefined,
  };
}

export function toServiceCategoryInsert(cat: ServiceCategory, salonId: string) {
  return {
    id: cat.id || undefined,
    salon_id: salonId,
    name: cat.name,
    color: cat.color,
    sort_order: cat.sortOrder ?? null,
  };
}
```

- [ ] **Step 2: Rewrite `modules/services/hooks/useServices.ts`**

Replace the entire file with:

```typescript
// modules/services/hooks/useServices.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  toService, toServiceInsert, toVariantInsert,
  toServiceCategory, toServiceCategoryInsert,
} from '../mappers';
import type { Service, ServiceCategory } from '../../../types';

export const useServices = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // --- Services query (with nested variants) ---
  const { data: services = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['services', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, service_variants(*)')
        .is('deleted_at', null);

      if (error) throw error;
      return (data ?? []).map(toService);
    },
    enabled: !!salonId,
  });

  // --- Service Categories query ---
  const { data: serviceCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['service_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []).map(toServiceCategory);
    },
    enabled: !!salonId,
  });

  // --- Add Service (+ variants) ---
  const addServiceMutation = useMutation({
    mutationFn: async (service: Service) => {
      // Insert the service row
      const serviceRow = toServiceInsert(service, salonId);
      const { data: inserted, error: svcErr } = await supabase
        .from('services')
        .insert(serviceRow)
        .select('id')
        .single();
      if (svcErr) throw svcErr;

      // Insert variants with the new service ID
      if (service.variants.length > 0) {
        const variantRows = service.variants.map((v, i) =>
          toVariantInsert(v, inserted.id, salonId, i)
        );
        const { error: varErr } = await supabase
          .from('service_variants')
          .insert(variantRows);
        if (varErr) throw varErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
    },
    onError: (error) => console.error('Failed to add service:', error.message),
  });

  // --- Update Service (+ upsert/delete variants) ---
  const updateServiceMutation = useMutation({
    mutationFn: async (service: Service) => {
      // Update the service row
      const { error: svcErr } = await supabase
        .from('services')
        .update(toServiceInsert(service, salonId))
        .eq('id', service.id);
      if (svcErr) throw svcErr;

      // Get existing variant IDs for this service
      const { data: existingVariants, error: fetchErr } = await supabase
        .from('service_variants')
        .select('id')
        .eq('service_id', service.id)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existingVariants ?? []).map(v => v.id));
      const newIds = new Set(service.variants.filter(v => v.id).map(v => v.id));

      // Soft-delete removed variants
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('service_variants')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining variants
      for (let i = 0; i < service.variants.length; i++) {
        const v = service.variants[i];
        const row = toVariantInsert(v, service.id, salonId, i);
        if (v.id && existingIds.has(v.id)) {
          // Update existing
          const { error } = await supabase
            .from('service_variants')
            .update({
              name: row.name,
              duration_minutes: row.duration_minutes,
              price: row.price,
              cost: row.cost,
              sort_order: row.sort_order,
            })
            .eq('id', v.id);
          if (error) throw error;
        } else {
          // Insert new (strip id so DB generates one)
          const { error } = await supabase
            .from('service_variants')
            .insert({ ...row, id: undefined });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
    },
    onError: (error) => console.error('Failed to update service:', error.message),
  });

  // --- Update Service Categories ---
  const updateServiceCategoriesMutation = useMutation({
    mutationFn: async (categories: ServiceCategory[]) => {
      const { data: existing, error: fetchErr } = await supabase
        .from('service_categories')
        .select('id')
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(c => c.id));
      const newIds = new Set(categories.map(c => c.id));

      // Soft-delete removed
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('service_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toServiceCategoryInsert({ ...cat, sortOrder: i }, salonId);
        if (existingIds.has(cat.id)) {
          const { error } = await supabase
            .from('service_categories')
            .update({ name: row.name, color: row.color, sort_order: row.sort_order })
            .eq('id', cat.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('service_categories')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_categories', salonId] });
    },
    onError: (error) => console.error('Failed to update service categories:', error.message),
  });

  // --- Filtering ---
  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;
    const term = searchTerm.toLowerCase();
    return services.filter(s =>
      s.name.toLowerCase().includes(term)
    );
  }, [services, searchTerm]);

  return {
    services: filteredServices,
    serviceCategories,
    isLoading: isLoadingServices || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addService: (service: Service) => addServiceMutation.mutate(service),
    updateService: (service: Service) => updateServiceMutation.mutate(service),
    updateServiceCategories: (categories: ServiceCategory[]) =>
      updateServiceCategoriesMutation.mutate(categories),
  };
};
```

- [ ] **Step 3: Remove services and serviceCategories from AppContext**

In `context/AppContext.tsx`:

1. Remove imports:
```typescript
import { INITIAL_SERVICES, INITIAL_SERVICE_CATEGORIES } from '../modules/services/data';
```

2. Remove from `AppContextType` interface:
```typescript
  // Services
  services: Service[];
  serviceCategories: ServiceCategory[];
  addService: (service: Service) => void;
  updateService: (service: Service) => void;
  updateServiceCategories: (categories: ServiceCategory[]) => void;
```

3. Remove `Service` and `ServiceCategory` from type imports.

4. Remove state:
```typescript
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(INITIAL_SERVICE_CATEGORIES);
```

5. Remove action functions:
```typescript
  const addService = (s: Service) => setServices(prev => [...prev, { ...s, id: s.id || `srv${Date.now()}` }]);
  const updateService = (s: Service) => setServices(prev => prev.map(item => item.id === s.id ? s : item));
  const updateServiceCategories = (cats: ServiceCategory[]) => setServiceCategories(cats);
```

6. Remove from value object:
```typescript
    services, serviceCategories, addService, updateService, updateServiceCategories,
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/services/mappers.ts modules/services/hooks/useServices.ts context/AppContext.tsx
git commit -m "feat: migrate services, variants, and categories to Supabase + TanStack Query"
```

---

### Task 8: Migrate Clients + Client Stats

**Why last:** Most complex. Has computed fields (`totalVisits`, `totalSpent`, `lastVisitDate`) from the `client_stats` database view. Also has cross-module consumers (Dashboard, POS).

**Files:**
- Create: `modules/clients/mappers.ts`
- Rewrite: `modules/clients/hooks/useClients.ts`
- Modify: `context/AppContext.tsx` (remove clients state + client side-effects in addTransaction)

- [ ] **Step 1: Create `modules/clients/mappers.ts`**

```typescript
// modules/clients/mappers.ts
import type { Client, ClientPermissions } from '../../types';

interface ClientStatsRow {
  client_id: string;
  salon_id: string;
  total_visits: number | null;
  total_spent: number | null;
  last_visit_date: string | null;
}

interface ClientRow {
  id: string;
  salon_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string | null;
  age_group: string | null;
  city: string | null;
  profession: string | null;
  company: string | null;
  notes: string | null;
  allergies: string | null;
  status: string | null;
  preferred_staff_id: string | null;
  photo_url: string | null;
  social_network: string | null;
  social_username: string | null;
  instagram: string | null;
  whatsapp: string | null;
  preferred_channel: string | null;
  other_channel_detail: string | null;
  preferred_language: string | null;
  contact_date: string | null;
  contact_method: string | null;
  message_channel: string | null;
  acquisition_source: string | null;
  acquisition_detail: string | null;
  permissions_social_media: boolean | null;
  permissions_marketing: boolean | null;
  permissions_other: boolean | null;
  permissions_other_detail: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

export function toClient(row: ClientRow, stats?: ClientStatsRow | null): Client {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    gender: (row.gender as Client['gender']) ?? undefined,
    ageGroup: row.age_group ?? undefined,
    city: row.city ?? undefined,
    profession: row.profession ?? undefined,
    company: row.company ?? undefined,
    notes: row.notes ?? undefined,
    allergies: row.allergies ?? undefined,
    status: (row.status as Client['status']) ?? undefined,
    preferredStaffId: row.preferred_staff_id ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    socialNetwork: row.social_network ?? undefined,
    socialUsername: row.social_username ?? undefined,
    instagram: row.instagram ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    preferredChannel: row.preferred_channel ?? undefined,
    otherChannelDetail: row.other_channel_detail ?? undefined,
    preferredLanguage: row.preferred_language ?? undefined,
    contactDate: row.contact_date ?? undefined,
    contactMethod: row.contact_method ?? undefined,
    messageChannel: row.message_channel ?? undefined,
    acquisitionSource: row.acquisition_source ?? undefined,
    acquisitionDetail: row.acquisition_detail ?? undefined,
    permissions: {
      socialMedia: row.permissions_social_media ?? false,
      marketing: row.permissions_marketing ?? false,
      other: row.permissions_other ?? false,
      otherDetail: row.permissions_other_detail ?? undefined,
    },
    totalVisits: stats?.total_visits ?? 0,
    totalSpent: stats?.total_spent ?? 0,
    lastVisitDate: stats?.last_visit_date ?? undefined,
    createdAt: row.created_at,
  };
}

export function toClientInsert(data: Partial<Client>, salonId: string) {
  return {
    id: data.id || undefined,
    salon_id: salonId,
    first_name: data.firstName!,
    last_name: data.lastName!,
    email: data.email!,
    phone: data.phone!,
    gender: data.gender ?? null,
    age_group: data.ageGroup ?? null,
    city: data.city ?? null,
    profession: data.profession ?? null,
    company: data.company ?? null,
    notes: data.notes ?? null,
    allergies: data.allergies ?? null,
    status: data.status ?? null,
    preferred_staff_id: data.preferredStaffId ?? null,
    photo_url: data.photoUrl ?? null,
    social_network: data.socialNetwork ?? null,
    social_username: data.socialUsername ?? null,
    instagram: data.instagram ?? null,
    whatsapp: data.whatsapp ?? null,
    preferred_channel: data.preferredChannel ?? null,
    other_channel_detail: data.otherChannelDetail ?? null,
    preferred_language: data.preferredLanguage ?? null,
    contact_date: data.contactDate ?? null,
    contact_method: data.contactMethod ?? null,
    message_channel: data.messageChannel ?? null,
    acquisition_source: data.acquisitionSource ?? null,
    acquisition_detail: data.acquisitionDetail ?? null,
    permissions_social_media: data.permissions?.socialMedia ?? false,
    permissions_marketing: data.permissions?.marketing ?? false,
    permissions_other: data.permissions?.other ?? false,
    permissions_other_detail: data.permissions?.otherDetail ?? null,
  };
}
```

- [ ] **Step 2: Rewrite `modules/clients/hooks/useClients.ts`**

Replace the entire file with:

```typescript
// modules/clients/hooks/useClients.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toClient, toClientInsert } from '../mappers';
import type { Client } from '../../../types';

export const useClients = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', salonId],
    queryFn: async () => {
      // Fetch clients and stats separately, then merge
      const [clientsRes, statsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .is('deleted_at', null),
        supabase
          .from('client_stats')
          .select('*'),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (statsRes.error) throw statsRes.error;

      // Build a lookup map for stats by client_id
      const statsMap = new Map(
        (statsRes.data ?? []).map(s => [s.client_id, s])
      );

      return (clientsRes.data ?? []).map(row =>
        toClient(row, statsMap.get(row.id) ?? null)
      );
    },
    enabled: !!salonId,
  });

  const addClientMutation = useMutation({
    mutationFn: async (client: Client) => {
      const { error } = await supabase
        .from('clients')
        .insert(toClientInsert(client, salonId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: (error) => console.error('Failed to add client:', error.message),
  });

  const updateClientMutation = useMutation({
    mutationFn: async (client: Client) => {
      const { error } = await supabase
        .from('clients')
        .update(toClientInsert(client, salonId))
        .eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: (error) => console.error('Failed to update client:', error.message),
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: (error) => console.error('Failed to delete client:', error.message),
  });

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(c =>
      c.lastName.toLowerCase().includes(term) ||
      c.firstName.toLowerCase().includes(term) ||
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  return {
    clients: filteredClients,
    allClients: clients,
    isLoading,
    searchTerm,
    setSearchTerm,
    addClient: (client: Client) => addClientMutation.mutate(client),
    updateClient: (client: Client) => updateClientMutation.mutate(client),
    deleteClient: (id: string) => deleteClientMutation.mutate(id),
  };
};
```

- [ ] **Step 3: Remove clients from AppContext + clean addTransaction side-effects**

In `context/AppContext.tsx`:

1. Remove import:
```typescript
import { MOCK_CLIENTS } from '../modules/clients/data';
```

2. Remove from `AppContextType` interface:
```typescript
  // Clients
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
```

3. Remove `Client` from type imports at top.

4. Remove state:
```typescript
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
```

5. Remove action functions:
```typescript
  const addClient = (c: Client) => setClients(prev => [...prev, { ...c, id: c.id || `c${Date.now()}` }]);
  const updateClient = (c: Client) => setClients(prev => prev.map(item => item.id === c.id ? c : item));
  const deleteClient = (id: string) => setClients(prev => prev.filter(item => item.id !== id));
```

6. In `addTransaction`, remove the client spending update block (lines 250-264):
```typescript
    // Logic: Update Client Spending
    if (t.clientId) {
       setClients(currentClients =>
         currentClients.map(c => {
           if (c.id === t.clientId) {
             return {
               ...c,
               totalSpent: c.totalSpent + t.total,
               totalVisits: c.totalVisits + 1,
               lastVisitDate: t.date.split('T')[0]
             };
           }
           return c;
         })
       );
    }
```

Replace with:
```typescript
    // Note: Client stats now computed by client_stats DB view, auto-updated on query refetch
```

7. Remove from value object:
```typescript
    clients, addClient, updateClient, deleteClient,
```

8. Also fix `generateMockTransactions` — it depends on `clients` parameter. Since `clients` state no longer exists, the `useEffect` that calls `generateMockTransactions(clients)` needs updating. The mock transactions are still used by the POS/accounting modules (not yet migrated). Pass an empty array for now:

Replace:
```typescript
  useEffect(() => {
    setTransactions(generateMockTransactions(clients));
    setExpenses(generateMockExpenses());
  }, []);
```

With:
```typescript
  useEffect(() => {
    setTransactions(generateMockTransactions([]));
    setExpenses(generateMockExpenses());
  }, []);
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/clients/mappers.ts modules/clients/hooks/useClients.ts context/AppContext.tsx
git commit -m "feat: migrate clients with client_stats view to Supabase + TanStack Query"
```

---

### Task 9: Update Cross-Module Consumers (POS + Dashboard)

**Why:** `usePOS` and `DashboardModule` currently get `services`, `serviceCategories`, `products`, `productCategories`, and `clients` from AppContext. These no longer exist there. Update them to use the new module hooks.

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`
- Modify: `modules/dashboard/DashboardModule.tsx`

- [ ] **Step 1: Update `usePOS.ts` to use module hooks**

In `modules/pos/hooks/usePOS.ts`, replace the imports and AppContext destructuring:

Replace:
```typescript
import { useAppContext } from '../../../context/AppContext';
import { CartItem, Client, Service, Product, ServiceVariant, Transaction, PaymentEntry } from '../../../types';
```

With:
```typescript
import { useAppContext } from '../../../context/AppContext';
import { useServices } from '../../services/hooks/useServices';
import { useProducts } from '../../products/hooks/useProducts';
import { useClients } from '../../clients/hooks/useClients';
import type { CartItem, Client, Service, Product, ServiceVariant, Transaction, PaymentEntry } from '../../../types';
```

Replace the current destructuring:
```typescript
  const {
    services,
    serviceCategories,
    products,
    productCategories,
    transactions,
    clients,
    addTransaction,
    salonSettings
  } = useAppContext();
```

With:
```typescript
  const { transactions, addTransaction, salonSettings } = useAppContext();
  const { services, serviceCategories } = useServices();
  const { products, productCategories } = useProducts();
  const { allClients: clients } = useClients();
```

**Note:** We use `allClients` (not `clients` which is filtered) because POS needs the full client list for its own filtering/selection.

The rest of `usePOS.ts` stays the same — it uses `services`, `products`, `clients` by name, which still match.

- [ ] **Step 2: Update `DashboardModule.tsx` to use `useClients` hook**

In `modules/dashboard/DashboardModule.tsx`, replace:

```typescript
import { useAppContext } from '../../context/AppContext';
```

With:
```typescript
import { useAppContext } from '../../context/AppContext';
import { useClients } from '../clients/hooks/useClients';
```

Replace the destructuring:
```typescript
const { transactions, appointments, clients } = useAppContext();
```

With:
```typescript
const { transactions, appointments } = useAppContext();
const { allClients: clients } = useClients();
```

(`formatPrice` was already extracted in Task 1.)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/hooks/usePOS.ts modules/dashboard/DashboardModule.tsx
git commit -m "refactor: update POS and Dashboard to use migrated module hooks"
```

---

### Task 10: Final AppContext Cleanup + Build Verification

**Why:** After all migrations, verify AppContext only contains what it should, and the full app builds cleanly.

**Files:**
- Modify: `context/AppContext.tsx` (verify/clean)

- [ ] **Step 1: Verify AppContext only retains unmigrated state**

Read `context/AppContext.tsx` and verify it only contains:

**AppContextType interface should have:**
- `appointments` + `addAppointment` + `updateAppointment`
- `team` + `addStaffMember` + `updateStaffMember`
- `transactions` + `expenses` + `addTransaction` + `addExpense`
- `salonSettings` + `updateSalonSettings`
- `expenseCategories` + `recurringExpenses` + `updateExpenseCategories` + `updateRecurringExpenses`

**Should NOT have:** `clients`, `suppliers`, `products`, `productCategories`, `services`, `serviceCategories`, `formatPrice`, or any of their CRUD functions.

If any residual references remain, remove them.

- [ ] **Step 2: Clean up unused imports in AppContext**

Remove any now-unused imports from `types.ts` (Client, Product, ProductCategory, Service, ServiceCategory, Supplier) and any unused data imports.

- [ ] **Step 3: Verify full build**

Run: `npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add context/AppContext.tsx
git commit -m "chore: clean up AppContext after Plan 2A data migrations"
```

---

### Task 11: Update CLAUDE.md

**Why:** Document the new architecture patterns so future work (Plans 2B/2C) follows them.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Data Layer section to CLAUDE.md**

Add after the "State Management" section:

```markdown
### Data Layer (Supabase + TanStack Query)

Migrated modules use TanStack Query for data fetching and Supabase for persistence:

```
modules/{module}/
  mappers.ts              # DB Row ↔ Frontend type translation
  hooks/use{Module}.ts    # TanStack Query hooks (useQuery + useMutation)
```

**Migrated modules (Plan 2A):** suppliers, products, services, clients
**Still in AppContext:** appointments, team, transactions, expenses, settings

**Query key convention:** `['resource', salonId]` — ensures auto-refetch on salon switch.

**Pattern:**
- `useQuery` for reads → calls `supabase.from('table').select()`
- `useMutation` for writes → calls insert/update + `invalidateQueries`
- Co-located mappers handle snake_case ↔ camelCase conversion
- RLS via `set_session_context()` scopes all reads automatically
- Writes include `salon_id` explicitly

**Standalone utilities:**
- `lib/format.ts` — `formatPrice()` (extracted from AppContext)
```

- [ ] **Step 2: Update "Known Issues to Fix" — mark completed items**

In the "Known Issues to Fix" section, update:
```
1. No data persistence (needs localStorage or backend) — PARTIALLY DONE (4 modules migrated to Supabase, remaining in Plan 2B/2C)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Plan 2A data layer architecture"
```
