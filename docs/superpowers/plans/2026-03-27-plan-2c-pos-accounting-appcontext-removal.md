# Plan 2C — POS, Accounting & AppContext Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the last two AppContext modules (Transactions/POS, Expenses/Accounting) to Supabase + TanStack Query, fix all broken `useAppContext` references from Plan 2B, then fully delete AppContext.

**Architecture:** Follows the established Plan 2A/2B pattern: co-located mappers, TanStack Query hooks, `['resource', salonId]` query keys, soft-delete filtering. Transactions use the existing `create_transaction` Postgres RPC for atomic multi-table inserts. A shared `useTransactions` hook lives at project level since transactions are consumed by POS, Dashboard, and Accounting.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Supabase JS v2

**Spec:** `docs/superpowers/specs/2026-03-27-plan-2c-pos-accounting-appcontext-removal-design.md`

---

## File Structure

### New Files
- `modules/pos/mappers.ts` — Transaction DB row ↔ frontend type translation
- `hooks/useTransactions.ts` — Shared TanStack Query hook for transactions (project-level)
- `modules/accounting/mappers.ts` — Expense DB row ↔ frontend type translation

### Modified Files
- `types.ts` — Add `supplierId?: string` to `Expense` interface
- `modules/pos/hooks/usePOS.ts` — Replace `useAppContext` with `useTransactions`
- `modules/pos/components/PaymentModal.tsx` — Replace `useAppContext` with `useSettings`
- `modules/pos/components/POSModals.tsx` — Replace `useAppContext` with `useSettings` (2 components)
- `modules/accounting/hooks/useAccounting.ts` — Full rewrite: Supabase expenses + shared transactions
- `modules/accounting/components/AccountingExpenses.tsx` — Replace `useAppContext` with `useSettings`
- `modules/accounting/components/AccountingLedger.tsx` — Replace `useAppContext` with `useSettings`
- `modules/accounting/components/ExpenseForm.tsx` — Replace `useAppContext` with `useSettings`, supplier ID normalization
- `modules/accounting/AccountingModule.tsx` — Remove unused `useAppContext` import
- `modules/clients/components/ClientDetails.tsx` — Replace `useAppContext` with `useAppointments` + `useTeam`
- `modules/clients/components/ClientForm.tsx` — Replace `useAppContext` with `useTeam`
- `modules/products/components/ProductForm.tsx` — Replace `useAppContext` with `useSettings`
- `modules/services/components/ServiceForm.tsx` — Replace `useAppContext` with `useSettings`
- `modules/team/components/TeamForm.tsx` — Replace `useAppContext` with `useServices` + `useSettings`
- `modules/dashboard/DashboardModule.tsx` — Replace `useAppContext` with `useTransactions`
- `App.tsx` — Remove `<AppProvider>` wrapper and import

### Deleted Files
- `context/AppContext.tsx` — Full removal after all consumers migrated

---

## Task 1: Transaction Mappers

**Files:**
- Create: `modules/pos/mappers.ts`

This task creates the mapper layer that translates between Supabase DB rows (snake_case, nested JOINs) and frontend `Transaction`/`CartItem`/`PaymentEntry` types (camelCase, flat).

- [ ] **Step 1: Create `modules/pos/mappers.ts`**

```typescript
// modules/pos/mappers.ts
import { CartItem, PaymentEntry, Transaction } from '../../types';

// --- Row interfaces matching Supabase JOIN result ---

export interface TransactionItemRow {
  id: string;
  reference_id: string;
  type: string;
  name: string;
  variant_name: string | null;
  price: number;
  original_price: number | null;
  quantity: number;
  cost: number | null;
  note: string | null;
}

export interface TransactionPaymentRow {
  id: string;
  method: string;
  amount: number;
}

export interface TransactionRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  date: string;
  total: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  transaction_items: TransactionItemRow[];
  transaction_payments: TransactionPaymentRow[];
  clients: { first_name: string; last_name: string } | null;
}

// --- Row → Frontend ---

export function toTransaction(row: TransactionRow): Transaction {
  const clientName = row.clients
    ? `${row.clients.first_name} ${row.clients.last_name}`.trim()
    : undefined;

  const items: CartItem[] = (row.transaction_items ?? []).map(item => ({
    id: item.id,
    referenceId: item.reference_id,
    type: item.type as 'SERVICE' | 'PRODUCT',
    name: item.name,
    variantName: item.variant_name ?? undefined,
    price: item.price,
    originalPrice: item.original_price ?? undefined,
    quantity: item.quantity,
    cost: item.cost ?? undefined,
    note: item.note ?? undefined,
  }));

  const payments: PaymentEntry[] = (row.transaction_payments ?? []).map(p => ({
    id: p.id,
    method: p.method,
    amount: p.amount,
  }));

  return {
    id: row.id,
    date: row.date,
    total: row.total,
    clientName,
    clientId: row.client_id ?? undefined,
    items,
    payments,
  };
}

// --- Frontend → RPC Payload ---

export function toTransactionRpcPayload(
  cart: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string
) {
  const p_items = cart.map(item => ({
    reference_id: item.referenceId,
    type: item.type,
    name: item.name,
    variant_name: item.variantName ?? null,
    price: item.price,
    original_price: item.originalPrice ?? item.price,
    quantity: item.quantity,
    cost: item.cost ?? 0,
    note: item.note ?? null,
  }));

  const p_payments = payments.map(p => ({
    method: p.method,
    amount: p.amount,
  }));

  return {
    p_salon_id: salonId,
    p_client_id: clientId ?? null,
    p_items,
    p_payments,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No new errors (mappers file is additive, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add modules/pos/mappers.ts
git commit -m "feat(plan-2c): add transaction mappers for Supabase row ↔ frontend type translation"
```

---

## Task 2: Shared `useTransactions` Hook

**Files:**
- Create: `hooks/useTransactions.ts`

This hook is consumed by POS, Dashboard, and Accounting. It lives at project level (`hooks/`) to avoid any single module becoming the transaction provider.

- [ ] **Step 1: Create `hooks/useTransactions.ts`**

```typescript
// hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toTransaction, toTransactionRpcPayload, TransactionRow } from '../modules/pos/mappers';
import type { CartItem, PaymentEntry } from '../types';

export const useTransactions = () => {
  const { activeSalon, role } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)')
        .eq('salon_id', salonId)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data as unknown as TransactionRow[]).map(toTransaction);
    },
    enabled: !!salonId,
  });

  const addTransactionMutation = useMutation({
    mutationFn: async ({
      items,
      payments,
      clientId,
    }: {
      items: CartItem[];
      payments: PaymentEntry[];
      clientId?: string;
    }) => {
      const payload = toTransactionRpcPayload(items, payments, clientId, salonId);
      const { error } = await supabase.rpc('create_transaction', payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      // RPC decrements product stock, so invalidate products too
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: (error: Error) => {
      // Map known RPC exceptions to French UI messages
      if (error.message.includes('Payment total') && error.message.includes('does not match')) {
        console.error('Le total des paiements ne correspond pas au montant de la transaction.');
      } else if (error.message.includes('do not have permission')) {
        console.error("Vous n'avez pas la permission de créer des transactions.");
      } else {
        console.error('Transaction error:', error.message);
      }
    },
  });

  const addTransaction = (items: CartItem[], payments: PaymentEntry[], clientId?: string) =>
    addTransactionMutation.mutateAsync({ items, payments, clientId });

  return {
    transactions,
    isLoading,
    addTransaction,
  };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No new errors (hook is additive, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add hooks/useTransactions.ts
git commit -m "feat(plan-2c): add shared useTransactions hook with TanStack Query + Supabase RPC"
```

---

## Task 3: POS Hook Rewrite

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`

Replace `useAppContext()` with `useTransactions()`. Remove manual Transaction object construction — let the DB generate the UUID via the RPC.

- [ ] **Step 1: Update imports and hook source**

In `modules/pos/hooks/usePOS.ts`, replace lines 2-3 and 8:

```typescript
// BEFORE (lines 2-3)
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useState, useMemo } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
```

Then replace lines 13-16:

```typescript
// BEFORE
const {
  transactions,
  addTransaction,
} = useAppContext();

// AFTER
const { transactions, addTransaction } = useTransactions();
```

- [ ] **Step 2: Rewrite `processTransaction` to use shared hook**

Replace the `processTransaction` function (lines 76-92):

```typescript
// BEFORE
const processTransaction = (payments: PaymentEntry[]) => {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const newTransaction: Transaction = {
    id: `trx-${Date.now()}`,
    date: new Date().toISOString(),
    total: subtotal,
    clientName: selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : undefined,
    clientId: selectedClient?.id,
    items: [...cart],
    payments: payments
  };

  addTransaction(newTransaction);
  clearCart();
  setViewMode('HISTORY');
};

// AFTER
const processTransaction = async (payments: PaymentEntry[]) => {
  await addTransaction(cart, payments, selectedClient?.id);
  clearCart();
  setViewMode('HISTORY');
};
```

- [ ] **Step 3: Clean up unused imports**

Remove `Transaction` from the types import on line 8 (it's no longer constructed locally):

```typescript
// BEFORE
import { CartItem, Client, Service, Product, ServiceVariant, Transaction, PaymentEntry } from '../../../types';

// AFTER
import { CartItem, Client, Service, Product, ServiceVariant, PaymentEntry } from '../../../types';
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "feat(plan-2c): rewrite POS hook to use shared useTransactions instead of AppContext"
```

---

## Task 4: POS Consumer Fixes

**Files:**
- Modify: `modules/pos/components/PaymentModal.tsx`
- Modify: `modules/pos/components/POSModals.tsx`

Both files use `useAppContext()` to get `salonSettings` — this was broken by Plan 2B. Replace with `useSettings()`.

- [ ] **Step 1: Fix `PaymentModal.tsx`**

Replace lines 5 and 15:

```typescript
// BEFORE (line 5)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

```typescript
// BEFORE (line 15)
const { salonSettings } = useAppContext();

// AFTER
const { salonSettings } = useSettings();
```

- [ ] **Step 2: Fix `POSModals.tsx`**

Replace lines 5 and both usage sites (line 15 in `ItemEditorModal`, line 144 in `ReceiptModal`):

```typescript
// BEFORE (line 5)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

```typescript
// BEFORE (line 15, in ItemEditorModal)
const { salonSettings } = useAppContext();

// AFTER
const { salonSettings } = useSettings();
```

```typescript
// BEFORE (line 144, in ReceiptModal)
const { salonSettings } = useAppContext();

// AFTER
const { salonSettings } = useSettings();
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/components/PaymentModal.tsx modules/pos/components/POSModals.tsx
git commit -m "fix(plan-2c): replace broken useAppContext with useSettings in POS modals"
```

---

## Task 5: Expense Type Update + Mappers

**Files:**
- Modify: `types.ts`
- Create: `modules/accounting/mappers.ts`

- [ ] **Step 1: Add `supplierId` to Expense type**

In `types.ts`, update the `Expense` interface (around line 271):

```typescript
// BEFORE
export interface Expense {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory; // ID of the category setting
  amount: number;
  supplier?: string;
  proofUrl?: string; // For scanned receipt
}

// AFTER
export interface Expense {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory; // ID of the category setting
  amount: number;
  supplier?: string;
  supplierId?: string; // UUID FK to suppliers table
  proofUrl?: string; // For scanned receipt
}
```

- [ ] **Step 2: Create `modules/accounting/mappers.ts`**

```typescript
// modules/accounting/mappers.ts
import type { Expense } from '../../types';

// --- Row interfaces matching Supabase JOIN result ---

export interface ExpenseRow {
  id: string;
  salon_id: string;
  date: string;
  description: string;
  category_id: string;
  amount: number;
  supplier_id: string | null;
  proof_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  expense_categories: { name: string; color: string } | null;
  suppliers: { name: string } | null;
}

// --- Row → Frontend ---

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category_id,
    amount: row.amount,
    supplier: row.suppliers?.name ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    proofUrl: row.proof_url ?? undefined,
  };
}

// --- Frontend → Insert ---

export function toExpenseInsert(expense: Omit<Expense, 'id'>, salonId: string) {
  return {
    salon_id: salonId,
    date: expense.date,
    description: expense.description,
    category_id: expense.category,
    amount: expense.amount,
    supplier_id: expense.supplierId ?? null,
    proof_url: expense.proofUrl ?? null,
  };
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add types.ts modules/accounting/mappers.ts
git commit -m "feat(plan-2c): add Expense supplierId field and accounting mappers"
```

---

## Task 6: Accounting Hook Rewrite

**Files:**
- Modify: `modules/accounting/hooks/useAccounting.ts`

Full rewrite: replace all `useAppContext()` usage with `useTransactions()` for transactions, Supabase query for expenses, and `useSettings()` for salonSettings.

- [ ] **Step 1: Rewrite `useAccounting.ts`**

Replace the entire file:

```typescript
// modules/accounting/hooks/useAccounting.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useTransactions } from '../../../hooks/useTransactions';
import { useSettings } from '../../settings/hooks/useSettings';
import { toExpense, toExpenseInsert, ExpenseRow } from '../mappers';
import type { Expense, LedgerEntry, DateRange } from '../../../types';

export const useAccounting = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();

  const { transactions } = useTransactions();
  const { salonSettings } = useSettings();

  // --- Expenses Query ---
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name, color), suppliers(name)')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data as unknown as ExpenseRow[]).map(toExpense);
    },
    enabled: !!salonId,
  });

  // --- Add Expense Mutation ---
  const addExpenseMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, 'id'>) => {
      const row = toExpenseInsert(expense, salonId);
      const { error } = await supabase.from('expenses').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', salonId] });
    },
    onError: (error: Error) => {
      console.error('Failed to add expense:', error.message);
    },
  });

  const addExpense = (expense: Omit<Expense, 'id'>) =>
    addExpenseMutation.mutate(expense);

  // --- Date Range State ---
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.setHours(23, 59, 59, 999)),
      label: 'Ce mois-ci',
    };
  });

  // --- Filtering ---
  const data = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;
    const prevTo = from - 1;
    const prevFrom = prevTo - duration;

    const filterRange = (items: any[], dateKey: string, start: number, end: number) =>
      items.filter(i => {
        const t = new Date(i[dateKey]).getTime();
        return t >= start && t <= end;
      });

    return {
      current: {
        transactions: filterRange(transactions, 'date', from, to),
        expenses: filterRange(expenses, 'date', from, to),
      },
      previous: {
        transactions: filterRange(transactions, 'date', prevFrom, prevTo),
        expenses: filterRange(expenses, 'date', prevFrom, prevTo),
      },
    };
  }, [transactions, expenses, dateRange]);

  // --- Financial KPIs & Trends ---
  const financials = useMemo(() => {
    const revenue = data.current.transactions.reduce((sum: number, t: any) => sum + t.total, 0);
    const cogs = data.current.transactions.reduce(
      (sum: number, t: any) => sum + t.items.reduce((isum: number, item: any) => isum + (item.cost || 0), 0),
      0
    );
    const opex = data.current.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const netProfit = revenue - cogs - opex;
    const avgBasket = data.current.transactions.length > 0 ? revenue / data.current.transactions.length : 0;

    const prevRevenue = data.previous.transactions.reduce((sum: number, t: any) => sum + t.total, 0);
    const prevCogs = data.previous.transactions.reduce(
      (sum: number, t: any) => sum + t.items.reduce((isum: number, item: any) => isum + (item.cost || 0), 0),
      0
    );
    const prevOpex = data.previous.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const prevNetProfit = prevRevenue - prevCogs - prevOpex;
    const prevAvgBasket = data.previous.transactions.length > 0 ? prevRevenue / data.previous.transactions.length : 0;

    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

    const taxRate = (salonSettings.vatRate || 20) / 100;
    const vatDue = revenue - revenue / (1 + taxRate);

    const serviceSales: Record<string, number> = {};
    data.current.transactions.forEach((t: any) => {
      t.items.forEach((i: any) => {
        if (i.type === 'SERVICE') serviceSales[i.name] = (serviceSales[i.name] || 0) + 1;
      });
    });
    const topServices = Object.entries(serviceSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      revenue,
      revenueTrend: calcTrend(revenue, prevRevenue),
      opex,
      opexTrend: calcTrend(opex, prevOpex),
      netProfit,
      netProfitTrend: calcTrend(netProfit, prevNetProfit),
      vatDue,
      avgBasket,
      avgBasketTrend: calcTrend(avgBasket, prevAvgBasket),
      transactionCount: data.current.transactions.length,
      topServices,
    };
  }, [data, salonSettings.vatRate]);

  // --- Ledger Generation ---
  const ledgerData: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];

    data.current.transactions.forEach((t: any) => {
      entries.push({
        id: t.id,
        date: t.date,
        type: 'INCOME',
        label: `Vente - ${t.clientName || 'Passage'}`,
        category: 'VENTE',
        amount: t.total,
        details: t,
      });
    });

    data.current.expenses.forEach((e: any) => {
      entries.push({
        id: e.id,
        date: e.date,
        type: 'EXPENSE',
        label: e.description,
        category: e.category,
        amount: e.amount,
        details: e,
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.current]);

  // --- Smart Chart Data ---
  const chartData = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const isMonthly = daysDiff > 60;
    const map = new Map<string, { name: string; sortKey: number; sales: number; expenses: number }>();

    const current = new Date(from);
    while (current <= to) {
      let key, sortKey;
      if (isMonthly) {
        key = current.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        sortKey = current.getFullYear() * 100 + current.getMonth();
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
      } else {
        key = current.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        sortKey = current.getTime();
        current.setDate(current.getDate() + 1);
      }
      if (!map.has(key)) map.set(key, { name: key, sortKey, sales: 0, expenses: 0 });
    }

    data.current.transactions.forEach((t: any) => {
      const d = new Date(t.date);
      const key = isMonthly
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if (map.has(key)) map.get(key)!.sales += t.total;
    });

    data.current.expenses.forEach((e: any) => {
      const d = new Date(e.date);
      const key = isMonthly
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if (map.has(key)) map.get(key)!.expenses += e.amount;
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [data.current, dateRange]);

  return {
    dateRange,
    setDateRange,
    filteredTransactions: data.current.transactions,
    filteredExpenses: data.current.expenses,
    financials,
    ledgerData,
    chartData,
    addExpense,
  };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/hooks/useAccounting.ts
git commit -m "feat(plan-2c): rewrite useAccounting to use Supabase expenses + shared useTransactions"
```

---

## Task 7: Accounting Consumer Fixes

**Files:**
- Modify: `modules/accounting/components/AccountingExpenses.tsx`
- Modify: `modules/accounting/components/AccountingLedger.tsx`
- Modify: `modules/accounting/components/ExpenseForm.tsx`
- Modify: `modules/accounting/AccountingModule.tsx`

All four files still import `useAppContext` for fields that were either removed in Plan 2B (`expenseCategories`, `salonSettings`) or are now handled by `useAccounting`.

- [ ] **Step 1: Fix `AccountingExpenses.tsx`**

Replace lines 5 and 9:

```typescript
// BEFORE (line 5)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

```typescript
// BEFORE (line 9)
const { expenseCategories } = useAppContext();

// AFTER
const { expenseCategories } = useSettings();
```

- [ ] **Step 2: Fix `AccountingLedger.tsx`**

Replace lines 5 and 9:

```typescript
// BEFORE (line 5)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

```typescript
// BEFORE (line 9)
const { expenseCategories } = useAppContext();

// AFTER
const { expenseCategories } = useSettings();
```

- [ ] **Step 3: Fix `ExpenseForm.tsx`**

Replace line 6 import:

```typescript
// BEFORE (line 6)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

Replace line 15:

```typescript
// BEFORE (line 15)
const { expenseCategories, salonSettings } = useAppContext();

// AFTER
const { expenseCategories, salonSettings } = useSettings();
```

Change supplier `<Select>` to use `s.id` instead of `s.name` as the value (lines 111-113):

```typescript
// BEFORE (line 111-113)
...suppliers.map(s => ({
   value: s.name,
   label: s.name,

// AFTER
...suppliers.map(s => ({
   value: s.id,
   label: s.name,
```

Update `handleSubmit` (lines 29-39) to set `supplierId` from the selected supplier and omit `id`:

```typescript
// BEFORE
const handleSubmit = () => {
  if (formData.description && formData.amount) {
      onSave({
          id: `exp-${Date.now()}`,
          description: formData.description!,
          amount: Number(formData.amount),
          date: formData.date || new Date().toISOString(),
          category: (formData.category || expenseCategories[0]?.id) as ExpenseCategory,
          supplier: formData.supplier
      });
  }
};

// AFTER
const handleSubmit = () => {
  if (formData.description && formData.amount) {
      // Find the selected supplier ID (when not custom/manual)
      const selectedSupplier = !isCustomSupplier
        ? suppliers.find(s => s.id === formData.supplier)
        : undefined;
      onSave({
          id: crypto.randomUUID(),
          description: formData.description!,
          amount: Number(formData.amount),
          date: formData.date || new Date().toISOString(),
          category: (formData.category || expenseCategories[0]?.id) as ExpenseCategory,
          supplier: selectedSupplier?.name ?? formData.supplier,
          supplierId: selectedSupplier?.id,
      });
  }
};
```

- [ ] **Step 4: Fix `AccountingModule.tsx`**

Remove unused import on line 10:

```typescript
// BEFORE (line 10)
import { useAppContext } from '../../context/AppContext';

// AFTER
// (delete this line entirely)
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add modules/accounting/components/AccountingExpenses.tsx modules/accounting/components/AccountingLedger.tsx modules/accounting/components/ExpenseForm.tsx modules/accounting/AccountingModule.tsx
git commit -m "fix(plan-2c): replace broken useAppContext with useSettings in accounting components"
```

---

## Task 8: Broken Import Fixes — Clients Module

**Files:**
- Modify: `modules/clients/components/ClientDetails.tsx`
- Modify: `modules/clients/components/ClientForm.tsx`

These files import `useAppContext` for `appointments`, `team` — fields removed in Plan 2B.

- [ ] **Step 1: Fix `ClientDetails.tsx`**

Replace line 24 import:

```typescript
// BEFORE (line 24)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { useTeam } from '../../team/hooks/useTeam';
```

Replace line 34:

```typescript
// BEFORE (line 34)
const { appointments, team } = useAppContext();

// AFTER
const { allAppointments: appointments } = useAppointments();
const { allStaff: team } = useTeam();
```

- [ ] **Step 2: Fix `ClientForm.tsx`**

Replace line 11 import:

```typescript
// BEFORE (line 11)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useTeam } from '../../team/hooks/useTeam';
```

Replace line 22:

```typescript
// BEFORE (line 22)
const { team } = useAppContext();

// AFTER
const { allStaff: team } = useTeam();
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add modules/clients/components/ClientDetails.tsx modules/clients/components/ClientForm.tsx
git commit -m "fix(plan-2c): replace broken useAppContext with useAppointments + useTeam in client components"
```

---

## Task 9: Broken Import Fixes — Products, Services, Team

**Files:**
- Modify: `modules/products/components/ProductForm.tsx`
- Modify: `modules/services/components/ServiceForm.tsx`
- Modify: `modules/team/components/TeamForm.tsx`

- [ ] **Step 1: Fix `ProductForm.tsx`**

Replace line 7 import:

```typescript
// BEFORE (line 7)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

Replace line 18:

```typescript
// BEFORE (line 18)
const { salonSettings } = useAppContext();

// AFTER
const { salonSettings } = useSettings();
```

- [ ] **Step 2: Fix `ServiceForm.tsx`**

Replace line 7 import:

```typescript
// BEFORE (line 7)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useSettings } from '../../settings/hooks/useSettings';
```

Replace line 17:

```typescript
// BEFORE (line 17)
const { salonSettings } = useAppContext();

// AFTER
const { salonSettings } = useSettings();
```

- [ ] **Step 3: Fix `TeamForm.tsx`**

Replace line 8 import:

```typescript
// BEFORE (line 8)
import { useAppContext } from '../../../context/AppContext';

// AFTER
import { useServices } from '../../services/hooks/useServices';
import { useSettings } from '../../settings/hooks/useSettings';
```

Replace line 36:

```typescript
// BEFORE (line 36)
const { serviceCategories, salonSettings } = useAppContext();

// AFTER
const { serviceCategories } = useServices();
const { salonSettings } = useSettings();
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add modules/products/components/ProductForm.tsx modules/services/components/ServiceForm.tsx modules/team/components/TeamForm.tsx
git commit -m "fix(plan-2c): replace broken useAppContext with useSettings/useServices in form components"
```

---

## Task 10: Dashboard Consumer Update

**Files:**
- Modify: `modules/dashboard/DashboardModule.tsx`

Replace `useAppContext()` for transactions with `useTransactions()`.

- [ ] **Step 1: Update imports**

Replace line 15:

```typescript
// BEFORE (line 15)
import { useAppContext } from '../../context/AppContext';

// AFTER
import { useTransactions } from '../../hooks/useTransactions';
```

- [ ] **Step 2: Update hook usage**

Replace line 48:

```typescript
// BEFORE (line 48)
const { transactions } = useAppContext();

// AFTER
const { transactions } = useTransactions();
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add modules/dashboard/DashboardModule.tsx
git commit -m "feat(plan-2c): replace useAppContext with useTransactions in dashboard"
```

---

## Task 11: AppContext Full Removal

**Files:**
- Delete: `context/AppContext.tsx`
- Modify: `App.tsx`

At this point, no file should import `useAppContext` anymore. Delete the context entirely.

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "useAppContext\|AppContext\|AppProvider" --include="*.ts" --include="*.tsx" modules/ components/ pages/ hooks/ lib/ App.tsx`

Expected: Only hits in `context/AppContext.tsx` and `App.tsx` (the files we're about to change). If any other file still imports it, fix that file first.

- [ ] **Step 2: Remove `AppProvider` from `App.tsx`**

In `App.tsx`, remove line 4 (import) and lines 74/94 (wrapper):

```typescript
// BEFORE (line 4)
import { AppProvider } from './context/AppContext';

// AFTER
// (delete this line entirely)
```

```typescript
// BEFORE (lines 73-95)
  return (
    <AuthProvider>
      <AppProvider>
        <HashRouter>
          ...
        </HashRouter>
      </AppProvider>
    </AuthProvider>
  );

// AFTER
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

          {/* Auth-required, no-salon routes */}
          <Route path="/create-salon" element={<CreateSalonPage />} />
          <Route path="/select-salon" element={<SalonPickerPage />} />

          {/* Protected app routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          } />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
```

- [ ] **Step 3: Delete `context/AppContext.tsx`**

```bash
rm context/AppContext.tsx
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no import resolution errors. This is the critical verification — if any file still imports `AppContext`, the build will fail with a module-not-found error.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(plan-2c): delete AppContext — all modules now on TanStack Query + Supabase"
```

---

## Task 12: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

Update documentation to reflect that AppContext is gone and all modules are on Supabase.

- [ ] **Step 1: Update State Management section**

```markdown
<!-- BEFORE -->
### State Management
- Single `AppContext` in `context/AppContext.tsx` provides all state
- Each module accesses state via `useAppContext()` hook
- No persistence - all state is in-memory (useState)

<!-- AFTER -->
### State Management
- All modules use TanStack Query + Supabase for data fetching and persistence
- No global state context — each module has co-located hooks
- Shared `useTransactions` hook at `hooks/useTransactions.ts` (consumed by POS, Dashboard, Accounting)
```

- [ ] **Step 2: Update Data Layer section**

```markdown
<!-- BEFORE -->
**Migrated modules (Plan 2A + 2B):** suppliers, products, services, clients, settings, team, appointments
**Still in AppContext:** transactions, expenses (Plan 2C targets)

<!-- AFTER -->
**All 10 modules migrated:** suppliers, products, services, clients, settings, team, appointments, pos/transactions, accounting/expenses, dashboard
```

- [ ] **Step 3: Update Known Issues**

```markdown
<!-- BEFORE -->
1. ~~No data persistence~~ PARTIAL — 7 modules migrated to Supabase (Plan 2A + 2B), POS/Accounting remaining in Plan 2C

<!-- AFTER -->
1. ~~No data persistence~~ DONE — all modules on Supabase
```

- [ ] **Step 4: Remove Dead Code references to AppContext**

Remove these lines from the Dead Code section if present:
- `services/store.ts` reference
- Any mention of `useAppContext()` in Code Conventions

Update Code Conventions:

```markdown
<!-- BEFORE -->
- **State**: Access shared state via `useAppContext()`. Local UI state (view, search, selection) stays in the component.

<!-- AFTER -->
- **State**: Each module uses TanStack Query hooks for server state. Local UI state (view, search, selection) stays in the component.
```

- [ ] **Step 5: Verify build one final time**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(plan-2c): update CLAUDE.md — AppContext removed, all modules on Supabase"
```

---

## Migration Order Summary

| Task | What | Risk | Depends On |
|------|------|------|------------|
| 1 | Transaction mappers | None (additive) | — |
| 2 | Shared useTransactions hook | None (additive) | Task 1 |
| 3 | POS hook rewrite | POS module changes data source | Task 2 |
| 4 | POS consumer fixes | Fixes broken runtime | Task 3 |
| 5 | Expense type + mappers | None (additive) | — |
| 6 | Accounting hook rewrite | Accounting changes data source | Tasks 2, 5 |
| 7 | Accounting consumer fixes | Fixes broken runtime | Task 6 |
| 8 | Client broken imports | Fixes broken runtime | — |
| 9 | Product/Service/Team broken imports | Fixes broken runtime | — |
| 10 | Dashboard consumer update | Dashboard changes data source | Task 2 |
| 11 | AppContext deletion | Breaking if any consumer missed | Tasks 3-10 |
| 12 | CLAUDE.md update | Documentation | Task 11 |

Each task can be verified independently via `npm run build`. Note that Vite/esbuild does not type-check — it only catches missing modules and syntax errors.
