# H-3 Fix: useTransactions Date-Range Filtering

> Push date filtering to the database so `useTransactions` no longer fetches the entire transaction history.

## Problem

`useTransactions` queries all rows from `transactions` with no date constraint. All 7 consumers filter client-side. This grows linearly with salon history and triggers expensive downstream recomputations (H-4).

## Approach

**Approach A** — add an optional `{ from, to }` parameter to `useTransactions`. Each consumer passes its own date range. A new `count_new_clients` RPC replaces the only consumer that genuinely needed unbounded data.

## Design

### 1. Hook API Change

```ts
interface TransactionQueryOptions {
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

export const useTransactions = (options?: TransactionQueryOptions) => {
  // ...
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
  // addTransaction, realtime sync — unchanged
};
```

- Query key includes date params so TanStack Query caches each range separately.
- `addTransaction.onSuccess` invalidates `['transactions', salonId]` — prefix matching invalidates all date-ranged caches.
- `useRealtimeSync('transactions')` invalidates `['transactions', salonId]` on any postgres change — same prefix matching covers all cached ranges.

### 2. Consumer Migration

Each consumer computes its query range **before** calling the hook (hook calls must be at the top level, not inside useMemo).

#### POS (`usePOS.ts`)

```ts
const posRange = useMemo(() => {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: new Date().toISOString() };
}, []);

const { transactions, addTransaction } = useTransactions(posRange);
```

30-day window for the HISTORY tab. Users needing older data use Accounting.

#### Dashboard (`DashboardModule.tsx`)

```ts
const queryRange = useMemo(() => {
  const from = new Date(dateRange.from).getTime();
  const to = new Date(dateRange.to).getTime();
  const duration = to - from;
  const prevFrom = new Date(from - duration - 1);
  return { from: prevFrom.toISOString(), to: new Date(to).toISOString() };
}, [dateRange]);

const { transactions } = useTransactions(queryRange);
```

Fetches `prevFrom → currentTo` to cover both current and previous period comparisons. The existing `useMemo` at line 88 splits this into current/previous buckets — unchanged logic, much smaller dataset.

#### Accounting (`useAccounting.ts`)

Same pattern as Dashboard — compute `prevFrom` in a `useMemo`, pass to `useTransactions`.

The `clientMetrics` block (lines 366-387) is replaced by a combination of:
- `uniqueClients`: computed from `data.current.transactions` (already date-filtered) — no change
- `newClients`: new `useNewClientCount` hook (see section 3)

#### useTeamPerformance (`useTeamPerformance.ts`)

```ts
const teamRange = useMemo(() => ({
  from: dateRange.from.toISOString(),
  to: dateRange.to.toISOString(),
}), [dateRange]);

const { transactions } = useTransactions(teamRange);
```

No previous-period comparison needed. The existing `filtered` useMemo (line 39-46) becomes unnecessary — transactions are already date-filtered from the DB. Remove it and use `transactions` directly.

#### useStaffCompensation (`useStaffCompensation.ts`)

```ts
const compRange = useMemo(() => ({
  from: periodStart.toISOString(),
  to: periodEnd.toISOString(),
}), [periodStart.getTime(), periodEnd.getTime()]);

const { transactions } = useTransactions(compRange);
```

The existing date filter in the `useMemo` (lines 29-33) becomes unnecessary. Use `transactions` directly.

#### StaffPerformanceTab (`StaffPerformanceTab.tsx`)

```ts
const perfRange = useMemo(() => ({
  from: new Date(dateRange.from).toISOString(),
  to: new Date(dateRange.to).toISOString(),
}), [dateRange]);

const { transactions } = useTransactions(perfRange);
```

Remove the `filteredTransactions` useMemo (lines 48-55) — use `transactions` directly.

#### StaffDetailPage (`StaffDetailPage.tsx`)

```ts
const monthRange = useMemo(() => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return { from: monthStart.toISOString(), to: new Date().toISOString() };
}, []);

const { transactions } = useTransactions(monthRange);
```

The `monthlyStats` useMemo (lines 51-67) no longer needs its own date filtering — transactions are already scoped to the current month.

### 3. New `useNewClientCount` Hook

Replaces the `clientMetrics.newClients` calculation in `useAccounting` that previously scanned ALL transactions.

**File:** `modules/accounting/hooks/useNewClientCount.ts`

```ts
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
      return (data as { new_clients: number }[])[0]?.new_clients ?? 0;
    },
    enabled: !!salonId,
  });
};
```

Called in `useAccounting`:
```ts
const { data: newClients = 0 } = useNewClientCount(salonId, dateRange.from.toISOString(), dateRange.to.toISOString());
```

`uniqueClients` stays client-side: `new Set(data.current.transactions.map(t => t.clientId).filter(Boolean)).size`.

### 4. Database Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_count_new_clients.sql`

```sql
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

Applied via `supabase db push` or Supabase SQL editor (no local Docker).

### 5. What Doesn't Change

- `toTransaction` mapper, `TransactionRow` type, `toTransactionRpcPayload` — untouched
- Realtime sync mechanism — prefix invalidation handles multiple query keys
- `addTransaction` signature and behavior — unchanged
- `useRealtimeSync` — ref-counted, one subscription per table regardless of consumer count
- All other hooks consumed alongside `useTransactions` (useAppointments, useClients, etc.)

### 6. Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| Dashboard query | All transactions ever | ~2x current date range (includes prev period) |
| Accounting query | All transactions ever | ~2x current date range |
| POS query | All transactions ever | Last 30 days |
| Team queries | All transactions ever | Selected date range only |
| `clientMetrics` | O(N) scan of all transactions | Single DB aggregate query |
| Realtime invalidation | 1 cached query | Multiple small cached queries (prefix match) |

### 7. Risks & Mitigations

- **POS 30-day cutoff**: Users lose visibility of older history in POS. Mitigated: Accounting module has full date-range browsing.
- **Multiple cached queries**: Each date range creates a separate cache entry. Mitigated: TanStack Query's garbage collection removes unused entries; typical usage has 2-3 active ranges.
- **Migration on remote Supabase**: The `count_new_clients` function must be deployed before the frontend code goes live. Mitigated: Function is additive (no schema change), safe to deploy ahead of time.
