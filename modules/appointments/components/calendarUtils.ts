import { Appointment } from '../../../types';

export function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
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
  return sorted.map(appt => {
    const colIndex = columns.findIndex(col => col.includes(appt));
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
