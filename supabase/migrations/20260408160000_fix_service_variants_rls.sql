-- Fix: ensure service_variants RLS policies use membership-based functions
-- (not legacy get_active_salon() which always returns NULL)

-- Drop any existing policies (old or new)
DROP POLICY IF EXISTS service_variants_select ON service_variants;
DROP POLICY IF EXISTS service_variants_insert ON service_variants;
DROP POLICY IF EXISTS service_variants_update ON service_variants;
DROP POLICY IF EXISTS service_variants_delete ON service_variants;

-- Recreate with membership-based checks
CREATE POLICY service_variants_select ON service_variants FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY service_variants_insert ON service_variants FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY service_variants_update ON service_variants FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY service_variants_delete ON service_variants FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Also fix services table policies (same pattern)
DROP POLICY IF EXISTS services_select ON services;
DROP POLICY IF EXISTS services_insert ON services;
DROP POLICY IF EXISTS services_update ON services;
DROP POLICY IF EXISTS services_delete ON services;

CREATE POLICY services_select ON services FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY services_insert ON services FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY services_update ON services FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY services_delete ON services FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
