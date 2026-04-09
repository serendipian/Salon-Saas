import { z } from 'zod';

export const packSchema = z.object({
  name: z.string().min(1, 'Le nom du pack est requis'),
  description: z.string().optional(),
  price: z.number().gt(0, 'Le prix doit être supérieur à 0'),
  items: z.array(z.object({
    serviceId: z.string().min(1),
    serviceVariantId: z.string().min(1),
  })).min(1, 'Au moins un service est requis'),
});
