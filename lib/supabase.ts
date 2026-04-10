import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

// Workaround: some browsers return null from navigator.locks.request(),
// causing getSession() to hang. We use a JS-level mutex instead so token
// refreshes are serialized without risk of hanging or concurrent corruption.
type _SupabaseAuth = SupabaseClientOptions<'public'>['auth'];
type AuthWithLock = NonNullable<_SupabaseAuth> & {
  lock: (name: string, acquireTimeout: number, fn: () => Promise<unknown>) => Promise<unknown>;
};

const _authLocks = new Map<string, Promise<unknown>>();

// Global fetch wrapper with 30s timeout to prevent indefinite hangs
// (network stalls, auth lock deadlocks, browser connection limits).
const FETCH_TIMEOUT_MS = 30_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Merge with any existing signal from the caller
  const existingSignal = init?.signal;
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError' && !existingSignal?.aborted) {
        throw new Error('La requête a expiré (30s). Vérifiez votre connexion et réessayez.');
      }
      throw err;
    })
    .finally(() => clearTimeout(timeoutId));
};

// Auth lock with deadlock recovery: if a lock holder stalls >10s, the chain
// resets so subsequent operations are not blocked indefinitely.
const AUTH_LOCK_TIMEOUT_MS = 10_000;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    lock: (_name, _acquireTimeout, fn) => {
      const pending = _authLocks.get(_name);

      const withTimeout = (p: Promise<unknown>) =>
        Promise.race([
          p,
          new Promise<unknown>((_, reject) =>
            setTimeout(() => reject(new Error('Auth lock timeout')), AUTH_LOCK_TIMEOUT_MS)
          ),
        ]);

      const next = pending
        ? withTimeout(pending).catch(() => {}).then(fn)
        : Promise.resolve().then(fn);

      _authLocks.set(_name, next);
      next.finally(() => { if (_authLocks.get(_name) === next) _authLocks.delete(_name); });
      return next;
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  } as AuthWithLock,
});
