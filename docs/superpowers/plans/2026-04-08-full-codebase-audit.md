# Full Codebase Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every module for security, logic, code quality, performance, and UX issues — fix critical/high/medium findings immediately, collect low-severity items.

**Architecture:** Module-by-module sequential audit. Each task reads all files in the module, analyzes against 5 dimensions, reports findings with severity ratings, and applies fixes inline. A final task syncs CLAUDE.md with the current codebase state.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS 4, TanStack Query, Supabase (RLS, Realtime, Auth, Storage, Edge Functions), Zod, Stripe

---

## Audit Dimensions (applied to every task)

1. **Security & Data Integrity** — `salon_id` on mutations, no injection vectors, PII encryption, RLS alignment
2. **Logic & Correctness** — null/edge cases, mapper fidelity, form state, date/timezone handling
3. **Code Quality** — file size (>400 LOC flagged), duplication, dead code, type safety (no `any`)
4. **Performance** — re-render risks, query patterns, missing memoization, over-fetching
5. **UX Robustness** — mutation error toasts, loading/empty states, mobile touch targets, a11y basics

## Severity Scale

| Level | Definition | Action |
|-------|-----------|--------|
| Critical | Security flaw or data loss | Fix immediately |
| High | Bug likely to affect users | Fix immediately |
| Medium | Code quality or minor UX | Fix during module pass |
| Low | Nitpick or optimization | Collect for later |

---

### Task 1: Audit Appointments Module (41 files, 5,213 LOC)

**Files to read:**
- Module root: `modules/appointments/AppointmentsModule.tsx`, `mappers.ts` (117), `schemas.ts` (40)
- Hooks: `hooks/useAppointmentForm.ts` (354), `hooks/useAppointments.ts` (244), `hooks/useStaffAvailability.ts` (85)
- Pages: `pages/AppointmentNewPage.tsx` (62), `pages/AppointmentEditPage.tsx` (133), `pages/AppointmentListPage.tsx` (51), `pages/AppointmentDetailPage.tsx` (40)
- Mobile: `components/AppointmentBuilderMobile.tsx` (534), `components/MobileBottomSheet.tsx` (135), `components/MobileClientSearch.tsx` (236), `components/MobileServicePicker.tsx` (174)
- Desktop builder: `components/AppointmentBuilder.tsx` (144), `components/ClientField.tsx` (214)
- Calendar: `components/CalendarView.tsx` (125), `components/CalendarDayView.tsx` (77), `components/CalendarWeekView.tsx` (116), `components/CalendarMonthView.tsx` (146), `components/CalendarHeader.tsx` (103), `components/CalendarSidebar.tsx` (131), `components/CalendarEventBlock.tsx` (65), `components/CalendarEventPopover.tsx` (101), `components/InlineCalendar.tsx` (95), `components/useCalendar.ts` (128), `components/calendarUtils.ts` (73), `components/calendarColors.ts` (43)
- Form parts: `components/ServiceBlock.tsx` (204), `components/ServiceGrid.tsx` (60), `components/StaffPills.tsx` (61), `components/VariantList.tsx` (36), `components/TimePicker.tsx` (104), `components/SchedulingPanel.tsx` (91), `components/ReminderToggle.tsx` (58), `components/StatusBadge.tsx` (94)
- Display: `components/AppointmentList.tsx` (131), `components/AppointmentTable.tsx` (251), `components/AppointmentCard.tsx` (71), `components/AppointmentDetails.tsx` (173), `components/AppointmentSummary.tsx` (106)

**Priority areas (recently changed, most complex):**
- `useAppointmentForm.ts` — newly extracted hook, all form logic lives here
- `AppointmentBuilderMobile.tsx` — 534 LOC, brand new, two-screen form
- `MobileClientSearch.tsx` — inline client creation, phone-first
- `AppointmentEditPage.tsx` — recently modified routing
- `mappers.ts` — null coalescing fixes were recent

- [ ] **Step 1: Read all hook files** — `useAppointmentForm.ts`, `useAppointments.ts`, `useStaffAvailability.ts`
- [ ] **Step 2: Read all page files** — all 4 pages
- [ ] **Step 3: Read mobile components** — `AppointmentBuilderMobile.tsx`, `MobileBottomSheet.tsx`, `MobileClientSearch.tsx`, `MobileServicePicker.tsx`
- [ ] **Step 4: Read desktop builder + form parts** — `AppointmentBuilder.tsx`, `ClientField.tsx`, `ServiceBlock.tsx`, `ServiceGrid.tsx`, `StaffPills.tsx`, `VariantList.tsx`, `TimePicker.tsx`, `SchedulingPanel.tsx`, `ReminderToggle.tsx`, `StatusBadge.tsx`
- [ ] **Step 5: Read calendar components** — all calendar files + `calendarUtils.ts`, `calendarColors.ts`, `useCalendar.ts`
- [ ] **Step 6: Read display + list components** — `AppointmentList.tsx`, `AppointmentTable.tsx`, `AppointmentCard.tsx`, `AppointmentDetails.tsx`, `AppointmentSummary.tsx`
- [ ] **Step 7: Read module root files** — `AppointmentsModule.tsx`, `mappers.ts`, `schemas.ts`
- [ ] **Step 8: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 9: Fix critical/high/medium issues**
- [ ] **Step 10: Commit fixes**

```bash
git add modules/appointments/
git commit -m "fix: appointments module audit — [summary of fixes]"
```

---

### Task 2: Audit Dashboard Module (2 files, 1,329 LOC)

**Files to read:**
- `modules/dashboard/DashboardModule.tsx` (642)
- `modules/dashboard/components/TodayCalendarCard.tsx` (687)

**Priority areas:**
- Both files exceed 400 LOC — evaluate extraction candidates
- Drag-and-drop rescheduling logic (recently added)
- Service category filter (recently added)
- Calendar rendering performance

- [ ] **Step 1: Read `DashboardModule.tsx`**
- [ ] **Step 2: Read `TodayCalendarCard.tsx`**
- [ ] **Step 3: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 4: Fix critical/high/medium issues**
- [ ] **Step 5: Commit fixes**

```bash
git add modules/dashboard/
git commit -m "fix: dashboard module audit — [summary of fixes]"
```

---

### Task 3: Audit POS Module (8 files, 2,210 LOC)

**Files to read:**
- `modules/pos/POSModule.tsx` (210), `mappers.ts` (140)
- `modules/pos/hooks/usePOS.ts` (202)
- `modules/pos/components/POSModals.tsx` (648), `PaymentModal.tsx` (390), `CartBottomSheet.tsx` (327), `POSCatalog.tsx` (311), `POSCart.tsx` (217), `PendingAppointments.tsx` (123), `StaffSelector.tsx` (118), `MiniCartBar.tsx` (55)

**Priority areas:**
- `POSModals.tsx` at 648 LOC — strong extraction candidate
- `PaymentModal.tsx` — payment logic correctness, price calculation
- Immutable transaction enforcement (no UPDATE)
- Price snapshotting on transaction_items

- [ ] **Step 1: Read `usePOS.ts` and `mappers.ts`**
- [ ] **Step 2: Read `POSModule.tsx`**
- [ ] **Step 3: Read `POSModals.tsx`, `PaymentModal.tsx`, `CartBottomSheet.tsx`**
- [ ] **Step 4: Read `POSCatalog.tsx`, `POSCart.tsx`, `PendingAppointments.tsx`, `StaffSelector.tsx`, `MiniCartBar.tsx`**
- [ ] **Step 5: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 6: Fix critical/high/medium issues**
- [ ] **Step 7: Commit fixes**

```bash
git add modules/pos/
git commit -m "fix: POS module audit — [summary of fixes]"
```

---

### Task 4: Audit Team Module (26 files, 3,747 LOC)

**Files to read:**
- Module root: `modules/team/TeamModule.tsx` (7), `mappers.ts` (112), `schemas.ts` (15), `utils.ts` (32)
- Hooks: `useTeam.ts` (151), `useStaffDetail.ts` (153), `useStaffPayouts.ts` (120), `useStaffCompensation.ts` (51), `useStaffClients.ts` (31), `useStaffAppointments.ts` (65), `useStaffActivity.ts` (44), `useStaffPhotoUpload.ts` (67), `useTeamPerformance.ts` (92), `useInvitation.ts` (99)
- Pages: `TeamListPage.tsx` (73), `NewStaffPage.tsx` (44), `StaffDetailPage.tsx` (149)
- Components: `StaffProfileTab.tsx` (719), `TeamForm.tsx` (419), `StaffRemunerationTab.tsx` (277), `TeamPerformance.tsx` (240), `StaffPerformanceTab.tsx` (236), `TeamTable.tsx` (204), `StaffAgendaTab.tsx` (188), `TeamCard.tsx` (164), `StaffHeader.tsx` (142), `StaffActivityTab.tsx` (130), `TeamList.tsx` (109), `PayoutHistory.tsx` (107), `PayoutForm.tsx` (179), `InvitationModal.tsx` (78)

**Priority areas:**
- `StaffProfileTab.tsx` at 719 LOC — largest component in codebase
- PII encryption via `update_staff_pii` RPC — two-step write pattern
- Staff-profile linking via `membership_id`
- `useStaffDetail.ts` — recent fix for active vs archived records
- Photo upload validation

- [ ] **Step 1: Read all 10 hook files**
- [ ] **Step 2: Read all 3 page files**
- [ ] **Step 3: Read `StaffProfileTab.tsx` and `TeamForm.tsx`**
- [ ] **Step 4: Read remaining components (12 files)**
- [ ] **Step 5: Read module root files** — `mappers.ts`, `schemas.ts`, `utils.ts`
- [ ] **Step 6: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 7: Fix critical/high/medium issues**
- [ ] **Step 8: Commit fixes**

```bash
git add modules/team/
git commit -m "fix: team module audit — [summary of fixes]"
```

---

### Task 5: Audit Clients Module (9 files, 1,685 LOC)

**Files to read:**
- `modules/clients/ClientsModule.tsx` (84), `mappers.ts` (129), `schemas.ts` (14)
- `modules/clients/hooks/useClients.ts` (111)
- `modules/clients/components/ClientForm.tsx` (514), `ClientDetails.tsx` (474), `ClientTable.tsx` (142), `ClientCard.tsx` (131), `ClientList.tsx` (86)

**Priority areas:**
- `ClientForm.tsx` at 514 LOC — duplicate phone detection (recently added)
- `ClientDetails.tsx` at 474 LOC — possible extraction
- `mappers.ts` — recent null coalescing fixes for phone/contact fields
- Client stats via `client_stats` view

- [ ] **Step 1: Read `useClients.ts` and `mappers.ts`**
- [ ] **Step 2: Read `ClientForm.tsx` and `ClientDetails.tsx`**
- [ ] **Step 3: Read remaining files** — `ClientsModule.tsx`, `schemas.ts`, `ClientTable.tsx`, `ClientCard.tsx`, `ClientList.tsx`
- [ ] **Step 4: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 5: Fix critical/high/medium issues**
- [ ] **Step 6: Commit fixes**

```bash
git add modules/clients/
git commit -m "fix: clients module audit — [summary of fixes]"
```

---

### Task 6: Audit Services & Products Modules (14 + 14 files, 3,173 LOC)

**Files to read — Services (1,656 LOC):**
- `modules/services/ServicesModule.tsx` (64), `ServiceSettingsPage.tsx` (59), `mappers.ts` (111), `schemas.ts` (15)
- `modules/services/hooks/useServices.ts` (222), `useServiceSettings.ts` (61)
- `modules/services/components/CategoriesTab.tsx` (255), `ServiceForm.tsx` (211), `ServiceTable.tsx` (144), `ServiceList.tsx` (138), `GeneralTab.tsx` (130), `ServiceCard.tsx` (115), `ColorPicker.tsx` (73), `IconPicker.tsx` (58)

**Files to read — Products (1,517 LOC):**
- `modules/products/ProductsModule.tsx` (64), `ProductSettingsPage.tsx` (60), `mappers.ts` (117), `schemas.ts` (9)
- `modules/products/hooks/useProducts.ts` (180), `useProductSettings.ts` (59)
- `modules/products/components/ProductCategoriesTab.tsx` (248), `ProductForm.tsx` (234), `BrandsTab.tsx` (141), `ProductGeneralTab.tsx` (120), `ProductTable.tsx` (99), `ProductList.tsx` (86), `ProductCard.tsx` (83), `UsageTypeBadge.tsx` (17)

**Priority areas:**
- Category management patterns (similar in both modules — check for duplication)
- Service variants mapping
- Product stock management logic
- Plan limit enforcement (`check_plan_limits` trigger on products)

- [ ] **Step 1: Read Services hooks and mappers** — `useServices.ts`, `useServiceSettings.ts`, `mappers.ts`, `schemas.ts`
- [ ] **Step 2: Read Services components** — all 8 component files
- [ ] **Step 3: Read Products hooks and mappers** — `useProducts.ts`, `useProductSettings.ts`, `mappers.ts`, `schemas.ts`
- [ ] **Step 4: Read Products components** — all 8 component files
- [ ] **Step 5: Read module containers** — both `*Module.tsx` and `*SettingsPage.tsx` files
- [ ] **Step 6: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 7: Fix critical/high/medium issues**
- [ ] **Step 8: Commit fixes**

```bash
git add modules/services/ modules/products/
git commit -m "fix: services & products audit — [summary of fixes]"
```

---

### Task 7: Audit Accounting Module (16 files, 1,956 LOC)

**Files to read:**
- `modules/accounting/FinancesLayout.tsx` (33), `mappers.ts` (49), `schemas.ts` (8)
- `modules/accounting/hooks/useAccounting.ts` (503)
- `modules/accounting/components/RevenuesPage.tsx` (303), `ExpenseForm.tsx` (179), `FinancesOverview.tsx` (174), `DepensesRecurrentes.tsx` (131), `JournalPage.tsx` (117), `RevenueCategoryTable.tsx` (87), `MiniKpiRow.tsx` (75), `AccountingLedger.tsx` (73), `DepensesPage.tsx` (72), `ExpenseTable.tsx` (67), `ExpenseCard.tsx` (61), `AccountingExpenses.tsx` (24)

**Priority areas:**
- `useAccounting.ts` at 503 LOC — largest hook, commission/bonus calculations (recently added)
- `RevenuesPage.tsx` — staff commission display, expandable service details
- Revenue calculation accuracy
- Expense recurring logic
- `useTransactions` integration (shared hook)

- [ ] **Step 1: Read `useAccounting.ts`**
- [ ] **Step 2: Read `RevenuesPage.tsx` and `FinancesOverview.tsx`**
- [ ] **Step 3: Read expense-related files** — `ExpenseForm.tsx`, `DepensesRecurrentes.tsx`, `DepensesPage.tsx`, `ExpenseTable.tsx`, `ExpenseCard.tsx`, `AccountingExpenses.tsx`
- [ ] **Step 4: Read remaining files** — `FinancesLayout.tsx`, `JournalPage.tsx`, `RevenueCategoryTable.tsx`, `MiniKpiRow.tsx`, `AccountingLedger.tsx`, `mappers.ts`, `schemas.ts`
- [ ] **Step 5: Read shared hook** — `hooks/useTransactions.ts`
- [ ] **Step 6: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 7: Fix critical/high/medium issues**
- [ ] **Step 8: Commit fixes**

```bash
git add modules/accounting/ hooks/useTransactions.ts
git commit -m "fix: accounting module audit — [summary of fixes]"
```

---

### Task 8: Audit Settings & Billing Modules (6 + 9 files, 1,763 LOC)

**Files to read — Settings (997 LOC):**
- `modules/settings/SettingsModule.tsx` (146), `mappers.ts` (154)
- `modules/settings/hooks/useSettings.ts` (228)
- `modules/settings/components/GeneralSettings.tsx` (276), `OpeningHoursSettings.tsx` (64), `AccountingSettings.tsx` (129)

**Files to read — Billing (766 LOC):**
- `modules/billing/BillingModule.tsx` (147)
- `modules/billing/hooks/useBilling.ts` (118)
- `modules/billing/components/CurrentPlanCard.tsx` (109), `PlanCards.tsx` (114), `UpgradeModal.tsx` (98), `UpgradeSuccess.tsx` (97), `StripePortalSection.tsx` (29), `TrialBanner.tsx` (28), `PastDueBanner.tsx` (26)

**Also read — Edge Functions:**
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-portal-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/expire-trials/index.ts`

**Priority areas:**
- Stripe webhook signature verification
- Edge function auth (JWT validation)
- Plan limit enforcement accuracy (`PLAN_LIMITS` vs DB trigger)
- Token refresh handling in `useBilling.ts`
- Trial expiry logic
- Settings mapper correctness

- [ ] **Step 1: Read Settings files** — all 6 files
- [ ] **Step 2: Read Billing files** — all 9 files
- [ ] **Step 3: Read Edge Functions** — all 4 function files
- [ ] **Step 4: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 5: Fix critical/high/medium issues**
- [ ] **Step 6: Commit fixes**

```bash
git add modules/settings/ modules/billing/ supabase/functions/
git commit -m "fix: settings & billing audit — [summary of fixes]"
```

---

### Task 9: Audit Shared Layer (50+ files, ~6,500 LOC)

**Files to read — Components (19 files):**
- `components/Layout.tsx` (484), `DateRangePicker.tsx` (567), `PhoneInput.tsx` (257), `FormElements.tsx` (266), `DatePicker.tsx` (221), `MobileDrawer.tsx` (219), `WorkScheduleEditor.tsx` (205), `MobileSelect.tsx` (176), `BonusSystemEditor.tsx` (131), `AdminLayout.tsx` (116), `ErrorBoundary.tsx` (77), `BottomTabBar.tsx` (68), `ConnectionStatus.tsx` (60), `Toast.tsx` (60), `StaffAvatar.tsx` (53), `ProtectedRoute.tsx` (51), `ViewToggle.tsx` (39), `AdminRoute.tsx` (38), `EmptyState.tsx` (22)

**Files to read — Hooks (10 files):**
- `hooks/useRealtimeSync.ts` (101), `usePermissions.ts` (89), `useConnectionStatus.ts` (77), `useTransactions.ts` (70), `useAvatarUpload.ts` (57), `useMutationToast.ts` (53), `useFormValidation.ts` (52), `useSidebar.ts` (38), `useLinkedStaffMember.ts` (33), `useViewMode.ts` (31)

**Files to read — Context (3 files):**
- `context/AuthContext.tsx` (453), `ToastContext.tsx` (117), `MediaQueryContext.tsx` (51)

**Files to read — Lib (5 files):**
- `lib/database.types.ts` (2842 — skim, auto-generated), `categoryIcons.tsx` (220), `auth.types.ts` (95), `supabase.ts` (36), `format.ts` (9)

**Files to read — Pages (9 + 7 profile files):**
- `pages/AcceptInvitationPage.tsx` (300), `LoginPage.tsx` (179), `SignupPage.tsx` (147), `CreateSalonPage.tsx` (142), `ResetPasswordPage.tsx` (119), `ForgotPasswordPage.tsx` (104), `SalonPickerPage.tsx` (98), `ProfilePage.tsx` (95), `SuspendedPage.tsx` (27)
- `pages/profile/ProfileIdentity.tsx` (148), `ProfileDangerZone.tsx` (98), `ProfilePerformance.tsx` (83), `ProfilePreferences.tsx` (77), `ProfileSalonRole.tsx` (68), `ProfileSecurity.tsx` (64), `ProfileSchedule.tsx` (62)

**Files to read — Root:**
- `App.tsx` (202), `index.tsx` (33), `types.ts` (417)

**Priority areas:**
- `AuthContext.tsx` — session management, token refresh, profile mutations, salon tier realtime
- `Layout.tsx` — sidebar/mobile nav, role-based visibility
- `PhoneInput.tsx` — recently built, numpad hiding, country codes
- `useRealtimeSync.ts` — ref-counted subscriptions, cache invalidation
- `ProtectedRoute.tsx` — auth/permission guards
- Auth pages — invitation acceptance, magic link, password reset
- `types.ts` — type completeness and consistency with DB types

- [ ] **Step 1: Read `AuthContext.tsx` and `auth.types.ts`**
- [ ] **Step 2: Read `Layout.tsx`, `ProtectedRoute.tsx`, `AdminRoute.tsx`**
- [ ] **Step 3: Read all shared hooks** — 10 files
- [ ] **Step 4: Read form-related components** — `FormElements.tsx`, `PhoneInput.tsx`, `DatePicker.tsx`, `DateRangePicker.tsx`, `WorkScheduleEditor.tsx`, `BonusSystemEditor.tsx`, `MobileSelect.tsx`
- [ ] **Step 5: Read navigation/UI components** — `MobileDrawer.tsx`, `BottomTabBar.tsx`, `ViewToggle.tsx`, `Toast.tsx`, `ConnectionStatus.tsx`, `ErrorBoundary.tsx`, `EmptyState.tsx`, `StaffAvatar.tsx`
- [ ] **Step 6: Read context files** — `ToastContext.tsx`, `MediaQueryContext.tsx`
- [ ] **Step 7: Read auth pages** — `LoginPage.tsx`, `SignupPage.tsx`, `AcceptInvitationPage.tsx`, `CreateSalonPage.tsx`, `SalonPickerPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `SuspendedPage.tsx`
- [ ] **Step 8: Read profile pages** — `ProfilePage.tsx` + all 7 profile section components
- [ ] **Step 9: Read root files** — `App.tsx`, `index.tsx`, `types.ts`, `lib/supabase.ts`, `lib/format.ts`, `lib/categoryIcons.tsx`
- [ ] **Step 10: Analyze all 5 dimensions and produce findings report**
- [ ] **Step 11: Fix critical/high/medium issues**
- [ ] **Step 12: Commit fixes**

```bash
git add components/ hooks/ context/ lib/ pages/ App.tsx types.ts
git commit -m "fix: shared layer audit — [summary of fixes]"
```

---

### Task 10: CLAUDE.md Sync

**Files to read:**
- `CLAUDE.md`
- Compare against actual file structure, module list, component inventory, and patterns discovered during audit

- [ ] **Step 1: Read current `CLAUDE.md`**
- [ ] **Step 2: Cross-reference with audit findings** — new files, removed files, changed patterns, updated conventions
- [ ] **Step 3: Update `CLAUDE.md`** — add missing documentation, correct outdated info, remove references to deleted code
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: sync CLAUDE.md with current codebase state"
```

---

## Post-Audit

After all 10 tasks complete:
- [ ] Compile low-severity findings into a summary document at `docs/superpowers/audit-low-severity-items.md`
- [ ] Verify the app builds cleanly: `npm run build`
- [ ] Final commit with summary
