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

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Mutation exceeded ${timeoutMs}ms`);
    this.name = 'TimeoutError';
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
