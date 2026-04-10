import { z } from 'zod';

// L-7: Reasonable date bounds. The form input is type="date" so the user gets
// a calendar picker, but typed values or a programmatic submit can sneak in
// silly dates. Reject anything in the future or before 2020.
const MIN_EXPENSE_YEAR = 2020;
const isReasonableExpenseDate = (value: string): boolean => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  if (d.getFullYear() < MIN_EXPENSE_YEAR) return false;
  // Allow today (compare against end-of-day to be timezone-tolerant).
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return d.getTime() <= endOfToday.getTime();
};

export const expenseSchema = z.object({
  description: z.string().min(1, 'La description est requise'),
  amount: z.number().gt(0, 'Le montant doit être supérieur à 0'),
  date: z.string()
    .min(1, 'La date est requise')
    .refine(isReasonableExpenseDate, 'La date doit être comprise entre 2020 et aujourd\'hui'),
  category: z.string().min(1, 'La catégorie est requise'),
});
