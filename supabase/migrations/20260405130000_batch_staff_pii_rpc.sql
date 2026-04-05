-- Batch RPC to read decrypted PII for multiple staff members at once
-- Eliminates N+1 queries in useTeamPerformance (1 call instead of N)

CREATE OR REPLACE FUNCTION get_staff_pii_batch(p_staff_ids UUID[])
RETURNS TABLE(
  staff_id UUID,
  base_salary TEXT,
  iban TEXT,
  social_security_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_allowed_salon_ids UUID[];
BEGIN
  -- Get all salon IDs the caller can access as owner/manager
  SELECT array_agg(id) INTO v_allowed_salon_ids
  FROM unnest(user_salon_ids_with_role(ARRAY['owner', 'manager'])) AS id;

  RETURN QUERY
  SELECT
    sm.id AS staff_id,
    decrypt_pii(sm.base_salary) AS base_salary,
    decrypt_pii(sm.iban) AS iban,
    decrypt_pii(sm.social_security_number) AS social_security_number
  FROM staff_members sm
  WHERE sm.id = ANY(p_staff_ids)
    AND sm.deleted_at IS NULL
    AND sm.salon_id = ANY(v_allowed_salon_ids);
END;
$$;
