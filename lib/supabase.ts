import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Workaround: some browsers return null from navigator.locks.request(),
    // causing getSession() to hang. This no-op lock bypasses the Web Locks API.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  } as any,
});
