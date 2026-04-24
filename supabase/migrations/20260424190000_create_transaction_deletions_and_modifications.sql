-- POS deletion pipeline: create_transaction now records per-appointment
-- deletion reasons and applies staff/price modifications atomically with
-- the transaction insert.
--
-- Problems this solves:
--   1. Previous behavior marked ALL group siblings COMPLETED when a
--      transaction linked to any member, regardless of whether the cashier
--      had removed some services from the cart before ringing up. Dropped
--      services showed up as COMPLETED in the Agenda even though they were
--      never charged.
--   2. When the cashier changed staff or price on a cart line that came
--      from an appointment, the appointment row kept the original booking
--      values. The booking record diverged from what actually happened.
--
-- New parameters:
--   p_deleted_appointments   jsonb  [{id, reason, note}]
--       appointments to mark CANCELLED with deletion_reason.
--   p_modified_appointments  jsonb  [{id, staff_id, price}]
--       appointments whose kept cart line has a different staff or price
--       than the booking; the appointment row is updated in place.
--
-- Semantics:
--   - "Honoured" appointments (in cart, in same group as p_appointment_id,
--     not in p_deleted_appointments) → COMPLETED
--   - "Deleted" appointments → status='CANCELLED', deletion_reason set,
--     deletion_note trimmed, cancelled_at=now()
--   - "Modified" appointments → UPDATE staff_id and/or price per payload
--   - Group status flips to COMPLETED only when no sibling remains
--     un-terminal (SCHEDULED/IN_PROGRESS). If a sibling was deleted, the
--     group is effectively finished — but group status tracks the
--     aggregate state so we leave it alone unless everyone terminated.
--
-- Reason validation matches the DeletionReason enum (see migration
-- 20260424180000): CANCELLED, REPLACED, OFFERED, COMPLAINED, ERROR.

CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_deleted_appointments JSONB DEFAULT '[]'::jsonb,
  p_modified_appointments JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_deletion JSONB;
  v_modification JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_staff_id UUID;
  v_group_id UUID;
  v_ticket_number BIGINT;
  v_deleted_ids UUID[] := ARRAY[]::UUID[];
  v_reason TEXT;
  v_note TEXT;
BEGIN
  -- Permission
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  -- Anchor must be billable if set (SCHEDULED or IN_PROGRESS)
  IF p_appointment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE id = p_appointment_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS')
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Appointment not found or not in a billable status';
    END IF;
  END IF;

  -- Validate each deletion payload up front so we raise before any writes
  FOR v_deletion IN SELECT * FROM jsonb_array_elements(p_deleted_appointments)
  LOOP
    v_reason := v_deletion->>'reason';
    IF v_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR') THEN
      RAISE EXCEPTION 'Invalid deletion reason: %', v_reason
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Totals
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total < v_total THEN
    RAISE EXCEPTION 'Payment total (%) is less than transaction total (%)', v_payment_total, v_total;
  END IF;

  -- Atomic per-salon ticket number assignment
  INSERT INTO salon_ticket_counters (salon_id)
  VALUES (p_salon_id)
  ON CONFLICT (salon_id) DO NOTHING;

  UPDATE salon_ticket_counters
     SET next_ticket_number = next_ticket_number + 1,
         updated_at = now()
   WHERE salon_id = p_salon_id
  RETURNING next_ticket_number - 1 INTO v_ticket_number;

  -- Insert transaction
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id, ticket_number)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id, v_ticket_number)
  RETURNING id INTO v_transaction_id;

  -- Items + stock decrement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
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

  -- Payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- Apply deletions (status=CANCELLED + deletion_reason)
  FOR v_deletion IN SELECT * FROM jsonb_array_elements(p_deleted_appointments)
  LOOP
    v_note := NULLIF(TRIM(v_deletion->>'note'), '');
    UPDATE appointments
    SET status          = 'CANCELLED',
        deletion_reason = v_deletion->>'reason',
        deletion_note   = v_note,
        cancelled_at    = now(),
        updated_at      = now()
    WHERE id = (v_deletion->>'id')::uuid
      AND salon_id = p_salon_id
      AND status IN ('SCHEDULED', 'IN_PROGRESS')
      AND deleted_at IS NULL;
    v_deleted_ids := array_append(v_deleted_ids, (v_deletion->>'id')::uuid);
  END LOOP;

  -- Apply modifications (staff and/or price changes to the appointment row)
  FOR v_modification IN SELECT * FROM jsonb_array_elements(p_modified_appointments)
  LOOP
    UPDATE appointments
    SET staff_id   = COALESCE((v_modification->>'staff_id')::uuid, staff_id),
        price      = COALESCE((v_modification->>'price')::numeric, price),
        updated_at = now()
    WHERE id = (v_modification->>'id')::uuid
      AND salon_id = p_salon_id
      AND status IN ('SCHEDULED', 'IN_PROGRESS')
      AND deleted_at IS NULL;
  END LOOP;

  -- Complete the remaining honoured appointments in the group
  IF p_appointment_id IS NOT NULL THEN
    SELECT group_id INTO v_group_id FROM appointments WHERE id = p_appointment_id;

    IF v_group_id IS NOT NULL THEN
      UPDATE appointments
      SET status = 'COMPLETED', updated_at = now()
      WHERE group_id = v_group_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS')
        AND deleted_at IS NULL
        AND id <> ALL(v_deleted_ids);

      -- Group status tracks sibling aggregate. Flip to COMPLETED only when
      -- no sibling remains un-terminal.
      IF NOT EXISTS (
        SELECT 1 FROM appointments
         WHERE group_id = v_group_id
           AND status IN ('SCHEDULED', 'IN_PROGRESS')
           AND deleted_at IS NULL
      ) THEN
        UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
        WHERE id = v_group_id;
      END IF;
    ELSE
      UPDATE appointments
      SET status = 'COMPLETED', updated_at = now()
      WHERE id = p_appointment_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS');
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$;
