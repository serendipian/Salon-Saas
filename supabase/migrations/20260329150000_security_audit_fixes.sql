-- Security audit fixes: invitations RLS, views security_invoker,
-- soft_delete guard, appointment_groups stylist access

-- ============================================================
-- FIX #2: Invitations RLS — restrict to user's own email
-- ============================================================
DROP POLICY IF EXISTS invitations_by_token ON invitations;
CREATE POLICY invitations_by_token ON invitations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND accepted_at IS NULL
    AND email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- FIX #3: Views — add security_invoker to enforce RLS
-- ============================================================

-- client_stats (latest definition from 20260329110000)
DROP VIEW IF EXISTS client_stats;
CREATE VIEW client_stats WITH (security_invoker = true) AS
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

-- appointment_details (filter soft-deleted related rows too)
DROP VIEW IF EXISTS appointment_details;
CREATE VIEW appointment_details WITH (security_invoker = true) AS
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
LEFT JOIN clients c ON c.id = a.client_id AND c.deleted_at IS NULL
LEFT JOIN services s ON s.id = a.service_id AND s.deleted_at IS NULL
LEFT JOIN service_variants sv ON sv.id = a.service_variant_id AND sv.deleted_at IS NULL
LEFT JOIN staff_members sm ON sm.id = a.staff_id AND sm.deleted_at IS NULL
WHERE a.deleted_at IS NULL;

-- ledger_entries (replace get_active_salon() with membership-based filter)
DROP VIEW IF EXISTS ledger_entries;
CREATE VIEW ledger_entries WITH (security_invoker = true) AS
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
WHERE e.deleted_at IS NULL

ORDER BY date DESC;

-- ============================================================
-- FIX #13: soft_delete_appointment — guard COMPLETED appointments
-- ============================================================
CREATE OR REPLACE FUNCTION soft_delete_appointment(p_appointment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_salon_id UUID;
BEGIN
  -- Get group_id and salon_id
  SELECT group_id, salon_id INTO v_group_id, v_salon_id
  FROM appointments
  WHERE id = p_appointment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already deleted';
  END IF;

  IF v_group_id IS NOT NULL THEN
    -- Soft-delete all non-completed appointments in the group
    UPDATE appointments
    SET deleted_at = now()
    WHERE group_id = v_group_id
      AND deleted_at IS NULL
      AND status != 'COMPLETED';

    -- Soft-delete the group itself
    UPDATE appointment_groups
    SET deleted_at = now()
    WHERE id = v_group_id
      AND deleted_at IS NULL;
  ELSE
    -- Single appointment
    UPDATE appointments
    SET deleted_at = now()
    WHERE id = p_appointment_id
      AND deleted_at IS NULL
      AND status != 'COMPLETED';
  END IF;
END;
$$;

-- ============================================================
-- FIX #14: appointment_groups — allow stylists to SELECT their own
-- ============================================================
DROP POLICY IF EXISTS appointment_groups_select ON appointment_groups;
CREATE POLICY appointment_groups_select ON appointment_groups
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
      OR EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.group_id = appointment_groups.id
          AND a.staff_id IN (
            SELECT sm.id FROM staff_members sm
            JOIN salon_memberships smb ON smb.id = sm.membership_id
            WHERE smb.profile_id = auth.uid()
              AND sm.salon_id = appointment_groups.salon_id
              AND sm.deleted_at IS NULL
          )
          AND a.deleted_at IS NULL
      )
    )
  );
