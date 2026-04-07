import { z } from 'zod';

// Legacy single-appointment schema (used by AppointmentForm)
export const appointmentSchema = z.object({
  clientId: z.string().min(1, 'Le client est requis'),
  staffId: z.string().min(1, "Le membre de l'équipe est requis"),
  serviceId: z.string().min(1, 'Le service est requis'),
  date: z.string().min(1, 'La date est requise').refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "La date n'est pas valide" },
  ),
});

export const newClientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().optional().default(''),
  phone: z.string().min(6, 'Le numéro de téléphone est requis'),
});

export const serviceBlockSchema = z.object({
  serviceId: z.string().min(1, 'Le service est requis'),
  variantId: z.string(),
  staffId: z.string().nullable(),
  date: z.string().min(1, 'La date est requise'),
  hour: z.number().min(0, "L'heure est requise").max(23, "L'heure doit être entre 0 et 23"),
  minute: z.number().refine(
    (m) => [0, 15, 30, 45].includes(m),
    { message: 'Les minutes doivent être 00, 15, 30 ou 45' },
  ),
});

export const appointmentGroupSchema = z.object({
  clientId: z.string().min(1, 'Le client est requis'),
  serviceBlocks: z
    .array(serviceBlockSchema)
    .min(1, 'Au moins un service est requis'),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().optional().default(''),
  reminderMinutes: z.number().nullable(),
});
