-- Admin version of accept_invitation that takes a user_id parameter
-- Used by the accept-invitation-signup Edge Function (service role)
CREATE OR REPLACE FUNCTION accept_invitation_admin(p_token TEXT, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_membership_id UUID;
BEGIN
  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id AND profile_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  INSERT INTO salon_memberships (salon_id, profile_id, role, status, invited_by, invited_at, accepted_at)
  VALUES (v_invitation.salon_id, p_user_id, v_invitation.role, 'active', v_invitation.invited_by, v_invitation.created_at, now())
  RETURNING id INTO v_membership_id;

  -- Link existing staff member OR create new one
  IF v_invitation.staff_member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM staff_members
      WHERE id = v_invitation.staff_member_id
        AND membership_id IS NOT NULL
        AND membership_id != v_membership_id
    ) THEN
      RAISE EXCEPTION 'Staff member is already linked to another account';
    END IF;

    UPDATE staff_members SET membership_id = v_membership_id
    WHERE id = v_invitation.staff_member_id
      AND salon_id = v_invitation.salon_id
      AND (membership_id IS NULL OR membership_id = v_membership_id);
  ELSIF v_invitation.role = 'stylist' THEN
    DECLARE
      v_profile RECORD;
    BEGIN
      SELECT first_name, last_name, email INTO v_profile FROM profiles WHERE id = p_user_id;
      INSERT INTO staff_members (salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate)
      VALUES (
        v_invitation.salon_id, v_membership_id,
        COALESCE(v_profile.first_name, ''), COALESCE(v_profile.last_name, ''),
        v_profile.email, 'Stylist',
        '#' || lpad(to_hex(floor(random() * 16777215)::int), 6, '0'),
        true, 0
      );
    END;
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
