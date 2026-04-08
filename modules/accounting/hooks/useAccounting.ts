// modules/accounting/hooks/useAccounting.ts
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useTransactions } from '../../../hooks/useTransactions';
import { useNewClientCount } from './useNewClientCount';
import { useSettings } from '../../settings/hooks/useSettings';
import { useServices } from '../../services/hooks/useServices';
import { useProducts } from '../../products/hooks/useProducts';
import { useTeam } from '../../team/hooks/useTeam';
import { calcBonus, calcCommission } from '../../team/utils';
import { toExpense, toExpenseInsert, ExpenseRow } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Expense, LedgerEntry, DateRange, Transaction, CartItem, PaymentEntry } from '../../../types';

const UNASSIGNED_KEY = '__unassigned__';

const calcTrend = (curr: number, prev: number) =>
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
  const { allServices, serviceCategories } = useServices();
  const { allProducts, productCategories } = useProducts();
  const { allStaff } = useTeam();

  // --- Date Range State ---
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: "Aujourd'hui",
    };
  });

  // Widen query to include previous period for trend comparisons
  const queryRange = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;
    const prevFrom = new Date(from - duration - 1);
    return { from: prevFrom.toISOString(), to: new Date(to).toISOString() };
  }, [dateRange]);

  const { transactions } = useTransactions(queryRange);

  const { data: newClientCount = 0 } = useNewClientCount(
    salonId,
    new Date(dateRange.from).toISOString(),
    new Date(dateRange.to).toISOString()
  );

  // --- Expenses Query ---
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name, color), suppliers(name, category)')
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

  const addExpense = (expense: Omit<Expense, 'id'>) =>
    addExpenseMutation.mutate(expense);

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

    const parseLocalDate = (dateStr: string): number => {
      const parts = (dateStr as string).split('T')[0].split('-');
      return new Date(+parts[0], +parts[1] - 1, +parts[2]).getTime();
    };

    const filterRange = <T extends object>(items: T[], dateKey: keyof T, start: number, end: number): T[] =>
      items.filter(i => {
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
      0
    );
    const opex = data.current.expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - cogs - opex;
    const saleCount = data.current.transactions.filter(t => t.type === 'SALE').length;
    const avgBasket = saleCount > 0 ? revenue / saleCount : 0;

    const prevRevenue = data.previous.transactions.reduce((sum, t) => sum + t.total, 0);
    const prevCogs = data.previous.transactions.reduce(
      (sum, t) => sum + t.items.reduce((isum, item) => isum + (item.cost || 0), 0),
      0
    );
    const prevOpex = data.previous.expenses.reduce((sum, e) => sum + e.amount, 0);
    const prevNetProfit = prevRevenue - prevCogs - prevOpex;
    const prevSaleCount = data.previous.transactions.filter(t => t.type === 'SALE').length;
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

  // --- Category Lookup Maps ---
  const serviceCategoryLookup = useMemo(() => {
    const catNameMap = new Map<string, string>();
    (serviceCategories || []).forEach(cat => catNameMap.set(cat.id, cat.name));

    const lookup = new Map<string, { categoryId: string; categoryName: string }>();
    (allServices || []).forEach(svc => {
      const entry = {
        categoryId: svc.categoryId || 'uncategorized',
        categoryName: catNameMap.get(svc.categoryId) || 'Non catégorisé',
      };
      lookup.set(svc.id, entry);
      // POS stores variant ID as referenceId, so map each variant ID too
      (svc.variants || []).forEach(v => lookup.set(v.id, entry));
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
    const map = new Map<string, { staffId: string | null; staffName: string; count: number; revenue: number; services: Map<string, { name: string; variantName?: string; count: number; revenue: number }> }>();

    data.current.transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (item.type !== 'SERVICE') return;
        const key = item.staffId || UNASSIGNED_KEY;
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0, services: new Map() });
        const row = map.get(key)!;
        const qty = item.quantity || 1;
        row.count += qty;
        row.revenue += item.price * qty;

        const svcKey = item.referenceId || item.name;
        if (!row.services.has(svcKey)) row.services.set(svcKey, { name: item.name, variantName: item.variantName, count: 0, revenue: 0 });
        const svc = row.services.get(svcKey)!;
        svc.count += qty;
        svc.revenue += item.price * qty;
      });
    });

    // Build staff lookup for bonus/commission
    const staffMap = new Map(allStaff.map(s => [s.id, s]));

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map(r => {
      const staff = r.staffId ? staffMap.get(r.staffId) : undefined;
      const commission = staff ? calcCommission(r.revenue, staff.commissionRate) : 0;
      const bonus = staff ? calcBonus(r.revenue, staff.bonusTiers) : 0;
      return {
        staffId: r.staffId,
        staffName: r.staffName,
        count: r.count,
        revenue: r.revenue,
        avgBasket: r.count > 0 ? r.revenue / r.count : 0,
        percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
        commission,
        bonus,
        services: Array.from(r.services.values()).sort((a, b) => b.revenue - a.revenue),
      };
    });
  }, [data.current.transactions, allStaff]);

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
    return { uniqueClients: currentClientIds.size, newClients: newClientCount };
  }, [data.current.transactions, newClientCount]);

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

    const toChartKey = (d: Date) => isMonthly
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const toDisplayName = (d: Date) => isMonthly
      ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    const current = new Date(from);
    while (current <= to) {
      const key = toChartKey(current);
      const sortKey = isMonthly
        ? current.getFullYear() * 100 + current.getMonth()
        : current.getTime();
      if (!map.has(key)) map.set(key, { name: toDisplayName(current), sortKey, sales: 0, expenses: 0 });
      if (isMonthly) {
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    data.current.transactions.forEach((t: Transaction) => {
      const key = toChartKey(new Date(t.date));
      if (map.has(key)) map.get(key)!.sales += t.total;
    });

    data.current.expenses.forEach((e: Expense) => {
      const key = toChartKey(new Date(e.date));
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
    isAddingExpense: addExpenseMutation.isPending,
    updateExpense: (expense: Expense) => updateExpenseMutation.mutate(expense),
    isUpdatingExpense: updateExpenseMutation.isPending,
    deleteExpense: (expenseId: string) => deleteExpenseMutation.mutate(expenseId),
    isDeletingExpense: deleteExpenseMutation.isPending,
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
