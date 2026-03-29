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
// causing getSession() to hang. This no-op lock bypasses the Web Locks API.
// Extended auth config type to include the undocumented `lock` option.
interface AuthWithLock extends SupabaseClientOptions<'public'>['auth'] {
  lock: (name: string, acquireTimeout: number, fn: () => Promise<unknown>) => Promise<unknown>;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async (_name, _acquireTimeout, fn) => fn(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  } as AuthWithLock,
});
