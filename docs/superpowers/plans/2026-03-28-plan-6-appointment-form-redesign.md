# Plan 6 — Appointment Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-service appointment form with a two-panel multi-service appointment builder featuring inline calendar, grid time picker, category-based service selection, per-service staff assignment, and new client quick-add.

**Architecture:** Two-panel layout — left panel manages client + service blocks (each with category/service/variant/staff), right panel is tabbed per service with scheduling controls (status, calendar, time picker, reminder, summary). Data model adds `appointment_groups` table to group multiple appointments under one booking. Each service block maps to one `appointments` row linked via `group_id`.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase (PostgreSQL), Zod, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-28-plan-6-appointment-form-redesign-design.md`

---

## File Structure

### New Files

```
supabase/migrations/20260328200000_appointment_groups.sql  — New table + ALTER appointments

types.ts                                                    — Add AppointmentGroup, ServiceBlockState types

modules/appointments/
├── components/
│   ├── AppointmentBuilder.tsx      — Top-level two-panel container
│   ├── ClientField.tsx             — Search + "Nouveau" inline form
│   ├── ServiceBlock.tsx            — Category tabs + service grid + variant + staff
│   ├── ServiceGrid.tsx             — 3-col grid of service cards
│   ├── VariantList.tsx             — Radio list inside selected service card
│   ├── StaffPills.tsx              — "N'importe qui" + staff chips
│   ├── SchedulingPanel.tsx         — Right panel: tabs + active content
│   ├── InlineCalendar.tsx          — Always-visible month grid
│   ├── TimePicker.tsx              — 3-row grid (hours + minutes + AM/PM)
│   ├── ReminderToggle.tsx          — Toggle + duration chip options
│   └── AppointmentSummary.tsx      — Per-service + total summary
├── hooks/
│   ├── useStaffAvailability.ts     — Compute available slots per staff+date
│   └── useServiceCategories.ts     — Fetch categories (may already be in useServices)
├── mappers.ts                      — Add group mappers (extend existing)
└── schemas.ts                      — Replace with group schema (extend existing)
```

### Modified Files

```
modules/appointments/AppointmentsModule.tsx  — Wire AppointmentBuilder for ADD/EDIT views
modules/appointments/components/AppointmentDetails.tsx — Show grouped services
modules/appointments/hooks/useAppointments.ts — Add group CRUD mutations
types.ts — Add new types
```

---

## Task 1: Database Migration — `appointment_groups` Table

**Files:**
- Create: `supabase/migrations/20260328200000_appointment_groups.sql`

- [ ] **Step 1: Write the migration SQL**

Create the file `supabase/migrations/20260328200000_appointment_groups.sql`:

```sql
-- ============================================================
-- Plan 6: Appointment Groups (multi-service bookings)
-- ============================================================

-- 1. Create appointment_groups table
CREATE TABLE appointment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  notes TEXT,
  reminder_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);

-- 2. Auto-update timestamp trigger
CREATE TRIGGER appointment_groups_updated_at
  BEFORE UPDATE ON appointment_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Audit log trigger (same pattern as other business tables)
CREATE TRIGGER appointment_groups_audit
  AFTER INSERT OR UPDATE OR DELETE ON appointment_groups
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 4. Add group_id to appointments
ALTER TABLE appointments
  ADD COLUMN group_id UUID REFERENCES appointment_groups(id);

-- 5. RLS policies for appointment_groups
ALTER TABLE appointment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointment_groups_select ON appointment_groups
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
  );

CREATE POLICY appointment_groups_insert ON appointment_groups
  FOR INSERT WITH CHECK (
    salon_id = get_active_salon()
  );

CREATE POLICY appointment_groups_update ON appointment_groups
  FOR UPDATE USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
  );

-- 6. Index for fast group lookups
CREATE INDEX idx_appointments_group_id ON appointments(group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX idx_appointment_groups_salon_id ON appointment_groups(salon_id)
  WHERE deleted_at IS NULL;
```

- [ ] **Step 2: Apply migration locally**

Run: `cd "/Users/sims/Casa de Chicas/Salon-Saas" && npx supabase db reset`

Expected: Migration applies without errors. All tables created.

- [ ] **Step 3: Regenerate database types**

Run: `npm run db:types`

Expected: `lib/database.types.ts` updated with `appointment_groups` table and `group_id` column on `appointments`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260328200000_appointment_groups.sql lib/database.types.ts
git commit -m "feat: add appointment_groups table for multi-service bookings"
```

---

## Task 2: Types & Schemas

**Files:**
- Modify: `types.ts`
- Modify: `modules/appointments/schemas.ts`

- [ ] **Step 1: Add new types to `types.ts`**

Add after the existing `Appointment` interface:

```typescript
export interface AppointmentGroup {
  id: string;
  clientId: string;
  clientName: string;
  notes: string;
  reminderMinutes: number | null;
  status: AppointmentStatus;
  appointments: Appointment[];
}

export interface ServiceBlockState {
  id: string;
  categoryId: string | null;
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
}
```

- [ ] **Step 2: Update `modules/appointments/schemas.ts`**

Replace file content:

```typescript
import { z } from 'zod';

export const newClientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().optional().default(''),
  phone: z.string().min(6, 'Le numéro de téléphone est requis'),
});

export const serviceBlockSchema = z.object({
  serviceId: z.string().min(1, 'Le service est requis'),
  variantId: z.string().min(1, 'La variante est requise'),
  staffId: z.string().nullable(),
  date: z.string().min(1, 'La date est requise'),
  hour: z.number().min(0).max(23, "L'heure doit être entre 0 et 23"),
  minute: z.number().refine(
    (m) => [0, 15, 30, 45].includes(m),
    { message: 'Les minutes doivent être 00, 15, 30 ou 45' },
  ),
});

export const appointmentGroupSchema = z.object({
  clientId: z.string().min(1, 'Le client est requis'),
  serviceBlocks: z
    .array(serviceBlockSchema)
    .min(1, 'Au moins un service est requis'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().optional().default(''),
  reminderMinutes: z.number().nullable(),
});
```

- [ ] **Step 3: Commit**

```bash
git add types.ts modules/appointments/schemas.ts
git commit -m "feat: add AppointmentGroup types and Zod schemas"
```

---

## Task 3: Mappers & Hook Updates

**Files:**
- Modify: `modules/appointments/mappers.ts`
- Modify: `modules/appointments/hooks/useAppointments.ts`

- [ ] **Step 1: Add group mappers to `modules/appointments/mappers.ts`**

Add to the existing file:

```typescript
import type { AppointmentGroup } from '../../types';

interface AppointmentGroupRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  notes: string | null;
  reminder_minutes: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  clients: { first_name: string; last_name: string } | null;
  appointments: AppointmentRow[];
}

export function toAppointmentGroup(row: AppointmentGroupRow): AppointmentGroup {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.clients
      ? `${row.clients.first_name} ${row.clients.last_name}`
      : '',
    notes: row.notes ?? '',
    reminderMinutes: row.reminder_minutes,
    status: row.status as AppointmentStatus,
    appointments: (row.appointments ?? []).map(toAppointment),
  };
}

export function toAppointmentGroupInsert(
  group: {
    clientId: string;
    notes: string;
    reminderMinutes: number | null;
    status: string;
  },
  salonId: string,
) {
  return {
    salon_id: salonId,
    client_id: group.clientId || null,
    notes: group.notes || null,
    reminder_minutes: group.reminderMinutes,
    status: group.status,
  };
}
```

- [ ] **Step 2: Add group mutations to `modules/appointments/hooks/useAppointments.ts`**

Add these mutations inside the hook, after existing mutations:

```typescript
const addAppointmentGroupMutation = useMutation({
  mutationFn: async (payload: {
    clientId: string;
    notes: string;
    reminderMinutes: number | null;
    status: string;
    serviceBlocks: Array<{
      serviceId: string;
      variantId: string;
      staffId: string | null;
      date: string;
      durationMinutes: number;
      price: number;
    }>;
  }) => {
    // 1. Insert the group
    const { data: group, error: groupError } = await supabase
      .from('appointment_groups')
      .insert(toAppointmentGroupInsert(payload, salonId))
      .select('id')
      .single();

    if (groupError) throw groupError;

    // 2. Insert each appointment linked to the group
    const appointmentRows = payload.serviceBlocks.map((block) => ({
      salon_id: salonId,
      group_id: group.id,
      client_id: payload.clientId || null,
      service_id: block.serviceId || null,
      service_variant_id: block.variantId || null,
      staff_id: block.staffId || null,
      date: block.date,
      duration_minutes: block.durationMinutes,
      price: block.price,
      status: payload.status,
      notes: payload.notes || null,
    }));

    const { error: apptError } = await supabase
      .from('appointments')
      .insert(appointmentRows);

    if (apptError) throw apptError;

    return group.id;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    addToast({ type: 'success', message: 'Rendez-vous créé' });
  },
  onError: toastOnError('Erreur lors de la création du rendez-vous'),
});
```

- [ ] **Step 3: Export the new mutation from the hook's return object**

Add to the return statement:

```typescript
return {
  // ... existing returns
  addAppointmentGroup: addAppointmentGroupMutation.mutate,
  isAddingGroup: addAppointmentGroupMutation.isPending,
};
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/mappers.ts modules/appointments/hooks/useAppointments.ts
git commit -m "feat: add appointment group mappers and mutations"
```

---

## Task 4: InlineCalendar Component

**Files:**
- Create: `modules/appointments/components/InlineCalendar.tsx`

- [ ] **Step 1: Create the calendar component**

Reference `components/DatePicker.tsx` for calendar grid logic (day-of-week headers, days-in-month computation, Monday-start grid). Build an always-visible version (no dropdown/modal wrapper).

Create `modules/appointments/components/InlineCalendar.tsx`:

```typescript
import React, { useState, useMemo } from 'react';

interface InlineCalendarProps {
  value: string | null; // YYYY-MM-DD
  onChange: (date: string) => void;
  disabledDates?: Set<string>; // dates to grey out
}

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function getDaysGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function InlineCalendar({ value, onChange, disabledDates }: InlineCalendarProps) {
  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const initial = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const grid = useMemo(() => getDaysGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
      {/* Month navigation */}
      <div className="flex justify-between items-center mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="text-slate-400 hover:text-white p-1"
        >
          ◀
        </button>
        <span className="text-slate-200 text-sm font-semibold">
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="text-slate-400 hover:text-white p-1"
        >
          ▶
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAYS_FR.map((d) => (
          <span key={d} className="text-slate-500 text-[10px] font-semibold py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {grid.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;

          const dateStr = formatDateStr(viewYear, viewMonth, day);
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const isDisabled = disabledDates?.has(dateStr);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              className={`
                text-xs p-1.5 rounded-md transition-colors
                ${isSelected
                  ? 'bg-pink-500 text-white font-semibold'
                  : isToday
                    ? 'text-pink-400 ring-1 ring-pink-500/50'
                    : isPast
                      ? 'text-slate-600'
                      : 'text-slate-200 hover:bg-slate-800'
                }
                ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/InlineCalendar.tsx
git commit -m "feat: add InlineCalendar component for appointment builder"
```

---

## Task 5: TimePicker Component

**Files:**
- Create: `modules/appointments/components/TimePicker.tsx`

- [ ] **Step 1: Create the time picker component**

Create `modules/appointments/components/TimePicker.tsx`:

```typescript
import React from 'react';

interface TimePickerProps {
  hour: number | null;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  unavailableHours?: Set<number>; // hours that are fully booked
}

const MORNING_HOURS = [
  { value: 9, label: '9', period: 'AM' },
  { value: 10, label: '10', period: 'AM' },
  { value: 11, label: '11', period: 'AM' },
  { value: 12, label: '12', period: 'PM' },
  { value: 13, label: '1', period: 'PM' },
  { value: 14, label: '2', period: 'PM' },
];

const AFTERNOON_HOURS = [
  { value: 15, label: '3', period: 'PM' },
  { value: 16, label: '4', period: 'PM' },
  { value: 17, label: '5', period: 'PM' },
  { value: 18, label: '6', period: 'PM' },
  { value: 19, label: '7', period: 'PM' },
  { value: 20, label: '8', period: 'PM' },
];

const MINUTES = [0, 15, 30, 45] as const;

export default function TimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  unavailableHours,
}: TimePickerProps) {
  const [isAM, setIsAM] = React.useState(hour === null || hour < 12);

  const renderHourButton = (h: { value: number; label: string; period: string }) => {
    const isUnavailable = unavailableHours?.has(h.value);
    const isSelected = h.value === hour;

    return (
      <button
        key={h.value}
        type="button"
        disabled={isUnavailable}
        onClick={() => onHourChange(h.value)}
        className={`
          rounded-md py-2 px-1 text-center transition-colors
          ${isSelected
            ? 'bg-pink-500 text-white'
            : isUnavailable
              ? 'bg-slate-800 border border-slate-700 text-slate-600 opacity-40 line-through cursor-not-allowed'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 cursor-pointer'
          }
        `}
      >
        <span className={`text-xs font-medium ${isSelected ? 'font-semibold' : ''}`}>
          {h.label}
        </span>
        <span className={`text-[9px] ml-0.5 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
          {h.period}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-2.5">
      {/* Row 1: Morning hours */}
      <div className="grid grid-cols-6 gap-1 mb-1">
        {MORNING_HOURS.map(renderHourButton)}
      </div>

      {/* Row 2: Afternoon hours */}
      <div className="grid grid-cols-6 gap-1 mb-2">
        {AFTERNOON_HOURS.map(renderHourButton)}
      </div>

      {/* Separator */}
      <div className="border-t border-slate-700 mb-2" />

      {/* Row 3: Minutes + AM/PM */}
      <div className="grid grid-cols-6 gap-1">
        {MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMinuteChange(m)}
            className={`
              rounded-md py-2 px-1 text-center text-xs transition-colors
              ${m === minute
                ? 'bg-pink-500 text-white font-semibold'
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 cursor-pointer'
              }
            `}
          >
            :{String(m).padStart(2, '0')}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsAM(true)}
          className={`
            rounded-md py-2 px-1 text-center text-sm transition-colors
            ${isAM
              ? 'bg-pink-500'
              : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer'
            }
          `}
        >
          ☀️
        </button>
        <button
          type="button"
          onClick={() => setIsAM(false)}
          className={`
            rounded-md py-2 px-1 text-center text-sm transition-colors
            ${!isAM
              ? 'bg-pink-500'
              : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer'
            }
          `}
        >
          🌙
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/TimePicker.tsx
git commit -m "feat: add TimePicker grid component for appointment builder"
```

---

## Task 6: ReminderToggle & AppointmentSummary Components

**Files:**
- Create: `modules/appointments/components/ReminderToggle.tsx`
- Create: `modules/appointments/components/AppointmentSummary.tsx`

- [ ] **Step 1: Create ReminderToggle**

Create `modules/appointments/components/ReminderToggle.tsx`:

```typescript
import React from 'react';

interface ReminderToggleProps {
  value: number | null; // null = off, else minutes before
  onChange: (minutes: number | null) => void;
}

const REMINDER_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1h avant', value: 60 },
  { label: '3h avant', value: 180 },
  { label: '1 jour', value: 1440 },
  { label: '2 jours', value: 2880 },
];

export default function ReminderToggle({ value, onChange }: ReminderToggleProps) {
  const isOn = value !== null;

  const toggle = () => {
    onChange(isOn ? null : 60); // default to 1h when toggling on
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
          Rappel
        </span>
        <button
          type="button"
          onClick={toggle}
          className={`w-9 h-5 rounded-full relative transition-colors ${
            isOn ? 'bg-pink-500' : 'bg-slate-600'
          }`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
              isOn ? 'right-0.5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {isOn ? (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`
                px-3 py-1.5 rounded-full text-[11px] transition-colors
                ${value === opt.value
                  ? 'bg-pink-500 text-white font-medium'
                  : 'bg-slate-950 border border-slate-600 text-slate-300 hover:border-slate-400'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-[11px] mt-1 italic">
          Activer pour configurer un rappel
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create AppointmentSummary**

Create `modules/appointments/components/AppointmentSummary.tsx`:

```typescript
import React from 'react';
import { formatPrice } from '../../../lib/format';
import type { Service, ServiceVariant, StaffMember } from '../../../types';

interface ServiceBlockSummary {
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
}

interface AppointmentSummaryProps {
  serviceBlocks: ServiceBlockSummary[];
  activeBlockIndex: number;
  services: Service[];
  team: StaffMember[];
}

function getVariant(services: Service[], serviceId: string | null, variantId: string | null): ServiceVariant | null {
  if (!serviceId || !variantId) return null;
  const svc = services.find((s) => s.id === serviceId);
  return svc?.variants.find((v) => v.id === variantId) ?? null;
}

function getServiceName(services: Service[], serviceId: string | null): string {
  return services.find((s) => s.id === serviceId)?.name ?? '';
}

function formatTime(hour: number | null, minute: number, durationMinutes: number): string {
  if (hour === null) return '';
  const start = `${hour}h${String(minute).padStart(2, '0')}`;
  const endTotal = hour * 60 + minute + durationMinutes;
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const end = `${endH}h${String(endM).padStart(2, '0')}`;
  return `${start} – ${end}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export default function AppointmentSummary({
  serviceBlocks,
  activeBlockIndex,
  services,
  team,
}: AppointmentSummaryProps) {
  const activeBlock = serviceBlocks[activeBlockIndex];
  const activeVariant = activeBlock
    ? getVariant(services, activeBlock.serviceId, activeBlock.variantId)
    : null;

  // Compute totals across all blocks
  const blockDetails = serviceBlocks.map((block) => {
    const variant = getVariant(services, block.serviceId, block.variantId);
    return {
      name: getServiceName(services, block.serviceId),
      variantName: variant?.name ?? '',
      duration: variant?.durationMinutes ?? 0,
      price: variant?.price ?? 0,
      time: formatTime(block.hour, block.minute, variant?.durationMinutes ?? 0),
    };
  });

  const totalDuration = blockDetails.reduce((sum, b) => sum + b.duration, 0);
  const totalPrice = blockDetails.reduce((sum, b) => sum + b.price, 0);

  return (
    <div>
      {/* Active service summary */}
      {activeVariant && (
        <div className="border-t border-slate-700 pt-3 mb-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Ce service
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">
              Durée : <strong className="text-slate-200">{formatDuration(activeVariant.durationMinutes)}</strong>
            </span>
            <span className="text-slate-400">
              Prix : <strong className="text-pink-500">{formatPrice(activeVariant.price)}</strong>
            </span>
          </div>
          {activeBlock?.hour !== null && (
            <div className="text-slate-500 text-[10px] mt-1">
              📅 {formatTime(activeBlock.hour, activeBlock.minute, activeVariant.durationMinutes)}
            </div>
          )}
        </div>
      )}

      {/* Total summary (only if > 1 service) */}
      {serviceBlocks.length > 1 && (
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 mt-2">
          <div className="text-[10px] text-pink-500 uppercase tracking-wider font-semibold mb-1.5">
            Total rendez-vous
          </div>
          {blockDetails.map((b, i) => (
            <div key={i} className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">
                {'\u2460\u2461\u2462\u2463\u2464'[i]} {b.name}{b.variantName ? ` · ${b.variantName}` : ''}
              </span>
              <span className="text-slate-200">{formatPrice(b.price)}</span>
            </div>
          ))}
          <div className="border-t border-slate-700 pt-1.5 mt-1.5 flex justify-between text-sm">
            <span className="text-slate-400">
              Durée : <strong className="text-slate-200">{formatDuration(totalDuration)}</strong>
            </span>
            <strong className="text-pink-500">{formatPrice(totalPrice)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/ReminderToggle.tsx modules/appointments/components/AppointmentSummary.tsx
git commit -m "feat: add ReminderToggle and AppointmentSummary components"
```

---

## Task 7: ClientField Component

**Files:**
- Create: `modules/appointments/components/ClientField.tsx`

- [ ] **Step 1: Create the client field component**

Create `modules/appointments/components/ClientField.tsx`:

```typescript
import React, { useState, useMemo } from 'react';
import type { Client } from '../../../types';

interface ClientFieldProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onClearClient: () => void;
  newClientData: { firstName: string; lastName: string; phone: string } | null;
  onNewClientChange: (data: { firstName: string; lastName: string; phone: string } | null) => void;
  error?: string;
}

export default function ClientField({
  clients,
  selectedClientId,
  onSelectClient,
  onClearClient,
  newClientData,
  onNewClientChange,
  error,
}: ClientFieldProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId],
  );

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.firstName.toLowerCase().includes(term) ||
          c.lastName.toLowerCase().includes(term) ||
          c.phone?.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [clients, searchTerm]);

  // Show "Nouveau" inline form
  if (newClientData) {
    return (
      <div className="mb-4">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
          Client *
        </div>
        <div className="bg-slate-950 border border-pink-500 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[11px] text-pink-500 font-semibold uppercase tracking-wider">
              Nouveau client
            </span>
            <button
              type="button"
              onClick={() => onNewClientChange(null)}
              className="text-slate-500 hover:text-slate-300 text-sm"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Prénom *</div>
              <input
                type="text"
                value={newClientData.firstName}
                onChange={(e) =>
                  onNewClientChange({ ...newClientData, firstName: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-2 text-sm text-slate-200 focus:border-pink-500 focus:outline-none min-h-[44px]"
                placeholder="Prénom"
                autoFocus
              />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Nom</div>
              <input
                type="text"
                value={newClientData.lastName}
                onChange={(e) =>
                  onNewClientChange({ ...newClientData, lastName: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-2 text-sm text-slate-200 focus:border-pink-500 focus:outline-none min-h-[44px]"
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 mb-1">Téléphone *</div>
            <input
              type="tel"
              inputMode="tel"
              value={newClientData.phone}
              onChange={(e) =>
                onNewClientChange({ ...newClientData, phone: e.target.value })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-2 text-sm text-slate-200 focus:border-pink-500 focus:outline-none min-h-[44px]"
              placeholder="+212 6 XX XX XX XX"
            />
          </div>
          <p className="text-slate-500 text-[10px] mt-2 italic">
            Le client sera automatiquement ajouté au CRM
          </p>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }

  // Show selected client chip
  if (selectedClient) {
    const initials = `${selectedClient.firstName[0] ?? ''}${selectedClient.lastName[0] ?? ''}`.toUpperCase();
    return (
      <div className="mb-4">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
          Client *
        </div>
        <div className="bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <div>
              <div className="text-slate-200 text-sm font-medium">
                {selectedClient.firstName} {selectedClient.lastName}
              </div>
              <div className="text-slate-500 text-[11px]">
                {selectedClient.phone ?? ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearClient}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Default: search + "Nouveau" button
  return (
    <div className="mb-4">
      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
        Client *
      </div>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearchOpen(e.target.value.length > 0);
            }}
            onFocus={() => searchTerm.length > 0 && setIsSearchOpen(true)}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
            placeholder="Rechercher un client..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:border-pink-500 focus:outline-none min-h-[44px] pl-9"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            🔍
          </span>

          {/* Dropdown results */}
          {isSearchOpen && filteredClients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onMouseDown={() => {
                    onSelectClient(client.id);
                    setSearchTerm('');
                    setIsSearchOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5 text-sm"
                >
                  <div className="w-7 h-7 bg-pink-500/20 text-pink-400 rounded-full flex items-center justify-center text-[10px] font-semibold">
                    {client.firstName[0]}{client.lastName[0] ?? ''}
                  </div>
                  <div>
                    <div className="text-slate-200">
                      {client.firstName} {client.lastName}
                    </div>
                    <div className="text-slate-500 text-[11px]">{client.phone ?? ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            onNewClientChange({ firstName: '', lastName: '', phone: '' })
          }
          className="bg-slate-950 border border-slate-600 text-slate-300 px-3.5 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 hover:border-slate-400 min-h-[44px]"
        >
          <span className="text-pink-500 font-bold">+</span> Nouveau
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/ClientField.tsx
git commit -m "feat: add ClientField component with search and inline new client form"
```

---

## Task 8: StaffPills Component

**Files:**
- Create: `modules/appointments/components/StaffPills.tsx`

- [ ] **Step 1: Create the staff pills component**

Create `modules/appointments/components/StaffPills.tsx`:

```typescript
import React, { useMemo } from 'react';
import type { StaffMember } from '../../../types';

interface StaffPillsProps {
  team: StaffMember[];
  categoryId: string | null; // filter staff by skill
  selectedStaffId: string | null; // null = "N'importe qui"
  onSelect: (staffId: string | null) => void;
}

export default function StaffPills({
  team,
  categoryId,
  selectedStaffId,
  onSelect,
}: StaffPillsProps) {
  const eligibleStaff = useMemo(() => {
    if (!categoryId) return team.filter((m) => m.active);
    return team.filter(
      (m) => m.active && m.skills.includes(categoryId),
    );
  }, [team, categoryId]);

  return (
    <div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
        Praticien
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {/* "N'importe qui" default */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`
            px-3 py-1.5 rounded-full text-[11px] transition-colors
            ${selectedStaffId === null
              ? 'bg-pink-500 text-white font-semibold'
              : 'bg-slate-950 border border-slate-600 text-slate-300 hover:border-slate-400'
            }
          `}
        >
          N'importe qui
        </button>

        {/* Staff members */}
        {eligibleStaff.map((member) => {
          const isSelected = member.id === selectedStaffId;
          const label = `${member.firstName} ${member.lastName[0]}.`;

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : member.id)}
              className={`
                px-3 py-1.5 rounded-full text-[11px] transition-colors flex items-center gap-1
                ${isSelected
                  ? 'bg-pink-500 text-white font-medium'
                  : 'bg-slate-950 border border-slate-700 text-slate-400 hover:border-slate-500'
                }
              `}
            >
              {label}
              {isSelected && (
                <span className="opacity-70 ml-0.5">✕</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/StaffPills.tsx
git commit -m "feat: add StaffPills component with category-based filtering"
```

---

## Task 9: ServiceGrid & VariantList Components

**Files:**
- Create: `modules/appointments/components/ServiceGrid.tsx`
- Create: `modules/appointments/components/VariantList.tsx`

- [ ] **Step 1: Create VariantList**

Create `modules/appointments/components/VariantList.tsx`:

```typescript
import React from 'react';
import type { ServiceVariant } from '../../../types';

interface VariantListProps {
  variants: ServiceVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
}

export default function VariantList({ variants, selectedVariantId, onSelect }: VariantListProps) {
  return (
    <div className="flex flex-col gap-0.5 mt-2">
      {variants.map((v) => {
        const isSelected = v.id === selectedVariantId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`
              flex items-center gap-1.5 rounded px-2 py-1.5 text-left transition-colors
              ${isSelected
                ? 'bg-slate-950 border border-pink-500'
                : 'bg-slate-950 border border-slate-700 hover:border-slate-500'
              }
            `}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isSelected ? 'bg-pink-500' : 'border border-slate-600'
              }`}
            />
            <span className={`text-[11px] flex-1 ${isSelected ? 'text-slate-200' : 'text-slate-300'}`}>
              {v.name}
            </span>
            <span className="text-slate-500 text-[10px]">{v.durationMinutes}m</span>
            <span className={`text-[10px] font-semibold ${isSelected ? 'text-pink-500' : 'text-slate-500'}`}>
              {v.price}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create ServiceGrid**

Create `modules/appointments/components/ServiceGrid.tsx`:

```typescript
import React from 'react';
import type { Service } from '../../../types';
import VariantList from './VariantList';

interface ServiceGridProps {
  services: Service[]; // filtered by active category
  selectedServiceId: string | null;
  selectedVariantId: string | null;
  onSelectService: (serviceId: string) => void;
  onSelectVariant: (variantId: string) => void;
}

export default function ServiceGrid({
  services,
  selectedServiceId,
  selectedVariantId,
  onSelectService,
  onSelectVariant,
}: ServiceGridProps) {
  return (
    <div className="bg-slate-950 border border-slate-700 border-t-0 rounded-b-lg p-1.5">
      <div className="grid grid-cols-3 max-md:grid-cols-2 gap-1.5">
        {services.map((svc) => {
          const isSelected = svc.id === selectedServiceId;

          return (
            <div
              key={svc.id}
              className={`
                rounded-lg p-2.5 transition-colors
                ${isSelected
                  ? 'bg-slate-800 border-2 border-pink-500'
                  : 'bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-500'
                }
              `}
              onClick={() => !isSelected && onSelectService(svc.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !isSelected && onSelectService(svc.id)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-semibold ${isSelected ? 'text-slate-200' : 'text-slate-300'}`}>
                  {svc.name}
                </span>
                {isSelected && (
                  <span className="w-4 h-4 bg-pink-500 rounded text-[9px] text-white flex items-center justify-center">
                    ✓
                  </span>
                )}
              </div>

              {isSelected ? (
                <VariantList
                  variants={svc.variants}
                  selectedVariantId={selectedVariantId}
                  onSelect={onSelectVariant}
                />
              ) : (
                <span className="text-slate-500 text-[10px]">
                  {svc.variants.length} variante{svc.variants.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/ServiceGrid.tsx modules/appointments/components/VariantList.tsx
git commit -m "feat: add ServiceGrid and VariantList components"
```

---

## Task 10: ServiceBlock Component

**Files:**
- Create: `modules/appointments/components/ServiceBlock.tsx`

- [ ] **Step 1: Create the service block component**

Create `modules/appointments/components/ServiceBlock.tsx`:

```typescript
import React, { useMemo } from 'react';
import type { Service, ServiceCategory, StaffMember } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import ServiceGrid from './ServiceGrid';
import StaffPills from './StaffPills';

interface ServiceBlockProps {
  block: ServiceBlockState;
  index: number;
  isActive: boolean;
  services: Service[];
  categories: ServiceCategory[];
  team: StaffMember[];
  onActivate: () => void;
  onRemove: () => void;
  onChange: (updates: Partial<ServiceBlockState>) => void;
  // Summary info for collapsed state
  summaryText?: string;
}

export default function ServiceBlock({
  block,
  index,
  isActive,
  services,
  categories,
  team,
  onActivate,
  onRemove,
  onChange,
  summaryText,
}: ServiceBlockProps) {
  const activeCategoryId = block.categoryId || categories[0]?.id || null;

  const filteredServices = useMemo(
    () => services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId],
  );

  const selectedService = useMemo(
    () => services.find((s) => s.id === block.serviceId),
    [services, block.serviceId],
  );

  const handleCategoryChange = (categoryId: string) => {
    onChange({ categoryId, serviceId: null, variantId: null });
  };

  const handleServiceSelect = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    const firstVariantId = svc?.variants[0]?.id ?? null;
    onChange({
      serviceId,
      variantId: firstVariantId,
      categoryId: activeCategoryId,
    });
  };

  const handleVariantSelect = (variantId: string) => {
    onChange({ variantId });
  };

  const handleStaffSelect = (staffId: string | null) => {
    onChange({ staffId });
  };

  // Collapsed (inactive) state
  if (!isActive) {
    return (
      <div
        className="border border-slate-600 rounded-xl p-3.5 cursor-pointer hover:border-slate-500 transition-colors"
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-slate-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
              {index + 1}
            </span>
            <span className="text-slate-300 text-sm font-semibold">Service</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            ✕
          </button>
        </div>
        {summaryText && (
          <div className="bg-slate-950 rounded-md px-3 py-2 text-xs text-slate-300">
            {summaryText}
          </div>
        )}
      </div>
    );
  }

  // Expanded (active) state
  return (
    <div className="border-2 border-pink-500 rounded-xl p-3.5 bg-pink-500/[0.02]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-pink-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
            {index + 1}
          </span>
          <span className="text-slate-200 text-sm font-semibold">Service</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0 border-b-2 border-slate-700 mb-0 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.id)}
            className={`
              px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors
              ${cat.id === activeCategoryId
                ? 'text-pink-500 border-b-2 border-pink-500 -mb-[2px] font-semibold'
                : 'text-slate-400 hover:text-slate-200'
              }
            `}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Service grid */}
      <ServiceGrid
        services={filteredServices}
        selectedServiceId={block.serviceId}
        selectedVariantId={block.variantId}
        onSelectService={handleServiceSelect}
        onSelectVariant={handleVariantSelect}
      />

      {/* Staff pills (show after service is selected) */}
      {block.serviceId && (
        <div className="mt-3">
          <StaffPills
            team={team}
            categoryId={selectedService?.categoryId ?? null}
            selectedStaffId={block.staffId}
            onSelect={handleStaffSelect}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/ServiceBlock.tsx
git commit -m "feat: add ServiceBlock component with category tabs, service grid, and staff pills"
```

---

## Task 11: SchedulingPanel Component

**Files:**
- Create: `modules/appointments/components/SchedulingPanel.tsx`

- [ ] **Step 1: Create the scheduling panel (right column)**

Create `modules/appointments/components/SchedulingPanel.tsx`:

```typescript
import React from 'react';
import type { AppointmentStatus, Service, StaffMember } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import ReminderToggle from './ReminderToggle';
import AppointmentSummary from './AppointmentSummary';

interface SchedulingPanelProps {
  serviceBlocks: ServiceBlockState[];
  activeBlockIndex: number;
  onActivateBlock: (index: number) => void;
  onBlockChange: (index: number, updates: Partial<ServiceBlockState>) => void;
  status: AppointmentStatus;
  onStatusChange: (status: AppointmentStatus) => void;
  reminderMinutes: number | null;
  onReminderChange: (minutes: number | null) => void;
  services: Service[];
  team: StaffMember[];
  unavailableHours?: Set<number>;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED' as AppointmentStatus, label: 'Planifié', color: 'bg-blue-500' },
  { value: 'COMPLETED' as AppointmentStatus, label: 'Complété', color: 'bg-green-500' },
  { value: 'CANCELLED' as AppointmentStatus, label: 'Annulé', color: 'bg-red-500' },
  { value: 'NO_SHOW' as AppointmentStatus, label: 'Absent', color: 'bg-orange-500' },
];

export default function SchedulingPanel({
  serviceBlocks,
  activeBlockIndex,
  onActivateBlock,
  onBlockChange,
  status,
  onStatusChange,
  reminderMinutes,
  onReminderChange,
  services,
  team,
  unavailableHours,
}: SchedulingPanelProps) {
  const activeBlock = serviceBlocks[activeBlockIndex];
  if (!activeBlock) return null;

  const getTabLabel = (block: ServiceBlockState, index: number) => {
    const svc = services.find((s) => s.id === block.serviceId);
    const variant = svc?.variants.find((v) => v.id === block.variantId);
    const staff = team.find((m) => m.id === block.staffId);
    return {
      name: svc?.name ?? 'Service',
      subtitle: [variant?.name, staff ? `${staff.firstName} ${staff.lastName[0]}.` : null]
        .filter(Boolean)
        .join(' · '),
    };
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Service tabs */}
      <div className="flex border-b-2 border-slate-700 bg-slate-950 overflow-x-auto">
        {serviceBlocks.map((block, i) => {
          const tab = getTabLabel(block, i);
          const isActive = i === activeBlockIndex;
          const circled = '\u2460\u2461\u2462\u2463\u2464'[i] ?? `${i + 1}`;

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onActivateBlock(i)}
              className={`
                flex-1 min-w-0 px-4 py-2.5 text-center transition-colors
                ${isActive
                  ? 'text-pink-500 font-semibold border-b-2 border-pink-500 -mb-[2px]'
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <div className="text-xs truncate">{circled} {tab.name}</div>
              {tab.subtitle && (
                <div className={`text-[9px] mt-0.5 truncate ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                  {tab.subtitle}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {/* Status */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Statut
          </div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AppointmentStatus)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:border-pink-500 focus:outline-none min-h-[44px] appearance-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Date *
          </div>
          <InlineCalendar
            value={activeBlock.date}
            onChange={(date) => onBlockChange(activeBlockIndex, { date })}
          />
        </div>

        {/* Time Picker */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Heure *
          </div>
          <TimePicker
            hour={activeBlock.hour}
            minute={activeBlock.minute}
            onHourChange={(hour) => onBlockChange(activeBlockIndex, { hour })}
            onMinuteChange={(minute) => onBlockChange(activeBlockIndex, { minute })}
            unavailableHours={unavailableHours}
          />
        </div>

        {/* Reminder */}
        <div className="mb-4">
          <ReminderToggle
            value={reminderMinutes}
            onChange={onReminderChange}
          />
        </div>

        {/* Summary */}
        <AppointmentSummary
          serviceBlocks={serviceBlocks}
          activeBlockIndex={activeBlockIndex}
          services={services}
          team={team}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/SchedulingPanel.tsx
git commit -m "feat: add SchedulingPanel with tabbed right column"
```

---

## Task 12: useStaffAvailability Hook

**Files:**
- Create: `modules/appointments/hooks/useStaffAvailability.ts`

- [ ] **Step 1: Create the availability hook**

Create `modules/appointments/hooks/useStaffAvailability.ts`:

```typescript
import { useMemo } from 'react';
import type { Appointment, StaffMember, WorkSchedule } from '../../../types';

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Computes which hours are unavailable for a given staff member on a given date,
 * accounting for the staff's weekly schedule and existing appointments.
 */
export function useStaffAvailability(
  staffMember: StaffMember | null,
  date: string | null,
  durationMinutes: number,
  existingAppointments: Appointment[],
): Set<number> {
  return useMemo(() => {
    const unavailable = new Set<number>();

    // If no staff or no date, all hours are available
    if (!staffMember || !date) return unavailable;

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Sunday
    const dayKey = DAY_KEYS[dayOfWeek];
    const schedule = staffMember.schedule?.[dayKey];

    // If staff doesn't work this day, all hours unavailable
    if (!schedule || !schedule.isOpen) {
      for (let h = 9; h <= 20; h++) unavailable.add(h);
      return unavailable;
    }

    const workStart = parseTime(schedule.start);
    const workEnd = parseTime(schedule.end);

    // Get this staff's appointments on this date
    const dayAppointments = existingAppointments
      .filter((a) => {
        if (a.staffId !== staffMember.id) return false;
        if (a.status === 'CANCELLED') return false;
        const aDate = a.date.split('T')[0];
        return aDate === date;
      })
      .map((a) => {
        const d = new Date(a.date);
        const startMin = d.getHours() * 60 + d.getMinutes();
        return { start: startMin, end: startMin + a.durationMinutes };
      })
      .sort((a, b) => a.start - b.start);

    // Check each hour slot
    for (let h = 9; h <= 20; h++) {
      for (const minute of [0, 15, 30, 45]) {
        const slotStart = h * 60 + minute;
        const slotEnd = slotStart + durationMinutes;

        // Outside working hours?
        if (slotStart < workStart || slotEnd > workEnd) {
          unavailable.add(h);
          continue;
        }

        // Overlaps with existing appointment?
        const hasConflict = dayAppointments.some(
          (a) => slotStart < a.end && slotEnd > a.start,
        );
        if (hasConflict) {
          unavailable.add(h);
        }
      }
    }

    return unavailable;
  }, [staffMember, date, durationMinutes, existingAppointments]);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/hooks/useStaffAvailability.ts
git commit -m "feat: add useStaffAvailability hook for time slot filtering"
```

---

## Task 13: AppointmentBuilder — Main Container

**Files:**
- Create: `modules/appointments/components/AppointmentBuilder.tsx`

- [ ] **Step 1: Create the appointment builder container**

Create `modules/appointments/components/AppointmentBuilder.tsx`:

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import type {
  Appointment,
  AppointmentStatus,
  ServiceBlockState,
  Service,
  ServiceCategory,
  StaffMember,
  Client,
} from '../../../types';
import { appointmentGroupSchema, newClientSchema } from '../schemas';
import { useFormValidation } from '../../../hooks/useFormValidation';
import ClientField from './ClientField';
import ServiceBlock from './ServiceBlock';
import SchedulingPanel from './SchedulingPanel';
import { useStaffAvailability } from '../hooks/useStaffAvailability';
import { formatPrice } from '../../../lib/format';

interface AppointmentBuilderProps {
  services: Service[];
  categories: ServiceCategory[];
  team: StaffMember[];
  clients: Client[];
  appointments: Appointment[];
  onSave: (payload: {
    clientId: string;
    newClient: { firstName: string; lastName: string; phone: string } | null;
    notes: string;
    reminderMinutes: number | null;
    status: string;
    serviceBlocks: Array<{
      serviceId: string;
      variantId: string;
      staffId: string | null;
      date: string;
      durationMinutes: number;
      price: number;
    }>;
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
  // For edit mode
  initialData?: {
    clientId: string;
    status: AppointmentStatus;
    notes: string;
    reminderMinutes: number | null;
    serviceBlocks: ServiceBlockState[];
  };
}

function createEmptyBlock(): ServiceBlockState {
  return {
    id: crypto.randomUUID(),
    categoryId: null,
    serviceId: null,
    variantId: null,
    staffId: null,
    date: null,
    hour: null,
    minute: 0,
  };
}

export default function AppointmentBuilder({
  services,
  categories,
  team,
  clients,
  appointments,
  onSave,
  onCancel,
  isSaving,
  initialData,
}: AppointmentBuilderProps) {
  // Client state
  const [clientId, setClientId] = useState<string | null>(initialData?.clientId ?? null);
  const [newClient, setNewClient] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);

  // Service blocks
  const [serviceBlocks, setServiceBlocks] = useState<ServiceBlockState[]>(
    initialData?.serviceBlocks ?? [createEmptyBlock()],
  );
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);

  // Scheduling
  const [status, setStatus] = useState<AppointmentStatus>(
    initialData?.status ?? ('SCHEDULED' as AppointmentStatus),
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    initialData?.reminderMinutes ?? null,
  );

  // Validation
  const { errors, validate, clearFieldError } = useFormValidation(appointmentGroupSchema);

  // Active block
  const activeBlock = serviceBlocks[activeBlockIndex];
  const activeStaff = useMemo(
    () => team.find((m) => m.id === activeBlock?.staffId) ?? null,
    [team, activeBlock?.staffId],
  );
  const activeVariant = useMemo(() => {
    if (!activeBlock?.serviceId || !activeBlock?.variantId) return null;
    const svc = services.find((s) => s.id === activeBlock.serviceId);
    return svc?.variants.find((v) => v.id === activeBlock.variantId) ?? null;
  }, [services, activeBlock?.serviceId, activeBlock?.variantId]);

  // Staff availability for active block
  const unavailableHours = useStaffAvailability(
    activeStaff,
    activeBlock?.date ?? null,
    activeVariant?.durationMinutes ?? 30,
    appointments,
  );

  // Handlers
  const updateBlock = useCallback((index: number, updates: Partial<ServiceBlockState>) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }, []);

  const removeBlock = useCallback((index: number) => {
    setServiceBlocks((prev) => {
      if (prev.length <= 1) return prev; // can't remove last block
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
    setActiveBlockIndex((prev) => Math.min(prev, serviceBlocks.length - 2));
  }, [serviceBlocks.length]);

  const addBlock = useCallback(() => {
    const newBlock = createEmptyBlock();
    // Copy date from last block if set
    const lastBlock = serviceBlocks[serviceBlocks.length - 1];
    if (lastBlock?.date) {
      newBlock.date = lastBlock.date;
    }
    setServiceBlocks((prev) => [...prev, newBlock]);
    setActiveBlockIndex(serviceBlocks.length);
  }, [serviceBlocks]);

  // Build summary text for collapsed blocks
  const getBlockSummary = (block: ServiceBlockState): string => {
    const svc = services.find((s) => s.id === block.serviceId);
    const variant = svc?.variants.find((v) => v.id === block.variantId);
    const staff = team.find((m) => m.id === block.staffId);
    const parts = [
      svc?.name,
      variant ? `· ${variant.name}` : null,
      variant ? `· ${variant.durationMinutes}m` : null,
      variant ? `· ${formatPrice(variant.price)}` : null,
      staff ? `· ${staff.firstName} ${staff.lastName[0]}.` : null,
    ].filter(Boolean);
    return parts.join(' ');
  };

  // Submit
  const handleSubmit = () => {
    const effectiveClientId = newClient ? 'pending-new-client' : (clientId ?? '');

    const formData = {
      clientId: effectiveClientId,
      serviceBlocks: serviceBlocks.map((b) => ({
        serviceId: b.serviceId ?? '',
        variantId: b.variantId ?? '',
        staffId: b.staffId,
        date: b.date ?? '',
        hour: b.hour ?? -1,
        minute: b.minute,
      })),
      status,
      notes,
      reminderMinutes,
    };

    const result = validate(formData);
    if (!result) return;

    // Validate new client separately if present
    if (newClient) {
      const clientResult = newClientSchema.safeParse(newClient);
      if (!clientResult.success) {
        // TODO: show client-specific errors
        return;
      }
    }

    // Build save payload
    const payload = {
      clientId: clientId ?? '',
      newClient,
      notes,
      reminderMinutes,
      status,
      serviceBlocks: serviceBlocks.map((b) => {
        const svc = services.find((s) => s.id === b.serviceId);
        const variant = svc?.variants.find((v) => v.id === b.variantId);
        const dateStr = b.date ?? '';
        const hour = b.hour ?? 0;
        const minute = b.minute;
        const isoDate = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

        return {
          serviceId: b.serviceId ?? '',
          variantId: b.variantId ?? '',
          staffId: b.staffId,
          date: isoDate,
          durationMinutes: variant?.durationMinutes ?? 30,
          price: variant?.price ?? 0,
        };
      }),
    };

    onSave(payload);
  };

  return (
    <div className="flex gap-4 max-md:flex-col">
      {/* LEFT PANEL */}
      <div className="flex-[1.3] bg-slate-800 rounded-xl p-5 border border-slate-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-semibold text-slate-200">
            {initialData ? 'Modifier le rendez-vous' : 'Nouveau Rendez-vous'}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-950 border border-slate-700 text-slate-400 px-3.5 py-1.5 rounded-md text-xs"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-pink-500 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Client */}
        <ClientField
          clients={clients}
          selectedClientId={clientId}
          onSelectClient={(id) => { setClientId(id); setNewClient(null); clearFieldError('clientId'); }}
          onClearClient={() => setClientId(null)}
          newClientData={newClient}
          onNewClientChange={setNewClient}
          error={errors.clientId}
        />

        <div className="border-t border-slate-700 mb-4" />

        {/* Service blocks */}
        <div className="space-y-3 mb-3">
          {serviceBlocks.map((block, i) => (
            <ServiceBlock
              key={block.id}
              block={block}
              index={i}
              isActive={i === activeBlockIndex}
              services={services}
              categories={categories}
              team={team}
              onActivate={() => setActiveBlockIndex(i)}
              onRemove={() => removeBlock(i)}
              onChange={(updates) => updateBlock(i, updates)}
              summaryText={getBlockSummary(block)}
            />
          ))}
        </div>

        {/* Add service button */}
        <button
          type="button"
          onClick={addBlock}
          className="w-full border border-dashed border-slate-600 rounded-xl py-3 text-slate-400 text-xs hover:border-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5 mb-4"
        >
          <span className="text-pink-500 font-bold text-base">+</span> Ajouter un service
        </button>

        {/* Notes */}
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
            Notes
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajouter des notes..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:border-pink-500 focus:outline-none resize-none min-h-[44px]"
          />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-[0.85]">
        <SchedulingPanel
          serviceBlocks={serviceBlocks}
          activeBlockIndex={activeBlockIndex}
          onActivateBlock={setActiveBlockIndex}
          onBlockChange={updateBlock}
          status={status}
          onStatusChange={setStatus}
          reminderMinutes={reminderMinutes}
          onReminderChange={setReminderMinutes}
          services={services}
          team={team}
          unavailableHours={unavailableHours}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/AppointmentBuilder.tsx
git commit -m "feat: add AppointmentBuilder main container component"
```

---

## Task 14: Wire AppointmentBuilder into AppointmentsModule

**Files:**
- Modify: `modules/appointments/AppointmentsModule.tsx`

- [ ] **Step 1: Read the current AppointmentsModule**

Read `modules/appointments/AppointmentsModule.tsx` to understand the current view state management and how `AppointmentForm` is used.

- [ ] **Step 2: Replace AppointmentForm with AppointmentBuilder for ADD/EDIT views**

In the imports section, replace:
```typescript
import AppointmentForm from './components/AppointmentForm';
```
with:
```typescript
import AppointmentBuilder from './components/AppointmentBuilder';
```

In the ADD view rendering block, replace the `<AppointmentForm>` usage with:

```typescript
<AppointmentBuilder
  services={services}
  categories={serviceCategories}
  team={team}
  clients={clients}
  appointments={appointments}
  onSave={async (payload) => {
    if (payload.newClient) {
      // Insert new client first
      const { data: newClientRow, error: clientError } = await supabase
        .from('clients')
        .insert({
          salon_id: activeSalon.id,
          first_name: payload.newClient.firstName,
          last_name: payload.newClient.lastName,
          phone: payload.newClient.phone,
        })
        .select('id')
        .single();

      if (clientError) {
        addToast({ type: 'error', message: 'Erreur lors de la création du client' });
        return;
      }
      payload.clientId = newClientRow.id;
    }
    addAppointmentGroup(payload);
    setView('LIST');
  }}
  onCancel={() => setView('LIST')}
  isSaving={isAddingGroup}
/>
```

Note: You will need to add the `useClients()` hook import and call at the top of the module, and destructure `clients` from it. Also import `useServices()` for `serviceCategories`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No errors. The app should compile and the appointment form should now use the new builder.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

Open http://localhost:3000, navigate to the Appointments module, click "Nouveau". Verify:
- Two-panel layout renders
- Client search field appears at top
- Service block with category tabs renders
- Right panel shows calendar, time picker, reminder toggle
- "Ajouter un service" button works

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/AppointmentsModule.tsx
git commit -m "feat: wire AppointmentBuilder into AppointmentsModule for ADD/EDIT views"
```

---

## Task 15: Update AppointmentDetails for Grouped Appointments

**Files:**
- Modify: `modules/appointments/components/AppointmentDetails.tsx`

- [ ] **Step 1: Read the current AppointmentDetails component**

Read `modules/appointments/components/AppointmentDetails.tsx` to understand its current layout.

- [ ] **Step 2: Add grouped services display**

After reading the file, add a section that checks if the appointment has a `group_id`. If it does, fetch sibling appointments from the same group and display them as a list of service cards below the main details.

Add below the existing appointment details grid:

```typescript
{/* Grouped services (if multi-service booking) */}
{groupedAppointments.length > 1 && (
  <div className="mt-6">
    <h4 className="text-sm font-semibold text-slate-300 mb-3">
      Services dans ce rendez-vous ({groupedAppointments.length})
    </h4>
    <div className="space-y-2">
      {groupedAppointments.map((appt, i) => (
        <div
          key={appt.id}
          className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center"
        >
          <div>
            <span className="text-slate-300 text-sm">
              {'\u2460\u2461\u2462\u2463\u2464'[i]} {appt.serviceName}
            </span>
            <span className="text-slate-500 text-xs ml-2">
              {appt.staffName} · {appt.durationMinutes} min
            </span>
          </div>
          <span className="text-pink-500 text-sm font-semibold">
            {formatPrice(appt.price)}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

Where `groupedAppointments` is computed by filtering all appointments by the same `group_id`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/AppointmentDetails.tsx
git commit -m "feat: show grouped services in AppointmentDetails view"
```

---

## Task 16: End-to-End Smoke Test & Polish

- [ ] **Step 1: Full manual test flow**

Run: `npm run dev`

Test the complete flow:
1. Navigate to Appointments → click "Nouveau"
2. Search for an existing client → select
3. Clear client → click "Nouveau" → fill inline form (prénom, téléphone)
4. Select a service category tab → click a service card → select a variant
5. Observe right panel: verify duration + price update in summary
6. Select a staff member → verify unavailable hours are dimmed
7. Pick a date on the calendar → pick an hour → pick minutes
8. Toggle reminder on → select "1h avant"
9. Click "Ajouter un service" → configure second service
10. Switch between service tabs in right panel
11. Click "Enregistrer" → verify toast "Rendez-vous créé"
12. View the created appointment in the list
13. Click the appointment → verify grouped services display in details

- [ ] **Step 2: Fix any layout/styling issues found during testing**

Common things to check:
- Mobile responsive stacking (resize browser to < 768px)
- Category tabs overflow scrolling
- Long service names truncation
- Empty states (no services in a category, no staff with the right skills)

- [ ] **Step 3: Final production build check**

Run: `npm run build`

Expected: Clean build with no errors or warnings.

- [ ] **Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: appointment builder polish and layout fixes"
```
