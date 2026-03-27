import { z } from 'zod';

export const expenseSchema = z.object({
  description: z.string().min(1, 'La description est requise'),
  amount: z.number().gt(0, 'Le montant doit être supérieur à 0'),
  date: z.string().min(1, 'La date est requise'),
  category: z.string().min(1, 'La catégorie est requise'),
});
