-- create_transaction: Atomic multi-table insert + stock update
CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total != v_total THEN
    RAISE EXCEPTION 'Payment total (%) does not match transaction total (%)', v_payment_total, v_total;
  END IF;

  INSERT INTO transactions (salon_id, client_id, total, notes, created_by)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid())
  RETURNING id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note
    ) VALUES (
      v_transaction_id, p_salon_id,
      (v_item->>'reference_id')::uuid, v_item->>'type', v_item->>'name', v_item->>'variant_name',
      (v_item->>'price')::numeric, (v_item->>'original_price')::numeric,
      (v_item->>'quantity')::integer, (v_item->>'cost')::numeric, v_item->>'note'
    );

    IF v_item->>'type' = 'PRODUCT' AND (v_item->>'reference_id') IS NOT NULL THEN
      UPDATE products SET stock = GREATEST(0, stock - (v_item->>'quantity')::integer), updated_at = now()
      WHERE id = (v_item->>'reference_id')::uuid AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- book_appointment: Validates slot + inserts
CREATE OR REPLACE FUNCTION book_appointment(
  p_salon_id UUID,
  p_client_id UUID,
  p_service_variant_id UUID,
  p_staff_id UUID,
  p_date TIMESTAMPTZ,
  p_duration_minutes INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_appointment_id UUID;
  v_service_id UUID;
  v_price NUMERIC(10,2);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to book appointments';
  END IF;

  SELECT sv.service_id, sv.price INTO v_service_id, v_price
  FROM service_variants sv WHERE sv.id = p_service_variant_id AND sv.salon_id = p_salon_id;

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'Service variant not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE staff_id = p_staff_id AND status NOT IN ('CANCELLED') AND deleted_at IS NULL
      AND tstzrange(date, date + (duration_minutes || ' minutes')::interval) &&
          tstzrange(p_date, p_date + (p_duration_minutes || ' minutes')::interval)
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'This time slot is no longer available';
  END IF;

  INSERT INTO appointments (
    salon_id, client_id, service_id, service_variant_id, staff_id,
    date, duration_minutes, status, price, created_by
  ) VALUES (
    p_salon_id, p_client_id, v_service_id, p_service_variant_id, p_staff_id,
    p_date, p_duration_minutes, 'SCHEDULED', v_price, auth.uid()
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- gdpr_delete_client: Anonymize client data
CREATE OR REPLACE FUNCTION gdpr_delete_client(p_client_id UUID)
RETURNS void AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  SELECT c.salon_id INTO v_salon_id FROM clients c WHERE c.id = p_client_id AND c.deleted_at IS NULL;

  IF v_salon_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_salon_id AND profile_id = auth.uid() AND role = 'owner' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Only the salon owner can perform GDPR deletion';
  END IF;

  UPDATE clients SET
    first_name = 'Client', last_name = 'Supprimé',
    email = NULL, phone = NULL, gender = NULL, age_group = NULL, city = NULL,
    profession = NULL, company = NULL, notes = NULL, photo_url = NULL, allergies = NULL,
    instagram = NULL, whatsapp = NULL, social_network = NULL, social_username = NULL,
    preferred_channel = NULL, other_channel_detail = NULL, preferred_language = NULL,
    contact_date = NULL, contact_method = NULL, message_channel = NULL,
    acquisition_source = NULL, acquisition_detail = NULL,
    permissions_social_media = false, permissions_marketing = false,
    permissions_other = false, permissions_other_detail = NULL,
    status = 'INACTIF', deleted_at = now(), updated_at = now()
  WHERE id = p_client_id;

  UPDATE appointments SET notes = NULL, updated_at = now()
  WHERE client_id = p_client_id AND salon_id = v_salon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
