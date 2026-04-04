-- RPC: leave_salon
-- Allows any authenticated user to leave a salon they belong to.
-- Validates they are not the sole owner, soft-deletes membership + linked staff member.
CREATE OR REPLACE FUNCTION leave_salon(p_salon_id UUID)
RETURNS void AS $$
DECLARE
  v_membership_id UUID;
  v_role TEXT;
  v_owner_count INTEGER;
BEGIN
  -- Find the caller's membership
  SELECT id, role INTO v_membership_id, v_role
  FROM salon_memberships
  WHERE salon_id = p_salon_id AND profile_id = auth.uid() AND deleted_at IS NULL;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this salon';
  END IF;

  -- Prevent sole owner from leaving
  IF v_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM salon_memberships
    WHERE salon_id = p_salon_id AND role = 'owner' AND deleted_at IS NULL;

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot leave: you are the sole owner of this salon';
    END IF;
  END IF;

  -- Soft-delete the membership
  UPDATE salon_memberships SET deleted_at = now() WHERE id = v_membership_id;

  -- Soft-delete any linked staff member
  UPDATE staff_members SET deleted_at = now(), active = false
  WHERE membership_id = v_membership_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
