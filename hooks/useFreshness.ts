import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface UseFreshnessOptions {
  queryKeyRoots: string[];
  salonId: string;
  refetchIntervalMs?: number;
}

/**
 * Provides "freshness" signals for pages that want to show a live-data indicator.
 * - Periodically invalidates the given query key roots as a safety net against dropped Realtime events.
 * - Tracks the timestamp of the most recent successful query update matching those roots.
 */
export function useFreshness({
  queryKeyRoots,
  salonId,
  refetchIntervalMs = 60_000,
}: UseFreshnessOptions) {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const rootsKey = queryKeyRoots.join('|');

  useEffect(() => {
    if (!salonId) return;
    const roots = rootsKey.split('|');
    const interval = setInterval(() => {
      roots.forEach((root) => {
        queryClient.invalidateQueries({ queryKey: [root, salonId] });
      });
    }, refetchIntervalMs);
    return () => clearInterval(interval);
  }, [queryClient, salonId, rootsKey, refetchIntervalMs]);

  useEffect(() => {
    const watched = new Set(rootsKey.split('|'));
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (event.action.type !== 'success') return;
      const [rootKey] = event.query.queryKey as [string, ...unknown[]];
      if (watched.has(rootKey)) setLastUpdated(Date.now());
    });
    return unsubscribe;
  }, [queryClient, rootsKey]);

  return { lastUpdated };
}
