-- Link transactions back to the appointment they were created from
ALTER TABLE transactions
ADD COLUMN appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Index for lookups (e.g., "has this appointment been paid?")
CREATE INDEX idx_transactions_appointment_id ON transactions(appointment_id);

-- Unique constraint: one transaction per appointment (prevents double-charging)
CREATE UNIQUE INDEX idx_transactions_appointment_id_unique ON transactions(appointment_id) WHERE appointment_id IS NOT NULL;

-- Replace create_transaction to accept p_appointment_id
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

  -- Calculate totals
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total != v_total THEN
    RAISE EXCEPTION 'Payment total (%) does not match transaction total (%)', v_payment_total, v_total;
  END IF;

  -- Insert transaction with optional appointment_id
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id)
  RETURNING id INTO v_transaction_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note, staff_id, staff_name
    ) VALUES (
      v_transaction_id, p_salon_id,
      (v_item->>'reference_id')::uuid, v_item->>'type', v_item->>'name', v_item->>'variant_name',
      (v_item->>'price')::numeric, (v_item->>'original_price')::numeric,
      (v_item->>'quantity')::integer, (v_item->>'cost')::numeric, v_item->>'note',
      (v_item->>'staff_id')::uuid, v_item->>'staff_name'
    );

    IF v_item->>'type' = 'PRODUCT' AND (v_item->>'reference_id') IS NOT NULL THEN
      UPDATE products SET stock = GREATEST(0, stock - (v_item->>'quantity')::integer), updated_at = now()
      WHERE id = (v_item->>'reference_id')::uuid AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- If linked to an appointment, mark it as COMPLETED
  IF p_appointment_id IS NOT NULL THEN
    UPDATE appointments SET status = 'COMPLETED', updated_at = now()
    WHERE id = p_appointment_id AND salon_id = p_salon_id;

    -- Also complete the group if all appointments in the group are completed
    UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
    WHERE id = (SELECT group_id FROM appointments WHERE id = p_appointment_id)
      AND NOT EXISTS (
        SELECT 1 FROM appointments
        WHERE group_id = (SELECT group_id FROM appointments WHERE id = p_appointment_id)
          AND status != 'COMPLETED' AND deleted_at IS NULL AND id != p_appointment_id
      );
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
