# Plan 2A: Core Data Migration — Design Spec

## Goal

Migrate 4 modules (Suppliers, Products, Services, Clients) from in-memory mock data (AppContext) to real Supabase queries via TanStack Query. Establish reusable patterns for Plans 2B/2C.

## Architecture

Each module hook gets rewritten to use TanStack Query (`useQuery` for reads, `useMutation` for writes) calling Supabase directly. Module components stay unchanged where possible — hooks return the same shape they expect today. Where the DB schema differs from the frontend types, co-located mapper functions handle the translation.

### Data Flow

```
Component → useClients() → useQuery(['clients', salonId]) → supabase.from('clients').select()
                          → useMutation()                   → supabase.from('clients').insert()
                                                            → queryClient.invalidateQueries(['clients', salonId])
```

RLS (via `set_session_context()`) scopes all SELECT queries to the active salon automatically. INSERT/UPDATE operations must include `salon_id` explicitly.

### Query Key Convention

All query keys include `salonId` to ensure automatic refetch on salon switch:

```typescript
['clients', salonId]
['suppliers', salonId]
['products', salonId]
['product_categories', salonId]
['services', salonId]
['service_categories', salonId]
```

### File Structure

```
lib/
  format.ts                              # formatPrice extracted from AppContext (standalone)

modules/
  clients/
    hooks/useClients.ts                  # Rewritten: TanStack Query + Supabase
    mappers.ts                           # DB Row → Client, Client → DB insert shape
  suppliers/
    hooks/useSuppliers.ts                # Rewritten: TanStack Query + Supabase
    mappers.ts                           # DB Row → Supplier
  products/
    hooks/useProducts.ts                 # Rewritten: TanStack Query + Supabase
    mappers.ts                           # DB Row (+ supplier JOIN) → Product
    components/ProductForm.tsx           # Modified: supplier text input → dropdown
  services/
    hooks/useServices.ts                 # Rewritten: TanStack Query + Supabase
    mappers.ts                           # DB Row (+ variants JOIN) → Service

context/
  AppContext.tsx                          # Modified: remove migrated state, keep unmigrated
  AuthContext.tsx                         # Modified: make switchSalon await setSalonContext
```

## Pre-Migration Cleanup

### 1. Extract `formatPrice` to standalone utility

**Problem:** Multiple components import `useAppContext()` solely for `formatPrice`. This couples them to AppContext unnecessarily and blocks cleanup.

**Solution:** Create `lib/format.ts` with:

```typescript
export function formatPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}
```

Update all components that use `formatPrice` from AppContext to import from `lib/format.ts` instead. This includes:
- `modules/clients/components/ClientList.tsx`
- `modules/products/components/ProductList.tsx`
- `modules/services/components/ServiceList.tsx`
- Any other component using `const { formatPrice } = useAppContext()`

### 2. Fix salon switch race condition

**Problem:** `AuthContext.switchSalon` calls `setSalonContext` (RPC) as fire-and-forget. If TanStack Query refetches immediately on the key change, the Supabase session may still have the old salon context — returning stale/empty data that gets cached under the new salon key.

**Solution:** Make `switchSalon` async. Await `setSalonContext` before updating `activeSalon`/`role` state. This ensures the PostgreSQL session variable is set before any queries fire.

### 3. Add `sort_order` to category frontend types

**Problem:** `ServiceCategory` and `ProductCategory` in `types.ts` don't have `sort_order`, but the DB tables do. Saving categories back to Supabase would silently lose ordering.

**Solution:** Add `sortOrder?: number` to both `ServiceCategory` and `ProductCategory` in `types.ts`. Mappers preserve the field on read and write.

## Module Migrations

### Migration 1: Suppliers

**Why first:** Zero dependencies on other modules. No joins. Simplest possible CRUD. Validates the entire pattern before touching anything more complex.

**Current state:**
- `useSuppliers` hook returns: `suppliers`, `addSupplier`, `updateSupplier` from AppContext
- Components: `SupplierList` (search/filter), `SupplierForm` (create/edit), `SupplierDetails` (read)
- Frontend type: `Supplier` with fields: id, name, contactPerson, email, phone, category, paymentTerms, notes, etc.
- DB table: `suppliers` with matching columns in snake_case + `salon_id`, `deleted_at`, `created_by`, `updated_by`

**Mapper (`modules/suppliers/mappers.ts`):**
- `toSupplier(row: DB Row) → Supplier`: snake_case → camelCase
- `toSupplierInsert(data: Partial<Supplier>, salonId: string) → DB Insert`: camelCase → snake_case + salon_id

**Hook rewrite (`modules/suppliers/hooks/useSuppliers.ts`):**
- `useQuery(['suppliers', salonId])` → `supabase.from('suppliers').select('*').is('deleted_at', null)`
- `addSupplier` → `useMutation` → insert + invalidate
- `updateSupplier` → `useMutation` → update + invalidate

**AppContext cleanup:** Remove `suppliers` state, `addSupplier`, `updateSupplier` from AppContext.

### Migration 2: Products + Product Categories

**Why second:** Depends on Suppliers being live (for the supplier dropdown in ProductForm).

**Current state:**
- `useProducts` hook returns: `products`, `productCategories`, `addProduct`, `updateProduct`, `updateProductCategories`
- `Product.supplier` is a free-text string; DB has `supplier_id` (UUID FK)
- `ProductCategory` in DB has `sort_order`; frontend type does not (fixed in pre-migration)

**Breaking change — ProductForm UI:**
The `supplier` field in `ProductForm` is currently a free-text `<Input>`. Since the DB stores `supplier_id` (FK to suppliers table), this must become a `<Select>` dropdown populated from `useSuppliers()`. This is a required component change.

**Mapper (`modules/products/mappers.ts`):**
- `toProduct(row: DB Row & { supplier_name?: string }) → Product`: Maps `supplier_id` to looked-up supplier name via JOIN
- `toProductInsert(data, salonId) → DB Insert`: Maps `supplier` name back to `supplier_id` via lookup, or stores the FK directly from the new dropdown

**Hook rewrite (`modules/products/hooks/useProducts.ts`):**
- Products query: `supabase.from('products').select('*, suppliers(name)').is('deleted_at', null)` — uses Supabase relation to get supplier name inline
- Categories query: `supabase.from('product_categories').select('*').is('deleted_at', null).order('sort_order')`
- `addProduct` → insert product row with `supplier_id` from form
- `updateProduct` → update product row
- `updateProductCategories` → upsert categories (compare old/new, handle inserts/updates/deletes)

**Cross-module fix:** `usePOS` currently gets `products` and `productCategories` from AppContext. After this migration, update `usePOS` to import from `useProducts` instead.

**AppContext cleanup:** Remove `products`, `productCategories`, `addProduct`, `updateProduct`, `updateProductCategories`.

### Migration 3: Services + Service Categories + Service Variants

**Why third:** Similar pattern to Products but with a 3-table JOIN (services + service_variants + service_categories).

**Current state:**
- `useServices` hook returns: `services`, `serviceCategories`, `addService`, `updateService`, `updateServiceCategories`
- `Service` has nested `variants: ServiceVariant[]` — but in DB, `service_variants` is a separate table
- `ServiceCategory` in DB has `sort_order`

**Mapper (`modules/services/mappers.ts`):**
- `toService(row: DB Row & { service_variants: VariantRow[] }) → Service`: Nests variants array into the service object
- `toServiceInsert(data, salonId) → { service: DB Insert, variants: VariantInsert[] }`: Splits nested service+variants for relational insert

**Hook rewrite (`modules/services/hooks/useServices.ts`):**
- Services query: `supabase.from('services').select('*, service_variants(*), service_categories!inner(*)').is('deleted_at', null)`
- Categories query: separate `supabase.from('service_categories').select('*').order('sort_order')`
- `addService` → insert service row, then insert each variant row with the new service's ID
- `updateService` → update service row + upsert/delete variants
- `updateServiceCategories` → upsert with sort_order preservation

**Cross-module fix:** `usePOS` currently gets `services` and `serviceCategories` from AppContext. Update to import from `useServices`.

**AppContext cleanup:** Remove `services`, `serviceCategories`, `addService`, `updateService`, `updateServiceCategories`.

### Migration 4: Clients

**Why last:** Most complex of the four. Has computed fields (`totalVisits`, `totalSpent`, `lastVisitDate`) that don't exist in the `clients` table — they come from the `client_stats` database view. Also has cross-module consumers (Dashboard, POS).

**Current state:**
- `useClients` hook returns: `clients`, `addClient`, `updateClient`, `deleteClient`
- `Client` type has `totalVisits`, `totalSpent`, `lastVisitDate` — computed from transactions in AppContext via `addTransaction` side effects
- DB has a `client_stats` view that computes these from the `transactions` table
- `deleteClient` in AppContext filters the array; DB uses soft-delete (`deleted_at`)

**Computed fields strategy:**
The database has a `client_stats` view (defined in `20260326234633_views.sql`) that computes `total_visits`, `total_spent`, `last_visit_date` from the `transactions` table via LEFT JOIN + GROUP BY. Query clients with a separate stats fetch and merge client-side:

```typescript
// Fetch clients
const { data: clients } = await supabase.from('clients').select('*').is('deleted_at', null);
// Fetch stats
const { data: stats } = await supabase.from('client_stats').select('*');
// Merge in mapper: match by client_id
```

This avoids Supabase's limitations with joining views to tables and keeps the queries simple.

**Mapper (`modules/clients/mappers.ts`):**
- `toClient(row: DB Row & { client_stats?: StatsRow }) → Client`: Maps base client fields + merges computed stats
- `toClientInsert(data, salonId) → DB Insert`: Standard camelCase → snake_case

**Hook rewrite (`modules/clients/hooks/useClients.ts`):**
- Clients query: `supabase.from('clients').select('*, client_stats(*)').is('deleted_at', null)`
- `addClient` → insert + invalidate
- `updateClient` → update + invalidate
- `deleteClient` → `supabase.from('clients').update({ deleted_at: new Date().toISOString() })` (soft delete) + invalidate

**Cross-module fixes:**
- `usePOS` gets `clients` from AppContext → update to import from `useClients`
- `DashboardModule` gets `clients` from AppContext → update to import from `useClients`
- `addTransaction` in AppContext updates client stats in-memory → after migration, stats come from `client_stats` view, so `addTransaction` no longer needs to touch client state. Instead, invalidate `['clients', salonId]` after a transaction is added so the view recomputes.

**AppContext cleanup:** Remove `clients`, `addClient`, `updateClient`, `deleteClient`.

## AppContext After Plan 2A

After all 4 migrations, AppContext retains only:

- `appointments` + `addAppointment` + `updateAppointment`
- `team` + `addTeamMember` + `updateTeamMember`
- `transactions` + `addTransaction` (still needed for POS until Plan 2C)
- `expenses` + `addExpense`
- `expenseCategories` + `recurringExpenses`
- `salonSettings` + `updateSalonSettings`

The `addTransaction` function's side effects on products/clients are replaced by:
1. TanStack Query cache invalidation for `['products', salonId]` and `['clients', salonId]` after successful transaction insert
2. The `client_stats` view automatically recomputes on next query

## Error Handling

All mutations use TanStack Query's `onError` callback to surface errors. Pattern:

```typescript
const mutation = useMutation({
  mutationFn: async (data) => { /* supabase call */ },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resource', salonId] }),
  onError: (error) => console.error('Operation failed:', error.message),
});
```

No optimistic updates in Plan 2A — keep it simple. Optimistic updates can be added in a future pass if latency is a problem.

## Testing Strategy

Each migration is tested by:
1. Build passes (`npm run build`)
2. Manual smoke test: navigate to the module, verify data loads from Supabase
3. CRUD operations work (create, edit, delete where applicable)
4. POS module still functions after each migration (critical cross-module check)
5. Dashboard still renders after clients migration

## Out of Scope

- Pagination / infinite scroll (data volumes are small for salon use)
- Server-side search (client-side filtering is fine for <1000 records per salon)
- Optimistic updates
- Offline support
- Team, Appointments, POS, Accounting, Dashboard module migrations (Plans 2B/2C)
