-- Pack groups: themed/seasonal collections of packs (e.g. "Halloween 2026", "Été")
-- A pack belongs to 0 or 1 group. Group has its own active flag that cascades
-- visibility without flipping the individual pack.active state.

CREATE TABLE pack_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK: pack belongs to at most one group; deleting a group ungroups its packs.
ALTER TABLE packs
    ADD COLUMN pack_group_id UUID REFERENCES pack_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_pack_groups_salon_id ON pack_groups(salon_id);
CREATE INDEX idx_packs_pack_group_id ON packs(pack_group_id);

-- updated_at trigger
CREATE TRIGGER pack_groups_updated_at
  BEFORE UPDATE ON pack_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE pack_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY pack_groups_select ON pack_groups FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()));

CREATE POLICY pack_groups_insert ON pack_groups FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY pack_groups_update ON pack_groups FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY pack_groups_delete ON pack_groups FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Audit logging
CREATE TRIGGER pack_groups_audit
  AFTER INSERT OR UPDATE OR DELETE ON pack_groups
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
