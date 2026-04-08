import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

const DISCONNECT_THRESHOLD_MS = 30_000;

// Module-level singleton — one channel shared by all consumers
let subscriberCount = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;
let disconnectedAt: number | null = null;
let wasDisconnected = false;
let currentState: ConnectionState = 'connected';
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

function evaluateStateInternal() {
  if (disconnectedAt === null) {
    if (wasDisconnected) {
      wasDisconnected = false;
    }
    currentState = 'connected';
  } else {
    const elapsed = Date.now() - disconnectedAt;
    currentState = elapsed >= DISCONNECT_THRESHOLD_MS ? 'disconnected' : 'reconnecting';
  }
  notifyListeners();
}

function startMonitoring() {
  if (channel) return;
  channel = supabase
    .channel('connection-monitor')
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        disconnectedAt = null;
        evaluateStateInternal();
      } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        if (disconnectedAt === null) {
          disconnectedAt = Date.now();
          wasDisconnected = true;
        }
        evaluateStateInternal();
      }
    });
}

function stopMonitoring() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

export function useConnectionStatus(): ConnectionState {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const prevStateRef = useRef(currentState);

  // Subscribe to singleton state changes
  const state = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => currentState,
  );

  // Manage channel lifecycle via ref counting
  useEffect(() => {
    subscriberCount++;
    if (subscriberCount === 1) startMonitoring();

    // Timer to transition from reconnecting → disconnected after 30s
    const interval = setInterval(() => {
      if (disconnectedAt !== null) evaluateStateInternal();
    }, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') evaluateStateInternal();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscriberCount--;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (subscriberCount === 0) stopMonitoring();
    };
  }, []);

  // React to state transitions (reconnect → invalidate queries + toast)
  useEffect(() => {
    if (prevStateRef.current !== 'connected' && state === 'connected') {
      queryClient.invalidateQueries({ refetchType: 'active' });
      addToast({ type: 'success', message: 'Connexion rétablie' });
    }
    prevStateRef.current = state;
  }, [state, queryClient, addToast]);

  return state;
}
