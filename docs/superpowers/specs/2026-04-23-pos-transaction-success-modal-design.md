# POS Transaction Success Modal — Design (v2)

**Date:** 2026-04-23
**Revision:** v2 — incorporates senior-review feedback, scope expanded to include sequential ticket numbers and ReceiptModal print action.
**Goal:** After a successful transaction creation in POS, show a confirmation modal with a compact summary, a human-readable ticket number, and navigation actions, replacing the current silent cart-clear.

---

## Motivation

Completing a payment today closes `PaymentModal` and clears the cart silently. Cashiers get no confirmation, no immediate path to the receipt, and no way to quickly review what they just rang up. This feature adds that confirmation surface, plus the prerequisite pieces it depends on (proper sequential ticket numbering and a working "Imprimer" on the receipt).

## Non-Goals

- No changes to refund / void flows.
- No auto-dismiss / timeout on the modal.
- No schema change to `transaction_items` / `transaction_payments`.
- No email/SMS receipt delivery (out of scope).

## In scope (three related deliverables)

1. **Sequential per-salon ticket numbers** (new schema) — prerequisite for a useful ticket display.
2. **Print button on `ReceiptModal`** (existing component, missing feature) — prerequisite for the success modal's "Voir le reçu" to lead to a real print path.
3. **`TransactionSuccessModal`** — the feature the user asked for.

Implementation plan will likely sequence these as 1 → 2 → 3.

---

## 1. Sequential per-salon ticket numbers

### Schema

New column on `transactions`:

```sql
ALTER TABLE transactions
  ADD COLUMN ticket_number BIGINT;
```

New counter table (one row per salon):

```sql
CREATE TABLE salon_ticket_counters (
  salon_id UUID PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
  next_ticket_number BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE salon_ticket_counters ENABLE ROW LEVEL SECURITY;
-- No client-side policies needed; only SECURITY DEFINER RPC touches it.
```

Unique index to enforce monotonicity and prevent accidental reuse:

```sql
CREATE UNIQUE INDEX transactions_ticket_number_per_salon
  ON transactions (salon_id, ticket_number)
  WHERE ticket_number IS NOT NULL;
```

### Reset policy

**Never resets.** Monotonically increasing per salon, forever. Tax-friendly (Morocco/France), simple, and the norm for modern POS. If a daily reset is ever needed, it's a future migration.

### Assignment — atomic, concurrency-safe

Done inside the existing `create_transaction` RPC (which is `SECURITY DEFINER`). Single SQL statement using `UPDATE ... RETURNING` for row-level locking:

```sql
-- inside create_transaction, before INSERT INTO transactions
INSERT INTO salon_ticket_counters (salon_id)
VALUES (p_salon_id)
ON CONFLICT (salon_id) DO NOTHING;

UPDATE salon_ticket_counters
SET next_ticket_number = next_ticket_number + 1,
    updated_at = now()
WHERE salon_id = p_salon_id
RETURNING next_ticket_number - 1 INTO v_ticket_number;

-- then INSERT INTO transactions (..., ticket_number) VALUES (..., v_ticket_number)
```

Concurrent calls in the same salon serialize on the counter row's lock. Different salons don't contend.

### Backfill

One-time migration block, deterministic ordering by `created_at`:

```sql
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

INSERT INTO salon_ticket_counters (salon_id, next_ticket_number)
SELECT salon_id, COALESCE(MAX(ticket_number), 0) + 1
  FROM transactions
 GROUP BY salon_id
ON CONFLICT (salon_id) DO UPDATE
  SET next_ticket_number = EXCLUDED.next_ticket_number;

ALTER TABLE transactions
  ALTER COLUMN ticket_number SET NOT NULL;
```

After backfill, every transaction has a ticket_number; the column is NOT NULL going forward.

### RPC signature

`create_transaction` keeps its existing `RETURNS UUID` signature. The ticket_number assignment is internal to the RPC body; the frontend reads the `ticket_number` via the hydration `rawSelect` that already runs for joined fields (client name, staff name, items, payments) — see §3. Keeping the signature unchanged means existing callers continue to work.

### Frontend type + mapper

- Add `ticketNumber: number` to the `Transaction` type in `types.ts`.
- Update `modules/pos/mappers.ts:toTransaction()` to read `ticket_number` from the DB row.

### Display updates (consistency)

Wherever a transaction is displayed with a short ID today, prefer the ticket number. Short-UUID display stays as a secondary tooltip.

- `modules/pos/components/POSModals.tsx` — `ReceiptModal` header: `Ticket n°000042` (zero-padded to 6 digits).
- `modules/pos/components/POSModals.tsx` — `TransactionDetailModal` title: same.
- `modules/pos/TransactionHistoryPage.tsx` — add a `N°` column (sortable) before the date column on desktop, inline on mobile row.

Zero-padding helper: add `formatTicketNumber(n: number): string` to `lib/format.ts`, returning `'n°' + n.toString().padStart(6, '0')`.

---

## 2. `ReceiptModal` print button

Existing `ReceiptModal` in `modules/pos/components/POSModals.tsx` has only `Fermer` today.

### Change

Add a secondary-primary `Imprimer` button that opens a dedicated print view.

Because ReceiptModal is rendered inside the POS layout, `window.print()` from there would try to print the whole page with sidebar chrome. Two viable implementations; recommendation is (b):

**(a) Print stylesheet.** Add `@media print` CSS that hides everything except `[data-print-target="receipt"]`. Minimal new code; brittle when layout changes.

**(b) Dedicated print route/window.** Clicking `Imprimer` opens `/pos/historique/:id/print` in a new tab. The print route renders only the receipt + calls `window.print()` on mount. Cleaner, survives layout changes, enables "Ctrl+P then close tab" workflow.

**Recommendation: (b).** One new route `/pos/historique/:id/print`, one new small page component that renders the same content `ReceiptModal` already renders, plus auto-`window.print()` on mount. The `Imprimer` button in ReceiptModal opens that route in a new tab.

Route guard: must check that the signed-in user has access to the tx's salon (RLS already enforces this on the query).

---

## 3. `TransactionSuccessModal`

### Component

**New file:** `modules/pos/components/TransactionSuccessModal.tsx`

```ts
interface TransactionSuccessModalProps {
  tx: Transaction | null;          // null = hidden
  onClose: () => void;             // backdrop (desktop) / Escape / X / "Nouvelle vente"
  onOpenReceipt: (tx: Transaction) => void;
}
```

Portaled to `document.body` (matching `PaymentModal`, `RefundModal`, `VoidModal`).

### Data flow — hydrated tx snapshot

The summary reads **entirely from a server-hydrated `Transaction` snapshot**, not from the in-memory cart (which is cleared immediately after the mutation).

1. `processTransaction()` in `modules/pos/hooks/usePOS.ts` awaits the create mutation.
2. Create mutation (`hooks/useTransactions.ts`) is reworked:
   - POST RPC → receive the new `id: UUID`.
   - Follow with a `rawSelect` (via `lib/supabaseRaw.rawSelect`, per project memory on SDK wedge) using the returned `id`, requesting `*, client:clients(name), created_by_profile:profiles!transactions_created_by_fkey(first_name,last_name), transaction_items(*), transaction_payments(*)`. The selected `*` includes `ticket_number`.
   - Map through `toTransaction()`.
   - Resolve the mutation with the full `Transaction`.
3. `processTransaction()` returns that `Transaction` to the caller.
4. `POSModule.tsx` sets `successTx` to that Transaction.
5. The modal renders from `successTx` alone; cart state is irrelevant by this point.

No extra queries on the modal side.

### State in POSModule

```ts
const [successTx, setSuccessTx] = useState<Transaction | null>(null);
```

`handleCompletePayment`:

```ts
const tx = await processTransaction(payments);
setShowPaymentModal(false);
setSuccessTx(tx);
```

Gate reopening PaymentModal on `successTx === null` — prevents modal-stacking if the user somehow triggers another checkout while the success modal is open.

### Close paths

Every close handler calls `setSuccessTx(null)`:

- Backdrop click (**desktop only** — mobile is fullscreen, no backdrop).
- `Escape`.
- `X` icon.
- `Nouvelle vente` button.
- `Voir le reçu`: closes + calls `onOpenReceipt(tx)`.
- `Voir l'historique`: **closes first, then** `navigate('/pos/historique')` (order matters — prevents painting the modal during route transition).

### Receipt handoff (standalone snapshot)

`onOpenReceipt(tx)` sets an existing `receiptTransaction` state already owned by `POSModule.tsx:90`, which `POSModals.tsx` consumes. `ReceiptModal` uses `allTransactions` for prev/next; at success-open time the just-created tx will not yet appear in that list (cache invalidation is async). Mitigation: render prev/next links **only when** the opened tx is present in `allTransactions`. When absent (freshly created), hide those controls for this open. Spec requires a small guard in `ReceiptModal` around the prev/next render.

---

## Visual design (success modal)

Compact, one-line summary per design review D3.

```
                                              [ X ]
         ✓ Ticket n°000042 enregistré

    60,00 € · 3 articles · Espèces + Carte
             Fatima Zahraoui                   ← only if client present

        [ Voir le reçu ]        (primary, full width)
        [ Voir l'historique ]   (secondary)
        [ Nouvelle vente ]      (ghost)
```

- Headline: green `CheckCircle` (to match existing POS icon vocabulary — `PaymentModal` uses `CheckCircle`, not `CheckCircle2`).
- Info line uses middle dots (`·`) as separators.
- Payment methods shortened via the existing `PAYMENT_METHOD_SHORT` map at [TransactionHistoryPage.tsx:254-258](modules/pos/TransactionHistoryPage.tsx#L254-L258) — lifted to a shared constant at `modules/pos/constants.ts` so both files import it.
- Articles count = sum of `quantity` across `tx.items` (e.g. 2× shampoo + 1× soin → `3 articles`).
- Total via existing `formatPrice()` from `lib/format.ts`.
- Timestamp is *not* in the compact summary — it's in the receipt.
- Client: full name if present (app convention — no abbreviation).
- Cashier ("Encaissé par"): dropped from the compact summary; still visible on the full receipt.

### Dismissibility

- Desktop: backdrop click, `Escape`, `X`, `Nouvelle vente`.
- Mobile: `Escape`, `X`, `Nouvelle vente` (no backdrop — modal is fullscreen).
- No auto-dismiss.

---

## Responsive behavior

Matches existing POS modals.

### Mobile (< lg)

- Fullscreen sheet, `fixed inset-0`, portal to `document.body`.
- Body scroll locked; safe-area insets respected on the bottom button group.
- Slide-up entry animation consistent with `PaymentModal` / `CartBottomSheet`.
- 3 buttons stacked full-width, 44 px min touch targets.
- Content fits without scrolling on 360 × 640 (one-line summary + 3 buttons + header = small footprint).

### Desktop (≥ lg)

- Centered card, `max-w-md` (~28 rem), `rounded-xl`.
- Backdrop `bg-black/60 backdrop-blur-sm`.
- 3 buttons stacked (primary on top, two secondaries below) — 3 buttons don't need a grid.

### A11y

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="tx-success-heading"`.
- `aria-live="polite"` on the headline so screen readers announce "Ticket n°000042 enregistré" on appear.
- Initial focus on the primary **Voir le reçu** button.
- **Focus trap**: implemented directly in the component (3 tabbable elements — simple loop). Do **not** claim reuse of `useMobileModalA11y` — that hook is file-local to `POSModals.tsx`, mobile-only, and only handles body-scroll-lock + Escape (not a focus trap). If shared a11y plumbing is desired later, extract to `hooks/useModalA11y.ts`; out of scope for this feature.

---

## Error handling

- Failure path unchanged: `toastOnError('Impossible de créer la transaction')` from `useTransactions`. No success modal opens. Cart is **not** cleared on failure (current behavior preserved).
- If the hydration `rawSelect` fails after the RPC succeeds (unlikely: same-session query right after insert), toast `'Transaction enregistrée'` as a plain success toast and skip opening the modal. One narrow fallback path, clearly scoped to a specific failure.
- No "defense-in-depth null-tx" fallback — that was spec-v1 cruft, removed.

---

## Testing

- **Unit:** mapper updates for `ticketNumber` (extend `mappers.test.ts`). Concurrency test for counter: `pgTAP`-style in the migration file, or a manual SQL note.
- **Manual test plan:**
  1. Single cash sale → modal shows `Ticket n°<next>`, `X,00 € · 1 article · Espèces`, no client row.
  2. Split cash + card, linked client → shows `... · Espèces + Carte` and client full name on second line.
  3. Two parallel sales in the same salon (two tabs) → both get sequential, non-colliding ticket numbers.
  4. Each button path: Voir le reçu opens ReceiptModal; ReceiptModal's new `Imprimer` opens a new tab that auto-opens the print dialog; Voir l'historique lands on `/pos/historique`; Nouvelle vente closes back to empty POS.
  5. Escape / X / backdrop (desktop) close modal, cart stays empty.
  6. Mobile (360 × 640): everything fits without scroll; buttons thumb-reachable.
  7. Screen reader: "Ticket n°000042 enregistré" announced on open.
  8. Create a transaction in a fresh salon (no rows yet) → ticket number is 1, counter seeded.
  9. Existing salons after migration: highest pre-migration ticket number = N; next new transaction = N+1.

---

## File changes

### New files

- `supabase/migrations/<next>_add_ticket_number.sql` — schema + backfill + `create_transaction` RPC update.
- `modules/pos/components/TransactionSuccessModal.tsx` — the success modal.
- `modules/pos/ReceiptPrintPage.tsx` — dedicated print route, auto-`window.print()` on mount.

### Modified files

- `types.ts` — `Transaction` gains `ticketNumber: number`.
- `modules/pos/mappers.ts` — `toTransaction` reads `ticket_number`.
- `modules/pos/mappers.test.ts` — cover `ticketNumber`.
- `modules/pos/constants.ts` — export `PAYMENT_METHOD_SHORT` (lifted from `TransactionHistoryPage`).
- `modules/pos/TransactionHistoryPage.tsx` — import shared `PAYMENT_METHOD_SHORT`; add `N°` column.
- `hooks/useTransactions.ts` — create mutation: parse RPC return, run hydrated `rawSelect`, resolve with full `Transaction`.
- `modules/pos/hooks/usePOS.ts` — `processTransaction()` returns the hydrated `Transaction`.
- `modules/pos/POSModule.tsx` — `successTx` state, render `<TransactionSuccessModal>`, wire `onOpenReceipt` into existing receipt state; gate PaymentModal reopen on `successTx === null`.
- `modules/pos/components/POSModals.tsx` — ReceiptModal: add `Imprimer` button opening the print route; guard prev/next controls when the opened tx isn't in `allTransactions`.
- `lib/format.ts` — add `formatTicketNumber(n)`.
- `App.tsx` — register `/pos/historique/:id/print` route.

### No changes

- `transaction_items`, `transaction_payments`, RLS policies (beyond the new counter table).
- Refund / void flows.
- `PaymentModal.tsx` internals (aside from the reopen-gate check already in POSModule).

---

## Open risks

- **Backfill correctness on large salons.** If any salon has millions of transactions, the `ROW_NUMBER() OVER(...)` window is fine but the `ALTER COLUMN ... SET NOT NULL` takes an ACCESS EXCLUSIVE lock. Should be quick on a well-indexed table; monitor. Acceptable for current scale.
- **Print route auth.** The print page loads the tx via the same authenticated Supabase client as the rest of the app. If the user opens the link in a truly anonymous tab, RLS denies — that's correct behavior.
- **Ticket-number rollover.** `BIGINT` headroom is 9.2 × 10^18. Not a real risk.
