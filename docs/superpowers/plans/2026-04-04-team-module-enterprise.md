# Team Module Enterprise Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the team module into an enterprise-level staff management system with detail pages, inline editing, invitations, payout tracking, and rich linked data.

**Architecture:** Nested React Router routes under `#/team` with `<Outlet>`. Dashboard-style staff detail page with pinned header + 5 tabs. New `staff_payouts` table + 2 RPCs for server-side aggregations. 7 new hooks following TanStack Query patterns.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query, Supabase (PostgreSQL + RLS + RPCs), Recharts, Tailwind CSS, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-04-team-module-enterprise-design.md`

---

## Phase 1: Database Migrations

### Task 1: Create `staff_payouts` table migration

**Files:**
- Create: `supabase/migrations/20260404200000_staff_payouts.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Staff payouts table for tracking salary, commission, and bonus payments
CREATE TABLE staff_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SALARY', 'COMMISSION', 'BONUS', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  amount NUMERIC(10,2) NOT NULL,
  reference_amount NUMERIC(10,2),
  rate_snapshot NUMERIC(5,2),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_staff_payouts_salon_staff ON staff_payouts(salon_id, staff_id);
CREATE INDEX idx_staff_payouts_period ON staff_payouts(salon_id, staff_id, period_start, period_end);

-- Auto-update updated_at trigger
CREATE TRIGGER staff_payouts_updated_at
  BEFORE UPDATE ON staff_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE staff_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_payouts_select" ON staff_payouts
  FOR SELECT USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );

CREATE POLICY "staff_payouts_insert" ON staff_payouts
  FOR INSERT WITH CHECK (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );

CREATE POLICY "staff_payouts_update" ON staff_payouts
  FOR UPDATE USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Migration applies successfully, table created.

- [ ] **Step 3: Regenerate types**

Run: `npm run db:types`
Expected: `lib/database.types.ts` updated with `staff_payouts` table types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404200000_staff_payouts.sql lib/database.types.ts
git commit -m "feat: add staff_payouts table for payout tracking"
```

---

### Task 2: Create `get_staff_activity` and `get_staff_clients` RPCs

**Files:**
- Create: `supabase/migrations/20260404200001_staff_rpc_activity_clients.sql`

- [ ] **Step 1: Create migration file**

```sql
-- RPC: get_staff_activity
-- Returns a paginated chronological feed of staff events (appointments + sales)
CREATE OR REPLACE FUNCTION get_staff_activity(
  p_staff_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  event_type TEXT,
  event_date TIMESTAMPTZ,
  description TEXT,
  client_name TEXT,
  metadata JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Security check: caller must have access to this staff member's salon
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  IF v_salon_id IS NULL OR v_salon_id NOT IN (SELECT user_salon_ids()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  (
    -- Completed appointments
    SELECT
      CASE a.status
        WHEN 'COMPLETED' THEN 'appointment_completed'
        WHEN 'CANCELLED' THEN 'appointment_cancelled'
        WHEN 'NO_SHOW' THEN 'appointment_no_show'
      END AS event_type,
      a.date AS event_date,
      COALESCE(s.name, 'Service') AS description,
      COALESCE(c.first_name || ' ' || c.last_name, 'Client inconnu') AS client_name,
      jsonb_build_object(
        'appointment_id', a.id,
        'service_id', a.service_id,
        'duration', a.duration_minutes,
        'price', a.price,
        'status', a.status
      ) AS metadata
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.staff_id = p_staff_id
      AND a.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')
      AND a.deleted_at IS NULL

    UNION ALL

    -- Sales (transaction items attributed to this staff)
    SELECT
      'sale' AS event_type,
      t.date AS event_date,
      ti.name || COALESCE(' - ' || ti.variant_name, '') AS description,
      COALESCE(c.first_name || ' ' || c.last_name, 'Client inconnu') AS client_name,
      jsonb_build_object(
        'transaction_id', t.id,
        'item_type', ti.type,
        'price', ti.price,
        'quantity', ti.quantity,
        'total', ti.price * ti.quantity
      ) AS metadata
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    LEFT JOIN clients c ON c.id = t.client_id
    WHERE ti.staff_id = p_staff_id
  )
  ORDER BY event_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- RPC: get_staff_clients
-- Returns top clients by visit frequency for a given staff member
CREATE OR REPLACE FUNCTION get_staff_clients(
  p_staff_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  client_id UUID,
  client_first_name TEXT,
  client_last_name TEXT,
  visit_count BIGINT,
  total_revenue NUMERIC,
  last_visit DATE
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Security check
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  IF v_salon_id IS NULL OR v_salon_id NOT IN (SELECT user_salon_ids()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS client_id,
    c.first_name AS client_first_name,
    c.last_name AS client_last_name,
    COUNT(DISTINCT a.id) AS visit_count,
    COALESCE(SUM(a.price), 0) AS total_revenue,
    MAX(a.date)::date AS last_visit
  FROM appointments a
  JOIN clients c ON c.id = a.client_id
  WHERE a.staff_id = p_staff_id
    AND a.status = 'COMPLETED'
    AND a.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.first_name, c.last_name
  ORDER BY visit_count DESC
  LIMIT p_limit;
END;
$$;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Both functions created successfully.

- [ ] **Step 3: Regenerate types**

Run: `npm run db:types`
Expected: `lib/database.types.ts` updated with RPC function signatures.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404200001_staff_rpc_activity_clients.sql lib/database.types.ts
git commit -m "feat: add get_staff_activity and get_staff_clients RPCs"
```

---

## Phase 2: Type Updates & Utility Extraction

### Task 3: Add `membershipId` to `StaffMember` type and update mapper

**Files:**
- Modify: `types.ts:135-169` (StaffMember interface)
- Modify: `modules/team/mappers.ts:39-75` (toStaffMember function)

- [ ] **Step 1: Add `membershipId` and `deletedAt` to StaffMember type**

In `types.ts`, add to the `StaffMember` interface (after `active: boolean` around line 149):

```typescript
  membershipId?: string;
  deletedAt?: string;
```

- [ ] **Step 2: Add `StaffPayout` type**

In `types.ts`, add after the `StaffMember` interface (after line ~171):

```typescript
export type PayoutType = 'SALARY' | 'COMMISSION' | 'BONUS' | 'OTHER';
export type PayoutStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface StaffPayout {
  id: string;
  salonId: string;
  staffId: string;
  type: PayoutType;
  status: PayoutStatus;
  amount: number;
  referenceAmount?: number;
  rateSnapshot?: number;
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

export interface StaffActivityEvent {
  eventType: 'appointment_completed' | 'appointment_cancelled' | 'appointment_no_show' | 'sale';
  eventDate: string;
  description: string;
  clientName: string;
  metadata: Record<string, unknown>;
}

export interface StaffClient {
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  visitCount: number;
  totalRevenue: number;
  lastVisit: string;
}
```

- [ ] **Step 3: Update mapper to include `membershipId` and `deletedAt`**

In `modules/team/mappers.ts`, in the `toStaffMember` function, add to the return object:

```typescript
    membershipId: row.membership_id ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add types.ts modules/team/mappers.ts
git commit -m "feat: add membershipId, deletedAt to StaffMember type and payout/activity types"
```

---

### Task 4: Extract compensation utils from `useTeamPerformance`

**Files:**
- Create: `modules/team/utils.ts`
- Modify: `modules/team/hooks/useTeamPerformance.ts:17-38`

- [ ] **Step 1: Create `utils.ts` with extracted functions**

```typescript
import { WorkSchedule, BonusTier } from '../../types';

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

export function countWorkingDays(
  from: Date,
  to: Date,
  schedule: WorkSchedule
): number {
  let count = 0;
  const d = new Date(from);
  while (d <= to) {
    const dayKey = DAY_KEYS[d.getDay()];
    if (schedule[dayKey].isOpen) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function calcBonus(
  revenue: number,
  tiers: BonusTier[]
): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.target - a.target);
  const reached = sorted.find((t) => revenue >= t.target);
  return reached ? reached.bonus : 0;
}

export function calcCommission(
  revenue: number,
  rate: number
): number {
  return revenue * (rate / 100);
}
```

- [ ] **Step 2: Update `useTeamPerformance.ts` to import from utils**

Replace the local `DAY_KEYS`, `countWorkingDays`, and `calcBonus` definitions (lines 17-38) with:

```typescript
import { countWorkingDays, calcBonus } from '../utils';
```

Remove the `DAY_KEYS` const (line 17-19), `countWorkingDays` function (lines 21-31), and `calcBonus` function (lines 33-38).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/team/utils.ts modules/team/hooks/useTeamPerformance.ts
git commit -m "refactor: extract compensation utils from useTeamPerformance"
```

---

## Phase 3: Routing Refactor

### Task 5: Refactor `TeamModule` into a route shell with `<Outlet>`

**Files:**
- Modify: `App.tsx:79-83` (team route)
- Modify: `modules/team/TeamModule.tsx` (full rewrite to shell)
- Create: `modules/team/pages/TeamListPage.tsx`
- Create: `modules/team/pages/NewStaffPage.tsx`

- [ ] **Step 1: Create `TeamListPage.tsx`**

This extracts the current list/performance tab logic from `TeamModule.tsx`:

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamList } from '../components/TeamList';
import { TeamPerformance } from '../components/TeamPerformance';
import { useTeam } from '../hooks/useTeam';
import { useAppointments } from '../../../modules/appointments/hooks/useAppointments';

type Tab = 'members' | 'performance';

export const TeamListPage: React.FC = () => {
  const { team, allStaff, searchTerm, setSearchTerm } = useTeam();
  const { appointments: allAppointments } = useAppointments();
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const navigate = useNavigate();

  const appointments = allAppointments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'members'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Membres
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'performance'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Performance
        </button>
      </div>

      {activeTab === 'members' ? (
        <TeamList
          team={team}
          appointments={appointments}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={() => navigate('/team/new')}
          onEdit={(id) => navigate(`/team/${id}`)}
        />
      ) : (
        <TeamPerformance staff={allStaff} />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create `NewStaffPage.tsx`**

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { TeamForm } from '../components/TeamForm';
import { useTeam } from '../hooks/useTeam';
import { StaffMember } from '../../../types';

export const NewStaffPage: React.FC = () => {
  const navigate = useNavigate();
  const { addStaffMember } = useTeam();

  const handleSave = async (member: StaffMember) => {
    const result = await addStaffMember(member);
    if (result?.id) {
      navigate(`/team/${result.id}`);
    } else {
      navigate('/team');
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/team')}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Équipe
      </button>
      <TeamForm onSave={handleSave} onCancel={() => navigate('/team')} />
    </div>
  );
};
```

- [ ] **Step 3: Rewrite `TeamModule.tsx` as route shell**

```typescript
import React from 'react';
import { Outlet } from 'react-router-dom';

export const TeamModule: React.FC = () => {
  return <Outlet />;
};
```

- [ ] **Step 4: Update `App.tsx` route config**

Replace the team route (around line 79-83):

```typescript
// Old:
<Route path="/team" element={<ProtectedRoute action="view" resource="team"><ErrorBoundary moduleName="Équipe"><TeamModule /></ErrorBoundary></ProtectedRoute>} />

// New:
<Route path="/team" element={<ProtectedRoute action="view" resource="team"><ErrorBoundary moduleName="Équipe"><TeamModule /></ErrorBoundary></ProtectedRoute>}>
  <Route index element={<TeamListPage />} />
  <Route path="new" element={<NewStaffPage />} />
  <Route path=":id" element={<StaffDetailPlaceholder />} />
</Route>
```

Add imports at top of `App.tsx`:

```typescript
import { TeamListPage } from './modules/team/pages/TeamListPage';
import { NewStaffPage } from './modules/team/pages/NewStaffPage';
```

Add a temporary placeholder for the detail page (inside `App.tsx` or as a separate file):

```typescript
const StaffDetailPlaceholder: React.FC = () => {
  const { id } = useParams();
  return <div className="p-8 text-slate-500">Staff detail page for {id} — coming in Phase 4</div>;
};
```

Add `useParams` to the react-router-dom import.

- [ ] **Step 5: Update `useTeam.addStaffMember` to return the new ID**

In `modules/team/hooks/useTeam.ts`, modify the `addStaffMemberMutation` (around line 60-75) to return the inserted row. The mutation's `mutationFn` should return the data:

```typescript
mutationFn: async (member: StaffMember) => {
  const insert = toStaffMemberInsert(member, salonId!);
  const { data, error } = await supabase
    .from('staff_members')
    .insert(insert)
    .select('id')
    .single();
  if (error) throw error;
  await savePiiFields(data.id, member);
  return data;
},
```

Then update the exposed function to return the result:

```typescript
addStaffMember: (member: StaffMember) => addStaffMemberMutation.mutateAsync(member),
```

- [ ] **Step 6: Verify build and test navigation**

Run: `npm run build`
Expected: Build succeeds. Navigating to `/team` shows list, `/team/new` shows form, `/team/:id` shows placeholder.

- [ ] **Step 7: Commit**

```bash
git add App.tsx modules/team/TeamModule.tsx modules/team/pages/TeamListPage.tsx modules/team/pages/NewStaffPage.tsx modules/team/hooks/useTeam.ts
git commit -m "feat: refactor team module to nested routes with Outlet"
```

---

### Task 6: Update `TeamCard`, `TeamTable`, and `TeamPerformance` navigation

**Files:**
- Modify: `modules/team/components/TeamCard.tsx`
- Modify: `modules/team/components/TeamTable.tsx`
- Modify: `modules/team/components/TeamPerformance.tsx`

- [ ] **Step 1: Update `TeamCard` — `onEdit` prop rename to `onSelect`**

In `TeamCard.tsx`, rename `onEdit` to `onSelect` in the props interface (line 9):

```typescript
interface TeamCardProps {
  team: StaffMember[];
  appointments: Appointment[];
  onSelect: (id: string) => void;
}
```

Update the click handler (the card's onClick) to use `onSelect`. Also add visual distinction for archived members — if `member.deletedAt` is set, add a greyed-out style and "Archivé" badge.

- [ ] **Step 2: Update `TeamTable` — same rename**

Same change: rename `onEdit` to `onSelect` in props and usage.

- [ ] **Step 3: Update `TeamList` — pass through renamed prop**

In `TeamList.tsx`, rename `onEdit` to `onSelect` in `TeamListProps` (line 16) and pass it through to `TeamCard`/`TeamTable`.

- [ ] **Step 4: Update `TeamPerformance` — add navigation on row click**

In `TeamPerformance.tsx`, add `useNavigate` import and a click handler on performance rows:

```typescript
const navigate = useNavigate();
// In PerformanceCard onClick:
onClick={() => navigate(`/team/${perf.staff.id}?tab=performance`)}
```

Remove the `StaffKpiModal` usage — clicking now navigates to the detail page instead.

- [ ] **Step 5: Update `TeamListPage` to use new prop names**

In `TeamListPage.tsx`, update the `TeamList` usage:

```typescript
onSelect={(id) => navigate(`/team/${id}`)}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add modules/team/components/TeamCard.tsx modules/team/components/TeamTable.tsx modules/team/components/TeamList.tsx modules/team/components/TeamPerformance.tsx modules/team/pages/TeamListPage.tsx
git commit -m "feat: update team list components to navigate to detail page"
```

---

## Phase 4: Staff Detail Page — Core Structure

### Task 7: Create `useStaffDetail` hook

**Files:**
- Create: `modules/team/hooks/useStaffDetail.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { toastOnError } from '../../../hooks/useMutationToast';
import { toStaffMember, toStaffMemberInsert } from '../mappers';
import { StaffMember } from '../../../types';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';

export const useStaffDetail = (staffId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  useRealtimeSync('staff_members');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff_member', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('id', staffId)
        .single();
      if (error) throw error;
      return toStaffMember(data as any);
    },
    enabled: !!salonId && !!staffId,
  });

  const loadPii = async (): Promise<Partial<StaffMember>> => {
    const { data, error } = await supabase.rpc('get_staff_pii', {
      p_staff_id: staffId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      baseSalary: row?.base_salary ? parseFloat(row.base_salary) : undefined,
      iban: row?.iban ?? undefined,
      socialSecurityNumber: row?.social_security_number ?? undefined,
    };
  };

  const savePiiFields = async (id: string, member: Partial<StaffMember>) => {
    const { error } = await supabase.rpc('update_staff_pii', {
      p_staff_id: id,
      p_base_salary: member.baseSalary?.toString() ?? null,
      p_iban: member.iban ?? null,
      p_social_security_number: member.socialSecurityNumber ?? null,
      p_clear_salary: member.baseSalary === undefined || member.baseSalary === null,
      p_clear_iban: !member.iban,
      p_clear_ssn: !member.socialSecurityNumber,
    });
    if (error) throw error;
  };

  const updateSectionMutation = useMutation({
    mutationFn: async (updates: Partial<StaffMember>) => {
      const hasPii = 'baseSalary' in updates || 'iban' in updates || 'socialSecurityNumber' in updates;

      // Non-PII fields
      const { baseSalary, iban, socialSecurityNumber, ...rest } = updates;
      if (Object.keys(rest).length > 0) {
        const current = staff!;
        const merged = { ...current, ...rest };
        const insert = toStaffMemberInsert(merged, salonId!);
        const { id: _id, salon_id: _sid, ...updatePayload } = insert;
        const { error } = await supabase
          .from('staff_members')
          .update(updatePayload)
          .eq('id', staffId)
          .eq('salon_id', salonId!);
        if (error) throw error;
      }

      // PII fields
      if (hasPii) {
        await savePiiFields(staffId, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_member', salonId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
      addToast({ type: 'success', message: 'Modifications enregistrées' });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (staff?.membershipId) {
        // Linked staff: revoke membership (atomically deletes membership + staff)
        const { error } = await supabase.rpc('revoke_membership', {
          p_membership_id: staff.membershipId,
        });
        if (error) throw error;
      } else {
        // Ghost staff: direct soft delete
        const { error } = await supabase
          .from('staff_members')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', staffId);
        if (error) throw error;
      }

      // Cancel pending invitations
      await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('staff_member_id', staffId)
        .is('accepted_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
      addToast({ type: 'success', message: staff?.membershipId ? 'Membre archivé et accès révoqué' : 'Membre archivé' });
    },
    onError: toastOnError('Erreur lors de l\'archivage'),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('staff_members')
        .update({ deleted_at: null })
        .eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_member', salonId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
      addToast({ type: 'success', message: 'Membre restauré' });
    },
    onError: toastOnError('Erreur lors de la restauration'),
  });

  return {
    staff,
    isLoading,
    isArchived: !!staff?.deletedAt,
    loadPii,
    updateSection: (updates: Partial<StaffMember>) => updateSectionMutation.mutateAsync(updates),
    isUpdating: updateSectionMutation.isPending,
    archive: () => archiveMutation.mutateAsync(),
    restore: () => restoreMutation.mutateAsync(),
  };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/team/hooks/useStaffDetail.ts
git commit -m "feat: add useStaffDetail hook with CRUD, PII, archive/restore"
```

---

### Task 8: Create `StaffDetailPage` and `StaffHeader`

**Files:**
- Create: `modules/team/pages/StaffDetailPage.tsx`
- Create: `modules/team/components/StaffHeader.tsx`

- [ ] **Step 1: Create `StaffHeader.tsx`**

```typescript
import React from 'react';
import {
  Mail, Phone, Calendar, TrendingUp, Percent, Clock,
  Link2, UserCheck, Send, Archive, RotateCcw,
} from 'lucide-react';
import { StaffMember } from '../../../types';
import { StaffAvatar } from '../../../components/StaffAvatar';
import { formatPrice } from '../../../lib/format';

interface StaffHeaderProps {
  staff: StaffMember;
  isArchived: boolean;
  monthlyRevenue: number;
  monthlyAppointments: number;
  currencySymbol: string;
  hasPendingInvitation: boolean;
  invitationExpiresAt?: string;
  onInvite: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  staff,
  isArchived,
  monthlyRevenue,
  monthlyAppointments,
  currencySymbol,
  hasPendingInvitation,
  invitationExpiresAt,
  onInvite,
  onArchive,
  onRestore,
}) => {
  const seniority = staff.startDate
    ? Math.floor((Date.now() - new Date(staff.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const roleColors: Record<string, string> = {
    Manager: 'bg-purple-100 text-purple-700',
    Stylist: 'bg-pink-100 text-pink-700',
    Assistant: 'bg-blue-100 text-blue-700',
    Receptionist: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${isArchived ? 'opacity-60' : ''}`}>
      {isArchived && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <span className="text-sm text-amber-800">
            Ce membre a été archivé le {new Date(staff.deletedAt!).toLocaleDateString('fr-FR')}
          </span>
          <button
            onClick={onRestore}
            className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurer
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Avatar + Identity */}
        <div className="flex items-start gap-4 flex-1">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: staff.color || '#64748b' }}>
            {staff.firstName[0]}{staff.lastName?.[0] || ''}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                {staff.firstName} {staff.lastName}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[staff.role] || 'bg-slate-100 text-slate-700'}`}>
                {staff.role}
              </span>
              {isArchived ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Archivé</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Actif</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              {staff.email && (
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{staff.email}</span>
              )}
              {staff.phone && (
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{staff.phone}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isArchived && (
          <div className="flex items-start gap-2">
            {staff.membershipId ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg">
                <UserCheck className="w-3.5 h-3.5" /> Compte lié
              </span>
            ) : hasPendingInvitation ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg">
                <Clock className="w-3.5 h-3.5" /> Invitation en attente
                {invitationExpiresAt && (
                  <span className="text-amber-500 ml-1">
                    (expire le {new Date(invitationExpiresAt).toLocaleDateString('fr-FR')})
                  </span>
                )}
              </span>
            ) : (
              <button
                onClick={onInvite}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" /> Inviter par lien
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">RDV ce mois</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{monthlyAppointments}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">CA ce mois</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{formatPrice(monthlyRevenue, currencySymbol)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Commission</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{staff.commissionRate}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Ancienneté</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">
            {seniority !== null ? `${seniority} an${seniority > 1 ? 's' : ''}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `StaffDetailPage.tsx`**

```typescript
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, User, TrendingUp, Wallet, CalendarDays, Activity } from 'lucide-react';
import { useStaffDetail } from '../hooks/useStaffDetail';
import { useInvitation } from '../hooks/useInvitation';
import { useSettings } from '../../settings/hooks/useSettings';
import { useTransactions } from '../../../hooks/useTransactions';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { StaffHeader } from '../components/StaffHeader';
import { StaffProfileTab } from '../components/StaffProfileTab';
import { StaffPerformanceTab } from '../components/StaffPerformanceTab';
import { StaffRemunerationTab } from '../components/StaffRemunerationTab';
import { StaffAgendaTab } from '../components/StaffAgendaTab';
import { StaffActivityTab } from '../components/StaffActivityTab';
import { InvitationModal } from '../components/InvitationModal';

const TABS = [
  { key: 'profil', label: 'Profil', icon: User },
  { key: 'performance', label: 'Performance', icon: TrendingUp },
  { key: 'remuneration', label: 'Rémunération', icon: Wallet },
  { key: 'agenda', label: 'Agenda', icon: CalendarDays },
  { key: 'activite', label: 'Activité', icon: Activity },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const StaffDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = (searchParams.get('tab') as TabKey) || 'profil';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { staff, isLoading, isArchived, updateSection, isUpdating, archive, restore, loadPii } = useStaffDetail(id!);
  const { invitation, createInvitation, cancelInvitation } = useInvitation(id!);
  const { salonSettings } = useSettings();
  const { transactions } = useTransactions();
  const { appointments } = useAppointments();

  const currencySymbol = salonSettings?.currency === 'MAD' ? 'MAD' : '€';

  // Monthly stats for header
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyStats = useMemo(() => {
    if (!staff || !transactions) return { revenue: 0, appointments: 0 };
    const revenue = (transactions || [])
      .filter((t: any) => new Date(t.date) >= monthStart)
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);
    const apptCount = (appointments || [])
      .filter((a: any) => a.staffId === staff.id && new Date(a.date) >= monthStart && a.status !== 'CANCELLED')
      .length;
    return { revenue, appointments: apptCount };
  }, [staff, transactions, appointments, monthStart]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Membre introuvable</p>
        <button onClick={() => navigate('/team')} className="mt-4 text-pink-600 hover:text-pink-700 text-sm">
          Retour à l'équipe
        </button>
      </div>
    );
  }

  const handleArchive = async () => {
    await archive();
    navigate('/team');
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/team')}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Équipe
      </button>

      {/* Header */}
      <StaffHeader
        staff={staff}
        isArchived={isArchived}
        monthlyRevenue={monthlyStats.revenue}
        monthlyAppointments={monthlyStats.appointments}
        currencySymbol={currencySymbol}
        hasPendingInvitation={!!invitation}
        invitationExpiresAt={invitation?.expires_at}
        onInvite={() => setShowInviteModal(true)}
        onArchive={handleArchive}
        onRestore={restore}
      />

      {/* Tabs */}
      {!isArchived && (
        <>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'profil' && (
            <StaffProfileTab
              staff={staff}
              loadPii={loadPii}
              onSave={updateSection}
              isSaving={isUpdating}
              currencySymbol={currencySymbol}
              onArchive={handleArchive}
            />
          )}
          {activeTab === 'performance' && (
            <StaffPerformanceTab staffId={staff.id} currencySymbol={currencySymbol} />
          )}
          {activeTab === 'remuneration' && (
            <StaffRemunerationTab staff={staff} currencySymbol={currencySymbol} onSave={updateSection} />
          )}
          {activeTab === 'agenda' && (
            <StaffAgendaTab staff={staff} />
          )}
          {activeTab === 'activite' && (
            <StaffActivityTab staffId={staff.id} />
          )}
        </>
      )}

      {/* Invitation Modal */}
      {showInviteModal && (
        <InvitationModal
          staffEmail={staff.email}
          staffRole={staff.role}
          onSubmit={async (email) => {
            await createInvitation(email);
            setShowInviteModal(false);
          }}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 3: Create stub tab components**

Create minimal placeholder files so the build works. Each will be implemented in later tasks.

For each of these files, create a simple placeholder:
- `modules/team/components/StaffProfileTab.tsx`
- `modules/team/components/StaffPerformanceTab.tsx`
- `modules/team/components/StaffRemunerationTab.tsx`
- `modules/team/components/StaffAgendaTab.tsx`
- `modules/team/components/StaffActivityTab.tsx`
- `modules/team/components/InvitationModal.tsx`

Example stub pattern (repeat for each):

```typescript
import React from 'react';

interface StaffProfileTabProps {
  staff: any;
  loadPii: () => Promise<any>;
  onSave: (updates: any) => Promise<void>;
  isSaving: boolean;
  currencySymbol: string;
  onArchive: () => void;
}

export const StaffProfileTab: React.FC<StaffProfileTabProps> = () => {
  return <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-500">Profil — à implémenter</div>;
};
```

Also create a stub `useInvitation` hook:

```typescript
// modules/team/hooks/useInvitation.ts
export const useInvitation = (_staffId: string) => {
  return {
    invitation: null as any,
    createInvitation: async (_email: string) => {},
    cancelInvitation: async () => {},
  };
};
```

- [ ] **Step 4: Update `App.tsx` to use `StaffDetailPage` instead of placeholder**

Replace `StaffDetailPlaceholder` with:

```typescript
import { StaffDetailPage } from './modules/team/pages/StaffDetailPage';
```

And in the route:
```typescript
<Route path=":id" element={<StaffDetailPage />} />
```

Remove the placeholder component.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds. Navigation to `/team/:id` shows header + tab placeholders.

- [ ] **Step 6: Commit**

```bash
git add modules/team/pages/StaffDetailPage.tsx modules/team/components/StaffHeader.tsx modules/team/components/StaffProfileTab.tsx modules/team/components/StaffPerformanceTab.tsx modules/team/components/StaffRemunerationTab.tsx modules/team/components/StaffAgendaTab.tsx modules/team/components/StaffActivityTab.tsx modules/team/components/InvitationModal.tsx modules/team/hooks/useInvitation.ts App.tsx
git commit -m "feat: add StaffDetailPage with header, tabs, and stub components"
```

---

## Phase 5: Tab Implementations

### Task 9: Implement `StaffProfileTab` with inline editing

**Files:**
- Modify: `modules/team/components/StaffProfileTab.tsx` (replace stub)

- [ ] **Step 1: Implement the full profile tab**

The component has 3 inline-editable sections + client portfolio + danger zone. Each section uses a local `editing` state boolean, a local `draft` state for form values, and calls `onSave(draft)` to persist.

Key patterns:
- `useState<'none' | 'personal' | 'contract' | 'pii'>('none')` for which section is in edit mode
- For PII section: call `loadPii()` when entering edit mode, populate draft with decrypted values
- Reuse `WorkScheduleEditor` for schedule editing in the contract section
- Reuse existing `FormElements` (`Input`, `Select`, `TextArea`) for form fields
- "Zone de danger" at bottom with collapsible `<details>` element containing archive button + confirmation modal
- Client portfolio section uses `useStaffClients` hook (to be implemented in Task 13)

This file will be large (~400 lines). Structure it with sub-components for each section defined inline.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add modules/team/components/StaffProfileTab.tsx
git commit -m "feat: implement StaffProfileTab with inline editing and danger zone"
```

---

### Task 10: Implement `StaffPerformanceTab`

**Files:**
- Modify: `modules/team/components/StaffPerformanceTab.tsx` (replace stub)

- [ ] **Step 1: Implement the performance tab**

This is essentially the `StaffKpiModal` content promoted to a full tab. It uses:
- `useTransactions()` for revenue data, filtered by `staffId` and date range
- `DateRangePicker` for period selection
- KPI cards: total revenue, service revenue, product revenue, avg basket, appointments completed, cancellation/no-show rates
- Recharts `BarChart` for daily revenue (only if range <= 31 days)
- Top 5 services table

Reuse the calculation patterns from `StaffKpiModal.tsx` (lines 17-27 for bonus calc, revenue grouping logic).

- [ ] **Step 2: Delete `StaffKpiModal.tsx`**

Remove `modules/team/components/StaffKpiModal.tsx` since its functionality is now in `StaffPerformanceTab`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add modules/team/components/StaffPerformanceTab.tsx
git rm modules/team/components/StaffKpiModal.tsx
git commit -m "feat: implement StaffPerformanceTab, remove StaffKpiModal"
```

---

### Task 11: Implement `useStaffPayouts` and `useStaffCompensation` hooks

**Files:**
- Create: `modules/team/hooks/useStaffPayouts.ts`
- Create: `modules/team/hooks/useStaffCompensation.ts`

- [ ] **Step 1: Create `useStaffPayouts.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { toastOnError } from '../../../hooks/useMutationToast';
import { StaffPayout, PayoutType } from '../../../types';

interface CreatePayoutInput {
  type: PayoutType;
  amount: number;
  referenceAmount?: number;
  rateSnapshot?: number;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

function toStaffPayout(row: any): StaffPayout {
  return {
    id: row.id,
    salonId: row.salon_id,
    staffId: row.staff_id,
    type: row.type,
    status: row.status,
    amount: parseFloat(row.amount),
    referenceAmount: row.reference_amount ? parseFloat(row.reference_amount) : undefined,
    rateSnapshot: row.rate_snapshot ? parseFloat(row.rate_snapshot) : undefined,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    paidAt: row.paid_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export const useStaffPayouts = (staffId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['staff_payouts', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_payouts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('salon_id', salonId!)
        .is('deleted_at', null)
        .order('period_start', { ascending: false });
      if (error) throw error;
      return (data || []).map(toStaffPayout);
    },
    enabled: !!salonId && !!staffId,
  });

  const addPayoutMutation = useMutation({
    mutationFn: async (input: CreatePayoutInput) => {
      const { error } = await supabase.from('staff_payouts').insert({
        salon_id: salonId!,
        staff_id: staffId,
        ...input,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        reference_amount: input.referenceAmount,
        rate_snapshot: input.rateSnapshot,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
      addToast({ type: 'success', message: 'Paiement enregistré' });
    },
    onError: toastOnError('Erreur lors de l\'enregistrement'),
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase
        .from('staff_payouts')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('id', payoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
      addToast({ type: 'success', message: 'Marqué comme payé' });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const cancelPayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase
        .from('staff_payouts')
        .update({ status: 'CANCELLED' })
        .eq('id', payoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
      addToast({ type: 'success', message: 'Paiement annulé' });
    },
    onError: toastOnError('Erreur lors de l\'annulation'),
  });

  return {
    payouts,
    isLoading,
    addPayout: (input: CreatePayoutInput) => addPayoutMutation.mutateAsync(input),
    markAsPaid: (id: string) => markAsPaidMutation.mutateAsync(id),
    cancelPayout: (id: string) => cancelPayoutMutation.mutateAsync(id),
  };
};
```

- [ ] **Step 2: Create `useStaffCompensation.ts`**

```typescript
import { useMemo } from 'react';
import { useTransactions } from '../../../hooks/useTransactions';
import { StaffMember } from '../../../types';
import { calcBonus, calcCommission } from '../utils';

interface CompensationSummary {
  baseSalary: number;
  commissionEarned: number;
  bonusEarned: number;
  totalExpected: number;
  periodRevenue: number;
}

export const useStaffCompensation = (
  staff: StaffMember,
  periodStart: Date,
  periodEnd: Date,
  baseSalary: number | null
) => {
  const { transactions } = useTransactions();

  const summary: CompensationSummary = useMemo(() => {
    const base = baseSalary ?? 0;

    // Revenue from transaction items attributed to this staff in the period
    const periodRevenue = (transactions || [])
      .filter((t: any) => {
        const d = new Date(t.date);
        return d >= periodStart && d <= periodEnd;
      })
      .reduce((sum: number, t: any) => {
        return sum + (t.items || [])
          .filter((i: any) => i.staffId === staff.id)
          .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      }, 0);

    const commissionEarned = calcCommission(periodRevenue, staff.commissionRate);
    const bonusEarned = calcBonus(periodRevenue, staff.bonusTiers || []);

    return {
      baseSalary: base,
      commissionEarned,
      bonusEarned,
      totalExpected: base + commissionEarned + bonusEarned,
      periodRevenue,
    };
  }, [transactions, staff, periodStart, periodEnd, baseSalary]);

  return summary;
};
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add modules/team/hooks/useStaffPayouts.ts modules/team/hooks/useStaffCompensation.ts
git commit -m "feat: add useStaffPayouts and useStaffCompensation hooks"
```

---

### Task 12: Implement `StaffRemunerationTab` with payout form and history

**Files:**
- Modify: `modules/team/components/StaffRemunerationTab.tsx` (replace stub)
- Create: `modules/team/components/PayoutForm.tsx`
- Create: `modules/team/components/PayoutHistory.tsx`

- [ ] **Step 1: Create `PayoutForm.tsx`**

Modal/form for "Marquer comme payé". Fields: type (select), amount (pre-filled), period start/end (date inputs), notes (textarea). On submit calls `addPayout()`.

- [ ] **Step 2: Create `PayoutHistory.tsx`**

Table component showing payout records. Columns: Période, Type, Montant, Statut (badge), Notes, Actions (mark as paid / cancel). Uses status badges: "En attente" (amber), "Payé" (emerald), "Annulé" (slate strikethrough).

- [ ] **Step 3: Implement `StaffRemunerationTab.tsx`**

Composes: monthly summary card (from `useStaffCompensation`), commission rate display with inline edit, bonus tier config (reuses `BonusSystemEditor`), `PayoutHistory`, and "Marquer comme payé" button opening `PayoutForm`.

Needs to call `loadPii` once to get baseSalary for compensation calculations.

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add modules/team/components/StaffRemunerationTab.tsx modules/team/components/PayoutForm.tsx modules/team/components/PayoutHistory.tsx
git commit -m "feat: implement StaffRemunerationTab with payout tracking"
```

---

### Task 13: Implement `useStaffClients`, `useStaffAppointments`, `useStaffActivity` hooks

**Files:**
- Create: `modules/team/hooks/useStaffClients.ts`
- Create: `modules/team/hooks/useStaffAppointments.ts`
- Create: `modules/team/hooks/useStaffActivity.ts`

- [ ] **Step 1: Create `useStaffClients.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { StaffClient } from '../../../types';

export const useStaffClients = (staffId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['staff_clients', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_staff_clients', {
        p_staff_id: staffId,
        p_limit: 10,
      });
      if (error) throw error;
      return (data || []).map((row: any): StaffClient => ({
        clientId: row.client_id,
        clientFirstName: row.client_first_name,
        clientLastName: row.client_last_name,
        visitCount: row.visit_count,
        totalRevenue: parseFloat(row.total_revenue),
        lastVisit: row.last_visit,
      }));
    },
    enabled: !!salonId && !!staffId,
  });

  return { clients, isLoading };
};
```

- [ ] **Step 2: Create `useStaffAppointments.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { StaffMember } from '../../../types';
import { countWorkingDays } from '../utils';

export const useStaffAppointments = (staffId: string, schedule?: StaffMember['schedule']) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['staff_appointments', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(first_name, last_name), services(name)')
        .eq('staff_id', staffId)
        .eq('salon_id', salonId!)
        .gte('date', today.toISOString())
        .lte('date', weekEnd.toISOString())
        .is('deleted_at', null)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!salonId && !!staffId,
  });

  const todayAppointments = useMemo(
    () => appointments.filter((a: any) => {
      const d = new Date(a.date);
      return d.toDateString() === today.toDateString();
    }),
    [appointments, today]
  );

  const bookingRate = useMemo(() => {
    if (!schedule) return null;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const workDays = countWorkingDays(monthStart, now, schedule);
    if (workDays === 0) return null;
    // Rough: assume 8 bookable hours per working day, 1 hour per appointment
    const totalSlots = workDays * 8;
    const bookedCount = appointments.filter((a: any) => a.status !== 'CANCELLED').length;
    return Math.min(100, Math.round((bookedCount / totalSlots) * 100));
  }, [appointments, schedule, now]);

  return {
    upcoming: appointments,
    today: todayAppointments,
    bookingRate,
    isLoading,
  };
};
```

- [ ] **Step 3: Create `useStaffActivity.ts`**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { StaffActivityEvent } from '../../../types';

const PAGE_SIZE = 20;

export const useStaffActivity = (staffId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['staff_activity', salonId, staffId],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase.rpc('get_staff_activity', {
        p_staff_id: staffId,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data || []).map((row: any): StaffActivityEvent => ({
        eventType: row.event_type,
        eventDate: row.event_date,
        description: row.description,
        clientName: row.client_name,
        metadata: row.metadata,
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    enabled: !!salonId && !!staffId,
  });

  const events = data?.pages.flat() || [];

  return {
    events,
    isLoading,
    loadMore: fetchNextPage,
    hasMore: !!hasNextPage,
    isLoadingMore: isFetchingNextPage,
  };
};
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add modules/team/hooks/useStaffClients.ts modules/team/hooks/useStaffAppointments.ts modules/team/hooks/useStaffActivity.ts
git commit -m "feat: add useStaffClients, useStaffAppointments, useStaffActivity hooks"
```

---

### Task 14: Implement `StaffAgendaTab`

**Files:**
- Modify: `modules/team/components/StaffAgendaTab.tsx` (replace stub)

- [ ] **Step 1: Implement the agenda tab**

Uses `useStaffAppointments` hook. Sections:
- **Today's timeline**: list of today's appointments with time, client, service, duration. Color-code by status.
- **Upcoming (7 days)**: list grouped by day, showing time + client + service.
- **Schedule card**: read-only `WorkScheduleEditor` view, with inline edit toggle that saves via `onSave`.
- **Stats row**: booking rate %, appointments this week count.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add modules/team/components/StaffAgendaTab.tsx
git commit -m "feat: implement StaffAgendaTab with timeline and upcoming"
```

---

### Task 15: Implement `StaffActivityTab`

**Files:**
- Modify: `modules/team/components/StaffActivityTab.tsx` (replace stub)

- [ ] **Step 1: Implement the activity feed**

Uses `useStaffActivity` hook. Renders a chronological list of events. Each event shows:
- Icon based on `eventType`: CheckCircle (completed), XCircle (cancelled), AlertCircle (no-show), ShoppingBag (sale)
- Description, client name, timestamp (relative with `Intl.RelativeTimeFormat` or absolute date)
- "Charger plus" button at bottom when `hasMore` is true.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add modules/team/components/StaffActivityTab.tsx
git commit -m "feat: implement StaffActivityTab with paginated event feed"
```

---

## Phase 6: Invitation Flow

### Task 16: Implement `useInvitation` hook and `InvitationModal`

**Files:**
- Modify: `modules/team/hooks/useInvitation.ts` (replace stub)
- Modify: `modules/team/components/InvitationModal.tsx` (replace stub)

- [ ] **Step 1: Implement `useInvitation.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { toastOnError } from '../../../hooks/useMutationToast';

const ROLE_MAP: Record<string, string> = {
  Manager: 'manager',
  Stylist: 'stylist',
  Receptionist: 'receptionist',
  Assistant: 'receptionist',
};

export const useInvitation = (staffId: string) => {
  const { activeSalon, profile } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: invitation } = useQuery({
    queryKey: ['invitation', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('staff_member_id', staffId)
        .eq('salon_id', salonId!)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!salonId && !!staffId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      // Expire any existing pending invitations for this staff
      await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('staff_member_id', staffId)
        .eq('salon_id', salonId!)
        .is('accepted_at', null);

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          salon_id: salonId!,
          email,
          role: ROLE_MAP[role] || 'stylist',
          token,
          invited_by: profile!.id,
          expires_at: expiresAt.toISOString(),
          staff_member_id: staffId,
        })
        .select('token')
        .single();

      if (error) throw error;
      return data.token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation', salonId, staffId] });
      addToast({ type: 'success', message: 'Lien d\'invitation généré' });
    },
    onError: toastOnError('Erreur lors de la création de l\'invitation'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!invitation) return;
      await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', invitation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation', salonId, staffId] });
    },
  });

  return {
    invitation,
    createInvitation: async (email: string, role: string = 'Stylist') => {
      const token = await createMutation.mutateAsync({ email, role });
      return token;
    },
    cancelInvitation: () => cancelMutation.mutateAsync(),
  };
};
```

- [ ] **Step 2: Implement `InvitationModal.tsx`**

```typescript
import React, { useState } from 'react';
import { X, Copy, Check, Send } from 'lucide-react';

interface InvitationModalProps {
  staffEmail?: string;
  staffRole: string;
  onSubmit: (email: string) => Promise<void>;
  onClose: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  staffEmail,
  staffRole,
  onSubmit,
  onClose,
}) => {
  const [email, setEmail] = useState(staffEmail || '');
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invitationLink = token
    ? `${window.location.origin}/#/accept-invitation?token=${token}`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(email);
      // The token will be available after submission completes
      // For now, show success state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!invitationLink) return;
    await navigator.clipboard.writeText(invitationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Inviter par lien</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!invitationLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
              <input
                type="text"
                value={staffRole}
                disabled
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-600 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Génération...' : 'Générer le lien'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Partagez ce lien avec le membre pour qu'il puisse créer son compte et rejoindre le salon.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={invitationLink}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <p className="text-xs text-slate-400">Ce lien expire dans 7 jours.</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

Note: The `InvitationModal` needs the token returned from `createInvitation`. Update the `StaffDetailPage` to pass the token back:

In `StaffDetailPage.tsx`, update the `onSubmit` handler:
```typescript
onSubmit={async (email) => {
  const token = await createInvitation(email, staff.role);
  // InvitationModal will need to receive the token
  // Simplest approach: make InvitationModal manage its own submission
}}
```

Alternative: refactor `InvitationModal` to receive `createInvitation` directly and manage the flow internally.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add modules/team/hooks/useInvitation.ts modules/team/components/InvitationModal.tsx
git commit -m "feat: implement invitation flow with link generation and copy"
```

---

## Phase 7: List Page Archive Toggle

### Task 17: Add "Voir les membres archivés" toggle to `TeamListPage`

**Files:**
- Modify: `modules/team/hooks/useTeam.ts`
- Modify: `modules/team/pages/TeamListPage.tsx`
- Modify: `modules/team/components/TeamList.tsx`
- Modify: `modules/team/components/TeamCard.tsx`
- Modify: `modules/team/components/TeamTable.tsx`

- [ ] **Step 1: Update `useTeam` to support archive toggle**

Add an `includeArchived` parameter to the hook. When true, remove the `.is('deleted_at', null)` filter. Add a `deletedAt` mapping in the query result so archived members are identifiable.

- [ ] **Step 2: Add toggle to `TeamListPage`**

Add a `showArchived` state and pass it to `useTeam`. Add a toggle button next to the search bar:

```typescript
<button
  onClick={() => setShowArchived(!showArchived)}
  className={`text-sm px-3 py-1.5 rounded-lg ${showArchived ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}
>
  {showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
</button>
```

- [ ] **Step 3: Update `TeamCard` and `TeamTable` for archived visual distinction**

Archived members (where `member.deletedAt` is set) show:
- Greyed out card/row (`opacity-50`)
- "Archivé" badge in red

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add modules/team/hooks/useTeam.ts modules/team/pages/TeamListPage.tsx modules/team/components/TeamList.tsx modules/team/components/TeamCard.tsx modules/team/components/TeamTable.tsx
git commit -m "feat: add archive toggle to team list with visual distinction"
```

---

## Phase 8: Final Integration & Cleanup

### Task 18: Wire up `StaffProfileTab` client portfolio with real hook

**Files:**
- Modify: `modules/team/components/StaffProfileTab.tsx`

- [ ] **Step 1: Add `useStaffClients` to `StaffProfileTab`**

Import and call `useStaffClients(staff.id)` in the profile tab. Render the client portfolio section with a table: client name, visits, revenue, last visit date.

- [ ] **Step 2: Add recent activity preview**

Import and call `useStaffActivity(staff.id)` with a limited view (first page only). Show last 10 events in a compact list with a "Voir toute l'activité" link that switches to the Activité tab.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add modules/team/components/StaffProfileTab.tsx
git commit -m "feat: wire up client portfolio and activity preview in StaffProfileTab"
```

---

### Task 19: Final build verification and cleanup

**Files:**
- Various cleanup across all modified files

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Dev server smoke test**

Run: `npm run dev`
Manually verify:
1. `/team` shows list with archive toggle
2. `/team/new` shows creation form, saves, redirects to detail page
3. `/team/:id` shows detail page with header + 5 tabs
4. Inline editing works on Profil tab
5. Performance tab shows KPIs and chart
6. Rémunération tab shows compensation and payout form
7. Agenda tab shows upcoming appointments
8. Activité tab shows event feed with pagination
9. Invitation flow generates link
10. Archive/restore works from danger zone

- [ ] **Step 3: Clean up any unused imports**

Check all modified files for unused imports. Remove any dead code from the old `ViewState` pattern.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup unused imports and dead code from team module refactor"
```
