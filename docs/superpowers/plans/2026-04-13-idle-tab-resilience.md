# Idle-Tab Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent degradation of the app after tab-idle periods — dead save buttons, empty dashboard, stale realtime — by rebuilding auth/realtime/query recovery as an orchestrated sequence triggered on return from idle.

**Architecture:** Five independent layers stacked for defense-in-depth. L1 deletes the broken auth-lock mutex (trust SDK default). L2 enables focus-refetch in TanStack Query. L3 extends `useConnectionStatus` into a recovery hub that orchestrates auth probe → realtime reset → query invalidation on visibility return. L4 adds a monotonic-epoch reset primitive consumed by every module that owns a Supabase channel. L5 adds a deterministic mutation-timeout wrapper with `AbortSignal` threading. Feature-flagged via localStorage for runtime rollback.

**Tech Stack:** TypeScript, React 19, @supabase/supabase-js@2.100.1, @tanstack/react-query@5.95, Vite 6.

**Design spec:** `docs/superpowers/specs/2026-04-13-idle-tab-resilience-design.md`
**Deferred follow-ups:** `docs/superpowers/specs/2026-04-13-idle-tab-resilience-followups.md`

**Test infrastructure note:** This project has no automated test framework (Vitest/Jest). Validation is **manual** via the test matrix in Task 11. Adding a test framework is deferred follow-up #3.

---

## File Map

**Create:**
- `lib/realtimeReset.ts` — Epoch primitive + `resetAllChannels()` (Task 3)
- `lib/mutations.ts` — `withMutationTimeout` helper + `TimeoutError` class (Task 7)

**Modify:**
- `lib/supabase.ts` — Delete custom mutex (Task 1)
- `index.tsx` — QueryClient config (Task 2)
- `hooks/useRealtimeSync.ts` — Consume epoch (Task 4)
- `context/AuthContext.tsx` — Consume epoch in two effects (Task 5)
- `hooks/useConnectionStatus.ts` — Rewrite as recovery hub (Task 6)
- `hooks/useMutationToast.ts` — Classify `TimeoutError` + fetch-timeout string (Task 8)
- `hooks/useTransactions.ts` — Wrap 3 mutations (Task 9)
- `modules/appointments/hooks/useAppointments.ts` — Wrap 6 mutations (Task 10)

---

## Task 1: L1 — Delete the custom auth-lock mutex

**Goal:** Remove the broken mutex so Supabase SDK's default `navigator.locks` (v2.100.1) handles token refresh correctly.

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Replace `lib/supabase.ts` with the simplified version**

Replace the entire file contents with:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

// Global fetch wrapper with 30s timeout to prevent indefinite hangs
// (network stalls, browser connection limits). Supabase SDK's default
// navigator.locks handling is trusted as of @supabase/supabase-js >= 2.45.
const FETCH_TIMEOUT_MS = 30_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const existingSignal = init?.signal;
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError' && !existingSignal?.aborted) {
        throw new Error('La requête a expiré (30s). Vérifiez votre connexion et réessayez.');
      }
      throw err;
    })
    .finally(() => clearTimeout(timeoutId));
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

- [ ] **Step 2: Verify the app still compiles and starts**

Run: `npm run dev`
Expected: Vite starts on port 3000, no type errors in console, login page loads.

- [ ] **Step 3: Verify session restores on reload**

Manual check: log in, hard-refresh the browser, confirm you stay logged in and the dashboard loads.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts
git commit -m "fix(auth): remove custom auth-lock mutex

Delete the JS-level mutex that was working around an old navigator.locks
bug in @supabase/supabase-js. The bug was fixed in 2.45 and we're on
2.100.1. The custom mutex ignored acquireTimeout and had no timeout
around the locked fn, causing save-button hangs after tab-idle when
token refresh stalled."
```

---

## Task 2: L2 — Enable refetch-on-window-focus

**Goal:** Dashboard KPIs and other stale queries refetch when the user returns to the tab.

**Files:**
- Modify: `index.tsx:7-19`

- [ ] **Step 1: Change the QueryClient config**

In `index.tsx`, replace lines 7-19 with:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Open dashboard, switch to another tab for >5 minutes, switch back.
Expected: Network tab shows refetches for dashboard queries.

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "fix(queries): refetch on window focus and reconnect

Enable refetchOnWindowFocus + refetchOnReconnect at the QueryClient
default level. staleTime: 5min bounds the cost — only stale queries
refetch on focus, so rapid tab-switching does not hammer Supabase."
```

---

## Task 3: L4 — Create the realtime reset primitive

**Goal:** A module-level monotonic epoch that every Supabase-channel owner can consume to rebuild channels in lockstep.

**Files:**
- Create: `lib/realtimeReset.ts`

- [ ] **Step 1: Create `lib/realtimeReset.ts`**

```ts
import { useSyncExternalStore } from 'react';

/**
 * Realtime Reset Primitive
 *
 * A monotonic epoch counter. Every module that owns a Supabase channel
 * must include `useRealtimeEpoch()` in its effect's dep array (or use
 * `useRealtimeSync`, which reads it internally). When `resetAllChannels()`
 * is called, the epoch bumps and React's standard effect dep-diff
 * triggers cleanup-then-rerun on every consumer — tearing down old
 * channels and creating fresh ones with current auth.
 *
 * Correctness note: React 19 runs all cleanups before all re-runs in
 * the same commit, so refcounted subscription managers (see
 * `useRealtimeSync.ts`) see refcount drop to zero, removeChannel fires,
 * then a fresh channel is created.
 *
 * Invariant: any module creating a supabase.channel(...) MUST either
 * (a) use `useRealtimeSync`, or
 * (b) add `useRealtimeEpoch()` to its effect deps.
 * Violating this means a zombie channel that survives recovery.
 */

let epoch = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function getRealtimeEpoch(): number {
  return epoch;
}

export function resetAllChannels(): void {
  epoch++;
  console.log('[recovery] realtime reset, epoch=', epoch);
  notify();
}

export function useRealtimeEpoch(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => epoch,
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build` (or let Vite dev-server pick it up; a syntax error would show in the terminal).
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add lib/realtimeReset.ts
git commit -m "feat(realtime): add realtime reset primitive

Monotonic epoch + useRealtimeEpoch hook. Consumers add the epoch to
their effect deps; resetAllChannels() bumps it, triggering coordinated
teardown + rebuild of every Supabase channel in the app.

No consumers yet — they're added in subsequent commits."
```

---

## Task 4: L4 consumer — `useRealtimeSync` reads the epoch

**Goal:** Every per-table realtime subscription rebuilds when the epoch bumps.

**Files:**
- Modify: `hooks/useRealtimeSync.ts:81-101`

- [ ] **Step 1: Modify the hook to consume the epoch**

In `hooks/useRealtimeSync.ts`, add an import and extend the effect:

Replace line 1-6:
```ts
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRealtimeEpoch } from '../lib/realtimeReset';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
```

Replace the `useRealtimeSync` function (lines 81-101):
```ts
export function useRealtimeSync(tableName: string, options?: RealtimeSyncOptions) {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const epoch = useRealtimeEpoch();

  // Store onEvent in a ref so we always call the latest version
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Stable handler that delegates to the ref — this identity is used for registration
  const stableHandler = useCallback((payload: EventPayload) => {
    queryClient.invalidateQueries({ queryKey: [tableName, salonId] });
    onEventRef.current?.(payload);
  }, [tableName, salonId, queryClient]);

  useEffect(() => {
    if (!salonId) return;

    return subscribe(tableName, salonId, stableHandler, options?.filterOverride);
    // epoch is in deps so a resetAllChannels() bump tears down and resubscribes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, salonId, stableHandler, options?.filterOverride, epoch]);
}
```

- [ ] **Step 2: Verify the app still runs**

Run: `npm run dev`
Open the app, navigate to the calendar, confirm appointments load and no console errors.

- [ ] **Step 3: Manually trigger a reset from the console**

In DevTools console:
```js
// import via window hack — or just verify the app-initiated path in Task 6
// For now, just confirm the app runs without regressions.
```

(A full reset-triggered resubscribe verification happens in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add hooks/useRealtimeSync.ts
git commit -m "feat(realtime): useRealtimeSync consumes reset epoch

Add useRealtimeEpoch to the subscribe effect deps. When
resetAllChannels() bumps the epoch, every per-table subscription
tears down and rebuilds with fresh auth."
```

---

## Task 5: L4 consumer — AuthContext channels read the epoch

**Goal:** The two channels owned by AuthContext (`salon-tier:{id}` and `memberships:{user.id}`) also rebuild on reset.

**Files:**
- Modify: `context/AuthContext.tsx`

- [ ] **Step 1: Add the import**

At the top of `context/AuthContext.tsx`, add after the existing imports:

```ts
import { useRealtimeEpoch } from '../lib/realtimeReset';
```

- [ ] **Step 2: Read the epoch inside the provider**

Inside `AuthProvider`, right after the existing `activeSalonRef.current = activeSalon;` line (around line 59-60), add:

```ts
  const epoch = useRealtimeEpoch();
```

- [ ] **Step 3: Add epoch to the salon-tier effect deps**

Find the effect at line 228-269 (`Real-time salon tracking`). Change its dependency array on line 269 from:
```ts
  }, [activeSalon?.id]);
```
to:
```ts
  }, [activeSalon?.id, epoch]);
```

- [ ] **Step 4: Add epoch to the memberships effect deps**

Find the effect at line 272-320 (`Real-time membership tracking`). Change its dependency array on line 320 from:
```ts
  }, [user, fetchMemberships]);
```
to:
```ts
  }, [user, fetchMemberships, epoch]);
```

- [ ] **Step 5: Verify the app runs**

Run: `npm run dev`
Log in, confirm dashboard loads, no console errors.

- [ ] **Step 6: Commit**

```bash
git add context/AuthContext.tsx
git commit -m "feat(auth): AuthContext channels consume reset epoch

Both salon-tier and memberships realtime channels now rebuild when
resetAllChannels() bumps the epoch, keeping them in lockstep with
every other Supabase channel in the app."
```

---

## Task 6: L3 — Rewrite `useConnectionStatus` as the recovery hub

**Goal:** Central orchestrator for idle-return recovery. Owns visibility monitoring, auth probe, realtime reset, query invalidation, and UI state.

**Files:**
- Modify: `hooks/useConnectionStatus.ts` (near-full rewrite)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `hooks/useConnectionStatus.ts` with:

```ts
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { resetAllChannels } from '../lib/realtimeReset';

export type ConnectionState =
  | 'connected'
  | 'recovering'
  | 'reconnecting'
  | 'disconnected'
  | 'offline';

// ---- Timing constants ---------------------------------------------------

const TIMINGS = {
  /** Tab must be hidden this long before return-to-visible triggers recovery. */
  IDLE_RECOVERY_THRESHOLD_MS: 30_000,
  /** supabase.auth.getUser() race timeout during recovery. */
  AUTH_PROBE_TIMEOUT_MS: 5_000,
  /** Wait for transient probe channel to hit SUBSCRIBED. */
  REALTIME_PROBE_TIMEOUT_MS: 10_000,
  /** Minimum gap between recovery attempts. */
  RECOVERY_RATE_LIMIT_MS: 60_000,
  /** Existing: how long reconnecting must last before the UI says "disconnected". */
  DISCONNECT_BANNER_THRESHOLD_MS: 30_000,
  /** Retry delay after an offline probe failure. */
  OFFLINE_RETRY_MS: 10_000,
} as const;

// ---- Feature flag -------------------------------------------------------

function isRecoveryEnabled(): boolean {
  try {
    return localStorage.getItem('idle_recovery_enabled') !== '0';
  } catch {
    return true; // incognito / privacy-locked → default on
  }
}

// ---- Module-level singleton state --------------------------------------

let subscriberCount = 0;
let monitorChannel: ReturnType<typeof supabase.channel> | null = null;
let disconnectedAt: number | null = null;
let wasDisconnected = false;
let currentState: ConnectionState = 'connected';
let hiddenSince: number | null = null;
let recoveryInFlight = false;
let lastRecoveryAt = 0;
let offlineRetryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

function setState(next: ConnectionState) {
  if (currentState === next) return;
  currentState = next;
  notifyListeners();
}

// ---- Passive monitoring (existing behavior, preserved) ------------------

function evaluateStateInternal() {
  // Suppress during intentional teardown; recovery controls state directly.
  if (recoveryInFlight) return;
  // Offline sticks until a probe or network event clears it.
  if (currentState === 'offline') return;

  if (disconnectedAt === null) {
    if (wasDisconnected) wasDisconnected = false;
    setState('connected');
  } else {
    const elapsed = Date.now() - disconnectedAt;
    setState(
      elapsed >= TIMINGS.DISCONNECT_BANNER_THRESHOLD_MS ? 'disconnected' : 'reconnecting',
    );
  }
}

function startMonitoring() {
  if (monitorChannel) return;
  monitorChannel = supabase
    .channel('connection-monitor')
    .subscribe((status) => {
      if (recoveryInFlight) return; // ignore expected churn during recovery
      if (status === 'SUBSCRIBED') {
        disconnectedAt = null;
        evaluateStateInternal();
      } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        if (disconnectedAt === null) {
          disconnectedAt = Date.now();
          wasDisconnected = true;
        }
        evaluateStateInternal();
        // WS-initiated recovery when the tab is visible.
        if (document.visibilityState === 'visible') {
          void triggerRecovery('ws');
        }
      }
    });
}

function stopMonitoring() {
  if (monitorChannel) {
    supabase.removeChannel(monitorChannel);
    monitorChannel = null;
  }
}

// ---- Recovery orchestrator ---------------------------------------------

/**
 * classify a probe failure into a category the recovery sequence can act on.
 */
function classifyProbeError(err: unknown): 'network' | 'auth' {
  if (err instanceof Error) {
    const msg = err.message || '';
    if (
      err.name === 'AbortError' ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('La requête a expiré')
    ) {
      return 'network';
    }
  }
  // Supabase auth errors have { status: 401 } or similar
  if (err && typeof err === 'object') {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) return 'auth';
    const msg = String((err as { message?: string }).message || '');
    if (msg.includes('invalid_grant') || msg.includes('refresh_token_not_found')) {
      return 'auth';
    }
  }
  // Default conservatively to network so we don't kick users out incorrectly.
  return 'network';
}

async function probeAuth(): Promise<'ok' | 'signed-out' | 'network' | 'auth'> {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AbortError')), TIMINGS.AUTH_PROBE_TIMEOUT_MS),
      ),
    ]);
    if (result.error) {
      return classifyProbeError(result.error);
    }
    if (!result.data.user) return 'signed-out';
    return 'ok';
  } catch (err) {
    return classifyProbeError(err);
  }
}

async function probeRealtime(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const ch = supabase.channel(`recovery-probe-${Date.now()}`);
    const timeoutId = setTimeout(() => {
      supabase.removeChannel(ch);
      resolve(false);
    }, TIMINGS.REALTIME_PROBE_TIMEOUT_MS);

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeoutId);
        supabase.removeChannel(ch);
        resolve(true);
      }
    });
  });
}

async function triggerRecovery(reason: 'visibility' | 'ws'): Promise<void> {
  if (!isRecoveryEnabled()) {
    console.log('[recovery] skip reason=', reason, 'flag=off');
    return;
  }
  if (recoveryInFlight) {
    console.log('[recovery] skip reason=', reason, 'already-in-flight');
    return;
  }
  if (Date.now() - lastRecoveryAt < TIMINGS.RECOVERY_RATE_LIMIT_MS) {
    console.log('[recovery] skip reason=', reason, 'rate-limited');
    return;
  }

  recoveryInFlight = true;
  const startedAt = Date.now();
  console.log('[recovery] start reason=', reason);
  setState('recovering');

  try {
    // Step 3: auth probe
    const authResult = await probeAuth();
    console.log('[recovery] auth', authResult);

    if (authResult === 'signed-out') {
      // User was signed out elsewhere; AuthContext will handle the redirect.
      return;
    }
    if (authResult === 'network') {
      setState('offline');
      if (offlineRetryTimer) clearTimeout(offlineRetryTimer);
      offlineRetryTimer = setTimeout(() => {
        offlineRetryTimer = null;
        if (document.visibilityState === 'visible') {
          void triggerRecovery('visibility');
        }
      }, TIMINGS.OFFLINE_RETRY_MS);
      return;
    }
    if (authResult === 'auth') {
      await supabase.auth.signOut();
      // AuthContext.onAuthStateChange → SIGNED_OUT → ProtectedRoute redirect.
      return;
    }

    // Step 4: realtime reset
    resetAllChannels();

    // Step 5: restart the monitor and wait for a fresh SUBSCRIBED via probe channel
    stopMonitoring();
    startMonitoring();
    const realtimeOk = await probeRealtime();
    console.log('[recovery] probe', realtimeOk ? 'subscribed' : 'timeout');

    // Step 6: query invalidation
    if (lastQueryClient) {
      lastQueryClient.invalidateQueries({ refetchType: 'active' });
      console.log('[recovery] queries invalidated');
    }

    // Step 7: final state — only promote to connected if realtime probe succeeded
    if (realtimeOk) {
      disconnectedAt = null;
      setState('connected');
    } else {
      // Stay on reconnecting; future WS status events can promote to green.
      disconnectedAt = disconnectedAt ?? Date.now();
      setState('reconnecting');
    }
  } finally {
    recoveryInFlight = false;
    lastRecoveryAt = Date.now();
    console.log('[recovery] done state=', currentState, 'ms=', Date.now() - startedAt);
  }
}

// ---- QueryClient injection ---------------------------------------------
// The recovery sequence (module-level) needs access to a QueryClient.
// The hook below stashes the current one; this is safe because there is
// exactly one QueryClient in this app (created in index.tsx).

let lastQueryClient: QueryClient | null = null;

// ---- Visibility wiring --------------------------------------------------

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    hiddenSince = Date.now();
    return;
  }
  // visible
  const elapsed = hiddenSince !== null ? Date.now() - hiddenSince : 0;
  hiddenSince = null;
  if (elapsed >= TIMINGS.IDLE_RECOVERY_THRESHOLD_MS) {
    void triggerRecovery('visibility');
  } else {
    evaluateStateInternal();
  }
}

// ---- Public hook --------------------------------------------------------

export function useConnectionStatus(): ConnectionState {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const prevStateRef = useRef(currentState);

  // Stash the QueryClient for the module-level recovery sequence.
  lastQueryClient = queryClient;

  const state = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => currentState,
  );

  // Manage channel lifecycle + visibility listener via ref counting.
  useEffect(() => {
    subscriberCount++;
    if (subscriberCount === 1) startMonitoring();

    // Timer to transition from reconnecting → disconnected after 30s.
    const interval = setInterval(() => {
      if (disconnectedAt !== null && !recoveryInFlight) evaluateStateInternal();
    }, 5000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscriberCount--;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (subscriberCount === 0) {
        stopMonitoring();
        if (offlineRetryTimer) {
          clearTimeout(offlineRetryTimer);
          offlineRetryTimer = null;
        }
      }
    };
  }, []);

  // React to state transitions (reconnect → toast).
  useEffect(() => {
    if (prevStateRef.current !== 'connected' && state === 'connected') {
      queryClient.invalidateQueries({ refetchType: 'active' });
      addToast({ type: 'success', message: 'Connexion rétablie' });
    }
    if (prevStateRef.current !== 'offline' && state === 'offline') {
      addToast({
        type: 'warning',
        message: 'Hors ligne, vérifiez votre connexion.',
      });
    }
    prevStateRef.current = state;
  }, [state, queryClient, addToast]);

  return state;
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npm run dev`
Expected: no type errors, app loads.

- [ ] **Step 3: Verify existing ConnectionStatus UI still works**

Navigate around the app. Check DevTools console for `[recovery]` logs on background/foreground.

- [ ] **Step 4: Extend ConnectionStatus.tsx for the new states**

`components/ConnectionStatus.tsx` uses `Record<ConnectionState, string>` which requires every state value to have an entry. Without this edit, the build will fail.

In `components/ConnectionStatus.tsx`, replace lines 7-17 with:

```ts
const DOT_STYLES: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  recovering: 'bg-amber-500 animate-pulse',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
  offline: 'bg-red-500',
};

const TOOLTIP: Record<ConnectionState, string> = {
  connected: 'Connecté',
  recovering: 'Synchronisation en cours...',
  reconnecting: 'Reconnexion en cours...',
  disconnected: 'Connexion perdue',
  offline: 'Hors ligne',
};
```

Also change line 37 — the banner should also show for the `'offline'` state:

From:
```ts
  if (status !== 'disconnected') return null;
```
To:
```ts
  if (status !== 'disconnected' && status !== 'offline') return null;
```

- [ ] **Step 5: Commit**

```bash
git add hooks/useConnectionStatus.ts components/ConnectionStatus.tsx
git commit -m "feat(recovery): rewrite useConnectionStatus as recovery hub

On return from >30s idle or a WS CLOSED/TIMED_OUT event, run:
  1. auth probe (getUser, 5s race) — classify as ok/signed-out/network/auth
  2. realtime reset (epoch bump) — rebuilds every Supabase channel
  3. restart connection monitor
  4. wait up to 10s for probe channel SUBSCRIBED
  5. invalidate active queries
  6. state → connected (green) on probe success, else reconnecting (orange)

Network errors keep the user signed in and retry after 10s.
Auth errors (401, invalid_grant) sign out, letting ProtectedRoute redirect.
Recovery is rate-limited to once per 60s.
Runtime kill switch: localStorage.setItem('idle_recovery_enabled', '0')."
```

---

## Task 7: L5 — Create the mutation timeout helper

**Goal:** A deterministic timeout wrapper for Supabase mutations that threads `AbortSignal` into the SDK's `.abortSignal(signal)` chain method.

**Files:**
- Create: `lib/mutations.ts`

- [ ] **Step 1: Create `lib/mutations.ts`**

```ts
/**
 * Mutation Timeout Guard
 *
 * Wraps a mutationFn with a deterministic timeout. Uses Promise.race so
 * the timeout fires even if the inner fn forgets to thread the signal
 * into its Supabase call. Best-effort aborts the underlying fetch via
 * AbortController to cancel server-side work when possible.
 *
 * USAGE:
 *   const addXMutation = useMutation({
 *     mutationFn: withMutationTimeout(async (input, signal) => {
 *       const { error } = await supabase.rpc('x', input).abortSignal(signal);
 *       if (error) throw error;
 *     }),
 *     onError: toastOnError('...'),
 *   });
 *
 * DO NOT double-wrap. Inner wrapping breaks outer signal propagation.
 */

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Mutation exceeded ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

const DEFAULT_MUTATION_TIMEOUT_MS = 30_000;

export function withMutationTimeout<TInput, TOutput>(
  fn: (input: TInput, signal: AbortSignal) => Promise<TOutput>,
  timeoutMs: number = DEFAULT_MUTATION_TIMEOUT_MS,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

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
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run dev` (or build). Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/mutations.ts
git commit -m "feat(mutations): add withMutationTimeout helper

Promise.race-based deterministic timeout for Supabase mutations.
Rejects with TimeoutError after 30s regardless of whether call sites
thread the AbortSignal correctly. Threading the signal is still best
practice (cancels server-side work) but correctness no longer depends
on it.

No call sites yet — migrated in subsequent commits."
```

---

## Task 8: L5 — Extend `useMutationToast` to classify timeouts

**Goal:** `TimeoutError` and the fetch-layer expiry string both route to the same French toast.

**Files:**
- Modify: `hooks/useMutationToast.ts`

- [ ] **Step 1: Replace the file contents**

Replace `hooks/useMutationToast.ts` with:

```ts
// hooks/useMutationToast.ts
import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { TimeoutError } from '../lib/mutations';

// Known Supabase / PostgREST error codes
const KNOWN_ERRORS: Record<string, string> = {
  '42501': "Vous n'avez pas les droits pour cette action",
  '23505': 'Cet élément existe déjà',
  '23503': 'Cet élément est référencé ailleurs et ne peut pas être modifié',
  '23P01': 'Ce créneau est déjà occupé',
};

const TIMEOUT_MESSAGE =
  "Connexion instable. Votre demande n'est peut-être pas arrivée — vérifiez avant de réessayer.";

function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof Error && error.message.includes('La requête a expiré')) return true;
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true;
  if (error instanceof Error && error.message.includes('NetworkError')) return true;
  return false;
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function useMutationToast() {
  const { addToast } = useToast();

  const toastOnError = useCallback(
    (fallbackMessage: string) => (error: unknown) => {
      let message: string;

      if (isTimeoutError(error)) {
        message = TIMEOUT_MESSAGE;
      } else if (isNetworkError(error)) {
        message = 'Problème de connexion, veuillez réessayer';
      } else {
        const code = getErrorCode(error);
        message = (code && KNOWN_ERRORS[code]) || fallbackMessage;
      }

      addToast({ type: 'error', message });
    },
    [addToast],
  );

  const toastOnSuccess = useCallback(
    (message: string) => () => {
      addToast({ type: 'success', message });
    },
    [addToast],
  );

  return { toastOnError, toastOnSuccess };
}
```

- [ ] **Step 2: Verify the app runs**

Run: `npm run dev`. Expected: no type errors, existing error toasts still work.

- [ ] **Step 3: Commit**

```bash
git add hooks/useMutationToast.ts
git commit -m "feat(toast): classify TimeoutError + fetch-timeout string

Both TimeoutError (from mutation wrapper) and the 'La requête a expiré'
string (from fetchWithTimeout) now route to the same 'Connexion
instable' French toast. Precedence runs ahead of the existing network
and known-error-code branches."
```

---

## Task 9: L5 — Wrap `useTransactions` mutations

**Goal:** POS transactions (add/void/refund) use the mutation timeout wrapper.

**Files:**
- Modify: `hooks/useTransactions.ts`

- [ ] **Step 1: Add the import**

At the top of `hooks/useTransactions.ts`, add:

```ts
import { withMutationTimeout } from '../lib/mutations';
```

- [ ] **Step 2: Wrap `addTransactionMutation`**

Replace lines 44-71 (`const addTransactionMutation = useMutation({ ... });`) with:

```ts
  const addTransactionMutation = useMutation({
    mutationFn: withMutationTimeout(async ({
      items,
      payments,
      clientId,
      appointmentId,
    }: {
      items: CartItem[];
      payments: PaymentEntry[];
      clientId?: string;
      appointmentId?: string;
    }, signal: AbortSignal) => {
      const payload = toTransactionRpcPayload(items, payments, clientId, salonId, appointmentId);
      const { error } = await supabase.rpc('create_transaction', payload).abortSignal(signal);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['new_client_count', salonId] });
    },
    onError: toastOnError("Impossible de créer la transaction"),
  });
```

- [ ] **Step 3: Wrap `voidMutation`**

Replace lines 73-97 (the `voidMutation = useMutation` block) with:

```ts
  const voidMutation = useMutation({
    mutationFn: withMutationTimeout(async ({
      transactionId,
      reasonCategory,
      reasonNote,
    }: {
      transactionId: string;
      reasonCategory: string;
      reasonNote: string;
    }, signal: AbortSignal) => {
      const { error } = await supabase.rpc('void_transaction', {
        p_transaction_id: transactionId,
        p_salon_id: salonId,
        p_reason_category: reasonCategory,
        p_reason_note: reasonNote,
      }).abortSignal(signal);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Transaction annulée')();
    },
    onError: toastOnError("Impossible d'annuler la transaction"),
  });
```

- [ ] **Step 4: Wrap `refundMutation`**

Replace lines 99-132 (the `refundMutation = useMutation` block) with:

```ts
  const refundMutation = useMutation({
    mutationFn: withMutationTimeout(async ({
      transactionId,
      items,
      payments,
      reasonCategory,
      reasonNote,
      restock,
    }: {
      transactionId: string;
      items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[];
      payments: { method: string; amount: number }[];
      reasonCategory: string;
      reasonNote: string;
      restock: boolean;
    }, signal: AbortSignal) => {
      const { error } = await supabase.rpc('refund_transaction', {
        p_transaction_id: transactionId,
        p_salon_id: salonId,
        p_items: items,
        p_payments: payments,
        p_reason_category: reasonCategory,
        p_reason_note: reasonNote,
        p_restock: restock,
      }).abortSignal(signal);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Remboursement effectué')();
    },
    onError: toastOnError('Impossible de rembourser la transaction'),
  });
```

- [ ] **Step 5: Verify the app runs and POS still works**

Run: `npm run dev`
Manual check: open POS, add an item to cart, select cash payment, confirm transaction. Expected: success toast, transaction appears in history.

- [ ] **Step 6: Commit**

```bash
git add hooks/useTransactions.ts
git commit -m "feat(pos): wrap transaction mutations with timeout guard

addTransaction, voidTransaction, refundTransaction now reject after 30s
with TimeoutError instead of hanging silently. .abortSignal(signal) is
threaded into each RPC call for best-effort server-side cancellation."
```

---

## Task 10: L5 — Wrap `useAppointments` mutations

**Goal:** All 6 appointment mutations use the timeout wrapper.

**Files:**
- Modify: `modules/appointments/hooks/useAppointments.ts`

- [ ] **Step 1: Add the import**

At the top of `modules/appointments/hooks/useAppointments.ts`, add:

```ts
import { withMutationTimeout } from '../../../lib/mutations';
```

- [ ] **Step 2: Wrap `addAppointmentMutation`**

Replace lines 49-66 (`const addAppointmentMutation = useMutation({ ... });`) with:

```ts
  const addAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appt: Appointment, signal: AbortSignal) => {
      const { error } = await supabase
        .from('appointments')
        .insert(toAppointmentInsert(appt, salonId))
        .abortSignal(signal);
      if (error) {
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le rendez-vous"),
  });
```

- [ ] **Step 3: Wrap `updateAppointmentMutation`**

Replace lines 68-87 with:

```ts
  const updateAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appt: Appointment, signal: AbortSignal) => {
      const { id, salon_id, ...updateData } = toAppointmentInsert(appt, salonId);
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appt.id)
        .eq('salon_id', salonId)
        .abortSignal(signal);
      if (error) {
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError("Impossible de modifier le rendez-vous"),
  });
```

- [ ] **Step 4: Wrap `addAppointmentGroupMutation`**

Replace lines 89-141 with:

```ts
  const addAppointmentGroupMutation = useMutation({
    mutationFn: withMutationTimeout(async (payload: {
      clientId: string;
      notes: string;
      reminderMinutes: number | null;
      status: string;
      serviceBlocks: Array<{
        serviceId: string;
        variantId: string;
        staffId: string | null;
        date: string;
        durationMinutes: number;
        price: number;
      }>;
    }, signal: AbortSignal) => {
      // 1. Insert the group
      const { data: group, error: groupError } = await supabase
        .from('appointment_groups')
        .insert(toAppointmentGroupInsert(payload, salonId))
        .select('id')
        .single()
        .abortSignal(signal);

      if (groupError) throw groupError;

      // 2. Insert each appointment linked to the group
      const appointmentRows = payload.serviceBlocks.map((block) => ({
        salon_id: salonId,
        group_id: group.id,
        client_id: payload.clientId || null,
        service_id: block.serviceId || null,
        service_variant_id: block.variantId || null,
        staff_id: block.staffId || null,
        date: block.date,
        duration_minutes: block.durationMinutes,
        price: block.price,
        status: payload.status,
        notes: payload.notes || null,
      }));

      const { error: apptError } = await supabase
        .from('appointments')
        .insert(appointmentRows)
        .abortSignal(signal);

      if (apptError) throw apptError;

      return group.id;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous créé' });
    },
    onError: toastOnError('Erreur lors de la création du rendez-vous'),
  });
```

- [ ] **Step 5: Wrap `updateStatusMutation`**

Replace lines 143-156 with:

```ts
  const updateStatusMutation = useMutation({
    mutationFn: withMutationTimeout(async ({ appointmentId, status }: { appointmentId: string; status: string }, signal: AbortSignal) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)
        .eq('salon_id', salonId)
        .abortSignal(signal);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError('Impossible de modifier le statut'),
  });
```

- [ ] **Step 6: Wrap `editAppointmentGroupMutation`**

Replace lines 158-203 with:

```ts
  const editAppointmentGroupMutation = useMutation({
    mutationFn: withMutationTimeout(async (payload: {
      oldAppointmentId: string;
      clientId: string;
      notes: string;
      reminderMinutes: number | null;
      status: string;
      serviceBlocks: Array<{
        serviceId: string;
        variantId: string;
        staffId: string | null;
        date: string;
        durationMinutes: number;
        price: number;
      }>;
    }, signal: AbortSignal) => {
      const { data, error } = await supabase.rpc('edit_appointment_group', {
        p_old_appointment_id: payload.oldAppointmentId,
        p_salon_id: salonId,
        p_client_id: payload.clientId || null,
        p_notes: payload.notes || null,
        p_reminder_minutes: payload.reminderMinutes,
        p_status: payload.status,
        p_service_blocks: payload.serviceBlocks.map(b => ({
          service_id: b.serviceId || null,
          service_variant_id: b.variantId || null,
          staff_id: b.staffId || null,
          date: b.date,
          duration_minutes: b.durationMinutes,
          price: b.price,
        })),
      }).abortSignal(signal);
      if (error) {
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
      return data;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous modifié' });
    },
    onError: toastOnError('Erreur lors de la modification du rendez-vous'),
  });
```

- [ ] **Step 7: Wrap `deleteAppointmentMutation`**

Replace lines 205-217 with:

```ts
  const deleteAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appointmentId: string, signal: AbortSignal) => {
      const { error } = await supabase.rpc('soft_delete_appointment', {
        p_appointment_id: appointmentId,
      }).abortSignal(signal);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous supprimé' });
    },
    onError: toastOnError('Erreur lors de la suppression du rendez-vous'),
  });
```

- [ ] **Step 8: Verify the app runs and appointments still work**

Run: `npm run dev`
Manual check: create a new appointment, edit it, cancel it. Expected: all succeed with appropriate toasts.

- [ ] **Step 9: Commit**

```bash
git add modules/appointments/hooks/useAppointments.ts
git commit -m "feat(appointments): wrap appointment mutations with timeout guard

All six useAppointments mutations (add, update, addGroup, updateStatus,
editGroup, delete) now reject after 30s with TimeoutError instead of
hanging silently. .abortSignal(signal) threaded into every Supabase
call for best-effort server-side cancellation."
```

---

## Task 11: Manual test matrix

**Goal:** Execute the full spec test matrix before merging to `main`.

**Files:** none (manual testing)

- [ ] **Step 1: Test 1 — Idle >30s, return, POS save**

  - Open POS page.
  - DevTools → Network → select "Offline" from throttling dropdown.
  - Wait 45 seconds (simulates idle + network drop).
  - Select "No throttling" to go back online.
  - Add a service to the cart, open payment modal, select cash, confirm.
  - **Expected:** dot flickers orange → green (DevTools console shows `[recovery] start reason=visibility` → `[recovery] done state=connected`); transaction saves; navigation happens normally.

- [ ] **Step 2: Test 2 — Idle >30s, return, calendar open**

  - Open calendar view.
  - Switch to another tab for 2 minutes.
  - Switch back.
  - **Expected:** dot flickers orange → green; console logs recovery steps; any new appointments added by another user/tab appear within 2 seconds of return.

- [ ] **Step 3: Test 3 — Idle >10min, dashboard**

  - Open dashboard.
  - Hide tab for 10+ minutes.
  - Return.
  - **Expected:** KPIs visibly refetch (brief loading states); console shows `[recovery] queries invalidated`.

- [ ] **Step 4: Test 4 — Mutation hang**

  - Open POS.
  - DevTools → Network → right-click → Block request URL → pattern `*create_transaction*`.
  - Add service, open payment, select cash, confirm.
  - **Expected:** after ~30s, toast "Connexion instable. Votre demande n'est peut-être pas arrivée — vérifiez avant de réessayer." appears; Confirm button re-enables; console shows `[mutation-timeout] ms= 30000`.
  - Unblock the URL after testing.

- [ ] **Step 5: Test 5 — Expired refresh token**

  - Open DevTools → Application → Local Storage → find keys starting with `sb-` and ending with `-auth-token` or containing `refresh`.
  - Delete the refresh token entry.
  - Hide tab for 35 seconds.
  - Return.
  - **Expected:** recovery triggers, auth probe fails with auth error, app signs out, redirects to `/login`. Console shows `[recovery] auth auth`.

- [ ] **Step 6: Test 6 — Offline return**

  - DevTools → Network → Offline.
  - Hide tab for 60 seconds.
  - Return (still offline).
  - **Expected:** red dot; "Hors ligne, vérifiez votre connexion" toast; **NO sign-out**; user stays logged in. Console shows `[recovery] auth network`.
  - Go back online.
  - **Expected:** retry fires within 10s; dot returns to green.

- [ ] **Step 7: Test 7 — Short tab switch**

  - Open any page.
  - Alt-tab to another window for 5 seconds.
  - Return.
  - **Expected:** NO recovery triggered; dot stays green; no `[recovery]` logs.

- [ ] **Step 8: Test 8 — Multi-tab**

  - Open the app in two tabs.
  - Hide both for 60 seconds.
  - Return to only one.
  - **Expected:** recovery fires only in the active tab; the other tab stays quiet until its own focus event.

- [ ] **Step 9: Test 9 — Feature flag off**

  - DevTools console: `localStorage.setItem('idle_recovery_enabled', '0')`.
  - Hide tab for 60 seconds.
  - Return.
  - **Expected:** console shows `[recovery] skip reason= visibility flag=off`; dashboard NOT refetched (old behavior); mutation timeout still works if triggered separately.
  - Clear: `localStorage.removeItem('idle_recovery_enabled')`.

- [ ] **Step 10: Test 10 — Salon switch during idle**

  - Set up two accounts: user A (owner) and user B (staff).
  - User A logs in on browser 1; user B on browser 2 (incognito).
  - User B hides tab.
  - User A changes user B's role from stylist → manager.
  - User B returns after 60s.
  - **Expected:** recovery fires; memberships channel delivers the role change; UI (sidebar, role badge in profile) reflects manager role without reload.

- [ ] **Step 11: Test 11 — Password change in another tab**

  - Open two tabs of the same account.
  - Tab B: go to `/profile` → change password.
  - Tab A: hide for 60 seconds.
  - Return to tab A.
  - **Expected:** auth probe fails 401 (old token invalidated); tab A signs out; redirects to `/login`.

- [ ] **Step 12: Test 12 — Pending mutation at idle start**

  - Open POS.
  - DevTools → Network → Slow 3G throttling.
  - Click Confirm on a transaction.
  - Immediately hide tab (within 1 second of click).
  - Wait 40 seconds.
  - Return.
  - **Expected:** mutation already timed out at 30s from original click; "Connexion instable" toast is visible; recovery runs in parallel / already ran. User can retry after.

- [ ] **Step 13: If any test fails, STOP and report**

  Do not merge. Document which test failed and the symptom. Open a follow-up issue or revert the relevant commit per the Rollback section of the spec.

- [ ] **Step 14: If all tests pass, commit a test log**

```bash
git commit --allow-empty -m "test(recovery): manual test matrix passed

All 12 scenarios from spec test matrix verified on dev server:
- idle recovery (POS, calendar, dashboard)
- mutation timeout
- auth expiry / offline / network classification
- short tab switch (no recovery)
- multi-tab, salon switch, password-change propagation
- pending mutation at idle start
- feature flag off"
```

- [ ] **Step 15: Push and open PR**

```bash
git push -u origin <branch>
gh pr create --title "fix: idle-tab resilience (dead saves, empty dashboard, stale realtime)" --body "$(cat <<'EOF'
## Summary

- Removes the broken custom auth-lock mutex in `lib/supabase.ts` (trusts SDK default on v2.100.1).
- Enables `refetchOnWindowFocus` so the dashboard refreshes on return from idle.
- Adds a recovery hub in `useConnectionStatus` that orchestrates auth probe → realtime reset → query invalidation when the tab returns after >30s idle.
- Adds a realtime reset primitive (`lib/realtimeReset.ts`) consumed by every module that owns a Supabase channel.
- Adds a deterministic mutation timeout wrapper (`lib/mutations.ts`) + classifies `TimeoutError` in `useMutationToast`.
- Phase 1 call-site migration: POS transactions + all appointment mutations. Phase 2 (remaining modules) tracked as follow-up.

Runtime kill switch: `localStorage.setItem('idle_recovery_enabled', '0')`.

Spec: `docs/superpowers/specs/2026-04-13-idle-tab-resilience-design.md`
Follow-ups: `docs/superpowers/specs/2026-04-13-idle-tab-resilience-followups.md`

## Test plan

- [x] Idle >30s return, POS save
- [x] Idle >30s return, calendar live update
- [x] Idle >10min dashboard KPI refetch
- [x] Mutation hang → 30s timeout toast
- [x] Expired refresh token → sign out
- [x] Offline return → red dot, no sign-out
- [x] Short tab switch (<30s) → no recovery
- [x] Multi-tab independent recovery
- [x] Feature flag off
- [x] Salon switch during idle
- [x] Password change propagation
- [x] Pending mutation at idle start

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Rollback

Per spec `Rollback` section:

- **Runtime kill switch:** `localStorage.setItem('idle_recovery_enabled', '0')` — disables recovery hub without a deploy.
- **Per-commit revert:** each task is a single commit; revert in reverse order if a specific layer regresses.
- **Full revert:** `git revert <merge-commit>` on `main`.
