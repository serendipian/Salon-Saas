# Safety Net — Design Spec

**Date:** 2026-04-15
**Status:** Ready for implementation plan
**Supersedes:** nothing
**Related:** `docs/superpowers/plans/2026-04-15-critical-remediation.md` (already merged)

## Goal

Install the dev-loop safety net the audit called out as its single biggest professional-liability gap: strict TypeScript, linting, tests, and CI. After this lands, every future change is verified by automation before it can reach `main`, and every future refactor has a compiler + linter + test suite to lean on.

Non-goal: production hardening (Sentry, CSP/HSTS, staging Supabase, README). Those are in the follow-up "Production Hardening" plan.

## Scope

**In scope (5 tasks, single PR):**

1. Biome (lint + format) — one tool replaces the ESLint+Prettier pair.
2. Strict TypeScript — enable `"strict": true`, fix the 29 resulting errors.
3. Vitest + @testing-library — unit-only test framework + ~75 tests covering mappers, schemas, permissions, formatters, schedule math.
4. GitHub Actions CI — one workflow gating every PR on lint + typecheck + test + build + `npm audit`.
5. Types-drift CI check — block PRs that add migrations without regenerating `lib/database.types.ts`.

**Explicitly out of scope:**

- Component/integration/E2E tests (Plan B adds Playwright once staging Supabase exists).
- Supabase mocking (unit tests target pure functions — mappers, schemas, permissions, formatters — which need no mocks).
- `noUncheckedIndexedAccess` TS flag (defers ~50+ extra errors; later plan).
- Prettier (replaced by Biome).
- ESLint (replaced by Biome).
- Sentry, CSP, staging DB, backup runbook, README rewrite, `.env.example` (Plan B).

## Architecture

One branch `fix/safety-net-2026-04-15`, five tasks executed in strict order. Each task is a standalone commit, independently revertible, and passes its own verification before the next starts.

**Ordering rationale:**

1. **Biome first.** Format-and-lint normalization rewrites whitespace and fixes low-hanging issues (unused imports, `window.confirm`). Running before strict TS prevents two tools from fighting the same files.
2. **Strict TS second.** 29 typed errors — mostly in mappers — fixed with Biome already normalizing the diffs.
3. **Vitest third.** Now that types are strict, test bodies get free type-safety on fixtures.
4. **CI fourth.** Wires the three tools above into one check that gates merges.
5. **Types-drift fifth.** Separate minimal workflow; requires no credentials.

## Component designs

### 1. Biome (~2h)

**Version:** `@biomejs/biome@^2.4`.

**Install:**

```bash
npm install --save-dev --save-exact @biomejs/biome@2.4.12
```

**`biome.jsonc` at repo root:**

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.12/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": [
      "**",
      "!**/node_modules",
      "!**/dist",
      "!**/.worktrees",
      "!**/lib/database.types.ts",
      "!**/supabase/migrations",
      "!**/supabase/functions/**/*.ts"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noAlert": "error",
        "noExplicitAny": "error",
        "noConsole": { "level": "warn", "options": { "allow": ["error", "warn"] } }
      },
      "correctness": {
        "useExhaustiveDependencies": "error",
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      },
      "nursery": {
        "noFloatingPromises": "error"
      }
    }
  }
}
```

- Auto-generated `lib/database.types.ts`, migrations, and edge functions are excluded (edge functions run on Deno, not browser; different lint rules apply).
- `noAlert` — critical: audit flagged 5 `window.confirm` leaks despite `ConfirmModal` being available. Default severity is `info`, must bump to `error`.
- `noExplicitAny` — catches the audit's 19 `as any` / `as unknown as` casts.
- `useExhaustiveDependencies` — replaces ESLint's famous `react-hooks/exhaustive-deps` rule. Default severity is already `error`.
- `noFloatingPromises` lives in `nursery` in Biome 2.x; stable-enough to enable.
- `noConsole` at `warn` (not `error`) — allows `console.error` / `console.warn` (the idle-tab `[recovery]` logs use `console.log` which will be flagged; we'll gate them behind `import.meta.env.DEV` per the audit).

**`package.json` scripts added:**

```json
"lint": "biome check",
"lint:fix": "biome check --write",
"format": "biome format --write"
```

**Initial pass sequence (done by hand in the Biome task):**

1. `npm run format` — mechanical whitespace normalization across the repo.
2. `npm run lint:fix` — auto-fix safe issues (unused imports, sort imports).
3. `npm run lint` — surface remaining errors. Expected: mostly `noExplicitAny` and `noAlert` hits from the audit's known issues plus any `console.log` warnings.
4. Fix remaining by hand. Cap: if more than 50 hand-fix errors surface, stop and report — we'd consider relaxing one or two rules instead of a long afternoon of fixes.

### 2. Strict TypeScript (~4-6h)

**`tsconfig.json`:** add a single key, keep everything else identical:

```json
{
  "compilerOptions": {
    "strict": true,
    ...
  }
}
```

This enables (from TS docs): `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `alwaysStrict`, `noImplicitThis`, `useUnknownInCatchVariables`.

Explicitly NOT enabled:

- `noUncheckedIndexedAccess` — would add ~50+ errors across the codebase. Deferred.
- `noUnusedLocals` / `noUnusedParameters` — Biome's `noUnusedVariables` / `noUnusedImports` cover this.

**Known error inventory (verified via `tsc --noEmit --strict`):**

- **21 × TS2322** (type not assignable) — mostly nullability mismatches between generated `Database['public']['Tables']['X']['Row']` (which permits `null` for nullable columns) and the hand-written `XRow` type aliases in mappers (which say `string`).
- **7 × TS2345** (argument type) — `.map(mapperFn)` where the generated Row has wider types than the mapper accepts.
- **1 × TS2769** (no overload match) — Recharts `Tooltip formatter` signature mismatch in `StaffPerformanceTab.tsx:189`.

**Canonical fix patterns:**

- **Mapper nullability:** delete the hand-written Row alias, import `Database['public']['Tables']['<name>']['Row']` directly. Make the mapper handle `null` via `?? ''` or `?? undefined` as appropriate.
- **`as unknown as null` (audit finding, `modules/team/mappers.ts:104,110`):** replace with a typed `Insert` shape: `import type { Database } from '../../lib/database.types'; type StaffInsert = Database['public']['Tables']['staff_members']['Insert'];` Return typed object, remove cast.
- **Recharts Tooltip:** the formatter signature in Recharts 3 is `(value: ValueType, name?: NameType, ...) => ReactNode`. Current code assumes `value: number` directly. Fix: `(v: number | string) => [typeof v === 'number' ? formatPrice(v) : String(v), ' CA']`.

**Acceptance:** `tsc --noEmit` returns 0 errors.

**Catch blocks: non-issue.** 14 catch blocks in the codebase, all use `catch (err)` and already narrow via `err instanceof Error ? err.message : String(err)`. `useUnknownInCatchVariables` won't surface new errors.

### 3. Vitest + @testing-library (~6h)

**Versions (exact pins — Vitest 4.x is recent, avoid surprise-patch breakage):**

```json
"vitest": "4.1.4",
"@testing-library/react": "^16",
"@testing-library/jest-dom": "^6",
"happy-dom": "^15"
```

`@vitest/ui` is optional (local dev UI for running tests in a browser). Not in CI dependencies.

**Install:**

```bash
npm install --save-dev --save-exact vitest@4.1.4
npm install --save-dev @testing-library/react@^16 @testing-library/jest-dom@^6 happy-dom@^15
```

**`vitest.config.ts` at repo root:**

```ts
/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./test/setup.ts'],
      include: ['**/*.test.{ts,tsx}'],
      exclude: ['node_modules', 'dist', '.worktrees', 'supabase/functions'],
    },
  }),
);
```

**`test/setup.ts`:** one line, nothing else.

```ts
import '@testing-library/jest-dom/vitest';
```

No Supabase mock. The 75 tests don't touch Supabase — they target pure functions (mappers, schemas, permissions, formatters, schedule math). Introducing a mock is premature abstraction.

**`package.json` scripts added:**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

**Test coverage inventory (~75 tests):**

| Target | Tests | What each verifies |
|---|---|---|
| `modules/clients/mappers.ts` | 3 | row → type → insert round-trip; undefined fields default correctly; `status` preserves 'ACTIF'/'VIP'/'INACTIF' |
| `modules/team/mappers.ts` | 5 | row → type round-trip; `bonusTiers` JSON round-trip (audit's `as unknown as null` bug class); `schedule` JSON; `start_date` empty-string ↔ null; color class string preserved |
| `modules/appointments/mappers.ts` | 4 | row → type; `toAppointmentInsert` drops `groupId` (known asymmetry — documented); variant name denorm correct; status enum passes through |
| `modules/pos/mappers.ts` | 3 | payment method label round-trip (audit's `'Autre'` → `'Carte Cadeau'` regression); items correctly computed; totals |
| `modules/accounting/mappers.ts` | 2 | category_id → category name join; amount sign for VOID/REFUND |
| `modules/services/mappers.ts` + `packMappers.ts` | 3 | variants array order preserved; pack items round-trip; favorite state |
| `modules/products/mappers.ts` | 2 | stock handling; usageType enum |
| `modules/suppliers/mappers.ts` | 2 | category nullability; active flag |
| `modules/settings/mappers.ts` | 2 | address fields present; schedule JSON round-trip |
| `modules/clients/schemas.ts` | 3 | valid input passes; required fields fail with French message; email regex catches malformed |
| `modules/team/schemas.ts` | 3 | commission 0-100; bonus tiers validation; contract type enum |
| `modules/appointments/schemas.ts` | 3 | date required; duration 5-480; status enum |
| `modules/accounting/schemas.ts` | 3 | amount > 0; date ≥ 2020; category_id required |
| `modules/products/schemas.ts` | 2 | price ≥ 0; usage type enum |
| `modules/services/schemas.ts` + `packSchemas.ts` | 3 | variant required; pack items ≥ 1; groupId optional |
| `modules/suppliers/schemas.ts` | 2 | name required; email optional but validated if present |
| `hooks/usePermissions.ts` | 15 | for every role (owner, manager, stylist, receptionist) × every resource × every standard action: correct can() return. Matrix verification. |
| `lib/format.ts` | 8 | `formatPrice` for MAD/EUR/USD/CAD; negative; zero; very large; `formatDuration` for 0/30/60/90/120 min |
| `lib/scheduleHours.ts` | 5 | day-slot math; overlap detection; closed-day handling; edge-of-midnight |

Total: ~73 tests. All pure, all sub-millisecond.

**Test file location:** co-located. `foo.test.ts` next to `foo.ts`. Biome's include already covers them; `vitest.config.ts` explicit `include` catches them too.

**Fixtures:** each test file declares its own fixture constants inline — no shared fixture modules for now. Duplication is fine at this scale.

### 4. GitHub Actions CI (~1h)

**`.github/workflows/ci.yml`:**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Typecheck
        run: npx tsc --noEmit
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
      - name: Audit
        run: npm audit --audit-level=high --production
```

- Single-job workflow. No matrix — no reason to test Node 18 + 20 when we only deploy on Node 20 (Vercel default).
- `--production` on audit: skip dev-only CVEs. Production CVEs block the PR.
- No caching beyond `setup-node`'s npm cache — repo is too small to matter.
- No coverage upload — Week 2 doesn't need coverage tracking.

**After the first green run,** branch protection on `main` will be updated (via `gh api`) to require the `check` context. This can be done in the task itself once the workflow is committed and one merge cycle has produced a successful run.

### 5. Types-drift CI check (~30min)

**`.github/workflows/types-drift.yml`:**

```yaml
name: Types drift
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'lib/database.types.ts'

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # need history for git log
      - name: Verify types reflect latest migration
        run: |
          types_ts=$(git log -1 --format=%ct -- lib/database.types.ts)
          mig_ts=$(git log -1 --format=%ct -- supabase/migrations/)
          if [ -z "$types_ts" ] || [ -z "$mig_ts" ]; then
            echo "::error::Could not read commit timestamps"
            exit 1
          fi
          if [ "$mig_ts" -gt "$types_ts" ]; then
            echo "::error::A migration was committed after lib/database.types.ts was last regenerated."
            echo "::error::Run: npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts"
            exit 1
          fi
          echo "Types up-to-date."
```

- `fetch-depth: 0` is required — default shallow clone doesn't give us `git log` for arbitrary paths.
- Timestamp-based via git, not filesystem mtime. Reliable on any clone.
- `paths:` filter — only runs when migrations or types file change. Saves CI minutes.
- If someone commits a migration AND regenerates types in the same commit, timestamps are equal, `-gt` is false, check passes. Correct.
- If someone amends history or force-pushes with timestamps going backwards, check may false-positive; dev escape is `git commit --amend --no-edit --date=now` on the types file.

## Data flow

Post-Plan, the dev loop becomes:

```
Edit code
  ↓ (save)
Biome format on save (VS Code ext)       ← local, instant
  ↓ (git push)
PR opens
  ↓
CI workflow runs                         ← ~3 minutes
  ├── Lint        (biome check)
  ├── Typecheck   (tsc --noEmit)
  ├── Test        (vitest run)
  ├── Build       (vite build)
  └── Audit       (npm audit --production --high)
  
Types-drift workflow runs (only if relevant paths changed)
  └── Git-timestamp comparison

All green → merge allowed
Any red  → PR blocked
```

## Error handling (of the setup itself)

- **Biome surfaces >50 hand-fix errors** (after auto-fix): implementer pauses, reports errors grouped by rule. Decision point: either (a) fix all, (b) relax one rule (most likely `noFloatingPromises` if too many async Supabase calls in JSX handlers surface), or (c) inline-suppress specific cases with `// biome-ignore` comments.
- **Strict TS surfaces significantly more than 29 errors:** likely means `lib/database.types.ts` is out of date (but we just regenerated it in the critical-remediation PR, so this is improbable). Regen first, re-count.
- **A test is flaky:** forbidden. Flaky test = task incomplete. Write a deterministic version or remove.
- **CI flaky** (npm registry timeout, etc.): acceptable; use `actions/setup-node`'s built-in retry. If persistent, add `uses: nick-fields/retry@v3` wrapper.
- **Types-drift false positive** after a merge-commit rewrites timestamps: documented escape is `touch -d "$(date -u)" lib/database.types.ts && git commit -am "chore: bump types mtime"` — this takes 15 seconds; not worth engineering around.

## Testing (of the setup itself)

- **Biome:** run `npx biome check modules/products/ProductsModule.tsx` on an unmodified copy — expect `noAlert` error for the `window.confirm` call. If it doesn't fire, the config is wrong.
- **Strict TS:** temporarily revert `modules/team/mappers.ts:104` to `as unknown as null` — expect `tsc --noEmit` to fail. If it doesn't, strict isn't actually on.
- **Vitest:** write one passing test (`lib/format.test.ts` with `formatPrice(100) === '100,00 MAD'`); one failing test; remove the failing test. Verify both behaviors.
- **CI:** open a throwaway PR that adds a single `console.log` to a JSX component — expect CI to go red on lint. Remove it, expect green.
- **Types-drift:** open a PR that adds a noop migration file but doesn't touch `lib/database.types.ts` — expect types-drift workflow to fail. Regenerate types, expect green.

## Risk register

- **`noFloatingPromises` may fire broadly.** Supabase's async-heavy API means many places (especially mutation `onClick` handlers) may have unawaited promises. Mitigation: if auto-fix count exceeds 30, relax rule to `warn` for Plan B.
- **Strict TS may surface errors in `types.ts` hand-written domain types** that the 29-error count missed because they're not directly imported from generated types. Mitigation: if cascade goes past ~50, pause and evaluate relaxing one flag.
- **Vitest + Vite 6 + React 19 is bleeding-edge.** Vitest 4.1 was released within the last 60 days. Stability is fine but docs still in flux. Mitigation: pin exact version in `package.json`, not a `^`-range that could pull a breaking patch.
- **Types-drift may race with merges.** If two PRs in flight each regenerate types, one wins; second has conflict. Acceptable — dev rebases and regenerates.

## Scale estimate

- Biome: 2h (install + config + auto-fix + hand-fix + verify)
- Strict TS: 4-6h (29 errors, serial fix + ripple check)
- Vitest: 6h (setup + 75 tests + verify)
- CI: 1h (workflow + branch protection update)
- Types-drift: 30m
- **Total: 13-15h** — one to two focused days of work.

## Definition of done

- [ ] `biome.jsonc` committed; `npm run lint` is clean.
- [ ] `tsc --noEmit` with `strict: true` returns 0 errors.
- [ ] `npm test` runs ≥70 tests, all passing, <5 seconds total.
- [ ] `.github/workflows/ci.yml` is committed; at least one PR has turned this green.
- [ ] Branch protection on `main` requires the `check` status context.
- [ ] `.github/workflows/types-drift.yml` is committed; verified to fire on a test PR and block.
- [ ] `package.json` has `lint`, `lint:fix`, `format`, `test`, `test:watch` scripts.
- [ ] No regressions: the existing app still builds, deploys, and runs correctly.

## Out of scope — follow-up plan

Not in this spec; belongs to "Production Hardening" (Plan B, next):

- Sentry + error reporting wiring (needs staging DSN first).
- CSP + HSTS headers in `vercel.json`.
- `.env.example` and README rewrite.
- Staging Supabase project (€25/month decision).
- Playwright smoke tests (3-4 critical flows against staging).
- Backup runbook + RTO/RPO.
- React Compiler pilot.

---

**Spec self-review checklist:**

- No `TBD` / `TODO` placeholders — all specifics nailed down.
- Internal consistency: Biome 2.4 mentioned once, Vitest 4.1 mentioned once; TS error count (29) stated once with breakdown. No contradictions.
- Ambiguity: every rule severity is explicit; every version is pinned; every file path is absolute within the repo.
- Scope: 5 tasks, 13-15h effort, one PR. Fits one implementation plan.
