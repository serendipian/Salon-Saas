-- 1. Make invitations.email nullable and drop unique constraint
ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_salon_id_email_key;

-- 2. Add slug column to staff_members
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS slug TEXT;

-- 3. Slug generation function
CREATE OR REPLACE FUNCTION generate_staff_slug(p_salon_id UUID, p_first_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_base TEXT;
  v_slug TEXT;
  v_counter INT := 1;
BEGIN
  -- Lowercase, strip accents, replace non-alphanumeric with hyphens
  v_base := lower(regexp_replace(
    translate(
      p_first_name,
      'àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ',
      'aaaeeeeiioouuycaaaeeeeiioouuyc'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'staff'; END IF;

  v_slug := v_base;
  WHILE EXISTS (
    SELECT 1 FROM staff_members
    WHERE salon_id = p_salon_id AND slug = v_slug AND deleted_at IS NULL
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base || '-' || v_counter;
  END LOOP;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger: auto-generate slug on INSERT only (slug stays fixed on rename)
CREATE OR REPLACE FUNCTION staff_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_staff_slug(NEW.salon_id, NEW.first_name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_slug ON staff_members;
CREATE TRIGGER trg_staff_slug
  BEFORE INSERT ON staff_members
  FOR EACH ROW EXECUTE FUNCTION staff_slug_trigger();

-- 5. Backfill existing rows
UPDATE staff_members
SET slug = generate_staff_slug(salon_id, first_name, id)
WHERE slug IS NULL;

-- 6. Unique index on slug per salon (active members only)
CREATE UNIQUE INDEX IF NOT EXISTS staff_members_salon_slug_key
  ON staff_members (salon_id, slug) WHERE deleted_at IS NULL;

-- 7. RPC to get invitation info (callable by anon key, gated by token)
CREATE OR REPLACE FUNCTION get_invitation_info(p_token TEXT)
RETURNS TABLE (
  staff_first_name TEXT,
  staff_last_name TEXT,
  staff_email TEXT,
  salon_name TEXT,
  role TEXT,
  is_valid BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT
    i.*,
    s.name AS sn,
    sm.first_name AS sfn,
    sm.last_name AS sln,
    sm.email AS sem
  INTO v_inv
  FROM invitations i
  JOIN salons s ON s.id = i.salon_id
  LEFT JOIN staff_members sm ON sm.id = i.staff_member_id
  WHERE i.token = p_token;

  IF v_inv IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_inv.sfn,
    v_inv.sln,
    v_inv.sem,
    v_inv.sn,
    v_inv.role,
    (v_inv.accepted_at IS NULL AND v_inv.expires_at > now());
END;
$$;

-- Grant anon access to get_invitation_info
GRANT EXECUTE ON FUNCTION get_invitation_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_invitation_info(TEXT) TO authenticated;
