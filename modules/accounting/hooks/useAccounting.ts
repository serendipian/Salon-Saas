// modules/accounting/hooks/useAccounting.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useTransactions } from '../../../hooks/useTransactions';
import { rawInsert, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { CartItem, DateRange, Expense, LedgerEntry, Transaction } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { type ExpenseRow, toExpense, toExpenseInsert } from '../mappers';
import { useNewClientCount } from './useNewClientCount';

export const calcTrend = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

// Parse a stored date value into a local-day Date. Bare YYYY-MM-DD strings
// (Postgres DATE columns, <input type="date"> values) are parsed by the
// browser as UTC midnight, which reads as the *previous* day in negative-
// offset timezones — build the Date from parts in that case.
const parseLocalDay = (dateStr: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(dateStr);
};

export const useAccounting = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();
  useRealtimeSync('expenses');
  useRealtimeSync('transactions', {
    onEvent: () => {
      queryClient.invalidateQueries({ queryKey: ['new_client_count', salonId] });
    },
  });

  const { salonSettings, expenseCategories } = useSettings();

  // --- Date Range State ---
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: "Aujourd'hui",
    };
  });

  // Chart range: always show at least 7 data points for context
  const chartRange = useMemo(() => {
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);
    const daysDiff = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    const MIN_DAYS = 7;
    if (daysDiff < MIN_DAYS) {
      const chartFrom = new Date(to);
      chartFrom.setDate(chartFrom.getDate() - (MIN_DAYS - 1));
      chartFrom.setHours(0, 0, 0, 0);
      return { from: chartFrom, to };
    }
    return { from, to };
  }, [dateRange]);

  // Widen query to include previous period + chart range for trend comparisons
  const queryRange = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const chartFrom = chartRange.from.getTime();
    const duration = to - from;
    const prevFrom = new Date(Math.min(from - duration, chartFrom) - 1);
    return { from: prevFrom.toISOString(), to: new Date(to).toISOString() };
  }, [dateRange, chartRange]);

  const { transactions } = useTransactions(queryRange);

  const { data: newClientCount = 0 } = useNewClientCount(
    salonId,
    new Date(dateRange.from).toISOString(),
    new Date(dateRange.to).toISOString(),
  );

  // --- Expenses Query ---
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*,expense_categories(name,color),suppliers(name)');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'date.desc');
      const data = await rawSelect<ExpenseRow>('expenses', params.toString(), signal);
      return data.map(toExpense);
    },
    enabled: !!salonId,
  });

  // --- Optimistic snapshot helpers (shared by add/update/delete) ---
  type ExpensesSnapshot = Array<[readonly unknown[], Expense[] | undefined]>;
  const restoreExpensesSnapshot = (snapshot: ExpensesSnapshot | undefined) => {
    if (!snapshot) return;
    for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
  };

  // --- Add Expense Mutation (raw-fetch + optimistic) ---
  const addExpenseMutation = useMutation<
    void,
    Error,
    Omit<Expense, 'id'>,
    { snapshot: ExpensesSnapshot }
  >({
    mutationFn: async (expense) => {
      const row = toExpenseInsert(expense, salonId);
      await rawInsert('expenses', row);
    },
    onMutate: async (expense) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', salonId] });
      const snapshot = queryClient.getQueriesData<Expense[]>({
        queryKey: ['expenses', salonId],
      });
      // Enrich with category metadata so the optimistic row renders identically
      // to a server-joined row (the real INSERT response will replace it on
      // invalidation in onSettled).
      const cat = expenseCategories.find((c) => c.id === expense.category);
      const optimistic: Expense = {
        ...expense,
        id: `optimistic-${crypto.randomUUID()}`,
        categoryName: cat?.name,
        categoryColor: cat?.color,
      };
      queryClient.setQueriesData<Expense[]>({ queryKey: ['expenses', salonId] }, (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { snapshot };
    },
    onSuccess: () => {
      toastOnSuccess('Dépense ajoutée')();
    },
    onError: (err, _vars, context) => {
      restoreExpensesSnapshot(context?.snapshot);
      toastOnError("Impossible d'ajouter la dépense")(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', salonId] });
    },
  });

  const addExpense = (expense: Omit<Expense, 'id'>) => addExpenseMutation.mutateAsync(expense);

  // --- Update Expense Mutation (raw-fetch + optimistic) ---
  const updateExpenseMutation = useMutation<
    void,
    Error,
    Expense,
    { snapshot: ExpensesSnapshot }
  >({
    mutationFn: async (expense) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${expense.id}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('expenses', params.toString(), {
        date: expense.date,
        description: expense.description,
        category_id: expense.category,
        amount: expense.amount,
        supplier_id: expense.supplierId ?? null,
        proof_url: expense.proofUrl ?? null,
        payment_method: expense.paymentMethod ?? null,
      });
    },
    onMutate: async (expense) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', salonId] });
      const snapshot = queryClient.getQueriesData<Expense[]>({
        queryKey: ['expenses', salonId],
      });
      const cat = expenseCategories.find((c) => c.id === expense.category);
      queryClient.setQueriesData<Expense[]>({ queryKey: ['expenses', salonId] }, (old) =>
        old?.map((e) =>
          e.id === expense.id
            ? { ...expense, categoryName: cat?.name, categoryColor: cat?.color }
            : e,
        ),
      );
      return { snapshot };
    },
    onSuccess: () => {
      toastOnSuccess('Dépense mise à jour')();
    },
    onError: (err, _vars, context) => {
      restoreExpensesSnapshot(context?.snapshot);
      toastOnError('Impossible de modifier la dépense')(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', salonId] });
    },
  });

  // --- Delete Expense Mutation (raw-fetch, soft-delete + optimistic) ---
  const deleteExpenseMutation = useMutation<
    void,
    Error,
    string,
    { snapshot: ExpensesSnapshot }
  >({
    mutationFn: async (expenseId) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${expenseId}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('expenses', params.toString(), {
        deleted_at: new Date().toISOString(),
      });
    },
    onMutate: async (expenseId) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', salonId] });
      const snapshot = queryClient.getQueriesData<Expense[]>({
        queryKey: ['expenses', salonId],
      });
      queryClient.setQueriesData<Expense[]>({ queryKey: ['expenses', salonId] }, (old) =>
        old?.filter((e) => e.id !== expenseId),
      );
      return { snapshot };
    },
    onSuccess: () => {
      toastOnSuccess('Dépense supprimée')();
    },
    onError: (err, _vars, context) => {
      restoreExpensesSnapshot(context?.snapshot);
      toastOnError('Impossible de supprimer la dépense')(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', salonId] });
    },
  });

  // --- Filtering ---
  const data = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;
    const prevTo = from - 1;
    const prevFrom = prevTo - duration;

    const parseLocalDate = (dateStr: string): number => {
      const d = parseLocalDay(dateStr);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    const filterRange = <T extends object>(
      items: T[],
      dateKey: keyof T,
      start: number,
      end: number,
    ): T[] =>
      items.filter((i) => {
        const t = parseLocalDate(i[dateKey] as string);
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
    const revenue = data.current.transactions.reduce((sum, t) => sum + t.total, 0);
    const cogs = data.current.transactions.reduce(
      (sum, t) => sum + t.items.reduce((isum, item) => isum + (item.cost || 0), 0),
      0,
    );
    const opex = data.current.expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - cogs - opex;
    const saleCount = data.current.transactions.filter((t) => t.type === 'SALE').length;
    const avgBasket = saleCount > 0 ? revenue / saleCount : 0;

    const prevRevenue = data.previous.transactions.reduce((sum, t) => sum + t.total, 0);
    const prevCogs = data.previous.transactions.reduce(
      (sum, t) => sum + t.items.reduce((isum, item) => isum + (item.cost || 0), 0),
      0,
    );
    const prevOpex = data.previous.expenses.reduce((sum, e) => sum + e.amount, 0);
    const prevNetProfit = prevRevenue - prevCogs - prevOpex;
    const prevSaleCount = data.previous.transactions.filter((t) => t.type === 'SALE').length;
    const prevAvgBasket = prevSaleCount > 0 ? prevRevenue / prevSaleCount : 0;

    const taxRate = (salonSettings.vatRate || 20) / 100;
    const vatDue = revenue - revenue / (1 + taxRate);

    const serviceSales: Record<string, number> = {};
    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((i: CartItem) => {
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
      transactionCount: saleCount,
      topServices,
    };
  }, [data, salonSettings.vatRate]);

  // --- Unique + New Clients ---
  const clientMetrics = useMemo(() => {
    const currentClientIds = new Set<string>();
    data.current.transactions.forEach((t: Transaction) => {
      if (t.clientId) currentClientIds.add(t.clientId);
    });
    return { uniqueClients: currentClientIds.size, newClients: newClientCount };
  }, [data.current.transactions, newClientCount]);

  // --- Ledger Generation ---
  const ledgerData: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];

    data.current.transactions.forEach((t: Transaction) => {
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

    data.current.expenses.forEach((e: Expense) => {
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
    const from = new Date(chartRange.from);
    const to = new Date(chartRange.to);
    const daysDiff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const isMonthly = daysDiff > 60;
    const map = new Map<
      string,
      { name: string; sortKey: number; sales: number; expenses: number }
    >();

    const toChartKey = (d: Date) =>
      isMonthly
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const toDisplayName = (d: Date) =>
      isMonthly
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    const toLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const current = new Date(from);
    while (current <= to) {
      const key = toChartKey(current);
      const sortKey = isMonthly
        ? current.getFullYear() * 100 + current.getMonth()
        : current.getTime();
      if (!map.has(key))
        map.set(key, { name: toDisplayName(current), sortKey, sales: 0, expenses: 0 });
      if (isMonthly) {
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    // Aggregate from raw arrays to cover chart range
    const chartFromStr = toLocalDate(from);
    const chartToStr = toLocalDate(to);

    transactions.forEach((t: Transaction) => {
      const d = parseLocalDay(t.date);
      const dStr = toLocalDate(d);
      if (dStr < chartFromStr || dStr > chartToStr) return;
      const key = toChartKey(d);
      if (map.has(key)) map.get(key)!.sales += t.total;
    });

    expenses.forEach((e: Expense) => {
      const d = parseLocalDay(e.date);
      const dStr = toLocalDate(d);
      if (dStr < chartFromStr || dStr > chartToStr) return;
      const key = toChartKey(d);
      if (map.has(key)) map.get(key)!.expenses += e.amount;
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [transactions, expenses, chartRange]);

  // Separate highlight index set — kept out of chart data to avoid confusing Recharts
  const chartHighlight = useMemo(() => {
    const selectedFrom = new Date(dateRange.from);
    selectedFrom.setHours(0, 0, 0, 0);
    const selectedTo = new Date(dateRange.to);
    selectedTo.setHours(0, 0, 0, 0);
    const from = new Date(chartRange.from);
    const to = new Date(chartRange.to);
    const daysDiff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const isMonthly = daysDiff > 60;
    const set = new Set<number>();
    const current = new Date(from);
    let idx = 0;
    while (current <= to) {
      const cn = new Date(current);
      cn.setHours(0, 0, 0, 0);
      if (cn >= selectedFrom && cn <= selectedTo) set.add(idx);
      if (isMonthly) {
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
      } else {
        current.setDate(current.getDate() + 1);
      }
      idx++;
    }
    return set;
  }, [dateRange, chartRange]);

  return {
    dateRange,
    setDateRange,
    filteredTransactions: data.current.transactions,
    prevFilteredTransactions: data.previous.transactions,
    filteredExpenses: data.current.expenses,
    financials,
    ledgerData,
    chartData,
    chartHighlight,
    addExpense,
    isAddingExpense: addExpenseMutation.isPending,
    updateExpense: (expense: Expense) => updateExpenseMutation.mutateAsync(expense),
    isUpdatingExpense: updateExpenseMutation.isPending,
    deleteExpense: (expenseId: string) => deleteExpenseMutation.mutateAsync(expenseId),
    isDeletingExpense: deleteExpenseMutation.isPending,
    clientMetrics,
  };
};
