// modules/accounting/hooks/useAccounting.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useTransactions } from '../../../hooks/useTransactions';
import { supabase } from '../../../lib/supabase';
import type { CartItem, DateRange, Expense, LedgerEntry, Transaction } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { type ExpenseRow, toExpense, toExpenseInsert } from '../mappers';
import { useNewClientCount } from './useNewClientCount';

export const calcTrend = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

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

  const { salonSettings } = useSettings();

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
      toastOnSuccess('Dépense ajoutée')();
    },
    onError: toastOnError("Impossible d'ajouter la dépense"),
  });

  const addExpense = (expense: Omit<Expense, 'id'>) => addExpenseMutation.mutate(expense);

  // --- Update Expense Mutation ---
  const updateExpenseMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          date: expense.date,
          description: expense.description,
          category_id: expense.category,
          amount: expense.amount,
          supplier_id: expense.supplierId ?? null,
          proof_url: expense.proofUrl ?? null,
          payment_method: expense.paymentMethod ?? null,
        })
        .eq('id', expense.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', salonId] });
      toastOnSuccess('Dépense mise à jour')();
    },
    onError: toastOnError('Impossible de modifier la dépense'),
  });

  // --- Delete Expense Mutation ---
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', expenseId)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', salonId] });
      toastOnSuccess('Dépense supprimée')();
    },
    onError: toastOnError('Impossible de supprimer la dépense'),
  });

  // --- Filtering ---
  const data = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;
    const prevTo = from - 1;
    const prevFrom = prevTo - duration;

    // Bucket a stored ISO timestamp to the *local* calendar day, not the UTC day.
    // Splitting on 'T' would pull the UTC date portion, which misfiles records
    // created close to midnight (e.g. 00:55 local = previous day UTC).
    const parseLocalDate = (dateStr: string): number => {
      const d = new Date(dateStr);
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
      const d = new Date(t.date);
      const dStr = toLocalDate(d);
      if (dStr < chartFromStr || dStr > chartToStr) return;
      const key = toChartKey(d);
      if (map.has(key)) map.get(key)!.sales += t.total;
    });

    expenses.forEach((e: Expense) => {
      const d = new Date(e.date);
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
    updateExpense: (expense: Expense) => updateExpenseMutation.mutate(expense),
    isUpdatingExpense: updateExpenseMutation.isPending,
    deleteExpense: (expenseId: string) => deleteExpenseMutation.mutate(expenseId),
    isDeletingExpense: deleteExpenseMutation.isPending,
    clientMetrics,
  };
};
