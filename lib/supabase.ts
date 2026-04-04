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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: (_name, _acquireTimeout, fn) => {
      const pending = _authLocks.get(_name);
      const next = (pending ?? Promise.resolve()).catch(() => {}).then(fn);
      _authLocks.set(_name, next);
      next.finally(() => { if (_authLocks.get(_name) === next) _authLocks.delete(_name); });
      return next;
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  } as AuthWithLock,
});
