# Appointment Form Desktop Redesign

## Summary

Reorganize the desktop appointment builder from a 2-panel layout (services-left, calendar-right) to a 3-zone layout: a narrow left sidebar for client and summary, a wide right area split into services (2/3) and staff+calendar (1/3). Staff stays per-service-block. Steps 3 and 4 are visually linked to the active service block via a connector line.

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  <- Nouveau Rendez-Vous                          [Delete] [Save]   │
├────────────┬────────────────────────────────────────────────────────┤
│            │                                                        │
│  LEFT 1/4  │  RIGHT 3/4                                            │
│            │  ┌──────────────────────┬─────────────────────┐       │
│  ┌──────┐  │  │                      │                     │       │
│  │Step 1│  │  │  Services 2/3        │  Staff+Calendar 1/3 │       │
│  │Client│  │  │                      │                     │       │
│  └──────┘  │  │  ┌────────────────┐  │  ┌───────────────┐  │       │
│            │  │  │ Active Block   │──┼──│ Step 3: Team  │  │       │
│  ┌──────┐  │  │  │ Category pills │  │  │ Staff pills   │  │       │
│  │Total │  │  │  │ Service grid   │  │  │               │  │       │
│  │Summ. │  │  │  └────────────────┘  │  ├───────────────┤  │       │
│  │always │  │  │                      │  │ Step 4: Date  │  │       │
│  └──────┘  │  │  ┌────────────────┐  │  │ Calendar      │  │       │
│            │  │  │ Collapsed blk  │  │  │ Time picker   │  │       │
│  ┌──────┐  │  │  └────────────────┘  │  │               │  │       │
│  │Rappel│  │  │                      │  └───────────────┘  │       │
│  │Notes │  │  │  ┌─ ─ ─ ─ ─ ─ ─ ┐  │                     │       │
│  └──────┘  │  │  │+ Ajouter svc  │  │                     │       │
│            │  │  └─ ─ ─ ─ ─ ─ ─ ┘  │                     │       │
│            │  └──────────────────────┴─────────────────────┘       │
└────────────┴────────────────────────────────────────────────────────┘
```

### Panel proportions

- Outer: left `flex-[1]` / right `flex-[3]`
- Inner right: services `flex-[2]` / staff+calendar `flex-[1]`

## Decisions

| Decision | Choice |
|---|---|
| Staff model | Per-block (unchanged). Each service block owns its own `staffId`. |
| Staff display | Extracted from ServiceBlock into a new right subpanel, rendered for the active block. |
| Calendar gating | Greyed out (`opacity-40 pointer-events-none` + overlay text) until staff is selected. "N'importe qui" counts as a valid selection. |
| Total Summary | Always visible. Elegant display when services exist; invitation message when empty. |
| Add service button | Dashed-border button (current style, not expandable). |
| Visual link | Explicit connector — thin blue line from active block's right edge to the staff+calendar subpanel's left edge. |
| Collapse behavior | At least one block always active (`activeBlockIndex` always points to a valid block). |
| Client form layout | Phone input full-width first row; first name + last name as 2 columns below. |

## Responsive breakpoints

| Breakpoint | Behavior |
|---|---|
| >= 1200px | Full 3-zone layout (left sidebar \| services \| staff+calendar side by side) |
| < 1200px | Right subpanel stacks vertically: services full-width, then staff+calendar below |
| < 768px (max-md) | Mobile shell takes over (`AppointmentBuilderMobile.tsx`) — no changes needed |

## Component changes

### AppointmentBuilder.tsx — full restructure

**Before:** 2-panel layout (left: client+services, right: calendar+rappel+notes).
**After:** Left sidebar (1/4) + right area (3/4) with inner split.

Left sidebar contains:
1. Step 1 — Client card (existing ClientField, with new grid layout)
2. Total Summary — AppointmentSummary (always rendered)
3. Rappel toggle — ReminderToggle
4. Notes toggle — existing toggle + textarea

Right area contains:
- Services subpanel (2/3): service blocks list + "Ajouter un service" button
- Staff+Calendar subpanel (1/3): new StaffCalendarPanel component
- Connector element (absolute-positioned blue line)

### ServiceBlock.tsx — simplify

Remove the embedded Step 3 (StaffPills section, lines 365-379). The active block's staff is now rendered in the separate StaffCalendarPanel. ServiceBlock focuses on: category pills, service/pack grid, collapsed state.

The Step 3 numbered badge ("3") and "Praticien" label move to StaffCalendarPanel.

### ClientField.tsx — adjust grid

Change from 3-column grid to:
- Row 1: PhoneInput (full width)
- Row 2: First name (1/2) + Last name (1/2)

This fits the narrow left panel (~300px inner width).

### New: StaffCalendarPanel.tsx

Renders for the active service block. Contains:

**Step 3 — Praticien:**
- Step badge "3" + "Praticien" label
- StaffPills (existing component) filtered by active block's category
- When active block has no service selected: pills rendered with `opacity-40 pointer-events-none`, centered overlay text "Choisissez un service"

**Step 4 — Date & Heure:**
- Step badge "4" + "Date & Heure" label
- InlineCalendar + TimePicker (existing components)
- When no staff is selected on active block: calendar/time rendered with `opacity-40 pointer-events-none`, centered overlay text "Selectionnez un praticien"

Props:
```ts
interface StaffCalendarPanelProps {
  activeBlock: ServiceBlockState;
  activeBlockIndex: number;
  team: StaffMember[];
  services: Service[];
  unavailableHours: number[];
  onUpdateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
}
```

### AppointmentSummary.tsx — enhance

**Empty state:** Card with subtle placeholder — "Commencez par choisir un service" in slate-400 text, perhaps with a small icon.

**Filled state:** Current summary display (service count, total duration, total price). Ensure it looks polished in the narrow left panel width.

### Connector implementation

A 2px blue-400 line connects the active service block to the StaffCalendarPanel:
- Rendered as an absolutely positioned `div` inside the right panel wrapper (which has `position: relative`)
- Vertical position: calculated from the active block's DOM position (via ref)
- Horizontal: spans the gap between the services subpanel and the staff+calendar subpanel
- Animates vertical position with CSS `transition: top 200ms ease`
- Hidden when viewport < 1200px (stacked layout — no side-by-side to connect)

### Greyed state implementation

Both Step 3 and Step 4 use the same pattern:
```tsx
<div className="relative">
  <div className={noService ? 'opacity-40 pointer-events-none' : ''}>
    {/* StaffPills or Calendar+TimePicker */}
  </div>
  {noService && (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-sm text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg">
        Choisissez un service
      </span>
    </div>
  )}
</div>
```

## Data model

No changes. `ServiceBlockState` already has `staffId`, `date`, `hour`, `minute` per block. The `useAppointmentForm` hook is unchanged. This is purely a layout/component restructure.

## Files affected

| File | Action |
|---|---|
| `modules/appointments/components/AppointmentBuilder.tsx` | Major rewrite — new layout structure |
| `modules/appointments/components/ServiceBlock.tsx` | Remove embedded StaffPills section |
| `modules/appointments/components/ClientField.tsx` | Change grid from 3-col to phone + 2-col names |
| `modules/appointments/components/StaffCalendarPanel.tsx` | **New** — staff + calendar for active block |
| `modules/appointments/components/AppointmentSummary.tsx` | Add empty state, ensure narrow-panel styling |

## Out of scope

- Mobile shell (`AppointmentBuilderMobile.tsx`) — no changes
- `useAppointmentForm` hook — no changes
- Data model / Supabase — no changes
- Service grid layout within ServiceBlock — no changes (grid adapts naturally to available width)
