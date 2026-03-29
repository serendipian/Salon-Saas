-- Fix #4: PII fields must go through server-side encrypt/decrypt RPCs
-- The client should never read or write raw BYTEA PII columns directly

-- RPC to update PII fields with encryption
CREATE OR REPLACE FUNCTION update_staff_pii(
  p_staff_id UUID,
  p_base_salary TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL,
  p_social_security_number TEXT DEFAULT NULL,
  p_clear_base_salary BOOLEAN DEFAULT FALSE,
  p_clear_iban BOOLEAN DEFAULT FALSE,
  p_clear_ssn BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller has access to this staff member's salon
  IF NOT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE sm.id = p_staff_id
      AND sm.deleted_at IS NULL
      AND sm.salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  ) THEN
    RAISE EXCEPTION 'Access denied or staff member not found';
  END IF;

  -- Update each PII field if provided
  IF p_base_salary IS NOT NULL THEN
    UPDATE staff_members SET base_salary = encrypt_pii(p_base_salary) WHERE id = p_staff_id;
  ELSIF p_clear_base_salary THEN
    UPDATE staff_members SET base_salary = NULL WHERE id = p_staff_id;
  END IF;

  IF p_iban IS NOT NULL THEN
    UPDATE staff_members SET iban = encrypt_pii(p_iban) WHERE id = p_staff_id;
  ELSIF p_clear_iban THEN
    UPDATE staff_members SET iban = NULL WHERE id = p_staff_id;
  END IF;

  IF p_social_security_number IS NOT NULL THEN
    UPDATE staff_members SET social_security_number = encrypt_pii(p_social_security_number) WHERE id = p_staff_id;
  ELSIF p_clear_ssn THEN
    UPDATE staff_members SET social_security_number = NULL WHERE id = p_staff_id;
  END IF;
END;
$$;

-- RPC to read decrypted PII fields for a single staff member
CREATE OR REPLACE FUNCTION get_staff_pii(p_staff_id UUID)
RETURNS TABLE(
  base_salary TEXT,
  iban TEXT,
  social_security_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Verify caller has access
  IF NOT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE sm.id = p_staff_id
      AND sm.deleted_at IS NULL
      AND sm.salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  ) THEN
    RAISE EXCEPTION 'Access denied or staff member not found';
  END IF;

  RETURN QUERY
  SELECT
    decrypt_pii(sm.base_salary) AS base_salary,
    decrypt_pii(sm.iban) AS iban,
    decrypt_pii(sm.social_security_number) AS social_security_number
  FROM staff_members sm
  WHERE sm.id = p_staff_id;
END;
$$;
