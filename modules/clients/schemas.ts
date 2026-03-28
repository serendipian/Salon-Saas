import { z } from 'zod';

export const clientSchema = z.object({
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.union([
    z.string().email("L'email n'est pas valide"),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
}).refine(
  (data) => (data.firstName?.trim() || data.lastName?.trim()),
  { message: 'Le prénom ou le nom est requis', path: ['firstName'] },
);
