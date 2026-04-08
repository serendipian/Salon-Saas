-- Fix: expenses and suppliers need permissive SELECT policies without
-- deleted_at IS NULL filter, so that soft-delete UPDATEs
-- (setting deleted_at = now()) pass RLS on the new row state.
-- Same pattern as 20260408170000_add_admin_select_for_soft_delete.sql.

-- expenses (soft-deleted in useAccounting.ts)
CREATE POLICY expenses_select_admin ON expenses FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- suppliers (soft-deleted in useSuppliers.ts)
CREATE POLICY suppliers_select_admin ON suppliers FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
