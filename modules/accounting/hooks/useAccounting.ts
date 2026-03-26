
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { LedgerEntry, DateRange } from '../../../types';

export const useAccounting = () => {
  const { transactions, expenses, addExpense, salonSettings } = useAppContext();
  
  // Default range: Current Month
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.setHours(23,59,59,999)),
        label: 'Ce mois-ci'
    };
  });

  // --- Filtering ---
  const data = useMemo(() => {
    // Current Period
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const duration = to - from;

    // Previous Period
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
            expenses: filterRange(expenses, 'date', from, to)
        },
        previous: {
            transactions: filterRange(transactions, 'date', prevFrom, prevTo),
            expenses: filterRange(expenses, 'date', prevFrom, prevTo)
        }
    };
  }, [transactions, expenses, dateRange]);

  // --- Financial KPIs & Trends ---
  const financials = useMemo(() => {
    // Current Stats
    const revenue = data.current.transactions.reduce((sum, t) => sum + t.total, 0);
    const cogs = data.current.transactions.reduce((sum, t) => sum + t.items.reduce((isum, item) => isum + (item.cost || 0), 0), 0);
    const opex = data.current.expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - cogs - opex;
    const avgBasket = data.current.transactions.length > 0 ? revenue / data.current.transactions.length : 0;

    // Previous Stats
    const prevRevenue = data.previous.transactions.reduce((sum, t) => sum + t.total, 0);
    const prevCogs = data.previous.transactions.reduce((sum, t) => sum + t.items.reduce((isum, item) => isum + (item.cost || 0), 0), 0);
    const prevOpex = data.previous.expenses.reduce((sum, e) => sum + e.amount, 0);
    const prevNetProfit = prevRevenue - prevCogs - prevOpex;
    const prevAvgBasket = data.previous.transactions.length > 0 ? prevRevenue / data.previous.transactions.length : 0;

    // Trend Helper
    const calcTrend = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

    // Dynamic VAT
    const taxRate = (salonSettings.vatRate || 20) / 100;
    const vatDue = revenue - (revenue / (1 + taxRate)); 

    // Top Services logic
    const serviceSales: Record<string, number> = {};
    data.current.transactions.forEach(t => {
      t.items.forEach(i => {
        if(i.type === 'SERVICE') serviceSales[i.name] = (serviceSales[i.name] || 0) + 1;
      });
    });
    const topServices = Object.entries(serviceSales).sort((a,b) => b[1] - a[1]).slice(0, 3);

    return { 
        revenue, revenueTrend: calcTrend(revenue, prevRevenue),
        opex, opexTrend: calcTrend(opex, prevOpex),
        netProfit, netProfitTrend: calcTrend(netProfit, prevNetProfit),
        vatDue, 
        avgBasket, avgBasketTrend: calcTrend(avgBasket, prevAvgBasket),
        transactionCount: data.current.transactions.length, 
        topServices 
    };
  }, [data, salonSettings.vatRate]);

  // --- Ledger Generation ---
  const ledgerData: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];
    
    data.current.transactions.forEach(t => {
      entries.push({
        id: t.id,
        date: t.date,
        type: 'INCOME',
        label: `Vente - ${t.clientName || 'Passage'}`,
        category: 'VENTE',
        amount: t.total,
        details: t
      });
    });

    data.current.expenses.forEach(e => {
      entries.push({
        id: e.id,
        date: e.date,
        type: 'EXPENSE',
        label: e.description,
        category: e.category,
        amount: e.amount,
        details: e
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
    const map = new Map<string, { name: string, sortKey: number, sales: number, expenses: number }>();

    // Initialize keys
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

    data.current.transactions.forEach(t => {
      const d = new Date(t.date);
      const key = isMonthly 
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if(map.has(key)) map.get(key)!.sales += t.total;
    });

    data.current.expenses.forEach(e => {
      const d = new Date(e.date);
      const key = isMonthly 
        ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if(map.has(key)) map.get(key)!.expenses += e.amount;
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
    addExpense
  };
};
