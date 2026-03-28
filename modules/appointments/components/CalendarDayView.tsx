import React from 'react';
import { Appointment, ServiceCategory, AppointmentStatus } from '../../../types';
import { CalendarEventBlock } from './CalendarEventBlock';

interface CalendarDayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: { id: string; categoryId: string }[];
  onEventClick: (appointment: Appointment, rect: DOMRect) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM
const ROW_HEIGHT = 64; // px per hour

const DAYS_FR_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

interface PositionedEvent {
  appointment: Appointment;
  top: number;
  height: number;
  left: string;
  width: string;
}

function layoutEvents(dayAppointments: Appointment[]): PositionedEvent[] {
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
    const apptEnd = apptStart + appt.durationMinutes * 60000;

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
    if (!placed) {
      columns.push([appt]);
    }
  }

  const totalCols = columns.length;

  return sorted.map(appt => {
    const colIndex = columns.findIndex(col => col.includes(appt));
    const startDate = new Date(appt.date);
    const startMinutes = (startDate.getHours() - 8) * 60 + startDate.getMinutes();
    const top = (startMinutes / 60) * ROW_HEIGHT;
    const height = Math.max((appt.durationMinutes / 60) * ROW_HEIGHT, 20);

    return {
      appointment: appt,
      top,
      height,
      left: `${(colIndex / totalCols) * 100}%`,
      width: `${(1 / totalCols) * 100}%`,
    };
  });
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  currentDate,
  appointments,
  serviceCategories,
  services,
  onEventClick,
}) => {
  const dayAppointments = appointments.filter(appt => isSameDay(new Date(appt.date), currentDate));
  const positioned = layoutEvents(dayAppointments);

  const categoryMap = new Map(serviceCategories.map(c => [c.id, c]));
  const serviceCatMap = new Map(services.map(s => [s.id, s.categoryId]));

  const todayFlag = isToday(currentDate);

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Day header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
        <span className="text-3xl font-bold text-slate-900">{currentDate.getDate()}</span>
        <span className="text-sm font-medium text-slate-500 uppercase">{DAYS_FR_SHORT[currentDate.getDay()]}</span>
        {todayFlag && (
          <span className="px-2.5 py-0.5 bg-pink-500 text-white text-xs font-semibold rounded-full">
            Aujourd'hui
          </span>
        )}
      </div>

      {/* Time grid */}
      <div className="relative">
        {HOURS.map(hour => (
          <div key={hour} className="flex" style={{ height: ROW_HEIGHT }}>
            <div className="w-16 flex-shrink-0 text-right pr-3 pt-0 text-xs text-slate-400 font-medium -mt-2">
              {formatHourLabel(hour)}
            </div>
            <div className="flex-1 border-t border-dashed border-slate-200 relative" />
          </div>
        ))}

        {/* Event blocks overlaid on the grid */}
        <div className="absolute top-0 left-16 right-0 bottom-0">
          {positioned.map(({ appointment, top, height, left, width }) => {
            const catId = serviceCatMap.get(appointment.serviceId);
            const category = catId ? categoryMap.get(catId) : undefined;
            return (
              <CalendarEventBlock
                key={appointment.id}
                appointment={appointment}
                category={category}
                style={{ top, height, left, width, position: 'absolute' }}
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onEventClick(appointment, rect);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
