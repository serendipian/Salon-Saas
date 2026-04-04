-- Add profile fields for user preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_email BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_sms BOOLEAN NOT NULL DEFAULT false;

-- Add staff_member_id to invitations for linking
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS staff_member_id UUID REFERENCES staff_members(id);

-- Update accept_invitation to link existing staff member when staff_member_id is set
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_membership_id UUID;
  v_profile_id UUID;
BEGIN
  v_profile_id := auth.uid();

  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id AND profile_id = v_profile_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  INSERT INTO salon_memberships (salon_id, profile_id, role, status, invited_by, invited_at, accepted_at)
  VALUES (v_invitation.salon_id, v_profile_id, v_invitation.role, 'active', v_invitation.invited_by, v_invitation.created_at, now())
  RETURNING id INTO v_membership_id;

  -- Link existing staff member OR create new one
  IF v_invitation.staff_member_id IS NOT NULL THEN
    UPDATE staff_members SET membership_id = v_membership_id
    WHERE id = v_invitation.staff_member_id AND salon_id = v_invitation.salon_id;
  ELSIF v_invitation.role = 'stylist' THEN
    DECLARE
      v_profile RECORD;
    BEGIN
      SELECT first_name, last_name, email INTO v_profile FROM profiles WHERE id = v_profile_id;
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

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can manage their own avatar folder
CREATE POLICY avatars_insert ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_update ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_delete ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_select ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
