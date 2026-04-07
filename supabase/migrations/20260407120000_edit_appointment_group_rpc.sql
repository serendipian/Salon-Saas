-- RPC for atomically editing an appointment group:
-- soft-deletes old group/appointments and inserts new ones in a single transaction.
-- This prevents data loss if the insert fails (e.g., constraint violation).

CREATE OR REPLACE FUNCTION edit_appointment_group(
  p_old_appointment_id UUID,
  p_salon_id UUID,
  p_client_id UUID,
  p_notes TEXT,
  p_reminder_minutes INTEGER,
  p_status TEXT,
  p_service_blocks JSONB  -- array of {service_id, service_variant_id, staff_id, date, duration_minutes, price}
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
  v_old_group_id UUID;
  v_new_group_id UUID;
  v_block JSONB;
BEGIN
  -- 1. Get old appointment info
  SELECT group_id, salon_id INTO v_old_group_id, v_group_id
  FROM appointments WHERE id = p_old_appointment_id AND deleted_at IS NULL;

  IF v_group_id IS NULL AND v_old_group_id IS NULL THEN
    -- Check if appointment exists at all
    IF NOT EXISTS (SELECT 1 FROM appointments WHERE id = p_old_appointment_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Rendez-vous introuvable' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 2. Permission check
  IF p_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])) THEN
    RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action' USING ERRCODE = '42501';
  END IF;

  -- 3. Soft-delete old appointment(s)
  IF v_old_group_id IS NOT NULL THEN
    UPDATE appointments SET deleted_at = now() WHERE group_id = v_old_group_id;
    UPDATE appointment_groups SET deleted_at = now() WHERE id = v_old_group_id;
  ELSE
    UPDATE appointments SET deleted_at = now() WHERE id = p_old_appointment_id;
  END IF;

  -- 4. Create new group
  INSERT INTO appointment_groups (salon_id, client_id, notes, reminder_minutes, status)
  VALUES (p_salon_id, p_client_id, p_notes, p_reminder_minutes, p_status)
  RETURNING id INTO v_new_group_id;

  -- 5. Insert new appointments from service blocks
  FOR v_block IN SELECT * FROM jsonb_array_elements(p_service_blocks)
  LOOP
    INSERT INTO appointments (
      salon_id, group_id, client_id, service_id, service_variant_id,
      staff_id, date, duration_minutes, price, status, notes
    ) VALUES (
      p_salon_id,
      v_new_group_id,
      p_client_id,
      NULLIF(v_block->>'service_id', ''),
      NULLIF(v_block->>'service_variant_id', ''),
      NULLIF(v_block->>'staff_id', ''),
      (v_block->>'date')::timestamptz,
      (v_block->>'duration_minutes')::integer,
      (v_block->>'price')::numeric,
      p_status,
      p_notes
    );
  END LOOP;

  RETURN v_new_group_id;
END;
$$;
