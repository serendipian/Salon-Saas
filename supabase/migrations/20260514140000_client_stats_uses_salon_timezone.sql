-- ============================================================
-- client_stats: bucket first/last visit dates in the salon's timezone
-- ============================================================
-- The view was casting `t.date::date` in UTC, so a sale at 00:30 local time
-- in a UTC+1 salon (23:30 UTC the previous day) showed up as "yesterday" in
-- client profiles. Fix: cast `(t.date AT TIME ZONE s.timezone)::date`.
--
-- Also restoring `WITH (security_invoker = true)` — the 2026-04-08 refunds
-- migration dropped and recreated the view without it, which silently made
-- it run as its owner (postgres superuser, bypassing RLS).
-- ============================================================

DROP VIEW IF EXISTS client_stats;
CREATE VIEW client_stats WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  c.salon_id,
  COUNT(DISTINCT t.id) FILTER (WHERE t.type = 'SALE') AS total_visits,
  COALESCE(SUM(t.total), 0) AS total_spent,
  MIN((t.date AT TIME ZONE s.timezone)::date) FILTER (WHERE t.type = 'SALE') AS first_visit_date,
  MAX((t.date AT TIME ZONE s.timezone)::date) FILTER (WHERE t.type = 'SALE') AS last_visit_date
FROM clients c
JOIN salons s ON s.id = c.salon_id
LEFT JOIN transactions t ON t.client_id = c.id AND t.salon_id = c.salon_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.salon_id, s.timezone;
