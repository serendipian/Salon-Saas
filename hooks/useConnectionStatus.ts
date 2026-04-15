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

/**
 * Raw-fetch auth probe. Bypasses the Supabase SDK entirely because the SDK
 * can deadlock on its internal locks after Chrome's background-tab throttling
 * releases (even with a no-op lock override, ordering assumptions break).
 * We read the session straight from localStorage, then hit /auth/v1/user with
 * a cold AbortController so the timeout is authoritative.
 */
async function probeAuth(): Promise<'ok' | 'signed-out' | 'network' | 'auth'> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
  const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null;

  let accessToken: string | null = null;
  try {
    const raw = storageKey ? localStorage.getItem(storageKey) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string };
      accessToken = parsed.access_token ?? null;
    }
  } catch {
    // fall through — treat as signed-out below
  }

  if (!accessToken) return 'signed-out';

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TIMINGS.AUTH_PROBE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) return 'auth';
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
    // Auth probe
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

    // Realtime reset
    resetAllChannels();

    // Restart the monitor and wait for a fresh SUBSCRIBED via probe channel.
    stopMonitoring();
    startMonitoring();
    const realtimeOk = await probeRealtime();
    console.log('[recovery] probe', realtimeOk ? 'subscribed' : 'timeout');

    // Query invalidation.
    if (lastQueryClient) {
      lastQueryClient.invalidateQueries({ refetchType: 'active' });
      console.log('[recovery] queries invalidated');
    }

    // Final state — only promote to connected if realtime probe succeeded.
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
