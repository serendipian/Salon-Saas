-- RPC: soft_delete_service
-- Soft-deletes a service and all its variants atomically.
-- Follows the same SECURITY DEFINER pattern as soft_delete_appointment.

CREATE OR REPLACE FUNCTION soft_delete_service(p_service_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Get the service's salon
  SELECT salon_id INTO v_salon_id
  FROM services
  WHERE id = p_service_id AND deleted_at IS NULL;

  IF v_salon_id IS NULL THEN
    RAISE EXCEPTION 'Service not found or already deleted';
  END IF;

  -- Must be owner or manager in this salon
  IF v_salon_id NOT IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Soft-delete the service
  UPDATE services
  SET deleted_at = now(), active = false, updated_at = now()
  WHERE id = p_service_id AND deleted_at IS NULL;

  -- Soft-delete its variants
  UPDATE service_variants
  SET deleted_at = now(), updated_at = now()
  WHERE service_id = p_service_id AND deleted_at IS NULL;
END;
$$;

-- RPC: save_service_categories
-- Atomic upsert of service categories + service assignments.
-- Handles inserts, updates, soft-deletes, and re-assignments in one call.

CREATE OR REPLACE FUNCTION save_service_categories(
  p_salon_id UUID,
  p_categories JSONB,    -- array of {id, name, color, icon, sort_order}
  p_assignments JSONB DEFAULT NULL  -- object {service_id: category_id_or_null}
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cat JSONB;
  v_cat_id UUID;
  v_service_id TEXT;
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
  FROM service_categories
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
    UPDATE service_categories
    SET deleted_at = now(), updated_at = now()
    WHERE id = ANY(v_to_delete) AND salon_id = p_salon_id;

    -- Unassign services from deleted categories
    UPDATE services
    SET category_id = NULL, updated_at = now()
    WHERE category_id = ANY(v_to_delete) AND salon_id = p_salon_id;
  END IF;

  -- Upsert categories
  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    v_cat_id := (v_cat->>'id')::uuid;

    IF v_cat_id = ANY(v_existing_ids) THEN
      UPDATE service_categories
      SET name = v_cat->>'name',
          color = v_cat->>'color',
          icon = v_cat->>'icon',
          sort_order = (v_cat->>'sort_order')::int,
          updated_at = now()
      WHERE id = v_cat_id AND salon_id = p_salon_id;
    ELSE
      INSERT INTO service_categories (id, salon_id, name, color, icon, sort_order)
      VALUES (v_cat_id, p_salon_id, v_cat->>'name', v_cat->>'color', v_cat->>'icon', (v_cat->>'sort_order')::int);
    END IF;
  END LOOP;

  -- Apply service assignments
  IF p_assignments IS NOT NULL THEN
    FOR v_service_id, v_category_id IN
      SELECT key, NULLIF(value::text, 'null')::uuid
      FROM jsonb_each_text(p_assignments)
    LOOP
      UPDATE services
      SET category_id = v_category_id, updated_at = now()
      WHERE id = v_service_id::uuid AND salon_id = p_salon_id;
    END LOOP;
  END IF;
END;
$$;
