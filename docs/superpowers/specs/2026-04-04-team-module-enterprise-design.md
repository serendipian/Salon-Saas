# Team Module Enterprise Upgrade — Design Spec

## Overview

Transform the team module from a simple list with add/edit form into a full-featured, enterprise-level staff management system with individual staff detail pages, inline editing, invitation flow, payout tracking, and rich linked data.

## Goals

1. View, edit, and archive/restore team members
2. Invite staff by generating a shareable link (email input + copy-to-clipboard)
3. Individual staff detail page with dashboard-style layout and 5 tabs
4. Hybrid payout tracking: computed expected compensation + manual "mark as paid" with audit trail
5. Rich linked data: performance, agenda, client portfolio, activity feed

---

## 1. Routing & Navigation

### Route Structure (HashRouter, nested)

| Route | Component | Purpose |
|---|---|---|
| `#/team` | `TeamModule` (layout with `<Outlet>`) | Shared layout shell |
| `#/team` (index) | `TeamListPage` | Staff list (cards/table, search, archive toggle) |
| `#/team/new` | `NewStaffPage` | Add new staff member (full form) |
| `#/team/:id` | `StaffDetailPage` | Dashboard-style detail page |

No `/team/:id/edit` route. Editing happens inline per-section on the detail page.

### Route Config (in App.tsx or equivalent)

```tsx
<Route path="/team" element={<TeamModule />}>
  <Route index element={<TeamListPage />} />
  <Route path="new" element={<NewStaffPage />} />
  <Route path=":id" element={<StaffDetailPage />} />
</Route>
```

### Navigation Flows

- List card/row click → `navigate(/team/${id})`
- "Ajouter un membre" button → `navigate('/team/new')`
- After new member save → `navigate(/team/${newId})`
- Back / breadcrumb → `navigate('/team')`
- TeamPerformance row click → `navigate(/team/${id}?tab=performance)`

### Breadcrumb

Simple trail at top of sub-pages:
- Detail: `Equipe > {Prenom Nom}`
- New: `Equipe > Nouveau membre`

### Tab URL Parameter

`StaffDetailPage` reads `?tab=` from URL to set default active tab. Valid values: `profil` (default), `performance`, `remuneration`, `agenda`, `activite`.

---

## 2. Staff Detail Page — Layout

### Header Card (pinned at top)

- Photo (or avatar with initials + staff color)
- Full name, role badge, status badge (Actif / Archive)
- Quick stats row: appointments this month, revenue this month, commission rate, seniority (since `start_date`)
- Next 3 upcoming appointments (quick glance)
- Action buttons:
  - "Inviter par lien" — only visible when `membership_id IS NULL`
  - "Compte lie" badge — when `membership_id` is set
  - "Invitation en attente" badge — when pending invitation exists (with expiry date)
  - "Desactiver" / "Activer" toggle — archives/restores

### Tabbed Content (5 tabs)

#### Tab 1 — Profil

Three inline-editable sections:
- **Informations personnelles**: first name, last name, email, phone, birth date, address, bio, emergency contact (name, relation, phone)
- **Contrat & Competences**: contract type, start/end date, weekly hours, skills (service categories), schedule (reuses `WorkScheduleEditor`)
- **Donnees sensibles** (owner/manager only): base salary, IBAN, social security number — loaded lazily via `get_staff_pii` RPC

Read-only sections:
- **Portfolio clients**: top 10 clients by visit frequency (from `get_staff_clients` RPC)
- **Activite recente**: last 10 events (compact version, links to Activite tab for full feed)

Collapsible section:
- **Zone de danger**: "Archiver ce membre" button with confirmation modal

Each inline-editable section has: a "Modifier" button that flips to edit mode, "Enregistrer" / "Annuler" buttons in edit mode, individual loading/error states.

#### Tab 2 — Performance

- Date range picker (reuses `DateRangePicker`)
- KPI cards: total revenue, service revenue, product revenue, avg basket, appointments completed, cancellation rate, no-show rate
- Revenue chart (daily/weekly bar chart via Recharts, shown only if range <= 31 days)
- Top 5 services table (by revenue and by count)

Data source: transactions + transaction_items filtered by `staff_id` (consistent with existing `useTeamPerformance` approach using POS data, not appointment prices).

#### Tab 3 — Remuneration

- **Monthly summary card**: base salary + commission earned + bonus = total expected for selected period
- **Commission rate** display with inline edit
- **Bonus tier config** (reuses `BonusSystemEditor`) with inline edit
- **Payout history table**: records from `staff_payouts`, columns: date, type, amount, status badge (En attente / Paye / Annule), notes, actions
- **"Marquer comme paye" button**: opens `PayoutForm` — amount (pre-filled with expected total), type (Salaire/Commission/Prime/Autre), period, date, notes

#### Tab 4 — Agenda

- **Weekly calendar view**: mini calendar showing this staff member's appointments for the current week
- **Today's schedule**: timeline view of today's slots (booked vs available)
- **Upcoming appointments**: next 7 days list with client name, service, duration, time
- **Schedule card**: weekly work hours (reuses `WorkScheduleEditor` in read-only mode, with inline edit)
- **Stats row**: booking rate (% of available hours filled), appointments this week, appointments this month

#### Tab 5 — Activite

- Chronological feed of recent events:
  - Appointments completed
  - Sales made (POS transactions attributed to this staff)
  - Cancellations
  - No-shows
- Built from `get_staff_activity` RPC (UNION ALL from appointments + transaction_items)
- Paginated: 20 events per page, "Charger plus" button
- Each event: icon, type label, description, timestamp, linked client name

---

## 3. Database Changes

### New Table: `staff_payouts`

```sql
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
```

**Column descriptions:**
- `type`: SALARY (base salary), COMMISSION (% of revenue), BONUS (tier-based), OTHER (ad hoc)
- `status`: PENDING (expected/generated), PAID (confirmed paid), CANCELLED (voided)
- `amount`: actual amount paid or expected
- `reference_amount`: the basis for calculation — base salary amount for SALARY, period revenue for COMMISSION, revenue that triggered tier for BONUS
- `rate_snapshot`: commission percentage or bonus tier amount at time of payout creation (audit trail)
- `period_start` / `period_end`: the period this payout covers (e.g., 2026-04-01 to 2026-04-30)
- `paid_at`: timestamp when status changed to PAID, NULL for PENDING/CANCELLED

**RLS policies:**
- SELECT: owner/manager only (via `user_salon_ids_with_role(ARRAY['owner', 'manager'])`)
- INSERT: owner/manager only
- UPDATE: owner/manager only
- DELETE: none (use soft delete or status change)

**Triggers:**
- `updated_at` auto-set trigger (standard pattern)

**Indexes:**
- `(salon_id, staff_id)` — primary lookup pattern
- `(salon_id, staff_id, period_start, period_end)` — period queries

### New RPC: `get_staff_activity`

```sql
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
```

Implementation: `UNION ALL` of:
- Appointments (type: 'appointment_completed', 'appointment_cancelled', 'appointment_no_show') from `appointments` where `staff_id = p_staff_id` and `status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')`
- Transaction items (type: 'sale') from `transaction_items ti JOIN transactions t` where `ti.staff_id = p_staff_id`

Sorted by `event_date DESC`, with `LIMIT p_limit OFFSET p_offset`.

Security: SECURITY DEFINER. Validates caller has access by checking `staff_members.salon_id IN (SELECT user_salon_ids())`. Raises exception if not.

### New RPC: `get_staff_clients`

```sql
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
```

Implementation: `SELECT` from `appointments a JOIN clients c` where `a.staff_id = p_staff_id` and `a.status = 'COMPLETED'`, `GROUP BY c.id`, `ORDER BY visit_count DESC`, `LIMIT p_limit`.

Security: SECURITY DEFINER. Validates caller has access by checking `staff_members.salon_id IN (SELECT user_salon_ids())`. Raises exception if not.

---

## 4. Invitation Flow

### Trigger

"Inviter par lien" button on `StaffHeader`. Only visible when `membership_id IS NULL` (ghost staff with no linked account).

### Flow

1. Owner/manager clicks "Inviter par lien"
2. `InvitationModal` opens: email input (pre-filled with staff member's email if set, editable), role confirmation (read-only, from staff record)
3. On submit: INSERT into `invitations` with `staff_member_id = staffId`, `role` mapped from staff role, `token` generated, `expires_at = now() + 7 days`
4. Modal displays the invitation link: `{window.location.origin}/#/accept-invitation?token={token}`
5. "Copier le lien" button copies to clipboard
6. Toast: "Lien d'invitation genere"
7. Header card updates to show "Invitation en attente" badge with expiry date

### Acceptance

Uses existing `accept_invitation` RPC which already handles `staff_member_id` linking:
- Sees `invitation.staff_member_id IS NOT NULL`
- Updates existing staff record: `SET membership_id = v_membership_id`
- Staff member is now linked — detail page shows "Compte lie" badge via realtime sync

### Edge Cases

- Staff member already has `membership_id` → invite button hidden
- Re-invite after expiry → expire old invitation (`SET expires_at = now()`), create new one
- Role mapping: staff `role` → invitation `role` (Manager→manager, Stylist→stylist, Receptionist→receptionist, Assistant→receptionist as fallback)

---

## 5. Archive & Restore

### Archive (Soft Delete)

Location: "Zone de danger" collapsible section at bottom of Profil tab.

**Ghost staff** (no `membership_id`):
1. Click "Archiver ce membre"
2. Confirmation modal: "Etes-vous sur de vouloir archiver {nom} ? Ses donnees historiques seront conservees."
3. Execute: `UPDATE staff_members SET deleted_at = now() WHERE id = :id`
4. Cancel any pending invitations: `UPDATE invitations SET expires_at = now() WHERE staff_member_id = :id AND accepted_at IS NULL`
5. Toast: "Membre archive"
6. Navigate to `#/team`

**Linked staff** (has `membership_id`):
1. Click "Archiver ce membre"
2. Confirmation modal: "Etes-vous sur de vouloir archiver {nom} ? Son acces a l'application sera egalement revoque."
3. Execute: call `revoke_membership(membership_id)` RPC (atomically soft-deletes membership + staff record)
4. Cancel any pending invitations (same as above)
5. Toast: "Membre archive et acces revoque"
6. Navigate to `#/team`

### Restore

1. In list with "Voir les membres archives" toggle enabled, archived members show greyed out with "Archive" badge
2. Clicking an archived member opens their detail page in **read-only mode** (all inline edit buttons hidden, action buttons hidden except "Restaurer")
3. Banner at top: "Ce membre a ete archive le {date}"
4. "Restaurer" button on the banner
5. Execute: `UPDATE staff_members SET deleted_at = NULL WHERE id = :id`
6. Toast: "Membre restaure"
7. Page refreshes to active state
8. Note: if membership was revoked, the member is restored as ghost staff. Owner must re-invite for account linking. Restore confirmation: "Ce membre devra etre reinvite pour acceder a l'application."

### Permissions

Only owner/manager can archive or restore. RLS on `staff_members` UPDATE already enforces this.

---

## 6. List Page Changes

### TeamListPage

**Preserved:**
- Card/table view toggle (ViewToggle)
- Search bar
- Performance tab (existing TeamPerformance component)

**Changed:**
- Card/row click → `navigate(/team/${id})` instead of opening edit form
- "Ajouter un membre" → `navigate('/team/new')`
- New "Voir les membres archives" toggle: when enabled, includes soft-deleted members in query (greyed out, "Archive" badge)
- TeamPerformance row click → `navigate(/team/${id}?tab=performance)`

**Removed:**
- Internal `ViewState` enum (LIST/ADD/EDIT) — replaced by routing
- `selectedMember` state — detail page loads its own data
- PII lazy-loading from TeamModule — moves to detail page

### Filter Logic

- Default: `deleted_at IS NULL` (existing behavior)
- Archive toggle ON: no `deleted_at` filter, archived members shown with visual distinction
- The `active` boolean column on staff_members is NOT used for this — `deleted_at` is the single source of truth for archive status

---

## 7. Hooks & Data Architecture

### New Hooks

| Hook | Purpose | Query Key |
|---|---|---|
| `useStaffDetail(staffId)` | Single staff member fetch, PII load, inline section update, archive/restore | `['staff_member', salonId, staffId]` |
| `useStaffPayouts(staffId)` | CRUD for `staff_payouts` table | `['staff_payouts', salonId, staffId]` |
| `useStaffCompensation(staffId, period)` | Computed expected salary + commission + bonus | `['staff_compensation', salonId, staffId, period]` |
| `useStaffAppointments(staffId)` | Upcoming appointments (7 days), today's schedule, booking rate | `['staff_appointments', salonId, staffId]` |
| `useStaffActivity(staffId)` | Calls `get_staff_activity` RPC, paginated | `['staff_activity', salonId, staffId]` |
| `useStaffClients(staffId)` | Calls `get_staff_clients` RPC, top 10 | `['staff_clients', salonId, staffId]` |
| `useInvitation(staffId)` | Pending invitation check, create, cancel | `['invitation', salonId, staffId]` |

### Refactored

- `useTeamPerformance.ts`: extract `calcCommission`, `calcBonus`, `countWorkingDays` into `modules/team/utils.ts`. Both `useTeamPerformance` and `useStaffCompensation` import from there.

### Unchanged

- `useTeam.ts` — list-level CRUD, consumed by TeamListPage
- `useTransactions` (shared) — consumed by useStaffCompensation for revenue data
- `useAppointments` (shared) — consumed by useStaffAppointments

### Query Key Convention

All new hooks follow `['resource', salonId, staffId]` to ensure proper cache invalidation on salon switch, consistent with the existing `['resource', salonId]` convention.

---

## 8. File Structure

### New Files

```
modules/team/
  utils.ts                              # Extracted: calcCommission, calcBonus, countWorkingDays
  pages/
    TeamListPage.tsx                     # List view extracted from TeamModule
    NewStaffPage.tsx                     # Add form wrapper (reuses TeamForm)
    StaffDetailPage.tsx                  # Dashboard container: header + tabs
  components/
    StaffHeader.tsx                      # Photo, name, role, status, stats, actions
    StaffProfileTab.tsx                  # Inline-editable sections + clients + danger zone
    StaffPerformanceTab.tsx              # KPIs, chart, top services
    StaffRemunerationTab.tsx             # Compensation summary, bonus config, payouts
    StaffAgendaTab.tsx                   # Calendar, upcoming, today, schedule
    StaffActivityTab.tsx                 # Chronological event feed
    InvitationModal.tsx                  # Email input + copy link
    ArchiveConfirmModal.tsx              # Archive confirmation with context
    PayoutForm.tsx                       # "Marquer comme paye" form
    PayoutHistory.tsx                    # Payout table with status badges
  hooks/
    useStaffDetail.ts
    useStaffPayouts.ts
    useStaffCompensation.ts
    useStaffAppointments.ts
    useStaffActivity.ts
    useStaffClients.ts
    useInvitation.ts

supabase/migrations/
    YYYYMMDDHHMMSS_staff_payouts.sql
    YYYYMMDDHHMMSS_staff_rpc_activity_clients.sql
```

### Modified Files

- `TeamModule.tsx` — refactored to Routes shell with `<Outlet>`
- `useTeamPerformance.ts` — imports extracted utils
- `TeamCard.tsx` / `TeamTable.tsx` — click navigates to detail page
- `TeamList.tsx` — archive toggle, remove ViewState dependency
- `App.tsx` (or route config) — nested team routes
- `TeamPerformance.tsx` — row click navigates to `#/team/:id?tab=performance`

### Deleted

- `StaffKpiModal.tsx` — replaced by StaffPerformanceTab on detail page

### Reused As-Is

- `TeamForm.tsx` — consumed by NewStaffPage
- `WorkScheduleEditor.tsx` — consumed by Profil + Agenda tabs
- `BonusSystemEditor.tsx` — consumed by Remuneration tab
- `DateRangePicker.tsx` — consumed by Performance + Remuneration tabs

---

## 9. Permissions Summary

| Action | Who Can |
|---|---|
| View staff list | owner/manager (all), stylist/receptionist (own record only, via RLS) |
| View staff detail page | owner/manager (any), stylist/receptionist (own record only) |
| Add staff member | owner/manager |
| Edit staff member (inline) | owner/manager (any), staff member (own record) |
| View/edit PII (salary, IBAN, SSN) | owner/manager only (via RPC) |
| Archive/restore staff | owner/manager only |
| Create invitation | owner/manager only |
| View/create payouts | owner/manager only |
| View performance data | owner/manager (any staff), stylist (own only) |

All enforced at both UI level (button visibility) and database level (RLS + RPC role checks).

---

## 10. Data Flow Diagram

```
TeamListPage
  └─ useTeam() → staff_members SELECT (list)
  └─ click row → navigate to /team/:id

StaffDetailPage
  └─ useStaffDetail(id) → staff_members SELECT (single)
  └─ ?tab= URL param → default active tab

  StaffHeader
    └─ useInvitation(id) → invitations SELECT
    └─ archive action → revoke_membership RPC or direct UPDATE

  StaffProfileTab
    └─ useStaffDetail.loadPii() → get_staff_pii RPC
    └─ useStaffDetail.updateSection() → staff_members UPDATE + update_staff_pii RPC
    └─ useStaffClients(id) → get_staff_clients RPC

  StaffPerformanceTab
    └─ useTransactions() → transactions + items (filtered by staff_id client-side)
    └─ useStaffAppointments(id) → appointments (for counts/rates)

  StaffRemunerationTab
    └─ useStaffCompensation(id, period) → computed from transactions + staff config
    └─ useStaffPayouts(id) → staff_payouts CRUD

  StaffAgendaTab
    └─ useStaffAppointments(id) → appointments (upcoming + today)

  StaffActivityTab
    └─ useStaffActivity(id) → get_staff_activity RPC (paginated)
```
