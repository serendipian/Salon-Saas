import React from 'react';
import { Appointment, ServiceCategory } from '../../../types';
import { CalendarEventBlock } from './CalendarEventBlock';

interface CalendarWeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: { id: string; categoryId: string }[];
  onEventClick: (appointment: Appointment, rect: DOMRect) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const ROW_HEIGHT = 64;
const DAYS_HEADER = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

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

function layoutDayEvents(dayAppointments: Appointment[]): PositionedEvent[] {
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
    const startMinutes = (startDate.getHours() - 8) * 60 + startDate.getMinutes();
    return {
      appointment: appt,
      top: (startMinutes / 60) * ROW_HEIGHT,
      height: Math.max((appt.durationMinutes / 60) * ROW_HEIGHT, 20),
      left: `${(colIndex / totalCols) * 100}%`,
      width: `${(1 / totalCols) * 100}%`,
    };
  });
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  appointments,
  serviceCategories,
  services,
  onEventClick,
}) => {
  const weekDays = getWeekDays(currentDate);
  const categoryMap = new Map(serviceCategories.map(c => [c.id, c]));
  const serviceCatMap = new Map(services.map(s => [s.id, s.categoryId]));

  const tzLabel = Intl.DateTimeFormat('fr-FR', { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find(p => p.type === 'timeZoneName')?.value ?? '';

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Column headers */}
      <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="w-16 flex-shrink-0 text-right pr-3 py-2 text-[10px] text-slate-400 font-medium">
          {tzLabel}
        </div>
        {weekDays.map((day, i) => {
          const today = isToday(day);
          const isSat = day.getDay() === 6;
          return (
            <div
              key={i}
              className={`flex-1 text-center py-2 border-l border-slate-100 ${isSat ? 'text-pink-500' : 'text-slate-500'}`}
            >
              <div className="text-xs font-semibold uppercase">{DAYS_HEADER[i]}</div>
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mt-0.5 ${
                today ? 'bg-pink-500 text-white' : ''
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex">
        {/* Hour labels */}
        <div className="w-16 flex-shrink-0">
          {HOURS.map(hour => (
            <div key={hour} style={{ height: ROW_HEIGHT }} className="text-right pr-3 text-xs text-slate-400 font-medium -mt-2">
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, dayIndex) => {
          const dayAppts = appointments.filter(a => isSameDay(new Date(a.date), day));
          const positioned = layoutDayEvents(dayAppts);

          return (
            <div key={dayIndex} className="flex-1 border-l border-slate-100 relative">
              {/* Hour rows */}
              {HOURS.map(hour => (
                <div key={hour} style={{ height: ROW_HEIGHT }} className="border-t border-dashed border-slate-200" />
              ))}

              {/* Events */}
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
          );
        })}
      </div>
    </div>
  );
};
