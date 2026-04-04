-- supabase/migrations/20260404130000_admin_is_admin.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Block authenticated users from updating is_admin on their own profile
-- Only the service role key (used by migrations and Studio) can set it
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
