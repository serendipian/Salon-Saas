-- client_stats: computed visits/spending/last visit
CREATE OR REPLACE VIEW client_stats AS
SELECT
  c.id AS client_id,
  c.salon_id,
  COUNT(DISTINCT t.id) AS total_visits,
  COALESCE(SUM(t.total), 0) AS total_spent,
  MAX(t.date)::date AS last_visit_date
FROM clients c
LEFT JOIN transactions t ON t.client_id = c.id AND t.salon_id = c.salon_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.salon_id;

-- appointment_details: joins with names
CREATE OR REPLACE VIEW appointment_details AS
SELECT
  a.id,
  a.salon_id,
  a.client_id,
  c.first_name || ' ' || c.last_name AS client_name,
  a.service_id,
  s.name AS service_name,
  a.service_variant_id,
  sv.name AS variant_name,
  a.staff_id,
  sm.first_name || ' ' || sm.last_name AS staff_name,
  sm.color AS staff_color,
  a.date,
  a.duration_minutes,
  a.status,
  a.price,
  a.notes,
  a.created_at,
  a.updated_at
FROM appointments a
LEFT JOIN clients c ON c.id = a.client_id
LEFT JOIN services s ON s.id = a.service_id
LEFT JOIN service_variants sv ON sv.id = a.service_variant_id
LEFT JOIN staff_members sm ON sm.id = a.staff_id
WHERE a.deleted_at IS NULL;

-- ledger_entries: unified income/expense ledger
CREATE OR REPLACE VIEW ledger_entries AS
SELECT
  t.id,
  t.salon_id,
  t.date,
  'INCOME' AS type,
  COALESCE(
    (SELECT string_agg(ti.name, ', ' ORDER BY ti.name) FROM transaction_items ti WHERE ti.transaction_id = t.id),
    'Transaction'
  ) AS label,
  'Ventes' AS category,
  t.total AS amount,
  NULL::jsonb AS details
FROM transactions t
WHERE t.salon_id = get_active_salon()

UNION ALL

SELECT
  e.id,
  e.salon_id,
  e.date::timestamptz,
  'EXPENSE' AS type,
  e.description AS label,
  COALESCE(ec.name, 'Non classé') AS category,
  e.amount,
  NULL::jsonb AS details
FROM expenses e
LEFT JOIN expense_categories ec ON ec.id = e.category_id
WHERE e.salon_id = get_active_salon()
  AND e.deleted_at IS NULL

ORDER BY date DESC;
