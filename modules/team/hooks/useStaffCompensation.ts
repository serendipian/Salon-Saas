import { useMemo } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import type { StaffMember } from '../../../types';
import { calcBonus, calcCommission } from '../utils';

interface CompensationSummary {
  baseSalary: number;
  commissionEarned: number;
  bonusEarned: number;
  totalExpected: number;
  periodRevenue: number;
}

export const useStaffCompensation = (
  staff: StaffMember,
  periodStart: Date,
  periodEnd: Date,
  baseSalary: number | null
): CompensationSummary => {
  const { transactions } = useTransactions();

  return useMemo(() => {
    const base = baseSalary ?? 0;

    // Compare using date strings (YYYY-MM-DD) to avoid timezone edge issues
    const startStr = periodStart.toISOString().slice(0, 10);
    const endStr = periodEnd.toISOString().slice(0, 10);

    const periodRevenue = (transactions || [])
      .filter((t: any) => {
        const dateStr = new Date(t.date).toISOString().slice(0, 10);
        return dateStr >= startStr && dateStr <= endStr;
      })
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);

    const commissionEarned = calcCommission(periodRevenue, staff.commissionRate);
    const bonusEarned = calcBonus(periodRevenue, staff.bonusTiers || []);

    return {
      baseSalary: base,
      commissionEarned,
      bonusEarned,
      totalExpected: base + commissionEarned + bonusEarned,
      periodRevenue,
    };
  }, [transactions, staff, periodStart.getTime(), periodEnd.getTime(), baseSalary]);
};
