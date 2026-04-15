import { z } from 'zod';

export const packSchema = z.object({
  name: z.string().min(1, 'Le nom du pack est requis'),
  description: z.string().optional(),
  price: z.number().gt(0, 'Le prix doit être supérieur à 0'),
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        serviceVariantId: z.string().min(1),
      }),
    )
    .min(1, 'Au moins un service est requis'),
});

// L-17: Zod schema for PackGroupForm — replaces the inline if/then validation
// in the form so it follows the same pattern as the rest of the codebase
// (useFormValidation + Zod refines).
export const packGroupSchema = z
  .object({
    name: z.string().min(1, 'Le nom est requis'),
    description: z.string().optional().default(''),
    color: z.string().nullable().default(null),
    startsAt: z.string().nullable().default(null),
    endsAt: z.string().nullable().default(null),
  })
  .refine(
    (data) => {
      if (!data.startsAt || !data.endsAt) return true;
      return new Date(data.startsAt).getTime() <= new Date(data.endsAt).getTime();
    },
    { message: 'La date de fin doit être après la date de début', path: ['endsAt'] },
  );
