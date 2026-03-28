-- Seed demo data when a new salon is created
-- Called automatically by create_salon()

CREATE OR REPLACE FUNCTION seed_salon_demo_data(p_salon_id UUID, p_owner_id UUID)
RETURNS VOID AS $$
DECLARE
  -- Service category IDs
  v_cat_coiffure UUID := gen_random_uuid();
  v_cat_soins    UUID := gen_random_uuid();
  v_cat_ongles   UUID := gen_random_uuid();

  -- Service IDs
  v_svc_coupe     UUID := gen_random_uuid();
  v_svc_balayage  UUID := gen_random_uuid();
  v_svc_brushing  UUID := gen_random_uuid();
  v_svc_soin      UUID := gen_random_uuid();
  v_svc_manucure  UUID := gen_random_uuid();

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
BEGIN

  -- ═══════════════════════════════════════════
  -- SERVICE CATEGORIES
  -- ═══════════════════════════════════════════
  INSERT INTO service_categories (id, salon_id, name, color, sort_order) VALUES
    (v_cat_coiffure, p_salon_id, 'Coiffure',      'bg-pink-100 text-pink-700',   1),
    (v_cat_soins,    p_salon_id, 'Soins',          'bg-purple-100 text-purple-700', 2),
    (v_cat_ongles,   p_salon_id, 'Ongles',         'bg-rose-100 text-rose-700',   3);

  -- ═══════════════════════════════════════════
  -- SERVICES + VARIANTS
  -- ═══════════════════════════════════════════
  INSERT INTO services (id, salon_id, name, category_id, description, active, created_by) VALUES
    (v_svc_coupe,    p_salon_id, 'Coupe Femme',    v_cat_coiffure, 'Coupe personnalisée avec consultation style et finition brushing.',          true, p_owner_id),
    (v_svc_balayage, p_salon_id, 'Balayage',       v_cat_coiffure, 'Technique de coloration naturelle pour un effet soleil subtil et lumineux.', true, p_owner_id),
    (v_svc_brushing, p_salon_id, 'Brushing',       v_cat_coiffure, 'Mise en forme professionnelle pour un résultat lisse, bouclé ou wavy.',     true, p_owner_id),
    (v_svc_soin,     p_salon_id, 'Soin Visage',    v_cat_soins,    'Soin complet du visage : nettoyage, gommage, masque et hydratation.',       true, p_owner_id),
    (v_svc_manucure, p_salon_id, 'Manucure',       v_cat_ongles,   'Soin des mains et des ongles avec pose de vernis classique ou semi-permanent.', true, p_owner_id);

  -- Service variants (each service gets 2 variants)
  INSERT INTO service_variants (salon_id, service_id, name, duration_minutes, price, cost, sort_order) VALUES
    -- Coupe Femme
    (p_salon_id, v_svc_coupe,    'Cheveux courts',       45,  35.00, 5.00, 1),
    (p_salon_id, v_svc_coupe,    'Cheveux longs',        60,  50.00, 7.00, 2),
    -- Balayage
    (p_salon_id, v_svc_balayage, 'Balayage partiel',     90,  75.00, 15.00, 1),
    (p_salon_id, v_svc_balayage, 'Balayage complet',    120, 120.00, 25.00, 2),
    -- Brushing
    (p_salon_id, v_svc_brushing, 'Brushing simple',      30,  25.00, 3.00, 1),
    (p_salon_id, v_svc_brushing, 'Brushing + boucles',   45,  35.00, 5.00, 2),
    -- Soin Visage
    (p_salon_id, v_svc_soin,     'Soin express (30min)',  30,  40.00, 10.00, 1),
    (p_salon_id, v_svc_soin,     'Soin complet (60min)',  60,  70.00, 18.00, 2),
    -- Manucure
    (p_salon_id, v_svc_manucure, 'Vernis classique',     30,  25.00, 4.00, 1),
    (p_salon_id, v_svc_manucure, 'Semi-permanent',       45,  40.00, 8.00, 2);

  -- ═══════════════════════════════════════════
  -- STAFF MEMBERS
  -- ═══════════════════════════════════════════
  -- base_salary, iban, social_security_number are encrypted (bytea) — use encrypt_pii()
  INSERT INTO staff_members (id, salon_id, first_name, last_name, role, email, phone, color, active, start_date, contract_type, weekly_hours, commission_rate, base_salary, schedule, skills, created_by) VALUES
    (v_staff_marie, p_salon_id, 'Marie',   'Dupont',   'Manager',      'marie.dupont@email.com',   '+33 6 12 34 56 78', '#ec4899', true, v_today - INTERVAL '2 years',  'CDI', 39, 10, encrypt_pii('2800'), v_staff_schedule, ARRAY[v_cat_coiffure, v_cat_soins], p_owner_id),
    (v_staff_julie, p_salon_id, 'Julie',   'Dubois',   'Stylist',      'julie.dubois@email.com',   '+33 6 23 45 67 89', '#8b5cf6', true, v_today - INTERVAL '1 year',   'CDI', 35, 15, encrypt_pii('2200'), v_staff_schedule, ARRAY[v_cat_coiffure],              p_owner_id),
    (v_staff_karim, p_salon_id, 'Karim',   'Benali',   'Stylist',      'karim.benali@email.com',   '+33 6 34 56 78 90', '#3b82f6', true, v_today - INTERVAL '6 months', 'CDI', 35, 15, encrypt_pii('2200'), v_staff_schedule, ARRAY[v_cat_coiffure, v_cat_soins], p_owner_id),
    (v_staff_sofia, p_salon_id, 'Sofia',   'Martinez', 'Stylist',      'sofia.martinez@email.com', '+33 6 45 67 89 01', '#f59e0b', true, v_today - INTERVAL '3 months', 'CDD', 35, 12, encrypt_pii('2000'), v_staff_schedule, ARRAY[v_cat_ongles],                p_owner_id),
    (v_staff_leila, p_salon_id, 'Leila',   'Amrani',  'Receptionist', 'leila.amrani@email.com',   '+33 6 56 78 90 12', '#10b981', true, v_today - INTERVAL '4 months', 'CDI', 35,  0, encrypt_pii('1900'), v_staff_schedule, NULL,                                p_owner_id);

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
  -- APPOINTMENTS (spread across this week)
  -- ═══════════════════════════════════════════
  INSERT INTO appointments (salon_id, client_id, service_id, staff_id, date, duration_minutes, status, price, created_by) VALUES
    (p_salon_id, v_client_amina,  v_svc_coupe,    v_staff_marie, (v_today + INTERVAL '1 day'  + INTERVAL '10 hours')::timestamptz, 60,  'SCHEDULED', 50.00,  p_owner_id),
    (p_salon_id, v_client_sarah,  v_svc_balayage, v_staff_julie, (v_today + INTERVAL '1 day'  + INTERVAL '14 hours')::timestamptz, 120, 'SCHEDULED', 120.00, p_owner_id),
    (p_salon_id, v_client_nadia,  v_svc_soin,     v_staff_karim, (v_today + INTERVAL '2 days' + INTERVAL '11 hours')::timestamptz, 60,  'SCHEDULED', 70.00,  p_owner_id),
    (p_salon_id, v_client_yasmin, v_svc_manucure, v_staff_sofia, (v_today + INTERVAL '3 days' + INTERVAL '15 hours')::timestamptz, 45,  'SCHEDULED', 40.00,  p_owner_id),
    (p_salon_id, v_client_fatima, v_svc_brushing, v_staff_marie, (v_today + INTERVAL '4 days' + INTERVAL '9 hours')::timestamptz,  30,  'SCHEDULED', 25.00,  p_owner_id);

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


-- ═══════════════════════════════════════════
-- UPDATE create_salon TO CALL seed_salon_demo_data
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_salon(
  p_name TEXT,
  p_timezone TEXT DEFAULT 'Europe/Paris',
  p_currency TEXT DEFAULT 'EUR',
  p_owner_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_salon_id UUID;
  v_free_plan_id UUID;
BEGIN
  SELECT id INTO v_free_plan_id FROM plans WHERE name = 'Free' AND active = true LIMIT 1;

  INSERT INTO salons (name, timezone, currency, plan_id, subscription_tier, trial_ends_at, schedule)
  VALUES (
    p_name, p_timezone, p_currency, v_free_plan_id, 'trial',
    now() + interval '14 days',
    '{"monday":{"isOpen":true,"start":"09:00","end":"19:00"},"tuesday":{"isOpen":true,"start":"09:00","end":"19:00"},"wednesday":{"isOpen":true,"start":"09:00","end":"19:00"},"thursday":{"isOpen":true,"start":"09:00","end":"19:00"},"friday":{"isOpen":true,"start":"09:00","end":"19:00"},"saturday":{"isOpen":true,"start":"10:00","end":"18:00"},"sunday":{"isOpen":false,"start":"09:00","end":"18:00"}}'::jsonb
  )
  RETURNING id INTO v_salon_id;

  INSERT INTO salon_memberships (salon_id, profile_id, role, status, accepted_at)
  VALUES (v_salon_id, p_owner_id, 'owner', 'active', now());

  INSERT INTO expense_categories (salon_id, name, color, sort_order) VALUES
    (v_salon_id, 'Loyer',     'bg-purple-100 text-purple-700', 1),
    (v_salon_id, 'Salaires',  'bg-blue-100 text-blue-700',     2),
    (v_salon_id, 'Stock',     'bg-amber-100 text-amber-700',   3),
    (v_salon_id, 'Marketing', 'bg-pink-100 text-pink-700',     4),
    (v_salon_id, 'Divers',    'bg-slate-100 text-slate-700',   5);

  -- Seed demo data for the new salon
  PERFORM seed_salon_demo_data(v_salon_id, p_owner_id);

  RETURN v_salon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
