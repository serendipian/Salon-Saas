import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Le nom du produit est requis'),
  categoryId: z.string().min(1, 'La catégorie est requise'),
  price: z.number().min(0, 'Le prix doit être positif'),
  cost: z.number().min(0, 'Le coût doit être positif'),
  stock: z.number().int('Le stock doit être un nombre entier').min(0, 'Le stock doit être positif'),
});
