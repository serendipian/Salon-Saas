import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useTransactions } from '../../../hooks/useTransactions';
import { useAuth } from '../../../context/AuthContext';
import type { StaffMember, DateRange, Transaction, CartItem } from '../../../types';
import { countWorkingDays, calcBonus } from '../utils';

export interface StaffPerformance {
  staff: StaffMember;
  revenue: number;
  revenuePerDay: number;
  workingDays: number;
  bonusAttribue: number;
  baseSalary: number | null;
  ratio: number | null;
}

export const useTeamPerformance = (staff: StaffMember[]): {
  performances: StaffPerformance[];
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  totalRevenue: number;
  isLoadingPii: boolean;
} => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: 'Ce mois-ci',
    };
  });

  const teamRange = useMemo(() => ({
    from: new Date(dateRange.from).toISOString(),
    to: new Date(dateRange.to).toISOString(),
  }), [dateRange]);

  const { transactions } = useTransactions(teamRange);

  const revenueByStaff = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t: Transaction) => {
      t.items.forEach((item: CartItem) => {
        if (!item.staffId) return;
        map.set(item.staffId, (map.get(item.staffId) || 0) + item.price * (item.quantity || 1));
      });
    });
    return map;
  }, [transactions]);

  const staffIds = useMemo(() => staff.map(m => m.id), [staff]);

  const { data: piiMap = {} as Record<string, number | null>, isLoading: isLoadingPii } = useQuery({
    queryKey: ['staff_pii_batch', salonId, staffIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_staff_pii_batch', { p_staff_ids: staffIds });
      const map: Record<string, number | null> = {};
      if (error || !data) return map;
      for (const row of data as { staff_id: string; base_salary: string | null }[]) {
        map[row.staff_id] = row.base_salary ? parseFloat(row.base_salary) : null;
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: staffIds.length > 0,
  });

  const performances = useMemo((): StaffPerformance[] => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);

    return staff.map((member) => {
      const revenue = revenueByStaff.get(member.id) || 0;
      const workingDays = countWorkingDays(from, to, member.schedule);
      const revenuePerDay = workingDays > 0 ? revenue / workingDays : 0;
      const bonusAttribue = calcBonus(revenue, member.bonusTiers);
      const baseSalary = piiMap[member.id] ?? null;
      const ratio = baseSalary && baseSalary > 0 ? revenue / baseSalary : null;

      return { staff: member, revenue, revenuePerDay, workingDays, bonusAttribue, baseSalary, ratio };
    });
  }, [staff, revenueByStaff, piiMap, dateRange]);

  const totalRevenue = useMemo(() => performances.reduce((s, p) => s + p.revenue, 0), [performances]);

  return { performances, dateRange, setDateRange, totalRevenue, isLoadingPii };
};
