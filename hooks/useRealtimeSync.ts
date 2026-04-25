import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtimeEpoch } from '../lib/realtimeReset';
import { supabase } from '../lib/supabase';

type EventPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;
type EventHandler = (payload: EventPayload) => void;

// --- Subscription Manager (module-level singleton) ---

interface Subscription {
  channel: RealtimeChannel;
  refCount: number;
  handlers: Set<EventHandler>;
}

const subscriptions = new Map<string, Subscription>();

function subscribe(
  tableName: string,
  salonId: string,
  handler: EventHandler,
  filterOverride?: string,
): () => void {
  const key = `${tableName}:${salonId}`;

  const existing = subscriptions.get(key);
  if (existing) {
    existing.refCount++;
    existing.handlers.add(handler);
    return () => unsubscribe(key, handler);
  }

  const handlers = new Set<EventHandler>([handler]);

  // Don't prefix `realtime:` ourselves — supabase-realtime-js's
  // RealtimeClient.channel() auto-prepends it, so we'd otherwise produce
  // double-prefixed topics like `realtime:realtime:appointments:...`.
  const channel = supabase
    .channel(key)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: filterOverride ?? `salon_id=eq.${salonId}`,
      },
      (payload) => {
        // Fan out to all registered handlers
        for (const h of handlers) {
          h(payload);
        }
      },
    )
    .subscribe();

  subscriptions.set(key, { channel, refCount: 1, handlers });

  return () => unsubscribe(key, handler);
}

function unsubscribe(key: string, handler: EventHandler) {
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub.handlers.delete(handler);
  sub.refCount--;
  if (sub.refCount <= 0) {
    supabase.removeChannel(sub.channel);
    subscriptions.delete(key);
  }
}

// --- Public Hook ---

export interface RealtimeSyncOptions {
  onEvent?: (payload: EventPayload) => void;
  /** Override the default salon_id filter (e.g., 'id=eq.xxx' for the salons table) */
  filterOverride?: string;
}

export function useRealtimeSync(tableName: string, options?: RealtimeSyncOptions) {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const _epoch = useRealtimeEpoch();

  // Store onEvent in a ref so we always call the latest version
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Stable handler that delegates to the ref — this identity is used for registration
  const stableHandler = useCallback(
    (payload: EventPayload) => {
      queryClient.invalidateQueries({ queryKey: [tableName, salonId] });
      onEventRef.current?.(payload);
    },
    [tableName, salonId, queryClient],
  );

  useEffect(() => {
    if (!salonId) return;

    return subscribe(tableName, salonId, stableHandler, options?.filterOverride);
    // epoch is in deps so a resetAllChannels() bump tears down and resubscribes.
  }, [tableName, salonId, stableHandler, options?.filterOverride]);
}
