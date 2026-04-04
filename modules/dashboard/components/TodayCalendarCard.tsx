import React, { useMemo, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Appointment, AppointmentStatus, Service, ServiceCategory } from '../../../types';
import { layoutDayEvents, ROW_HEIGHT, HOURS, isSameDay } from '../../appointments/components/calendarUtils';
import { getCategoryCalendarColors } from '../../appointments/components/calendarColors';

interface TodayCalendarCardProps {
  appointments: Appointment[];
  services: Service[];
  serviceCategories: ServiceCategory[];
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getNowPosition(): number | null {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  if (hour < 8 || hour >= 21) return null;
  return ((hour - 8) * 60 + minutes) / 60 * ROW_HEIGHT;
}

export const TodayCalendarCard: React.FC<TodayCalendarCardProps> = ({
  appointments,
  services,
  serviceCategories,
}) => {
  const [nowPos, setNowPos] = useState<number | null>(getNowPosition);

  // Update "now" line every minute
  useEffect(() => {
    const interval = setInterval(() => setNowPos(getNowPosition()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return appointments.filter(a =>
      isSameDay(new Date(a.date), today) && a.status !== AppointmentStatus.CANCELLED
    );
  }, [appointments]);

  const positionedEvents = useMemo(() => layoutDayEvents(todayAppointments), [todayAppointments]);

  // Build service → category lookup
  const categoryByServiceId = useMemo(() => {
    const catMap = new Map<string, ServiceCategory>();
    for (const cat of serviceCategories) catMap.set(cat.id, cat);
    const map = new Map<string, ServiceCategory>();
    for (const svc of services) {
      const cat = catMap.get(svc.categoryId);
      if (cat) map.set(svc.id, cat);
    }
    return map;
  }, [services, serviceCategories]);

  const totalHeight = HOURS.length * ROW_HEIGHT;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <CalendarClock size={18} className="text-slate-400" />
          <h3 className="font-bold text-slate-800">Agenda du jour</h3>
          {todayAppointments.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {todayAppointments.length}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* Timeline */}
      {todayAppointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <CalendarClock size={32} className="mb-2 opacity-50" />
          <p className="text-sm">Aucun rendez-vous aujourd'hui</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[420px]">
          <div className="relative" style={{ height: totalHeight }}>
            {/* Hour grid lines + labels */}
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: i * ROW_HEIGHT }}
              >
                <span className="absolute -top-2.5 left-2 text-[10px] font-medium text-slate-300 bg-white px-1">
                  {hour}:00
                </span>
              </div>
            ))}

            {/* Event blocks */}
            <div className="absolute left-12 right-3 top-0 bottom-0">
              {positionedEvents.map(({ appointment, top, height, left, width }) => {
                const category = categoryByServiceId.get(appointment.serviceId);
                const colors = category ? getCategoryCalendarColors(category.color) : null;
                const isCompleted = appointment.status === AppointmentStatus.COMPLETED;
                const startDate = new Date(appointment.date);
                const endDate = new Date(startDate.getTime() + appointment.durationMinutes * 60000);

                return (
                  <div
                    key={appointment.id}
                    className={`
                      absolute rounded-md px-2 py-1 overflow-hidden border-l-[3px] transition-opacity
                      ${isCompleted
                        ? 'opacity-50 border-slate-300 bg-slate-50 text-slate-500'
                        : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'}`
                      }
                    `}
                    style={{ top, height: Math.max(height, 28), left, width }}
                  >
                    <div className="text-xs font-semibold truncate">{appointment.serviceName}</div>
                    {height >= 40 && (
                      <div className="text-[11px] opacity-75 truncate">
                        {formatTime(startDate)} – {formatTime(endDate)}
                      </div>
                    )}
                    {height >= 56 && (
                      <div className="text-[10px] opacity-60 truncate">
                        {appointment.clientName} · {appointment.staffName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Now indicator */}
            {nowPos !== null && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowPos }}>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-[2px] bg-red-500 opacity-70" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
