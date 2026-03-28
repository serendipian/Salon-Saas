-- Fix: appointment_groups_update policy blocks soft-delete
-- Because USING clause (checked on both old AND new row when no WITH CHECK)
-- includes `deleted_at IS NULL`, setting deleted_at fails.
-- Split into USING (old row) + WITH CHECK (new row).

DROP POLICY IF EXISTS appointment_groups_update ON appointment_groups;

CREATE POLICY appointment_groups_update ON appointment_groups
  FOR UPDATE
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
    AND deleted_at IS NULL
  )
  WITH CHECK (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
  );
