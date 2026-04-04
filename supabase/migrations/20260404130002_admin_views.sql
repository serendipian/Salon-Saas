-- supabase/migrations/20260404130002_admin_views.sql

-- MRR summary: total recurring revenue and plan breakdown
CREATE OR REPLACE VIEW admin_mrr_summary AS
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
CREATE OR REPLACE VIEW admin_accounts_overview AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.subscription_tier,
  s.is_suspended,
  s.created_at,
  COUNT(DISTINCT sm.id) FILTER (WHERE sm.status = 'active') AS staff_count,
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
CREATE OR REPLACE VIEW admin_trials_pipeline AS
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
