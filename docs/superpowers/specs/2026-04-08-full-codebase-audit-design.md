# Full Codebase Audit — Lumiere Beauty SaaS

**Date:** 2026-04-08
**Scope:** All 10 modules + shared layer + CLAUDE.md sync
**Strategy:** Module-by-module, fix as we go
**Codebase:** 224 source files, ~34k LOC

## Audit Order (risk-prioritized)

1. **Appointments** — most recent changes (mobile builder, hook extraction, routing)
2. **Dashboard** — drag-and-drop calendar, 642-line module file
3. **POS** — 648-line modals, payment logic, cart bottom sheet
4. **Team** — 719-line profile tab, PII encryption, staff-profile linking
5. **Clients** — 514-line form, duplicate phone detection, mappers
6. **Services & Products** — category tabs, service variants
7. **Accounting** — 503-line hook, revenues page, commission calculations
8. **Settings & Billing** — Stripe integration, edge functions, plan limits
9. **Shared Layer** — Layout, AuthContext, FormElements, PhoneInput, hooks, context
10. **CLAUDE.md Sync** — verify documentation matches current codebase

## 5-Dimension Review Framework

Each module is audited across these dimensions:

### 1. Security & Data Integrity
- Mutations include `salon_id` checks (defense in depth)
- No raw user input in queries (injection risk)
- PII properly encrypted where applicable
- RLS alignment — frontend doesn't assume access it shouldn't have
- Sensitive data not leaked in logs or error messages

### 2. Logic & Correctness
- Edge cases: nulls, empty arrays, missing relations
- Form state management: controlled inputs, validation, reset on unmount
- Mapper consistency: snake_case <-> camelCase, no data loss in translation
- Conditional rendering: loading, error, empty states all handled
- Date/timezone handling consistency

### 3. Code Quality & Maintainability
- File size — flag anything over 400 lines for potential extraction
- Duplication across components
- Dead code, unused imports, commented-out blocks
- Naming consistency and convention adherence
- Type safety — no `any` types, proper generics

### 4. Performance
- Unnecessary re-renders: inline objects/functions in JSX, missing memoization
- Query patterns: over-fetching, missing query key dependencies
- Expensive computations without useMemo where warranted
- Bundle impact: large imports, tree-shaking blockers

### 5. UX Robustness
- Error handling in mutations (toasts, user feedback)
- Loading and empty states present and styled
- Mobile responsiveness: touch targets (44px), overflow, scroll behavior
- Accessibility basics: ARIA labels, focus management, keyboard navigation

## Severity Ratings

| Severity | Definition | Action |
|----------|-----------|--------|
| **Critical** | Security flaw or data loss risk | Fix immediately |
| **High** | Bug or logic error likely to affect users | Fix immediately |
| **Medium** | Code quality or minor UX issue | Fix during module pass |
| **Low** | Nitpick or minor optimization | Collect, fix at end |

## Process Per Module

1. Read all files in the module (components, hooks, mappers, schemas, pages)
2. Analyze against all 5 dimensions
3. Report findings grouped by severity
4. Fix critical, high, and medium issues
5. Move to next module

## Deliverables

- Per-module findings report with severity ratings
- Code fixes applied directly (critical/high/medium)
- Updated CLAUDE.md reflecting current codebase state
- Summary of low-severity items for future consideration
