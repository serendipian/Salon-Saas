# Idle-Tab Resilience — Design

**Date:** 2026-04-13
**Status:** Approved, ready for implementation plan
**Scope:** Full hardening of auth, realtime, and mutation layers against tab-idle degradation

## Problem

Paying salon users report three symptoms after leaving the tab idle:

1. **Save buttons go dead.** Clicking "Confirm" on a POS transaction or "Save" on an appointment form produces no navigation, no error toast, no network request. Only a hard refresh unblocks it.
2. **Dashboard KPIs stay empty** on return until manual refresh.
3. **Realtime updates stop.** New appointments or transactions added by another user don't appear without a refresh.

Manual diagnosis identified three root causes, all traced to the Supabase client degrading silently while the browser suspends or throttles the tab:

- **L1 — Custom auth-lock mutex in `lib/supabase.ts` queues requests indefinitely when a previous token-refresh hangs.** It ignores the `acquireTimeout` parameter the SDK passes in and provides no timeout around the locked function. A stuck `getSession()` poisons every subsequent auth call; new mutations never reach the fetch layer, so the existing 30s fetch timeout never fires.
- **L2 — Realtime WebSocket dies silently during tab suspension.** `useConnectionStatus` has a `visibilitychange` listener, but it only re-evaluates a UI flag; it does not probe the socket or force resubscription. `useRealtimeSync` has no visibility awareness at all.
- **L3 — TanStack Query has `refetchOnWindowFocus: false`** globally, so stale queries (dashboard KPIs) do not refresh when the tab regains focus. Mutations have no timeout at the TanStack layer.

The earlier fix (commit `fd99752`, "global fetch timeout") added a 30s guard at the `fetch()` layer. That guard cannot help here because the hang happens *above* fetch, inside the auth mutex.

`@supabase/supabase-js` is `^2.100.1`, well past the version (2.45) that fixed the `navigator.locks` bug the custom mutex was working around. The mutex is no longer needed.

## Goals

- Save buttons either succeed or surface a user-visible error within 30 seconds, always.
- Dashboard KPIs and calendar refresh within ~2 seconds of a user returning from idle.
- Realtime subscriptions recover automatically without a manual page refresh.
- Recovery is observable via an existing UI affordance (the connection-status dot), not a modal overlay.
- Safe rollback: a runtime kill switch disables the new behavior without a redeploy.

## Non-goals

Seven items intentionally excluded; tracked in `2026-04-13-idle-tab-resilience-followups.md`:

1. Client idempotency keys for non-idempotent RPCs.
2. Phase 2 mutation-timeout wrapping for non-critical modules.
3. Automated test suite (Vitest setup).
4. External telemetry (Sentry, etc.).
5. Eventual removal of the `idle_recovery_enabled` feature flag.
6. Dashboard "today" staleness across midnight (separate bug).
7. Storage upload resilience (avatar uploads use a different Supabase API).

## Architecture Overview

Five independent layers, stacked for defense in depth. Each layer is reviewable, committable, and revertable on its own.

```
L1  Delete the custom auth-lock mutex in lib/supabase.ts. Trust SDK default.
L2  QueryClient config: refetchOnWindowFocus: true (keep staleTime: 5min).
L3  Recovery hub: extend useConnectionStatus to orchestrate idle-return
    recovery (auth probe → realtime reset → query invalidation).
L4  Realtime reset primitive (lib/realtimeReset.ts): monotonic epoch
    consumed by every module that owns a Supabase channel.
L5  Mutation timeout guard (lib/mutations.ts): withMutationTimeout wrapper
    with deterministic timeout + AbortSignal threading.
```

Single recovery orchestrator lives in `useConnectionStatus`. It already owns visibility monitoring and WebSocket health; it gains three new responsibilities: decide when to recover, run the recovery sequence, and surface state via the existing UI dot.

### Recovery state machine

```
healthy ──(hidden >30s + visible)──► recovering ──(success)──► healthy
   ▲                                     │
   │                                     ├──(network error)──► offline ──► (retry 10s)
   │                                     │
   │                                     └──(auth error)──► signOut → /login
   │
   └──(WS CLOSED/TIMED_OUT while visible)──► recovering
```

The UI dot reuses the existing color scheme: green (`connected`), orange (`recovering` or `reconnecting`), red (`disconnected` or `offline`). No new UI components.

### Recovery sequence (inside `useConnectionStatus`)

Each step has its own timeout; failures route to specific state transitions rather than blocking.

1. **Guard.** If `recoveryInFlight` is true, or the feature flag is off, or the last recovery completed <60s ago, return. The rate-limit prevents a storm of recoveries if realtime stays broken and the user keeps tab-switching.
2. **Enter `recovering` state.** Notify listeners; dot goes orange.
3. **Auth probe: `Promise.race([supabase.auth.getUser(), timeout(5s)])`.** `getUser()` (not `getSession()`) because it round-trips to Supabase and returns a real 401 on token rejection. Classify the result:
   - Success with user → continue.
   - Success without user → user was signed out elsewhere; stop, AuthContext handles the redirect.
   - `NetworkError` / `AbortError` → transition to `offline`, schedule retry in 10s, bail. Do NOT sign out — the user's internet is down, signing them out would send them to a `/login` page they cannot load.
   - `401` / `invalid_grant` / `refresh_token_not_found` → call `supabase.auth.signOut()`. AuthContext's `onAuthStateChange` fires `SIGNED_OUT`, clears state, and `ProtectedRoute` redirects to `/login`. No router access needed from the hub.
4. **Reset realtime.** Call `resetAllChannels()` from the L4 primitive. Epoch bump causes every dependent hook (useRealtimeSync, AuthContext's two channels) to tear down and recreate their subscriptions with fresh auth. Fire-and-forget removal — a hung `removeChannel` must not block recovery.
5. **Restart the connection monitor.** `stopMonitoring(); startMonitoring()` inline (the monitor lives in this same module; no epoch indirection needed). Attach a *one-shot* listener on a transient `recovery-probe` channel, race its `SUBSCRIBED` event against a 10s timeout.
   - Probe subscribes within 10s → realtime transport is healthy. Proceed.
   - Probe times out → do NOT promote to `connected`. Stay on `reconnecting` (orange). Future WS status events can still promote to green when the per-table channels re-handshake. This is a proxy signal — probe success implies infrastructure is up; per-table channels will resubscribe through the same mechanism.
6. **Query invalidation.** `queryClient.invalidateQueries({ refetchType: 'active' })`. Only refetches currently-rendered queries. Dashboard refetches if on dashboard, calendar if on calendar. Other cached data is marked stale and refetches on next access.
7. **Enter `connected` state.** Green dot. Existing "Connexion rétablie" toast fires via the prevStateRef effect already in the hook.
8. **Clear `recoveryInFlight`; stamp `lastRecoveryAt`.**

### During `recoveryInFlight`

The connection-monitor channel's `.subscribe(status => ...)` callback emits `CLOSED` during the intentional teardown in step 4. Without suppression, the dot would flicker red mid-recovery. The monitor's status handler gains a guard: `if (recoveryInFlight) return`.

### Visibility listener

```
visible → hidden:  hiddenSince = Date.now()
hidden → visible:  if (hiddenSince && elapsed > 30_000) triggerRecovery()
                   else  evaluateStateInternal()   // short flicker, no recovery
                   hiddenSince = null
```

A 2-second tab switch should not trigger a recovery cycle; 30 seconds is the threshold.

## L4 — Realtime Reset Primitive

**File:** `lib/realtimeReset.ts`

```ts
let epoch = 0;

export function getRealtimeEpoch(): number { return epoch; }
export function useRealtimeEpoch(): number { /* useSyncExternalStore */ }
export function resetAllChannels(): void {
  epoch++;
  console.log('[recovery] realtime reset, epoch=', epoch);
  /* notify listeners */
}
```

A monotonic counter, not a boolean. When a consumer's `useEffect` deps include the epoch, React's standard dep-diff machinery triggers cleanup-then-re-run on bump. No custom state machine.

### Consumer invariant (documented in header comment)

Any module that creates a `supabase.channel(...)` must either (a) use `useRealtimeSync`, which reads the epoch internally, or (b) add `useRealtimeEpoch()` to its effect deps. Violating this invariant means a channel that silently survives recovery and stays dead.

### Current consumers (three sites)

1. `hooks/useRealtimeSync.ts` — add epoch to the subscribe-effect deps. The refcounted subscription manager handles tearing down and recreating the shared channel: when all consumers' effects cleanup due to epoch change, refcount drops to zero, `removeChannel()` fires, the map entry is deleted; when effects re-run, a fresh entry is created. React 19 runs all cleanups before all re-runs in the same commit, making this ordering deterministic.
2. `context/AuthContext.tsx` — both the `salon-tier:{id}` effect and the `memberships:{user.id}` effect add epoch to their deps.
3. `hooks/useConnectionStatus.ts` — the `connection-monitor` channel is reset inline by the recovery hub itself (step 5), not via epoch. Same module, simpler.

### API surface

Exported: `getRealtimeEpoch()`, `useRealtimeEpoch()`, `resetAllChannels()`. Nothing else. Non-React subscribers are not needed in this codebase.

## L5 — Mutation Timeout Guard

**File:** `lib/mutations.ts`

```ts
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Mutation exceeded ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a mutationFn with a deterministic timeout.
 * Uses Promise.race so the timeout fires even if the inner fn ignores the signal.
 * Best-effort aborts the underlying fetch via AbortController.
 *
 * DO NOT double-wrap. Inner wrapping breaks outer signal propagation.
 */
export function withMutationTimeout<TInput, TOutput>(
  fn: (input: TInput, signal: AbortSignal) => Promise<TOutput>,
  timeoutMs: number = 30_000,
): (input: TInput) => Promise<TOutput> {
  return async (input) => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        console.warn('[mutation-timeout] ms=', timeoutMs);
        reject(new TimeoutError(timeoutMs));
      }, timeoutMs);
    });
    try {
      return await Promise.race([fn(input, controller.signal), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };
}
```

**Why `Promise.race` instead of awaiting `fn` and relying on the signal.** If a call site forgets to thread the signal into its Supabase call, a signal-based abort would cancel nothing, and `await fn(...)` would hang indefinitely. `Promise.race` makes the timeout deterministic regardless of call-site correctness. Threading `signal` into Supabase calls remains best practice — it aborts the underlying fetch to prevent wasted server work — but correctness no longer depends on it.

### Call sites (Phase 1)

Every mutation that either navigates on success or touches money/scheduling:

- `hooks/useTransactions.ts` — `addTransactionMutation`, `voidMutation`, `refundMutation`
- `modules/appointments/hooks/useAppointments.ts` — `addAppointmentMutation`, `updateAppointmentMutation`, `addAppointmentGroupMutation`, `updateStatusMutation`, `editAppointmentGroupMutation`, `deleteAppointmentMutation`

Pattern:
```ts
const addTransactionMutation = useMutation({
  mutationFn: withMutationTimeout(async (input, signal) => {
    const { error } = await supabase.rpc('create_transaction', payload).abortSignal(signal);
    if (error) throw error;
  }, 30_000),
  onError: toastOnError('Impossible de créer la transaction'),
});
```

### Toast classification

`hooks/useMutationToast.ts` gains a first-branch check that routes both `TimeoutError` instances AND error messages containing `"La requête a expiré"` (the fetch-layer timeout from `lib/supabase.ts:40`) to the same French message:

> "Connexion instable. Votre demande n'est peut-être pas arrivée — vérifiez avant de réessayer."

The copy is deliberate. For non-idempotent RPCs (notably `create_transaction`), a client-side timeout does not guarantee the server didn't complete the write. Until client idempotency keys are built (follow-up #1), the toast sets correct user expectations. Appointment double-booking is caught server-side by the `23P01` exclusion constraint; POS carries residual duplicate risk documented in the follow-up.

### Why not global TanStack defaults

`mutationCache` defaults do not pass an `AbortSignal` into the mutationFn. Per-call wrapping keeps the signal explicit and threadable into Supabase's `.abortSignal(signal)` chain method.

## L2 — QueryClient Config

**File:** `index.tsx`

Change:
```ts
defaultOptions: {
  queries: {
    staleTime: 1000 * 60 * 5,   // keep
    gcTime: 1000 * 60 * 10,     // keep
    retry: 1,                   // keep
    refetchOnWindowFocus: true, // was false
    refetchOnReconnect: true,   // explicit (already default)
  },
  mutations: { retry: 0 },      // keep
}
```

With `staleTime: 5min`, only queries older than 5 minutes refetch on focus. A rapid tab-switch does not hammer Supabase. Dashboard after 10-minute idle: every query is stale, every active query refetches once. Bounded cost, large UX win.

## L1 — Delete the Custom Auth-Lock Mutex

**File:** `lib/supabase.ts`

Delete the `lock` function, the `_authLocks` map, the `withTimeout` helper, and the `AUTH_LOCK_TIMEOUT_MS` / `AuthWithLock` type cast. Retain `fetchWithTimeout` (the `global.fetch` wrapper) — it remains useful for non-mutation calls (queries, auth operations).

Result: `createClient` uses the SDK default, which handles `navigator.locks` correctly in v2.100.1 and falls back to `processLock` when `locks` is unavailable (in-app browsers, old WebViews).

If post-deploy observation shows auth hangs return, the rollback is to re-add a *correctly written* mutex that honors `acquireTimeout` AND wraps `fn` in its own timeout — not to re-introduce the broken one.

## Feature Flag

**Key:** `localStorage['idle_recovery_enabled']`
**Default:** enabled (missing key = on)
**Off value:** `'0'`

Read per-recovery-attempt (not cached), so a DevTools toggle takes effect immediately. localStorage reads wrapped in try/catch — incognito/privacy-locked browsers default to enabled.

When off: recovery hub is a no-op. L1, L2, L4, and L5 remain active (they are not gated). So the flag disables *idle-return recovery specifically*, not the entire fix.

Temporary by design. Revisit for removal around 2026-04-27 after two weeks of observed stability.

## Timing Constants

Centralized at the top of `useConnectionStatus.ts`:

```ts
const TIMINGS = {
  IDLE_RECOVERY_THRESHOLD_MS: 30_000,     // tab hidden duration before recovery fires
  AUTH_PROBE_TIMEOUT_MS: 5_000,           // getUser() race timeout
  REALTIME_PROBE_TIMEOUT_MS: 10_000,      // SUBSCRIBED wait before proceeding
  RECOVERY_RATE_LIMIT_MS: 60_000,         // minimum gap between recovery attempts
  DISCONNECT_BANNER_THRESHOLD_MS: 30_000, // existing, keep
} as const;
```

And in `lib/mutations.ts`:

```ts
const DEFAULT_MUTATION_TIMEOUT_MS = 30_000;
```

## Observability

Console-only. External telemetry is follow-up #4.

Recovery hub emits:
- `[recovery] start reason=visibility|ws`
- `[recovery] auth ok` / `[recovery] auth fail type=network|auth message=...`
- `[recovery] realtime reset epoch=N`
- `[recovery] probe subscribed` / `[recovery] probe timeout`
- `[recovery] queries invalidated`
- `[recovery] done state=<state> ms=<n>`

Mutation wrapper emits:
- `[mutation-timeout] ms=<n>` before throwing `TimeoutError`

Recommend opening DevTools console during the first days of rollout.

## Test Matrix (Manual)

No automated test harness exists (follow-up #3). Execute before merge:

| # | Scenario | Simulation | Expected |
|---|---|---|---|
| 1 | Idle >30s, return, POS save | DevTools Network offline 45s → online; return to tab | Orange → green dot; save succeeds; no hang |
| 2 | Idle >30s, return, calendar open | Tab hidden 2min, return | Orange → green; new appointments appear without refresh |
| 3 | Idle >10min, dashboard | Tab hidden 10min, return | KPIs refetch visibly; orange → green |
| 4 | Mutation hang | DevTools block `*rpc*` pattern; click save | TimeoutError toast at 30s; button re-enables |
| 5 | Expired refresh token | Delete `sb-*-refresh-token` from localStorage; idle; return | Sign-out + redirect to `/login` + "Session expirée" toast |
| 6 | Offline return | DevTools offline + idle 60s + return | Red dot + offline toast; NO sign-out; recovers when online |
| 7 | Short tab switch | Alt-tab 5s, return | No recovery; no dot flicker |
| 8 | Multi-tab | Open app in 2 tabs, idle both, return to one | Only active tab recovers; other unaffected |
| 9 | Feature flag off | `localStorage.setItem('idle_recovery_enabled', '0')`; idle; return | Old behavior (page refresh needed); L5 still protects mutations |
| 10 | Salon switch during idle | Admin changes user's role in tab B while tab A is idle; return to A | Recovery fires with activeSalon=A; memberships channel delivers update; UI reflects new role |
| 11 | Password change in another tab | Tab B: change password; tab A (idle) returns | Auth probe returns 401; tab A signs out + redirects |
| 12 | Pending mutation at idle start | Click save, background tab 1s later | Mutation times out at 30s from original click, independent of recovery; toast appears on return |

## Rollback

**Runtime kill switch.** `localStorage.setItem('idle_recovery_enabled', '0')` disables recovery without a deploy. Read per-attempt, effect is immediate.

**Code-level rollback.** Five commits, one per layer, in this order (chosen so any partial revert still type-checks):

1. L1 — delete custom mutex
2. L2 — QueryClient config change
3. L4 — `lib/realtimeReset.ts` primitive
4. L3 — recovery hub in `useConnectionStatus`
5. L5 — `lib/mutations.ts` + migrate Phase 1 call sites

Reverting L5 restores the old direct `useMutation` call sites. Reverting L3 removes recovery orchestration but leaves the L4 primitive and L5 guards in place. Reverting L1 without care may re-introduce the mutex bug — the rule is "if auth hangs return, write a correct mutex, don't restore the broken one."

**Deploy.** Single merge to `main` → Vercel auto-deploy. No migration, no env vars.

## Out of Scope

See `2026-04-13-idle-tab-resilience-followups.md`. Seven items tracked: idempotency keys, Phase 2 mutation wrapping, test infrastructure, external telemetry, flag removal, midnight-staleness bug, storage upload resilience.
