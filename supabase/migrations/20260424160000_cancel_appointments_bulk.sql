-- Atomic bulk cancellation.
--
-- The cancel-with-reason feature originally issued N parallel RPC calls via
-- Promise.all on the client to cancel a multi-service visit. Two problems:
--   1. Partial failure — if one of N failed, the other N-1 might have
--      succeeded server-side, but the client saw only an error toast and
--      rolled back its optimistic view. After refetch, the user saw a
--      half-cancelled visit with no clear signal.
--   2. Race errors — if a realtime event cancelled a sibling between the
--      modal opening and the user clicking Confirm, the second RPC raised
--      APPT_ALREADY_CANCELLED, producing a misleading error toast for what
--      was effectively a no-op.
--
-- cancel_appointments_bulk collapses N calls into one atomic DB transaction:
--   * All rows validated up front (COMPLETED / permission / not-found → raise)
--   * Already-CANCELLED rows are silently skipped (idempotent)
--   * The UPDATE is one statement — partial writes are impossible
--   * Returns the count of rows actually cancelled so the client can phrase
--     a precise toast ("1 annulé" / "3 services annulés" / "Déjà annulé")

CREATE OR REPLACE FUNCTION cancel_appointments_bulk(
  p_appointment_ids UUID[],
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
  v_salon_id UUID;
  v_count INTEGER := 0;
  v_trimmed_note TEXT;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid cancellation reason: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_trimmed_note := NULLIF(TRIM(p_note), '');

  -- Validate every id up front. Anything other than SCHEDULED / IN_PROGRESS /
  -- CANCELLED is a refusal; missing rows and wrong-salon rows also raise.
  -- All raises roll back the entire transaction — no partial writes possible.
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
      RAISE EXCEPTION 'APPT_COMPLETED:Cannot cancel a completed appointment'
        USING ERRCODE = 'P0001';
    END IF;

    -- v_status = 'CANCELLED' → idempotent skip (no raise; the UPDATE below
    -- already excludes these rows via status <> 'CANCELLED')
  END LOOP;

  UPDATE appointments
  SET status              = 'CANCELLED',
      cancellation_reason = p_reason,
      cancellation_note   = v_trimmed_note,
      cancelled_at        = now()
  WHERE id = ANY(p_appointment_ids)
    AND deleted_at IS NULL
    AND status <> 'CANCELLED';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_appointments_bulk(UUID[], TEXT, TEXT) TO authenticated;
