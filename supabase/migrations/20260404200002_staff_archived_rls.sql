-- Allow owners/managers to see archived (soft-deleted) staff members
-- The existing staff_members_select policy requires deleted_at IS NULL,
-- which blocks the "Voir les archivés" feature in the team list.
-- This additional policy grants SELECT on archived rows to owners/managers only.

CREATE POLICY staff_members_select_archived ON staff_members FOR SELECT
  USING (
    deleted_at IS NOT NULL
    AND salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );
