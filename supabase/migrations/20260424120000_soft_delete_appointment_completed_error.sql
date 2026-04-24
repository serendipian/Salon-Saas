-- soft_delete_appointment: raise an explicit error when the target is COMPLETED.
--
-- The previous version silently no-op'd on COMPLETED rows (WHERE status != 'COMPLETED').
-- Callers could not distinguish "deleted" from "refused" and showed a false success toast.
-- Now: check status up-front and raise P0001 with a machine-readable prefix
-- (APPT_COMPLETED:) so the client can map it to a French user-facing message.

CREATE OR REPLACE FUNCTION soft_delete_appointment(p_appointment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_salon_id UUID;
  v_status TEXT;
BEGIN
  SELECT group_id, salon_id, status
    INTO v_group_id, v_salon_id, v_status
  FROM appointments
  WHERE id = p_appointment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already deleted';
  END IF;

  -- Completed appointments are financial records; refuse deletion explicitly
  IF v_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'APPT_COMPLETED:Cannot delete a completed appointment'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_group_id IS NOT NULL THEN
    -- Soft-delete all non-completed siblings in the group
    UPDATE appointments
    SET deleted_at = now()
    WHERE group_id = v_group_id
      AND deleted_at IS NULL
      AND status != 'COMPLETED';

    UPDATE appointment_groups
    SET deleted_at = now()
    WHERE id = v_group_id
      AND deleted_at IS NULL;
  ELSE
    UPDATE appointments
    SET deleted_at = now()
    WHERE id = p_appointment_id
      AND deleted_at IS NULL;
  END IF;
END;
$$;
