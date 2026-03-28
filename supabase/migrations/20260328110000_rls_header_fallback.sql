-- Fix RLS for connection pooling: read salon context from request headers
-- when session variables are not set (different connection from the pool).
--
-- The client sends x-salon-id and x-user-role headers with every request.
-- PostgREST exposes these as request.header.x-salon-id / request.header.x-user-role.

CREATE OR REPLACE FUNCTION get_active_salon()
RETURNS uuid AS $$
  SELECT COALESCE(
    nullif(current_setting('app.active_salon_id', true), ''),
    nullif(current_setting('request.header.x-salon-id', true), '')
  )::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT COALESCE(
    nullif(current_setting('app.user_role', true), ''),
    nullif(current_setting('request.header.x-user-role', true), '')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
