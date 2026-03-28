# Finances Module Restructure — Design Spec

## Overview

Restructure the Finances (Accounting) module from a flat 3-tab layout into a professional, multi-page financial hub with sidebar sub-navigation. Remove duplicate settings (TVA, Devise), relocate recurring expenses from Settings into Finances, and add analytical revenue breakdowns by category. Three-phase delivery: Phase 1 (UI restructure), Phase 2 (staff tracking on POS), Phase 3 (appointment-to-POS bridge).

## Phase Summary

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| **Phase 1** | Finances restructure + Settings cleanup + Revenue/Expense pages + Overview upgrade | None |
| **Phase 2** | Staff tracking on POS cart items + "Par équipe" revenue views | Phase 1 |
| **Phase 3** | Appointment-to-POS bridge (import pending appointments into POS) | Phase 2 |

---

## Phase 1: Finances Restructure

### 1. Sidebar Navigation

**Current:** "Finances" is a single sidebar link.

**New:** "Finances" becomes an always-expanded section with sub-pages:

```
Accueil
Agenda
Clients
Caisse
▼ Finances          → click = Vue d'ensemble page
    Revenus          → Revenue breakdown page
    Dépenses         → Expenses page
    Journal          → Ledger page (renamed from "Grand Livre")
─────────────
Équipe
Services
Produits
Fournisseurs
─────────────
Réglages
```

**Behavior:**
- Sub-items always visible (not collapsible), visually indented, smaller font, no icon
- Active sub-item highlighted, parent "Finances" stays highlighted when any sub-page is active
- Clicking "Finances" navigates to Vue d'ensemble (not a separate "Vue d'ensemble" sub-item)
- Mobile: sub-items appear in MobileDrawer under Finances section, same indented style
- Routing: HashRouter routes `#/finances` (overview), `#/finances/revenus`, `#/finances/depenses`, `#/finances/journal`
- Permissions: same as current accounting — owner/manager only

### 2. Shared Date Range Picker

- Lives in a `FinancesLayout` wrapper component, rendered above all sub-page content
- State lifted to the layout level, passed down to sub-pages
- Preserved when navigating between sub-pages (Revenus → Dépenses keeps same range)
- Default: current month on first load
- Reuses existing `DateRangePicker` component with presets

### 3. Vue d'ensemble (Overview) — Analytical Upgrade

Replaces the current AccountingOverview. Professional financial dashboard.

**KPI Row (4 cards):**

| KPI | Value | Subtitle | Source |
|-----|-------|----------|--------|
| Chiffre d'Affaires | sum(transaction.total) | ▲/▼ trend % vs previous period | transactions |
| Bénéfice Net | revenue - COGS - opex | "marge XX.X%" subtitle | transactions + expenses |
| Dépenses Totales | sum(expenses.amount) | ▲/▼ trend % (inverted: down = good) | expenses |
| Panier Moyen | revenue / tx count | "N transactions" subtitle + trend | transactions |

**Charts Row 1:**

| Chart | Type | Content |
|-------|------|---------|
| Évolution du CA | Bar chart (Recharts) | Total revenue per time bucket. Smart bucketing: daily bars for ≤60 days, monthly bars for >60 days |
| Répartition par Catégorie | Donut chart (Recharts PieChart) | Revenue split by service category + "Produits" as one slice. Shows category name + amount + percentage |

**Charts Row 2:**

| Chart | Type | Content |
|-------|------|---------|
| Flux de Trésorerie | Line chart (Recharts) | Two lines: revenue vs expenses over time. Same bucketing as CA chart |
| Moyens de Paiement | Horizontal bar chart | Payment method breakdown: Espèces, Carte Bancaire, Virement, etc. Shows amount + percentage. Source: transaction_payments |

**Bottom Cards (2x2 grid):**

| Card | Content |
|------|---------|
| Top 5 Services | Ranked list with horizontal bar visualization. Service name, count, total CA. Source: transaction_items where type=SERVICE |
| Top 5 Produits | Ranked list with horizontal bar visualization. Product name, qty sold, total CA. Source: transaction_items where type=PRODUCT |
| Clients Servis | Total unique clients this period + "N nouveaux" (clients whose first transaction falls within period). Source: transactions.client_id distinct count |
| TVA Estimée | Calculated: revenue - revenue/(1+vatRate). Shows amount + period label |

**Removed from current overview:**
- "Dernières Transactions" list → now in Journal page
- "Dernières Dépenses" list → now in Dépenses page
- "Meilleur Vendeur" hardcoded card → removed entirely
- "Cashflow" card → replaced by Flux de Trésorerie chart

### 4. Revenus Page

New page with tabs: **Services | Produits**

#### Services Tab

**Mini KPI Row (3 cards):**

| KPI | Value | Source |
|-----|-------|--------|
| CA Services | sum of SERVICE items revenue | transaction_items.type=SERVICE |
| Prestations | count of SERVICE items | transaction_items.type=SERVICE |
| Prix Moyen | CA / prestations count | computed |

All with ▲/▼ trend vs previous period.

**Sub-tabs:** Par catégorie (default) | Par équipe (Phase 2 — disabled)

**Par catégorie view:**
- Table columns: Catégorie, Nb prestations, CA, % du total, Tendance (sparkline, last 4 weeks)
- Rows expandable (▸ arrow) to show individual services within that category
- Expanded row columns: Service, Variante, Nb prestations, CA
- Sorted by CA descending by default
- Card view on mobile via ViewToggle
- Data source: transaction_items joined to services table (via reference_id) → service.category_id → service_categories

**Par équipe view (Phase 2):**
- Greyed out tab with lock icon
- On click: shows message "Activez le suivi par équipe dans la Caisse pour débloquer cette vue"
- Unlocked in Phase 2 when staff_id exists on transaction_items

#### Produits Tab

**Mini KPI Row (3 cards):**

| KPI | Value | Source |
|-----|-------|--------|
| CA Produits | sum of PRODUCT items revenue | transaction_items.type=PRODUCT |
| Articles Vendus | sum of PRODUCT items quantity | transaction_items.type=PRODUCT |
| Prix Moyen | CA / quantity | computed |

All with ▲/▼ trend vs previous period.

**Sub-tabs:** Par catégorie (default) | Tous les produits | Par équipe (Phase 2 — disabled)

**Par catégorie view:**
- Same expandable table pattern as Services > Par catégorie
- Rows: product categories (from product_categories table)
- Expanded: individual products within category
- Table columns: Catégorie/Produit, Qté vendue, CA, % du total, Tendance (sparkline)
- Data source: transaction_items joined to products table (via reference_id) → product.category_id → product_categories

**Tous les produits view:**
- Flat table: Produit, Catégorie, Qté vendue, CA, % du total
- Sorted by CA descending
- Card view on mobile via ViewToggle

### 5. Dépenses Page

Tabs: **Courantes | Récurrentes**

#### Courantes Tab

Existing expense functionality, relocated here.

**Mini KPI Row (3 cards):**

| KPI | Value | Source |
|-----|-------|--------|
| Total Dépenses | sum(expenses.amount) in date range | expenses table |
| Nb Dépenses | count of expenses in date range | expenses table |
| Moyenne par Dépense | total / count | computed |

All with ▲/▼ trend vs previous period.

- "Nouvelle Dépense" button in top right (opens existing ExpenseForm)
- Table: Date, Description, Fournisseur, Catégorie, Montant
- Card view on mobile via ViewToggle
- Reuses existing components: ExpenseTable, ExpenseCard, ExpenseForm

#### Récurrentes Tab

Moved from Settings > Paramètres Comptables > Dépenses Récurrentes.

**Next payment alert (prominent, top of page):**
```
⚡ Prochaine échéance: [Name] — [Amount] MAD — dans [N] jours ([date])
```
Shows the soonest upcoming recurring expense. Warning color if ≤3 days away.

**Mini KPI Row (3 cards):**

| KPI | Value | Source |
|-----|-------|--------|
| Charges Mensuelles | sum of monthly recurring amounts | recurring_expenses where frequency=Mensuel |
| Charges Annuelles | sum of annual recurring amounts | recurring_expenses where frequency=Annuel |
| Nb Charges Actives | count of active recurring expenses | recurring_expenses count |

**Info banner:**
"ℹ Les charges récurrentes sont un aide-mémoire. Saisissez-les dans « Courantes » à chaque échéance."

- "Nouvelle Charge" button in top right
- Table: Nom, Montant, Fréquence (badge: Mensuel/Annuel/Hebdomadaire), Prochaine échéance, Actions (delete)
- Add form inline (existing pattern from AccountingSettings)
- Data source: recurring_expenses table via useSettings hook (relocated)

### 6. Journal Page

Renamed from "Grand Livre". Combined ledger with export tools.

**Mini KPI Row (3 cards):**

| KPI | Value | Source |
|-----|-------|--------|
| Total Crédit | sum of income entries | transactions |
| Total Débit | sum of expense entries | expenses |
| Solde Net | crédit - débit | computed |

**Controls bar:**
- Search input (filters by libellé)
- Filter dropdown:
  - Type: Recette / Dépense / Tous
  - Catégorie: multi-select from expense categories + service categories
  - Montant: min / max range inputs
  - Fournisseur: text search
- Export dropdown (replaces Settings > Export tab):
  - "Télécharger CSV" — full ledger CSV export
  - "Générer fichier FEC" — French tax compliance file

**Table:** Date/Heure, Type (badge), Libellé, Catégorie, Débit, Crédit

Reuses existing AccountingLedger component, enhanced with filter and export dropdown.

### 7. Settings Cleanup

#### GeneralSettings Changes
- **Remove:** "Taux de TVA par défaut" field
- **Keep:** Devise (currency) dropdown — this is the single source for salon-wide currency

#### AccountingSettings Changes

| Current Tab | Action |
|-------------|--------|
| Fiscalité (TVA + Devise) | **Keep TVA only**, remove Devise dropdown |
| Catégories | **Keep unchanged** |
| Dépenses Récurrentes | **Remove** — moved to Finances > Dépenses > Récurrentes |
| Export Données | **Remove** — moved to Finances > Journal > Export dropdown |

Result: AccountingSettings goes from 4 tabs to 2 tabs: **Fiscalité | Catégories**

---

## Phase 2: Staff Tracking on POS

### Database Migration
- Add `staff_id UUID REFERENCES staff_members(id)` to `transaction_items` table
- Nullable (not required) — allows gradual adoption

### Type Changes
- `CartItem`: add `staffId?: string` and `staffName?: string`

### POS UI Changes
- Per cart item: staff selector dropdown (appears below variant selector)
- Default: "Non attribué" (null)
- For services: dropdown shown expanded/prompted (staff selection is natural for services)
- For products: dropdown shown but collapsed by default (less common to attribute)
- Dropdown shows active team members from useTeam() hook
- Staff name stored on cart item for display, staff_id persisted to transaction_items

### Revenue "Par équipe" Views (Unlocked)
- Services > Par équipe: Table with Membre, Nb prestations, CA, Panier moyen, % du total
- Produits > Par équipe: Table with Membre, Qté vendue, CA, % du total
- Data source: transaction_items grouped by staff_id, joined to staff_members for names
- Items with staff_id=NULL grouped under "Non attribué" row

---

## Phase 3: Appointment-to-POS Bridge

### POS Entry Points (3 paths)
1. **From appointment** (new) — pull pending appointment into POS, pre-filled
2. **Walk-in with staff** (enhanced by Phase 2) — manual cart with staff selection
3. **Quick sale** (existing) — manual cart, staff optional

### "Rendez-vous en attente" Section
- New section in POS, above or beside the catalog
- Shows appointments eligible for checkout:
  - Today's appointments with status "confirmé" or "en cours"
  - Overdue appointments from previous days (never paid) — flagged with warning
  - Sorted: overdue first (flagged), then today's by scheduled time
- Each card shows: client name, time, service(s), staff member

### Import Flow
1. Cashier clicks an appointment card → cart is pre-filled:
   - Client auto-selected
   - Services added as cart items with staff_id from appointment
   - Variant and price from appointment data
2. Cart is fully editable:
   - Add/remove items
   - Change staff assignments
   - Add products (upsell at checkout)
   - Adjust prices/discounts
3. Payment flow proceeds as normal (existing PaymentModal)
4. On payment completion:
   - Transaction created (existing flow)
   - Appointment status updated to "completed" / "paid"
   - Appointment linked to transaction (new: `transaction_id` on appointments table or `appointment_id` on transactions table)

### Database Changes
- Add `appointment_id UUID REFERENCES appointments(id)` to `transactions` table (nullable) — transaction is the downstream event, so it references the appointment
- Appointment status: add "paid" to allowed statuses if not already present

---

## Component Architecture (Phase 1)

### New Components
```
modules/accounting/
  FinancesLayout.tsx              — Wrapper: date range picker + sub-page routing
  components/
    FinancesOverview.tsx           — Replaces AccountingOverview (analytical upgrade)
    RevenuesPage.tsx               — Services/Produits tabs container
    RevenueServices.tsx            — Service revenue with sub-tabs
    RevenueProducts.tsx            — Product revenue with sub-tabs
    RevenueCategoryTable.tsx       — Expandable category table (shared by services + products)
    DepensesPage.tsx               — Courantes/Récurrentes tabs container
    DepensesRecurrentes.tsx        — Recurring expenses (moved from Settings)
    JournalPage.tsx                — Replaces/enhances AccountingLedger
    JournalFilters.tsx             — Filter dropdown component
    MiniKpiRow.tsx                 — Reusable 3-card KPI row
    SparklineCell.tsx              — Tiny trend sparkline for table cells
    PaymentMethodChart.tsx         — Horizontal bar chart for payment methods
    CategoryDonutChart.tsx         — Donut chart for category breakdown
```

### Modified Components
```
components/Layout.tsx              — Sidebar: Finances expandable section with sub-items
components/MobileDrawer.tsx        — Mobile nav: same Finances sub-items
modules/settings/components/
  GeneralSettings.tsx              — Remove TVA field
  AccountingSettings.tsx           — Remove Devise, Récurrentes tab, Export tab (4→2 tabs)
modules/accounting/
  AccountingModule.tsx             — Replaced by FinancesLayout + sub-page routing
```

### Reused Components (no changes)
```
modules/accounting/components/
  ExpenseTable.tsx                 — Used in Dépenses > Courantes
  ExpenseCard.tsx                  — Used in Dépenses > Courantes (mobile)
  ExpenseForm.tsx                  — Used in Dépenses > Courantes
components/
  DateRangePicker.tsx              — Used in FinancesLayout
  ViewToggle.tsx                   — Used in Revenue + Expense tables
```

### Data Flow
- `useAccounting()` hook: enhanced with revenue breakdown computations (by category, by type)
- `useSettings()` hook: recurring expenses query stays, but the component consuming it moves from Settings to Finances
- `useTransactions()` hook: unchanged, already provides all transaction data
- New computed data in useAccounting:
  - `revenueByServiceCategory`: group transaction_items by service category
  - `revenueByProductCategory`: group transaction_items by product category
  - `paymentMethodBreakdown`: group transaction_payments by method
  - `uniqueClientsCount`: distinct client_ids in period
  - `newClientsCount`: clients whose first-ever transaction (across ALL time, not just filtered period) falls within the selected date range. Requires a cross-period query: fetch min(date) per client_id from all transactions, then count those where min(date) is within the selected range
  - `topProducts`: top 5 products by revenue

---

## Mobile Considerations

- All pages follow existing responsive patterns (MediaQueryContext breakpoints)
- Tables switch to card view on mobile via ViewToggle (persisted in localStorage per view)
- Mini KPI rows: horizontal scroll with snap on mobile (3 cards, swipeable)
- Expandable category tables: full-width cards on mobile, tap to expand
- Sparklines hidden on mobile (too small to be useful)
- Journal filters: fullscreen overlay on mobile (like MobileSelect pattern)
- Date range picker: already responsive (existing component)

---

## Naming Reference (French UI)

| English | French (UI label) |
|---------|-------------------|
| Overview | Vue d'ensemble |
| Revenue | Revenus |
| Services | Services |
| Products | Produits |
| By category | Par catégorie |
| By team | Par équipe |
| All products | Tous les produits |
| Expenses | Dépenses |
| Current expenses | Courantes |
| Recurring expenses | Récurrentes |
| Journal/Ledger | Journal |
| Turnover | Chiffre d'Affaires (CA) |
| Net Profit | Bénéfice Net |
| Average Basket | Panier Moyen |
| VAT | TVA |
| Payment Methods | Moyens de Paiement |
| Clients Served | Clients Servis |
| Next due date | Prochaine échéance |
| Not assigned | Non attribué |
| Export | Exporter |
