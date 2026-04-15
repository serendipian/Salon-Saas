import { z } from 'zod';

// M-28: Extend the previously bare-minimum client schema to cover the
// conditional fields and enums in ClientForm. The form already enforces
// some of these client-side via show/hide logic, but Zod is the only
// validation layer that catches programmatic submissions and gives field-
// level error messages in one place.

const optionalString = z.string().optional().default('');

export const clientSchema = z
  .object({
    // --- Identity ---
    firstName: optionalString,
    lastName: optionalString,
    gender: z.enum(['Homme', 'Femme']).optional(),
    ageGroup: optionalString,
    city: optionalString,
    profession: optionalString,
    company: optionalString,
    notes: optionalString,
    allergies: optionalString,

    // --- Relation ---
    status: z.enum(['ACTIF', 'VIP', 'INACTIF']).optional(),
    preferredStaffId: z.string().optional(),

    // --- Contact ---
    phone: optionalString,
    email: z
      .union([z.string().email("L'email n'est pas valide"), z.string().length(0)])
      .optional()
      .default(''),
    whatsapp: optionalString,
    instagram: optionalString,
    preferredChannel: optionalString,
    preferredLanguage: optionalString,
    otherChannelDetail: optionalString,

    // --- Acquisition ---
    contactDate: optionalString,
    contactMethod: optionalString,
    messageChannel: optionalString,
    acquisitionSource: optionalString,
    acquisitionDetail: optionalString,

    // --- Permissions ---
    permissions: z
      .object({
        socialMedia: z.boolean().default(false),
        marketing: z.boolean().default(false),
        other: z.boolean().default(false),
        otherDetail: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .refine((data) => Boolean(data.firstName?.trim() || data.lastName?.trim()), {
    message: 'Le prénom ou le nom est requis',
    path: ['firstName'],
  })
  .refine(
    // If preferredChannel is "Autre", the otherChannelDetail must be filled.
    (data) => data.preferredChannel !== 'Autre' || Boolean(data.otherChannelDetail?.trim()),
    { message: 'Précisez le canal de contact', path: ['otherChannelDetail'] },
  )
  .refine(
    // If contactMethod is "Message", a messageChannel must be selected.
    (data) => data.contactMethod !== 'Message' || Boolean(data.messageChannel?.trim()),
    { message: 'Sélectionnez le canal du message', path: ['messageChannel'] },
  )
  .refine(
    // If acquisitionSource is "Influenceur", the influencer name (acquisitionDetail) is required.
    (data) => data.acquisitionSource !== 'Influenceur' || Boolean(data.acquisitionDetail?.trim()),
    { message: "Indiquez le nom de l'influenceur", path: ['acquisitionDetail'] },
  )
  .refine(
    // If acquisitionSource is "Autre", the explanation (acquisitionDetail) is required.
    (data) => data.acquisitionSource !== 'Autre' || Boolean(data.acquisitionDetail?.trim()),
    { message: 'Précisez la source', path: ['acquisitionDetail'] },
  )
  .refine(
    // If permissions.other is true, the otherDetail explanation is required.
    (data) => !data.permissions?.other || Boolean(data.permissions.otherDetail?.trim()),
    { message: 'Précisez les autres autorisations', path: ['permissions', 'otherDetail'] },
  );
