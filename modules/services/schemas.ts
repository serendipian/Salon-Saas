import { z } from 'zod';

export const serviceVariantSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Le nom de la variante est requis'),
  durationMinutes: z.number().gt(0, 'La durée doit être supérieure à 0'),
  price: z.number().min(0, 'Le prix doit être positif'),
  cost: z.number().min(0, 'Le coût doit être positif'),
  additionalCost: z.number().min(0, 'Le coût additionnel doit être positif'),
});

export const serviceSchema = z.object({
  name: z.string().min(1, 'Le nom du service est requis'),
  categoryId: z.string().min(1, 'La catégorie est requise'),
  variants: z.array(serviceVariantSchema).min(1, 'Au moins une variante est requise'),
});
