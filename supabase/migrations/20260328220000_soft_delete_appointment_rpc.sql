-- RPC function for soft-deleting appointments (and their group if grouped).
-- Uses SECURITY DEFINER to bypass RLS, with its own permission check.
CREATE OR REPLACE FUNCTION soft_delete_appointment(p_appointment_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
  v_salon_id UUID;
BEGIN
  -- Get appointment info
  SELECT group_id, salon_id INTO v_group_id, v_salon_id
  FROM appointments WHERE id = p_appointment_id AND deleted_at IS NULL;

  IF v_salon_id IS NULL THEN
    RAISE EXCEPTION 'Rendez-vous introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- Permission check: owner, manager, or receptionist
  IF v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])) THEN
    RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action' USING ERRCODE = '42501';
  END IF;

  -- Soft-delete
  IF v_group_id IS NOT NULL THEN
    UPDATE appointments SET deleted_at = now() WHERE group_id = v_group_id;
    UPDATE appointment_groups SET deleted_at = now() WHERE id = v_group_id;
  ELSE
    UPDATE appointments SET deleted_at = now() WHERE id = p_appointment_id;
  END IF;
END;
$$;
