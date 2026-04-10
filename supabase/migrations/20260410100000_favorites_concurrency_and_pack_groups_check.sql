-- Audit fixes H-3, M-21, M-22.
--
-- H-3: toggle_favorite RPC previously computed MAX(favorite_sort_order) across
--     services/variants/packs then UPDATEd the target row, with no locking
--     between the SELECT and UPDATE. Two concurrent toggles from the same
--     salon could both read the same MAX and write the same v_next, producing
--     duplicate sort orders — exactly the bug the RPC was meant to prevent.
--
-- M-21: reorder_favorites loops through a JSONB array and updates each row
--      individually. Two concurrent reorders interleaving produced a final
--      state matching neither user's intent.
--
-- Fix for both: take a per-salon transaction-scoped advisory lock at the top
-- of each function. PostgreSQL advisory locks are cheap, automatically
-- released at transaction end (including implicit single-statement
-- transactions, which cover RPC calls from PostgREST), and avoid the
-- overhead of SERIALIZABLE isolation. The lock key is derived from the
-- salon_id via hashtext so it's deterministic and does not collide across
-- unrelated lock namespaces (two-argument form uses two int4 keys, so we
-- use a namespace identifier for the "favorites ordering" concept plus
-- the salon hash).
--
-- M-22: pack_groups has no CHECK constraint ensuring starts_at <= ends_at.
--      Client-side validation catches this in the UI but direct API/SQL
--      writes bypass it. Add the CHECK. Uses NOT VALID + VALIDATE so
--      existing rows that might violate don't block the migration (the
--      feature is new, so this is belt-and-braces).

-- =====================================================
-- H-3: toggle_favorite with advisory lock
-- =====================================================

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

  -- Serialize concurrent favorite ordering writes within a salon.
  -- First key = namespace id for "favorites ordering" (arbitrary constant).
  -- Second key = salon hash. Lock auto-releases at transaction end.
  PERFORM pg_advisory_xact_lock(729346, hashtext(p_salon_id::text));

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
  -- favorites from different tables never collide. Safe under the advisory
  -- lock: no other session can compute the same v_next until we commit.
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

-- =====================================================
-- M-21: reorder_favorites with advisory lock
-- =====================================================

CREATE OR REPLACE FUNCTION public.reorder_favorites(
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

  -- Same advisory lock namespace as toggle_favorite, so a reorder can't
  -- interleave with a toggle or with another concurrent reorder.
  PERFORM pg_advisory_xact_lock(729346, hashtext(p_salon_id::text));

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

-- =====================================================
-- M-22: pack_groups date-range CHECK constraint
-- =====================================================

-- Paranoia: if any existing row violates the new constraint (shouldn't
-- happen since the UI enforces it, but the feature only shipped yesterday),
-- swap the dates so the ALTER succeeds. This is safer than erroring out
-- during the migration.
UPDATE pack_groups
SET starts_at = ends_at,
    ends_at = starts_at
WHERE starts_at IS NOT NULL
  AND ends_at IS NOT NULL
  AND starts_at > ends_at;

ALTER TABLE pack_groups
  ADD CONSTRAINT pack_groups_dates_chk
  CHECK (
    starts_at IS NULL
    OR ends_at IS NULL
    OR starts_at <= ends_at
  );

NOTIFY pgrst, 'reload schema';
