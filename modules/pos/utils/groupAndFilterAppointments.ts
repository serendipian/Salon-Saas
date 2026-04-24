import type { Appointment, Service } from '../../../types';
import { AppointmentStatus } from '../../../types';

export interface AppointmentFilters {
  staffId: string; // staffId | 'ALL'
  categoryId: string; // categoryId | 'ALL'
  status: 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS;
}

export const groupAppointments = (appointments: Appointment[]): Appointment[][] => {
  const order: string[] = [];
  const byKey = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    const key = appt.groupId ?? appt.id;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)?.push(appt);
  }
  return order.map((k) => byKey.get(k) ?? []);
};

export const filterAppointmentGroups = (
  groups: Appointment[][],
  filters: AppointmentFilters,
  services: Service[],
): Appointment[][] => {
  const serviceCategoryById = new Map(services.map((s) => [s.id, s.categoryId]));

  return groups.filter((group) => {
    const staffMatch =
      filters.staffId === 'ALL' || group.some((a) => a.staffId === filters.staffId);
    if (!staffMatch) return false;

    const categoryMatch =
      filters.categoryId === 'ALL' ||
      group.some((a) => serviceCategoryById.get(a.serviceId) === filters.categoryId);
    if (!categoryMatch) return false;

    const statusMatch =
      filters.status === 'ALL' || group.some((a) => a.status === filters.status);
    return statusMatch;
  });
};
