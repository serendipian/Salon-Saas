# useTransactions Date-Range Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push date filtering into the database query so `useTransactions` no longer fetches the entire transaction history, and replace the unbounded "new clients" calculation with a targeted DB aggregate.

**Architecture:** Add optional `{ from, to }` ISO string parameters to `useTransactions`. Each of the 7 consumers passes its own date range. A new `count_new_clients` Postgres function replaces the only consumer that needed unbounded data. No test framework exists in this project — verification is via `npm run build` (TypeScript type-checking) and manual browser testing.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase (PostgreSQL), Vite

**Spec:** `docs/superpowers/specs/2026-04-08-useTransactions-date-range-design.md`

---

### Task 1: Database Migration — `count_new_clients` RPC

**Files:**
- Create: `supabase/migrations/20260408140000_count_new_clients.sql`

This must be deployed before any frontend changes go live.

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260408140000_count_new_clients.sql

-- Returns the number of clients whose first-ever transaction falls within [p_from, p_to].
CREATE OR REPLACE FUNCTION count_new_clients(
  p_salon_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(new_clients bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*) AS new_clients
  FROM (
    SELECT client_id
    FROM transactions
    WHERE salon_id = p_salon_id
      AND client_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY client_id
    HAVING MIN(date) >= p_from AND MIN(date) <= p_to
  ) sub;
$$;
```

- [ ] **Step 2: Deploy migration**

Run via Supabase SQL editor or:
```bash
npx supabase db push --linked
```

- [ ] **Step 3: Verify in Supabase SQL editor**

```sql
SELECT * FROM count_new_clients(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '2026-04-01'::timestamptz,
  '2026-04-08'::timestamptz
);
-- Expected: returns a row with new_clients = 0 (no data for fake UUID)
```

- [ ] **Step 4: Regenerate database types**

```bash
npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260408140000_count_new_clients.sql lib/database.types.ts
git commit -m "feat: add count_new_clients RPC for date-scoped new client metric"
```

---

### Task 2: Add Date Range Parameter to `useTransactions`

**Files:**
- Modify: `hooks/useTransactions.ts`

- [ ] **Step 1: Add options interface and wire into query**

Replace the full content of `hooks/useTransactions.ts` with:

```ts
// hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toTransaction, toTransactionRpcPayload, TransactionRow } from '../modules/pos/mappers';
import type { CartItem, PaymentEntry } from '../types';
import { useRealtimeSync } from './useRealtimeSync';
import { useMutationToast } from './useMutationToast';

export interface TransactionQueryOptions {
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

export const useTransactions = (options?: TransactionQueryOptions) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();
  useRealtimeSync('transactions');

  const from = options?.from;
  const to = options?.to;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', salonId, from ?? 'all', to ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)')
        .eq('salon_id', salonId)
        .order('date', { ascending: false });

      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);

      const { data, error } = await query;
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
      appointmentId,
    }: {
      items: CartItem[];
      payments: PaymentEntry[];
      clientId?: string;
      appointmentId?: string;
    }) => {
      const payload = toTransactionRpcPayload(items, payments, clientId, salonId, appointmentId);

      // Timeout after 30s to prevent indefinite hang (network issues, auth lock deadlock)
      const rpcPromise = supabase.rpc('create_transaction', payload);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('La transaction a expiré (30s). Vérifiez votre connexion et réessayez.')), 30_000)
      );
      const { error } = await Promise.race([rpcPromise, timeoutPromise]);
      if (error) throw error;
    },
    onSuccess: () => {
      // Prefix match: invalidates ALL ['transactions', salonId, ...] regardless of date params
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      // Also invalidate new client count since a new transaction could change the metric
      queryClient.invalidateQueries({ queryKey: ['new_client_count', salonId] });
    },
    onError: toastOnError("Impossible de créer la transaction"),
  });

  const addTransaction = (items: CartItem[], payments: PaymentEntry[], clientId?: string, appointmentId?: string) =>
    addTransactionMutation.mutateAsync({ items, payments, clientId, appointmentId });

  return {
    transactions,
    isLoading,
    addTransaction,
  };
};
```

Key changes from the original:
- New `TransactionQueryOptions` interface with optional `from`/`to`
- Query key now includes `from ?? 'all'` and `to ?? 'all'`
- Conditional `.gte()` and `.lte()` on the Supabase query
- `onSuccess` also invalidates `['new_client_count', salonId]`
- Everything else (mutation, realtime sync, timeout) is unchanged

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: SUCCESS — the parameter is optional, so all existing consumers still compile with no changes.

- [ ] **Step 3: Commit**

```bash
git add hooks/useTransactions.ts
git commit -m "feat: add optional date range parameter to useTransactions"
```

---

### Task 3: Migrate POS Consumer

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`

- [ ] **Step 1: Add date range and pass to useTransactions**

At the top of `usePOS`, before the existing `useTransactions` call (line 15), add a `useMemo` for the 30-day range, then pass it:

```ts
// Add useMemo to the existing import on line 2
import { useState, useMemo, useRef } from 'react';
```

Replace line 15:
```ts
  const { transactions, addTransaction } = useTransactions();
```

With:
```ts
  const posRange = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: new Date().toISOString() };
  }, []);

  const { transactions, addTransaction } = useTransactions(posRange);
```

`useMemo` with `[]` deps: the 30-day window is computed once per mount. A page refresh resets it — acceptable for a POS register.

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "perf: POS uses 30-day transaction window instead of full history"
```

---

### Task 4: Migrate Dashboard Consumer

**Files:**
- Modify: `modules/dashboard/DashboardModule.tsx`

- [ ] **Step 1: Compute query range and pass to useTransactions**

In `DashboardModule.tsx`, the `dateRange` state is defined at lines 78-85. After it, add a `queryRange` memo, then update the `useTransactions` call.

Add after the `dateRange` useState (after line 85):

```ts
  // Widen query to include previous period for trend comparisons
  const queryRange = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;
    const prevFrom = new Date(from - duration - 1);
    return { from: prevFrom.toISOString(), to: new Date(to).toISOString() };
  }, [dateRange]);
```

Replace line 71:
```ts
  const { transactions } = useTransactions();
```

With:
```ts
  const { transactions } = useTransactions(queryRange);
```

The `queryRange` memo must appear after `dateRange` state and before `useTransactions` call. Move the `useTransactions` call after `queryRange` if needed.

The existing `data` useMemo (lines 88-119) that splits transactions into current/previous buckets stays unchanged — it now operates on a much smaller dataset.

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add modules/dashboard/DashboardModule.tsx
git commit -m "perf: Dashboard fetches only current+previous period transactions"
```

---

### Task 5: Create `useNewClientCount` Hook and Migrate Accounting

**Files:**
- Create: `modules/accounting/hooks/useNewClientCount.ts`
- Modify: `modules/accounting/hooks/useAccounting.ts`

- [ ] **Step 1: Create the useNewClientCount hook**

```ts
// modules/accounting/hooks/useNewClientCount.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export const useNewClientCount = (salonId: string, from: string, to: string) => {
  return useQuery({
    queryKey: ['new_client_count', salonId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_new_clients', {
        p_salon_id: salonId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      // RPC returns TABLE(new_clients bigint) — Supabase wraps as array
      const row = Array.isArray(data) ? data[0] : data;
      return Number(row?.new_clients ?? 0);
    },
    enabled: !!salonId && !!from && !!to,
  });
};
```

- [ ] **Step 2: Add query range and update useTransactions call in useAccounting**

In `modules/accounting/hooks/useAccounting.ts`, add the import for the new hook at the top (after line 6):

```ts
import { useNewClientCount } from './useNewClientCount';
```

After the `dateRange` state (line 75), add a `queryRange` memo:

```ts
  // Widen query to include previous period for trend comparisons
  const queryRange = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;
    const prevFrom = new Date(from - duration - 1);
    return { from: prevFrom.toISOString(), to: new Date(to).toISOString() };
  }, [dateRange]);
```

Replace line 29:
```ts
  const { transactions } = useTransactions();
```

With:
```ts
  const { transactions } = useTransactions(queryRange);
```

The `useTransactions` call must appear after `queryRange`. Reorder the hook calls so that `dateRange` state and `queryRange` memo come before `useTransactions`.

- [ ] **Step 3: Add useNewClientCount call**

After the `useTransactions` call, add:

```ts
  const { data: newClientCount = 0 } = useNewClientCount(
    salonId,
    new Date(dateRange.from).toISOString(),
    new Date(dateRange.to).toISOString()
  );
```

- [ ] **Step 4: Replace the clientMetrics useMemo**

Replace the entire `clientMetrics` useMemo block (lines 366-387):

```ts
  const clientMetrics = useMemo(() => {
    const currentClientIds = new Set<string>();
    data.current.transactions.forEach((t: Transaction) => { if (t.clientId) currentClientIds.add(t.clientId); });

    const firstTransactionByClient = new Map<string, number>();
    transactions.forEach((t: Transaction) => {
      if (!t.clientId) return;
      const time = new Date(t.date).getTime();
      const existing = firstTransactionByClient.get(t.clientId);
      if (!existing || time < existing) firstTransactionByClient.set(t.clientId, time);
    });

    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    let newClients = 0;
    currentClientIds.forEach(clientId => {
      const firstDate = firstTransactionByClient.get(clientId);
      if (firstDate && firstDate >= from && firstDate <= to) newClients++;
    });

    return { uniqueClients: currentClientIds.size, newClients };
  }, [data.current.transactions, transactions, dateRange]);
```

With:

```ts
  const clientMetrics = useMemo(() => {
    const currentClientIds = new Set<string>();
    data.current.transactions.forEach((t: Transaction) => { if (t.clientId) currentClientIds.add(t.clientId); });
    return { uniqueClients: currentClientIds.size, newClients: newClientCount };
  }, [data.current.transactions, newClientCount]);
```

- [ ] **Step 5: Verify build compiles**

```bash
npm run build
```

Expected: SUCCESS

- [ ] **Step 6: Commit**

```bash
git add modules/accounting/hooks/useNewClientCount.ts modules/accounting/hooks/useAccounting.ts
git commit -m "perf: Accounting uses date-scoped transactions + DB-side new client count"
```

---

### Task 6: Migrate Team Consumers (3 files)

**Files:**
- Modify: `modules/team/hooks/useTeamPerformance.ts`
- Modify: `modules/team/hooks/useStaffCompensation.ts`
- Modify: `modules/team/components/StaffPerformanceTab.tsx`

- [ ] **Step 1: Migrate useTeamPerformance**

In `modules/team/hooks/useTeamPerformance.ts`, add `useMemo` to the import on line 1:

```ts
import { useMemo, useState } from 'react';
```

(Already imported — no change needed.)

After the `dateRange` state (line 37), add:

```ts
  const teamRange = useMemo(() => ({
    from: new Date(dateRange.from).toISOString(),
    to: new Date(dateRange.to).toISOString(),
  }), [dateRange]);
```

Replace line 26:
```ts
  const { transactions } = useTransactions();
```

With:
```ts
  const { transactions } = useTransactions(teamRange);
```

The `useTransactions` call must appear after `teamRange`. Reorder: move `dateRange` state and `teamRange` memo above the `useTransactions` call.

Remove the `filtered` useMemo (lines 39-46) since transactions are already date-filtered from the DB. Replace references to `filtered` with `transactions`:

On line 50, replace:
```ts
    filtered.forEach((t: Transaction) => {
```

With:
```ts
    transactions.forEach((t: Transaction) => {
```

Update the `revenueByStaff` useMemo dependency array (line 57), replace:
```ts
  }, [filtered]);
```

With:
```ts
  }, [transactions]);
```

- [ ] **Step 2: Migrate useStaffCompensation**

In `modules/team/hooks/useStaffCompensation.ts`, add `useMemo` to the imports:

```ts
import { useMemo } from 'react';
```

(Already imported — no change needed.)

Before the `useTransactions` call (line 20), add the range memo:

```ts
  const compRange = useMemo(() => ({
    from: periodStart.toISOString(),
    to: periodEnd.toISOString(),
  }), [periodStart.getTime(), periodEnd.getTime()]);
```

Replace line 20:
```ts
  const { transactions } = useTransactions();
```

With:
```ts
  const { transactions } = useTransactions(compRange);
```

The existing date filtering inside the `useMemo` (lines 26-33) is now redundant. Replace:

```ts
    // Compare using date strings (YYYY-MM-DD) to avoid timezone edge issues
    const startStr = periodStart.toISOString().slice(0, 10);
    const endStr = periodEnd.toISOString().slice(0, 10);

    const periodRevenue = (transactions || [])
      .filter((t: any) => {
        const dateStr = new Date(t.date).toISOString().slice(0, 10);
        return dateStr >= startStr && dateStr <= endStr;
      })
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);
```

With:

```ts
    const periodRevenue = (transactions || [])
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);
```

- [ ] **Step 3: Migrate StaffPerformanceTab**

In `modules/team/components/StaffPerformanceTab.tsx`, add `useMemo` to the import on line 2 (already imported).

After the `dateRange` state (line 45), add:

```ts
  const perfRange = useMemo(() => ({
    from: new Date(dateRange.from).toISOString(),
    to: new Date(dateRange.to).toISOString(),
  }), [dateRange]);
```

Replace line 35:
```ts
  const { transactions } = useTransactions();
```

With:
```ts
  const { transactions } = useTransactions(perfRange);
```

The `useTransactions` call must appear after `perfRange`. Reorder: move `dateRange` state and `perfRange` memo above `useTransactions`.

Remove the `filteredTransactions` useMemo (lines 48-55). Replace all references to `filteredTransactions` with `transactions`:

Line 65, replace:
```ts
    filteredTransactions.forEach((t: Transaction) => {
```

With:
```ts
    transactions.forEach((t: Transaction) => {
```

Line 102, update the dependency array, replace:
```ts
  }, [filteredTransactions, staffId, dateRange]);
```

With:
```ts
  }, [transactions, staffId, dateRange]);
```

- [ ] **Step 4: Verify build compiles**

```bash
npm run build
```

Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add modules/team/hooks/useTeamPerformance.ts modules/team/hooks/useStaffCompensation.ts modules/team/components/StaffPerformanceTab.tsx
git commit -m "perf: Team module consumers use date-scoped transactions"
```

---

### Task 7: Migrate StaffDetailPage Consumer

**Files:**
- Modify: `modules/team/pages/StaffDetailPage.tsx`

- [ ] **Step 1: Add date range and pass to useTransactions**

At the top of the component (after line 43, before the `useTransactions` call on line 44), add:

```ts
  const monthRange = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return { from: monthStart.toISOString(), to: new Date().toISOString() };
  }, []);
```

Ensure `useMemo` is imported (check the imports at top of file — add to existing React import if missing).

Replace line 44:
```ts
  const { transactions } = useTransactions();
```

With:
```ts
  const { transactions } = useTransactions(monthRange);
```

The `monthlyStats` useMemo (lines 51-67) currently filters by month start. Since transactions are already month-scoped, simplify by removing the date filter:

Replace the `monthlyStats` useMemo:
```ts
  const monthlyStats = useMemo(() => {
    if (!staff || !transactions) return { revenue: 0, appointments: 0 };
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const revenue = (transactions || [])
      .filter((t: any) => new Date(t.date) >= monthStart)
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);
    const apptCount = (allAppointments || [])
      .filter((a: any) => a.staffId === staff.id && new Date(a.date) >= monthStart && a.status !== 'CANCELLED')
      .length;
    return { revenue, appointments: apptCount };
  }, [staff, transactions, allAppointments]);
```

With:
```ts
  const monthlyStats = useMemo(() => {
    if (!staff || !transactions) return { revenue: 0, appointments: 0 };
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const revenue = (transactions || [])
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);
    const apptCount = (allAppointments || [])
      .filter((a: any) => a.staffId === staff.id && new Date(a.date) >= monthStart && a.status !== 'CANCELLED')
      .length;
    return { revenue, appointments: apptCount };
  }, [staff, transactions, allAppointments]);
```

Note: `allAppointments` is NOT date-scoped here (that's a separate hook — H-1 issue), so its month filter stays.

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add modules/team/pages/StaffDetailPage.tsx
git commit -m "perf: StaffDetailPage uses month-scoped transactions"
```

---

### Task 8: Final Verification and Cleanup

**Files:**
- Verify: all modified files

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: SUCCESS with no TypeScript errors.

- [ ] **Step 2: Grep for any remaining unscoped useTransactions calls**

```bash
grep -rn "useTransactions()" --include="*.ts" --include="*.tsx" modules/ hooks/
```

Expected: NO matches in `modules/` — every consumer should now pass a date range. The only match should be the function definition in `hooks/useTransactions.ts`.

- [ ] **Step 3: Manual browser verification**

Start dev server:
```bash
npm run dev
```

Verify each module loads data correctly:
1. **POS** — HISTORY tab shows recent transactions, creating a new transaction works
2. **Dashboard** — KPIs display, changing date range updates numbers
3. **Accounting** — Revenue, expenses, new clients metric all display correctly
4. **Team list** — Performance tab shows staff revenue
5. **Staff detail** — Monthly stats in header, Performance tab, Compensation tab all show data

- [ ] **Step 4: Update audit document**

In `docs/superpowers/audit-remaining-items.md`, mark H-3 as resolved. Also note that H-4 (clientMetrics recomputation) is now resolved as a side effect — the `clientMetrics` useMemo no longer depends on the full unfiltered transaction list.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/audit-remaining-items.md
git commit -m "docs: mark H-3 and H-4 as resolved in audit"
```
