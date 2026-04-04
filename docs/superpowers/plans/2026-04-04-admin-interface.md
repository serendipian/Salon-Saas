# Platform Admin Interface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-level admin interface at `/admin/*` that lets the app owner see all salon accounts, subscriptions, MRR, trials, and churn — with write actions to extend trials, override plans, suspend accounts, and cancel subscriptions.

**Architecture:** `is_admin` flag on profiles controls access. All cross-salon reads use `SECURITY DEFINER` Postgres RPCs (bypassing RLS). Write actions are RPCs for DB-only operations and one Edge Function for Stripe cancellation. Admin routes use a separate `AdminLayout` with `<Outlet />`, sibling to the existing salon routes.

**Tech Stack:** React 19, React Router 7, TanStack Query, Supabase RPC, Stripe (cancel only), Tailwind CSS, Lucide React

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260404120000_admin_is_admin.sql` | Add `is_admin` to profiles |
| `supabase/migrations/20260404120001_admin_is_suspended.sql` | Add `is_suspended` to salons |
| `supabase/migrations/20260404120002_admin_views.sql` | 3 read-only aggregation views |
| `supabase/migrations/20260404120003_admin_read_rpcs.sql` | 7 read RPC functions |
| `supabase/migrations/20260404120004_admin_write_rpcs.sql` | 4 write RPC functions |
| `supabase/functions/admin-cancel-subscription/index.ts` | Edge Function — Stripe cancel |
| `components/AdminRoute.tsx` | Route guard for admin pages |
| `components/AdminLayout.tsx` | Admin shell with sidebar + topbar |
| `pages/SuspendedPage.tsx` | Shown to salon users when suspended |
| `modules/admin/hooks/useAdmin.ts` | All read queries + write mutations |
| `modules/admin/components/AdminDashboard.tsx` | MRR + stat cards |
| `modules/admin/components/AdminAccountList.tsx` | All salons table |
| `modules/admin/components/AdminAccountDetail.tsx` | Single salon + action buttons |
| `modules/admin/components/AdminTrialsPipeline.tsx` | Expiring trials table |
| `modules/admin/components/AdminFailedPayments.tsx` | past_due accounts table |
| `modules/admin/components/AdminRecentSignups.tsx` | New signups list |
| `modules/admin/components/AdminChurnLog.tsx` | Cancelled subscriptions log |

## Files Modified

| File | Change |
|------|--------|
| `lib/auth.types.ts` | Add `is_admin` to `Profile`, `is_suspended` to `ActiveSalon` and `SalonMembership.salon` |
| `context/AuthContext.tsx` | Add `is_admin` to fetchProfile select, `is_suspended` to salon join, patch `is_suspended` in realtime handler |
| `components/ProtectedRoute.tsx` | Add `profile` to destructure, admin redirect, suspension check |
| `App.tsx` | Add admin route block + all admin page imports |

---

## Task 1: Migration — `is_admin` on profiles

**Files:**
- Create: `supabase/migrations/20260404120000_admin_is_admin.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260404120000_admin_is_admin.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Block authenticated users from updating is_admin on their own profile
-- Only the service role key (used by migrations and Studio) can set it
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
```

- [ ] **Step 2: Push migration to remote**

```bash
supabase db push
```

Expected: `Applying migration 20260404120000_admin_is_admin.sql...` then success.

- [ ] **Step 3: Verify in Studio**

Open Supabase Studio → Table Editor → `profiles`. Confirm `is_admin` column exists with default `false`. Then open SQL Editor and run:

```sql
-- Set yourself as admin (replace with your user's profile id)
UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
SELECT id, email, is_admin FROM profiles WHERE email = 'your@email.com';
-- Expected: is_admin = true
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404120000_admin_is_admin.sql
git commit -m "feat: add is_admin flag to profiles"
```

---

## Task 2: Migration — `is_suspended` on salons + update types and AuthContext

**Files:**
- Create: `supabase/migrations/20260404120001_admin_is_suspended.sql`
- Modify: `lib/auth.types.ts`
- Modify: `context/AuthContext.tsx`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260404120001_admin_is_suspended.sql
ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: `Applying migration 20260404120001_admin_is_suspended.sql...` then success.

- [ ] **Step 3: Update `lib/auth.types.ts`**

Add `is_admin` to `Profile` and `is_suspended` to `ActiveSalon` and `SalonMembership.salon`:

```ts
// lib/auth.types.ts
import type { Session, User } from '@supabase/supabase-js';

export type Role = 'owner' | 'manager' | 'stylist' | 'receptionist';

export type SubscriptionTier = 'trial' | 'free' | 'premium' | 'pro' | 'past_due';

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  language: string;
  notification_email: boolean;
  notification_sms: boolean;
  is_admin: boolean;
}

export interface SalonMembership {
  id: string;
  salon_id: string;
  profile_id: string;
  role: Role;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  salon: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    currency: string;
    timezone: string;
    subscription_tier: SubscriptionTier;
    is_suspended: boolean;
  };
}

export interface ActiveSalon {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  subscription_tier: SubscriptionTier;
  is_suspended: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  activeSalon: ActiveSalon | null;
  role: Role | null;
  memberships: SalonMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

export type AuthAction = 'view' | 'create' | 'edit' | 'delete' | 'manage';
export type AuthResource =
  | 'dashboard'
  | 'appointments'
  | 'clients'
  | 'pos'
  | 'services'
  | 'products'
  | 'team'
  | 'accounting'
  | 'suppliers'
  | 'settings'
  | 'billing'
  | 'invitations'
  | 'audit_log';

export type AccessLevel = 'full' | 'own' | 'linked' | 'summary' | 'none';

export interface Subscription {
  id: string;
  salon_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  billing_cycle: 'monthly' | 'yearly';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  currency: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Update `context/AuthContext.tsx` — three changes**

**Change A** — add `is_admin` to `fetchProfile` select. Find the line that selects from profiles (around line 70) and add `is_admin`:

```ts
// Find this pattern and add is_admin to the select list:
.select('id, email, first_name, last_name, avatar_url, phone, bio, language, notification_email, notification_sms, is_admin')
```

**Change B** — add `is_suspended` to the salon join query in `fetchMemberships` (line ~87):

```ts
// Change from:
salon:salons!inner(id, name, slug, logo_url, currency, timezone, subscription_tier)
// Change to:
salon:salons!inner(id, name, slug, logo_url, currency, timezone, subscription_tier, is_suspended)
```

**Change C** — update the realtime `salon-tier` channel patch handler (around line 240) to also patch `is_suspended`:

```ts
// Find the .on('postgres_changes', ...) callback and replace the handler body:
(payload) => {
  const updated = payload.new as Record<string, unknown>;
  setActiveSalon(prev => {
    if (!prev) return prev;
    const patch: Partial<ActiveSalon> = {};
    if (updated.subscription_tier !== undefined) patch.subscription_tier = updated.subscription_tier as SubscriptionTier;
    if (updated.is_suspended !== undefined) patch.is_suspended = updated.is_suspended as boolean;
    return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260404120001_admin_is_suspended.sql lib/auth.types.ts context/AuthContext.tsx
git commit -m "feat: add is_suspended to salons, update auth types and context"
```

---

## Task 3: `SuspendedPage` + `AdminRoute` + update `ProtectedRoute`

**Files:**
- Create: `pages/SuspendedPage.tsx`
- Create: `components/AdminRoute.tsx`
- Modify: `components/ProtectedRoute.tsx`

- [ ] **Step 1: Create `pages/SuspendedPage.tsx`**

```tsx
// pages/SuspendedPage.tsx
import React from 'react';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SuspendedPage: React.FC = () => {
  const { signOut } = useAuth();
  return (
    <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-rose-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Compte suspendu</h1>
        <p className="text-sm text-slate-500">
          L'accès à ce salon a été suspendu. Contactez le support pour plus d'informations.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-2 text-sm text-slate-500 underline hover:text-slate-700"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `components/AdminRoute.tsx`**

```tsx
// components/AdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!profile?.is_admin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
```

- [ ] **Step 3: Update `components/ProtectedRoute.tsx`**

Add `profile` to destructure, `useLocation` import, admin redirect, and suspension check:

```tsx
// components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { SuspendedPage } from '../pages/SuspendedPage';
import type { AuthAction, AuthResource } from '../lib/auth.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  action?: AuthAction;
  resource?: AuthResource;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, action, resource }) => {
  const { isAuthenticated, isLoading, activeSalon, memberships, role, profile } = useAuth();
  const { can } = usePermissions(role);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Admin users don't need a salon — redirect them to admin panel
  if (profile?.is_admin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  if (!activeSalon) {
    if (memberships.length > 0) return <Navigate to="/select-salon" replace />;
    return <Navigate to="/create-salon" replace />;
  }

  if (activeSalon.is_suspended) return <SuspendedPage />;

  if (action && resource && !can(action, resource)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add pages/SuspendedPage.tsx components/AdminRoute.tsx components/ProtectedRoute.tsx
git commit -m "feat: add AdminRoute guard, SuspendedPage, admin redirect in ProtectedRoute"
```

---

## Task 4: `AdminLayout` component

**Files:**
- Create: `components/AdminLayout.tsx`

- [ ] **Step 1: Create `components/AdminLayout.tsx`**

```tsx
// components/AdminLayout.tsx
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, CreditCard, UserPlus, TrendingDown, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/accounts', label: 'Comptes', icon: Users, end: false },
  { to: '/admin/trials', label: 'Essais', icon: Clock, end: false },
  { to: '/admin/billing', label: 'Facturation', icon: CreditCard, end: false },
  { to: '/admin/signups', label: 'Inscriptions', icon: UserPlus, end: false },
  { to: '/admin/churn', label: 'Résiliations', icon: TrendingDown, end: false },
];

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-700">
          <span className="text-white font-extrabold text-base tracking-tight">Lumiere</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">ADMIN</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
              {profile?.first_name?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <span className="text-xs text-slate-300 truncate flex-1">
              {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : profile?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-white transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/AdminLayout.tsx
git commit -m "feat: add AdminLayout with dark sidebar and Outlet"
```

---

## Task 5: Wire admin routes into `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add imports to `App.tsx`**

Add these imports after the existing page imports (after `ProfilePage` import line):

```tsx
import { AdminRoute } from './components/AdminRoute';
import { AdminLayout } from './components/AdminLayout';
import { AdminDashboard } from './modules/admin/components/AdminDashboard';
import { AdminAccountList } from './modules/admin/components/AdminAccountList';
import { AdminAccountDetail } from './modules/admin/components/AdminAccountDetail';
import { AdminTrialsPipeline } from './modules/admin/components/AdminTrialsPipeline';
import { AdminFailedPayments } from './modules/admin/components/AdminFailedPayments';
import { AdminRecentSignups } from './modules/admin/components/AdminRecentSignups';
import { AdminChurnLog } from './modules/admin/components/AdminChurnLog';
```

- [ ] **Step 2: Add admin route block in `App.tsx`**

Inside the `<Routes>` in the `App()` component, add the admin route block **before** the `/*` catch-all route:

```tsx
{/* Admin routes — own layout, own guard, outside salon Layout */}
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminDashboard />} />
  <Route path="accounts" element={<AdminAccountList />} />
  <Route path="accounts/:id" element={<AdminAccountDetail />} />
  <Route path="trials" element={<AdminTrialsPipeline />} />
  <Route path="billing" element={<AdminFailedPayments />} />
  <Route path="signups" element={<AdminRecentSignups />} />
  <Route path="churn" element={<AdminChurnLog />} />
</Route>

{/* Protected app routes */}
<Route path="/*" element={
  <ProtectedRoute>
    <AppContent />
  </ProtectedRoute>
} />
```

Note: The admin route must be placed **before** the `/*` catch-all, but the `/*` catch-all's `ProtectedRoute` now has the admin redirect, so visiting `/admin` as a regular user will hit `AdminRoute` first which redirects to `/`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Errors about missing admin component files — that's expected since they don't exist yet. The only errors should be "Cannot find module" for admin components.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: wire admin routes into App.tsx"
```

---

## Task 6: Migration — admin aggregation views

**Files:**
- Create: `supabase/migrations/20260404120002_admin_views.sql`

- [ ] **Step 1: Create the migration**

```sql
-- supabase/migrations/20260404120002_admin_views.sql

-- MRR summary: total recurring revenue and plan breakdown
CREATE OR REPLACE VIEW admin_mrr_summary AS
WITH active_subs AS (
  SELECT sub.salon_id, p.price_monthly, p.name AS plan_name
  FROM subscriptions sub
  JOIN plans p ON p.id = sub.plan_id
  WHERE sub.status = 'active'
)
SELECT
  COALESCE(SUM(price_monthly), 0)::numeric                                          AS total_mrr,
  COUNT(*) FILTER (WHERE LOWER(plan_name) = 'premium')                              AS premium_count,
  COUNT(*) FILTER (WHERE LOWER(plan_name) = 'pro')                                  AS pro_count,
  (SELECT COUNT(*) FROM salons WHERE subscription_tier = 'free'     AND deleted_at IS NULL) AS free_count,
  (SELECT COUNT(*) FROM salons WHERE subscription_tier = 'trial'    AND deleted_at IS NULL) AS trial_count,
  (SELECT COUNT(*) FROM salons WHERE subscription_tier = 'past_due' AND deleted_at IS NULL) AS past_due_count,
  (SELECT COUNT(*) FROM salons WHERE deleted_at IS NULL)                             AS total_salons
FROM active_subs;

-- All salons overview with usage counts
CREATE OR REPLACE VIEW admin_accounts_overview AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.subscription_tier,
  s.is_suspended,
  s.created_at,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.status = 'active') AS staff_count,
  COUNT(DISTINCT c.id)  FILTER (WHERE c.deleted_at IS NULL) AS client_count,
  sub.status            AS subscription_status,
  sub.current_period_end,
  sub.trial_ends_at,
  sub.stripe_subscription_id
FROM salons s
LEFT JOIN salon_memberships sm ON sm.salon_id = s.id
LEFT JOIN clients c            ON c.salon_id  = s.id
LEFT JOIN subscriptions sub    ON sub.salon_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.slug, s.subscription_tier, s.is_suspended, s.created_at,
         sub.status, sub.current_period_end, sub.trial_ends_at, sub.stripe_subscription_id
ORDER BY s.created_at DESC;

-- Trials expiring within 14 days (sorted soonest first)
CREATE OR REPLACE VIEW admin_trials_pipeline AS
SELECT
  s.id,
  s.name,
  sub.trial_ends_at,
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (sub.trial_ends_at - now())) / 86400))::integer AS days_remaining
FROM salons s
JOIN subscriptions sub ON sub.salon_id = s.id
WHERE s.subscription_tier = 'trial'
  AND sub.trial_ends_at IS NOT NULL
  AND sub.trial_ends_at > now()
  AND s.deleted_at IS NULL
ORDER BY sub.trial_ends_at ASC;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: migration applied successfully.

- [ ] **Step 3: Verify views in Studio SQL Editor**

```sql
-- Should return one row with numeric columns
SELECT * FROM admin_mrr_summary;

-- Should return all salons
SELECT id, name, subscription_tier, staff_count FROM admin_accounts_overview LIMIT 5;

-- Should return salons in trial (may be empty if no trial salons exist)
SELECT * FROM admin_trials_pipeline;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404120002_admin_views.sql
git commit -m "feat: add admin aggregation views (mrr, accounts, trials)"
```

---

## Task 7: Migration — admin read RPC functions

**Files:**
- Create: `supabase/migrations/20260404120003_admin_read_rpcs.sql`

- [ ] **Step 1: Create the migration**

```sql
-- supabase/migrations/20260404120003_admin_read_rpcs.sql

-- Helper: check is_admin, raise if not
CREATE OR REPLACE FUNCTION _assert_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;
END;
$$;

-- MRR summary as JSONB
CREATE OR REPLACE FUNCTION get_admin_mrr()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN (SELECT row_to_json(s)::jsonb FROM admin_mrr_summary s LIMIT 1);
END;
$$;

-- All accounts as table rows
CREATE OR REPLACE FUNCTION get_admin_accounts()
RETURNS TABLE (
  id                   uuid,
  name                 text,
  slug                 text,
  subscription_tier    text,
  is_suspended         boolean,
  created_at           timestamptz,
  staff_count          bigint,
  client_count         bigint,
  subscription_status  text,
  current_period_end   timestamptz,
  trial_ends_at        timestamptz,
  stripe_subscription_id text
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY SELECT
    a.id, a.name, a.slug, a.subscription_tier::text, a.is_suspended, a.created_at,
    a.staff_count, a.client_count, a.subscription_status::text,
    a.current_period_end, a.trial_ends_at, a.stripe_subscription_id
  FROM admin_accounts_overview a;
END;
$$;

-- Single account detail as JSONB (includes last 20 invoices)
CREATE OR REPLACE FUNCTION get_admin_account_detail(p_salon_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_account jsonb;
  v_invoices jsonb;
BEGIN
  PERFORM _assert_admin();

  SELECT row_to_json(a)::jsonb INTO v_account
  FROM admin_accounts_overview a
  WHERE a.id = p_salon_id;

  SELECT COALESCE(json_agg(i ORDER BY i.paid_at DESC), '[]'::json)::jsonb INTO v_invoices
  FROM (
    SELECT id, stripe_invoice_id, amount_cents, currency, status,
           hosted_invoice_url, invoice_pdf_url, paid_at
    FROM invoices
    WHERE salon_id = p_salon_id
    ORDER BY paid_at DESC
    LIMIT 20
  ) i;

  RETURN v_account || jsonb_build_object('invoices', v_invoices);
END;
$$;

-- Trials expiring ≤14 days
CREATE OR REPLACE FUNCTION get_admin_trials()
RETURNS TABLE (
  id             uuid,
  name           text,
  trial_ends_at  timestamptz,
  days_remaining integer
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY SELECT t.id, t.name, t.trial_ends_at, t.days_remaining
  FROM admin_trials_pipeline t;
END;
$$;

-- Failed payments (past_due salons)
CREATE OR REPLACE FUNCTION get_admin_failed_payments()
RETURNS TABLE (
  id                     uuid,
  name                   text,
  subscription_tier      text,
  current_period_end     timestamptz,
  stripe_subscription_id text,
  days_overdue           integer
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.subscription_tier::text,
    sub.current_period_end,
    sub.stripe_subscription_id,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (now() - sub.current_period_end)) / 86400))::integer AS days_overdue
  FROM salons s
  JOIN subscriptions sub ON sub.salon_id = s.id
  WHERE s.subscription_tier = 'past_due'
    AND s.deleted_at IS NULL
  ORDER BY sub.current_period_end ASC;
END;
$$;

-- Recent signups (last 30 days)
CREATE OR REPLACE FUNCTION get_admin_recent_signups()
RETURNS TABLE (
  id                uuid,
  name              text,
  subscription_tier text,
  created_at        timestamptz,
  staff_count       bigint
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.subscription_tier::text,
    s.created_at,
    COUNT(DISTINCT sm.id) FILTER (WHERE sm.status = 'active') AS staff_count
  FROM salons s
  LEFT JOIN salon_memberships sm ON sm.salon_id = s.id
  WHERE s.created_at >= now() - INTERVAL '30 days'
    AND s.deleted_at IS NULL
  GROUP BY s.id, s.name, s.subscription_tier, s.created_at
  ORDER BY s.created_at DESC;
END;
$$;

-- Churn log (cancelled subscriptions, most recent 50)
CREATE OR REPLACE FUNCTION get_admin_churn()
RETURNS TABLE (
  id           uuid,
  name         text,
  cancelled_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY
  SELECT s.id, s.name, sub.cancelled_at
  FROM salons s
  JOIN subscriptions sub ON sub.salon_id = s.id
  WHERE sub.status = 'cancelled'
    AND sub.cancelled_at IS NOT NULL
    AND s.deleted_at IS NULL
  ORDER BY sub.cancelled_at DESC
  LIMIT 50;
END;
$$;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: migration applied successfully.

- [ ] **Step 3: Verify in Studio SQL Editor**

```sql
-- Must return your account's MRR data (run as your admin user won't work from Studio
-- since Studio uses service role — test via anon key after is_admin is set)
-- Instead verify the functions exist:
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE 'get_admin_%' OR routine_name = '_assert_admin'
ORDER BY routine_name;
-- Expected: 7 rows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404120003_admin_read_rpcs.sql
git commit -m "feat: add admin read RPC functions (mrr, accounts, trials, payments, signups, churn)"
```

---

## Task 8: Migration — admin write RPC functions

**Files:**
- Create: `supabase/migrations/20260404120004_admin_write_rpcs.sql`

- [ ] **Step 1: Create the migration**

```sql
-- supabase/migrations/20260404120004_admin_write_rpcs.sql

-- Extend a salon's trial by N days
CREATE OR REPLACE FUNCTION admin_extend_trial(p_salon_id uuid, p_days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();

  -- Reset tier to trial if it expired
  UPDATE salons
  SET subscription_tier = 'trial', updated_at = now()
  WHERE id = p_salon_id AND subscription_tier != 'trial';

  -- Extend trial_ends_at from now (if expired) or from current end date
  UPDATE subscriptions
  SET
    trial_ends_at = CASE
      WHEN trial_ends_at IS NULL OR trial_ends_at < now()
        THEN now() + (p_days || ' days')::interval
      ELSE trial_ends_at + (p_days || ' days')::interval
    END,
    updated_at = now()
  WHERE salon_id = p_salon_id;
END;
$$;

-- Manually override a salon's plan tier (blocked if active Stripe subscription exists)
CREATE OR REPLACE FUNCTION admin_set_plan(p_salon_id uuid, p_tier text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();

  IF p_tier NOT IN ('trial', 'free', 'premium', 'pro', 'past_due') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  -- Block override if salon has an active Stripe subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE salon_id = p_salon_id
      AND status = 'active'
      AND stripe_subscription_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot override active Stripe subscription. Use Stripe dashboard to change plans.';
  END IF;

  UPDATE salons
  SET subscription_tier = p_tier, updated_at = now()
  WHERE id = p_salon_id;
END;
$$;

-- Suspend a salon (app-level only, Stripe untouched)
CREATE OR REPLACE FUNCTION admin_suspend_salon(p_salon_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();
  UPDATE salons SET is_suspended = true, updated_at = now() WHERE id = p_salon_id;
END;
$$;

-- Reactivate a suspended salon
CREATE OR REPLACE FUNCTION admin_reactivate_salon(p_salon_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();
  UPDATE salons SET is_suspended = false, updated_at = now() WHERE id = p_salon_id;
END;
$$;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: migration applied successfully.

- [ ] **Step 3: Verify functions exist**

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE 'admin_%'
ORDER BY routine_name;
-- Expected: admin_extend_trial, admin_reactivate_salon, admin_set_plan, admin_suspend_salon
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404120004_admin_write_rpcs.sql
git commit -m "feat: add admin write RPC functions (extend trial, set plan, suspend, reactivate)"
```

---

## Task 9: Edge Function — `admin-cancel-subscription`

**Files:**
- Create: `supabase/functions/admin-cancel-subscription/index.ts`

- [ ] **Step 1: Create the Edge Function**

```ts
// supabase/functions/admin-cancel-subscription/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  // Service role client — for privileged DB reads
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // User client — to verify JWT identity
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // Verify is_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return new Response('Forbidden', { status: 403 });

  const body = await req.json().catch(() => null);
  const { salon_id } = body ?? {};
  if (!salon_id) {
    return new Response(JSON.stringify({ error: 'salon_id required' }), { status: 400 });
  }

  // Find active Stripe subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('salon_id', salon_id)
    .eq('status', 'active')
    .single();

  if (!subscription?.stripe_subscription_id) {
    return new Response(
      JSON.stringify({ error: 'No active Stripe subscription found for this salon' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Cancel in Stripe — webhook handles DB update via customer.subscription.deleted
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy the Edge Function**

```bash
supabase functions deploy admin-cancel-subscription --no-verify-jwt --use-api
```

Expected: `Deployed admin-cancel-subscription` with a function URL.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-cancel-subscription/index.ts
git commit -m "feat: add admin-cancel-subscription Edge Function"
```

---

## Task 10: `useAdmin.ts` — all read hooks and write mutations

**Files:**
- Create: `modules/admin/hooks/useAdmin.ts`

- [ ] **Step 1: Create the hooks file**

```ts
// modules/admin/hooks/useAdmin.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminMRR {
  total_mrr: number;
  premium_count: number;
  pro_count: number;
  free_count: number;
  trial_count: number;
  past_due_count: number;
  total_salons: number;
}

export interface AdminAccount {
  id: string;
  name: string;
  slug: string | null;
  subscription_tier: string;
  is_suspended: boolean;
  created_at: string;
  staff_count: number;
  client_count: number;
  subscription_status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
}

export interface AdminAccountDetail extends AdminAccount {
  invoices: Array<{
    id: string;
    stripe_invoice_id: string;
    amount_cents: number;
    currency: string;
    status: string;
    hosted_invoice_url: string | null;
    invoice_pdf_url: string | null;
    paid_at: string;
  }>;
}

export interface AdminTrial {
  id: string;
  name: string;
  trial_ends_at: string;
  days_remaining: number;
}

export interface AdminFailedPayment {
  id: string;
  name: string;
  subscription_tier: string;
  current_period_end: string;
  stripe_subscription_id: string | null;
  days_overdue: number;
}

export interface AdminSignup {
  id: string;
  name: string;
  subscription_tier: string;
  created_at: string;
  staff_count: number;
}

export interface AdminChurn {
  id: string;
  name: string;
  cancelled_at: string;
}

// ─── Read hooks ──────────────────────────────────────────────────────────────

export function useAdminMRR() {
  return useQuery<AdminMRR>({
    queryKey: ['admin', 'mrr'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_mrr');
      if (error) throw error;
      return data as AdminMRR;
    },
  });
}

export function useAdminAccounts() {
  return useQuery<AdminAccount[]>({
    queryKey: ['admin', 'accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_accounts');
      if (error) throw error;
      return (data ?? []) as AdminAccount[];
    },
  });
}

export function useAdminAccount(salonId: string) {
  return useQuery<AdminAccountDetail>({
    queryKey: ['admin', 'account', salonId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_account_detail', { p_salon_id: salonId });
      if (error) throw error;
      return data as AdminAccountDetail;
    },
    enabled: !!salonId,
  });
}

export function useAdminTrials() {
  return useQuery<AdminTrial[]>({
    queryKey: ['admin', 'trials'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_trials');
      if (error) throw error;
      return (data ?? []) as AdminTrial[];
    },
  });
}

export function useAdminFailedPayments() {
  return useQuery<AdminFailedPayment[]>({
    queryKey: ['admin', 'failed_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_failed_payments');
      if (error) throw error;
      return (data ?? []) as AdminFailedPayment[];
    },
  });
}

export function useAdminRecentSignups() {
  return useQuery<AdminSignup[]>({
    queryKey: ['admin', 'recent_signups'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_recent_signups');
      if (error) throw error;
      return (data ?? []) as AdminSignup[];
    },
  });
}

export function useAdminChurn() {
  return useQuery<AdminChurn[]>({
    queryKey: ['admin', 'churn'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_churn');
      if (error) throw error;
      return (data ?? []) as AdminChurn[];
    },
  });
}

// ─── Write mutations ──────────────────────────────────────────────────────────

export function useAdminExtendTrial(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.rpc('admin_extend_trial', { p_salon_id: salonId, p_days: days });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Essai prolongé avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'trials'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la prolongation.' }),
  });
}

export function useAdminSetPlan(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async (tier: string) => {
      const { error } = await supabase.rpc('admin_set_plan', { p_salon_id: salonId, p_tier: tier });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Plan mis à jour avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors du changement de plan.' }),
  });
}

export function useAdminSuspend(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_suspend_salon', { p_salon_id: salonId });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Compte suspendu.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la suspension.' }),
  });
}

export function useAdminReactivate(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_reactivate_salon', { p_salon_id: salonId });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Compte réactivé.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la réactivation.' }),
  });
}

export function useAdminCancelSubscription(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      if (!token) throw new Error('Session expirée.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ salon_id: salonId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Abonnement annulé. Le salon passera en Free à la fin de la période.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed_payments'] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || "Erreur lors de l'annulation." }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Errors only about missing UI component files — not about this hook file.

- [ ] **Step 3: Commit**

```bash
git add modules/admin/hooks/useAdmin.ts
git commit -m "feat: add useAdmin hooks (reads + write mutations)"
```

---

## Task 11: `AdminDashboard` component

**Files:**
- Create: `modules/admin/components/AdminDashboard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// modules/admin/components/AdminDashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { useAdminMRR, useAdminTrials, useAdminFailedPayments, useAdminRecentSignups } from '../hooks/useAdmin';

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  iconClass: string;
  to?: string;
}> = ({ label, value, icon: Icon, iconClass, to }) => {
  const content = (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-900">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block">{content}</Link>;
  return content;
};

export const AdminDashboard: React.FC = () => {
  const { data: mrr, isLoading: loadingMRR } = useAdminMRR();
  const { data: trials } = useAdminTrials();
  const { data: failedPayments } = useAdminFailedPayments();
  const { data: signups } = useAdminRecentSignups();

  const activeSubs = (mrr?.premium_count ?? 0) + (mrr?.pro_count ?? 0);
  const expiringThisWeek = (trials ?? []).filter(t => t.days_remaining <= 7).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard Admin</h1>
        <p className="text-sm text-slate-500 mt-1">Vue d'ensemble de la plateforme</p>
      </div>

      {/* MRR Hero */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">MRR Total</div>
        {loadingMRR ? (
          <div className="h-10 bg-slate-700 rounded animate-pulse w-40" />
        ) : (
          <div className="text-4xl font-extrabold">
            {(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </div>
        )}
        <div className="flex gap-6 mt-4 text-sm text-slate-400">
          <span><span className="text-white font-semibold">{mrr?.premium_count ?? '–'}</span> Premium</span>
          <span><span className="text-white font-semibold">{mrr?.pro_count ?? '–'}</span> Pro</span>
          <span><span className="text-white font-semibold">{mrr?.trial_count ?? '–'}</span> Essai</span>
          <span><span className="text-white font-semibold">{mrr?.free_count ?? '–'}</span> Free</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Abonnements actifs"
          value={activeSubs}
          icon={TrendingUp}
          iconClass="bg-brand-100 text-brand-600"
          to="/admin/accounts"
        />
        <StatCard
          label="Essais actifs"
          value={mrr?.trial_count ?? '–'}
          icon={Clock}
          iconClass="bg-blue-100 text-blue-600"
          to="/admin/trials"
        />
        <StatCard
          label={`Essais expirant cette semaine`}
          value={expiringThisWeek}
          icon={Clock}
          iconClass="bg-amber-100 text-amber-600"
          to="/admin/trials"
        />
        <StatCard
          label="Paiements échoués"
          value={failedPayments?.length ?? '–'}
          icon={AlertCircle}
          iconClass="bg-rose-100 text-rose-600"
          to="/admin/billing"
        />
        <StatCard
          label="Nouvelles inscriptions (30j)"
          value={signups?.length ?? '–'}
          icon={UserPlus}
          iconClass="bg-emerald-100 text-emerald-600"
          to="/admin/signups"
        />
        <StatCard
          label="Total salons"
          value={mrr?.total_salons ?? '–'}
          icon={Users}
          iconClass="bg-slate-100 text-slate-600"
          to="/admin/accounts"
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Fewer "Cannot find module" errors as components are created. Fix any errors specific to this file.

- [ ] **Step 3: Commit**

```bash
git add modules/admin/components/AdminDashboard.tsx
git commit -m "feat: add AdminDashboard with MRR hero and stat cards"
```

---

## Task 12: `AdminAccountList` component

**Files:**
- Create: `modules/admin/components/AdminAccountList.tsx`

- [ ] **Step 1: Create the component**

```tsx
// modules/admin/components/AdminAccountList.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useAdminAccounts, type AdminAccount } from '../hooks/useAdmin';

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  trial:    { label: 'ESSAI',    className: 'bg-blue-100 text-blue-700' },
  free:     { label: 'FREE',     className: 'bg-slate-100 text-slate-600' },
  premium:  { label: 'PREMIUM',  className: 'bg-brand-100 text-brand-700' },
  pro:      { label: 'PRO',      className: 'bg-purple-100 text-purple-700' },
  past_due: { label: 'IMPAYÉ',   className: 'bg-rose-100 text-rose-700' },
};

export const AdminAccountList: React.FC = () => {
  const { data: accounts = [], isLoading } = useAdminAccounts();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Comptes</h1>
          <p className="text-sm text-slate-500 mt-1">{accounts.length} salon(s) au total</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un salon..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white w-64"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Aucun salon trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Membres</th>
                <th className="text-right px-4 py-3">Clients</th>
                <th className="text-left px-4 py-3">Inscrit le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((account: AdminAccount) => {
                const badge = TIER_BADGE[account.subscription_tier] ?? TIER_BADGE.free;
                return (
                  <tr
                    key={account.id}
                    onClick={() => navigate(`/admin/accounts/${account.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{account.name}</div>
                      {account.is_suspended && (
                        <span className="text-[10px] font-bold text-rose-600">SUSPENDU</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{account.staff_count}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{account.client_count}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(account.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add modules/admin/components/AdminAccountList.tsx
git commit -m "feat: add AdminAccountList with search and plan badges"
```

---

## Task 13: `AdminTrialsPipeline` component

**Files:**
- Create: `modules/admin/components/AdminTrialsPipeline.tsx`

- [ ] **Step 1: Create the component**

```tsx
// modules/admin/components/AdminTrialsPipeline.tsx
import React from 'react';
import { Clock } from 'lucide-react';
import { useAdminTrials, useAdminExtendTrial, type AdminTrial } from '../hooks/useAdmin';

const DaysChip: React.FC<{ days: number }> = ({ days }) => {
  const cls = days <= 3
    ? 'bg-rose-100 text-rose-700'
    : days <= 7
    ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>
      {days === 0 ? 'Expire aujourd\'hui' : `${days}j restants`}
    </span>
  );
};

const TrialRow: React.FC<{ trial: AdminTrial }> = ({ trial }) => {
  const extend = useAdminExtendTrial(trial.id);
  return (
    <tr className="border-b border-slate-50">
      <td className="px-6 py-3 font-semibold text-slate-900">{trial.name}</td>
      <td className="px-4 py-3">
        <DaysChip days={trial.days_remaining} />
      </td>
      <td className="px-4 py-3 text-slate-500 text-sm">
        {new Date(trial.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => extend.mutate(days)}
              disabled={extend.isPending}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              +{days}j
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
};

export const AdminTrialsPipeline: React.FC = () => {
  const { data: trials = [], isLoading } = useAdminTrials();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Essais en cours</h1>
        <p className="text-sm text-slate-500 mt-1">
          {trials.length} essai(s) expirant dans les 14 prochains jours
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : trials.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucun essai n'expire dans les 14 prochains jours</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Délai</th>
                <th className="text-left px-4 py-3">Expire le</th>
                <th className="text-left px-4 py-3">Prolonger</th>
              </tr>
            </thead>
            <tbody>
              {trials.map(trial => <TrialRow key={trial.id} trial={trial} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add modules/admin/components/AdminTrialsPipeline.tsx
git commit -m "feat: add AdminTrialsPipeline with extend buttons"
```

---

## Task 14: `AdminFailedPayments` component

**Files:**
- Create: `modules/admin/components/AdminFailedPayments.tsx`

- [ ] **Step 1: Create the component**

```tsx
// modules/admin/components/AdminFailedPayments.tsx
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useAdminFailedPayments, useAdminCancelSubscription, type AdminFailedPayment } from '../hooks/useAdmin';

const FailedPaymentRow: React.FC<{ payment: AdminFailedPayment }> = ({ payment }) => {
  const cancel = useAdminCancelSubscription(payment.id);

  const handleCancel = () => {
    if (!window.confirm(`Annuler l'abonnement Stripe de "${payment.name}" ? Le salon passera en Free à la fin de la période en cours.`)) return;
    cancel.mutate();
  };

  return (
    <tr className="border-b border-slate-50">
      <td className="px-6 py-3 font-semibold text-slate-900">{payment.name}</td>
      <td className="px-4 py-3">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
          {payment.days_overdue}j de retard
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500 text-sm">
        {payment.current_period_end
          ? new Date(payment.current_period_end).toLocaleDateString('fr-FR')
          : '–'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleCancel}
          disabled={cancel.isPending || !payment.stripe_subscription_id}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
        >
          {cancel.isPending ? '...' : 'Annuler abonnement'}
        </button>
      </td>
    </tr>
  );
};

export const AdminFailedPayments: React.FC = () => {
  const { data: payments = [], isLoading } = useAdminFailedPayments();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Paiements échoués</h1>
        <p className="text-sm text-slate-500 mt-1">{payments.length} compte(s) en retard de paiement</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucun paiement échoué</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Retard</th>
                <th className="text-left px-4 py-3">Fin de période</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => <FailedPaymentRow key={p.id} payment={p} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add modules/admin/components/AdminFailedPayments.tsx
git commit -m "feat: add AdminFailedPayments with cancel subscription action"
```

---

## Task 15: `AdminRecentSignups` and `AdminChurnLog` components

**Files:**
- Create: `modules/admin/components/AdminRecentSignups.tsx`
- Create: `modules/admin/components/AdminChurnLog.tsx`

- [ ] **Step 1: Create `AdminRecentSignups.tsx`**

```tsx
// modules/admin/components/AdminRecentSignups.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAdminRecentSignups } from '../hooks/useAdmin';

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  trial:    { label: 'ESSAI',   className: 'bg-blue-100 text-blue-700' },
  free:     { label: 'FREE',    className: 'bg-slate-100 text-slate-600' },
  premium:  { label: 'PREMIUM', className: 'bg-brand-100 text-brand-700' },
  pro:      { label: 'PRO',     className: 'bg-purple-100 text-purple-700' },
  past_due: { label: 'IMPAYÉ',  className: 'bg-rose-100 text-rose-700' },
};

export const AdminRecentSignups: React.FC = () => {
  const { data: signups = [], isLoading } = useAdminRecentSignups();
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Nouvelles inscriptions</h1>
        <p className="text-sm text-slate-500 mt-1">{signups.length} salon(s) inscrit(s) ces 30 derniers jours</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : signups.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune inscription ces 30 derniers jours</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Membres</th>
                <th className="text-left px-4 py-3">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {signups.map(s => {
                const badge = TIER_BADGE[s.subscription_tier] ?? TIER_BADGE.free;
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/accounts/${s.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{s.staff_count}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `AdminChurnLog.tsx`**

```tsx
// modules/admin/components/AdminChurnLog.tsx
import React from 'react';
import { TrendingDown } from 'lucide-react';
import { useAdminChurn } from '../hooks/useAdmin';

export const AdminChurnLog: React.FC = () => {
  const { data: churn = [], isLoading } = useAdminChurn();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Résiliations</h1>
        <p className="text-sm text-slate-500 mt-1">{churn.length} résiliation(s)</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : churn.length === 0 ? (
          <div className="p-8 text-center">
            <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune résiliation enregistrée</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Résilié le</th>
              </tr>
            </thead>
            <tbody>
              {churn.map(c => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.cancelled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add modules/admin/components/AdminRecentSignups.tsx modules/admin/components/AdminChurnLog.tsx
git commit -m "feat: add AdminRecentSignups and AdminChurnLog components"
```

---

## Task 16: `AdminAccountDetail` component

**Files:**
- Create: `modules/admin/components/AdminAccountDetail.tsx`

- [ ] **Step 1: Create the component**

```tsx
// modules/admin/components/AdminAccountDetail.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  useAdminAccount,
  useAdminExtendTrial,
  useAdminSetPlan,
  useAdminSuspend,
  useAdminReactivate,
  useAdminCancelSubscription,
} from '../hooks/useAdmin';

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  trial:    { label: 'ESSAI',   className: 'bg-blue-100 text-blue-700' },
  free:     { label: 'FREE',    className: 'bg-slate-100 text-slate-600' },
  premium:  { label: 'PREMIUM', className: 'bg-brand-100 text-brand-700' },
  pro:      { label: 'PRO',     className: 'bg-purple-100 text-purple-700' },
  past_due: { label: 'IMPAYÉ',  className: 'bg-rose-100 text-rose-700' },
};

export const AdminAccountDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading } = useAdminAccount(id!);

  const extendTrial    = useAdminExtendTrial(id!);
  const setPlan        = useAdminSetPlan(id!);
  const suspend        = useAdminSuspend(id!);
  const reactivate     = useAdminReactivate(id!);
  const cancelSub      = useAdminCancelSubscription(id!);

  const [planInput, setPlanInput] = useState('');
  const [showSetPlan, setShowSetPlan] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-400">Chargement...</div>;
  }

  if (!account) {
    return <div className="p-8 text-sm text-slate-400">Compte introuvable.</div>;
  }

  const badge = TIER_BADGE[account.subscription_tier] ?? TIER_BADGE.free;

  const handleSuspend = () => {
    if (!window.confirm(`Suspendre l'accès à "${account.name}" ? Les utilisateurs ne pourront plus se connecter.`)) return;
    suspend.mutate();
  };

  const handleReactivate = () => {
    reactivate.mutate();
  };

  const handleCancel = () => {
    if (!window.confirm(`Annuler l'abonnement Stripe de "${account.name}" ? Le salon passera en Free à la fin de la période en cours.`)) return;
    cancelSub.mutate();
  };

  const handleSetPlan = () => {
    if (!planInput) return;
    if (!window.confirm(`Changer le plan de "${account.name}" vers "${planInput}" ?`)) return;
    setPlan.mutate(planInput, { onSuccess: () => { setShowSetPlan(false); setPlanInput(''); } });
  };

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/accounts')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux comptes
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900">{account.name}</h1>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
            {account.is_suspended && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-200 text-rose-800">
                SUSPENDU
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inscrit le {new Date(account.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Membres', value: account.staff_count },
          { label: 'Clients', value: account.client_count },
          { label: 'Statut abonnement', value: account.subscription_status ?? 'Aucun' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-2xl font-extrabold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Subscription info */}
      {(account.current_period_end || account.trial_ends_at) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 text-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Abonnement</div>
          {account.current_period_end && (
            <p className="text-slate-600">
              Fin de période : <span className="font-semibold text-slate-900">
                {new Date(account.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
          {account.trial_ends_at && (
            <p className="text-slate-600 mt-1">
              Fin d'essai : <span className="font-semibold text-slate-900">
                {new Date(account.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actions admin</div>
        <div className="flex flex-wrap gap-3">

          {/* Extend trial */}
          <div className="flex gap-1">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => {
                  if (window.confirm(`Prolonger l'essai de ${days} jours ?`)) extendTrial.mutate(days);
                }}
                disabled={extendTrial.isPending}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Essai +{days}j
              </button>
            ))}
          </div>

          {/* Set plan */}
          <button
            onClick={() => setShowSetPlan(v => !v)}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Changer plan
          </button>

          {/* Suspend / Reactivate */}
          {account.is_suspended ? (
            <button
              onClick={handleReactivate}
              disabled={reactivate.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              {reactivate.isPending ? '...' : 'Réactiver'}
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={suspend.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              {suspend.isPending ? '...' : 'Suspendre'}
            </button>
          )}

          {/* Cancel subscription */}
          {account.stripe_subscription_id && (
            <button
              onClick={handleCancel}
              disabled={cancelSub.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
            >
              {cancelSub.isPending ? '...' : 'Annuler abonnement Stripe'}
            </button>
          )}
        </div>

        {/* Set plan inline form */}
        {showSetPlan && (
          <div className="mt-4 flex gap-2 items-center">
            <select
              value={planInput}
              onChange={e => setPlanInput(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Choisir un plan</option>
              <option value="free">Free</option>
              <option value="trial">Trial</option>
              <option value="premium">Premium</option>
              <option value="pro">Pro</option>
            </select>
            <button
              onClick={handleSetPlan}
              disabled={!planInput || setPlan.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {setPlan.isPending ? '...' : 'Confirmer'}
            </button>
            <button
              onClick={() => { setShowSetPlan(false); setPlanInput(''); }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Invoice history */}
      {account.invoices && account.invoices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Factures</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {account.invoices.map(inv => (
                <tr key={inv.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {(inv.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: inv.currency.toUpperCase() })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify full build**

```bash
npm run build
```

Expected: Clean build with no TypeScript errors. All admin component imports in App.tsx should now resolve.

- [ ] **Step 3: Commit**

```bash
git add modules/admin/components/AdminAccountDetail.tsx
git commit -m "feat: add AdminAccountDetail with all write actions"
```

---

## Task 17: End-to-end smoke test

No automated test framework exists in this project. Verify manually.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: Dev server starts on http://localhost:3000.

- [ ] **Step 2: Test admin redirect**

Log in with your admin account (the one where you set `is_admin = true` in Studio). Expected: after login, browser redirects to `/admin` automatically.

- [ ] **Step 3: Test non-admin redirect**

Log in with a regular salon account. Navigate to `/admin`. Expected: redirected to `/` (ProtectedRoute admin redirect).

- [ ] **Step 4: Test dashboard loads**

At `/admin`, confirm: MRR card renders (may show 0 if no active subs), stat cards render, no console errors.

- [ ] **Step 5: Test accounts list**

Navigate to `/admin/accounts`. Confirm: all salons appear, search works, clicking a row navigates to `/admin/accounts/:id`.

- [ ] **Step 6: Test account detail**

Open any account. Confirm: stats show, action buttons render. Test extend trial: click "+7j" → confirm dialog → toast success.

- [ ] **Step 7: Test suspension**

On any account, click "Suspendre" → confirm → verify `is_suspended = true` in Studio. Log in as that salon → verify `SuspendedPage` renders. Back in admin, click "Réactiver" → verify access restored.

- [ ] **Step 8: Test trials pipeline**

Navigate to `/admin/trials`. Confirm: only trial salons expiring ≤14 days shown. Extend one — confirm toast success and list refreshes.

- [ ] **Step 9: Final production build**

```bash
npm run build
```

Expected: Clean build, no TypeScript errors, no warnings about missing modules.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: complete platform admin interface (smoke tested)"
```
