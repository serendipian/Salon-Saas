-- Transaction tips — Phase H
--
-- New table `transaction_tips` records per-staff gratuities attached to a
-- transaction. Tips are conceptually distinct from payments and items:
--   - `transaction_payments.amount` covers services + products only
--   - `transaction_tips.amount` covers gratuity per recipient
--   - `transactions.total` continues to mean services+products (VAT base)
--
-- Why a dedicated table (vs a column on transactions or a polymorphic item):
--   - Multiple tip recipients per visit ("10 € Sarah, 5 € colorist")
--   - Per-tip method (cash tip vs card tip on the same transaction)
--   - Per-staff reporting in a single SQL query
--   - Future tip-payout integration (staff_payouts) joins cleanly
--
-- Method validation is now centralized in is_valid_payment_method() to avoid
-- drift across transaction_payments + transaction_tips + RPC validation.

-- ============================================================
-- 1. Centralized method validator
-- ============================================================

CREATE OR REPLACE FUNCTION is_valid_payment_method(m TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT m IN ('CASH', 'CARD', 'TRANSFER', 'CHECK', 'MOBILE', 'OTHER')
$$;

-- Replace the existing transaction_payments method CHECK to use the helper
-- (single source of truth; future method additions only touch one place).
ALTER TABLE transaction_payments DROP CONSTRAINT IF EXISTS transaction_payments_method_check;
ALTER TABLE transaction_payments
  ADD CONSTRAINT transaction_payments_method_check
  CHECK (is_valid_payment_method(method));

-- ============================================================
-- 2. transaction_tips table
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id),
  -- Nullable + ON DELETE SET NULL matches transaction_items.staff_id precedent.
  -- Staff are soft-deleted, but if a hard delete ever happens, the tip row
  -- survives and the UI renders "Pourboire (staff supprimé)" gracefully.
  staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (is_valid_payment_method(method)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS transaction_tips_salon_staff_created_idx
  ON transaction_tips (salon_id, staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_tips_transaction_idx
  ON transaction_tips (transaction_id);

-- ============================================================
-- 3. RLS policies
-- ============================================================

ALTER TABLE transaction_tips ENABLE ROW LEVEL SECURITY;

-- Owners / managers / receptionists see all tips in their salon.
-- Stylists see only their OWN tips (via staff_members → salon_memberships → auth.uid()).
-- Tip privacy matters in salons — a stylist shouldn't see a peer's earnings.
DROP POLICY IF EXISTS "transaction_tips_select" ON transaction_tips;
CREATE POLICY "transaction_tips_select" ON transaction_tips
  FOR SELECT TO authenticated
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
    OR staff_id IN (
      SELECT sm.id
      FROM staff_members sm
      JOIN salon_memberships smb ON smb.id = sm.membership_id
      WHERE smb.profile_id = auth.uid()
        AND smb.deleted_at IS NULL
    )
  );

-- Defense in depth: even though create_transaction is SECURITY DEFINER,
-- mirror the existing transaction_items / transaction_payments INSERT policy
-- so a future direct-insert path is safe.
DROP POLICY IF EXISTS "transaction_tips_insert" ON transaction_tips;
CREATE POLICY "transaction_tips_insert" ON transaction_tips
  FOR INSERT TO authenticated
  WITH CHECK (salon_id IN (SELECT user_salon_ids()));

-- No UPDATE policy (tips are immutable).
-- No DELETE policy (cascade-only via FK).

GRANT SELECT, INSERT ON transaction_tips TO authenticated;

-- ============================================================
-- 4. create_transaction RPC extension
-- ============================================================
-- Adds p_tips JSONB DEFAULT '[]' parameter. Validates each tip up front,
-- inserts after transaction_payments, before deletions/modifications/group
-- completion. Tips do NOT contribute to the v_payment_total >= v_total check
-- because tips are not part of the services-revenue total.

CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_deleted_appointments JSONB DEFAULT '[]'::jsonb,
  p_modified_appointments JSONB DEFAULT '[]'::jsonb,
  p_tips JSONB DEFAULT '[]'::jsonb
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
  v_tip JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_staff_id UUID;
  v_group_id UUID;
  v_ticket_number BIGINT;
  v_deleted_ids UUID[] := ARRAY[]::UUID[];
  v_reason TEXT;
  v_note TEXT;
  v_tip_staff_id UUID;
  v_tip_amount NUMERIC(10,2);
  v_tip_method TEXT;
BEGIN
  -- Reject empty item list up front
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

  -- Validate each deletion payload up front
  FOR v_deletion IN SELECT * FROM jsonb_array_elements(p_deleted_appointments)
  LOOP
    v_reason := v_deletion->>'reason';
    IF v_reason NOT IN ('CANCELLED', 'REPLACED', 'OFFERED', 'COMPLAINED', 'ERROR') THEN
      RAISE EXCEPTION 'Invalid deletion reason: %', v_reason
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Validate each tip payload up front
  FOR v_tip IN SELECT * FROM jsonb_array_elements(p_tips)
  LOOP
    v_tip_method := v_tip->>'method';
    v_tip_amount := (v_tip->>'amount')::numeric;
    v_tip_staff_id := (v_tip->>'staff_id')::uuid;
    IF NOT is_valid_payment_method(v_tip_method) THEN
      RAISE EXCEPTION 'Invalid tip method: %', v_tip_method
        USING ERRCODE = '22023';
    END IF;
    IF v_tip_amount IS NULL OR v_tip_amount <= 0 THEN
      RAISE EXCEPTION 'Tip amount must be positive: %', v_tip->>'amount'
        USING ERRCODE = '22023';
    END IF;
    IF v_tip_staff_id IS NULL THEN
      RAISE EXCEPTION 'Tip staff_id is required'
        USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM staff_members
      WHERE id = v_tip_staff_id AND salon_id = p_salon_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid tip staff_id for this salon: %', v_tip_staff_id;
    END IF;
  END LOOP;

  -- Totals (services only — tips are independent)
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

  -- Tips (one row per recipient, validated above)
  FOR v_tip IN SELECT * FROM jsonb_array_elements(p_tips)
  LOOP
    INSERT INTO transaction_tips (transaction_id, salon_id, staff_id, amount, method, created_by)
    VALUES (
      v_transaction_id,
      p_salon_id,
      (v_tip->>'staff_id')::uuid,
      (v_tip->>'amount')::numeric,
      v_tip->>'method',
      auth.uid()
    );
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

  -- Apply modifications (staff and/or price changes + change_note from cart)
  FOR v_modification IN SELECT * FROM jsonb_array_elements(p_modified_appointments)
  LOOP
    UPDATE appointments
    SET staff_id    = COALESCE((v_modification->>'staff_id')::uuid, staff_id),
        price       = COALESCE((v_modification->>'price')::numeric, price),
        change_note = COALESCE(NULLIF(TRIM(v_modification->>'note'), ''), change_note),
        updated_at  = now()
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
