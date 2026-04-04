-- RPC: get_staff_activity
-- Returns a paginated chronological feed of staff events (appointments + sales)
CREATE OR REPLACE FUNCTION get_staff_activity(
  p_staff_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  event_type TEXT,
  event_date TIMESTAMPTZ,
  description TEXT,
  client_name TEXT,
  metadata JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Security check: caller must have access to this staff member's salon
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  IF v_salon_id IS NULL OR v_salon_id NOT IN (SELECT user_salon_ids()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  (
    -- Completed/cancelled/no-show appointments
    SELECT
      CASE a.status
        WHEN 'COMPLETED' THEN 'appointment_completed'
        WHEN 'CANCELLED' THEN 'appointment_cancelled'
        WHEN 'NO_SHOW' THEN 'appointment_no_show'
      END AS event_type,
      a.date AS event_date,
      COALESCE(s.name, 'Service') AS description,
      COALESCE(c.first_name || ' ' || c.last_name, 'Client inconnu') AS client_name,
      jsonb_build_object(
        'appointment_id', a.id,
        'service_id', a.service_id,
        'duration', a.duration_minutes,
        'price', a.price,
        'status', a.status
      ) AS metadata
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.staff_id = p_staff_id
      AND a.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')
      AND a.deleted_at IS NULL

    UNION ALL

    -- Sales (transaction items attributed to this staff)
    SELECT
      'sale' AS event_type,
      t.date AS event_date,
      ti.name || COALESCE(' - ' || ti.variant_name, '') AS description,
      COALESCE(c.first_name || ' ' || c.last_name, 'Client inconnu') AS client_name,
      jsonb_build_object(
        'transaction_id', t.id,
        'item_type', ti.type,
        'price', ti.price,
        'quantity', ti.quantity,
        'total', ti.price * ti.quantity
      ) AS metadata
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    LEFT JOIN clients c ON c.id = t.client_id
    WHERE ti.staff_id = p_staff_id
  )
  ORDER BY event_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- RPC: get_staff_clients
-- Returns top clients by visit frequency for a given staff member
CREATE OR REPLACE FUNCTION get_staff_clients(
  p_staff_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  client_id UUID,
  client_first_name TEXT,
  client_last_name TEXT,
  visit_count BIGINT,
  total_revenue NUMERIC,
  last_visit DATE
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Security check
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  IF v_salon_id IS NULL OR v_salon_id NOT IN (SELECT user_salon_ids()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS client_id,
    c.first_name AS client_first_name,
    c.last_name AS client_last_name,
    COUNT(DISTINCT a.id) AS visit_count,
    COALESCE(SUM(a.price), 0) AS total_revenue,
    MAX(a.date)::date AS last_visit
  FROM appointments a
  JOIN clients c ON c.id = a.client_id
  WHERE a.staff_id = p_staff_id
    AND a.status = 'COMPLETED'
    AND a.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.first_name, c.last_name
  ORDER BY visit_count DESC
  LIMIT p_limit;
END;
$$;
