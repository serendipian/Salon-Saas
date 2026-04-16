import type { InvalidateOptions, InvalidateQueryFilters, QueryClient } from '@tanstack/react-query';

const CHANNEL_NAME = 'salon-saas-query-sync';

let isBroadcastReplay = false;

interface SyncMessage {
  type: 'invalidate';
  queryKey: readonly unknown[];
}

/**
 * Wraps queryClient.invalidateQueries so every call automatically broadcasts
 * the invalidated query key to other same-origin tabs via BroadcastChannel.
 *
 * Other tabs receive the message and call invalidateQueries locally, which
 * triggers a refetch for any active queries matching that key.
 *
 * Loop prevention:
 *  - BroadcastChannel never delivers to the sender tab (spec guarantee).
 *  - isBroadcastReplay flag prevents cross-tab ping-pong: Tab A broadcasts,
 *    Tab B receives and invalidates locally, but B's invalidation is flagged
 *    as a replay so it does not broadcast back to A.
 *
 * Blanket invalidations (no queryKey — e.g. useConnectionStatus recovery)
 * are excluded from broadcasting. Each tab handles its own recovery.
 *
 * Graceful degradation: if BroadcastChannel is unavailable (old browsers, SSR),
 * this function is a no-op and the app works exactly as before.
 */
export function setupCrossTabSync(queryClient: QueryClient): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);

  // --- Outbound: wrap invalidateQueries ---
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);

  queryClient.invalidateQueries = (
    filters?: InvalidateQueryFilters,
    options?: InvalidateOptions,
  ): Promise<void> => {
    const result = originalInvalidate(filters, options);

    if (!isBroadcastReplay && filters?.queryKey) {
      try {
        channel.postMessage({
          type: 'invalidate',
          queryKey: filters.queryKey,
        } satisfies SyncMessage);
      } catch {
        // postMessage can throw if channel is closed or payload not cloneable.
        // Local invalidation already happened — fail silently.
      }
    }

    return result;
  };

  // --- Inbound: listen for invalidations from other tabs ---
  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    const { data } = event;
    if (data?.type !== 'invalidate' || !Array.isArray(data.queryKey)) return;

    isBroadcastReplay = true;
    try {
      queryClient.invalidateQueries({ queryKey: data.queryKey });
    } finally {
      isBroadcastReplay = false;
    }
  };

  // --- Cleanup (for HMR) ---
  return () => {
    queryClient.invalidateQueries = originalInvalidate;
    channel.close();
  };
}
