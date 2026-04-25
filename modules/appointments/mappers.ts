// modules/appointments/mappers.ts
import type {
  Appointment,
  AppointmentGroup,
  AppointmentStatus,
  DeletionReason,
} from '../../types';

// Row type includes JOINed relations from:
// .select('*, clients(first_name, last_name), services(name), staff_members!staff_id(first_name, last_name)')
// (staff_members FK is hinted via !staff_id since appointments has two FKs to it: staff_id and original_staff_id)
interface AppointmentRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  service_id: string | null;
  service_variant_id: string | null;
  staff_id: string | null;
  group_id: string | null;
  date: string;
  duration_minutes: number;
  status: string;
  price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  deletion_note: string | null;
  cancelled_at: string | null;
  original_price: number | null;
  original_staff_id: string | null;
  change_note: string | null;
  // JOINed relations (nullable if FK is null)
  clients: { first_name: string; last_name: string } | null;
  services: { name: string } | null;
  service_variants: { name: string } | null;
  staff_members: { first_name: string; last_name: string } | null;
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(' ')
      : '',
    serviceId: row.service_id ?? '',
    serviceName: row.services?.name ?? '',
    date: row.date,
    durationMinutes: row.duration_minutes,
    staffId: row.staff_id ?? '',
    staffName: row.staff_members
      ? [row.staff_members.first_name, row.staff_members.last_name].filter(Boolean).join(' ')
      : '',
    status: row.status as AppointmentStatus,
    variantId: row.service_variant_id ?? undefined,
    variantName: row.service_variants?.name ?? '',
    price: row.price,
    notes: row.notes ?? undefined,
    groupId: row.group_id ?? null,
    deletedAt: row.deleted_at ?? null,
    deletionReason: (row.deletion_reason as DeletionReason | null) ?? null,
    deletionNote: row.deletion_note ?? null,
    cancelledAt: row.cancelled_at ?? null,
    originalPrice: row.original_price ?? null,
    originalStaffId: row.original_staff_id ?? null,
    changeNote: row.change_note ?? null,
  };
}

export function toAppointmentInsert(appt: Appointment, salonId: string) {
  return {
    id: appt.id || undefined,
    salon_id: salonId,
    client_id: appt.clientId || null,
    service_id: appt.serviceId || null,
    service_variant_id: appt.variantId || null,
    staff_id: appt.staffId || null,
    date: appt.date,
    duration_minutes: appt.durationMinutes,
    status: appt.status,
    price: appt.price,
    notes: appt.notes ?? null,
  };
}

// --- Appointment Group mappers ---

interface AppointmentGroupRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  notes: string | null;
  reminder_minutes: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  clients: { first_name: string; last_name: string } | null;
  appointments: AppointmentRow[];
}

export function toAppointmentGroup(row: AppointmentGroupRow): AppointmentGroup {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(' ')
      : '',
    notes: row.notes ?? '',
    reminderMinutes: row.reminder_minutes,
    status: row.status as AppointmentStatus,
    appointments: (row.appointments ?? []).map(toAppointment),
  };
}

export function toAppointmentGroupInsert(
  group: {
    clientId: string;
    notes: string;
    reminderMinutes: number | null;
    status: string;
  },
  salonId: string,
) {
  return {
    salon_id: salonId,
    client_id: group.clientId || null,
    notes: group.notes || null,
    reminder_minutes: group.reminderMinutes,
    status: group.status,
  };
}
