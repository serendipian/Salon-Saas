
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { CalendarClock, Check, Clock } from 'lucide-react';
import { Appointment, AppointmentStatus, Service, ServiceCategory, StaffMember } from '../../../types';
import { HOURS, isSameDay } from '../../appointments/components/calendarUtils';
import { getCategoryCalendarColors } from '../../appointments/components/calendarColors';
import { StaffAvatar } from '../../../components/StaffAvatar';

// --- Constants ---
const ROW_H = 72; // px per hour — taller for a more spacious feel
const HALF_HOUR_H = ROW_H / 2;

interface TodayCalendarCardProps {
  appointments: Appointment[];
  services: Service[];
  serviceCategories: ServiceCategory[];
  staff: StaffMember[];
}

function fmt(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getNowOffset(): number | null {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < 8 || h >= 21) return null;
  return ((h - 8) * 60 + m) / 60 * ROW_H;
}

/** Map staff Tailwind color class → inline hex for avatar fallback */
const COLOR_HEX: Record<string, string> = {
  rose: '#f43f5e', blue: '#3b82f6', emerald: '#10b981', purple: '#a855f7',
  pink: '#ec4899', amber: '#f59e0b', red: '#ef4444', cyan: '#06b6d4',
  indigo: '#6366f1', teal: '#14b8a6', slate: '#64748b',
};

function staffHex(color: string): string {
  const match = color.match(/bg-(\w+)-\d+/);
  return COLOR_HEX[match?.[1] ?? ''] ?? '#64748b';
}

/** Soft bg for staff column header from staff color */
const COLUMN_BG: Record<string, string> = {
  rose: 'bg-rose-50/60', blue: 'bg-blue-50/60', emerald: 'bg-emerald-50/60', purple: 'bg-purple-50/60',
  pink: 'bg-pink-50/60', amber: 'bg-amber-50/60', red: 'bg-red-50/60', cyan: 'bg-cyan-50/60',
  indigo: 'bg-indigo-50/60', teal: 'bg-teal-50/60', slate: 'bg-slate-50/60',
};

function staffColumnBg(color: string): string {
  const match = color.match(/bg-(\w+)-\d+/);
  return COLUMN_BG[match?.[1] ?? ''] ?? 'bg-slate-50/60';
}

export const TodayCalendarCard: React.FC<TodayCalendarCardProps> = ({
  appointments,
  services,
  serviceCategories,
  staff,
}) => {
  const [nowOffset, setNowOffset] = useState<number | null>(getNowOffset);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Tick every minute
  useEffect(() => {
    const id = setInterval(() => setNowOffset(getNowOffset()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current time on first render
  const scrollToCurrent = useCallback(() => {
    if (hasScrolled.current || !scrollRef.current || nowOffset === null) return;
    hasScrolled.current = true;
    scrollRef.current.scrollTo({ top: Math.max(nowOffset - 120, 0), behavior: 'smooth' });
  }, [nowOffset]);

  useEffect(() => { scrollToCurrent(); }, [scrollToCurrent]);

  const todayAppts = useMemo(() => {
    const today = new Date();
    return appointments.filter(a =>
      isSameDay(new Date(a.date), today) && a.status !== AppointmentStatus.CANCELLED
    );
  }, [appointments]);

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

  const staffColumns = useMemo(() => {
    const withAppts = new Set(todayAppts.map(a => a.staffId));
    const active = staff.filter(s => s.active && !s.deletedAt);
    const cols = active.filter(s => withAppts.has(s.id) || s.role === 'Stylist' || s.role === 'Manager');
    return cols.length > 0 ? cols : active.filter(s => withAppts.has(s.id));
  }, [staff, todayAppts]);

  const apptsByStaff = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    todayAppts.forEach(a => {
      const arr = m.get(a.staffId) || [];
      arr.push(a);
      m.set(a.staffId, arr);
    });
    return m;
  }, [todayAppts]);

  // Count completed / total for header summary
  const completedCount = useMemo(() => todayAppts.filter(a => a.status === AppointmentStatus.COMPLETED).length, [todayAppts]);

  const totalHeight = HOURS.length * ROW_H;
  const nowLabel = nowOffset !== null ? fmt(new Date()) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <CalendarClock size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm leading-tight">Agenda du jour</h3>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5 capitalize">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {todayAppts.length > 0 && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-lg">
                <Check size={12} />
                {completedCount}
              </span>
              <span className="flex items-center gap-1 text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-lg">
                <Clock size={12} />
                {todayAppts.length - completedCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {todayAppts.length === 0 && staffColumns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <CalendarClock size={40} strokeWidth={1.5} className="mb-3" />
          <p className="text-sm font-medium text-slate-400">Aucun rendez-vous aujourd'hui</p>
          <p className="text-xs text-slate-300 mt-1">Profitez de la pause !</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* ── Sticky staff headers ── */}
          <div className="flex border-b border-slate-100 bg-white sticky top-0 z-20">
            {/* Hour gutter */}
            <div className="w-[52px] shrink-0" />
            {staffColumns.map(s => {
              const count = (apptsByStaff.get(s.id) || []).length;
              const colBg = staffColumnBg(s.color);
              return (
                <div
                  key={s.id}
                  className={`flex-1 min-w-[160px] px-3 py-3 border-l border-slate-100/80 ${colBg}`}
                >
                  <div className="flex items-center gap-2">
                    <StaffAvatar
                      firstName={s.firstName}
                      lastName={s.lastName}
                      photoUrl={s.photoUrl}
                      color={staffHex(s.color)}
                      size={28}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate leading-tight">
                        {s.firstName}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        {count} rdv
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Scrollable grid ── */}
          <div ref={scrollRef} className="overflow-x-auto overflow-y-auto max-h-[520px] relative">
            <div className="flex relative" style={{ minHeight: totalHeight }}>
              {/* ── Hour gutter ── */}
              <div className="w-[52px] shrink-0 relative" style={{ height: totalHeight }}>
                {HOURS.map((hour, i) => (
                  <div key={hour} className="absolute left-0 right-0" style={{ top: i * ROW_H }}>
                    <span className="absolute right-2 -top-[6px] text-[10px] font-medium text-slate-300 tabular-nums select-none">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* ── Staff columns ── */}
              {staffColumns.map(s => {
                const staffAppts = apptsByStaff.get(s.id) || [];
                return (
                  <div
                    key={s.id}
                    className="flex-1 min-w-[160px] relative border-l border-slate-100/80"
                    style={{ height: totalHeight }}
                  >
                    {/* Hour + half-hour grid lines */}
                    {HOURS.map((hour, i) => (
                      <React.Fragment key={hour}>
                        {/* Full hour */}
                        <div
                          className="absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: i * ROW_H }}
                        />
                        {/* Half hour */}
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-slate-50"
                          style={{ top: i * ROW_H + HALF_HOUR_H }}
                        />
                      </React.Fragment>
                    ))}

                    {/* ── Appointment blocks ── */}
                    {staffAppts.map(appt => {
                      const start = new Date(appt.date);
                      const startMin = Math.max((start.getHours() - 8) * 60 + start.getMinutes(), 0);
                      const top = (startMin / 60) * ROW_H;
                      const maxMin = 13 * 60;
                      const dur = Math.min(appt.durationMinutes, maxMin - startMin);
                      const height = Math.max((dur / 60) * ROW_H, 28);

                      const cat = categoryByServiceId.get(appt.serviceId);
                      const colors = cat ? getCategoryCalendarColors(cat.color) : null;
                      const done = appt.status === AppointmentStatus.COMPLETED;
                      const end = new Date(start.getTime() + appt.durationMinutes * 60000);

                      return (
                        <div
                          key={appt.id}
                          className={`
                            absolute left-1.5 right-1.5 rounded-lg overflow-hidden
                            transition-all duration-200 cursor-default group/block
                            border-l-[3px]
                            ${done
                              ? 'border-slate-300 bg-slate-50/80 text-slate-400 hover:bg-slate-100/80'
                              : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'} hover:shadow-md hover:shadow-slate-200/50 hover:-translate-y-[1px]`
                            }
                          `}
                          style={{ top: top + 1, height: Math.max(height - 2, 26) }}
                          title={`${appt.serviceName} — ${appt.clientName}\n${fmt(start)} – ${fmt(end)}`}
                        >
                          <div className="px-2 py-1 h-full flex flex-col justify-center">
                            {/* Service name — always visible */}
                            <div className="flex items-center gap-1">
                              {done && <Check size={10} className="text-slate-400 shrink-0" />}
                              <span className={`text-[11px] font-semibold truncate leading-tight ${done ? 'line-through decoration-slate-300' : ''}`}>
                                {appt.serviceName}
                              </span>
                            </div>
                            {/* Time range */}
                            {height >= 40 && (
                              <div className="text-[10px] opacity-60 truncate leading-tight mt-0.5 tabular-nums">
                                {fmt(start)} – {fmt(end)}
                              </div>
                            )}
                            {/* Client name */}
                            {height >= 56 && (
                              <div className="text-[10px] font-medium opacity-50 truncate leading-tight mt-0.5">
                                {appt.clientName}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ── Now indicator ── */}
              {nowOffset !== null && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: nowOffset }}
                >
                  <div className="flex items-center">
                    {/* Time label */}
                    <div className="w-[52px] shrink-0 flex justify-end pr-1.5">
                      <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 py-[1px] rounded tabular-nums">
                        {nowLabel}
                      </span>
                    </div>
                    {/* Dot + line */}
                    <div className="flex-1 flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-[0_0_0_3px_rgba(239,68,68,0.15)] animate-pulse" />
                      <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 to-red-500/0" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
