// Realtime connection state + recovery orchestrator. If you change anything
// in this file, especially around startMonitoring / stopMonitoring, read
// the project memory note `project_realtime_gotchas.md` first. Two traps
// burned us hard:
//   1. supabase.channel(topic) auto-prepends `realtime:` — don't add it.
//   2. phoenix's leave() fires onClose SYNCHRONOUSLY when canPush() is false
//      (channel still in `joining` state). So `removeChannel(ch)` can
//      dispatch the channel's CLOSED callback in the same tick, before the
//      next line of code runs. Always null the channel reference BEFORE
//      calling removeChannel — the stale-channel guard depends on it.
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { resetAllChannels } from '../lib/realtimeReset';
import { abortStaleFetches, supabase } from '../lib/supabase';

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
  /** supabase.auth.getUser() race timeout during recovery. Background-tab
   *  throttling can delay the SDK by several seconds once a tab returns to
   *  foreground, so we give the probe a generous window before falling back
   *  to offline. */
  AUTH_PROBE_TIMEOUT_MS: 15_000,
  /** Wait for transient probe channel to hit SUBSCRIBED. */
  REALTIME_PROBE_TIMEOUT_MS: 10_000,
  /** Minimum gap between recovery attempts. */
  RECOVERY_RATE_LIMIT_MS: 60_000,
  /** How long reconnecting must last before the UI says "disconnected". */
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
let lastQueryClient: QueryClient | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

function setState(next: ConnectionState) {
  if (currentState === next) return;
  const prev = currentState;
  currentState = next;

  // Refetch queries on reconnect (user-visible feedback handled inline in ConnectionStatusDot).
  if (prev !== 'connected' && next === 'connected') {
    lastQueryClient?.invalidateQueries({ refetchType: 'active' });
  }

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
    setState(elapsed >= TIMINGS.DISCONNECT_BANNER_THRESHOLD_MS ? 'disconnected' : 'reconnecting');
  }
}

function startMonitoring() {
  if (monitorChannel) return;
  // Capture the channel locally so the subscribe callback can verify it's
  // still the active monitor before reacting. Without this guard, a
  // torn-down channel's stale CLOSED event (from React StrictMode's
  // double-mount, route changes, or any other remount) would trigger a
  // bogus recovery cycle that kills the working WS for every other
  // channel.
  const ch = supabase.channel('connection-monitor');
  ch.subscribe((status) => {
    // Stale: this channel was already removed; ignore its trailing events.
    if (ch !== monitorChannel) return;

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
  monitorChannel = ch;
}

function stopMonitoring() {
  const ch = monitorChannel;
  if (!ch) return;
  // CRITICAL ordering: null out monitorChannel BEFORE removeChannel.
  // If the channel is still in `joining` state (server hasn't replied to
  // phx_join yet), phoenix's leave() can't push and instead fires onClose
  // synchronously inside removeChannel — which dispatches our subscribe
  // callback before the next line could run. The stale-channel guard
  // (`if (ch !== monitorChannel) return`) only works if monitorChannel is
  // already null/different at that moment.
  monitorChannel = null;
  supabase.removeChannel(ch);
}

// ---- Recovery orchestrator ---------------------------------------------

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
  if (err && typeof err === 'object') {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) return 'auth';
    const msg = String((err as { message?: string }).message || '');
    if (
      msg.includes('invalid_grant') ||
      msg.includes('refresh_token_not_found') ||
      msg.includes('Auth session missing')
    ) {
      return 'auth';
    }
  }
  // Default conservatively to network so we don't kick users out incorrectly.
  return 'network';
}

interface StoredSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: unknown;
}

function readStoredSession(storageKey: string | null): StoredSession | null {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.access_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Refresh the session via raw fetch, bypassing the Supabase SDK. Writes the
 * new tokens to localStorage so the SDK picks them up on its next read.
 * Returns the fresh session on success, or a failure reason.
 */
async function refreshSessionRaw(
  supabaseUrl: string,
  anonKey: string,
  storageKey: string,
  refreshToken: string,
  signal: AbortSignal,
): Promise<StoredSession | 'auth' | 'network'> {
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal,
    });
  } catch (err) {
    return classifyProbeError(err) === 'auth' ? 'auth' : 'network';
  }

  // 400/401 from /token means the refresh_token is invalid/expired/rotated.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return 'auth';
  }
  if (!response.ok) return 'network';

  const fresh = (await response.json()) as StoredSession;
  if (!fresh.access_token) return 'network';

  const existingRaw = localStorage.getItem(storageKey);
  const existing = existingRaw ? (JSON.parse(existingRaw) as StoredSession) : ({} as StoredSession);

  const merged: StoredSession = {
    ...existing,
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token ?? existing.refresh_token,
    expires_in: fresh.expires_in,
    expires_at: fresh.expires_at,
    token_type: fresh.token_type ?? existing.token_type,
    user: fresh.user ?? existing.user,
  };
  localStorage.setItem(storageKey, JSON.stringify(merged));
  return merged;
}

/**
 * Raw-fetch auth probe. Bypasses the Supabase SDK entirely because the SDK
 * can deadlock on its internal locks after Chrome's background-tab throttling
 * releases (even with a no-op lock override, ordering assumptions break).
 * Reads the session straight from localStorage, proactively refreshes if the
 * access_token is expired or close to expiring, then hits /auth/v1/user with
 * a cold AbortController so the timeout is authoritative.
 */
async function probeAuth(): Promise<'ok' | 'signed-out' | 'network' | 'auth'> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
  const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null;

  let session = readStoredSession(storageKey);
  if (!session) return 'signed-out';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMINGS.AUTH_PROBE_TIMEOUT_MS);

  try {
    // Refresh proactively if the access_token is expired or within 30s of
    // expiring. This keeps idle-returning sessions signed in across the 1h
    // access_token lifetime, the way users expect from major SaaS apps.
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt && expiresAt - nowSec < 30 && session.refresh_token && storageKey) {
      const refreshed = await refreshSessionRaw(
        supabaseUrl,
        anonKey,
        storageKey,
        session.refresh_token,
        controller.signal,
      );
      if (refreshed === 'auth' || refreshed === 'network') return refreshed;
      session = refreshed;
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: controller.signal,
    });

    // Server says the access token is dead. It may just be expired — try
    // refreshing once before giving up. Only classify as 'auth' if the
    // refresh itself is rejected.
    if (response.status === 401) {
      if (!session.refresh_token || !storageKey) return 'auth';
      const refreshed = await refreshSessionRaw(
        supabaseUrl,
        anonKey,
        storageKey,
        session.refresh_token,
        controller.signal,
      );
      if (refreshed === 'auth') return 'auth';
      if (refreshed === 'network') return 'network';
      return 'ok';
    }

    if (response.status === 403) return 'auth';
    if (!response.ok) return 'network';
    return 'ok';
  } catch (err) {
    return classifyProbeError(err);
  } finally {
    clearTimeout(timeoutId);
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

async function triggerRecovery(
  _reason: 'visibility' | 'ws' | 'manual',
  opts: { force?: boolean } = {},
): Promise<void> {
  if (!isRecoveryEnabled()) {
    return;
  }
  if (recoveryInFlight) {
    return;
  }
  if (!opts.force && Date.now() - lastRecoveryAt < TIMINGS.RECOVERY_RATE_LIMIT_MS) {
    return;
  }

  recoveryInFlight = true;
  setState('recovering');

  try {
    // Kick any wedged SDK fetches so their auth-lock callbacks can release.
    // Background-tab throttling routinely strands a refresh mid-flight; every
    // subsequent read/write (favorites, history, expenses) queues behind it
    // until we free the lock. 5s is generous enough that healthy in-flight
    // requests are never touched.
    abortStaleFetches(5_000);

    // Auth probe
    const authResult = await probeAuth();

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
      // Hard sign-out: SDK signOut() can hang on background-tab lock issues
      // (same reason we replaced getUser() with raw fetch). If it hangs, the
      // recovery finally block never runs and the app wedges. So we clear
      // session storage ourselves, fire-and-forget the SDK call, and force
      // a redirect to /login so AuthContext re-initializes cleanly.
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
        if (projectRef) localStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch {
        // best effort — redirect anyway
      }
      void supabase.auth.signOut().catch(() => {});
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }

    // Cycle the underlying WebSocket before resetting logical channels.
    // resetAllChannels() alone only recreates channel objects; if the socket
    // itself is zombied from throttling, new channels never SUBSCRIBE.
    try {
      supabase.realtime.disconnect();
      supabase.realtime.connect();
    } catch {
      // best effort — never throw from recovery
    }

    // Realtime reset
    resetAllChannels();

    // Restart the monitor and wait for a fresh SUBSCRIBED via probe channel.
    stopMonitoring();
    startMonitoring();
    const realtimeOk = await probeRealtime();

    // Refetch active queries unconditionally. Even if the realtime probe
    // didn't succeed, auth is fresh and the SDK lock is free — reads should
    // go through. Gating this on realtime left the app with stale cache
    // (dashboard, POS favorites, history) until a manual refresh.
    lastQueryClient?.invalidateQueries({ refetchType: 'active' });

    if (realtimeOk) {
      disconnectedAt = null;
      setState('connected');
    } else {
      disconnectedAt = disconnectedAt ?? Date.now();
      setState('reconnecting');
    }
  } finally {
    recoveryInFlight = false;
    lastRecoveryAt = Date.now();
  }
}

// User-initiated retry from the disconnect banner. Bypasses the rate limit
// because a manual click expresses explicit intent that should override
// throttling — and the retry button is useless otherwise (the auto-recovery
// that just ran is still inside the 60s window).
export async function manualRetryRecovery(): Promise<void> {
  await triggerRecovery('manual', { force: true });
}

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

  // Stash reference for module-level setState / recovery sequence.
  lastQueryClient = queryClient;

  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
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

    // Focus listener: covers window/app switching where the tab stays visible
    // (visibilitychange doesn't fire). Debounced to avoid spamming recovery on
    // rapid alt-tab clicks.
    let focusDebounce: ReturnType<typeof setTimeout> | null = null;
    const handleFocus = () => {
      if (focusDebounce) clearTimeout(focusDebounce);
      focusDebounce = setTimeout(() => {
        focusDebounce = null;
        if (!recoveryInFlight && Date.now() - lastRecoveryAt > TIMINGS.RECOVERY_RATE_LIMIT_MS) {
          void triggerRecovery('visibility');
        }
      }, 500);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      subscriberCount--;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (focusDebounce) clearTimeout(focusDebounce);
      if (subscriberCount === 0) {
        stopMonitoring();
        if (offlineRetryTimer) {
          clearTimeout(offlineRetryTimer);
          offlineRetryTimer = null;
        }
      }
    };
  }, []);

  return state;
}
