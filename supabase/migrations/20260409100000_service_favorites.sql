-- Add favorite columns to services
ALTER TABLE services
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN favorite_sort_order INTEGER NOT NULL DEFAULT 0;

-- Add favorite columns to service_variants
ALTER TABLE service_variants
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN favorite_sort_order INTEGER NOT NULL DEFAULT 0;

-- RPC: Atomically reorder favorites across both tables
CREATE OR REPLACE FUNCTION reorder_favorites(
  p_salon_id UUID,
  p_items JSONB  -- array of { "type": "service"|"variant", "id": UUID, "sort_order": int }
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- Permission check: caller must be owner or manager of this salon
  IF p_salon_id NOT IN (SELECT unnest(user_salon_ids_with_role(ARRAY['owner', 'manager']))) THEN
    RAISE EXCEPTION 'Permission denied: owner or manager role required';
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'type') = 'service' THEN
      UPDATE services
      SET favorite_sort_order = (v_item->>'sort_order')::INTEGER,
          updated_at = now()
      WHERE id = (v_item->>'id')::UUID
        AND salon_id = p_salon_id;
    ELSIF (v_item->>'type') = 'variant' THEN
      UPDATE service_variants
      SET favorite_sort_order = (v_item->>'sort_order')::INTEGER,
          updated_at = now()
      WHERE id = (v_item->>'id')::UUID
        AND salon_id = p_salon_id;
    END IF;
  END LOOP;
END;
$$;
