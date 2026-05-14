import { useMemo, useState } from 'react';
import { useSalonTimezone } from '../../../hooks/useSalonTimezone';
import { useTransactions } from '../../../hooks/useTransactions';
import {
  addDaysInSalon,
  endOfDayInSalon,
  endOfMonthInSalon,
  endOfYearInSalon,
  getDayOfMonthInSalon,
  getDayOfWeekInSalon,
  getHourInSalon,
  getMonthInSalon,
  getYearInSalon,
  salonDateString,
  salonInstantFromParts,
  startOfDayInSalon,
  startOfMonthInSalon,
  startOfYearInSalon,
} from '../../../lib/salonTime';
import { getSalonHourRange } from '../../../lib/scheduleHours';
import type { DateRange, Transaction, WorkSchedule } from '../../../types';

export interface ActivityChartPoint {
  label: string;
  revenue: number;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];
const MONTH_LABELS_FULL = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function isTodayWithinRange(dateRange: DateRange, tz: string): boolean {
  const todayStart = startOfDayInSalon(new Date(), tz).getTime();
  const fromStart = startOfDayInSalon(dateRange.from, tz).getTime();
  const toEnd = endOfDayInSalon(dateRange.to, tz).getTime();
  return todayStart >= fromStart && todayStart <= toEnd;
}

function salesTotals(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'SALE');
}

// JS Date.getDay returns 0=Sunday … 6=Saturday. Our DAY_LABELS start Monday.
function jsDayToIdx(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1; // Mon=0 … Sun=6
}

function formatPeriodLabel(dateRange: DateRange, tz: string): string {
  const fromStr = salonDateString(dateRange.from, tz);
  const toStr = salonDateString(dateRange.to, tz);
  const todayStr = salonDateString(new Date(), tz);
  const yesterdayStr = salonDateString(addDaysInSalon(new Date(), -1, tz), tz);

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });

  if (fromStr === toStr) {
    if (fromStr === todayStr) return "Aujourd'hui";
    if (fromStr === yesterdayStr) return 'Hier';
    return fmt(fromStr);
  }
  return `${fmt(fromStr)} – ${fmt(toStr)}`;
}

// ── By Hour ──

export function useRevenueByHour(
  filteredTransactions: Transaction[],
  schedule: WorkSchedule | undefined,
  dateRange: DateRange,
) {
  const tz = useSalonTimezone();
  const { minHour, maxHour } = useMemo(() => getSalonHourRange(schedule), [schedule]);

  const data = useMemo(() => {
    const sales = salesTotals(filteredTransactions);
    const buckets = new Map<number, number>();
    for (let h = minHour; h < maxHour; h++) buckets.set(h, 0);
    for (const t of sales) {
      const h = getHourInSalon(t.date, tz);
      if (buckets.has(h)) buckets.set(h, buckets.get(h)! + t.total);
    }
    return Array.from(buckets.entries()).map(([h, revenue]) => ({
      label: `${h}h`,
      revenue,
    }));
  }, [filteredTransactions, minHour, maxHour, tz]);

  const periodLabel = useMemo(() => formatPeriodLabel(dateRange, tz), [dateRange, tz]);

  // Highlight the current hour when viewing today only
  const highlightIndex = useMemo(() => {
    const todayStr = salonDateString(new Date(), tz);
    const fromStr = salonDateString(dateRange.from, tz);
    const toStr = salonDateString(dateRange.to, tz);
    if (fromStr !== todayStr || toStr !== todayStr) return undefined;
    const h = getHourInSalon(new Date(), tz);
    if (h < minHour || h >= maxHour) return undefined;
    return h - minHour;
  }, [dateRange, minHour, maxHour, tz]);

  return { data, periodLabel, highlightIndex };
}

// ── By Day of Week ──
// Single day: fetch surrounding week, highlight the selected day.
// Period: aggregate filteredTransactions per weekday, no highlight.

export function useRevenueByDayOfWeek(dateRange: DateRange, filteredTransactions: Transaction[]) {
  const tz = useSalonTimezone();

  const bucketByDayOfWeek = (transactions: Transaction[]): number[] => {
    const buckets = Array.from({ length: 7 }, () => 0);
    for (const t of salesTotals(transactions)) {
      buckets[jsDayToIdx(getDayOfWeekInSalon(t.date, tz))] += t.total;
    }
    return buckets;
  };

  const isSingleDay = useMemo(() => {
    const fromStr = salonDateString(dateRange.from, tz);
    const toStr = salonDateString(dateRange.to, tz);
    return fromStr === toStr;
  }, [dateRange, tz]);

  // Single-day mode: Mon–Sun calendar week containing the selected day,
  // fetching only up to today so future days stay empty.
  const weekWindow = useMemo(() => {
    if (!isSingleDay) return null;
    const selectedStart = startOfDayInSalon(dateRange.from, tz);
    const dayIdx = jsDayToIdx(getDayOfWeekInSalon(selectedStart, tz)); // Mon=0 … Sun=6
    const weekStart = addDaysInSalon(selectedStart, -dayIdx, tz);
    const weekEnd = endOfDayInSalon(addDaysInSalon(weekStart, 6, tz), tz);

    // Clamp fetch window to today to avoid future-dated buckets having any data
    const todayEnd = endOfDayInSalon(new Date(), tz);
    const fetchTo = weekEnd.getTime() > todayEnd.getTime() ? todayEnd : weekEnd;

    return { weekStart, weekEnd, fetchTo };
  }, [dateRange, isSingleDay, tz]);

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
    // bucketByDayOfWeek closes over `tz`; including it ensures recompute on TZ change.
    // biome-ignore lint/correctness/useExhaustiveDependencies: bucketByDayOfWeek is redeclared each render
  }, [isSingleDay, weekTransactions, filteredTransactions, tz]);

  // Highlight: single-day mode → selected day; period mode → today if within period
  const highlightIndex = useMemo(() => {
    if (isSingleDay) {
      return jsDayToIdx(getDayOfWeekInSalon(dateRange.from, tz));
    }
    if (isTodayWithinRange(dateRange, tz)) {
      return jsDayToIdx(getDayOfWeekInSalon(new Date(), tz));
    }
    return undefined;
  }, [isSingleDay, dateRange, tz]);

  const periodLabel = useMemo(() => {
    if (isSingleDay && weekWindow) {
      const fmt = (d: Date) =>
        d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
      return `${fmt(weekWindow.weekStart)} – ${fmt(weekWindow.weekEnd)}`;
    }
    return formatPeriodLabel(dateRange, tz);
  }, [isSingleDay, weekWindow, dateRange, tz]);

  return { data, periodLabel, highlightIndex };
}

// ── By Day of Month ──
// Short period (within one calendar month): show full month's daily breakdown.
// Long period (spans multiple months): aggregate filteredTransactions by day-of-month.

export function useRevenueByDayOfMonth(dateRange: DateRange, filteredTransactions: Transaction[]) {
  const tz = useSalonTimezone();

  const periodMonth = useMemo(() => {
    const fromMonth = getMonthInSalon(dateRange.from, tz);
    const fromYear = getYearInSalon(dateRange.from, tz);
    const toMonth = getMonthInSalon(dateRange.to, tz);
    const toYear = getYearInSalon(dateRange.to, tz);
    return fromMonth === toMonth && fromYear === toYear ? { month: fromMonth, year: fromYear } : null;
  }, [dateRange, tz]);

  // Fetch the full month only when in single-month mode
  const monthQueryRange = useMemo(() => {
    if (!periodMonth) return undefined;
    const from = salonInstantFromParts(periodMonth.year, periodMonth.month, 1, 0, 0, 0, 0, tz);
    const to = endOfMonthInSalon(from, tz);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [periodMonth, tz]);

  const { transactions: monthTransactions } = useTransactions(
    monthQueryRange ?? { from: undefined, to: undefined },
  );

  const data = useMemo(() => {
    const source = periodMonth ? monthTransactions : filteredTransactions;
    const sales = salesTotals(source);
    const buckets = Array.from({ length: 31 }, () => 0);
    for (const t of sales) {
      const day = getDayOfMonthInSalon(t.date, tz);
      buckets[day - 1] += t.total;
    }
    return buckets.map((revenue, i) => ({ label: `${i + 1}`, revenue }));
  }, [periodMonth, monthTransactions, filteredTransactions, tz]);

  const periodLabel = useMemo(() => {
    if (periodMonth) {
      return `${MONTH_LABELS_FULL[periodMonth.month - 1]} ${periodMonth.year}`;
    }
    return formatPeriodLabel(dateRange, tz);
  }, [periodMonth, dateRange, tz]);

  // Highlight today's day-number when the viewed month (or period) includes today
  const highlightIndex = useMemo(() => {
    const todayMonth = getMonthInSalon(new Date(), tz);
    const todayYear = getYearInSalon(new Date(), tz);
    const todayDay = getDayOfMonthInSalon(new Date(), tz);
    if (periodMonth) {
      if (periodMonth.month === todayMonth && periodMonth.year === todayYear) {
        return todayDay - 1;
      }
      return undefined;
    }
    if (isTodayWithinRange(dateRange, tz)) return todayDay - 1;
    return undefined;
  }, [periodMonth, dateRange, tz]);

  return { data, periodLabel, highlightIndex };
}

// ── By Month (own year selector) ──

export function useRevenueByMonth(globalDateRange: DateRange) {
  const tz = useSalonTimezone();

  const defaultYear = useMemo(() => {
    const midInstant = new Date(
      (new Date(globalDateRange.from).getTime() + new Date(globalDateRange.to).getTime()) / 2,
    );
    return getYearInSalon(midInstant, tz);
  }, [globalDateRange, tz]);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);

  const queryRange = useMemo(() => {
    const from = startOfYearInSalon(
      salonInstantFromParts(selectedYear, 6, 1, 12, 0, 0, 0, tz),
      tz,
    );
    const to = endOfYearInSalon(from, tz);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [selectedYear, tz]);

  const { transactions } = useTransactions(queryRange);

  const data = useMemo(() => {
    const sales = salesTotals(transactions);
    const buckets = Array.from({ length: 12 }, () => 0);
    for (const t of sales) {
      const m = getMonthInSalon(t.date, tz); // 1-12
      buckets[m - 1] += t.total;
    }
    return MONTH_LABELS.map((label, i) => ({ label, revenue: buckets[i] }));
  }, [transactions, tz]);

  const periodLabel = `${selectedYear}`;

  const goToPrevYear = () => setSelectedYear((y) => y - 1);
  const goToNextYear = () => setSelectedYear((y) => y + 1);

  // Highlight current month only if selected year === current year
  const highlightIndex = useMemo(() => {
    const todayYear = getYearInSalon(new Date(), tz);
    if (selectedYear !== todayYear) return undefined;
    return getMonthInSalon(new Date(), tz) - 1;
  }, [selectedYear, tz]);

  return { data, periodLabel, goToPrevYear, goToNextYear, highlightIndex };
}
