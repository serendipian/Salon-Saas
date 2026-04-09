-- Create packs table
CREATE TABLE packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    favorite_sort_order INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Create pack_items table
CREATE TABLE pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    service_variant_id UUID NOT NULL REFERENCES service_variants(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_packs_salon_id ON packs(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pack_items_pack_id ON pack_items(pack_id);
CREATE INDEX idx_pack_items_service_variant_id ON pack_items(service_variant_id);

-- updated_at triggers
CREATE TRIGGER packs_updated_at
  BEFORE UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pack_items_updated_at
  BEFORE UPDATE ON pack_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_items ENABLE ROW LEVEL SECURITY;

-- packs policies
CREATE POLICY packs_select ON packs FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);

CREATE POLICY packs_select_admin ON packs FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY packs_insert ON packs FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY packs_update ON packs FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY packs_delete ON packs FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- pack_items policies
CREATE POLICY pack_items_select ON pack_items FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()));

CREATE POLICY pack_items_insert ON pack_items FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY pack_items_update ON pack_items FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY pack_items_delete ON pack_items FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Audit logging for packs (same pattern as other business tables)
CREATE TRIGGER packs_audit
  AFTER INSERT OR UPDATE OR DELETE ON packs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
