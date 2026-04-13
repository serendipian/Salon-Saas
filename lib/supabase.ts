import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
