import { useMemo, useState } from 'react';
import { getSalonHourRange } from '../../../lib/scheduleHours';
import type { DateRange, Transaction, WorkSchedule } from '../../../types';
import { useTransactions } from '../../../hooks/useTransactions';

export interface ActivityChartPoint {
  label: string;
  revenue: number;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];
const MONTH_LABELS_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function isTodayWithinRange(dateRange: DateRange): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(dateRange.from);
  from.setHours(0, 0, 0, 0);
  const to = new Date(dateRange.to);
  to.setHours(23, 59, 59, 999);
  return today.getTime() >= from.getTime() && today.getTime() <= to.getTime();
}

function salesTotals(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'SALE');
}

// ── By Hour (uses global filteredTransactions) ──

function formatPeriodLabel(dateRange: DateRange): string {
  const from = new Date(dateRange.from);
  const to = new Date(dateRange.to);
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = fromDay.getTime() === toDay.getTime();
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  if (isSameDay) {
    if (fromDay.getTime() === today.getTime()) return "Aujourd'hui";
    if (fromDay.getTime() === yesterday.getTime()) return 'Hier';
    return fmt(fromDay);
  }
  return `${fmt(fromDay)} – ${fmt(toDay)}`;
}

export function useRevenueByHour(
  filteredTransactions: Transaction[],
  schedule: WorkSchedule | undefined,
  dateRange: DateRange,
) {
  const { minHour, maxHour } = useMemo(() => getSalonHourRange(schedule), [schedule]);

  const data = useMemo(() => {
    const sales = salesTotals(filteredTransactions);
    const buckets = new Map<number, number>();
    for (let h = minHour; h < maxHour; h++) buckets.set(h, 0);
    for (const t of sales) {
      const h = new Date(t.date).getHours();
      if (buckets.has(h)) buckets.set(h, buckets.get(h)! + t.total);
    }
    return Array.from(buckets.entries()).map(([h, revenue]) => ({
      label: `${h}h`,
      revenue,
    }));
  }, [filteredTransactions, minHour, maxHour]);

  const periodLabel = useMemo(() => formatPeriodLabel(dateRange), [dateRange]);

  // Highlight the current hour when viewing today only
  const highlightIndex = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (fromDay !== todayStart || toDay !== todayStart) return undefined;
    const h = today.getHours();
    if (h < minHour || h >= maxHour) return undefined;
    return h - minHour;
  }, [dateRange, minHour, maxHour]);

  return { data, periodLabel, highlightIndex };
}

// ── By Day of Week ──
// Single day: fetch surrounding week, highlight the selected day.
// Period: aggregate filteredTransactions per weekday, no highlight.

function jsDayToIdx(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1; // Mon=0 … Sun=6
}

function bucketByDayOfWeek(transactions: Transaction[]): number[] {
  const buckets = Array.from({ length: 7 }, () => 0);
  for (const t of salesTotals(transactions)) {
    buckets[jsDayToIdx(new Date(t.date).getDay())] += t.total;
  }
  return buckets;
}

export function useRevenueByDayOfWeek(
  dateRange: DateRange,
  filteredTransactions: Transaction[],
) {
  const isSingleDay = useMemo(() => {
    const diff = Math.round(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86_400_000,
    );
    return diff <= 1;
  }, [dateRange]);

  // Single-day mode: Mon–Sun calendar week containing the selected day,
  // fetching only up to today so future days stay empty.
  const weekWindow = useMemo(() => {
    if (!isSingleDay) return null;
    const selected = new Date(dateRange.from);
    selected.setHours(0, 0, 0, 0);
    const dayIdx = jsDayToIdx(selected.getDay()); // Mon=0 … Sun=6
    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - dayIdx);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Clamp fetch window to today to avoid future-dated buckets having any data
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const fetchTo = weekEnd.getTime() > today.getTime() ? today : weekEnd;

    return { weekStart, weekEnd, fetchTo };
  }, [dateRange, isSingleDay]);

  const weekQueryRange = useMemo(
    () =>
      weekWindow
        ? { from: weekWindow.weekStart.toISOString(), to: weekWindow.fetchTo.toISOString() }
        : undefined,
    [weekWindow],
  );

  const { transactions: weekTransactions } = useTransactions(
    weekQueryRange ?? { from: undefined, to: undefined },
  );

  const data = useMemo(() => {
    const buckets = isSingleDay
      ? bucketByDayOfWeek(weekTransactions)
      : bucketByDayOfWeek(filteredTransactions);
    return DAY_LABELS.map((label, i) => ({ label, revenue: buckets[i] }));
  }, [isSingleDay, weekTransactions, filteredTransactions]);

  // Highlight: single-day mode → selected day; period mode → today if within period
  const highlightIndex = useMemo(() => {
    if (isSingleDay) {
      return jsDayToIdx(new Date(dateRange.from).getDay());
    }
    if (isTodayWithinRange(dateRange)) {
      return jsDayToIdx(new Date().getDay());
    }
    return undefined;
  }, [isSingleDay, dateRange]);

  const periodLabel = useMemo(() => {
    if (isSingleDay) {
      const fmt = (d: Date) =>
        d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return `${fmt(weekWindow!.weekStart)} – ${fmt(weekWindow!.weekEnd)}`;
    }
    return formatPeriodLabel(dateRange);
  }, [isSingleDay, weekWindow, dateRange]);

  return { data, periodLabel, highlightIndex };
}

// ── By Day of Month ──
// Short period (within one calendar month): show full month's daily breakdown.
// Long period (spans multiple months): aggregate filteredTransactions by day-of-month.

export function useRevenueByDayOfMonth(
  dateRange: DateRange,
  filteredTransactions: Transaction[],
) {
  const periodMonth = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const sameMonth =
      from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
    return sameMonth ? { month: from.getMonth(), year: from.getFullYear() } : null;
  }, [dateRange]);

  // Fetch the full month only when in single-month mode
  const monthQueryRange = useMemo(() => {
    if (!periodMonth) return undefined;
    const from = new Date(periodMonth.year, periodMonth.month, 1);
    const to = new Date(periodMonth.year, periodMonth.month + 1, 0, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [periodMonth]);

  const { transactions: monthTransactions } = useTransactions(
    monthQueryRange ?? { from: undefined, to: undefined },
  );

  const data = useMemo(() => {
    const source = periodMonth ? monthTransactions : filteredTransactions;
    const sales = salesTotals(source);
    const buckets = Array.from({ length: 31 }, () => 0);
    for (const t of sales) {
      const day = new Date(t.date).getDate();
      buckets[day - 1] += t.total;
    }
    return buckets.map((revenue, i) => ({ label: `${i + 1}`, revenue }));
  }, [periodMonth, monthTransactions, filteredTransactions]);

  const periodLabel = useMemo(() => {
    if (periodMonth) {
      return `${MONTH_LABELS_FULL[periodMonth.month]} ${periodMonth.year}`;
    }
    return formatPeriodLabel(dateRange);
  }, [periodMonth, dateRange]);

  // Highlight today's day-number when the viewed month (or period) includes today
  const highlightIndex = useMemo(() => {
    const today = new Date();
    if (periodMonth) {
      if (periodMonth.month === today.getMonth() && periodMonth.year === today.getFullYear()) {
        return today.getDate() - 1;
      }
      return undefined;
    }
    if (isTodayWithinRange(dateRange)) return today.getDate() - 1;
    return undefined;
  }, [periodMonth, dateRange]);

  return { data, periodLabel, highlightIndex };
}

// ── By Month (own year selector) ──

export function useRevenueByMonth(globalDateRange: DateRange) {
  const defaultYear = useMemo(() => {
    const mid = new Date(
      (new Date(globalDateRange.from).getTime() + new Date(globalDateRange.to).getTime()) / 2,
    );
    return mid.getFullYear();
  }, [globalDateRange]);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);

  const queryRange = useMemo(() => {
    const from = new Date(selectedYear, 0, 1);
    const to = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [selectedYear]);

  const { transactions } = useTransactions(queryRange);

  const data = useMemo(() => {
    const sales = salesTotals(transactions);
    const buckets = Array.from({ length: 12 }, () => 0);
    for (const t of sales) {
      const m = new Date(t.date).getMonth();
      buckets[m] += t.total;
    }
    return MONTH_LABELS.map((label, i) => ({ label, revenue: buckets[i] }));
  }, [transactions]);

  const periodLabel = `${selectedYear}`;

  const goToPrevYear = () => setSelectedYear((y) => y - 1);
  const goToNextYear = () => setSelectedYear((y) => y + 1);

  // Highlight current month only if selected year === current year
  const highlightIndex = useMemo(() => {
    const today = new Date();
    if (selectedYear !== today.getFullYear()) return undefined;
    return today.getMonth();
  }, [selectedYear]);

  return { data, periodLabel, goToPrevYear, goToNextYear, highlightIndex };
}
