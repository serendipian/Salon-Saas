# Lumiere Beauty SaaS - Casa de Chicas

## Project Overview

Salon management SaaS application for beauty salons. Built with React 19, TypeScript, Vite, Tailwind CSS, Recharts, and Lucide React icons. French-language UI targeting the Moroccan/French beauty salon market.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 6
- **Styling**: Tailwind CSS 4 (via @tailwindcss/vite plugin)
- **Charts**: Recharts 3
- **Icons**: Lucide React
- **Routing**: React Router DOM 7 (BrowserRouter, with Vercel catch-all rewrite)

## Architecture

### Module Structure (Active Code)
```
modules/
  {module}/
    {Module}Module.tsx    # Container component, manages view state
    hooks/use{Module}.ts  # TanStack Query hooks (useQuery + useMutation)
    components/           # Presentational components
    mappers.ts            # DB Row ↔ Frontend type translation
    schemas.ts            # Zod validation schemas (where applicable)
```

Active modules: `dashboard`, `clients`, `services`, `products`, `appointments`, `pos`, `team`, `suppliers`, `accounting`, `settings`, `billing`, `admin`

### Team Module (Enterprise)
Nested routes under `/team` with `<Outlet>` pattern:
- `/team` — TeamListPage (list + performance tabs, archive toggle)
- `/team/new` — NewStaffPage (creation form)
- `/team/:id` — StaffDetailPage (pinned header + 5 tabs: Profil, Performance, Rémunération, Agenda, Activité)

Team-specific hooks: `useStaffDetail`, `useStaffPayouts`, `useStaffCompensation`, `useStaffClients`, `useStaffAppointments`, `useStaffActivity`, `useInvitation`

Staff detail uses inline section editing (edit mode per section, not per field). PII fields (salary, IBAN, SSN) encrypted via pgcrypto RPCs.
PII write is two-step (insert/update row, then call `update_staff_pii` RPC) — handle partial failure gracefully.
`staff.color` is a Tailwind class string (e.g., `bg-rose-100 text-rose-800`), not a hex color — use as className, not inline style.
WorkSchedule day slots use `start`/`end` properties (not `open`/`close`). WorkDay type: `{ isOpen, start, end }`.

### Shared Components (Active)
```
components/
  Layout.tsx              # App shell: sidebar + topbar (avatar dropdown with profile link)
  FormElements.tsx        # Input, Select, TextArea, Section
  DatePicker.tsx          # Single date picker
  DateRangePicker.tsx     # Range picker with presets
  WorkScheduleEditor.tsx  # Weekly schedule grid
  BonusSystemEditor.tsx   # Tiered bonus configuration
  ProtectedRoute.tsx      # Auth/salon/permission route guard
  ErrorBoundary.tsx       # Module-level error boundary
  Toast.tsx               # Portal-rendered toast notifications
  ConnectionStatus.tsx    # Realtime connection indicator
  BottomTabBar.tsx        # Mobile bottom navigation
  MobileDrawer.tsx        # Slide-in overlay with focus trap
  MobileSelect.tsx        # Fullscreen select overlay for mobile
  ViewToggle.tsx          # Card/table view switch
  StaffAvatar.tsx         # Staff member avatar display
  EmptyState.tsx          # Empty list placeholder
  PhoneInput.tsx          # Country code selector + tel input (numpad hidden on mobile/tablet via lg: breakpoint)
```

### Auth Pages
```
pages/
  LoginPage.tsx           # Email+password + magic link login
  SignupPage.tsx           # Registration form
  CreateSalonPage.tsx      # Post-signup salon creation
  SalonPickerPage.tsx      # Multi-salon user selection
  AcceptInvitationPage.tsx # Token-based invitation acceptance
  ForgotPasswordPage.tsx  # Password reset request (sends magic link)
  ResetPasswordPage.tsx   # New password form (from recovery link)
  SuspendedPage.tsx       # Shown when salon is suspended
```

### Profile Page (`/profile`)
```
pages/
  ProfilePage.tsx                    # Container, conditional section rendering by role
  profile/
    ProfileIdentity.tsx              # Avatar upload + personal info (name, phone, bio)
    ProfileSalonRole.tsx             # Active salon, role badge, member since, multi-salon list
    ProfileSchedule.tsx              # Weekly schedule (linked staff members only)
    ProfilePerformance.tsx           # Monthly stats (linked stylists only)
    ProfileSecurity.tsx              # Password change
    ProfilePreferences.tsx           # Language selector (fr/ar/en) + notification toggles
    ProfileDangerZone.tsx            # Leave salon (via leave_salon RPC, hidden for sole owners)
```
- Accessible from topbar avatar dropdown (desktop) and MobileDrawer (mobile)
- No ProtectedRoute permission check — all authenticated users can access
- `hooks/useAvatarUpload.ts` — uploads to Supabase Storage `avatars` bucket
- `hooks/useLinkedStaffMember.ts` — queries `staff_members` by `membership_id` to find linked record
- `AuthContext` provides `updateProfile()` and `refreshProfile()` for profile mutations
- Profile type (`lib/auth.types.ts`): id, email, first_name, last_name, avatar_url, phone, bio, language, notification_email, notification_sms

### Staff-Profile Linking
- `staff_members.membership_id` links a staff record to a `salon_memberships` entry
- `invitations.staff_member_id` (nullable) links an invitation to an existing staff member
- `accept_invitation` RPC: if `staff_member_id` is set, links existing staff; otherwise creates new one for stylists
- `leave_salon` RPC: SECURITY DEFINER function that soft-deletes membership + linked staff atomically

### State Management
- All modules use TanStack Query + Supabase for data fetching and persistence
- No global state context — each module has co-located hooks
- Shared `useTransactions` hook at `hooks/useTransactions.ts` (consumed by POS, Dashboard, Accounting)

### Data Layer (Supabase + TanStack Query)

Migrated modules use TanStack Query for data fetching and Supabase for persistence:

```
modules/{module}/
  mappers.ts              # DB Row ↔ Frontend type translation
  hooks/use{Module}.ts    # TanStack Query hooks (useQuery + useMutation)
```

**All 10 modules migrated:** suppliers, products, services, clients, settings, team, appointments, pos/transactions, accounting/expenses, dashboard

**Query key convention:** `['resource', salonId]` — ensures auto-refetch on salon switch.

**Pattern:**
- `useQuery` for reads → calls `supabase.from('table').select()`
- `useMutation` for writes → calls insert/update + `invalidateQueries`
- Co-located mappers handle snake_case ↔ camelCase conversion
- RLS via membership-based policies (`user_salon_ids()`) scopes all reads automatically
- Writes include `salon_id` explicitly

**Standalone utilities:**
- `lib/format.ts` — `formatPrice()`, `formatDuration()` (shared formatting utilities)

### Real-Time Sync
- `hooks/useRealtimeSync.ts` — shared hook with ref-counted subscription manager
- Each module hook calls `useRealtimeSync('tableName')` to subscribe to Postgres changes
- On any INSERT/UPDATE/DELETE: invalidates TanStack Query cache for that table
- Subscription manager avoids duplicate channels when multiple components sync the same table
- Optional `onEvent` callback for per-module reactions (e.g., toast on new appointment)

### Toast Notifications
- `context/ToastContext.tsx` — split dispatch/state contexts (prevents consumer re-renders)
- `components/Toast.tsx` — portal-rendered to `#toast-root`, top-right position
- `useToast()` hook provides `addToast({ type, message, duration? })` and `removeToast(id)`
- Types: success (green), error (red), warning (amber), info (blue)
- Errors don't auto-dismiss; all others dismiss after 5s

### Connection Status
- `hooks/useConnectionStatus.ts` — monitors Supabase Realtime WebSocket state
- `components/ConnectionStatus.tsx` — dot indicator in top bar + disconnect banner
- States: connected (green), reconnecting (orange), disconnected after 30s (red + banner)
- On reconnect: invalidates active queries, shows "Connexion rétablie" toast

### Form Validation
- `hooks/useFormValidation.ts` — generic hook wrapping Zod schema validation
- Per-module schemas at `modules/{module}/schemas.ts`
- Validates on submit, clears individual field errors on change
- French error messages defined inline in Zod schemas
- FormElements accept `error` prop to display field-level errors

### Mutation Error Handling
- `hooks/useMutationToast.ts` — callback factory for mutation `onError`
- `toastOnError(fallbackMessage)` — inspects Supabase error codes, falls back to provided French message
- `toastOnSuccess(message)` — returns callback for `onSuccess` with French message
- Known codes: RLS violation, unique constraint, network error, plan limit exceeded
- All mutations use toastOnError; service/product/category/settings mutations also use toastOnSuccess

### Error Boundaries
- `components/ErrorBoundary.tsx` — React class component wrapping each module route
- On crash: shows French error card with "Réessayer" (remount) and "Tableau de bord" (escape)
- resetKey pattern forces full subtree remount → fresh queries → fresh data
- Layout (sidebar, header, connection status) survives any module crash

### Mobile Responsiveness (Plan 5A)
- `context/MediaQueryContext.tsx` — singleton provider with breakpoint flags (isMobile/isTablet/isDesktop)
- `hooks/useSidebar.ts` — drawer/collapsed/expanded mode management
- `hooks/useViewMode.ts` — card/table toggle with localStorage persistence per module
- `components/BottomTabBar.tsx` — 5-tab mobile nav (Accueil, Agenda, Caisse, Clients, Plus)
- `components/MobileDrawer.tsx` — slide-in overlay with focus trap and ARIA
- `components/MobileSelect.tsx` — fullscreen select overlay for mobile
- `components/ViewToggle.tsx` — card/table switch button pair
- Layout.tsx refactored: sidebar hidden on mobile, bottom tabs + drawer shown
- FormElements: 44px touch targets, dir="auto", fullscreen Select on mobile
- WorkScheduleEditor: horizontal scroll with snap on mobile
- BonusSystemEditor: card layout on mobile
- z-index scale defined in CSS custom properties (--z-content through --z-toast)

### Appointment Module — Mobile Architecture
- `modules/appointments/hooks/useAppointmentForm.ts` — shared hook extracting all form state/logic, consumed by both desktop and mobile shells
- `modules/appointments/components/AppointmentBuilder.tsx` — desktop rendering shell (thin wrapper over useAppointmentForm)
- `modules/appointments/components/AppointmentBuilderMobile.tsx` — mobile two-screen form: Screen 1 (client + services + staff + options), Screen 2 (scheduling/date+time)
- `modules/appointments/components/MobileBottomSheet.tsx` — portal-based bottom sheet with drag gestures, `dvh` units, body scroll lock
- `modules/appointments/components/MobileClientSearch.tsx` — client search + inline new-client creation (phone-first, names on same row)
- `modules/appointments/components/MobileServicePicker.tsx` — category pills + service/variant selection
- `AppointmentNewPage.tsx` / `AppointmentEditPage.tsx` — conditionally render mobile or desktop shell via `useMediaQuery().isMobile`
- Sticky footers use `bottom: calc(56px + env(safe-area-inset-bottom, 0px))` to sit above BottomTabBar
- Content areas use `pb-44` to prevent footer overlap

### Dead Code
All previously listed dead monolithic components (`components/AccountingModule.tsx`, etc.) and `services/store.ts` have been deleted. No known dead code remains in the active codebase.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Database

- **Backend**: Supabase (PostgreSQL 15, Auth, Realtime, Storage — `avatars` bucket for profile photos)
- **Local dev**: `npm run db:start` / `npm run db:stop` (requires Docker Desktop)
- **Migrations**: `supabase/migrations/` — 61 migration files, applied in order
- **Seed data**: `supabase/seed.sql` — subscription plans (Free, Premium, Pro)
- **Types**: Auto-generated via `npm run db:types` → `lib/database.types.ts`
- **Types (remote)**: `npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts` (no Docker/local dev)
- **Reset**: `npm run db:reset` — drops and recreates everything
- **Studio**: http://127.0.0.1:54323 (local Supabase dashboard)

### Schema Overview
- 24 tables + 3 views
- RLS enabled on every table
- Membership-based RLS via `user_salon_ids()` / `user_salon_ids_with_role()` functions
- Custom Postgres functions across migration files (identity, RPC, encryption, etc.)
- Audit logging on all business tables via triggers

### Key Patterns
- RLS SELECT policies include `deleted_at IS NULL` — to query archived records, add a separate additive policy for owner/manager
- `salon_id` on every business table for multi-tenancy
- Soft-delete via `deleted_at` column (NULL = active)
- `updated_at` auto-set by trigger on every table
- Immutable transactions (no UPDATE policy)
- Price snapshotting on transaction_items
- Computed client stats via `client_stats` view (not denormalized)
- `staff_payouts` has unique index on `(staff_id, type, period_start, period_end)` WHERE non-cancelled
- Restore from archive must set `active: true` (archive sets it to false via `revoke_membership` RPC)
- All mutations MUST include `.eq('salon_id', salonId)` even when RLS enforces it (defense in depth)

## Authentication & Authorization

- **Auth Provider**: Supabase Auth (email+password, magic link)
- **Auth Context**: `context/AuthContext.tsx` — provides user, session, profile, activeSalon, role, memberships, updateProfile, refreshProfile
- **Access Hook**: `useAuth()` — access auth state from any component
- **Permissions**: `hooks/usePermissions.ts` — static role-based permission matrix (UX only, RLS is authoritative)
- **Route Guards**: `components/ProtectedRoute.tsx` — redirects unauthorized users
- **Supabase Client**: `lib/supabase.ts` — typed singleton, uses `Database` from `lib/database.types.ts`
- **Auth Types**: `lib/auth.types.ts` — Role, Profile (with phone/bio/language/notifications), SalonMembership (with created_at), permission types

### Password Policy
- Minimum 8 characters enforced consistently across all auth pages (signup, reset, invitation, profile change)

### Auth Flow
1. Unauthenticated → `/login` or `/signup`
2. Authenticated, no salon → `/create-salon`
3. Authenticated, multiple salons → `/select-salon`
4. Authenticated + active salon → main app (Layout + modules)

### Role-Based Sidebar Visibility
- **owner/manager**: All items visible
- **stylist**: No accounting, suppliers, settings
- **receptionist**: No accounting, suppliers, settings

### RLS Model (Membership-Based)
RLS uses `user_salon_ids()` and `user_salon_ids_with_role()` functions that derive access from `salon_memberships` using `auth.uid()` from the JWT. No session variables are needed — `set_session_context` is legacy and no longer called by the application. All data isolation is enforced via membership-based RLS policies (migration `20260328120000`).

## Billing & Subscriptions

### Subscription Tiers
The `salons.subscription_tier` column uses these internal identifiers — **do not confuse with plan display names**:

| Internal tier | Display name | Price | Limits |
|---|---|---|---|
| `trial` | Premium (Essai) | Free, 14 days | 10 staff, unlimited clients |
| `free` | Free | 0€ | 2 staff, 50 clients, 20 products |
| `premium` | Premium | 59€/mo | 10 staff, unlimited clients |
| `pro` | Pro | 89€/mo | Unlimited everything |
| `past_due` | — | — | Treated like `premium`, payment failed |

`SubscriptionTier` type is in `lib/auth.types.ts`. Limits are in `PLAN_LIMITS` in `modules/billing/hooks/useBilling.ts`.

### Plan Limit Enforcement
Server-side: `check_plan_limits()` trigger fires BEFORE INSERT on `staff_members`, `clients`, `products`. Raises `PLAN_LIMIT_EXCEEDED:table.limit` with ERRCODE `P0001`. Client-side: `canAddStaff/canAddClient/canAddProduct` helpers in `useBilling` (UX-only gate).

### Billing Module
```
modules/billing/
  BillingModule.tsx              # Container: loads plans + usage, shows success screen
  hooks/useBilling.ts            # PLAN_LIMITS, createCheckoutSession, createPortalSession
  components/
    CurrentPlanCard.tsx          # Current tier display + usage bars
    PlanCards.tsx                # Plan comparison grid with upgrade/downgrade CTAs
    TrialBanner.tsx              # Top banner showing trial days remaining
    PastDueBanner.tsx            # App-wide payment failure banner (rendered in Layout.tsx)
    UpgradeModal.tsx             # Upsell modal triggered when hitting plan limits
    UpgradeSuccess.tsx           # Post-checkout success screen (reads plan from ?plan= URL param)
    StripePortalSection.tsx      # Link to Stripe Customer Portal for paid plans
```

### Edge Functions (all deployed with --no-verify-jwt)
All 4 Edge Functions perform their own auth internally. Deploy via:
`npx supabase functions deploy <name> --no-verify-jwt --use-api`

| Function | Trigger | Auth method |
|---|---|---|
| `create-checkout-session` | Frontend upgrade button | `getUser()` via user JWT |
| `create-portal-session` | Frontend "Gérer la facturation" | `getUser()` via user JWT |
| `stripe-webhook` | Stripe events | Stripe signature verification |
| `expire-trials` | pg_cron daily at 02:00 UTC | None (open, idempotent) |

### Stripe Webhook Events Handled
`checkout.session.completed` → sets subscription active, updates `salons.subscription_tier`
`customer.subscription.updated` → syncs status/tier on plan change or past_due
`invoice.paid` → inserts invoice record, resets status to active
`invoice.payment_failed` → sets status/tier to `past_due`
`customer.subscription.deleted` → sets status to cancelled, tier to `free`

### Real-Time Tier Updates
`AuthContext` subscribes to `salons` table UPDATE events (channel `salon-tier:{id}`) to update `activeSalon.subscription_tier` in memory immediately when the webhook fires — no sign-out required.

### Checkout Flow
1. User clicks upgrade → `create-checkout-session` creates Stripe Checkout session
2. User pays on Stripe → redirected to `?section=billing&success=true&plan={PlanName}`
3. `UpgradeSuccess` component reads `?plan=` to display correct plan name and features
4. Stripe sends webhook → `salons.subscription_tier` updated → realtime pushes to client

### Token Auth for Edge Functions
`useBilling.ts` uses raw `fetch` (not `supabase.functions.invoke`) with an explicit `Authorization` header. Always call `supabase.auth.getSession()` first to ensure a fresh token.
`lib/supabase.ts` has a JS mutex for the `auth.lock` option to serialize token refreshes safely in environments without Web Locks API.

## Code Conventions

- **Language**: UI text is in French. Code (variables, comments) in English.
- **Styling**: Tailwind utility classes. Design system uses slate color palette with blue-500 as accent.
- **Components**: Functional components with hooks. No class components.
- **Types**: All domain types in `types.ts`. Use proper TypeScript types, avoid `any`.
- **IDs**: Use `crypto.randomUUID()` for generating IDs (not `Date.now()`).
- **State**: Each module uses TanStack Query hooks for server state. Local UI state (view, search, selection) stays in the component.
- **Forms**: Use controlled React state. Never use `document.getElementById()`.
- **File naming**: PascalCase for components, camelCase for hooks/utilities.

## Known Issues to Fix

1. ~~No data persistence~~ DONE — all modules on Supabase
2. ~~Tailwind via CDN~~ DONE — Tailwind CSS 4 via @tailwindcss/vite plugin
3. ~~Import maps in index.html~~ DONE — removed, clean index.html
5. ~~No authentication system~~ DONE — Plan 1B
6. ~~Appointment form hardcoded staff~~ DONE — uses useTeam() hook for live data
7. ~~Dashboard KPI trends hardcoded~~ DONE — computed dynamically via calcTrend()
8. ~~No form validation~~ DONE — Plan 4, Zod schemas
9. ~~No error boundaries~~ DONE — Plan 4, module-level ErrorBoundary
10. ~~Not responsive for mobile~~ DONE — Plan 5A infrastructure + nav + forms
11. ~~No billing/subscriptions~~ DONE — Stripe checkout, webhook, portal, trial expiry cron

## Environment Variables

```
VITE_SUPABASE_URL=             # Supabase API URL (in .env.local)
VITE_SUPABASE_ANON_KEY=        # Supabase anon key (in .env.local)
VITE_SENTRY_DSN=               # Sentry DSN for prod error reporting (optional)
VITE_SENTRY_RELEASE=           # Release tag for Sentry (optional)
```
