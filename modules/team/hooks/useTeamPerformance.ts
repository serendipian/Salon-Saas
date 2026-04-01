import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useTransactions } from '../../../hooks/useTransactions';
import type { StaffMember, BonusTier, DateRange, Transaction, CartItem, WorkSchedule } from '../../../types';

export interface StaffPerformance {
  staff: StaffMember;
  revenue: number;
  revenuePerDay: number;
  workingDays: number;
  bonusAttribue: number;
  baseSalary: number | null;
  ratio: number | null;
}

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function countWorkingDays(from: Date, to: Date, schedule: WorkSchedule | undefined): number {
  if (!schedule) return 0;
  let count = 0;
  const current = new Date(from);
  while (current <= to) {
    const dayKey = DAY_KEYS[current.getDay()];
    if (schedule[dayKey]?.isOpen) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function calcBonus(revenue: number, tiers?: BonusTier[]): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.target - a.target);
  const applicable = sorted.find(t => revenue >= t.target);
  return applicable?.bonus ?? 0;
}

export const useTeamPerformance = (staff: StaffMember[]) => {
  const { transactions } = useTransactions();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: 'Ce mois-ci',
    };
  });

  const filtered = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    return transactions.filter(t => {
      const time = new Date(t.date).getTime();
      return time >= from && time <= to;
    });
  }, [transactions, dateRange]);

  const revenueByStaff = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (!item.staffId) return;
        map.set(item.staffId, (map.get(item.staffId) || 0) + item.price * (item.quantity || 1));
      });
    });
    return map;
  }, [filtered]);

  const piiQueries = useQueries({
    queries: staff.map(m => ({
      queryKey: ['staff_pii', m.id],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_staff_pii', { p_staff_id: m.id });
        if (error) return null;
        const row = (data as { base_salary: string | null }[] | null)?.[0];
        return row?.base_salary ? parseFloat(row.base_salary) : null;
      },
      staleTime: 5 * 60 * 1000,
      enabled: !!m.id,
    })),
  });

  const performances = useMemo((): StaffPerformance[] => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);

    return staff.map((member, idx) => {
      const revenue = revenueByStaff.get(member.id) || 0;
      const workingDays = countWorkingDays(from, to, member.schedule);
      const revenuePerDay = workingDays > 0 ? revenue / workingDays : 0;
      const bonusAttribue = calcBonus(revenue, member.bonusTiers);
      const baseSalary = piiQueries[idx]?.data ?? null;
      const ratio = baseSalary && baseSalary > 0 ? revenue / baseSalary : null;

      return { staff: member, revenue, revenuePerDay, workingDays, bonusAttribue, baseSalary, ratio };
    });
  }, [staff, revenueByStaff, piiQueries, dateRange]);

  const totalRevenue = useMemo(() => performances.reduce((s, p) => s + p.revenue, 0), [performances]);
  const isLoadingPii = piiQueries.some(q => q.isLoading);

  return { performances, dateRange, setDateRange, totalRevenue, isLoadingPii };
};
