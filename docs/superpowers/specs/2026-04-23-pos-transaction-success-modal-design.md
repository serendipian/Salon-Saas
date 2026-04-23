# POS Post-Sale Confirmation — Design (v4)

**Date:** 2026-04-23
**Revision:** v4 — aligns with industry POS practice (Square, Shopify POS, Lightspeed, Clover). Post-sale surface is a **lightweight confirmation modal with peer action buttons**, not a full rendered receipt. Full itemization stays in the existing `ReceiptModal`, reachable via a `Voir le reçu` button. Corrects v3's assumption that the receipt is the success state.
**Goal:** After a successful transaction, show a compact confirmation with the ticket number, total, and peer actions (Imprimer / Voir le reçu / Voir l'historique / Nouvelle vente). Matches how Square, Lightspeed, and Clover handle post-sale UX, adapted to the current salon feature set.

---

## Motivation

The cashier today gets no confirmation, no print path, and no navigation hooks after a sale — cart clears silently. Industry POS practice for this surface is well-established: a **slim confirmation screen** with receipt-delivery options as peer buttons, a manual "New Sale" to continue, and total/tender visible but itemization deferred to the emitted receipt. This design follows that pattern.

## Non-Goals

- No changes to refund / void flows.
- No auto-dismiss on the modal.
- No email/SMS receipt delivery (out of scope — easy to add later as additional peer buttons).
- No changes to `PaymentModal` itself.

## In scope (three coupled deliverables)

1. **Sequential per-salon ticket numbers** — schema + backfill + concurrency-safe assignment. Prerequisite for a human-readable ticket display.
2. **`TransactionSuccessModal`** — the new lightweight post-sale confirmation, opened automatically on sale success.
3. **Dedicated print route `/pos/historique/:id/print`** — powers the one-tap `Imprimer` button, reused across the success modal, the `ReceiptModal`, and the `TransactionHistoryPage` row action.

Implementation ordering likely: 1 → 3 → 2.

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

Unique index to enforce monotonicity:

```sql
CREATE UNIQUE INDEX transactions_ticket_number_per_salon
  ON transactions (salon_id, ticket_number)
  WHERE ticket_number IS NOT NULL;
```

### Reset policy

**Never resets.** Monotonically increasing per salon. Tax-friendly and simplest.

### Assignment — atomic, concurrency-safe

Inside `create_transaction` (existing `SECURITY DEFINER` RPC):

```sql
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

`UPDATE ... RETURNING` locks the counter row — concurrent calls in the same salon serialize; different salons don't contend.

### Backfill

One-time, deterministic ordering by `(created_at, id)`:

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

### RPC signature

`create_transaction` keeps `RETURNS UUID`. Frontend reads `ticket_number` via the hydration `rawSelect` (§4).

### Frontend type + mapper

- `types.ts`: `Transaction` gains `ticketNumber: number`.
- `modules/pos/mappers.ts:toTransaction` reads `ticket_number`.

### Display updates (consistency)

- `ReceiptModal` header: `Ticket n°000042`.
- `TransactionDetailModal` title: same.
- `TransactionHistoryPage`: new `N°` column (sortable), placed before date on desktop, inline on mobile row.
- `TransactionSuccessModal`: prominent in the success layout.

Add `formatTicketNumber(n: number): string` to `lib/format.ts` → `'n°' + n.toString().padStart(6, '0')`.

---

## 2. `TransactionSuccessModal`

### Component

**New file:** `modules/pos/components/TransactionSuccessModal.tsx`

```ts
interface TransactionSuccessModalProps {
  tx: Transaction | null;          // null = hidden
  onClose: () => void;             // backdrop (desktop) / Escape / X / "Nouvelle vente"
  onOpenReceipt: (tx: Transaction) => void;
  onViewHistory: () => void;
}
```

Portaled to `document.body` (matching `PaymentModal`, `RefundModal`, `VoidModal`).

### Layout

```
                                              [ X ]

              ✓ Transaction enregistrée        ← green CheckCircle, aria-live

                  Ticket n°000042               ← monospaced, large
                      60,00 €                   ← headline total, extra large

          1 article · Espèces + Carte           ← compact sub-summary
              Fatima Zahraoui                    ← only if client present

              [ Imprimer ]         (primary, full width)
              [ Voir le reçu ]     (secondary)
              [ Voir l'historique ](secondary)
              [ Nouvelle vente ]   (ghost)
```

Details:

- Icon: green `CheckCircle` from `lucide-react` (matches icon vocabulary used in `PaymentModal`).
- Ticket number rendered via `formatTicketNumber` → `n°000042`, monospaced.
- Total: `formatPrice(tx.total)`. Rendered large — this is the single most important piece of info.
- Sub-summary line: `<sum-of-qty> article(s) · <payment methods, comma-joined>`. Payment method labels via `PAYMENT_METHOD_SHORT` (e.g. `Espèces + Carte`).
- Client row (optional): full `tx.clientName` as stored — no abbreviation. Hidden when null.
- No timestamp, no cashier name in the compact view — those live in the full receipt.
- Headline announces via `aria-live="polite"` so screen readers say "Transaction enregistrée, Ticket n°000042, 60 euros".

### Button order and behavior

Top-to-bottom on mobile (primary → ghost), two-column on desktop (`Imprimer` full-width on top, three secondaries in a grid below).

| Label | Role | Behavior |
|---|---|---|
| **Imprimer** | Primary | `window.open('/pos/historique/<tx.id>/print', '_blank', 'noopener,noreferrer')`. Does **not** close the modal — cashier can print, then tap Nouvelle vente or close. Matches Square's "All Done" pattern. |
| **Voir le reçu** | Secondary | `onClose()` then `onOpenReceipt(tx)` — closes this modal and opens the existing `ReceiptModal` with the just-created tx. |
| **Voir l'historique** | Secondary | `onClose()` then `onViewHistory()` (which calls `navigate('/pos/historique')` in POSModule). Close-before-navigate to avoid painting the modal during route transition. |
| **Nouvelle vente** | Ghost | `onClose()` only. Cashier lands on empty POS (cart already cleared by `processTransaction`). |

### Dismissibility

- Desktop: backdrop click, `Escape`, `X` icon, `Nouvelle vente` button — all fire `onClose`.
- Mobile: `Escape`, `X`, `Nouvelle vente` (no backdrop — modal is fullscreen).
- No auto-dismiss. Cashier dismisses manually (matches Square, Lightspeed, Clover defaults).

---

## 3. Dedicated print route

### Route

`/pos/historique/:id/print` — registered in `App.tsx`. Uses the same authenticated Supabase client as the rest of the app; RLS enforces salon scope.

### Page component

`modules/pos/ReceiptPrintPage.tsx`:

- Fetches the transaction by id via a hydrated `rawSelect` (same joins as §4).
- Renders the same content that `ReceiptModal` renders — factored into a shared presentational component `ReceiptBody` (extracted from `POSModals.tsx`) so both stay in sync.
- No app chrome: no sidebar, no topbar, no tab bar. Just the receipt on a white page.
- Calls `window.print()` in a `useEffect` on mount, after the data loads and renders.
- No post-print behavior — cashier closes the tab.

### CSS

A small `@media print` block clears default page margins. No app-wide print stylesheet needed.

### Consumers of this route

Three entry points, all converging on the same URL:

1. `TransactionSuccessModal` → `Imprimer` button.
2. `ReceiptModal` → new `Imprimer` button (replaces the current single `Fermer` with `[ Imprimer ] [ Fermer ]`).
3. `TransactionHistoryPage` → existing Imprimer row action migrates to this route for consistency.

---

## 4. Data flow — hydrated tx snapshot

The success modal reads entirely from a server-hydrated `Transaction` snapshot (not from the cart, which is cleared immediately after the mutation).

1. `processTransaction()` in `modules/pos/hooks/usePOS.ts` awaits the create mutation.
2. Create mutation (`hooks/useTransactions.ts`) is reworked:
   - POST RPC → receive `id: UUID`.
   - Follow with `rawSelect` (via `lib/supabaseRaw.rawSelect`, per project memory on SDK wedge) using the returned `id`, requesting `*, client:clients(name), created_by_profile:profiles!transactions_created_by_fkey(first_name,last_name), transaction_items(*), transaction_payments(*)`. `*` includes `ticket_number`.
   - Map through `toTransaction()`.
   - Resolve the mutation with the full `Transaction`.
3. `processTransaction()` returns that `Transaction`.
4. `POSModule.tsx` sets `successTx = tx`.
5. `TransactionSuccessModal` renders from `successTx` alone.

No extra queries on the modal side.

### State in `POSModule`

```ts
const [successTx, setSuccessTx] = useState<Transaction | null>(null);
```

`handleCompletePayment`:

```ts
const tx = await processTransaction(payments);
setShowPaymentModal(false);
setSuccessTx(tx);
```

Guard: don't reopen `PaymentModal` while `successTx !== null` — disables the checkout button for the brief time the success modal is visible. Prevents modal stacking.

### Receipt handoff via `onOpenReceipt`

Wires into the existing `receiptTransaction` state at `POSModule.tsx:90`. The `onOpenReceipt` callback closes the success modal (`setSuccessTx(null)`) and then sets `receiptTransaction` — both modals are never visible simultaneously.

Because the just-created tx won't yet be in `allTransactions` (invalidation is async), `ReceiptModal` must **hide its prev/next controls when the opened tx is not in `allTransactions`**. Small guard in the component.

---

## 5. Error handling

- Failure path unchanged: `toastOnError('Impossible de créer la transaction')`. Cart preserved, success modal does not open.
- If the hydration `rawSelect` fails after the RPC succeeds (rare), toast `'Transaction enregistrée'` as plain success toast and skip opening the modal. Narrow fallback.

---

## 6. A11y

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="tx-success-heading"`.
- `aria-live="polite"` on the headline so screen readers announce "Transaction enregistrée, Ticket n°000042, 60 euros" on open.
- Initial focus on the primary `Imprimer` button.
- Focus trap implemented inline in the component (4 tabbable buttons + X — simple loop). Do **not** claim reuse of `useMobileModalA11y` — that hook is file-local to `POSModals.tsx`, mobile-only, and only handles body-scroll-lock + Escape, not a focus trap. If a shared focus-trap hook is desired later, extract to `hooks/useModalA11y.ts`; out of scope for this feature.

---

## 7. Responsive behavior

### Mobile (< lg)

- Fullscreen sheet, `fixed inset-0`, portal to `document.body`.
- Body scroll locked; safe-area insets respected at the bottom.
- Slide-up entry animation consistent with `PaymentModal` / `CartBottomSheet`.
- 4 buttons stacked full-width, 44 px min touch targets, safe-area padding at the bottom so none are hidden under `BottomTabBar` + home indicator.
- Content fits 360×640 without scrolling (headline + ticket# + total + 1 summary line + 4 buttons = small footprint).

### Desktop (≥ lg)

- Centered card, `max-w-md` (~28 rem), `rounded-xl`.
- Backdrop `bg-black/60 backdrop-blur-sm`; clicking backdrop closes.
- Footer: `Imprimer` full-width primary on top, three secondaries in a 3-column grid below.

---

## 8. Consistency changes in other places

- `PAYMENT_METHOD_SHORT` lifted from `TransactionHistoryPage.tsx:254-258` into `modules/pos/constants.ts` and imported by both places.
- `ReceiptModal` in `POSModals.tsx` gains an `Imprimer` button alongside `Fermer`, and renders via the new `ReceiptBody` sub-component.
- `ReceiptModal` header uses `formatTicketNumber` instead of short-UUID.
- `TransactionDetailModal` title adopts `formatTicketNumber`.
- `TransactionHistoryPage`: row-action `Imprimer` navigates to the print route (migrating from whatever it does today, for consistency).

---

## 9. Testing

- **Unit:** mapper updates for `ticketNumber` (extend `mappers.test.ts`).
- **Manual test plan:**
  1. Cash sale → success modal opens with `Ticket n°<next>`, headline total, `1 article · Espèces`, no client row. Focus on Imprimer.
  2. Split cash + card, linked client → sub-summary shows `... · Espèces + Carte`, client full name on its own line.
  3. Click `Imprimer` → new tab opens at `/pos/historique/<id>/print`, print dialog appears, success modal still visible in POS tab.
  4. Click `Voir le reçu` → success modal closes, `ReceiptModal` opens with the same tx, prev/next hidden (tx not yet in allTransactions).
  5. Close `ReceiptModal` → back to POS, empty cart.
  6. Click `Voir l'historique` on the success modal → modal closes, route `/pos/historique`.
  7. Click `Nouvelle vente` (or backdrop on desktop, or Escape, or X) → modal closes, cart empty, POS ready.
  8. Two parallel sales in the same salon (two tabs) → sequential, non-colliding ticket numbers.
  9. Fresh salon (no prior sales) → first ticket is 1, counter seeded.
  10. Existing salons after migration: highest pre-migration ticket = N; next new sale = N+1.
  11. Mobile 360×640: modal fits without scroll, all 4 buttons thumb-reachable, above safe-area.
  12. Screen reader: `"Transaction enregistrée, Ticket n°000042, 60 euros"` announced on open.
  13. Open a receipt from TransactionHistoryPage → new `Imprimer` button present; clicking it opens the print route.
  14. Print route opened in anonymous tab → RLS denial, clean error state.

---

## 10. File changes

### New files

- `supabase/migrations/<next>_add_ticket_number.sql` — schema + backfill + `create_transaction` RPC update.
- `modules/pos/components/TransactionSuccessModal.tsx` — the post-sale confirmation.
- `modules/pos/ReceiptPrintPage.tsx` — dedicated print route, auto-`window.print()` on mount.
- `modules/pos/components/ReceiptBody.tsx` — shared receipt layout factored out of `POSModals.tsx` so `ReceiptModal` and `ReceiptPrintPage` render identical markup.

### Modified files

- `types.ts` — `Transaction` gains `ticketNumber: number`.
- `modules/pos/mappers.ts` — `toTransaction` reads `ticket_number`.
- `modules/pos/mappers.test.ts` — cover `ticketNumber`.
- `modules/pos/constants.ts` — export `PAYMENT_METHOD_SHORT`.
- `modules/pos/TransactionHistoryPage.tsx` — import shared `PAYMENT_METHOD_SHORT`; add `N°` column; row-action Imprimer navigates to print route.
- `hooks/useTransactions.ts` — create mutation: parse RPC return, run hydrated `rawSelect`, resolve with full `Transaction`.
- `modules/pos/hooks/usePOS.ts` — `processTransaction()` returns the hydrated `Transaction`.
- `modules/pos/POSModule.tsx` — add `successTx` state; on success `setSuccessTx(tx)`; render `<TransactionSuccessModal>`; wire `onOpenReceipt` into existing `receiptTransaction` state; wire `onViewHistory` to `navigate('/pos/historique')`; gate PaymentModal reopen on `successTx === null`.
- `modules/pos/components/POSModals.tsx` — `ReceiptModal`: footer gains `Imprimer` alongside `Fermer`; body delegates to new `ReceiptBody`; header uses `formatTicketNumber`; prev/next hidden when opened tx not in `allTransactions`. `TransactionDetailModal` title adopts `formatTicketNumber`.
- `lib/format.ts` — add `formatTicketNumber`.
- `App.tsx` — register `/pos/historique/:id/print` route.

### No changes

- `transaction_items`, `transaction_payments`, RLS policies (beyond the new counter table).
- Refund / void flows.
- `PaymentModal.tsx` internals (POSModule handles the reopen gate).

---

## 11. Open risks

- **Backfill lock.** `ALTER COLUMN ... SET NOT NULL` takes an ACCESS EXCLUSIVE lock on `transactions`. Fast on current scale; monitor if the table ever grows into millions of rows.
- **Mobile print.** `window.open('_blank')` behavior varies on iOS Safari and inside PWAs. If installed as a PWA the new tab may not open or may break out of the standalone window. In practice most salon POS deployments use a desktop or tablet with a dedicated thermal printer, so the new-tab pattern targets the common case. If mobile print matters in the future, revisit with same-tab navigation to the print route and a back button.
- **`BIGINT` rollover** — 9.2 × 10^18 headroom, irrelevant.
- **Cross-tab print.** Opening the print tab and not closing it accumulates tabs. Acceptable; typical browsers and shifts handle this fine.

---

## 12. Future work (out of scope for v4)

- **Email receipt** — adds an `[ Email ]` peer button on the success modal; requires an email-sending capability (SendGrid/Resend/etc.) and a customer-email field on clients or a direct entry field in the modal.
- **SMS receipt** — same shape, different channel.
- **"No receipt" quick-dismiss** — Toast's pattern of a prominent `[ Sans reçu ]` button that also advances to the next sale. Low priority for a salon where physical receipts remain common.
