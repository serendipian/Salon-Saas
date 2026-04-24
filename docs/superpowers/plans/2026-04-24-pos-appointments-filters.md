# POS Rendez-vous Tab Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add staff, service-category, and status filters to the POS Rendez-vous tab; fix two bugs along the way (IN_PROGRESS appointments hidden; past-day overdues polluting the list).

**Architecture:** Extract grouping and filtering logic into a pure, unit-tested utility. Add filter state to `usePOS`. Create a stateless `AppointmentFilters` chip-row component. Refactor `PendingAppointments` to render pre-grouped data with a filtered-empty state.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-24-pos-appointments-filters-design.md](../specs/2026-04-24-pos-appointments-filters-design.md)

**Branch:** `feat/pos-appointments-filters` (already created, off main, spec committed).

---

## File Plan

### Create

- `modules/pos/utils/groupAndFilterAppointments.ts` — pure grouping + filtering functions
- `modules/pos/utils/groupAndFilterAppointments.test.ts` — unit tests (vitest, matches existing `mappers.test.ts` pattern)
- `modules/pos/components/AppointmentFilters.tsx` — stateless chip-row component

### Modify

- `modules/pos/hooks/usePOS.ts` — base scope fix, filter state, new exports
- `modules/pos/components/POSCatalog.tsx` — render filters, thread new props
- `modules/pos/components/PendingAppointments.tsx` — accept grouped data, filtered-empty state, same-day overdue
- `modules/pos/POSModule.tsx` — thread new hook exports into POSCatalog

---

## Task 1: Fix base `pendingAppointments` scope (two-bug fix, standalone commit)

**Why first:** This is a bug fix that improves behavior regardless of the filter UI. Ship it independently so it's easy to review and revert if needed.

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts:161-184`

- [ ] **Step 1: Read the current memo**

Run: `sed -n '161,184p' modules/pos/hooks/usePOS.ts` to confirm current state matches the diff baseline below.

Expected current body:

```ts
const pendingAppointments = useMemo(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();

  return allAppointments
    .filter((a) => {
      if (a.status !== 'SCHEDULED') return false;
      // Today's appointments OR overdue from previous days
      return a.date < tomorrowStart;
    })
    .sort((a, b) => {
      const aIsOverdue = a.date < todayStart;
      const bIsOverdue = b.date < todayStart;
      // Overdue first, then by scheduled time
      if (aIsOverdue && !bIsOverdue) return -1;
      if (!aIsOverdue && bIsOverdue) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}, [allAppointments]);
```

- [ ] **Step 2: Apply the two-line change**

Edit `modules/pos/hooks/usePOS.ts:172-174`.

Old:

```ts
      if (a.status !== 'SCHEDULED') return false;
      // Today's appointments OR overdue from previous days
      return a.date < tomorrowStart;
```

New:

```ts
      if (a.status !== 'SCHEDULED' && a.status !== 'IN_PROGRESS') return false;
      // Today only — past-day overdues are stale data, not billable work
      return a.date >= todayStart && a.date < tomorrowStart;
```

- [ ] **Step 3: Remove the now-impossible overdue sort branch**

Inside the same memo's `.sort`, the `aIsOverdue`/`bIsOverdue` flags (which compared to `todayStart`) are now always `false` because the filter already excludes past-day entries. Collapse the sort to just scheduled-time:

Old:

```ts
    .sort((a, b) => {
      const aIsOverdue = a.date < todayStart;
      const bIsOverdue = b.date < todayStart;
      // Overdue first, then by scheduled time
      if (aIsOverdue && !bIsOverdue) return -1;
      if (!aIsOverdue && bIsOverdue) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
```

New:

```ts
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
```

(Same-day overdue highlighting is a render-time concern, handled in Task 4.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Smoke test in the browser**

Run: `npm run dev`
Navigate to POS → Rendez-vous tab.
Expected:
- `IN_PROGRESS` appointments (if any exist) now appear
- Past-day `SCHEDULED` appointments no longer appear
- Today's list is unchanged otherwise

Stop the dev server after verifying.

- [ ] **Step 6: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "fix(pos): show IN_PROGRESS, drop past-day overdue from Rendez-vous tab

Two bugs the Rendez-vous tab was carrying:
- IN_PROGRESS appointments were filtered out entirely, so clients
  currently in the chair could not be billed from this tab.
- The window extended infinitely into the past, polluting the list
  with stale SCHEDULED rows from previous days (forgotten status
  updates, unreconciled no-shows).

Scope is now 'billable today' = SCHEDULED or IN_PROGRESS within
today's date. Past-day cleanup belongs in the Agenda module."
```

---

## Task 2: Extract grouping and filtering into a pure utility with unit tests

**Why:** Filter semantics have enough edge cases (multi-staff groups, OR logic, orphaned service IDs) that unit tests earn their keep. The utility is also consumed twice — once for the filtered render, once for derived filter-option lists — so sharing a pure function keeps them in sync.

**Files:**
- Create: `modules/pos/utils/groupAndFilterAppointments.ts`
- Create: `modules/pos/utils/groupAndFilterAppointments.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `modules/pos/utils/groupAndFilterAppointments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Appointment, Service } from '../../../types';
import { AppointmentStatus } from '../../../types';
import {
  filterAppointmentGroups,
  groupAppointments,
  type AppointmentFilters,
} from './groupAndFilterAppointments';

const mkAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: overrides.id ?? 'a1',
  clientId: 'c1',
  clientName: 'Jane Doe',
  serviceId: overrides.serviceId ?? 'sv1',
  serviceName: 'Cut',
  date: overrides.date ?? '2026-04-24T10:00:00.000Z',
  durationMinutes: 60,
  staffId: overrides.staffId ?? 'st1',
  staffName: 'Anna',
  status: overrides.status ?? AppointmentStatus.SCHEDULED,
  variantId: 'v1',
  variantName: 'Short',
  price: 100,
  groupId: overrides.groupId ?? null,
  ...overrides,
});

const mkService = (id: string, categoryId: string): Service =>
  ({
    id,
    name: `Service ${id}`,
    categoryId,
    description: '',
    variants: [],
    active: true,
    isFavorite: false,
    favoriteSortOrder: 0,
  }) as Service;

const noFilters: AppointmentFilters = {
  staffId: 'ALL',
  categoryId: 'ALL',
  status: 'ALL',
};

describe('groupAppointments', () => {
  it('returns an empty array when given no appointments', () => {
    expect(groupAppointments([])).toEqual([]);
  });

  it('groups appointments sharing a groupId into one group', () => {
    const a1 = mkAppt({ id: 'a1', groupId: 'g1' });
    const a2 = mkAppt({ id: 'a2', groupId: 'g1', serviceId: 'sv2' });
    const groups = groupAppointments([a1, a2]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('treats appointments with null groupId as standalone groups', () => {
    const a1 = mkAppt({ id: 'a1', groupId: null });
    const a2 = mkAppt({ id: 'a2', groupId: null });
    const groups = groupAppointments([a1, a2]);
    expect(groups).toHaveLength(2);
  });

  it('preserves input order of groups (by first appearance)', () => {
    const a1 = mkAppt({ id: 'a1', groupId: 'g2' });
    const a2 = mkAppt({ id: 'a2', groupId: 'g1' });
    const a3 = mkAppt({ id: 'a3', groupId: 'g2' });
    const groups = groupAppointments([a1, a2, a3]);
    expect(groups[0][0].id).toBe('a1');
    expect(groups[1][0].id).toBe('a2');
  });
});

describe('filterAppointmentGroups', () => {
  const services = [
    mkService('sv1', 'cat-hair'),
    mkService('sv2', 'cat-color'),
  ];

  it('returns all groups when all filters are ALL', () => {
    const groups = [[mkAppt()], [mkAppt({ id: 'a2' })]];
    expect(filterAppointmentGroups(groups, noFilters, services)).toEqual(groups);
  });

  it('filters by staffId — keeps groups where any appointment matches', () => {
    const groups = [
      [mkAppt({ id: 'a1', staffId: 'st1' })],
      [mkAppt({ id: 'a2', staffId: 'st2' })],
    ];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, staffId: 'st1' },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a1');
  });

  it('filters by staffId — keeps multi-staff group if any member matches', () => {
    const group = [
      mkAppt({ id: 'a1', staffId: 'st1', groupId: 'g1' }),
      mkAppt({ id: 'a2', staffId: 'st2', groupId: 'g1' }),
    ];
    const result = filterAppointmentGroups(
      [group],
      { ...noFilters, staffId: 'st2' },
      services,
    );
    expect(result).toHaveLength(1);
  });

  it('filters by categoryId — resolves via service lookup', () => {
    const groups = [
      [mkAppt({ id: 'a1', serviceId: 'sv1' })], // cat-hair
      [mkAppt({ id: 'a2', serviceId: 'sv2' })], // cat-color
    ];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, categoryId: 'cat-color' },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a2');
  });

  it('filters by categoryId — excludes appointment with orphaned serviceId', () => {
    const groups = [[mkAppt({ id: 'a1', serviceId: 'missing-service' })]];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, categoryId: 'cat-hair' },
      services,
    );
    expect(result).toHaveLength(0);
  });

  it('filters by status', () => {
    const groups = [
      [mkAppt({ id: 'a1', status: AppointmentStatus.SCHEDULED })],
      [mkAppt({ id: 'a2', status: AppointmentStatus.IN_PROGRESS })],
    ];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, status: AppointmentStatus.IN_PROGRESS },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a2');
  });

  it('combines all three filters with AND semantics', () => {
    const groups = [
      [
        mkAppt({
          id: 'a1',
          staffId: 'st1',
          serviceId: 'sv1',
          status: AppointmentStatus.SCHEDULED,
        }),
      ],
      [
        mkAppt({
          id: 'a2',
          staffId: 'st1',
          serviceId: 'sv1',
          status: AppointmentStatus.IN_PROGRESS,
        }),
      ],
      [
        mkAppt({
          id: 'a3',
          staffId: 'st2',
          serviceId: 'sv1',
          status: AppointmentStatus.SCHEDULED,
        }),
      ],
    ];
    const result = filterAppointmentGroups(
      groups,
      {
        staffId: 'st1',
        categoryId: 'cat-hair',
        status: AppointmentStatus.SCHEDULED,
      },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a1');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run modules/pos/utils/groupAndFilterAppointments.test.ts`
Expected: FAIL — module `./groupAndFilterAppointments` cannot be resolved.

- [ ] **Step 3: Create the implementation**

Create `modules/pos/utils/groupAndFilterAppointments.ts`:

```ts
import type { Appointment, Service } from '../../../types';
import type { AppointmentStatus } from '../../../types';

export interface AppointmentFilters {
  staffId: string; // staffId | 'ALL'
  categoryId: string; // categoryId | 'ALL'
  status: 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS;
}

/**
 * Groups appointments by groupId. Appointments with null/undefined groupId
 * become standalone groups keyed by their own id. Preserves first-appearance
 * order of groups.
 */
export const groupAppointments = (appointments: Appointment[]): Appointment[][] => {
  const order: string[] = [];
  const byKey = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    const key = appt.groupId ?? appt.id;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)?.push(appt);
  }
  return order.map((k) => byKey.get(k) ?? []);
};

/**
 * Filters appointment groups by staff, category, and status with OR semantics
 * within a group (group matches if any member matches) and AND across the
 * three filter dimensions. 'ALL' is a pass-through for that dimension.
 *
 * Category is resolved via the `services` lookup — an appointment with an
 * orphaned serviceId never matches a specific category filter.
 */
export const filterAppointmentGroups = (
  groups: Appointment[][],
  filters: AppointmentFilters,
  services: Service[],
): Appointment[][] => {
  const serviceCategoryById = new Map(services.map((s) => [s.id, s.categoryId]));

  return groups.filter((group) => {
    const staffMatch =
      filters.staffId === 'ALL' || group.some((a) => a.staffId === filters.staffId);
    if (!staffMatch) return false;

    const categoryMatch =
      filters.categoryId === 'ALL' ||
      group.some((a) => serviceCategoryById.get(a.serviceId) === filters.categoryId);
    if (!categoryMatch) return false;

    const statusMatch =
      filters.status === 'ALL' || group.some((a) => a.status === filters.status);
    return statusMatch;
  });
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run modules/pos/utils/groupAndFilterAppointments.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add modules/pos/utils/groupAndFilterAppointments.ts modules/pos/utils/groupAndFilterAppointments.test.ts
git commit -m "feat(pos): add pure utility for grouping and filtering appointments

Extracts groupId-based grouping and multi-dimensional filtering into
a tested utility shared between the Rendez-vous tab render and the
derived filter-option lists. OR semantics within groups, AND across
filter dimensions."
```

---

## Task 3: Add filter state and new exports to `usePOS`

**Why:** The hook is the data owner. Render components should consume already-grouped, already-filtered data plus the option lists for chip rendering.

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`

- [ ] **Step 1: Add imports at the top of the file**

Add to the existing imports at the top of `modules/pos/hooks/usePOS.ts`:

```ts
import { AppointmentStatus } from '../../../types';
import {
  filterAppointmentGroups,
  groupAppointments,
  type AppointmentFilters,
} from '../utils/groupAndFilterAppointments';
```

- [ ] **Step 2: Add filter state after the existing state declarations**

Locate the block at `modules/pos/hooks/usePOS.ts:40-45`:

```ts
const [viewMode, setViewMode] = useState<POSViewMode>('SERVICES');
const [searchTerm, setSearchTerm] = useState('');
const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
const [selectedClient, setSelectedClient] = useState<Client | null>(null);
const [cart, setCart] = useState<CartItem[]>([]);
const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
```

Add immediately after (preserving the existing lines):

```ts
const [appointmentStaffFilter, setAppointmentStaffFilter] = useState<string>('ALL');
const [appointmentCategoryFilter, setAppointmentCategoryFilter] = useState<string>('ALL');
const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<
  AppointmentFilters['status']
>('ALL');
```

- [ ] **Step 3: Derive `pendingAppointmentGroups` after the existing `pendingAppointments` memo**

Locate the end of the `pendingAppointments` memo (currently ending around `modules/pos/hooks/usePOS.ts:184`). Add immediately after:

```ts
const pendingAppointmentGroups = useMemo(
  () => groupAppointments(pendingAppointments),
  [pendingAppointments],
);

const filteredPendingAppointmentGroups = useMemo(
  () =>
    filterAppointmentGroups(
      pendingAppointmentGroups,
      {
        staffId: appointmentStaffFilter,
        categoryId: appointmentCategoryFilter,
        status: appointmentStatusFilter,
      },
      services,
    ),
  [
    pendingAppointmentGroups,
    appointmentStaffFilter,
    appointmentCategoryFilter,
    appointmentStatusFilter,
    services,
  ],
);
```

- [ ] **Step 4: Derive available filter options**

Add immediately after the block from Step 3:

```ts
const availableAppointmentStaff = useMemo(() => {
  const ids = new Set<string>();
  for (const group of pendingAppointmentGroups) {
    for (const appt of group) ids.add(appt.staffId);
  }
  return allStaff.filter((s) => s.active && !s.deletedAt && ids.has(s.id));
}, [pendingAppointmentGroups, allStaff]);

const availableAppointmentCategories = useMemo(() => {
  const serviceCategoryById = new Map(services.map((s) => [s.id, s.categoryId]));
  const ids = new Set<string>();
  for (const group of pendingAppointmentGroups) {
    for (const appt of group) {
      const catId = serviceCategoryById.get(appt.serviceId);
      if (catId) ids.add(catId);
    }
  }
  return serviceCategories.filter((c) => ids.has(c.id));
}, [pendingAppointmentGroups, services, serviceCategories]);
```

- [ ] **Step 5: Add auto-reset effect for vanished filter options**

Add immediately after the block from Step 4:

```ts
useEffect(() => {
  if (
    appointmentStaffFilter !== 'ALL' &&
    !availableAppointmentStaff.some((s) => s.id === appointmentStaffFilter)
  ) {
    setAppointmentStaffFilter('ALL');
  }
}, [availableAppointmentStaff, appointmentStaffFilter]);

useEffect(() => {
  if (
    appointmentCategoryFilter !== 'ALL' &&
    !availableAppointmentCategories.some((c) => c.id === appointmentCategoryFilter)
  ) {
    setAppointmentCategoryFilter('ALL');
  }
}, [availableAppointmentCategories, appointmentCategoryFilter]);
```

- [ ] **Step 6: Add a reset-all helper**

Add immediately after the effects from Step 5:

```ts
const resetAppointmentFilters = () => {
  setAppointmentStaffFilter('ALL');
  setAppointmentCategoryFilter('ALL');
  setAppointmentStatusFilter('ALL');
};
```

- [ ] **Step 7: Add new values to the hook's return object**

Locate the return block at `modules/pos/hooks/usePOS.ts:239-263` and insert the new keys inside it. The existing `pendingAppointments` export stays for now (removed in Task 6 after consumers migrate).

Insert after `pendingAppointments,`:

```ts
    pendingAppointmentGroups,
    filteredPendingAppointmentGroups,
    availableAppointmentStaff,
    availableAppointmentCategories,
    appointmentStaffFilter,
    appointmentCategoryFilter,
    appointmentStatusFilter,
    setAppointmentStaffFilter,
    setAppointmentCategoryFilter,
    setAppointmentStatusFilter,
    resetAppointmentFilters,
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (The hook consumers — POSModule — compile fine because they destructure only named keys and ignore the new ones for now.)

- [ ] **Step 9: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "feat(pos): add filter state and grouped exports to usePOS

Introduces staff/category/status filter state, exports pre-grouped
appointment lists (unfiltered and filtered), and derives the option
lists for each chip row from appointments that actually appear. Auto-
resets a dimension to ALL when its selected option is no longer
available (e.g., category deleted while active)."
```

---

## Task 4: Refactor `PendingAppointments` to render pre-grouped data with new empty state

**Files:**
- Modify: `modules/pos/components/PendingAppointments.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `modules/pos/components/PendingAppointments.tsx` with:

```tsx
import { AlertTriangle, Calendar, Clock, Filter, User } from 'lucide-react';
import type React from 'react';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { formatName, formatPrice } from '../../../lib/format';
import type { Appointment } from '../../../types';
import { AppointmentStatus } from '../../../types';

interface PendingAppointmentsProps {
  groups: Appointment[][];
  onImport: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
  filtersActive: boolean;
  onResetFilters: () => void;
}

export const PendingAppointments: React.FC<PendingAppointmentsProps> = ({
  groups,
  onImport,
  linkedAppointmentId,
  filtersActive,
  onResetFilters,
}) => {
  const { isMobile } = useMediaQuery();

  if (groups.length === 0) {
    if (filtersActive) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Filter size={48} strokeWidth={1} className="mb-4 opacity-50" />
          <p className="font-medium text-sm">Aucun rendez-vous ne correspond aux filtres</p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Réinitialiser les filtres
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Calendar size={48} strokeWidth={1} className="mb-4 opacity-50" />
        <p className="font-medium text-sm">Aucun rendez-vous en attente</p>
        <p className="text-xs mt-1">Les rendez-vous confirmés du jour apparaîtront ici</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-3'}`}>
      {groups.map((groupAppts) => {
        const primary = groupAppts[0];
        const groupKey = primary.groupId ?? primary.id;
        // Same-day overdue: scheduled time has passed, status still SCHEDULED.
        // Past-day overdues are excluded upstream, so this only fires within today.
        const isOverdue =
          primary.status === AppointmentStatus.SCHEDULED && new Date(primary.date) < now;
        const isLinked = groupAppts.some((a) => a.id === linkedAppointmentId);
        const totalPrice = groupAppts.reduce((sum, a) => sum + a.price, 0);

        return (
          <button
            type="button"
            key={groupKey}
            onClick={() => onImport(primary)}
            disabled={isLinked}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              isLinked
                ? 'border-green-300 bg-green-50 opacity-60 cursor-not-allowed'
                : isOverdue
                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-md'
            }`}
          >
            {isOverdue && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold mb-2">
                <AlertTriangle size={12} />
                <span>En retard</span>
              </div>
            )}

            {isLinked && (
              <div className="text-xs font-semibold text-green-600 mb-2">Dans le panier</div>
            )}

            <div className="font-semibold text-slate-900 text-sm mb-1">
              {formatName(primary.clientName) || (
                <span className="text-slate-400 italic">Client de passage</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
              <Clock size={12} />
              <span>
                {new Date(primary.date).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              {groupAppts.map((appt) => (
                <div key={appt.id} className="flex justify-between items-center text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-700 font-medium truncate block">
                      {appt.serviceName}
                    </span>
                    {appt.variantName && <span className="text-slate-400">{appt.variantName}</span>}
                  </div>
                  <span className="text-slate-600 font-medium ml-2 shrink-0">
                    {formatPrice(appt.price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User size={12} />
                <span className="truncate max-w-[120px]">
                  {(() => {
                    const names = [...new Set(groupAppts.map((a) => a.staffName).filter(Boolean))];
                    return names.length > 0 ? names.join(', ') : 'Non attribué';
                  })()}
                </span>
              </div>
              <span className="font-bold text-slate-900 text-sm">{formatPrice(totalPrice)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

Key changes vs the previous version:
- Prop `appointments: Appointment[]` → `groups: Appointment[][]`; internal grouping removed.
- New props `filtersActive: boolean`, `onResetFilters: () => void`.
- Two empty states: unfiltered (existing copy) and filtered (new copy + reset button).
- `isOverdue` rule changed from "before today" to "scheduled time passed + still SCHEDULED".
- `type="button"` added on both interactive buttons (was missing, avoids accidental submits inside a `<form>`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: two errors at the call site in `POSCatalog.tsx` because props changed. These are fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/PendingAppointments.tsx
git commit -m "refactor(pos): PendingAppointments renders pre-grouped data

- Accept Appointment[][] instead of Appointment[], grouping lifted
  to the hook where it is shared with filter-option derivation.
- Add filtered-empty state with a Reset button.
- Rescope 'En retard' badge to same-day overdues only (past-day
  overdues no longer reach this component).

Typechecks temporarily break at the POSCatalog call site; fixed in
the next commit."
```

(Type error remains until Task 6 wires the new props. This is the TDD-ish 'red' state and is acceptable for a single-feature branch. Keep going.)

---

## Task 5: Create `AppointmentFilters` chip-row component

**Files:**
- Create: `modules/pos/components/AppointmentFilters.tsx`

- [ ] **Step 1: Create the component**

Create `modules/pos/components/AppointmentFilters.tsx`:

```tsx
import type React from 'react';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { AppointmentStatus, type ServiceCategory, type StaffMember } from '../../../types';

type StatusFilter = 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS;

interface AppointmentFiltersProps {
  staff: StaffMember[];
  categories: ServiceCategory[];
  staffValue: string;
  categoryValue: string;
  statusValue: StatusFilter;
  onStaffChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  onReset: () => void;
}

const chipBase =
  'shrink-0 snap-start px-3 min-h-[36px] rounded-full text-xs font-medium transition-colors flex items-center gap-1.5';
const chipActive = 'bg-slate-900 text-white';
const chipIdle = 'bg-slate-100 text-slate-700 hover:bg-slate-200';

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${chipBase} ${active ? chipActive : chipIdle}`}
  >
    {children}
  </button>
);

export const AppointmentFilters: React.FC<AppointmentFiltersProps> = ({
  staff,
  categories,
  staffValue,
  categoryValue,
  statusValue,
  onStaffChange,
  onCategoryChange,
  onStatusChange,
  onReset,
}) => {
  const { isMobile } = useMediaQuery();
  const anyActive = staffValue !== 'ALL' || categoryValue !== 'ALL' || statusValue !== 'ALL';

  // Nothing to filter by — hide the whole row set rather than render empty rows.
  const hasStaffOptions = staff.length > 0;
  const hasCategoryOptions = categories.length > 0;
  if (!hasStaffOptions && !hasCategoryOptions) return null;

  const rowClass = `flex gap-2 ${isMobile ? 'overflow-x-auto snap-x scrollbar-hide' : 'flex-wrap'}`;

  return (
    <div className="mb-4 space-y-2">
      {hasStaffOptions && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium w-20 shrink-0">Employé</span>
          <div className={rowClass}>
            <Chip active={staffValue === 'ALL'} onClick={() => onStaffChange('ALL')}>
              Tous
            </Chip>
            {staff.map((s) => (
              <Chip
                key={s.id}
                active={staffValue === s.id}
                onClick={() => onStaffChange(s.id)}
              >
                {s.photoUrl ? (
                  <img
                    src={s.photoUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : null}
                <span>{s.firstName}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {hasCategoryOptions && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium w-20 shrink-0">Catégorie</span>
          <div className={rowClass}>
            <Chip
              active={categoryValue === 'ALL'}
              onClick={() => onCategoryChange('ALL')}
            >
              Toutes
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c.id}
                active={categoryValue === c.id}
                onClick={() => onCategoryChange(c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium w-20 shrink-0">Statut</span>
        <div className={`${rowClass} flex-1`}>
          <Chip active={statusValue === 'ALL'} onClick={() => onStatusChange('ALL')}>
            Tous
          </Chip>
          <Chip
            active={statusValue === AppointmentStatus.SCHEDULED}
            onClick={() => onStatusChange(AppointmentStatus.SCHEDULED)}
          >
            Planifié
          </Chip>
          <Chip
            active={statusValue === AppointmentStatus.IN_PROGRESS}
            onClick={() => onStatusChange(AppointmentStatus.IN_PROGRESS)}
          >
            En cours
          </Chip>
        </div>
        {anyActive && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold shrink-0"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
};
```

Notes:
- Uses `StaffMember.photoUrl` directly instead of `StaffAvatar` to keep the chip compact (24px icon). `StaffAvatar`'s smallest supported size is still too large for a 36px chip.
- `scrollbar-hide` is a Tailwind utility added via the `tailwind-scrollbar-hide` plugin or a CSS recipe already in use elsewhere in this codebase. If the class isn't resolving at runtime, grep for its definition under `src/` or `styles/` and either use the existing utility or fall back to `[&::-webkit-scrollbar]:hidden` inline.

- [ ] **Step 2: Verify `scrollbar-hide` resolves**

Run: `grep -r "scrollbar-hide" modules/ src/ styles/ 2>/dev/null | head -5`
Expected: at least one existing usage, confirming the utility is available.

If no match, replace `scrollbar-hide` in the component with `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: same two pre-existing errors from Task 4 (POSCatalog call site). No new errors from the new file.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/components/AppointmentFilters.tsx
git commit -m "feat(pos): add AppointmentFilters chip-row component

Three stateless chip rows (employé, catégorie, statut) with a reset
link. Horizontal scroll-snap on mobile, flex-wrap on desktop. Hides
row sets that have no options to avoid rendering empty rows."
```

---

## Task 6: Wire `AppointmentFilters` through `POSModule` and `POSCatalog`

**Files:**
- Modify: `modules/pos/POSModule.tsx`
- Modify: `modules/pos/components/POSCatalog.tsx`
- Modify: `modules/pos/hooks/usePOS.ts` (remove now-unused export)

**Final prop names (used consistently below):**
- `filteredAppointmentGroups: Appointment[][]` — what PendingAppointments renders
- `totalAppointmentGroupCount: number` — what the tab badge shows (unfiltered, per spec)

- [ ] **Step 1: Update `POSCatalogProps` interface**

In `modules/pos/components/POSCatalog.tsx`, replace the existing three appointment-related props in the interface (around line 31-33):

Old:

```ts
  pendingAppointments: Appointment[];
  onImportAppointment: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
```

New:

```ts
  filteredAppointmentGroups: Appointment[][];
  totalAppointmentGroupCount: number;
  onImportAppointment: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
  availableAppointmentStaff: StaffMember[];
  availableAppointmentCategories: ServiceCategory[];
  appointmentStaffFilter: string;
  appointmentCategoryFilter: string;
  appointmentStatusFilter: 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS;
  onAppointmentStaffFilterChange: (id: string) => void;
  onAppointmentCategoryFilterChange: (id: string) => void;
  onAppointmentStatusFilterChange: (
    status: 'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS,
  ) => void;
  onResetAppointmentFilters: () => void;
```

- [ ] **Step 2: Update imports in `POSCatalog.tsx`**

At the top of `modules/pos/components/POSCatalog.tsx`, add:

```ts
import { AppointmentStatus } from '../../../types';
import { AppointmentFilters } from './AppointmentFilters';
```

Ensure the `type` imports include `StaffMember`:

```ts
import type {
  Appointment,
  FavoriteItem,
  Pack,
  Product,
  ProductCategory,
  Service,
  ServiceCategory,
  StaffMember,
} from '../../../types';
```

- [ ] **Step 3: Update parameter destructuring in `POSCatalog`**

Locate the destructured parameters at `modules/pos/components/POSCatalog.tsx:68-87`. Replace:

Old:

```ts
  pendingAppointments,
  onImportAppointment,
  linkedAppointmentId,
```

New:

```ts
  filteredAppointmentGroups,
  totalAppointmentGroupCount,
  onImportAppointment,
  linkedAppointmentId,
  availableAppointmentStaff,
  availableAppointmentCategories,
  appointmentStaffFilter,
  appointmentCategoryFilter,
  appointmentStatusFilter,
  onAppointmentStaffFilterChange,
  onAppointmentCategoryFilterChange,
  onAppointmentStatusFilterChange,
  onResetAppointmentFilters,
```

- [ ] **Step 4: Update the tab badge count source**

Locate the "Rendez-vous" tab label block in `POSCatalog.tsx` at lines 134-143.

Old:

```tsx
{pendingAppointments.length > 0 &&
  (() => {
    const groupCount = new Set(pendingAppointments.map((a) => a.groupId ?? a.id))
      .size;
    return (
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {groupCount > 9 ? '9+' : groupCount}
      </span>
    );
  })()}
```

New:

```tsx
{totalAppointmentGroupCount > 0 && (
  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
    {totalAppointmentGroupCount > 9 ? '9+' : totalAppointmentGroupCount}
  </span>
)}
```

- [ ] **Step 5: Replace the `<PendingAppointments>` call site**

Locate the render block around `modules/pos/components/POSCatalog.tsx:462-469`. Replace:

Old:

```tsx
{viewMode === 'APPOINTMENTS' && (
  <PendingAppointments
    appointments={pendingAppointments}
    onImport={onImportAppointment}
    linkedAppointmentId={linkedAppointmentId}
  />
)}
```

New:

```tsx
{viewMode === 'APPOINTMENTS' && (
  <>
    <AppointmentFilters
      staff={availableAppointmentStaff}
      categories={availableAppointmentCategories}
      staffValue={appointmentStaffFilter}
      categoryValue={appointmentCategoryFilter}
      statusValue={appointmentStatusFilter}
      onStaffChange={onAppointmentStaffFilterChange}
      onCategoryChange={onAppointmentCategoryFilterChange}
      onStatusChange={onAppointmentStatusFilterChange}
      onReset={onResetAppointmentFilters}
    />
    <PendingAppointments
      groups={filteredAppointmentGroups}
      onImport={onImportAppointment}
      linkedAppointmentId={linkedAppointmentId}
      filtersActive={
        appointmentStaffFilter !== 'ALL' ||
        appointmentCategoryFilter !== 'ALL' ||
        appointmentStatusFilter !== 'ALL'
      }
      onResetFilters={onResetAppointmentFilters}
    />
  </>
)}
```

- [ ] **Step 6: Update destructuring in `POSModule.tsx`**

In `modules/pos/POSModule.tsx`, locate the `usePOS()` destructure at lines 40-68. Remove the line `pendingAppointments,` and replace it with the new keys:

```ts
    pendingAppointmentGroups,
    filteredPendingAppointmentGroups,
    availableAppointmentStaff,
    availableAppointmentCategories,
    appointmentStaffFilter,
    appointmentCategoryFilter,
    appointmentStatusFilter,
    setAppointmentStaffFilter,
    setAppointmentCategoryFilter,
    setAppointmentStatusFilter,
    resetAppointmentFilters,
```

Leave `linkedAppointmentId` and `importAppointment` in place.

- [ ] **Step 7: Update the `<POSCatalog>` invocation in `POSModule.tsx`**

Locate the `<POSCatalog ... />` JSX in `POSModule.tsx` (around line 219). Replace the three appointment-related props with the new set:

Old:

```tsx
pendingAppointments={pendingAppointments}
onImportAppointment={importAppointment}
linkedAppointmentId={linkedAppointmentId}
```

New:

```tsx
filteredAppointmentGroups={filteredPendingAppointmentGroups}
totalAppointmentGroupCount={pendingAppointmentGroups.length}
onImportAppointment={importAppointment}
linkedAppointmentId={linkedAppointmentId}
availableAppointmentStaff={availableAppointmentStaff}
availableAppointmentCategories={availableAppointmentCategories}
appointmentStaffFilter={appointmentStaffFilter}
appointmentCategoryFilter={appointmentCategoryFilter}
appointmentStatusFilter={appointmentStatusFilter}
onAppointmentStaffFilterChange={setAppointmentStaffFilter}
onAppointmentCategoryFilterChange={setAppointmentCategoryFilter}
onAppointmentStatusFilterChange={setAppointmentStatusFilter}
onResetAppointmentFilters={resetAppointmentFilters}
```

- [ ] **Step 8: Drop the unused `pendingAppointments` hook export**

In `modules/pos/hooks/usePOS.ts`, remove `pendingAppointments,` from the return object at lines 239-263. The internal `pendingAppointments` memo (the computed value itself) stays because `pendingAppointmentGroups` depends on it; only the public export goes.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 10: Run all tests**

Run: `npm test`
Expected: all tests pass, including `groupAndFilterAppointments.test.ts`.

- [ ] **Step 11: Smoke test in the browser**

Run: `npm run dev`
Open the POS module, switch to the Rendez-vous tab, and verify the checklist in Task 7 before committing. If something is broken, fix before committing — this commit is the feature landing.

- [ ] **Step 12: Commit**

```bash
git add modules/pos/POSModule.tsx modules/pos/components/POSCatalog.tsx modules/pos/hooks/usePOS.ts
git commit -m "feat(pos): filters on Rendez-vous tab — staff, category, status

Wires AppointmentFilters above the pending appointments card grid.
Tab badge shows unfiltered count; empty state distinguishes unfiltered
from filtered-match-zero. Active staff / present categories are
derived from the unfiltered list so chips reflect what is actually
there."
```

---

## Task 7: Manual verification checklist

This is a final pass before opening the PR. Do it in a browser.

- [ ] **Run the dev server:** `npm run dev`

- [ ] **Rendez-vous tab shows IN_PROGRESS appointments.** Create an appointment for today, set it to `IN_PROGRESS` from the Agenda, return to POS → Rendez-vous. The card appears.

- [ ] **Past-day SCHEDULED appointments are not shown.** Create an appointment with `date` = yesterday (or inspect one if the salon already has stale rows). Rendez-vous tab does not list it.

- [ ] **Same-day overdue badge appears.** Appointment scheduled for earlier today, still `SCHEDULED`. Card shows the amber "En retard" badge.

- [ ] **Staff filter narrows correctly.** Click a staff chip. Only groups where that staff appears are shown. Click "Tous" to clear.

- [ ] **Category filter narrows correctly.** Click a category chip. Only groups containing a service from that category are shown. Click "Toutes" to clear.

- [ ] **Status filter narrows correctly.** Click "Planifié" → only `SCHEDULED`. Click "En cours" → only `IN_PROGRESS`. Click "Tous" to clear.

- [ ] **Filters combine.** Staff + Category + Status together produce the intersection.

- [ ] **Filtered-empty state works.** Set filters so the intersection is empty. Message + Reset button appears. Clicking Reset clears all three filters.

- [ ] **Reset link shows only when any filter is active.** All filters at "Tous"/"Toutes" = no link visible.

- [ ] **Tab badge is unfiltered.** Apply filters that reduce the visible count. The number next to "Rendez-vous" in the tab bar stays the same.

- [ ] **Multi-service group import works.** A group with two services imports both into the cart when the card is clicked.

- [ ] **"Dans le panier" badge still appears** on the imported appointment's card until the cart is cleared.

- [ ] **Mobile (resize window to <768px).** All three chip rows are horizontally scrollable. Scrolling snaps. All chips remain reachable.

- [ ] **Deleted category auto-resets.** Manually delete a service category from Settings while it is the active filter. The filter resets to "Toutes" without an error.

- [ ] **Typecheck clean:** `npx tsc --noEmit` → no errors.

- [ ] **All unit tests pass:** `npm test` → green.

---

## Self-Review Checklist (planner-side, already applied)

- Spec coverage: each spec section — data scope, filter state, filter semantics, components, UI, empty states, tab badge, same-day overdue, edge cases — maps to a task. ✓
- No placeholders: every step contains the actual code or command. ✓
- Type consistency: `AppointmentFilters` type alias from the utility matches the chip component's `StatusFilter` shape (both `'ALL' | AppointmentStatus.SCHEDULED | AppointmentStatus.IN_PROGRESS`). Hook exports and component prop names are lined up end-to-end (`filteredPendingAppointmentGroups` → `filteredAppointmentGroups` at the render layer; `pendingAppointmentGroups.length` → `totalAppointmentGroupCount`). ✓
- Scope: one branch, one PR, feature-and-fix bundled since they are intertwined. ✓

---

## Out of scope (do not do in this plan)

- Agenda-side "needs attention" view for past-day stale appointments.
- Filter persistence via localStorage.
- Bottom sheet on mobile instead of inline chip rows.
- Date range selector.
