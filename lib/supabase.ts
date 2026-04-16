import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
  );
}

// Global fetch wrapper with 30s timeout to prevent indefinite hangs
// (network stalls, browser connection limits). Supabase SDK's default
// navigator.locks handling is trusted as of @supabase/supabase-js >= 2.45.
const FETCH_TIMEOUT_MS = 30_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

// Per-tab async mutex keyed by name. Serializes callers via a promise chain.
// Used as a fallback when navigator.locks is unavailable or returns a null
// lock (a Chromium quirk that the default supabase-js lock warns about).
const inMemoryLocks = new Map<string, Promise<unknown>>();
const inMemoryLock = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const previous = inMemoryLocks.get(name) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((r) => {
    release = r;
  });
  inMemoryLocks.set(name, previous.then(() => current));
  try {
    await previous;
  } catch {
    // A prior holder's error shouldn't block subsequent holders.
  }
  try {
    return await fn();
  } finally {
    release();
    if (inMemoryLocks.get(name) === current) {
      inMemoryLocks.delete(name);
    }
  }
};

// Custom auth lock:
//   - Uses navigator.locks for cross-tab coordination when the browser behaves.
//   - Silently falls back to an in-memory lock when Chromium hands back a null
//     lock (the "not following the LockManager spec" case supabase-js normally
//     warns about). We keep serialization within the tab either way.
//   - Respects acquireTimeout when provided (supabase passes -1 for "wait forever").
const authLock = async <T>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<T>,
): Promise<T> => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    const options: LockOptions = { mode: 'exclusive' };
    if (acquireTimeout > 0) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), acquireTimeout);
      options.signal = controller.signal;
      try {
        return await navigator.locks.request(name, options, async (heldLock) => {
          if (heldLock) return await fn();
          return await inMemoryLock(name, fn);
        });
      } finally {
        clearTimeout(timer);
      }
    }
    return await navigator.locks.request(name, options, async (heldLock) => {
      if (heldLock) return await fn();
      return await inMemoryLock(name, fn);
    });
  }
  return await inMemoryLock(name, fn);
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: authLock,
  },
});
