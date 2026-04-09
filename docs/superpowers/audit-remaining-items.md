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
| HIGH | 13 | Actionable this sprint |
| MEDIUM | 28 | Batch work |
| LOW | 22 | Polish queue |

**Of the 19 previously-documented MEDIUM items:** 1 RESOLVED, 1 PARTIAL, 17 still apply (all re-listed below).

---

## CRITICAL (0)

No critical issues found. The codebase has no silent data corruption, no security holes, and no production-blocking bugs in the audited surfaces.

---

## HIGH (13)

### H-1: ExpenseForm custom-supplier text path is dead code — custom names never persist
**Files:** `modules/accounting/components/ExpenseForm.tsx:75-77,102-111`; `modules/accounting/mappers.ts:6-52`
**Issue:** The `expenses` table schema only has `supplier_id` (FK) — there is no `supplier` text column. `toExpense` reads `suppliers?.name` from the join, `toExpenseInsert` only writes `supplier_id`, and `updateExpenseMutation` (`useAccounting.ts:101-123`) only updates `supplier_id`. Meanwhile the form maintains `isCustomSupplier` state and a `formData.supplier` text field as if ad-hoc supplier names were stored. When a user types a custom supplier name, nothing is persisted — on reload the field is empty. This has been latent for at least one release.
**Fix:** Either add a `supplier_text` nullable column and wire it through mapper/insert/update, or remove the entire custom-supplier UI path and require selection from the pre-defined suppliers list.

### H-2: Edit-mode variant fallback produces empty `variantId` when no match
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:62-68`
**Issue:** When an existing appointment has `variantId === null`, the code falls back to matching by `price + durationMinutes`. If no variant matches (e.g., the variant was deleted or the pack pro-rated the price), `variant?.id` is undefined and the item is pushed with `variantId: ''`. The Zod schema later rejects empty strings, surfacing a generic "form invalid" error with no explanation of which block is broken.
**Fix:** Add an explicit null-check before push. If `variant` cannot be resolved, drop the appointment with a toast `"Une prestation n'a pas pu être chargée — édition incomplète"` or keep it but flag the block for user attention.

### H-3: `toggle_favorite` RPC still races on concurrent toggles
**File:** `supabase/migrations/20260409200000_toggle_favorite_rpc.sql:53-66`
**Issue:** The RPC was added to fix sort-order collisions between services/variants/packs, but it still computes `MAX(favorite_sort_order) + 1` in a SELECT and then UPDATEs the target row. Nothing locks the three tables between SELECT and UPDATE. Two concurrent transactions (e.g., owner + manager rapid-click) can both see the same MAX, compute the same `v_next`, and both write it — reintroducing the exact collision the RPC was meant to prevent. No unique constraint enforces uniqueness.
**Fix:** Take a per-salon advisory lock at function entry: `PERFORM pg_advisory_xact_lock(hashtext('fav_order_' || p_salon_id::text));`. Alternative: add a `favorite_sort_order_seq` sequence per salon.

### H-4: Expense delete confirmation uses `window.confirm` instead of design-system modal
**File:** `modules/accounting/components/ExpenseForm.tsx` (delete button handler)
**Issue:** Matches an existing LOW in clients module — native `window.confirm` blocks the main thread, doesn't match design, and has poor mobile UX.
**Fix:** Replace with a confirmation modal component (see `AppointmentDetails` pattern).

### H-5: Pack hard-delete orphans `appointments.pack_id` references silently
**File:** `modules/services/hooks/usePacks.ts` (delete mutation) + migration `20260409190000_cleanup_soft_deleted_packs.sql`
**Issue:** Commit `c898f3a` switched pack deletion from soft to hard delete with confirmation. Appointments that reference the deleted pack retain a dangling `pack_id`, breaking historical "Pack Promo" tag rendering and appointment audit trails. The delete confirmation does not check or warn about active references.
**Fix:** Pre-query `appointments` for live `pack_id` references and warn in the confirmation: `"Ce pack est utilisé dans N rendez-vous. La suppression est définitive."` Consider reverting to soft-delete with `deleted_at` to preserve referential integrity, or add `ON DELETE SET NULL` to the FK.

### H-6: Expense delete mutation only invalidates `expenses` — ledger/charts stale until realtime catches up
**File:** `modules/accounting/hooks/useAccounting.ts:135-140`
**Issue:** `deleteExpenseMutation.onSuccess` only invalidates `['expenses', salonId]`. `useAccounting` exposes `ledgerData`, `chartData`, and financial KPIs all derived from expenses. Realtime sync eventually invalidates, but there's a visible stale window.
**Fix:** Explicitly invalidate related query keys in `onSuccess`, or rely on `useRealtimeSync('expenses')` being present (verify).

### H-7: Role-change mutation doesn't invalidate `staff_members` cache
**File:** `modules/settings/hooks/useTeamSettings.ts:84-106`
**Issue:** `changeRoleMutation` updates both `salon_memberships.role` and `staff_members.role` atomically but only invalidates `['team-settings-members', salonId]`. Team module and appointment hooks that query `staff_members` directly see stale role data until the next natural refetch.
**Fix:** Add `queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] })` in the `onSuccess` callback.

### H-8: Settings modals missing focus trap + aria-modal semantics
**Files:** `modules/settings/components/RevokeAccessModal.tsx:14-15`, `TransferOwnershipModal.tsx:23-24`
**Issue:** Both desktop modals lack `role="dialog"`, `aria-modal="true"`, and focus management. `MobileDrawer` has focus trap support but these desktop modals do not.
**Fix:** Add ARIA attributes and a `useEffect` that focuses the first interactive element on mount and restores focus on close. Ideally extract a shared `<Modal>` wrapper.

### H-9: Settings `useTeamSettings` query response cast as `any`, bypassing type safety
**File:** `modules/settings/hooks/useTeamSettings.ts:59-60`
**Issue:** Result from the `salon_memberships` + `profiles` join is cast `as any` and then filtered/mapped without type safety. Silent failures if schema changes.
**Fix:** Define a proper row type from `Database['public']['Tables']['salon_memberships']['Row'] & { profiles: ... }` or use a typed join wrapper.

### H-10: InvitationsTab expiration days hardcoded in UI, will drift from backend
**File:** `modules/settings/components/InvitationsTab.tsx:111`
**Issue:** UI says "expire dans 7 jours" but the value is hardcoded in the component. `useTeamSettings.ts` (`+7` in the create mutation) is the source of truth. Changes to one will silently desync.
**Fix:** Export a `INVITATION_EXPIRY_DAYS` constant from the hook and import it in the component.

### H-11: `useAppointmentForm` save-flattening uses local-timezone Date construction before UTC serialization
**File:** `modules/appointments/hooks/useAppointmentForm.ts:430-448`
**Issue:** `new Date(year, month-1, day, hour, min, 0, 0).toISOString()` creates a Date in the browser's local timezone then serializes to UTC. For salons with staff/owners in a different timezone than the salon's physical location (e.g., owner traveling abroad), this shifts appointment times by the offset delta. Staff availability checks use browser local, so double-booking detection can silently miss overlaps.
**Fix:** Either require all clients to be in the salon's timezone (document + enforce), or store times in minutes-since-midnight + date, and only compose the full UTC timestamp at save time using an explicit salon timezone offset.

### H-12: Edit-mode merge requires exact millisecond contiguity, fragile across daylight savings / manual time edits
**File:** `modules/appointments/pages/AppointmentEditPage.tsx:71-78`
**Issue:** The merge condition is `currentCursorEnd.getTime() === apptStart.getTime()`. Any drift (a 1-second difference from a manual DB edit, a daylight-savings crossing, a clock adjustment on the server) breaks the merge and the contiguous block appears as separate blocks in edit mode.
**Fix:** Use a tolerance window (e.g., within 60 seconds). Also detect the case where appointments should merge but don't and emit a debug log so this can be monitored.

### H-13: Unsafe `any` types in `useStaffCompensation`
**File:** `modules/team/hooks/useStaffCompensation.ts:31-34`
**Issue:** `.reduce((sum: number, t: any) => { ... .filter((i: any) => ... })` — filter/reduce callbacks untyped. Carried over from 2026-04-08 audit.
**Fix:** Type with `Transaction` and `CartItem`.

---

## MEDIUM (28)

### Equipe & Permissions Settings

#### M-1: Revoke membership mutation doesn't refresh auth context if user is self
**File:** `modules/settings/hooks/useTeamSettings.ts:108-118`
**Issue:** If a user revokes their own membership (edge case, possible), `AuthContext` still holds the stale membership. No `refreshProfile()` call.
**Fix:** Call `refreshProfile()` in `onSuccess` or invalidate `['salon_memberships', salonId]`.

#### M-2: TransferOwnershipModal: no handling when no eligible members exist
**File:** `modules/settings/components/TransferOwnershipModal.tsx:19,47-52`
**Issue:** If `eligibleMembers` is empty, the select shows only a placeholder — user can open the modal but cannot confirm, with no guidance.
**Fix:** Check `eligibleMembers.length === 0` before opening the modal, or show "Aucun membre éligible pour le transfert".

#### M-3: Clipboard copy in InvitationsTab lacks try/catch
**File:** `modules/settings/components/InvitationsTab.tsx:48-53`
**Issue:** `navigator.clipboard.writeText()` is awaited without a catch block. If it fails (permission denied, non-HTTPS context), `setCopied(true)` still runs, misleading the user.
**Fix:** Wrap in try/catch, only set `copied=true` on success, toast on failure.

#### M-4: Handle async errors from `onCreate` in InvitationsTab
**File:** `modules/settings/components/InvitationsTab.tsx:43-46`
**Issue:** `handleCreate` calls `onCreate(selectedRole)` without try/catch. The mutation's `toastOnError` will fire at the hook level, but the component's `isCreating` local state may not reset cleanly if the promise rejects in an unexpected path.
**Fix:** Wrap in try/finally to ensure `setIsCreating(false)` always runs.

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

#### M-17: Cross-category swap via `toggleBlockItem` is silently rejected, no user feedback
**File:** `modules/appointments/hooks/useAppointmentForm.ts:232-241`
**Issue:** The invariant guard returns the block unchanged if a cross-category item is added, but emits nothing to the UI. User clicks a service, sees nothing happen, and has no idea why.
**Fix:** Return a sentinel value or call `addToast` to emit `"Impossible de mélanger les catégories dans un même créneau"`.

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
