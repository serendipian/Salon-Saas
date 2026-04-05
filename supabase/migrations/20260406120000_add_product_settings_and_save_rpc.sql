-- Add product_settings JSONB column to salons (mirrors service_settings)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS product_settings jsonb DEFAULT NULL;

-- RPC: save_product_categories — atomic upsert + soft-delete + product reassignment
CREATE OR REPLACE FUNCTION save_product_categories(
  p_salon_id uuid,
  p_categories jsonb,
  p_assignments jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat jsonb;
  kept_ids uuid[];
BEGIN
  -- Collect IDs from the incoming array
  SELECT array_agg((c->>'id')::uuid)
    INTO kept_ids
    FROM jsonb_array_elements(p_categories) AS c;

  -- Soft-delete categories not in the incoming list
  UPDATE product_categories
     SET deleted_at = now()
   WHERE salon_id = p_salon_id
     AND deleted_at IS NULL
     AND id != ALL(COALESCE(kept_ids, ARRAY[]::uuid[]));

  -- Upsert each category
  FOR cat IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    INSERT INTO product_categories (id, salon_id, name, color, sort_order)
    VALUES (
      (cat->>'id')::uuid,
      p_salon_id,
      cat->>'name',
      cat->>'color',
      (cat->>'sort_order')::int
    )
    ON CONFLICT (id) DO UPDATE SET
      name       = EXCLUDED.name,
      color      = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order,
      deleted_at = NULL,
      updated_at = now();
  END LOOP;

  -- Apply product assignments if provided
  IF p_assignments IS NOT NULL THEN
    DECLARE
      product_id text;
      category_id text;
    BEGIN
      FOR product_id, category_id IN
        SELECT key, value #>> '{}' FROM jsonb_each(p_assignments)
      LOOP
        UPDATE products
           SET category_id = CASE WHEN category_id = '' OR category_id IS NULL THEN NULL ELSE category_id::uuid END
         WHERE id = product_id::uuid
           AND salon_id = p_salon_id;
      END LOOP;
    END;
  END IF;
END;
$$;
