import { z } from 'zod';

export const salonSettingsSchema = z.object({
  name: z.string().min(1, 'Le nom du salon est requis'),
  email: z.union([
    z.string().email("L'email n'est pas valide"),
    z.string().length(0),
  ]).optional().default(''),
  vatRate: z.number().min(0, 'Le taux TVA doit être entre 0 et 100').max(100, 'Le taux TVA doit être entre 0 et 100'),
});

export const expenseCategorySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale requise'),
});

export const recurringExpenseSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  amount: z.number().gt(0, 'Le montant doit être supérieur à 0'),
  frequency: z.enum(['Mensuel', 'Annuel', 'Hebdomadaire'], {
    errorMap: () => ({ message: 'La fréquence est requise' }),
  }),
  nextDate: z.string().min(1, 'La prochaine date est requise'),
});
