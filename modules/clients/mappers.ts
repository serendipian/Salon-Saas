import type { Client } from '../../types';

interface ClientStatsRow {
  client_id: string;
  salon_id: string;
  total_visits: number | null;
  total_spent: number | null;
  first_visit_date: string | null;
  last_visit_date: string | null;
}

interface ClientRow {
  id: string;
  salon_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string | null;
  age_group: string | null;
  city: string | null;
  profession: string | null;
  company: string | null;
  notes: string | null;
  allergies: string | null;
  status: string | null;
  preferred_staff_id: string | null;
  photo_url: string | null;
  social_network: string | null;
  social_username: string | null;
  instagram: string | null;
  whatsapp: string | null;
  preferred_channel: string | null;
  other_channel_detail: string | null;
  preferred_language: string | null;
  contact_date: string | null;
  contact_method: string | null;
  message_channel: string | null;
  acquisition_source: string | null;
  acquisition_detail: string | null;
  permissions_social_media: boolean | null;
  permissions_marketing: boolean | null;
  permissions_other: boolean | null;
  permissions_other_detail: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

export function toClient(row: ClientRow, stats?: ClientStatsRow | null): Client {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name ?? '',
    email: row.email,
    phone: row.phone,
    gender: (row.gender as Client['gender']) ?? undefined,
    ageGroup: row.age_group ?? undefined,
    city: row.city ?? undefined,
    profession: row.profession ?? undefined,
    company: row.company ?? undefined,
    notes: row.notes ?? undefined,
    allergies: row.allergies ?? undefined,
    status: (row.status as Client['status']) ?? undefined,
    preferredStaffId: row.preferred_staff_id ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    socialNetwork: row.social_network ?? undefined,
    socialUsername: row.social_username ?? undefined,
    instagram: row.instagram ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    preferredChannel: row.preferred_channel ?? undefined,
    otherChannelDetail: row.other_channel_detail ?? undefined,
    preferredLanguage: row.preferred_language ?? undefined,
    contactDate: row.contact_date ?? undefined,
    contactMethod: row.contact_method ?? undefined,
    messageChannel: row.message_channel ?? undefined,
    acquisitionSource: row.acquisition_source ?? undefined,
    acquisitionDetail: row.acquisition_detail ?? undefined,
    permissions: {
      socialMedia: row.permissions_social_media ?? false,
      marketing: row.permissions_marketing ?? false,
      other: row.permissions_other ?? false,
      otherDetail: row.permissions_other_detail ?? undefined,
    },
    totalVisits: stats?.total_visits ?? 0,
    totalSpent: stats?.total_spent ?? 0,
    firstVisitDate: stats?.first_visit_date ?? undefined,
    lastVisitDate: stats?.last_visit_date ?? undefined,
    createdAt: row.created_at,
  };
}

export function toClientInsert(data: Client, salonId: string) {
  return {
    salon_id: salonId,
    first_name: data.firstName || '',
    last_name: data.lastName || '',
    email: data.email || null,
    phone: data.phone || null,
    gender: data.gender || null,
    age_group: data.ageGroup || null,
    city: data.city || null,
    profession: data.profession || null,
    company: data.company || null,
    notes: data.notes || null,
    allergies: data.allergies || null,
    status: data.status || 'ACTIF',
    preferred_staff_id: data.preferredStaffId || null,
    photo_url: data.photoUrl || null,
    social_network: data.socialNetwork || null,
    social_username: data.socialUsername || null,
    instagram: data.instagram || null,
    whatsapp: data.whatsapp || null,
    preferred_channel: data.preferredChannel || null,
    other_channel_detail: data.otherChannelDetail || null,
    preferred_language: data.preferredLanguage || null,
    contact_date: data.contactDate || null,
    contact_method: data.contactMethod || null,
    message_channel: data.messageChannel || null,
    acquisition_source: data.acquisitionSource || null,
    acquisition_detail: data.acquisitionDetail || null,
    permissions_social_media: data.permissions?.socialMedia ?? false,
    permissions_marketing: data.permissions?.marketing ?? false,
    permissions_other: data.permissions?.other ?? false,
    permissions_other_detail: data.permissions?.otherDetail ?? null,
  };
}
