# PaymentModal SOTA redesign — Phase G

**Date:** 2026-04-25
**Status:** Spec pending review

## Problem

The current PaymentModal puts the cashier in **split-payment mode by default**: clicking any payment method immediately appends a `PaymentEntry` for the full remaining total to a payments list, which drops `remaining` to 0 and disables every method button. To "change the method" the cashier has to spot the small X icon on the payment row, click it, then click a different method. Discoverable for someone managing split payments — actively hostile for the 95% case of "single payment, just pick the method."

Beyond the immediate bug, the modal trails industry SOTA on several axes:

- No visible "selected" state on method buttons (same anti-pattern we just fixed for `ItemEditorModal` presets)
- No mutual-exclusion ergonomics (clicking a different method should swap, not stack)
- No quick-amount chips for cash (`50`, `100`, `200`, `Exact`) — cashiers count notes; round-amount entry is the dominant case
- Change-due is calculated but rendered small; SOTA emphasizes it visually so the cashier can read it across a counter
- Confirm button copy is generic — SOTA shows the locked-in method on the button: *"Encaisser 100 € · Espèces"*
- Split-payment is not behind a deliberate toggle; the cashier ends up in it accidentally

## Goals

1. Default flow is **single payment** — pick a method, optionally adjust amount, confirm. No "add to list" mental model.
2. Method buttons have a clear visible "selected" state. Clicking another method **swaps** the selection.
3. Cash-specific affordances: quick-amount chips (`Exact`, `+10`, `+20`, `+50`) appear when method = Espèces.
4. Change-due is a large, high-contrast display when amount > total.
5. Confirm button copy includes the method and amount once locked in.
6. Split-payment mode stays available behind a `Paiement multiple` toggle (preserves the current power-user flow).
7. Mobile and desktop variants both follow the new pattern.

## Non-goals

- Tipping line (cultural fit unclear for the Moroccan salon market; user didn't ask).
- Customer-facing display / dual-screen mode.
- NFC / contactless / hardware integrations.
- Saving cards on file / loyalty deductions / gift card balance lookup.
- A full numeric keypad — keep using `<input type="number" inputMode="decimal">` (the OS keyboard handles the rest).

## Design

### Two modes

**Mode A — Single payment (default):**

```
[Summary: 1 article · 100,00 €]
                      [Total]
                    100,00 €

  [ Espèces ✓ ]  [ Carte Bancaire ]
  [ Virement ]  [ Carte Cadeau ]  [ Autre ]

  Quick amounts (cash only):
  [ Exact ]  [ +10 ]  [ +20 ]  [ +50 ]

  Amount: [____100,00____] €

  Rendre: 0,00 €    ← appears only when amount > total

  [ Encaisser 100,00 € · Espèces ]   ← method + amount in label
```

**Mode B — Paiement multiple (opt-in via toggle):**

The current behavior, kept intact: payments list, "Ajouter un paiement" button, X to remove rows. Toggle text: *"Paiement multiple"* link near the top. Once toggled, the layout shifts to today's flow.

### Selection mechanics (Mode A)

- `selectedMethod: string | null` state, default null
- Click method button → `setSelectedMethod(method)`. The button gets `bg-slate-900 text-white border-slate-900` (matches the chip pattern from POS filters and ItemEditorModal presets).
- Click a different method → swap (same setter, different value). No stacking.
- The Confirmer button is disabled until `selectedMethod !== null` AND amount is valid.
- Amount input shows the total by default; cashier can edit it (overpay, exact change, partial in split mode).

### Quick-amount chips (Mode A, Espèces only)

Renders below the amount input when `selectedMethod === 'Espèces'`. Hidden for other methods (the amount on a card transaction is exact by definition).

Chips use **absolute note denominations** rather than relative round-up arithmetic — this matches the SOTA convention (Square, Toast, Lightspeed) and the cashier's mental model: they hold a 100 note, they tap `100`. Set:

- **Exact** → set amount = total. Always visible.
- **50** → set amount = 50. Visible only when `50 > total`.
- **100** → set amount = 100. Visible only when `100 > total`.
- **200** → set amount = 200. Visible only when `200 > total`.

For totals > 200, only `Exact` shows — the cashier types the tendered amount manually for higher-value transactions. The four-chip set covers the salon's typical price band.

Defensive arithmetic: comparisons use `denomination > total` after rounding both sides via `Math.round(x * 100) / 100` to avoid float drift (`100.0000001 > 100` should be true, but a 100 € note for a 100 € total should hide the `100` chip — `Exact` covers it).

### Change-due display

When `amount > total`, render between the amount input and the Confirmer button:

```
Rendre  12,50 €
```

Layout: 4xl font weight bold for the number, left-aligned label, right-aligned amount. Slate background panel for visual separation. Hidden when amount ≤ total.

### Confirmer button — method-aware copy

All currency rendering uses `formatPrice()` (already imported, already handles € vs $ via `salonSettings.currency`). The new copy must NOT hard-code `€`.

- **No method selected:** `"Sélectionnez un mode de paiement"` + disabled
- **Single method, exact amount:** `"Encaisser {formatPrice(amount)} · {method}"`
- **Single method, overpaid:** `"Encaisser {formatPrice(amount)} · {method} (rendre {formatPrice(change)})"` — calls out the change explicitly
- **Split mode**, `payments.length > 0`: `"Valider la transaction (N paiements)"`

**Mobile wrap mitigation.** The single-method overpaid copy can run ~50 chars and would wrap on a 375 px viewport. On mobile only, render two stacked lines inside the same button: amount on top (large), method + rendre on the bottom (smaller). Desktop keeps the single-line variant. Both layouts are inside the same `<button>` so the click target is unchanged.

**Mode A submit shape.** When the cashier confirms in Mode A with an overpaid amount, the recorded `PaymentEntry.amount` is the **tendered amount** (e.g., 100 for a 87 total), not the total. Change is informational only — the cashier hands it back, it doesn't enter the system. Don't "helpfully" cap the recorded amount at the total.

### Split-payment toggle

A small text link at the top of the methods area: *"Paiement multiple"* (with `+` icon). When clicked, modal switches to the existing list-based UI:
- Methods become "Ajouter un paiement [Method]" buttons
- Payments list appears with X buttons
- Confirmer activates when `remaining === 0` exactly. **Overpaying a partial payment is refused in split mode** — split is for exact splits only. If a cashier needs to overpay (cash + change owed), they must do that in Mode A with a single payment. The "Ajouter un paiement" button caps each entry at `remaining`.
- A reciprocal "Retour au paiement simple" link allows toggling back as long as `payments.length === 0`

State: `isSplitMode: boolean`. Default `false`. Reset to `false` whenever the modal closes (next open starts fresh).

**Mode-A → Mode-B handoff.** When entering split mode:
- If `selectedMethod` is set AND `currentAmount` is valid AND `amount ≤ total`: auto-promote that pending state to a first `PaymentEntry` so the cashier doesn't lose what they typed.
- If `selectedMethod` is set AND `amount > total`: refuse the toggle with an inline message "Le paiement multiple ne permet pas de rendre la monnaie. Restez en paiement simple." (split mode can't represent change-due.)
- Otherwise (no method selected): clear `selectedMethod` and proceed.

**Mode-B → Mode-A handoff.** Disabled when `payments.length > 0` (would orphan the list). The link uses `aria-disabled="true"` plus an inline visible helper line below the link: "Retirez d'abord les paiements en cours." (Native `title` tooltips don't fire reliably on touch — this works on mobile and desktop equally.)

### Method shortlist

Stays the same **five** methods the modal currently renders: Espèces, Carte Bancaire (primary, large, two per row), Virement, Carte Cadeau, Autre (secondary, smaller, three per row). The mapper supports `Chèque` and `Mobile` as additional codes but they're not surfaced in the UI today; not adding them as part of this redesign — that's a separate decision.

### Accessibility

Each method button in Mode A carries `aria-pressed={selectedMethod === method}` so screen readers announce the toggle state. Same pattern as the `ItemEditorModal` discount preset chips after Phase E.

### Mobile vs desktop

Same logical structure. Mobile uses the existing fullscreen sheet pattern with sticky footer; desktop uses the centered card. Quick-amount chips render in a horizontal scroll-snap row on mobile (matches the AppointmentFilters style).

## Implementation

Single file: `modules/pos/components/PaymentModal.tsx`. Mobile and desktop variants both rewritten to share the new structure. ~500 lines total, similar size to today's file.

State additions:
- `selectedMethod: string | null` — Mode A active method
- `isSplitMode: boolean` — Mode B opt-in toggle
- Existing `payments: PaymentEntry[]`, `currentAmount: string`, `summaryExpanded: boolean` retained

Logic:
- `handleSelectMethod(method)` — Mode A only, sets selectedMethod
- `handleAddPayment(method)` — Mode B only, existing behavior
- `handleConfirm()`:
  - In Mode A: builds a single `PaymentEntry` with `selectedMethod` + amount, calls `onComplete([entry])`
  - In Mode B: calls `onComplete(payments)` when `remaining === 0`
- `handleQuickAmount(strategy: 'exact' | 'roundUp10' | 'roundUp20' | 'roundUp50')` — sets `currentAmount`
- `toggleSplitMode()` — flips `isSplitMode`, clears `selectedMethod` on entry, blocks exit when `payments.length > 0`

No changes outside this file. The downstream `processTransaction` already accepts a `PaymentEntry[]`, so the contract is preserved.

## Risks

- **Existing cashier muscle memory.** Anyone trained on the current split-first flow will look for the X. Mitigation: the toggle is visible but unobtrusive — accidental clicks are unlikely, and Mode A's UX is more discoverable than what they're used to.
- **Quick-amount math edge cases.** Total of 100 €, click `+10` → 110 €? Or 100 € (already round)? Spec: round-up-to-next-multiple ≥ total, so 100 stays 100. Verify in testing.
- **Decimal precision on overpaid amounts.** All amounts go through `Math.round(value * 100) / 100` in the existing code. Preserve this discipline in new handlers.

## Testing

Automated: existing tests at the `processTransaction` boundary still pass (unchanged contract). No new utility tests since the logic is component-local.

Manual:
- Single cash payment, exact → method highlights, confirm button shows "Encaisser X € · Espèces", finalize succeeds
- Single cash payment, overpaid via quick amount → change-due renders prominently, confirm button shows "(rendre Y €)", finalize succeeds
- Single card payment → no quick-amount chips visible, exact-amount workflow, confirm succeeds
- Click method A then click method B → only B is highlighted, no payments stacked
- Toggle to split mode → list-based UI appears, add two payments at < total → confirm disabled until remaining = 0, finalize succeeds
- Toggle back from split with payments present → toggle disabled with tooltip, must remove payments first
- Mobile: same flows with the fullscreen sheet, sticky footer, quick-amount chips scroll horizontally

## Out of scope

- Auto-detect tipping (skip for now)
- Receipt email field at this step (handled by separate post-sale modal)
- Save card / saved customer payment methods
- Loyalty/voucher deductions before checkout
- Multi-currency input (single salon currency stays)
