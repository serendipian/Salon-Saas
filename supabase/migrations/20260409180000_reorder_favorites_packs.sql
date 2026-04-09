-- Extend reorder_favorites RPC to handle pack favorites.
-- Previously only services and variants were supported, so reordering a pack
-- in the Favorites tab silently did nothing.

DROP FUNCTION IF EXISTS public.reorder_favorites(UUID, JSONB);

CREATE FUNCTION public.reorder_favorites(
  p_salon_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
BEGIN
  IF p_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) THEN
    RAISE EXCEPTION 'Permission denied: owner or manager role required';
  END IF;

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
    ELSIF (v_item->>'type') = 'pack' THEN
      UPDATE packs
      SET favorite_sort_order = (v_item->>'sort_order')::INTEGER,
          updated_at = now()
      WHERE id = (v_item->>'id')::UUID
        AND salon_id = p_salon_id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_favorites(UUID, JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
