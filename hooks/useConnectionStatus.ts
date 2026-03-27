import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

const DISCONNECT_THRESHOLD_MS = 30_000;

export function useConnectionStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connected');
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const disconnectedAtRef = useRef<number | null>(null);
  const wasDisconnectedRef = useRef(false);

  const evaluateState = useCallback(() => {
    if (disconnectedAtRef.current === null) {
      // Connected
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        // Reconnected — invalidate active queries to catch up
        queryClient.invalidateQueries({ refetchType: 'active' });
        addToast({ type: 'success', message: 'Connexion rétablie' });
      }
      setState('connected');
      return;
    }

    const elapsed = Date.now() - disconnectedAtRef.current;
    if (elapsed >= DISCONNECT_THRESHOLD_MS) {
      setState('disconnected');
    } else {
      setState('reconnecting');
    }
  }, [queryClient, addToast]);

  useEffect(() => {
    const channel = supabase
      .channel('connection-monitor')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          disconnectedAtRef.current = null;
          evaluateState();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (disconnectedAtRef.current === null) {
            disconnectedAtRef.current = Date.now();
            wasDisconnectedRef.current = true;
          }
          evaluateState();
        }
      });

    // Timer to transition from reconnecting → disconnected after 30s
    const interval = setInterval(() => {
      if (disconnectedAtRef.current !== null) {
        evaluateState();
      }
    }, 5000);

    // Re-evaluate on tab visibility change (timers may have drifted)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        evaluateState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [evaluateState]);

  return state;
}
