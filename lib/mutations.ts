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

import { Sentry } from './sentry';
import { supabase } from './supabase';

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Mutation exceeded ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

async function recordTimeoutBreadcrumb(timeoutMs: number): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const expiresAt = session?.expires_at;
    const nowSec = Math.floor(Date.now() / 1000);
    Sentry.addBreadcrumb({
      category: 'mutation',
      level: 'warning',
      message: 'mutation-timeout',
      data: {
        timeoutMs,
        hasSession: Boolean(session),
        expiresInSec: typeof expiresAt === 'number' ? expiresAt - nowSec : null,
        visibility: typeof document !== 'undefined' ? document.visibilityState : null,
        online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      },
    });
  } catch {
    // best-effort; never throw from breadcrumb collection
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
        void recordTimeoutBreadcrumb(timeoutMs);
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
