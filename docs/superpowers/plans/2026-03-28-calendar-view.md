# Appointments Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Day/Week/Month calendar views to the appointments module, matching the provided screenshot design with pink theming, service category color coding, and filter sidebar.

**Architecture:** New `CalendarView` component replaces the list area when calendar mode is active. A `useCalendar` hook manages navigation state and filters. Nine new files under `modules/appointments/components/`, no new API queries — reuses existing `allAppointments` data. Category colors are mapped from Tailwind class strings to calendar-specific color tokens.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React icons

---

## File Structure

```
modules/appointments/
  components/
    CalendarView.tsx          — Layout container: sidebar + main calendar area
    CalendarHeader.tsx        — "Today" btn + prev/next + title + Day/Week/Month toggle
    CalendarDayView.tsx       — Single-day time grid with positioned event blocks
    CalendarWeekView.tsx      — 7-column time grid
    CalendarMonthView.tsx     — Month grid with compact event bars
    CalendarSidebar.tsx       — Mini calendar + category/staff filter checkboxes
    CalendarEventBlock.tsx    — Styled appointment block (shared by day/week views)
    CalendarEventPopover.tsx  — Click popover: details + action buttons
    useCalendar.ts            — Hook: currentDate, calendarView, navigation, filters
  AppointmentList.tsx         — Modified: add List/Calendar toggle
  AppointmentsModule.tsx      — Modified: pass new props for calendar view

types.ts                      — Modified: add 'CALENDAR' to ViewState
```

---

### Task 1: Add ViewState and useCalendar Hook

**Files:**
- Modify: `types.ts:324`
- Create: `modules/appointments/components/useCalendar.ts`

- [ ] **Step 1: Add CALENDAR to ViewState**

In `types.ts`, change line 324:

```typescript
// Before:
export type ViewState = 'LIST' | 'DETAILS' | 'ADD' | 'EDIT';

// After:
export type ViewState = 'LIST' | 'CALENDAR' | 'DETAILS' | 'ADD' | 'EDIT';
```

- [ ] **Step 2: Create useCalendar hook**

Create `modules/appointments/components/useCalendar.ts`:

```typescript
import { useState, useCallback, useMemo } from 'react';
import { Appointment, ServiceCategory, StaffMember } from '../../../types';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface UseCalendarReturn {
  currentDate: Date;
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  goToDate: (date: Date) => void;
  categoryFilters: Set<string>;
  staffFilters: Set<string>;
  toggleCategory: (id: string) => void;
  toggleStaff: (id: string) => void;
  filteredAppointments: Appointment[];
}

export function useCalendar(
  allAppointments: Appointment[],
  serviceCategories: ServiceCategory[],
  services: { id: string; categoryId: string }[],
  allStaff: StaffMember[]
): UseCalendarReturn {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  // Initialize filters with all IDs checked
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(
    () => new Set(serviceCategories.map(c => c.id))
  );
  const [staffFilters, setStaffFilters] = useState<Set<string>>(
    () => new Set(allStaff.map(s => s.id))
  );

  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  const goPrev = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'day') d.setDate(d.getDate() - 1);
      else if (viewMode === 'week') d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'day') d.setDate(d.getDate() + 1);
      else if (viewMode === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, [viewMode]);

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleStaff = useCallback((id: string) => {
    setStaffFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build a serviceId -> categoryId lookup
  const serviceCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.id, s.categoryId);
    return map;
  }, [services]);

  const filteredAppointments = useMemo(() => {
    return allAppointments.filter(appt => {
      const catId = serviceCategoryMap.get(appt.serviceId);
      if (catId && !categoryFilters.has(catId)) return false;
      if (!staffFilters.has(appt.staffId)) return false;
      return true;
    });
  }, [allAppointments, serviceCategoryMap, categoryFilters, staffFilters]);

  return {
    currentDate,
    viewMode,
    setViewMode,
    goToday,
    goPrev,
    goNext,
    goToDate,
    categoryFilters,
    staffFilters,
    toggleCategory,
    toggleStaff,
    filteredAppointments,
  };
}
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds (no components use CALENDAR yet, hook is unused but valid)

- [ ] **Step 4: Commit**

```bash
git add types.ts modules/appointments/components/useCalendar.ts
git commit -m "feat: add CALENDAR ViewState and useCalendar hook"
```

---

### Task 2: Calendar Color Utilities

**Files:**
- Create: `modules/appointments/components/calendarColors.ts`

The existing `ServiceCategory.color` is a Tailwind class string like `"bg-blue-100 text-blue-800 border-blue-200"`. Calendar event blocks need: (a) a left border color, (b) a light background, (c) a text color. We extract the color base from the class string and map it to calendar-specific tokens.

- [ ] **Step 1: Create calendarColors.ts**

Create `modules/appointments/components/calendarColors.ts`:

```typescript
/**
 * Maps a ServiceCategory.color Tailwind class string to calendar event styles.
 * Category colors look like: "bg-blue-100 text-blue-800 border-blue-200"
 * We extract the color name (blue, emerald, purple, etc.) and return calendar tokens.
 */

interface CalendarColorTokens {
  bg: string;       // Light background class
  border: string;   // Left border class
  text: string;     // Text color class
  dot: string;      // Filter dot color class
}

const COLOR_MAP: Record<string, CalendarColorTokens> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-400',    text: 'text-blue-800',    dot: 'bg-blue-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-400' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-400',  text: 'text-purple-800',  dot: 'bg-purple-400' },
  pink:    { bg: 'bg-pink-50',    border: 'border-pink-400',    text: 'text-pink-800',    dot: 'bg-pink-400' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-400',   text: 'text-amber-800',   dot: 'bg-amber-400' },
  red:     { bg: 'bg-red-50',     border: 'border-red-400',     text: 'text-red-800',     dot: 'bg-red-400' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-400',    text: 'text-cyan-800',    dot: 'bg-cyan-400' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-400',    text: 'text-rose-800',    dot: 'bg-rose-400' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-400',  text: 'text-indigo-800',  dot: 'bg-indigo-400' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-400',    text: 'text-teal-800',    dot: 'bg-teal-400' },
};

const DEFAULT_TOKENS: CalendarColorTokens = {
  bg: 'bg-slate-50',
  border: 'border-slate-400',
  text: 'text-slate-800',
  dot: 'bg-slate-400',
};

/**
 * Extract color name from a Tailwind class string like "bg-blue-100 text-blue-800 border-blue-200"
 */
function extractColorName(tailwindClasses: string): string | null {
  const match = tailwindClasses.match(/bg-(\w+)-\d+/);
  return match ? match[1] : null;
}

export function getCategoryCalendarColors(categoryColor: string): CalendarColorTokens {
  const colorName = extractColorName(categoryColor);
  if (colorName && COLOR_MAP[colorName]) return COLOR_MAP[colorName];
  return DEFAULT_TOKENS;
}

/**
 * Staff member colors also use Tailwind class strings like "bg-rose-100 text-rose-800".
 * Reuse the same extraction logic.
 */
export function getStaffDotColor(staffColor: string): string {
  const colorName = extractColorName(staffColor);
  if (colorName && COLOR_MAP[colorName]) return COLOR_MAP[colorName].dot;
  return DEFAULT_TOKENS.dot;
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/calendarColors.ts
git commit -m "feat: add calendar color utilities for category mapping"
```

---

### Task 3: CalendarHeader Component

**Files:**
- Create: `modules/appointments/components/CalendarHeader.tsx`

- [ ] **Step 1: Create CalendarHeader.tsx**

Create `modules/appointments/components/CalendarHeader.tsx`:

```typescript
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarViewMode } from './useCalendar';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAYS_SHORT_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function formatTitle(date: Date, viewMode: CalendarViewMode): string {
  if (viewMode === 'day') {
    return `${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (viewMode === 'week') {
    const { start, end } = getWeekRange(date);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${MONTHS_FR[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTHS_FR[start.getMonth()]} ${start.getDate()} - ${MONTHS_FR[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  // month
  return `${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

const VIEW_MODES: { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onViewModeChange,
  onToday,
  onPrev,
  onNext,
}) => {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-slate-200 bg-white">
      {/* Left: Today + nav arrows */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
        >
          Aujourd'hui
        </button>
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Center: Title */}
      <h2 className="text-lg font-semibold text-slate-900">
        {formatTitle(currentDate, viewMode)}
      </h2>

      {/* Right: View mode toggle */}
      <div className="flex rounded-lg border border-slate-300 overflow-hidden">
        {VIEW_MODES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onViewModeChange(key)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === key
                ? 'bg-pink-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            } ${key !== 'day' ? 'border-l border-slate-300' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/CalendarHeader.tsx
git commit -m "feat: add CalendarHeader with navigation and view mode toggle"
```

---

### Task 4: CalendarSidebar Component

**Files:**
- Create: `modules/appointments/components/CalendarSidebar.tsx`

- [ ] **Step 1: Create CalendarSidebar.tsx**

Create `modules/appointments/components/CalendarSidebar.tsx`:

```typescript
import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ServiceCategory, StaffMember } from '../../../types';
import InlineCalendar from './InlineCalendar';
import { getCategoryCalendarColors, getStaffDotColor } from './calendarColors';

interface CalendarSidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  serviceCategories: ServiceCategory[];
  allStaff: StaffMember[];
  categoryFilters: Set<string>;
  staffFilters: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleStaff: (id: string) => void;
}

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  currentDate,
  onDateSelect,
  serviceCategories,
  allStaff,
  categoryFilters,
  staffFilters,
  onToggleCategory,
  onToggleStaff,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Convert currentDate to YYYY-MM-DD string for InlineCalendar
  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  const handleCalendarChange = (dateString: string) => {
    // dateString is YYYY-MM-DD
    const [y, m, d] = dateString.split('-').map(Number);
    onDateSelect(new Date(y, m - 1, d));
  };

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-slate-200 bg-white p-4 space-y-5 overflow-y-auto">
      {/* Mini Calendar */}
      <InlineCalendar value={dateStr} onChange={handleCalendarChange} />

      {/* Filters */}
      <div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center justify-between w-full text-sm font-semibold text-slate-900 mb-3"
        >
          Filtres
          {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {filtersOpen && (
          <div className="space-y-4">
            {/* Service Categories */}
            <div className="space-y-2">
              {serviceCategories.map(cat => {
                const colors = getCategoryCalendarColors(cat.color);
                const checked = categoryFilters.has(cat.id);
                return (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleCategory(cat.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors ${
                        checked
                          ? `${colors.dot} border-transparent`
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {cat.name}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Team Members */}
            <div className="space-y-2">
              {allStaff.map(staff => {
                const dotColor = getStaffDotColor(staff.color);
                const checked = staffFilters.has(staff.id);
                return (
                  <label
                    key={staff.id}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleStaff(staff.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors ${
                        checked
                          ? `${dotColor} border-transparent`
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {staff.firstName} {staff.lastName}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarSidebar.tsx
git commit -m "feat: add CalendarSidebar with mini calendar and filters"
```

---

### Task 5: CalendarEventBlock Component

**Files:**
- Create: `modules/appointments/components/CalendarEventBlock.tsx`

- [ ] **Step 1: Create CalendarEventBlock.tsx**

Create `modules/appointments/components/CalendarEventBlock.tsx`:

```typescript
import React from 'react';
import { Appointment, AppointmentStatus, ServiceCategory } from '../../../types';
import { getCategoryCalendarColors } from './calendarColors';

interface CalendarEventBlockProps {
  appointment: Appointment;
  category: ServiceCategory | undefined;
  style: React.CSSProperties;
  compact?: boolean; // true for month view compact bars
  onClick: (e: React.MouseEvent) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export const CalendarEventBlock: React.FC<CalendarEventBlockProps> = ({
  appointment,
  category,
  style,
  compact = false,
  onClick,
}) => {
  const isCompleted = appointment.status === AppointmentStatus.COMPLETED;
  const isCancelled = appointment.status === AppointmentStatus.CANCELLED;
  const colors = category ? getCategoryCalendarColors(category.color) : null;

  const startDate = new Date(appointment.date);
  const endDate = new Date(startDate.getTime() + appointment.durationMinutes * 60000);
  const timeRange = `${formatTime(startDate)} - ${formatTime(endDate)}`;

  if (compact) {
    // Month view: compact single-line bar
    return (
      <button
        onClick={onClick}
        style={style}
        className={`
          w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded truncate
          border-l-[3px] cursor-pointer transition-opacity
          ${isCompleted || isCancelled ? 'opacity-40 border-slate-300 bg-slate-50 text-slate-500' : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'}`}
          hover:opacity-80
        `}
      >
        <span className="font-medium">{formatTime(startDate)}</span>{' '}
        <span>{appointment.serviceName}</span>
      </button>
    );
  }

  // Day/Week view: positioned block
  return (
    <button
      onClick={onClick}
      style={style}
      className={`
        absolute left-0.5 right-0.5 rounded-md px-2 py-1 overflow-hidden cursor-pointer
        border-l-[3px] transition-opacity
        ${isCompleted || isCancelled ? 'opacity-40 border-slate-300 bg-slate-50 text-slate-500' : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'}`}
        hover:opacity-80
      `}
    >
      <div className="text-xs font-semibold truncate">{appointment.serviceName}</div>
      <div className="text-[11px] opacity-75 truncate">{timeRange}</div>
    </button>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarEventBlock.tsx
git commit -m "feat: add CalendarEventBlock for day/week/month views"
```

---

### Task 6: CalendarEventPopover Component

**Files:**
- Create: `modules/appointments/components/CalendarEventPopover.tsx`

- [ ] **Step 1: Create CalendarEventPopover.tsx**

Create `modules/appointments/components/CalendarEventPopover.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { Clock, User, Scissors, Tag } from 'lucide-react';
import { Appointment } from '../../../types';
import { StatusBadge } from './StatusBadge';
import { formatPrice } from '../../../lib/format';

interface CalendarEventPopoverProps {
  appointment: Appointment;
  anchorRect: DOMRect;
  onClose: () => void;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
}

export const CalendarEventPopover: React.FC<CalendarEventPopoverProps> = ({
  appointment,
  anchorRect,
  onClose,
  onViewDetails,
  onEdit,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Position: below the anchor, flip above if near bottom
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const showAbove = spaceBelow < 250;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 300),
    zIndex: 50,
    ...(showAbove
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  const startDate = new Date(appointment.date);
  const endDate = new Date(startDate.getTime() + appointment.durationMinutes * 60000);
  const timeStr = `${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div ref={ref} style={style} className="w-[280px] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{appointment.serviceName}</h3>
          <StatusBadge status={appointment.status} />
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Clock size={14} className="text-slate-400 flex-shrink-0" />
          <span>{timeStr}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <User size={14} className="text-slate-400 flex-shrink-0" />
          <span>{appointment.clientName}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Scissors size={14} className="text-slate-400 flex-shrink-0" />
          <span>{appointment.staffName}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Tag size={14} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium text-pink-600">{formatPrice(appointment.price)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => onViewDetails(appointment.id)}
          className="flex-1 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
        >
          Voir détails
        </button>
        <button
          onClick={() => onEdit(appointment.id)}
          className="flex-1 px-3 py-1.5 text-sm font-medium bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
        >
          Modifier
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarEventPopover.tsx
git commit -m "feat: add CalendarEventPopover with details and actions"
```

---

### Task 7: CalendarDayView Component

**Files:**
- Create: `modules/appointments/components/CalendarDayView.tsx`

- [ ] **Step 1: Create CalendarDayView.tsx**

Create `modules/appointments/components/CalendarDayView.tsx`:

```typescript
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

  // Sort by start time, then by duration (longer first)
  const sorted = [...dayAppointments].sort((a, b) => {
    const aStart = new Date(a.date).getTime();
    const bStart = new Date(b.date).getTime();
    if (aStart !== bStart) return aStart - bStart;
    return b.durationMinutes - a.durationMinutes;
  });

  // Assign columns for overlapping events
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
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarDayView.tsx
git commit -m "feat: add CalendarDayView with time grid and event layout"
```

---

### Task 8: CalendarWeekView Component

**Files:**
- Create: `modules/appointments/components/CalendarWeekView.tsx`

- [ ] **Step 1: Create CalendarWeekView.tsx**

Create `modules/appointments/components/CalendarWeekView.tsx`:

```typescript
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

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM
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

  // Get timezone abbreviation
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
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarWeekView.tsx
git commit -m "feat: add CalendarWeekView with 7-column time grid"
```

---

### Task 9: CalendarMonthView Component

**Files:**
- Create: `modules/appointments/components/CalendarMonthView.tsx`

- [ ] **Step 1: Create CalendarMonthView.tsx**

Create `modules/appointments/components/CalendarMonthView.tsx`:

```typescript
import React from 'react';
import { Appointment, ServiceCategory } from '../../../types';
import { CalendarEventBlock } from './CalendarEventBlock';

interface CalendarMonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: { id: string; categoryId: string }[];
  onEventClick: (appointment: Appointment, rect: DOMRect) => void;
  onDateClick: (date: Date) => void;
}

const DAYS_HEADER = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const MAX_VISIBLE_EVENTS = 3;

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

interface MonthCell {
  date: Date;
  isCurrentMonth: boolean;
}

function getMonthGrid(year: number, month: number): MonthCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: MonthCell[] = [];

  // Previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ date: d, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Next month days to fill 6 rows
  while (cells.length < 42) {
    const d = new Date(year, month + 1, cells.length - startOffset - lastDay.getDate() + 1);
    cells.push({ date: d, isCurrentMonth: false });
  }

  return cells;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  appointments,
  serviceCategories,
  services,
  onEventClick,
  onDateClick,
}) => {
  const cells = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const categoryMap = new Map(serviceCategories.map(c => [c.id, c]));
  const serviceCatMap = new Map(services.map(s => [s.id, s.categoryId]));

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 sticky top-0 bg-white z-10">
        {DAYS_HEADER.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-semibold uppercase ${
              i === 5 ? 'text-pink-500' : 'text-slate-500'
            } ${i > 0 ? 'border-l border-slate-100' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const today = isToday(cell.date);
          const dayAppts = appointments
            .filter(a => isSameDay(new Date(a.date), cell.date))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const visible = dayAppts.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = dayAppts.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={i}
              className={`min-h-[120px] p-1.5 border-t border-slate-100 ${
                i % 7 > 0 ? 'border-l border-slate-100' : ''
              } ${!cell.isCurrentMonth ? 'bg-slate-50/50' : ''}`}
            >
              {/* Date number */}
              <button
                onClick={() => onDateClick(cell.date)}
                className="mb-1"
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                    today
                      ? 'bg-pink-500 text-white font-bold'
                      : cell.isCurrentMonth
                        ? 'text-slate-900 font-medium hover:bg-slate-100'
                        : 'text-slate-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
              </button>

              {/* Events */}
              <div className="space-y-0.5">
                {visible.map(appt => {
                  const catId = serviceCatMap.get(appt.serviceId);
                  const category = catId ? categoryMap.get(catId) : undefined;
                  return (
                    <CalendarEventBlock
                      key={appt.id}
                      appointment={appt}
                      category={category}
                      compact
                      style={{}}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        onEventClick(appt, rect);
                      }}
                    />
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => onDateClick(cell.date)}
                    className="text-[11px] text-pink-500 font-medium pl-1.5 hover:underline"
                  >
                    +{overflow} de plus
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarMonthView.tsx
git commit -m "feat: add CalendarMonthView with compact event bars"
```

---

### Task 10: CalendarView Container Component

**Files:**
- Create: `modules/appointments/components/CalendarView.tsx`

- [ ] **Step 1: Create CalendarView.tsx**

Create `modules/appointments/components/CalendarView.tsx`:

```typescript
import React, { useState, useCallback } from 'react';
import { Appointment, ServiceCategory, StaffMember, Service } from '../../../types';
import { useCalendar } from './useCalendar';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { CalendarDayView } from './CalendarDayView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarEventPopover } from './CalendarEventPopover';

interface CalendarViewProps {
  allAppointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  allStaff: StaffMember[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  allAppointments,
  serviceCategories,
  services,
  allStaff,
  onViewDetails,
  onEdit,
}) => {
  const calendar = useCalendar(allAppointments, serviceCategories, services, allStaff);

  const [popover, setPopover] = useState<{
    appointment: Appointment;
    rect: DOMRect;
  } | null>(null);

  const handleEventClick = useCallback((appointment: Appointment, rect: DOMRect) => {
    setPopover({ appointment, rect });
  }, []);

  const closePopover = useCallback(() => setPopover(null), []);

  const handleViewDetails = useCallback((id: string) => {
    setPopover(null);
    onViewDetails(id);
  }, [onViewDetails]);

  const handleEdit = useCallback((id: string) => {
    setPopover(null);
    onEdit(id);
  }, [onEdit]);

  // Simplified service data for child components (they only need id + categoryId)
  const serviceData = services.map(s => ({ id: s.id, categoryId: s.categoryId }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <CalendarSidebar
          currentDate={calendar.currentDate}
          onDateSelect={calendar.goToDate}
          serviceCategories={serviceCategories}
          allStaff={allStaff}
          categoryFilters={calendar.categoryFilters}
          staffFilters={calendar.staffFilters}
          onToggleCategory={calendar.toggleCategory}
          onToggleStaff={calendar.toggleStaff}
        />

        {/* Main calendar area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CalendarHeader
            currentDate={calendar.currentDate}
            viewMode={calendar.viewMode}
            onViewModeChange={calendar.setViewMode}
            onToday={calendar.goToday}
            onPrev={calendar.goPrev}
            onNext={calendar.goNext}
          />

          {calendar.viewMode === 'day' && (
            <CalendarDayView
              currentDate={calendar.currentDate}
              appointments={calendar.filteredAppointments}
              serviceCategories={serviceCategories}
              services={serviceData}
              onEventClick={handleEventClick}
            />
          )}

          {calendar.viewMode === 'week' && (
            <CalendarWeekView
              currentDate={calendar.currentDate}
              appointments={calendar.filteredAppointments}
              serviceCategories={serviceCategories}
              services={serviceData}
              onEventClick={handleEventClick}
            />
          )}

          {calendar.viewMode === 'month' && (
            <CalendarMonthView
              currentDate={calendar.currentDate}
              appointments={calendar.filteredAppointments}
              serviceCategories={serviceCategories}
              services={serviceData}
              onEventClick={handleEventClick}
              onDateClick={calendar.goToDate}
            />
          )}
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <CalendarEventPopover
          appointment={popover.appointment}
          anchorRect={popover.rect}
          onClose={closePopover}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/appointments/components/CalendarView.tsx
git commit -m "feat: add CalendarView container wiring sidebar, header, and views"
```

---

### Task 11: Integrate Calendar into AppointmentList and AppointmentsModule

**Files:**
- Modify: `modules/appointments/components/AppointmentList.tsx`
- Modify: `modules/appointments/AppointmentsModule.tsx`

- [ ] **Step 1: Add List/Calendar toggle to AppointmentList**

Replace the full content of `modules/appointments/components/AppointmentList.tsx`:

```typescript
import React, { useState } from 'react';
import { Plus, Search, List, CalendarDays } from 'lucide-react';
import { Appointment, AppointmentStatus, ServiceCategory, StaffMember, Service } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { AppointmentTable } from './AppointmentTable';
import { AppointmentCardList } from './AppointmentCard';
import { CalendarView } from './CalendarView';

interface AppointmentListProps {
  appointments: Appointment[];
  allAppointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  onAdd: () => void;
  onDetails: (id: string) => void;
  onEdit: (id: string) => void;
  serviceCategories: ServiceCategory[];
  services: Service[];
  allStaff: StaffMember[];
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  allAppointments,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAdd,
  onDetails,
  onEdit,
  serviceCategories,
  services,
  allStaff,
}) => {
  const { viewMode, setViewMode } = useViewMode('appointments');
  const [mode, setMode] = useState<'list' | 'calendar'>('list');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Rendez-vous</h1>
        <div className="flex items-center gap-3">
          {/* List / Calendar toggle */}
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List size={14} />
              Liste
            </button>
            <button
              onClick={() => setMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-slate-300 ${
                mode === 'calendar'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CalendarDays size={14} />
              Calendrier
            </button>
          </div>

          <button
            onClick={onAdd}
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau RDV
          </button>
        </div>
      </div>

      {mode === 'calendar' ? (
        <CalendarView
          allAppointments={allAppointments}
          serviceCategories={serviceCategories}
          services={services}
          allStaff={allStaff}
          onViewDetails={onDetails}
          onEdit={onEdit}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => onStatusFilterChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm shadow-sm cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
              <option value={AppointmentStatus.COMPLETED}>Terminé</option>
              <option value={AppointmentStatus.CANCELLED}>Annulé</option>
            </select>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === 'table' ? (
            <AppointmentTable appointments={appointments} onDetails={onDetails} />
          ) : (
            <AppointmentCardList appointments={appointments} onDetails={onDetails} />
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Update AppointmentsModule to pass new props**

In `modules/appointments/AppointmentsModule.tsx`, replace the `AppointmentList` rendering (lines 89-99) with:

```typescript
      {view === 'LIST' && (
        <AppointmentList
          appointments={appointments}
          allAppointments={allAppointments}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAdd={handleAdd}
          onDetails={handleDetails}
          onEdit={(id: string) => {
            setSelectedApptId(id);
            setView('EDIT');
          }}
          serviceCategories={serviceCategories}
          services={services}
          allStaff={team}
        />
      )}
```

Note: This adds `allAppointments`, `onEdit`, `serviceCategories`, `services`, and `allStaff` props that didn't exist before.

- [ ] **Step 3: Verify build and test in browser**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

Run: `npm run dev`
Expected: Navigate to Rendez-vous page, see List/Calendar toggle. Clicking "Calendrier" shows the calendar view with sidebar, header, and time grid. Clicking "Liste" returns to the familiar list/table view.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/AppointmentList.tsx modules/appointments/AppointmentsModule.tsx
git commit -m "feat: integrate calendar view into appointments module with List/Calendar toggle"
```

---

### Task 12: Final Build Verification and Cleanup

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build with no errors or warnings related to our changes

- [ ] **Step 2: Visual verification checklist**

Open the app in browser and verify:
1. List/Calendar toggle appears in the Rendez-vous header
2. Calendar sidebar shows mini calendar and filters (categories + staff)
3. Week view shows 7-column grid with today highlighted in pink
4. Day view shows single-column time grid with "Aujourd'hui" badge
5. Month view shows month grid with compact event bars
6. Clicking mini calendar dates switches to Day view
7. "Aujourd'hui" button resets to current date
8. Prev/next arrows navigate correctly for each view mode
9. Unchecking a filter hides those appointments
10. Clicking an event block shows the popover with details
11. Popover "Voir détails" navigates to details view
12. Popover "Modifier" navigates to edit view
13. Completed appointments appear greyed out (opacity-40)
14. Event blocks show correct category colors

- [ ] **Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: calendar view adjustments from visual review"
```
