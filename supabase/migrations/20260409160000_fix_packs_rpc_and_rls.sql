-- Fix #2: Atomic pack item replacement via RPC (prevents orphaned packs on partial failure)
CREATE OR REPLACE FUNCTION replace_pack_items(
  p_pack_id UUID,
  p_salon_id UUID,
  p_items JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller has access to this salon as owner/manager
  IF p_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Verify the pack belongs to this salon
  IF NOT EXISTS (SELECT 1 FROM packs WHERE id = p_pack_id AND salon_id = p_salon_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Pack not found' USING ERRCODE = 'P0002';
  END IF;

  -- Atomic: delete old items + insert new ones
  DELETE FROM pack_items WHERE pack_id = p_pack_id AND salon_id = p_salon_id;

  INSERT INTO pack_items (pack_id, salon_id, service_id, service_variant_id, sort_order)
  SELECT
    p_pack_id,
    p_salon_id,
    (item->>'service_id')::UUID,
    (item->>'service_variant_id')::UUID,
    (item->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_items) AS item;
END;
$$;

-- Fix #9: Admin select policy should also filter deleted packs
-- Drop and recreate to add deleted_at filter for consistency
DROP POLICY IF EXISTS packs_select_admin ON packs;
-- Owners/managers can see all packs INCLUDING inactive ones, but NOT soft-deleted
CREATE POLICY packs_select_admin ON packs FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) AND deleted_at IS NULL);
