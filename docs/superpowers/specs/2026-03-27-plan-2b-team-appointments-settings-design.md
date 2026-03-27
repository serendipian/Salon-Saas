# Plan 2B — Team, Appointments, Settings Migration

## Goal

Migrate the Team, Appointments, and Settings modules from in-memory AppContext state to Supabase + TanStack Query, following the patterns established in Plan 2A.

## Scope

Three modules, migrated in dependency order:

1. **Settings** (no dependencies) — SalonSettings from `salons` row + ExpenseCategories + RecurringExpenses
2. **Team** (no dependencies) — StaffMembers with JSONB fields
3. **Appointments** (depends on Team + Plan 2A modules) — 4-entity JOIN query

After migration, AppContext retains only: transactions, expenses, mock data generators (Plan 2C targets).

## Architecture

Same pattern as Plan 2A:

- **Per-module `mappers.ts`** — DB row ↔ frontend type translation (snake_case ↔ camelCase)
- **Per-module TanStack Query hook** — `useQuery` for reads, `useMutation` for writes
- **Query keys** — `['resource', salonId]` for auto-refetch on salon switch
- **Soft-delete** — `.is('deleted_at', null)` on reads, `update({ deleted_at })` on deletes
- **Defense-in-depth** — explicit `.eq('salon_id', salonId)` on all queries alongside RLS

---

## Module 1: Settings

### Data Sources

| Frontend State | DB Table | Notes |
|---|---|---|
| `salonSettings` (name, address, phone, email, website, currency, vatRate, schedule) | `salons` row | Columns on the salon row, not a separate table |
| `expenseCategories` | `expense_categories` | Standard CRUD with soft-delete |
| `recurringExpenses` | `recurring_expenses` | Standard CRUD with soft-delete, FK to expense_categories |

### Unique Pattern: Salon Row Update

Unlike other modules that have dedicated tables, `SalonSettings` fields are columns on the `salons` table. The hook reads the salon row by `activeSalon.id` and updates it with a `toSalonUpdate()` mapper.

### ActiveSalon Sync

**Problem:** `AuthContext.activeSalon` holds a snapshot of the salon row. When settings are updated via `useSettings`, `activeSalon` goes stale — any component reading `activeSalon.name` (sidebar, header) shows the old value.

**Solution:** The `updateSalonSettings` mutation's `onSuccess` callback calls `setActiveSalon()` from AuthContext with the updated data, keeping both TanStack Query cache and AuthContext state in sync. This requires exposing a `setActiveSalon` (or `refreshActiveSalon`) function from AuthContext.

### New Files

- `modules/settings/mappers.ts`
  - `toSalonSettings(row)` — extracts settings-relevant columns from salon row → `SalonSettings`
  - `toSalonUpdate(settings)` — `SalonSettings` → snake_case column updates
  - `toExpenseCategory(row)` / `toExpenseCategoryInsert(cat, salonId)`
  - `toRecurringExpense(row)` / `toRecurringExpenseInsert(expense, salonId)`

- `modules/settings/hooks/useSettings.ts`

### Hook Shape: `useSettings()`

```
Queries:
  ['salon_settings', salonId] → supabase.from('salons').select('*').eq('id', salonId).single()
  ['expense_categories', salonId] → standard soft-delete query, ordered by sort_order
  ['recurring_expenses', salonId] → standard soft-delete query, ordered by name

Mutations:
  updateSalonSettings(settings) → .update(toSalonUpdate(settings)).eq('id', salonId)
    onSuccess: invalidate query + update AuthContext.activeSalon
  updateExpenseCategories(categories[]) → upsert with soft-delete (same pattern as Plan 2A categories)
  updateRecurringExpenses(expenses[]) → upsert with soft-delete

Returns:
  salonSettings, expenseCategories, recurringExpenses
  updateSalonSettings, updateExpenseCategories, updateRecurringExpenses
  isLoading
```

### Consumer Impact

- `GeneralSettings`, `OpeningHoursSettings`, `AccountingSettings` → switch from AppContext to `useSettings()`
- `usePOS` reads `salonSettings.vatRate` → switch to `useSettings()`
- `formatPrice` in `lib/format.ts` already hardcodes EUR — no change needed until currency is wired through

---

## Module 2: Team

### Data Source

| Frontend State | DB Table | Notes |
|---|---|---|
| `team: StaffMember[]` | `staff_members` | JSONB: schedule, bonus_tiers. UUID[]: skills |

### JSONB & Array Fields

Supabase JS handles JSONB natively — returns/accepts JS objects. No manual `JSON.parse`/`JSON.stringify`. The `schedule` (WorkSchedule), `bonus_tiers` (BonusTier[]), and `skills` (UUID string[]) fields map directly through the mapper.

### New Files

- `modules/team/mappers.ts`
  - `toStaffMember(row)` — full snake_case → camelCase mapping (~25 fields including nested schedule, bonusTiers, emergencyContact fields)
  - `toStaffMemberInsert(staff, salonId)` — reverse mapping for insert/update

- Rewrite `modules/team/hooks/useTeam.ts`

### Hook Shape: `useTeam()`

```
Query:
  ['staff_members', salonId] → .select('*').eq('salon_id', salonId).is('deleted_at', null).order('last_name')

Mutations:
  addStaffMember(staff) → .insert(toStaffMemberInsert(staff, salonId))
  updateStaffMember(staff) → .update(toStaffMemberInsert minus id/salon_id).eq('id', staff.id)

Returns:
  staff (filtered by searchTerm)
  allStaff (unfiltered — for AppointmentForm dropdown)
  isLoading, searchTerm, setSearchTerm
  addStaffMember, updateStaffMember
```

### Team Stats — Component-Level Computation

**Problem:** The current `useTeam` hook has `getMemberStats(staffId)` that computes appointment counts and revenue from the in-memory `appointments` array. After migration, appointments live in a separate TanStack Query hook.

**Solution:** Move stats computation to the `TeamList` component. `TeamList` calls both `useTeam()` and `useAppointments()`, then computes stats locally. This keeps `useTeam` as pure CRUD with no cross-module coupling.

```
TeamList component:
  const { allStaff } = useTeam();
  const { allAppointments } = useAppointments();
  // Compute stats per staff member from allAppointments
```

This avoids creating a DB view (premature) and avoids cross-hook imports (coupling).

---

## Module 3: Appointments

### Data Source

| Frontend State | DB Table | Notes |
|---|---|---|
| `appointments: Appointment[]` | `appointments` | FKs: client_id, service_id, service_variant_id, staff_id |

### JOIN Query

```
supabase
  .from('appointments')
  .select('*, clients(first_name, last_name), services(name), staff_members(first_name, last_name)')
  .eq('salon_id', salonId)
  .is('deleted_at', null)
  .order('date', { ascending: false })
```

The mapper constructs denormalized name fields from the joined data:
- `clientName` ← `row.clients.last_name + ' ' + row.clients.first_name`
- `serviceName` ← `row.services.name`
- `staffName` ← `row.staff_members.first_name + ' ' + row.staff_members.last_name`

Null-safe: if a FK is null (e.g., walk-in with no client), the name field defaults to empty string.

### New Files

- `modules/appointments/mappers.ts`
  - `toAppointment(row)` — maps row + joined relations → `Appointment` type
  - `toAppointmentInsert(appt, salonId)` — maps `Appointment` → DB row (FKs only, no name fields)

- Rewrite `modules/appointments/hooks/useAppointments.ts`

### Hook Shape: `useAppointments()`

```
Query:
  ['appointments', salonId] → JOIN query above

Mutations:
  addAppointment(appt) → .insert(toAppointmentInsert(appt, salonId))
    onError: detect double-booking constraint violation, surface to caller
  updateAppointment(appt) → .update(toAppointmentInsert minus id/salon_id).eq('id', appt.id)

Returns:
  appointments (filtered by searchTerm + statusFilter)
  allAppointments (unfiltered — for Dashboard/Team stats)
  isLoading, searchTerm, setSearchTerm, statusFilter, setStatusFilter
  addAppointment, updateAppointment
```

### Double-Booking Error Handling

The DB has a GIST index preventing overlapping appointments for the same staff member. Unlike other mutations that just `console.error`, the appointment mutations should detect constraint violations and surface them to the caller.

**Implementation:** The `addAppointment` and `updateAppointment` mutations check the Supabase error code. If it's an exclusion constraint violation (code `23P01`), the `onError` callback surfaces a user-facing message rather than silently logging. The mutation exposes `error` state so the form component can display it.

### AppointmentForm Updates

- `team` from AppContext → `useTeam().allStaff`
- `salonSettings` from AppContext → `useSettings().salonSettings` (or already has it)
- `allClients` from `useClients()` — already migrated (Plan 2A)
- `allServices` from `useServices()` — already migrated (Plan 2A)

---

## Module 4: AppContext Cleanup

### Remove from AppContext

- `appointments` state + `addAppointment` + `updateAppointment`
- `team` state + `addStaffMember` + `updateStaffMember`
- `salonSettings` state + `updateSalonSettings`
- `expenseCategories` state + `updateExpenseCategories`
- `recurringExpenses` state + `updateRecurringExpenses`
- `MOCK_APPOINTMENTS` import from appointments data.ts
- `INITIAL_TEAM` import from team data.ts
- Initial expense categories / recurring expenses hardcoded data

### Remains in AppContext (Plan 2C targets)

- `transactions` + `addTransaction` + mock transaction generator
- `expenses` + mock expense generator

### AuthContext Update

Expose a `refreshActiveSalon(updates: Partial<Salon>)` function that merges updated fields into the current `activeSalon` state. Called by `useSettings().updateSalonSettings` mutation's `onSuccess` to keep auth state in sync with DB writes.

---

## Module 5: CLAUDE.md Update

Update the data layer documentation to reflect 7/10 modules migrated. Update the "State Management" section and "Known Issues" list.

---

## Future Considerations (NOT in Plan 2B scope)

- **Appointment date-range filtering:** Currently loads all appointments. At ~50/day, a year of data is 18K rows. Add server-side date filtering when scale demands it.
- **Optimistic updates:** No mutations use optimistic updates yet. Consider for frequently-used mutations (appointment status changes) in a future pass.
- **Toast/snackbar errors:** All mutations use `console.error`. A proper error notification system is needed eventually — the double-booking handler in this plan is a targeted exception, not a systemic solution.
- **Currency wiring:** `formatPrice` currently defaults to EUR. When `useSettings` is available everywhere, currency can be passed through — but that's a UI-wide change better suited for a dedicated pass.
