-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Trigger function: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Session context for RLS
CREATE OR REPLACE FUNCTION set_session_context(p_salon_id uuid, p_user_role text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.active_salon_id', p_salon_id::text, true);
  PERFORM set_config('app.user_role', p_user_role, true);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION get_active_salon()
RETURNS uuid AS $$
  SELECT nullif(current_setting('app.active_salon_id', true), '')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT nullif(current_setting('app.user_role', true), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;
