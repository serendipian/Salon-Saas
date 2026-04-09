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
| HIGH | 5 remaining (7 fixed, 1 invalid) | Batches A+B shipped 2026-04-10 |
| MEDIUM | 23 remaining (5 fixed) | Batch work |
| LOW | 22 | Polish queue |

**Of the 19 previously-documented MEDIUM items:** 1 RESOLVED (pre-batch), 1 PARTIAL, 17 still apply.

**Batch A completed 2026-04-10:** H-2, H-7, H-9, H-10, H-13 fixed. H-6 investigated and marked invalid.
**Batch B completed 2026-04-10:** H-4, H-8 fixed via new shared `<Modal>` + `<ConfirmModal>` components. M-1, M-2, M-3, M-4, M-17 fixed alongside.

---

## CRITICAL (0)

No critical issues found. The codebase has no silent data corruption, no security holes, and no production-blocking bugs in the audited surfaces.

---

## HIGH (13)

### H-1: ExpenseForm custom-supplier text path is dead code — custom names never persist
**Files:** `modules/accounting/components/ExpenseForm.tsx:75-77,102-111`; `modules/accounting/mappers.ts:6-52`
**Issue:** The `expenses` table schema only has `supplier_id` (FK) — there is no `supplier` text column. `toExpense` reads `suppliers?.name` from the join, `toExpenseInsert` only writes `supplier_id`, and `updateExpenseMutation` (`useAccounting.ts:101-123`) only updates `supplier_id`. Meanwhile the form maintains `isCustomSupplier` state and a `formData.supplier` text field as if ad-hoc supplier names were stored. When a user types a custom supplier name, nothing is persisted — on reload the field is empty. This has been latent for at least one release.
**Fix:** Either add a `supplier_text` nullable column and wire it through mapper/insert/update, or remove the entire custom-supplier UI path and require selection from the pre-defined suppliers list.

### ~~H-2: Edit-mode variant fallback produces empty `variantId` when no match~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:40-134`
**Resolved:** The loop now skips appointments whose service or variant cannot be resolved, increments an `unresolvedCount`, and shows a warning toast once per load. Also breaks the merge chain at a hole so partially-loaded groups don't incorrectly merge appointments across the gap.

### H-3: `toggle_favorite` RPC still races on concurrent toggles
**File:** `supabase/migrations/20260409200000_toggle_favorite_rpc.sql:53-66`
**Issue:** The RPC was added to fix sort-order collisions between services/variants/packs, but it still computes `MAX(favorite_sort_order) + 1` in a SELECT and then UPDATEs the target row. Nothing locks the three tables between SELECT and UPDATE. Two concurrent transactions (e.g., owner + manager rapid-click) can both see the same MAX, compute the same `v_next`, and both write it — reintroducing the exact collision the RPC was meant to prevent. No unique constraint enforces uniqueness.
**Fix:** Take a per-salon advisory lock at function entry: `PERFORM pg_advisory_xact_lock(hashtext('fav_order_' || p_salon_id::text));`. Alternative: add a `favorite_sort_order_seq` sequence per salon.

### ~~H-4: Expense delete confirmation uses `window.confirm`~~ RESOLVED (2026-04-10)
**File:** `modules/accounting/components/ExpenseForm.tsx:82,400-415`
**Resolved:** Replaced `window.confirm` with the new shared `<ConfirmModal>` component. Delete button is now disabled during any pending mutation. Same-design-system modal, accessible, dismissible only when not loading.

### H-5: Pack hard-delete orphans `appointments.pack_id` references silently
**File:** `modules/services/hooks/usePacks.ts` (delete mutation) + migration `20260409190000_cleanup_soft_deleted_packs.sql`
**Issue:** Commit `c898f3a` switched pack deletion from soft to hard delete with confirmation. Appointments that reference the deleted pack retain a dangling `pack_id`, breaking historical "Pack Promo" tag rendering and appointment audit trails. The delete confirmation does not check or warn about active references.
**Fix:** Pre-query `appointments` for live `pack_id` references and warn in the confirmation: `"Ce pack est utilisé dans N rendez-vous. La suppression est définitive."` Consider reverting to soft-delete with `deleted_at` to preserve referential integrity, or add `ON DELETE SET NULL` to the FK.

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

### H-11: `useAppointmentForm` save-flattening uses local-timezone Date construction before UTC serialization
**File:** `modules/appointments/hooks/useAppointmentForm.ts:430-448`
**Issue:** `new Date(year, month-1, day, hour, min, 0, 0).toISOString()` creates a Date in the browser's local timezone then serializes to UTC. For salons with staff/owners in a different timezone than the salon's physical location (e.g., owner traveling abroad), this shifts appointment times by the offset delta. Staff availability checks use browser local, so double-booking detection can silently miss overlaps.
**Fix:** Either require all clients to be in the salon's timezone (document + enforce), or store times in minutes-since-midnight + date, and only compose the full UTC timestamp at save time using an explicit salon timezone offset.

### H-12: Edit-mode merge requires exact millisecond contiguity, fragile across daylight savings / manual time edits
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:71-78`
**Issue:** The merge condition is `currentCursorEnd.getTime() === apptStart.getTime()`. Any drift (a 1-second difference from a manual DB edit, a daylight-savings crossing, a clock adjustment on the server) breaks the merge and the contiguous block appears as separate blocks in edit mode.
**Fix:** Use a tolerance window (e.g., within 60 seconds). Also detect the case where appointments should merge but don't and emit a debug log so this can be monitored.

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

#### M-5: ExpenseForm: no double-submit guard between save and delete
**File:** `modules/accounting/components/DepensesPage.tsx` + `ExpenseForm.tsx:172-180`
**Issue:** The save button disables on `isPending`, but `isPending` is a combined flag for add/update/delete. A user can click Save, then quickly click Delete before the save completes — both mutations race.
**Fix:** Disable the delete button explicitly while any mutation is in flight.

#### M-6: ExpenseForm silently defaults category to `expenseCategories[0]` when missing
**File:** `modules/accounting/components/ExpenseForm.tsx:109`
**Issue:** After Zod validation passes, `handleSubmit` uses `(formData.category || expenseCategories[0]?.id)`. The schema requires category, so this fallback should never fire — but if it does, the user's expense is silently categorized without consent. Dead defensive code.
**Fix:** Remove the `||` fallback; schema already enforces required.

#### M-7: `toExpense` drops joined `category.name` / `category.color`, components re-query [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/mappers.ts:25-36`
**Issue:** Mapper ignores `row.expense_categories` and returns only the ID. `ExpenseTable` / `ExpenseCard` then re-query `useSettings` to look up the name/color per row.
**Fix:** Map `categoryName` and `categoryColor` from joined data; remove lookup calls from components.

#### M-8: ExpenseForm category default empty on first render [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/components/ExpenseForm.tsx:66-73`
**Issue:** `formData.category` initializes as `''`. No `useEffect` sets a default when `expenseCategories` loads. User sees no pre-selection.
**Fix:** Add `useEffect` to set default category when list first becomes available.

#### M-9: `useAccounting` mounts 5 extra hooks unconditionally [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/hooks/useAccounting.ts:35-38`
**Issue:** `useSettings`, `useServices`, `useProducts`, `useTeam` fire on every accounting page even when only the Journal tab is active.
**Fix:** Move service/product/team data into a dedicated `useRevenueBreakdown()` hook used only by `RevenuesPage`.

#### M-10: `DepensesRecurrentes` monthly KPI omits weekly expenses [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/components/DepensesRecurrentes.tsx:63`
**Issue:** `monthlyTotal` filters only `frequency === 'Mensuel'`, silently dropping weekly recurring expenses.
**Fix:** Normalize weekly to monthly (×4.33) and include in the KPI.

#### M-11: Single VAT rate applied to 100% of revenue [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/hooks/useAccounting.ts:195`
**Issue:** `vatDue = revenue - revenue / (1 + taxRate)` applies one rate to all revenue. Labeled "Estimée" but used for business decisions.
**Fix:** Add a prominent caveat or allow per-category VAT rates.

#### M-12: `calcTrend` not exported as named export [STILL APPLIES from 2026-04-08]
**File:** `modules/accounting/hooks/useAccounting.ts:20` (module-level)
**Issue:** Defined at module level but only consumed through the hook's return value. Awkward.
**Fix:** Add `export` keyword; import directly in `RevenuesPage`.

### Appointments — Multi-Item Blocks

#### M-13: `CalendarEventBlock` renders each appointment row separately, not as a multi-item block
**File:** `modules/appointments/components/CalendarEventBlock.tsx:28-30`
**Issue:** A multi-item block is persisted as N separate `appointments` rows. The calendar view renders each row individually, so the block's visual grouping is lost on the calendar (only list view groups them). Duration, popover, click handler all operate per-row, not per-block.
**Fix:** Group consecutive same-client same-staff appointments in the calendar day/week view; show total duration and a combined popover.

#### M-14: `AppointmentSummary` can render blocks containing zero items
**File:** `modules/appointments/components/AppointmentSummary.tsx:70`
**Issue:** Return condition is `serviceBlocks.length <= 1`, not `serviceBlocks.filter(b => b.items.length > 0).length <= 1`. An empty placeholder block slips through.
**Fix:** Filter by `items.length > 0` in the early-return check.

#### M-15: Pack-block ID is regenerated on every edit-mode load
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:85`
**Issue:** Each merged block gets a fresh `crypto.randomUUID()` on load. Not a correctness bug (DB save uses appointment IDs, not block IDs), but makes state reconciliation harder and loses any debugger breadcrumb trail across navigations.
**Fix:** Derive block ID from `appts[0].id` or a stable hash of participating appointment IDs.

#### M-16: Mobile service picker over-disables category pills when locked
**File:** `modules/appointments/components/MobileServicePicker.tsx:56-62`
**Issue:** When items are selected, all category pills except the active tab are disabled — even though the desktop `ServiceBlock` allows switching to both the locked category and Favorites.
**Fix:** Mirror desktop logic in `isCategoryPillDisabled`: allow switch to locked category OR Favorites.

#### ~~M-17: Cross-category swap silently rejected~~ RESOLVED (2026-04-10)
**File:** `modules/appointments/hooks/useAppointmentForm.ts:18,218-244`
**Resolved:** `toggleBlockItem` now pre-computes the cross-category rejection outside the state updater (keeping the reducer pure) and emits `addToast({ type: 'warning', message: 'Impossible de mélanger les catégories dans un même créneau.' })` before returning. The in-reducer check is kept as a belt-and-braces defensive guard.

#### M-18: `getBlockPrice` silently returns 0 when service/variant missing
**File:** `modules/appointments/hooks/useAppointmentForm.ts:119-125`
**Issue:** If an item references a deleted service/variant, the fallback chain drops to 0 without distinguishing legitimate free services from data loss.
**Fix:** Return `{ price, isMissing: boolean }` and validate in `handleSubmit` before save.

#### M-19: Pack toggle-off loses scheduling context of surviving blocks
**File:** `modules/appointments/hooks/useAppointmentForm.ts:308-317`
**Issue:** When a user removes a pack and `remaining.length === 0`, the code returns `[createEmptyBlock()]`. Any date/hour the user had set on a now-removed pack block is lost; the fresh empty block has no date carry-over.
**Fix:** Before clearing, capture the first pack block's date/hour and pre-populate the new empty block.

### Packs / Favorites

#### M-20: FavoritesTab doesn't revert `localOrder` if `reorderFavorites` RPC fails
**File:** `modules/services/components/FavoritesTab.tsx:21-47`
**Issue:** On drag, `localOrder` updates optimistically. If the RPC fails (permission denied, network error), `toastOnError` fires but `localOrder` stays in its reordered state. Refresh shows the old server order — confusing.
**Fix:** `useMutation({ onError: () => setLocalOrder(allFavorites) })` to rollback.

#### M-21: `reorder_favorites` RPC has no optimistic-concurrency check
**File:** `supabase/migrations/20260409180000_reorder_favorites_packs.sql:22-43`
**Issue:** Loops through JSONB items and UPDATEs each without transaction isolation override. Two concurrent reorders interleave, producing a final state matching neither user's intent.
**Fix:** Either wrap in `SET LOCAL TRANSACTION ISOLATION LEVEL REPEATABLE READ` or take an advisory lock per salon.

#### M-22: `PackGroupForm` validates date range client-side only; DB lacks CHECK constraint
**File:** `modules/services/components/PackGroupForm.tsx:51-54` + `20260409210000_pack_groups.sql` (if exists)
**Issue:** Client validates `startsAt <= endsAt`, but the DB schema has no CHECK constraint. Bypassing the UI (direct API / SQL) can insert inverted dates, causing `isPackGroupLive()` to return undefined behavior.
**Fix:** Add `CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)` to the migration.

#### M-23: `PackForm` over-cost warning is informational only; submit still proceeds
**File:** `modules/services/components/PackForm.tsx:189-194`
**Issue:** Shows yellow warning when `priceNum >= totalOriginal` but does not block save. User can accidentally create packs priced above their content — negative discount.
**Fix:** Disable Save unless user checks an "I know this is above cost" acknowledgment, or hard-reject.

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
