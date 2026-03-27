import { z } from 'zod';

export const appointmentSchema = z.object({
  clientId: z.string().min(1, 'Le client est requis'),
  staffId: z.string().min(1, "Le membre de l'équipe est requis"),
  serviceId: z.string().min(1, 'Le service est requis'),
  date: z.string().min(1, 'La date est requise').refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "La date n'est pas valide" },
  ),
});
