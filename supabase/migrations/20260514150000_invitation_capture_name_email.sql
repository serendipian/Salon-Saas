-- Invitation flow: capture invitee name + email at creation time, replacing
-- the broken assumption that staff_members.email always exists. Patches both
-- accept_invitation variants with auto-link-by-email (FOR UPDATE for race
-- safety), invitation-row fallback, and the correct Tailwind color format.

-- 1. Schema: capture invitee name on the invitation row itself.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- 2. get_invitation_info: invitation row wins over linked staff record so
-- the manager's typed email is authoritative; legacy invitations with NULL
-- captured values fall back to the linked staff record.
CREATE OR REPLACE FUNCTION get_invitation_info(p_token TEXT)
RETURNS TABLE (
  staff_first_name TEXT,
  staff_last_name TEXT,
  staff_email TEXT,
  salon_name TEXT,
  role TEXT,
  is_valid BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT
    i.*,
    s.name AS sn,
    sm.first_name AS sm_first_name,
    sm.last_name AS sm_last_name,
    sm.email AS sm_email
  INTO v_inv
  FROM invitations i
  JOIN salons s ON s.id = i.salon_id
  LEFT JOIN staff_members sm
    ON sm.id = i.staff_member_id AND sm.deleted_at IS NULL
  WHERE i.token = p_token;

  IF v_inv IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_inv.first_name, v_inv.sm_first_name),
    COALESCE(v_inv.last_name,  v_inv.sm_last_name),
    COALESCE(v_inv.email,      v_inv.sm_email),
    v_inv.sn,
    v_inv.role,
    (v_inv.accepted_at IS NULL AND v_inv.expires_at > now());
END;
$$;

-- Re-grant: CREATE OR REPLACE preserves grants but be explicit for clarity.
GRANT EXECUTE ON FUNCTION get_invitation_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_invitation_info(TEXT) TO authenticated;

-- 3. accept_invitation (auth.uid variant): used when an already-signed-in
-- user clicks the invitation link.
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation           RECORD;
  v_membership_id        UUID;
  v_profile_id           UUID;
  v_auto_linked_staff_id UUID;
  v_color                TEXT;
BEGIN
  v_profile_id := auth.uid();

  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id
      AND profile_id = v_profile_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  -- Auto-link by email: if no explicit staff_member_id but the invitation
  -- carries an email matching an active, unlinked staff record, lock and
  -- adopt that row so we don't create a duplicate.
  IF v_invitation.staff_member_id IS NULL AND v_invitation.email IS NOT NULL THEN
    SELECT id INTO v_auto_linked_staff_id
    FROM staff_members
    WHERE salon_id = v_invitation.salon_id
      AND lower(email) = lower(v_invitation.email)
      AND membership_id IS NULL
      AND deleted_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_auto_linked_staff_id IS NOT NULL THEN
      v_invitation.staff_member_id := v_auto_linked_staff_id;
    END IF;
  END IF;

  INSERT INTO salon_memberships (
    salon_id, profile_id, role, status, invited_by, invited_at, accepted_at
  ) VALUES (
    v_invitation.salon_id, v_profile_id, v_invitation.role, 'active',
    v_invitation.invited_by, v_invitation.created_at, now()
  )
  RETURNING id INTO v_membership_id;

  -- Link existing staff member OR create new one for stylist
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
    v_color := (ARRAY[
      'bg-rose-100 text-rose-800',
      'bg-blue-100 text-blue-800',
      'bg-emerald-100 text-emerald-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-slate-100 text-slate-800'
    ])[1 + floor(random() * 6)::int];

    INSERT INTO staff_members (
      salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate
    ) VALUES (
      v_invitation.salon_id,
      v_membership_id,
      COALESCE(v_invitation.first_name, ''),
      COALESCE(v_invitation.last_name, ''),
      v_invitation.email,
      'Stylist',
      v_color,
      true,
      0
    );
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, vault;

-- 4. accept_invitation_admin (service-role variant): used by the
-- accept-invitation-signup Edge Function. Identical logic except the profile
-- id is passed in (the auth user was just created server-side).
CREATE OR REPLACE FUNCTION accept_invitation_admin(p_token TEXT, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_invitation           RECORD;
  v_membership_id        UUID;
  v_auto_linked_staff_id UUID;
  v_color                TEXT;
BEGIN
  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id
      AND profile_id = p_user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  IF v_invitation.staff_member_id IS NULL AND v_invitation.email IS NOT NULL THEN
    SELECT id INTO v_auto_linked_staff_id
    FROM staff_members
    WHERE salon_id = v_invitation.salon_id
      AND lower(email) = lower(v_invitation.email)
      AND membership_id IS NULL
      AND deleted_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_auto_linked_staff_id IS NOT NULL THEN
      v_invitation.staff_member_id := v_auto_linked_staff_id;
    END IF;
  END IF;

  INSERT INTO salon_memberships (
    salon_id, profile_id, role, status, invited_by, invited_at, accepted_at
  ) VALUES (
    v_invitation.salon_id, p_user_id, v_invitation.role, 'active',
    v_invitation.invited_by, v_invitation.created_at, now()
  )
  RETURNING id INTO v_membership_id;

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
    v_color := (ARRAY[
      'bg-rose-100 text-rose-800',
      'bg-blue-100 text-blue-800',
      'bg-emerald-100 text-emerald-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-slate-100 text-slate-800'
    ])[1 + floor(random() * 6)::int];

    INSERT INTO staff_members (
      salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate
    ) VALUES (
      v_invitation.salon_id,
      v_membership_id,
      COALESCE(v_invitation.first_name, ''),
      COALESCE(v_invitation.last_name, ''),
      v_invitation.email,
      'Stylist',
      v_color,
      true,
      0
    );
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, vault;
