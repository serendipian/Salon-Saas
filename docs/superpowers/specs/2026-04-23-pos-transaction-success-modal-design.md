# POS Post-Sale Receipt — Design (v3)

**Date:** 2026-04-23
**Revision:** v3 — drop the separate success modal. Open the existing `ReceiptModal` directly on transaction success, extended with post-sale action buttons. This matches how real POS systems (Square, Shopify, Lightspeed) handle post-sale UX and removes a redundant preview modal.
**Goal:** After a successful transaction creation in POS, open the receipt with a small success affordance and three post-sale actions (Imprimer / Voir l'historique / Nouvelle vente), so the cashier can print or move on in one click.

---

## Motivation

Completing a payment today closes `PaymentModal` and clears the cart silently. Cashiers get no confirmation, no path to print, no direct path back into work. Rather than introducing a new "success" modal that previews info already on the receipt, the receipt itself becomes the post-sale surface — faster, fewer clicks, and aligned with industry-standard POS flows.

## Non-Goals

- No changes to refund / void flows.
- No auto-dismiss on the receipt.
- No email/SMS receipt delivery (out of scope).
- No new standalone success modal. The `ReceiptModal` takes on a post-sale mode instead.

## In scope (three coupled deliverables)

1. **Sequential per-salon ticket numbers** (new schema) — prerequisite for a human-readable ticket display.
2. **`ReceiptModal` gains a post-sale mode** — success banner + three action buttons; history mode unchanged except gaining `Imprimer`.
3. **Dedicated print route `/pos/historique/:id/print`** — enables the new `Imprimer` button and "Ctrl+P then close tab" workflow.

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

Unique index:

```sql
CREATE UNIQUE INDEX transactions_ticket_number_per_salon
  ON transactions (salon_id, ticket_number)
  WHERE ticket_number IS NOT NULL;
```

### Reset policy

**Never resets.** Monotonically increasing per salon, forever. Tax-friendly and simplest.

### Assignment — atomic, concurrency-safe

Done inside `create_transaction` (existing `SECURITY DEFINER` RPC). Row-level lock via `UPDATE ... RETURNING`:

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

Concurrent calls in the same salon serialize on the counter row. Different salons don't contend.

### Backfill

One-time, deterministic ordering by `created_at, id`:

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

`create_transaction` keeps `RETURNS UUID`. `ticket_number` is read client-side via the hydration `rawSelect` (§3).

### Frontend type + mapper

- `types.ts`: `Transaction` gains `ticketNumber: number`.
- `modules/pos/mappers.ts:toTransaction` reads `ticket_number`.

### Display updates (consistency)

Ticket number shown wherever a short ID is shown today:

- `ReceiptModal` header: `Ticket n°000042`.
- `TransactionDetailModal` title: same.
- `TransactionHistoryPage`: new `N°` column (sortable), placed before date on desktop, inline on mobile row.

Add `formatTicketNumber(n: number): string` to `lib/format.ts` → `'n°' + n.toString().padStart(6, '0')`.

---

## 2. `ReceiptModal` — post-sale mode

### Current state

`ReceiptModal` lives in `modules/pos/components/POSModals.tsx`. It renders the formal receipt (header, items, VAT, total, payments, change) plus prev/next tx navigation, and a single `Fermer` button.

### New props

```ts
interface ReceiptModalProps {
  tx: Transaction | null;
  allTransactions: Transaction[];
  onClose: () => void;
  // Post-sale extras (all optional):
  postSale?: boolean;              // true when opened from the POS success path
  onNewSale?: () => void;          // "Nouvelle vente" (required when postSale=true)
  onViewHistory?: () => void;      // "Voir l'historique" (required when postSale=true)
}
```

### Behavior

**History mode** (`postSale` omitted/false — existing call sites):
- Header: `Ticket n°000042` (was `#<UUID>`).
- Footer buttons: `[ Imprimer ]  [ Fermer ]`.
- Prev/next controls as today.

**Post-sale mode** (`postSale = true`):
- Small green banner at the very top, inside the modal body:
  `✓ Transaction enregistrée`
  `aria-live="polite"` so screen readers announce it. Banner uses `bg-emerald-50 text-emerald-700`, `lucide-react` `CheckCircle` icon.
- Header: `Ticket n°000042` (same as history mode).
- Prev/next controls **hidden** (the just-created tx won't be in `allTransactions` yet — cache invalidation is async; controls aren't useful anyway for a brand-new sale).
- Footer buttons, in order: `[ Imprimer ]  (primary)  [ Voir l'historique ]  [ Nouvelle vente ]`.
- Dismissal: `Escape`, `X`, backdrop (desktop only), or `Nouvelle vente` all fire `onClose()`. Backdrop on mobile is a no-op (fullscreen).

### The `Imprimer` button (both modes)

Opens the print route (§3) in a new browser tab: `window.open('/pos/historique/<id>/print', '_blank', 'noopener,noreferrer')`. Does not close the receipt modal — cashier can come back to it if needed.

### Action wiring

- `onNewSale` → `setReceiptTransaction(null); setIsPostSale(false);` — cart is already empty, user stays on POS.
- `onViewHistory` → close first (`setReceiptTransaction(null); setIsPostSale(false);`), then `navigate('/pos/historique')`. Order matters (prevent painting modal during route transition).

---

## 3. Dedicated print route

### Route

`/pos/historique/:id/print` — registered in `App.tsx`. Protected by the same auth/salon guard as the rest of the app (RLS on the query enforces salon scope).

### Page component

`modules/pos/ReceiptPrintPage.tsx`:

- Fetches the transaction by id via a hydrated `rawSelect` (same joins as §3 hydration).
- Renders the same receipt body that `ReceiptModal` renders — factored into a shared presentational component `ReceiptBody` (extracted from `POSModals.tsx`) so both places stay in sync.
- No chrome: no sidebar, no topbar, no tab bar. Just the receipt on a white page.
- Calls `window.print()` in a `useEffect` on mount, after the data loads and renders.
- After `onafterprint`, does nothing (cashier closes the tab).

### CSS

A small `@media print` block hides the browser-default margins and forces the receipt to fill the page. No page-wide print stylesheet needed — the print page has no chrome to hide.

---

## 4. Data flow — hydrated tx snapshot

The receipt in post-sale mode reads entirely from a server-hydrated `Transaction`, not from the cart (which is cleared immediately after the mutation).

1. `processTransaction()` in `modules/pos/hooks/usePOS.ts` awaits the create mutation.
2. Create mutation (`hooks/useTransactions.ts`) is reworked:
   - POST RPC → receive `id: UUID`.
   - Follow with `rawSelect` (via `lib/supabaseRaw.rawSelect`, per project memory on SDK wedge) using the returned `id`, requesting `*, client:clients(name), created_by_profile:profiles!transactions_created_by_fkey(first_name,last_name), transaction_items(*), transaction_payments(*)`. `*` includes `ticket_number`.
   - Map through `toTransaction()`.
   - Resolve the mutation with the full `Transaction`.
3. `processTransaction()` returns that `Transaction`.
4. `POSModule.tsx` sets `receiptTransaction` + `isPostSale = true`.
5. Receipt renders from `receiptTransaction` alone; cart/client state irrelevant.

No extra queries on the modal side (re-using the hydrated tx returned by the mutation).

### State in `POSModule`

`receiptTransaction: Transaction | null` already exists (`POSModule.tsx:90`). Add:

```ts
const [isPostSale, setIsPostSale] = useState(false);
```

`handleCompletePayment`:

```ts
const tx = await processTransaction(payments);
setShowPaymentModal(false);
setReceiptTransaction(tx);
setIsPostSale(true);
```

Every close/action path also resets `setIsPostSale(false)`.

### Gate against modal-stacking

Guard reopening `PaymentModal` on `receiptTransaction === null`. If the receipt is open, the "Encaissement" button is disabled. Prevents stacking.

---

## Error handling

- Failure path unchanged: `toastOnError('Impossible de créer la transaction')`. Cart preserved, receipt does not open.
- If the hydration `rawSelect` fails after the RPC succeeds (rare), toast `'Transaction enregistrée'` and skip opening the receipt. Narrow fallback.

---

## A11y

- Banner has `role="status"` and `aria-live="polite"` so "Transaction enregistrée" is announced on appearance.
- Modal keeps `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the ticket-number heading.
- Initial focus on `Imprimer` (primary action) in post-sale mode; on `Fermer` in history mode.
- Focus trap implemented inline in `ReceiptModal`. (Existing `useMobileModalA11y` is file-local, mobile-only, and only handles body-scroll-lock + Escape — not a focus trap.)

---

## Responsive behavior

Matches existing POS modal patterns.

### Mobile (< lg)

- Fullscreen sheet (current `ReceiptModal` pattern preserved).
- Body scroll locked; safe-area insets respected.
- Footer buttons stacked full-width, 44 px min touch targets, safe-area padding at the bottom so none are hidden under `BottomTabBar` + home indicator.
- Success banner sits at the top; content scrolls under it if long.

### Desktop (≥ lg)

- Centered card, `max-w-lg` (same as current `ReceiptModal`).
- Backdrop `bg-black/60 backdrop-blur-sm`; clicking backdrop closes.
- Footer: `Imprimer` full-width primary on top, two secondaries below in a two-column grid.

---

## Consistency changes in other places

- `TransactionHistoryPage.tsx`: `Imprimer` column/button now navigates to the print route instead of whatever it does today (verify current behavior; if already using `window.print()` with a print stylesheet, migrate to the route for consistency).
- `TransactionDetailModal` title adopts `formatTicketNumber`.
- `PAYMENT_METHOD_SHORT` lifted from `TransactionHistoryPage.tsx:254-258` into `modules/pos/constants.ts` and imported by both places.

---

## Testing

- **Unit:** mapper updates for `ticketNumber` (extend `mappers.test.ts`).
- **Manual test plan:**
  1. Cash sale → receipt opens in post-sale mode, green banner visible, header shows `Ticket n°<next>`, footer has Imprimer / Voir l'historique / Nouvelle vente, no prev/next.
  2. Click `Imprimer` → new tab opens at `/pos/historique/<id>/print`, print dialog appears, original receipt modal stays open in the POS tab.
  3. Click `Voir l'historique` → modal closes, route is `/pos/historique`.
  4. Click `Nouvelle vente` (or backdrop on desktop, or Escape, or X) → modal closes, cart empty, POS ready for next sale.
  5. Open a receipt from TransactionHistoryPage → post-sale mode OFF: no green banner, footer is Imprimer / Fermer, prev/next shown.
  6. Two parallel sales in the same salon (two tabs) → sequential, non-colliding ticket numbers.
  7. Fresh salon (no prior sales) → ticket number is 1; counter seeded.
  8. Existing salons after migration: highest pre-migration ticket number = N; next new sale = N+1.
  9. Mobile 360×640: banner + ticket number + items + footer buttons all reachable, button area above safe-area/home indicator.
  10. Screen reader: `Transaction enregistrée` announced when receipt opens in post-sale mode.
  11. Print route opened in anonymous tab → RLS denial, clean error state (user's expected fallback).

---

## File changes

### New files

- `supabase/migrations/<next>_add_ticket_number.sql` — schema + backfill + `create_transaction` RPC update.
- `modules/pos/ReceiptPrintPage.tsx` — dedicated print route, auto-`window.print()` on mount.
- `modules/pos/components/ReceiptBody.tsx` — shared receipt layout factored out of `POSModals.tsx` so `ReceiptModal` and `ReceiptPrintPage` both render the same thing.

### Modified files

- `types.ts` — `Transaction` gains `ticketNumber: number`.
- `modules/pos/mappers.ts` — `toTransaction` reads `ticket_number`.
- `modules/pos/mappers.test.ts` — cover `ticketNumber`.
- `modules/pos/constants.ts` — export `PAYMENT_METHOD_SHORT`.
- `modules/pos/TransactionHistoryPage.tsx` — import shared `PAYMENT_METHOD_SHORT`; add `N°` column; Imprimer action navigates to print route.
- `hooks/useTransactions.ts` — create mutation: parse RPC return, run hydrated `rawSelect`, resolve with full `Transaction`.
- `modules/pos/hooks/usePOS.ts` — `processTransaction()` returns the hydrated `Transaction`.
- `modules/pos/POSModule.tsx` — add `isPostSale` state; on success set `receiptTransaction` + `isPostSale=true`; pass props to `POSModals`; wire `onNewSale` / `onViewHistory`; gate PaymentModal reopen.
- `modules/pos/components/POSModals.tsx` — `ReceiptModal` gains `postSale`, `onNewSale`, `onViewHistory` props + banner + reworked footer; delegates layout to new `ReceiptBody`. Header uses `formatTicketNumber`. `TransactionDetailModal` title adopts `formatTicketNumber`.
- `lib/format.ts` — add `formatTicketNumber`.
- `App.tsx` — register `/pos/historique/:id/print` route.

### No changes

- `transaction_items`, `transaction_payments`, RLS policies (beyond the new counter table).
- Refund / void flows.
- `PaymentModal.tsx` internals (POSModule handles the reopen gate).

### Dropped from v2

- `TransactionSuccessModal.tsx` — not built. Receipt is the success surface.

---

## Open risks

- **Backfill lock.** `ALTER COLUMN ... SET NOT NULL` takes an ACCESS EXCLUSIVE lock. Fast on current scale; monitor if the table ever grows into millions of rows.
- **Print route auth.** Uses the standard authenticated Supabase client. Anonymous tab → RLS denies (expected).
- **`BIGINT` rollover** — irrelevant.
- **Cross-tab print.** If the cashier opens the print tab and doesn't close it, they accumulate tabs. Acceptable; browsers handle this fine and a typical shift closes them.
- **Mobile print.** `window.open('_blank')` behavior varies on iOS Safari and inside PWAs. If installed as a PWA, the new tab may not open or may break out of the standalone window. In practice many salon POS setups use a dedicated thermal printer driven from a desktop/tablet anyway, so the new-tab flow targets the common case. If mobile print turns out to matter, a future refinement is same-tab navigation (push/replace) to the print route and a back button, but that adds friction on desktop — skipped for v1.
