-- Admin time-series RPC functions for dashboard sparklines
-- Protected by _assert_admin() and REVOKED from public

-- Monthly MRR history
-- For each month in range: sum price_monthly (or price_yearly/12) of subscriptions
-- that were active (created before end of month, not yet cancelled as of month start)
CREATE OR REPLACE FUNCTION get_admin_mrr_history(months_back int DEFAULT 6)
RETURNS TABLE(month date, mrr numeric)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_admin();
  months_back := LEAST(GREATEST(months_back, 1), 24);

  RETURN QUERY
  WITH month_series AS (
    SELECT generate_series(
      date_trunc('month', now() - ((months_back - 1) * '1 month'::interval)),
      date_trunc('month', now()),
      '1 month'::interval
    )::date AS month_start
  )
  SELECT
    ms.month_start AS month,
    COALESCE(SUM(
      CASE sub.billing_cycle
        WHEN 'yearly' THEN p.price_yearly / 12.0
        ELSE p.price_monthly
      END
    ), 0)::numeric AS mrr
  FROM month_series ms
  LEFT JOIN subscriptions sub ON
    sub.created_at < (ms.month_start + '1 month'::interval)
    AND (sub.cancelled_at IS NULL OR sub.cancelled_at >= ms.month_start)
    AND sub.status != 'trial'
  LEFT JOIN plans p ON p.id = sub.plan_id AND p.price_monthly > 0
  GROUP BY ms.month_start
  ORDER BY ms.month_start;
END;
$$;

-- Monthly new salon signups history
CREATE OR REPLACE FUNCTION get_admin_signups_history(months_back int DEFAULT 6)
RETURNS TABLE(month date, count bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_admin();
  months_back := LEAST(GREATEST(months_back, 1), 24);

  RETURN QUERY
  WITH month_series AS (
    SELECT generate_series(
      date_trunc('month', now() - ((months_back - 1) * '1 month'::interval)),
      date_trunc('month', now()),
      '1 month'::interval
    )::date AS month_start
  )
  SELECT
    ms.month_start AS month,
    COUNT(s.id) AS count
  FROM month_series ms
  LEFT JOIN salons s ON
    date_trunc('month', s.created_at)::date = ms.month_start
    AND s.deleted_at IS NULL
  GROUP BY ms.month_start
  ORDER BY ms.month_start;
END;
$$;

-- Monthly new trial starts history
CREATE OR REPLACE FUNCTION get_admin_trials_history(months_back int DEFAULT 6)
RETURNS TABLE(month date, count bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_admin();
  months_back := LEAST(GREATEST(months_back, 1), 24);

  RETURN QUERY
  WITH month_series AS (
    SELECT generate_series(
      date_trunc('month', now() - ((months_back - 1) * '1 month'::interval)),
      date_trunc('month', now()),
      '1 month'::interval
    )::date AS month_start
  )
  SELECT
    ms.month_start AS month,
    COUNT(sub.id) AS count
  FROM month_series ms
  LEFT JOIN subscriptions sub ON
    date_trunc('month', sub.created_at)::date = ms.month_start
    AND sub.status = 'trial'
  GROUP BY ms.month_start
  ORDER BY ms.month_start;
END;
$$;

-- Security: revoke public execute
REVOKE EXECUTE ON FUNCTION get_admin_mrr_history(int)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_signups_history(int)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_trials_history(int)   FROM PUBLIC;
