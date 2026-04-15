import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom du fournisseur est requis'),
  email: z
    .union([z.string().email("L'email n'est pas valide"), z.string().length(0)])
    .optional()
    .default(''),
  phone: z.string().optional().default(''),
  contactName: z.string().optional().default(''),
  categoryId: z.string().nullable().optional(),
});
