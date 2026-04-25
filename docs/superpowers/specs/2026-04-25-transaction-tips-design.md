# Transaction tips — Phase H

**Date:** 2026-04-25
**Status:** Spec pending review

## Problem

The POS today has no concept of tips. When a client adds a tip on top of the service price, the cashier either lumps it into the payment amount (no allocation, lost as bookkeeping) or walks away from a feature the client expected.

For salons specifically:
- Tips are personal compensation, not business revenue
- Multiple staff often work on one client (color + cut + style → 2-3 staff)
- Tax/legal regimes typically require per-staff tip records
- Staff want to see "Sarah received X this week in tips"
- Staff payouts depend on accurate per-recipient tip data

## Goals

1. Cashier can record one or more tips per transaction, each linked to a specific staff member.
2. Each tip has its own amount and payment method (defaults to the main transaction's method, but is per-row overridable).
3. Tips appear on the receipt as separate lines, distinguished from the service charge.
4. Tips are queryable per staff, per transaction, and per period (foundation for future tip-payout reporting — that report itself is out of scope here).
5. Cashier UX overhead is zero when no tip is involved (collapsed section, one click to expand).
6. Voiding a transaction cascade-removes its tips (refunding too — tips disappear with the parent).

## Non-goals

- Tip-out auto-splits (assistant gets X% of senior's tip)
- Pooled tips with periodic distribution
- Editing tips on past transactions
- Tip reports / dashboards (data will be queryable; the dashboard is a separate phase)
- Tipping on products (cultural norm: services-only)
- Splitting a single tip across multiple methods (1 tip = 1 method; multi-method = multiple rows)

## Design

### Schema

**Method validation refactor (do this first in the migration).** Method literals are validated in 3 places today (CHECK on `transaction_payments`, validation in `create_transaction` for items, validation in `create_transaction` for the new tips). To prevent drift, extract a shared SQL function:

```sql
CREATE OR REPLACE FUNCTION is_valid_payment_method(m TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT m IN ('CASH','CARD','TRANSFER','CHECK','MOBILE','OTHER')
$$;
```

The existing `transaction_payments.method` CHECK is updated to use this function. The new `transaction_tips.method` CHECK uses it. The RPC's two validation loops (payments, tips) call it. Single source of truth.

**New table:**

```sql
CREATE TABLE transaction_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id),
  -- Nullable + ON DELETE SET NULL matches the existing transaction_items.staff_id
  -- precedent. Staff are soft-deleted, but if a hard delete ever happens,
  -- the tip row survives and the UI renders "Pourboire (staff supprimé)".
  staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (is_valid_payment_method(method)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX transaction_tips_salon_staff_created_idx
  ON transaction_tips (salon_id, staff_id, created_at DESC);
CREATE INDEX transaction_tips_transaction_idx
  ON transaction_tips (transaction_id);
```

**Cascade behavior:** `ON DELETE CASCADE` on the transaction FK. Voiding/refunding doesn't actually DELETE transactions in this app (they stay as immutable records with sibling rows for the void/refund), so cascade-delete won't fire in normal operation. But if a transaction were ever hard-deleted (admin operation), tips clean themselves up. Insurance.

**Auditing:** `created_at` and `created_by` mirror the pattern on `transaction_items`. No `updated_at` because tips aren't edited (one-shot record at transaction time).

### RLS policies

```sql
ALTER TABLE transaction_tips ENABLE ROW LEVEL SECURITY;

-- Owners / managers / receptionists see all tips in their salon.
-- Stylists see only their OWN tips (joined via staff_members → salon_memberships → auth.uid()).
-- This is more restrictive than the items/payments policy (which uses created_by)
-- because tip privacy matters in salons — a stylist shouldn't see a peer's earnings.
CREATE POLICY "transaction_tips_select" ON transaction_tips
  FOR SELECT TO authenticated
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
    OR staff_id IN (
      SELECT sm.id
      FROM staff_members sm
      JOIN salon_memberships smb ON smb.id = sm.membership_id
      WHERE smb.profile_id = auth.uid()
        AND smb.deleted_at IS NULL
    )
  );

-- Defense in depth: even though create_transaction is SECURITY DEFINER and
-- bypasses RLS, add an INSERT policy mirroring the existing transaction_items
-- and transaction_payments patterns so a future direct-insert path is safe.
CREATE POLICY "transaction_tips_insert" ON transaction_tips
  FOR INSERT TO authenticated
  WITH CHECK (salon_id IN (SELECT user_salon_ids()));

-- No UPDATE policy (tips are immutable).
-- No DELETE policy (cascade-only via FK).
```

### `create_transaction` RPC extension

Add `p_tips JSONB DEFAULT '[]'::jsonb` parameter, matching the shape:

```json
[
  {"staff_id": "uuid", "amount": 10.00, "method": "CASH"},
  {"staff_id": "uuid", "amount": 5.00, "method": "CARD"}
]
```

Validation pass at the top of the body (same place we validate deletion reasons today):

```sql
FOR v_tip IN SELECT * FROM jsonb_array_elements(p_tips)
LOOP
  IF (v_tip->>'method') NOT IN ('CASH','CARD','TRANSFER','CHECK','MOBILE','OTHER') THEN
    RAISE EXCEPTION 'Invalid tip method: %', v_tip->>'method'
      USING ERRCODE = '22023';
  END IF;
  IF ((v_tip->>'amount')::numeric) <= 0 THEN
    RAISE EXCEPTION 'Tip amount must be positive: %', v_tip->>'amount'
      USING ERRCODE = '22023';
  END IF;
  -- Validate staff_id belongs to this salon (mirrors the staff_id validation
  -- already in the items loop)
  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE id = (v_tip->>'staff_id')::uuid
      AND salon_id = p_salon_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid tip staff_id for this salon: %', v_tip->>'staff_id';
  END IF;
END LOOP;
```

Insert pass after `transaction_payments`:

```sql
FOR v_tip IN SELECT * FROM jsonb_array_elements(p_tips)
LOOP
  INSERT INTO transaction_tips (
    transaction_id, salon_id, staff_id, amount, method, created_by
  ) VALUES (
    v_transaction_id, p_salon_id,
    (v_tip->>'staff_id')::uuid,
    (v_tip->>'amount')::numeric,
    v_tip->>'method',
    auth.uid()
  );
END LOOP;
```

### Storage model — what `transaction_payments.amount` represents on a tipped sale

**Decision: `transaction_payments.amount` records the services portion only. Tips live on `transaction_tips`. The cashier types a tendered amount in the modal; the modal splits it internally.**

Worked example — services 100 €, tip 15 € for Sarah, client hands a 200 € note in cash:

| Where | Value |
|---|---|
| `transactions.total` | `100.00` (services + products only) |
| `transaction_payments[]` | `[{method: 'CASH', amount: 100.00}]` |
| `transaction_tips[]` | `[{staff_id: sarah, amount: 15.00, method: 'CASH'}]` |
| Modal "Rendre" display | `200 - 100 - 15 = 85 €` |

Properties:
- `SUM(transaction_payments.amount) === transactions.total` always (services revenue is consistent)
- `SUM(transaction_tips.amount)` reports per-staff earnings cleanly
- `ReceiptBody.change = totalPaid - tx.total` stays correct because `totalPaid` is now services-only
- VAT calc `(tx.total * vatRate) / (1 + vatRate)` stays correct because `tx.total` excludes tips (tips aren't VATable)

**The tendered amount is NOT persisted.** It only exists at the modal level for the cashier's change calculation. The receipt shows services + tips separately; change isn't shown on the printed receipt.

**Implication for PaymentModal:** the existing single-amount input semantics change. The "Montant reçu" input now represents tendered cash for **services only**. Tip amounts are entered per row in the tips section. The Confirmer's bottom-line `Rendre Y €` calculation becomes `tendered - servicesTotal` (tips are separately self-balanced — each tip row IS what the client gave for that recipient, no overpay/change for tips). This keeps the cashier from having to do mental arithmetic.

**The existing `v_payment_total >= v_total` check in the RPC stays unchanged** — it's still validating services payments against services total, which is correct.

### Client types

`types.ts`:

```ts
export interface TransactionTip {
  id: string;
  transactionId: string;
  staffId: string;
  staffName?: string; // hydrated via join in receipt views
  amount: number;
  method: string;
  createdAt: string;
}
```

`Transaction` interface gains an optional `tips?: TransactionTip[]` field, hydrated by `toTransaction` when the row's joined `transaction_tips(*, staff_members(first_name, last_name))` are present.

`mappers.ts` — `toTransactionRpcPayload` accepts a new `tips` parameter:

```ts
export interface TransactionTipPayload {
  staff_id: string;
  amount: number;
  method: string;  // wire format
}

export function toTransactionRpcPayload(
  cart: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string,
  appointmentId?: string,
  deletedAppointments: TransactionDeletion[] = [],
  modifiedAppointments: TransactionModification[] = [],
  tips: TransactionTipPayload[] = [],
) {
  // ...
  return {
    p_salon_id: salonId,
    p_client_id: clientId ?? null,
    p_appointment_id: appointmentId ?? null,
    p_items,
    p_payments,
    p_deleted_appointments: deletedAppointments,
    p_modified_appointments: modifiedAppointments,
    p_tips: tips,
  };
}
```

`useTransactions.addTransaction` mutation gains an optional `tips` arg, forwarded verbatim.

### `usePOS.processTransaction`

Currently builds the payments array; will collect tip entries from a new hook-level state `pendingTips: TipEntry[]` (just an in-memory array, reset on `clearCart` and `importAppointment` like `pendingDeletions`).

Set by the PaymentModal's tips section when the cashier confirms.

### PaymentModal — Tips section

A new collapsed section above the Confirmer button. **Hidden by default**; cashier clicks `+ Ajouter un pourboire` to expand. Once a tip row is present, the section stays expanded.

```
┌─ Pourboires (optionnel) ─────────────────────────────┐
│  ┌─────────────────────────────────────────────────┐ │
│  │ Sarah Martin ▼   10,00 €   Espèces ▼   [×]      │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Amira Dubois ▼    5,00 €   Espèces ▼   [×]      │ │
│  └─────────────────────────────────────────────────┘ │
│  [ + Ajouter ]            Total pourboires: 15,00 € │
└──────────────────────────────────────────────────────┘
```

**Per-row controls:**

- **Staff dropdown:** filtered to staff who appear in the transaction's cart items (i.e., `cart.filter(i => i.staffId).map(i => i.staffId)` deduped). If no items have staff, the dropdown shows all active staff. This prevents accidentally tipping someone who didn't work on this client.

- **Amount input:** numeric, validates > 0. Quick chips: `5%`, `10%`, `15%`, `20%`, `Personnalisé`. Percentage is computed from the **SERVICES** subtotal only (cart items where `type === 'SERVICE'`) — products aren't tipped per cultural convention. If the cart is product-only, percentage chips are hidden.

- **Method dropdown:** defaults to the **first method** in the main `payments` list (in Mode B), the `selectedMethod` (in Mode A), or `'Espèces'` as a final fallback when neither is set yet. Per-row overridable from the same six methods used elsewhere.

  **`isMethodCustom` semantics (precise):** the boolean is set to `true` *only* on a user-originated `onChange` event of the tip row's method dropdown (i.e., the user clicks/selects a different method). Programmatic updates (a parent prop change syncing the default to a new main method) MUST NOT flip the flag. Implementation: the dropdown's `onChange` handler is the only place that calls `setIsMethodCustom(true)`; the default-sync `useEffect` does not touch it.

  Reactive default sync: when the main method changes, every tip row with `isMethodCustom === false` updates its method to the new default. Rows with `isMethodCustom === true` are left alone.

- **Remove (×) button** clears the row.

**Section-level controls:**

- `+ Ajouter` adds a new empty row (staff dropdown empty, amount empty, method = current main method default).
- **Total pourboires** line shows the sum of all tip amounts.
- The Confirmer button copy updates to include the tip total when > 0:
  - Mode A, no tip: `"Encaisser 100 € · Espèces"`
  - Mode A, with tip: `"Encaisser 100 € + 15 € pourboire · Espèces"`
  - Mode B, no tip: `"Valider la transaction (3 paiements)"`
  - Mode B, with tip: `"Valider la transaction (3 paiements + 15 € pourboire)"`

**Validation before confirm:**

- Each tip row must have: staff_id selected, amount > 0, method set
- A row is **fully empty** when `staff_id === null` AND amount is empty/0. Fully-empty rows are silently dropped at confirm time (no warning).
- A row is **half-filled** when one of staff/amount is set but the other isn't. These rows render with a red border + small "Complétez ce pourboire" hint, and the Confirmer button is disabled until they're either completed or removed (via the × button).
- If after dropping fully-empty rows there are no tip rows, no tip data is sent.

### ReceiptBody — Tip lines

Below the items section and above the payments section, render a **Tips** subsection (only when `tx.tips` is non-empty):

```
Pourboires
  Sarah Martin (Espèces)   10,00 €
  Amira Dubois (Espèces)    5,00 €
                          ─────────
  Total pourboires         15,00 €
```

Tips do NOT contribute to the printed `Total` (which remains the service+product total per the existing layout). A separate `Total avec pourboires` line appears below it when tips exist.

### Tip recipient resolution

The receipt + transaction-detail views need staff names. Two paths:

- **At fetch time:** add a join in the existing transactions select string: `transaction_tips(*, staff_members(first_name, last_name))`. The mapper resolves `tip.staffName` from the joined relation.
- **At create time:** the RPC returns just the transaction id; the hydration query that already runs after `create_transaction` (in `useTransactions`) is what populates the full Transaction shape — extend its select to include the tips join.

### Cart subtotal for percentage chips

```ts
const servicesSubtotal = cart
  .filter((item) => item.type === 'SERVICE')
  .reduce((sum, item) => sum + item.price * item.quantity, 0);
```

Quick chips multiply this by 0.05 / 0.10 / 0.15 / 0.20 and round to 2dp. If `servicesSubtotal === 0`, hide the chip row.

## Implementation order

1. Migration: new table + RLS + indexes + RPC extension. Push to remote, regenerate types.
2. `types.ts`: `TransactionTip` interface, `Transaction.tips?` field
3. `mappers.ts`: `TransactionRow` joined relation, `toTransaction` hydration, `toTransactionRpcPayload` extension
4. `useTransactions.addTransaction`: pipe tips arg through to RPC payload
5. `usePOS`: `pendingTips` state, reset on clearCart/importAppointment, exposed via return; `processTransaction` flushes tips into RPC call
6. `PaymentModal`: tips section UI, validation, confirm-copy updates. Wire `pendingTips` setter through.
7. `ReceiptBody`: tip line rendering. Backwards compatible (omits the section when tips empty).
8. Manual verification.

## Risks

1. **Cashier UX overhead.** If tips are visible by default, every checkout becomes a 3-click flow. Mitigation: section collapsed by default, only expands on explicit click.

2. **Method default drift.** When the cashier toggles between Mode A and Mode B (PaymentModal), the "main method" definition changes. Tip method default must follow without overriding manual selections — the `isMethodCustom` flag handles this.

3. **Staff dropdown empty case.** Walk-in product-only sale → no items have staff → dropdown shows all active staff. Acceptable but worth flagging in the spec so the implementer doesn't show an empty dropdown.

4. **Refund handling for tipped transactions.** When refunding a transaction that has tips, what happens? Current refund flow doesn't touch payments either — it creates a sibling refund row. For tips: the original tip row stays. If the cashier wants to "claw back" the tip, they'd need a separate flow (out of scope). Document the behavior; don't build a tip-clawback path.

5. **Tip on a fully-Offert visit.** Total is 0; the modal shouldn't open at all (no encaissement). If it does (edge case), tips are still allowed because the cashier may still want to record a generosity tip. Don't block.

6. **Currency rounding.** Percentage chips compute `serviceTotal * 0.10` etc. Use `round2` helper consistently.

## Testing

Automated: existing `processTransaction` tests still pass (tips arg is optional, defaults to empty). Add 1-2 mapper tests for `toTransactionRpcPayload` to confirm tip pass-through if useful.

Manual:
- Walk-in service, click + Ajouter un pourboire, pick staff, type 5 €, ring up. Receipt shows the tip line. DB has the row.
- Multi-service group with two stylists. Add two tip rows. Both land on receipt.
- Tip with method different from main payment. Receipt distinguishes them.
- 10% chip: with services-only cart, sets to 10% of services. With product-only cart, chip is hidden.
- Edit cart items after tipping — does the percentage chip recompute? Yes (it's reactive). Confirm.
- Confirm modal closes, reopens, tip section is collapsed again (state reset on close).
- Refund a tipped transaction — tip rows stay (don't clawback automatically). Verify Agenda / receipt history reflects the original tip.
- Cancel modal mid-tip-edit — pending tips discarded (state reset on close).

## Out of scope (deliberate)

- Tip-out auto-splits to assistants
- Pooled tips
- Editing past tips
- Tip dashboard / reports
- Tipping products
- Multi-method per single tip
- Tip clawback on refund
- Cash drawer integration for cash tips

These are real features but each deserves its own scope. Ship the storage layer + cashier flow first; everything else builds on this foundation.
