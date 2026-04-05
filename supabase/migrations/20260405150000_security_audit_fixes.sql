-- ============================================================
-- MIGRATION: Security audit fixes
-- Fixes: hardcoded encryption key, staff RPC auth, audit PII,
--         transaction staff_id validation, membership policy,
--         accept_invitation re-linking guard
-- ============================================================

-- ============================================================
-- FIX #1: Remove hardcoded PII encryption key fallback
-- The key MUST be set via: ALTER DATABASE postgres SET "app.encryption_key" = '...'
-- or via Supabase Dashboard > Project Settings > Database > Configuration
-- ============================================================

CREATE OR REPLACE FUNCTION encrypt_pii(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := NULLIF(current_setting('app.encryption_key', true), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'app.encryption_key is not configured — cannot encrypt PII';
  END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  v_key := NULLIF(current_setting('app.encryption_key', true), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'app.encryption_key is not configured — cannot decrypt PII';
  END IF;
  RETURN extensions.pgp_sym_decrypt(ciphertext, v_key);
END;
$$;

-- ============================================================
-- FIX #3: Staff RPCs — enforce role-based access
-- Owner/manager can view any staff; stylists can only view own data
-- ============================================================

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
  -- Get staff member's salon
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  -- Must be owner/manager OR querying own staff record
  IF v_salon_id IS NULL
    OR (
      v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
      AND p_staff_id != user_staff_id_in_salon(v_salon_id)
    )
  THEN
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
    LEFT JOIN clients c ON c.id = a.client_id AND c.deleted_at IS NULL
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
    LEFT JOIN clients c ON c.id = t.client_id AND c.deleted_at IS NULL
    WHERE ti.staff_id = p_staff_id
  )
  ORDER BY event_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

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
  SELECT sm.salon_id INTO v_salon_id
  FROM staff_members sm
  WHERE sm.id = p_staff_id;

  -- Must be owner/manager OR querying own staff record
  IF v_salon_id IS NULL
    OR (
      v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
      AND p_staff_id != user_staff_id_in_salon(v_salon_id)
    )
  THEN
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

-- ============================================================
-- FIX #4: Strip PII fields from audit log for staff_members
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_salon_id UUID;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_salon_id := OLD.salon_id;
    v_record_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_salon_id := NEW.salon_id;
    v_record_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_salon_id := NEW.salon_id;
    v_record_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  -- Scrub PII columns from staff_members audit entries
  IF TG_TABLE_NAME = 'staff_members' THEN
    v_old := v_old - 'iban' - 'social_security_number' - 'base_salary';
    v_new := v_new - 'iban' - 'social_security_number' - 'base_salary';
  END IF;

  INSERT INTO audit_log (salon_id, table_name, record_id, action, old_data, new_data, performed_by)
  VALUES (v_salon_id, TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, auth.uid());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX #7: Validate staff_id in create_transaction items
-- ============================================================

CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_staff_id UUID;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  -- Validate appointment if provided
  IF p_appointment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE id = p_appointment_id AND salon_id = p_salon_id AND status = 'SCHEDULED'
    ) THEN
      RAISE EXCEPTION 'Appointment not found or not in SCHEDULED status';
    END IF;
  END IF;

  -- Calculate totals
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total < v_total THEN
    RAISE EXCEPTION 'Payment total (%) is less than transaction total (%)', v_payment_total, v_total;
  END IF;

  -- Insert transaction with optional appointment_id
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id)
  RETURNING id INTO v_transaction_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate staff_id belongs to this salon
    v_staff_id := (v_item->>'staff_id')::uuid;
    IF v_staff_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM staff_members
        WHERE id = v_staff_id AND salon_id = p_salon_id AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Invalid staff_id for this salon: %', v_staff_id;
      END IF;
    END IF;

    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note, staff_id, staff_name
    ) VALUES (
      v_transaction_id, p_salon_id,
      (v_item->>'reference_id')::uuid, v_item->>'type', v_item->>'name', v_item->>'variant_name',
      (v_item->>'price')::numeric, (v_item->>'original_price')::numeric,
      (v_item->>'quantity')::integer, (v_item->>'cost')::numeric, v_item->>'note',
      v_staff_id, v_item->>'staff_name'
    );

    IF v_item->>'type' = 'PRODUCT' AND (v_item->>'reference_id') IS NOT NULL THEN
      UPDATE products SET stock = GREATEST(0, stock - (v_item->>'quantity')::integer), updated_at = now()
      WHERE id = (v_item->>'reference_id')::uuid AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- If linked to an appointment, mark it as COMPLETED
  IF p_appointment_id IS NOT NULL THEN
    UPDATE appointments SET status = 'COMPLETED', updated_at = now()
    WHERE id = p_appointment_id AND salon_id = p_salon_id;

    UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
    WHERE id = (SELECT group_id FROM appointments WHERE id = p_appointment_id)
      AND NOT EXISTS (
        SELECT 1 FROM appointments
        WHERE group_id = (SELECT group_id FROM appointments WHERE id = p_appointment_id)
          AND status != 'COMPLETED' AND deleted_at IS NULL AND id != p_appointment_id
      );
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX #8: Split memberships_modify FOR ALL into specific policies
-- Prevents managers from hard-deleting membership rows
-- ============================================================

DROP POLICY IF EXISTS memberships_modify ON salon_memberships;

CREATE POLICY memberships_insert ON salon_memberships FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY memberships_update ON salon_memberships FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- No DELETE policy — memberships must be soft-deleted via revoke_membership RPC

-- ============================================================
-- FIX #9: Guard accept_invitation against re-linking
-- ============================================================

CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_membership_id UUID;
  v_profile_id UUID;
BEGIN
  v_profile_id := auth.uid();

  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id AND profile_id = v_profile_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  INSERT INTO salon_memberships (salon_id, profile_id, role, status, invited_by, invited_at, accepted_at)
  VALUES (v_invitation.salon_id, v_profile_id, v_invitation.role, 'active', v_invitation.invited_by, v_invitation.created_at, now())
  RETURNING id INTO v_membership_id;

  -- Link existing staff member OR create new one
  IF v_invitation.staff_member_id IS NOT NULL THEN
    -- Guard: only link if the staff member is not already linked to another account
    IF EXISTS (
      SELECT 1 FROM staff_members
      WHERE id = v_invitation.staff_member_id
        AND membership_id IS NOT NULL
        AND membership_id != v_membership_id
    ) THEN
      RAISE EXCEPTION 'Staff member is already linked to another account';
    END IF;

    UPDATE staff_members SET membership_id = v_membership_id
    WHERE id = v_invitation.staff_member_id
      AND salon_id = v_invitation.salon_id
      AND (membership_id IS NULL OR membership_id = v_membership_id);
  ELSIF v_invitation.role = 'stylist' THEN
    DECLARE
      v_profile RECORD;
    BEGIN
      SELECT first_name, last_name, email INTO v_profile FROM profiles WHERE id = v_profile_id;
      INSERT INTO staff_members (salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate)
      VALUES (
        v_invitation.salon_id, v_membership_id,
        COALESCE(v_profile.first_name, ''), COALESCE(v_profile.last_name, ''),
        v_profile.email, 'Stylist',
        '#' || lpad(to_hex(floor(random() * 16777215)::int), 6, '0'),
        true, 0
      );
    END;
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
