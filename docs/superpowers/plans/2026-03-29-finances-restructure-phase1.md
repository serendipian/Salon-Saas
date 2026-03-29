# Finances Restructure — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Finances module from a flat 3-tab layout into a multi-page financial hub with sidebar sub-navigation, analytical overview, revenue/expense breakdowns, and cleaned-up settings.

**Architecture:** The single `/accounting` route becomes a layout with 4 sub-routes (`/finances`, `/finances/revenus`, `/finances/depenses`, `/finances/journal`). The sidebar gains expandable sub-items under "Finances". Existing components are reused where possible; new components handle revenue breakdowns and the upgraded overview.

**Tech Stack:** React 19, TypeScript, React Router DOM 7 (HashRouter), TanStack Query, Recharts 3, Tailwind CSS, Supabase

**Spec:** `docs/superpowers/specs/2026-03-29-finances-restructure-design.md`

---

### Task 1: Update Routes — Replace `/accounting` with `/finances/*`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Update route definitions**

Replace the single accounting route with nested finances routes:

```tsx
// In App.tsx, replace lines 84-88:
// OLD:
//   <Route path="/accounting" element={
//     <ProtectedRoute action="view" resource="accounting">
//       <ErrorBoundary moduleName="Comptabilité"><AccountingModule /></ErrorBoundary>
//     </ProtectedRoute>
//   } />

// NEW:
import { FinancesLayout } from './modules/accounting/FinancesLayout';
import { FinancesOverview } from './modules/accounting/components/FinancesOverview';
import { RevenuesPage } from './modules/accounting/components/RevenuesPage';
import { DepensesPage } from './modules/accounting/components/DepensesPage';
import { JournalPage } from './modules/accounting/components/JournalPage';

// Replace the /accounting route block with:
<Route path="/finances" element={
  <ProtectedRoute action="view" resource="accounting">
    <ErrorBoundary moduleName="Finances">
      <FinancesLayout />
    </ErrorBoundary>
  </ProtectedRoute>
}>
  <Route index element={<FinancesOverview />} />
  <Route path="revenus" element={<RevenuesPage />} />
  <Route path="depenses" element={<DepensesPage />} />
  <Route path="journal" element={<JournalPage />} />
</Route>
{/* Redirect old route */}
<Route path="/accounting" element={<Navigate to="/finances" replace />} />
```

Also update the import at the top: remove the `AccountingModule` import.

- [ ] **Step 2: Verify the app still compiles**

Run: `npm run build 2>&1 | tail -5`

This will fail because the new components don't exist yet. That's expected — we'll create them in the following tasks. For now, create minimal stubs so the build passes.

- [ ] **Step 3: Create stub components**

Create minimal placeholder files so the build passes. These will be fully implemented in later tasks.

**`modules/accounting/FinancesLayout.tsx`:**
```tsx
import React from 'react';
import { Outlet } from 'react-router-dom';

export const FinancesLayout: React.FC = () => {
  return (
    <div>
      <Outlet />
    </div>
  );
};
```

**`modules/accounting/components/FinancesOverview.tsx`:**
```tsx
import React from 'react';

export const FinancesOverview: React.FC = () => {
  return <div>Vue d'ensemble (placeholder)</div>;
};
```

**`modules/accounting/components/RevenuesPage.tsx`:**
```tsx
import React from 'react';

export const RevenuesPage: React.FC = () => {
  return <div>Revenus (placeholder)</div>;
};
```

**`modules/accounting/components/DepensesPage.tsx`:**
```tsx
import React from 'react';

export const DepensesPage: React.FC = () => {
  return <div>Dépenses (placeholder)</div>;
};
```

**`modules/accounting/components/JournalPage.tsx`:**
```tsx
import React from 'react';

export const JournalPage: React.FC = () => {
  return <div>Journal (placeholder)</div>;
};
```

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add App.tsx modules/accounting/FinancesLayout.tsx modules/accounting/components/FinancesOverview.tsx modules/accounting/components/RevenuesPage.tsx modules/accounting/components/DepensesPage.tsx modules/accounting/components/JournalPage.tsx
git commit -m "feat: add finances sub-routes with stub components"
```

---

### Task 2: Sidebar Navigation — Expandable Finances Section

**Files:**
- Modify: `components/Layout.tsx`
- Modify: `components/MobileDrawer.tsx`

- [ ] **Step 1: Update sidebar nav items in Layout.tsx**

In `components/Layout.tsx`, change the `mainNavItems` array (lines 104-110). Replace the `accounting` entry with `finances`, and add a new `financesSubItems` array:

```tsx
// Replace lines 104-110:
const mainNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
  { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
  { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
  { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
  { id: 'finances', label: 'Finances', icon: BarChart3, resource: 'accounting' },
];

const financesSubItems = [
  { id: 'finances/revenus', label: 'Revenus' },
  { id: 'finances/depenses', label: 'Dépenses' },
  { id: 'finances/journal', label: 'Journal' },
];
```

- [ ] **Step 2: Render sub-items under Finances in the sidebar**

In the sidebar nav rendering loop (lines 210-219), add sub-item rendering after the Finances item:

```tsx
{visibleMainNav.map(item => (
  <React.Fragment key={item.id}>
    <SidebarItem
      icon={item.icon}
      label={item.label}
      active={activeModule === item.id || activeModule.startsWith(item.id + '/')}
      onClick={() => onNavigate(item.id)}
      collapsed={collapsed}
    />
    {/* Finances sub-items */}
    {item.id === 'finances' && !collapsed && (
      <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5">
        {financesSubItems.map(sub => (
          <button
            key={sub.id}
            onClick={() => onNavigate(sub.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
              activeModule === sub.id
                ? 'text-slate-900 bg-slate-100'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>
    )}
  </React.Fragment>
))}
```

- [ ] **Step 3: Update the activeModule derivation**

In `App.tsx`, the `currentModule` is derived from `location.pathname.substring(1)`. This already handles nested paths like `finances/revenus`. Verify that the Layout receives the full path. In `App.tsx` line 33:

```tsx
const currentModule = location.pathname.substring(1) || 'dashboard';
```

This already returns `finances/revenus` for `/finances/revenus`. The sidebar active state checks `activeModule === item.id || activeModule.startsWith(item.id + '/')` which will correctly highlight "Finances" when on any sub-page.

- [ ] **Step 4: Update MobileDrawer to show sub-items**

In `components/MobileDrawer.tsx`, update the main nav rendering (line 157) to include finances sub-items:

```tsx
// Replace line 157: {mainNavItems.map(renderItem)}
// With:
{mainNavItems.map(item => (
  <React.Fragment key={item.id}>
    {renderItem(item)}
    {item.id === 'finances' && (
      <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5">
        {[
          { id: 'finances/revenus', label: 'Revenus' },
          { id: 'finances/depenses', label: 'Dépenses' },
          { id: 'finances/journal', label: 'Journal' },
        ].map(sub => (
          <button
            key={sub.id}
            onClick={() => handleNavClick(sub.id)}
            className={`flex items-center w-full px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all min-h-[44px] ${
              activeModule === sub.id
                ? 'text-slate-900 bg-slate-100'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>
    )}
  </React.Fragment>
))}
```

- [ ] **Step 5: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/Layout.tsx components/MobileDrawer.tsx
git commit -m "feat: add Finances sub-navigation in sidebar and mobile drawer"
```

---

### Task 3: FinancesLayout — Shared Date Range Picker + Page Shell

**Files:**
- Modify: `modules/accounting/FinancesLayout.tsx`

- [ ] **Step 1: Implement the full layout**

Replace the stub with the real layout that provides shared date range state to all sub-pages via Outlet context:

```tsx
import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DateRangePicker } from '../../components/DateRangePicker';
import type { DateRange } from '../../types';

export interface FinancesOutletContext {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export const FinancesLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(new Date().setHours(23, 59, 59, 999)),
      label: 'Ce mois-ci',
    };
  });

  // Determine page title based on route
  const path = location.pathname;
  let pageTitle = 'Finances';
  let pageSubtitle = 'Vue d\'ensemble financière';
  if (path.includes('/revenus')) { pageTitle = 'Revenus'; pageSubtitle = 'Analyse des revenus par service et produit'; }
  else if (path.includes('/depenses')) { pageTitle = 'Dépenses'; pageSubtitle = 'Suivi des dépenses courantes et récurrentes'; }
  else if (path.includes('/journal')) { pageTitle = 'Journal'; pageSubtitle = 'Historique complet des écritures'; }

  return (
    <div className="w-full relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Page content */}
      <Outlet context={{ dateRange, setDateRange } satisfies FinancesOutletContext} />
    </div>
  );
};
```

- [ ] **Step 2: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/FinancesLayout.tsx
git commit -m "feat: implement FinancesLayout with shared date range picker"
```

---

### Task 4: MiniKpiRow — Reusable KPI Card Component

**Files:**
- Create: `modules/accounting/components/MiniKpiRow.tsx`

- [ ] **Step 1: Create the reusable component**

```tsx
import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatPrice } from '../../../lib/format';

interface KpiItem {
  title: string;
  value: number | string;
  format?: 'price' | 'number' | 'percent' | 'raw';
  trend?: number | null;
  invertTrend?: boolean; // true = lower is better (e.g., expenses)
  subtitle?: string;
}

interface MiniKpiRowProps {
  items: KpiItem[];
}

export const MiniKpiRow: React.FC<MiniKpiRowProps> = ({ items }) => {
  const formatValue = (value: number | string, format?: string) => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'price': return formatPrice(value);
      case 'percent': return `${value.toFixed(1)}%`;
      case 'number': return value.toLocaleString('fr-FR');
      default: return formatPrice(value);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {items.map((item, idx) => {
        const isPositive = item.trend != null
          ? item.invertTrend ? item.trend <= 0 : item.trend >= 0
          : true;

        return (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{item.title}</span>
              {item.trend != null && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {Math.abs(item.trend).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatValue(item.value, item.format)}
            </div>
            {item.subtitle && <div className="text-[11px] text-slate-400 mt-1">{item.subtitle}</div>}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/components/MiniKpiRow.tsx
git commit -m "feat: add MiniKpiRow reusable KPI card component"
```

---

### Task 5: Enhanced useAccounting Hook — Revenue Breakdowns + Payment Methods

**Files:**
- Modify: `modules/accounting/hooks/useAccounting.ts`

**Important:** `CartItem` (transaction items) do NOT have `categoryId` or `categoryName` fields — only `referenceId` (which points to a service or product ID). To resolve categories, we import `useServices()` and `useProducts()` hooks and build lookup maps from `referenceId` → category info.

- [ ] **Step 1: Import service/product hooks and build lookup maps**

At the top of `useAccounting.ts`, add the imports:

```tsx
import { useServices } from '../../services/hooks/useServices';
import { useProducts } from '../../products/hooks/useProducts';
```

Inside the hook function, after the existing queries, add lookup maps:

```tsx
// Fetch services and products for category resolution
const { services } = useServices();
const { products } = useProducts();

// Build lookup maps: referenceId → { categoryId, categoryName }
const serviceCategoryMap = useMemo(() => {
  const map = new Map<string, { categoryId: string; categoryName: string }>();
  (services || []).forEach((svc: any) => {
    map.set(svc.id, {
      categoryId: svc.categoryId || 'uncategorized',
      categoryName: svc.categoryName || 'Non catégorisé',
    });
  });
  return map;
}, [services]);

const productCategoryMap = useMemo(() => {
  const map = new Map<string, { categoryId: string; categoryName: string }>();
  (products || []).forEach((prod: any) => {
    map.set(prod.id, {
      categoryId: prod.categoryId || 'uncategorized',
      categoryName: prod.categoryName || 'Non catégorisé',
    });
  });
  return map;
}, [products]);
```

- [ ] **Step 2: Add revenue breakdown computations using lookup maps**

Add these new computations after the existing `financials` useMemo (after line 140):

```tsx
// --- Revenue by Service Category ---
const revenueByServiceCategory = useMemo(() => {
  const map = new Map<string, { categoryId: string; categoryName: string; count: number; revenue: number; services: Map<string, { name: string; variantName?: string; count: number; revenue: number }> }>();

  data.current.transactions.forEach((t: any) => {
    t.items.forEach((item: any) => {
      if (item.type !== 'SERVICE') return;
      // Resolve category via lookup map (referenceId → service → category)
      const lookup = serviceCategoryMap.get(item.referenceId);
      const catId = lookup?.categoryId || 'uncategorized';
      const catName = lookup?.categoryName || 'Non catégorisé';
      if (!map.has(catId)) {
        map.set(catId, { categoryId: catId, categoryName: catName, count: 0, revenue: 0, services: new Map() });
      }
      const cat = map.get(catId)!;
      cat.count += item.quantity || 1;
      cat.revenue += item.price * (item.quantity || 1);

      const serviceKey = item.referenceId || item.name;
      if (!cat.services.has(serviceKey)) {
        cat.services.set(serviceKey, { name: item.name, variantName: item.variantName, count: 0, revenue: 0 });
      }
      const svc = cat.services.get(serviceKey)!;
      svc.count += item.quantity || 1;
      svc.revenue += item.price * (item.quantity || 1);
    });
  });

  return Array.from(map.values())
    .map(cat => ({
      ...cat,
      services: Array.from(cat.services.values()).sort((a, b) => b.revenue - a.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}, [data.current.transactions, serviceCategoryMap]);

// --- Revenue by Product Category ---
const revenueByProductCategory = useMemo(() => {
  const map = new Map<string, { categoryId: string; categoryName: string; count: number; revenue: number; products: Map<string, { name: string; count: number; revenue: number }> }>();

  data.current.transactions.forEach((t: any) => {
    t.items.forEach((item: any) => {
      if (item.type !== 'PRODUCT') return;
      // Resolve category via lookup map (referenceId → product → category)
      const lookup = productCategoryMap.get(item.referenceId);
      const catId = lookup?.categoryId || 'uncategorized';
      const catName = lookup?.categoryName || 'Non catégorisé';
      if (!map.has(catId)) {
        map.set(catId, { categoryId: catId, categoryName: catName, count: 0, revenue: 0, products: new Map() });
      }
      const cat = map.get(catId)!;
      cat.count += item.quantity || 1;
      cat.revenue += item.price * (item.quantity || 1);

      const prodKey = item.referenceId || item.name;
      if (!cat.products.has(prodKey)) {
        cat.products.set(prodKey, { name: item.name, count: 0, revenue: 0 });
      }
      const prod = cat.products.get(prodKey)!;
      prod.count += item.quantity || 1;
      prod.revenue += item.price * (item.quantity || 1);
    });
  });

  return Array.from(map.values())
    .map(cat => ({
      ...cat,
      products: Array.from(cat.products.values()).sort((a, b) => b.revenue - a.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}, [data.current.transactions, productCategoryMap]);

// --- Payment Method Breakdown ---
const paymentMethodBreakdown = useMemo(() => {
  const map = new Map<string, number>();
  data.current.transactions.forEach((t: any) => {
    (t.payments || []).forEach((p: any) => {
      map.set(p.method, (map.get(p.method) || 0) + p.amount);
    });
  });
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  return Array.from(map.entries())
    .map(([method, amount]) => ({ method, amount, percent: total > 0 ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}, [data.current.transactions]);

// --- Service/Product Revenue Totals ---
const serviceRevenue = useMemo(() => {
  let total = 0, count = 0;
  data.current.transactions.forEach((t: any) => {
    t.items.forEach((item: any) => {
      if (item.type === 'SERVICE') {
        total += item.price * (item.quantity || 1);
        count += item.quantity || 1;
      }
    });
  });
  return { total, count, avgPrice: count > 0 ? total / count : 0 };
}, [data.current.transactions]);

const productRevenue = useMemo(() => {
  let total = 0, count = 0;
  data.current.transactions.forEach((t: any) => {
    t.items.forEach((item: any) => {
      if (item.type === 'PRODUCT') {
        total += item.price * (item.quantity || 1);
        count += item.quantity || 1;
      }
    });
  });
  return { total, count, avgPrice: count > 0 ? total / count : 0 };
}, [data.current.transactions]);

// --- Previous period service/product revenue (for trends) ---
const prevServiceRevenue = useMemo(() => {
  let total = 0, count = 0;
  data.previous.transactions.forEach((t: any) => {
    t.items.forEach((item: any) => {
      if (item.type === 'SERVICE') {
        total += item.price * (item.quantity || 1);
        count += item.quantity || 1;
      }
    });
  });
  return { total, count, avgPrice: count > 0 ? total / count : 0 };
}, [data.previous.transactions]);

const prevProductRevenue = useMemo(() => {
  let total = 0, count = 0;
  data.previous.transactions.forEach((t: any) => {
    t.items.forEach((item: any) => {
      if (item.type === 'PRODUCT') {
        total += item.price * (item.quantity || 1);
        count += item.quantity || 1;
      }
    });
  });
  return { total, count, avgPrice: count > 0 ? total / count : 0 };
}, [data.previous.transactions]);

// --- Unique + New Clients ---
const clientMetrics = useMemo(() => {
  const currentClientIds = new Set<string>();
  data.current.transactions.forEach((t: any) => {
    if (t.clientId) currentClientIds.add(t.clientId);
  });

  // Find each client's first transaction date across ALL transactions
  const firstTransactionByClient = new Map<string, number>();
  transactions.forEach((t: any) => {
    if (!t.clientId) return;
    const time = new Date(t.date).getTime();
    const existing = firstTransactionByClient.get(t.clientId);
    if (!existing || time < existing) {
      firstTransactionByClient.set(t.clientId, time);
    }
  });

  const from = new Date(dateRange.from).getTime();
  const to = new Date(dateRange.to).getTime();
  let newClients = 0;
  currentClientIds.forEach(clientId => {
    const firstDate = firstTransactionByClient.get(clientId);
    if (firstDate && firstDate >= from && firstDate <= to) {
      newClients++;
    }
  });

  return { uniqueClients: currentClientIds.size, newClients };
}, [data.current.transactions, transactions, dateRange]);

// --- Top Products ---
const topProducts = useMemo(() => {
  const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
  data.current.transactions.forEach((t: any) => {
    t.items.forEach((i: any) => {
      if (i.type === 'PRODUCT') {
        const key = i.referenceId || i.name;
        if (!productSales[key]) productSales[key] = { name: i.name, count: 0, revenue: 0 };
        productSales[key].count += i.quantity || 1;
        productSales[key].revenue += i.price * (i.quantity || 1);
      }
    });
  });
  return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
}, [data.current.transactions]);
```

- [ ] **Step 2: Extract calcTrend to module scope**

Move `calcTrend` from inside the `financials` useMemo to module scope (before the hook function) so it can be reused:

```tsx
// Add before export const useAccounting
const calcTrend = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;
```

Remove the duplicate definition from inside the `financials` useMemo.

- [ ] **Step 3: Update the return value**

Replace the return block (lines 217-227) with:

```tsx
return {
  dateRange,
  setDateRange,
  filteredTransactions: data.current.transactions,
  filteredExpenses: data.current.expenses,
  financials,
  ledgerData,
  chartData,
  addExpense,
  // New for Phase 1:
  revenueByServiceCategory,
  revenueByProductCategory,
  paymentMethodBreakdown,
  serviceRevenue,
  productRevenue,
  prevServiceRevenue,
  prevProductRevenue,
  clientMetrics,
  topProducts,
  calcTrend,
};
```

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (new values are exported but not yet consumed).

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/hooks/useAccounting.ts
git commit -m "feat: add revenue breakdowns, payment methods, and client metrics to useAccounting"
```

---

### Task 6: FinancesOverview — Analytical Dashboard

**Files:**
- Modify: `modules/accounting/components/FinancesOverview.tsx`

- [ ] **Step 1: Implement the full overview page**

Replace the stub with the complete analytical dashboard. This is a large component — it replaces the old `AccountingOverview.tsx`:

```tsx
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Users as UsersIcon, Receipt, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { useAccounting } from '../hooks/useAccounting';
import { MiniKpiRow } from './MiniKpiRow';
import { formatPrice } from '../../../lib/format';
import type { FinancesOutletContext } from '../FinancesLayout';

const CATEGORY_COLORS = ['#0f172a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444'];

const PaymentMethodBar: React.FC<{ data: { method: string; amount: number; percent: number }[] }> = ({ data }) => (
  <div className="space-y-3">
    {data.map((item, idx) => (
      <div key={item.method}>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-slate-700">{item.method}</span>
          <span className="text-slate-500">{formatPrice(item.amount)} ({item.percent.toFixed(0)}%)</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${item.percent}%`, backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
          />
        </div>
      </div>
    ))}
    {data.length === 0 && <div className="text-sm text-slate-400 text-center py-4">Aucune donnée</div>}
  </div>
);

const RankedList: React.FC<{ title: string; items: { name: string; count: number; revenue: number }[] }> = ({ title, items }) => {
  const maxRevenue = items.length > 0 ? items[0].revenue : 1;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.name} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-700 truncate pr-2">{i + 1}. {item.name}</span>
              <span className="font-medium text-slate-900 whitespace-nowrap">{formatPrice(item.revenue)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: `${(item.revenue / maxRevenue) * 100}%` }} />
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-slate-400">Aucune donnée</li>}
      </ul>
    </div>
  );
};

export const FinancesOverview: React.FC = () => {
  const { dateRange } = useOutletContext<FinancesOutletContext>();
  const {
    financials, chartData, revenueByServiceCategory, paymentMethodBreakdown,
    clientMetrics, topProducts, serviceRevenue, productRevenue, calcTrend,
  } = useAccounting();

  // Donut data: service categories + products as one slice
  const donutData = [
    ...revenueByServiceCategory.map((cat, idx) => ({
      name: cat.categoryName,
      value: cat.revenue,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    })),
    ...(productRevenue.total > 0 ? [{ name: 'Produits', value: productRevenue.total, color: '#f59e0b' }] : []),
  ];

  // Top 5 services for ranked list
  const topServicesList: { name: string; count: number; revenue: number }[] = [];
  revenueByServiceCategory.forEach(cat => {
    cat.services.forEach(svc => {
      topServicesList.push(svc);
    });
  });
  topServicesList.sort((a, b) => b.revenue - a.revenue);
  const top5Services = topServicesList.slice(0, 5);

  const margin = financials.revenue > 0 ? ((financials.netProfit / financials.revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKpiRow items={[
          { title: "Chiffre d'Affaires", value: financials.revenue, trend: financials.revenueTrend },
          { title: 'Bénéfice Net', value: financials.netProfit, trend: financials.netProfitTrend, subtitle: `marge ${margin}%` },
          { title: 'Dépenses Totales', value: financials.opex, trend: financials.opexTrend, invertTrend: true },
          { title: 'Panier Moyen', value: financials.avgBasket, trend: financials.avgBasketTrend, subtitle: `${financials.transactionCount} transactions` },
        ]} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Évolution du CA</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} cursor={{ fill: '#f8fafc' }} formatter={(value: number) => formatPrice(value)} />
                <Bar dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Répartition par Catégorie</h3>
          <div className="h-64 flex items-center">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {donutData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatPrice(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full text-center text-sm text-slate-400">Aucune donnée</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Flux de Trésorerie</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} formatter={(value: number) => formatPrice(value)} />
                <Line type="monotone" dataKey="sales" stroke="#0f172a" strokeWidth={2} dot={false} name="Revenus" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Dépenses" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Moyens de Paiement</h3>
          <PaymentMethodBar data={paymentMethodBreakdown} />
        </div>
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RankedList title="Top 5 Services" items={top5Services} />
        <RankedList title="Top 5 Produits" items={topProducts} />

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Clients Servis</h3>
          <div className="text-3xl font-bold text-slate-900 mb-1">{clientMetrics.uniqueClients}</div>
          <div className="text-xs text-slate-500">
            {clientMetrics.newClients > 0 && (
              <span className="text-emerald-600 font-medium">{clientMetrics.newClients} nouveaux</span>
            )}
            {clientMetrics.newClients === 0 && 'cette période'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">TVA Estimée</h3>
          <div className="text-3xl font-bold text-slate-900 mb-1">{formatPrice(financials.vatDue)}</div>
          <div className="text-xs text-slate-500">À provisionner</div>
        </div>
      </div>
    </div>
  );
};
```

Note: The KPI row at the top uses `MiniKpiRow` but wraps it in a 4-column grid. Actually, `MiniKpiRow` renders a 3-column grid. For the overview, we need 4 KPIs. Update the overview to render the 4 KPIs directly instead of using `MiniKpiRow`:

Replace the KPIs section with direct rendering using the `MetricCard` pattern inline (same style as MiniKpiRow but in a 4-col grid). The simplest approach: just render 4 cards directly using the same styling from MiniKpiRow.

- [ ] **Step 2: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/components/FinancesOverview.tsx
git commit -m "feat: implement analytical FinancesOverview with charts and KPIs"
```

---

### Task 7: RevenuesPage — Service & Product Revenue Breakdowns

**Files:**
- Modify: `modules/accounting/components/RevenuesPage.tsx`
- Create: `modules/accounting/components/RevenueCategoryTable.tsx`

- [ ] **Step 1: Create RevenueCategoryTable (shared expandable table)**

```tsx
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Lock } from 'lucide-react';
import { formatPrice } from '../../../lib/format';

interface CategoryRow {
  categoryId: string;
  categoryName: string;
  count: number;
  revenue: number;
  items: { name: string; variantName?: string; count: number; revenue: number }[];
}

interface RevenueCategoryTableProps {
  data: CategoryRow[];
  totalRevenue: number;
  itemLabel?: string; // "prestations" or "articles"
}

export const RevenueCategoryTable: React.FC<RevenueCategoryTableProps> = ({ data, totalRevenue, itemLabel = 'prestations' }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
        Aucune donnée pour cette période
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-xs font-semibold text-slate-500 uppercase">
            <th className="px-4 py-3 w-8"></th>
            <th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3 text-right">Nb {itemLabel}</th>
            <th className="px-4 py-3 text-right">CA</th>
            <th className="px-4 py-3 text-right">% du total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map(cat => {
            const isExpanded = expandedIds.has(cat.categoryId);
            const percent = totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0;

            return (
              <React.Fragment key={cat.categoryId}>
                <tr
                  className="hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                  onClick={() => toggleExpand(cat.categoryId)}
                >
                  <td className="px-4 py-3 text-slate-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{cat.categoryName}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{cat.count}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(cat.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{percent.toFixed(1)}%</td>
                </tr>
                {isExpanded && cat.items.map((item, idx) => (
                  <tr key={`${cat.categoryId}-${idx}`} className="bg-slate-50/50 text-sm">
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-slate-600 pl-8">
                      {item.name}
                      {item.variantName && <span className="text-slate-400 text-xs ml-1">({item.variantName})</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">{item.count}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{formatPrice(item.revenue)}</td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      {totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Implement RevenuesPage**

Replace the stub:

```tsx
import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAccounting } from '../hooks/useAccounting';
import { MiniKpiRow } from './MiniKpiRow';
import { RevenueCategoryTable } from './RevenueCategoryTable';
import type { FinancesOutletContext } from '../FinancesLayout';

type MainTab = 'SERVICES' | 'PRODUCTS';
type ServiceSubTab = 'PAR_CATEGORIE' | 'PAR_EQUIPE';
type ProductSubTab = 'PAR_CATEGORIE' | 'TOUS' | 'PAR_EQUIPE';

export const RevenuesPage: React.FC = () => {
  const { dateRange } = useOutletContext<FinancesOutletContext>();
  const {
    serviceRevenue, productRevenue,
    prevServiceRevenue, prevProductRevenue,
    revenueByServiceCategory, revenueByProductCategory,
    calcTrend,
  } = useAccounting();

  const [mainTab, setMainTab] = useState<MainTab>('SERVICES');
  const [serviceSubTab, setServiceSubTab] = useState<ServiceSubTab>('PAR_CATEGORIE');
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>('PAR_CATEGORIE');

  const serviceCategoryData = revenueByServiceCategory.map(cat => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    count: cat.count,
    revenue: cat.revenue,
    items: cat.services,
  }));

  const productCategoryData = revenueByProductCategory.map(cat => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    count: cat.count,
    revenue: cat.revenue,
    items: cat.products.map(p => ({ name: p.name, count: p.count, revenue: p.revenue })),
  }));

  // Flat product list for "Tous les produits"
  const allProducts = revenueByProductCategory.flatMap(cat =>
    cat.products.map(p => ({ ...p, categoryName: cat.categoryName }))
  ).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Main Tabs: Services | Produits */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'SERVICES' as MainTab, label: 'Services' },
          { id: 'PRODUCTS' as MainTab, label: 'Produits' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mainTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === SERVICES TAB === */}
      {mainTab === 'SERVICES' && (
        <>
          <MiniKpiRow items={[
            { title: 'CA Services', value: serviceRevenue.total, trend: calcTrend(serviceRevenue.total, prevServiceRevenue.total) },
            { title: 'Prestations', value: serviceRevenue.count, format: 'number', trend: calcTrend(serviceRevenue.count, prevServiceRevenue.count) },
            { title: 'Prix Moyen', value: serviceRevenue.avgPrice, trend: calcTrend(serviceRevenue.avgPrice, prevServiceRevenue.avgPrice) },
          ]} />

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {[
              { id: 'PAR_CATEGORIE' as ServiceSubTab, label: 'Par catégorie' },
              { id: 'PAR_EQUIPE' as ServiceSubTab, label: 'Par équipe', disabled: true },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setServiceSubTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  tab.disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : serviceSubTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.disabled && <Lock size={10} />}
                {tab.label}
              </button>
            ))}
          </div>

          {serviceSubTab === 'PAR_CATEGORIE' && (
            <RevenueCategoryTable
              data={serviceCategoryData}
              totalRevenue={serviceRevenue.total}
              itemLabel="prestations"
            />
          )}

          {serviceSubTab === 'PAR_EQUIPE' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Lock size={24} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Activez le suivi par équipe dans la Caisse pour débloquer cette vue</p>
            </div>
          )}
        </>
      )}

      {/* === PRODUCTS TAB === */}
      {mainTab === 'PRODUCTS' && (
        <>
          <MiniKpiRow items={[
            { title: 'CA Produits', value: productRevenue.total, trend: calcTrend(productRevenue.total, prevProductRevenue.total) },
            { title: 'Articles Vendus', value: productRevenue.count, format: 'number', trend: calcTrend(productRevenue.count, prevProductRevenue.count) },
            { title: 'Prix Moyen', value: productRevenue.avgPrice, trend: calcTrend(productRevenue.avgPrice, prevProductRevenue.avgPrice) },
          ]} />

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {[
              { id: 'PAR_CATEGORIE' as ProductSubTab, label: 'Par catégorie' },
              { id: 'TOUS' as ProductSubTab, label: 'Tous les produits' },
              { id: 'PAR_EQUIPE' as ProductSubTab, label: 'Par équipe', disabled: true },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setProductSubTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  tab.disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : productSubTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.disabled && <Lock size={10} />}
                {tab.label}
              </button>
            ))}
          </div>

          {productSubTab === 'PAR_CATEGORIE' && (
            <RevenueCategoryTable
              data={productCategoryData}
              totalRevenue={productRevenue.total}
              itemLabel="articles"
            />
          )}

          {productSubTab === 'TOUS' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3">Catégorie</th>
                    <th className="px-4 py-3 text-right">Qté vendue</th>
                    <th className="px-4 py-3 text-right">CA</th>
                    <th className="px-4 py-3 text-right">% du total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-slate-500">{p.categoryName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{p.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(p.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {productRevenue.total > 0 ? ((p.revenue / productRevenue.total) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                  {allProducts.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Aucune donnée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {productSubTab === 'PAR_EQUIPE' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Lock size={24} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Activez le suivi par équipe dans la Caisse pour débloquer cette vue</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/components/RevenuesPage.tsx modules/accounting/components/RevenueCategoryTable.tsx
git commit -m "feat: implement Revenus page with category breakdowns and expandable tables"
```

---

### Task 8: DepensesPage — Courantes + Récurrentes Tabs

**Files:**
- Modify: `modules/accounting/components/DepensesPage.tsx`
- Create: `modules/accounting/components/DepensesRecurrentes.tsx`

- [ ] **Step 1: Create DepensesRecurrentes component**

This is the recurring expenses component moved from AccountingSettings. Uses the same `useSettings()` hook:

```tsx
import React, { useState } from 'react';
import { Plus, Trash2, RefreshCw, Zap, Info } from 'lucide-react';
import { useSettings } from '../../settings/hooks/useSettings';
import { Input, Select } from '../../../components/FormElements';
import { MiniKpiRow } from './MiniKpiRow';
import { formatPrice } from '../../../lib/format';
import type { RecurringExpense } from '../../../types';

export const DepensesRecurrentes: React.FC = () => {
  const { recurringExpenses, updateRecurringExpenses, salonSettings } = useSettings();
  const [isAdding, setIsAdding] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<RecurringExpense>>({
    name: '', amount: 0, frequency: 'Mensuel', nextDate: new Date().toISOString().slice(0, 10),
  });

  const handleAdd = () => {
    if (!newExpense.name || !newExpense.amount) return;
    updateRecurringExpenses([...recurringExpenses, {
      id: crypto.randomUUID(),
      name: newExpense.name!,
      amount: Number(newExpense.amount),
      frequency: newExpense.frequency as RecurringExpense['frequency'],
      nextDate: newExpense.nextDate || new Date().toISOString(),
    }]);
    setIsAdding(false);
    setNewExpense({ name: '', amount: 0, frequency: 'Mensuel', nextDate: new Date().toISOString().slice(0, 10) });
  };

  const handleDelete = (id: string) => {
    updateRecurringExpenses(recurringExpenses.filter(r => r.id !== id));
  };

  // KPI calculations
  const monthlyTotal = recurringExpenses
    .filter(r => r.frequency === 'Mensuel')
    .reduce((sum, r) => sum + r.amount, 0);
  const annualTotal = recurringExpenses
    .filter(r => r.frequency === 'Annuel')
    .reduce((sum, r) => sum + r.amount, 0);

  // Next upcoming expense
  const now = new Date();
  const sortedByDate = [...recurringExpenses]
    .filter(r => new Date(r.nextDate) >= now)
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
  const nextExpense = sortedByDate[0];
  const daysUntilNext = nextExpense
    ? Math.ceil((new Date(nextExpense.nextDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Next payment alert */}
      {nextExpense && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          daysUntilNext! <= 3 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <Zap size={16} className={daysUntilNext! <= 3 ? 'text-amber-500' : 'text-slate-400'} />
          <span className="text-sm font-medium">
            Prochaine échéance : <strong>{nextExpense.name}</strong> — {formatPrice(nextExpense.amount)} — dans {daysUntilNext} jour{daysUntilNext! > 1 ? 's' : ''} ({new Date(nextExpense.nextDate).toLocaleDateString('fr-FR')})
          </span>
        </div>
      )}

      {/* KPIs */}
      <MiniKpiRow items={[
        { title: 'Charges Mensuelles', value: monthlyTotal, subtitle: '/mois' },
        { title: 'Charges Annuelles', value: annualTotal, subtitle: '/an' },
        { title: 'Nb Charges Actives', value: recurringExpenses.length, format: 'number' },
      ]} />

      {/* Info banner */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>Les charges récurrentes sont un aide-mémoire. Saisissez-les dans « Courantes » à chaque échéance.</span>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all">
            <Plus size={16} /> Nouvelle Charge
          </button>
        )}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in slide-in-from-top-2">
          <h4 className="text-sm font-bold text-slate-800 mb-3">Nouvelle charge</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input label="Nom" value={newExpense.name} onChange={e => setNewExpense({ ...newExpense, name: e.target.value })} placeholder="Ex: Loyer" />
            <Input label="Montant" type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })} />
            <Select label="Fréquence" value={newExpense.frequency} onChange={(val) => setNewExpense({ ...newExpense, frequency: val as any })} options={[
              { value: 'Mensuel', label: 'Mensuel' },
              { value: 'Annuel', label: 'Annuel' },
              { value: 'Hebdomadaire', label: 'Hebdomadaire' },
            ]} />
            <Input label="Prochaine échéance" type="date" value={newExpense.nextDate} onChange={e => setNewExpense({ ...newExpense, nextDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAdd} className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800">Confirmer</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-semibold text-slate-500 uppercase">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Fréquence</th>
              <th className="px-4 py-3">Prochaine</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recurringExpenses.map(rec => (
              <tr key={rec.id} className="text-sm hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3 font-medium text-slate-900">{rec.name}</td>
                <td className="px-4 py-3 text-slate-600 font-medium">{formatPrice(rec.amount)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                    <RefreshCw size={10} /> {rec.frequency}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(rec.nextDate).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(rec.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {recurringExpenses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Aucune charge récurrente</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Implement DepensesPage**

Replace the stub:

```tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAccounting } from '../hooks/useAccounting';
import { MiniKpiRow } from './MiniKpiRow';
import { AccountingExpenses } from './AccountingExpenses';
import { ExpenseForm } from './ExpenseForm';
import { DepensesRecurrentes } from './DepensesRecurrentes';
import type { FinancesOutletContext } from '../FinancesLayout';
import type { Expense } from '../../../types';

type Tab = 'COURANTES' | 'RECURRENTES';

export const DepensesPage: React.FC = () => {
  const { dateRange } = useOutletContext<FinancesOutletContext>();
  const { filteredExpenses, addExpense, financials, calcTrend } = useAccounting();

  const [activeTab, setActiveTab] = useState<Tab>('COURANTES');
  const [showForm, setShowForm] = useState(false);

  const expenseCount = filteredExpenses.length;
  const expenseTotal = financials.opex;
  const avgExpense = expenseCount > 0 ? expenseTotal / expenseCount : 0;

  const handleAddExpense = (expense: Expense) => {
    addExpense(expense);
    setShowForm(false);
  };

  if (showForm) {
    return <ExpenseForm onSave={handleAddExpense} onCancel={() => setShowForm(false)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-slate-200">
          {[
            { id: 'COURANTES' as Tab, label: 'Courantes' },
            { id: 'RECURRENTES' as Tab, label: 'Récurrentes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'COURANTES' && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} /> Nouvelle Dépense
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'COURANTES' && (
        <>
          <MiniKpiRow items={[
            { title: 'Total Dépenses', value: expenseTotal, trend: financials.opexTrend, invertTrend: true },
            { title: 'Nb Dépenses', value: expenseCount, format: 'number' },
            { title: 'Moyenne par Dépense', value: avgExpense },
          ]} />
          <AccountingExpenses expenses={filteredExpenses} />
        </>
      )}

      {activeTab === 'RECURRENTES' && <DepensesRecurrentes />}
    </div>
  );
};
```

- [ ] **Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/components/DepensesPage.tsx modules/accounting/components/DepensesRecurrentes.tsx
git commit -m "feat: implement Dépenses page with Courantes and Récurrentes tabs"
```

---

### Task 9: JournalPage — Ledger with Filters and Export

**Files:**
- Modify: `modules/accounting/components/JournalPage.tsx`

- [ ] **Step 1: Implement JournalPage**

Replace the stub:

```tsx
import React, { useState, useMemo } from 'react';
import { Filter, Search, Download, FileText, Database, X } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAccounting } from '../hooks/useAccounting';
import { useSettings } from '../../settings/hooks/useSettings';
import { MiniKpiRow } from './MiniKpiRow';
import { AccountingLedger } from './AccountingLedger';
import { formatPrice } from '../../../lib/format';
import type { FinancesOutletContext } from '../FinancesLayout';

export const JournalPage: React.FC = () => {
  const { dateRange } = useOutletContext<FinancesOutletContext>();
  const { ledgerData, financials } = useAccounting();
  const { expenseCategories } = useSettings();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filter ledger data
  const filteredLedger = useMemo(() => {
    let data = ledgerData;
    if (filterType !== 'ALL') {
      data = data.filter(e => e.type === filterType);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(e => e.label.toLowerCase().includes(term));
    }
    return data;
  }, [ledgerData, filterType, searchTerm]);

  const totalCredit = ledgerData.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const totalDebit = ledgerData.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

  const handleExportCSV = () => {
    const headers = 'Date,Type,Libellé,Catégorie,Débit,Crédit\n';
    const rows = ledgerData.map(e =>
      `${new Date(e.date).toLocaleDateString()},${e.type === 'INCOME' ? 'Recette' : 'Dépense'},"${e.label}","${e.category}",${e.type === 'EXPENSE' ? e.amount : ''},${e.type === 'INCOME' ? e.amount : ''}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* KPIs */}
      <MiniKpiRow items={[
        { title: 'Total Crédit', value: totalCredit },
        { title: 'Total Débit', value: totalDebit },
        { title: 'Solde Net', value: totalCredit - totalDebit },
      ]} />

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'ALL' as const, label: 'Tous' },
            { id: 'INCOME' as const, label: 'Recettes' },
            { id: 'EXPENSE' as const, label: 'Dépenses' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterType === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Export dropdown */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={16} /> Exporter
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-10">
                <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <FileText size={16} className="text-blue-500" /> Télécharger CSV
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <Database size={16} className="text-emerald-500" /> Générer fichier FEC
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ledger table */}
      <AccountingLedger data={filteredLedger} />
    </div>
  );
};
```

- [ ] **Step 2: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/components/JournalPage.tsx
git commit -m "feat: implement Journal page with filters and CSV export"
```

---

### Task 10: Settings Cleanup — Remove Duplicates

**Files:**
- Modify: `modules/settings/components/GeneralSettings.tsx`
- Modify: `modules/settings/components/AccountingSettings.tsx`

- [ ] **Step 1: Remove TVA field from GeneralSettings**

In `modules/settings/components/GeneralSettings.tsx`, remove the TVA input (lines 92-98). The "Préférences Financières" section should only contain the Devise dropdown:

```tsx
// Replace the grid at lines 78-99 with just the currency dropdown:
<Section title="Préférences Financières">
  <div className="max-w-xs">
    <Select
      label="Devise"
      value={formData.currency}
      onChange={(val) => setFormData({...formData, currency: val as string})}
      options={[
        { value: 'EUR', label: 'Euro (€)' },
        { value: 'USD', label: 'Dollar US ($)' },
        { value: 'MAD', label: 'Dirham Marocain (MAD)' },
        { value: 'GBP', label: 'Livre Sterling (£)' },
        { value: 'CAD', label: 'Dollar Canadien ($)' },
        { value: 'CHF', label: 'Franc Suisse (CHF)' }
      ]}
    />
  </div>
</Section>
```

- [ ] **Step 2: Simplify AccountingSettings to 2 tabs**

In `modules/settings/components/AccountingSettings.tsx`:

1. Remove the `RECURRING` and `EXPORT` entries from the tabs array (lines 78-82):

```tsx
{[
  { id: 'TAXES', label: 'Fiscalité', icon: Calculator },
  { id: 'CATEGORIES', label: 'Catégories', icon: Users },
].map((tab) => (
```

2. Update the state type: `useState<'TAXES' | 'CATEGORIES'>('TAXES')`

3. Remove the RECURRING tab content (lines 166-256) and the EXPORT tab content (lines 258-293).

4. Update the TAXES tab to remove the Devise dropdown and connect the TVA input to actual settings:

```tsx
{activeTab === 'TAXES' && (
  <div className="max-w-xl space-y-8 animate-in fade-in">
    <div>
      <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Fiscalité</h3>
      <div className="max-w-xs">
        <Input
          label="Taux de TVA (%)"
          type="number"
          suffix="%"
          value={salonSettings.vatRate}
          onChange={e => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) updateSalonSettings({ ...salonSettings, vatRate: val });
          }}
        />
      </div>
    </div>
  </div>
)}
```

5. Remove the unused imports: `RefreshCw`, `FileText`, `Database`, `RecurringExpense`, `Select`, and the recurring expense state/handlers.

6. Clean up the subtitle to reflect new scope:
```tsx
<p className="text-xs text-slate-500">Gérez vos taxes et catégories de dépenses</p>
```

- [ ] **Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/settings/components/GeneralSettings.tsx modules/settings/components/AccountingSettings.tsx
git commit -m "fix: remove duplicate TVA/Devise from settings, simplify AccountingSettings to 2 tabs"
```

---

### Task 11: Wire useAccounting to FinancesLayout Date Range

**Files:**
- Modify: `modules/accounting/hooks/useAccounting.ts`

The `useAccounting` hook currently manages its own date range state (lines 56-63). Since the date range now comes from `FinancesLayout` via `useOutletContext`, we need to support an optional external date range.

- [ ] **Step 1: Accept optional external date range**

Update the hook to accept an optional `dateRange` parameter. If provided, use it instead of internal state:

```tsx
// Change the hook signature:
export const useAccounting = (externalDateRange?: DateRange) => {
  // ... existing code ...

  // Replace the dateRange state (lines 56-63) with:
  const [internalDateRange, setInternalDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(new Date().setHours(23, 59, 59, 999)),
      label: 'Ce mois-ci',
    };
  });

  const dateRange = externalDateRange || internalDateRange;
  const setDateRange = setInternalDateRange;
```

This way, sub-pages that get the date range from `useOutletContext` don't need to pass it — they just call `useAccounting()` and it uses the same default. The hook is backward-compatible.

Actually, a simpler approach: since every sub-page now gets dateRange from the outlet context but the hook manages its own, the sub-pages should just use the hook as-is. The FinancesLayout date range IS the hook's date range — they're initialized to the same default.

However, the issue is that changing the date range in FinancesLayout won't affect the hook's internal state. The cleanest fix: make FinancesLayout use the hook directly.

- [ ] **Step 2: Lift useAccounting to FinancesLayout**

Update `FinancesLayout.tsx` to use `useAccounting` directly and pass its full return value through outlet context:

```tsx
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DateRangePicker } from '../../components/DateRangePicker';
import { useAccounting } from './hooks/useAccounting';

export type FinancesOutletContext = ReturnType<typeof useAccounting>;

export const FinancesLayout: React.FC = () => {
  const location = useLocation();
  const accounting = useAccounting();

  const path = location.pathname;
  let pageTitle = 'Finances';
  let pageSubtitle = 'Vue d\'ensemble financière';
  if (path.includes('/revenus')) { pageTitle = 'Revenus'; pageSubtitle = 'Analyse des revenus par service et produit'; }
  else if (path.includes('/depenses')) { pageTitle = 'Dépenses'; pageSubtitle = 'Suivi des dépenses courantes et récurrentes'; }
  else if (path.includes('/journal')) { pageTitle = 'Journal'; pageSubtitle = 'Historique complet des écritures'; }

  return (
    <div className="w-full relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker dateRange={accounting.dateRange} onChange={accounting.setDateRange} />
        </div>
      </div>
      <Outlet context={accounting} />
    </div>
  );
};
```

- [ ] **Step 3: Update all sub-pages to use the shared context**

Each sub-page should use `useOutletContext<FinancesOutletContext>()` instead of calling `useAccounting()` directly. Update each file:

In **FinancesOverview.tsx**, **RevenuesPage.tsx**, **DepensesPage.tsx**, **JournalPage.tsx**: replace `useAccounting()` calls with:

```tsx
import { useOutletContext } from 'react-router-dom';
import type { FinancesOutletContext } from '../FinancesLayout';

// Inside component:
const accounting = useOutletContext<FinancesOutletContext>();
// Then destructure what you need: const { financials, chartData, ... } = accounting;
```

This ensures all sub-pages share the same date range and data.

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/FinancesLayout.tsx modules/accounting/components/FinancesOverview.tsx modules/accounting/components/RevenuesPage.tsx modules/accounting/components/DepensesPage.tsx modules/accounting/components/JournalPage.tsx
git commit -m "refactor: lift useAccounting to FinancesLayout, share via outlet context"
```

---

### Task 12: Cleanup — Remove Old AccountingModule

**Files:**
- Delete: `modules/accounting/AccountingModule.tsx` (no longer imported anywhere after route change)
- Verify: no other files import it

- [ ] **Step 1: Check for remaining imports**

Search for any remaining references to `AccountingModule`:

Run: `grep -r "AccountingModule" --include="*.ts" --include="*.tsx" .`

Expected: Only the file itself and possibly `App.tsx` if it still has the old import.

- [ ] **Step 2: Remove the old file**

If no other files reference it (after the App.tsx route change in Task 1), delete `modules/accounting/AccountingModule.tsx`.

Also check if `modules/accounting/components/AccountingOverview.tsx` is still imported anywhere. If not, it can be deleted too (replaced by `FinancesOverview.tsx`).

- [ ] **Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds with no unused import warnings.

- [ ] **Step 4: Commit**

```bash
git rm modules/accounting/AccountingModule.tsx
# Only if not imported anywhere:
# git rm modules/accounting/components/AccountingOverview.tsx
git commit -m "chore: remove old AccountingModule replaced by FinancesLayout"
```

---

### Task 13: Final Integration Test

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 2: Dev server smoke test**

Run: `npm run dev` and verify:

1. Sidebar shows "Finances" with sub-items (Revenus, Dépenses, Journal)
2. Clicking "Finances" loads the analytical overview with KPIs, charts, donut
3. Clicking "Revenus" shows Services/Produits tabs with category breakdowns
4. Clicking "Dépenses" shows Courantes/Récurrentes tabs
5. Clicking "Journal" shows filtered ledger with export dropdown
6. Date range picker persists across sub-page navigation
7. Settings > Général only shows Devise (no TVA)
8. Settings > Comptabilité only shows Fiscalité and Catégories (no Récurrentes, no Export)
9. Old `/accounting` route redirects to `/finances`

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: complete Finances module restructure (Phase 1)"
```
