# Codebase Audit — Remaining Items

> Generated 2026-04-08 after full audit session. All critical (12) and high (31/31) issues are fixed.
> MEDIUM items are organized into themed batches for focused sessions.

---

## Batching Plan for MEDIUM Items

Work through one batch per session. Start each session with:
"Fix MEDIUM batch N from `docs/superpowers/audit-remaining-items.md`"

| Batch | Theme | Items | Effort |
|---|---|---|---|
| **1** | Quick cross-cutting fixes | Loading states (4 modules), NaN on empty input (7 files), double-submit guard (ExpenseForm) | ~5 min each |
| **2** | Non-functional buttons | Remove or implement 6 dead buttons across modules | ~3 min each |
| **3** | Accounting fixes | Chart key collisions, weekly expense omission, VAT caveat, expense category mapping, ExpenseForm cleanup, calcTrend export | ~10 min each |
| **4** | Team constants + photo | Extract CONTRACT_LABELS/COLORS 3x duplication, StaffHeader photo rendering, PayoutForm date validation, useStaffCompensation `any` types | ~5 min each |
| **5** | DRY refactors | CategoriesTab duplication (Services vs Products), settings pages duplication | ~30 min |
| **6** | Remaining misc | Billing (stripe-webhook trial_ends_at, UpgradeModal hardcode, PlanCards trial button, TrialBanner fallback), Auth (ResetPasswordPage access), Shared (MediaQueryContext, PhoneInput, DateRangePicker, ClientForm, ClientDetails guard, client schemas, window.confirm) | ~5 min each |

---

## HIGH (0 remaining) — All Resolved

### ~~H-1: ClientDetails loads ALL salon appointments~~ RESOLVED
**Resolved:** 2026-04-08. Created `useClientAppointments(clientId)` hook with `WHERE client_id = $clientId` pushed to DB. Query key `['appointments', salonId, 'client', clientId]` — prefix-matched by existing invalidation. Removed `useAppointments()` from ClientDetails.

### ~~H-2: StaffProfileTab is 719 LOC — largest component~~ RESOLVED
**Resolved:** 2026-04-08. Split into 6 self-contained section components + shared helpers + thin orchestrator (51 LOC). Each editable section owns its own `editing`/`draft` state — eliminated fragile shared draft pattern.

### ~~H-3: useTransactions fetches ALL historical transactions~~ RESOLVED
**Resolved:** 2026-04-08. Added optional `{ from, to }` date range parameter to `useTransactions`. All 7 consumers now pass date ranges pushed to the DB query. POS uses 30-day window; Dashboard/Accounting use current+previous period; Team hooks use their own date range.

### ~~H-4: Accounting clientMetrics memo recomputes on every realtime event~~ RESOLVED
**Resolved:** 2026-04-08. Side effect of H-3 fix — `clientMetrics` now uses a `count_new_clients` DB RPC instead of scanning all transactions client-side. The useMemo no longer depends on the full unfiltered transaction list.

---

## MEDIUM (42 remaining)

### Cross-Cutting: Missing Loading States (4+ modules)
**Files:** `ClientsModule.tsx`, `ServicesModule.tsx`, `ProductsModule.tsx`, `AccountingExpenses`
**Issue:** `isLoading` from hooks is not consumed — modules show "Aucun X trouvé" (empty state) during initial fetch instead of a spinner/skeleton.
**Fix:** Render a loading skeleton when `isLoading` is true before rendering the list component.

### Cross-Cutting: Non-Functional UI Buttons (6 modules)
| Button | File | Issue |
|--------|------|-------|
| "Imprimer Ticket" | `AppointmentDetails.tsx:33` | No onClick |
| "Voir le profil" | `AppointmentDetails.tsx:91` | No onClick/routing |
| "Prendre RDV" | `ClientsModule.tsx:29` | handleSchedule is a no-op stub |
| "Email" receipt | `POSModals.tsx:368` | No onClick |
| "Imprimer" receipt | `POSModals.tsx:370` | No onClick |
| Filter/Search | `AccountingLedger.tsx:21-22` | No onClick (redundant with JournalPage controls) |
**Fix:** Either implement the feature or remove the button to avoid user confusion. For AccountingLedger, just remove the redundant buttons.

### Cross-Cutting: Hardcoded Calendar Hours
**Files:** `useStaffAvailability.ts:39,62` (9-20), `TodayCalendarCard.tsx:13` (9-23)
**Issue:** Available hours are hardcoded instead of reading from salon opening hours settings.
**Fix:** Read `salonSettings.schedule` and derive min/max hours from the salon's configured opening times.

### Cross-Cutting: Duplicated Category Management Code
**Files:** `modules/services/components/CategoriesTab.tsx` (255 LOC) vs `modules/products/components/ProductCategoriesTab.tsx` (248 LOC)
**Issue:** Structurally identical components with only type names differing. Also: `GeneralTab` vs `ProductGeneralTab`, `useServiceSettings` vs `useProductSettings`, `ServiceSettingsPage` vs `ProductSettingsPage`.
**Fix:** Extract a generic `<CategoriesManager<T>>` component or shared hook. Apply DRY to settings pages.

### Team: CONTRACT_LABELS/COLORS duplicated 3x
**Files:** `TeamCard.tsx:13-27`, `TeamTable.tsx:14-28`, `StaffProfileTab.tsx:91-97`
**Fix:** Extract to `modules/team/constants.ts`.

### Team: StaffHeader doesn't show uploaded photo
**File:** `modules/team/components/StaffHeader.tsx:57`
**Issue:** Always renders initials avatar from `staff.color`, never renders `staff.photoUrl`. Also `useStaffPhotoUpload` doesn't invalidate `['staff_member', salonId, slug]` query.
**Fix:** Add `<img>` rendering for `staff.photoUrl` in StaffHeader. Add broad query invalidation in `useStaffPhotoUpload`.

### Team: useStaffCompensation uses `any` types
**File:** `modules/team/hooks/useStaffCompensation.ts:29-38`
**Fix:** Type the filter/reduce callbacks with `Transaction` and `CartItem`.

### Team: PayoutForm silently swallows date validation failure
**File:** `modules/team/components/PayoutForm.tsx:45-47`
**Issue:** When `end < start`, form returns early with no error message shown.
**Fix:** Show inline error or use `min={start}` on end date input.

### Clients: ClientForm initializes read-only fields in form state
**File:** `modules/clients/components/ClientForm.tsx:64-66`
**Issue:** `totalVisits: 0, totalSpent: 0, createdAt: new Date().toISOString()` are server-computed but included in form state.
**Fix:** Remove from initial state; merge from `existingClient` in onSave for edit case.

### Clients: ClientDetails accesses preferredStaff.firstName[0] without guard
**File:** `modules/clients/components/ClientDetails.tsx:276`
**Fix:** Use `preferredStaff.firstName?.[0] ?? ''`.

### Clients: window.confirm for delete instead of design-system modal
**File:** `modules/clients/ClientsModule.tsx:34`
**Fix:** Replace with in-app confirmation modal (like `AppointmentDetails` pattern).

### Clients: schemas.ts only validates 4 of 25+ fields
**File:** `modules/clients/schemas.ts`
**Fix:** Extend schema to cover conditional fields (acquisitionSource/Detail, etc.).

### Services/Products: parseInt/parseFloat on empty input produces NaN
**Files:** `ServiceForm.tsx:125,134,142,152`, `ProductForm.tsx:103,111,134`
**Fix:** Add `|| 0` fallback on all numeric `parseInt`/`parseFloat` calls.

### Services/Products: CategoriesTab calls servicesForCategory twice per render row
**Files:** `CategoriesTab.tsx:148`, `ProductCategoriesTab.tsx:141`
**Fix:** Store result in a `const count` within the `.map()` callback.

### Services/Products: BrandsTab has no empty-name validation
**File:** `modules/products/components/BrandsTab.tsx:45-47`
**Fix:** Validate that all brand names are non-empty before saving.

### Services/Products: isLoading not consumed by module containers
**Files:** `ServicesModule.tsx`, `ProductsModule.tsx`
**Fix:** Show loading spinner when `isLoading` is true.

### Accounting: addExpense has no isPending guard (double-submit)
**File:** `modules/accounting/hooks/useAccounting.ts:52`, `ExpenseForm.tsx:59`
**Fix:** Export `isAddingExpense: addExpenseMutation.isPending`, disable submit button while pending.

### Accounting: ExpenseForm generates then discards crypto.randomUUID()
**Files:** `ExpenseForm.tsx:40`, `DepensesPage.tsx:25`
**Fix:** Change `onSave` prop type to `Omit<Expense, 'id'>`, remove id generation.

### Accounting: useAccounting mounts 5 extra hooks unconditionally
**File:** `modules/accounting/hooks/useAccounting.ts:30-33`
**Issue:** `useSettings()`, `useServices()`, `useProducts()`, `useTeam()` all fire on every accounting page, even when only the Journal tab is active.
**Fix:** Move service/product/team data into a `useRevenueBreakdown()` hook used only by RevenuesPage.

### Accounting: chartData daily bucket key omits year
**File:** `modules/accounting/hooks/useAccounting.ts:449-466`
**Issue:** Date ranges spanning a year boundary produce key collisions (e.g., "25 dec." from two years).
**Fix:** Include year in the daily key, or use `YYYY-MM-DD` as internal key.

### Accounting: DepensesRecurrentes monthly total omits weekly expenses
**File:** `modules/accounting/components/DepensesRecurrentes.tsx:31`
**Fix:** Normalize weekly to monthly (x4.33) and include in the monthly KPI.

### Accounting: VAT calculation applies single rate to all revenue
**File:** `modules/accounting/hooks/useAccounting.ts:123`
**Issue:** Single `vatRate` applied to 100% of revenue. Labelled "Estimée" but used for decisions.
**Fix:** Add prominent caveat or allow per-category VAT rates.

### Accounting: toExpense drops joined category data, components re-query
**File:** `modules/accounting/mappers.ts:24`
**Fix:** Map `categoryName`/`categoryColor` from joined data in `toExpense`, remove `useSettings` lookups from ExpenseTable/Card.

### Accounting: calcTrend exported as hook return value instead of named export
**File:** `modules/accounting/hooks/useAccounting.ts:501`
**Fix:** Export directly from module; import in RevenuesPage.

### Accounting: ExpenseForm category default empty on first render
**File:** `modules/accounting/components/ExpenseForm.tsx:26`
**Fix:** Add useEffect to set default category when `expenseCategories` first loads.

### Settings: AccountingSettings saves VAT on every keystroke
**File:** `modules/settings/components/AccountingSettings.tsx:76-79`
**Fix:** Use local state for VAT field, save only on blur or explicit save button.

### Billing: stripe-webhook doesn't clear trial_ends_at on checkout
**File:** `supabase/functions/stripe-webhook/index.ts:48-61`
**Fix:** Include `trial_ends_at: null` in the checkout.session.completed upsert.

### Billing: TrialBanner depends on subscription query — silent failure if query errors
**File:** `modules/billing/BillingModule.tsx:88`
**Fix:** Add fallback or independent loading state for trial banner.

### Billing: UpgradeModal hardcodes "10 membres"
**File:** `modules/billing/components/UpgradeModal.tsx:65`
**Fix:** Read from plan data instead of hardcoding.

### Billing: PlanCards trial→Free button confusing
**File:** `modules/billing/components/PlanCards.tsx:47-48`
**Fix:** Hide or explain the Free plan button for trial users.

### Shared: Password reset accessible to logged-in users without RECOVERY session
**File:** `pages/ResetPasswordPage.tsx`
**Issue:** Any logged-in user can navigate to `/reset-password` and change password without current-password verification.
**Fix:** Check auth event is `PASSWORD_RECOVERY` before showing the form, or redirect non-recovery users.

### Shared: MediaQueryContext module-level mutable cachedState
**File:** `context/MediaQueryContext.tsx:32-41`
**Issue:** Shared global state could cause issues with HMR or multiple providers.
**Fix:** Move state into the provider component or use a proper store.

### Shared: PhoneInput inconsistent format between keyboard and numpad
**File:** `components/PhoneInput.tsx:114-117`
**Issue:** Keyboard entry allows spaces, numpad doesn't — inconsistent DB values.
**Fix:** Strip spaces from both entry paths, or format consistently.

### Shared: DateRangePicker presets mutate `now`
**File:** `components/DateRangePicker.tsx:44-47`
**Issue:** `now.setHours()` mutates in place — fragile if property order changes.
**Fix:** Use `new Date(now)` copy before mutating.

---

## LOW (27 remaining)

### Appointment Module
- `AppointmentDetails` grouped services index limited to 5 (hardcoded unicode digits)
- Hardcoded hours 9-20 in `useStaffAvailability` (M6 from original audit)

### POS Module
- Payment method labels as data keys (design debt — French strings flow through pipeline)
- Payment time shows current time, not actual payment time

### Team Module
- TeamTable/TeamCard "Total" count includes all-time appointments (not time-scoped)
- useStaffDetail archiveMutation doesn't invalidate detail query key
- useStaffPhotoUpload uses Date.now() for cache-busting (should use crypto.randomUUID())

### Clients Module
- ClientCard action buttons lack aria-label
- ClientList search doesn't debounce
- handleSchedule is a no-op stub

### Services Module
- ServiceSettingsPage tab rendering uses ternary instead of data-driven pattern

### Products Module
- IconPicker not used for product categories (no icon support)
- Unused category insert mappers (dead code)
- ProductForm carries vestigial `supplier` display string in form state

### Billing Module
- expire-trials processes trials serially (no batch update)
- toExpenseCategoryInsert `id: cat.id || undefined` misleading

### Shared Layer
- AcceptInvitationPage raw Edge Function error exposed in UI
- useAvatarUpload file extension from filename, not MIME type
- CLAUDE.md documents HashRouter but code uses BrowserRouter (fixed in CLAUDE.md, ErrorBoundary link fixed — but worth checking all `#/` references)
