-- ============================================================
-- supplier_categories table
-- ============================================================
CREATE TABLE supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-800 border-slate-200',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at trigger
CREATE TRIGGER supplier_categories_updated_at
  BEFORE UPDATE ON supplier_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index
CREATE INDEX idx_supplier_categories_salon ON supplier_categories(salon_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_categories_select ON supplier_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY supplier_categories_insert ON supplier_categories FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY supplier_categories_update ON supplier_categories FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY supplier_categories_delete ON supplier_categories FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Audit trigger (re-use existing audit function)
CREATE TRIGGER audit_supplier_categories
  AFTER INSERT OR UPDATE OR DELETE ON supplier_categories
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================
-- Add category_id FK to suppliers + backfill from string field
-- ============================================================
ALTER TABLE suppliers ADD COLUMN category_id UUID REFERENCES supplier_categories(id) ON DELETE SET NULL;

-- Backfill: create one supplier_categories row per distinct (salon_id, category) string,
-- then set category_id on existing suppliers.
DO $$
DECLARE
  r RECORD;
  v_cat_id UUID;
  v_sort INTEGER := 0;
  v_prev_salon UUID := NULL;
  v_colors TEXT[] := ARRAY[
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-slate-100 text-slate-800 border-slate-200'
  ];
BEGIN
  FOR r IN
    SELECT DISTINCT salon_id, category
    FROM suppliers
    WHERE category IS NOT NULL AND category != '' AND deleted_at IS NULL
    ORDER BY salon_id, category
  LOOP
    IF v_prev_salon IS DISTINCT FROM r.salon_id THEN
      v_sort := 0;
      v_prev_salon := r.salon_id;
    END IF;

    v_cat_id := gen_random_uuid();

    INSERT INTO supplier_categories (id, salon_id, name, color, sort_order)
    VALUES (v_cat_id, r.salon_id, r.category, v_colors[1 + (v_sort % array_length(v_colors, 1))], v_sort);

    UPDATE suppliers
    SET category_id = v_cat_id
    WHERE salon_id = r.salon_id AND category = r.category AND deleted_at IS NULL;

    v_sort := v_sort + 1;
  END LOOP;
END;
$$;

-- Drop old string column
ALTER TABLE suppliers DROP COLUMN category;

-- ============================================================
-- supplier_settings JSONB on salons
-- ============================================================
ALTER TABLE salons ADD COLUMN IF NOT EXISTS supplier_settings JSONB DEFAULT '{}';

-- ============================================================
-- RPC: save_supplier_categories
-- ============================================================
CREATE OR REPLACE FUNCTION save_supplier_categories(
  p_salon_id UUID,
  p_categories JSONB,
  p_assignments JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cat JSONB;
  v_cat_id UUID;
  v_supplier_id TEXT;
  v_category_id UUID;
  v_existing_ids UUID[];
  v_new_ids UUID[];
  v_to_delete UUID[];
BEGIN
  -- Must be owner or manager
  IF p_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get existing category IDs
  SELECT array_agg(id) INTO v_existing_ids
  FROM supplier_categories
  WHERE salon_id = p_salon_id AND deleted_at IS NULL;

  v_existing_ids := COALESCE(v_existing_ids, ARRAY[]::UUID[]);

  -- Collect new category IDs
  SELECT array_agg((cat->>'id')::uuid)
  INTO v_new_ids
  FROM jsonb_array_elements(p_categories) AS cat;

  v_new_ids := COALESCE(v_new_ids, ARRAY[]::UUID[]);

  -- Soft-delete removed categories
  v_to_delete := ARRAY(
    SELECT unnest(v_existing_ids)
    EXCEPT
    SELECT unnest(v_new_ids)
  );

  IF array_length(v_to_delete, 1) > 0 THEN
    UPDATE supplier_categories
    SET deleted_at = now(), updated_at = now()
    WHERE id = ANY(v_to_delete) AND salon_id = p_salon_id;

    -- Unassign suppliers from deleted categories
    UPDATE suppliers
    SET category_id = NULL, updated_at = now()
    WHERE category_id = ANY(v_to_delete) AND salon_id = p_salon_id;
  END IF;

  -- Upsert categories
  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    v_cat_id := (v_cat->>'id')::uuid;

    IF v_cat_id = ANY(v_existing_ids) THEN
      UPDATE supplier_categories
      SET name = v_cat->>'name',
          color = v_cat->>'color',
          sort_order = (v_cat->>'sort_order')::int,
          updated_at = now()
      WHERE id = v_cat_id AND salon_id = p_salon_id;
    ELSE
      INSERT INTO supplier_categories (id, salon_id, name, color, sort_order)
      VALUES (v_cat_id, p_salon_id, v_cat->>'name', v_cat->>'color', (v_cat->>'sort_order')::int);
    END IF;
  END LOOP;

  -- Apply supplier assignments
  IF p_assignments IS NOT NULL THEN
    FOR v_supplier_id, v_category_id IN
      SELECT key, NULLIF(value::text, 'null')::uuid
      FROM jsonb_each_text(p_assignments)
    LOOP
      UPDATE suppliers
      SET category_id = v_category_id, updated_at = now()
      WHERE id = v_supplier_id::uuid AND salon_id = p_salon_id;
    END LOOP;
  END IF;
END;
$$;
