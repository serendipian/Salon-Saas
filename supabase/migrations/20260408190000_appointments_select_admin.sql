-- Allow owners to query soft-deleted appointments (audit trail).
-- Additive SELECT policy: combined with the base policy via OR,
-- so owners see both active and deleted rows when the app requests them.
CREATE POLICY appointments_select_admin ON appointments FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner'])));
