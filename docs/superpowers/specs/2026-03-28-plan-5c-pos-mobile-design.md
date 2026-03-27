# Plan 5C: POS Mobile — Design Spec

## Goal

Make the POS (Point of Sale) module fully usable on mobile devices by replacing the fixed two-panel desktop layout with a mobile-optimized bottom-sheet cart pattern, converting all modals to fullscreen overlays, improving catalog browsing, and fixing the VAT extraction formula.

## Architecture

The POS module currently uses a side-by-side layout: POSCatalog (flex-1) on the left, POSCart (w-96) on the right. On screens below `md` breakpoint, the cart sidebar doesn't fit. This spec converts the mobile experience to a bottom-sheet cart pattern — the industry standard for mobile POS apps (Square, Toast, Shopify POS).

Desktop layout is unchanged. All changes are gated behind `useMediaQuery()` from `context/MediaQueryContext.tsx`.

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS utility classes
- `createPortal` for mobile overlays
- `useMediaQuery()` from existing `MediaQueryContext`
- `useViewMode()` hook (if needed for history card/table toggle)
- CSS custom properties for z-index (`--z-modal`, `--z-drawer-panel`)

---

## 1. Mobile Layout: Bottom Sheet Cart

### Current State

`POSModule.tsx` renders a flex row: `POSCatalog` (flex-1) + `POSCart` (w-96). On mobile, the w-96 cart overflows.

### Mobile Behavior

**POSCart sidebar hidden on mobile.** Replaced by two new elements:

#### 1.1 Mini Cart Bar

- **Position:** Fixed at bottom, above BottomTabBar
- **Height:** 44px, compact single-line layout
- **Content:** Item count + total price + "Panier" button (e.g., `"2 articles · 85,00 € [Panier →]"`)
- **Visibility:** Hidden when cart is empty
- **Feedback:** CSS bounce/flash animation on the bar when an item is added to cart
- **z-index:** `var(--z-content)` or above BottomTabBar level

#### 1.2 Cart Bottom Sheet

- **Trigger:** Tap mini cart bar or "Panier" button
- **Appearance:** Fullscreen overlay sliding up from bottom
- **z-index:** `var(--z-modal)`
- **Header:** Drag handle at top for swipe-to-dismiss + "Panier" title + X close button
- **Dismiss:** Swipe down on drag handle only (not on content — prevents scroll conflict), X button, Escape key
- **Body scroll lock:** Enabled while sheet is open
- **Content (scrollable):**
  - Client selector — uses `MobileSelect` fullscreen pattern from Plan 5A (not a dropdown)
  - Cart item list with quantity +/- controls (48px touch targets)
  - Tap item to open ItemEditorModal
- **Sticky footer:**
  - Subtotal, TVA, Total display
  - "Payer" checkout button (full width, prominent)

### Desktop Behavior

Unchanged. Two-panel flex layout with POSCart sidebar.

### Conditional Rendering

`POSModule.tsx` uses `useMediaQuery()`:
- Mobile: renders `<MiniCartBar>` + `<CartBottomSheet>` (portal)
- Desktop: renders `<POSCart>` sidebar

---

## 2. Fullscreen Modals on Mobile

All four POS modals become fullscreen bottom-sheet overlays on mobile. Desktop rendering unchanged (centered overlay cards).

### 2.1 Shared Mobile Modal Pattern

Consistent with DatePicker/DateRangePicker mobile pattern from Plan 5B:

- `createPortal` to document body
- `z-index: var(--z-modal)`
- Slide-up animation: `translate-y-full` → `translate-y-0`
- Sticky header: title + X close button
- Scrollable body
- Focus trap (matching MobileDrawer from Plan 5A)
- Body scroll lock
- Escape key dismisses
- `role="dialog"` + `aria-modal="true"`

### 2.2 PaymentModal (Mobile)

Single scrollable column replacing desktop two-column layout:

1. **Collapsible item summary** at top — shows "3 articles · 85,00 €" as a tappable row. Expands to show full itemized list. Collapsed by default to prioritize payment input.
2. **Amount input** — large display, `inputMode="decimal"` to trigger numeric keyboard
3. **Payment method buttons** — 2x2 grid (Carte Bancaire, Espèces, Carte Cadeau, Autre)
4. **Added payments list** — removable entries with trash icon
5. **Sticky footer** — remaining amount / change due + "Valider" button (disabled until fully paid)

### 2.3 ItemEditorModal (Mobile)

Fullscreen single column:

1. Item name + original price at top
2. Price input field — `inputMode="decimal"`
3. Discount buttons in a row (-10%, -20%, Offert)
4. Quantity +/- controls (48px buttons)
5. Note textarea
6. Sticky footer with "Appliquer" button

### 2.4 ReceiptModal (Mobile)

Fullscreen with scrollable receipt content (salon info, itemized list, totals, transaction ID). Sticky footer with Print + Email buttons.

### 2.5 ServiceVariantModal (Mobile)

Fullscreen list of variant buttons:
- Full width, 56px height each
- Shows variant name, duration, and price per row
- Tap to select and dismiss

---

## 3. POSCatalog Mobile Adjustments

### 3.1 Category Pills

- Add `scroll-snap-type: x mandatory` with `scroll-snap-align: start` on each pill
- Larger touch targets on mobile: `py-2` instead of `py-1`
- **Auto-hide when search term is non-empty** on mobile (searching by name makes category filter redundant, saves vertical space)
- Re-appear when search is cleared
- Desktop unchanged

### 3.2 Catalog Grid

- Keep 2 columns on mobile (services/products are compact enough)
- Cards get slightly more padding and larger tap areas on mobile

### 3.3 History View (Mobile)

- Replace table with card layout on mobile using `useMediaQuery()`
- Each card shows: date/time, client name, item count, total, receipt button
- Tapping a card opens ReceiptModal
- Desktop keeps the table unchanged

### 3.4 View Toggle

- Current behavior preserved (text hidden on small screens, icons remain)
- Ensure 44px minimum touch targets on all toggle buttons

---

## 4. Tax Formula Fix (TTC Pricing)

### Current Bug

```typescript
tax = subtotal * vatRate           // HT formula — overstates VAT
total = subtotal                   // TTC behavior — correct
```

These are contradictory. Prices in the system are TTC (tax-inclusive), standard for French/Moroccan salons.

### Fix

```typescript
tax = subtotal * vatRate / (1 + vatRate)   // correct TTC extraction
total = subtotal                            // unchanged
```

One change in the `totals` useMemo in `usePOS.ts`. Both POSCart and PaymentModal read `totals.total` — no downstream changes needed. ReceiptModal will now display the correct VAT amount.

---

## Files Affected

| File | Change |
|------|--------|
| `modules/pos/POSModule.tsx` | Conditional mobile/desktop layout rendering |
| `modules/pos/components/POSCart.tsx` | Desktop-only sidebar, unchanged internally |
| `modules/pos/components/POSCatalog.tsx` | Category snap, history cards, auto-hide pills |
| `modules/pos/components/POSModals.tsx` | Fullscreen mobile versions of 3 modals |
| `modules/pos/components/PaymentModal.tsx` | Fullscreen mobile version |
| `modules/pos/hooks/usePOS.ts` | Fix tax formula |
| **New:** `modules/pos/components/MiniCartBar.tsx` | Mobile mini cart bar |
| **New:** `modules/pos/components/CartBottomSheet.tsx` | Mobile cart sheet |

---

## Out of Scope

- Print/email receipt functionality (buttons exist but are non-functional — separate concern)
- Custom numeric keypad (native `inputMode="decimal"` is sufficient)
- Back-gesture modal dismiss (browser back button behavior)
- Swipe gestures on cart items (delete by swiping)
- Offline/queued transactions

---

## Deferred Improvements

- Loading skeleton states for catalog grid
- Pull-to-refresh on transaction history
- Barcode/QR scanning for product lookup
- Split-screen tablet layout (iPad)
