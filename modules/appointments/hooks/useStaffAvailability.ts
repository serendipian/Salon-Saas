import { useMemo } from 'react';
import type { Appointment, StaffMember, WorkSchedule } from '../../../types';

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Computes which hours are unavailable for a given staff member on a given date,
 * accounting for the staff's weekly schedule and existing appointments.
 */
export function useStaffAvailability(
  staffMember: StaffMember | null,
  date: string | null,
  durationMinutes: number,
  existingAppointments: Appointment[],
): Set<number> {
  return useMemo(() => {
    const unavailable = new Set<number>();

    // If no staff or no date, all hours are available
    if (!staffMember || !date) return unavailable;

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Sunday
    const dayKey = DAY_KEYS[dayOfWeek];
    const schedule = staffMember.schedule?.[dayKey];

    // If staff doesn't work this day, all hours unavailable
    if (!schedule || !schedule.isOpen) {
      for (let h = 9; h <= 20; h++) unavailable.add(h);
      return unavailable;
    }

    const workStart = parseTime(schedule.start);
    const workEnd = parseTime(schedule.end);

    // Get this staff's appointments on this date
    const dayAppointments = existingAppointments
      .filter((a) => {
        if (a.staffId !== staffMember.id) return false;
        if (a.status === 'CANCELLED') return false;
        const aDate = a.date.split('T')[0];
        return aDate === date;
      })
      .map((a) => {
        const d = new Date(a.date);
        const startMin = d.getHours() * 60 + d.getMinutes();
        return { start: startMin, end: startMin + a.durationMinutes };
      })
      .sort((a, b) => a.start - b.start);

    // Check each hour slot — only mark unavailable if ALL 15-min slots are blocked
    for (let h = 9; h <= 20; h++) {
      let allBlocked = true;
      for (const minute of [0, 15, 30, 45]) {
        const slotStart = h * 60 + minute;
        const slotEnd = slotStart + durationMinutes;

        // Outside working hours?
        if (slotStart < workStart || slotEnd > workEnd) continue;

        // Overlaps with existing appointment?
        const hasConflict = dayAppointments.some(
          (a) => slotStart < a.end && slotEnd > a.start,
        );
        if (!hasConflict) {
          allBlocked = false;
          break;
        }
      }
      if (allBlocked) unavailable.add(h);
    }

    return unavailable;
  }, [staffMember, date, durationMinutes, existingAppointments]);
}
