# Lumiere Beauty SaaS - Casa de Chicas

## Project Overview

Salon management SaaS application for beauty salons. Built with React 19, TypeScript, Vite, Tailwind CSS, Recharts, and Lucide React icons. French-language UI targeting the Moroccan/French beauty salon market.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 6
- **Styling**: Tailwind CSS (needs migration from CDN to proper install)
- **Charts**: Recharts 3
- **Icons**: Lucide React
- **Routing**: React Router DOM 7 (HashRouter)
- **AI**: Google Gemini API (via @google/genai) for service description generation

## Architecture

### Module Structure (Active Code)
```
modules/
  {module}/
    {Module}Module.tsx    # Container component, manages view state
    hooks/use{Module}.ts  # TanStack Query hooks (useQuery + useMutation)
    components/           # Presentational components
    data.ts               # Mock/initial data (where applicable)
```

Active modules: `dashboard`, `clients`, `services`, `products`, `appointments`, `pos`, `team`, `suppliers`, `accounting`, `settings`

### Shared Components (Active)
```
components/
  Layout.tsx              # App shell: sidebar + topbar
  FormElements.tsx        # Input, Select, TextArea, Section
  DatePicker.tsx          # Single date picker
  DateRangePicker.tsx     # Range picker with presets
  WorkScheduleEditor.tsx  # Weekly schedule grid
  BonusSystemEditor.tsx   # Tiered bonus configuration
  ProtectedRoute.tsx      # Auth/salon/permission route guard
```

### Auth Pages
```
pages/
  LoginPage.tsx           # Email+password + magic link login
  SignupPage.tsx           # Registration form
  CreateSalonPage.tsx      # Post-signup salon creation
  SalonPickerPage.tsx      # Multi-salon user selection
  AcceptInvitationPage.tsx # Token-based invitation acceptance
```

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
- RLS via `set_session_context()` scopes all reads automatically
- Writes include `salon_id` explicitly

**Standalone utilities:**
- `lib/format.ts` — `formatPrice()` (extracted from AppContext)

### Dead Code (DO NOT USE)
These files in `components/` are old monolithic versions replaced by `modules/`:
- `components/AccountingModule.tsx`
- `components/AppointmentsModule.tsx`
- `components/ClientsModule.tsx`
- `components/Dashboard.tsx`
- `components/POSModule.tsx`
- `components/ProductsModule.tsx`
- `components/ServicesModule.tsx`
- `components/SettingsModule.tsx`
- `components/SuppliersModule.tsx`
- `services/store.ts` (legacy singleton store, broken import)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Database

- **Backend**: Supabase (PostgreSQL 15, Auth, Realtime, Storage)
- **Local dev**: `npm run db:start` / `npm run db:stop` (requires Docker Desktop)
- **Migrations**: `supabase/migrations/` — 13 migration files, applied in order
- **Seed data**: `supabase/seed.sql` — subscription plans (Free, Pro, Enterprise)
- **Types**: Auto-generated via `npm run db:types` → `lib/database.types.ts`
- **Reset**: `npm run db:reset` — drops and recreates everything
- **Studio**: http://127.0.0.1:54323 (local Supabase dashboard)

### Schema Overview
- 20 tables + 3 views
- RLS enabled on every table
- Session-variable-based RLS via `set_session_context()` RPC
- 17 custom Postgres functions (see `supabase/migrations/` files 00011-00013)
- Audit logging on all business tables via triggers

### Key Patterns
- `salon_id` on every business table for multi-tenancy
- Soft-delete via `deleted_at` column (NULL = active)
- `updated_at` auto-set by trigger on every table
- Immutable transactions (no UPDATE policy)
- Price snapshotting on transaction_items
- Computed client stats via `client_stats` view (not denormalized)

## Authentication & Authorization

- **Auth Provider**: Supabase Auth (email+password, magic link)
- **Auth Context**: `context/AuthContext.tsx` — provides user, session, profile, activeSalon, role, memberships
- **Access Hook**: `useAuth()` — access auth state from any component
- **Permissions**: `hooks/usePermissions.ts` — static role-based permission matrix (UX only, RLS is authoritative)
- **Route Guards**: `components/ProtectedRoute.tsx` — redirects unauthorized users
- **Supabase Client**: `lib/supabase.ts` — typed singleton, uses `Database` from `lib/database.types.ts`
- **Auth Types**: `lib/auth.types.ts` — Role, Profile, SalonMembership, permission types

### Auth Flow
1. Unauthenticated → `/login` or `/signup`
2. Authenticated, no salon → `/create-salon`
3. Authenticated, multiple salons → `/select-salon`
4. Authenticated + active salon → main app (Layout + modules)

### Role-Based Sidebar Visibility
- **owner/manager**: All items visible
- **stylist**: No accounting, suppliers, settings
- **receptionist**: No accounting, suppliers, settings

### Session Context
Every Supabase query requires salon context set first:
```typescript
await supabase.rpc('set_session_context', { p_salon_id: salonId, p_user_role: role });
```
AuthContext calls this automatically on salon selection. The `get_active_salon()` and `get_user_role()` Postgres functions read these session variables for RLS.

## Code Conventions

- **Language**: UI text is in French. Code (variables, comments) in English.
- **Styling**: Tailwind utility classes. Design system uses slate color palette with brand-500 (#ec4899) as accent.
- **Components**: Functional components with hooks. No class components.
- **Types**: All domain types in `types.ts`. Use proper TypeScript types, avoid `any`.
- **IDs**: Use `crypto.randomUUID()` for generating IDs (not `Date.now()`).
- **State**: Each module uses TanStack Query hooks for server state. Local UI state (view, search, selection) stays in the component.
- **Forms**: Use controlled React state. Never use `document.getElementById()`.
- **File naming**: PascalCase for components, camelCase for hooks/utilities.

## Known Issues to Fix

1. ~~No data persistence~~ DONE — all modules on Supabase
2. Tailwind via CDN (needs proper PostCSS setup)
3. Import maps in index.html point to aistudiocdn.com (not needed with Vite)
4. Gemini API key exposed client-side
5. ~~No authentication system~~ (DONE — Plan 1B)
6. Appointment form uses hardcoded staff names instead of team data
7. Dashboard KPI trends are hardcoded percentages
8. No form validation
9. No error boundaries
10. Not responsive for mobile

## Environment Variables

```
GEMINI_API_KEY=                # Google Gemini API key (in .env.local)
VITE_SUPABASE_URL=             # Supabase API URL (in .env.local)
VITE_SUPABASE_ANON_KEY=        # Supabase anon key (in .env.local)
```
