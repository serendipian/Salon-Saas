-- Unify the "reason a booked service was not delivered/charged" vocabulary
-- across advance-cancellation and POS-deletion flows.
--
-- Renames:
--   CancellationReason (enum)    → DeletionReason
--   cancellation_reason (col)    → deletion_reason
--   cancellation_note   (col)    → deletion_note
--   cancelled_at        (col)    → unchanged (renaming would collide with deleted_at)
--   cancel_appointments_bulk RPC → delete_appointments_bulk
--   trigger + its function       → renamed
--
-- Value set changes:
--   Drop OTHER (vague dumping ground)
--   Add COMPLAINED (client unhappy — service not charged)
--   Add ERROR (staff / system mistake)
--   Final: CANCELLED, REPLACED, OFFERED, COMPLAINED, ERROR
--
-- Migration of existing OTHER rows: downgrade to CANCELLED (the generic).
-- Note field is preserved across the rename so no context is lost.

-- 1. Backfill OTHER → CANCELLED BEFORE swapping the CHECK constraint
UPDATE appointments
   SET cancellation_reason = 'CANCELLED'
 WHERE cancellation_reason = 'OTHER';

-- 2. Rename columns
ALTER TABLE appointments RENAME COLUMN cancellation_reason TO deletion_reason;
ALTER TABLE appointments RENAME COLUMN cancellation_note   TO deletion_note;
-- cancelled_at stays — renaming would collide with the existing deleted_at
-- (soft-delete timestamp).

-- 3. Drop and recreate CHECK constraints with new names + 5 allowed values
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_deletion_reason_check
  CHECK (
    deletion_reason IS NULL
    OR deletion_reason IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR')
  );

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_consistency_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_deletion_consistency_check
  CHECK (
    deletion_reason IS NULL
    OR status = 'CANCELLED'
  );

-- 4. Drop old trigger and its function, create renamed versions
DROP TRIGGER IF EXISTS appointments_clear_cancellation_on_uncancel ON appointments;
DROP FUNCTION IF EXISTS clear_cancellation_on_uncancel();

CREATE OR REPLACE FUNCTION clear_deletion_metadata_on_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a row leaves CANCELLED, clear the deletion metadata so the
  -- consistency CHECK stays satisfied.
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    NEW.deletion_reason := NULL;
    NEW.deletion_note   := NULL;
    NEW.cancelled_at    := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_clear_deletion_on_restore
  BEFORE UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED')
  EXECUTE FUNCTION clear_deletion_metadata_on_restore();

-- 5. Drop the old bulk RPC, create delete_appointments_bulk with the 5-value
--    validation. Only caller (useAppointments.ts) is updated in the same PR.
DROP FUNCTION IF EXISTS cancel_appointments_bulk(UUID[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION delete_appointments_bulk(
  p_appointment_ids UUID[],
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
  v_salon_id UUID;
  v_count INTEGER := 0;
  v_trimmed_note TEXT;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR') THEN
    RAISE EXCEPTION 'Invalid deletion reason: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_trimmed_note := NULLIF(TRIM(p_note), '');

  FOREACH v_id IN ARRAY p_appointment_ids
  LOOP
    SELECT status, salon_id INTO v_status, v_salon_id
    FROM appointments
    WHERE id = v_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Appointment not found or already archived';
    END IF;

    IF v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])) THEN
      RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action'
        USING ERRCODE = '42501';
    END IF;

    IF v_status = 'COMPLETED' THEN
      RAISE EXCEPTION 'APPT_COMPLETED:Cannot delete a completed appointment'
        USING ERRCODE = 'P0001';
    END IF;
    -- CANCELLED → idempotent skip (UPDATE below excludes via status <> 'CANCELLED')
  END LOOP;

  UPDATE appointments
  SET status           = 'CANCELLED',
      deletion_reason  = p_reason,
      deletion_note    = v_trimmed_note,
      cancelled_at     = now()
  WHERE id = ANY(p_appointment_ids)
    AND deleted_at IS NULL
    AND status <> 'CANCELLED';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_appointments_bulk(UUID[], TEXT, TEXT) TO authenticated;
