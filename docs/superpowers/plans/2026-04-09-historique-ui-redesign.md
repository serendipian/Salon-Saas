# Historique Page UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Historique page with clean visual polish, staff display, search/filter bar, and daily summary — all in a single file.

**Architecture:** Single-file refactor of `modules/pos/TransactionHistoryPage.tsx`. No new files, no hook changes, no schema changes. Add `Search` icon import from lucide-react. Add filter state via `useState`. Derive staff names, daily summary, and filtered results via `useMemo`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React icons

---

### Task 1: Visual Polish — Status Badges + Empty State

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx:116-123` (statusBadge function)
- Modify: `modules/pos/TransactionHistoryPage.tsx:203-207` (empty state)

- [ ] **Step 1: Update statusBadge to use ring style**

Replace the `statusBadge` function (lines 116-123) with:

```tsx
const statusBadge = (status: TransactionStatus, trx: Transaction) => {
  if (trx.type === 'VOID') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-red-200 text-red-600">Annulation</span>;
  if (trx.type === 'REFUND') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">Remboursement</span>;
  if (status === 'voided') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-red-200 text-red-600">Annulé</span>;
  if (status === 'fully_refunded') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">Remboursé</span>;
  if (status === 'partially_refunded') return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-transparent ring-1 ring-inset ring-orange-200 text-orange-600">Remb. partiel</span>;
  return null;
};
```

- [ ] **Step 2: Update empty state**

Replace the empty state block (lines 203-207) with:

```tsx
<div className="p-12 text-center">
  <History size={36} className="mx-auto mb-4 text-slate-300" />
  <p className="text-slate-400">Aucune transaction enregistrée.</p>
</div>
```

- [ ] **Step 3: Verify dev server compiles**

Run: `npm run dev` (should already be running)
Expected: No TypeScript errors, page loads at `/pos/historique`

- [ ] **Step 4: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "style(historique): update status badges to ring style and lighten empty state"
```

---

### Task 2: Visual Polish — Merged Header + Date Nav

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx:153-201` (header + date nav)

- [ ] **Step 1: Replace the page header and date nav**

Replace everything from line 153 (`return (`) through line 201 (closing `</div>` of date nav bar) with:

```tsx
return (
  <div className="w-full space-y-6">
    {/* Merged Header: back + title on left, date nav on right */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/pos')}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
          aria-label="Retour à la caisse"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Historique</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={goToPrevDay}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
          aria-label="Jour précédent"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 min-w-[120px] text-center">
          {historyDateLabel}
          <span className="ml-1.5 text-xs text-slate-400 font-normal">{filteredTransactions.length}</span>
        </span>
        <button
          onClick={goToNextDay}
          disabled={isHistoryToday}
          className={`p-1.5 rounded-lg transition-colors ${isHistoryToday ? 'text-slate-200 cursor-not-allowed' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          aria-label="Jour suivant"
        >
          <ChevronRight size={18} />
        </button>
        {!isHistoryToday && (
          <button
            onClick={() => setHistoryDate(new Date())}
            className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors ml-1"
          >
            Aujourd'hui
          </button>
        )}
      </div>
    </div>

    {/* Transaction List Card */}
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
```

Note: The old separate `{/* Page Header */}` div and the `{/* Date Navigation */}` bar inside the card are now a single row above the card. The card starts right after, containing only the transaction list.

- [ ] **Step 2: Verify layout renders correctly**

Run: Check `/pos/historique` in browser
Expected: Back arrow + "Historique" on left, pill date nav on right. White card below with just the list.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "style(historique): merge header and date nav into single row with pill styling"
```

---

### Task 3: Visual Polish — Desktop Table + Mobile Cards

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx` (table thead, tr rows, mobile card container)

- [ ] **Step 1: Update desktop table thead**

Replace:
```tsx
<thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
```

With:
```tsx
<thead className="border-b border-slate-100">
```

And replace all `<th>` elements with lighter styling:
```tsx
<tr>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Heure</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Client</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Détails</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal text-right">Total</th>
  <th className="px-6 py-3"></th>
</tr>
```

- [ ] **Step 2: Add hover-reveal actions on desktop rows**

Replace each parent `<tr>` opening tag:
```tsx
<tr className={`hover:bg-slate-50/80 transition-colors ${isVoided ? 'opacity-60' : ''}`}>
```

With:
```tsx
<tr className={`group hover:bg-slate-50/80 transition-colors ${isVoided ? 'opacity-60' : ''}`}>
```

And wrap the actions `<div>` with opacity transition:
Replace:
```tsx
<div className="flex items-center justify-end gap-1">
```

With:
```tsx
<div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
```

Update parent row `<td>` elements from `py-4` to `py-5`:
```tsx
<td className="px-6 py-5 font-medium text-slate-700">
```
(Apply `py-5` to all 5 `<td>` elements in the parent row.)

- [ ] **Step 3: Update mobile cards to thread-style dividers**

Replace the mobile container:
```tsx
<div className="p-3 space-y-3">
```

With:
```tsx
<div className="divide-y divide-slate-100">
```

Replace each parent card wrapper:
```tsx
<div className={`w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm ${isVoided ? 'opacity-60' : ''}`}>
```

With:
```tsx
<div className={`w-full text-left px-4 py-4 ${isVoided ? 'opacity-60' : ''}`}>
```

Update the spacing in mobile cards — replace `mb-2` with `mb-3` on the flex wrapper:
```tsx
<div className="flex justify-between items-start mb-3">
```

- [ ] **Step 4: Verify both layouts**

Run: Check `/pos/historique` in browser at desktop and mobile widths
Expected: Clean table headers, hover-reveal actions on desktop. Borderless thread-style cards on mobile.

- [ ] **Step 5: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "style(historique): clean table headers, hover-reveal actions, thread-style mobile cards"
```

---

### Task 4: Staff Member Display

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx` (add helper, update desktop thead/rows, update mobile cards)

- [ ] **Step 1: Add staff name helper**

Add this helper function inside the component, after the `statusBadge` function (after line ~123):

```tsx
const getStaffDisplay = (trx: Transaction): { label: string; title?: string } | null => {
  const names = [...new Set(trx.items.filter(i => i.staffName).map(i => i.staffName!))];
  if (names.length === 0) return null;
  if (names.length === 1) return { label: names[0] };
  return { label: `${names[0]} +${names.length - 1}`, title: names.join(', ') };
};
```

- [ ] **Step 2: Add Styliste column to desktop table**

Update the thead to add the new column between Client and Détails:
```tsx
<tr>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Heure</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Client</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Styliste</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal">Détails</th>
  <th className="px-6 py-3 text-xs text-slate-400 font-normal text-right">Total</th>
  <th className="px-6 py-3"></th>
</tr>
```

Add the staff cell in the parent row body, between the Client `<td>` and the Détails `<td>`:
```tsx
<td className="px-6 py-5">
  {(() => {
    const staff = getStaffDisplay(trx);
    if (!staff) return null;
    return <span className="text-sm text-slate-600" title={staff.title}>{staff.label}</span>;
  })()}
</td>
```

Add an empty staff cell for child rows (between the client/badge td and the détails td):
```tsx
<td className="px-6 py-2"></td>
```

- [ ] **Step 3: Add staff name to mobile cards**

In the mobile card, update the time/badge line to include staff. Replace:
```tsx
<div className="flex items-center gap-2 mt-0.5">
  <span className="text-xs text-slate-500">
    {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </span>
  {statusBadge(status, trx)}
</div>
```

With:
```tsx
<div className="flex items-center gap-2 mt-0.5">
  <span className="text-xs text-slate-500">
    {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    {(() => {
      const staff = getStaffDisplay(trx);
      if (!staff) return null;
      return <span title={staff.title}> · {staff.label}</span>;
    })()}
  </span>
  {statusBadge(status, trx)}
</div>
```

- [ ] **Step 4: Verify staff display**

Run: Check `/pos/historique` with transactions that have staff assigned
Expected: Staff names appear in Styliste column on desktop, after time on mobile. No placeholder for transactions without staff.

- [ ] **Step 5: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "feat(historique): display staff member names on transactions"
```

---

### Task 5: Search & Filter Bar — State + Search Input

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx` (imports, state, filtering logic, JSX)

- [ ] **Step 1: Add Search icon import**

Update the lucide-react import line:
```tsx
import { History, ChevronLeft, ChevronRight, ArrowLeft, Eye, Receipt, Ban, RotateCcw, Search } from 'lucide-react';
```

- [ ] **Step 2: Add filter state variables**

Add after the modal state declarations (after line ~76):
```tsx
// Search & filter state
const [searchTerm, setSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState<'all' | 'voided' | 'refunded'>('all');
const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
```

- [ ] **Step 3: Reset filters on date change**

Update `goToPrevDay` and `goToNextDay` to reset filters. Replace both functions:

```tsx
const goToPrevDay = () => {
  setHistoryDate(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() - 1);
    return d;
  });
  setSearchTerm('');
  setStatusFilter('all');
  setPaymentFilter(null);
};

const goToNextDay = () => {
  if (isHistoryToday) return;
  setHistoryDate(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() + 1);
    return d;
  });
  setSearchTerm('');
  setStatusFilter('all');
  setPaymentFilter(null);
};
```

Also add filter reset to the "Aujourd'hui" button. Replace:
```tsx
onClick={() => setHistoryDate(new Date())}
```
With:
```tsx
onClick={() => { setHistoryDate(new Date()); setSearchTerm(''); setStatusFilter('all'); setPaymentFilter(null); }}
```

- [ ] **Step 4: Add filtered grouped transactions memo**

Add after the existing `groupedTransactions` memo:

```tsx
// Derive available payment methods from this day's transactions
const availablePaymentMethods = React.useMemo(() => {
  const methods = new Set<string>();
  for (const { parent } of groupedTransactions) {
    for (const p of parent.payments) {
      methods.add(p.method);
    }
  }
  return [...methods].sort();
}, [groupedTransactions]);

// Apply search + status + payment filters
const displayedTransactions = React.useMemo(() => {
  return groupedTransactions.filter(({ parent: trx }) => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchClient = trx.clientName?.toLowerCase().includes(term);
      const matchItem = trx.items.some(i => i.name.toLowerCase().includes(term));
      if (!matchClient && !matchItem) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const status = getTransactionStatus(trx, transactions);
      if (statusFilter === 'voided' && status !== 'voided') return false;
      if (statusFilter === 'refunded' && status !== 'fully_refunded' && status !== 'partially_refunded') return false;
    }

    // Payment method filter
    if (paymentFilter) {
      const hasMethod = trx.payments.some(p => p.method === paymentFilter);
      if (!hasMethod) return false;
    }

    return true;
  });
}, [groupedTransactions, searchTerm, statusFilter, paymentFilter, transactions]);
```

- [ ] **Step 5: Add search + filter bar JSX**

Add inside the card, right after the opening `<div className="bg-white rounded-xl ...">` tag and before the empty state / list content. This should only render when there are transactions for the day:

```tsx
{filteredTransactions.length > 0 && (
  <div className="px-4 pt-4 pb-2 space-y-3 border-b border-slate-100">
    {/* Search input */}
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Rechercher un client ou service..."
        className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
    {/* Filter pills */}
    <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto flex-nowrap pb-1' : 'flex-wrap'}`}>
      {/* Status pills */}
      {(['all', 'voided', 'refunded'] as const).map(f => {
        const labels = { all: 'Tous', voided: 'Annulés', refunded: 'Remboursés' };
        const isActive = statusFilter === f;
        return (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {labels[f]}
          </button>
        );
      })}
      {/* Payment method pills */}
      {availablePaymentMethods.map(method => {
        const isActive = paymentFilter === method;
        return (
          <button
            key={method}
            onClick={() => setPaymentFilter(isActive ? null : method)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {method}
          </button>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 6: Update list rendering to use displayedTransactions**

Replace all references to `groupedTransactions.map(` in the JSX (both mobile and desktop) with `displayedTransactions.map(`.

There are two occurrences:
1. Mobile: `{groupedTransactions.map(({ parent: trx, children }) => {`
2. Desktop: `{groupedTransactions.map(({ parent: trx, children }) => {`

Replace both with: `{displayedTransactions.map(({ parent: trx, children }) => {`

- [ ] **Step 7: Verify search and filters**

Run: Check `/pos/historique` in browser
Expected: Search input filters by client name and service name. Status pills toggle correctly. Payment pills appear based on available methods. Filters reset on date change.

- [ ] **Step 8: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "feat(historique): add search input and filter pills for status and payment method"
```

---

### Task 6: Daily Summary Bar

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx` (add summary memo + JSX)

- [ ] **Step 1: Add payment method abbreviation map and summary memo**

Add after the `displayedTransactions` memo:

```tsx
const PAYMENT_METHOD_SHORT: Record<string, string> = {
  'Carte Bancaire': 'Carte',
  'Carte Cadeau': 'Cadeau',
};

const dailySummary = React.useMemo(() => {
  const activeSales = groupedTransactions.filter(({ parent: trx }) => {
    const status = getTransactionStatus(trx, transactions);
    return trx.type === 'SALE' && (status === 'active' || status === 'partially_refunded');
  });
  if (activeSales.length === 0) return null;

  const total = activeSales.reduce((sum, { parent }) => sum + parent.total, 0);
  const byMethod: Record<string, number> = {};
  for (const { parent } of activeSales) {
    for (const p of parent.payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }
  }

  return { total, count: activeSales.length, byMethod };
}, [groupedTransactions, transactions]);
```

- [ ] **Step 2: Add summary bar JSX**

Add right after the search/filter bar `</div>` and before the empty state check. This goes inside the card:

```tsx
{dailySummary && (
  isMobile ? (
    <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
      <div>{formatPrice(dailySummary.total)} · {dailySummary.count} vente{dailySummary.count > 1 ? 's' : ''}</div>
      <div className="mt-0.5">
        {Object.entries(dailySummary.byMethod).map(([method, amount], i) => (
          <span key={method}>{i > 0 ? ' · ' : ''}{PAYMENT_METHOD_SHORT[method] || method}: {formatPrice(amount)}</span>
        ))}
      </div>
    </div>
  ) : (
    <div className="px-6 py-3 border-b border-slate-100 text-sm text-slate-500">
      <span className="font-medium text-slate-700">{formatPrice(dailySummary.total)}</span>
      {' · '}{dailySummary.count} vente{dailySummary.count > 1 ? 's' : ''}
      {Object.entries(dailySummary.byMethod).map(([method, amount]) => (
        <span key={method}> · {method}: {formatPrice(amount)}</span>
      ))}
    </div>
  )
)}
```

- [ ] **Step 3: Verify summary bar**

Run: Check `/pos/historique` with active transactions
Expected: Summary bar shows total, count, payment breakdown. Hidden when only voided/refunded transactions. Different layout on mobile vs desktop.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "feat(historique): add daily summary bar with revenue and payment breakdown"
```

---

### Task 7: Final Cleanup + Verify

**Files:**
- Modify: `modules/pos/TransactionHistoryPage.tsx` (if needed)

- [ ] **Step 1: Run build to check for TypeScript errors**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Full visual check**

Manually verify in the browser:
- Desktop: clean table, hover-reveal actions, staff column, search/filters, summary bar
- Mobile: borderless cards, staff after time, horizontal scrolling pills, stacked summary
- Empty day: no search/filter bar, no summary, lighter empty state
- Date navigation: filters reset when changing days
- Status badges: ring style (not solid)

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add modules/pos/TransactionHistoryPage.tsx
git commit -m "style(historique): final polish and cleanup"
```
