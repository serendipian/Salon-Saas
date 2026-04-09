-- Consolidated toggle_favorite RPC.
--
-- Previously each hook computed the "next favorite sort order" within its
-- own scope: useServices scanned services+variants client-side, usePacks
-- queried only the packs table. Favoriting the first pack and the first
-- service both produced sort_order=1, causing collisions that were only
-- resolved after a manual drag-and-save in the Favorites tab.
--
-- This RPC computes MAX(favorite_sort_order) atomically across services,
-- service_variants, AND packs, then flips the target row in a single
-- SECURITY DEFINER transaction. Permission check matches reorder_favorites.

CREATE OR REPLACE FUNCTION public.toggle_favorite(
  p_salon_id UUID,
  p_type TEXT,
  p_id UUID,
  p_is_favorite BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  IF p_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) THEN
    RAISE EXCEPTION 'Permission denied: owner or manager role required';
  END IF;

  IF NOT p_is_favorite THEN
    -- Remove from favorites. services/service_variants.favorite_sort_order is
    -- NOT NULL DEFAULT 0; packs.favorite_sort_order is nullable.
    IF p_type = 'service' THEN
      UPDATE services
      SET is_favorite = false, favorite_sort_order = 0, updated_at = now()
      WHERE id = p_id AND salon_id = p_salon_id;
    ELSIF p_type = 'variant' THEN
      UPDATE service_variants
      SET is_favorite = false, favorite_sort_order = 0, updated_at = now()
      WHERE id = p_id AND salon_id = p_salon_id;
    ELSIF p_type = 'pack' THEN
      UPDATE packs
      SET is_favorite = false, favorite_sort_order = NULL, updated_at = now()
      WHERE id = p_id AND salon_id = p_salon_id;
    ELSE
      RAISE EXCEPTION 'Invalid favorite type: %', p_type;
    END IF;
    RETURN;
  END IF;

  -- Compute the next sort order across ALL three favorite tables so new
  -- favorites from different tables never collide.
  SELECT COALESCE(MAX(mx), 0) + 1 INTO v_next
  FROM (
    SELECT MAX(favorite_sort_order) AS mx
    FROM services
    WHERE salon_id = p_salon_id AND is_favorite = true
    UNION ALL
    SELECT MAX(favorite_sort_order) AS mx
    FROM service_variants
    WHERE salon_id = p_salon_id AND is_favorite = true
    UNION ALL
    SELECT MAX(favorite_sort_order) AS mx
    FROM packs
    WHERE salon_id = p_salon_id AND is_favorite = true
  ) agg;

  IF p_type = 'service' THEN
    UPDATE services
    SET is_favorite = true, favorite_sort_order = v_next, updated_at = now()
    WHERE id = p_id AND salon_id = p_salon_id;
  ELSIF p_type = 'variant' THEN
    UPDATE service_variants
    SET is_favorite = true, favorite_sort_order = v_next, updated_at = now()
    WHERE id = p_id AND salon_id = p_salon_id;
  ELSIF p_type = 'pack' THEN
    UPDATE packs
    SET is_favorite = true, favorite_sort_order = v_next, updated_at = now()
    WHERE id = p_id AND salon_id = p_salon_id;
  ELSE
    RAISE EXCEPTION 'Invalid favorite type: %', p_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_favorite(UUID, TEXT, UUID, BOOLEAN) TO authenticated;
NOTIFY pgrst, 'reload schema';
