-- ═══════════════════════════════════════════════════════════════
-- Migration: Restructure Épilation — 1 service per zone (13 services)
-- Soft-deletes the previous single 'Épilation' service with 13 variants
-- and replaces it with 13 individual services so multiple zones can be
-- combined in a single POS transaction.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_epilation_services(p_salon_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cat_epilation UUID;
BEGIN
  -- Idempotency guard: skip if 'Duvet' service already exists under Épilation
  IF EXISTS (
    SELECT 1
    FROM services s
    JOIN service_categories sc ON sc.id = s.category_id
    WHERE sc.salon_id = p_salon_id
      AND sc.name = 'Épilation'
      AND s.name = 'Duvet'
      AND s.deleted_at IS NULL
      AND sc.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- Find or create the Épilation category
  SELECT id INTO v_cat_epilation
  FROM service_categories
  WHERE salon_id = p_salon_id AND name = 'Épilation' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cat_epilation IS NULL THEN
    v_cat_epilation := gen_random_uuid();
    INSERT INTO service_categories (id, salon_id, name, color, sort_order) VALUES
      (v_cat_epilation, p_salon_id, 'Épilation', 'bg-green-100 text-green-700', 4);
  END IF;

  -- Soft-delete the old single 'Épilation' service (the one with 13 variants)
  UPDATE services
  SET deleted_at = now()
  WHERE salon_id = p_salon_id
    AND name = 'Épilation'
    AND category_id = v_cat_epilation
    AND deleted_at IS NULL;

  -- Insert 13 individual services, each with one variant
  WITH new_services (svc_name, duration_minutes, price, sort_order) AS (
    VALUES
      ('Duvet',              10,  15, 1),
      ('Sourcil',            10,  20, 2),
      ('Menton',             10,  20, 3),
      ('Aisselles',          15,  30, 4),
      ('Visage',             20,  50, 5),
      ('Jambe complète',     45,  70, 6),
      ('Demi jambe',         25,  40, 7),
      ('Bras complet',       30,  50, 8),
      ('Demi bras',          20,  30, 9),
      ('Maillot',            20,  50, 10),
      ('Dos complet',        30,  50, 11),
      ('Ventre',             20,  50, 12),
      ('Épilation complète', 90, 160, 13)
  ),
  inserted_services AS (
    INSERT INTO services (id, salon_id, name, category_id, active)
    SELECT gen_random_uuid(), p_salon_id, svc_name, v_cat_epilation, true
    FROM new_services
    RETURNING id, name
  )
  INSERT INTO service_variants (salon_id, service_id, name, duration_minutes, price, cost, additional_cost, sort_order)
  SELECT
    p_salon_id,
    inserted_services.id,
    new_services.svc_name,
    new_services.duration_minutes,
    new_services.price,
    0.00,
    0.00,
    1
  FROM inserted_services
  JOIN new_services ON new_services.svc_name = inserted_services.name;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all existing salons
SELECT add_epilation_services(id) FROM salons;
