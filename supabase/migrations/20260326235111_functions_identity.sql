-- create_salon: Creates salon + owner membership + seeds defaults
CREATE OR REPLACE FUNCTION create_salon(
  p_name TEXT,
  p_timezone TEXT DEFAULT 'Europe/Paris',
  p_currency TEXT DEFAULT 'EUR',
  p_owner_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_salon_id UUID;
  v_free_plan_id UUID;
BEGIN
  SELECT id INTO v_free_plan_id FROM plans WHERE name = 'Free' AND active = true LIMIT 1;

  INSERT INTO salons (name, timezone, currency, plan_id, subscription_tier, trial_ends_at, schedule)
  VALUES (
    p_name, p_timezone, p_currency, v_free_plan_id, 'trial',
    now() + interval '14 days',
    '{"monday":{"isOpen":true,"start":"09:00","end":"19:00"},"tuesday":{"isOpen":true,"start":"09:00","end":"19:00"},"wednesday":{"isOpen":true,"start":"09:00","end":"19:00"},"thursday":{"isOpen":true,"start":"09:00","end":"19:00"},"friday":{"isOpen":true,"start":"09:00","end":"19:00"},"saturday":{"isOpen":true,"start":"10:00","end":"18:00"},"sunday":{"isOpen":false,"start":"09:00","end":"18:00"}}'::jsonb
  )
  RETURNING id INTO v_salon_id;

  INSERT INTO salon_memberships (salon_id, profile_id, role, status, accepted_at)
  VALUES (v_salon_id, p_owner_id, 'owner', 'active', now());

  INSERT INTO expense_categories (salon_id, name, color, sort_order) VALUES
    (v_salon_id, 'Loyer',     'bg-purple-100 text-purple-700', 1),
    (v_salon_id, 'Salaires',  'bg-blue-100 text-blue-700',     2),
    (v_salon_id, 'Stock',     'bg-amber-100 text-amber-700',   3),
    (v_salon_id, 'Marketing', 'bg-pink-100 text-pink-700',     4),
    (v_salon_id, 'Divers',    'bg-slate-100 text-slate-700',   5);

  RETURN v_salon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- accept_invitation: Validates token, creates membership
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

  IF v_invitation.role = 'stylist' THEN
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

-- transfer_ownership: Atomic owner swap
CREATE OR REPLACE FUNCTION transfer_ownership(p_salon_id UUID, p_new_owner_id UUID)
RETURNS void AS $$
DECLARE
  v_current_owner_id UUID;
BEGIN
  SELECT profile_id INTO v_current_owner_id FROM salon_memberships
  WHERE salon_id = p_salon_id AND profile_id = auth.uid() AND role = 'owner' AND deleted_at IS NULL;

  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = p_new_owner_id AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Target user is not an active member of this salon';
  END IF;

  UPDATE salon_memberships SET role = 'owner', updated_at = now()
  WHERE salon_id = p_salon_id AND profile_id = p_new_owner_id AND deleted_at IS NULL;

  UPDATE salon_memberships SET role = 'manager', updated_at = now()
  WHERE salon_id = p_salon_id AND profile_id = auth.uid() AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- revoke_membership: Soft-delete membership
CREATE OR REPLACE FUNCTION revoke_membership(p_membership_id UUID)
RETURNS void AS $$
DECLARE
  v_membership RECORD;
BEGIN
  SELECT * INTO v_membership FROM salon_memberships WHERE id = p_membership_id AND deleted_at IS NULL;

  IF v_membership IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_membership.salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager') AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You do not have permission to revoke this membership';
  END IF;

  IF v_membership.role = 'owner' THEN
    IF (SELECT COUNT(*) FROM salon_memberships WHERE salon_id = v_membership.salon_id AND role = 'owner' AND deleted_at IS NULL) <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a salon';
    END IF;
  END IF;

  UPDATE salon_memberships SET deleted_at = now(), updated_at = now() WHERE id = p_membership_id;
  UPDATE staff_members SET active = false, deleted_at = now(), updated_at = now()
  WHERE membership_id = p_membership_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- protect_last_owner trigger
CREATE OR REPLACE FUNCTION protect_last_owner()
RETURNS trigger AS $$
DECLARE
  v_owner_count INTEGER;
BEGIN
  IF OLD.role = 'owner' AND OLD.deleted_at IS NULL THEN
    IF (TG_OP = 'DELETE') OR (NEW.role != 'owner') OR (NEW.deleted_at IS NOT NULL) THEN
      SELECT COUNT(*) INTO v_owner_count FROM salon_memberships
      WHERE salon_id = OLD.salon_id AND role = 'owner' AND deleted_at IS NULL AND id != OLD.id;

      IF v_owner_count < 1 THEN
        RAISE EXCEPTION 'Cannot remove or demote the last owner of a salon. Transfer ownership first.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_last_owner_trigger
  BEFORE UPDATE OR DELETE ON salon_memberships
  FOR EACH ROW EXECUTE FUNCTION protect_last_owner();
