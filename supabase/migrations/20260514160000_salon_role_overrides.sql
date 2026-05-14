-- Per-salon overrides for the static role permission matrix in hooks/usePermissions.ts.
-- Sparse table: only rows that diverge from the static defaults are stored.
-- `granted=true` adds an action that the default denies; `granted=false` removes one
-- that the default grants. Owner role is intentionally outside the CHECK so owners
-- can never lock themselves out of their own salon.

CREATE TABLE salon_role_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'stylist', 'receptionist')),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, role, resource, action)
);

CREATE INDEX salon_role_overrides_salon_id_idx ON salon_role_overrides (salon_id);

ALTER TABLE salon_role_overrides ENABLE ROW LEVEL SECURITY;

-- Every salon member can read overrides — needed so usePermissions can apply them.
CREATE POLICY salon_role_overrides_select ON salon_role_overrides FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()));

-- Only owners can mutate overrides.
CREATE POLICY salon_role_overrides_modify ON salon_role_overrides FOR ALL
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner'])));

CREATE TRIGGER salon_role_overrides_updated_at BEFORE UPDATE ON salon_role_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
