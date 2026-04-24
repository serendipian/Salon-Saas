-- Appointment cancellation with reason
--
-- Primary action when a user clicks the trash icon on an appointment row is now
-- "cancel with reason", not "archive". Cancelled rows stay visible in lists and
-- on the appointment detail page; POS already excludes status=CANCELLED from
-- the pending pool and from group-import, so cancelled services disappear from
-- billing flows automatically.
--
-- Columns:
--   cancellation_reason   machine code for reason (CANCELLED / REPLACED / OFFERED / OTHER)
--   cancellation_note     free-text detail shown in the UI
--   cancelled_at          audit timestamp
--
-- One RPC: cancel_appointment(id, reason, note) — per-row. Card-level "cancel
-- whole visit" loops this RPC from the client; we do not add a group variant
-- today because reasons apply independently per service.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_note TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Reason must be one of the four codes (or null)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_cancellation_reason_check
  CHECK (
    cancellation_reason IS NULL
    OR cancellation_reason IN ('CANCELLED', 'REPLACED', 'OFFERED', 'OTHER')
  );

-- Reason / cancelled_at can only be set when status=CANCELLED (but status may be
-- CANCELLED without a reason for rows cancelled via the status badge dropdown —
-- legacy / quick cancellation path).
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_consistency_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_cancellation_consistency_check
  CHECK (
    cancellation_reason IS NULL
    OR status = 'CANCELLED'
  );

-- ============================================================
-- RPC: cancel_appointment
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
  -- Validate reason
  IF p_reason IS NULL OR p_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid cancellation reason: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  -- Load row
  SELECT status, salon_id INTO v_status, v_salon_id
  FROM appointments
  WHERE id = p_appointment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already archived';
  END IF;

  -- Permission: owner / manager / receptionist for the salon
  IF v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])) THEN
    RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action'
      USING ERRCODE = '42501';
  END IF;

  -- Already-terminal states
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
  WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_appointment(UUID, TEXT, TEXT) TO authenticated;
