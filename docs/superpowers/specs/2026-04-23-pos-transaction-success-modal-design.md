# POS Transaction Success Modal — Design

**Date:** 2026-04-23
**Scope:** Frontend-only. POS module.
**Goal:** After a successful transaction creation in POS, show a confirmation modal with a compact summary and navigation actions, replacing the current silent cart-clear.

---

## Motivation

Today, completing a payment in POS closes `PaymentModal` and clears the cart with no user-visible confirmation. Cashiers have no affirmation that the sale was recorded, no immediate way to review it, and no explicit "what's next" navigation. A success modal gives closure to the sale and a clear choice: view the receipt, review history, jump to the dashboard, or start the next ticket.

## Non-Goals

- No changes to the RPC (`create_transaction`), database schema, or RLS.
- No changes to the existing `ReceiptModal`. The new modal opens it unchanged.
- No changes to refund / void flows.
- No auto-dismiss / timeout behavior. The modal is manually dismissed.
- No print-triggering from the success modal directly (user goes through `ReceiptModal`).

---

## Architecture

### Component

**New file:** `modules/pos/components/TransactionSuccessModal.tsx`

Props:

```ts
interface TransactionSuccessModalProps {
  tx: Transaction | null;        // null = modal hidden
  onClose: () => void;           // backdrop / Escape / "Nouveau ticket" / X
  onOpenReceipt: (tx: Transaction) => void;
}
```

Rendered unconditionally from `POSModule.tsx`; when `tx` is `null` the component returns `null`. Portaled to `document.body` (same pattern as `PaymentModal`, `RefundModal`, `VoidModal`).

### State & trigger flow

1. `POSModule.tsx` gains `const [successTx, setSuccessTx] = useState<Transaction | null>(null);`
2. `handleCompletePayment` awaits `processTransaction(payments)` → receives the created `Transaction` → `setSuccessTx(tx)`.
3. Existing `clearCart()` still runs inside `processTransaction()`, so when the modal closes the user lands on an empty POS, ready for the next sale.
4. Every close path calls `setSuccessTx(null)`.

`processTransaction()` (in `modules/pos/hooks/usePOS.ts`) currently swallows the mutation result. Change: return the `Transaction` produced by the create mutation. One line.

`useTransactions.ts` create mutation already has the row to return (it inserts + reads back). Verify it resolves with the mapped `Transaction`; if it resolves with the DB row, map it through the existing `fromDbTransaction` before returning.

### Receipt handoff

`POSModule.tsx` already orchestrates modal state for receipt viewing via `POSModals.tsx`. The success modal's **"Voir le reçu"** button calls `onOpenReceipt(tx)` which, in `POSModule`, sets the existing "receipt transaction" state that `POSModals` consumes. The success modal closes itself as part of this action (both modals should not be visible simultaneously).

### Navigation actions

- `Voir l'historique` → `navigate('/pos/historique')` then close.
- `Tableau de bord` → `navigate('/dashboard')` then close.
- `Nouveau ticket` → close only. User stays on POS.

`useNavigate()` is imported from `react-router-dom`.

---

## Visual design

### Summary content (top → bottom)

| Row | Value | Notes |
|---|---|---|
| Headline | `✓ Transaction enregistrée` | Green `CheckCircle2` icon from `lucide-react` |
| N° de ticket | `#<first 8 chars of tx.id>` | Monospaced |
| Date | `23 avr. 2026, 15:42` | French locale, from `tx.date` |
| Articles | `3 article(s)` | Sum of `quantity` across `tx.items` (i.e. 2× shampoo + 1× soin → `3 article(s)`) |
| Total | `60,00 €` | From `tx.total`, French formatting via existing `formatPrice()` |
| Paiement | `Espèces 20,00 € · Carte 40,00 €` | Joined `tx.payments`, using French method labels |
| Encaissé par | `Sophia` | From `tx.createdByName`, hidden if absent |
| Client | `Fatima Z.` | From `tx.clientName`, hidden if absent |

No item-level detail (that belongs to `ReceiptModal`).

### Buttons

Order and style:

| Label | Variant | Action |
|---|---|---|
| Voir le reçu | Primary (blue-500) | `onOpenReceipt(tx)` → opens `ReceiptModal`, closes this modal |
| Voir l'historique | Secondary | `navigate('/pos/historique')`, close |
| Tableau de bord | Secondary | `navigate('/dashboard')`, close |
| Nouveau ticket | Ghost | Close only |

### Dismissibility

- Backdrop click → close (behaves as "Nouveau ticket")
- `Escape` → close
- Top-right `X` icon → close
- No auto-dismiss

---

## Responsive behavior

Reuses the existing POS modal pattern.

### Mobile (< lg)

- Fullscreen sheet, `inset-0`, portal to `document.body`.
- Body scroll locked while open.
- Buttons stacked full-width, minimum 44 px touch targets.
- Bottom padding respects `env(safe-area-inset-bottom)`.
- Slide-up entry animation (`animate-in slide-in-from-bottom`) — matches `PaymentModal` / `CartBottomSheet`.

### Desktop (≥ lg)

- Centered card, `max-w-md` (~28 rem), `rounded-xl`.
- Backdrop `bg-black/60 backdrop-blur-sm`.
- Buttons: primary full-width on top row, three secondaries in a 3-column grid below (or stacked if cramped at this width — design-time call).

### Focus & a11y

- Reuses `useMobileModalA11y` hook from `POSModals.tsx` for focus trap and Escape binding.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the "Transaction enregistrée" heading.
- Initial focus moves to the primary "Voir le reçu" button.

---

## Error handling

The modal is shown only after the create mutation resolves successfully. Failure path is unchanged: `useTransactions` already surfaces errors via `toastOnError('Impossible de créer la transaction')`, no modal opens, cart is not cleared.

If `processTransaction()` resolves with an unexpectedly null/undefined transaction (defensive check), fall through to the current silent behavior and toast `'Transaction créée'` so the user still gets feedback. This is a defense-in-depth path, not an expected flow.

---

## Testing

- **Unit:** none required. Component is presentational; logic is state transitions that the manual test plan covers.
- **Manual test plan:**
  1. Ring up a single-item cash sale → modal appears with matching total, items count = 1, payment = `Espèces`.
  2. Ring up a split-payment sale (cash + card) → `Paiement` row shows both.
  3. Ring up a sale on a linked client → `Client` row visible.
  4. Ring up a walk-in (no client) → `Client` row hidden.
  5. Click each of the four buttons → verify correct navigation + modal closes.
  6. Press Escape → modal closes, no navigation.
  7. Click backdrop → modal closes, no navigation.
  8. Mobile (DevTools responsive mode): fullscreen layout, buttons reachable with thumb, no overlap with bottom tab bar.
  9. After modal closes, cart is empty and POS is ready for the next sale.

---

## File changes (summary)

**New**

- `modules/pos/components/TransactionSuccessModal.tsx`

**Modified**

- `modules/pos/POSModule.tsx` — add `successTx` state, render modal, wire `onOpenReceipt` into existing receipt state.
- `modules/pos/hooks/usePOS.ts` — `processTransaction()` returns the created `Transaction`.
- `hooks/useTransactions.ts` (if needed) — confirm create mutation resolves with a mapped `Transaction`; adjust mapper call site if it currently returns the raw DB row.

No backend, schema, RPC, or route changes.
