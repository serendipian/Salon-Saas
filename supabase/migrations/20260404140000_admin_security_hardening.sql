-- supabase/migrations/20260404140000_admin_security_hardening.sql
-- Security and data integrity hardening for admin infrastructure.
--
-- Fix S1: Revoke EXECUTE on all admin RPCs from PUBLIC; re-grant to authenticated only.
-- Fix D1: Recreate admin views with security_invoker = true so direct queries respect RLS.
-- Fix D2: Add INSERT policy on profiles blocking is_admin = true from authenticated users.
-- Fix S5: Add p_days bounds check (1–365) and fix silent no-op in admin_extend_trial.
-- Fix M2: Exclude soft-deleted memberships from staff_count in admin_accounts_overview.

-- =============================================================================
-- Fix S1: Revoke EXECUTE on admin RPCs from PUBLIC, re-grant to authenticated
-- =============================================================================

-- Read RPCs
REVOKE EXECUTE ON FUNCTION get_admin_mrr() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_accounts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_account_detail(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_trials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_failed_payments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_recent_signups() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_churn() FROM PUBLIC;

-- Write RPCs
REVOKE EXECUTE ON FUNCTION admin_extend_trial(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_set_plan(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_suspend_salon(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_reactivate_salon(uuid) FROM PUBLIC;

-- Internal helper — revoke from PUBLIC, do NOT grant to authenticated
-- (called only by other SECURITY DEFINER functions, never directly by clients)
REVOKE EXECUTE ON FUNCTION _assert_admin() FROM PUBLIC;

-- Re-grant read/write RPCs to authenticated (they still pass _assert_admin() internally)
GRANT EXECUTE ON FUNCTION get_admin_mrr() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_account_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_trials() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_failed_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_recent_signups() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_churn() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_extend_trial(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_suspend_salon(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reactivate_salon(uuid) TO authenticated;

-- =============================================================================
-- Fix D1 + Fix M2: Recreate admin views with security_invoker = true
-- (also fixes staff_count to exclude soft-deleted memberships — Fix M2)
-- =============================================================================

DROP VIEW IF EXISTS admin_mrr_summary;
DROP VIEW IF EXISTS admin_accounts_overview;
DROP VIEW IF EXISTS admin_trials_pipeline;

-- MRR summary: total recurring revenue and plan breakdown
CREATE VIEW admin_mrr_summary WITH (security_invoker = true) AS
WITH active_subs AS (
  SELECT sub.salon_id, p.price_monthly, p.name AS plan_name
  FROM subscriptions sub
  JOIN plans p ON p.id = sub.plan_id
  WHERE sub.status = 'active'
)
SELECT
  COALESCE(SUM(price_monthly), 0)::numeric                                          AS total_mrr,
  COUNT(*) FILTER (WHERE LOWER(plan_name) = 'premium')                              AS premium_count,
  COUNT(*) FILTER (WHERE LOWER(plan_name) = 'pro')                                  AS pro_count,
  (SELECT COUNT(*) FROM salons WHERE subscription_tier = 'free'     AND deleted_at IS NULL) AS free_count,
  (SELECT COUNT(*) FROM salons WHERE subscription_tier = 'trial'    AND deleted_at IS NULL) AS trial_count,
  (SELECT COUNT(*) FROM salons WHERE subscription_tier = 'past_due' AND deleted_at IS NULL) AS past_due_count,
  (SELECT COUNT(*) FROM salons WHERE deleted_at IS NULL)                             AS total_salons
FROM active_subs;

-- All salons overview with usage counts
-- M2 fix: staff_count now also filters sm.deleted_at IS NULL to exclude soft-deleted memberships
CREATE VIEW admin_accounts_overview WITH (security_invoker = true) AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.subscription_tier,
  s.is_suspended,
  s.created_at,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.status = 'active' AND sm.deleted_at IS NULL) AS staff_count,
  COUNT(DISTINCT c.id)  FILTER (WHERE c.deleted_at IS NULL) AS client_count,
  sub.status            AS subscription_status,
  sub.current_period_end,
  sub.trial_ends_at,
  sub.stripe_subscription_id
FROM salons s
LEFT JOIN salon_memberships sm ON sm.salon_id = s.id
LEFT JOIN clients c            ON c.salon_id  = s.id
LEFT JOIN subscriptions sub    ON sub.salon_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.slug, s.subscription_tier, s.is_suspended, s.created_at,
         sub.status, sub.current_period_end, sub.trial_ends_at, sub.stripe_subscription_id
ORDER BY s.created_at DESC;

-- Trials expiring within 14 days (sorted soonest first)
CREATE VIEW admin_trials_pipeline WITH (security_invoker = true) AS
SELECT
  s.id,
  s.name,
  sub.trial_ends_at,
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (sub.trial_ends_at - now())) / 86400))::integer AS days_remaining
FROM salons s
JOIN subscriptions sub ON sub.salon_id = s.id
WHERE s.subscription_tier = 'trial'
  AND sub.trial_ends_at IS NOT NULL
  AND sub.trial_ends_at > now()
  AND s.deleted_at IS NULL
ORDER BY sub.trial_ends_at ASC;

-- =============================================================================
-- Fix D2: Block INSERT on profiles with is_admin = true from authenticated users
-- (profile creation via the handle_new_user trigger runs as SECURITY DEFINER
--  and is unaffected; this only closes the direct REST API / PostgREST vector)
-- =============================================================================

DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND is_admin = false);

-- =============================================================================
-- Fix S5: Rewrite admin_extend_trial with bounds check and no-op detection
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_extend_trial(p_salon_id uuid, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM _assert_admin();

  -- Validate bounds: refuse unreasonable values to prevent accidental/malicious abuse
  IF p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 365, got %', p_days;
  END IF;

  UPDATE salons
  SET subscription_tier = 'trial',
      trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + (p_days * INTERVAL '1 day'),
      updated_at = now()
  WHERE id = p_salon_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Salon not found: %', p_salon_id;
  END IF;

  -- Also update subscriptions table if a row exists.
  -- A missing subscriptions row is acceptable — salons.trial_ends_at is the
  -- source of truth for trial state; subscriptions is only present for paid plans.
  UPDATE subscriptions
  SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + (p_days * INTERVAL '1 day'),
      status = 'trialing',
      updated_at = now()
  WHERE salon_id = p_salon_id;
END;
$$;

-- Re-apply the REVOKE/GRANT for admin_extend_trial in case the CREATE OR REPLACE
-- above reset the privileges back to the PostgreSQL default (EXECUTE to PUBLIC).
REVOKE EXECUTE ON FUNCTION admin_extend_trial(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_extend_trial(uuid, integer) TO authenticated;
