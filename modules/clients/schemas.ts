import { z } from 'zod';

export const clientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([
    z.string().email("L'email n'est pas valide"),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
});
