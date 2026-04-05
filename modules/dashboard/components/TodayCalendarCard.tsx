
import React, { useMemo, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Appointment, AppointmentStatus, Service, ServiceCategory, StaffMember } from '../../../types';
import { ROW_HEIGHT, HOURS, isSameDay } from '../../appointments/components/calendarUtils';
import { getCategoryCalendarColors } from '../../appointments/components/calendarColors';

interface TodayCalendarCardProps {
  appointments: Appointment[];
  services: Service[];
  serviceCategories: ServiceCategory[];
  staff: StaffMember[];
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

/** Extract Tailwind color name from class like "bg-rose-100 text-rose-800" → "rose" */
function extractStaffColor(color: string): string {
  const match = color.match(/bg-(\w+)-\d+/);
  return match?.[1] ?? 'slate';
}

/** Staff column header color chip */
const HEADER_COLORS: Record<string, string> = {
  rose: 'bg-rose-200', blue: 'bg-blue-200', emerald: 'bg-emerald-200', purple: 'bg-purple-200',
  pink: 'bg-pink-200', amber: 'bg-amber-200', red: 'bg-red-200', cyan: 'bg-cyan-200',
  indigo: 'bg-indigo-200', teal: 'bg-teal-200', slate: 'bg-slate-200',
};

export const TodayCalendarCard: React.FC<TodayCalendarCardProps> = ({
  appointments,
  services,
  serviceCategories,
  staff,
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

  // Determine which staff members have appointments today (or are active stylists)
  const staffColumns = useMemo(() => {
    const staffWithAppointments = new Set(todayAppointments.map(a => a.staffId));
    // Show active staff who are stylists/managers with appointments, plus any staff with appointments
    const activeStaff = staff.filter(s => s.active && !s.deletedAt);
    const columns = activeStaff.filter(s =>
      staffWithAppointments.has(s.id) || s.role === 'Stylist' || s.role === 'Manager'
    );
    // If no columns, just show staff with appointments
    if (columns.length === 0) {
      return activeStaff.filter(s => staffWithAppointments.has(s.id));
    }
    return columns;
  }, [staff, todayAppointments]);

  // Group appointments by staff
  const appointmentsByStaff = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    todayAppointments.forEach(a => {
      const list = map.get(a.staffId) || [];
      list.push(a);
      map.set(a.staffId, list);
    });
    return map;
  }, [todayAppointments]);

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
        <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
          {/* Staff column headers */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-slate-100">
            {/* Hour label spacer */}
            <div className="w-14 shrink-0" />
            {/* Staff headers */}
            {staffColumns.map(s => {
              const colorName = extractStaffColor(s.color);
              const chipClass = HEADER_COLORS[colorName] || 'bg-slate-200';
              const staffAppts = appointmentsByStaff.get(s.id) || [];
              return (
                <div
                  key={s.id}
                  className="flex-1 min-w-[140px] px-2 py-2.5 text-center border-l border-slate-100"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${chipClass} shrink-0`} />
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {s.firstName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({staffAppts.length})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div className="flex" style={{ minHeight: totalHeight }}>
            {/* Hour labels */}
            <div className="w-14 shrink-0 relative" style={{ height: totalHeight }}>
              {HOURS.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0"
                  style={{ top: i * ROW_HEIGHT }}
                >
                  <span className="absolute top-0 left-2 text-[10px] font-medium text-slate-300 leading-none -translate-y-1/2">
                    {hour}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Staff columns */}
            {staffColumns.map(s => {
              const staffAppts = appointmentsByStaff.get(s.id) || [];
              return (
                <div
                  key={s.id}
                  className="flex-1 min-w-[140px] relative border-l border-slate-100"
                  style={{ height: totalHeight }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((hour, i) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-slate-50"
                      style={{ top: i * ROW_HEIGHT }}
                    />
                  ))}

                  {/* Appointment blocks */}
                  {staffAppts.map(appt => {
                    const startDate = new Date(appt.date);
                    const startMinutes = Math.max((startDate.getHours() - 8) * 60 + startDate.getMinutes(), 0);
                    const top = (startMinutes / 60) * ROW_HEIGHT;
                    const maxMinutes = 13 * 60;
                    const clampedDuration = Math.min(appt.durationMinutes, maxMinutes - startMinutes);
                    const height = Math.max((clampedDuration / 60) * ROW_HEIGHT, 24);

                    const category = categoryByServiceId.get(appt.serviceId);
                    const colors = category ? getCategoryCalendarColors(category.color) : null;
                    const isCompleted = appt.status === AppointmentStatus.COMPLETED;
                    const endDate = new Date(startDate.getTime() + appt.durationMinutes * 60000);

                    return (
                      <div
                        key={appt.id}
                        className={`
                          absolute left-1 right-1 rounded-md px-1.5 py-1 overflow-hidden border-l-[3px] transition-opacity
                          ${isCompleted
                            ? 'opacity-50 border-slate-300 bg-slate-50 text-slate-500'
                            : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'}`
                          }
                        `}
                        style={{ top, height: Math.max(height, 24) }}
                        title={`${appt.serviceName} — ${appt.clientName}\n${formatTime(startDate)} – ${formatTime(endDate)}`}
                      >
                        <div className="text-[11px] font-semibold truncate leading-tight">{appt.serviceName}</div>
                        {height >= 36 && (
                          <div className="text-[10px] opacity-75 truncate leading-tight">
                            {formatTime(startDate)} – {formatTime(endDate)}
                          </div>
                        )}
                        {height >= 52 && (
                          <div className="text-[10px] opacity-60 truncate leading-tight">
                            {appt.clientName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Now indicator — spans across all columns */}
            {nowPos !== null && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: nowPos }}
              >
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
