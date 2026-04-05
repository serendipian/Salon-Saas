-- ═══════════════════════════════════════════════════════════════
-- Migration: Seed Épilation services
-- 1 category, 1 service, 13 variants
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_epilation_services(p_salon_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cat_epilation UUID;
  v_svc_epilation UUID;
BEGIN
  -- Idempotency guard: skip if 'Duvet' variant under 'Épilation' already exists
  IF EXISTS (
    SELECT 1
    FROM service_variants sv
    JOIN services s ON s.id = sv.service_id
    WHERE s.salon_id = p_salon_id
      AND s.name = 'Épilation'
      AND sv.name = 'Duvet'
      AND s.deleted_at IS NULL
      AND sv.deleted_at IS NULL
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

  -- Insert service
  v_svc_epilation := gen_random_uuid();

  INSERT INTO services (id, salon_id, name, category_id, active) VALUES
    (v_svc_epilation, p_salon_id, 'Épilation', v_cat_epilation, true);

  -- Insert 13 variants (durations estimated; costs not provided → 0.00)
  INSERT INTO service_variants (salon_id, service_id, name, duration_minutes, price, cost, additional_cost, sort_order) VALUES
    (p_salon_id, v_svc_epilation, 'Duvet',               10,  15,  0.00, 0.00,  1),
    (p_salon_id, v_svc_epilation, 'Sourcil',             10,  20,  0.00, 0.00,  2),
    (p_salon_id, v_svc_epilation, 'Menton',              10,  20,  0.00, 0.00,  3),
    (p_salon_id, v_svc_epilation, 'Aisselles',           15,  30,  0.00, 0.00,  4),
    (p_salon_id, v_svc_epilation, 'Visage',              20,  50,  0.00, 0.00,  5),
    (p_salon_id, v_svc_epilation, 'Jambe complète',      45,  70,  0.00, 0.00,  6),
    (p_salon_id, v_svc_epilation, 'Demi jambe',          25,  40,  0.00, 0.00,  7),
    (p_salon_id, v_svc_epilation, 'Bras complet',        30,  50,  0.00, 0.00,  8),
    (p_salon_id, v_svc_epilation, 'Demi bras',           20,  30,  0.00, 0.00,  9),
    (p_salon_id, v_svc_epilation, 'Maillot',             20,  50,  0.00, 0.00, 10),
    (p_salon_id, v_svc_epilation, 'Dos complet',         30,  50,  0.00, 0.00, 11),
    (p_salon_id, v_svc_epilation, 'Ventre',              20,  50,  0.00, 0.00, 12),
    (p_salon_id, v_svc_epilation, 'Épilation complète',  90, 160,  0.00, 0.00, 13);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all existing salons
SELECT add_epilation_services(id) FROM salons;

-- ═══════════════════════════════════════════════════════════════
-- Update seed_salon_demo_data to include Épilation for new salons
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION seed_salon_demo_data(p_salon_id UUID, p_owner_id UUID)
RETURNS VOID AS $$
DECLARE
  -- Service category IDs
  v_cat_coiffure UUID;  -- resolved after add_coiffure_services
  v_cat_soins    UUID := gen_random_uuid();

  -- Service IDs (Soins only — Coiffure/Onglerie/Épilation come from shared functions)
  v_svc_soin UUID := gen_random_uuid();

  -- Coiffure service IDs (resolved after add_coiffure_services)
  v_svc_brushing_id   UUID;
  v_svc_coloration_id UUID;

  -- Staff IDs
  v_staff_marie   UUID := gen_random_uuid();
  v_staff_julie   UUID := gen_random_uuid();
  v_staff_karim   UUID := gen_random_uuid();
  v_staff_sofia   UUID := gen_random_uuid();
  v_staff_leila   UUID := gen_random_uuid();

  -- Client IDs
  v_client_amina  UUID := gen_random_uuid();
  v_client_sarah  UUID := gen_random_uuid();
  v_client_nadia  UUID := gen_random_uuid();
  v_client_yasmin UUID := gen_random_uuid();
  v_client_fatima UUID := gen_random_uuid();

  -- Supplier ID
  v_supplier_id   UUID := gen_random_uuid();

  -- Product category IDs
  v_pcat_capillaire UUID := gen_random_uuid();
  v_pcat_styling    UUID := gen_random_uuid();

  -- Schedule template
  v_staff_schedule JSONB := '{
    "monday":    {"isOpen": true,  "start": "09:00", "end": "18:00"},
    "tuesday":   {"isOpen": true,  "start": "09:00", "end": "18:00"},
    "wednesday": {"isOpen": true,  "start": "09:00", "end": "18:00"},
    "thursday":  {"isOpen": true,  "start": "09:00", "end": "18:00"},
    "friday":    {"isOpen": true,  "start": "09:00", "end": "18:00"},
    "saturday":  {"isOpen": true,  "start": "10:00", "end": "17:00"},
    "sunday":    {"isOpen": false, "start": "09:00", "end": "18:00"}
  }'::jsonb;

  v_today DATE := CURRENT_DATE;

  -- Onglerie service IDs (resolved after add_onglerie_services)
  v_svc_manucure UUID;
BEGIN

  -- ═══════════════════════════════════════════
  -- SERVICE CATEGORIES
  -- (Coiffure created by add_coiffure_services — only Soins here)
  -- ═══════════════════════════════════════════
  INSERT INTO service_categories (id, salon_id, name, color, sort_order) VALUES
    (v_cat_soins, p_salon_id, 'Soins', 'bg-purple-100 text-purple-700', 2);

  -- ═══════════════════════════════════════════
  -- SERVICES + VARIANTS (Soin Visage only)
  -- ═══════════════════════════════════════════
  INSERT INTO services (id, salon_id, name, category_id, description, active, created_by) VALUES
    (v_svc_soin, p_salon_id, 'Soin Visage', v_cat_soins, 'Soin complet du visage : nettoyage, gommage, masque et hydratation.', true, p_owner_id);

  INSERT INTO service_variants (salon_id, service_id, name, duration_minutes, price, cost, sort_order) VALUES
    (p_salon_id, v_svc_soin, 'Soin express (30min)', 30, 40.00, 10.00, 1),
    (p_salon_id, v_svc_soin, 'Soin complet (60min)', 60, 70.00, 18.00, 2);

  -- ═══════════════════════════════════════════
  -- COIFFURE (via shared function)
  -- ═══════════════════════════════════════════
  PERFORM add_coiffure_services(p_salon_id);

  -- Resolve Coiffure category ID (for staff skills) and service IDs (for appointments)
  SELECT id INTO v_cat_coiffure
  FROM service_categories
  WHERE salon_id = p_salon_id AND name = 'Coiffure' AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO v_svc_brushing_id
  FROM services
  WHERE salon_id = p_salon_id AND name = 'Brushing' AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO v_svc_coloration_id
  FROM services
  WHERE salon_id = p_salon_id AND name = 'Coloration' AND deleted_at IS NULL
  LIMIT 1;

  IF v_svc_brushing_id IS NULL OR v_svc_coloration_id IS NULL THEN
    RAISE EXCEPTION 'add_coiffure_services did not create Brushing or Coloration service for salon %', p_salon_id;
  END IF;

  -- ═══════════════════════════════════════════
  -- ONGLERIE (via shared function)
  -- ═══════════════════════════════════════════
  PERFORM add_onglerie_services(p_salon_id);

  -- Resolve manucure service ID for demo appointment
  SELECT id INTO v_svc_manucure
  FROM services
  WHERE salon_id = p_salon_id AND name = 'Manucure' AND deleted_at IS NULL
  LIMIT 1;

  -- ═══════════════════════════════════════════
  -- ÉPILATION (via shared function)
  -- ═══════════════════════════════════════════
  PERFORM add_epilation_services(p_salon_id);

  -- ═══════════════════════════════════════════
  -- STAFF MEMBERS
  -- ═══════════════════════════════════════════
  INSERT INTO staff_members (id, salon_id, first_name, last_name, role, email, phone, color, active, start_date, contract_type, weekly_hours, commission_rate, base_salary, schedule, skills, created_by) VALUES
    (v_staff_marie, p_salon_id, 'Marie',  'Dupont',   'Manager',      'marie.dupont@email.com',   '+33 6 12 34 56 78', '#ec4899', true, v_today - INTERVAL '2 years',  'CDI', 39, 10, encrypt_pii('2800'), v_staff_schedule, ARRAY[v_cat_coiffure, v_cat_soins], p_owner_id),
    (v_staff_julie, p_salon_id, 'Julie',  'Dubois',   'Stylist',      'julie.dubois@email.com',   '+33 6 23 45 67 89', '#8b5cf6', true, v_today - INTERVAL '1 year',   'CDI', 35, 15, encrypt_pii('2200'), v_staff_schedule, ARRAY[v_cat_coiffure],              p_owner_id),
    (v_staff_karim, p_salon_id, 'Karim',  'Benali',   'Stylist',      'karim.benali@email.com',   '+33 6 34 56 78 90', '#3b82f6', true, v_today - INTERVAL '6 months', 'CDI', 35, 15, encrypt_pii('2200'), v_staff_schedule, ARRAY[v_cat_coiffure, v_cat_soins], p_owner_id),
    (v_staff_sofia, p_salon_id, 'Sofia',  'Martinez', 'Stylist',      'sofia.martinez@email.com', '+33 6 45 67 89 01', '#f59e0b', true, v_today - INTERVAL '3 months', 'CDD', 35, 12, encrypt_pii('2000'), v_staff_schedule, NULL,                                p_owner_id),
    (v_staff_leila, p_salon_id, 'Leila',  'Amrani',   'Receptionist', 'leila.amrani@email.com',   '+33 6 56 78 90 12', '#10b981', true, v_today - INTERVAL '4 months', 'CDI', 35,  0, encrypt_pii('1900'), v_staff_schedule, NULL,                                p_owner_id);

  -- ═══════════════════════════════════════════
  -- CLIENTS
  -- ═══════════════════════════════════════════
  INSERT INTO clients (id, salon_id, first_name, last_name, gender, email, phone, status, city, acquisition_source, created_by) VALUES
    (v_client_amina,  p_salon_id, 'Amina',   'El Mansouri', 'Femme', 'amina.elmansouri@email.com', '+33 6 11 22 33 44', 'VIP',   'Casablanca', 'Bouche à oreille', p_owner_id),
    (v_client_sarah,  p_salon_id, 'Sarah',   'Benjelloun',  'Femme', 'sarah.benj@email.com',       '+33 6 22 33 44 55', 'ACTIF', 'Rabat',      'Instagram',        p_owner_id),
    (v_client_nadia,  p_salon_id, 'Nadia',   'Tazi',        'Femme', 'nadia.tazi@email.com',       '+33 6 33 44 55 66', 'ACTIF', 'Marrakech',  'Google',           p_owner_id),
    (v_client_yasmin, p_salon_id, 'Yasmine', 'Chraibi',     'Femme', 'yasmine.c@email.com',        '+33 6 44 55 66 77', 'ACTIF', 'Casablanca', 'Bouche à oreille', p_owner_id),
    (v_client_fatima, p_salon_id, 'Fatima',  'Ouazzani',    'Femme', 'fatima.ouaz@email.com',      '+33 6 55 66 77 88', 'ACTIF', 'Fès',        'Passage',          p_owner_id);

  -- ═══════════════════════════════════════════
  -- APPOINTMENTS
  -- ═══════════════════════════════════════════
  INSERT INTO appointments (salon_id, client_id, service_id, staff_id, date, duration_minutes, status, price, created_by) VALUES
    (p_salon_id, v_client_amina,  v_svc_brushing_id,   v_staff_marie, (v_today + INTERVAL '1 day'  + INTERVAL '10 hours')::timestamptz, 20,  'SCHEDULED', 30.00,  p_owner_id),
    (p_salon_id, v_client_sarah,  v_svc_coloration_id, v_staff_julie, (v_today + INTERVAL '1 day'  + INTERVAL '14 hours')::timestamptz, 50,  'SCHEDULED', 200.00, p_owner_id),
    (p_salon_id, v_client_nadia,  v_svc_soin,          v_staff_karim, (v_today + INTERVAL '2 days' + INTERVAL '11 hours')::timestamptz, 60,  'SCHEDULED', 70.00,  p_owner_id),
    (p_salon_id, v_client_yasmin, v_svc_manucure,      v_staff_sofia, (v_today + INTERVAL '3 days' + INTERVAL '15 hours')::timestamptz, 45,  'SCHEDULED', 80.00,  p_owner_id),
    (p_salon_id, v_client_fatima, v_svc_brushing_id,   v_staff_marie, (v_today + INTERVAL '4 days' + INTERVAL '9 hours')::timestamptz,  35,  'SCHEDULED', 50.00,  p_owner_id);

  -- ═══════════════════════════════════════════
  -- SUPPLIER
  -- ═══════════════════════════════════════════
  INSERT INTO suppliers (id, salon_id, name, contact_name, email, phone, category, active, created_by) VALUES
    (v_supplier_id, p_salon_id, 'L''Oréal Professionnel', 'Marc Lefèvre', 'pro@loreal.com', '+33 1 47 56 70 00', 'Capillaire', true, p_owner_id);

  -- ═══════════════════════════════════════════
  -- PRODUCT CATEGORIES
  -- ═══════════════════════════════════════════
  INSERT INTO product_categories (id, salon_id, name, color, sort_order) VALUES
    (v_pcat_capillaire, p_salon_id, 'Soins Capillaires', 'bg-amber-100 text-amber-700', 1),
    (v_pcat_styling,    p_salon_id, 'Coiffants',         'bg-blue-100 text-blue-700',   2);

  -- ═══════════════════════════════════════════
  -- PRODUCTS
  -- ═══════════════════════════════════════════
  INSERT INTO products (salon_id, name, description, category_id, price, cost, stock, supplier_id, sku, active, created_by) VALUES
    (p_salon_id, 'Shampooing Réparateur',   'Shampooing professionnel pour cheveux abîmés et secs.',          v_pcat_capillaire, 18.90, 8.50,  24, v_supplier_id, 'SHP-REP-001', true, p_owner_id),
    (p_salon_id, 'Masque Hydratant',         'Masque nourrissant intense à l''huile d''argan.',                v_pcat_capillaire, 24.90, 11.00, 18, v_supplier_id, 'MSK-HYD-001', true, p_owner_id),
    (p_salon_id, 'Huile de Soin',            'Huile légère multi-usages pour brillance et protection.',        v_pcat_capillaire, 29.90, 13.50, 15, v_supplier_id, 'OIL-SIN-001', true, p_owner_id),
    (p_salon_id, 'Laque Fixation Forte',     'Laque professionnelle tenue longue durée sans résidu.',          v_pcat_styling,    15.90, 6.00,  30, v_supplier_id, 'LAQ-FRT-001', true, p_owner_id),
    (p_salon_id, 'Sérum Lissant',            'Sérum thermo-protecteur pour un lissage parfait.',               v_pcat_styling,    22.50, 9.50,  20, v_supplier_id, 'SER-LIS-001', true, p_owner_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
