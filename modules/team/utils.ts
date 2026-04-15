import type { WorkSchedule, BonusTier } from '../../types';

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function countWorkingDays(from: Date, to: Date, schedule: WorkSchedule | undefined): number {
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

export function calcBonus(revenue: number, tiers?: BonusTier[]): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.target - a.target);
  const applicable = sorted.find((t) => revenue >= t.target);
  return applicable?.bonus ?? 0;
}

export function calcCommission(revenue: number, rate: number): number {
  return revenue * (rate / 100);
}
