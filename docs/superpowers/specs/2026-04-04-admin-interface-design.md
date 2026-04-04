# Platform Admin Interface — Design Spec

## Goal

Allow the app owner to log in and access a platform-level admin dashboard showing all salon accounts, subscriptions, billing, usage, and trial pipeline — with write actions to manage accounts without touching Stripe directly for most operations.

## Architecture

Single admin user identified by `is_admin = true` on the `profiles` table. Admin routes live at `/admin/*` with a separate layout. All cross-salon data reads use Postgres RPC functions with `SECURITY DEFINER` (bypassing RLS). Write actions use the same RPC pattern for pure DB operations, and one Edge Function for Stripe cancellation. No new auth system — same login page, declarative redirect.

## Tech Stack

React 19, React Router 7, TanStack Query, Supabase (RPC + realtime), Stripe (cancel only), Tailwind CSS

---

## Section 1: Auth & Routing

### Database

New migration adds `is_admin` to profiles:

```sql
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Block users from setting is_admin on themselves
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
```

Admin status is set manually via Supabase Studio. Only the service role key can write `is_admin`.

### AdminRoute Guard

New component `components/AdminRoute.tsx`:
- Shows spinner while `isLoading = true`
- Redirects to `/login` if not authenticated
- Redirects to `/` if `profile.is_admin !== true`
- Renders children if all checks pass

### ProtectedRoute Change

Add one check to the existing `ProtectedRoute` — if an admin user tries to access a salon route, redirect them to `/admin`:

```tsx
if (profile?.is_admin && !location.pathname.startsWith('/admin')) {
  return <Navigate to="/admin" replace />;
}
```

AuthContext is **not modified** — navigation remains fully declarative.

### Route Structure (App.tsx)

```tsx
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminDashboard />} />
  <Route path="accounts" element={<AdminAccountList />} />
  <Route path="accounts/:id" element={<AdminAccountDetail />} />
  <Route path="trials" element={<AdminTrialsPipeline />} />
  <Route path="billing" element={<AdminFailedPayments />} />
  <Route path="signups" element={<AdminRecentSignups />} />
  <Route path="churn" element={<AdminChurnLog />} />
</Route>
```

Admin routes are siblings of the existing salon routes — outside the main `Layout` wrapper.

### AdminLayout

`components/AdminLayout.tsx` — separate from `Layout.tsx`, uses `<Outlet />` (follows FinancesLayout pattern):
- Simple top bar: logo + "Admin" badge + signed-in name + sign out button
- Left sidebar: Dashboard / Comptes / Essais / Facturation / Inscriptions / Résiliations
- No salon picker, no bottom tab bar, no `activeSalon` dependency

---

## Section 2: Data Layer

### Suspension Column

```sql
ALTER TABLE salons ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT false;
```

`is_suspended` must be added to:
- The salons join query in `AuthContext` fetchMemberships: `salon:salons!inner(id, name, slug, logo_url, currency, timezone, subscription_tier, is_suspended)`
- The `ActiveSalon` interface in `lib/auth.types.ts`
- `ProtectedRoute`: if `activeSalon.is_suspended` → render a `SuspendedPage` component instead of children

The existing realtime `salons` channel in `AuthContext` (subscribed to `UPDATE` on `salons`) will automatically patch `is_suspended` in memory when admin suspends an account.

### Postgres Views (read-only aggregations)

```sql
-- admin_mrr_summary: total MRR, per-plan breakdown, growth vs last month
CREATE VIEW admin_mrr_summary AS ...

-- admin_accounts_overview: all salons with plan, status, staff/client count, last active
CREATE VIEW admin_accounts_overview AS ...

-- admin_trials_pipeline: trials expiring in next 14 days
CREATE VIEW admin_trials_pipeline AS ...
```

These views use the service role context (called only from `SECURITY DEFINER` RPCs — never directly from the client).

### Read RPC Functions

All read RPCs follow this pattern:
```sql
CREATE FUNCTION get_admin_mrr()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN (SELECT row_to_json(s) FROM admin_mrr_summary s);
END;
$$;
```

| RPC | Returns |
|-----|---------|
| `get_admin_mrr()` | Total MRR, per-plan breakdown, MoM growth |
| `get_admin_accounts()` | All salons: name, plan, status, staff count, client count, last active |
| `get_admin_account_detail(p_salon_id uuid)` | Single salon: full details + invoice history |
| `get_admin_trials()` | Trials expiring ≤14 days, days remaining, salon name |
| `get_admin_failed_payments()` | All `past_due` salons with amount owed, days overdue |
| `get_admin_recent_signups()` | New salons last 30 days, plan they signed up on |
| `get_admin_churn()` | Cancelled subscriptions: salon name, plan, cancellation date |

### Frontend Hooks

`modules/admin/hooks/useAdmin.ts` — all reads via `supabase.rpc()`, no Edge Function calls for reads:

```ts
export function useAdminMRR() {
  return useQuery({ queryKey: ['admin', 'mrr'], queryFn: () => supabase.rpc('get_admin_mrr') });
}
export function useAdminAccounts() {
  return useQuery({ queryKey: ['admin', 'accounts'], queryFn: () => supabase.rpc('get_admin_accounts') });
}
export function useAdminAccount(salonId: string) {
  return useQuery({ queryKey: ['admin', 'account', salonId], queryFn: () => supabase.rpc('get_admin_account_detail', { p_salon_id: salonId }) });
}
export function useAdminTrials() {
  return useQuery({ queryKey: ['admin', 'trials'], queryFn: () => supabase.rpc('get_admin_trials') });
}
export function useAdminFailedPayments() {
  return useQuery({ queryKey: ['admin', 'failed_payments'], queryFn: () => supabase.rpc('get_admin_failed_payments') });
}
export function useAdminRecentSignups() {
  return useQuery({ queryKey: ['admin', 'recent_signups'], queryFn: () => supabase.rpc('get_admin_recent_signups') });
}
export function useAdminChurn() {
  return useQuery({ queryKey: ['admin', 'churn'], queryFn: () => supabase.rpc('get_admin_churn') });
}
```

---

## Section 3: Module Structure

```
components/
  AdminLayout.tsx              # Outlet-based layout, sidebar + topbar

modules/admin/
  hooks/
    useAdmin.ts                # All read queries + write mutations
  components/
    AdminDashboard.tsx         # MRR card + key metrics (signups, trials, failed payments count)
    AdminAccountList.tsx       # Searchable/filterable table of all salons
    AdminAccountDetail.tsx     # Single salon: details + invoice history + action buttons
    AdminTrialsPipeline.tsx    # Table of expiring trials + extend button per row
    AdminFailedPayments.tsx    # Table of past_due accounts + cancel button per row
    AdminRecentSignups.tsx     # Recent signups list
    AdminChurnLog.tsx          # Cancelled subscriptions log

pages/
  SuspendedPage.tsx            # Shown to salon users when is_suspended = true
```

---

## Section 4: Write Actions

### Write RPC Functions (pure DB, no Stripe)

All follow the same pattern: `SECURITY DEFINER`, `is_admin` check first, business logic after.

#### `admin_extend_trial(p_salon_id uuid, p_days integer)`
- Checks `is_admin`
- Updates `subscriptions.trial_ends_at = trial_ends_at + p_days * INTERVAL '1 day'`
- If trial already expired: resets `salons.subscription_tier = 'trial'` and sets `trial_ends_at = now() + p_days * INTERVAL '1 day'`

#### `admin_set_plan(p_salon_id uuid, p_tier subscription_tier)`
- Checks `is_admin`
- **Blocks if active Stripe subscription exists:**
  ```sql
  IF EXISTS (SELECT 1 FROM subscriptions WHERE salon_id = p_salon_id AND status = 'active') THEN
    RAISE EXCEPTION 'Cannot override active Stripe subscription. Use Stripe dashboard.';
  END IF;
  ```
- Updates `salons.subscription_tier = p_tier`
- Updates `subscriptions.status = 'active'` (or inserts a manual record)

#### `admin_suspend_salon(p_salon_id uuid)`
- Checks `is_admin`
- Sets `salons.is_suspended = true`
- Suspension is app-level only — Stripe subscription untouched

#### `admin_reactivate_salon(p_salon_id uuid)`
- Checks `is_admin`
- Sets `salons.is_suspended = false`

### Edge Function: `admin-cancel-subscription`

Only write action that must touch Stripe. Thin by design:

```ts
// 1. Verify JWT + is_admin via service role DB lookup
// 2. Look up stripe_subscription_id from subscriptions table
// 3. Call stripe.subscriptions.cancel(stripe_subscription_id)
// 4. Return 200 — existing stripe-webhook handles customer.subscription.deleted → DB update
// No duplicate DB logic here
```

### Audit Trail

All admin write actions are automatically captured by the existing `audit_log` trigger on the `salons` table. The `performed_by` field will be the admin's `auth.uid()`. No extra audit work needed.

---

## Section 5: Migrations Required

| Migration | Contents |
|-----------|----------|
| `YYYYMMDD000001_admin_is_admin.sql` | Add `is_admin` to profiles, revoke update permission |
| `YYYYMMDD000002_admin_is_suspended.sql` | Add `is_suspended` to salons |
| `YYYYMMDD000003_admin_views.sql` | `admin_mrr_summary`, `admin_accounts_overview`, `admin_trials_pipeline` views |
| `YYYYMMDD000004_admin_read_rpcs.sql` | All 7 read RPC functions |
| `YYYYMMDD000005_admin_write_rpcs.sql` | 4 write RPC functions |

Edge Function `admin-cancel-subscription` deployed via `supabase functions deploy`.

---

## Section 6: UI Pages Summary

### `/admin` — Dashboard
- MRR card (total + MoM growth %)
- 4 stat cards: active subscriptions, trials expiring this week, failed payments, new signups this month
- Quick-action links to other pages

### `/admin/accounts` — Account List
- Searchable table: salon name, plan badge, status (active/trial/past_due/suspended), staff count, client count, created date
- Click row → `/admin/accounts/:id`

### `/admin/accounts/:id` — Account Detail
- Salon info header
- Subscription status + current period end
- Usage: staff, clients, products
- Invoice history table
- Action buttons: Extend Trial / Set Plan / Suspend / Reactivate / Cancel Subscription
- Each action shows a confirmation modal before executing

### `/admin/trials` — Trials Pipeline
- Table sorted by expiry (soonest first): salon name, days remaining, plan, extend button (+7 / +14 / +30 days)

### `/admin/billing` — Failed Payments
- Table: salon name, amount owed, days overdue, cancel subscription button

### `/admin/signups` — Recent Signups
- Timeline list: salon name, plan, date joined

### `/admin/churn` — Churn Log
- Table: salon name, plan they were on, cancellation date

---

## Out of Scope (for this phase)

- Impersonating a salon owner's view
- Bulk actions (mass email, bulk plan changes)
- Admin activity log (who-did-what in admin)
- Multi-admin support
- Stripe invoice creation / refunds
- Custom Auth Hook JWT claims (can migrate to this later without breaking changes)
