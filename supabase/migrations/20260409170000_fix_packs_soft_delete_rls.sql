-- Fix: pack soft-delete fails with 42501 (RLS violation).
--
-- Root cause: both packs_select policies include `deleted_at IS NULL`. When an
-- UPDATE sets deleted_at, PostgreSQL checks that the new row is still visible
-- via at least one SELECT policy (to prevent "row invisibility" on UPDATE).
-- Because both SELECT policies filter out soft-deleted rows, the new row
-- becomes invisible and the UPDATE is rejected with
-- "new row violates row-level security policy".
--
-- Fix: drop `deleted_at IS NULL` from packs_select_admin so owners/managers can
-- see archived packs. This matches the pattern used by services_select_admin,
-- clients_select_admin, etc., and is the convention documented in CLAUDE.md
-- ("to query archived records, add a separate additive policy for owner/manager").

DROP POLICY IF EXISTS packs_select_admin ON packs;
CREATE POLICY packs_select_admin ON packs FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
