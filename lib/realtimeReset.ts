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
      return () => {
        listeners.delete(cb);
      };
    },
    () => epoch,
  );
}
