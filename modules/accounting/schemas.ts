import { z } from 'zod';
import { todayInSalon } from '../../lib/salonTime';

// L-7: Reasonable date bounds. The form input is type="date" so the user gets
// a calendar picker, but typed values or a programmatic submit can sneak in
// silly dates. Reject anything in the future or before 2020.
//
// Schema is a factory: callers pass the salon's timezone so "today" matches
// the cashier's calendar day (not the browser's local day, which can disagree
// at midnight UTC or when browser TZ ≠ salon TZ).
const MIN_EXPENSE_YEAR = 2020;

export const buildExpenseSchema = (timezone: string) => {
  const today = todayInSalon(timezone); // YYYY-MM-DD in salon-local
  const isReasonableExpenseDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    if (Number.parseInt(value.slice(0, 4), 10) < MIN_EXPENSE_YEAR) return false;
    return value <= today; // ISO date-string comparison is lexical & TZ-free
  };

  return z.object({
    description: z.string().min(1, 'La description est requise'),
    amount: z.number().gt(0, 'Le montant doit être supérieur à 0'),
    date: z
      .string()
      .min(1, 'La date est requise')
      .refine(isReasonableExpenseDate, "La date doit être comprise entre 2020 et aujourd'hui"),
    category: z.string().min(1, 'La catégorie est requise'),
  });
};
