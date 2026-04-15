import React from 'react';
import { Appointment, ServiceCategory } from '../../../types';
import { CalendarEventBlock } from './CalendarEventBlock';
import {
  isSameDay,
  isToday,
  formatHourLabel,
  layoutDayEvents,
  mergeAppointmentGroups,
  HOURS,
  ROW_HEIGHT,
} from './calendarUtils';

interface CalendarWeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: { id: string; categoryId: string }[];
  onEventClick: (appointment: Appointment, rect: DOMRect) => void;
}

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

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  appointments,
  serviceCategories,
  services,
  onEventClick,
}) => {
  const weekDays = getWeekDays(currentDate);
  const categoryMap = new Map(serviceCategories.map((c) => [c.id, c]));
  const serviceCatMap = new Map(services.map((s) => [s.id, s.categoryId]));

  const tzLabel =
    Intl.DateTimeFormat('fr-FR', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? '';

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
              className={`flex-1 text-center py-2 border-l border-slate-100 ${isSat ? 'text-blue-500' : 'text-slate-500'}`}
            >
              <div className="text-xs font-semibold uppercase">{DAYS_HEADER[i]}</div>
              <div
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mt-0.5 ${
                  today ? 'bg-blue-500 text-white' : ''
                }`}
              >
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
          {HOURS.map((hour) => (
            <div
              key={hour}
              style={{ height: ROW_HEIGHT }}
              className="text-right pr-3 text-xs text-slate-400 font-medium -mt-2"
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, dayIndex) => {
          const dayAppts = appointments.filter((a) => isSameDay(new Date(a.date), day));
          // M-13: merge multi-item service blocks into single visual events
          const mergedAppts = mergeAppointmentGroups(dayAppts);
          const positioned = layoutDayEvents(mergedAppts);

          return (
            <div key={dayIndex} className="flex-1 border-l border-slate-100 relative">
              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  style={{ height: ROW_HEIGHT }}
                  className="border-t border-dashed border-slate-200"
                />
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
