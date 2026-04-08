-- ============================================================
-- POS Refunds & Voids: schema, RPCs, RLS, view update
-- ============================================================

-- 1. Add columns to transactions
ALTER TABLE transactions
  ADD COLUMN type TEXT NOT NULL DEFAULT 'SALE'
    CHECK (type IN ('SALE', 'VOID', 'REFUND')),
  ADD COLUMN original_transaction_id UUID REFERENCES transactions(id),
  ADD COLUMN reason_category TEXT,
  ADD COLUMN reason_note TEXT;

-- One void per transaction
CREATE UNIQUE INDEX idx_transactions_void_unique
  ON transactions(original_transaction_id) WHERE type = 'VOID';

-- Fast lookup of refunds/voids for an original
CREATE INDEX idx_transactions_original_id
  ON transactions(original_transaction_id) WHERE original_transaction_id IS NOT NULL;

-- 2. Add original_item_id to transaction_items
ALTER TABLE transaction_items
  ADD COLUMN original_item_id UUID REFERENCES transaction_items(id);

-- 3. Update RLS INSERT policy (defense in depth)
DROP POLICY transactions_insert ON transactions;
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (
  salon_id = get_active_salon()
  AND (type = 'SALE' OR get_user_role() IN ('owner', 'manager'))
);

-- 4. Update client_stats view
DROP VIEW IF EXISTS client_stats;
CREATE VIEW client_stats AS
SELECT
  c.id AS client_id,
  c.salon_id,
  COUNT(DISTINCT t.id) FILTER (WHERE t.type = 'SALE') AS total_visits,
  COALESCE(SUM(t.total), 0) AS total_spent,
  MIN(t.date) FILTER (WHERE t.type = 'SALE')::date AS first_visit_date,
  MAX(t.date) FILTER (WHERE t.type = 'SALE')::date AS last_visit_date
FROM clients c
LEFT JOIN transactions t ON t.client_id = c.id AND t.salon_id = c.salon_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.salon_id;

-- 5. void_transaction RPC
CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_reason_category TEXT,
  p_reason_note TEXT
)
RETURNS UUID AS $$
DECLARE
  v_original RECORD;
  v_void_id UUID;
  v_item RECORD;
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

  -- Create void transaction (negative total)
  INSERT INTO transactions (
    salon_id, client_id, date, total, notes, created_by, appointment_id,
    type, original_transaction_id, reason_category, reason_note
  ) VALUES (
    p_salon_id, v_original.client_id, now(), -v_original.total, v_original.notes, auth.uid(), NULL,
    'VOID', p_transaction_id, p_reason_category, p_reason_note
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. refund_transaction RPC
CREATE OR REPLACE FUNCTION refund_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_reason_category TEXT,
  p_reason_note TEXT,
  p_restock BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
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

  -- Create refund transaction (total computed from items)
  INSERT INTO transactions (
    salon_id, client_id, date, total, notes, created_by,
    type, original_transaction_id, reason_category, reason_note
  ) VALUES (
    p_salon_id, v_original.client_id, now(), 0, NULL, auth.uid(),
    'REFUND', p_transaction_id, p_reason_category, p_reason_note
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
