-- Accept IN_PROGRESS appointments at POS, not just SCHEDULED.
--
-- The POS pending pool has allowed status IN ('SCHEDULED', 'IN_PROGRESS')
-- since 5398e49, but create_transaction kept rejecting IN_PROGRESS anchors
-- and left IN_PROGRESS siblings behind (not marked COMPLETED on transaction).
-- Net effect: clicking an IN_PROGRESS card at POS either errored out or
-- left orphaned IN_PROGRESS rows after billing.
--
-- This migration teaches create_transaction that both SCHEDULED and
-- IN_PROGRESS are billable-active states. Signature, ticket-number logic,
-- and all other behavior preserved. Based on the 20260423120000 version.

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
  v_group_id UUID;
  v_ticket_number BIGINT;
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

  -- Anchor may be SCHEDULED or IN_PROGRESS — both represent live, billable work.
  -- COMPLETED, CANCELLED, NO_SHOW are terminal and rejected.
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

  -- Insert transaction with assigned ticket_number
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id, ticket_number)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id, v_ticket_number)
  RETURNING id INTO v_transaction_id;

  -- Items
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

  -- Complete the appointment(s) linked to this transaction.
  -- Any SCHEDULED or IN_PROGRESS sibling in the same group becomes COMPLETED.
  -- CANCELLED / NO_SHOW / already-COMPLETED siblings are untouched.
  IF p_appointment_id IS NOT NULL THEN
    SELECT group_id INTO v_group_id FROM appointments WHERE id = p_appointment_id;

    IF v_group_id IS NOT NULL THEN
      UPDATE appointments SET status = 'COMPLETED', updated_at = now()
      WHERE group_id = v_group_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS')
        AND deleted_at IS NULL;

      UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
      WHERE id = v_group_id;
    ELSE
      UPDATE appointments SET status = 'COMPLETED', updated_at = now()
      WHERE id = p_appointment_id
        AND salon_id = p_salon_id
        AND status IN ('SCHEDULED', 'IN_PROGRESS');
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault;
