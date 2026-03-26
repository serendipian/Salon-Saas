# Lumiere Beauty SaaS — Supabase Persistence & Multi-Tenancy Design

> **Status:** Draft
> **Date:** 2026-03-26
> **Scope:** Full persistence layer, authentication, authorization, real-time sync, and production hardening for a multi-tenant beauty salon SaaS.

---

## Table of Contents

1. [Overview & Key Decisions](#1-overview--key-decisions)
2. [Database Schema & Multi-Tenancy](#2-database-schema--multi-tenancy)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Frontend Migration Strategy](#4-frontend-migration-strategy)
5. [Real-Time Architecture & Edge Functions](#5-real-time-architecture--edge-functions)
6. [Error Handling, Notifications & Production Hardening](#6-error-handling-notifications--production-hardening)
7. [Deferred Features (Prioritized)](#7-deferred-features-prioritized)
- [Appendix A: Full Table Schema Reference](#appendix-a-full-table-schema-reference)
- [Appendix B: RLS Policy Reference](#appendix-b-rls-policy-reference)
- [Appendix C: Function Inventory](#appendix-c-function-inventory)

---

## 1. Overview & Key Decisions

### What We're Building

The current Lumiere Beauty app is a frontend-only React prototype. All data lives in React `useState` hooks initialized from hardcoded mock files. There is zero persistence — refreshing the browser resets everything. There is no authentication, no authorization, no multi-user support.

This design transforms it into a production multi-tenant SaaS where:
- Multiple salons operate on a single Supabase instance, fully isolated
- Each salon has an owner who invites staff members with role-based access
- All data persists in PostgreSQL with real-time sync across connected clients
- The architecture is ready for Stripe billing, client self-service portal, and mobile in future versions

### Decisions Made During Design

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Multi-tenancy model | Row-Level Security with `salon_id` | Industry standard for SaaS. Single database, strong isolation via RLS policies. Simpler than schema-per-tenant, cheaper to operate. |
| Role model | Fixed predefined roles (owner, manager, stylist, receptionist) | Simpler and faster to ship than custom permission builder. Covers all salon use cases. |
| Client self-service portal | Deferred to V2 | Focus on staff-facing app first. Schema supports future client login. |
| Invitation flow | Email-based invitations | Standard SaaS pattern. Supabase has built-in email auth. SMS/WhatsApp deferred. |
| Authentication methods | Email+password, magic link (passwordless), Google, Facebook | Maximum flexibility. Staff use email/password, social login ready for future client portal. |
| Billing | Stripe-ready schema, manual for V1 | Database has `subscription_tier`, `plans` table, feature limits. Owner manually assigned a plan in the DB until Stripe is integrated. Stripe integration is V2 P0. |
| Real-time | Real-time everywhere via cache invalidation | Supabase Realtime notifies of changes, TanStack Query re-fetches. Per-table listeners on a shared connection. |
| Offline/resilience | Online-only | Operations fail with error messages when network is down. Optimistic UI via TanStack Query for perceived performance (rollback on server failure), but no offline queue. |
| Data migration | Seed script for new salons | Default structural data (service categories, expense categories, schedule template) seeded on salon creation. No fake clients or transactions. |

### New Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client (auth, database, storage, realtime) |
| `@tanstack/react-query` | Client-side caching, deduplication, background refetch, optimistic updates |
| `zod` | Schema validation for forms (client-side validation layer) |

---

## 2. Database Schema & Multi-Tenancy

### 2.1 Multi-Tenancy Model

Every business data table includes a `salon_id UUID NOT NULL REFERENCES salons(id)` column. Supabase RLS policies enforce that authenticated users can only access rows belonging to their active salon.

The active salon is set per-request via a Postgres variable:

```sql
-- Called by the Supabase client on every request via an RPC
SELECT set_config('app.active_salon_id', :salon_id, true);
```

RLS policies read this variable:

```sql
CREATE FUNCTION get_active_salon() RETURNS uuid AS $$
  SELECT current_setting('app.active_salon_id', true)::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

The active user's role is also set per-request to avoid repeated subqueries in RLS:

```sql
SELECT set_config('app.user_role', :role, true);

CREATE FUNCTION get_user_role() RETURNS text AS $$
  SELECT current_setting('app.user_role', true);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Request wrapper:** The Supabase client is wrapped with a helper that calls both `set_config` RPCs before every query:

```typescript
// lib/supabase.ts
async function withSalonContext<T>(salonId: string, role: string, fn: () => Promise<T>): Promise<T> {
  await supabase.rpc('set_session_context', { salon_id: salonId, user_role: role });
  return fn();
}
```

This is integrated into TanStack Query's `queryFn` wrapper so every query automatically sets the context.

### 2.2 Common Column Patterns

Every business data table includes these columns for audit and soft-delete:

```
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
salon_id      UUID NOT NULL REFERENCES salons(id)
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
created_by    UUID REFERENCES profiles(id)
updated_by    UUID REFERENCES profiles(id)
deleted_at    TIMESTAMPTZ  -- NULL = active, non-NULL = soft-deleted
```

An `updated_at` trigger fires on every UPDATE:

```sql
CREATE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Identity & Access Tables

#### `profiles`
Global user identity, independent of any salon. Created automatically by a trigger on `auth.users` insert.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | = `auth.users.id` |
| email | TEXT NOT NULL UNIQUE | |
| first_name | TEXT | |
| last_name | TEXT | |
| avatar_url | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `salons`
One row per salon tenant. Contains business settings (merged from current `SalonSettings`).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| slug | TEXT UNIQUE | URL-safe identifier |
| address | TEXT | |
| phone | TEXT | |
| email | TEXT | |
| website | TEXT | |
| logo_url | TEXT | |
| currency | TEXT NOT NULL DEFAULT 'EUR' | ISO 4217 |
| vat_rate | NUMERIC(5,2) DEFAULT 20 | |
| timezone | TEXT NOT NULL DEFAULT 'Europe/Paris' | IANA timezone |
| schedule | JSONB | Weekly opening hours (WorkSchedule structure) |
| plan_id | UUID REFERENCES plans(id) | |
| subscription_tier | TEXT CHECK (... IN ('trial','free','pro','enterprise')) DEFAULT 'trial' | |
| trial_ends_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | |

#### `plans`
Subscription plan definitions. Stripe-ready but manually managed for V1.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | e.g. 'Free', 'Pro', 'Enterprise' |
| max_staff | INTEGER | NULL = unlimited |
| max_clients | INTEGER | NULL = unlimited |
| max_products | INTEGER | NULL = unlimited |
| features | JSONB | Feature flags e.g. `{"analytics": true, "api_access": false}` |
| price_monthly | NUMERIC(10,2) | |
| price_yearly | NUMERIC(10,2) | |
| stripe_price_id_monthly | TEXT | For future Stripe integration |
| stripe_price_id_yearly | TEXT | For future Stripe integration |
| active | BOOLEAN DEFAULT true | |

#### `salon_memberships`
Join table linking users to salons with roles. One user can belong to multiple salons.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID NOT NULL REFERENCES salons(id) | |
| profile_id | UUID NOT NULL REFERENCES profiles(id) | |
| role | TEXT NOT NULL CHECK (... IN ('owner','manager','stylist','receptionist')) | App permission role |
| invited_by | UUID REFERENCES profiles(id) | |
| invited_at | TIMESTAMPTZ | |
| accepted_at | TIMESTAMPTZ | |
| status | TEXT CHECK (... IN ('pending','active','suspended')) DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | |
| UNIQUE(salon_id, profile_id) | | One membership per salon per user |

#### `invitations`
Pending invitations to join a salon.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID NOT NULL REFERENCES salons(id) | |
| email | TEXT NOT NULL | |
| role | TEXT NOT NULL CHECK (... IN ('manager','stylist','receptionist')) | Cannot invite as owner |
| token | TEXT NOT NULL UNIQUE | URL-safe random token |
| invited_by | UUID NOT NULL REFERENCES profiles(id) | |
| expires_at | TIMESTAMPTZ NOT NULL | Default: 7 days from creation |
| accepted_at | TIMESTAMPTZ | NULL until accepted |
| email_sent_at | TIMESTAMPTZ | NULL until email successfully sent |
| created_at | TIMESTAMPTZ | |
| UNIQUE(salon_id, email) | | Prevent duplicate invitations |

### 2.4 Business Data Tables

#### `clients`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| first_name | TEXT NOT NULL | |
| last_name | TEXT NOT NULL | |
| email | TEXT | |
| phone | TEXT | |
| gender | TEXT CHECK (... IN ('Homme','Femme')) | |
| age_group | TEXT | |
| city | TEXT | |
| profession | TEXT | |
| company | TEXT | |
| notes | TEXT | |
| allergies | TEXT | Sensitive — medical |
| status | TEXT CHECK (... IN ('ACTIF','VIP','INACTIF')) DEFAULT 'ACTIF' | |
| preferred_staff_id | UUID REFERENCES staff_members(id) | |
| photo_url | TEXT | |
| instagram | TEXT | |
| whatsapp | TEXT | |
| social_network | TEXT | |
| social_username | TEXT | |
| preferred_channel | TEXT | |
| other_channel_detail | TEXT | |
| preferred_language | TEXT | |
| contact_date | DATE | |
| contact_method | TEXT | |
| message_channel | TEXT | |
| acquisition_source | TEXT | |
| acquisition_detail | TEXT | |
| permissions_social_media | BOOLEAN DEFAULT false | RGPD consent |
| permissions_marketing | BOOLEAN DEFAULT false | RGPD consent |
| permissions_other | BOOLEAN DEFAULT false | RGPD consent |
| permissions_other_detail | TEXT | |
| created_at, updated_at, created_by, updated_by, deleted_at | | Standard columns |

**No `totalVisits`, `totalSpent`, `lastVisitDate` columns.** These are computed via the `client_stats` database view (see Appendix C).

#### `service_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| color | TEXT | Tailwind class or hex |
| sort_order | INTEGER DEFAULT 0 | |
| created_at, updated_at, deleted_at | | |

#### `services`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| category_id | UUID REFERENCES service_categories(id) | |
| description | TEXT | |
| active | BOOLEAN DEFAULT true | |
| created_at, updated_at, created_by, updated_by, deleted_at | | |

#### `service_variants`
Normalized from the current nested `variants[]` array on Service.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| service_id | UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE | |
| salon_id | UUID FK | Denormalized for RLS efficiency |
| name | TEXT NOT NULL | e.g. "Cheveux Courts", "Cheveux Longs" |
| duration_minutes | INTEGER NOT NULL | |
| price | NUMERIC(10,2) NOT NULL | |
| cost | NUMERIC(10,2) DEFAULT 0 | Internal cost for profit calculation |
| sort_order | INTEGER DEFAULT 0 | |
| created_at, updated_at, deleted_at | | |

#### `product_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| color | TEXT | |
| sort_order | INTEGER DEFAULT 0 | |
| created_at, updated_at, deleted_at | | |

#### `products`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| category_id | UUID REFERENCES product_categories(id) | |
| price | NUMERIC(10,2) NOT NULL | |
| cost | NUMERIC(10,2) DEFAULT 0 | |
| sku | TEXT | |
| barcode | TEXT | |
| stock | INTEGER NOT NULL DEFAULT 0 | |
| supplier_id | UUID REFERENCES suppliers(id) | Proper FK instead of text |
| active | BOOLEAN DEFAULT true | |
| created_at, updated_at, created_by, updated_by, deleted_at | | |

#### `suppliers`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| contact_name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| website | TEXT | |
| address | TEXT | |
| category | TEXT | e.g. 'Produits', 'Materiel', 'Charges' |
| payment_terms | TEXT | |
| active | BOOLEAN DEFAULT true | |
| notes | TEXT | |
| created_at, updated_at, created_by, updated_by, deleted_at | | |

#### `staff_members`
HR/payroll data. Linked to `salon_memberships` when the staff member has an app account.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| membership_id | UUID REFERENCES salon_memberships(id) | NULL if staff doesn't use the app |
| first_name | TEXT NOT NULL | |
| last_name | TEXT NOT NULL | |
| role | TEXT | HR role label (Manager, Stylist, etc.) — display only, not for permissions |
| email | TEXT | |
| phone | TEXT | |
| color | TEXT | Calendar color |
| photo_url | TEXT | |
| bio | TEXT | |
| skills | UUID[] | Array of service_category IDs |
| active | BOOLEAN DEFAULT true | |
| start_date | DATE | |
| end_date | DATE | |
| contract_type | TEXT CHECK (... IN ('CDI','CDD','Freelance','Apprentissage','Stage')) | |
| weekly_hours | NUMERIC(4,1) | |
| commission_rate | NUMERIC(5,2) DEFAULT 0 | Percentage 0-100 |
| base_salary | NUMERIC(10,2) | Encrypted via Supabase Vault |
| bonus_tiers | JSONB | `[{"target": 5000, "bonus": 200}, ...]` |
| iban | TEXT | Encrypted via Supabase Vault |
| social_security_number | TEXT | Encrypted via Supabase Vault |
| birth_date | DATE | |
| address | TEXT | |
| emergency_contact_name | TEXT | |
| emergency_contact_relation | TEXT | |
| emergency_contact_phone | TEXT | |
| schedule | JSONB | WorkSchedule structure |
| created_at, updated_at, created_by, updated_by, deleted_at | | |

**Sensitive fields** (`base_salary`, `iban`, `social_security_number`) are encrypted at rest using Supabase Vault / `pgcrypto`. RLS restricts these columns to `owner` role only.

#### `appointments`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| client_id | UUID REFERENCES clients(id) | |
| service_id | UUID REFERENCES services(id) | |
| service_variant_id | UUID REFERENCES service_variants(id) | |
| staff_id | UUID REFERENCES staff_members(id) | |
| date | TIMESTAMPTZ NOT NULL | |
| duration_minutes | INTEGER NOT NULL | |
| status | TEXT CHECK (... IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')) DEFAULT 'SCHEDULED' | |
| price | NUMERIC(10,2) NOT NULL | Snapshotted at booking time |
| notes | TEXT | |
| created_at, updated_at, created_by, updated_by, deleted_at | | |

**No denormalized name columns** (`clientName`, `staffName`, `serviceName`). These are resolved via joins or a database view `appointment_details` (see Appendix C).

**Double-booking prevention:** Postgres exclusion constraint using `tstzrange`.
**Prerequisite:** `CREATE EXTENSION IF NOT EXISTS btree_gist;` (required for GiST index on UUID + range combination).

```sql
ALTER TABLE appointments
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(date, date + (duration_minutes || ' minutes')::interval) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED'));
```

#### `transactions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| client_id | UUID REFERENCES clients(id) | |
| date | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| total | NUMERIC(10,2) NOT NULL | |
| notes | TEXT | |
| created_at, created_by | | Transactions are immutable — no updated_at |

#### `transaction_items`
Normalized from the current nested `CartItem[]`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| transaction_id | UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE | |
| salon_id | UUID FK | Denormalized for RLS |
| reference_id | UUID | Product or service variant ID at time of sale |
| type | TEXT CHECK (... IN ('SERVICE','PRODUCT')) | |
| name | TEXT NOT NULL | **Snapshotted** — the name at time of sale |
| variant_name | TEXT | |
| price | NUMERIC(10,2) NOT NULL | **Snapshotted** — the selling price at time of sale |
| original_price | NUMERIC(10,2) | Price before discount |
| quantity | INTEGER NOT NULL DEFAULT 1 | |
| cost | NUMERIC(10,2) | **Snapshotted** cost for profit calculation |
| note | TEXT | Discount reason |

#### `transaction_payments`
Normalized from the current nested `PaymentEntry[]`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| transaction_id | UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE | |
| salon_id | UUID FK | Denormalized for RLS |
| method | TEXT NOT NULL | 'Especes', 'Carte Bancaire', etc. |
| amount | NUMERIC(10,2) NOT NULL | |

#### `expense_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| color | TEXT | |
| sort_order | INTEGER DEFAULT 0 | |
| created_at, updated_at, deleted_at | | |

#### `expenses`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| date | DATE NOT NULL | |
| description | TEXT NOT NULL | |
| category_id | UUID REFERENCES expense_categories(id) | |
| amount | NUMERIC(10,2) NOT NULL | |
| supplier_id | UUID REFERENCES suppliers(id) | Proper FK |
| proof_url | TEXT | Supabase Storage path |
| created_at, updated_at, created_by, updated_by, deleted_at | | |

#### `recurring_expenses`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID FK | |
| name | TEXT NOT NULL | |
| amount | NUMERIC(10,2) NOT NULL | |
| frequency | TEXT CHECK (... IN ('Mensuel','Annuel','Hebdomadaire')) | |
| next_date | DATE NOT NULL | |
| category_id | UUID REFERENCES expense_categories(id) | |
| active | BOOLEAN DEFAULT true | |
| created_at, updated_at, deleted_at | | |

#### `audit_log`
Populated automatically by Postgres triggers on all business tables.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| salon_id | UUID | |
| table_name | TEXT NOT NULL | |
| record_id | UUID NOT NULL | |
| action | TEXT CHECK (... IN ('INSERT','UPDATE','DELETE')) | |
| old_data | JSONB | Previous row state (for UPDATE/DELETE) |
| new_data | JSONB | New row state (for INSERT/UPDATE) |
| performed_by | UUID REFERENCES profiles(id) | |
| performed_at | TIMESTAMPTZ DEFAULT now() | |

### 2.5 Key Indexes

```sql
-- Every table: salon_id filter is on every query
CREATE INDEX idx_{table}_salon ON {table}(salon_id) WHERE deleted_at IS NULL;

-- High-traffic date-based queries
CREATE INDEX idx_transactions_salon_date ON transactions(salon_id, date DESC);
CREATE INDEX idx_appointments_salon_date ON appointments(salon_id, date);
CREATE INDEX idx_expenses_salon_date ON expenses(salon_id, date);

-- Appointment double-booking (GiST for exclusion constraint)
CREATE INDEX idx_appointments_staff_date ON appointments USING gist(staff_id, tstzrange(date, date + (duration_minutes || ' minutes')::interval));

-- Lookup patterns
CREATE INDEX idx_clients_salon_name ON clients(salon_id, last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_profile ON salon_memberships(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_salon ON salon_memberships(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_token ON invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_transaction_items_txn ON transaction_items(transaction_id);
```

---

## 3. Authentication & Authorization

### 3.1 Signup Flow (New Salon Owner)

1. User signs up via Supabase Auth (email+password, magic link, or Google/Facebook)
2. Postgres trigger on `auth.users` insert creates a `profiles` row automatically
3. User hits a "Create Salon" form — enters salon name, timezone, currency
4. Calls Postgres function `create_salon()` which in a single transaction:
   - Creates the `salons` row (default plan = trial, `trial_ends_at` = now + 14 days)
   - Creates a `salon_memberships` row with `role = 'owner'`
   - Seeds default data: service categories, expense categories, schedule template
5. User lands in the dashboard

**Seed data created by `create_salon()`:**
- 5 expense categories: Loyer, Salaires, Stock, Marketing, Divers (matching current app defaults)
- Default schedule: Mon-Fri 9:00-19:00, Sat 10:00-18:00, Sun closed
- No service categories or products — salon owner creates these (every salon is different)

**Global seed data (in migration, not per-salon):**
- `plans` table: Free (max 2 staff, 50 clients), Pro (max 10 staff, unlimited clients), Enterprise (unlimited)
- Default plan assignment: new salons start on `trial` tier with 14-day expiry, then fall to Free

### 3.2 Invitation Flow (Adding Staff)

1. Owner/Manager navigates to Team > Invite, enters email + role
2. Calls Edge Function `send-invitation`:
   - Validates the inviter has permission (owner or manager)
   - Checks for existing membership (unique constraint)
   - Creates `invitations` row with unique token, 7-day expiry
   - Sends email via Resend/SMTP with link: `app.com/invite/{token}`
   - Sets `email_sent_at` on success. If email fails, deletes invitation row and returns error.
3. Recipient clicks link:
   - If they have an account: prompted to sign in, then auto-accepted into the salon
   - If new: signup form, profile created, then auto-accepted
4. Calls Postgres function `accept_invitation(token)`:
   - Validates token exists and is not expired
   - Creates `salon_memberships` row
   - If role is stylist: also creates a linked `staff_members` row with defaults
   - Marks invitation as accepted
5. Rate limit: max 10 invitations per salon per hour

### 3.3 Session & Salon Switching

- After login, the app fetches all `salon_memberships` for the user
- Single salon: auto-select. Multiple salons: salon picker screen
- Active `salon_id` + `role` stored in React `AuthContext`
- Every Supabase request sets the active salon via RPC:
  ```sql
  SELECT set_config('app.active_salon_id', :salon_id, true);
  ```
- RLS policies read via `get_active_salon()` helper function
- `onAuthStateChange` listener handles token refresh, sign-out, and session expiry

### 3.4 Identity Linking

Supabase Auth configured with identity linking enabled. If a user signs up with email+password and later tries Google login with the same email, the accounts are merged — not duplicated. Prevents orphaned profiles and duplicate memberships.

### 3.5 Role-Based Access Matrix

| Feature | Owner | Manager | Stylist | Receptionist |
|---------|-------|---------|---------|--------------|
| Dashboard (full KPIs) | Yes | Yes | Own stats only | Today's summary |
| Appointments | Full CRUD | Full CRUD | Own schedule only | Full CRUD |
| Clients | Full CRUD | Full CRUD | Linked via appointments | Full CRUD |
| POS / Transactions | Full | Full | Full | Full |
| Services & Products | Full CRUD | Full CRUD | View only | View only |
| Team management | Full CRUD | Full CRUD | View own profile | View own profile |
| Accounting / Expenses | Full | Full | Hidden | Hidden |
| Suppliers | Full CRUD | Full CRUD | Hidden | Hidden |
| Salon Settings | Full | Limited (no billing) | Hidden | Hidden |
| Billing / Subscription | Full | Hidden | Hidden | Hidden |
| Invite members | Yes | Yes | No | No |
| View audit log | Yes | Yes | No | No |

**Stylist client access rule:** Stylists can view clients who have at least one appointment (past or future) with that stylist. Enforced via RLS join on appointments table.

**Stylist POS access:** Stylists can create transactions (ring up sales) but can only view their own transactions. They cannot view the full transaction history or revenue totals for the salon. Transaction SELECT policy filters by `created_by` for stylists.

### 3.6 Permission Enforcement — Two Layers

1. **RLS policies (server-side, authoritative):** Every table has role-aware policies. A stylist physically cannot `SELECT * FROM expenses` — the query returns zero rows. See Appendix B for full policy definitions.

2. **`usePermissions()` hook (client-side, UX convenience):** Static permission map based on role from AuthContext. Controls sidebar visibility, button rendering, route guards. This is for UX only — if bypassed, RLS still blocks the operation.

```typescript
const { can } = usePermissions();
can('view', 'accounting')   // true for owner/manager
can('manage', 'team')       // true for owner/manager
can('view', 'clients')      // true for all except stylist (who gets filtered view)
```

### 3.7 Owner Protection

- **Constraint:** A salon must always have at least one active owner. Enforced by a Postgres trigger that prevents deletion/role-change of the last owner.
- **Ownership transfer:** `transfer_ownership(new_owner_id)` Postgres function atomically promotes target to owner and demotes current owner to manager.
- **Membership revocation:** `revoke_membership(membership_id)` soft-deletes the membership. Real-time subscription detects this and forces sign-out from that salon.

### 3.8 Session Expiry Handling

- Supabase JWT tokens expire after 1 hour (default)
- Supabase client auto-refreshes in the background via refresh token
- If refresh fails (user revoked, token expired): `onAuthStateChange` fires `SIGNED_OUT` event
- App redirects to login with message: "Votre session a expire, veuillez vous reconnecter"
- Real-time subscription on `salon_memberships` detects role changes and updates AuthContext immediately

---

## 4. Frontend Migration Strategy

### 4.1 Core Principle

Keep existing module components untouched as long as possible. We swap the data layer underneath them, not the components themselves. Modules migrate one at a time — the app is functional throughout the migration.

### 4.2 Architecture Layers

```
Layer 0: Local dev setup (Supabase CLI)
Layer 1: Supabase client (lib/supabase.ts)
Layer 2: TanStack Query (QueryClientProvider)
Layer 3: Auth context (AuthContext.tsx)
Layer 4: Permission hook (usePermissions)
Layer 5: Data hooks (per-module, replacing AppContext)
Layer 6: Data transform layer (DB types <-> frontend types)
Layer 7: Loading/error states in every module
```

### 4.3 Layer Details

#### Layer 0 — Local Development Setup

- `supabase init` — creates `supabase/` directory with config
- `supabase start` — local Postgres + Auth + Storage + Realtime
- Migration files in `supabase/migrations/` — version-controlled
- Seed script in `supabase/seed.sql` — structural defaults for new salons
- `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` pointing to local instance

#### Layer 1 — Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

`lib/database.types.ts` — auto-generated via `supabase gen types typescript`.

#### Layer 2 — TanStack Query

Wraps the app in `QueryClientProvider`. Provides:
- **Caching:** navigating away and back doesn't re-fetch if data is fresh
- **Deduplication:** multiple components requesting the same data = one query
- **Background refetch:** stale data is shown immediately, fresh data replaces it
- **Optimistic updates:** mutations update cache immediately, rollback on error
- **Loading/error states:** consistent `isLoading`, `error` across all hooks

#### Layer 3 — Auth Context

New `context/AuthContext.tsx` provides:

```typescript
interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  activeSalon: Salon | null;
  role: Role | null;
  memberships: SalonMembership[];
  isLoading: boolean;
  signIn: (email, password) => Promise;
  signUp: (email, password, name) => Promise;
  signInWithProvider: (provider: 'google' | 'facebook') => Promise;
  signInWithMagicLink: (email) => Promise;
  signOut: () => Promise;
  switchSalon: (salonId) => Promise;
}
```

Auth-gated routing:
- Unauthenticated → login/signup pages
- Authenticated, no salon → "Create Salon" or pending invitations
- Authenticated, has salon → main app

#### Layer 4 — Permission Hook

```typescript
// hooks/usePermissions.ts
const PERMISSION_MAP = {
  owner:        { dashboard: 'full', appointments: 'full', clients: 'full', ... },
  manager:      { dashboard: 'full', appointments: 'full', clients: 'full', ... },
  stylist:      { dashboard: 'own',  appointments: 'own',  clients: 'linked', ... },
  receptionist: { dashboard: 'summary', appointments: 'full', clients: 'full', ... },
};

function usePermissions() {
  const { role } = useAuth();
  const can = (action: string, resource: string) => boolean;
  const accessLevel = (resource: string) => 'full' | 'own' | 'linked' | 'summary' | 'none';
  return { role, can, accessLevel };
}
```

#### Layer 5 — Data Hooks (The Big Swap)

Each module's existing hook is rewritten internally. The external API stays as close as possible to the current shape, with the addition of `isLoading` and `error`.

**Before (current):**
```typescript
// modules/clients/hooks/useClients.ts
const { clients, addClient, updateClient, deleteClient } = useAppContext();
```

**After (new internals):**
```typescript
// modules/clients/hooks/useClients.ts
function useClients() {
  const { activeSalon } = useAuth();
  const queryClient = useQueryClient();

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients', activeSalon.id],
    queryFn: () => supabase.from('clients')
      .select('*')
      .eq('salon_id', activeSalon.id)
      .is('deleted_at', null)
      .then(transform)
  });

  const addClient = useMutation({
    mutationFn: (client) => supabase.from('clients').insert(toDbClient(client, activeSalon.id)),
    onSuccess: () => queryClient.invalidateQueries(['clients', activeSalon.id])
  });

  // ... updateClient, deleteClient (soft-delete)

  return { clients, addClient, updateClient, deleteClient, isLoading, error };
}
```

**Generic base hook** for simple CRUD tables:

```typescript
function useSupabaseTable<TDb, TFrontend>(
  tableName: string,
  options: {
    select?: string;
    transform: (rows: TDb[]) => TFrontend[];
    toDb: (item: TFrontend) => Partial<TDb>;
  }
)
```

Covers ~60% of tables (suppliers, categories, products, expenses). Complex tables (transactions, appointments) use custom hooks with Postgres function calls.

#### Layer 6 — Data Transform Layer

Explicit mapper functions per entity:

```typescript
// lib/transforms/clients.ts
export function dbClientToClient(row: DbClient): Client { ... }  // snake_case -> camelCase, joins
export function clientToDbClient(client: Client, salonId: string): DbClientInsert { ... }
```

Handles:
- `snake_case` (database) <-> `camelCase` (frontend)
- Normalized relations (separate tables) <-> nested objects (frontend types)
- `deleted_at` filtering (DB) <-> not present in frontend types
- Computed fields (from views) <-> flat properties

#### Layer 7 — Loading & Error States

Every module gets:
- **Skeleton screen** during initial load (not a spinner — maintains layout)
- **Per-module error boundary** — if one module crashes, others still work
- **Inline retry** for failed queries
- **Severity-based mutation feedback** (see Section 6)

### 4.4 Migration Order

Modules migrate one at a time. During migration, migrated modules read from Supabase while unmigrated modules still use AppContext. Both coexist.

| Phase | Module | Depends On | Notes |
|-------|--------|------------|-------|
| 0 | Local dev + Supabase CLI | — | Migrations, seed script, env setup |
| 1 | Auth + Salon + TanStack Query | Phase 0 | Foundation. Login, signup, salon creation |
| 2 | Permissions + Layout gating | Phase 1 | Sidebar visibility, route guards |
| 3 | Settings | Phase 1 | Salon config, reads from `salons` table |
| 4 | Service Categories + Services + Variants | Phase 1 | No dependencies on other business data |
| 5 | Product Categories + Products | Phase 1 | Standalone |
| 6 | Suppliers | Phase 1 | Standalone |
| 7 | Team / Staff Members | Phase 1, 2 | Links to memberships + profiles |
| 8 | Clients | Phase 7 | Needs staff for `preferred_staff_id`, stats via view |
| 9 | Appointments | Phase 4, 7, 8 | Depends on clients, services, staff. Uses `book_appointment()` |
| 10 | POS + Transactions | Phase 4, 5, 8 | Most complex. Uses `create_transaction()` Postgres function |
| 11 | Expenses + Accounting | Phase 6 | Depends on suppliers for FK |
| 12 | Dashboard | All above | Aggregates via `get_dashboard_stats()` |
| 13 | Cleanup | All above | Delete AppContext, delete mock data files, delete dead code |

### 4.5 What Happens to Existing Code

| File | Fate |
|------|------|
| `context/AppContext.tsx` | Shrinks as modules migrate off it. Deleted in Phase 13. |
| `modules/*/data.ts` (mock data) | Replaced by seed script. Deleted in Phase 13. |
| `types.ts` | Becomes the **frontend view types**. Database types are auto-generated separately. |
| `modules/*/hooks/use*.ts` | Rewritten internally. External API evolves minimally (adds `isLoading`, `error`). |
| `modules/*/components/*.tsx` | Minimal changes — add loading/error state handling. |
| `components/Layout.tsx` | Updated to respect `usePermissions()` for sidebar items. |
| Dead code in `components/` | Deleted (already flagged in CLAUDE.md). |

---

## 5. Real-Time Architecture & Edge Functions

### 5.1 Real-Time Strategy: Cache Invalidation

Real-time changes are delivered as lightweight notifications that invalidate TanStack Query caches. Components re-fetch only if they're mounted and viewing affected data.

**One Supabase channel per salon**, with per-table listeners attached/detached on module mount:

```typescript
// hooks/useRealtimeSync.ts
function useRealtimeSync(tableName: string) {
  const { activeSalon } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`salon:${activeSalon.id}:${tableName}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: `salon_id=eq.${activeSalon.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: [tableName, activeSalon.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSalon.id, tableName]);
}
```

Each module hook calls `useRealtimeSync('clients')`, `useRealtimeSync('appointments')`, etc. When the module unmounts, the listener is cleaned up.

**No direct cache merging** — all tables use invalidation-only for consistency. The ~100ms re-fetch latency is imperceptible.

### 5.2 Membership Change Detection

A separate always-on channel watches the current user's memberships:

```typescript
// In AuthContext
supabase
  .channel(`user:${user.id}:memberships`)
  .on('postgres_changes', {
    table: 'salon_memberships',
    filter: `profile_id=eq.${user.id}`
  }, (payload) => {
    if (payload.new.deleted_at) {
      // Membership revoked — force sign-out from this salon
      handleMembershipRevoked(payload.new.salon_id);
    } else if (payload.new.role !== currentRole) {
      // Role changed — update AuthContext, re-evaluate permissions
      handleRoleChanged(payload.new.role);
    }
  })
  .subscribe();
```

### 5.3 Connection Status

A connection health indicator in the app header:
- Green dot: connected
- Orange dot + "Reconnexion...": reconnecting (auto, exponential backoff)
- Red dot + banner "Donnees potentiellement obsoletes": disconnected > 30 seconds

On reconnect: all TanStack Query caches are invalidated to catch up on missed changes.

### 5.4 Postgres Functions (Server-Side Logic, No Network Hop)

These run inside PostgreSQL for atomicity and performance:

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `create_salon` | `(name, timezone, currency, owner_profile_id) -> salon_id` | Creates salon + owner membership + seeds defaults. Single transaction. |
| `accept_invitation` | `(token) -> membership_id` | Validates token, creates membership, links staff if stylist. |
| `create_transaction` | `(salon_id, client_id, items[], payments[]) -> transaction_id` | Inserts transaction + items + payments, updates product stock, all atomic. |
| `book_appointment` | `(salon_id, client_id, service_variant_id, staff_id, date, duration) -> appointment_id` | Validates slot availability with `SELECT ... FOR UPDATE`, then inserts. Exclusion constraint is backup. |
| `transfer_ownership` | `(salon_id, new_owner_profile_id) -> void` | Atomically promotes new owner, demotes current to manager. |
| `revoke_membership` | `(membership_id) -> void` | Soft-deletes membership. Trigger prevents revoking last owner. |
| `gdpr_delete_client` | `(client_id) -> void` | Anonymizes client across all tables (transactions, appointments) while preserving financial aggregates. |
| `get_dashboard_stats` | `(salon_id, date_from, date_to) -> jsonb` | Aggregated KPIs: revenue, transaction count, avg basket, top services, appointments. Single query. |
| `get_client_stats` | `(client_id) -> {total_visits, total_spent, last_visit_date}` | Computed from transactions. Replaces denormalized fields. |
| `get_staff_performance` | `(salon_id, staff_id, date_from, date_to) -> jsonb` | Revenue per stylist, commission calculations. |
| `check_slot_availability` | `(staff_id, date, duration_minutes) -> boolean` | Advisory check for UI — NOT authoritative (TOCTOU). `book_appointment` is the real guard. |

### 5.5 Edge Functions (External I/O Required)

These need to call external services and therefore cannot be Postgres functions:

| Function | Trigger | What It Does |
|----------|---------|--------------|
| `send-invitation` | Called from Team > Invite UI | Validates permissions, creates invitation row, sends email via Resend/SMTP. Rolls back invitation if email fails. |
| `delete-salon` | Called from Settings > Danger Zone | Validates owner. Soft-deletes salon + cascades to all data + revokes memberships. Could trigger external cleanup (Stripe cancellation in V2). |

### 5.6 Database Views

| View | Purpose |
|------|---------|
| `client_stats` | Computes `total_visits`, `total_spent`, `last_visit_date` from transactions. Used by client list/detail. |
| `appointment_details` | Joins appointments with client name, staff name, service name. Replaces denormalized name columns. |
| `ledger_entries` | Unions transactions (as income) and expenses into a single chronological ledger for accounting module. |

### 5.7 File Storage

Supabase Storage with RLS-protected buckets:

```
salon-assets/
  {salon_id}/
    logo.{ext}
    clients/{client_id}/avatar.{ext}
    staff/{staff_id}/avatar.{ext}
    receipts/{expense_id}/proof.{ext}
```

**Bucket configuration:**
- Avatars: max 2MB, allowed types: `image/jpeg`, `image/png`, `image/webp`
- Logos: max 5MB, same image types
- Receipts: max 10MB, allowed types: `image/*`, `application/pdf`
- Image transforms: avatars served at 200x200, logos at 400x400 via Supabase transforms

Storage RLS: users can only read/write within their salon's folder path.

---

## 6. Error Handling, Notifications & Production Hardening

### 6.1 Error Handling — Three Tiers

#### Tier 1: Error Boundaries

- **Global error boundary** at app root: catches unrecoverable rendering crashes. Shows "Something went wrong" with reload button. Logs to Sentry.
- **Per-module error boundaries**: wraps each module. If Appointments crashes, Clients still works. Shows inline error with "Retry" button.

#### Tier 2: Mutation Error Handling (via TanStack Query)

All mutations use `useMutation` with optimistic updates and rollback on failure.

**Severity-based notification routing:**

| Severity | Used For | UI Treatment |
|----------|----------|--------------|
| `critical` | POS transaction failure, appointment booking failure | **Blocking modal** — user cannot navigate away until they acknowledge/retry |
| `error` | CRUD failures (save client, update product) | **Persistent toast** — no auto-dismiss, must be manually closed |
| `warning` | Connection issues, stale data | **Banner** at top of app |
| `success` / `info` | Successful operations, real-time notifications | **Auto-dismissing toast** (5 seconds) |

**Error code mapping (French UI):**

| Error | Message |
|-------|---------|
| 403 / RLS violation | "Vous n'avez pas la permission d'effectuer cette action" |
| 409 / unique constraint | "Cet enregistrement existe deja" |
| 23P01 / exclusion (double booking) | "Ce creneau n'est plus disponible" |
| Network error | "Connexion perdue — verifiez votre connexion internet" |
| Unknown | "Une erreur inattendue s'est produite — veuillez reessayer" |

#### Tier 3: Real-Time Connection Handling

- Auto-reconnect with exponential backoff (Supabase built-in)
- On reconnect: invalidate all TanStack Query caches
- Connection status indicator in header (green/orange/red)
- Banner after 30s disconnect: "Donnees potentiellement obsoletes — reconnexion en cours..."

### 6.2 Structured Error Logging

Every Sentry event enriched with context:

```typescript
function logError(error: Error, context: {
  salonId?: string;
  userId?: string;
  role?: string;
  action?: string;       // e.g. 'create_transaction'
  table?: string;        // e.g. 'transactions'
  recordId?: string;
}) { ... }
```

### 6.3 Toast / Notification System

Built in-house (~100 lines, Tailwind-styled):
- Position: bottom-right
- Stack up to 3 visible, queue the rest
- Types: success (green), error (red), warning (amber), info (blue)
- `ToastContext` + `useToast()` hook
- Used for mutation feedback and real-time event notifications

### 6.4 Form Validation — Three Layers

1. **Zod schemas (client-side):** Validates before the Supabase call. Instant feedback. One schema per entity matching the frontend type.
2. **Postgres function validation:** Complex operations (`create_transaction`, `book_appointment`) validate business rules (quantities > 0, payment sums match total, slot available).
3. **Database constraints:** NOT NULL, CHECK, FK, UNIQUE, exclusion. Last line of defense. Never rely on client-side alone.

### 6.5 Security

- **Env vars:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only in client code. Service role key in Edge Functions only.
- **RLS on every table** — no exceptions. A table without RLS is a data breach.
- **Sensitive field encryption:** `base_salary`, `iban`, `social_security_number` encrypted via Supabase Vault / pgcrypto. Decrypted only for owner role.
- **CSP headers:** configured via Vite / hosting platform.
- **CORS:** restricted to app domain in production.
- **Rate limiting:**
  - `send-invitation`: max 10 per salon per hour
  - `create-salon`: max 3 per user per day
  - `create-transaction`: max 100 per salon per hour
  - Auth attempts: Supabase built-in rate limits
- **Input sanitization:** Supabase parameterized queries prevent SQL injection. Text output is React-escaped (prevents XSS by default).

### 6.6 RGPD / Data Privacy Compliance

This app handles personal data (names, phones, emails, medical allergies, staff SSN/IBAN) in the French/Moroccan market. RGPD applies.

**V1 requirements:**
- **Consent tracking:** `permissions_*` fields on clients table track marketing/social media consent
- **Right to deletion:** `gdpr_delete_client()` Postgres function anonymizes client data across all tables while preserving financial aggregates for accounting
- **Encrypted sensitive fields:** SSN, IBAN, base salary encrypted at rest, decryptable only by owner
- **Privacy policy:** referenced in app footer (content is a legal deliverable, not a code deliverable)
- **Data minimization:** only collect what's needed (existing field set is justified by business need)

### 6.7 Performance

- **Composite indexes** on every `(salon_id, ...)` query path (see Section 2.5)
- **`select()` projections:** never `SELECT *` — only fetch columns the component needs
- **Pagination:** list views default to 50 rows with load-more. Applies to clients, transactions, expenses, appointments.
- **Image optimization:** avatars served at 200x200, logos at 400x400 via Supabase Storage transforms

### 6.8 Environment Management

| Environment | Purpose | Database | Auth |
|-------------|---------|----------|------|
| `local` | Development | Supabase CLI (local Postgres) | Local auth (test users) |
| `staging` | Testing | Supabase project (staging) | Real auth, test data |
| `production` | Live | Supabase project (production, Pro plan) | Real auth, real data |

- **Migrations:** managed via Supabase CLI (`supabase migration new`, `supabase db push`). All migrations are additive in V1.
- **Seed script:** runs on local/staging only. Never production.
- **Env files:** `.env.local`, `.env.staging`, `.env.production`
- **Backups:** Supabase Pro plan provides daily backups with point-in-time recovery. **The free tier is not suitable for production** — no backups, pauses after inactivity.

### 6.9 Observability

- **Sentry:** JS errors, failed mutations, unhandled rejections. Every event tagged with salon_id, user_id, role, action.
- **Supabase Dashboard:** database performance, Realtime metrics, Edge Function logs, Auth events.
- **Audit log:** populated from day one via Postgres triggers. UI for viewing activity feed is V2 (but the data is collected now).

---

## 7. Deferred Features (Prioritized)

| Priority | Feature | Reasoning |
|----------|---------|-----------|
| **P0** | Stripe billing integration | No revenue without it. Schema is ready. |
| **P1** | Appointment reminders (email) | Biggest driver of no-shows. Edge Function + scheduled job. |
| **P1** | Mobile responsive redesign | Staff use phones/tablets. Current UI is desktop-only. |
| **P2** | Client self-service portal | Separate auth flow + booking UI. Reduces receptionist load. |
| **P2** | Data export (CSV/PDF) | Legal/accounting requirement. Edge Function + file generation. |
| **P3** | SMS/WhatsApp notifications | Morocco is WhatsApp-heavy. Requires Twilio. |
| **P3** | Onboarding wizard | Better UX than seed script. Guides initial setup. |
| **P3** | Inventory alerts (low stock) | Scheduled function + notification. |
| **P3** | Audit log UI (activity feed) | Data is collected from V1. UI for browsing it. |
| **P4** | Multi-language (i18n) | French covers target market. i18n framework adds complexity. |
| **P4** | Advanced analytics / reporting | Dashboard KPIs cover basics. BI-grade reports are V2+. |

---

## Appendix A: Full Table Schema Reference

### Tables by Category

**Identity & Access (no salon_id):**
- `profiles` (id, email, first_name, last_name, avatar_url, created_at, updated_at)
- `plans` (id, name, max_staff, max_clients, max_products, features, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, active)

**Identity & Access (with salon_id):**
- `salons` (id, name, slug, address, phone, email, website, logo_url, currency, vat_rate, timezone, schedule, plan_id, subscription_tier, trial_ends_at, created_at, updated_at, deleted_at)
- `salon_memberships` (id, salon_id, profile_id, role, invited_by, invited_at, accepted_at, status, created_at, updated_at, deleted_at) — UNIQUE(salon_id, profile_id)
- `invitations` (id, salon_id, email, role, token, invited_by, expires_at, accepted_at, email_sent_at, created_at) — UNIQUE(salon_id, email)

**Business Data (all have salon_id + standard audit columns):**
- `clients` (28 columns — see Section 2.4)
- `service_categories` (id, salon_id, name, color, sort_order)
- `services` (id, salon_id, name, category_id, description, active)
- `service_variants` (id, service_id, salon_id, name, duration_minutes, price, cost, sort_order)
- `product_categories` (id, salon_id, name, color, sort_order)
- `products` (id, salon_id, name, description, category_id, price, cost, sku, barcode, stock, supplier_id, active)
- `suppliers` (id, salon_id, name, contact_name, email, phone, website, address, category, payment_terms, active, notes)
- `staff_members` (id, salon_id, membership_id, first_name, last_name, role, email, phone, color, photo_url, bio, skills, active, start_date, end_date, contract_type, weekly_hours, commission_rate, base_salary*, iban*, social_security_number*, birth_date, address, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, schedule) — *encrypted
- `appointments` (id, salon_id, client_id, service_id, service_variant_id, staff_id, date, duration_minutes, status, price, notes) — exclusion constraint on (staff_id, time range)
- `transactions` (id, salon_id, client_id, date, total, notes, created_at, created_by) — immutable
- `transaction_items` (id, transaction_id, salon_id, reference_id, type, name, variant_name, price, original_price, quantity, cost, note) — all prices snapshotted
- `transaction_payments` (id, transaction_id, salon_id, method, amount)
- `expense_categories` (id, salon_id, name, color, sort_order)
- `expenses` (id, salon_id, date, description, category_id, amount, supplier_id, proof_url)
- `recurring_expenses` (id, salon_id, name, amount, frequency, next_date, category_id, active)

**System:**
- `audit_log` (id, salon_id, table_name, record_id, action, old_data, new_data, performed_by, performed_at) — populated by triggers

**Total: 20 tables + 3 views**

---

## Appendix B: RLS Policy Reference

### Helper Functions

```sql
-- Set session context (called once per request by the client wrapper)
CREATE FUNCTION set_session_context(salon_id uuid, user_role text) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.active_salon_id', salon_id::text, true);
  PERFORM set_config('app.user_role', user_role, true);
END;
$$ LANGUAGE plpgsql;

-- Get the active salon for the current request (reads from session variable — no subquery)
CREATE FUNCTION get_active_salon() RETURNS uuid AS $$
  SELECT current_setting('app.active_salon_id', true)::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get the current user's role (reads from session variable — no subquery)
CREATE FUNCTION get_user_role() RETURNS text AS $$
  SELECT current_setting('app.user_role', true);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Both role and salon are set once per request via `set_session_context()`, then read cheaply by RLS policies via `current_setting()`. No per-row subqueries on `salon_memberships`.

### Policy Patterns

**Pattern 1: All roles, salon-scoped (clients, services, products, appointments)**

```sql
-- SELECT: all active members can read
CREATE POLICY select_policy ON {table}
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
  );

-- INSERT/UPDATE/DELETE: owner and manager only
CREATE POLICY modify_policy ON {table}
  FOR ALL USING (
    salon_id = get_active_salon()
    AND get_user_role() IN ('owner', 'manager')
  );
```

**Pattern 2: Restricted to owner/manager (expenses, suppliers, accounting)**

```sql
CREATE POLICY select_policy ON expenses
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
    AND get_user_role() IN ('owner', 'manager')
  );
```

**Pattern 3: Stylist sees own data only (appointments, filtered clients)**

```sql
-- Stylists see only their own appointments
CREATE POLICY stylist_appointments ON appointments
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
    AND (
      get_user_role() IN ('owner', 'manager', 'receptionist')
      OR (get_user_role() = 'stylist' AND staff_id = (
        SELECT id FROM staff_members WHERE membership_id = (
          SELECT id FROM salon_memberships
          WHERE profile_id = auth.uid() AND salon_id = get_active_salon()
        )
      ))
    )
  );

-- Stylists see clients linked via appointments
CREATE POLICY stylist_clients ON clients
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
    AND (
      get_user_role() IN ('owner', 'manager', 'receptionist')
      OR (get_user_role() = 'stylist' AND id IN (
        SELECT DISTINCT client_id FROM appointments
        WHERE staff_id = (
          SELECT id FROM staff_members WHERE membership_id = (
            SELECT id FROM salon_memberships
            WHERE profile_id = auth.uid() AND salon_id = get_active_salon()
          )
        )
      ))
    )
  );
```

**Pattern 4: Staff member sees own profile only**

```sql
CREATE POLICY staff_own_profile ON staff_members
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
    AND (
      get_user_role() IN ('owner', 'manager')
      OR membership_id = (
        SELECT id FROM salon_memberships
        WHERE profile_id = auth.uid() AND salon_id = get_active_salon()
      )
    )
  );
```

**Pattern 5: Sensitive columns (salary, IBAN, SSN) — owner only**

Implemented via column-level security or a separate restricted view that only the owner role can access. The base `staff_members` policy excludes these columns for non-owner roles.

### Full Table → Policy Mapping

| Table | SELECT | INSERT | UPDATE | DELETE (soft) |
|-------|--------|--------|--------|---------------|
| salons | Own memberships | Authenticated | Owner | Owner |
| salon_memberships | Own salon | Owner, Manager | Owner, Manager | Owner, Manager |
| clients | Pattern 3 (stylist filtered) | Owner, Manager, Receptionist | Owner, Manager, Receptionist | Owner, Manager |
| services | Pattern 1 (all read) | Owner, Manager | Owner, Manager | Owner, Manager |
| service_variants | Pattern 1 | Owner, Manager | Owner, Manager | Owner, Manager |
| service_categories | Pattern 1 | Owner, Manager | Owner, Manager | Owner, Manager |
| products | Pattern 1 | Owner, Manager | Owner, Manager | Owner, Manager |
| product_categories | Pattern 1 | Owner, Manager | Owner, Manager | Owner, Manager |
| suppliers | Pattern 2 (owner/manager) | Owner, Manager | Owner, Manager | Owner, Manager |
| staff_members | Pattern 4 (own profile) | Owner, Manager | Owner, Manager (own profile for stylist/receptionist) | Owner, Manager |
| appointments | Pattern 3 (stylist filtered) | Owner, Manager, Receptionist | Owner, Manager, Receptionist | Owner, Manager |
| transactions | Owner/Manager: all; Receptionist: all; Stylist: own (`created_by`) | Via `create_transaction()` only | Never (immutable) | Never |
| transaction_items | Same as transactions (joined via transaction_id) | Via `create_transaction()` only | Never | Never |
| transaction_payments | Same as transactions (joined via transaction_id) | Via `create_transaction()` only | Never | Never |
| expenses | Pattern 2 | Owner, Manager | Owner, Manager | Owner, Manager |
| expense_categories | Pattern 2 | Owner, Manager | Owner, Manager | Owner, Manager |
| recurring_expenses | Pattern 2 | Owner, Manager | Owner, Manager | Owner, Manager |
| audit_log | Owner, Manager (read only) | Via triggers only | Never | Never |

---

## Appendix C: Function Inventory

### Postgres Functions

**Security model:** Functions that perform multi-table writes bypassing RLS use `SECURITY DEFINER` with explicit permission checks inside. Functions that should respect RLS use `SECURITY INVOKER`. Helper functions used by RLS policies are `SECURITY DEFINER` (they need to read `salon_memberships` regardless of the caller's RLS context).

| Function | Type | Security | Called By | Purpose |
|----------|------|----------|----------|---------|
| `set_session_context(salon_id, user_role)` | RPC | INVOKER | Request wrapper | Sets `app.active_salon_id` and `app.user_role` per-request |
| `create_salon(name, timezone, currency, owner_id)` | RPC | DEFINER | Signup flow | Creates salon + owner membership + seeds defaults |
| `accept_invitation(token)` | RPC | DEFINER | Invitation flow | Validates, creates membership, links staff |
| `create_transaction(salon_id, client_id, items[], payments[])` | RPC | DEFINER | POS module | Atomic multi-table insert + stock update. Checks role internally. |
| `book_appointment(salon_id, client_id, variant_id, staff_id, date, duration)` | RPC | DEFINER | Appointments module | Validates availability + inserts. Checks role internally. |
| `transfer_ownership(salon_id, new_owner_id)` | RPC | DEFINER | Settings | Atomic role swap. Owner-only check inside. |
| `revoke_membership(membership_id)` | RPC | DEFINER | Team module | Soft-delete + prevents last-owner removal |
| `gdpr_delete_client(client_id)` | RPC | DEFINER | Client module | Anonymizes across all tables. Owner-only. |
| `get_dashboard_stats(salon_id, date_from, date_to)` | RPC | INVOKER | Dashboard | Aggregated KPIs in single query. Respects RLS. |
| `get_client_stats(client_id)` | RPC | INVOKER | Client detail | Computed visits/spending/last visit. Respects RLS. |
| `get_staff_performance(salon_id, staff_id, date_from, date_to)` | RPC | INVOKER | Team / Dashboard | Revenue + commission per staff. Respects RLS. |
| `check_slot_availability(staff_id, date, duration)` | RPC | INVOKER | Appointment form | Advisory availability check (not authoritative) |
| `get_active_salon()` | Helper | DEFINER | RLS policies | Returns current salon from session variable |
| `get_user_role()` | Helper | DEFINER | RLS policies | Returns current role from session variable |
| `update_updated_at()` | Trigger | DEFINER | All tables | Auto-sets `updated_at` on UPDATE |
| `audit_trigger()` | Trigger | DEFINER | All business tables | Writes to audit_log on INSERT/UPDATE/DELETE |
| `create_profile_on_signup()` | Trigger | DEFINER | auth.users INSERT | Creates profiles row for new user |
| `protect_last_owner()` | Trigger | DEFINER | salon_memberships | Prevents removal/demotion of last owner |

### Edge Functions (Deno)

| Function | HTTP Method | Called By | Purpose |
|----------|-------------|----------|---------|
| `send-invitation` | POST | Team > Invite UI | Creates invitation + sends email |
| `delete-salon` | POST | Settings > Danger Zone | Soft-deletes salon + cascades |

### Database Views

| View | Source Tables | Purpose |
|------|-------------|---------|
| `client_stats` | transactions, transaction_items | `total_visits`, `total_spent`, `last_visit_date` per client |
| `appointment_details` | appointments, clients, staff_members, services, service_variants | Full appointment with joined names |
| `ledger_entries` | transactions, expenses | Unified income/expense chronological ledger |
