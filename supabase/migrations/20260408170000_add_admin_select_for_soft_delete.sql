-- Fix: PostgreSQL RLS requires new rows (after UPDATE) to pass at least one
-- SELECT policy. When soft-deleting via UPDATE (setting deleted_at = now()),
-- the new row fails the base SELECT policy (which has `deleted_at IS NULL`).
--
-- Solution: Add additive PERMISSIVE SELECT policies for owner/manager that
-- do NOT filter on deleted_at, allowing soft-delete UPDATEs to succeed.
-- These are additive (OR'd with existing SELECT policies) so normal users
-- still only see active records via the base policy.

-- service_variants (soft-deleted in useServices.ts)
CREATE POLICY service_variants_select_admin ON service_variants FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- services (soft-deleted via RPC, but keep consistent)
CREATE POLICY services_select_admin ON services FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- staff_members (soft-deleted in useStaffDetail.ts, also restored from archive)
CREATE POLICY staff_members_select_admin ON staff_members FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- products (soft-deleted in useProducts.ts)
CREATE POLICY products_select_admin ON products FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- expense_categories (soft-deleted in useSettings.ts)
CREATE POLICY expense_categories_select_admin ON expense_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- recurring_expenses (soft-deleted in useSettings.ts)
CREATE POLICY recurring_expenses_select_admin ON recurring_expenses FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- service_categories (soft-deleted via save_service_categories RPC, but keep consistent)
CREATE POLICY service_categories_select_admin ON service_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- brands (may be soft-deleted in future)
CREATE POLICY brands_select_admin ON brands FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- product_categories (may be soft-deleted in future)
CREATE POLICY product_categories_select_admin ON product_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
