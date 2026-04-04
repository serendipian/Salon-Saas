-- supabase/migrations/20260404130003_admin_read_rpcs.sql

-- Helper: check is_admin, raise if not
CREATE OR REPLACE FUNCTION _assert_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;
END;
$$;

-- MRR summary as JSONB
CREATE OR REPLACE FUNCTION get_admin_mrr()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN (SELECT row_to_json(s)::jsonb FROM admin_mrr_summary s LIMIT 1);
END;
$$;

-- All accounts as table rows
CREATE OR REPLACE FUNCTION get_admin_accounts()
RETURNS TABLE (
  id                   uuid,
  name                 text,
  slug                 text,
  subscription_tier    text,
  is_suspended         boolean,
  created_at           timestamptz,
  staff_count          bigint,
  client_count         bigint,
  subscription_status  text,
  current_period_end   timestamptz,
  trial_ends_at        timestamptz,
  stripe_subscription_id text
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY SELECT
    a.id, a.name, a.slug, a.subscription_tier::text, a.is_suspended, a.created_at,
    a.staff_count, a.client_count, a.subscription_status::text,
    a.current_period_end, a.trial_ends_at, a.stripe_subscription_id
  FROM admin_accounts_overview a;
END;
$$;

-- Single account detail as JSONB (includes last 20 invoices)
CREATE OR REPLACE FUNCTION get_admin_account_detail(p_salon_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_account jsonb;
  v_invoices jsonb;
BEGIN
  PERFORM _assert_admin();

  SELECT row_to_json(a)::jsonb INTO v_account
  FROM admin_accounts_overview a
  WHERE a.id = p_salon_id;

  SELECT COALESCE(json_agg(i ORDER BY i.paid_at DESC), '[]'::json)::jsonb INTO v_invoices
  FROM (
    SELECT id, stripe_invoice_id, amount_cents, currency, status,
           hosted_invoice_url, invoice_pdf_url, paid_at
    FROM invoices
    WHERE salon_id = p_salon_id
    ORDER BY paid_at DESC
    LIMIT 20
  ) i;

  RETURN v_account || jsonb_build_object('invoices', v_invoices);
END;
$$;

-- Trials expiring <=14 days
CREATE OR REPLACE FUNCTION get_admin_trials()
RETURNS TABLE (
  id             uuid,
  name           text,
  trial_ends_at  timestamptz,
  days_remaining integer
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY SELECT t.id, t.name, t.trial_ends_at, t.days_remaining
  FROM admin_trials_pipeline t;
END;
$$;

-- Failed payments (past_due salons)
CREATE OR REPLACE FUNCTION get_admin_failed_payments()
RETURNS TABLE (
  id                     uuid,
  name                   text,
  subscription_tier      text,
  current_period_end     timestamptz,
  stripe_subscription_id text,
  days_overdue           integer
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.subscription_tier::text,
    sub.current_period_end,
    sub.stripe_subscription_id,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (now() - sub.current_period_end)) / 86400))::integer AS days_overdue
  FROM salons s
  JOIN subscriptions sub ON sub.salon_id = s.id
  WHERE s.subscription_tier = 'past_due'
    AND s.deleted_at IS NULL
  ORDER BY sub.current_period_end ASC;
END;
$$;

-- Recent signups (last 30 days)
CREATE OR REPLACE FUNCTION get_admin_recent_signups()
RETURNS TABLE (
  id                uuid,
  name              text,
  subscription_tier text,
  created_at        timestamptz,
  staff_count       bigint
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.subscription_tier::text,
    s.created_at,
    COUNT(DISTINCT sm.id) FILTER (WHERE sm.status = 'active') AS staff_count
  FROM salons s
  LEFT JOIN salon_memberships sm ON sm.salon_id = s.id
  WHERE s.created_at >= now() - INTERVAL '30 days'
    AND s.deleted_at IS NULL
  GROUP BY s.id, s.name, s.subscription_tier, s.created_at
  ORDER BY s.created_at DESC;
END;
$$;

-- Churn log (cancelled subscriptions, most recent 50)
CREATE OR REPLACE FUNCTION get_admin_churn()
RETURNS TABLE (
  id           uuid,
  name         text,
  cancelled_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  PERFORM _assert_admin();
  RETURN QUERY
  SELECT s.id, s.name, sub.cancelled_at
  FROM salons s
  JOIN subscriptions sub ON sub.salon_id = s.id
  WHERE sub.status = 'cancelled'
    AND sub.cancelled_at IS NOT NULL
    AND s.deleted_at IS NULL
  ORDER BY sub.cancelled_at DESC
  LIMIT 50;
END;
$$;
