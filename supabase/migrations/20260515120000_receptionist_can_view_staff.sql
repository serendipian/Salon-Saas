-- Allow receptionists to SELECT all staff_members in their salon.
--
-- Without this, the POS staff selector, Agenda staff filter chips, and
-- appointment cards show "Aucun membre qualifié" / blank names for
-- receptionists because RLS returns 0 rows.
--
-- Matches the existing pattern in appointments_select and clients_select
-- (same migration file 20260328120000), both of which already include
-- 'receptionist' in the allowed-roles array.
--
-- PII columns (iban, social_security_number, base_salary) are encrypted
-- at-rest via pgcrypto and unreadable without the encryption key, so
-- broadening SELECT does not leak sensitive data.
--
-- INSERT/UPDATE/DELETE policies are intentionally NOT changed:
-- receptionists can read staff records but not create, edit, or remove them.

DROP POLICY IF EXISTS staff_members_select ON staff_members;
CREATE POLICY staff_members_select ON staff_members FOR SELECT
  USING (
    deleted_at IS NULL AND (
      salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
      OR id = user_staff_id_in_salon(salon_id)
    )
  );
