-- ============================================================
-- Fix: void_transaction same-day check must use the salon's timezone
-- ============================================================
-- The check `v_original.date::date != CURRENT_DATE` compared dates in UTC.
-- For a salon in Africa/Casablanca or Europe/Paris (UTC+1), a sale made
-- at 23:50 local on day N is stored as 22:50 UTC on day N → CURRENT_DATE
-- on day N matches → ok. But a sale at 00:50 local on day N+1 is stored
-- as 23:50 UTC on day N → server thinks "yesterday" while the cashier
-- (and the frontend `isToday` check, which uses browser-local time) both
-- see "today". Result: voids of fresh sales made just after midnight
-- UTC fail with "Void is only allowed on same-day transactions."
--
-- Fix: compare dates in the salon's timezone (salons.timezone, default
-- 'Europe/Paris'). This matches the cashier's experience.
-- ============================================================

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
  v_salon_tz TEXT;
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

  -- Resolve salon timezone (NOT NULL with default, but coalesce defensively)
  SELECT COALESCE(timezone, 'Europe/Paris') INTO v_salon_tz
  FROM salons WHERE id = p_salon_id;

  -- Fetch and validate original
  SELECT * INTO v_original FROM transactions
  WHERE id = p_transaction_id AND salon_id = p_salon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = '23503';
  END IF;

  IF v_original.type != 'SALE' THEN
    RAISE EXCEPTION 'Only SALE transactions can be voided';
  END IF;

  -- Same-day check in salon's local timezone (matches cashier's calendar day)
  IF (v_original.date AT TIME ZONE v_salon_tz)::date
       != (now() AT TIME ZONE v_salon_tz)::date THEN
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
