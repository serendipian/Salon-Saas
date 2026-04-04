-- Prevent duplicate payouts for the same staff/type/period
-- Excludes CANCELLED payouts so re-issuing after cancellation is allowed
CREATE UNIQUE INDEX idx_staff_payouts_unique_period
  ON staff_payouts (staff_id, type, period_start, period_end)
  WHERE status != 'CANCELLED' AND deleted_at IS NULL;

-- Fix: add salon_id + deleted_at filters to get_staff_activity sales leg
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
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  IF v_salon_id IS NULL OR v_salon_id NOT IN (SELECT user_salon_ids()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  (
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
      AND t.salon_id = v_salon_id
      AND t.deleted_at IS NULL
  )
  ORDER BY event_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
