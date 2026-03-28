-- Add first_visit_date to client_stats view
-- Must DROP + CREATE because adding a column in the middle is not allowed with CREATE OR REPLACE
DROP VIEW IF EXISTS client_stats;

CREATE VIEW client_stats AS
SELECT
  c.id AS client_id,
  c.salon_id,
  COUNT(DISTINCT t.id) AS total_visits,
  COALESCE(SUM(t.total), 0) AS total_spent,
  MIN(t.date)::date AS first_visit_date,
  MAX(t.date)::date AS last_visit_date
FROM clients c
LEFT JOIN transactions t ON t.client_id = c.id AND t.salon_id = c.salon_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.salon_id;
