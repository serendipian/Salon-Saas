# Appointment form — preserve date/time on staff change, surface conflicts, kill silent save failures

**Date:** 2026-04-25
**Status:** Spec pending review, ready for implementation

## Problem

Two real-world UX failures reported by a salon employee using the appointment edit form:

1. **Silent date/time wipe on staff change.** When editing an appointment that has no assigned staff and the user picks one in step 3, the existing date/time silently resets to null. The employee couldn't recall the original time and was confused. Source: [useAppointmentForm.ts:227-238](../../modules/appointments/hooks/useAppointmentForm.ts#L227-L238) — `updateBlock` resets `date: null, hour: null, minute: 0` whenever `staffId` changes.

2. **Silent save button failure.** Mobile screen 2's "Confirmer" button is `disabled` ([AppointmentBuilderMobile.tsx:554](../../modules/appointments/components/AppointmentBuilderMobile.tsx#L554)) when `!form.allBlocksScheduled`. The employee assigned a staff member, didn't realize date+time was still required, clicked save, and nothing happened. She thought it was broken.

Underlying both: the form discards user input on related-field changes and gives no diagnostic feedback when save is blocked.

## Goals

1. Preserve the user's date/time selection when staff changes. Re-validate availability against the new staff and surface any conflict explicitly instead of wiping data.
2. Make staff availability for the currently-selected slot visible at pick time (in the staff pills themselves) so the user can predict conflicts before they happen.
3. Detect cross-block intra-form double-bookings (two service blocks of the same form sharing staff + overlapping time) — a pre-existing footgun that becomes more reachable once date/time are preserved.
4. Replace silent disabled-button behavior with three layers of progressive feedback: live "what's missing" hint above the button, shake/pulse on the missing section when the button is clicked anyway, and a toast naming the missing fields.

## Non-goals

- Restructuring the multi-step form layout. The Client → Services → Staff → Date/Time flow is untouched.
- Changing the database schema or RPCs. Purely client-side.
- Fixing the pre-existing `TimePicker` 9–20 hardcoded range. Out of scope; the conflict banner will reference whichever hour the picker can show. A separate ticket can extend the picker to honor salon schedule.
- Eliminating the mobile/desktop `staffConfirmed` asymmetry. The spec accommodates it but does not unify it.
- Showing availability indicators in the date picker (`InlineCalendar`). Pills only — date-level availability is a future enhancement.

## Design

### Part 1 — Per-block conflict derivation in `useAppointmentForm`

The current `useStaffAvailability` hook is single-instance and runs only against the **active** block's `(staffId, date, durationMinutes)`. That works for rendering `unavailableHours` in `TimePicker`, but is too narrow for our new requirements: we need conflict status for **every** block (so the save gate, the block-selector chips, and per-block banners can all reflect reality), and we need it to include sibling-block overlaps that aren't in the database yet.

**Approach:** introduce a new derivation in `useAppointmentForm` that produces `blockConflicts: Map<number, BlockConflict>`, indexed by block index. The existing `useStaffAvailability` hook stays as-is for the active-block hour-button rendering — its job (pre-emptively grey out unavailable hours in `TimePicker`) is unchanged.

```ts
type BlockConflict =
  | { kind: 'staff_unavailable'; staffName: string; date: string; hour: number }
  | { kind: 'staff_offday'; staffName: string; date: string }
  | { kind: 'sibling_overlap'; staffName: string; otherBlockLabel: string };
```

The derivation runs once per render across all blocks:

1. Build sibling appointment slots from the form state itself: for each block with `staffId + date + hour + items`, compute `{ staffId, startMin, endMin }` using `getBlockDuration`.
2. For each block with `staffId + date + hour`, evaluate three checks in order:
   - **Sibling overlap** (highest priority): does another block in the form share the same `staffId` and overlap in the local time window? If so, emit `sibling_overlap` with the other block's display label (from `getBlockSummary` truncated).
   - **Staff off-day**: does the staff schedule have `isOpen: false` for that day-of-week? Emit `staff_offday`.
   - **DB conflict**: does the slot intersect an existing non-cancelled appointment for the same staff (excluding `excludeAppointmentIds`)? Emit `staff_unavailable`.
3. Blocks without `staffId`, `date`, or `hour` are not evaluated (no conflict).

This logic lives in a new pure helper `modules/appointments/utils/deriveBlockConflicts.ts` so it can be unit-tested without React. The hook calls it inside a `useMemo` keyed on `[serviceBlocks, team, services, availabilityAppointments, salonSettings.schedule]`.

**Why a pure helper:** the cross-block check is the most complex piece of new logic and is the highest-risk regression target. Unit tests catch off-by-one window math and "two blocks at exact same minute" edge cases without rendering anything.

The existing `useStaffAvailability` hook is **not modified**. It remains the per-block-active hour-grey-out source of truth for `TimePicker`.

### Part 2 — Remove the date/time wipe in `updateBlock`

[useAppointmentForm.ts:227-238](../../modules/appointments/hooks/useAppointmentForm.ts#L227-L238) currently:

```ts
if ('staffId' in updates && updates.staffId !== b.staffId) {
  return { ...b, ...updates, date: null, hour: null, minute: 0 };
}
```

Becomes:

```ts
return { ...b, ...updates };
```

The wipe was originally a defensive measure ("availability depends on staff, so don't carry stale time"). With per-block conflict derivation, that defense is no longer needed — staleness becomes a visible conflict, not an invariant we have to enforce by erasing data.

### Part 3 — UI rendering

#### 3a. Per-block conflict banner

A new component `modules/appointments/components/BlockConflictBanner.tsx` renders the conflict for a given block. Amber palette to match existing convention (`bg-amber-50 border-amber-200 text-amber-800`):

```tsx
{blockConflict && (
  <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
    <span>
      {blockConflict.kind === 'staff_unavailable' && (
        <><strong>{blockConflict.staffName}</strong> n'est pas disponible le {formatLongDate(blockConflict.date)} à {formatHour(blockConflict.hour)}.</>
      )}
      {blockConflict.kind === 'staff_offday' && (
        <><strong>{blockConflict.staffName}</strong> ne travaille pas le {formatLongDate(blockConflict.date)}.</>
      )}
      {blockConflict.kind === 'sibling_overlap' && (
        <>Conflit avec un autre service de ce rendez-vous : <strong>{blockConflict.staffName}</strong> est déjà réservée pour « {blockConflict.otherBlockLabel} ».</>
      )}
    </span>
  </div>
)}
```

`formatLongDate` and `formatHour` go into [lib/format.ts](../../lib/format.ts) alongside the existing `formatPrice` / `formatDuration`. Staff name format follows the existing convention from `getBlockSummary` ([useAppointmentForm.ts:476-478](../../modules/appointments/hooks/useAppointmentForm.ts#L476-L478)): `firstName` + ` ` + `lastName[0]` + `.` when last name exists.

**Banner placement:**
- **Desktop** ([StaffCalendarPanel.tsx](../../modules/appointments/components/StaffCalendarPanel.tsx)): inside the Step 4 panel, above the calendar. The panel is per-active-block, so it shows the active block's conflict.
- **Mobile screen 2** ([AppointmentBuilderMobile.tsx](../../modules/appointments/components/AppointmentBuilderMobile.tsx) lines 507-518): inside the "Context header" section, below the staff name line and above the calendar. Same active-block scoping.

Non-active blocks' conflicts are surfaced through the block-selector chips (next section).

#### 3b. Per-block conflict chip on mobile

Mobile screen 2's block selector ([AppointmentBuilderMobile.tsx:475-505](../../modules/appointments/components/AppointmentBuilderMobile.tsx#L475-L505)) currently has three states: active (blue), scheduled (green), unscheduled (slate). Add a fourth: **conflict** (amber border, `AlertTriangle` icon). Precedence: active > conflict > scheduled > unscheduled. The active state styling itself gains an amber ring when the active block has a conflict, so switching away from a conflicted active block doesn't hide the conflict.

The desktop builder doesn't have a chip selector (each block renders inline as `ServiceBlock`), so per-block conflict is reflected via:
- The active block's conflict shows in the Step 4 panel.
- Each `ServiceBlock` component gains a small inline conflict indicator next to its summary text (a small amber `AlertTriangle` + "Conflit horaire" pill). Click switches to that block.

#### 3c. Staff pill availability indicator

When the active block already has `date` and `hour` set, `StaffPills` ([StaffPills.tsx](../../modules/appointments/components/StaffPills.tsx)) marks staff who are unavailable for that exact slot. The pill **stays clickable** — the user might intend to pick the staff first and then change the time.

Indicator (WCAG-compliant, redundant cue):
- Dim the pill background (`opacity-60`).
- Add a small `Clock` icon (Lucide) **and** the text "Indisponible" as a subtitle below the name on a second line (kept compact: `text-[10px] text-amber-700`).
- A small amber dot on the pill is fine as additional reinforcement but never the only signal.

The unavailability check reuses the same logic as `deriveBlockConflicts` for a hypothetical `(staffId, currentDate, currentHour)` per pill. To avoid running the full check N times, expose a memoized helper from the form hook: `isStaffAvailableForSlot(staffId, date, hour, blockIndex): boolean`. Returns true when no conflict would arise. The pill renders an `Indisponible` subtitle when this returns false.

If `date` or `hour` is null, no indicator is shown (nothing to compare against).

#### 3d. Step 4 calendar overlay handling

[StaffCalendarPanel.tsx:172-178](../../modules/appointments/components/StaffCalendarPanel.tsx#L172-L178) currently shows a "Choisissez un membre" overlay when `!hasStaff`, hiding the calendar. With preserved date/time, the calendar may already hold values that the user can't see — actively misleading.

**Change:** when `!hasStaff` but `activeBlock?.date || activeBlock?.hour`, render the calendar in **read-only mode** (`opacity-60 pointer-events-none`, but visible) with a small note: `"Sélectionnez un membre pour modifier l'heure"`. The pre-existing date/time stay visible. When `!hasStaff` and no date/time exists, keep the current overlay (nothing useful to show).

The mobile Screen 2 doesn't have an equivalent overlay — it always renders the calendar. No change needed there.

### Part 4 — Save button: live hint + shake/pulse + toast

#### 4a. `missingFields` derivation

In `useAppointmentForm`, derive `missingFields: MissingField[]` where `MissingField` is one of `'client' | 'service' | 'staff' | 'datetime'`. Order matters — first missing field is the first one to scroll to.

```ts
type MissingField = { kind: 'client' | 'service' | 'staff' | 'datetime'; blockIndex?: number };
```

Logic:
- If neither `clientId` nor `newClient` is set → push `client`.
- For each block with no items → push `service` with that block's index. (The form treats "at least one block has items" as the gate today via `hasCompleteServiceBlock`; we tighten to "all visible blocks must have items" since extra empty blocks are user-removable.)
- For each block with items but no `staffId` AND `staffConfirmed !== true` → push `staff` (allows the explicit "Aucun" case).
- For each block with items but no `date` or no `hour` → push `datetime`.

`hasAnyConflict = blockConflicts.size > 0` is a separate gate. Save is blocked when `missingFields.length > 0 || hasAnyConflict`.

#### 4b. Live "Encore requis" hint

A new component `modules/appointments/components/MissingFieldsHint.tsx` renders the hint:

```tsx
{missingFields.length > 0 && (
  <p className="text-xs text-amber-700 text-center">
    Encore requis : {humanizeMissing(missingFields)}
  </p>
)}
```

`humanizeMissing` produces French labels and dedupes: e.g., `[client, datetime, datetime]` → `"Client, Date & heure"`. Rendering rules:

- **Mobile screen 2 footer** ([AppointmentBuilderMobile.tsx:546-551](../../modules/appointments/components/AppointmentBuilderMobile.tsx#L546-L551)): when `missingFields.length === 0` and no conflicts, show the existing summary (`clientName · serviceNames · firstDate · totalPrice`). When missing, replace with the hint.
- **Mobile screen 1 footer** (`Continuer` button): show hint when `!hasCompleteServiceBlock` (effectively just `Service` and possibly `Client`). The "Continuer" button stays disabled-but-clickable too (consistent feedback).
- **Desktop**: render the hint above the page header's "Enregistrer" button. Right-aligned, same amber palette.

#### 4c. Click-when-disabled: shake + pulse + toast

When the save button is clicked while `missingFields.length > 0 || hasAnyConflict`:

1. **Toast** via `useToast()`: `addToast({ type: 'warning', message: 'Veuillez compléter : <missing fields>' })`. The toast auto-dismisses (5s, the default for non-error types).
2. **Shake animation** on the first missing block / first conflicted block. New CSS keyframe `shake` in `index.css` (translateX ±4px, 400ms, ease-in-out, 2 iterations) triggered by toggling a `data-shake="true"` attribute on the target element for 800ms.
3. **Pulse animation** on the live hint itself (so the user notices the words even if they were ignoring the footer): `animate-pulse` Tailwind utility for 1s.
4. **Scroll target** is screen-aware on mobile:
   - If `missingFields[0]` belongs to screen 1 (`client`, `service`, missing `staff`) and user is on screen 2, **navigate back to screen 1** AND scroll/shake the missing section there. The block-selector chip (if multi-block) gets a one-time amber ring matching the shake.
   - If `missingFields[0]` is `datetime` or there's a conflict and user is on screen 2, scroll within screen 2 to the calendar/banner.
   - On screen 1's `Continuer` click, only screen-1 fields can be missing, so always scroll within screen 1.
5. **Desktop**: scroll to first missing block or first conflict banner. Shake the same target.

Both buttons (mobile `Confirmer`, mobile `Continuer`, desktop `Enregistrer`) become **always clickable**:
- `disabled` styling is preserved visually (`opacity-50`) when `missingFields.length > 0 || hasAnyConflict`, so it still looks like a not-yet-ready button.
- But `disabled` HTML attribute is removed so click events fire.
- Click handler branches: if blocked, run the shake/toast/scroll path; else run the existing handler (`setScreen('scheduling')` / `form.handleSubmit`).
- `aria-disabled="true"` is added when blocked so screen readers convey the state.

### Part 5 — Implementation order

1. **Pure helper + tests:** create `modules/appointments/utils/deriveBlockConflicts.ts` and a Vitest spec covering: no conflict; staff_unavailable; staff_offday; sibling_overlap (exact-same minute, partial overlap, contiguous-not-overlapping); excludeAppointmentIds honored; null-staff blocks skipped. ~8-10 test cases.
2. **Format helpers:** add `formatLongDate(dateStr)` and `formatHour(hour, minute?)` to [lib/format.ts](../../lib/format.ts). Trivial, no test needed beyond an inline assertion.
3. **Hook integration:** `useAppointmentForm` derives `blockConflicts`, `missingFields`, `hasAnyConflict`, `isStaffAvailableForSlot`. Remove the wipe in `updateBlock`. Update `allBlocksScheduled` semantics (or add a parallel `canSubmit` flag — `canSubmit = !missingFields.length && !hasAnyConflict`).
4. **`MissingFieldsHint` + `BlockConflictBanner`** components. Pure presentational.
5. **Shake CSS + `useShake` hook:** small hook that takes a ref and a trigger, sets `data-shake` for 800ms.
6. **Desktop `AppointmentBuilder` + `StaffCalendarPanel`:** mount banner, mount hint above save button, switch save button to always-clickable + shake handler, replace overlay with read-only calendar when date/time exists but no staff.
7. **Mobile `AppointmentBuilderMobile`:** mount banner in screen 2 context header, switch chip selector to four-state (add conflict variant), wire screen-aware scroll/navigate-back logic, switch both `Continuer` and `Confirmer` to always-clickable, mount hint in both footers.
8. **`StaffPills`:** consume `isStaffAvailableForSlot` (via prop), render `Indisponible` subtitle + `Clock` icon + dimmed pill when unavailable.
9. **`ServiceBlock`** (desktop): render small `Conflit horaire` indicator on the block summary when `blockConflicts.has(blockIndex)`.
10. **Manual verification** (see Testing).
11. **Typecheck + tests + build.**
12. **Direct commit to main** (per project workflow preference).

### Risks

- **Per-block conflict derivation perf.** O(blocks × (existingAppointments + blocks)) per render. Acceptable: blocks rarely exceed 4-5 and `existingAppointments` is salon-scoped. Memoization on `serviceBlocks` reference + `availabilityAppointments` reference keeps recomputation bounded.
- **`staffConfirmed` mobile/desktop asymmetry.** Mobile `StaffPills` doesn't set `staffConfirmed: true` ([AppointmentBuilderMobile.tsx:268](../../modules/appointments/components/AppointmentBuilderMobile.tsx#L268)). The new `missingFields.staff` rule allows `staffId !== null` OR `staffConfirmed === true`, so the mobile path works without further change. Desktop `StaffCalendarPanel` already sets both. Documented but not unified.
- **Cross-block "Aucun" interaction.** A block with `staffId: null, staffConfirmed: true` ("Aucun" explicitly selected) doesn't enter sibling-overlap checks (no staff to overlap on). Correct by construction.
- **Realtime mid-edit.** If a remote update populates `availabilityAppointments` while the form is open, `blockConflicts` recomputes via the existing memo dependency. The user sees a new banner appear, which is the right UX — better than learning at save time. `handleSubmit` re-validates conflicts at submit time too (`if (hasAnyConflict) { runShakePath(); return; }`) to close the race window.
- **Scroll-to-first-missing on screen-1 from screen-2.** Requires storing a ref to the screen-1 target during screen-1 render. Simplest approach: each screen-1 section attaches a `data-missing-target="client" / "service" / "staff"` attribute to its root; when navigating back, screen-1 mounts and a one-shot `useEffect` reads `pendingScrollTarget` from form state and runs the scroll + shake. State lives in the parent `AppointmentBuilderMobile` component as `[pendingScrollTarget, setPendingScrollTarget]`.
- **Toast spam on rapid re-clicks.** The shake-toast handler debounces by 500ms (don't fire if a shake is already in flight).

### Testing

**Automated (Vitest):**
- `deriveBlockConflicts.test.ts` — 8-10 cases covering all conflict kinds and the cross-block check.
- `humanizeMissing.test.ts` — 4 cases covering dedup, ordering, French copy.

**Manual (browser, both desktop and mobile via responsive tools):**
1. **Original bug repro:** edit appointment with no staff; pick a staff; date/time stays. ✓
2. **Conflict on staff change:** edit appointment with staff A at 10:00 (10:00 has another booking on staff B); change staff to B; banner appears, save blocked. Change back to A or move time; banner clears.
3. **Cross-block conflict:** create new appointment with two blocks, both same staff, both at 10:00 (same date); banner shows on second block; chip on screen 2 shows amber; save blocked.
4. **Click-disabled feedback (mobile):** new appointment with services + staff but no date/time; click "Confirmer"; toast appears, calendar shakes, hint pulses.
5. **Click-disabled feedback (mobile, cross-screen):** new appointment with no services; navigate to screen 2 is blocked at "Continuer" (the Continuer click also shakes the empty service block on screen 1). On screen 2 with services missing on a non-active block, click "Confirmer" → navigate back to screen 1, screen-1 service block shakes.
6. **Click-disabled feedback (desktop):** click "Enregistrer" with missing client; toast + scroll + shake on Step 1 panel.
7. **Staff pill indicator:** edit appointment with date+hour set; observe staff who don't work that day or are booked at that hour show dimmed + "Indisponible" subtitle.
8. **Off-day banner:** edit appointment for a Sunday; pick staff who has Sunday off; off-day banner copy appears.
9. **"Aucun" path:** click "Aucun" on a block with date/time set; calendar stays visible; no conflict; save allowed.
10. **Pack flow regression:** add a pack; pick staff per block; ensure no double-clear of date/time and conflicts work per-block.
11. **Read-only calendar overlay:** edit appointment that has date/time but no staff; observe calendar visible (read-only) with "Sélectionnez un membre…" note instead of full overlay.
12. **Realtime mid-edit:** open form with staff A at 10:00; in another tab, book staff A at 10:00 for the same date; first tab's banner appears within ~1s.

## Out of scope for this phase

- Date-level availability indicators in `InlineCalendar`. Pills only.
- Extending `TimePicker` to honor salon hours (separate ticket).
- Unifying mobile/desktop `staffConfirmed` semantics.
- Auto-suggesting alternative staff or alternative slots when a conflict appears (just-in-time pickers — possible follow-up).
