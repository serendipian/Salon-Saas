# Plan 6 — Appointment Form Redesign

## Problem

The current appointment form has poor UX:
- Native `datetime-local` input for date/time — no visual calendar, multiple taps required
- Single-column layout with no spatial separation between "what" and "when"
- Auto-selects `variants[0]` with no variant picker
- No staff availability awareness — double-bookings caught only on DB constraint error after submit
- Supports only one service per appointment — salons commonly book service combos (coloration + brushing)
- No quick-add for new clients — must leave the form to create one first
- No reminder configuration

## Solution

A two-panel multi-service appointment builder:
- **Left panel:** Client → Service blocks (each with category/service/variant/staff) → Notes
- **Right panel:** Tabbed per service — Status, inline calendar, grid time picker, reminder toggle, summary

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Two-panel split | Matches reference UX, keeps "what" and "when" visible simultaneously |
| Service flow | Category tabs → service grid (3-col) → variant radio list | Scannable, one-click selection, avoids dropdowns |
| Multi-service | Service blocks with "Ajouter un service" | Each block is independent: own service, staff, time |
| Staff per service | Independent staff selection per service block | Different staff can handle different services |
| Time picker | Right column, tabbed per service | Each service's time syncs to its staff's availability |
| Client position | First field (above services) | Matches natural booking conversation flow |
| New client | Inline "Nouveau" form (prénom + nom + téléphone) | No context-switch, auto-creates in CRM |
| Staff default | "N'importe qui" button | Common case — client doesn't care who |
| Reminder | Toggle (off by default) with chip options | Non-intrusive, preset durations |

## Layout Specification

### Left Panel — Booking Details

#### 1. Client (top field)

**Default state:** Search input + "Nouveau" button side by side.

**Search behavior:**
- Type-ahead search on client first name, last name, phone
- Results show avatar, name, phone, visit count
- Click to select → collapses to selected chip

**Selected state:** Card showing avatar initials, full name, phone, visit count. "✕" to clear.

**"Nouveau" clicked state:** Inline form replaces search:
- Prénom (required) + Nom (optional) — side by side in 2-col grid
- Téléphone (required) — full width, `inputMode="tel"`
- "✕" to dismiss, return to search
- On appointment save: inserts into `clients` table, links to appointment

#### 2. Service Blocks

Each service block contains:

**Category tabs:** Horizontal tabs sourced from `service_categories` table, ordered by `sort_order`. Active tab highlighted with pink underline.

**Service grid:** 3-column grid of cards for the active category. Each card shows:
- Unselected: service name + variant count (e.g., "3 variantes")
- Selected: pink border, checkmark, expands to show variants

**Variant list:** Inside the selected service card, radio-style rows:
- Each row: radio dot, variant name, duration, price
- Selected variant highlighted with pink border
- Selecting a variant sets duration + price for this block

**Staff selection:** Below the service grid:
- "N'importe qui" pill (default selected)
- Staff member pills — show only staff whose `skills` array includes the selected service's `category_id`
- Selected staff shown as pink chip with "✕"
- When a specific staff is selected, the right column filters time slots by that staff's schedule and existing appointments

**Active vs. inactive blocks:**
- Active block: pink border, fully expanded, controls the right column tab
- Inactive blocks: grey border, collapsed to a summary line (service · variant · duration · price · staff · scheduled time)
- Click an inactive block to activate it (switches right column tab)
- "✕" on each block to remove it

**"+ Ajouter un service" button:** Dashed border button below the last block. Adds a new empty service block and activates it.

#### 3. Notes

Full-width textarea at the bottom. Placeholder: "Ajouter des notes..."

### Right Panel — Scheduling (Tabbed)

**Tab bar:** One tab per service block. Each tab shows:
- Service number (①, ②, ③...)
- Service name
- Variant + staff summary in smaller text
- Active tab: pink underline + pink text
- Clicking a tab also activates the corresponding left-panel service block

#### Status

Dropdown with current options: Planifié (blue dot), Complété (green), Annulé (red), Absent (orange). Default: Planifié.

Note: Status is per-appointment (shared across all service blocks), not per-service. Shown on the active tab but applies globally.

#### Date Picker (Inline Calendar)

Always-visible month calendar grid:
- 7-column grid (Lu–Di), French day abbreviations
- Navigation: ◀ ▶ arrows to change month
- Today highlighted, selected date in pink
- Past dates dimmed
- Calendar is shared across service tabs (selecting a date on one tab applies to all — most appointments happen on the same day). User can override per-service if needed.

#### Time Picker (Grid)

Contained in a card with three rows:

**Row 1 — Morning/early PM (6 columns):** 9 AM, 10 AM, 11 AM, 12 PM, 1 PM, 2 PM
**Row 2 — Afternoon/evening (6 columns):** 3 PM, 4 PM, 5 PM, 6 PM, 7 PM, 8 PM
**Separator line**
**Row 3 — Minutes + AM/PM (6 columns, equal width):** :00, :15, :30, :45, ☀️, 🌙

Behavior:
- All 6 columns in each row are equal width
- Hour buttons show number + AM/PM label (e.g., "10 AM")
- Selected hour highlighted in pink
- Unavailable hours (staff not working, or slot conflicts with existing appointments for selected staff + duration) shown dimmed with strikethrough, not clickable
- :00 selected by default when an hour is clicked
- ☀️/🌙 toggle filters which hours are shown as primary (cosmetic grouping aid, does not hide hours)
- When "N'importe qui" is selected for staff: all business hours are available (no staff-specific filtering)

**Availability logic:**
- Fetch staff's `schedule` JSONB for the selected day of week → get working hours
- Fetch existing appointments for that staff on the selected date
- Compute available slots: working hours minus booked slots, accounting for selected variant's `duration_minutes`
- A slot is available only if the full duration fits before the next booking or end of working hours

#### Reminder

**Toggle:** Off by default. Label: "Rappel".

**When toggled on:** Shows chip options:
- 30 min avant
- 1h avant
- 3h avant
- 1 jour avant
- 2 jours avant

Single-select (one reminder per service block). Selected chip in pink.

Note: Reminder is stored but not actively sent in this iteration (no notification backend yet). The field captures intent for future implementation.

#### Summary Section

**"Ce service" line:** Duration + price for the active tab's service. Below: formatted date + time range (e.g., "Sam. 28 mars · 10h00 – 10h45").

**"Total rendez-vous" card:** Below the per-service summary:
- Lists all service blocks: number + service · variant → price
- Separator
- Total duration (sum) + total price (sum)
- Full time range across all services

### Mobile Layout

Desktop/tablet is the primary target. On mobile (< 768px):
- Two panels stack vertically: left panel on top, right panel below
- Service grid drops to 2 columns
- Category tabs become horizontally scrollable
- Time picker grid remains 6 columns (fits on 320px+ screens)
- Tab bar in right panel becomes horizontally scrollable

## Data Model Changes

### New: `appointment_groups` table

```sql
CREATE TABLE appointment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  client_id UUID REFERENCES clients(id),
  notes TEXT,
  reminder_minutes INTEGER,  -- NULL = no reminder, else minutes before
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);
```

Purpose: Groups multiple service appointments under one logical booking. Client and notes live here (shared across services).

### Modified: `appointments` table

Add column:
```sql
ALTER TABLE appointments ADD COLUMN group_id UUID REFERENCES appointment_groups(id);
```

The existing `client_id` and `notes` columns on `appointments` remain for backwards compatibility but are denormalized from the group. New appointments populate both.

Single-service appointments: `group_id` points to a group with one appointment.
Multi-service appointments: multiple appointments share the same `group_id`.

### Existing tables used as-is

- `service_categories` — category tabs (name, color, sort_order)
- `services` — service cards (name, category_id)
- `service_variants` — variant rows (name, duration_minutes, price)
- `staff_members` — staff pills (first_name, last_name, skills[], schedule JSONB)
- `clients` — client search + inline creation

### No changes needed

- `transactions` / `transaction_items` — POS already supports multi-item; linking to appointment_groups is a future enhancement
- RLS policies — `appointment_groups` needs the same RLS pattern as `appointments` (salon_id-based, using `get_active_salon()`)
- Audit triggers — `appointment_groups` needs `updated_at` trigger + audit log trigger, same as other business tables

## Component Architecture

### New Components

| Component | Purpose |
|-----------|---------|
| `AppointmentBuilder.tsx` | Top-level two-panel container, manages service blocks state |
| `ClientField.tsx` | Search + "Nouveau" inline form, handles client selection/creation |
| `ServiceBlock.tsx` | Single service block: category tabs, service grid, variant list, staff pills |
| `ServiceGrid.tsx` | 3-col grid of service cards for active category |
| `VariantList.tsx` | Radio list inside selected service card |
| `StaffPills.tsx` | "N'importe qui" + staff member chips, filtered by category skills |
| `SchedulingPanel.tsx` | Right panel container: tab bar + active tab content |
| `InlineCalendar.tsx` | Always-visible month grid, French locale |
| `TimePicker.tsx` | 3-row grid (hours + minutes + AM/PM), availability-aware |
| `ReminderToggle.tsx` | Toggle + chip options |
| `AppointmentSummary.tsx` | Per-service + total summary cards |

### Modified Components

| Component | Change |
|-----------|--------|
| `AppointmentsModule.tsx` | Replace `AppointmentForm` with `AppointmentBuilder` for ADD/EDIT views |
| `AppointmentDetails.tsx` | Show grouped services when viewing an appointment group |

### Hooks

| Hook | Purpose |
|------|---------|
| `useStaffAvailability(staffId, date)` | Computes available time slots from staff schedule + existing appointments |
| `useServiceCategories()` | Fetches categories with sort order |
| `useAppointmentGroups()` | CRUD for appointment groups + child appointments |

Existing hooks used: `useServices()`, `useTeam()`, `useClients()`, `useAppointments()`

### State Shape (AppointmentBuilder)

```typescript
interface AppointmentBuilderState {
  clientId: string | null;
  newClient: { firstName: string; lastName: string; phone: string } | null;
  serviceBlocks: ServiceBlockState[];
  activeBlockIndex: number;
  notes: string;
  reminderMinutes: number | null;
  status: AppointmentStatus;
}

interface ServiceBlockState {
  id: string;  // temp UUID for React key
  categoryId: string | null;
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;  // null = "N'importe qui"
  date: string | null;     // ISO date
  hour: number | null;     // 0-23
  minute: number;          // 0, 15, 30, 45 — default 0
}
```

## Validation

Zod schema for submission:

```typescript
appointmentGroupSchema = z.object({
  clientId: z.string().min(1, 'Le client est requis'),
  serviceBlocks: z.array(z.object({
    serviceId: z.string().min(1, 'Le service est requis'),
    variantId: z.string().min(1, 'La variante est requise'),
    staffId: z.string().nullable(),
    date: z.string().min(1, 'La date est requise'),
    hour: z.number().min(0).max(23),
    minute: z.number().refine(m => [0, 15, 30, 45].includes(m)),
  })).min(1, 'Au moins un service est requis'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().optional(),
  reminderMinutes: z.number().nullable(),
});
```

New client inline form:
```typescript
newClientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().optional(),
  phone: z.string().min(6, 'Le numéro est requis'),
});
```

## Save Flow

1. Validate form with Zod
2. If `newClient` is set: insert into `clients`, get back `clientId`
3. Insert `appointment_groups` row (salon_id, client_id, notes, reminder_minutes)
4. For each service block: insert `appointments` row with group_id, service_id, variant_id, staff_id, computed datetime, duration_minutes (from variant), price (from variant)
5. Wrap in a single Supabase transaction (or sequential inserts with rollback on error)
6. Invalidate queries: `['appointments']`, `['clients']` (if new client created)
7. Toast: "Rendez-vous créé" / error toast on failure

## Edit Flow

- Load appointment group + child appointments
- Populate `AppointmentBuilderState` from DB data
- Allow adding/removing service blocks
- On save: upsert group, upsert/insert/soft-delete child appointments as needed
- Same validation as create

## Out of Scope

- Reminder notification delivery (SMS/email/push) — field is stored for future use
- Recurring appointments
- Drag-and-drop calendar view (separate feature)
- Online client self-booking
- Staff availability exceptions (vacations, sick days) — uses only weekly schedule JSONB
