-- get_dashboard_stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_salon_id UUID, p_date_from TIMESTAMPTZ, p_date_to TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'revenue', COALESCE(SUM(t.total), 0),
    'transaction_count', COUNT(t.id),
    'avg_basket', CASE WHEN COUNT(t.id) > 0 THEN ROUND(SUM(t.total) / COUNT(t.id), 2) ELSE 0 END,
    'appointment_count', (
      SELECT COUNT(*) FROM appointments a
      WHERE a.salon_id = p_salon_id AND a.date BETWEEN p_date_from AND p_date_to
        AND a.status != 'CANCELLED' AND a.deleted_at IS NULL
    ),
    'new_clients', (
      SELECT COUNT(*) FROM clients c
      WHERE c.salon_id = p_salon_id AND c.created_at BETWEEN p_date_from AND p_date_to AND c.deleted_at IS NULL
    ),
    'top_services', (
      SELECT COALESCE(jsonb_agg(row_to_json(top)), '[]'::jsonb)
      FROM (
        SELECT ti.name, SUM(ti.quantity) AS count, SUM(ti.price * ti.quantity) AS revenue
        FROM transaction_items ti
        INNER JOIN transactions tx ON tx.id = ti.transaction_id
        WHERE tx.salon_id = p_salon_id AND tx.date BETWEEN p_date_from AND p_date_to AND ti.type = 'SERVICE'
        GROUP BY ti.name ORDER BY revenue DESC LIMIT 5
      ) top
    ),
    'revenue_by_day', (
      SELECT COALESCE(jsonb_agg(row_to_json(daily) ORDER BY daily.day), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', t2.date)::date AS day, SUM(t2.total) AS revenue
        FROM transactions t2
        WHERE t2.salon_id = p_salon_id AND t2.date BETWEEN p_date_from AND p_date_to
        GROUP BY date_trunc('day', t2.date)::date
      ) daily
    )
  ) INTO v_result
  FROM transactions t WHERE t.salon_id = p_salon_id AND t.date BETWEEN p_date_from AND p_date_to;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- get_client_stats
CREATE OR REPLACE FUNCTION get_client_stats(p_client_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_visits', COUNT(DISTINCT t.id),
    'total_spent', COALESCE(SUM(t.total), 0),
    'last_visit_date', MAX(t.date)::date
  ) INTO v_result FROM transactions t WHERE t.client_id = p_client_id;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- get_staff_performance
CREATE OR REPLACE FUNCTION get_staff_performance(
  p_salon_id UUID, p_staff_id UUID, p_date_from TIMESTAMPTZ, p_date_to TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_commission_rate NUMERIC(5,2);
BEGIN
  SELECT commission_rate INTO v_commission_rate FROM staff_members
  WHERE id = p_staff_id AND salon_id = p_salon_id AND deleted_at IS NULL;

  SELECT jsonb_build_object(
    'appointment_count', (
      SELECT COUNT(*) FROM appointments a WHERE a.staff_id = p_staff_id AND a.salon_id = p_salon_id
        AND a.date BETWEEN p_date_from AND p_date_to AND a.status = 'COMPLETED' AND a.deleted_at IS NULL
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(a.price), 0) FROM appointments a WHERE a.staff_id = p_staff_id AND a.salon_id = p_salon_id
        AND a.date BETWEEN p_date_from AND p_date_to AND a.status = 'COMPLETED' AND a.deleted_at IS NULL
    ),
    'commission_rate', COALESCE(v_commission_rate, 0),
    'commission_earned', (
      SELECT COALESCE(SUM(a.price) * COALESCE(v_commission_rate, 0) / 100, 0) FROM appointments a
      WHERE a.staff_id = p_staff_id AND a.salon_id = p_salon_id
        AND a.date BETWEEN p_date_from AND p_date_to AND a.status = 'COMPLETED' AND a.deleted_at IS NULL
    ),
    'cancelled_count', (
      SELECT COUNT(*) FROM appointments a WHERE a.staff_id = p_staff_id AND a.salon_id = p_salon_id
        AND a.date BETWEEN p_date_from AND p_date_to AND a.status = 'CANCELLED' AND a.deleted_at IS NULL
    ),
    'no_show_count', (
      SELECT COUNT(*) FROM appointments a WHERE a.staff_id = p_staff_id AND a.salon_id = p_salon_id
        AND a.date BETWEEN p_date_from AND p_date_to AND a.status = 'NO_SHOW' AND a.deleted_at IS NULL
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- check_slot_availability (advisory only)
CREATE OR REPLACE FUNCTION check_slot_availability(
  p_staff_id UUID, p_date TIMESTAMPTZ, p_duration_minutes INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE staff_id = p_staff_id AND status NOT IN ('CANCELLED') AND deleted_at IS NULL
      AND tstzrange(date, date + (duration_minutes || ' minutes')::interval) &&
          tstzrange(p_date, p_date + (p_duration_minutes || ' minutes')::interval)
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
