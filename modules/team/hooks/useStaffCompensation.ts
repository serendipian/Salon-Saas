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
  const compRange = useMemo(() => ({
    from: periodStart.toISOString(),
    to: periodEnd.toISOString(),
  }), [periodStart.getTime(), periodEnd.getTime()]);

  const { transactions } = useTransactions(compRange);

  return useMemo(() => {
    const base = baseSalary ?? 0;

    const periodRevenue = (transactions || [])
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
