# POS Transaction Success Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a minimalist post-sale confirmation modal (`[ Imprimer ]` + `[ Nouvelle vente ]`) after a successful transaction, with sequential per-salon ticket numbers and a real print-to-new-tab flow.

**Architecture:** Three coupled pieces. (1) `transactions.ticket_number BIGINT NOT NULL` populated by a new `salon_ticket_counters` counter table assigned atomically inside `create_transaction`. (2) A compact `TransactionSuccessModal` rendered from `POSModule` on successful `processTransaction`, reading a fully hydrated `Transaction` returned by the create mutation (POST RPC → `rawSelect` with joins). (3) `/pos/historique/:id/print` route rendering a shared `ReceiptBody` (extracted from `POSModals.tsx`) with auto-`window.print()` on mount. The same print route powers `Imprimer` in the success modal, in `ReceiptModal`, and in `TransactionHistoryPage`.

**Tech Stack:** React 19 + TypeScript, TanStack Query 5, Tailwind CSS 4, React Router DOM 7, Vitest, Supabase (PostgreSQL 15 with pgcrypto). Existing patterns: `lib/supabaseRaw.rawSelect` / `rawRpc` to bypass SDK auth-lock wedge, `useMutationToast.toastOnError`, modal convention via `createPortal(document.body)` with `role="dialog"` + `aria-modal="true"`.

**Spec:** [docs/superpowers/specs/2026-04-23-pos-transaction-success-modal-design.md](../specs/2026-04-23-pos-transaction-success-modal-design.md) (v5).

**Branch:** `feat/pos-success-modal` (already created, spec already committed).

---

## File Structure Map

### New files (5)

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260423120000_add_ticket_number.sql` | Schema (`ticket_number` col + `salon_ticket_counters` table + unique index), backfill, updated `create_transaction` RPC assigning the next counter value atomically. |
| `lib/format.ts` (new export, same file) | `formatTicketNumber(n)` → `"n°000042"`. |
| `modules/pos/components/ReceiptBody.tsx` | Pure presentational component rendering the receipt body (salon header, date, ticket #, items, VAT section, totals, watermark). Consumed by both `ReceiptModal` and `ReceiptPrintPage`. |
| `modules/pos/ReceiptPrintPage.tsx` | Standalone print route page. Fetches the tx via `rawSelect` + `toTransaction`, renders `<ReceiptBody>` on a white page, calls `window.print()` in `useEffect`. No app chrome (rendered outside `Layout` in `App.tsx`). |
| `modules/pos/components/TransactionSuccessModal.tsx` | The minimalist post-sale modal. 2 buttons (Imprimer primary, Nouvelle vente ghost). Portaled, focus-trapped, `aria-live` headline. |

### Modified files (10)

| Path | Change |
|---|---|
| `types.ts` | `Transaction` gains `ticketNumber: number`. |
| `modules/pos/mappers.ts` | `toTransaction` reads `ticket_number`; `TransactionRow` typed with it. |
| `modules/pos/mappers.test.ts` | Add a case covering `ticketNumber` round-trip. |
| `modules/pos/constants.ts` | Export new `PAYMENT_METHOD_SHORT` constant. |
| `modules/pos/TransactionHistoryPage.tsx` | Remove local `PAYMENT_METHOD_SHORT` (import from constants); add `N°` column; row-action `Imprimer` navigates to print route instead of opening ReceiptModal. |
| `hooks/useTransactions.ts` | `addTransactionMutation` parses the RPC's returned UUID, calls `rawSelect` with joins, maps via `toTransaction`, resolves with the full `Transaction`. |
| `modules/pos/hooks/usePOS.ts` | `processTransaction()` returns the hydrated `Transaction`. |
| `modules/pos/POSModule.tsx` | Add `successTx` state; on success call `setSuccessTx(tx)`; render `<TransactionSuccessModal>`; gate PaymentModal reopen on `successTx === null`. |
| `modules/pos/components/POSModals.tsx` | `ReceiptModal` footer gains `Imprimer` (opens print route in new tab) alongside `Fermer`; body delegates to `<ReceiptBody>`; header renders `formatTicketNumber(tx.ticketNumber)`; prev/next controls hidden when opened tx not in `allTransactions`. `TransactionDetailModal` title adopts `formatTicketNumber`. |
| `App.tsx` | Register `/pos/historique/:id/print` route **outside** `AppContent` (no `Layout` wrapper), alongside the other chrome-less routes. |

---

## Pre-flight

- [ ] **Step 0.1: Confirm branch and starting point**

Run:
```bash
cd "/Users/sims/Casa de Chicas/Salon-Saas"
git status
git log --oneline -3
```

Expected: on `feat/pos-success-modal`, clean tree, top commit is `782ecf5 docs(pos): revise spec v5 — strict industry minimalism`.

---

## Phase 1 — Ticket number schema

### Task 1: Migration — schema + backfill + `create_transaction` RPC update

**Files:**
- Create: `supabase/migrations/20260423120000_add_ticket_number.sql`

- [ ] **Step 1.1: Create the migration file**

Full content (paste exactly):

```sql
-- Sequential per-salon ticket numbers for transactions.
-- Monotonically increasing per salon, never resets. Tax-friendly.
-- Assigned atomically inside create_transaction via a counter row lock.

-- 1. Schema: nullable column + counter table + partial unique index
ALTER TABLE transactions
  ADD COLUMN ticket_number BIGINT;

CREATE TABLE salon_ticket_counters (
  salon_id UUID PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
  next_ticket_number BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE salon_ticket_counters ENABLE ROW LEVEL SECURITY;
-- No client-side policies — only the SECURITY DEFINER RPC touches this table.

CREATE UNIQUE INDEX transactions_ticket_number_per_salon
  ON transactions (salon_id, ticket_number)
  WHERE ticket_number IS NOT NULL;

-- 2. Backfill existing rows deterministically by (created_at, id)
WITH ranked AS (
  SELECT id,
         salon_id,
         ROW_NUMBER() OVER (
           PARTITION BY salon_id ORDER BY created_at, id
         ) AS rn
  FROM transactions
)
UPDATE transactions t
   SET ticket_number = r.rn
  FROM ranked r
 WHERE t.id = r.id;

-- Seed each salon's counter with (max existing + 1); no rows in transactions → counter stays 1
INSERT INTO salon_ticket_counters (salon_id, next_ticket_number)
SELECT salon_id, COALESCE(MAX(ticket_number), 0) + 1
  FROM transactions
 GROUP BY salon_id
ON CONFLICT (salon_id) DO UPDATE
  SET next_ticket_number = EXCLUDED.next_ticket_number;

-- 3. Enforce NOT NULL now that every row has a value
ALTER TABLE transactions
  ALTER COLUMN ticket_number SET NOT NULL;

-- 4. Re-create create_transaction with ticket_number assignment.
-- Signature is unchanged (still RETURNS UUID); only the body changes.
CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_staff_id UUID;
  v_group_id UUID;
  v_ticket_number BIGINT;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  -- Validate appointment if provided
  IF p_appointment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE id = p_appointment_id AND salon_id = p_salon_id AND status = 'SCHEDULED'
    ) THEN
      RAISE EXCEPTION 'Appointment not found or not in SCHEDULED status';
    END IF;
  END IF;

  -- Totals
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total < v_total THEN
    RAISE EXCEPTION 'Payment total (%) is less than transaction total (%)', v_payment_total, v_total;
  END IF;

  -- Atomic per-salon ticket number assignment
  INSERT INTO salon_ticket_counters (salon_id)
  VALUES (p_salon_id)
  ON CONFLICT (salon_id) DO NOTHING;

  UPDATE salon_ticket_counters
     SET next_ticket_number = next_ticket_number + 1,
         updated_at = now()
   WHERE salon_id = p_salon_id
  RETURNING next_ticket_number - 1 INTO v_ticket_number;

  -- Insert transaction with assigned ticket_number
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id, ticket_number)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id, v_ticket_number)
  RETURNING id INTO v_transaction_id;

  -- Items
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

  -- Payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- Appointment completion (group-aware) — unchanged from prior version
  IF p_appointment_id IS NOT NULL THEN
    SELECT group_id INTO v_group_id FROM appointments WHERE id = p_appointment_id;

    IF v_group_id IS NOT NULL THEN
      UPDATE appointments SET status = 'COMPLETED', updated_at = now()
      WHERE group_id = v_group_id AND salon_id = p_salon_id
        AND status = 'SCHEDULED' AND deleted_at IS NULL;

      UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
      WHERE id = v_group_id;
    ELSE
      UPDATE appointments SET status = 'COMPLETED', updated_at = now()
      WHERE id = p_appointment_id AND salon_id = p_salon_id;
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault;
```

- [ ] **Step 1.2: Apply the migration to the linked remote DB**

Apply via CLI (user may be prompted for approval):

```bash
cd "/Users/sims/Casa de Chicas/Salon-Saas"
npx supabase db push --linked
```

Expected: the new migration file is applied; no errors. Verify in Supabase Studio that:
- `transactions.ticket_number` column exists and is NOT NULL
- `salon_ticket_counters` table exists
- Every existing `transactions` row has a non-null `ticket_number`
- `salon_ticket_counters` has one row per salon that has transactions

- [ ] **Step 1.3: Regenerate database types**

```bash
npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts
```

Expected: `lib/database.types.ts` updated to include `ticket_number` on `transactions` and the new `salon_ticket_counters` table.

- [ ] **Step 1.4: Sanity-check insert with a probe**

Via Supabase SQL editor (or `npx supabase db query --linked`):

```sql
SELECT id, ticket_number, created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 5;

SELECT * FROM salon_ticket_counters;
```

Expected: ticket_numbers are populated, monotonically increasing per salon by `created_at`. Counter table has `next_ticket_number = (max + 1)` per salon.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260423120000_add_ticket_number.sql lib/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): add per-salon sequential ticket_number to transactions

- New column transactions.ticket_number BIGINT NOT NULL
- New salon_ticket_counters table with atomic UPDATE ... RETURNING
- Backfill orders existing rows by (created_at, id) within each salon
- create_transaction RPC now assigns the next counter value inside
  its existing SECURITY DEFINER body; signature unchanged (RETURNS UUID)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Frontend type + mapper + formatter

### Task 2: Add `ticketNumber` to `Transaction` type

**Files:**
- Modify: `types.ts` (the `interface Transaction` block, around line 428)

- [ ] **Step 2.1: Edit `Transaction`**

Find:
```ts
export interface Transaction {
  id: string;
  date: string; // ISO String
  total: number;
```

Insert `ticketNumber: number;` right after `total`:

```ts
export interface Transaction {
  id: string;
  date: string; // ISO String
  total: number;
  ticketNumber: number;
  clientName?: string;
  ...
}
```

- [ ] **Step 2.2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: errors in `modules/pos/mappers.ts` (missing `ticketNumber`) and in any code that constructs a `Transaction` literal without it. Note the list — the next tasks address them.

- [ ] **Step 2.3: Commit**

```bash
git add types.ts
git commit -m "feat(types): add ticketNumber to Transaction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: Update `toTransaction` mapper

**Files:**
- Modify: `modules/pos/mappers.ts` (around line 50 for `TransactionRow`; `toTransaction` body)

- [ ] **Step 3.1: Add `ticket_number` to `TransactionRow`**

In `modules/pos/mappers.ts`, find the `TransactionRow` interface and add `ticket_number: number;` alongside the other core columns:

```ts
export interface TransactionRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  appointment_id: string | null;
  date: string;
  total: number;
  ticket_number: number;
  notes: string | null;
  // ...rest unchanged
```

- [ ] **Step 3.2: Read `ticket_number` inside `toTransaction`**

In the body of `toTransaction`, add `ticketNumber: row.ticket_number` to the returned `Transaction`. If the function builds an object literal, insert next to `total`:

```ts
return {
  id: row.id,
  date: row.date,
  total: Number(row.total),
  ticketNumber: row.ticket_number,
  // ...rest unchanged
};
```

- [ ] **Step 3.3: Verify typecheck is green**

```bash
npx tsc --noEmit
```

Expected: no errors from mappers.ts. Errors may remain in components that build `Transaction` inline (seed data, tests, etc.) — handle in the next step.

### Task 4: Extend mapper test

**Files:**
- Modify: `modules/pos/mappers.test.ts`

- [ ] **Step 4.1: Add a test case**

Append (or weave into the existing `toTransaction` describe block):

```ts
it('maps ticket_number to ticketNumber', () => {
  const row = buildTransactionRow({ ticket_number: 42 }); // existing helper, or inline object
  const tx = toTransaction(row);
  expect(tx.ticketNumber).toBe(42);
});
```

If `mappers.test.ts` does not have a helper, open the file and follow the existing pattern for building a `TransactionRow` — inline object with all required fields, substituting defaults for the ones not under test.

- [ ] **Step 4.2: Run the test**

```bash
npm run test -- modules/pos/mappers.test.ts
```

Expected: all tests pass, including the new one.

- [ ] **Step 4.3: Commit**

```bash
git add modules/pos/mappers.ts modules/pos/mappers.test.ts
git commit -m "feat(pos/mappers): map transactions.ticket_number to ticketNumber

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: Add `formatTicketNumber` helper

**Files:**
- Modify: `lib/format.ts`

- [ ] **Step 5.1: Write test (new file or add to existing)**

If `lib/format.test.ts` exists, append to it; otherwise create it:

```ts
import { describe, expect, it } from 'vitest';
import { formatTicketNumber } from './format';

describe('formatTicketNumber', () => {
  it('pads single-digit to 6 digits with n° prefix', () => {
    expect(formatTicketNumber(1)).toBe('n°000001');
  });
  it('pads multi-digit correctly', () => {
    expect(formatTicketNumber(42)).toBe('n°000042');
  });
  it('keeps numbers >6 digits unpadded', () => {
    expect(formatTicketNumber(1234567)).toBe('n°1234567');
  });
});
```

- [ ] **Step 5.2: Run — expect failure**

```bash
npm run test -- lib/format.test.ts
```

Expected: FAIL (function not exported).

- [ ] **Step 5.3: Implement**

Append to `lib/format.ts`:

```ts
export function formatTicketNumber(n: number): string {
  return `n°${n.toString().padStart(6, '0')}`;
}
```

- [ ] **Step 5.4: Run — expect pass**

```bash
npm run test -- lib/format.test.ts
```

Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat(format): add formatTicketNumber helper

Zero-pads to 6 digits with n° prefix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Hydrated create mutation

### Task 6: Rework `addTransactionMutation` to return hydrated `Transaction`

**Files:**
- Modify: `hooks/useTransactions.ts` (around line 49–126)

- [ ] **Step 6.1: Import dependencies**

At the top of `hooks/useTransactions.ts`, ensure these imports exist (add if missing):

```ts
import { rawSelect } from '@/lib/supabaseRaw';
import { toTransaction, type TransactionRow } from '@/modules/pos/mappers';
import type { Transaction } from '@/types';
```

(If some imports already exist, only add the missing ones.)

- [ ] **Step 6.2: Rewrite the create mutation**

Replace the `addTransactionMutation` block (current lines ~49–126) with:

```ts
  const addTransactionMutation = useMutation<
    Transaction,
    Error,
    {
      items: CartItem[];
      payments: PaymentEntry[];
      clientId?: string;
      appointmentId?: string;
    }
  >({
    mutationFn: withMutationTimeout(
      async ({ items, payments, clientId, appointmentId }, signal) => {
        const payload = toTransactionRpcPayload(items, payments, clientId, salonId, appointmentId);

        // Raw fetch — supabase.rpc() can hang indefinitely after background-tab
        // throttling when the SDK's auth lock wedges.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
        const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null;

        let accessToken: string | null = null;
        try {
          const raw = storageKey ? localStorage.getItem(storageKey) : null;
          if (raw) {
            const parsed = JSON.parse(raw) as { access_token?: string };
            accessToken = parsed.access_token ?? null;
          }
        } catch {
          // fall through
        }
        if (!accessToken) {
          throw new Error('Session introuvable, veuillez vous reconnecter.');
        }

        const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_transaction`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal,
        });

        if (!rpcResponse.ok) {
          let message = `HTTP ${rpcResponse.status}`;
          let code: string | undefined;
          try {
            const body = (await rpcResponse.json()) as { message?: string; code?: string };
            if (body.message) message = body.message;
            code = body.code;
          } catch {
            // keep HTTP status
          }
          const err = new Error(message) as Error & { code?: string; status?: number };
          if (code) err.code = code;
          err.status = rpcResponse.status;
          throw err;
        }

        // RPC returns a bare UUID string (PostgREST wraps scalar RPC return in JSON)
        const newId = (await rpcResponse.json()) as string;

        // Hydrate the full transaction for callers (success modal, etc.)
        const rows = await rawSelect<TransactionRow>(
          'transactions',
          `select=*,transaction_items(*),transaction_payments(*),clients(first_name,last_name),profiles(first_name,last_name)&id=eq.${newId}`,
          signal,
        );
        if (!rows[0]) {
          throw new Error('Transaction créée mais introuvable après hydratation.');
        }
        return toTransaction(rows[0]);
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['new_client_count', salonId] });
    },
    onError: toastOnError('Impossible de créer la transaction'),
  });
```

The key additions: explicit generic type parameters on `useMutation` (so callers see `Transaction`), parsing the RPC's JSON response into a UUID, and the hydration `rawSelect`.

- [ ] **Step 6.3: Ensure `addTransaction` is exposed with the new return type**

Find where the hook exposes `addTransaction` (likely `addTransaction: addTransactionMutation.mutateAsync`). Confirm no explicit return-type annotation is narrowing it to `void`. If there is one, remove it so TypeScript infers `Transaction`.

- [ ] **Step 6.4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `hooks/useTransactions.ts`. Errors may remain in `modules/pos/hooks/usePOS.ts` where the return value is currently discarded — addressed in the next task.

- [ ] **Step 6.5: Commit**

```bash
git add hooks/useTransactions.ts
git commit -m "feat(useTransactions): hydrate and return Transaction from create mutation

POST create_transaction returns a UUID; a follow-up rawSelect joins
client, profile, items, and payments so callers receive a fully mapped
Transaction (including ticketNumber).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: `processTransaction` returns the hydrated `Transaction`

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts` (around line 122–131)

- [ ] **Step 7.1: Capture and return the tx**

Replace the current `processTransaction`:

```ts
  const processTransaction = async (payments: PaymentEntry[]) => {
    await addTransaction(
      cartRef.current,
      payments,
      selectedClientRef.current?.id,
      linkedAppointmentIdRef.current ?? undefined,
    );
    clearCart();
  };
```

with:

```ts
  const processTransaction = async (payments: PaymentEntry[]): Promise<Transaction> => {
    const tx = await addTransaction(
      cartRef.current,
      payments,
      selectedClientRef.current?.id,
      linkedAppointmentIdRef.current ?? undefined,
    );
    clearCart();
    return tx;
  };
```

Ensure `Transaction` is imported at the top of the file:

```ts
import type { Transaction } from '@/types';
```

- [ ] **Step 7.2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `usePOS.ts`. POSModule will light up — handled in Task 14.

- [ ] **Step 7.3: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "feat(pos): processTransaction returns the hydrated Transaction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Shared constants

### Task 8: Lift `PAYMENT_METHOD_SHORT` to `modules/pos/constants.ts`

**Files:**
- Modify: `modules/pos/constants.ts`
- Modify: `modules/pos/TransactionHistoryPage.tsx` (remove local copy; import from constants)

- [ ] **Step 8.1: Add the export to constants.ts**

Append to `modules/pos/constants.ts`:

```ts
// Short labels for payment methods (used on dense surfaces where the full label
// would overflow). Full labels are authored by PaymentModal.
export const PAYMENT_METHOD_SHORT: Record<string, string> = {
  'Carte Bancaire': 'Carte',
  'Carte Cadeau': 'Cadeau',
  Virement: 'Virement',
};
```

- [ ] **Step 8.2: Remove the local copy in TransactionHistoryPage and import from constants**

Open `modules/pos/TransactionHistoryPage.tsx`. Remove the local declaration around line 254–258:

```ts
  const PAYMENT_METHOD_SHORT: Record<string, string> = {
    'Carte Bancaire': 'Carte',
    'Carte Cadeau': 'Cadeau',
    Virement: 'Virement',
  };
```

Add to the file's top imports:

```ts
import { PAYMENT_METHOD_SHORT } from './constants';
```

- [ ] **Step 8.3: Typecheck + test**

```bash
npx tsc --noEmit
npm run test
```

Expected: no new errors.

- [ ] **Step 8.4: Commit**

```bash
git add modules/pos/constants.ts modules/pos/TransactionHistoryPage.tsx
git commit -m "refactor(pos): lift PAYMENT_METHOD_SHORT to shared constants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — ReceiptBody extraction

### Task 9: Extract `ReceiptBody` from `POSModals.tsx`

**Files:**
- Create: `modules/pos/components/ReceiptBody.tsx`
- Modify: `modules/pos/components/POSModals.tsx` (ReceiptModal body delegates to the new component)

- [ ] **Step 9.1: Identify the body region of ReceiptModal**

Open `modules/pos/components/POSModals.tsx`. `ReceiptModal` spans roughly lines 376–582 per the survey. The "body" is the content inside the modal (salon info, date, items, VAT, change, watermark) — excluding the header (`Ticket de caisse` + close button) and the footer (close button). On mobile the body is ~lines 415–480; on desktop ~lines 510–568.

- [ ] **Step 9.2: Read the current ReceiptModal body**

Open `modules/pos/components/POSModals.tsx` and identify one of the two body branches of ReceiptModal (mobile ~415–480 OR desktop ~510–568). The two branches render identical content — pick one as the source of truth. Copy the JSX (from the salon-info block through the change row) to your clipboard.

- [ ] **Step 9.3: Create `ReceiptBody.tsx` with the copied JSX**

Create `modules/pos/components/ReceiptBody.tsx`:

```tsx
import type { Transaction } from '@/types';
import { formatPrice, formatTicketNumber } from '@/lib/format';
import { PAYMENT_METHOD_SHORT } from '@/modules/pos/constants';

interface ReceiptBodyProps {
  tx: Transaction;
  salonName?: string;
  salonAddress?: string;
  salonPhone?: string;
  change?: number;
}

/**
 * Pure presentational receipt body. Rendered inside ReceiptModal on screen
 * and inside ReceiptPrintPage in a chrome-less print page. Wrapping components
 * own the header and footer/action buttons.
 */
export function ReceiptBody({ tx, salonName, salonAddress, salonPhone, change }: ReceiptBodyProps) {
  return (
    <div data-testid="receipt-body" className="receipt-body">
      {/* Paste the JSX you copied from ReceiptModal here.
          Replace the following:
            - any references to a hard-coded `salon.name` / `salon.address` / `salon.phone`
              with `salonName` / `salonAddress` / `salonPhone` props (render only when truthy)
            - any short-UUID display of the transaction id with
              `formatTicketNumber(tx.ticketNumber)`
            - computed `change` value currently derived inline → read from `change` prop
              when provided, else compute the same way as before
            - payment-method labels in dense rows → `PAYMENT_METHOD_SHORT[p.method] ?? p.method`
          Keep every class, every conditional (VOID/REFUND watermark, VAT section,
          payments list, change row, items list). Do not invent new markup. */}
    </div>
  );
}
```

Now replace the comment block with the ported JSX, applying the four substitutions listed. Keep Tailwind classes and conditional rendering exactly as in the source.

- [ ] **Step 9.4: Wire ReceiptModal to use `ReceiptBody`**

In `modules/pos/components/POSModals.tsx`, inside `ReceiptModal` replace the body JSX (mobile and desktop branches) with `<ReceiptBody tx={tx} salonName={...} salonAddress={...} salonPhone={...} change={...} />`. Keep the header and footer as they are for now (subsequent tasks edit the header text and footer buttons).

- [ ] **Step 9.5: Typecheck + visual smoke**

```bash
npx tsc --noEmit
npm run dev
```

Open an existing sale from TransactionHistoryPage — click the current Imprimer icon to open ReceiptModal. Verify the body renders identically to before (same salon info, items, VAT, payments, change). If anything is missing, port the JSX more carefully.

- [ ] **Step 9.6: Commit**

```bash
git add modules/pos/components/ReceiptBody.tsx modules/pos/components/POSModals.tsx
git commit -m "refactor(pos): extract ReceiptBody from POSModals

Prepares for reuse from the upcoming ReceiptPrintPage. ReceiptModal
delegates its body to the new presentational component; header and
footer stay in place.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Print route

### Task 10: Create `ReceiptPrintPage.tsx`

**Files:**
- Create: `modules/pos/ReceiptPrintPage.tsx`

- [ ] **Step 10.1: Create the page**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { rawSelect } from '@/lib/supabaseRaw';
import { toTransaction, type TransactionRow } from '@/modules/pos/mappers';
import { ReceiptBody } from '@/modules/pos/components/ReceiptBody';
import type { Transaction } from '@/types';
import { useAuth } from '@/context/AuthContext';

/**
 * Chromeless print view for a transaction receipt. Auto-opens the browser
 * print dialog once data is ready. Closing the tab is the user's job.
 */
export default function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { activeSalon } = useAuth();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Identifiant de transaction manquant.');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await rawSelect<TransactionRow>(
          'transactions',
          `select=*,transaction_items(*),transaction_payments(*),clients(first_name,last_name),profiles(first_name,last_name)&id=eq.${id}`,
          controller.signal,
        );
        if (!rows[0]) {
          setError('Transaction introuvable.');
          return;
        }
        setTx(toTransaction(rows[0]));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue.');
      }
    })();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (tx) {
      // Defer one tick so React commits the DOM before the print dialog opens
      const handle = requestAnimationFrame(() => window.print());
      return () => cancelAnimationFrame(handle);
    }
  }, [tx]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-700">
        <h1 className="text-xl font-semibold mb-2">Impossible d'afficher le reçu</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="p-8 text-center text-slate-500">Chargement du reçu…</div>
    );
  }

  return (
    <div className="bg-white min-h-screen p-6 print:p-0">
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body { background: white; }
        }
      `}</style>
      <ReceiptBody
        tx={tx}
        salonName={activeSalon?.name}
        salonAddress={activeSalon?.address}
        salonPhone={activeSalon?.phone}
      />
    </div>
  );
}
```

Note: match `activeSalon` property names to the actual shape in `AuthContext` — if the salon fields are on a nested object or named differently, adjust (`activeSalon?.salon?.name`, etc.). Read `context/AuthContext.tsx` if unsure.

- [ ] **Step 10.2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If the `activeSalon` shape mismatches, fix the property access.

### Task 11: Register print route in `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 11.1: Find the outer `<Routes>` block**

In `App.tsx`, locate the outer `<Routes>` that hosts `AppContent` and any other chrome-less routes (e.g. `/admin` has its own layout, around lines 293–310 per the survey).

- [ ] **Step 11.2: Add the new route sibling**

Add, near the other outer routes (lazy-import at top of file):

```tsx
import ReceiptPrintPage from '@/modules/pos/ReceiptPrintPage';
```

```tsx
<Route
  path="/pos/historique/:id/print"
  element={
    <ProtectedRoute action="view" resource="pos">
      <ErrorBoundary moduleName="Impression">
        <ReceiptPrintPage />
      </ErrorBoundary>
    </ProtectedRoute>
  }
/>
```

Place it at the outer `<Routes>` level (outside `AppContent`) so `Layout` is not wrapped around it. Match the surrounding formatting exactly.

- [ ] **Step 11.3: Smoke-test**

```bash
npm run dev
```

Navigate in your browser to `/pos/historique/<an-existing-tx-id>/print`. Expected:
- No sidebar, no topbar, no tabbar.
- Receipt body rendered.
- Browser print dialog opens automatically.

- [ ] **Step 11.4: Commit**

```bash
git add modules/pos/ReceiptPrintPage.tsx App.tsx
git commit -m "feat(pos): add chrome-less print route for receipts

Route: /pos/historique/:id/print
Auto-opens the browser print dialog after hydrating the transaction
via rawSelect. Renders ReceiptBody (shared with ReceiptModal).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 — ReceiptModal, TransactionDetailModal, and TransactionHistoryPage

### Task 12: ReceiptModal — add `Imprimer` button, use `formatTicketNumber`, guard prev/next

**Files:**
- Modify: `modules/pos/components/POSModals.tsx`

- [ ] **Step 12.1: Import formatter**

At top of `POSModals.tsx`, ensure `formatTicketNumber` is imported:

```ts
import { formatPrice, formatTicketNumber } from '@/lib/format';
```

- [ ] **Step 12.2: Replace header UUID with ticket number**

Find the header of `ReceiptModal` where the short-UUID or "Ticket de caisse" title is rendered (around line 431–434 mobile, 526–529 desktop). Change the displayed ticket label from a short UUID to `formatTicketNumber(tx.ticketNumber)`. Example:

```tsx
<div className="text-sm text-slate-500">{formatTicketNumber(tx.ticketNumber)}</div>
```

(Exact JSX shape depends on the current code — preserve surrounding classes; swap the string.)

- [ ] **Step 12.3: Add `Imprimer` button to the footer**

In the footer (mobile ~lines 484–494, desktop ~lines 571–578), transform the sole `Fermer` button into two buttons side-by-side. Example desktop footer:

```tsx
<div className="flex gap-3 justify-end">
  <button
    type="button"
    onClick={() => {
      window.open(
        `/pos/historique/${tx.id}/print`,
        '_blank',
        'noopener,noreferrer',
      );
    }}
    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
  >
    Imprimer
  </button>
  <button
    type="button"
    onClick={onClose}
    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
  >
    Fermer
  </button>
</div>
```

For the mobile footer apply the same two buttons, stacked full-width with 44px min-height. Use whatever classes the surrounding mobile footer already uses; the new button simply matches the existing `Fermer` styling with emerald primary for `Imprimer`.

- [ ] **Step 12.4: Guard prev/next when opened tx is not in `allTransactions`**

Locate the prev/next navigation block in ReceiptModal. Wrap it with a conditional that checks membership:

```tsx
{allTransactions.some((t) => t.id === tx.id) && (
  // existing prev/next JSX
)}
```

This ensures a freshly-created tx (not yet in the invalidated cache) doesn't render broken navigation.

- [ ] **Step 12.5: Smoke-test**

```bash
npm run dev
```

Open a historical transaction → ReceiptModal → verify:
- Header shows `n°000042` style number.
- Footer shows `[ Imprimer ]` and `[ Fermer ]`.
- Clicking `Imprimer` opens a new tab at the print route and fires the print dialog.
- Prev/next still works for historical transactions.

- [ ] **Step 12.6: Commit**

```bash
git add modules/pos/components/POSModals.tsx
git commit -m "feat(pos/receipt): add Imprimer button and ticket number to ReceiptModal

- Header uses formatTicketNumber instead of short UUID
- Footer gains Imprimer (opens print route in new tab) alongside Fermer
- Prev/next controls hidden when the opened tx is not yet in the cached
  transactions list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 13: TransactionDetailModal — adopt `formatTicketNumber` in title

**Files:**
- Modify: `modules/pos/components/POSModals.tsx` (TransactionDetailModal section)

- [ ] **Step 13.1: Update the title**

Find `TransactionDetailModal`'s header title (around lines 869–877 mobile, 893–898 desktop). Wherever the current short-UUID or id suffix appears alongside "Détails de la transaction", swap to `formatTicketNumber(tx.ticketNumber)`. Example:

```tsx
<h2 className="text-lg font-semibold">Détails — {formatTicketNumber(tx.ticketNumber)}</h2>
```

Preserve surrounding classes.

- [ ] **Step 13.2: Smoke-test**

Open the app, navigate to TransactionHistoryPage, click a row to open the detail modal. Title shows `Détails — n°000042`.

- [ ] **Step 13.3: Commit**

```bash
git add modules/pos/components/POSModals.tsx
git commit -m "feat(pos/detail): TransactionDetailModal title uses formatTicketNumber

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 14: TransactionHistoryPage — N° column + print-route navigation

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx`

- [ ] **Step 14.1: Import the formatter**

```ts
import { formatTicketNumber } from '@/lib/format';
```

- [ ] **Step 14.2: Desktop table — add `N°` column**

Find the desktop table header and rows (the list of `<th>` and the matching `<td>`s). Insert a new first (or second, before the date) column:

- Header cell: `<th className="...">N°</th>` matching the existing header classes.
- Body cell: `<td className="... font-mono">{formatTicketNumber(trx.ticketNumber)}</td>` matching the row cell classes.

If sorting is table-driven (sort handlers keyed by column), add a `ticket_number` sort option so the new column is sortable. If adding a sort handler is non-trivial, mark the column non-sortable for now and log a follow-up — but prefer sortable to match other columns.

- [ ] **Step 14.3: Mobile row — show ticket number**

Find the mobile row layout (typically a card-like `<div>`). Add a small line near the date (or at the top of the card):

```tsx
<div className="text-xs text-slate-500 font-mono">
  {formatTicketNumber(trx.ticketNumber)}
</div>
```

- [ ] **Step 14.4: Imprimer row action → open print route**

Find the current Imprimer icon button (desktop around lines 1002–1008, mobile around 751–758). Current `onClick` is `() => setReceiptTransaction(trx)`. Replace with:

```tsx
onClick={() => {
  window.open(
    `/pos/historique/${trx.id}/print`,
    '_blank',
    'noopener,noreferrer',
  );
}}
```

Leave the `setReceiptTransaction` elsewhere — a separate "view" action (if present) still opens the modal; only the "Imprimer" icon navigates to the print route.

- [ ] **Step 14.5: Smoke-test**

```bash
npm run dev
```

- Desktop: N° column visible, sortable, values like `n°000042`.
- Mobile: ticket number appears on each row.
- Click Imprimer icon: new tab opens at print route, print dialog fires. The old behavior of opening ReceiptModal from Imprimer is gone; any separate "view receipt" entry still opens the modal.

- [ ] **Step 14.6: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "feat(pos/history): show ticket number column + print via new tab

- Desktop table gains a sortable N° column using formatTicketNumber
- Mobile rows show the ticket number inline
- Imprimer icon navigates to /pos/historique/:id/print in a new tab
  (was: opens ReceiptModal)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 8 — TransactionSuccessModal

### Task 15: Create `TransactionSuccessModal.tsx`

**Files:**
- Create: `modules/pos/components/TransactionSuccessModal.tsx`

- [ ] **Step 15.1: Create the file**

```tsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, X } from 'lucide-react';
import type { Transaction } from '@/types';
import { formatPrice, formatTicketNumber } from '@/lib/format';
import { PAYMENT_METHOD_SHORT } from '@/modules/pos/constants';
import { useMediaQuery } from '@/context/MediaQueryContext';

interface TransactionSuccessModalProps {
  tx: Transaction | null;
  onClose: () => void;
}

function formatPaymentMethods(tx: Transaction): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of tx.payments) {
    const short = PAYMENT_METHOD_SHORT[p.method] ?? p.method;
    if (!seen.has(short)) {
      seen.add(short);
      labels.push(short);
    }
  }
  return labels.join(' + ');
}

function totalArticles(tx: Transaction): number {
  return tx.items.reduce((sum, it) => sum + it.quantity, 0);
}

export function TransactionSuccessModal({ tx, onClose }: TransactionSuccessModalProps) {
  const { isMobile } = useMediaQuery();
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll + handle Escape
  useEffect(() => {
    if (!tx) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [tx, onClose]);

  // Initial focus on primary
  useEffect(() => {
    if (tx) primaryButtonRef.current?.focus();
  }, [tx]);

  // Focus trap: Tab cycles through focusable elements inside the modal
  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tx]);

  if (!tx) return null;

  const handlePrint = () => {
    window.open(
      `/pos/historique/${tx.id}/print`,
      '_blank',
      'noopener,noreferrer',
    );
    // Intentionally do NOT close — cashier can print, then tap Nouvelle vente.
  };

  const backdropClass = isMobile
    ? 'fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300 z-50'
    : 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200';

  const panelClass = isMobile
    ? 'flex flex-col w-full h-full'
    : 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden';

  return createPortal(
    <div
      className={backdropClass}
      onClick={(e) => {
        // Backdrop click closes on desktop only
        if (!isMobile && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-success-heading"
    >
      <div ref={modalRef} className={panelClass}>
        {/* Close (X) */}
        <div className="flex justify-end p-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex-1 flex flex-col items-center text-center">
          <div
            id="tx-success-heading"
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-2 mb-6"
          >
            <CheckCircle size={48} className="text-emerald-500" />
            <div className="text-lg font-medium text-slate-900">
              Transaction enregistrée
            </div>
            <div className="font-mono text-slate-600 text-base">
              {formatTicketNumber(tx.ticketNumber)}
            </div>
          </div>

          <div className="text-4xl font-bold text-slate-900 mb-4">
            {formatPrice(tx.total)}
          </div>

          <div className="text-sm text-slate-600 mb-1">
            {totalArticles(tx)} article{totalArticles(tx) > 1 ? 's' : ''} · {formatPaymentMethods(tx)}
          </div>

          {tx.clientName && (
            <div className="text-sm text-slate-500 mb-4">{tx.clientName}</div>
          )}
        </div>

        {/* Footer buttons */}
        <div
          className="px-6 pb-6 flex flex-col gap-3"
          style={isMobile ? { paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' } : undefined}
        >
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={handlePrint}
            className="w-full min-h-[44px] px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            Imprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
          >
            Nouvelle vente
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 15.2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any import paths if the `@/` alias isn't used consistently in neighbours — match existing import style.

### Task 16: Wire `TransactionSuccessModal` into `POSModule`

**Files:**
- Modify: `modules/pos/POSModule.tsx`

- [ ] **Step 16.1: Add state**

Near the other `useState` declarations:

```tsx
const [successTx, setSuccessTx] = useState<Transaction | null>(null);
```

Add the import at the top:

```tsx
import { TransactionSuccessModal } from './components/TransactionSuccessModal';
```

Also ensure `Transaction` is imported (likely already is).

- [ ] **Step 16.2: Update `handleCompletePayment`**

Find the current function (lines 139–151):

```tsx
const handleCompletePayment = async (payments: PaymentEntry[]) => {
  if (isProcessing) return;
  setIsProcessing(true);
  try {
    await processTransaction(payments);
    setShowPaymentModal(false);
  } catch {
    // Error toast handled by mutation onError
  } finally {
    setIsProcessing(false);
  }
};
```

Replace with:

```tsx
const handleCompletePayment = async (payments: PaymentEntry[]) => {
  if (isProcessing) return;
  setIsProcessing(true);
  try {
    const tx = await processTransaction(payments);
    setShowPaymentModal(false);
    setSuccessTx(tx);
  } catch {
    // Error toast handled by mutation onError
  } finally {
    setIsProcessing(false);
  }
};
```

- [ ] **Step 16.3: Gate reopening PaymentModal while success modal is open**

Find where `PaymentModal` is triggered (look for `setShowPaymentModal(true)` call sites — typically from the Encaissement button). Guard it:

```tsx
<button
  // ...existing props
  disabled={cart.length === 0 || successTx !== null}
  onClick={() => {
    if (successTx !== null) return;
    setShowPaymentModal(true);
  }}
>
  Encaissement
</button>
```

If the button's disabled state is computed somewhere centralised, add `|| successTx !== null` there instead of at the button.

- [ ] **Step 16.4: Render the success modal**

At the JSX modal stack (alongside `<PaymentModal>`, `<ReceiptModal>`, etc., around lines 274–357):

```tsx
<TransactionSuccessModal
  tx={successTx}
  onClose={() => setSuccessTx(null)}
/>
```

- [ ] **Step 16.5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 16.6: Manual test**

```bash
npm run dev
```

1. Add a product to the cart.
2. Click Encaissement, pick a payment method, complete.
3. Expected: PaymentModal closes, TransactionSuccessModal opens with:
   - green check + "Transaction enregistrée"
   - ticket number formatted `n°000042`
   - headline total
   - summary line (e.g. `1 article · Espèces`)
   - no client row for a walk-in sale
4. Press Escape → modal closes, cart empty.
5. Try again with a linked client → client's full name appears on its own line.
6. Try a split payment → summary shows both methods joined with ` + `.
7. Click Imprimer → new tab opens at print route, print dialog fires, success modal stays visible in POS tab.
8. Click Nouvelle vente → modal closes.
9. While the success modal is open, try clicking Encaissement (there's nothing in the cart anyway, but confirm it doesn't reopen PaymentModal).

- [ ] **Step 16.7: Commit**

```bash
git add modules/pos/POSModule.tsx modules/pos/components/TransactionSuccessModal.tsx
git commit -m "feat(pos): add TransactionSuccessModal and wire into POSModule

Minimalist post-sale confirmation matching Square's All Done pattern:
green check + ticket number + headline total + one-line sub-summary +
two peer actions (Imprimer primary, Nouvelle vente ghost). Imprimer
opens the print route in a new tab without closing the modal; cashier
dismisses manually via Nouvelle vente / Escape / backdrop (desktop) / X.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 9 — Final pass

### Task 17: Full manual test run

- [ ] **Step 17.1: Walk the spec's test plan**

Run through the numbered manual tests in `docs/superpowers/specs/2026-04-23-pos-transaction-success-modal-design.md` §9:

1. Cash sale → success modal shows correct data.
2. Split cash + card with linked client → summary + client name.
3. Imprimer opens print tab, success modal stays visible.
4. Nouvelle vente / backdrop (desktop) / Escape / X → modal closes, cart empty.
5. Two parallel sales in the same salon (two tabs) → sequential non-colliding ticket numbers (open two POS tabs in the same browser, ring sales back-to-back, verify numbers increment without duplicates).
6. Fresh-salon first sale → ticket is 1 (test by creating a brand-new salon in the app, ringing a sale).
7. Post-migration existing salon → next new sale = (prev max + 1).
8. Mobile 360×640 (DevTools responsive): modal fits, both buttons thumb-reachable, no overlap with BottomTabBar / home indicator.
9. Screen reader on open: `"Transaction enregistrée, Ticket n°000042, 60 euros"` announced (use VoiceOver on macOS or NVDA on Windows).
10. TransactionHistoryPage Imprimer icon opens print route.
11. Anonymous-tab print route → RLS denial rendered gracefully.

Fix anything broken; if a fix is more than one-line, create a follow-up task in this plan and iterate.

### Task 18: Lint, format, typecheck, full test

- [ ] **Step 18.1: Run the toolchain**

```bash
cd "/Users/sims/Casa de Chicas/Salon-Saas"
npm run lint:fix
npm run format
npx tsc --noEmit
npm run test
```

Expected: clean formatter, clean linter, no type errors, all tests pass.

- [ ] **Step 18.2: Commit any formatter/lint-fix changes**

```bash
git status
# If anything moved:
git add -A
git commit -m "chore: biome format + lint fix after feature implementation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 19: Open PR

- [ ] **Step 19.1: Push branch**

```bash
git push -u origin feat/pos-success-modal
```

- [ ] **Step 19.2: Open PR against main**

```bash
gh pr create --title "feat(pos): post-sale confirmation modal + ticket numbers" --body "$(cat <<'EOF'
## Summary

- Sequential per-salon `ticket_number` (schema + backfill + atomic assignment in `create_transaction`).
- `TransactionSuccessModal` — minimalist post-sale confirmation (Imprimer + Nouvelle vente), matching Square's All Done pattern.
- `/pos/historique/:id/print` chrome-less route powers one-tap printing from three places (success modal, ReceiptModal, TransactionHistoryPage row action).
- `ReceiptModal` gains a real Imprimer button; ticket numbers displayed via new `formatTicketNumber` across ReceiptModal, TransactionDetailModal, and TransactionHistoryPage.
- `addTransactionMutation` now returns a fully hydrated `Transaction` (RPC → rawSelect with joins → toTransaction).

Design: docs/superpowers/specs/2026-04-23-pos-transaction-success-modal-design.md (v5)
Plan:   docs/superpowers/plans/2026-04-23-pos-transaction-success-modal.md

## Test plan

- [x] Single cash sale → modal opens with correct ticket #, total, summary
- [x] Split payment + linked client → client + both methods rendered
- [x] Imprimer opens print tab, success modal remains visible
- [x] Nouvelle vente / Escape / X / backdrop (desktop) close modal, cart empty
- [x] Two tabs, same salon, back-to-back sales → sequential non-colliding ticket numbers
- [x] Fresh salon → first ticket is 1
- [x] Post-migration existing salons → next new sale = max + 1
- [x] Mobile 360×640 — buttons thumb-reachable, safe-area respected
- [x] TransactionHistoryPage Imprimer icon opens print route in new tab

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Note the PR URL and report it back.

---

## Appendix — Notes for the executing agent

- **Always use `lib/supabaseRaw.rawSelect` / `rawRpc`** for hot-path reads and the create mutation's hydrate step. `supabase.rpc()` / `supabase.from(...).select()` can wedge after an idle background tab — see `project_sdk_wedge_raw_fetch.md` in the project memory.
- **Don't change the `create_transaction` signature.** Callers (`toTransactionRpcPayload` in `modules/pos/mappers.ts`) format a specific JSONB shape; the migration only changes the body.
- **Respect the `search_path` convention** for SECURITY DEFINER functions: `SET search_path = public, extensions, vault`. Migration 20260415102000 enforces this for all existing functions; the new `create_transaction` body pins the same list.
- **Do not `git push` without explicit permission** beyond Task 19 where the user is already expecting a PR. Per project memory on git workflow, PRs go to `main`, direct pushes are not the default.
- **Vitest, not Jest.** Use `npm run test` / `npm run test -- <path>`.
- **Biome, not Prettier.** `npm run format` / `npm run lint:fix`.
