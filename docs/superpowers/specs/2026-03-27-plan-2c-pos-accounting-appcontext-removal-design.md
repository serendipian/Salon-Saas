# Plan 2C — POS, Accounting & AppContext Removal

## Goal

Migrate the last two AppContext modules (Transactions/POS, Expenses/Accounting) to Supabase + TanStack Query, fix all broken `useAppContext` references from Plan 2B, then fully delete AppContext.

## Architecture

Follows the established Plan 2A/2B pattern: co-located mappers, TanStack Query hooks, `['resource', salonId]` query keys, soft-delete filtering.

Key difference from prior plans: Transactions use the existing `create_transaction` Postgres RPC for atomic multi-table inserts (transaction + items + payments + stock update), rather than direct `.insert()` calls.

A **shared `useTransactions` hook** lives at project level (`hooks/useTransactions.ts`) since transactions are consumed by POS, Dashboard, and Accounting — avoiding any single module becoming the de-facto provider.

## Tech Stack

React 19, TypeScript, TanStack Query v5, Supabase JS v2

---

## Module 1: Shared Transactions Hook + Mappers

### Files
- Create: `hooks/useTransactions.ts`
- Create: `modules/pos/mappers.ts`

### Mappers (`modules/pos/mappers.ts`)

**`TransactionRow`** interface models the JOIN result from:
```
.select('*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)')
```

Fields:
- `id`, `salon_id`, `client_id`, `date`, `total`, `notes`, `created_at`, `created_by`
- `transaction_items: TransactionItemRow[]` — nested relation
- `transaction_payments: TransactionPaymentRow[]` — nested relation
- `clients: { first_name: string; last_name: string } | null` — JOINed client name

**`TransactionItemRow`**: `id`, `reference_id`, `type`, `name`, `variant_name`, `price`, `original_price`, `quantity`, `cost`, `note`

**`TransactionPaymentRow`**: `id`, `method`, `amount`

**`toTransaction(row)`** maps:
- `row.transaction_items` → `items: CartItem[]` (snake_case → camelCase: `reference_id` → `referenceId`, `variant_name` → `variantName`, `original_price` → `originalPrice`)
- `row.transaction_payments` → `payments: PaymentEntry[]`
- `row.clients` → `clientName` (concatenate first + last, empty string fallback)
- `row.client_id` → `clientId`

**`toTransactionRpcPayload(cart, clientId, salonId)`** maps cart items and payments into the JSONB shape expected by the `create_transaction` RPC:
- Items JSONB: `{ reference_id, type, name, variant_name, price, original_price, quantity, cost, note }`
- Payments JSONB: `{ method, amount }`
- Returns `{ p_salon_id, p_client_id, p_items, p_payments }`

### Shared Hook (`hooks/useTransactions.ts`)

**Query:**
- Key: `['transactions', salonId]`
- Select: `'*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)'`
- Filter: `.eq('salon_id', salonId)` — no soft-delete filter (transactions table has no `deleted_at`)
- Order: `.order('date', { ascending: false })`
- Maps via `toTransaction()`

**Mutation (`addTransaction`):**
- Calls `supabase.rpc('create_transaction', payload)` where payload is built by `toTransactionRpcPayload()`
- The RPC atomically: validates payment total = item total, inserts transaction + items + payments, decrements product stock
- `onSuccess`: invalidates `['transactions', salonId]` and `['products', salonId]` (stock changed)
- `onError`: surfaces RPC exceptions (payment mismatch, permission denied)

**Returns:** `{ transactions, isLoading, addTransaction }`

No update/delete mutations — transactions are immutable per DB schema (no UPDATE/DELETE RLS policies).

---

## Module 2: POS Hook Rewrite

### Files
- Modify: `modules/pos/hooks/usePOS.ts`
- Modify: `modules/pos/components/PaymentModal.tsx`
- Modify: `modules/pos/components/POSModals.tsx`

### Hook Changes (`usePOS.ts`)

Replace `useAppContext()` import with `useTransactions()`:
```typescript
// Before
const { transactions, addTransaction } = useAppContext();
// After
const { transactions, addTransaction } = useTransactions();
```

**`processTransaction()`** changes:
- Remove `id: \`trx-${Date.now()}\`` — let DB generate UUID via RPC
- Call `addTransaction(cart, selectedClient?.id, salonId)` which internally calls the RPC
- Cart state stays local (useState) — not persisted

### Consumer Fixes

**`PaymentModal.tsx`** (line 5, 15):
- `useAppContext` → `useSettings()` for `salonSettings`

**`POSModals.tsx`** (line 5, 15, 144):
- `useAppContext` → `useSettings()` for `salonSettings` (two component instances)

---

## Module 3: Expenses Migration

### Files
- Create: `modules/accounting/mappers.ts`
- Modify: `modules/accounting/hooks/useAccounting.ts`
- Modify: `modules/accounting/components/AccountingExpenses.tsx`
- Modify: `modules/accounting/components/AccountingLedger.tsx`
- Modify: `modules/accounting/components/ExpenseForm.tsx`
- Modify: `modules/accounting/AccountingModule.tsx`

### Mappers (`modules/accounting/mappers.ts`)

**`ExpenseRow`** interface models the JOIN result from:
```
.select('*, expense_categories(name, color), suppliers(name)')
```

Fields: `id`, `salon_id`, `date`, `description`, `category_id`, `amount`, `supplier_id`, `proof_url`, `created_at`, `updated_at`, `deleted_at`, plus JOINed `expense_categories` and `suppliers`.

**`toExpense(row)`** maps:
- `category_id` → `category` (string ID, matching current frontend type)
- `supplier_id` → `supplierId` (new field, UUID)
- `suppliers.name` → `supplier` (display name for backwards compat)
- `proof_url` → `proofUrl`

**`toExpenseInsert(expense, salonId)`** maps:
- `category` → `category_id`
- `supplierId` → `supplier_id` (UUID FK)
- `proofUrl` → `proof_url`

### Expense Type Update (`types.ts`)

Add `supplierId?: string` to the `Expense` interface to support the FK relationship while keeping `supplier?: string` as the display name.

### ExpenseForm Changes

The supplier `<Select>` currently uses `s.name` as the value. Change to use `s.id`:
```typescript
// Before
value: s.name, label: s.name
// After
value: s.id, label: s.name
```

On submit, set `supplierId` to the selected supplier ID. For custom/manual suppliers, `supplierId` stays undefined (null in DB), and `supplier` is not stored in the DB (it's derived from the JOIN on read, or empty for manual entries).

**Note:** Manual supplier entries ("Autre / Saisir manuellement") will have `supplier_id = null` in the DB. The supplier name will not be stored for manual entries — this is a data loss tradeoff. If the user wants to track a supplier, they should create it in the Suppliers module first. This matches the normalized data model.

### Hook Rewrite (`useAccounting.ts`)

Replace all `useAppContext()` usage:
- `transactions` → from `useTransactions()` (shared hook)
- `expenses` → from `useQuery(['expenses', salonId])` with Supabase query + `toExpense()` mapper
- `addExpense` → `useMutation` with `.insert()` + `toExpenseInsert()`
- `salonSettings` → from `useSettings()`

All computed state (`financials`, `ledgerData`, `chartData`) stays as `useMemo` — just sourced from query data instead of AppContext.

### Consumer Fixes (broken Plan 2B references)

**`AccountingExpenses.tsx`**: `useAppContext` → `useSettings()` for `expenseCategories`

**`AccountingLedger.tsx`**: `useAppContext` → `useSettings()` for `expenseCategories`

**`ExpenseForm.tsx`**: `useAppContext` → `useSettings()` for `expenseCategories` + `salonSettings`

**`AccountingModule.tsx`**: Remove unused `useAppContext` import (line 10)

---

## Module 4: Other Broken Import Fixes

Files that still import `useAppContext` for fields removed in Plan 2B:

| File | Current `useAppContext` usage | Replace with |
|------|------------------------------|-------------|
| `modules/clients/components/ClientDetails.tsx` | `{ appointments, team }` | `useAppointments()` + `useTeam()` |
| `modules/clients/components/ClientForm.tsx` | `{ team }` | `useTeam()` |
| `modules/products/components/ProductForm.tsx` | `{ salonSettings }` | `useSettings()` |
| `modules/services/components/ServiceForm.tsx` | `{ salonSettings }` | `useSettings()` |
| `modules/team/components/TeamForm.tsx` | `{ serviceCategories, salonSettings }` | `useServices()` + `useSettings()` |

---

## Module 5: Dashboard Consumer Update

### Files
- Modify: `modules/dashboard/DashboardModule.tsx`

Replace `useAppContext()` for transactions:
```typescript
// Before
const { transactions } = useAppContext();
// After
const { transactions } = useTransactions();
```

Remove `useAppContext` import entirely — Dashboard will have zero AppContext dependency.

---

## Module 6: AppContext Full Removal

### Files
- Delete: `context/AppContext.tsx`
- Modify: `App.tsx` — remove `<AppProvider>` wrapper (lines 74, 94) and import (line 4)
- Modify: `CLAUDE.md`

### Verification

After deletion, run `npm run build`. If any file still imports `useAppContext`, TypeScript will catch it.

### CLAUDE.md Updates

1. **State Management**: Remove AppContext section entirely. Replace with: "All modules use TanStack Query + Supabase. No global state context."
2. **Data Layer**: Update to "All 10 modules migrated" with no "Still in AppContext" line.
3. **Known Issues**: Update item 1 to "~~No data persistence~~ DONE — all modules on Supabase"

---

## Migration Order

1. Transaction mappers + shared hook (no consumers broken — additive)
2. POS hook rewrite + POS consumer fixes
3. Expense mappers + accounting hook rewrite + accounting consumer fixes
4. Other broken import fixes (clients, products, services, team forms)
5. Dashboard consumer update
6. AppContext deletion + App.tsx cleanup + CLAUDE.md

This order ensures each step can be verified independently via `npm run build`.

## Key Decisions

- **`create_transaction` RPC** for atomic multi-table insert — not separate `.insert()` calls
- **Shared `useTransactions` hook** at project level — avoids POS module becoming transaction provider for Dashboard/Accounting
- **Supplier FK normalization** — ExpenseForm switches from supplier name to supplier ID
- **Manual supplier entries** lose the name on persistence — acceptable tradeoff for normalized data
- **No transaction update/delete** — immutable by design (DB has no UPDATE/DELETE policies)
- **Product stock invalidation** — `addTransaction` invalidates `['products', salonId]` because RPC decrements stock
