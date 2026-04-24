# POS Rendez-vous tab filters

**Date:** 2026-04-24
**Status:** Design approved, pending implementation plan

## Problem

The POS "Rendez-vous" tab at [modules/pos/components/PendingAppointments.tsx](../../modules/pos/components/PendingAppointments.tsx) renders all pending appointments as a flat card grid with no way to filter. In a salon with multiple stylists, dozens of service categories, and a mix of scheduled and in-progress appointments, users scroll through the full list every checkout.

Three operational problems fall out of this:

1. **No filtering.** Receptionists processing checkout for a specific stylist see everyone's appointments. Stylists looking for their own work see the same.
2. **Silent bug.** The current query at [modules/pos/hooks/usePOS.ts:172](../../modules/pos/hooks/usePOS.ts#L172) excludes `IN_PROGRESS` — appointments where the client is currently in the chair don't appear in POS at all, even though they are the exact appointments you'd want to bill next.
3. **Stale past-day overdue pollution.** The current query window is "anything before tomorrow", which pulls in past-day `SCHEDULED` appointments that are almost always stale data (forgotten status updates, unreconciled no-shows). These accumulate without bound and drown out today's real work.

## Goals

- Let users filter the Rendez-vous tab by staff member, service category, and status.
- Show `IN_PROGRESS` appointments alongside `SCHEDULED` ones — both are billable.
- Exclude `COMPLETED`, `CANCELLED`, `NO_SHOW` from this view entirely — these are not user-toggleable, they are policy exclusions.
- Drop past-day overdue from POS. Keep same-day overdue visual highlight.

## Non-goals

- Filter persistence across sessions (localStorage).
- Bottom-sheet filter panel on mobile.
- Date range selector. Today is the only window.
- A cleanup UI for past-day stale appointments. That belongs in the Agenda module and is out of scope here.
- Changing how appointment groups are imported into the POS cart.

## Design

### Data scope

Replace the filter in the `pendingAppointments` memo at [modules/pos/hooks/usePOS.ts:161-184](../../modules/pos/hooks/usePOS.ts#L161-L184):

```ts
// Before
if (a.status !== 'SCHEDULED') return false;
return a.date < tomorrowStart;

// After
if (a.status !== 'SCHEDULED' && a.status !== 'IN_PROGRESS') return false;
return a.date >= todayStart && a.date < tomorrowStart;
```

Two changes: `IN_PROGRESS` is now included, and the lower bound clamps to today (past-day overdue drops off).

The existing sort "overdue first, then by time" still works within today's list — same-day overdues (scheduled time passed, not yet started) float to the top.

### Filter state

Lives in `usePOS` alongside existing catalog state (`searchTerm`, `selectedCategory`):

```ts
const [appointmentStaffFilter, setAppointmentStaffFilter] = useState<string>('ALL');
const [appointmentCategoryFilter, setAppointmentCategoryFilter] = useState<string>('ALL');
const [appointmentStatusFilter, setAppointmentStatusFilter] =
  useState<'ALL' | 'SCHEDULED' | 'IN_PROGRESS'>('ALL');
```

Defaults are `'ALL'`. State is in-memory and resets on leaving POS. No persistence.

### Grouping lift

Grouping by `groupId` currently lives inside [PendingAppointments.tsx:34-39](../../modules/pos/components/PendingAppointments.tsx#L34-L39). It moves up into `usePOS` so filtering and tab-badge counting share one grouped source of truth.

New hook exports:

- `pendingAppointmentGroups: Appointment[][]` — base scope, ungrouped by filters. Used for the tab badge count at [POSCatalog.tsx:134-136](../../modules/pos/components/POSCatalog.tsx#L134-L136).
- `filteredPendingAppointmentGroups: Appointment[][]` — base scope with staff, category, and status filters applied. Rendered by `PendingAppointments`.
- Filter values and setters for each of the three dimensions.

`PendingAppointments` props change from `appointments: Appointment[]` to `groups: Appointment[][]`. The component no longer groups; it just renders.

### Filter semantics

All three filters apply per-group after grouping:

- **Staff.** Group matches if any appointment in the group has `staffId === filter`. OR semantics — a multi-service group with Sarah and Amira matches when either is selected.
- **Category.** Group matches if any appointment has `service.categoryId === filter`. Resolved by looking up `services[appt.serviceId]?.categoryId`; if the service is missing or has no category, the appointment does not match any category filter.
- **Status.** Group matches if any appointment in the group has `status === filter`. In practice all appointments in a group share status, but OR is the safe default.

Filter dimensions combine with AND: `(staffMatch && categoryMatch && statusMatch)`.

### Components

New: `modules/pos/components/AppointmentFilters.tsx`

Stateless. Props:

```ts
interface AppointmentFiltersProps {
  staff: StaffMember[];                   // active staff only
  categories: ServiceCategory[];          // service categories only
  staffValue: string;
  categoryValue: string;
  statusValue: 'ALL' | 'SCHEDULED' | 'IN_PROGRESS';
  onStaffChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  onStatusChange: (status: 'ALL' | 'SCHEDULED' | 'IN_PROGRESS') => void;
  onReset: () => void;
}
```

Modified:

- `modules/pos/hooks/usePOS.ts` — adds filter state, grouping logic, filter setters, and new exports.
- `modules/pos/components/POSCatalog.tsx` — renders `<AppointmentFilters>` above `<PendingAppointments>`, only when the Rendez-vous tab is active. Passes active staff list and service categories down.
- `modules/pos/components/PendingAppointments.tsx` — accepts pre-grouped data; adds "filtered empty" state variant.
- `modules/pos/POSModule.tsx` — wires new hook exports through to `POSCatalog`.

### UI

Three stacked chip rows above the card grid. Each row has a small left-side label (`text-xs text-slate-500`) and inline chips:

```
Employé      [Tous] [👤 Sarah] [👤 Amira] [👤 Leila] ...
Catégorie    [Toutes] [Coiffure] [Coloration] [Soins] ...
Statut       [Tous] [Planifié] [En cours]           [Réinitialiser]
```

Chip styling:

- Active: `bg-slate-900 text-white`
- Inactive: `bg-slate-100 text-slate-700 hover:bg-slate-200`
- Touch target: 44px min height, consistent with existing mobile touch target pattern in this app.

Staff chips render `<StaffAvatar size="sm">` + first name.

On mobile (`isMobile`), each row becomes `overflow-x-auto snap-x scrollbar-hide` — horizontally scrollable with snap. No bottom sheet.

The "Réinitialiser" text link appears on the right of the status row and only when at least one filter is not `'ALL'`. Clicking it sets all three filters back to `'ALL'`.

### Empty states

Two variants in `PendingAppointments`:

- **Unfiltered empty** (existing): "Aucun rendez-vous en attente" with calendar icon. Unchanged behavior.
- **Filtered empty** (new): triggered when `groups.length === 0 && filtersActive`. Shows "Aucun rendez-vous ne correspond aux filtres" with filter icon + a "Réinitialiser les filtres" button that clears all three filters.

`filtersActive` is a boolean flag passed from `POSCatalog`, computed as `staffValue !== 'ALL' || categoryValue !== 'ALL' || statusValue !== 'ALL'`.

### Tab badge

The tab badge at [POSCatalog.tsx:134-136](../../modules/pos/components/POSCatalog.tsx#L134-L136) continues to count **unfiltered** groups. Badge signals global workload; filters are a view within the tab. This is an intentional split.

### Same-day overdue highlight

The "En retard" amber badge at [PendingAppointments.tsx:62-68](../../modules/pos/components/PendingAppointments.tsx#L62-L68) stays but its condition changes:

```ts
// Before — past-day overdue
const isOverdue = new Date(primary.date) < todayStart;

// After — same-day overdue (scheduled time passed, still not started)
const isOverdue = primary.status === 'SCHEDULED' && new Date(primary.date) < new Date();
```

Because past-day appointments are filtered out upstream, this now only fires for today's scheduled-but-overdue appointments. Useful operational signal: client is late, already in the chair but not checked in, or a no-show nobody marked yet.

### Edge cases

- **Archived staff member.** Staff chips source from the same active-staff list the rest of POS uses. Archived staff never appear, so the filter can't select one.
- **Deleted category while filter active.** On next render, the chip disappears. If the active filter was the deleted category, silently reset that filter to `'ALL'`. Implemented by a `useEffect` that checks whether the current filter ID still exists in the options list.
- **Service lookup fails** when resolving `categoryId` (orphaned `serviceId`): the appointment matches no category filter. Category `'ALL'` still includes it.
- **Group spans multiple staff / categories.** OR semantics by design — selecting Sarah keeps the Sarah+Amira group visible, and the card continues to show both staff names as it does today.
- **`IN_PROGRESS` appointment whose scheduled time is in the future.** Edge case but possible if staff started early. Not overdue, renders normally.

## Risks

- **Filter dimensions interact unexpectedly.** Staff=Sarah + Category=Coloration + Status=Planifié is a narrow slice that often matches zero. The filtered empty state + reset button handles this UX; no other mitigation needed.
- **Users miss past-day overdue.** A salon that relied on the old behavior to catch stale appointments loses that. This is intended — past-day cleanup belongs in the Agenda, not POS. Worth flagging to the user in the rollout note but not worth blocking the change.
- **Grouping-lift refactor may break existing imports.** `importAppointment` in [usePOS.ts:188](../../modules/pos/hooks/usePOS.ts#L188) re-derives groups inside itself by `groupId`. That logic stays unchanged; only the rendering path moves. Low risk but worth a manual test of multi-service appointment import after the change.

## Testing

Manual verification (no automated tests exist for this tab):

- Rendez-vous tab with no filters shows today's `SCHEDULED` and `IN_PROGRESS` groups, overdue-first.
- `IN_PROGRESS` appointments now appear (they did not before).
- Past-day `SCHEDULED` appointments no longer appear.
- Same-day overdue (scheduled 9am, current time 11am, still `SCHEDULED`) shows the amber "En retard" badge.
- Each filter independently narrows the grid correctly.
- All three filters combined produce the intersection.
- Filtered-empty state shows when filters match nothing; reset button clears all three.
- Reset link in the status row appears only when at least one filter is active.
- Tab badge count stays constant regardless of active filters.
- Multi-service appointment groups with staff Sarah + Amira render as one card and match both "Sarah" and "Amira" filters.
- Deleting a category while it's the active filter silently resets it to "Toutes".
- Mobile: chip rows scroll horizontally with snap; all chips reachable.
- Importing a filtered appointment into the cart works identically to today.

## Rollout

Single PR against `main` per the usual workflow. No feature flag — the change is low-risk and the bug fix (`IN_PROGRESS` missing, past-day overdue polluting) is an improvement regardless of the filter UI.

## Follow-ups worth considering (out of scope)

- A "needs attention" view in the Agenda module for past-day `SCHEDULED` appointments — the proper home for stale-appointment cleanup.
- Re-purposing same-day overdue as a push notification to reception.
