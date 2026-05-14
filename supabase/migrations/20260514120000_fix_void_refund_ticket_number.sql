-- ============================================================
-- Fix: void_transaction and refund_transaction must allocate ticket_number
-- ============================================================
-- Both RPCs were written before transactions.ticket_number became NOT NULL
-- (migration 20260423120000). They insert into transactions without a
-- ticket_number, which now fails with 23502 → PostgREST returns HTTP 400
-- and the UI shows "Impossible d'annuler la transaction".
--
-- This migration recreates both functions, atomically allocating a per-salon
-- ticket_number from salon_ticket_counters (same pattern as create_transaction).
-- All other behavior is preserved verbatim.
-- ============================================================

-- void_transaction
CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_reason_category TEXT,
  p_reason_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_original RECORD;
  v_void_id UUID;
  v_item RECORD;
  v_ticket_number BIGINT;
BEGIN
  -- Permission: owner or manager only
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only owner or manager can void transactions'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch and validate original
  SELECT * INTO v_original FROM transactions
  WHERE id = p_transaction_id AND salon_id = p_salon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = '23503';
  END IF;

  IF v_original.type != 'SALE' THEN
    RAISE EXCEPTION 'Only SALE transactions can be voided';
  END IF;

  IF v_original.date::date != CURRENT_DATE THEN
    RAISE EXCEPTION 'Void is only allowed on same-day transactions. Use refund for past transactions.';
  END IF;

  -- Check not already voided
  IF EXISTS (SELECT 1 FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'VOID') THEN
    RAISE EXCEPTION 'Transaction has already been voided';
  END IF;

  -- Check not already refunded (partial or full)
  IF EXISTS (SELECT 1 FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'REFUND') THEN
    RAISE EXCEPTION 'Transaction has refunds — cannot void. Use refund instead.';
  END IF;

  -- Atomic per-salon ticket number assignment (mirrors create_transaction)
  INSERT INTO salon_ticket_counters (salon_id)
  VALUES (p_salon_id)
  ON CONFLICT (salon_id) DO NOTHING;

  UPDATE salon_ticket_counters
     SET next_ticket_number = next_ticket_number + 1,
         updated_at = now()
   WHERE salon_id = p_salon_id
  RETURNING next_ticket_number - 1 INTO v_ticket_number;

  -- Create void transaction (negative total)
  INSERT INTO transactions (
    salon_id, client_id, date, total, notes, created_by, appointment_id,
    type, original_transaction_id, reason_category, reason_note, ticket_number
  ) VALUES (
    p_salon_id, v_original.client_id, now(), -v_original.total, v_original.notes, auth.uid(), NULL,
    'VOID', p_transaction_id, p_reason_category, p_reason_note, v_ticket_number
  ) RETURNING id INTO v_void_id;

  -- Mirror items with negative prices
  FOR v_item IN
    SELECT * FROM transaction_items WHERE transaction_id = p_transaction_id
  LOOP
    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
    ) VALUES (
      v_void_id, p_salon_id, v_item.reference_id, v_item.type, v_item.name, v_item.variant_name,
      -v_item.price, v_item.original_price, v_item.quantity, v_item.cost, v_item.note,
      v_item.staff_id, v_item.staff_name, v_item.id
    );

    -- Restock products
    IF v_item.type = 'PRODUCT' AND v_item.reference_id IS NOT NULL THEN
      UPDATE products SET stock = stock + v_item.quantity, updated_at = now()
      WHERE id = v_item.reference_id AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  -- Mirror payments with negative amounts
  INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
  SELECT v_void_id, p_salon_id, method, -amount
  FROM transaction_payments WHERE transaction_id = p_transaction_id;

  RETURN v_void_id;
END;
$$;

-- refund_transaction
CREATE OR REPLACE FUNCTION refund_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_reason_category TEXT,
  p_reason_note TEXT,
  p_restock BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_original RECORD;
  v_refund_id UUID;
  v_item JSONB;
  v_orig_item RECORD;
  v_already_refunded INTEGER;
  v_refund_total NUMERIC(10,2) := 0;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_total_previously_refunded NUMERIC(10,2);
  v_item_price NUMERIC(10,2);
  v_ticket_number BIGINT;
BEGIN
  -- Permission: owner or manager only
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only owner or manager can refund transactions'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch and validate original
  SELECT * INTO v_original FROM transactions
  WHERE id = p_transaction_id AND salon_id = p_salon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = '23503';
  END IF;

  IF v_original.type != 'SALE' THEN
    RAISE EXCEPTION 'Only SALE transactions can be refunded';
  END IF;

  -- Check not voided
  IF EXISTS (SELECT 1 FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'VOID') THEN
    RAISE EXCEPTION 'Transaction has been voided — cannot refund';
  END IF;

  -- Calculate total previously refunded
  SELECT COALESCE(SUM(ABS(total)), 0) INTO v_total_previously_refunded
  FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'REFUND';

  -- Atomic per-salon ticket number assignment (mirrors create_transaction)
  INSERT INTO salon_ticket_counters (salon_id)
  VALUES (p_salon_id)
  ON CONFLICT (salon_id) DO NOTHING;

  UPDATE salon_ticket_counters
     SET next_ticket_number = next_ticket_number + 1,
         updated_at = now()
   WHERE salon_id = p_salon_id
  RETURNING next_ticket_number - 1 INTO v_ticket_number;

  -- Create refund transaction (total computed from items)
  INSERT INTO transactions (
    salon_id, client_id, date, total, notes, created_by,
    type, original_transaction_id, reason_category, reason_note, ticket_number
  ) VALUES (
    p_salon_id, v_original.client_id, now(), 0, NULL, auth.uid(),
    'REFUND', p_transaction_id, p_reason_category, p_reason_note, v_ticket_number
  ) RETURNING id INTO v_refund_id;

  -- Process refund items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'original_item_id') IS NOT NULL THEN
      -- Linked item: validate against original
      SELECT * INTO v_orig_item FROM transaction_items
      WHERE id = (v_item->>'original_item_id')::uuid AND transaction_id = p_transaction_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Refund item references invalid original item';
      END IF;

      -- Check already-refunded quantity for this item
      SELECT COALESCE(SUM(ti.quantity), 0) INTO v_already_refunded
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE ti.original_item_id = v_orig_item.id AND t.type = 'REFUND';

      IF (v_item->>'quantity')::integer > (v_orig_item.quantity - v_already_refunded) THEN
        RAISE EXCEPTION 'Refund quantity exceeds remaining quantity for item %', v_orig_item.name;
      END IF;

      -- Use price_override if provided, otherwise use original price
      IF (v_item->>'price_override') IS NOT NULL THEN
        v_item_price := (v_item->>'price_override')::numeric;
        IF v_item_price > v_orig_item.price * (v_item->>'quantity')::integer THEN
          RAISE EXCEPTION 'Price override exceeds original item total for %', v_orig_item.name;
        END IF;
        -- For price_override: store as single negative amount
        INSERT INTO transaction_items (
          transaction_id, salon_id, reference_id, type, name, variant_name,
          price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
        ) VALUES (
          v_refund_id, p_salon_id, v_orig_item.reference_id, v_orig_item.type,
          v_orig_item.name, v_orig_item.variant_name,
          -v_item_price, v_orig_item.original_price, 1, v_orig_item.cost, v_orig_item.note,
          v_orig_item.staff_id, v_orig_item.staff_name, v_orig_item.id
        );
        v_refund_total := v_refund_total + v_item_price;
      ELSE
        -- Standard: mirror item with negative price, requested quantity
        INSERT INTO transaction_items (
          transaction_id, salon_id, reference_id, type, name, variant_name,
          price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
        ) VALUES (
          v_refund_id, p_salon_id, v_orig_item.reference_id, v_orig_item.type,
          v_orig_item.name, v_orig_item.variant_name,
          -v_orig_item.price, v_orig_item.original_price, (v_item->>'quantity')::integer,
          v_orig_item.cost, v_orig_item.note,
          v_orig_item.staff_id, v_orig_item.staff_name, v_orig_item.id
        );
        v_refund_total := v_refund_total + (v_orig_item.price * (v_item->>'quantity')::integer);
      END IF;

      -- Restock product if requested
      IF p_restock AND v_orig_item.type = 'PRODUCT' AND v_orig_item.reference_id IS NOT NULL THEN
        UPDATE products SET stock = stock + (v_item->>'quantity')::integer, updated_at = now()
        WHERE id = v_orig_item.reference_id AND salon_id = p_salon_id;
      END IF;

    ELSE
      -- Manual amount item (no original_item_id)
      INSERT INTO transaction_items (
        transaction_id, salon_id, reference_id, type, name, variant_name,
        price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
      ) VALUES (
        v_refund_id, p_salon_id, NULL, 'SERVICE',
        COALESCE(v_item->>'name', 'Remboursement partiel'), NULL,
        -(v_item->>'price')::numeric, NULL, 1, NULL, NULL, NULL, NULL, NULL
      );
      v_refund_total := v_refund_total + (v_item->>'price')::numeric;
    END IF;
  END LOOP;

  -- Over-refund guard
  IF (v_total_previously_refunded + v_refund_total) > v_original.total THEN
    RAISE EXCEPTION 'Total refunded amount (%) would exceed original transaction total (%)',
      v_total_previously_refunded + v_refund_total, v_original.total;
  END IF;

  -- Update the refund transaction total (negative)
  UPDATE transactions SET total = -v_refund_total WHERE id = v_refund_id;

  -- Validate payments
  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0) INTO v_payment_total
  FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total != v_refund_total THEN
    RAISE EXCEPTION 'Refund payment total (%) does not match refund total (%)', v_payment_total, v_refund_total;
  END IF;

  -- Insert refund payments (negative amounts)
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_refund_id, p_salon_id, v_payment->>'method', -(v_payment->>'amount')::numeric);
  END LOOP;

  RETURN v_refund_id;
END;
$$;
