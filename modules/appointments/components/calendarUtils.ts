import { type Appointment, AppointmentStatus } from '../../../types';

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * M-13: Merge multi-item service blocks into a single visual event for the
 * calendar. A multi-item block persists as N consecutive appointment rows
 * sharing the same `groupId`. The list view groups them, but each calendar
 * view used to render N separate tiles, breaking visual contiguity and
 * making the popover/click handler operate on a single sub-item instead of
 * the whole block.
 *
 * This helper folds same-groupId rows into one synthetic Appointment with:
 *   - id        = the first sub-appointment's id (so click → edit/details
 *                 still routes correctly; the edit page already resolves the
 *                 full group from any member id via `groupId`)
 *   - date      = the earliest start (chronological sort guarantees first)
 *   - durationMinutes = sum of all sub-durations (same-staff invariant means
 *                 they're back-to-back, so sum == span)
 *   - serviceName = "N prestations · Coupe, Brushing, …" for groups, or the
 *                   single service name for ungrouped rows
 *   - price     = sum of all sub-prices
 *   - status    = derived: COMPLETED if all are completed, CANCELLED if any
 *                 is cancelled, NO_SHOW if any is no-show, otherwise the
 *                 first sub-appointment's status
 *
 * Appointments without a groupId pass through unchanged.
 */
function mergeStatuses(statuses: AppointmentStatus[]): AppointmentStatus {
  if (statuses.every((s) => s === AppointmentStatus.COMPLETED)) return AppointmentStatus.COMPLETED;
  if (statuses.some((s) => s === AppointmentStatus.CANCELLED)) return AppointmentStatus.CANCELLED;
  if (statuses.some((s) => s === AppointmentStatus.NO_SHOW)) return AppointmentStatus.NO_SHOW;
  if (statuses.some((s) => s === AppointmentStatus.IN_PROGRESS))
    return AppointmentStatus.IN_PROGRESS;
  return statuses[0] ?? AppointmentStatus.SCHEDULED;
}

export function mergeAppointmentGroups(appointments: Appointment[]): Appointment[] {
  const groups = new Map<string, Appointment[]>();
  const ungrouped: Appointment[] = [];

  for (const appt of appointments) {
    if (appt.groupId) {
      const arr = groups.get(appt.groupId) ?? [];
      arr.push(appt);
      groups.set(appt.groupId, arr);
    } else {
      ungrouped.push(appt);
    }
  }

  const merged: Appointment[] = [...ungrouped];

  for (const [, items] of groups) {
    if (items.length === 1) {
      merged.push(items[0]);
      continue;
    }

    const sorted = [...items].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const first = sorted[0];
    const totalDuration = sorted.reduce((sum, a) => sum + (a.durationMinutes ?? 0), 0);
    const totalPrice = sorted.reduce((sum, a) => sum + (a.price ?? 0), 0);
    const serviceNames = sorted.map((a) => a.serviceName).filter(Boolean);
    const label = `${sorted.length} prestations · ${serviceNames.join(', ')}`;

    merged.push({
      ...first,
      durationMinutes: totalDuration,
      price: totalPrice,
      serviceName: label,
      status: mergeStatuses(sorted.map((a) => a.status)),
    });
  }

  return merged;
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

export interface PositionedEvent {
  appointment: Appointment;
  top: number;
  height: number;
  left: string;
  width: string;
}

export const ROW_HEIGHT = 64;
export const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

export function layoutDayEvents(dayAppointments: Appointment[]): PositionedEvent[] {
  if (dayAppointments.length === 0) return [];

  const sorted = [...dayAppointments].sort((a, b) => {
    const aStart = new Date(a.date).getTime();
    const bStart = new Date(b.date).getTime();
    if (aStart !== bStart) return aStart - bStart;
    return b.durationMinutes - a.durationMinutes;
  });

  const columns: Appointment[][] = [];
  for (const appt of sorted) {
    const apptStart = new Date(appt.date).getTime();
    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      const lastEnd = new Date(lastInCol.date).getTime() + lastInCol.durationMinutes * 60000;
      if (apptStart >= lastEnd) {
        col.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([appt]);
  }

  const totalCols = columns.length;
  return sorted.map((appt) => {
    const colIndex = columns.findIndex((col) => col.includes(appt));
    const startDate = new Date(appt.date);
    const startMinutes = Math.max((startDate.getHours() - 8) * 60 + startDate.getMinutes(), 0);
    const top = (startMinutes / 60) * ROW_HEIGHT;
    const maxMinutes = 13 * 60; // 8 AM to 8 PM = 780 minutes
    const clampedDuration = Math.min(appt.durationMinutes, maxMinutes - startMinutes);
    const height = Math.max((clampedDuration / 60) * ROW_HEIGHT, 20);

    return {
      appointment: appt,
      top,
      height,
      left: `${(colIndex / totalCols) * 100}%`,
      width: `${(1 / totalCols) * 100}%`,
    };
  });
}
