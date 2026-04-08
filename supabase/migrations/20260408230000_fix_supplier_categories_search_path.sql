-- Fix: add SET search_path = public to save_supplier_categories
-- All SECURITY DEFINER functions must pin search_path to prevent path injection.
CREATE OR REPLACE FUNCTION save_supplier_categories(
  p_salon_id UUID,
  p_categories JSONB,
  p_assignments JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
