# Idle-Tab Resilience — Deferred Follow-ups

Tracked items deliberately left out of the 2026-04-13 idle-tab-resilience design. These are real improvements with real value, but each is large enough to warrant its own spec and none block shipping the core fix.

## 1. Client idempotency keys for non-idempotent RPCs

**Problem.** With the mutation timeout guard in place (L5 of the resilience fix), a timed-out mutation may still complete server-side. A user retry creates a duplicate. Appointment double-booking is caught server-side by the `23P01` exclusion constraint. POS has no equivalent guard: a 30s timeout followed by retry risks a duplicate `create_transaction`, which for a real salon means a double-charge.

**Proposed solution.** Client generates a UUID idempotency key per mutation attempt. Server-side RPCs (`create_transaction` first; extend to other non-idempotent writes) accept the key, check a short-lived `idempotency_keys` table (salon-scoped, 1h TTL), and return the existing result if the key is already known.

**Why deferred.** Requires a server migration (new table, RLS policies, index, changes to every non-idempotent RPC signature) plus client-side key generation/passing. Roughly 2-3 days. The core resilience fix delivers most of the value without this; the toast copy ("vérifiez avant de réessayer") sets correct expectations in the meantime.

## 2. Phase 2 — wrap remaining mutations with the timeout guard

**Problem.** The resilience plan wraps only high-stakes mutations (POS + Appointments). Every other module (clients, services, products, settings, team, suppliers, accounting, billing) still calls Supabase directly without a mutation-layer timeout. If any of these hang post-idle, the user gets a dead button.

**Proposed solution.** Mechanically migrate every `useMutation({ mutationFn: async () => { ... } })` across the remaining modules to `withMutationTimeout(async (input, signal) => { ... })` + thread `.abortSignal(signal)` into Supabase calls.

**Why deferred.** Roughly 30-40 mutations to migrate, each a small identical change. Low risk but high volume. Safer to ship the high-value Phase 1 first, gather production observability on timeout frequency, then do Phase 2 as a single mechanical PR.

## 3. Automated test suite

**Problem.** The project has no Vitest/Jest setup. The resilience fix validates via a manual test matrix only — correct-by-checklist, not correct-by-CI.

**Proposed solution.** Add Vitest + jsdom + React Testing Library. Write tests for the recovery hub state machine, the timeout helper, the realtime reset primitive, and the `useMutationToast` error classification. Over time, backfill tests for existing hooks where regression risk is highest (auth, billing, POS).

**Why deferred.** Test infrastructure is a standalone ~1 day project with its own design decisions (test runner choice, how to mock Supabase, snapshot vs. behavior testing). Bundling it with the resilience fix would roughly double the work and delay shipping the user-visible fix.

## 4. External telemetry / observability

**Problem.** The resilience fix logs recovery events to `console.*`. That's useful during manual rollout monitoring but gives us no signal once the PR is merged and users are in the wild. We won't know if mutation timeouts fire 10× or 10,000× per day.

**Proposed solution.** Wire Sentry (or equivalent) and emit structured events: `recovery.started`, `recovery.completed`, `recovery.auth_failed`, `mutation.timeout`. Dashboard on event rates to spot regressions.

**Why deferred.** External telemetry is a cross-cutting concern that belongs in its own spec (what do we emit? PII policy? cost?). It would be valuable well beyond this one fix, so shouldn't be designed narrowly as a sidecar to resilience.

## 5. Remove the `idle_recovery_enabled` feature flag

**Problem.** The flag is a rollout safety net. Once the fix is observed stable in production for ~2 weeks, the flag becomes legacy cruft that adds a conditional to every recovery attempt and a setting nobody knows exists.

**Proposed solution.** Two-line PR that deletes the flag read and its default; recovery always enabled.

**Why deferred.** By design — the flag must exist for the rollout window to be useful. Calendar reminder: revisit around 2026-04-27.

## 6. Dashboard "today" staleness across midnight

**Problem.** Unrelated to idle-tab resilience, but observed while investigating: if a user sits on the dashboard past midnight local time, the "today" view shows yesterday's date until refresh. The resilience fix's `refetchOnWindowFocus: true` partially mitigates (a focus event would refetch), but a single long session on one tab still shows stale date.

**Proposed solution.** A small `useClockTick` hook that invalidates date-scoped queries when the local date changes. Or server-side midnight-aware query keys.

**Why deferred.** Separate bug, separate root cause. Surfaced during resilience investigation; noted here so we don't forget.

## 7. Storage upload resilience (avatar uploads)

**Problem.** The Phase 1 mutation guard covers Postgres RPCs and table writes. `supabase.storage.from(bucket).upload(...)` uses a different API (`{ signal }` option, not `.abortSignal()`). Avatar uploads in `useAvatarUpload.ts` are not wrapped.

**Proposed solution.** Extend `withMutationTimeout` call sites to storage uploads, threading `signal` into the upload's options object.

**Why deferred.** Avatar uploads are low-frequency and large (files, not JSON), so the 30s default doesn't fit. Needs its own timeout tuning and progress-UI consideration.
