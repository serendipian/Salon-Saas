# Deletion reasons and POS deletion pipeline

**Date:** 2026-04-24
**Status:** Design approved, ready for plan

## Problem

Two user-reported POS issues plus a broader architectural unification.

### POS bugs

1. **Cannot unselect an appointment at POS.** Clicking a card that's already linked to the cart does nothing — the button is `disabled={isLinked}`. The user has to manually clear the cart to try a different appointment.
2. **Print receipt crashes with an abort error.** Opening the print view shows *"Impossible d'afficher le reçu — signal is aborted without reason"*. The print page's effect cleanup aborts an in-flight fetch, and React Strict Mode's double-invocation makes this fire on every mount; the catch handler doesn't discriminate `AbortError` from real failures.
3. **Filter UI on the Rendez-vous tab does not match the rest of the POS.** Three stacked labeled chip rows sit in the header area; the Services tab uses one horizontal chip row with a specific pill style. The inconsistency looks broken.
4. **Services tab defaults to "Toutes" after leaving and returning.** The Favoris auto-select fires exactly once per session; switching to Produits or Rendez-vous and back loses it.

### The deeper problem

Appointment cancellation and POS service removal are the same business event under different skins — a booked service that did not convert into revenue. The existing machinery from commit `88be880` introduced `CancellationReason` (4 values: `CANCELLED`, `REPLACED`, `OFFERED`, `OTHER`) for the advance-cancellation flow. We now need the same machinery for POS: when a cashier removes a service from the cart, they pick a reason, and the appointment row records it.

Reusing the existing enum as-is has two defects:

1. **`OTHER` is a code smell.** It was a dumping ground for reasons we hadn't named yet. In a POS context the two concrete reasons that surface are *client complained about the service* and *staff/system error*. Adding them to the enum and retiring `OTHER` tightens the data.
2. **`CancellationReason` is the wrong name once POS deletions are in scope.** The common operation is "a booked service was deleted from the billable pool" — `DeletionReason` names the unified concept; the status value `CANCELLED` remains in the status enum since that's the DB-level state the deletion puts a row into.

### POS bugs #1–#2 tied to the pipeline

A third POS problem sits inside the deletion pipeline itself:

- When an appointment group has services A + B, the cashier imports both, deletes B from the cart, and rings up A, the existing `create_transaction` RPC marks **both** A and B `COMPLETED`. There is no concept of "some services were dropped". B shows up as done in the Agenda even though it was never charged.
- Similarly, when a cashier changes the staff or price on a cart line that came from an appointment, the appointment row does not reflect the change. The booking record forever shows the original, not what actually happened.

Both need fixing as part of the POS deletion pipeline feature.

## Goals

1. **Unify the vocabulary.** Rename the enum to `DeletionReason`, drop `OTHER`, add `COMPLAINED` and `ERROR`. Rename DB columns, CHECK constraints, triggers, the bulk RPC. Propagate through every consumer.
2. **Fix four small POS bugs** on the stalled filters branch.
3. **Make POS deletions record a reason** on the appointment row, just like an advance cancellation does. Carry cart-item modifications (staff, price) into the appointment record. Fix the "everything gets marked COMPLETED" bug as part of this.

## Non-goals

- A `deletion_source` column distinguishing POS vs advance-cancel. YAGNI for now; derivable from whether a linked transaction row exists.
- Separate enum for POS removals vs advance cancellation. One unified set of five reasons covers both.
- Retaining the single-row `cancel_appointment` RPC. Already dropped on main.
- A status badge for "modified" appointments. Phase C updates the row in place; the Agenda shows the actual staff/price. No diff icon.

## Design

### Migration: existing `OTHER` rows

`UPDATE appointments SET cancellation_reason = 'CANCELLED' WHERE cancellation_reason = 'OTHER'` before the constraint swap. The note field carries whatever context was captured; no information is lost beyond the reason-category downgrade. Decision: user explicitly chose A2 (downgrade to generic `CANCELLED`).

### Phase A — `DeletionReason` unification

Branch: `feat/rename-to-deletion-reason` off `main`.

**DB migration** (`20260424180000_rename_cancellation_to_deletion_reason.sql`):
- Backfill `OTHER` → `CANCELLED`
- Rename columns: `cancellation_reason` → `deletion_reason`, `cancellation_note` → `deletion_note`
- Keep `cancelled_at` (renaming collides with existing `deleted_at` column for soft-delete)
- Drop-and-recreate the two CHECK constraints with new names + 5 allowed values
- Drop-and-recreate the trigger and its function with new names
- Drop `cancel_appointments_bulk` and create `delete_appointments_bulk` with the 5-value validation

**App layer**:
- `types.ts`: enum rename + value list, Appointment field renames (`deletionReason`, `deletionNote`)
- `mappers.ts`: `AppointmentRow` column names + `toAppointment` field names
- `CancelAppointmentModal.tsx` → `DeleteAppointmentModal.tsx` — rename, update 5 reason options, drop note-required logic for OTHER
- `StatusBadge.tsx`: add `COMPLAINED` (rose-pink palette) and `ERROR` (slate palette) to `REASON_CONFIG`
- `useAppointments.ts`: `cancelAppointmentMutation` → `deleteAppointmentMutation`, method rename, RPC name, optimistic-patch field names
- `useMutationToast.ts`: keep error codes (`APPT_ALREADY_CANCELLED` still accurate since status literal is still `CANCELLED`), update any user-facing French strings
- Propagate field renames through the six consumer files (`AppointmentListPage`, `AppointmentDetailPage`, `AppointmentDetails`, `AppointmentCard`, `AppointmentTable`, `AppointmentList`)
- `database.types.ts`: regenerate after migration via `npm run db:types`

UI terminology: the French user-facing labels ("Annuler", "Confirmer l'annulation") stay. The rename is internal / semantic only. The status badge on a dropped appointment still says "Annulé" or the specific reason label.

### Phase B — four small POS fixes

Branch: `feat/pos-appointments-filters` rebased onto `main`.

**Rebase strategy.** My Task-1 commit `5398e49` did two things: allow `IN_PROGRESS` (now on main as `9262e4e`) and restrict to today-only (not on main). On rebase, the IN_PROGRESS portion is a no-op (already done on main); I keep the today-only portion. Likely one conflict in `pendingAppointments` memo to resolve by hand.

**The four fixes** (one atomic commit post-rebase):

- **#1 Unselect.** Change `disabled={isLinked}` at [PendingAppointments.tsx:53](modules/pos/components/PendingAppointments.tsx#L53) to `disabled={false}`. Rename the "Dans le panier" badge to "Cliquer pour retirer" when linked. Change `onClick` to toggle: if `isLinked`, call the hook's `clearCart()` (need to export); else call `onImport(primary)`.
- **#3 Print abort.** At [ReceiptPrintPage.tsx:47-49](modules/pos/ReceiptPrintPage.tsx#L47-L49), skip `DOMException` with name `AbortError`.
- **#4 Filter UI.** Rewrite `AppointmentFilters.tsx` as one horizontal chip row placed in the same slot currently occupied by the Services category chips. Chip style matches `px-4 py-2.5 rounded-lg bg-white text-slate-600 border border-slate-200` (inactive) / colored bg (active). Staff chips prefix with the staff photo; category chips show the colored dot; status chips show "Planifié"/"En cours" labels. Small `w-px` dividers between dimension groups. Reset link to the right.
- **#5 Favoris default.** In `usePOS.ts`, remove the `hasDefaultedToFavorites` ref guard. Instead, wrap `setViewMode` so that whenever the new mode is `'SERVICES'` and favorites exist, `selectedCategory` is set to `'FAVORITES'` at the same time.

### Phase C — POS deletion pipeline with reason + modification propagation

Branch: `feat/pos-deletion-pipeline` off `feat/rename-to-deletion-reason` (Phase A).

**CartItem extension.** Add `appointmentId?: string` to the `CartItem` type. Populated by `importAppointment` when the item originates from an appointment.

**Cart-level deletion UX.** When `removeFromCart(id)` or `updateQuantity` would drop a cart item with a populated `appointmentId`, open `DeleteAppointmentModal` (from Phase A), and on confirm record `{appointmentId, reason, note}` into an in-hook `pendingDeletions` map. Only then remove the cart item. If the user cancels the modal, the cart item stays.

**Modification detection.** Before `processTransaction` runs, compute the delta between current cart items and their source appointments. For each cart item with `appointmentId`, if the current `staffId` or `price` differs from the appointment's stored values, collect `{appointmentId, staffId, price}` modifications.

**RPC signature extension** (`20260424190000_create_transaction_with_deletions.sql`):

```sql
create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_deleted_appointments JSONB DEFAULT '[]',     -- [{id, reason, note}]
  p_modified_appointments JSONB DEFAULT '[]'     -- [{id, staff_id, price}]
) RETURNS UUID
```

RPC behavior:
- Honoured appointments (in cart, same group as `p_appointment_id`): mark COMPLETED as today
- Deleted appointments (listed in `p_deleted_appointments`): set `status='CANCELLED'`, `deletion_reason=...`, `deletion_note=...`, `cancelled_at=now()`
- Modified appointments: `UPDATE appointments SET staff_id = ..., price = ... WHERE id = ...` — same transaction, atomic with the rest
- Validates reasons against the 5-value list
- The `appointment_groups.status` aggregate is set to `COMPLETED` only if all siblings ended up COMPLETED; if any sibling was deleted, group status is left as-is (for future group-level badges, if we care)

**Visual verification.** No new components in Agenda/List — the existing StatusBadge already renders reason-specific colors and the appointment card / table rows pull their staff and price from the appointment row itself. Phase C just makes sure the row reflects reality.

### Phase dependency graph

```
main
 ├── Phase A: feat/rename-to-deletion-reason  ──┐
 │                                               └── merged to main
 │                                                   └── Phase C: feat/pos-deletion-pipeline
 └── Phase B: feat/pos-appointments-filters (rebased onto main)
     └── merged to main (parallel with A)
```

Phase B can ship in parallel with A — they touch disjoint surface areas. Phase C waits for A to merge because it imports `DeletionReason` and calls `delete_appointments_bulk`.

## Risks & mitigations

- **Migration touches a live feature.** The cancel-with-reason flow just shipped. The rename migration will briefly (during execution) have both old and new column names coexisting if anything fails. Keep the migration atomic (single `BEGIN; ... COMMIT;` implicit at the file level), and test on a local reset before applying remote.
- **`database.types.ts` drift.** Phase A regenerates the file and commits it; any consumer file that references stale generated types will fail typecheck in the same PR, caught before merge.
- **`feat/pos-appointments-filters` rebase.** Has 5 commits to skip past. My Task-1 commit duplicates main's IN_PROGRESS fix. Expect one hand-resolve in `pendingAppointments` memo.
- **Phase C's deletion modal flow blocks a common path.** If the cashier clicks the trash icon on a cart item from an appointment, we block them mid-flow to pick a reason. That's the desired behavior, but the modal dismissal needs to leave the cart untouched (we don't want the item gone with no reason recorded). Implementation: modal confirm → remove; modal cancel → do nothing.

## Testing strategy

### Phase A

- Run `npm test` — existing suite catches enum misuses via TypeScript.
- Manual verification of the advance-cancellation flow with all 5 reasons.
- Verify existing `OTHER` rows (if any) are migrated to `CANCELLED` and that appointment detail view still renders them correctly.
- Verify the un-cancel path (status dropdown) still clears metadata.

### Phase B

- Automated: `tsc --noEmit`, `npm test`, production build.
- Manual: walk through the 12-item verification checklist from the original filters plan plus the four new fixes.

### Phase C

- Extend `groupAndFilterAppointments.test.ts` is unrelated; write targeted tests for the RPC payload builder and the deletion-tracking hook state.
- Manual:
  - Import a 2-service appointment group, remove one, complete transaction → deleted appointment shows reason in Agenda; charged appointment shows COMPLETED
  - Import an appointment, change the staff on the cart line, complete transaction → appointment staff updated
  - Import an appointment, change the price, complete transaction → appointment price updated
  - Combine deletion + modification in one transaction → both effects land atomically

## Open questions

None. All decisions are final:
- A2: `OTHER` → `CANCELLED` for existing rows
- Drop the old `cancel_appointments_bulk` RPC outright (no shim)
- Keep `cancelled_at` column name (avoids collision with `deleted_at`)
- French UI strings unchanged
- No `deletion_source` column (derive from transaction link if ever needed)
