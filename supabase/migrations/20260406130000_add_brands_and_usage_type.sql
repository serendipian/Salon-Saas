-- Create brands table
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  color text NOT NULL DEFAULT 'bg-slate-100 text-slate-800 border-slate-200',
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_brands_salon_id ON brands(salon_id);
CREATE INDEX idx_brands_supplier_id ON brands(supplier_id);

-- Auto-update updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select" ON brands
  FOR SELECT USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);

CREATE POLICY "brands_insert" ON brands
  FOR INSERT WITH CHECK (salon_id IN (SELECT user_salon_ids()));

CREATE POLICY "brands_update" ON brands
  FOR UPDATE USING (salon_id IN (SELECT user_salon_ids()))
  WITH CHECK (salon_id IN (SELECT user_salon_ids()));

CREATE POLICY "brands_delete" ON brands
  FOR DELETE USING (salon_id IN (SELECT user_salon_ids()));

-- Audit trigger (same pattern as other business tables)
CREATE TRIGGER audit_brands
  AFTER INSERT OR UPDATE OR DELETE ON brands
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Add brand_id and usage_type to products
ALTER TABLE products
  ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN usage_type text NOT NULL DEFAULT 'retail'
    CONSTRAINT products_usage_type_check CHECK (usage_type IN ('internal', 'retail', 'both'));

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_usage_type ON products(usage_type);

-- RPC: save_brands — atomic upsert + soft-delete
CREATE OR REPLACE FUNCTION save_brands(
  p_salon_id uuid,
  p_brands jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b jsonb;
  kept_ids uuid[];
BEGIN
  -- Collect IDs from the incoming array
  SELECT array_agg((item->>'id')::uuid)
    INTO kept_ids
    FROM jsonb_array_elements(p_brands) AS item;

  -- Soft-delete brands not in the incoming list
  UPDATE brands
     SET deleted_at = now()
   WHERE salon_id = p_salon_id
     AND deleted_at IS NULL
     AND id != ALL(COALESCE(kept_ids, ARRAY[]::uuid[]));

  -- Upsert each brand
  FOR b IN SELECT * FROM jsonb_array_elements(p_brands)
  LOOP
    INSERT INTO brands (id, salon_id, name, supplier_id, color, sort_order)
    VALUES (
      (b->>'id')::uuid,
      p_salon_id,
      b->>'name',
      CASE WHEN b->>'supplier_id' = '' OR b->>'supplier_id' IS NULL THEN NULL ELSE (b->>'supplier_id')::uuid END,
      COALESCE(b->>'color', 'bg-slate-100 text-slate-800 border-slate-200'),
      (b->>'sort_order')::int
    )
    ON CONFLICT (id) DO UPDATE SET
      name        = EXCLUDED.name,
      supplier_id = EXCLUDED.supplier_id,
      color       = EXCLUDED.color,
      sort_order  = EXCLUDED.sort_order,
      deleted_at  = NULL,
      updated_at  = now();
  END LOOP;
END;
$$;
