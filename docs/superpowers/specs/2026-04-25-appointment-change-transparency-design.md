# Appointment change transparency + linked-transaction link

**Date:** 2026-04-25
**Status:** Spec pending review, ready for implementation

## Problem

The POS deletion pipeline (shipped 2026-04-24) propagates staff and price changes from the cart back to the appointment row. But the appointment detail view shows only the final values — no indication the price or staff was changed, no reason for the change, no pointer to the transaction where it happened.

A cashier, manager, or auditor looking at a past appointment in the Agenda today cannot tell:
- Was this the originally booked price, or a discounted one?
- Did the booked stylist actually deliver the service, or was it swapped?
- Where is the receipt for this appointment?

The cart UI already captures a change reason via `ItemEditorModal` (presets like `-10%`, `-20%`, `Offert`, plus free-text notes). That reason lands on `transaction_items.note` today but doesn't flow to the appointment row.

## Goals

1. Preserve the original price and staff assignment on the appointment row — never overwrite.
2. Capture the change reason from the POS cart onto the appointment row when a modification happens.
3. Render a visual "was → became" diff on the appointment detail view for both price and staff, with the reason below.
4. Provide a one-click link from the appointment detail view to the linked POS transaction receipt.

## Non-goals

- Multi-row price change history. A later modification overwrites the earlier reason — good enough for salon operations.
- Visual diff on the appointment list/card/table views — detail page only.
- Snapshot of staff name (derive live via the existing `staff_members` join — matches current pattern).
- Change tracking for other fields (service, variant, date, duration). Out of scope.

## Design

### Schema

Three columns added to `appointments`:

```sql
ALTER TABLE appointments
  ADD COLUMN original_price NUMERIC(10,2),
  ADD COLUMN original_staff_id UUID REFERENCES staff_members(id),
  ADD COLUMN change_note TEXT;
```

**Snapshot trigger** — BEFORE INSERT, copies `price` and `staff_id` into the `original_*` columns whenever they're NULL on the inserted row. Ensures the snapshot is populated regardless of insertion path (RPC, direct client, bulk import).

```sql
CREATE FUNCTION snapshot_appointment_originals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.original_price IS NULL THEN
    NEW.original_price := NEW.price;
  END IF;
  IF NEW.original_staff_id IS NULL THEN
    NEW.original_staff_id := NEW.staff_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_snapshot_originals
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_appointment_originals();
```

**Backfill** for existing rows:

```sql
UPDATE appointments
SET original_price = price,
    original_staff_id = staff_id
WHERE original_price IS NULL;
```

**Atomicity:** backfill runs before the trigger is created so no race. Both `original_price` and `original_staff_id` stay nullable — the trigger's "fill if NULL" pattern is the load-bearing safeguard. A `NOT NULL` constraint on `original_price` would cause a future cleanup script that nulled the column to fail; the trigger achieves the same correctness with less rigidity.

### RPC

`create_transaction` takes `p_modified_appointments` as `[{id, staff_id?, price?, note?}]`. The `note` field is new in this iteration; when present, it writes to `appointments.change_note`.

```sql
UPDATE appointments
SET staff_id    = COALESCE((v_modification->>'staff_id')::uuid, staff_id),
    price       = COALESCE((v_modification->>'price')::numeric, price),
    change_note = COALESCE(NULLIF(TRIM(v_modification->>'note'), ''), change_note),
    updated_at  = now()
WHERE id = (v_modification->>'id')::uuid
  AND salon_id = p_salon_id
  AND status IN ('SCHEDULED', 'IN_PROGRESS')
  AND deleted_at IS NULL;
```

The `COALESCE(..., change_note)` on the note preserves the previous note when the modification has no note (e.g., a staff change without a reason). A fresh blank note from the cart becomes NULL via `NULLIF(TRIM(...), '')`.

### Client types

`types.ts`:

```ts
interface Appointment {
  // ...existing fields
  originalPrice?: number;
  originalStaffId?: string | null;
  changeNote?: string | null;
}
```

`mappers.ts` (`TransactionModification`):

```ts
export interface TransactionModification {
  id: string;
  staff_id?: string | null;
  price?: number;
  note?: string;  // NEW
}
```

### `diffAppointmentsFromCart`

Extend to carry the cart item's `note` when a modification is emitted:

```ts
if (staffDiff || priceDiff) {
  const mod: AppointmentModification = { id: source.id };
  if (staffDiff) mod.staff_id = item.staffId ?? null;
  if (priceDiff) mod.price = item.price;
  if (item.note) mod.note = item.note;  // NEW
  modifications.push(mod);
}
```

Two new test cases:
- Modification emitted with a note
- Modification emitted without a note (note not set)

### `useLinkedTransaction` hook

New hook at `hooks/useLinkedTransaction.ts`. Fetches the transaction linked to any appointment in the same group as the passed appointment ID.

```ts
const { transaction, isLoading } = useLinkedTransaction(appointment);
```

Implementation:
- Query: `supabase.from('transactions').select('id, ticket_number, appointment_id').eq('salon_id', salonId).in('appointment_id', groupApptIds).maybeSingle()`
- Group IDs derived: if `appointment.groupId` is set, the hook pulls all sibling appointment IDs from the `allAppointments` list already in cache; otherwise just the single appointment's ID
- Returns `null` when no linked transaction exists

Alternative considered: extending `useAppointments` to include linked transactions per appointment. Rejected — adds overhead to every list query for a detail-only feature.

### UI — `AppointmentDetails.tsx`

**Price row:**

```tsx
{appointment.originalPrice != null && appointment.price !== appointment.originalPrice ? (
  <span className="flex items-baseline gap-2">
    <span className="line-through text-slate-400 text-base">
      {formatPrice(appointment.originalPrice)}
    </span>
    <span className="font-semibold text-slate-900">
      {formatPrice(appointment.price)}
    </span>
    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
      Modifié
    </span>
  </span>
) : (
  <span className="font-semibold">{formatPrice(appointment.price)}</span>
)}
```

**Staff row (Option B, strike-through to match price):**

```tsx
{appointment.originalStaffId && appointment.originalStaffId !== appointment.staffId ? (
  <span className="flex items-baseline gap-2">
    <span className="line-through text-slate-400">
      {resolveStaffName(appointment.originalStaffId)}
    </span>
    <span className="text-slate-400">→</span>
    <span className="font-semibold text-slate-900">{appointment.staffName}</span>
  </span>
) : (
  <span className="font-semibold">{appointment.staffName}</span>
)}
```

**Change note row (below either/both modified fields):**

```tsx
{appointment.changeNote && (
  <div className="text-xs text-slate-500 italic mt-1">
    Motif : {appointment.changeNote}
  </div>
)}
```

**Linked transaction button:**

```tsx
{linkedTransaction && (
  <button
    type="button"
    onClick={() =>
      window.open(`/pos/historique/${linkedTransaction.id}/print`, '_blank', 'noopener,noreferrer')
    }
    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
  >
    <Receipt size={16} />
    Voir le reçu · Ticket #{linkedTransaction.ticketNumber}
  </button>
)}
```

**Navigation target:** the existing print route `/pos/historique/:id/print` (already in use by `TransactionSuccessModal` and `POSModals.tsx`). Opens in a new tab — matches existing call sites. Avoids two real problems with the alternative:
- `TransactionHistoryPage` does not support deep-linking by ID (no `useSearchParams` / `URLSearchParams` references in that file)
- The history list only loads the last 30 days, so an older appointment's linked transaction wouldn't even be in the page's data set

The print route loads the single transaction directly via `id`, no date filter dependency.

### Implementation order

1. Migration — columns, trigger, backfill, RPC extension (one file or two — decide by size)
2. Push to remote + regenerate `lib/database.types.ts`
3. `types.ts` — `Appointment` interface gains `originalPrice?`, `originalStaffId?`, `changeNote?`
4. `mappers.ts`:
   - `AppointmentRow` interface: add `original_price`, `original_staff_id`, `change_note` columns
   - `toAppointment` mapper: map the three new columns to camelCase
   - `TransactionModification` type: add `note?: string`
   - `toTransactionRpcPayload` already forwards arrays verbatim — no change needed
   - `toAppointmentInsert` does NOT need updating — the BEFORE INSERT trigger handles the snapshot, the client doesn't pass `original_*`
5. `useTransactions.ts` — already forwards the modifications array as-is; no signature change
6. `diffAppointmentsFromCart` + 2 new tests (note carried through; note absent)
7. `useLinkedTransaction` hook — accepts `(appointment, allAppointments)` so the parent passes its already-cached list (avoids re-running `useAppointments` inside the hook and triggering its realtime subscription registration)
8. `AppointmentDetails.tsx` — price row strike-through, staff row strike-through (Option B), change note italic line, "Voir le reçu" `window.open` button
9. Typecheck + tests + build
10. Manual browser verification (2 scenarios: modified appointment shows the diff; click through to receipt works)
11. Direct commit to main (no branch per updated workflow preference)

### Risks

- **`TransactionHistoryPage` may not support deep-linking by ID.** Mitigation: inspect the route signature during step 8; if not supported, either extend the page to accept a query param or settle for a link to the history index.
- **Migration sequence matters.** Backfill before `NOT NULL` constraint, trigger creation before any insert could race. Wrap in a single migration file for atomicity.
- **Trigger + snapshot preservation on restore paths.** The deletion+restore trigger from Phase A clears `deletion_*` fields when status leaves CANCELLED. It does NOT touch `change_note`, `original_price`, or `original_staff_id` — these are meant to persist. Verify during code review.

### Testing

Automated:
- `diffAppointmentsFromCart` gains two tests for note passthrough (with + without note)
- Existing tests must continue passing

Manual (one-pass verification before commit):
- Create an appointment, import to POS, change price with `-20%` preset → ring up → detail view shows strike-through + "Modifié" badge + note "-20%"
- Change staff instead → detail shows strike-through original staff → new staff
- Combine both → both diffs visible, note from whichever field carried it
- Unmodified appointment → no diffs, no badges, single price + single staff row
- Completed appointment → "Voir le reçu · Ticket #" button present and navigates correctly

## Out of scope for this phase

- Historical list of all past modifications (one-note overwrites)
- Modifying an appointment from the Agenda (non-POS flow) — the `change_note` column stays null on Agenda-driven edits, but the strike-through diff WILL still appear on the detail view (because the price/staff fields differ from the originals). Intended behavior; just no Motif text below the diff.
- Un-completed transactions (e.g., voids) — if a transaction is voided, the linked-transaction link still shows it, which might be confusing. Accepted as a future refinement.
