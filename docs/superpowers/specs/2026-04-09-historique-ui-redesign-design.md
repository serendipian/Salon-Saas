# Historique Page UI Redesign

**Date:** 2026-04-09
**File:** `modules/pos/TransactionHistoryPage.tsx`
**Route:** `/pos/historique`

## Goals

Improve the Historique page with: clean & minimal visual polish (Stripe-style), staff member display, search/filter capabilities, and a daily summary bar. All changes are contained to this single file — no new files, no hook changes, no schema changes.

## Section 1: Visual Polish (Clean & Minimal)

### Page Header
- Merge page header and date nav into a single row: `← Historique` on the left, date nav `‹ Aujourd'hui ›` on the right
- Remove the white card wrapper from the date nav bar — make it part of the page header area
- Date label gets a soft `rounded-full bg-slate-100 px-3 py-1` pill treatment
- Transaction count badge moves next to the date label (inside or beside the pill)
- "Aujourd'hui" quick-link remains when viewing past dates

### Desktop Table
- Remove `uppercase` and `font-semibold` from thead — use normal-weight `text-slate-400 text-xs`
- Increase row vertical padding slightly (`py-4` → `py-5`)
- Action buttons: default `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` on the row (add `group` class to `<tr>`) — visible on hover or keyboard focus
- Keep dividers as subtle `divide-y divide-slate-100`

### Mobile Cards
- Remove per-card `border` and `shadow-sm`. Use a simple `divide-y divide-slate-100` on the parent container instead (thread-style)
- Cards become borderless, relying on dividers between them
- Increase spacing between client name and item list (`mb-2` → `mb-3`)

### Status Badges
- Switch from solid bg (`bg-red-100`) to ring style: `bg-transparent ring-1 ring-inset ring-red-200 text-red-600` (and orange equivalent)
- Slightly smaller text if needed

### Empty State
- Reduce icon size from 48 to 36
- Lighter text: `text-slate-300` for icon, `text-slate-400` for text

## Section 2: Staff Member Display

Data source: `transaction.items[].staffName` — already available, no DB changes needed.

### Logic
- Collect unique staff names from `trx.items.filter(i => i.staffName).map(i => i.staffName)`
- If 1 staff: show name directly
- If 2+: show first name + `+N` with a `title` attribute listing all names
- If 0: show nothing (no placeholder)

### Desktop Table
- Add "Styliste" column between "Client" and "Détails"
- Normal text style: `text-sm text-slate-600`

### Mobile Cards
- Append staff name after the time: `14:43 · Manu` — same `text-xs text-slate-500` style
- If multiple staff: `14:43 · Manu +1`

## Section 3: Search & Filter Bar

Placed inside the main card, below the header/date-nav row, above the transaction list. Only visible when there are transactions for the day (hidden on empty state).

### Search Input
- Simple text input with `Search` icon (from lucide), `rounded-lg bg-slate-50 border-0`
- Placeholder: `"Rechercher un client ou service..."`
- Filters `groupedTransactions` client-side by matching `trx.clientName` or any `trx.items[].name` against the search term (case-insensitive includes)
- Debounce not needed (small dataset per day)

### Filter Pills
- Horizontal row of small pills below/beside the search input
- **Status filters:** `Tous` (default active) | `Annules` | `Rembourses`
  - `Annules` matches status `voided`
  - `Rembourses` matches status `fully_refunded` or `partially_refunded`
  - `Tous` clears the status filter
- **Payment method filters:** Dynamic — derive from the day's transactions. Show only methods present (e.g., if no `Cheque` transactions, don't show that pill)
  - Each pill filters to transactions containing at least one payment of that method
- Pill styling: inactive = `bg-slate-100 text-slate-600`, active = `bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200`
- Filters are combinable: search AND status AND payment method
- Mobile: pills scroll horizontally with `overflow-x-auto flex-nowrap`

### Filtering Logic
- Apply search first, then status filter, then payment method filter
- All operate on the already date-filtered `groupedTransactions`
- Reset filters when date changes (clear search and deselect pills on date navigation)

## Section 4: Daily Summary Bar

Positioned between the filter bar and the transaction list. A single subtle info line.

### Data
- Only count `SALE` transactions with `active` status (exclude voided, fully_refunded)
- Partially refunded: count original total (not reduced amount)
- Sum totals and group payments by method

### Desktop
- Single row: `Total: 570,00 MAD · 3 ventes · Especes: 320,00 MAD · Carte Bancaire: 250,00 MAD`
- Style: `text-sm text-slate-500 px-6 py-3 border-b border-slate-100`

### Mobile
- Two lines:
  - Line 1: `570,00 MAD · 3 ventes`
  - Line 2: `Especes: 320 MAD · Carte: 250 MAD`
- Style: `text-xs text-slate-500 px-4 py-3`
- Payment method labels can be abbreviated on mobile (Carte Bancaire → Carte)

### Edge Cases
- 0 active transactions: hide the summary bar entirely
- Only voided/refunded transactions visible: hide summary bar

## Implementation Notes

- All changes in `TransactionHistoryPage.tsx` — single file edit
- No new components needed; inline everything
- No hook changes — all data is already available
- Filter state: `useState` for searchTerm, statusFilter, paymentFilter
- Staff extraction: inline helper function at top of component or derived in the render
- Payment method abbreviations for mobile: simple map `{'Carte Bancaire': 'Carte', 'Carte Cadeau': 'Cadeau'}`, others as-is
