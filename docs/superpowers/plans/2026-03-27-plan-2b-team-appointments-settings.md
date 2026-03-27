# Plan 2B — Team, Appointments, Settings Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Team, Appointments, and Settings modules from in-memory AppContext to Supabase + TanStack Query, following Plan 2A patterns.

**Architecture:** Per-module `mappers.ts` for DB↔frontend translation, TanStack Query hooks for data fetching/mutations, soft-delete filtering, defense-in-depth `salon_id` checks. Settings reads/writes the `salons` row directly rather than a separate table.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Supabase JS v2, Tailwind CSS

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `modules/settings/mappers.ts` | Salon row ↔ SalonSettings, ExpenseCategory, RecurringExpense mappers |
| `modules/settings/hooks/useSettings.ts` | TanStack Query hook for salon settings, expense categories, recurring expenses |
| `modules/team/mappers.ts` | StaffMember DB row ↔ frontend type (handles JSONB schedule, bonus_tiers) |
| `modules/appointments/mappers.ts` | Appointment DB row (with JOINs) ↔ frontend type (denormalized names) |

### Modified Files
| File | Change |
|------|--------|
| `context/AuthContext.tsx` | Expose `refreshActiveSalon()` for settings sync |
| `modules/team/hooks/useTeam.ts` | Rewrite: AppContext → TanStack Query + Supabase |
| `modules/appointments/hooks/useAppointments.ts` | Rewrite: AppContext → TanStack Query + Supabase |
| `modules/settings/components/GeneralSettings.tsx` | AppContext → `useSettings()` |
| `modules/settings/components/OpeningHoursSettings.tsx` | AppContext → `useSettings()` |
| `modules/settings/components/AccountingSettings.tsx` | AppContext → `useSettings()` |
| `modules/appointments/components/AppointmentForm.tsx` | AppContext `team`/`salonSettings` → `useTeam()`/`useSettings()` |
| `modules/team/TeamModule.tsx` | Adapt to new `useTeam()` return shape |
| `modules/team/components/TeamList.tsx` | Remove AppContext import, receive appointments for stats |
| `modules/dashboard/DashboardModule.tsx` | AppContext `appointments` → `useAppointments()` |
| `modules/pos/hooks/usePOS.ts` | AppContext `salonSettings` → `useSettings()` |
| `context/AppContext.tsx` | Remove migrated state (team, appointments, settings) |
| `CLAUDE.md` | Update data layer documentation |

---

### Task 1: Settings Mappers

**Files:**
- Create: `modules/settings/mappers.ts`

- [ ] **Step 1: Create the settings mappers file**

```typescript
// modules/settings/mappers.ts
import type { SalonSettings, WorkSchedule, ExpenseCategorySetting, RecurringExpense } from '../../types';

// --- Salon Settings (reads from salons table row) ---

interface SalonRow {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  currency: string;
  vat_rate: number;
  timezone: string;
  schedule: WorkSchedule | null;
  plan_id: string | null;
  subscription_tier: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toSalonSettings(row: SalonRow): SalonSettings {
  return {
    name: row.name,
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    website: row.website ?? '',
    currency: row.currency,
    vatRate: row.vat_rate,
    schedule: row.schedule ?? undefined,
  };
}

export function toSalonUpdate(settings: SalonSettings) {
  return {
    name: settings.name,
    address: settings.address || null,
    phone: settings.phone || null,
    email: settings.email || null,
    website: settings.website || null,
    currency: settings.currency,
    vat_rate: settings.vatRate,
    schedule: settings.schedule ?? null,
  };
}

// --- Expense Categories ---

interface ExpenseCategoryRow {
  id: string;
  salon_id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toExpenseCategory(row: ExpenseCategoryRow): ExpenseCategorySetting {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? 'bg-slate-100 text-slate-700',
  };
}

export function toExpenseCategoryInsert(cat: ExpenseCategorySetting, salonId: string, sortOrder: number) {
  return {
    id: cat.id || undefined,
    salon_id: salonId,
    name: cat.name,
    color: cat.color,
    sort_order: sortOrder,
  };
}

// --- Recurring Expenses ---

interface RecurringExpenseRow {
  id: string;
  salon_id: string;
  name: string;
  amount: number;
  frequency: string;
  next_date: string;
  category_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toRecurringExpense(row: RecurringExpenseRow): RecurringExpense {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    frequency: row.frequency as RecurringExpense['frequency'],
    nextDate: row.next_date,
  };
}

export function toRecurringExpenseInsert(expense: RecurringExpense, salonId: string) {
  return {
    id: expense.id || undefined,
    salon_id: salonId,
    name: expense.name,
    amount: expense.amount,
    frequency: expense.frequency,
    next_date: expense.nextDate,
    active: true,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (file is created but not imported anywhere yet)

- [ ] **Step 3: Commit**

```bash
git add modules/settings/mappers.ts
git commit -m "feat(settings): add mappers for salon settings, expense categories, recurring expenses"
```

---

### Task 2: AuthContext — Expose `refreshActiveSalon`

**Files:**
- Modify: `context/AuthContext.tsx`
- Modify: `lib/auth.types.ts` (if ActiveSalon type needs updating)

**Context:** When salon settings are updated via `useSettings`, the `activeSalon` state in AuthContext goes stale. We need a function to sync updated settings back to AuthContext.

- [ ] **Step 1: Add `refreshActiveSalon` to AuthContext interface and implementation**

In `context/AuthContext.tsx`, add `refreshActiveSalon` to the `AuthContextType` interface:

```typescript
// Add to AuthContextType interface (after switchSalon line):
  refreshActiveSalon: (updates: Partial<ActiveSalon>) => void;
```

Add the implementation inside `AuthProvider`, after the `createSalon` callback:

```typescript
  const refreshActiveSalon = useCallback((updates: Partial<ActiveSalon>) => {
    setActiveSalon(prev => prev ? { ...prev, ...updates } : prev);
  }, []);
```

Add `refreshActiveSalon` to the `value` object:

```typescript
  const value: AuthContextType = {
    // ... existing fields ...
    refreshActiveSalon,
  };
```

- [ ] **Step 2: Import `ActiveSalon` type in AuthContext**

The `ActiveSalon` type is already imported from `lib/auth.types.ts` at the top of `AuthContext.tsx`. No change needed here — just verify the import exists:

```typescript
import type {
  Role,
  Profile,
  SalonMembership,
  ActiveSalon,
} from '../lib/auth.types';
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add context/AuthContext.tsx
git commit -m "feat(auth): expose refreshActiveSalon for settings sync"
```

---

### Task 3: `useSettings` Hook

**Files:**
- Create: `modules/settings/hooks/useSettings.ts`

**Context:** This hook manages three data sources:
1. `salonSettings` — reads/writes the `salons` table row
2. `expenseCategories` — standard CRUD on `expense_categories` table
3. `recurringExpenses` — standard CRUD on `recurring_expenses` table

- [ ] **Step 1: Create the useSettings hook**

```typescript
// modules/settings/hooks/useSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  toSalonSettings,
  toSalonUpdate,
  toExpenseCategory,
  toExpenseCategoryInsert,
  toRecurringExpense,
  toRecurringExpenseInsert,
} from '../mappers';
import type { SalonSettings, ExpenseCategorySetting, RecurringExpense } from '../../../types';

export const useSettings = () => {
  const { activeSalon, refreshActiveSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();

  // --- Salon Settings (from salons table) ---
  const { data: salonSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['salon_settings', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('*')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      return toSalonSettings(data);
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: SalonSettings) => {
      const { error } = await supabase
        .from('salons')
        .update(toSalonUpdate(settings))
        .eq('id', salonId);
      if (error) throw error;
      return settings;
    },
    onSuccess: (settings) => {
      queryClient.invalidateQueries({ queryKey: ['salon_settings', salonId] });
      // Sync AuthContext so sidebar/header reflect updated name etc.
      refreshActiveSalon({ name: settings.name, currency: settings.currency });
    },
    onError: (error) => console.error('Failed to update salon settings:', error.message),
  });

  // --- Expense Categories ---
  const { data: expenseCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['expense_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toExpenseCategory);
    },
    enabled: !!salonId,
  });

  const updateExpenseCategoriesMutation = useMutation({
    mutationFn: async (categories: ExpenseCategorySetting[]) => {
      // Fetch existing IDs
      const { data: existing, error: fetchErr } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('salon_id', salonId)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(c => c.id));
      const newIds = new Set(categories.map(c => c.id));

      // Soft-delete removed categories
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining categories
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toExpenseCategoryInsert(cat, salonId, i);
        if (existingIds.has(cat.id)) {
          const { error } = await supabase
            .from('expense_categories')
            .update({ name: row.name, color: row.color, sort_order: row.sort_order })
            .eq('id', cat.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('expense_categories')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories', salonId] });
    },
    onError: (error) => console.error('Failed to update expense categories:', error.message),
  });

  // --- Recurring Expenses ---
  const { data: recurringExpenses = [], isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['recurring_expenses', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toRecurringExpense);
    },
    enabled: !!salonId,
  });

  const updateRecurringExpensesMutation = useMutation({
    mutationFn: async (expenses: RecurringExpense[]) => {
      // Fetch existing IDs
      const { data: existing, error: fetchErr } = await supabase
        .from('recurring_expenses')
        .select('id')
        .eq('salon_id', salonId)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(e => e.id));
      const newIds = new Set(expenses.map(e => e.id));

      // Soft-delete removed
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('recurring_expenses')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining
      for (const expense of expenses) {
        const row = toRecurringExpenseInsert(expense, salonId);
        if (existingIds.has(expense.id)) {
          const { error } = await supabase
            .from('recurring_expenses')
            .update({ name: row.name, amount: row.amount, frequency: row.frequency, next_date: row.next_date })
            .eq('id', expense.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recurring_expenses')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses', salonId] });
    },
    onError: (error) => console.error('Failed to update recurring expenses:', error.message),
  });

  // Default settings fallback while loading
  const defaultSettings: SalonSettings = {
    name: activeSalon?.name ?? '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: activeSalon?.currency ?? 'EUR',
    vatRate: 20,
  };

  return {
    salonSettings: salonSettings ?? defaultSettings,
    expenseCategories,
    recurringExpenses,
    isLoading: isLoadingSettings || isLoadingCategories || isLoadingRecurring,
    updateSalonSettings: (settings: SalonSettings) => updateSettingsMutation.mutate(settings),
    updateExpenseCategories: (categories: ExpenseCategorySetting[]) =>
      updateExpenseCategoriesMutation.mutate(categories),
    updateRecurringExpenses: (expenses: RecurringExpense[]) =>
      updateRecurringExpensesMutation.mutate(expenses),
  };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (hook created but not consumed yet)

- [ ] **Step 3: Commit**

```bash
git add modules/settings/hooks/useSettings.ts
git commit -m "feat(settings): add useSettings hook with TanStack Query + Supabase"
```

---

### Task 4: Settings Consumer Updates

**Files:**
- Modify: `modules/settings/components/GeneralSettings.tsx`
- Modify: `modules/settings/components/OpeningHoursSettings.tsx`
- Modify: `modules/settings/components/AccountingSettings.tsx`

**Context:** These three components currently read from `useAppContext()`. Switch them to `useSettings()`.

- [ ] **Step 1: Update GeneralSettings.tsx**

Replace the import and hook call. Change:

```typescript
import { useAppContext } from '../../../context/AppContext';
```

To:

```typescript
import { useSettings } from '../hooks/useSettings';
```

Change:

```typescript
  const { salonSettings, updateSalonSettings } = useAppContext();
```

To:

```typescript
  const { salonSettings, updateSalonSettings } = useSettings();
```

No other changes needed — the component already uses `salonSettings` and `updateSalonSettings` with the same signatures.

- [ ] **Step 2: Update OpeningHoursSettings.tsx**

Replace the import and hook call. Change:

```typescript
import { useAppContext } from '../../../context/AppContext';
```

To:

```typescript
import { useSettings } from '../hooks/useSettings';
```

Change:

```typescript
  const { salonSettings, updateSalonSettings } = useAppContext();
```

To:

```typescript
  const { salonSettings, updateSalonSettings } = useSettings();
```

- [ ] **Step 3: Update AccountingSettings.tsx**

Replace the import and hook call. Change:

```typescript
import { useAppContext } from '../../../context/AppContext';
```

To:

```typescript
import { useSettings } from '../hooks/useSettings';
```

Change:

```typescript
  const {
    expenseCategories,
    recurringExpenses,
    updateExpenseCategories,
    updateRecurringExpenses,
    salonSettings
  } = useAppContext();
```

To:

```typescript
  const {
    expenseCategories,
    recurringExpenses,
    updateExpenseCategories,
    updateRecurringExpenses,
    salonSettings
  } = useSettings();
```

- [ ] **Step 4: Update usePOS.ts — switch salonSettings source**

In `modules/pos/hooks/usePOS.ts`, the hook reads `salonSettings` from AppContext. Change:

```typescript
import { useAppContext } from '../../../context/AppContext';
```

To:

```typescript
import { useAppContext } from '../../../context/AppContext';
import { useSettings } from '../../settings/hooks/useSettings';
```

Change:

```typescript
  const {
    transactions,
    addTransaction,
    salonSettings
  } = useAppContext();
```

To:

```typescript
  const {
    transactions,
    addTransaction,
  } = useAppContext();
  const { salonSettings } = useSettings();
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds. All settings consumers now read from Supabase.

- [ ] **Step 6: Commit**

```bash
git add modules/settings/components/GeneralSettings.tsx modules/settings/components/OpeningHoursSettings.tsx modules/settings/components/AccountingSettings.tsx modules/pos/hooks/usePOS.ts
git commit -m "feat(settings): switch all consumers from AppContext to useSettings"
```

---

### Task 5: Team Mappers

**Files:**
- Create: `modules/team/mappers.ts`

- [ ] **Step 1: Create the team mappers file**

```typescript
// modules/team/mappers.ts
import type { StaffMember, WorkSchedule, BonusTier } from '../../types';

interface StaffMemberRow {
  id: string;
  salon_id: string;
  membership_id: string | null;
  first_name: string;
  last_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  color: string | null;
  photo_url: string | null;
  bio: string | null;
  skills: string[] | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  contract_type: string | null;
  weekly_hours: number | null;
  commission_rate: number;
  base_salary: number | null;
  bonus_tiers: BonusTier[] | null; // JSONB — Supabase returns as JS object
  iban: string | null;
  social_security_number: string | null;
  birth_date: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  schedule: WorkSchedule | null; // JSONB — Supabase returns as JS object
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

export function toStaffMember(row: StaffMemberRow): StaffMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    role: (row.role as StaffMember['role']) ?? 'Stylist',
    email: row.email ?? '',
    phone: row.phone ?? '',
    color: row.color ?? 'bg-slate-200',
    photoUrl: row.photo_url ?? undefined,
    bio: row.bio ?? undefined,
    skills: row.skills ?? [],
    active: row.active,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? undefined,
    contractType: (row.contract_type as StaffMember['contractType']) ?? undefined,
    weeklyHours: row.weekly_hours ?? undefined,
    commissionRate: row.commission_rate,
    baseSalary: row.base_salary ?? undefined,
    bonusTiers: row.bonus_tiers ?? undefined,
    iban: row.iban ?? undefined,
    socialSecurityNumber: row.social_security_number ?? undefined,
    birthDate: row.birth_date ?? undefined,
    address: row.address ?? undefined,
    emergencyContactName: row.emergency_contact_name ?? undefined,
    emergencyContactRelation: row.emergency_contact_relation ?? undefined,
    emergencyContactPhone: row.emergency_contact_phone ?? undefined,
    schedule: row.schedule ?? {
      monday: { isOpen: true, start: '09:00', end: '19:00' },
      tuesday: { isOpen: true, start: '09:00', end: '19:00' },
      wednesday: { isOpen: true, start: '09:00', end: '19:00' },
      thursday: { isOpen: true, start: '09:00', end: '19:00' },
      friday: { isOpen: true, start: '09:00', end: '19:00' },
      saturday: { isOpen: true, start: '10:00', end: '18:00' },
      sunday: { isOpen: false, start: '09:00', end: '18:00' },
    },
  };
}

export function toStaffMemberInsert(staff: StaffMember, salonId: string) {
  return {
    id: staff.id || undefined,
    salon_id: salonId,
    first_name: staff.firstName,
    last_name: staff.lastName,
    role: staff.role,
    email: staff.email || null,
    phone: staff.phone || null,
    color: staff.color || null,
    photo_url: staff.photoUrl ?? null,
    bio: staff.bio ?? null,
    skills: staff.skills.length > 0 ? staff.skills : null,
    active: staff.active,
    start_date: staff.startDate || null,
    end_date: staff.endDate ?? null,
    contract_type: staff.contractType ?? null,
    weekly_hours: staff.weeklyHours ?? null,
    commission_rate: staff.commissionRate,
    base_salary: staff.baseSalary ?? null,
    bonus_tiers: staff.bonusTiers ?? null, // JSONB — Supabase accepts JS object
    iban: staff.iban ?? null,
    social_security_number: staff.socialSecurityNumber ?? null,
    birth_date: staff.birthDate ?? null,
    address: staff.address ?? null,
    emergency_contact_name: staff.emergencyContactName ?? null,
    emergency_contact_relation: staff.emergencyContactRelation ?? null,
    emergency_contact_phone: staff.emergencyContactPhone ?? null,
    schedule: staff.schedule ?? null, // JSONB
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/team/mappers.ts
git commit -m "feat(team): add mappers for staff members with JSONB field handling"
```

---

### Task 6: Rewrite `useTeam` Hook

**Files:**
- Modify: `modules/team/hooks/useTeam.ts`

**Context:** Replace AppContext-based hook with TanStack Query + Supabase. Remove `getMemberStats` — stats computation moves to TeamList component in Task 7.

- [ ] **Step 1: Rewrite useTeam.ts**

Replace the entire contents of `modules/team/hooks/useTeam.ts` with:

```typescript
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toStaffMember, toStaffMemberInsert } from '../mappers';
import type { StaffMember } from '../../../types';

export const useTeam = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff_members', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('last_name');
      if (error) throw error;
      return (data ?? []).map(toStaffMember);
    },
    enabled: !!salonId,
  });

  const addStaffMemberMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const { error } = await supabase
        .from('staff_members')
        .insert(toStaffMemberInsert(member, salonId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: (error) => console.error('Failed to add staff member:', error.message),
  });

  const updateStaffMemberMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const { id, salon_id, ...updateData } = toStaffMemberInsert(member, salonId);
      const { error } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: (error) => console.error('Failed to update staff member:', error.message),
  });

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staff;
    const term = searchTerm.toLowerCase();
    return staff.filter(m =>
      m.firstName.toLowerCase().includes(term) ||
      m.lastName.toLowerCase().includes(term)
    );
  }, [staff, searchTerm]);

  return {
    team: filteredStaff,
    allStaff: staff,
    isLoading,
    searchTerm,
    setSearchTerm,
    addStaffMember: (member: StaffMember) => addStaffMemberMutation.mutate(member),
    updateStaffMember: (member: StaffMember) => updateStaffMemberMutation.mutate(member),
  };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: May have type errors in TeamModule/TeamList (they still expect `getMemberStats`). That's expected — Task 7 fixes consumers.

- [ ] **Step 3: Commit**

```bash
git add modules/team/hooks/useTeam.ts
git commit -m "feat(team): rewrite useTeam hook with TanStack Query + Supabase"
```

---

### Task 7: Team Consumer Updates

**Files:**
- Modify: `modules/team/TeamModule.tsx`
- Modify: `modules/team/components/TeamList.tsx`

**Context:** `useTeam` no longer exposes `getMemberStats`. Stats computation moves to TeamList, which receives `allAppointments` from `useAppointments`. Since `useAppointments` hasn't been migrated yet (Task 9), we'll import it from AppContext temporarily and update it in Task 10.

- [ ] **Step 1: Update TeamModule.tsx**

Replace the entire contents of `modules/team/TeamModule.tsx` with:

```typescript
import React, { useState } from 'react';
import { ViewState, StaffMember } from '../../types';
import { useTeam } from './hooks/useTeam';
import { useAppContext } from '../../context/AppContext';
import { TeamList } from './components/TeamList';
import { TeamForm } from './components/TeamForm';

export const TeamModule: React.FC = () => {
  const { team, allStaff, searchTerm, setSearchTerm, addStaffMember, updateStaffMember } = useTeam();
  const { appointments } = useAppContext();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedMemberId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedMemberId(id);
    setView('EDIT');
  };

  const handleSave = (member: StaffMember) => {
    if (selectedMemberId) {
      updateStaffMember(member);
    } else {
      addStaffMember(member);
    }
    setView('LIST');
  };

  return (
    <div className="w-full">
      {view === 'LIST' && (
        <TeamList
          team={team}
          appointments={appointments}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <TeamForm
          existingMember={allStaff.find(m => m.id === selectedMemberId)}
          onSave={handleSave}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Update TeamList.tsx — move stats computation to component**

In `modules/team/components/TeamList.tsx`:

Replace the import block:

```typescript
import { StaffMember } from '../../../types';
import { useAppContext } from '../../../context/AppContext';
```

With:

```typescript
import { StaffMember, Appointment } from '../../../types';
```

Replace the interface:

```typescript
interface TeamListProps {
  team: StaffMember[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  getStats: (id: string) => { totalAppointments: number, todayCount: number, totalRevenue: number };
}
```

With:

```typescript
interface TeamListProps {
  team: StaffMember[];
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}
```

Replace the component signature:

```typescript
export const TeamList: React.FC<TeamListProps> = ({ team, searchTerm, onSearchChange, onAdd, onEdit, getStats }) => {
```

With:

```typescript
export const TeamList: React.FC<TeamListProps> = ({ team, appointments, searchTerm, onSearchChange, onAdd, onEdit }) => {
```

Add `getMemberStats` as a local function inside the component, right after the `viewMode` state:

```typescript
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  const getMemberStats = (memberId: string) => {
    const memberAppointments = appointments.filter(a => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = memberAppointments.filter(a => a.date.startsWith(today));
    const totalRevenue = memberAppointments.reduce((sum, a) => sum + a.price, 0);
    return {
      totalAppointments: memberAppointments.length,
      todayCount: todaysAppointments.length,
      totalRevenue,
    };
  };
```

In the GRID view, change `getStats` calls to `getMemberStats`:

```typescript
const stats = getMemberStats(member.id);
```

(Both occurrences — in the GRID map and in the LIST tbody map — already use `getStats(member.id)`. Renaming the prop to a local function means these calls now use the local `getMemberStats` instead. Since the variable was previously `getStats` from props, update both occurrences to `getMemberStats`.)

Replace the two lines in the grid/list that read:
```typescript
            const stats = getStats(member.id);
```
With:
```typescript
            const stats = getMemberStats(member.id);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add modules/team/TeamModule.tsx modules/team/components/TeamList.tsx
git commit -m "feat(team): move stats to TeamList component, update consumers for new useTeam"
```

---

### Task 8: Appointments Mappers

**Files:**
- Create: `modules/appointments/mappers.ts`

- [ ] **Step 1: Create the appointments mappers file**

```typescript
// modules/appointments/mappers.ts
import type { Appointment, AppointmentStatus } from '../../types';

// Row type includes JOINed relations from:
// .select('*, clients(first_name, last_name), services(name), staff_members(first_name, last_name)')
interface AppointmentRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  service_id: string | null;
  service_variant_id: string | null;
  staff_id: string | null;
  date: string;
  duration_minutes: number;
  status: string;
  price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  // JOINed relations (nullable if FK is null)
  clients: { first_name: string; last_name: string } | null;
  services: { name: string } | null;
  staff_members: { first_name: string; last_name: string } | null;
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    clientName: row.clients
      ? `${row.clients.first_name} ${row.clients.last_name}`
      : '',
    serviceId: row.service_id ?? '',
    serviceName: row.services?.name ?? '',
    date: row.date,
    durationMinutes: row.duration_minutes,
    staffId: row.staff_id ?? '',
    staffName: row.staff_members
      ? `${row.staff_members.first_name} ${row.staff_members.last_name}`
      : '',
    status: row.status as AppointmentStatus,
    price: row.price,
    notes: row.notes ?? undefined,
  };
}

export function toAppointmentInsert(appt: Appointment, salonId: string) {
  return {
    id: appt.id || undefined,
    salon_id: salonId,
    client_id: appt.clientId || null,
    service_id: appt.serviceId || null,
    staff_id: appt.staffId || null,
    date: appt.date,
    duration_minutes: appt.durationMinutes,
    status: appt.status,
    price: appt.price,
    notes: appt.notes ?? null,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/mappers.ts
git commit -m "feat(appointments): add mappers with JOIN relation mapping for denormalized names"
```

---

### Task 9: Rewrite `useAppointments` Hook

**Files:**
- Modify: `modules/appointments/hooks/useAppointments.ts`

- [ ] **Step 1: Rewrite useAppointments.ts**

Replace the entire contents of `modules/appointments/hooks/useAppointments.ts` with:

```typescript
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toAppointment, toAppointmentInsert } from '../mappers';
import type { Appointment } from '../../../types';

export const useAppointments = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(first_name, last_name), services(name), staff_members(first_name, last_name)')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAppointment);
    },
    enabled: !!salonId,
  });

  const addAppointmentMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { error } = await supabase
        .from('appointments')
        .insert(toAppointmentInsert(appt, salonId));
      if (error) {
        // Surface double-booking constraint violation
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: (error) => console.error('Failed to add appointment:', error.message),
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { id, salon_id, ...updateData } = toAppointmentInsert(appt, salonId);
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appt.id);
      if (error) {
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: (error) => console.error('Failed to update appointment:', error.message),
  });

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const matchesSearch = a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchTerm, statusFilter]);

  return {
    appointments: filteredAppointments,
    allAppointments: appointments,
    isLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    addAppointment: (appt: Appointment) => addAppointmentMutation.mutate(appt),
    updateAppointment: (appt: Appointment) => updateAppointmentMutation.mutate(appt),
  };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: May have errors in consumers still using AppContext for appointments. Task 10 fixes these.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/hooks/useAppointments.ts
git commit -m "feat(appointments): rewrite useAppointments with TanStack Query, JOIN mapping, double-booking detection"
```

---

### Task 10: Appointments & Dashboard Consumer Updates

**Files:**
- Modify: `modules/appointments/components/AppointmentForm.tsx`
- Modify: `modules/dashboard/DashboardModule.tsx`
- Modify: `modules/team/TeamModule.tsx` (switch from AppContext appointments to useAppointments)

**Context:** Now that `useAppointments` is migrated, update all consumers that still read appointments from AppContext.

- [ ] **Step 1: Update AppointmentForm.tsx**

In `modules/appointments/components/AppointmentForm.tsx`:

Replace:

```typescript
import { useAppContext } from '../../../context/AppContext';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
```

With:

```typescript
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { useSettings } from '../../settings/hooks/useSettings';
```

Replace:

```typescript
  const { salonSettings, team } = useAppContext();
```

With:

```typescript
  const { salonSettings } = useSettings();
  const { allStaff: team } = useTeam();
```

No other changes needed — the component already uses `team` and `salonSettings` with the same shape.

- [ ] **Step 2: Update DashboardModule.tsx**

In `modules/dashboard/DashboardModule.tsx`:

Replace:

```typescript
import { useAppContext } from '../../context/AppContext';
import { useClients } from '../clients/hooks/useClients';
```

With:

```typescript
import { useAppContext } from '../../context/AppContext';
import { useClients } from '../clients/hooks/useClients';
import { useAppointments } from '../appointments/hooks/useAppointments';
```

Replace:

```typescript
  const { transactions, appointments } = useAppContext();
```

With:

```typescript
  const { transactions } = useAppContext();
  const { allAppointments: appointments } = useAppointments();
```

- [ ] **Step 3: Update TeamModule.tsx — switch to useAppointments**

In `modules/team/TeamModule.tsx`, replace the AppContext import used for appointments:

Replace:

```typescript
import { useTeam } from './hooks/useTeam';
import { useAppContext } from '../../context/AppContext';
```

With:

```typescript
import { useTeam } from './hooks/useTeam';
import { useAppointments } from '../appointments/hooks/useAppointments';
```

Replace:

```typescript
  const { appointments } = useAppContext();
```

With:

```typescript
  const { allAppointments: appointments } = useAppointments();
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds. All appointment consumers now read from Supabase.

- [ ] **Step 5: Commit**

```bash
git add modules/appointments/components/AppointmentForm.tsx modules/dashboard/DashboardModule.tsx modules/team/TeamModule.tsx
git commit -m "feat(appointments): switch all consumers from AppContext to useAppointments/useTeam/useSettings"
```

---

### Task 11: AppContext Cleanup

**Files:**
- Modify: `context/AppContext.tsx`

**Context:** Remove all migrated state: appointments, team, salonSettings, expenseCategories, recurringExpenses. After this, AppContext only retains: transactions, expenses, mock generators (Plan 2C targets).

- [ ] **Step 1: Rewrite AppContext.tsx**

Replace the entire contents of `context/AppContext.tsx` with:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Transaction,
  Expense,
} from '../types';

// --- Mock Generators (Plan 2C will migrate these to Supabase) ---
const generateMockTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (date.getDay() === 0 && Math.random() > 0.2) continue;
    const dailyCount = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < dailyCount; j++) {
      const amount = Math.floor(Math.random() * 150) + 40;
      const finalAmount = Math.random() > 0.95 ? amount * 5 : amount;
      const cost = finalAmount * (Math.random() * 0.15 + 0.1);
      transactions.push({
        id: `trx-${i}-${j}`,
        date: date.toISOString(),
        total: finalAmount,
        clientName: 'Client Passage',
        items: [
          {
            id: 'item1',
            referenceId: 'ref1',
            type: 'SERVICE',
            name: Math.random() > 0.5 ? 'Coupe Brushing' : 'Coloration',
            price: finalAmount,
            quantity: 1,
            cost: cost
          }
        ],
        payments: [{ id: 'p1', method: 'Carte Bancaire', amount: finalAmount }]
      });
    }
  }
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const generateMockExpenses = (): Expense[] => {
  const expenses: Expense[] = [];
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 5);
    expenses.push({ id: `rent-${i}`, date: d.toISOString(), description: 'Loyer Commercial', category: '1', amount: 1200, supplier: 'Agence Immo' });
    expenses.push({ id: `sal-${i}`, date: d.toISOString(), description: 'Salaires Équipe', category: '2', amount: 2500, supplier: 'Staff' });
    expenses.push({ id: `stock-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 12).toISOString(), description: 'Réassort Produits', category: '3', amount: Math.random() * 500 + 200, supplier: 'L\'Oréal' });
    expenses.push({ id: `rand-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 18).toISOString(), description: 'Maintenance', category: '5', amount: Math.random() * 150, supplier: 'ReparTout' });
  }
  return expenses;
};

interface AppContextType {
  // POS & Accounting (Plan 2C targets)
  transactions: Transaction[];
  expenses: Expense[];
  addTransaction: (transaction: Transaction) => void;
  addExpense: (expense: Expense) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Initialize mock history
  useEffect(() => {
    setTransactions(generateMockTransactions());
    setExpenses(generateMockExpenses());
  }, []);

  // --- Actions ---
  const addTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
    // Note: Product stock updates moved to Supabase in Plan 2C (transaction migration)
    // Note: Client stats now computed by client_stats DB view, auto-updated on query refetch
  };

  const addExpense = (e: Expense) => setExpenses(prev => [...prev, e]);

  const value = {
    transactions, expenses, addTransaction, addExpense,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. If any file still imports removed fields from AppContext, the build will catch it.

- [ ] **Step 3: Commit**

```bash
git add context/AppContext.tsx
git commit -m "refactor(context): remove team, appointments, settings from AppContext — now on Supabase"
```

---

### Task 12: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Data Layer section in CLAUDE.md**

In `CLAUDE.md`, find the "Data Layer" section and update it to reflect 7/10 modules migrated. Update the "State Management" section and "Known Issues" item 1.

In the **State Management** subsection, update text to reflect:

```markdown
### State Management
- **Supabase + TanStack Query** (primary): Clients, Suppliers, Products, Services, Team, Appointments, Settings (salon config, expense categories, recurring expenses) — 7 modules migrated
- **AppContext** (legacy, Plan 2C targets): Transactions, Expenses — still in-memory with mock data generators
- Each module accesses Supabase data via its own `use{Module}()` hook
- Local UI state (view, search, selection) stays in the component
```

In the **Known Issues** list, update item 1:

```markdown
1. ~~No data persistence~~ → 7/10 modules now persist via Supabase. Remaining: Transactions, Expenses (Plan 2C)
```

In the **Data Layer** section, add Team, Appointments, Settings to the list of migrated modules and note the settings pattern:

```markdown
- **Settings** hook reads/writes the `salons` row directly (not a separate settings table). `refreshActiveSalon()` syncs AuthContext after updates.
- **Appointments** hook uses JOIN query: `select('*, clients(...), services(...), staff_members(...)')` to map denormalized name fields.
- **Team** hook handles JSONB fields (`schedule`, `bonus_tiers`) natively via Supabase JS.
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (documentation-only change)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Plan 2B — 7/10 modules on Supabase"
```

---

## Self-Review Checklist

### Spec Coverage
| Spec Requirement | Task |
|---|---|
| Settings: salon row read/write | Task 1 (mappers) + Task 3 (hook) |
| Settings: activeSalon sync | Task 2 (AuthContext) + Task 3 (onSuccess) |
| Settings: expense categories CRUD | Task 1 + Task 3 |
| Settings: recurring expenses CRUD | Task 1 + Task 3 |
| Settings: consumer switchover | Task 4 |
| Team: JSONB fields (schedule, bonus_tiers) | Task 5 (mappers) |
| Team: allStaff for dropdowns | Task 6 (hook returns allStaff) |
| Team: stats at component level | Task 7 (TeamList) |
| Appointments: 4-entity JOIN | Task 8 (mapper) + Task 9 (hook query) |
| Appointments: double-booking error | Task 9 (error code 23P01) |
| Appointments: consumer switchover | Task 10 |
| AppContext cleanup | Task 11 |
| CLAUDE.md update | Task 12 |

### Placeholder Scan
No TBD, TODO, or placeholder content found.

### Type Consistency
- `toSalonSettings` / `toSalonUpdate` use `SalonSettings` type throughout
- `toStaffMember` / `toStaffMemberInsert` use `StaffMember` type throughout
- `toAppointment` / `toAppointmentInsert` use `Appointment` type throughout
- `useTeam` returns `{ team, allStaff }` — consumed correctly in TeamModule (Task 7) and AppointmentForm (Task 10)
- `useAppointments` returns `{ appointments, allAppointments }` — consumed correctly in Dashboard (Task 10) and TeamModule (Task 10)
- `useSettings` returns `{ salonSettings, expenseCategories, recurringExpenses }` — consumed correctly in all settings components (Task 4) and usePOS (Task 4)
- `refreshActiveSalon` signature `(updates: Partial<ActiveSalon>) => void` — used correctly in Task 3 onSuccess
