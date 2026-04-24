-- Cancel-appointment polish:
--   1. Scope the UPDATE in cancel_appointment by salon_id (defense in depth per CLAUDE.md)
--   2. Auto-clear cancellation fields when un-cancelling via the status dropdown
--      (prevents the appointments_cancellation_consistency_check from firing
--      when a user flips a cancelled row back to SCHEDULED / IN_PROGRESS / etc.)

-- ============================================================
-- 1. cancel_appointment — add salon_id to UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_appointment(
  p_appointment_id UUID,
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
  v_salon_id UUID;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid cancellation reason: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  SELECT status, salon_id INTO v_status, v_salon_id
  FROM appointments
  WHERE id = p_appointment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already archived';
  END IF;

  IF v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])) THEN
    RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action'
      USING ERRCODE = '42501';
  END IF;

  IF v_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'APPT_COMPLETED:Cannot cancel a completed appointment'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'APPT_ALREADY_CANCELLED:Appointment already cancelled'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE appointments
  SET status              = 'CANCELLED',
      cancellation_reason = p_reason,
      cancellation_note   = NULLIF(TRIM(p_note), ''),
      cancelled_at        = now()
  WHERE id = p_appointment_id
    AND salon_id = v_salon_id;
END;
$$;

-- ============================================================
-- 2. Auto-clear cancellation metadata when un-cancelling
-- ============================================================
CREATE OR REPLACE FUNCTION clear_cancellation_on_uncancel()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a row leaves the CANCELLED state (e.g., via the status badge dropdown),
  -- drop the cancellation metadata so the consistency CHECK stays happy.
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    NEW.cancellation_reason := NULL;
    NEW.cancellation_note   := NULL;
    NEW.cancelled_at        := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_clear_cancellation_on_uncancel ON appointments;
CREATE TRIGGER appointments_clear_cancellation_on_uncancel
  BEFORE UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED')
  EXECUTE FUNCTION clear_cancellation_on_uncancel();
