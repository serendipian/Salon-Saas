-- Fix get_staff_pii_batch: unnest() doesn't work on SETOF uuid from user_salon_ids_with_role
-- Use IN (SELECT ...) pattern instead, matching get_staff_pii (single)

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
BEGIN
  RETURN QUERY
  SELECT
    sm.id AS staff_id,
    decrypt_pii(sm.base_salary) AS base_salary,
    decrypt_pii(sm.iban) AS iban,
    decrypt_pii(sm.social_security_number) AS social_security_number
  FROM staff_members sm
  WHERE sm.id = ANY(p_staff_ids)
    AND sm.deleted_at IS NULL
    AND sm.salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']));
END;
$$;
