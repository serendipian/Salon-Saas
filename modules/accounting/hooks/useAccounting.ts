// modules/accounting/hooks/useAccounting.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useTransactions } from '../../../hooks/useTransactions';
import { useSettings } from '../../settings/hooks/useSettings';
import { useServices } from '../../services/hooks/useServices';
import { useProducts } from '../../products/hooks/useProducts';
import { toExpense, toExpenseInsert, ExpenseRow } from '../mappers';

const UNASSIGNED_KEY = '__unassigned__';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Expense, LedgerEntry, DateRange, Transaction, CartItem, PaymentEntry } from '../../../types';

const calcTrend = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

export const useAccounting = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();
  useRealtimeSync('expenses');

  const { transactions } = useTransactions();
  const { salonSettings } = useSettings();
  const { allServices, serviceCategories } = useServices();
  const { allProducts, productCategories } = useProducts();

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
    onError: toastOnError("Impossible d'ajouter la dépense"),
  });

  const addExpense = (expense: Omit<Expense, 'id'>) =>
    addExpenseMutation.mutate(expense);

  // --- Date Range State ---
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
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

    const filterRange = <T extends Record<string, unknown>>(items: T[], dateKey: keyof T, start: number, end: number): T[] =>
      items.filter(i => {
        const t = new Date(i[dateKey] as string).getTime();
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
      transactionCount: data.current.transactions.length,
      topServices,
    };
  }, [data, salonSettings.vatRate]);

  // --- Category Lookup Maps ---
  const serviceCategoryLookup = useMemo(() => {
    const catNameMap = new Map<string, string>();
    (serviceCategories || []).forEach(cat => catNameMap.set(cat.id, cat.name));

    const lookup = new Map<string, { categoryId: string; categoryName: string }>();
    (allServices || []).forEach(svc => {
      lookup.set(svc.id, {
        categoryId: svc.categoryId || 'uncategorized',
        categoryName: catNameMap.get(svc.categoryId) || 'Non catégorisé',
      });
    });
    return lookup;
  }, [allServices, serviceCategories]);

  const productCategoryLookup = useMemo(() => {
    const catNameMap = new Map<string, string>();
    (productCategories || []).forEach(cat => catNameMap.set(cat.id, cat.name));

    const lookup = new Map<string, { categoryId: string; categoryName: string }>();
    (allProducts || []).forEach(prod => {
      lookup.set(prod.id, {
        categoryId: prod.categoryId || 'uncategorized',
        categoryName: catNameMap.get(prod.categoryId) || 'Non catégorisé',
      });
    });
    return lookup;
  }, [allProducts, productCategories]);

  // --- Revenue by Service Category ---
  const revenueByServiceCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; categoryName: string; count: number; revenue: number; services: Map<string, { name: string; variantName?: string; count: number; revenue: number }> }>();

    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type !== 'SERVICE') return;
        const lookup = serviceCategoryLookup.get(item.referenceId);
        const catId = lookup?.categoryId || 'uncategorized';
        const catName = lookup?.categoryName || 'Non catégorisé';
        if (!map.has(catId)) map.set(catId, { categoryId: catId, categoryName: catName, count: 0, revenue: 0, services: new Map() });
        const cat = map.get(catId)!;
        cat.count += item.quantity || 1;
        cat.revenue += item.price * (item.quantity || 1);

        const serviceKey = item.referenceId || item.name;
        if (!cat.services.has(serviceKey)) cat.services.set(serviceKey, { name: item.name, variantName: item.variantName, count: 0, revenue: 0 });
        const svc = cat.services.get(serviceKey)!;
        svc.count += item.quantity || 1;
        svc.revenue += item.price * (item.quantity || 1);
      });
    });

    return Array.from(map.values())
      .map(cat => ({ ...cat, services: Array.from(cat.services.values()).sort((a, b) => b.revenue - a.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data.current.transactions, serviceCategoryLookup]);

  // --- Revenue by Product Category ---
  const revenueByProductCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; categoryName: string; count: number; revenue: number; products: Map<string, { name: string; count: number; revenue: number }> }>();

    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type !== 'PRODUCT') return;
        const lookup = productCategoryLookup.get(item.referenceId);
        const catId = lookup?.categoryId || 'uncategorized';
        const catName = lookup?.categoryName || 'Non catégorisé';
        if (!map.has(catId)) map.set(catId, { categoryId: catId, categoryName: catName, count: 0, revenue: 0, products: new Map() });
        const cat = map.get(catId)!;
        cat.count += item.quantity || 1;
        cat.revenue += item.price * (item.quantity || 1);

        const prodKey = item.referenceId || item.name;
        if (!cat.products.has(prodKey)) cat.products.set(prodKey, { name: item.name, count: 0, revenue: 0 });
        const prod = cat.products.get(prodKey)!;
        prod.count += item.quantity || 1;
        prod.revenue += item.price * (item.quantity || 1);
      });
    });

    return Array.from(map.values())
      .map(cat => ({ ...cat, products: Array.from(cat.products.values()).sort((a, b) => b.revenue - a.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data.current.transactions, productCategoryLookup]);

  // --- Revenue by Staff (Services) ---
  const revenueByStaffServices = useMemo(() => {
    const map = new Map<string, { staffId: string | null; staffName: string; count: number; revenue: number }>();

    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type !== 'SERVICE') return;
        const key = item.staffId || UNASSIGNED_KEY;
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0 });
        const row = map.get(key)!;
        row.count += item.quantity || 1;
        row.revenue += item.price * (item.quantity || 1);
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map(r => ({
      ...r,
      avgBasket: r.count > 0 ? r.revenue / r.count : 0,
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [data.current.transactions]);

  // --- Revenue by Staff (Products) ---
  const revenueByStaffProducts = useMemo(() => {
    const map = new Map<string, { staffId: string | null; staffName: string; count: number; revenue: number }>();

    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type !== 'PRODUCT') return;
        const key = item.staffId || UNASSIGNED_KEY;
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0 });
        const row = map.get(key)!;
        row.count += item.quantity || 1;
        row.revenue += item.price * (item.quantity || 1);
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map(r => ({
      ...r,
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [data.current.transactions]);

  // --- Payment Method Breakdown ---
  const paymentMethodBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    data.current.transactions.forEach((t: Transaction) => {
      (t.payments || []).forEach((p: PaymentEntry) => {
        map.set(p.method, (map.get(p.method) || 0) + p.amount);
      });
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([method, amount]) => ({ method, amount, percent: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.current.transactions]);

  // --- Service/Product Revenue Totals ---
  const serviceRevenue = useMemo(() => {
    let total = 0, count = 0;
    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type === 'SERVICE') { total += item.price * (item.quantity || 1); count += item.quantity || 1; }
      });
    });
    return { total, count, avgPrice: count > 0 ? total / count : 0 };
  }, [data.current.transactions]);

  const productRevenue = useMemo(() => {
    let total = 0, count = 0;
    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type === 'PRODUCT') { total += item.price * (item.quantity || 1); count += item.quantity || 1; }
      });
    });
    return { total, count, avgPrice: count > 0 ? total / count : 0 };
  }, [data.current.transactions]);

  // --- Previous Period Service/Product Revenue (for trends) ---
  const prevServiceRevenue = useMemo(() => {
    let total = 0, count = 0;
    data.previous.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type === 'SERVICE') { total += item.price * (item.quantity || 1); count += item.quantity || 1; }
      });
    });
    return { total, count, avgPrice: count > 0 ? total / count : 0 };
  }, [data.previous.transactions]);

  const prevProductRevenue = useMemo(() => {
    let total = 0, count = 0;
    data.previous.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type === 'PRODUCT') { total += item.price * (item.quantity || 1); count += item.quantity || 1; }
      });
    });
    return { total, count, avgPrice: count > 0 ? total / count : 0 };
  }, [data.previous.transactions]);

  // --- Unique + New Clients ---
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

  // --- Top Products ---
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((i: CartItem) => {
        if (i.type === 'PRODUCT') {
          const key = i.referenceId || i.name;
          if (!productSales[key]) productSales[key] = { name: i.name, count: 0, revenue: 0 };
          productSales[key].count += i.quantity || 1;
          productSales[key].revenue += i.price * (i.quantity || 1);
        }
      });
    });
    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [data.current.transactions]);

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

    data.current.transactions.forEach((t: Transaction) => {
      const d = new Date(t.date);
      const key = isMonthly
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if (map.has(key)) map.get(key)!.sales += t.total;
    });

    data.current.expenses.forEach((e: Expense) => {
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
    // Revenue breakdowns & metrics
    revenueByServiceCategory,
    revenueByProductCategory,
    paymentMethodBreakdown,
    serviceRevenue,
    productRevenue,
    prevServiceRevenue,
    prevProductRevenue,
    clientMetrics,
    topProducts,
    revenueByStaffServices,
    revenueByStaffProducts,
    calcTrend,
  };
};
