# Deletion Reasons and POS Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three related pieces of work: (A) rename + extend the appointment cancellation-reason vocabulary to a unified `DeletionReason` with five values, (B) four small POS fixes on the stalled filters branch, (C) POS deletion pipeline that records per-service reasons, propagates modifications, and stops falsely marking dropped services as COMPLETED.

**Architecture:** Phase A renames `CancellationReason` → `DeletionReason` with DB column/constraint/RPC renames propagated through all consumers. Phase B rebases `feat/pos-appointments-filters` onto main and adds four surgical fixes. Phase C extends `CartItem` with `appointmentId`, reuses the Phase-A deletion modal in the POS cart, and teaches `create_transaction` to record reasons per appointment and apply staff/price modifications to the linked rows.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest, Supabase (Postgres 15).

**Spec:** [docs/superpowers/specs/2026-04-24-deletion-reasons-and-pos-pipeline-design.md](../specs/2026-04-24-deletion-reasons-and-pos-pipeline-design.md)

**Phase dependency:** A → C (C needs A's enum/RPC). B is independent of A and can ship in parallel.

---

## Phase A — Unify to `DeletionReason`

**Branch:** `feat/rename-to-deletion-reason` off `main`.
**Goal:** Rename `CancellationReason` → `DeletionReason`, extend to five values (drop `OTHER`, add `COMPLAINED` + `ERROR`), and propagate rename through DB schema, RPC, and every app-layer consumer.

### File Plan (Phase A)

**Create:**
- `supabase/migrations/20260424180000_rename_cancellation_to_deletion_reason.sql`
- `modules/appointments/components/DeleteAppointmentModal.tsx` (replaces `CancelAppointmentModal.tsx`)

**Modify:**
- `types.ts` — enum + `Appointment` field renames
- `modules/appointments/mappers.ts` — row shape + mapper
- `modules/appointments/components/StatusBadge.tsx` — add two reasons to `REASON_CONFIG`
- `modules/appointments/hooks/useAppointments.ts` — mutation + method + optimistic patch renames
- `modules/appointments/pages/AppointmentListPage.tsx` — handler type + modal import
- `modules/appointments/pages/AppointmentDetailPage.tsx` — same
- `modules/appointments/components/AppointmentDetails.tsx` — field name pass-through
- `modules/appointments/components/AppointmentCard.tsx` — same
- `modules/appointments/components/AppointmentTable.tsx` — same
- `modules/appointments/components/AppointmentList.tsx` — same
- `hooks/useMutationToast.ts` — user-facing French strings (error codes stay)
- `lib/database.types.ts` — regenerated via `npm run db:types`

**Delete:**
- `modules/appointments/components/CancelAppointmentModal.tsx`

---

### Task A.1: Branch setup

- [ ] **Step 1: Verify we're on main and up to date**

```bash
git checkout main
git status
```

Expected: working tree clean, on main at `5b92b61`.

- [ ] **Step 2: Create the phase branch**

```bash
git checkout -b feat/rename-to-deletion-reason
```

---

### Task A.2: Write the migration

**Files:** Create `supabase/migrations/20260424180000_rename_cancellation_to_deletion_reason.sql`

- [ ] **Step 1: Author the migration file**

```sql
-- Unify the "reason a booked service was not delivered/charged" vocabulary
-- across advance-cancellation and POS-deletion flows.
--
-- Renames:
--   CancellationReason (enum)    → DeletionReason
--   cancellation_reason (col)    → deletion_reason
--   cancellation_note   (col)    → deletion_note
--   cancelled_at        (col)    → unchanged (would collide with deleted_at)
--   cancel_appointments_bulk RPC → delete_appointments_bulk
--   trigger + its function       → renamed
--
-- Value set changes:
--   Drop OTHER (vague dumping ground)
--   Add COMPLAINED (client unhappy — service not charged)
--   Add ERROR (staff/system mistake)
--   Final: CANCELLED, REPLACED, OFFERED, COMPLAINED, ERROR
--
-- Migration of existing OTHER rows: downgrade to CANCELLED (the generic).
-- Note field is preserved across the rename so no context is lost.

-- 1. Backfill OTHER → CANCELLED BEFORE swapping the CHECK constraint
UPDATE appointments
   SET cancellation_reason = 'CANCELLED'
 WHERE cancellation_reason = 'OTHER';

-- 2. Rename columns
ALTER TABLE appointments RENAME COLUMN cancellation_reason TO deletion_reason;
ALTER TABLE appointments RENAME COLUMN cancellation_note   TO deletion_note;
-- cancelled_at stays — renaming would collide with the existing deleted_at
-- (soft-delete timestamp).

-- 3. Drop and recreate CHECK constraints with new names + 5 allowed values
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_deletion_reason_check
  CHECK (
    deletion_reason IS NULL
    OR deletion_reason IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR')
  );

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_consistency_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_deletion_consistency_check
  CHECK (
    deletion_reason IS NULL
    OR status = 'CANCELLED'
  );

-- 4. Drop old trigger and its function, create renamed versions
DROP TRIGGER IF EXISTS appointments_clear_cancellation_on_uncancel ON appointments;
DROP FUNCTION IF EXISTS clear_cancellation_on_uncancel();

CREATE OR REPLACE FUNCTION clear_deletion_metadata_on_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a row leaves CANCELLED, clear the deletion metadata so the
  -- consistency CHECK stays satisfied.
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    NEW.deletion_reason := NULL;
    NEW.deletion_note   := NULL;
    NEW.cancelled_at    := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_clear_deletion_on_restore
  BEFORE UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED')
  EXECUTE FUNCTION clear_deletion_metadata_on_restore();

-- 5. Drop the old bulk RPC, create delete_appointments_bulk with the 5-value
--    validation. Only caller (useAppointments.ts) is updated in the same PR.
DROP FUNCTION IF EXISTS cancel_appointments_bulk(UUID[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION delete_appointments_bulk(
  p_appointment_ids UUID[],
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
  v_salon_id UUID;
  v_count INTEGER := 0;
  v_trimmed_note TEXT;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR') THEN
    RAISE EXCEPTION 'Invalid deletion reason: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_trimmed_note := NULLIF(TRIM(p_note), '');

  FOREACH v_id IN ARRAY p_appointment_ids
  LOOP
    SELECT status, salon_id INTO v_status, v_salon_id
    FROM appointments
    WHERE id = v_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Appointment not found or already archived';
    END IF;

    IF v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])) THEN
      RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action'
        USING ERRCODE = '42501';
    END IF;

    IF v_status = 'COMPLETED' THEN
      RAISE EXCEPTION 'APPT_COMPLETED:Cannot delete a completed appointment'
        USING ERRCODE = 'P0001';
    END IF;
    -- CANCELLED → idempotent skip (UPDATE below excludes via status <> 'CANCELLED')
  END LOOP;

  UPDATE appointments
  SET status           = 'CANCELLED',
      deletion_reason  = p_reason,
      deletion_note    = v_trimmed_note,
      cancelled_at     = now()
  WHERE id = ANY(p_appointment_ids)
    AND deleted_at IS NULL
    AND status <> 'CANCELLED';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_appointments_bulk(UUID[], TEXT, TEXT) TO authenticated;
```

- [ ] **Step 2: Apply locally (against remote dev DB)**

Because this project uses remote Supabase only (no Docker per `memory/project_status.md`), push via the Supabase CLI:

```bash
npx supabase db push --project-ref izsycdmrwscdnxebptsx --password "$SUPABASE_DB_PASSWORD"
```

Expected: migration applies cleanly. If the remote DB has data with `cancellation_reason = 'OTHER'`, those rows get downgraded to `CANCELLED` and the note is preserved.

- [ ] **Step 3: Regenerate generated types**

```bash
npm run db:types
```

This writes to `lib/database.types.ts`. Stage this file with the migration in step A.8.

---

### Task A.3: Update `types.ts`

**Files:** Modify `types.ts`

- [ ] **Step 1: Rename the enum and update values**

Locate [types.ts:14-19](types.ts#L14-L19):

Old:
```ts
export enum CancellationReason {
  CANCELLED = 'CANCELLED',
  REPLACED = 'REPLACED',
  OFFERED = 'OFFERED',
  OTHER = 'OTHER',
}
```

New:
```ts
// Reason codes for why a booked service was deleted (either via advance
// cancellation or via removal from the POS cart). Stored on the appointment
// row alongside status='CANCELLED'. UI displays these via StatusBadge.
export enum DeletionReason {
  CANCELLED = 'CANCELLED',   // Client cancelled — generic
  REPLACED = 'REPLACED',     // Swapped for a different service
  OFFERED = 'OFFERED',       // Performed as a gift / complimentary, not billed
  COMPLAINED = 'COMPLAINED', // Client complained — service not charged
  ERROR = 'ERROR',           // Staff or system mistake
}
```

- [ ] **Step 2: Rename fields on Appointment interface**

Locate [types.ts:381-383](types.ts#L381-L383):

Old:
```ts
  cancellationReason?: CancellationReason | null;
  cancellationNote?: string | null;
  cancelledAt?: string | null;
```

New:
```ts
  deletionReason?: DeletionReason | null;
  deletionNote?: string | null;
  cancelledAt?: string | null;  // unchanged name
```

---

### Task A.4: Update `mappers.ts`

**Files:** Modify `modules/appointments/mappers.ts`

- [ ] **Step 1: Update import**

Change `CancellationReason` → `DeletionReason` in the import at line 6.

- [ ] **Step 2: Update AppointmentRow interface**

Locate the `cancellation_reason: string | null;` line (around line 29). Change to:
```ts
  deletion_reason: string | null;
  deletion_note: string | null;
```
Remove the old `cancellation_note` line if present on a nearby line.

- [ ] **Step 3: Update toAppointment mapper**

Locate lines ~61-63:

Old:
```ts
cancellationReason: (row.cancellation_reason as CancellationReason | null) ?? null,
cancellationNote: row.cancellation_note ?? null,
cancelledAt: row.cancelled_at ?? null,
```

New:
```ts
deletionReason: (row.deletion_reason as DeletionReason | null) ?? null,
deletionNote: row.deletion_note ?? null,
cancelledAt: row.cancelled_at ?? null,
```

---

### Task A.5: Create the renamed modal

**Files:** Create `modules/appointments/components/DeleteAppointmentModal.tsx`, delete `modules/appointments/components/CancelAppointmentModal.tsx`

- [ ] **Step 1: Create the new modal file**

Create `modules/appointments/components/DeleteAppointmentModal.tsx`:

```tsx
import type React from 'react';
import { useEffect, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { DeletionReason } from '../../../types';

interface ReasonOption {
  code: DeletionReason;
  label: string;
  hint: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  { code: DeletionReason.CANCELLED, label: 'Annulé', hint: 'Le rendez-vous n’aura pas lieu' },
  { code: DeletionReason.REPLACED, label: 'Remplacé', hint: 'Le service a été remplacé par un autre' },
  { code: DeletionReason.OFFERED, label: 'Offert', hint: 'Offert — ne sera pas facturé' },
  { code: DeletionReason.COMPLAINED, label: 'Réclamation', hint: 'Client mécontent — non facturé' },
  { code: DeletionReason.ERROR, label: 'Erreur', hint: 'Erreur de saisie ou de réservation' },
];

export interface DeleteAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: 'single' | 'group';
  subjectLabel?: string;
  count?: number;
  onConfirm: (reason: DeletionReason, note: string) => void | Promise<void>;
  isSubmitting?: boolean;
}

export const DeleteAppointmentModal: React.FC<DeleteAppointmentModalProps> = ({
  isOpen,
  onClose,
  scope,
  subjectLabel,
  count,
  onConfirm,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState<DeletionReason>(DeletionReason.CANCELLED);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(DeletionReason.CANCELLED);
      setNote('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (isSubmitting) return;
    void onConfirm(reason, note);
  };

  const title =
    scope === 'group'
      ? `Annuler la visite${count && count > 1 ? ` (${count} services)` : ''}`
      : 'Annuler ce rendez-vous';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" dismissible={!isSubmitting}>
      <div className="px-6 pb-6 space-y-5">
        {subjectLabel && (
          <p className="text-sm text-slate-600">
            {scope === 'group' ? (
              <>Client : <span className="font-medium text-slate-900">{subjectLabel}</span></>
            ) : (
              <>Service : <span className="font-medium text-slate-900">{subjectLabel}</span></>
            )}
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700 mb-2">Motif</legend>
          <div className="grid grid-cols-1 gap-2">
            {REASON_OPTIONS.map((opt) => {
              const isActive = reason === opt.code;
              return (
                <label
                  key={opt.code}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete-reason"
                    value={opt.code}
                    checked={isActive}
                    onChange={() => setReason(opt.code)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
                    <span className="block text-xs text-slate-500">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="delete-note" className="block text-sm font-medium text-slate-700 mb-1.5">
            Note <span className="text-slate-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            id="delete-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Détail supplémentaire (visible dans l'historique)"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm transition-all shadow-sm placeholder:text-slate-400 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Annulation...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

Differences from the old modal:
- Type rename throughout
- 5 reason options; `OTHER` replaced with two specific ones (COMPLAINED, REPLACED existing; COMPLAINED, ERROR added)
- No more "noteRequired" logic — note is always optional (none of the 5 codes is a catch-all)
- Radio `name` attribute: `cancel-reason` → `delete-reason`
- Field id: `cancel-note` → `delete-note`
- Confirm button label: "Confirmer l'annulation" → "Confirmer" (the action in context is clear from title)

- [ ] **Step 2: Delete the old modal file**

```bash
git rm modules/appointments/components/CancelAppointmentModal.tsx
```

---

### Task A.6: Update `StatusBadge.tsx`

**Files:** Modify `modules/appointments/components/StatusBadge.tsx`

- [ ] **Step 1: Update import**

`CancellationReason` → `DeletionReason` at line 4.

- [ ] **Step 2: Extend REASON_CONFIG**

Locate `REASON_CONFIG` (around lines 44-65). The existing mapping for `CancellationReason.CANCELLED`, `REPLACED`, `OFFERED`, `OTHER` becomes:

```ts
const REASON_CONFIG: Record<DeletionReason, {
  label: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  [DeletionReason.CANCELLED]: {
    label: 'Annulé',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  [DeletionReason.REPLACED]: {
    label: 'Remplacé',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  [DeletionReason.OFFERED]: {
    label: 'Offert',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
  },
  [DeletionReason.COMPLAINED]: {
    label: 'Réclamation',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  [DeletionReason.ERROR]: {
    label: 'Erreur',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
  },
};
```

- [ ] **Step 3: Update prop + resolveConfig**

Any reference to `cancellationReason` in this file (props, parameters, switch branches) → `deletionReason`.

---

### Task A.7: Update `useAppointments.ts`

**Files:** Modify `modules/appointments/hooks/useAppointments.ts`

- [ ] **Step 1: Update import**

```ts
import { /* other imports */, type DeletionReason } from '../../../types';
```

- [ ] **Step 2: Rename mutation, method, type, and RPC name**

Rename throughout the file:
- `CancelVars` type → `DeleteVars`
- `cancelAppointmentMutation` → `deleteAppointmentMutation`
- `cancelAppointments` (exported method, ~line 392) → `deleteAppointments`
- `reason: CancellationReason` → `reason: DeletionReason` in type signatures (appears at least at lines 261, 392)
- `supabase.rpc('cancel_appointments_bulk', ...)` → `supabase.rpc('delete_appointments_bulk', ...)`
- Optimistic patch fields at lines ~298-300: `cancellationReason` → `deletionReason`, `cancellationNote` → `deletionNote`. Keep `cancelledAt`.

---

### Task A.8: Propagate renames through consumer files

**Files:** Modify six consumer files. These are all mechanical field/type renames; follow the pattern for each.

- [ ] **Step 1: `AppointmentListPage.tsx`**

Imports: `CancellationReason` → `DeletionReason`, `CancelAppointmentModal` → `DeleteAppointmentModal`.
Handler signature: `reason: DeletionReason`.
JSX: `<CancelAppointmentModal` → `<DeleteAppointmentModal`.
Hook method call: `cancelAppointments` → `deleteAppointments`.

- [ ] **Step 2: `AppointmentDetailPage.tsx`**

Same pattern as A.8 Step 1.

- [ ] **Step 3: `AppointmentDetails.tsx`**

Field references at lines 76 and 183: `cancellationReason` → `deletionReason`.
Note-display pass-through: `cancellationNote` → `deletionNote`.

- [ ] **Step 4: `AppointmentCard.tsx`**

Same field pattern.

- [ ] **Step 5: `AppointmentTable.tsx`**

Same field pattern.

- [ ] **Step 6: `AppointmentList.tsx`**

Same field pattern (and any status-filter handling if present).

- [ ] **Step 7: Grep sweep for remaining references**

```bash
grep -rn "CancellationReason\|cancellationReason\|cancellation_reason\|cancellation_note\|cancellationNote\|CancelAppointmentModal\|cancel_appointments_bulk\|cancelAppointmentMutation\|cancelAppointments\b" --include="*.ts" --include="*.tsx" modules/ hooks/ types.ts lib/ | grep -v database.types.ts
```

Expected: zero results. If any remain, update them.

---

### Task A.9: Update `useMutationToast.ts`

**Files:** Modify `hooks/useMutationToast.ts`

- [ ] **Step 1: Review error-code messages**

At ~line 17-20 there's an entry for `APPT_ALREADY_CANCELLED`. Keep the code name itself (the DB raises this literal), but the user-facing French message can stay: "Ce rendez-vous est déjà annulé" still describes the state accurately since status is `CANCELLED`.

If there's any reference to "annulation" in user-facing strings attached to the delete flow, leave as-is — the user-facing word remains "annuler" per the spec.

No functional change required here unless new codes are introduced. Confirm by reading the file.

---

### Task A.10: Typecheck, test, commit

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If any remain, fix them — likely missed references in consumer files.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build sanity check**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Stage and commit everything**

```bash
git add \
  supabase/migrations/20260424180000_rename_cancellation_to_deletion_reason.sql \
  lib/database.types.ts \
  types.ts \
  modules/appointments/mappers.ts \
  modules/appointments/components/DeleteAppointmentModal.tsx \
  modules/appointments/components/StatusBadge.tsx \
  modules/appointments/hooks/useAppointments.ts \
  modules/appointments/pages/AppointmentListPage.tsx \
  modules/appointments/pages/AppointmentDetailPage.tsx \
  modules/appointments/components/AppointmentDetails.tsx \
  modules/appointments/components/AppointmentCard.tsx \
  modules/appointments/components/AppointmentTable.tsx \
  modules/appointments/components/AppointmentList.tsx \
  hooks/useMutationToast.ts
git rm modules/appointments/components/CancelAppointmentModal.tsx
git commit -m "refactor(appointments): rename CancellationReason to DeletionReason

Unifies the reason-code vocabulary ahead of the POS deletion pipeline
feature. Advance cancellation and POS service removal are the same
business event — a booked service that was not delivered or charged —
so they share a single enum, modal, DB column, and StatusBadge palette.

Value set changes:
- Drop OTHER (vague dumping ground)
- Add COMPLAINED (client unhappy, not charged)
- Add ERROR (staff / system mistake)
- Final: CANCELLED, REPLACED, OFFERED, COMPLAINED, ERROR

Existing OTHER rows downgraded to CANCELLED; notes preserved.
The old single-row cancel_appointment RPC has been gone since 5b92b61;
this PR also drops cancel_appointments_bulk in favor of
delete_appointments_bulk with the 5-value validation.

User-facing French UI strings ('Annuler', 'Confirmer') are unchanged.
The status literal 'CANCELLED' stays — only the reason vocabulary is
renamed."
```

- [ ] **Step 5: Manual verification**

Start `npm run dev`, open an appointment, click the trash icon, confirm:
- Modal opens, shows 5 reasons, no "OTHER"
- COMPLAINED has the rose badge; ERROR has the slate badge
- Confirming with a reason cancels the appointment; badge on the list shows the correct label + color
- Un-cancelling via the status dropdown clears the reason/note (trigger verified)

---

## Phase B — Four small POS fixes

**Branch:** `feat/pos-appointments-filters` rebased onto `main`.
**Goal:** Land the stalled filters work plus four targeted fixes.

### File Plan (Phase B)

**Modify (via rebase or new edits on rebased branch):**
- `modules/pos/hooks/usePOS.ts` — Favoris default + keep today-only filter
- `modules/pos/components/PendingAppointments.tsx` — unselect toggle
- `modules/pos/ReceiptPrintPage.tsx` — AbortError skip
- `modules/pos/components/AppointmentFilters.tsx` — single-row chip layout matching Services

---

### Task B.1: Rebase the branch

- [ ] **Step 1: Check out the filters branch**

```bash
git checkout feat/pos-appointments-filters
```

- [ ] **Step 2: Rebase onto current main**

```bash
git fetch origin
git rebase origin/main
```

- [ ] **Step 3: Resolve the `pendingAppointments` memo conflict**

The conflict is in `modules/pos/hooks/usePOS.ts`. Main's commit `9262e4e` extended the filter to accept IN_PROGRESS (same as my commit's first change) but left the time window as "anything before tomorrow" (not today-only). My commit `5398e49` additionally restricted to today-only.

Open the file. At the `pendingAppointments` memo, accept the IN_PROGRESS part from main, and apply the today-only restriction on top. The final body should read:

```ts
const pendingAppointments = useMemo(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();

  return allAppointments
    .filter((a) => {
      if (a.status !== 'SCHEDULED' && a.status !== 'IN_PROGRESS') return false;
      // Today only — past-day overdues are stale data, not billable work
      return a.date >= todayStart && a.date < tomorrowStart;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}, [allAppointments]);
```

Then continue the rebase:

```bash
git add modules/pos/hooks/usePOS.ts
git rebase --continue
```

- [ ] **Step 4: Typecheck + test after rebase**

```bash
npx tsc --noEmit
npm test
```

Expected: clean. If anything broke, stop and investigate — do not mask a regression.

---

### Task B.2: Fix #1 — unselect an appointment

**Files:** Modify `modules/pos/components/PendingAppointments.tsx`, `modules/pos/hooks/usePOS.ts` (maybe export `clearCart`)

- [ ] **Step 1: Check if `clearCart` is already exported from `usePOS`**

```bash
grep -n "clearCart" modules/pos/hooks/usePOS.ts
```

If `clearCart` is internal only (defined but not in the return object), add it to the return object.

- [ ] **Step 2: Wire the unselect behavior into POSCatalog's onImport**

In `POSCatalog.tsx`, the current prop `onImport` is bound to `importAppointment`. The toggle behavior belongs at the POS module level, not inside the card. Update `POSModule.tsx`:

Old:
```tsx
onImportAppointment={importAppointment}
```

New: write an inline handler that toggles:

```tsx
onImportAppointment={(appt) => {
  if (linkedAppointmentId === appt.id ||
      (appt.groupId && allAppointments.some((a) =>
        a.id === linkedAppointmentId && a.groupId === appt.groupId))) {
    clearCart();
  } else {
    importAppointment(appt);
  }
}}
```

Use whichever sibling-check variant matches the data available at this layer. Simpler alternative if `clearCart` isn't easily available: pass a new `onUnlinkAppointment` prop that the POS module wires to `clearCart`.

- [ ] **Step 3: Update PendingAppointments button**

Open `modules/pos/components/PendingAppointments.tsx`. Change line 53 from:
```tsx
disabled={isLinked}
```
to just remove the `disabled` attribute entirely.

Change the "Dans le panier" badge text (line 72) to "Cliquer pour retirer".

Adjust the hover styles conditionally — when `isLinked`, still show hover feedback since the card is now clickable.

Remove the `cursor-not-allowed` class from the `isLinked` branch of className (line 56).

---

### Task B.3: Fix #3 — receipt print AbortError

**Files:** Modify `modules/pos/ReceiptPrintPage.tsx`

- [ ] **Step 1: Skip AbortError in the catch**

At [ReceiptPrintPage.tsx:47-49](modules/pos/ReceiptPrintPage.tsx#L47-L49):

Old:
```tsx
} catch (e) {
  setError(e instanceof Error ? e.message : 'Erreur inconnue.');
}
```

New:
```tsx
} catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError') return;
  setError(e instanceof Error ? e.message : 'Erreur inconnue.');
}
```

---

### Task B.4: Fix #4 — filter UI matching Services tab

**Files:** Modify `modules/pos/components/AppointmentFilters.tsx`

- [ ] **Step 1: Replace the component with a single chip row matching Services style**

```tsx
import type React from 'react';
import { AppointmentStatus, type ServiceCategory, type StaffMember } from '../../../types';

type StatusFilter = 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS;

interface AppointmentFiltersProps {
  staff: StaffMember[];
  categories: ServiceCategory[];
  staffValue: string;
  categoryValue: string;
  statusValue: StatusFilter;
  onStaffChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  onReset: () => void;
}

const CHIP_BASE =
  'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0';
const CHIP_ACTIVE = 'bg-slate-900 text-white border border-slate-900';
const CHIP_IDLE = 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
    style={{ scrollSnapAlign: 'start' }}
  >
    {children}
  </button>
);

const Divider: React.FC = () => (
  <span className="shrink-0 self-stretch w-px bg-slate-200 mx-1" />
);

export const AppointmentFilters: React.FC<AppointmentFiltersProps> = ({
  staff,
  categories,
  staffValue,
  categoryValue,
  statusValue,
  onStaffChange,
  onCategoryChange,
  onStatusChange,
  onReset,
}) => {
  const anyActive = staffValue !== 'ALL' || categoryValue !== 'ALL' || statusValue !== 'ALL';
  const hasStaffOptions = staff.length > 0;
  const hasCategoryOptions = categories.length > 0;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {/* Staff group */}
      {hasStaffOptions && (
        <>
          <Chip active={staffValue === 'ALL'} onClick={() => onStaffChange('ALL')}>
            Tous
          </Chip>
          {staff.map((s) => (
            <Chip
              key={s.id}
              active={staffValue === s.id}
              onClick={() => onStaffChange(s.id)}
            >
              {s.photoUrl ? (
                <img src={s.photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : null}
              <span>{s.firstName}</span>
            </Chip>
          ))}
          {(hasCategoryOptions || true) && <Divider />}
        </>
      )}

      {/* Category group */}
      {hasCategoryOptions && (
        <>
          <Chip active={categoryValue === 'ALL'} onClick={() => onCategoryChange('ALL')}>
            Toutes
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={categoryValue === c.id}
              onClick={() => onCategoryChange(c.id)}
            >
              {c.name}
            </Chip>
          ))}
          <Divider />
        </>
      )}

      {/* Status group */}
      <Chip active={statusValue === 'ALL'} onClick={() => onStatusChange('ALL')}>
        Tous statuts
      </Chip>
      <Chip
        active={statusValue === AppointmentStatus.SCHEDULED}
        onClick={() => onStatusChange(AppointmentStatus.SCHEDULED)}
      >
        Planifié
      </Chip>
      <Chip
        active={statusValue === AppointmentStatus.IN_PROGRESS}
        onClick={() => onStatusChange(AppointmentStatus.IN_PROGRESS)}
      >
        En cours
      </Chip>

      {anyActive && (
        <>
          <Divider />
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2.5 text-xs text-blue-600 hover:text-blue-700 font-semibold shrink-0 whitespace-nowrap"
          >
            Réinitialiser
          </button>
        </>
      )}
    </div>
  );
};
```

Key changes from the current version:
- No more stacked rows or dimension labels
- One horizontal scroll-snap row
- Chip style matches Services tab chips exactly (`px-4 py-2.5 rounded-lg`, white/slate-900 colors, `scrollbar-hide`)
- Small vertical dividers between dimension groups
- Status group shows all three chips (always — it's cheap)
- Reset link at the end when active

- [ ] **Step 2: Update `POSCatalog.tsx` to render it in the Services-chip slot**

In the current branch's `POSCatalog.tsx`, the new filter component is rendered above the `PendingAppointments` grid. Move it up into the same slot as the Services category chips ([POSCatalog.tsx:169-173](modules/pos/components/POSCatalog.tsx#L169-L173)) so it occupies the exact same screen position.

Wrap the existing category chip row with a condition: show Services/Products chips when viewMode !== APPOINTMENTS (current behavior), OR show AppointmentFilters when viewMode === APPOINTMENTS.

Old structure:
```tsx
{viewMode !== 'APPOINTMENTS' && !(isMobile && searchTerm.length > 0) && (
  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" ...>
    {/* Services / Products category chips */}
  </div>
)}
```

New structure:
```tsx
{viewMode !== 'APPOINTMENTS' && !(isMobile && searchTerm.length > 0) && (
  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" ...>
    {/* Services / Products category chips — unchanged */}
  </div>
)}
{viewMode === 'APPOINTMENTS' && (
  <AppointmentFilters
    staff={availableAppointmentStaff}
    categories={availableAppointmentCategories}
    staffValue={appointmentStaffFilter}
    categoryValue={appointmentCategoryFilter}
    statusValue={appointmentStatusFilter}
    onStaffChange={onAppointmentStaffFilterChange}
    onCategoryChange={onAppointmentCategoryFilterChange}
    onStatusChange={onAppointmentStatusFilterChange}
    onReset={onResetAppointmentFilters}
  />
)}
```

Then below, inside the main content area, remove the old `<AppointmentFilters ... />` that was rendered above the grid. Keep `<PendingAppointments ... />`.

---

### Task B.5: Fix #5 — default to Favoris every time SERVICES is entered

**Files:** Modify `modules/pos/hooks/usePOS.ts`

- [ ] **Step 1: Remove the one-shot ref guard**

At [usePOS.ts:64-71](modules/pos/hooks/usePOS.ts#L64-L71):

Old:
```ts
const hasDefaultedToFavorites = useRef(false);
useEffect(() => {
  if (!hasDefaultedToFavorites.current && favorites.length > 0 && viewMode === 'SERVICES') {
    setSelectedCategory('FAVORITES');
    hasDefaultedToFavorites.current = true;
  }
}, [favorites, viewMode]);
```

New: wrap `setViewMode` so that whenever SERVICES is entered and favorites exist, the category resets to FAVORITES in the same tick. Remove the useEffect entirely.

```ts
const setViewMode = (mode: POSViewMode) => {
  setViewModeRaw(mode);
  if (mode === 'SERVICES' && favorites.length > 0) {
    setSelectedCategory('FAVORITES');
  }
};
```

To accommodate this, rename the `useState`-derived setter at line 40 from `setViewMode` to `setViewModeRaw`:

```ts
const [viewMode, setViewModeRaw] = useState<POSViewMode>('SERVICES');
```

Export the wrapped `setViewMode` (the same name consumers already use).

---

### Task B.6: Typecheck, test, commit, manual verification

- [ ] **Step 1: Typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 2: Run dev server and verify four fixes**

```bash
npm run dev
```

Then open `http://localhost:3000/pos` and verify:
- Click an appointment card → it imports. Click the same card again → cart clears.
- Complete a transaction → click the "Imprimer" button on the success modal → new tab opens; no red error.
- Filter UI is a single horizontal chip row in the same visual slot as Services chips. Chips styled like Services chips.
- Switch to Produits, then back to Services → lands on Favoris automatically.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/
git commit -m "fix(pos): four Rendez-vous/POS polish fixes

- Unselect imported appointment by clicking its card again (clears cart)
- Skip AbortError in receipt print page catch (React Strict Mode effect
  cleanup aborted in-flight fetch; now distinguished from real failures)
- Filter UI rewritten as a single horizontal chip row in the category-chip
  slot, matching the Services tab chip style exactly
- Services tab defaults to Favoris on every entry, not once per session"
```

- [ ] **Step 4: Force-push the rebased branch**

```bash
git push --force-with-lease origin feat/pos-appointments-filters
```

Open PR against main.

---

## Phase C — POS deletion pipeline

**Branch:** `feat/pos-deletion-pipeline` off `feat/rename-to-deletion-reason` (or off main once Phase A is merged).
**Goal:** When cashier deletes a service that came from an appointment, prompt for a reason via the unified `DeleteAppointmentModal`. Record the reason on the appointment row. Also apply staff/price modifications from cart items back to their source appointments. Stop falsely marking dropped services as COMPLETED.

### File Plan (Phase C)

**Create:**
- `supabase/migrations/20260424190000_create_transaction_deletions_and_modifications.sql`
- `modules/pos/utils/diffAppointmentsFromCart.ts`

**Modify:**
- `types.ts` — add `appointmentId?: string` to `CartItem`
- `modules/pos/hooks/usePOS.ts` — populate `appointmentId` on import; track `pendingDeletions`; expose new `requestDeleteCartItem` handler
- `modules/pos/POSModule.tsx` — wire the `DeleteAppointmentModal` into the cart deletion flow
- `modules/pos/components/POSCart.tsx` (and `CartBottomSheet.tsx` for mobile) — call `requestDeleteCartItem` instead of direct `removeFromCart` for items with `appointmentId`
- `modules/pos/mappers.ts` — `toTransactionRpcPayload` accepts and forwards deleted/modified arrays
- `hooks/useTransactions.ts` — signature extension
- `lib/database.types.ts` — regenerated

---

### Task C.1: Branch setup

- [ ] **Step 1: Create branch off Phase A**

```bash
git checkout feat/rename-to-deletion-reason
git checkout -b feat/pos-deletion-pipeline
```

If Phase A has merged to main by then, branch off main instead.

---

### Task C.2: Extend `CartItem` with appointment linkage

**Files:** Modify `types.ts`

- [ ] **Step 1: Add the field**

Locate the `CartItem` interface (~line 415-431). Add:

```ts
  appointmentId?: string; // populated when this cart item originated from a pending appointment
```

---

### Task C.3: Write the RPC migration

**Files:** Create `supabase/migrations/20260424190000_create_transaction_deletions_and_modifications.sql`

- [ ] **Step 1: Author the migration**

```sql
-- POS deletion pipeline: create_transaction now records per-appointment
-- deletion reasons and applies staff/price modifications atomically with the
-- transaction insert.
--
-- Problems this solves:
--   1. Previous behavior marked ALL group siblings COMPLETED when a transaction
--      linked to any member, regardless of whether the cashier had removed
--      some services from the cart before ringing up. Dropped services showed
--      up as done in the Agenda.
--   2. When the cashier changed staff or price on a cart line from an
--      appointment, the appointment row kept the original booking values.
--      The booking record diverged from what actually happened.
--
-- New parameters:
--   p_deleted_appointments   jsonb  - [{id, reason, note}] — siblings to mark
--                                     CANCELLED with deletion_reason
--   p_modified_appointments  jsonb  - [{id, staff_id, price}] — appointments
--                                     whose kept cart line has different
--                                     staff or price than the booking
--
-- Semantics:
--   - "Honoured" appointments (in cart, in same group as p_appointment_id,
--     not in p_deleted_appointments) → COMPLETED as before
--   - "Deleted" appointments → status='CANCELLED', deletion_reason set,
--     deletion_note trimmed, cancelled_at=now()
--   - "Modified" appointments → UPDATE staff_id and/or price per payload
--   - Reasons validated against the 5-value DeletionReason set

CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_deleted_appointments JSONB DEFAULT '[]'::jsonb,
  p_modified_appointments JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_deletion JSONB;
  v_modification JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_staff_id UUID;
  v_group_id UUID;
  v_ticket_number BIGINT;
  v_deleted_ids UUID[] := ARRAY[]::UUID[];
  v_reason TEXT;
  v_note TEXT;
BEGIN
  -- Permission
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  -- Anchor billable?
  IF p_appointment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE id = p_appointment_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS')
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Appointment not found or not in a billable status';
    END IF;
  END IF;

  -- Validate each deletion payload up front (so we raise before any writes)
  FOR v_deletion IN SELECT * FROM jsonb_array_elements(p_deleted_appointments)
  LOOP
    v_reason := v_deletion->>'reason';
    IF v_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR') THEN
      RAISE EXCEPTION 'Invalid deletion reason: %', v_reason
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Totals
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total < v_total THEN
    RAISE EXCEPTION 'Payment total (%) is less than transaction total (%)', v_payment_total, v_total;
  END IF;

  -- Ticket number
  INSERT INTO salon_ticket_counters (salon_id) VALUES (p_salon_id)
  ON CONFLICT (salon_id) DO NOTHING;
  UPDATE salon_ticket_counters
     SET next_ticket_number = next_ticket_number + 1, updated_at = now()
   WHERE salon_id = p_salon_id
  RETURNING next_ticket_number - 1 INTO v_ticket_number;

  -- Insert transaction
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id, ticket_number)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id, v_ticket_number)
  RETURNING id INTO v_transaction_id;

  -- Items + stock decrement (unchanged)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_staff_id := (v_item->>'staff_id')::uuid;
    IF v_staff_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM staff_members
        WHERE id = v_staff_id AND salon_id = p_salon_id AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Invalid staff_id for this salon: %', v_staff_id;
      END IF;
    END IF;

    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note, staff_id, staff_name
    ) VALUES (
      v_transaction_id, p_salon_id,
      (v_item->>'reference_id')::uuid, v_item->>'type', v_item->>'name', v_item->>'variant_name',
      (v_item->>'price')::numeric, (v_item->>'original_price')::numeric,
      (v_item->>'quantity')::integer, (v_item->>'cost')::numeric, v_item->>'note',
      v_staff_id, v_item->>'staff_name'
    );

    IF v_item->>'type' = 'PRODUCT' AND (v_item->>'reference_id') IS NOT NULL THEN
      UPDATE products SET stock = GREATEST(0, stock - (v_item->>'quantity')::integer), updated_at = now()
      WHERE id = (v_item->>'reference_id')::uuid AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  -- Payments (unchanged)
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- Apply deletions
  FOR v_deletion IN SELECT * FROM jsonb_array_elements(p_deleted_appointments)
  LOOP
    v_note := NULLIF(TRIM(v_deletion->>'note'), '');
    UPDATE appointments
    SET status          = 'CANCELLED',
        deletion_reason = v_deletion->>'reason',
        deletion_note   = v_note,
        cancelled_at    = now(),
        updated_at      = now()
    WHERE id = (v_deletion->>'id')::uuid
      AND salon_id = p_salon_id
      AND status IN ('SCHEDULED', 'IN_PROGRESS')
      AND deleted_at IS NULL;
    v_deleted_ids := array_append(v_deleted_ids, (v_deletion->>'id')::uuid);
  END LOOP;

  -- Apply modifications
  FOR v_modification IN SELECT * FROM jsonb_array_elements(p_modified_appointments)
  LOOP
    UPDATE appointments
    SET staff_id   = COALESCE((v_modification->>'staff_id')::uuid, staff_id),
        price      = COALESCE((v_modification->>'price')::numeric, price),
        updated_at = now()
    WHERE id = (v_modification->>'id')::uuid
      AND salon_id = p_salon_id
      AND status IN ('SCHEDULED', 'IN_PROGRESS')
      AND deleted_at IS NULL;
  END LOOP;

  -- Mark remaining honoured appointments COMPLETED
  IF p_appointment_id IS NOT NULL THEN
    SELECT group_id INTO v_group_id FROM appointments WHERE id = p_appointment_id;

    IF v_group_id IS NOT NULL THEN
      UPDATE appointments
      SET status = 'COMPLETED', updated_at = now()
      WHERE group_id = v_group_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS')
        AND deleted_at IS NULL
        AND id <> ALL(v_deleted_ids);

      -- Group status stays aligned with sibling state: set to COMPLETED only
      -- when no sibling remains un-terminal.
      IF NOT EXISTS (
        SELECT 1 FROM appointments
         WHERE group_id = v_group_id
           AND status IN ('SCHEDULED', 'IN_PROGRESS')
           AND deleted_at IS NULL
      ) THEN
        UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
        WHERE id = v_group_id;
      END IF;
    ELSE
      UPDATE appointments
      SET status = 'COMPLETED', updated_at = now()
      WHERE id = p_appointment_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS');
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault;
```

- [ ] **Step 2: Apply and regenerate types**

```bash
npx supabase db push --project-ref izsycdmrwscdnxebptsx --password "$SUPABASE_DB_PASSWORD"
npm run db:types
```

---

### Task C.4: Populate `appointmentId` on import

**Files:** Modify `modules/pos/hooks/usePOS.ts`

- [ ] **Step 1: Update `importAppointment` to tag each cart item with its source appointment ID**

Locate the `importAppointment` function (around lines 181-209 on current main). Change the mapped cart items:

Old:
```ts
const cartItems: CartItem[] = groupAppointments.map((appt) => ({
  id: crypto.randomUUID(),
  referenceId: appt.variantId || appt.serviceId,
  type: 'SERVICE' as const,
  name: appt.serviceName,
  variantName: appt.variantName || undefined,
  price: appt.price,
  originalPrice: appt.price,
  quantity: 1,
  staffId: appt.staffId || undefined,
  staffName: appt.staffName || undefined,
}));
```

New:
```ts
const cartItems: CartItem[] = groupAppointments.map((appt) => ({
  id: crypto.randomUUID(),
  referenceId: appt.variantId || appt.serviceId,
  type: 'SERVICE' as const,
  name: appt.serviceName,
  variantName: appt.variantName || undefined,
  price: appt.price,
  originalPrice: appt.price,
  quantity: 1,
  staffId: appt.staffId || undefined,
  staffName: appt.staffName || undefined,
  appointmentId: appt.id,
}));
```

- [ ] **Step 2: Also expand the filter in importAppointment to include IN_PROGRESS siblings**

The current code filters siblings by `a.status === 'SCHEDULED'` which is stale after commit 9262e4e. Update to include IN_PROGRESS:

```ts
const groupAppointments = appointment.groupId
  ? allAppointments.filter(
      (a) =>
        a.groupId === appointment.groupId &&
        (a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS'),
    )
  : [appointment];
```

---

### Task C.5: Track pending deletions in the hook

**Files:** Modify `modules/pos/hooks/usePOS.ts`

- [ ] **Step 1: Add state for pending deletion map**

```ts
import type { DeletionReason } from '../../../types';

interface PendingDeletion {
  reason: DeletionReason;
  note: string;
}

const [pendingDeletions, setPendingDeletions] = useState<Map<string, PendingDeletion>>(
  new Map(),
);
```

Where `map key = appointmentId`.

- [ ] **Step 2: Expose `requestDeleteCartItem` for items with `appointmentId`**

Add a handler that opens the DeleteAppointmentModal upstream; on confirmation it records the reason and then calls `removeFromCart`. Since modal state lives in `POSModule`, the hook just exposes a "record then remove" helper:

```ts
const recordAppointmentDeletion = (appointmentId: string, reason: DeletionReason, note: string) => {
  setPendingDeletions((prev) => new Map(prev).set(appointmentId, { reason, note }));
};
```

Also reset `pendingDeletions` to empty in `clearCart`.

Also reset when a new appointment is imported (overrides any prior deletion tracking from the previous visit).

- [ ] **Step 3: Expose in the return object**

Add `pendingDeletions` and `recordAppointmentDeletion` to the returned hook values.

---

### Task C.6: Write the diff utility

**Files:** Create `modules/pos/utils/diffAppointmentsFromCart.ts`

- [ ] **Step 1: Utility body**

```ts
import type { Appointment, CartItem } from '../../../types';

export interface AppointmentModification {
  id: string;
  staff_id?: string | null;
  price?: number;
}

/**
 * Compare cart items that originated from appointments against their source
 * appointment rows. Returns an array of modification payloads for the RPC —
 * one per appointment whose current cart-item representation differs on
 * staffId or price.
 */
export const diffAppointmentsFromCart = (
  cart: CartItem[],
  sourceAppointments: Appointment[],
): AppointmentModification[] => {
  const byId = new Map(sourceAppointments.map((a) => [a.id, a]));
  const modifications: AppointmentModification[] = [];

  for (const item of cart) {
    if (!item.appointmentId) continue;
    const source = byId.get(item.appointmentId);
    if (!source) continue;

    const staffDiff = (item.staffId ?? null) !== (source.staffId ?? null);
    const priceDiff = item.price !== source.price;

    if (staffDiff || priceDiff) {
      modifications.push({
        id: source.id,
        ...(staffDiff && { staff_id: item.staffId ?? null }),
        ...(priceDiff && { price: item.price }),
      });
    }
  }

  return modifications;
};
```

- [ ] **Step 2: Unit tests**

Create `modules/pos/utils/diffAppointmentsFromCart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Appointment, CartItem } from '../../../types';
import { AppointmentStatus } from '../../../types';
import { diffAppointmentsFromCart } from './diffAppointmentsFromCart';

const mkAppt = (o: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  clientId: 'c1',
  clientName: '',
  serviceId: 'sv1',
  serviceName: '',
  date: '',
  durationMinutes: 60,
  staffId: 'st1',
  staffName: 'Anna',
  status: AppointmentStatus.SCHEDULED,
  variantId: 'v1',
  variantName: '',
  price: 100,
  groupId: null,
  ...o,
});

const mkItem = (o: Partial<CartItem> = {}): CartItem => ({
  id: 'ci1',
  referenceId: 'v1',
  type: 'SERVICE',
  name: 'Cut',
  price: 100,
  originalPrice: 100,
  quantity: 1,
  ...o,
});

describe('diffAppointmentsFromCart', () => {
  it('returns empty when no cart items have appointmentId', () => {
    expect(diffAppointmentsFromCart([mkItem()], [mkAppt()])).toEqual([]);
  });

  it('detects staff change', () => {
    const appt = mkAppt({ staffId: 'st1' });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st2' });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([
      { id: 'a1', staff_id: 'st2' },
    ]);
  });

  it('detects price change', () => {
    const appt = mkAppt({ price: 100 });
    const item = mkItem({ appointmentId: 'a1', price: 80 });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([
      { id: 'a1', price: 80 },
    ]);
  });

  it('detects both changes together', () => {
    const appt = mkAppt({ staffId: 'st1', price: 100 });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st2', price: 80 });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([
      { id: 'a1', staff_id: 'st2', price: 80 },
    ]);
  });

  it('skips cart items whose source appointment is missing', () => {
    const item = mkItem({ appointmentId: 'ghost' });
    expect(diffAppointmentsFromCart([item], [])).toEqual([]);
  });

  it('returns empty when staff and price match', () => {
    const appt = mkAppt({ staffId: 'st1', price: 100 });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st1', price: 100 });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run modules/pos/utils/diffAppointmentsFromCart.test.ts
```

Expected: all six tests pass.

---

### Task C.7: Update `toTransactionRpcPayload` and `useTransactions`

**Files:** Modify `modules/pos/mappers.ts`, `hooks/useTransactions.ts`

- [ ] **Step 1: Extend `toTransactionRpcPayload` signature**

Current signature (at [mappers.ts:111-157](modules/pos/mappers.ts)):

```ts
export const toTransactionRpcPayload = (
  items: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string,
  appointmentId: string | undefined,
) => { ... };
```

New signature:

```ts
export const toTransactionRpcPayload = (
  items: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string,
  appointmentId: string | undefined,
  deletedAppointments: Array<{ id: string; reason: string; note?: string }> = [],
  modifiedAppointments: Array<{ id: string; staff_id?: string | null; price?: number }> = [],
) => { ... };
```

The returned payload gets two new keys:
```ts
p_deleted_appointments: deletedAppointments,
p_modified_appointments: modifiedAppointments,
```

- [ ] **Step 2: Update `useTransactions.addTransaction`**

The mutation's `mutationFn` (at [useTransactions.ts:49-141](hooks/useTransactions.ts#L49-L141)) currently takes `{items, payments, clientId, appointmentId}`. Extend:

```ts
async (
  {
    items,
    payments,
    clientId,
    appointmentId,
    deletedAppointments = [],
    modifiedAppointments = [],
  }: {
    items: CartItem[];
    payments: PaymentEntry[];
    clientId?: string;
    appointmentId?: string;
    deletedAppointments?: Array<{ id: string; reason: string; note?: string }>;
    modifiedAppointments?: Array<{ id: string; staff_id?: string | null; price?: number }>;
  },
  signal: AbortSignal,
) => {
  const payload = toTransactionRpcPayload(
    items, payments, clientId, salonId, appointmentId,
    deletedAppointments, modifiedAppointments,
  );
  // ... rest unchanged
}
```

Update the exported wrapper `addTransaction` to accept and forward the two new optional arrays.

---

### Task C.8: Wire the deletion modal into POSModule

**Files:** Modify `modules/pos/POSModule.tsx`, `modules/pos/components/POSCart.tsx`, `modules/pos/components/CartBottomSheet.tsx`

- [ ] **Step 1: State for the deletion modal**

In `POSModule.tsx` add:

```tsx
const [deletionTarget, setDeletionTarget] = useState<{
  appointmentId: string;
  cartItemId: string;
  serviceName: string;
} | null>(null);
```

- [ ] **Step 2: Handler factory for cart delete**

```tsx
const handleRequestDeleteCartItem = (item: CartItem) => {
  if (item.appointmentId) {
    setDeletionTarget({
      appointmentId: item.appointmentId,
      cartItemId: item.id,
      serviceName: item.name,
    });
  } else {
    removeFromCart(item.id);
  }
};

const handleConfirmDeletion = (reason: DeletionReason, note: string) => {
  if (!deletionTarget) return;
  recordAppointmentDeletion(deletionTarget.appointmentId, reason, note);
  removeFromCart(deletionTarget.cartItemId);
  setDeletionTarget(null);
};
```

- [ ] **Step 3: Thread `handleRequestDeleteCartItem` into POSCart and CartBottomSheet**

Replace any direct `onRemove={removeFromCart}` call with `onRemove={handleRequestDeleteCartItem}` where appropriate. Because `removeFromCart` currently takes `(id: string)` and the new handler needs the full `CartItem`, either:
- pass the item to the handler: `onRemove={(id) => handleRequestDeleteCartItem(cart.find(c => c.id === id)!)}`, or
- update `POSCart` / `CartBottomSheet` to call `onRemove(item)` instead of `onRemove(item.id)`.

Pick the cleaner option — passing the full item is more informative. Update the `POSCart` / `CartBottomSheet` props accordingly.

- [ ] **Step 4: Render the modal**

Below existing modals in POSModule JSX:

```tsx
<DeleteAppointmentModal
  isOpen={deletionTarget !== null}
  onClose={() => setDeletionTarget(null)}
  scope="single"
  subjectLabel={deletionTarget?.serviceName}
  onConfirm={handleConfirmDeletion}
/>
```

---

### Task C.9: Hook processTransaction to send deletions + modifications

**Files:** Modify `modules/pos/hooks/usePOS.ts`

- [ ] **Step 1: Update `processTransaction`**

Current body (at [usePOS.ts:122-132](modules/pos/hooks/usePOS.ts#L122-L132)) passes `(cart, payments, clientId, appointmentId)`. Expand to compute modifications and pass deletions + modifications through:

```ts
import { diffAppointmentsFromCart } from '../utils/diffAppointmentsFromCart';

const processTransaction = async (payments: PaymentEntry[]): Promise<Transaction> => {
  const deletedAppointments = Array.from(pendingDeletions.entries()).map(
    ([id, { reason, note }]) => ({ id, reason, note }),
  );

  const modifiedAppointments = diffAppointmentsFromCart(
    cartRef.current,
    allAppointments,
  );

  const tx = await addTransaction(
    cartRef.current,
    payments,
    selectedClientRef.current?.id,
    linkedAppointmentIdRef.current ?? undefined,
    deletedAppointments,
    modifiedAppointments,
  );
  clearCart();
  return tx;
};
```

(The hook must destructure `addTransaction` from `useTransactions()` with the extended signature introduced in Task C.7.)

---

### Task C.10: Typecheck, tests, commit

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Full test suite**

```bash
npm test
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add \
  supabase/migrations/20260424190000_create_transaction_deletions_and_modifications.sql \
  lib/database.types.ts \
  types.ts \
  modules/pos/utils/diffAppointmentsFromCart.ts \
  modules/pos/utils/diffAppointmentsFromCart.test.ts \
  modules/pos/mappers.ts \
  modules/pos/hooks/usePOS.ts \
  modules/pos/POSModule.tsx \
  modules/pos/components/POSCart.tsx \
  modules/pos/components/CartBottomSheet.tsx \
  hooks/useTransactions.ts
git commit -m "feat(pos): deletion pipeline with reasons and modification propagation

Resolves two issues with POS-to-appointment synchronization:

1. Dropped services were marked COMPLETED. Deleting a service from the
   POS cart now opens DeleteAppointmentModal; on confirm, the cart item
   is removed and a {reason, note} pair is recorded against the source
   appointment. On transaction commit, create_transaction sets
   status='CANCELLED' with deletion_reason on each dropped appointment,
   leaving the charged siblings to complete as before.

2. Staff/price changes on cart lines that came from appointments now
   propagate back to the appointment row atomically with the transaction.

Changes:
- CartItem gains appointmentId (populated on importAppointment)
- diffAppointmentsFromCart utility detects modifications
- create_transaction RPC takes p_deleted_appointments and
  p_modified_appointments JSONB arrays
- Group status only flips to COMPLETED when no sibling remains
  un-terminal"
```

---

### Task C.11: Manual verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Scenario — dropped service keeps reason**

Create a 2-service appointment (Cut + Color) for today. Import into POS. Remove the Color line from the cart — DeleteAppointmentModal opens. Pick "Offert", add a note, confirm. Ring up the transaction. Navigate to Agenda:
- Cut appointment shows COMPLETED (green)
- Color appointment shows CANCELLED + "Offert" (sky badge)
- Note visible in detail view

- [ ] **Step 3: Scenario — staff change**

Import a single-service appointment. Change the staff on the cart line to a different person. Ring up. Agenda:
- Appointment's staff reflects the new person, not the booking

- [ ] **Step 4: Scenario — price change**

Import an appointment. Change the price on the cart line. Ring up. Agenda:
- Appointment's price reflects the new value

- [ ] **Step 5: Scenario — combined**

Import 2-service group, remove one (reason Replaced), change staff on the kept one, ring up. Agenda:
- Removed service = CANCELLED + Remplacé
- Kept service = COMPLETED with new staff

- [ ] **Step 6: Scenario — product-only transaction**

Ring up a walk-in product sale (no appointment linked). Confirm no DeletionReason modal appears, transaction proceeds normally.

---

## Self-Review Checklist (planner-side)

- **Spec coverage:** each spec requirement (unify vocabulary, fix 4 POS bugs, deletion pipeline, modification propagation) maps to a task in A / B / C. ✓
- **No placeholders:** every step shows actual SQL/TSX/TS code or an exact command. ✓
- **Dependency ordering:** Phase C branches from Phase A, not main, so DeletionReason is available. Phase B is independent and branches from main. ✓
- **Migration safety:** Phase A migrates `OTHER` → `CANCELLED` before the CHECK swap, so no constraint violation mid-flight. Phase C uses default-empty `jsonb` array params so calling the new RPC with old client code (which doesn't send the new fields) still works — forward compatibility preserved for the brief moment between RPC deploy and client deploy. ✓
- **Atomicity:** Phase A's rename happens in one commit; Phase B's four fixes in one commit; Phase C's backend + frontend changes in one commit with DB migration applied separately (user runs `supabase db push` in Task C.3 Step 2). ✓
- **Test coverage:** Phase A has manual verification. Phase B has manual + typecheck + existing tests. Phase C adds 6 unit tests for the diff utility and a 5-scenario manual checklist. ✓
- **Rollback path:** each migration is additive or renaming — can be reverted with a reverse migration if necessary. Old RPC name is dropped in Phase A's migration, so rollback requires recreating it. Note this. ✓

---

## Out of scope

- `deletion_source` column (derive from transaction link if needed later)
- Automatic reason badges in Agenda (StatusBadge already handles it from Phase A)
- Split of Phase C into smaller PRs (deletion vs modification) — kept as one because they share the RPC signature change
- Group-level deletion modal (when user deletes all cart items from a group at once — current design prompts per item; can batch later)
- Notifying clients when their appointment was COMPLAINED/ERROR/OFFERED — out of scope
