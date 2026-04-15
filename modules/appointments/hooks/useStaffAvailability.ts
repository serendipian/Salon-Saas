import { useMemo } from 'react';
import type { Appointment, StaffMember, WorkSchedule } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { getSalonHourRange } from '../../../lib/scheduleHours';

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Computes which hours are unavailable for a given staff member on a given date,
 * accounting for the staff's weekly schedule and existing appointments.
 *
 * The hour iteration range comes from the SALON's opening hours (M-24) — not
 * a hardcoded 9-20 — so salons that open earlier or close later see the right
 * window. Falls back to 9-20 if no schedule is configured.
 */
export function useStaffAvailability(
  staffMember: StaffMember | null,
  date: string | null,
  durationMinutes: number,
  existingAppointments: Appointment[],
): Set<number> {
  const { salonSettings } = useSettings();
  const { minHour, maxHour } = getSalonHourRange(salonSettings.schedule);

  return useMemo(() => {
    const unavailable = new Set<number>();

    // If no staff or no date, all hours are available
    if (!staffMember || !date) return unavailable;

    // Parse YYYY-MM-DD as local midnight (not UTC)
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0=Sunday
    const dayKey = DAY_KEYS[dayOfWeek];
    const schedule = staffMember.schedule?.[dayKey];

    // If staff doesn't work this day, all hours in the salon range are unavailable
    if (!schedule || !schedule.isOpen) {
      for (let h = minHour; h <= maxHour; h++) unavailable.add(h);
      return unavailable;
    }

    const workStart = parseTime(schedule.start);
    const workEnd = parseTime(schedule.end);

    // Get this staff's appointments on this date (compare in LOCAL time)
    const dayAppointments = existingAppointments
      .filter((a) => {
        if (a.staffId !== staffMember.id) return false;
        if (a.status === 'CANCELLED') return false;
        const d = new Date(a.date);
        const aLocalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return aLocalDate === date;
      })
      .map((a) => {
        const d = new Date(a.date);
        const startMin = d.getHours() * 60 + d.getMinutes();
        return { start: startMin, end: startMin + a.durationMinutes };
      })
      .sort((a, b) => a.start - b.start);

    // Check each hour slot — only mark unavailable if ALL 15-min slots are blocked
    for (let h = minHour; h <= maxHour; h++) {
      let allBlocked = true;
      for (const minute of [0, 15, 30, 45]) {
        const slotStart = h * 60 + minute;
        const slotEnd = slotStart + durationMinutes;

        // Outside working hours?
        if (slotStart < workStart || slotEnd > workEnd) continue;

        // Overlaps with existing appointment?
        const hasConflict = dayAppointments.some((a) => slotStart < a.end && slotEnd > a.start);
        if (!hasConflict) {
          allBlocked = false;
          break;
        }
      }
      if (allBlocked) unavailable.add(h);
    }

    return unavailable;
  }, [staffMember, date, durationMinutes, existingAppointments, minHour, maxHour]);
}
