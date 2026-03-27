# Plan 5: Mobile Responsiveness — Design Spec

**Goal:** Make the Lumiere Beauty SaaS fully usable on phones and tablets via progressive enhancement of existing components.

**Approach:** Responsive Tailwind classes + lightweight React hooks on existing components. No separate mobile component tree. One codebase, responsive everywhere.

**Target devices:** Phones and tablets equally. Primary use cases: stylists checking appointments between clients (phone), receptionist at front desk (tablet), POS checkout (both).

**Priority order for implementation:** Infrastructure (1) → Navigation (2) → Forms (6) → Tables (3) → Pickers (4) → POS (5)

---

## Section 1: Shared Infrastructure

### MediaQueryContext Singleton

A context provider that runs a single `window.matchMedia` listener and distributes breakpoint flags to all consumers. No per-component subscriptions — eliminates re-render cascades when multiple components need breakpoint awareness.

```ts
interface MediaQueryState {
  isMobile: boolean;       // < 768px
  isTablet: boolean;       // 768px - 1023px (includes portrait + landscape)
  isTabletPortrait: boolean; // 768px - 899px
  isTabletLandscape: boolean; // 900px - 1023px
  isDesktop: boolean;      // >= 1024px
}
```

Breakpoints aligned with Tailwind defaults: `md` = 768px, `lg` = 1024px. Secondary threshold at 900px for tablet portrait vs landscape (sidebar auto-collapse behavior).

### useViewMode Hook

Controls card/table toggle for list components.

```ts
const { viewMode, setViewMode } = useViewMode('clients');
// viewMode: 'card' | 'table'
```

- Defaults to `'card'` on mobile, `'table'` on desktop
- Persists preference in localStorage with key `lumiere_viewMode_{moduleName}`
- Uses lazy `useState` initializer for synchronous localStorage read (no one-frame flash)
- Preference is per-device (localStorage is inherently device-scoped)

### ViewToggle Component

Two icon buttons (grid icon / list icon) for switching between card and table views. Hidden on mobile (`< 768px`) — card view is the only option on phones. Visible on tablet and desktop.

### useSidebar Hook

Shared sidebar state consumed by Layout and any component needing sidebar awareness.

```ts
interface SidebarState {
  isDrawerOpen: boolean;       // mobile overlay drawer visibility
  isExpanded: boolean;         // desktop/tablet sidebar expanded vs collapsed
  mode: 'drawer' | 'collapsed' | 'expanded';
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleExpanded: () => void;
}
```

Mode derived from MediaQueryContext. Sidebar auto-collapses below 900px (tablet portrait).

### Touch Target Standard

Minimum 44x44px for all interactive elements on mobile (Apple HIG / Google Material guideline). Applies to: buttons, inputs, select triggers, calendar day cells, dropdown options, nav items.

---

## Section 2: Mobile Navigation

### Breakpoint Behavior

| Breakpoint | Sidebar | Bottom Tabs | Top Bar |
|---|---|---|---|
| Mobile (< 768px) | Hidden. Overlay drawer via hamburger or "Plus" tab | Visible: 5 tabs | Simplified: hamburger + logo + bell |
| Tablet portrait (768-899px) | Collapsed icons only | Hidden | Full top bar |
| Tablet landscape (900-1023px) | Collapsed by default, can expand | Hidden | Full top bar |
| Desktop (1024px+) | Expanded, collapsible | Hidden | Full top bar (current) |

### Bottom Tab Bar (Mobile Only)

- Fixed to bottom of viewport with `pb-[env(safe-area-inset-bottom)]`
- 5 tabs: **Accueil** (Home), **Agenda** (Calendar), **Caisse** (POS), **Clients**, **Plus** (Menu)
- "Plus" opens the full sidebar as overlay drawer
- Active tab: brand-500, inactive: slate-400
- Height: 56px + safe area
- Tab items pass through `can('view', resource)` permission check (same as sidebar)

### Overlay Drawer

- Triggered by hamburger icon in top bar OR "Plus" tab
- Slides in from left with backdrop overlay (semi-transparent black)
- Contains all 10 modules in current sidebar order
- Tap backdrop or any nav item to close
- Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-label="Navigation"`, focus trap, Escape key closes and returns focus to trigger, `inert` on main content while open

### Top Bar on Mobile

- Left: hamburger icon (opens drawer)
- Center: "Lumiere" logo
- Right: user avatar or notification bell
- Search bar hidden on mobile (deferred: future search icon that expands to full-width input)

### z-index Scale (Global)

Established consistently across all components:

| Layer | z-index |
|---|---|
| Content | 0 |
| Peek bar (POS) | 10 |
| Top bar | 20 |
| Sidebar | 30 |
| Drawer backdrop | 40 |
| Drawer panel / picker dropdown | 50 |
| Modals / fullscreen overlays | 60 |
| Toast notifications | 70 |

### Main Content Bottom Padding

Layout adds `pb-[calc(56px+env(safe-area-inset-bottom))]` to main content area on mobile so list items aren't hidden behind the tab bar.

---

## Section 3: Data Tables — Card/Table View Toggle

### Behavior by Breakpoint

- **Desktop/tablet:** Table view default, ViewToggle button to switch to cards
- **Mobile (< 768px):** Card view only, no toggle shown

### 3-File Split Pattern

Each list module gets extracted into 3 focused files:

```
modules/{module}/components/
  {Module}List.tsx        # Thin orchestrator: picks table or card view
  {Module}Table.tsx       # Existing table code extracted verbatim
  {Module}Card.tsx        # New card layout
```

### Card Layout

Per-module card layouts (no shared Card component — data is too different across modules):

- **Primary line:** Name/title (bold, larger text)
- **Secondary line:** Key identifier (phone, email, category)
- **Metadata:** 2-3 small detail chips (status badge, date, amount)
- **Action:** Tap card → open detail/edit view

### Card Accessibility

- Cards rendered as `<button>` elements
- `aria-label` on each card: e.g., `"Voir le client Fatima Benali"`
- Focus ring: `focus-visible:ring-2 focus-visible:ring-brand-500`
- Entire card is the tap target

### Card Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {items.map(item => <ModuleCard key={item.id} ... />)}
</div>
```

### EmptyState Component

Shared component used by both card and table views:

```ts
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;        // French
  description: string;  // French
  ctaLabel?: string;
  onCta?: () => void;
}
```

### Loading States

- Card view: skeleton card grid (pulse animation)
- Table view: skeleton rows

### Pagination

"Charger plus" button at bottom of card grid. Page size 25 items. No virtual scrolling.

### Card Sort Order

Default sort per module matches existing query order:
- Clients: alphabetical
- Appointments: chronological
- Products: by category then name
- Expenses: date descending
- Services, Team, Suppliers: alphabetical

No sort controls in card view for now.

### Affected Modules (7)

ClientList, ServiceList, ProductList, TeamList, SupplierList, AppointmentList, ExpenseList

**Not affected:** Dashboard, POS, Settings

### AppointmentList Note

Appointments have time-based hierarchy (day grouping, time slot + service + client). Card layout gets its own specification — grouped by day headers with time-based cards. May overlap with Calendar view on mobile.

### Bulk Actions

Deferred. Future path: checkbox column in table view, long-press to select in card view.

---

## Section 4: Date Pickers on Mobile

### Behavior by Breakpoint

| Breakpoint | DatePicker | DateRangePicker |
|---|---|---|
| Mobile (< 768px) | Fullscreen modal | Fullscreen modal, single calendar |
| Tablet/Desktop | Current dropdown (unchanged) | Current dropdown (unchanged) |

### DatePicker on Mobile

- Tap input → fullscreen modal (portal to `document.body`)
- Top bar: "Sélectionner une date" title + X close button
- Calendar grid fills available width, day cells min 44px touch targets
- Month navigation arrows: `min-w-[44px] min-h-[44px]`
- Tap day → selects, auto-closes, returns value
- Body scroll lock: `overflow: hidden` on `<body>` via `useEffect` with cleanup

### DateRangePicker on Mobile

- Tap input → fullscreen modal
- Top bar: "Période" title + X close button (X = discard, never applies selection)
- **Presets first:** full-width buttons at top (Ce mois-ci, Semaine dernière, etc.) — most common action
- Below presets: single calendar (not dual) with left/right month navigation
- **Two-tap range indicator:** header shows "1. Date de début" → "2. Date de fin" — updates after first tap
- Selected range highlighted across days
- Bottom: "Appliquer" button to confirm selection

### Desktop z-index Fix

Both pickers change from `z-[100]` to `z-50` on desktop, matching the approved z-index scale.

### Calendar Accessibility

- Modal: `role="dialog"`, `aria-modal="true"`, `aria-label`
- Focus trap inside modal while open, Escape key closes
- Day cells: `aria-label="15 mars 2026"` format
- Calendar container: `role="grid"`, day buttons: `role="gridcell"`
- Arrow key grid navigation: stretch goal for future hardening pass

### Bug Fix: "Aujourd'hui" Preset

Fix pre-existing bug: the preset mutates one `Date` object for both `from` and `to`. Fix: use two separate `new Date()` calls.

---

## Section 5: POS Module on Mobile

### Layout by Breakpoint

| Breakpoint | Layout |
|---|---|
| Mobile (< 768px) | Catalog fullscreen, cart as bottom sheet |
| Tablet/Desktop | Current side-by-side (unchanged) |

### Bottom Tab Bar Hidden During POS

When POS is active on mobile, the bottom tab bar is hidden. POS module signals "active" state via layout context.

### Catalog Grid on Mobile

- Category tabs: horizontal scroll (existing, already works)
- Items: `grid grid-cols-2 gap-3`
- Each card: name, price, tap to add to cart (full card tappable, min 44px height)
- `React.memo` on catalog grid, `useCallback` on add-to-cart handler (prevents re-render jank on mid-range Android)

### Peek Bar (Collapsed Cart)

- **Hidden when cart is empty.** Appears with slide-up animation on first item added.
- Fixed to bottom with safe area inset, z-index 10
- Height: 56px
- Shows: cart icon + item count + total price + up-chevron
- Background: brand-500 (pink) when items in cart
- Tap anywhere to expand cart

### Cart Bottom Sheet (75% — Cart State)

- Slides up covering ~75% of screen via CSS `transform: translateY()`
- Top: drag handle with swipe-to-collapse (`touchstart`/`touchmove`/`touchend`, collapse on downward velocity threshold) + "Retour" text button as accessible fallback
- Drag handle: `role="button"`, `aria-label="Fermer le panier"`
- Content: scrollable cart items, quantity +/- buttons (44px, 8px gap between them), remove via swipe-left on row
- Client selector trigger (tapping opens fullscreen search overlay per Section 4 pattern)
- "Payer" button at bottom
- Focus trap while sheet is open, focus returns to peek bar on collapse

### Checkout Fullscreen (100% — Checkout State)

Triggered by "Payer" button. Sheet expands to fullscreen:

- Client name
- Itemized order summary
- Total
- Payment method selector + split payment controls
- Final "Confirmer la transaction" button (creates the transaction)

This separates browsing from payment, avoids keyboard-in-75%-sheet problems, and ensures staff see the full order before confirming.

---

## Section 6: Forms & Remaining Module Tweaks

### Form Improvements (All Modules)

- **Touch targets:** All buttons, inputs, select triggers → `min-h-[44px]` on mobile
- **Input spacing:** Normalize to `gap-4` on mobile, `gap-5` on desktop
- **Submit buttons:** `w-full` on mobile, inline on desktop
- **Button pairs:** Cancel + Submit use `flex-col-reverse` on mobile (Submit on top in thumb zone, Cancel below)
- **Input types for mobile keyboards:** `type="tel"` / `inputMode="tel"` for phone fields, `type="email"` for email, `inputMode="numeric"` for prices/quantities
- **`dir="auto"`** on client name and text inputs for Arabic text (Moroccan market)

### Select Component — Fullscreen Overlay on Mobile

When `isMobile`, the Select component renders a fullscreen picker (same Section 4 pattern):
- Search input at top
- Full-height scrollable option list (44px per option)
- Tap to select, overlay closes
- Trigger button in the form still shows selected value inline

### Dashboard

- Existing responsive grids are adequate — no major changes
- KPI cards: `flex-col` for value/trend pair on mobile, allow text wrapping
- KPI grid: `grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4` (handles 320px screens)
- Charts: already stack on mobile — no changes

### Settings

- **Tab navigation:** Horizontal scroll with `overflow-x-auto`, `whitespace-nowrap`, hidden scrollbar. Active tab auto-scrolls into view on mount via `scrollIntoView`.
- **WorkScheduleEditor:** Day columns `min-w-[120px]`, time label `min-w-[64px]`. Container `overflow-x-auto` with `scroll-snap-type: x mandatory`, `scroll-snap-align: start` per column. Right-edge fade gradient to signal scrollability.
- **BonusSystemEditor:** Each bonus tier becomes a card on mobile with subtle border, inputs stacked vertically, full-width "Supprimer" button (destructive variant) at bottom of card.

### Team

- WorkScheduleEditor: same spec as Settings (shared component)
- Staff detail view: sections stack vertically on mobile

### Appointments / Calendar

- **Default to day view on mobile** (single column of time slots)
- **Month view condensed:** Up to 3 colored dots (8px, 2px gap) per day cell. More than 3: "+N" text. Tapping any day (including empty) transitions to day view for that date via component state, not route change.
- **Week view:** Horizontal scroll on mobile
- **Day view bottom padding:** `pb-[calc(64px+env(safe-area-inset-bottom))]` for tab bar clearance

### Accounting & Suppliers

Covered by existing patterns:
- Lists: Section 3 card/table toggle
- Date pickers: Section 4 fullscreen modals
- Forms: Section 6 form improvements
- No module-specific changes needed

### 320px Screen Handling

Below 360px width, all grids fall back to single column. KPI quick stats: `grid-cols-1 min-[360px]:grid-cols-2`. Forms already single-column at base.
