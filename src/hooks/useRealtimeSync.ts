import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// --- Subscription Manager (module-level singleton) ---

interface Subscription {
  channel: RealtimeChannel;
  refCount: number;
}

const subscriptions = new Map<string, Subscription>();

function subscribe(
  tableName: string,
  salonId: string,
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
): () => void {
  const key = `${tableName}:${salonId}`;

  const existing = subscriptions.get(key);
  if (existing) {
    existing.refCount++;
    return () => unsubscribe(key);
  }

  const channel = supabase
    .channel(`realtime:${key}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: `salon_id=eq.${salonId}`,
      },
      onEvent,
    )
    .subscribe();

  subscriptions.set(key, { channel, refCount: 1 });

  return () => unsubscribe(key);
}

function unsubscribe(key: string) {
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub.refCount--;
  if (sub.refCount <= 0) {
    supabase.removeChannel(sub.channel);
    subscriptions.delete(key);
  }
}

// --- Public Hook ---

export interface RealtimeSyncOptions {
  onEvent?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

export function useRealtimeSync(tableName: string, options?: RealtimeSyncOptions) {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();

  // Store onEvent in a ref to avoid re-subscribing when the callback changes
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  useEffect(() => {
    if (!salonId) return;

    const unsub = subscribe(tableName, salonId, (payload) => {
      // Invalidate TanStack Query cache for this table
      queryClient.invalidateQueries({ queryKey: [tableName, salonId] });

      // Call optional per-module event handler
      onEventRef.current?.(payload);
    });

    return unsub;
  }, [tableName, salonId, queryClient]);
}
