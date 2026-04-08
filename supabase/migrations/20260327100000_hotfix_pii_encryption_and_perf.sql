-- ============================================================
-- HOTFIX 1: PII Encryption for staff_members
-- Fields: iban, social_security_number, base_salary
-- Uses pgcrypto from extensions schema (Supabase cloud convention)
-- ============================================================

-- Ensure pgcrypto is available in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Step 1: Add encrypted columns alongside existing ones
ALTER TABLE staff_members
  ADD COLUMN iban_encrypted BYTEA,
  ADD COLUMN ssn_encrypted BYTEA,
  ADD COLUMN salary_encrypted BYTEA;

-- Step 2: Create encrypt/decrypt helper functions
-- The encryption key is set as a Supabase secret via app.encryption_key session variable
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext TEXT)
RETURNS BYTEA
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT extensions.pgp_sym_encrypt(
    plaintext,
    current_setting('app.encryption_key', true)
  );
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT extensions.pgp_sym_decrypt(
    ciphertext,
    current_setting('app.encryption_key', true)
  );
$$;

-- Step 3: Migrate existing plaintext data (if any exists)
-- REDACTED: Originally used a temporary migration key. This migration ran on an empty
-- table (seed data comes later), so no rows were affected. The encryption key has since
-- been rotated and lives in Supabase Vault. This migration is already applied.
-- No action needed.

-- Step 4: Drop plaintext columns
ALTER TABLE staff_members
  DROP COLUMN iban,
  DROP COLUMN social_security_number,
  DROP COLUMN base_salary;

-- Step 5: Rename encrypted columns to original names
ALTER TABLE staff_members RENAME COLUMN iban_encrypted TO iban;
ALTER TABLE staff_members RENAME COLUMN ssn_encrypted TO social_security_number;
ALTER TABLE staff_members RENAME COLUMN salary_encrypted TO base_salary;

-- ============================================================
-- HOTFIX 2: get_staff_id() function for RLS performance
-- Caches staff_id lookup in session variable to avoid N+1
-- ============================================================

CREATE OR REPLACE FUNCTION get_staff_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(current_setting('app.staff_id', true), '')::UUID;
$$;

-- Update set_session_context to also cache staff_id
CREATE OR REPLACE FUNCTION set_session_context(p_salon_id UUID, p_user_role TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  PERFORM set_config('app.active_salon_id', p_salon_id::text, false);
  PERFORM set_config('app.user_role', p_user_role, false);

  -- Cache staff_id for stylist RLS performance
  IF p_user_role = 'stylist' THEN
    SELECT sm.id INTO v_staff_id
    FROM staff_members sm
    INNER JOIN salon_memberships m ON m.id = sm.membership_id
    WHERE m.profile_id = auth.uid()
      AND m.salon_id = p_salon_id
      AND sm.deleted_at IS NULL
    LIMIT 1;

    PERFORM set_config('app.staff_id', COALESCE(v_staff_id::text, ''), false);
  ELSE
    PERFORM set_config('app.staff_id', '', false);
  END IF;
END;
$$;

-- ============================================================
-- HOTFIX 3: Update RLS policies to use get_staff_id()
-- Replaces correlated subqueries with cached session variable
-- ============================================================

-- Appointments: replace stylist subquery
DROP POLICY IF EXISTS appointments_select ON appointments;
CREATE POLICY appointments_select ON appointments FOR SELECT USING (
  salon_id = get_active_salon() AND deleted_at IS NULL AND (
    get_user_role() IN ('owner', 'manager', 'receptionist')
    OR (get_user_role() = 'stylist' AND staff_id = get_staff_id())
  )
);

-- Clients: replace stylist subquery
DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT USING (
  salon_id = get_active_salon() AND deleted_at IS NULL AND (
    get_user_role() IN ('owner', 'manager', 'receptionist')
    OR (get_user_role() = 'stylist' AND id IN (
      SELECT DISTINCT a.client_id FROM appointments a
      WHERE a.staff_id = get_staff_id()
        AND a.salon_id = get_active_salon()
        AND a.deleted_at IS NULL
    ))
  )
);

-- Staff members: replace stylist subquery for self-view
DROP POLICY IF EXISTS staff_members_select ON staff_members;
CREATE POLICY staff_members_select ON staff_members FOR SELECT USING (
  salon_id = get_active_salon() AND deleted_at IS NULL AND (
    get_user_role() IN ('owner', 'manager')
    OR id = get_staff_id()
  )
);

DROP POLICY IF EXISTS staff_members_update ON staff_members;
CREATE POLICY staff_members_update ON staff_members FOR UPDATE USING (
  salon_id = get_active_salon() AND (
    get_user_role() IN ('owner', 'manager')
    OR id = get_staff_id()
  )
);

-- ============================================================
-- HOTFIX 4: Add payment method enum constraint
-- ============================================================

ALTER TABLE transaction_payments
  ADD CONSTRAINT transaction_payments_method_check
  CHECK (method IN ('CASH', 'CARD', 'TRANSFER', 'CHECK', 'MOBILE', 'OTHER'));

-- ============================================================
-- HOTFIX 5: Fix ledger_entries view consistency
-- Remove session-context dependency from WHERE, let RLS handle it
-- ============================================================

CREATE OR REPLACE VIEW ledger_entries AS
SELECT
  t.id, t.salon_id, t.date, 'INCOME'::text AS type,
  COALESCE(
    (SELECT string_agg(ti.name, ', ' ORDER BY ti.name) FROM transaction_items ti WHERE ti.transaction_id = t.id),
    'Transaction'
  ) AS label,
  'Ventes'::text AS category,
  t.total AS amount,
  NULL::jsonb AS details
FROM transactions t

UNION ALL

SELECT
  e.id, e.salon_id, e.date::timestamptz, 'EXPENSE'::text AS type,
  e.description AS label,
  COALESCE(ec.name, 'Non classé') AS category,
  e.amount,
  NULL::jsonb AS details
FROM expenses e
LEFT JOIN expense_categories ec ON ec.id = e.category_id
WHERE e.deleted_at IS NULL

ORDER BY date DESC;
