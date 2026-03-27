# Plan 5B: Data Tables & Date Pickers Mobile Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all data tables responsive with card/table view toggle and make date pickers fullscreen on mobile.

**Architecture:** Each list module gets a 3-file split (orchestrator + table + card). Orchestrators use the existing `useViewMode` hook and `ViewToggle` component from Plan 5A. Date pickers detect mobile via `useMediaQuery` and render fullscreen modals instead of dropdowns.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React icons, existing Plan 5A infrastructure (`useViewMode`, `ViewToggle`, `useMediaQuery`/`MediaQueryContext`)

**Intentionally deferred from spec (not in this plan):**
- Loading states (skeleton cards/rows) — fetching-layer concern, layered on separately
- Pagination ("Charger plus", page size 25) — changes data fetching hooks, not just UI
- Arrow key grid navigation in calendar — spec marks as stretch goal
- Appointment day-grouping in card view — spec says "gets its own specification"

---

## File Structure

### New Files
- `components/EmptyState.tsx` — Shared empty state for card and table views
- `modules/clients/components/ClientTable.tsx` — Extracted table from ClientList
- `modules/clients/components/ClientCard.tsx` — New card layout
- `modules/services/components/ServiceTable.tsx` — Extracted table from ServiceList
- `modules/services/components/ServiceCard.tsx` — New card layout
- `modules/products/components/ProductTable.tsx` — Extracted table from ProductList
- `modules/products/components/ProductCard.tsx` — New card layout
- `modules/team/components/TeamTable.tsx` — Extracted table from TeamList
- `modules/team/components/TeamCard.tsx` — Refactored from existing inline grid
- `modules/suppliers/components/SupplierTable.tsx` — Extracted table from SupplierList
- `modules/suppliers/components/SupplierCard.tsx` — New card layout
- `modules/appointments/components/AppointmentTable.tsx` — Extracted table (includes StatusBadge)
- `modules/appointments/components/AppointmentCard.tsx` — New card layout
- `modules/accounting/components/ExpenseTable.tsx` — Extracted table from AccountingExpenses
- `modules/accounting/components/ExpenseCard.tsx` — New card layout

### Modified Files
- `modules/clients/components/ClientList.tsx` — Becomes orchestrator (search + toggle + conditional render)
- `modules/services/components/ServiceList.tsx` — Becomes orchestrator
- `modules/products/components/ProductList.tsx` — Becomes orchestrator
- `modules/team/components/TeamList.tsx` — Becomes orchestrator, replace local GRID/LIST with useViewMode
- `modules/suppliers/components/SupplierList.tsx` — Becomes orchestrator
- `modules/appointments/components/AppointmentList.tsx` — Becomes orchestrator
- `modules/accounting/components/AccountingExpenses.tsx` — Becomes orchestrator
- `components/DatePicker.tsx` — Add fullscreen modal on mobile, fix z-index
- `components/DateRangePicker.tsx` — Add fullscreen modal on mobile, fix "Aujourd'hui" bug, single calendar on mobile

---

### Task 1: EmptyState Shared Component

**Files:**
- Create: `components/EmptyState.tsx`

- [ ] **Step 1: Create EmptyState component**

```tsx
// components/EmptyState.tsx
import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        {icon || <Inbox size={24} />}
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to EmptyState

- [ ] **Step 3: Commit**

```bash
git add components/EmptyState.tsx
git commit -m "feat: add shared EmptyState component for empty card/table views"
```

---

### Task 2: Clients — 3-File Split

**Files:**
- Create: `modules/clients/components/ClientTable.tsx`
- Create: `modules/clients/components/ClientCard.tsx`
- Modify: `modules/clients/components/ClientList.tsx`

- [ ] **Step 1: Create ClientTable — extract table from ClientList**

Extract the `<table>` from `ClientList.tsx` into its own component. This is a pure extraction — no logic changes.

```tsx
// modules/clients/components/ClientTable.tsx
import React from 'react';
import { Eye, Edit3, Calendar, ChevronRight } from 'lucide-react';
import { Client } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ClientTableProps {
  clients: Client[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    VIP: 'bg-amber-50 text-amber-700 border-amber-200',
    Régulier: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Nouveau: 'bg-blue-50 text-blue-700 border-blue-200',
    Inactif: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${styles[status] || styles['Nouveau']} shadow-sm`}>
      {status}
    </span>
  );
};

export const ClientTable: React.FC<ClientTableProps> = ({ clients, onViewDetails, onEdit, onSchedule }) => {
  if (clients.length === 0) {
    return <EmptyState title="Aucun client trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Client</th>
            <th className="px-6 py-3">Statut</th>
            <th className="px-6 py-3 hidden lg:table-cell">Téléphone</th>
            <th className="px-6 py-3 hidden xl:table-cell">Première Visite</th>
            <th className="px-6 py-3 hidden xl:table-cell">Dernière Visite</th>
            <th className="px-6 py-3 hidden lg:table-cell">Total Visites</th>
            <th className="px-6 py-3 hidden lg:table-cell">Total Dépensé</th>
            <th className="px-6 py-3 hidden xl:table-cell">Panier Moyen</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onViewDetails(client.id)}>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-slate-200 shrink-0">
                    {client.firstName[0]}{client.lastName[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{client.firstName} {client.lastName}</div>
                    <div className="text-xs text-slate-500">{client.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4"><StatusBadge status={client.status} /></td>
              <td className="px-6 py-4 hidden lg:table-cell text-sm text-slate-600">{client.phone}</td>
              <td className="px-6 py-4 hidden xl:table-cell text-sm text-slate-500">
                {client.firstVisitDate ? new Date(client.firstVisitDate).toLocaleDateString('fr-FR') : '-'}
              </td>
              <td className="px-6 py-4 hidden xl:table-cell text-sm text-slate-500">
                {client.lastVisitDate ? new Date(client.lastVisitDate).toLocaleDateString('fr-FR') : '-'}
              </td>
              <td className="px-6 py-4 hidden lg:table-cell text-sm font-medium text-slate-900">{client.totalVisits}</td>
              <td className="px-6 py-4 hidden lg:table-cell text-sm font-medium text-slate-900">{formatPrice(client.totalSpent)}</td>
              <td className="px-6 py-4 hidden xl:table-cell text-sm text-slate-600">
                {client.totalVisits > 0 ? formatPrice(client.totalSpent / client.totalVisits) : '-'}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={(e) => { e.stopPropagation(); onViewDetails(client.id); }} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" aria-label={`Voir ${client.firstName}`}>
                    <Eye size={15} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(client.id); }} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" aria-label={`Modifier ${client.firstName}`}>
                    <Edit3 size={15} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSchedule(client.id); }} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" aria-label={`Planifier pour ${client.firstName}`}>
                    <Calendar size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Create ClientCard**

```tsx
// modules/clients/components/ClientCard.tsx
import React from 'react';
import { Eye, Edit3, Calendar, Phone, Mail } from 'lucide-react';
import { Client } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ClientCardProps {
  clients: Client[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    VIP: 'bg-amber-50 text-amber-700 border-amber-200',
    Régulier: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Nouveau: 'bg-blue-50 text-blue-700 border-blue-200',
    Inactif: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${styles[status] || styles['Nouveau']} shadow-sm`}>
      {status}
    </span>
  );
};

export const ClientCard: React.FC<ClientCardProps> = ({ clients, onViewDetails, onEdit, onSchedule }) => {
  if (clients.length === 0) {
    return <EmptyState title="Aucun client trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {clients.map((client) => (
        <button
          key={client.id}
          onClick={() => onViewDetails(client.id)}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label={`${client.firstName} ${client.lastName}, ${client.status}, ${client.totalVisits} visites`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-slate-200 shrink-0">
                {client.firstName[0]}{client.lastName[0]}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{client.firstName} {client.lastName}</div>
                <StatusBadge status={client.status} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-500 mb-3">
            {client.phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={12} className="text-slate-400" />
                {client.phone}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail size={12} className="text-slate-400" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-slate-400">Visites</span>
                <span className="ml-1 font-semibold text-slate-900">{client.totalVisits}</span>
              </div>
              <div>
                <span className="text-slate-400">Dépensé</span>
                <span className="ml-1 font-semibold text-slate-900">{formatPrice(client.totalSpent)}</span>
              </div>
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onViewDetails(client.id)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" aria-label={`Voir ${client.firstName}`}>
                <Eye size={14} />
              </button>
              <button onClick={() => onEdit(client.id)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" aria-label={`Modifier ${client.firstName}`}>
                <Edit3 size={14} />
              </button>
              <button onClick={() => onSchedule(client.id)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" aria-label={`Planifier pour ${client.firstName}`}>
                <Calendar size={14} />
              </button>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Refactor ClientList to orchestrator**

Replace the table in `ClientList.tsx` with conditional rendering. Keep search bar and header. Add `useViewMode` and `ViewToggle`.

```tsx
// modules/clients/components/ClientList.tsx
import React, { useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Client } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ClientTable } from './ClientTable';
import { ClientCard } from './ClientCard';

interface ClientListProps {
  clients: Client[];
  onAdd: () => void;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
}

export const ClientList: React.FC<ClientListProps> = ({ clients, onAdd, onViewDetails, onEdit, onSchedule }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { viewMode, setViewMode } = useViewMode('clients');

  const filtered = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
           c.email.toLowerCase().includes(term) ||
           c.phone.includes(term);
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <button
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau Client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <ClientTable clients={filtered} onViewDetails={onViewDetails} onEdit={onEdit} onSchedule={onSchedule} />
        ) : (
          <ClientCard clients={filtered} onViewDetails={onViewDetails} onEdit={onEdit} onSchedule={onSchedule} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Client components

- [ ] **Step 5: Commit**

```bash
git add modules/clients/components/ClientTable.tsx modules/clients/components/ClientCard.tsx modules/clients/components/ClientList.tsx
git commit -m "feat: split ClientList into table/card views with useViewMode"
```

---

### Task 3: Services — 3-File Split

**Files:**
- Create: `modules/services/components/ServiceTable.tsx`
- Create: `modules/services/components/ServiceCard.tsx`
- Modify: `modules/services/components/ServiceList.tsx`

- [ ] **Step 1: Create ServiceTable — extract table from ServiceList**

```tsx
// modules/services/components/ServiceTable.tsx
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ServiceTableProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
}

export const ServiceTable: React.FC<ServiceTableProps> = ({ services, categories, onEdit }) => {
  if (services.length === 0) {
    return <EmptyState title="Aucun service trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Sans catégorie';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Service</th>
            <th className="px-6 py-3">Catégorie</th>
            <th className="px-6 py-3 hidden md:table-cell">Variantes</th>
            <th className="px-6 py-3">Prix</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => {
            const prices = service.variants.map(v => v.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);

            return (
              <tr key={service.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(service.id)}>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-900 text-sm">{service.name}</div>
                  {service.description && <div className="text-xs text-slate-500 truncate max-w-xs">{service.description}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex px-2.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs font-medium">
                    {getCategoryName(service.categoryId)}
                  </span>
                </td>
                <td className="px-6 py-4 hidden md:table-cell text-sm text-slate-600">{service.variants.length}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                  {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Create ServiceCard**

```tsx
// modules/services/components/ServiceCard.tsx
import React from 'react';
import { Layers } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ServiceCardProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ services, categories, onEdit }) => {
  if (services.length === 0) {
    return <EmptyState title="Aucun service trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Sans catégorie';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {services.map((service) => {
        const prices = service.variants.map(v => v.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        return (
          <button
            key={service.id}
            onClick={() => onEdit(service.id)}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`${service.name}, ${getCategoryName(service.categoryId)}, ${service.variants.length} variantes`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-slate-900 text-sm">{service.name}</div>
                {service.description && <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{service.description}</div>}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs font-medium">
                {getCategoryName(service.categoryId)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Layers size={12} />
                {service.variants.length} variante{service.variants.length > 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Refactor ServiceList to orchestrator**

```tsx
// modules/services/components/ServiceList.tsx
import React from 'react';
import { Plus, Search, Settings2 } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ServiceTable } from './ServiceTable';
import { ServiceCard } from './ServiceCard';

interface ServiceListProps {
  services: Service[];
  categories: ServiceCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onManageCategories: () => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({
  services, categories, searchTerm, onSearchChange, onAdd, onEdit, onManageCategories
}) => {
  const { viewMode, setViewMode } = useViewMode('services');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
        <div className="flex gap-2">
          <button
            onClick={onManageCategories}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Settings2 size={16} />
            <span className="hidden sm:inline">Catégories</span>
          </button>
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Service
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher un service..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <ServiceTable services={services} categories={categories} onEdit={onEdit} />
        ) : (
          <ServiceCard services={services} categories={categories} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Service components

- [ ] **Step 5: Commit**

```bash
git add modules/services/components/ServiceTable.tsx modules/services/components/ServiceCard.tsx modules/services/components/ServiceList.tsx
git commit -m "feat: split ServiceList into table/card views with useViewMode"
```

---

### Task 4: Products — 3-File Split

**Files:**
- Create: `modules/products/components/ProductTable.tsx`
- Create: `modules/products/components/ProductCard.tsx`
- Modify: `modules/products/components/ProductList.tsx`

- [ ] **Step 1: Create ProductTable — extract table from ProductList**

```tsx
// modules/products/components/ProductTable.tsx
import React from 'react';
import { Package, ChevronRight } from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ProductTableProps {
  products: Product[];
  categories: ProductCategory[];
  onEdit: (id: string) => void;
}

const StockBadge = ({ stock }: { stock: number }) => {
  if (stock === 0) return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">Épuisé</span>;
  if (stock < 10) return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">Faible ({stock})</span>;
  return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">En stock ({stock})</span>;
};

export const ProductTable: React.FC<ProductTableProps> = ({ products, categories, onEdit }) => {
  if (products.length === 0) {
    return <EmptyState title="Aucun produit trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Sans catégorie';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Produit</th>
            <th className="px-6 py-3">État du stock</th>
            <th className="px-6 py-3 hidden md:table-cell">Inventaire</th>
            <th className="px-6 py-3">Prix</th>
            <th className="px-6 py-3 hidden lg:table-cell">Fournisseur</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(product.id)}>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                    <Package size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{product.name}</div>
                    <div className="text-xs text-slate-500">{getCategoryName(product.categoryId)}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4"><StockBadge stock={product.stock} /></td>
              <td className="px-6 py-4 hidden md:table-cell">
                <div className="text-sm text-slate-900">{product.stock} unités</div>
                {product.sku && <div className="text-xs text-slate-400">SKU: {product.sku}</div>}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{formatPrice(product.price)}</td>
              <td className="px-6 py-4 hidden lg:table-cell text-sm text-slate-600">{product.supplier || '-'}</td>
              <td className="px-6 py-4 text-right">
                <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Create ProductCard**

```tsx
// modules/products/components/ProductCard.tsx
import React from 'react';
import { Package } from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ProductCardProps {
  products: Product[];
  categories: ProductCategory[];
  onEdit: (id: string) => void;
}

const StockBadge = ({ stock }: { stock: number }) => {
  if (stock === 0) return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">Épuisé</span>;
  if (stock < 10) return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">Faible ({stock})</span>;
  return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">En stock ({stock})</span>;
};

export const ProductCard: React.FC<ProductCardProps> = ({ products, categories, onEdit }) => {
  if (products.length === 0) {
    return <EmptyState title="Aucun produit trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Sans catégorie';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onEdit(product.id)}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label={`${product.name}, ${product.stock} en stock, ${formatPrice(product.price)}`}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-sm">{product.name}</div>
              <div className="text-xs text-slate-500">{getCategoryName(product.categoryId)}</div>
            </div>
          </div>

          <div className="mb-3">
            <StockBadge stock={product.stock} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {product.sku && <span>SKU: {product.sku}</span>}
            </div>
            <div className="text-sm font-semibold text-slate-900">{formatPrice(product.price)}</div>
          </div>
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Refactor ProductList to orchestrator**

```tsx
// modules/products/components/ProductList.tsx
import React from 'react';
import { Plus, Search, Settings2 } from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ProductTable } from './ProductTable';
import { ProductCard } from './ProductCard';

interface ProductListProps {
  products: Product[];
  categories: ProductCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onManageCategories: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products, categories, searchTerm, onSearchChange, onAdd, onEdit, onManageCategories
}) => {
  const { viewMode, setViewMode } = useViewMode('products');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
        <div className="flex gap-2">
          <button
            onClick={onManageCategories}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Settings2 size={16} />
            <span className="hidden sm:inline">Catégories</span>
          </button>
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Produit
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <ProductTable products={products} categories={categories} onEdit={onEdit} />
        ) : (
          <ProductCard products={products} categories={categories} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Product components

- [ ] **Step 5: Commit**

```bash
git add modules/products/components/ProductTable.tsx modules/products/components/ProductCard.tsx modules/products/components/ProductList.tsx
git commit -m "feat: split ProductList into table/card views with useViewMode"
```

---

### Task 5: Team — 3-File Split (Refactor Existing Grid)

**Files:**
- Create: `modules/team/components/TeamTable.tsx`
- Create: `modules/team/components/TeamCard.tsx`
- Modify: `modules/team/components/TeamList.tsx`

TeamList already has its own inline GRID/LIST toggle. We refactor it to use the shared `useViewMode` hook and extract both views.

- [ ] **Step 1: Read current TeamList for exact code**

Run: `cat /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b/modules/team/components/TeamList.tsx`

This step ensures the implementer has the exact current code before extracting.

- [ ] **Step 2: Create TeamTable — extract LIST view from TeamList**

```tsx
// modules/team/components/TeamTable.tsx
import React from 'react';
import { ChevronRight, Mail, Phone } from 'lucide-react';
import { StaffMember, Appointment } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface TeamTableProps {
  team: StaffMember[];
  appointments: Appointment[];
  onEdit: (id: string) => void;
}

export const TeamTable: React.FC<TeamTableProps> = ({ team, appointments, onEdit }) => {
  if (team.length === 0) {
    return <EmptyState title="Aucun membre trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  const getMemberStats = (memberId: string) => {
    const memberAppts = appointments.filter(a => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todayAppts = memberAppts.filter(a => a.date.startsWith(today));
    return { todayCount: todayAppts.length, totalCount: memberAppts.length };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Membre</th>
            <th className="px-6 py-3 hidden md:table-cell">Contact</th>
            <th className="px-6 py-3">Activité</th>
            <th className="px-6 py-3 hidden lg:table-cell">Commission</th>
            <th className="px-6 py-3">Statut</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {team.map((member) => {
            const stats = getMemberStats(member.id);
            return (
              <tr key={member.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(member.id)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-slate-200 shrink-0">
                      {member.firstName[0]}{member.lastName[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{member.firstName} {member.lastName}</div>
                      <div className="text-xs text-slate-500 capitalize">{member.role}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="flex items-center gap-1"><Mail size={10} /> {member.email}</div>
                    <div className="flex items-center gap-1"><Phone size={10} /> {member.phone}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-900">{stats.todayCount} RDV auj.</div>
                  <div className="text-xs text-slate-500">{stats.totalCount} total</div>
                </td>
                <td className="px-6 py-4 hidden lg:table-cell text-sm text-slate-600">{member.commissionRate}%</td>
                <td className="px-6 py-4">
                  {member.active ? (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Actif</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Inactif</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 3: Create TeamCard — refactored from existing inline GRID view**

```tsx
// modules/team/components/TeamCard.tsx
import React from 'react';
import { Calendar, Users, Percent } from 'lucide-react';
import { StaffMember, Appointment } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface TeamCardProps {
  team: StaffMember[];
  appointments: Appointment[];
  onEdit: (id: string) => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, appointments, onEdit }) => {
  if (team.length === 0) {
    return <EmptyState title="Aucun membre trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  const getMemberStats = (memberId: string) => {
    const memberAppts = appointments.filter(a => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todayAppts = memberAppts.filter(a => a.date.startsWith(today));
    return { todayCount: todayAppts.length, totalCount: memberAppts.length };
  };

  const roleColors: Record<string, string> = {
    owner: 'bg-amber-500',
    manager: 'bg-blue-500',
    stylist: 'bg-emerald-500',
    receptionist: 'bg-purple-500',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {team.map((member) => {
        const stats = getMemberStats(member.id);
        return (
          <button
            key={member.id}
            onClick={() => onEdit(member.id)}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 relative overflow-hidden"
            aria-label={`${member.firstName} ${member.lastName}, ${member.role}, ${stats.todayCount} RDV aujourd'hui`}
          >
            <div className={`absolute top-0 left-0 right-0 h-1 ${roleColors[member.role] || 'bg-slate-300'}`} />

            <div className="flex items-center gap-3 mb-3 pt-1">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-slate-200 shrink-0">
                {member.firstName[0]}{member.lastName[0]}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{member.firstName} {member.lastName}</div>
                <div className="text-xs text-slate-500 capitalize">{member.role}</div>
              </div>
              {member.active ? (
                <span className="ml-auto px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Actif</span>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Inactif</span>
              )}
            </div>

            <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1 text-slate-500">
                <Calendar size={12} className="text-slate-400" />
                <span className="font-semibold text-slate-900">{stats.todayCount}</span> auj.
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <Users size={12} className="text-slate-400" />
                <span className="font-semibold text-slate-900">{stats.totalCount}</span> total
              </div>
              <div className="flex items-center gap-1 text-slate-500 ml-auto">
                <Percent size={12} className="text-slate-400" />
                <span className="font-semibold text-slate-900">{member.commissionRate}%</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Refactor TeamList to orchestrator — replace local toggle with useViewMode**

```tsx
// modules/team/components/TeamList.tsx
import React from 'react';
import { Plus, Search } from 'lucide-react';
import { StaffMember, Appointment } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { TeamTable } from './TeamTable';
import { TeamCard } from './TeamCard';

interface TeamListProps {
  team: StaffMember[];
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const TeamList: React.FC<TeamListProps> = ({
  team, appointments, searchTerm, onSearchChange, onAdd, onEdit
}) => {
  const { viewMode, setViewMode } = useViewMode('team');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
        <button
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau Membre
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <TeamTable team={team} appointments={appointments} onEdit={onEdit} />
        ) : (
          <TeamCard team={team} appointments={appointments} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Team components

- [ ] **Step 6: Commit**

```bash
git add modules/team/components/TeamTable.tsx modules/team/components/TeamCard.tsx modules/team/components/TeamList.tsx
git commit -m "feat: split TeamList into table/card views, replace local toggle with useViewMode"
```

---

### Task 6: Suppliers — 3-File Split

**Files:**
- Create: `modules/suppliers/components/SupplierTable.tsx`
- Create: `modules/suppliers/components/SupplierCard.tsx`
- Modify: `modules/suppliers/components/SupplierList.tsx`

- [ ] **Step 1: Create SupplierTable — extract table from SupplierList**

```tsx
// modules/suppliers/components/SupplierTable.tsx
import React from 'react';
import { Truck, Globe, Mail, Phone, ChevronRight } from 'lucide-react';
import { Supplier } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface SupplierTableProps {
  suppliers: Supplier[];
  onEdit: (id: string) => void;
}

export const SupplierTable: React.FC<SupplierTableProps> = ({ suppliers, onEdit }) => {
  if (suppliers.length === 0) {
    return <EmptyState title="Aucun fournisseur trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Entreprise</th>
            <th className="px-6 py-3 hidden md:table-cell">Contact</th>
            <th className="px-6 py-3 hidden lg:table-cell">Catégorie</th>
            <th className="px-6 py-3">Statut</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(supplier.id)}>
              <td className="px-6 py-4 align-top">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                    <Truck size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{supplier.name}</div>
                    {supplier.website && (
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Globe size={10} />
                        {supplier.website}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 align-top hidden md:table-cell">
                <div className="text-sm font-medium text-slate-700">{supplier.contactName}</div>
                <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-1">
                  <span className="flex items-center gap-1"><Mail size={10} /> {supplier.email}</span>
                  <span className="flex items-center gap-1"><Phone size={10} /> {supplier.phone}</span>
                </div>
              </td>
              <td className="px-6 py-4 align-top hidden lg:table-cell">
                <span className="inline-flex px-2.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs font-medium">
                  {supplier.category}
                </span>
              </td>
              <td className="px-6 py-4 align-top">
                {supplier.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Actif</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Inactif</span>
                )}
              </td>
              <td className="px-6 py-4 align-top text-right">
                <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Create SupplierCard**

```tsx
// modules/suppliers/components/SupplierCard.tsx
import React from 'react';
import { Truck, Globe, Mail, Phone } from 'lucide-react';
import { Supplier } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface SupplierCardProps {
  suppliers: Supplier[];
  onEdit: (id: string) => void;
}

export const SupplierCard: React.FC<SupplierCardProps> = ({ suppliers, onEdit }) => {
  if (suppliers.length === 0) {
    return <EmptyState title="Aucun fournisseur trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {suppliers.map((supplier) => (
        <button
          key={supplier.id}
          onClick={() => onEdit(supplier.id)}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label={`${supplier.name}, ${supplier.category}, ${supplier.active ? 'Actif' : 'Inactif'}`}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
              <Truck size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-sm">{supplier.name}</div>
              <div className="text-xs text-slate-500">{supplier.contactName}</div>
            </div>
            {supplier.active ? (
              <span className="ml-auto px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">Actif</span>
            ) : (
              <span className="ml-auto px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">Inactif</span>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-slate-500 mb-3">
            <div className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" /> {supplier.email}</div>
            <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {supplier.phone}</div>
            {supplier.website && (
              <div className="flex items-center gap-1.5"><Globe size={12} className="text-slate-400" /> <span className="truncate">{supplier.website}</span></div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <span className="inline-flex px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs font-medium">
              {supplier.category}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Refactor SupplierList to orchestrator**

```tsx
// modules/suppliers/components/SupplierList.tsx
import React from 'react';
import { Plus, Search } from 'lucide-react';
import { Supplier } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { SupplierTable } from './SupplierTable';
import { SupplierCard } from './SupplierCard';

interface SupplierListProps {
  suppliers: Supplier[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const SupplierList: React.FC<SupplierListProps> = ({ suppliers, searchTerm, onSearchChange, onAdd, onEdit }) => {
  const { viewMode, setViewMode } = useViewMode('suppliers');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Fournisseurs</h1>
        <button
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau Fournisseur
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher un fournisseur..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <SupplierTable suppliers={suppliers} onEdit={onEdit} />
        ) : (
          <SupplierCard suppliers={suppliers} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Supplier components

- [ ] **Step 5: Commit**

```bash
git add modules/suppliers/components/SupplierTable.tsx modules/suppliers/components/SupplierCard.tsx modules/suppliers/components/SupplierList.tsx
git commit -m "feat: split SupplierList into table/card views with useViewMode"
```

---

### Task 7: Appointments — 3-File Split

**Files:**
- Create: `modules/appointments/components/AppointmentTable.tsx`
- Create: `modules/appointments/components/AppointmentCard.tsx`
- Modify: `modules/appointments/components/AppointmentList.tsx`

- [ ] **Step 1: Create AppointmentTable — extract table + StatusBadge from AppointmentList**

```tsx
// modules/appointments/components/AppointmentTable.tsx
import React from 'react';
import { ChevronRight, User } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface AppointmentTableProps {
  appointments: Appointment[];
  onDetails: (id: string) => void;
}

const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
  const styles = {
    [AppointmentStatus.SCHEDULED]: 'bg-blue-50 text-blue-700 border-blue-100',
    [AppointmentStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [AppointmentStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
    [AppointmentStatus.NO_SHOW]: 'bg-orange-50 text-orange-700 border-orange-100',
  };
  const labels = {
    [AppointmentStatus.SCHEDULED]: 'Planifié',
    [AppointmentStatus.COMPLETED]: 'Terminé',
    [AppointmentStatus.CANCELLED]: 'Annulé',
    [AppointmentStatus.NO_SHOW]: 'No Show',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${styles[status]} flex items-center gap-1.5 w-fit shadow-sm`}>
      {labels[status]}
    </span>
  );
};

export const AppointmentTable: React.FC<AppointmentTableProps> = ({ appointments, onDetails }) => {
  if (appointments.length === 0) {
    return <EmptyState title="Aucun rendez-vous trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Date & Heure</th>
            <th className="px-6 py-3">Client</th>
            <th className="px-6 py-3">Service & Staff</th>
            <th className="px-6 py-3">Statut</th>
            <th className="px-6 py-3 hidden md:table-cell">Prix</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments.map((appt) => {
            const date = new Date(appt.date);
            return (
              <tr key={appt.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onDetails(appt.id)}>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 capitalize text-sm">
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="font-medium text-slate-900 text-sm">{appt.clientName}</div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-slate-800">{appt.serviceName}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <User size={12} /> {appt.staffName}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <StatusBadge status={appt.status} />
                </td>
                <td className="px-6 py-4 align-top hidden md:table-cell text-sm font-medium text-slate-900">
                  {formatPrice(appt.price)}
                </td>
                <td className="px-6 py-4 align-top text-right">
                  <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Create AppointmentCard**

```tsx
// modules/appointments/components/AppointmentCard.tsx
import React from 'react';
import { Clock, User, Scissors } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface AppointmentCardProps {
  appointments: Appointment[];
  onDetails: (id: string) => void;
}

const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
  const styles = {
    [AppointmentStatus.SCHEDULED]: 'bg-blue-50 text-blue-700 border-blue-100',
    [AppointmentStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [AppointmentStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
    [AppointmentStatus.NO_SHOW]: 'bg-orange-50 text-orange-700 border-orange-100',
  };
  const labels = {
    [AppointmentStatus.SCHEDULED]: 'Planifié',
    [AppointmentStatus.COMPLETED]: 'Terminé',
    [AppointmentStatus.CANCELLED]: 'Annulé',
    [AppointmentStatus.NO_SHOW]: 'No Show',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${styles[status]} shadow-sm`}>
      {labels[status]}
    </span>
  );
};

export const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointments, onDetails }) => {
  if (appointments.length === 0) {
    return <EmptyState title="Aucun rendez-vous trouvé" description="Essayez de modifier vos critères de recherche" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {appointments.map((appt) => {
        const date = new Date(appt.date);
        return (
          <button
            key={appt.id}
            onClick={() => onDetails(appt.id)}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`${appt.clientName}, ${appt.serviceName}, ${date.toLocaleDateString('fr-FR')}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-slate-900 text-sm">{appt.clientName}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <Clock size={12} className="text-slate-400" />
                  <span className="capitalize">{date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  {' '}
                  {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <StatusBadge status={appt.status} />
            </div>

            <div className="space-y-1.5 text-xs text-slate-500 mb-3">
              <div className="flex items-center gap-1.5">
                <Scissors size={12} className="text-slate-400" />
                <span className="font-medium text-slate-700">{appt.serviceName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-slate-400" />
                {appt.staffName}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <span className="text-sm font-semibold text-slate-900">{formatPrice(appt.price)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Refactor AppointmentList to orchestrator**

```tsx
// modules/appointments/components/AppointmentList.tsx
import React from 'react';
import { Plus, Search } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { AppointmentTable } from './AppointmentTable';
import { AppointmentCard } from './AppointmentCard';

interface AppointmentListProps {
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  onAdd: () => void;
  onDetails: (id: string) => void;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments, searchTerm, onSearchChange, statusFilter, onStatusFilterChange, onAdd, onDetails
}) => {
  const { viewMode, setViewMode } = useViewMode('appointments');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Rendez-vous</h1>
        <button
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau RDV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm shadow-sm cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
            <option value={AppointmentStatus.COMPLETED}>Terminé</option>
            <option value={AppointmentStatus.CANCELLED}>Annulé</option>
          </select>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <AppointmentTable appointments={appointments} onDetails={onDetails} />
        ) : (
          <AppointmentCard appointments={appointments} onDetails={onDetails} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Appointment components

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/components/AppointmentTable.tsx modules/appointments/components/AppointmentCard.tsx modules/appointments/components/AppointmentList.tsx
git commit -m "feat: split AppointmentList into table/card views with useViewMode"
```

---

### Task 8: Accounting Expenses — 3-File Split

**Files:**
- Create: `modules/accounting/components/ExpenseTable.tsx`
- Create: `modules/accounting/components/ExpenseCard.tsx`
- Modify: `modules/accounting/components/AccountingExpenses.tsx`

- [ ] **Step 1: Create ExpenseTable — extract table from AccountingExpenses**

```tsx
// modules/accounting/components/ExpenseTable.tsx
import React from 'react';
import { Trash2, Tag } from 'lucide-react';
import { Expense } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ExpenseTableProps {
  expenses: Expense[];
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({ expenses }) => {
  const { expenseCategories } = useSettings();

  const getCategoryDetails = (id: string) => {
    const category = expenseCategories.find(c => c.id === id);
    if (category) return { label: category.name, color: category.color };
    return { label: 'Autre', color: 'bg-slate-100 text-slate-700' };
  };

  if (expenses.length === 0) {
    return <EmptyState title="Aucune dépense trouvée" description="Aucune dépense pour la période sélectionnée" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
          <tr>
            <th className="px-6 py-4">Date</th>
            <th className="px-6 py-4">Description</th>
            <th className="px-6 py-4 hidden md:table-cell">Fournisseur</th>
            <th className="px-6 py-4 hidden lg:table-cell">Catégorie</th>
            <th className="px-6 py-4 text-right">Montant</th>
            <th className="px-6 py-4 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {expenses.map((exp) => {
            const { label, color } = getCategoryDetails(exp.category);
            return (
              <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors text-sm group">
                <td className="px-6 py-4 text-slate-500 font-medium">{new Date(exp.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-6 py-4 font-bold text-slate-800">{exp.description}</td>
                <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{exp.supplier || '-'}</td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-white/20 shadow-sm ${color}`}>
                    <Tag size={12} /> {label}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">{formatPrice(exp.amount)}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 2: Create ExpenseCard**

```tsx
// modules/accounting/components/ExpenseCard.tsx
import React from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { Expense } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ExpenseCardProps {
  expenses: Expense[];
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({ expenses }) => {
  const { expenseCategories } = useSettings();

  const getCategoryDetails = (id: string) => {
    const category = expenseCategories.find(c => c.id === id);
    if (category) return { label: category.name, color: category.color };
    return { label: 'Autre', color: 'bg-slate-100 text-slate-700' };
  };

  if (expenses.length === 0) {
    return <EmptyState title="Aucune dépense trouvée" description="Aucune dépense pour la période sélectionnée" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {expenses.map((exp) => {
        const { label, color } = getCategoryDetails(exp.category);
        return (
          <div
            key={exp.id}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-slate-800 text-sm">{exp.description}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(exp.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <button className="p-1.5 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100" aria-label="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>

            {exp.supplier && (
              <div className="text-xs text-slate-500 mb-2">{exp.supplier}</div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border border-white/20 shadow-sm ${color}`}>
                <Tag size={10} /> {label}
              </span>
              <span className="text-sm font-bold text-slate-900">{formatPrice(exp.amount)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Refactor AccountingExpenses to orchestrator**

```tsx
// modules/accounting/components/AccountingExpenses.tsx
import React from 'react';
import { Expense } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ExpenseTable } from './ExpenseTable';
import { ExpenseCard } from './ExpenseCard';

export const AccountingExpenses: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
  const { viewMode, setViewMode } = useViewMode('expenses');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-3 border-b border-slate-200 flex justify-end bg-white">
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'table' ? (
        <ExpenseTable expenses={expenses} />
      ) : (
        <ExpenseCard expenses={expenses} />
      )}
    </div>
  );
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to Accounting components

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/components/ExpenseTable.tsx modules/accounting/components/ExpenseCard.tsx modules/accounting/components/AccountingExpenses.tsx
git commit -m "feat: split AccountingExpenses into table/card views with useViewMode"
```

---

### Task 9: DatePicker — Mobile Fullscreen + z-index Fix

**Files:**
- Modify: `components/DatePicker.tsx`

- [ ] **Step 1: Read current DatePicker**

Run: `cat /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b/components/DatePicker.tsx`

- [ ] **Step 2: Refactor DatePicker with mobile fullscreen modal and z-index fix**

Replace the dropdown with a conditional: on mobile, render a portal fullscreen modal; on desktop, render the existing dropdown (with fixed z-index).

```tsx
// components/DatePicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useMediaQuery } from '../context/MediaQueryContext';

interface DatePickerProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  error?: string;
  placeholder?: string;
}

const parseDate = (str?: string) => {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startingBlankDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const days: (number | null)[] = [];
  for (let i = 0; i < startingBlankDays; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
};

const CalendarGrid: React.FC<{
  viewDate: Date;
  value?: string;
  onDayClick: (day: number) => void;
  onChangeMonth: (delta: number) => void;
}> = ({ viewDate, value, onDayClick, onChangeMonth }) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => onChangeMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="font-bold text-slate-800 capitalize text-sm">
          {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => onChangeMonth(1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {getDaysInMonth(viewDate).map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;

          const currentDayStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = value === currentDayStr;
          const isToday = todayStr === currentDayStr;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(day)}
              className={`
                h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-sm sm:text-xs flex items-center justify-center transition-all relative
                ${isSelected
                  ? 'bg-slate-900 text-white font-bold shadow-md scale-105 z-10'
                  : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                }
                ${isToday && !isSelected ? 'text-slate-900 font-bold ring-1 ring-slate-200 bg-slate-50' : ''}
              `}
            >
              {day}
              {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-400"></div>}
            </button>
          );
        })}
      </div>
    </>
  );
};

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, error, placeholder = "Sélectionner date" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMediaQuery();

  const [viewDate, setViewDate] = useState(parseDate(value));

  useEffect(() => {
    if (isOpen && value) {
      setViewDate(parseDate(value));
    }
  }, [isOpen, value]);

  // Click outside — desktop only
  useEffect(() => {
    if (isMobile) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  // Body scroll lock — mobile only
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isOpen]);

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleDayClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    onChange(`${year}-${monthStr}-${dayStr}`);
    setIsOpen(false);
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setViewDate(newDate);
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return placeholder;
    const date = parseDate(dateStr);
    if (isNaN(date.getTime())) return 'Date invalide';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const calendarContent = (
    <CalendarGrid
      viewDate={viewDate}
      value={value}
      onDayClick={handleDayClick}
      onChangeMonth={changeMonth}
    />
  );

  return (
    <div className="w-full" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full bg-white border rounded-lg text-sm shadow-sm transition-all
            focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
            px-3 py-2 text-left flex items-center justify-between group
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
            ${isOpen ? 'ring-2 ring-slate-900 border-transparent' : 'hover:border-slate-400'}
          `}
        >
          <div className="flex items-center gap-2.5">
            <CalendarIcon size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>
              {formatDateDisplay(value)}
            </span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Desktop dropdown */}
        {isOpen && !isMobile && (
          <div className="absolute top-[calc(100%+4px)] left-0 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 w-[300px] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-left" style={{ zIndex: 'var(--z-drawer-panel)' }}>
            {calendarContent}
          </div>
        )}

        {/* Mobile fullscreen modal */}
        {isOpen && isMobile && createPortal(
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center" style={{ zIndex: 'var(--z-modal)' }}>
            <div
              className="bg-white w-full rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une date"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">{label || 'Date'}</h2>
                <button type="button" onClick={() => setIsOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              {calendarContent}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to DatePicker

- [ ] **Step 4: Commit**

```bash
git add components/DatePicker.tsx
git commit -m "feat: DatePicker fullscreen modal on mobile, fix z-index to use CSS var"
```

---

### Task 10: DateRangePicker — Mobile Fullscreen + Bug Fix

**Files:**
- Modify: `components/DateRangePicker.tsx`

- [ ] **Step 1: Read current DateRangePicker**

Run: `cat /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b/components/DateRangePicker.tsx`

- [ ] **Step 2: Fix the "Aujourd'hui" preset bug**

Find the preset that mutates a single Date object and fix it to use two separate `new Date()` calls:

```tsx
// BEFORE (buggy):
{ label: "Aujourd'hui", getValue: () => {
    const now = new Date();
    return { from: new Date(now.setHours(0,0,0,0)), to: new Date(now.setHours(23,59,59,999)) };
}},

// AFTER (fixed):
{ label: "Aujourd'hui", getValue: () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return { from, to };
}},
```

- [ ] **Step 3: Refactor DateRangePicker for mobile fullscreen**

Key mobile changes:
- Render as portal fullscreen modal (bottom sheet) on mobile
- Single calendar column instead of dual
- Presets shown as a horizontal scroll strip above calendar
- Body scroll lock
- "Appliquer" button at bottom

The implementer should read the full current file first, then apply these changes:

1. Import `createPortal` from `react-dom`, `useMediaQuery` from `../context/MediaQueryContext`, and `X` from `lucide-react`
2. Add `const { isMobile } = useMediaQuery();` in the main component
3. Add body scroll lock effect (same pattern as DatePicker Task 9)
4. Split the dropdown render into desktop (existing layout) and mobile (fullscreen portal)
5. On mobile: presets as horizontal scroll strip, single MonthGrid, "Appliquer" sticky at bottom
6. Fix z-index on desktop dropdown from `z-50` to `style={{ zIndex: 'var(--z-drawer-panel)' }}`

Mobile layout structure:
```tsx
{isOpen && isMobile && createPortal(
  <div className="fixed inset-0 bg-black/40 flex items-end justify-center" style={{ zIndex: 'var(--z-modal)' }}>
    <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
         role="dialog" aria-modal="true" aria-label="Sélectionner une période">
      {/* Header with title + X close */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Période</h2>
        <button type="button" onClick={() => { setIsOpen(false); setEditMode(null); }} className="p-2 -mr-2 text-slate-400">
          <X size={20} />
        </button>
      </div>

      {/* Horizontal preset strip */}
      <div className="px-5 py-3 border-b border-slate-100 overflow-x-auto flex gap-2 no-scrollbar">
        {PRESETS.map(preset => (
          <button key={preset.label} type="button"
            onClick={() => handlePresetClick(preset)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border border-slate-200 hover:bg-slate-50 transition-colors shrink-0">
            {preset.label}
          </button>
        ))}
      </div>

      {/* Single calendar */}
      <div className="px-5 py-4">
        <MonthGrid ... />
      </div>

      {/* Sticky apply footer */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex gap-3">
        <button type="button" onClick={() => { setIsOpen(false); setEditMode(null); }}
          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium">
          Annuler
        </button>
        <button type="button" onClick={handleApply}
          className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold">
          Appliquer
        </button>
      </div>
    </div>
  </div>,
  document.body
)}
```

The implementer should preserve all existing functionality (presets, editMode, tempRange, DayCell highlighting) while restructuring the layout for mobile.

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to DateRangePicker

- [ ] **Step 5: Commit**

```bash
git add components/DateRangePicker.tsx
git commit -m "feat: DateRangePicker fullscreen on mobile, fix Aujourd'hui preset bug, fix z-index"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npx tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 2: Run build**

Run: `cd /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b && npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Verify all new files exist**

Run: `find /Users/sims/Casa\ de\ Chicas/Salon-Saas/.worktrees/plan-5b/modules -name "*Table.tsx" -o -name "*Card.tsx" | sort`

Expected output (14 new files):
```
modules/accounting/components/ExpenseCard.tsx
modules/accounting/components/ExpenseTable.tsx
modules/appointments/components/AppointmentCard.tsx
modules/appointments/components/AppointmentTable.tsx
modules/clients/components/ClientCard.tsx
modules/clients/components/ClientTable.tsx
modules/products/components/ProductCard.tsx
modules/products/components/ProductTable.tsx
modules/services/components/ServiceCard.tsx
modules/services/components/ServiceTable.tsx
modules/suppliers/components/SupplierCard.tsx
modules/suppliers/components/SupplierTable.tsx
modules/team/components/TeamCard.tsx
modules/team/components/TeamTable.tsx
```

- [ ] **Step 4: Commit if any uncommitted changes remain**

```bash
git status
# If clean, skip. If not:
git add -A && git commit -m "chore: final Plan 5B cleanup"
```
