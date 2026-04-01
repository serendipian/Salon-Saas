import { z } from 'zod';

export const staffMemberSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().optional().default(''),
  email: z.union([
    z.string().email("L'email n'est pas valide"),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
  role: z.enum(['Manager', 'Stylist', 'Assistant', 'Receptionist'], {
    errorMap: () => ({ message: 'Le rôle est requis' }),
  }),
});
