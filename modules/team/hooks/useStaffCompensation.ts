import { useMemo } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import type { CartItem, StaffMember, Transaction } from '../../../types';
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
  baseSalary: number | null,
): CompensationSummary => {
  const compRange = useMemo(
    () => ({
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
    }),
    [periodStart.toISOString, periodEnd.toISOString],
  );

  const { transactions } = useTransactions(compRange);

  return useMemo(() => {
    const base = baseSalary ?? 0;

    const periodRevenue = (transactions || []).reduce(
      (sum: number, t: Transaction) =>
        sum +
        (t.items || [])
          .filter((i: CartItem) => i.staffId === staff.id)
          .reduce((s: number, i: CartItem) => s + i.price * i.quantity, 0),
      0,
    );

    const commissionEarned = calcCommission(periodRevenue, staff.commissionRate);
    const bonusEarned = calcBonus(periodRevenue, staff.bonusTiers || []);

    return {
      baseSalary: base,
      commissionEarned,
      bonusEarned,
      totalExpected: base + commissionEarned + bonusEarned,
      periodRevenue,
    };
  }, [transactions, staff, baseSalary]);
};
