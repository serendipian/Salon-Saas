-- Defensive guard on create_transaction: reject empty p_items.
--
-- The client already disables the checkout button when the cart is empty,
-- but a direct RPC call (curl, a misbehaving client, a future integration)
-- could send an empty items array. That would mint a ticket number and
-- insert a total=0 transaction row — bad for accounting and burns a ticket
-- number from the salon's sequence.
--
-- The zero-amount payment validation doesn't catch this either: sum(0) is
-- trivially >= sum(0).
--
-- This migration is a narrow overlay on top of 20260424190000. It re-creates
-- the function with a single new line (the jsonb_array_length check) at the
-- very top of the body. Everything else is verbatim from 20260424190000.

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
  -- Reject empty item list up front. The client UI guards against this via
  -- the checkout button's disabled state, but a direct RPC call could slip
  -- through and mint a zero-euro transaction.
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create a transaction with no items'
      USING ERRCODE = '22023';
  END IF;

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
