
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Check, Clock, User, Scissors, Tag, X, StickyNote, Filter } from 'lucide-react';
import { Appointment, AppointmentStatus, Service, ServiceCategory, StaffMember } from '../../../types';
import { isSameDay } from '../../appointments/components/calendarUtils';
import { StatusBadge } from '../../appointments/components/StatusBadge';
import { StaffAvatar } from '../../../components/StaffAvatar';
import { formatPrice } from '../../../lib/format';

// --- Constants ---
const CALENDAR_HOURS = Array.from({ length: 15 }, (_, i) => i + 9); // 9h to 23h
const ROW_H = 48;
const HALF_HOUR_H = ROW_H / 2;
const START_HOUR = 9;
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD = 5; // px before drag starts

interface TodayCalendarCardProps {
  appointments: Appointment[];
  services: Service[];
  serviceCategories: ServiceCategory[];
  staff: StaffMember[];
  onUpdateAppointment?: (appt: Appointment) => void;
}

function fmt(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) + START_HOUR;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getNowOffset(): number | null {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < 9 || h >= 23) return null;
  return ((h - 9) * 60 + m) / 60 * ROW_H;
}

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

// Blue-only palette for dashboard calendar (staff columns cycle through shades)
const BLUE_HEX_PALETTE = [
  '#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd',
  '#1e40af', '#7dd3fc', '#0ea5e9', '#38bdf8', '#0284c7',
];

const BLUE_BG_PALETTE = [
  'bg-blue-50/60', 'bg-blue-100/40', 'bg-sky-50/60', 'bg-indigo-50/40', 'bg-blue-50/40',
  'bg-sky-100/40', 'bg-blue-100/30', 'bg-sky-50/40', 'bg-indigo-50/30', 'bg-blue-50/50',
];

function staffHexByIndex(index: number): string {
  return BLUE_HEX_PALETTE[index % BLUE_HEX_PALETTE.length];
}

function staffColumnBgByIndex(index: number): string {
  return BLUE_BG_PALETTE[index % BLUE_BG_PALETTE.length];
}

// Blue-only appointment block colors (override category colors on dashboard)
const BLUE_BLOCK = {
  bg: 'bg-blue-50',
  border: 'border-blue-400',
  text: 'text-blue-800',
};

// ── Drag state ──────────────────────────────────────────

interface DragState {
  appointment: Appointment;
  offsetY: number; // pointer offset within the block
  startX: number;
  startY: number;
  isDragging: boolean; // becomes true after threshold
  ghostTop: number;
  ghostStaffIdx: number;
}

// ── Popover ──────────────────────────────────────────────

interface PopoverState {
  appointment: Appointment;
  rect: DOMRect;
}

const AppointmentPopover: React.FC<{
  appointment: Appointment;
  anchorRect: DOMRect;
  onClose: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
}> = ({ appointment, anchorRect, onClose, onViewDetails, onEdit }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Fixed positioning relative to viewport using anchorRect (which is viewport-relative)
  const popoverWidth = 280;

  // Prefer right of block, fall back to left
  let left = anchorRect.right + 8;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = anchorRect.left - popoverWidth - 8;
  }
  left = Math.max(8, left);

  // Vertically align to top of block, shift up if it overflows bottom
  const spaceBelow = window.innerHeight - anchorRect.top;
  const showAbove = spaceBelow < 280;

  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    zIndex: 50,
    ...(showAbove
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.top }),
  };

  const start = new Date(appointment.date);
  const end = new Date(start.getTime() + appointment.durationMinutes * 60000);

  return (
    <div ref={ref} style={style} className="w-[280px] bg-white rounded-xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">{appointment.serviceName}</h4>
            {appointment.variantName && (
              <span className="text-[11px] text-slate-400">{appointment.variantName}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={appointment.status} />
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
          <Clock size={14} className="text-slate-400 shrink-0" />
          <span className="tabular-nums">{fmt(start)} – {fmt(end)}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">{appointment.durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
          <User size={14} className="text-slate-400 shrink-0" />
          <span className="truncate">{appointment.clientName}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
          <Scissors size={14} className="text-slate-400 shrink-0" />
          <span className="truncate">{appointment.staffName}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <Tag size={14} className="text-slate-400 shrink-0" />
          <span className="font-semibold text-blue-600">{formatPrice(appointment.price)}</span>
        </div>
        {appointment.notes && (
          <div className="flex items-start gap-2.5 text-[13px] text-slate-500">
            <StickyNote size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2 italic">{appointment.notes}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={onViewDetails}
          className="flex-1 px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
        >
          Voir détails
        </button>
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Modifier
        </button>
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────

export const TodayCalendarCard: React.FC<TodayCalendarCardProps> = ({
  appointments,
  services,
  serviceCategories,
  staff,
  onUpdateAppointment,
}) => {
  const navigate = useNavigate();
  const [nowOffset, setNowOffset] = useState<number | null>(getNowOffset);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
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
    scrollRef.current.scrollTo({ top: Math.max(nowOffset - 80, 0), behavior: 'smooth' });
  }, [nowOffset]);

  useEffect(() => { scrollToCurrent(); }, [scrollToCurrent]);

  const handleBlockClick = useCallback((appt: Appointment, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ appointment: appt, rect });
  }, []);

  // Build a set of service IDs that belong to the selected category
  const categoryServiceIds = useMemo(() => {
    if (!selectedCategory) return null;
    return new Set(services.filter(s => s.categoryId === selectedCategory).map(s => s.id));
  }, [selectedCategory, services]);

  const todayAppts = useMemo(() => {
    const today = new Date();
    return appointments.filter(a => {
      if (!isSameDay(new Date(a.date), today)) return false;
      if (a.status === AppointmentStatus.CANCELLED) return false;
      if (categoryServiceIds && !categoryServiceIds.has(a.serviceId)) return false;
      return true;
    });
  }, [appointments, categoryServiceIds]);

  // Only show staff who have at least one appointment (after filtering)
  const staffColumns = useMemo(() => {
    const withAppts = new Set(todayAppts.map(a => a.staffId));
    const active = staff.filter(s => s.active && !s.deletedAt && withAppts.has(s.id));
    return active;
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

  const completedCount = useMemo(() => todayAppts.filter(a => a.status === AppointmentStatus.COMPLETED).length, [todayAppts]);

  // Categories that have appointments today (for filter options)
  const availableCategories = useMemo(() => {
    const today = new Date();
    const todayAllAppts = appointments.filter(a =>
      isSameDay(new Date(a.date), today) && a.status !== AppointmentStatus.CANCELLED
    );
    const catIds = new Set<string>();
    todayAllAppts.forEach(a => {
      const svc = services.find(s => s.id === a.serviceId);
      if (svc?.categoryId) catIds.add(svc.categoryId);
    });
    return serviceCategories.filter(c => catIds.has(c.id));
  }, [appointments, services, serviceCategories]);

  // ── Drag & Drop logic ──

  const findStaffIndexAtX = useCallback((clientX: number): number => {
    let closest = 0;
    let closestDist = Infinity;
    staffColumns.forEach((s, idx) => {
      const el = columnRefs.current.get(s.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = idx;
      }
    });
    return closest;
  }, [staffColumns]);

  const calcMinutesFromY = useCallback((clientY: number): number => {
    if (!gridRef.current) return 0;
    const gridRect = gridRef.current.getBoundingClientRect();
    const relY = clientY - gridRect.top + (scrollRef.current?.scrollTop ?? 0);
    const rawMinutes = (relY / ROW_H) * 60;
    return snapToGrid(Math.max(0, Math.min(rawMinutes, CALENDAR_HOURS.length * 60 - SNAP_MINUTES)));
  }, []);

  const handlePointerDown = useCallback((appt: Appointment, e: React.PointerEvent<HTMLDivElement>) => {
    if (!onUpdateAppointment) return;
    if (appt.status === AppointmentStatus.COMPLETED) return;

    const blockRect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - blockRect.top;

    const staffIdx = staffColumns.findIndex(s => s.id === appt.staffId);
    const startDate = new Date(appt.date);
    const startMin = Math.max((startDate.getHours() - START_HOUR) * 60 + startDate.getMinutes(), 0);
    const ghostTop = (startMin / 60) * ROW_H;

    setDrag({
      appointment: appt,
      offsetY,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      ghostTop,
      ghostStaffIdx: staffIdx >= 0 ? staffIdx : 0,
    });

    e.currentTarget.setPointerCapture(e.pointerId);
  }, [onUpdateAppointment, staffColumns]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!drag.isDragging && dist < DRAG_THRESHOLD) return;

    const minutes = calcMinutesFromY(e.clientY - drag.offsetY);
    const staffIdx = findStaffIndexAtX(e.clientX);
    const newTop = (minutes / 60) * ROW_H;

    setDrag(prev => prev ? { ...prev, isDragging: true, ghostTop: newTop, ghostStaffIdx: staffIdx } : null);
  }, [drag, calcMinutesFromY, findStaffIndexAtX]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;

    if (drag.isDragging && onUpdateAppointment) {
      const minutes = calcMinutesFromY(e.clientY - drag.offsetY);
      const staffIdx = findStaffIndexAtX(e.clientX);
      const targetStaff = staffColumns[staffIdx];

      if (targetStaff) {
        const today = new Date();
        const newHour = Math.floor(minutes / 60) + START_HOUR;
        const newMin = minutes % 60;
        const newDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), newHour, newMin, 0, 0);

        const oldDate = new Date(drag.appointment.date);
        const hasChanged = newDate.getTime() !== oldDate.getTime() || targetStaff.id !== drag.appointment.staffId;

        if (hasChanged) {
          onUpdateAppointment({
            ...drag.appointment,
            date: newDate.toISOString(),
            staffId: targetStaff.id,
            staffName: `${targetStaff.firstName} ${targetStaff.lastName}`.trim(),
          });
        }
      }
    }

    setDrag(null);
  }, [drag, onUpdateAppointment, calcMinutesFromY, findStaffIndexAtX, staffColumns]);

  const handlePointerCancel = useCallback(() => {
    setDrag(null);
  }, []);

  // Ghost preview info
  const ghostInfo = useMemo(() => {
    if (!drag?.isDragging) return null;
    const topPx = drag.ghostTop;
    const minutes = (topPx / ROW_H) * 60;
    const snapped = snapToGrid(minutes);
    const timeLabel = fmtMinutes(snapped);
    const endLabel = fmtMinutes(snapped + drag.appointment.durationMinutes);
    const targetStaff = staffColumns[drag.ghostStaffIdx];
    return { topPx, timeLabel, endLabel, targetStaff, snappedMinutes: snapped };
  }, [drag, staffColumns]);

  const totalHeight = CALENDAR_HOURS.length * ROW_H;
  const nowLabel = nowOffset !== null ? fmt(new Date()) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden relative">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
        <h3 className="font-bold text-slate-800 capitalize">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h3>
        <div className="flex items-center gap-2">
          {/* Category filter */}
          {availableCategories.length > 0 && (
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="appearance-none text-[11px] font-medium pl-6 pr-5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
              >
                <option value="">Toutes catégories</option>
                {availableCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Filter size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          {todayAppts.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-lg">
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
        <div
          ref={scrollRef}
          className={`overflow-x-auto overflow-y-auto max-h-[560px] relative ${drag?.isDragging ? 'select-none' : ''}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {/* ── Sticky staff headers ── */}
          <div className="flex border-b border-slate-100 bg-white sticky top-0 z-20">
            <div className="w-[52px] shrink-0" />
            {staffColumns.map((s, sIdx) => {
              const count = (apptsByStaff.get(s.id) || []).length;
              const colBg = staffColumnBgByIndex(sIdx);
              const isDropTarget = drag?.isDragging && drag.ghostStaffIdx === sIdx;
              return (
                <div
                  key={s.id}
                  className={`flex-1 min-w-[140px] px-2 py-2 border-l border-slate-100/80 transition-colors duration-150 ${colBg} ${isDropTarget ? '!bg-blue-100/60' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <StaffAvatar
                      firstName={s.firstName}
                      lastName={s.lastName}
                      photoUrl={s.photoUrl}
                      color={staffHexByIndex(sIdx)}
                      size={24}
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

          {/* ── Grid body ── */}
          <div ref={gridRef} className="flex relative" style={{ minHeight: totalHeight }}>
              {/* ── Hour gutter ── */}
              <div className="w-[52px] shrink-0 relative" style={{ height: totalHeight }}>
                {CALENDAR_HOURS.map((hour, i) => (
                  <div key={hour} className="absolute left-0 right-0" style={{ top: i * ROW_H }}>
                    <span className="absolute right-2 -top-[6px] text-[10px] font-medium text-slate-300 tabular-nums select-none">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* ── Staff columns ── */}
              {staffColumns.map((s, sIdx) => {
                const staffAppts = apptsByStaff.get(s.id) || [];
                const isDropTarget = drag?.isDragging && drag.ghostStaffIdx === sIdx;
                return (
                  <div
                    key={s.id}
                    ref={(el) => { if (el) columnRefs.current.set(s.id, el); }}
                    className={`flex-1 min-w-[140px] relative border-l border-slate-100/80 transition-colors duration-150 ${isDropTarget ? 'bg-blue-50/30' : ''}`}
                    style={{ height: totalHeight }}
                  >
                    {CALENDAR_HOURS.map((hour, i) => (
                      <React.Fragment key={hour}>
                        <div
                          className="absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: i * ROW_H }}
                        />
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-slate-50"
                          style={{ top: i * ROW_H + HALF_HOUR_H }}
                        />
                      </React.Fragment>
                    ))}

                    {/* Ghost drop preview */}
                    {isDropTarget && ghostInfo && (
                      <div
                        className="absolute left-1.5 right-1.5 rounded-lg border-2 border-dashed border-blue-400 bg-blue-100/40 z-30 pointer-events-none flex items-center justify-center"
                        style={{
                          top: ghostInfo.topPx + 1,
                          height: Math.max((drag!.appointment.durationMinutes / 60) * ROW_H - 2, 20),
                        }}
                      >
                        <span className="text-[10px] font-semibold text-blue-600 tabular-nums">
                          {ghostInfo.timeLabel} – {ghostInfo.endLabel}
                        </span>
                      </div>
                    )}

                    {staffAppts.map(appt => {
                      const start = new Date(appt.date);
                      const startMin = Math.max((start.getHours() - START_HOUR) * 60 + start.getMinutes(), 0);
                      const top = (startMin / 60) * ROW_H;
                      const maxMin = CALENDAR_HOURS.length * 60;
                      const dur = Math.min(appt.durationMinutes, maxMin - startMin);
                      const height = Math.max((dur / 60) * ROW_H, 22);

                      const done = appt.status === AppointmentStatus.COMPLETED;
                      const end = new Date(start.getTime() + appt.durationMinutes * 60000);
                      const isSelected = popover?.appointment.id === appt.id;
                      const isBeingDragged = drag?.isDragging && drag.appointment.id === appt.id;

                      return (
                        <div
                          key={appt.id}
                          onClick={(e) => { if (!drag?.isDragging) handleBlockClick(appt, e); }}
                          onPointerDown={(e) => handlePointerDown(appt, e)}
                          className={`
                            absolute left-1.5 right-1.5 rounded-lg overflow-hidden
                            transition-all duration-200 group/block
                            border-l-[3px]
                            ${onUpdateAppointment && !done ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                            ${isBeingDragged ? 'opacity-30 scale-95' : ''}
                            ${isSelected ? 'ring-2 ring-blue-300/40 shadow-lg z-20' : ''}
                            ${done
                              ? 'border-slate-300 bg-slate-50/80 text-slate-400 hover:bg-slate-100/80'
                              : `${BLUE_BLOCK.border} ${BLUE_BLOCK.bg} ${BLUE_BLOCK.text} hover:shadow-md hover:shadow-blue-100/50 hover:-translate-y-[1px]`
                            }
                          `}
                          style={{ top: top + 1, height: Math.max(height - 2, 20), touchAction: 'none' }}
                        >
                          <div className="px-2 py-1 h-full flex flex-col justify-center">
                            <div className="flex items-center gap-1">
                              {done && <Check size={10} className="text-slate-400 shrink-0" />}
                              <span className={`text-[11px] font-semibold truncate leading-tight ${done ? 'line-through decoration-slate-300' : ''}`}>
                                {appt.serviceName}
                              </span>
                            </div>
                            {height >= 32 && (
                              <div className="text-[9px] opacity-60 truncate leading-tight tabular-nums">
                                {fmt(start)} – {fmt(end)}
                              </div>
                            )}
                            {height >= 44 && (
                              <div className="text-[9px] font-medium opacity-50 truncate leading-tight">
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
                    <div className="w-[52px] shrink-0 flex justify-end pr-1.5">
                      <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 py-[1px] rounded tabular-nums">
                        {nowLabel}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-[0_0_0_3px_rgba(239,68,68,0.15)] animate-pulse" />
                      <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 to-red-500/0" />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
      )}

      {/* ── Popover (fixed positioning, outside scroll container) ── */}
      {popover && !drag?.isDragging && (
        <AppointmentPopover
          appointment={popover.appointment}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onViewDetails={() => {
            setPopover(null);
            navigate(`/calendar/${popover.appointment.id}`);
          }}
          onEdit={() => {
            setPopover(null);
            navigate(`/calendar/${popover.appointment.id}/edit`);
          }}
        />
      )}
    </div>
  );
};
