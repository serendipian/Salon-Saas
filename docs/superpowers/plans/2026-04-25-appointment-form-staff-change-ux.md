# Appointment Form Staff-Change UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop wiping date/time when the user changes staff in the appointment form; surface availability conflicts (including cross-block intra-form double-booking) in place; replace silent disabled-save-button behavior with a live "what's missing" hint, a shake/pulse on the missing section, and a toast.

**Architecture:** A new pure helper `deriveBlockConflicts` runs across all service blocks of the in-progress form, producing per-block conflict descriptors (DB conflict, off-day, sibling overlap). `useAppointmentForm` exposes that map plus `missingFields` and `canSubmit` derivations, and stops wiping date/time on staff change. New presentational components (`BlockConflictBanner`, `MissingFieldsHint`) render the diagnostics. A small `useShake` hook + CSS keyframe drives the click-when-disabled feedback. Save buttons become always-clickable with a screen-aware fallback path that scrolls + shakes the first missing field and toasts the missing list.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind CSS 4, Vitest. UI in French.

**Spec reference:** [docs/superpowers/specs/2026-04-25-appointment-form-staff-change-ux-design.md](../specs/2026-04-25-appointment-form-staff-change-ux-design.md).

---

## File map

**Create:**
- `modules/appointments/utils/deriveBlockConflicts.ts` — pure conflict derivation
- `modules/appointments/utils/deriveBlockConflicts.test.ts`
- `modules/appointments/utils/missingFields.ts` — `missingFields` builder + `humanizeMissing`
- `modules/appointments/utils/missingFields.test.ts`
- `modules/appointments/components/BlockConflictBanner.tsx` — amber banner
- `modules/appointments/components/MissingFieldsHint.tsx` — "Encore requis : …" line
- `hooks/useShake.ts` — toggles `data-shake` on a target ref for 800ms
- `lib/format.ts` (modify) — add `formatLongDate`, `formatHour`

**Modify:**
- `modules/appointments/hooks/useAppointmentForm.ts` — remove the wipe; add `blockConflicts`, `missingFields`, `canSubmit`, `isStaffAvailableForSlot`
- `modules/appointments/components/StaffPills.tsx` — availability dimming + "Indisponible" subtitle
- `modules/appointments/components/StaffCalendarPanel.tsx` — mount conflict banner; read-only calendar when staff null but date/time exists
- `modules/appointments/components/ServiceBlock.tsx` — inline "Conflit horaire" indicator on summary
- `modules/appointments/components/AppointmentBuilder.tsx` — hint above save button; always-clickable handler
- `modules/appointments/components/AppointmentBuilderMobile.tsx` — banner in screen 2, 4-state chips, hint in footers, screen-aware shake/scroll
- `src/index.css` — `@keyframes shake` + `[data-shake="true"]` rule

---

## Task 1: `formatLongDate` and `formatHour` in `lib/format.ts`

**Files:**
- Modify: `lib/format.ts`
- Test: (inline — these are too small to merit a separate file; sanity-checked via the helpers that consume them)

Used by `BlockConflictBanner` to render French date/time strings. Existing `formatPrice` / `formatDuration` / `formatName` already live in this file; same conventions.

- [ ] **Step 1: Add the two helpers**

Append to `lib/format.ts`:

```ts
/**
 * Format a YYYY-MM-DD string as a long French date.
 *   "2026-04-25" → "25 avril 2026"
 * Parses as local midnight (matches the rest of the form's date handling).
 */
export function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format an hour (0-23) and optional minute (0-59) as "HH:MM".
 *   formatHour(10)        → "10:00"
 *   formatHour(10, 30)    → "10:30"
 */
export function formatHour(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/format.ts
git commit -m "feat(format): add formatLongDate and formatHour helpers"
```

---

## Task 2: `deriveBlockConflicts` pure helper + tests

**Files:**
- Create: `modules/appointments/utils/deriveBlockConflicts.ts`
- Create: `modules/appointments/utils/deriveBlockConflicts.test.ts`

The core piece. Pure function — no React, no Supabase. Takes the form's blocks plus the existing-appointments list and produces per-block conflict descriptors.

- [ ] **Step 1: Write the failing test file**

Create `modules/appointments/utils/deriveBlockConflicts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Appointment, Service, ServiceBlockState, StaffMember, WorkSchedule } from '../../../types';
import { AppointmentStatus } from '../../../types';
import { deriveBlockConflicts } from './deriveBlockConflicts';

const fullDaySchedule: WorkSchedule = {
  monday:    { isOpen: true, start: '09:00', end: '20:00' },
  tuesday:   { isOpen: true, start: '09:00', end: '20:00' },
  wednesday: { isOpen: true, start: '09:00', end: '20:00' },
  thursday:  { isOpen: true, start: '09:00', end: '20:00' },
  friday:    { isOpen: true, start: '09:00', end: '20:00' },
  saturday:  { isOpen: true, start: '09:00', end: '20:00' },
  sunday:    { isOpen: true, start: '09:00', end: '20:00' },
};

const sundayClosedSchedule: WorkSchedule = {
  ...fullDaySchedule,
  sunday: { isOpen: false, start: '09:00', end: '20:00' },
};

const mkStaff = (id: string, firstName: string, schedule: WorkSchedule = fullDaySchedule): StaffMember => ({
  id,
  firstName,
  lastName: 'D',
  email: '',
  phone: '',
  role: 'STYLIST',
  active: true,
  skills: ['cat-1'],
  color: 'bg-rose-100 text-rose-800',
  schedule,
  hireDate: '2024-01-01',
  photoUrl: null,
} as StaffMember);

const mkService = (id: string, durationMinutes: number, categoryId = 'cat-1'): Service => ({
  id,
  name: `Service ${id}`,
  categoryId,
  durationMinutes,
  price: 100,
  description: '',
  variants: [{ id: `${id}-v1`, name: '', durationMinutes, price: 100, sortOrder: 0 }],
  active: true,
  isFavorite: false,
} as Service);

const mkBlock = (overrides: Partial<ServiceBlockState>): ServiceBlockState => ({
  id: overrides.id ?? crypto.randomUUID(),
  categoryId: 'cat-1',
  items: [{ serviceId: 'svc-1', variantId: 'svc-1-v1' }],
  staffId: null,
  date: null,
  hour: null,
  minute: 0,
  ...overrides,
});

const mkExistingAppt = (overrides: Partial<Appointment>): Appointment => ({
  id: 'a1',
  clientId: 'c1',
  clientName: '',
  serviceId: 'svc-x',
  serviceName: '',
  variantId: 'svc-x-v1',
  variantName: '',
  date: '2026-04-27T10:00:00.000',
  durationMinutes: 60,
  staffId: 'st-1',
  staffName: '',
  status: AppointmentStatus.SCHEDULED,
  price: 100,
  groupId: null,
  ...overrides,
} as Appointment);

const services: Service[] = [mkService('svc-1', 60), mkService('svc-2', 30)];

describe('deriveBlockConflicts', () => {
  const staff1 = mkStaff('st-1', 'Marie');
  const team = [staff1, mkStaff('st-2', 'Sara')];

  it('returns empty map when no blocks have staff+date+hour', () => {
    const blocks = [mkBlock({ staffId: null })];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('flags staff_offday when staff does not work that day', () => {
    const sundayStaff = mkStaff('st-3', 'Lina', sundayClosedSchedule);
    // 2026-04-26 is a Sunday
    const blocks = [mkBlock({ staffId: 'st-3', date: '2026-04-26', hour: 10 })];
    const result = deriveBlockConflicts({
      blocks,
      team: [sundayStaff],
      services,
      existingAppointments: [],
    });
    expect(result.get(0)?.kind).toBe('staff_offday');
    expect(result.get(0)?.staffName).toBe('Lina D.');
  });

  it('flags staff_unavailable when slot overlaps an existing appointment', () => {
    const blocks = [mkBlock({ staffId: 'st-1', date: '2026-04-27', hour: 10 })];
    const existing = [
      mkExistingAppt({ id: 'a-existing', staffId: 'st-1', date: '2026-04-27T10:30:00.000', durationMinutes: 60 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: existing });
    expect(result.get(0)?.kind).toBe('staff_unavailable');
  });

  it('honors excludeAppointmentIds (edit mode)', () => {
    const blocks = [mkBlock({ staffId: 'st-1', date: '2026-04-27', hour: 10 })];
    const existing = [
      mkExistingAppt({ id: 'a-edited', staffId: 'st-1', date: '2026-04-27T10:00:00.000', durationMinutes: 60 }),
    ];
    const result = deriveBlockConflicts({
      blocks,
      team,
      services,
      existingAppointments: existing,
      excludeAppointmentIds: ['a-edited'],
    });
    expect(result.size).toBe(0);
  });

  it('flags sibling_overlap when two blocks share staff at exact same minute', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.get(0)?.kind).toBe('sibling_overlap');
    expect(result.get(1)?.kind).toBe('sibling_overlap');
  });

  it('flags sibling_overlap on partial time overlap', () => {
    // svc-1 = 60min. b1 at 10:00-11:00, b2 at 10:30-11:30
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10, minute: 0 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 10, minute: 30 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.get(0)?.kind).toBe('sibling_overlap');
    expect(result.get(1)?.kind).toBe('sibling_overlap');
  });

  it('does NOT flag sibling_overlap for contiguous-not-overlapping blocks (back-to-back)', () => {
    // b1 = 10:00-11:00, b2 = 11:00-12:00, same staff, different end/start touching
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10, minute: 0 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 11, minute: 0 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('does NOT flag sibling_overlap when staff differ', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-2', date: '2026-04-27', hour: 10 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('skips blocks without staffId, date, or hour', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: null, date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: null, hour: 10 }),
      mkBlock({ id: 'b3', staffId: 'st-1', date: '2026-04-27', hour: null }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('prioritizes sibling_overlap over staff_unavailable when both apply', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
    ];
    const existing = [
      mkExistingAppt({ id: 'a-existing', staffId: 'st-1', date: '2026-04-27T10:00:00.000', durationMinutes: 60 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: existing });
    expect(result.get(0)?.kind).toBe('sibling_overlap');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run modules/appointments/utils/deriveBlockConflicts.test.ts`
Expected: FAIL with `Cannot find module './deriveBlockConflicts'`.

- [ ] **Step 3: Write the implementation**

Create `modules/appointments/utils/deriveBlockConflicts.ts`:

```ts
import type { Appointment, Service, ServiceBlockState, StaffMember, WorkSchedule } from '../../../types';

export type BlockConflict =
  | { kind: 'staff_unavailable'; staffName: string; date: string; hour: number; minute: number }
  | { kind: 'staff_offday'; staffName: string; date: string }
  | { kind: 'sibling_overlap'; staffName: string; otherBlockLabel: string };

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function staffName(staff: StaffMember): string {
  return staff.lastName ? `${staff.firstName} ${staff.lastName[0]}.` : staff.firstName;
}

function blockDuration(block: ServiceBlockState, services: Service[]): number {
  return block.items.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    const variant = svc?.variants.find((v) => v.id === item.variantId);
    return sum + (variant?.durationMinutes ?? svc?.durationMinutes ?? 0);
  }, 0);
}

function blockLabel(block: ServiceBlockState, services: Service[]): string {
  if (block.items.length === 0) return 'Prestation';
  if (block.items.length > 1) return `${block.items.length} prestations`;
  const svc = services.find((s) => s.id === block.items[0].serviceId);
  return svc?.name ?? 'Prestation';
}

function parseLocalDateTimeMinutes(date: string, hour: number, minute: number): number {
  // Convert YYYY-MM-DD + hour + minute → minutes since midnight (local-time semantics)
  return hour * 60 + minute;
}

function dayOfWeekKey(date: string): keyof WorkSchedule {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return DAY_KEYS[dow];
}

interface DeriveInput {
  blocks: ServiceBlockState[];
  team: StaffMember[];
  services: Service[];
  existingAppointments: Appointment[];
  excludeAppointmentIds?: string[];
}

export function deriveBlockConflicts(input: DeriveInput): Map<number, BlockConflict> {
  const { blocks, team, services, existingAppointments, excludeAppointmentIds } = input;
  const result = new Map<number, BlockConflict>();
  const excludeSet = new Set(excludeAppointmentIds ?? []);

  // Pre-compute each block's effective time window (only for blocks with staff+date+hour+items).
  type Slot = { staffId: string; date: string; startMin: number; endMin: number };
  const slots: Array<Slot | null> = blocks.map((b) => {
    if (!b.staffId || !b.date || b.hour === null || b.items.length === 0) return null;
    const start = parseLocalDateTimeMinutes(b.date, b.hour, b.minute);
    const end = start + blockDuration(b, services);
    return { staffId: b.staffId, date: b.date, startMin: start, endMin: end };
  });

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const slot = slots[i];
    if (!slot) continue;

    const staff = team.find((m) => m.id === slot.staffId);
    if (!staff) continue;
    const name = staffName(staff);

    // 1. Sibling overlap (highest priority).
    let siblingFound: { otherIndex: number } | null = null;
    for (let j = 0; j < blocks.length; j++) {
      if (j === i) continue;
      const other = slots[j];
      if (!other) continue;
      if (other.staffId !== slot.staffId) continue;
      if (other.date !== slot.date) continue;
      // Half-open intervals [start, end). Touching endpoints don't overlap.
      if (slot.startMin < other.endMin && other.startMin < slot.endMin) {
        siblingFound = { otherIndex: j };
        break;
      }
    }
    if (siblingFound) {
      result.set(i, {
        kind: 'sibling_overlap',
        staffName: name,
        otherBlockLabel: blockLabel(blocks[siblingFound.otherIndex], services),
      });
      continue;
    }

    // 2. Staff off-day.
    const dayKey = dayOfWeekKey(slot.date);
    const daySched = staff.schedule?.[dayKey];
    if (!daySched?.isOpen) {
      result.set(i, { kind: 'staff_offday', staffName: name, date: slot.date });
      continue;
    }

    // 3. DB conflict against existing non-cancelled appointments.
    for (const appt of existingAppointments) {
      if (excludeSet.has(appt.id)) continue;
      if (appt.staffId !== slot.staffId) continue;
      if (appt.status === 'CANCELLED') continue;
      const apptDate = new Date(appt.date);
      const apptLocalDate = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
      if (apptLocalDate !== slot.date) continue;
      const apptStart = apptDate.getHours() * 60 + apptDate.getMinutes();
      const apptEnd = apptStart + appt.durationMinutes;
      if (slot.startMin < apptEnd && apptStart < slot.endMin) {
        result.set(i, {
          kind: 'staff_unavailable',
          staffName: name,
          date: slot.date,
          hour: block.hour ?? 0,
          minute: block.minute,
        });
        break;
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run modules/appointments/utils/deriveBlockConflicts.test.ts`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/utils/deriveBlockConflicts.ts modules/appointments/utils/deriveBlockConflicts.test.ts
git commit -m "feat(appointments): pure deriveBlockConflicts with cross-block check"
```

---

## Task 3: `missingFields` builder + `humanizeMissing` + tests

**Files:**
- Create: `modules/appointments/utils/missingFields.ts`
- Create: `modules/appointments/utils/missingFields.test.ts`

Pure helpers for the live "Encore requis : …" hint and the toast message.

- [ ] **Step 1: Write the failing test file**

Create `modules/appointments/utils/missingFields.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ServiceBlockState } from '../../../types';
import { buildMissingFields, humanizeMissing } from './missingFields';

const mkBlock = (overrides: Partial<ServiceBlockState>): ServiceBlockState => ({
  id: overrides.id ?? crypto.randomUUID(),
  categoryId: 'cat-1',
  items: [],
  staffId: null,
  date: null,
  hour: null,
  minute: 0,
  ...overrides,
});

describe('buildMissingFields', () => {
  it('reports client missing when no clientId and no newClient', () => {
    const result = buildMissingFields({
      clientId: null,
      newClient: null,
      blocks: [mkBlock({ items: [{ serviceId: 's', variantId: 'v' }], staffId: 'st', date: '2026-04-27', hour: 10 })],
    });
    expect(result).toContainEqual({ kind: 'client' });
  });

  it('does not report client missing when newClient is set', () => {
    const result = buildMissingFields({
      clientId: null,
      newClient: { firstName: 'A', lastName: 'B', phone: '+33' },
      blocks: [mkBlock({ items: [{ serviceId: 's', variantId: 'v' }], staffId: 'st', date: '2026-04-27', hour: 10 })],
    });
    expect(result.some((f) => f.kind === 'client')).toBe(false);
  });

  it('reports service missing per empty block', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [mkBlock({}), mkBlock({})],
    });
    expect(result.filter((f) => f.kind === 'service')).toHaveLength(2);
    expect(result[0]).toEqual({ kind: 'service', blockIndex: 0 });
    expect(result[1]).toEqual({ kind: 'service', blockIndex: 1 });
  });

  it('reports staff missing only when block has items but no staffId AND staffConfirmed is not true', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({ items: [{ serviceId: 's', variantId: 'v' }], staffId: null, staffConfirmed: false }),
      ],
    });
    expect(result).toContainEqual({ kind: 'staff', blockIndex: 0 });
  });

  it('does NOT report staff missing when staffConfirmed=true (explicit "Aucun")', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({ items: [{ serviceId: 's', variantId: 'v' }], staffId: null, staffConfirmed: true, date: '2026-04-27', hour: 10 }),
      ],
    });
    expect(result.some((f) => f.kind === 'staff')).toBe(false);
  });

  it('reports datetime missing when block has items + staff but no date or hour', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({ items: [{ serviceId: 's', variantId: 'v' }], staffId: 'st', date: null, hour: null }),
      ],
    });
    expect(result).toContainEqual({ kind: 'datetime', blockIndex: 0 });
  });

  it('returns empty array when fully complete', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({ items: [{ serviceId: 's', variantId: 'v' }], staffId: 'st', date: '2026-04-27', hour: 10 }),
      ],
    });
    expect(result).toEqual([]);
  });
});

describe('humanizeMissing', () => {
  it('joins unique kinds in fixed order with French labels', () => {
    expect(
      humanizeMissing([
        { kind: 'datetime', blockIndex: 0 },
        { kind: 'client' },
        { kind: 'datetime', blockIndex: 1 },
        { kind: 'service', blockIndex: 0 },
      ]),
    ).toBe('Client, Service, Date & heure');
  });

  it('returns empty string for empty array', () => {
    expect(humanizeMissing([])).toBe('');
  });

  it('handles single missing field', () => {
    expect(humanizeMissing([{ kind: 'staff', blockIndex: 0 }])).toBe('Membre');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run modules/appointments/utils/missingFields.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `modules/appointments/utils/missingFields.ts`:

```ts
import type { ServiceBlockState } from '../../../types';

export type MissingField =
  | { kind: 'client' }
  | { kind: 'service'; blockIndex: number }
  | { kind: 'staff'; blockIndex: number }
  | { kind: 'datetime'; blockIndex: number };

interface BuildInput {
  clientId: string | null;
  newClient: { firstName: string; lastName: string; phone: string } | null;
  blocks: ServiceBlockState[];
}

export function buildMissingFields(input: BuildInput): MissingField[] {
  const { clientId, newClient, blocks } = input;
  const out: MissingField[] = [];

  if (!clientId && !newClient) out.push({ kind: 'client' });

  blocks.forEach((b, i) => {
    if (b.items.length === 0) {
      out.push({ kind: 'service', blockIndex: i });
      return;
    }
    if (!b.staffId && b.staffConfirmed !== true) {
      out.push({ kind: 'staff', blockIndex: i });
    }
    if (!b.date || b.hour === null) {
      out.push({ kind: 'datetime', blockIndex: i });
    }
  });

  return out;
}

const ORDER: MissingField['kind'][] = ['client', 'service', 'staff', 'datetime'];
const LABELS: Record<MissingField['kind'], string> = {
  client: 'Client',
  service: 'Service',
  staff: 'Membre',
  datetime: 'Date & heure',
};

export function humanizeMissing(fields: MissingField[]): string {
  if (fields.length === 0) return '';
  const kinds = new Set(fields.map((f) => f.kind));
  return ORDER.filter((k) => kinds.has(k)).map((k) => LABELS[k]).join(', ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run modules/appointments/utils/missingFields.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/utils/missingFields.ts modules/appointments/utils/missingFields.test.ts
git commit -m "feat(appointments): missingFields builder + humanizeMissing"
```

---

## Task 4: Shake CSS keyframe + `useShake` hook

**Files:**
- Modify: `src/index.css`
- Create: `hooks/useShake.ts`

Tiny utility that the click-when-disabled handler uses to nudge the missing element. CSS keyframe is global.

- [ ] **Step 1: Add the keyframe to `src/index.css`**

Append to the bottom of `src/index.css`:

```css
/* Shake animation for invalid-action feedback */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
[data-shake='true'] {
  animation: shake 400ms ease-in-out 2;
}
```

- [ ] **Step 2: Write `hooks/useShake.ts`**

Create `hooks/useShake.ts`:

```ts
import { useCallback, useRef } from 'react';

/**
 * Triggers the shake animation on a target element by toggling
 * `data-shake="true"` for 800ms. The element must be rendered and have its
 * ref attached. Subsequent calls within the active window are debounced.
 */
export function useShake() {
  const activeUntilRef = useRef(0);

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const now = Date.now();
    if (now < activeUntilRef.current) return; // already shaking
    activeUntilRef.current = now + 800;
    el.setAttribute('data-shake', 'true');
    setTimeout(() => {
      el.removeAttribute('data-shake');
    }, 800);
  }, []);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.css hooks/useShake.ts
git commit -m "feat(ui): shake animation + useShake hook"
```

---

## Task 5: `useAppointmentForm` — remove wipe, add derivations

**Files:**
- Modify: `modules/appointments/hooks/useAppointmentForm.ts`

Stop wiping date/time on staff change; expose `blockConflicts`, `missingFields`, `canSubmit`, `hasAnyConflict`, `isStaffAvailableForSlot`.

- [ ] **Step 1: Update imports**

In `modules/appointments/hooks/useAppointmentForm.ts`, replace the existing import block at the top with one that adds the new utility imports. Find:

```ts
import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { formatDuration, formatPrice } from '../../../lib/format';
import type {
  Appointment,
  AppointmentStatus,
  Client,
  FavoriteItem,
  Pack,
  Service,
  ServiceBlockState,
  ServiceCategory,
  StaffMember,
} from '../../../types';
import { appointmentGroupSchema, newClientSchema } from '../schemas';
import { useStaffAvailability } from './useStaffAvailability';
```

Replace with:

```ts
import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { formatDuration, formatPrice } from '../../../lib/format';
import type {
  Appointment,
  AppointmentStatus,
  Client,
  FavoriteItem,
  Pack,
  Service,
  ServiceBlockState,
  ServiceCategory,
  StaffMember,
} from '../../../types';
import { appointmentGroupSchema, newClientSchema } from '../schemas';
import { type BlockConflict, deriveBlockConflicts } from '../utils/deriveBlockConflicts';
import { type MissingField, buildMissingFields } from '../utils/missingFields';
import { useStaffAvailability } from './useStaffAvailability';
```

- [ ] **Step 2: Remove the date/time wipe in `updateBlock`**

Find ([useAppointmentForm.ts:227-238](../../modules/appointments/hooks/useAppointmentForm.ts#L227-L238)):

```ts
  const updateBlock = useCallback((index: number, updates: Partial<ServiceBlockState>) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        // When staff changes, reset date & time (availability depends on staff)
        if ('staffId' in updates && updates.staffId !== b.staffId) {
          return { ...b, ...updates, date: null, hour: null, minute: 0 };
        }
        return { ...b, ...updates };
      }),
    );
  }, []);
```

Replace with:

```ts
  const updateBlock = useCallback((index: number, updates: Partial<ServiceBlockState>) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        // M-25: Date/time intentionally NOT wiped on staff change. The new
        // blockConflicts derivation surfaces stale-time mismatches as a
        // visible amber banner instead of silently erasing user input.
        return { ...b, ...updates };
      }),
    );
  }, []);
```

- [ ] **Step 3: Add the new derivations**

Find this block in `useAppointmentForm.ts` (right after `availabilityAppointments` and `unavailableHours` are computed, before `totalDuration`):

```ts
  // Staff availability for active block
  const unavailableHours = useStaffAvailability(
    activeStaff,
    activeBlock?.date ?? null,
    activeBlockDuration || 30,
    availabilityAppointments,
  );

  // Totals & completeness
```

Insert immediately before `// Totals & completeness`:

```ts
  // Per-block conflict derivation (covers DB conflicts, off-day, sibling overlap).
  const blockConflicts = useMemo(
    () =>
      deriveBlockConflicts({
        blocks: serviceBlocks,
        team,
        services,
        existingAppointments: availabilityAppointments,
        excludeAppointmentIds,
      }),
    [serviceBlocks, team, services, availabilityAppointments, excludeAppointmentIds],
  );

  const hasAnyConflict = blockConflicts.size > 0;

  const missingFields = useMemo<MissingField[]>(
    () => buildMissingFields({ clientId, newClient, blocks: serviceBlocks }),
    [clientId, newClient, serviceBlocks],
  );

  /**
   * Probe: would this staff be available if we placed them at the given
   * (date, hour, minute) for the block at blockIndex's duration?
   * Used by StaffPills to dim unavailable members for the active slot.
   */
  const isStaffAvailableForSlot = useCallback(
    (staffId: string, date: string, hour: number, minute: number, blockIndex: number): boolean => {
      const block = serviceBlocks[blockIndex];
      if (!block) return true;
      const probe: ServiceBlockState = { ...block, staffId, date, hour, minute };
      const probeBlocks = serviceBlocks.map((b, i) => (i === blockIndex ? probe : b));
      const result = deriveBlockConflicts({
        blocks: probeBlocks,
        team,
        services,
        existingAppointments: availabilityAppointments,
        excludeAppointmentIds,
      });
      return !result.has(blockIndex);
    },
    [serviceBlocks, team, services, availabilityAppointments, excludeAppointmentIds],
  );
```

- [ ] **Step 4: Add `canSubmit` flag**

Find:

```ts
  const allBlocksScheduled = serviceBlocks.every(
    (b) => b.items.length > 0 && b.date && b.hour !== null,
  );
```

Append immediately after:

```ts
  // Save is only allowed when nothing is missing AND there are no conflicts.
  // Kept separate from `allBlocksScheduled` so existing callers (mobile screen 1
  // gate) keep their narrower meaning.
  const canSubmit = missingFields.length === 0 && !hasAnyConflict;
```

- [ ] **Step 5: Pre-submit conflict guard inside `handleSubmit`**

Find the start of `handleSubmit`:

```ts
  // Submit — expand each block's items[] into sequential appointment rows
  const handleSubmit = useCallback(async () => {
    const effectiveClientId = newClient ? 'pending-new-client' : (clientId ?? '');
```

Insert immediately after the line `const effectiveClientId = ...;`:

```ts
    // Realtime safety: if remote data made the form conflict-prone since the
    // user last looked, refuse to submit and let the visible banners do the
    // talking.
    if (hasAnyConflict) {
      addToast({
        type: 'warning',
        message: 'Conflit de planning. Modifiez le membre ou le créneau pour continuer.',
      });
      return;
    }
```

Then update the dependency array of `handleSubmit` (currently ends with `addToast`) to include `hasAnyConflict`. Find:

```ts
  }, [
    newClient,
    clientId,
    serviceBlocks,
    status,
    notes,
    reminderMinutes,
    validate,
    services,
    onSave,
    addToast,
  ]);
```

Replace with:

```ts
  }, [
    newClient,
    clientId,
    serviceBlocks,
    status,
    notes,
    reminderMinutes,
    validate,
    services,
    onSave,
    addToast,
    hasAnyConflict,
  ]);
```

- [ ] **Step 6: Expose new return values + types**

Find the `AppointmentFormReturn` interface (top of file). Add the following properties to the `// Derived` section, before the existing line `unavailableHours: Set<number>;`:

```ts
  blockConflicts: Map<number, BlockConflict>;
  hasAnyConflict: boolean;
  missingFields: MissingField[];
  canSubmit: boolean;
```

Add to the `// Helpers` section (alongside `getBlockSummary` / `handleSubmit`):

```ts
  isStaffAvailableForSlot: (
    staffId: string,
    date: string,
    hour: number,
    minute: number,
    blockIndex: number,
  ) => boolean;
```

Find the final `return { … }` of `useAppointmentForm`. Add to the `// Derived` block:

```ts
    blockConflicts,
    hasAnyConflict,
    missingFields,
    canSubmit,
```

Add to the `// Helpers` block:

```ts
    isStaffAvailableForSlot,
```

- [ ] **Step 7: Typecheck + run all tests**

Run: `npx tsc --noEmit && npx vitest run modules/appointments`
Expected: typecheck clean; appointments tests pass.

- [ ] **Step 8: Commit**

```bash
git add modules/appointments/hooks/useAppointmentForm.ts
git commit -m "feat(appointments): preserve date/time on staff change; expose blockConflicts/missingFields/canSubmit"
```

---

## Task 6: `BlockConflictBanner` component

**Files:**
- Create: `modules/appointments/components/BlockConflictBanner.tsx`

- [ ] **Step 1: Write the component**

Create `modules/appointments/components/BlockConflictBanner.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react';
import { formatHour, formatLongDate } from '../../../lib/format';
import type { BlockConflict } from '../utils/deriveBlockConflicts';

interface Props {
  conflict: BlockConflict | undefined;
}

export default function BlockConflictBanner({ conflict }: Props) {
  if (!conflict) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>
        {conflict.kind === 'staff_unavailable' && (
          <>
            <strong>{conflict.staffName}</strong> n'est pas disponible le{' '}
            {formatLongDate(conflict.date)} à {formatHour(conflict.hour, conflict.minute)}.
          </>
        )}
        {conflict.kind === 'staff_offday' && (
          <>
            <strong>{conflict.staffName}</strong> ne travaille pas le {formatLongDate(conflict.date)}.
          </>
        )}
        {conflict.kind === 'sibling_overlap' && (
          <>
            Conflit avec un autre service de ce rendez-vous : <strong>{conflict.staffName}</strong>{' '}
            est déjà réservée pour « {conflict.otherBlockLabel} ».
          </>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/BlockConflictBanner.tsx
git commit -m "feat(appointments): BlockConflictBanner component"
```

---

## Task 7: `MissingFieldsHint` component

**Files:**
- Create: `modules/appointments/components/MissingFieldsHint.tsx`

- [ ] **Step 1: Write the component**

Create `modules/appointments/components/MissingFieldsHint.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { humanizeMissing } from '../utils/missingFields';
import type { MissingField } from '../utils/missingFields';

interface Props {
  missingFields: MissingField[];
  pulseTrigger?: number; // bump this number to retrigger the pulse
  className?: string;
}

export default function MissingFieldsHint({ missingFields, pulseTrigger = 0, className = '' }: Props) {
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (pulseTrigger === 0) return;
    const el = ref.current;
    if (!el) return;
    el.classList.add('animate-pulse');
    const timer = setTimeout(() => el.classList.remove('animate-pulse'), 1000);
    return () => clearTimeout(timer);
  }, [pulseTrigger]);

  if (missingFields.length === 0) return null;

  return (
    <p ref={ref} className={`text-xs text-amber-700 text-center ${className}`}>
      Encore requis : <strong>{humanizeMissing(missingFields)}</strong>
    </p>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/MissingFieldsHint.tsx
git commit -m "feat(appointments): MissingFieldsHint with pulse on retrigger"
```

---

## Task 8: `StaffPills` — availability dimming + "Indisponible" subtitle

**Files:**
- Modify: `modules/appointments/components/StaffPills.tsx`

- [ ] **Step 1: Add availability prop and rendering**

Replace the entire contents of `modules/appointments/components/StaffPills.tsx` with:

```tsx
import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { StaffAvatar } from '../../../components/StaffAvatar';
import type { StaffMember } from '../../../types';

interface StaffPillsProps {
  team: StaffMember[];
  categoryId: string | null;
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
  hideLabel?: boolean;
  /**
   * Optional: when supplied, returns true if the staff is available for the
   * current slot. Pills for unavailable staff are dimmed and show an
   * "Indisponible" subtitle. Returning true (or omitting the prop) renders
   * the pill normally. Pills stay clickable either way — the user might pick
   * a staff first and adjust the time afterward.
   */
  isStaffAvailable?: (staffId: string) => boolean;
}

export default function StaffPills({
  team,
  categoryId,
  selectedStaffId,
  onSelect,
  hideLabel,
  isStaffAvailable,
}: StaffPillsProps) {
  const eligibleStaff = useMemo(() => {
    if (!categoryId) return team.filter((m) => m.active);
    return team.filter((m) => m.active && m.skills.includes(categoryId));
  }, [team, categoryId]);

  return (
    <div>
      {!hideLabel && <div className="text-xs font-medium text-slate-500 mb-2">Équipe</div>}
      <div className="flex gap-2 flex-wrap">
        {eligibleStaff.map((member) => {
          const isSelected = member.id === selectedStaffId;
          const available = isStaffAvailable ? isStaffAvailable(member.id) : true;
          const label = member.lastName
            ? `${member.firstName} ${member.lastName[0]}.`
            : member.firstName;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : member.id)}
              className={`px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-blue-500 text-white font-medium shadow-sm'
                  : available
                    ? 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                    : 'bg-white border border-amber-200 text-slate-500 opacity-70 hover:border-amber-300'
              }`}
            >
              <StaffAvatar
                firstName={member.firstName}
                lastName={member.lastName}
                photoUrl={member.photoUrl}
                color={isSelected ? 'rgba(255,255,255,0.3)' : 'bg-blue-100 text-blue-700'}
                size={20}
              />
              <span className="flex flex-col items-start leading-tight">
                <span>{label}</span>
                {!isSelected && !available && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                    <Clock size={10} />
                    Indisponible
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/StaffPills.tsx
git commit -m "feat(appointments): dim unavailable staff in StaffPills with 'Indisponible' subtitle"
```

---

## Task 9: `StaffCalendarPanel` — banner mount + read-only calendar fallback

**Files:**
- Modify: `modules/appointments/components/StaffCalendarPanel.tsx`

- [ ] **Step 1: Update props and imports**

In `modules/appointments/components/StaffCalendarPanel.tsx`, replace the existing import block:

```tsx
import { Bell, Users } from 'lucide-react';
import { useMemo } from 'react';
import type { Service, ServiceBlockState, StaffMember } from '../../../types';
import InlineCalendar from './InlineCalendar';
import StaffPills from './StaffPills';
import TimePicker from './TimePicker';
```

Replace with:

```tsx
import { Bell, Users } from 'lucide-react';
import { useMemo } from 'react';
import type { Service, ServiceBlockState, StaffMember } from '../../../types';
import type { BlockConflict } from '../utils/deriveBlockConflicts';
import BlockConflictBanner from './BlockConflictBanner';
import InlineCalendar from './InlineCalendar';
import StaffPills from './StaffPills';
import TimePicker from './TimePicker';
```

Replace the existing `interface StaffCalendarPanelProps`:

```tsx
interface StaffCalendarPanelProps {
  activeBlock: ServiceBlockState | undefined;
  activeBlockIndex: number;
  team: StaffMember[];
  services: Service[];
  unavailableHours: Set<number>;
  onUpdateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
  reminderMinutes: number | null;
  onReminderChange: (minutes: number | null) => void;
}
```

With:

```tsx
interface StaffCalendarPanelProps {
  activeBlock: ServiceBlockState | undefined;
  activeBlockIndex: number;
  team: StaffMember[];
  services: Service[];
  unavailableHours: Set<number>;
  onUpdateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
  reminderMinutes: number | null;
  onReminderChange: (minutes: number | null) => void;
  conflict?: BlockConflict;
  isStaffAvailableForSlot?: (staffId: string) => boolean;
  conflictRef?: React.RefObject<HTMLDivElement | null>;
}
```

Update the destructuring at the top of the component:

```tsx
export default function StaffCalendarPanel({
  activeBlock,
  activeBlockIndex,
  team,
  services,
  unavailableHours,
  onUpdateBlock,
  reminderMinutes,
  onReminderChange,
  conflict,
  isStaffAvailableForSlot,
  conflictRef,
}: StaffCalendarPanelProps) {
```

- [ ] **Step 2: Pass `isStaffAvailable` to `StaffPills`**

Inside the existing `StaffPills` JSX (within the Step 3 panel), replace:

```tsx
            <StaffPills
              team={team}
              categoryId={firstItemCategoryId}
              selectedStaffId={activeBlock?.staffId ?? null}
              onSelect={(staffId) =>
                onUpdateBlock(activeBlockIndex, { staffId, staffConfirmed: staffId !== null })
              }
              hideLabel
            />
```

With:

```tsx
            <StaffPills
              team={team}
              categoryId={firstItemCategoryId}
              selectedStaffId={activeBlock?.staffId ?? null}
              onSelect={(staffId) =>
                onUpdateBlock(activeBlockIndex, { staffId, staffConfirmed: staffId !== null })
              }
              hideLabel
              isStaffAvailable={isStaffAvailableForSlot}
            />
```

- [ ] **Step 3: Replace the Step 4 panel body to mount the banner and the read-only fallback**

Find the existing Step 4 calendar block (the one rendering `<InlineCalendar value={activeBlock?.date ?? null} ...>` and the `Choisissez un membre` overlay). Replace the entire `<div className="relative">…</div>` that contains it with:

```tsx
        <div className="relative" ref={conflictRef}>
          {conflict && (
            <div className="mb-3">
              <BlockConflictBanner conflict={conflict} />
            </div>
          )}

          {hasStaff ? (
            <div className="space-y-4">
              <InlineCalendar
                value={activeBlock?.date ?? null}
                onChange={(date) => onUpdateBlock(activeBlockIndex, { date })}
              />
              <TimePicker
                hour={activeBlock?.hour ?? null}
                minute={activeBlock?.minute ?? 0}
                onHourChange={(hour) => onUpdateBlock(activeBlockIndex, { hour })}
                onMinuteChange={(minute) => onUpdateBlock(activeBlockIndex, { minute })}
                unavailableHours={unavailableHours}
                dateSelected={(activeBlock?.date ?? null) !== null}
              />
            </div>
          ) : activeBlock?.date || activeBlock?.hour !== null ? (
            // Read-only fallback when staff is null but date/time exist —
            // keep prior values visible rather than hiding under an overlay.
            <div className="space-y-4">
              <div className="opacity-60 pointer-events-none">
                <InlineCalendar
                  value={activeBlock?.date ?? null}
                  onChange={() => {}}
                />
                <TimePicker
                  hour={activeBlock?.hour ?? null}
                  minute={activeBlock?.minute ?? 0}
                  onHourChange={() => {}}
                  onMinuteChange={() => {}}
                  unavailableHours={new Set()}
                  dateSelected={(activeBlock?.date ?? null) !== null}
                />
              </div>
              <p className="text-xs text-slate-500 text-center italic">
                Sélectionnez un membre pour modifier l'heure.
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="opacity-40 pointer-events-none">
                <div className="space-y-4">
                  <InlineCalendar value={null} onChange={() => {}} />
                  <TimePicker
                    hour={null}
                    minute={0}
                    onHourChange={() => {}}
                    onMinuteChange={() => {}}
                    unavailableHours={new Set()}
                    dateSelected={false}
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg shadow-sm">
                  Choisissez un membre
                </span>
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/components/StaffCalendarPanel.tsx
git commit -m "feat(appointments): mount conflict banner + read-only calendar fallback in StaffCalendarPanel"
```

---

## Task 10: `ServiceBlock` (desktop) — inline conflict indicator

**Files:**
- Modify: `modules/appointments/components/ServiceBlock.tsx`

The desktop builder has no chip selector, so per-block conflict needs to live on the block component itself. Add a small amber pill to the block header when a conflict exists.

- [ ] **Step 1: Locate the file and inspect props**

Run: `grep -n "interface ServiceBlockProps\|export default\|summaryText" modules/appointments/components/ServiceBlock.tsx | head -10`

Confirm it has `summaryText` and a header section. (We expect this; if structure differs, adapt the next step accordingly.)

- [ ] **Step 2: Add `hasConflict` prop and indicator**

In `modules/appointments/components/ServiceBlock.tsx`, add `hasConflict?: boolean` to its props interface (next to `summaryText` / `stepOffset`).

In the destructured props at the top of the component, add `hasConflict`.

In the block header — wherever the block's summary text or step number renders — find the line that renders the summary or the title. Add the following just before the existing summary text element:

```tsx
{hasConflict && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 mr-2">
    Conflit horaire
  </span>
)}
```

If `ServiceBlock.tsx` has multiple plausible header locations, place the indicator immediately to the left of the summary line in the block's collapsed/header row. The exact insertion site is the first user-visible flex row of the block header.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/ServiceBlock.tsx
git commit -m "feat(appointments): inline 'Conflit horaire' indicator on desktop ServiceBlock header"
```

---

## Task 11: `AppointmentBuilder` (desktop) — hint + always-clickable save + shake

**Files:**
- Modify: `modules/appointments/components/AppointmentBuilder.tsx`

- [ ] **Step 1: Add imports and refs**

In `modules/appointments/components/AppointmentBuilder.tsx`, replace the existing imports at the top with:

```tsx
import { ArrowLeft, Plus, Save, Trash2, Users } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useShake } from '../../../hooks/useShake';
import type { FavoriteItem } from '../../../types';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import { humanizeMissing } from '../utils/missingFields';
import AppointmentSummary from './AppointmentSummary';
import ClientField from './ClientField';
import MissingFieldsHint from './MissingFieldsHint';
import ServiceBlock from './ServiceBlock';
import StaffCalendarPanel from './StaffCalendarPanel';
```

- [ ] **Step 2: Wire shake + scroll target refs**

Inside the component body, immediately after `const form = useAppointmentForm(hookProps);`, add:

```tsx
  const { addToast } = useToast();
  const shake = useShake();
  const [pulseTrigger, setPulseTrigger] = useState(0);

  // Refs for scroll-to-target on click-when-disabled.
  const clientPanelRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const conflictBannerRef = useRef<HTMLDivElement | null>(null);

  const setBlockRef = (i: number) => (el: HTMLDivElement | null) => {
    blockRefs.current.set(i, el);
  };

  const handleSaveClick = () => {
    if (form.canSubmit) {
      form.handleSubmit();
      return;
    }
    setPulseTrigger((n) => n + 1);
    const missing = form.missingFields;
    const conflictBlockIndex = form.blockConflicts.size > 0
      ? Array.from(form.blockConflicts.keys())[0]
      : null;

    let target: HTMLElement | null = null;
    if (missing.length > 0) {
      const first = missing[0];
      if (first.kind === 'client') target = clientPanelRef.current;
      else target = blockRefs.current.get(first.blockIndex) ?? null;
    } else if (conflictBlockIndex !== null) {
      target = conflictBannerRef.current ?? blockRefs.current.get(conflictBlockIndex) ?? null;
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      shake(target);
    }

    const message = missing.length > 0
      ? `Veuillez compléter : ${humanizeMissing(missing)}`
      : 'Conflit de planning. Modifiez le membre ou le créneau.';
    addToast({ type: 'warning', message });
  };
```

- [ ] **Step 3: Replace the save button + add the hint**

Find the existing save button block:

```tsx
          <button
            type="button"
            onClick={form.handleSubmit}
            disabled={form.isSaving}
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            <Save size={15} />
            {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
```

Replace with:

```tsx
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={form.isSaving}
              aria-disabled={!form.canSubmit}
              className={`bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2 ${
                form.canSubmit ? '' : 'opacity-50'
              }`}
            >
              <Save size={15} />
              {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <MissingFieldsHint
              missingFields={form.missingFields}
              pulseTrigger={pulseTrigger}
              className="text-right"
            />
          </div>
```

- [ ] **Step 4: Attach refs to the client panel and each block; pass conflict + availability to StaffCalendarPanel**

Find the Step 1 — Client outer div:

```tsx
          <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                  1
                </span>
                <span className="text-slate-900 text-base font-semibold">Client</span>
              </div>
```

Add the ref to its outer div. Replace the opening `<div className="border-2 …">` with:

```tsx
          <div ref={clientPanelRef} className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
```

Find the per-block render inside the Services subpanel:

```tsx
              {form.serviceBlocks.map((block, i) => (
                <div key={block.id}>
                  <ServiceBlock
                    block={block}
                    index={i}
                    isActive={i === form.activeBlockIndex}
                    services={hookProps.services}
                    categories={hookProps.categories}
                    favorites={allFavorites}
                    packs={hookProps.packs ?? []}
                    onAddPackBlocks={form.addPackBlocks}
                    onActivate={() => form.setActiveBlockIndex(i)}
                    onRemove={() => form.removeBlock(i)}
                    onUpdate={(updates) => form.updateBlock(i, updates)}
                    onToggleItem={(serviceId, variantId) =>
                      form.toggleBlockItem(i, serviceId, variantId)
                    }
                    onClearItems={() => form.clearBlockItems(i)}
                    summaryText={form.getBlockSummary(block)}
                    stepOffset={1}
                  />
                </div>
              ))}
```

Replace with:

```tsx
              {form.serviceBlocks.map((block, i) => (
                <div key={block.id} ref={setBlockRef(i)}>
                  <ServiceBlock
                    block={block}
                    index={i}
                    isActive={i === form.activeBlockIndex}
                    services={hookProps.services}
                    categories={hookProps.categories}
                    favorites={allFavorites}
                    packs={hookProps.packs ?? []}
                    onAddPackBlocks={form.addPackBlocks}
                    onActivate={() => form.setActiveBlockIndex(i)}
                    onRemove={() => form.removeBlock(i)}
                    onUpdate={(updates) => form.updateBlock(i, updates)}
                    onToggleItem={(serviceId, variantId) =>
                      form.toggleBlockItem(i, serviceId, variantId)
                    }
                    onClearItems={() => form.clearBlockItems(i)}
                    summaryText={form.getBlockSummary(block)}
                    stepOffset={1}
                    hasConflict={form.blockConflicts.has(i)}
                  />
                </div>
              ))}
```

Find the `<StaffCalendarPanel />` JSX and replace with:

```tsx
                <StaffCalendarPanel
                  activeBlock={form.activeBlock}
                  activeBlockIndex={form.activeBlockIndex}
                  team={hookProps.team}
                  services={hookProps.services}
                  unavailableHours={form.unavailableHours}
                  onUpdateBlock={form.updateBlock}
                  reminderMinutes={form.reminderMinutes}
                  onReminderChange={form.setReminderMinutes}
                  conflict={form.blockConflicts.get(form.activeBlockIndex)}
                  isStaffAvailableForSlot={(staffId) => {
                    const b = form.activeBlock;
                    if (!b?.date || b.hour === null) return true;
                    return form.isStaffAvailableForSlot(
                      staffId,
                      b.date,
                      b.hour,
                      b.minute,
                      form.activeBlockIndex,
                    );
                  }}
                  conflictRef={conflictBannerRef}
                />
```

- [ ] **Step 5: Typecheck + run tests**

Run: `npx tsc --noEmit && npx vitest run modules/appointments`
Expected: typecheck clean; tests pass.

- [ ] **Step 6: Commit**

```bash
git add modules/appointments/components/AppointmentBuilder.tsx
git commit -m "feat(appointments): desktop builder always-clickable save with shake/toast/hint"
```

---

## Task 12: `AppointmentBuilderMobile` — banner, 4-state chips, hint, screen-aware shake

**Files:**
- Modify: `modules/appointments/components/AppointmentBuilderMobile.tsx`

Most-touched file. Mobile has two screens; the click-when-disabled handler must navigate back to screen 1 if the missing field lives there.

- [ ] **Step 1: Update imports**

Replace the existing imports at the top of `modules/appointments/components/AppointmentBuilderMobile.tsx` with:

```tsx
import { AlertTriangle, ArrowLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useShake } from '../../../hooks/useShake';
import { formatDuration, formatName, formatPrice } from '../../../lib/format';
import type { AppointmentStatus } from '../../../types';
import { type UseAppointmentFormProps, useAppointmentForm } from '../hooks/useAppointmentForm';
import { humanizeMissing } from '../utils/missingFields';
import BlockConflictBanner from './BlockConflictBanner';
import InlineCalendar from './InlineCalendar';
import MissingFieldsHint from './MissingFieldsHint';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileClientSearch } from './MobileClientSearch';
import { MobileServicePicker } from './MobileServicePicker';
import ReminderToggle from './ReminderToggle';
import StaffPills from './StaffPills';
import TimePicker from './TimePicker';
```

- [ ] **Step 2: Add shake/toast plumbing + screen-aware pending-target state**

Inside the component body, immediately after `const form = useAppointmentForm(hookProps);`, add:

```tsx
  const { addToast } = useToast();
  const shake = useShake();
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<
    | { kind: 'client' }
    | { kind: 'service' | 'staff'; blockIndex: number }
    | { kind: 'datetime' | 'conflict'; blockIndex: number }
    | null
  >(null);

  // Screen-1 refs.
  const clientSectionRef = useRef<HTMLDivElement | null>(null);
  const screen1BlockRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const setScreen1BlockRef = (i: number) => (el: HTMLDivElement | null) => {
    screen1BlockRefs.current.set(i, el);
  };

  // Screen-2 refs.
  const screen2CalendarRef = useRef<HTMLDivElement | null>(null);
  const screen2BannerRef = useRef<HTMLDivElement | null>(null);

  // When we navigate back to screen 1 to surface a missing field, shake the
  // target on next paint.
  useEffect(() => {
    if (!pendingScrollTarget || screen !== 'services') return;
    let target: HTMLElement | null = null;
    if (pendingScrollTarget.kind === 'client') target = clientSectionRef.current;
    else if (pendingScrollTarget.kind === 'service' || pendingScrollTarget.kind === 'staff') {
      target = screen1BlockRefs.current.get(pendingScrollTarget.blockIndex) ?? null;
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      shake(target);
    }
    setPendingScrollTarget(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScrollTarget, screen]);
```

- [ ] **Step 3: Replace the screen 1 → screen 2 "Continuer" handler with the always-clickable variant**

Find the existing `Continuer` button on screen 1:

```tsx
          <button
            type="button"
            disabled={!form.hasCompleteServiceBlock}
            onClick={() => setScreen('scheduling')}
            className="w-full bg-blue-500 text-white py-3.5 rounded-2xl min-h-[52px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-600"
          >
            Continuer
            <ChevronRight size={18} />
          </button>
```

Replace with:

```tsx
          <button
            type="button"
            aria-disabled={!form.hasCompleteServiceBlock}
            onClick={() => {
              if (form.hasCompleteServiceBlock && (form.clientId || form.newClient)) {
                setScreen('scheduling');
                return;
              }
              setPulseTrigger((n) => n + 1);
              const missing = form.missingFields.filter(
                (f) => f.kind === 'client' || f.kind === 'service',
              );
              const first = missing[0];
              if (first?.kind === 'client') {
                setPendingScrollTarget({ kind: 'client' });
              } else if (first?.kind === 'service') {
                setPendingScrollTarget({ kind: 'service', blockIndex: first.blockIndex });
              }
              const message = missing.length > 0
                ? `Veuillez compléter : ${humanizeMissing(missing)}`
                : 'Veuillez compléter le formulaire.';
              addToast({ type: 'warning', message });
            }}
            className={`w-full bg-blue-500 text-white py-3.5 rounded-2xl min-h-[52px] font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-blue-600 ${
              form.hasCompleteServiceBlock && (form.clientId || form.newClient) ? '' : 'opacity-50'
            }`}
          >
            Continuer
            <ChevronRight size={18} />
          </button>
```

Also replace the existing serviceCount paragraph above the Continuer button:

```tsx
          {serviceCount > 0 && (
            <p className="text-xs text-slate-500 text-center">
              {serviceCount} service{serviceCount > 1 ? 's' : ''} &middot;{' '}
              {formatDuration(form.totalDuration)} &middot; {formatPrice(form.totalPrice)}
            </p>
          )}
```

With:

```tsx
          {form.missingFields.some((f) => f.kind === 'client' || f.kind === 'service') ? (
            <MissingFieldsHint
              missingFields={form.missingFields.filter(
                (f) => f.kind === 'client' || f.kind === 'service',
              )}
              pulseTrigger={pulseTrigger}
            />
          ) : serviceCount > 0 ? (
            <p className="text-xs text-slate-500 text-center">
              {serviceCount} service{serviceCount > 1 ? 's' : ''} &middot;{' '}
              {formatDuration(form.totalDuration)} &middot; {formatPrice(form.totalPrice)}
            </p>
          ) : null}
```

- [ ] **Step 4: Attach refs to client section and each block on screen 1**

Find the screen 1 client section opening:

```tsx
          <div className="px-4 pt-4 pb-3">
            <label className="text-xs font-medium text-slate-500 mb-2 block">Client *</label>
```

Replace with:

```tsx
          <div ref={clientSectionRef} className="px-4 pt-4 pb-3">
            <label className="text-xs font-medium text-slate-500 mb-2 block">Client *</label>
```

Find the per-block render on screen 1. There are two render branches in the existing code (one for `info` truthy, one for the empty placeholder). Wrap both in a `<div ref={…}>`. Replace the `form.serviceBlocks.map(...)` body — find:

```tsx
              {form.serviceBlocks.map((block, i) => {
                const info = getBlockInfo(block);

                if (info) {
                  return (
                    <div
                      key={block.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                    >
```

Replace the inner `return ( <div key={block.id}` line with:

```tsx
                if (info) {
                  return (
                    <div
                      key={block.id}
                      ref={setScreen1BlockRef(i)}
                      className={`bg-white rounded-2xl border overflow-hidden ${
                        form.blockConflicts.has(i)
                          ? 'border-amber-200'
                          : 'border-slate-200'
                      }`}
                    >
```

And find the placeholder branch:

```tsx
                // No items yet
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => openServiceSheet(i)}
                    className="w-full bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 min-h-[52px] hover:border-slate-300 transition-colors"
                  >
```

Replace with:

```tsx
                // No items yet
                return (
                  <div key={block.id} ref={setScreen1BlockRef(i)}>
                    <button
                      type="button"
                      onClick={() => openServiceSheet(i)}
                      className="w-full bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 min-h-[52px] hover:border-slate-300 transition-colors"
                    >
```

Then find the matching closing `</button>` of that placeholder branch and replace it with:

```tsx
                    </button>
                  </div>
```

(Look for the immediate `</button>` after the `<ChevronRight size={16}` element inside the placeholder branch.)

- [ ] **Step 5: Update screen 1 `StaffPills` to honor availability**

Find the inner `<StaffPills>` on screen 1:

```tsx
                      {/* Staff pills */}
                      <div className="border-t border-slate-100 pt-2 px-4 pb-3">
                        <StaffPills
                          team={hookProps.team}
                          categoryId={info.firstCategoryId}
                          selectedStaffId={block.staffId}
                          onSelect={(staffId) => form.updateBlock(i, { staffId })}
                        />
                      </div>
```

Replace with:

```tsx
                      {/* Staff pills */}
                      <div className="border-t border-slate-100 pt-2 px-4 pb-3">
                        <StaffPills
                          team={hookProps.team}
                          categoryId={info.firstCategoryId}
                          selectedStaffId={block.staffId}
                          onSelect={(staffId) =>
                            form.updateBlock(i, { staffId, staffConfirmed: staffId !== null })
                          }
                          isStaffAvailable={(staffId) => {
                            if (!block.date || block.hour === null) return true;
                            return form.isStaffAvailableForSlot(
                              staffId,
                              block.date,
                              block.hour,
                              block.minute,
                              i,
                            );
                          }}
                        />
                      </div>
```

(This also fixes the asymmetry called out in the spec — mobile `StaffPills` now sets `staffConfirmed`.)

- [ ] **Step 6: Add 4-state block chip on screen 2**

Find the screen-2 block selector:

```tsx
        {form.serviceBlocks.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
            {form.serviceBlocks.map((block, i) => {
              const info = getBlockInfo(block);
              const isActive = i === form.activeBlockIndex;
              const isScheduled = block.date !== null && block.hour !== null;

              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => form.setActiveBlockIndex(i)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-sm'
                      : isScheduled
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {info?.label ?? `Service ${i + 1}`}
                </button>
              );
            })}
          </div>
        )}
```

Replace with:

```tsx
        {form.serviceBlocks.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
            {form.serviceBlocks.map((block, i) => {
              const info = getBlockInfo(block);
              const isActive = i === form.activeBlockIndex;
              const hasConflict = form.blockConflicts.has(i);
              const isScheduled = block.date !== null && block.hour !== null;

              const baseClass = isActive
                ? hasConflict
                  ? 'bg-blue-500 text-white shadow-sm ring-2 ring-amber-400'
                  : 'bg-blue-500 text-white shadow-sm'
                : hasConflict
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : isScheduled
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-slate-100 text-slate-600';

              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => form.setActiveBlockIndex(i)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${baseClass}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {hasConflict && <AlertTriangle size={12} />}
                  {info?.label ?? `Service ${i + 1}`}
                </button>
              );
            })}
          </div>
        )}
```

- [ ] **Step 7: Mount the conflict banner on screen 2**

Find the screen-2 context header block:

```tsx
        {/* Context header */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Planifier</div>
          {activeBlockInfo && (
            <div className="text-sm text-slate-700">
              {activeBlockInfo.label}
              {activeStaffName && (
                <span className="text-slate-400"> &middot; {activeStaffName}</span>
              )}
            </div>
          )}
        </div>
```

Replace with:

```tsx
        {/* Context header */}
        <div className="px-4 py-3" ref={screen2BannerRef}>
          <div className="text-xs font-medium text-slate-500 mb-1">Planifier</div>
          {activeBlockInfo && (
            <div className="text-sm text-slate-700">
              {activeBlockInfo.label}
              {activeStaffName && (
                <span className="text-slate-400"> &middot; {activeStaffName}</span>
              )}
            </div>
          )}
          {form.blockConflicts.get(form.activeBlockIndex) && (
            <div className="mt-2">
              <BlockConflictBanner conflict={form.blockConflicts.get(form.activeBlockIndex)} />
            </div>
          )}
        </div>
```

Wrap the calendar div with the screen-2 ref. Find:

```tsx
        {/* Calendar */}
        <div className="px-4 mb-4">
          <InlineCalendar
            value={activeBlock?.date ?? null}
            onChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
          />
        </div>
```

Replace with:

```tsx
        {/* Calendar */}
        <div className="px-4 mb-4" ref={screen2CalendarRef}>
          <InlineCalendar
            value={activeBlock?.date ?? null}
            onChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
          />
        </div>
```

- [ ] **Step 8: Replace the screen 2 footer (hint + always-clickable Confirmer)**

Find the screen 2 footer:

```tsx
      {/* Sticky footer — above BottomTabBar */}
      <div
        className="fixed left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-2 z-10"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        <p className="text-xs text-slate-500 text-center truncate">
          {clientName && <span>{clientName} &middot; </span>}
          {serviceNames}
          {firstDate && <span> &middot; {formatDate(firstDate)}</span>}
          {form.totalPrice > 0 && <span> &middot; {formatPrice(form.totalPrice)}</span>}
        </p>
        <button
          type="button"
          disabled={!form.allBlocksScheduled || form.isSaving}
          onClick={form.handleSubmit}
          className="w-full bg-blue-500 text-white py-3.5 rounded-2xl min-h-[52px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-600"
        >
          {form.isSaving ? 'Enregistrement...' : 'Confirmer'}
        </button>
      </div>
```

Replace with:

```tsx
      {/* Sticky footer — above BottomTabBar */}
      <div
        className="fixed left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-2 z-10"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        {form.canSubmit ? (
          <p className="text-xs text-slate-500 text-center truncate">
            {clientName && <span>{clientName} &middot; </span>}
            {serviceNames}
            {firstDate && <span> &middot; {formatDate(firstDate)}</span>}
            {form.totalPrice > 0 && <span> &middot; {formatPrice(form.totalPrice)}</span>}
          </p>
        ) : (
          <MissingFieldsHint missingFields={form.missingFields} pulseTrigger={pulseTrigger} />
        )}
        <button
          type="button"
          disabled={form.isSaving}
          aria-disabled={!form.canSubmit}
          onClick={() => {
            if (form.canSubmit) {
              form.handleSubmit();
              return;
            }
            setPulseTrigger((n) => n + 1);
            const missing = form.missingFields;
            const first = missing[0];

            // Decide whether to navigate back to screen 1 or stay on screen 2.
            const onScreen1 = first && (first.kind === 'client' || first.kind === 'service');
            if (onScreen1) {
              if (first.kind === 'client') setPendingScrollTarget({ kind: 'client' });
              else setPendingScrollTarget({ kind: 'service', blockIndex: first.blockIndex });
              setScreen('services');
            } else if (first && first.kind === 'staff') {
              // Staff selection is on screen 1.
              setPendingScrollTarget({ kind: 'staff', blockIndex: first.blockIndex });
              setScreen('services');
            } else {
              // Datetime missing or conflict — stay on screen 2 and shake target.
              const target =
                form.blockConflicts.size > 0
                  ? screen2BannerRef.current
                  : screen2CalendarRef.current;
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                shake(target);
              }
            }

            const message = missing.length > 0
              ? `Veuillez compléter : ${humanizeMissing(missing)}`
              : 'Conflit de planning. Modifiez le membre ou le créneau.';
            addToast({ type: 'warning', message });
          }}
          className={`w-full bg-blue-500 text-white py-3.5 rounded-2xl min-h-[52px] font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-blue-600 ${
            form.canSubmit ? '' : 'opacity-50'
          }`}
        >
          {form.isSaving ? 'Enregistrement...' : 'Confirmer'}
        </button>
      </div>
```

- [ ] **Step 9: Typecheck + run tests**

Run: `npx tsc --noEmit && npx vitest run modules/appointments`
Expected: typecheck clean; tests pass.

- [ ] **Step 10: Commit**

```bash
git add modules/appointments/components/AppointmentBuilderMobile.tsx
git commit -m "feat(appointments): mobile builder banner, 4-state chips, screen-aware shake/toast/hint"
```

---

## Task 13: Build verification

**Files:** none new — final build + lint sweep.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: clean. If formatter complains, run `npm run lint:fix` and review the diff.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit any lint fixups**

If `lint:fix` made changes:

```bash
git add -p
git commit -m "chore: lint fixups for appointment-form UX work"
```

Otherwise skip.

---

## Task 14: Manual browser verification

**Files:** none — exercise the dev server.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open: `http://localhost:3000`

- [ ] **Step 2: Original bug repro — staff change preserves date/time**

Steps:
1. Open Agenda. Find an existing appointment that has a date/time but **no assigned staff**, or create one fresh.
2. Click the appointment, then "Modifier".
3. In step 3, pick a staff member.

Expected: the previously-selected date and hour stay visible. No wipe. Save button is enabled (assuming nothing else is missing).

- [ ] **Step 3: Conflict banner appears when staff change creates a conflict**

Steps:
1. Find a slot where staff A is busy at 10:00 on a date.
2. Edit a different appointment, set it to that date and 10:00 with staff B (no conflict).
3. Change staff to A.

Expected: amber banner inside the date/time panel: "Marie n'est pas disponible…". Save is blocked. Hint shows nothing missing (because date/time is set), but `canSubmit=false`. Click save anyway → toast "Conflit de planning…" + shake on the banner.

- [ ] **Step 4: Off-day banner**

Steps:
1. Create a new appointment for a Sunday.
2. Pick a staff who has Sunday closed in their schedule.

Expected: banner reads "X ne travaille pas le 26 avril 2026."

- [ ] **Step 5: Cross-block sibling overlap**

Steps:
1. New appointment, two service blocks. Same staff. Same date. Same hour.

Expected: both blocks show conflict (banner on the active one; chip on screen 2 shows amber + AlertTriangle on the other). Save blocked.

- [ ] **Step 6: Click-disabled feedback (mobile screen 2, datetime missing)**

Steps:
1. New appointment, fill client + services + staff but leave date unselected.
2. Reach screen 2.
3. Tap "Confirmer".

Expected: toast "Veuillez compléter : Date & heure", calendar shakes, hint pulses.

- [ ] **Step 7: Click-disabled feedback (mobile, navigate back to screen 1)**

Steps:
1. New appointment with two service blocks. Block 1 fully filled. Block 2 has services + staff but block 1 has services missing somehow.
2. (Easier repro: leave the second block empty, tap "Continuer" on screen 1 → it stays on screen 1 + shakes the empty block.)
3. Alternative: on screen 2 with client missing (delete it via "Modifier" then come back), tap Confirmer.

Expected: navigation goes back to screen 1, scrolls + shakes the missing target. Toast names the missing field.

- [ ] **Step 8: Click-disabled feedback (desktop)**

Steps:
1. New appointment with everything filled except client.
2. Click "Enregistrer".

Expected: toast, scroll to client panel, shake client panel, hint above save button pulses.

- [ ] **Step 9: Staff pill availability indicator**

Steps:
1. Edit appointment with a fixed date+hour set.
2. Look at staff pills: ones who are unavailable for that exact slot show dimmed + Clock icon + "Indisponible" subtitle.
3. Verify clicking an "Indisponible" staff still selects them and the conflict banner appears.

- [ ] **Step 10: "Aucun" path stays clean**

Steps:
1. Edit appointment, set a date+time.
2. Click the "Aucun" button in step 3 (`StaffCalendarPanel`).

Expected: calendar stays visible, no overlay, no conflict (no staff to conflict with), save allowed (assuming all other fields complete).

- [ ] **Step 11: Read-only calendar fallback**

Steps:
1. Edit appointment that has date+hour but no staff.
2. Look at step 4 panel.

Expected: calendar visible read-only (dimmed) showing the existing date/time, with the line "Sélectionnez un membre pour modifier l'heure.". No overlay covering the values.

- [ ] **Step 12: Realtime mid-edit**

Steps:
1. Open appointment edit in tab A with staff S at 10:00, no conflict.
2. In tab B, create another booking for staff S at 10:00 same date.
3. Switch back to tab A.

Expected: the conflict banner appears within ~1s without any user action in tab A.

- [ ] **Step 13: Pack flow regression check**

Steps:
1. New appointment, add a pack from favorites.
2. Pick a staff for one of the pack blocks.
3. Pick a date and hour.
4. Change the staff again.

Expected: date and hour stay; conflict logic runs across pack blocks; nothing crashes.

- [ ] **Step 14: Final commit (if anything tweaked during manual testing)**

If you made any small fixes during manual testing:

```bash
git add -p
git commit -m "fix(appointments): minor manual-verification touch-ups"
```

Otherwise skip.

---

## Self-review pass

- ✅ **Spec coverage:** every section of the spec maps to a task.
  - Part 1 (per-block conflict derivation): Task 2 (helper) + Task 5 (hook integration).
  - Part 2 (remove wipe): Task 5 step 2.
  - Part 3a (banner): Task 6 + Task 9 (desktop mount) + Task 12 step 7 (mobile mount).
  - Part 3b (per-block chip on mobile): Task 12 step 6.
  - Part 3c (staff pill indicator): Task 8 + Task 9 step 2 (desktop wiring) + Task 12 step 5 (mobile wiring).
  - Part 3d (read-only calendar): Task 9 step 3.
  - Part 4a (missingFields): Task 3 + Task 5.
  - Part 4b (live hint): Task 7 + Task 11 step 3 (desktop) + Task 12 steps 3 & 8 (mobile).
  - Part 4c (shake + toast + scroll, screen-aware): Task 4 (CSS+hook), Task 11 step 2, Task 12 step 2, 3, 8.
  - Format helpers: Task 1.
  - Pre-submit guard: Task 5 step 5.
- ✅ **No placeholders:** every step has the actual code or exact command.
- ✅ **Type consistency:** `BlockConflict`, `MissingField`, `canSubmit`, `hasAnyConflict`, `isStaffAvailableForSlot`, `blockConflicts` names match across tasks 2, 3, 5, 6, 7, 8, 9, 10, 11, 12.
- ✅ **Frequent commits:** each task ends with a commit; UI tasks are focused on a single component.
