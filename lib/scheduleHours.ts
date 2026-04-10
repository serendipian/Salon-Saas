// lib/scheduleHours.ts
//
// Derive a calendar hour range from the salon's WorkSchedule. Used by the
// dashboard mini-calendar and the staff-availability hook to replace the
// previously hardcoded 9-20 / 9-23 ranges (M-24).

import type { WorkSchedule } from '../types';

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const DEFAULT_RANGE = { minHour: 9, maxHour: 20 };

export interface SalonHourRange {
  minHour: number;
  maxHour: number;
}

/**
 * Compute the calendar hour range from a WorkSchedule. Returns the earliest
 * open-time hour (floored) as `minHour` and the latest close-time hour
 * (ceiled if non-zero minutes) as `maxHour` across all open days.
 *
 * Falls back to 9-20 if the schedule is missing or has no open days, so the
 * UI never shows an empty calendar.
 *
 * Always returns at least a 1-hour range (`maxHour > minHour`).
 */
export function getSalonHourRange(schedule: WorkSchedule | undefined): SalonHourRange {
  if (!schedule) return DEFAULT_RANGE;

  let minHour = Infinity;
  let maxHour = -Infinity;

  for (const day of DAY_KEYS) {
    const d = schedule[day];
    if (!d?.isOpen || !d.start || !d.end) continue;

    const startH = parseInt(d.start.split(':')[0], 10);
    const [endHStr, endMStr] = d.end.split(':');
    const endH = parseInt(endHStr, 10);
    const endM = parseInt(endMStr ?? '0', 10);

    if (!Number.isNaN(startH) && startH < minHour) minHour = startH;
    if (!Number.isNaN(endH)) {
      // Ceil to the next whole hour if there are minutes (e.g., 19:30 → 20)
      const ceiledEnd = endM > 0 ? endH + 1 : endH;
      if (ceiledEnd > maxHour) maxHour = ceiledEnd;
    }
  }

  if (minHour === Infinity || maxHour === -Infinity || maxHour <= minHour) {
    return DEFAULT_RANGE;
  }

  return { minHour, maxHour };
}
