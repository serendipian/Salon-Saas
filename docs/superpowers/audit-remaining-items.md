# Codebase Audit — Remaining Items

> Regenerated 2026-04-10 after full audit session covering:
> - Recently added Equipe & Permissions settings tab
> - Accounting expense edit/delete flow
> - Multi-item service blocks in appointment builder
> - Pack / favorites integration
> - Re-verification of the 19 MEDIUM items from the 2026-04-08 audit
>
> Severity ratings are calibrated against real impact: CRITICAL = active data loss/corruption or security hole; HIGH = broken functionality users will hit; MEDIUM = degraded UX or code-quality risk; LOW = polish / defensive improvements.

---

## Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 remaining (11 fixed, 2 invalid) | All HIGH cleared 2026-04-10 |
| MEDIUM | 6 remaining (22 fixed) | Polish queue |
| LOW | 21 | Polish queue (1 fixed in M-14) |

**Of the 19 previously-documented MEDIUM items:** 1 RESOLVED (pre-batch), 1 PARTIAL, 17 still apply.

**Batch A completed 2026-04-10:** H-2, H-7, H-9, H-10, H-13 fixed. H-6 investigated and marked invalid.
**Batch B completed 2026-04-10:** H-4, H-8 fixed via new shared `<Modal>` + `<ConfirmModal>` components. M-1, M-2, M-3, M-4, M-17 fixed alongside.
**Batch C completed 2026-04-10:** H-3, M-21, M-22 fixed via migration `20260410100000_favorites_concurrency_and_pack_groups_check.sql`, applied to remote. H-5 investigated and marked invalid.
**Batch D completed 2026-04-10:** H-1 fixed by removing the dead custom-supplier UI path; H-11 fixed by adding a timezone mismatch warning to the Profile page. H-12 also shipped (60s tolerance window for edit-mode merge), clearing all remaining HIGH items.
**Batch E completed 2026-04-10:** Accounting cleanup. M-5, M-6, M-7, M-8, M-9, M-10, M-12 all fixed. M-9 extracted `useRevenueBreakdown` into a dedicated hook so the 3 heavy hooks (`useServices`, `useProducts`, `useTeam`) only mount on the Vue d'ensemble and Revenus tabs — Dépenses, Journal, and Annulations no longer pay that cost.
**Batch F completed 2026-04-10:** Appointments + packs/favorites polish. M-13 (calendar multi-item grouping via `mergeAppointmentGroups`), M-14, M-15, M-16, M-18, M-19, M-20, M-23 all fixed. Also picked up the L-10 aria-label as a drive-by during M-14.

---

## CRITICAL (0)

No critical issues found. The codebase has no silent data corruption, no security holes, and no production-blocking bugs in the audited surfaces.

---

## HIGH (13)

### ~~H-1: ExpenseForm custom-supplier text path is dead code~~ RESOLVED (2026-04-10)
**Files:** `modules/accounting/components/ExpenseForm.tsx:66-78,86-128,313-336`
**Resolved:** Removed the entire custom-supplier UI path (Option B from the audit recommendation). `isCustomSupplier` state is gone, the `__OTHER__` Select option and the conditional text input are gone, and `formData.supplierId` is now the single source of truth (was previously `formData.supplier` storing either an ID or a name depending on mode — also fixed a latent bug where the Select would show no selection on edit because the supplier name didn't match the option's ID value). `handleSubmit` now looks up the supplier by ID and passes both `supplier` (name, for optimistic UI) and `supplierId` to the mutation. Added a helper-text line under the Bénéficiaire field directing users to create new suppliers in the Fournisseurs module.

### ~~H-2: Edit-mode variant fallback produces empty `variantId` when no match~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:40-134`
**Resolved:** The loop now skips appointments whose service or variant cannot be resolved, increments an `unresolvedCount`, and shows a warning toast once per load. Also breaks the merge chain at a hole so partially-loaded groups don't incorrectly merge appointments across the gap.

### ~~H-3: `toggle_favorite` RPC races on concurrent toggles~~ RESOLVED (2026-04-10)
**File:** `supabase/migrations/20260410100000_favorites_concurrency_and_pack_groups_check.sql:36-110`
**Resolved:** New migration recreates `toggle_favorite` with `pg_advisory_xact_lock(729346, hashtext(p_salon_id::text))` at function entry. Lock namespace is shared with `reorder_favorites` (M-21) so toggles and reorders serialize within a salon but not across salons. Transaction-scoped so it auto-releases — no explicit unlock needed. **Pending `npx supabase db push`.**

### ~~H-4: Expense delete confirmation uses `window.confirm`~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/components/ExpenseForm.tsx:82,400-415`
**Resolved:** Replaced `window.confirm` with the new shared `<ConfirmModal>` component. Delete button is now disabled during any pending mutation. Same-design-system modal, accessible, dismissible only when not loading.

### ~~H-5: Pack hard-delete orphans `appointments.pack_id`~~ INVALID (2026-04-10)
**File:** `modules/services/hooks/usePacks.ts:125-143`
**Investigated and dismissed:** The `appointments` table has **no `pack_id` column** — confirmed against `lib/database.types.ts` (only `pack_items.pack_id` exists, which cascades on pack delete). `ServiceBlockState.packId` in `modules/appointments/hooks/useAppointmentForm.ts` is a UI-only field used during appointment construction and is NOT persisted; the save flattening at line 430-448 drops it. The hard-delete design is safe by construction: `pack_items` cascades, no live references exist elsewhere, and the audit trigger captures the row on delete. The audit agent incorrectly assumed a schema that doesn't exist.

### ~~H-6: Expense delete — ledger/charts stale~~ INVALID (2026-04-10)
**File:** `modules/accounting/hooks/useAccounting.ts:125-140,461-489`
**Investigated and dismissed:** `ledgerData` and `chartData` are `useMemo`-derived from `data.current.expenses` / `data.current.transactions`, which themselves come from the `['expenses', salonId]` / `['transactions', salonId, ...]` base queries. There is no separate `['ledger', ...]` or `['chart', ...]` query key. Invalidating `['expenses', salonId]` refetches, the hook re-runs, the memos recompute. No stale window. The original audit agent mistook derived memoization for a separate cache.

### ~~H-7: Role-change mutation doesn't invalidate `staff_members`~~ RESOLVED (2026-04-10)
**File:** `modules/settings/hooks/useTeamSettings.ts:101-107`
**Resolved:** Added `queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] })` in `changeRoleMutation.onSuccess`. Prefix match cascades to `useTeam`'s `['staff_members', salonId, { includeArchived }]` key.

### ~~H-8: Settings modals missing focus trap + aria-modal~~ RESOLVED (2026-04-10)
**Files:** `components/Modal.tsx` (new), `components/ConfirmModal.tsx` (new), `modules/settings/components/RevokeAccessModal.tsx`, `TransferOwnershipModal.tsx`
**Resolved:** Extracted a shared accessible `<Modal>` component with focus trap, Escape-to-close, backdrop click, body scroll lock, and `inert` on main content (same a11y pattern as `MobileDrawer`). Built `<ConfirmModal>` on top with danger/warning/info tones. Refactored both settings modals to use the new wrapper. `RevokeAccessModal` is now a 20-line wrapper around `ConfirmModal`; `TransferOwnershipModal` uses `Modal` directly for its form-like body.

### ~~H-9: Settings `useTeamSettings` query response cast as `any`~~ RESOLVED (2026-04-10)
**File:** `modules/settings/hooks/useTeamSettings.ts:48-82`
**Resolved:** Replaced `any` with a typed `JoinedRow` local type, added explicit `Promise<MemberRow[]>` return type, and disambiguated the `profiles` join via the explicit FK name `salon_memberships_profile_id_fkey` (previously PostgREST errored on ambiguous relationship). Single `as unknown as` remains at the Supabase response boundary because PostgREST's inferred type differs from the runtime shape after embed normalization.

### ~~H-10: InvitationsTab expiration days hardcoded~~ RESOLVED (2026-04-10)
**File:** `modules/settings/hooks/useTeamSettings.ts:7`, `modules/settings/components/InvitationsTab.tsx:3,112`
**Resolved:** Exported `INVITATION_EXPIRY_DAYS = 7` from `useTeamSettings`. Both the create mutation (line 144) and the UI copy (`InvitationsTab.tsx`) now import and use the constant.

### ~~H-11: Save-flattening uses local timezone before UTC serialization~~ MITIGATED (2026-04-10)
**File:** `pages/profile/ProfileSalonRole.tsx:42-60,81-94`
**Mitigated (Option A from audit recommendation):** Picked the documentation-and-warning path rather than reworking the time storage model (which would have been a week of work for a hypothetical use case — single-location salons today). Added a timezone-mismatch detection in `ProfileSalonRole`: compares `Intl.DateTimeFormat().resolvedOptions().timeZone` against `activeSalon.timezone` and shows an amber warning card with both zones + their offsets when they differ. Catches the real failure mode (owner traveling abroad) without invasive code changes. The underlying flatten-then-serialize behavior in `useAppointmentForm.ts:430-448` is unchanged — if you ever need true multi-timezone support, that's the place to revisit.

### ~~H-12: Edit-mode merge requires exact millisecond contiguity~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:56-95`
**Resolved:** Replaced strict `.getTime() === .getTime()` equality with a 60-second tolerance window: `Math.abs(currentCursorEnd.getTime() - apptStart.getTime()) <= MERGE_TOLERANCE_MS`. 60s is well below the smallest realistic appointment duration so it can't accidentally bridge a real gap. Handles DST crossings, manual DB time edits, and any sub-minute drift.

### ~~H-13: Unsafe `any` types in `useStaffCompensation`~~ RESOLVED (2026-04-10)
**File:** `modules/team/hooks/useStaffCompensation.ts:3,30-37`
**Resolved:** Imported `Transaction` and `CartItem` from `types.ts`; typed all reduce/filter callbacks.

---

## MEDIUM (28)

### Equipe & Permissions Settings

#### ~~M-1: Revoke membership — no refresh on self-revoke~~ RESOLVED (2026-04-10)
**File:** `modules/settings/hooks/useTeamSettings.ts:44,111-131`
**Resolved:** `revokeMutation` now returns the revoked membership ID; `onSuccess` checks it against the current user's membership and triggers `window.location.reload()` if they just revoked themselves. Also added `['staff_members', salonId]` invalidation. `MembersTab.canRevoke` still blocks the UI path today, so this is defensive.

#### ~~M-2: TransferOwnershipModal — empty eligible list~~ RESOLVED (2026-04-10)
**File:** `modules/settings/components/TransferOwnershipModal.tsx:21-43`
**Resolved:** Modal now branches on `eligibleMembers.length === 0` and shows an explanatory message ("Aucun membre éligible pour le transfert. Invitez d'abord un autre manager ou styliste actif, puis réessayez.") with a single "Fermer" button.

#### ~~M-3: Clipboard copy lacks try/catch~~ RESOLVED (2026-04-10)
**File:** `modules/settings/components/InvitationsTab.tsx:62-76`
**Resolved:** Wrapped `navigator.clipboard.writeText` in try/catch. On failure, shows an error toast ("Impossible de copier le lien. Copiez-le manuellement depuis le champ.") and leaves `copied` false. `setCopied(true)` + timeout only run on success.

#### ~~M-4: Handle async errors in InvitationsTab.handleCreate~~ RESOLVED (2026-04-10)
**File:** `modules/settings/components/InvitationsTab.tsx:48-60`
**Resolved:** `handleCreate` now wraps `onCreate(selectedRole)` in try/catch. The mutation's `onError` still toasts via `useMutationToast`, but the component-level catch ensures the `generatedLink` UI only appears on success and unhandled rejections don't leak.

### Accounting — Expense Flow

#### ~~M-5: ExpenseForm: no double-submit guard~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/components/ExpenseForm.tsx:107-115,387-396`
**Resolved:** Both Save and Delete buttons already disable on `isPending` (the combined add/update/delete flag from `DepensesPage.tsx:49`). Added an early-return guard at the top of `handleSubmit` (`if (isPending) return;`) as a belt-and-braces against rapid double-clicks where a click queued before the next render slips through. The Delete button uses `disabled:pointer-events-none` from Batch B's H-4 fix.

#### ~~M-6: ExpenseForm dead category fallback~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/components/ExpenseForm.tsx:118`
**Resolved:** The `(formData.category || expenseCategories[0]?.id)` fallback was already removed during the H-1 refactor in Batch D — `handleSubmit` now writes `formData.category as ExpenseCategory` directly. Dead defensive code is gone; Zod schema enforces required.

#### ~~M-7: `toExpense` drops joined category data~~ RESOLVED (2026-04-10)
**Files:** `modules/accounting/mappers.ts:25-39`, `types.ts:466-477`, `ExpenseTable.tsx`, `ExpenseCard.tsx`
**Resolved:** Added optional `categoryName` and `categoryColor` to the `Expense` type. `toExpense` now maps both from `row.expense_categories`. `ExpenseTable` and `ExpenseCard` no longer call `useSettings` — they read directly from the expense fields with a `'Autre' / 'bg-slate-100 text-slate-700'` fallback.

#### ~~M-8: ExpenseForm category default empty on first render~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/components/ExpenseForm.tsx:80-89`
**Resolved:** Added a `useEffect` that pre-selects the first category once `expenseCategories` loads on a brand-new form (skipped on edit and when a category is already set). User no longer sees an empty form with no pre-selection.

#### ~~M-9: `useAccounting` mounts heavy hooks unconditionally~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/hooks/useRevenueBreakdown.ts` (new), `useAccounting.ts` (slimmed)
**Resolved:** Extracted `useRevenueBreakdown(currentTransactions, prevTransactions)` into its own hook. It calls `useServices`, `useProducts`, and `useTeam` internally and returns all the breakdown shapes (`revenueByServiceCategory`, `revenueByProductCategory`, `revenueByStaffServices`, `revenueByStaffProducts`, `serviceRevenue`, `productRevenue`, `prevServiceRevenue`, `prevProductRevenue`, `paymentMethodBreakdown`, `topProducts`). Only `RevenuesPage` and `FinancesOverview` call it. `DepensesPage`, `JournalPage`, and `RefundsPage` no longer mount the 3 heavy hooks. `useAccounting` keeps `useSettings` for `salonSettings.vatRate` (light hook, needed for `financials`).

#### ~~M-10: `DepensesRecurrentes` monthly KPI omits weekly expenses~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/components/DepensesRecurrentes.tsx:63-74`
**Resolved:** `monthlyTotal` now folds weekly recurring expenses into the total via `WEEKS_PER_MONTH = 52 / 12` (4.333…). Mensuel rows are added at face value, Hebdomadaire rows are normalized via the multiplier. Annuel rows still excluded from the monthly KPI by design (they have their own KPI tile).

#### M-11: Single VAT rate applied to 100% of revenue [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/hooks/useAccounting.ts:195`
**Issue:** `vatDue = revenue - revenue / (1 + taxRate)` applies one rate to all revenue. Labeled "Estimée" but used for business decisions.
**Fix:** Add a prominent caveat or allow per-category VAT rates.

#### ~~M-12: `calcTrend` not exported as named export~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/hooks/useAccounting.ts:18`, `modules/accounting/components/RevenuesPage.tsx:7`
**Resolved:** Added `export` keyword to the module-level `calcTrend` definition. `RevenuesPage` now imports it directly: `import { calcTrend } from '../hooks/useAccounting';` and no longer pulls it from outletContext. Removed from the hook's return shape.

### Appointments — Multi-Item Blocks

#### ~~M-13: Calendar renders multi-item blocks as separate rows~~ RESOLVED (2026-04-10)
**Files:** `modules/appointments/components/calendarUtils.ts:9-79` (new `mergeAppointmentGroups`), `CalendarDayView.tsx:25-29`, `CalendarWeekView.tsx:84-87`, `CalendarMonthView.tsx:60-65,84`
**Resolved:** Added `mergeAppointmentGroups()` helper that folds same-`groupId` appointments into a single synthetic `Appointment` per group with summed `durationMinutes`/`price`, an "N prestations · A, B, C" service label, and a derived status (COMPLETED if all are; CANCELLED if any is; etc.). The merged event keeps the first sub-appointment's `id` so the existing click → edit/details routing still works (the edit page already resolves the full group from any member id via `groupId`). Applied in all three calendar views (Day, Week, Month) before the layout/sort step. The popover still shows only the first sub-appointment's metadata, but the new `serviceName` label includes all the sibling services so the user immediately sees "3 prestations · Coupe, Brushing, Coloration".

#### ~~M-14: AppointmentSummary can render empty blocks~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/components/AppointmentSummary.tsx:39-46,72`
**Resolved:** Pre-filters `serviceBlocks` into `populatedBlocks` (items.length > 0) and uses that for both the early-return check and the rendering loop. Also added `aria-label={`Prestation ${i + 1}`}` to the numbered circle badges (drive-by pickup of L-10).

#### ~~M-15: Pack-block ID regenerated on every edit-mode load~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:90-97`
**Resolved:** Replaced `crypto.randomUUID()` with `\`block-${appt.id}\`` (where `appt` is the first appointment in the merge group). Reloading the edit page now yields stable block IDs. Cleaner debugger breadcrumbs and any future state-reconciliation logic that compares blocks by id will work correctly.

#### ~~M-16: Mobile picker over-disables pills when locked~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/components/MobileServicePicker.tsx:56-69`
**Resolved:** `isCategoryPillDisabled` now mirrors desktop `ServiceBlock` behavior — when locked, the user can still tap the locked category itself OR the Favoris pill (favorites disable cross-category items individually via `disabledByLock`, so the tab is safe to enter). All other category pills and the Packs pill stay disabled.

#### ~~M-17: Cross-category swap silently rejected~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/hooks/useAppointmentForm.ts:18,218-244`
**Resolved:** `toggleBlockItem` now pre-computes the cross-category rejection outside the state updater (keeping the reducer pure) and emits `addToast({ type: 'warning', message: 'Impossible de mélanger les catégories dans un même créneau.' })` before returning. The in-reducer check is kept as a belt-and-braces defensive guard.

#### ~~M-18: `getBlockPrice` silently returns 0 on missing data~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/hooks/useAppointmentForm.ts:128-144,477-489`
**Resolved:** Added `blockHasMissingItems(block, services)` helper that returns true if any item references a deleted service or variant. `handleSubmit` now calls it across all blocks before flattening; if any are missing it shows an error toast (`"Une prestation référence un service ou une variante supprimé. Retirez-la avant de sauvegarder."`) and aborts. Took the less-invasive path — kept `getBlockPrice` returning a number so the existing UI sums work unchanged, and added the validation as a separate save-time guard.

#### ~~M-19: Pack toggle-off loses date~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/hooks/useAppointmentForm.ts:343-373`
**Resolved:** When toggling a pack off, the cleared first-pack-block now keeps its `date` field (`carryDate`) instead of being wiped to null. Hour is still dropped because the next service the user picks will have a different duration, so the prior end-time slot is no longer meaningful.

### Packs / Favorites

#### ~~M-20: FavoritesTab doesn't revert `localOrder` on RPC error~~ RESOLVED (2026-04-10)
**Files:** `modules/services/hooks/useServices.ts:292-293`, `modules/services/components/FavoritesTab.tsx:40-58`
**Resolved:** Switched the `reorderFavorites` wrapper from `mutate` to `mutateAsync` so the consumer can await the result. `handleSaveOrder` is now async and wraps the call in try/catch — on success the existing query invalidation + the `useEffect` at line 24 sync `localOrder` back to canonical state; on failure the catch block resets `localOrder` to `allFavorites` (the last-known server order). The mutation's `onError` still toasts via `useMutationToast`.

#### ~~M-21: `reorder_favorites` RPC interleaves on concurrent reorders~~ RESOLVED (2026-04-10)
**File:** `supabase/migrations/20260410100000_favorites_concurrency_and_pack_groups_check.sql:116-157`
**Resolved:** Same advisory lock as H-3 — `pg_advisory_xact_lock(729346, hashtext(p_salon_id::text))` at function entry. Sharing the namespace with `toggle_favorite` means a reorder in progress blocks concurrent toggles and vice versa, so no interleaving can occur within a salon. **Pending `npx supabase db push`.**

#### ~~M-22: `pack_groups` missing date-range CHECK constraint~~ RESOLVED (2026-04-10)
**File:** `supabase/migrations/20260410100000_favorites_concurrency_and_pack_groups_check.sql:163-181`
**Resolved:** Migration adds `CONSTRAINT pack_groups_dates_chk CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)`. A pre-ALTER `UPDATE` swaps any existing inverted rows (should be none in practice since the UI validates, but the belt-and-braces fix avoids aborting the migration on dirty data). **Pending `npx supabase db push`.**

#### ~~M-23: PackForm over-cost warning is informational only~~ RESOLVED (2026-04-10)
**File:** `modules/services/components/PackForm.tsx:64-72,84-103,189-194,304-312`
**Resolved:** Added `isOverCost` computed flag (`priceNum > 0 && totalOriginal > 0 && priceNum >= totalOriginal`). The Save button is now `disabled` when `isOverCost`, with a tooltip explaining why. `handleSubmit` also early-returns on `isOverCost` as a belt-and-braces. The warning text is now red instead of amber and reads "Le prix du pack doit être inférieur au prix total des services" — making the constraint clear instead of just suggestive.

### Team / Clients / Shared (carried from 2026-04-08)

#### M-24: Hardcoded calendar hours 9-20 / 9-23 [STILL APPLIES]
**Files:** `modules/appointments/hooks/useStaffAvailability.ts:38,62` (9-20), `modules/dashboard/components/TodayCalendarCard.tsx:13` (9-23)
**Fix:** Derive from `salonSettings.schedule` min/max.

#### M-25: Duplicated category management (Services vs Products) [STILL APPLIES]
**Files:** `modules/services/components/CategoriesTab.tsx` (258 LOC) vs `modules/products/components/ProductCategoriesTab.tsx` (251 LOC). Also `GeneralTab` vs `ProductGeneralTab`, `useServiceSettings` vs `useProductSettings`, `ServiceSettingsPage` vs `ProductSettingsPage`.
**Fix:** Extract `<CategoriesManager<T>>` generic.

#### M-26: `ClientForm` initializes server-computed fields in form state [STILL APPLIES]
**File:** `modules/clients/components/ClientForm.tsx:63-65`
**Issue:** `totalVisits: 0, totalSpent: 0, createdAt: new Date().toISOString()` are server-computed but included in form state.
**Fix:** Remove from initial state; merge from `existingClient` in onSave for edit.

#### M-27: `ClientsModule` delete uses `window.confirm` [STILL APPLIES]
**File:** `modules/clients/ClientsModule.tsx:42`
**Fix:** Replace with in-app modal.

#### M-28: `clients/schemas.ts` validates 4 of 25+ fields [STILL APPLIES]
**File:** `modules/clients/schemas.ts`
**Fix:** Extend schema to cover all fields.

---

## LOW (22)

### Equipe & Permissions

- **L-1:** `MembersTab.tsx:100` — hardcoded "(vous)" label not extracted to constant.
- **L-2:** `MembersTab.tsx:116-118` — `<option key={r} value={r}>` reuses value as key (technically valid but fragile if options are ever not unique).
- **L-3:** `TransferOwnershipModal.tsx:78-85` — disabled button lacks `disabled:pointer-events-none`; visual feedback subtle during mutation.

### Accounting

- **L-4:** `ExpenseForm.tsx:198-206` — amount `<input type="number">` accepts negative values until Zod catches it at submit; add `min="0" step="0.01"`.
- **L-5:** `ExpenseForm.tsx:277` — `accept="…image/gif"` not in `ACCEPTED_TYPES` at line 38; file picker allows selection that's rejected after.
- **L-6:** `ExpenseForm.tsx:316-343` — supplier dropdown shows nothing while `useSuppliers()` is loading; add a loading placeholder.
- **L-7:** `schemas.ts` date field — only required-check, no range validation (future dates accepted).
- **L-8:** Deleted-category rows fall back to "Autre" label (`useAccounting.ts:73` SELECT + UI lookup) — historical accuracy loss.

### Appointments / Multi-Item Blocks

- **L-9:** `useAppointmentForm.ts:367` — `return 'Service'` hardcoded English; should be `'Prestation'`.
- **L-10:** `AppointmentSummary.tsx:80` — numbered circle badges have no `aria-label`.
- **L-11:** `ServiceBlock.tsx:82-88` — `isPillAllowedWhenLocked` permits FAVORITES even when `favorites.length === 0`, producing an empty grid.
- **L-12:** `ServiceBlock.tsx:133-140` — `blockDuration` range calc lacks `> 0` guard (defensive).
- **L-13:** `ServiceBlock.tsx:219-293` — category pill row wraps on narrow screens, "Vider" button can break alignment with long category names.
- **L-14:** `AppointmentEditPage.tsx:62-68` — variant price+duration fallback can pick the wrong variant if two have identical price/duration.
- **L-15:** `AppointmentDetails` — grouped-services index limited to 5 hardcoded unicode digits [from 2026-04-08].

### Packs / Favorites

- **L-16:** `packs.deleted_at` column exists but packs are hard-deleted — dead column + dead index.
- **L-17:** `PackGroupForm` uses inline validation instead of Zod + `useFormValidation` (inconsistent with codebase pattern).
- **L-18:** `toggle_favorite` RPC returns success silently if `p_type` is invalid-but-matches-one-of-the-fallthrough-cases — verify the ELSE path always raises.
- **L-19:** `favorite_sort_order` is INTEGER; no overflow protection (theoretical — would take millions of toggles).

### Team / Clients / Billing / Shared (carried)

- **L-20:** `MediaQueryContext.tsx:32-41` — module-level `let cachedState` mutable global [STILL APPLIES].
- **L-21:** `PhoneInput.tsx:114-130` — keyboard input allows spaces (`/[^0-9\s]/g`), numpad doesn't — inconsistent DB values [STILL APPLIES].
- **L-22:** `CONTRACT_COLORS` still duplicated in `TeamCard.tsx:21-27` only (labels were extracted to `profile-shared.tsx:72-78`) [PARTIAL from 2026-04-08].

### Billing (carried from 2026-04-08, still apply)

- `BillingModule.tsx:85-91` — TrialBanner silent failure on subscription query error.
- `UpgradeModal.tsx:8,65` — hardcodes "10 membres"; should read from plan data.
- `PlanCards.tsx:48,105` — trial→Free button labeled "Choisir Free →" is confusing (Free is a downgrade from trial).

---

## Re-verification Results — 19 Previously MEDIUM Items

From the 2026-04-08 audit:

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Hardcoded calendar hours | **STILL APPLIES** | Now M-24 |
| 2 | Duplicated category management | **STILL APPLIES** | Now M-25 |
| 3 | CONTRACT_LABELS/COLORS 3x | **PARTIAL** | Labels extracted to `profile-shared.tsx:72-78`; COLORS still in `TeamCard.tsx:21-27`. Now L-22 |
| 4 | StaffHeader doesn't show photo | **RESOLVED** | `StaffHeader.tsx:61-66` now delegates to `StaffAvatar` component; `useStaffPhotoUpload` invalidates `['staff_members', salonId]` |
| 5 | useStaffCompensation `any` types | **STILL APPLIES** | Now H-13 (bumped — carried long enough) |
| 6 | ClientForm read-only fields in state | **STILL APPLIES** | Now M-26 |
| 7 | Clients window.confirm | **STILL APPLIES** | Now M-27 |
| 8 | Clients schemas.ts partial | **STILL APPLIES** | Now M-28 |
| 9 | useAccounting 5 hooks unconditional | **STILL APPLIES** | Now M-9 |
| 10 | DepensesRecurrentes omits weekly | **STILL APPLIES** | Now M-10 |
| 11 | VAT single-rate caveat | **STILL APPLIES** | Now M-11 |
| 12 | toExpense drops joined category data | **STILL APPLIES** | Now M-7 |
| 13 | calcTrend hook return value | **STILL APPLIES** | Now M-12 |
| 14 | ExpenseForm category default empty | **STILL APPLIES** | Now M-8 |
| 15 | TrialBanner silent failure | **STILL APPLIES** | LOW (billing carry) |
| 16 | UpgradeModal "10 membres" hardcoded | **STILL APPLIES** | LOW (billing carry) |
| 17 | PlanCards trial→Free confusing | **STILL APPLIES** | LOW (billing carry) |
| 18 | MediaQueryContext mutable cachedState | **STILL APPLIES** | Now L-20 |
| 19 | PhoneInput keyboard vs numpad | **STILL APPLIES** | Now L-21 |

**Net:** 1 resolved, 1 partial, 17 still apply (1 bumped to HIGH).

---

## Recommended Work Order

1. **Sprint this week:** H-1 (dead supplier path), H-3 (RPC race), H-5 (pack orphans), H-11 (timezone — document first), H-7 (role invalidation)
2. **Next sprint:** Remaining HIGH items + M-1 through M-8
3. **Polish batch:** M-24 through M-28 (carried-over UX) + LOW items

## Claims Investigated and Rejected

A few findings surfaced by parallel audit agents were investigated and **determined to not be bugs**:

- ~~"Pack with mixed categories breaks block invariant"~~ — `useAppointmentForm.ts:219` makes pack blocks atomic (`if (b.packId) return b;`). Users cannot add items to pack blocks via `toggleBlockItem`, so each pack block stays exactly as applied. Invariant holds.
- ~~"Missing supplier update in update mutation"~~ — the DB has no supplier text column, so there is no text to update. The real bug is that the form maintains a text state that never persists (captured as H-1).
- ~~"Stale closure in `activeBlock` derivation"~~ — the derivation `serviceBlocks[activeBlockIndex]` is computed inline in render, not inside a `useCallback`/`useMemo` closure; the concern was speculative.
- ~~"Form category silently defaults to first category"~~ — Zod schema enforces `min(1)` on category; the fallback in `handleSubmit` is unreachable dead code (captured as M-6 for cleanup, not a bug).
- ~~"Expense delete invalidates only `['expenses']`, leaving ledger/charts stale"~~ (H-6) — `ledgerData` and `chartData` are `useMemo` derivatives of the base expenses query, not separate cache entries. Invalidating the base query already propagates via re-derivation.
- ~~"Pack hard-delete orphans `appointments.pack_id`"~~ (H-5) — `appointments` has no `pack_id` column. `ServiceBlockState.packId` is a UI-only field dropped at save time. No orphan possible.
