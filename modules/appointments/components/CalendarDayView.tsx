import React from 'react';
import { Appointment, ServiceCategory } from '../../../types';
import { CalendarEventBlock } from './CalendarEventBlock';
import { isSameDay, isToday, formatHourLabel, layoutDayEvents, mergeAppointmentGroups, HOURS, ROW_HEIGHT } from './calendarUtils';

interface CalendarDayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: { id: string; categoryId: string }[];
  onEventClick: (appointment: Appointment, rect: DOMRect) => void;
}

const DAYS_FR_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  currentDate,
  appointments,
  serviceCategories,
  services,
  onEventClick,
}) => {
  const dayAppointments = appointments.filter(appt => isSameDay(new Date(appt.date), currentDate));
  // M-13: collapse multi-item service blocks into a single visual event so the
  // calendar matches the list-view grouping. Each merged event keeps the first
  // sub-appointment's id, so click → edit/details still routes correctly.
  const mergedAppointments = mergeAppointmentGroups(dayAppointments);
  const positioned = layoutDayEvents(mergedAppointments);

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
          <span className="px-2.5 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded-full">
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
