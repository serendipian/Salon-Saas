# Coiffure Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 demo Coiffure services with 8 real services and 43 variants, and update the demo seed function accordingly.

**Architecture:** Single SQL migration file. An idempotent `add_coiffure_services(p_salon_id)` function handles soft-deleting demo services and inserting real ones. `seed_salon_demo_data` is replaced via `CREATE OR REPLACE` to call the shared function instead of hardcoding demo coiffure services.

**Tech Stack:** PostgreSQL (Supabase), PL/pgSQL, `supabase db push` for deployment (remote-only, no Docker).

---

### Task 1: Create Coiffure migration

**Files:**
- Create: `supabase/migrations/20260331200000_seed_coiffure_services.sql`

**Context:** The existing migration `supabase/migrations/20260331100001_seed_onglerie_services.sql` (lines 94–240) defines the current `seed_salon_demo_data`. Its DECLARE block currently has:
- `v_cat_coiffure UUID := gen_random_uuid();` — used in service_categories INSERT and staff skills
- `v_svc_coupe UUID := gen_random_uuid();`, `v_svc_balayage UUID := gen_random_uuid();`, `v_svc_brushing UUID := gen_random_uuid();` — used in services INSERT, variants INSERT, and appointments
- The appointments INSERT uses `v_svc_coupe` (Amina, 60min, 50.00), `v_svc_balayage` (Sarah, 120min, 120.00), `v_svc_brushing` (Fatima, 30min, 25.00)

The new migration must:
1. Define `add_coiffure_services(p_salon_id UUID)` — idempotent, soft-deletes demo services, inserts 8 real services + 43 variants
2. Apply to all existing salons via `SELECT add_coiffure_services(id) FROM salons`
3. Replace `seed_salon_demo_data` via `CREATE OR REPLACE` — removing the 3 demo coiffure services and resolving the new service IDs via SELECT

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260331200000_seed_coiffure_services.sql` with the following exact content:

```sql
-- ═══════════════════════════════════════════════════════════════
-- Migration: Seed Coiffure real services
-- Replaces 3 demo services (Coupe Femme, Balayage, Brushing)
-- with 8 real services and 43 variants from FICHE DE PRIX - COIFFURE
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_coiffure_services(p_salon_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cat_coiffure   UUID;
  v_svc_brushing   UUID;
  v_svc_coloration UUID;
  v_svc_shampoing  UUID;
  v_svc_coupes     UUID;
  v_svc_soins      UUID;
  v_svc_lissages   UUID;
  v_svc_extensions UUID;
  v_svc_invitees   UUID;
BEGIN
  -- Idempotency guard: skip if 'Court' variant under 'Brushing' already exists
  IF EXISTS (
    SELECT 1
    FROM service_variants sv
    JOIN services s ON s.id = sv.service_id
    WHERE s.salon_id = p_salon_id
      AND s.name = 'Brushing'
      AND sv.name = 'Court'
      AND s.deleted_at IS NULL
      AND sv.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- Find the existing Coiffure category
  SELECT id INTO v_cat_coiffure
  FROM service_categories
  WHERE salon_id = p_salon_id AND name = 'Coiffure' AND deleted_at IS NULL
  LIMIT 1;

  -- Soft-delete demo services
  UPDATE services
  SET deleted_at = now()
  WHERE salon_id = p_salon_id
    AND name IN ('Coupe Femme', 'Balayage', 'Brushing')
    AND deleted_at IS NULL
    AND category_id = v_cat_coiffure;

  -- Generate service IDs
  v_svc_brushing   := gen_random_uuid();
  v_svc_coloration := gen_random_uuid();
  v_svc_shampoing  := gen_random_uuid();
  v_svc_coupes     := gen_random_uuid();
  v_svc_soins      := gen_random_uuid();
  v_svc_lissages   := gen_random_uuid();
  v_svc_extensions := gen_random_uuid();
  v_svc_invitees   := gen_random_uuid();

  -- Insert 8 services
  INSERT INTO services (id, salon_id, name, category_id, active) VALUES
    (v_svc_brushing,   p_salon_id, 'Brushing',           v_cat_coiffure, true),
    (v_svc_coloration, p_salon_id, 'Coloration',         v_cat_coiffure, true),
    (v_svc_shampoing,  p_salon_id, 'Shampoings',         v_cat_coiffure, true),
    (v_svc_coupes,     p_salon_id, 'Coupes',             v_cat_coiffure, true),
    (v_svc_soins,      p_salon_id, 'Soins Capillaires',  v_cat_coiffure, true),
    (v_svc_lissages,   p_salon_id, 'Lissages Protéines', v_cat_coiffure, true),
    (v_svc_extensions, p_salon_id, 'Extensions',         v_cat_coiffure, true),
    (v_svc_invitees,   p_salon_id, 'Coiffures Invitées', v_cat_coiffure, true);

  -- Insert 43 variants
  INSERT INTO service_variants (salon_id, service_id, name, duration_minutes, price, cost, additional_cost, sort_order) VALUES
    -- Brushing (6 variantes)
    (p_salon_id, v_svc_brushing, 'Court',         20,  30,    0.00, 0, 1),
    (p_salon_id, v_svc_brushing, 'Mi-long',       30,  40,    0.00, 0, 2),
    (p_salon_id, v_svc_brushing, 'Long',          35,  50,    0.00, 0, 3),
    (p_salon_id, v_svc_brushing, 'Wavy Babyliss', 45,  70,    0.00, 0, 4),
    (p_salon_id, v_svc_brushing, 'Wavy Invité',   60,  150,   5.00, 0, 5),
    (p_salon_id, v_svc_brushing, 'Plaques',       20,  50,    0.00, 0, 6),
    -- Coloration (5 variantes)
    (p_salon_id, v_svc_coloration, 'Racine',                      50,  200, 52.00, 0, 1),
    (p_salon_id, v_svc_coloration, 'Normale (à partir de)',       90,  250, 52.00, 0, 2),
    (p_salon_id, v_svc_coloration, 'Sans ammoniac (à partir de)', 90,  250, 61.00, 0, 3),
    (p_salon_id, v_svc_coloration, 'Balayage (à partir de)',      180, 700, 34.67, 0, 4),
    (p_salon_id, v_svc_coloration, 'Ombré (à partir de)',         180, 700, 34.67, 0, 5),
    -- Shampoings (4 variantes)
    (p_salon_id, v_svc_shampoing, 'SH Normal',    5, 10,  4.00, 0, 1),
    (p_salon_id, v_svc_shampoing, 'Mask Normal',  5, 10,  6.25, 0, 2),
    (p_salon_id, v_svc_shampoing, 'SHP Spécial',  5, 20,  8.75, 0, 3),
    (p_salon_id, v_svc_shampoing, 'Mask Spécial', 5, 20,  8.75, 0, 4),
    -- Coupes (3 variantes)
    (p_salon_id, v_svc_coupes, 'Pointes',   15,  40,  0.00, 0, 1),
    (p_salon_id, v_svc_coupes, 'Frange',    15,  40,  0.00, 0, 2),
    (p_salon_id, v_svc_coupes, 'Relooking', 35, 120,  0.00, 0, 3),
    -- Soins Capillaires (7 variantes)
    (p_salon_id, v_svc_soins, 'Soin K18',                      60, 300, 145.00, 0, 1),
    (p_salon_id, v_svc_soins, 'Soin Ker Factor',               60, 300,  66.67, 0, 2),
    (p_salon_id, v_svc_soins, 'Soins Antichute (à partir de)', 60, 300, 100.00, 0, 3),
    (p_salon_id, v_svc_soins, 'Soins Cadiveau',                60, 400,  90.00, 0, 4),
    (p_salon_id, v_svc_soins, 'Soins Aminoplex',               60, 400, 233.33, 0, 5),
    (p_salon_id, v_svc_soins, 'Soins Caviar',                  60, 400, 233.33, 0, 6),
    (p_salon_id, v_svc_soins, 'Soins Plasma',                  80, 700, 250.00, 0, 7),
    -- Lissages Protéines (8 variantes)
    (p_salon_id, v_svc_lissages, 'Cadiveau (à partir de)',              150,  900, 160.00, 0, 1),
    (p_salon_id, v_svc_lissages, 'Cadiveau BTX (à partir de)',          150,  900, 160.00, 0, 2),
    (p_salon_id, v_svc_lissages, 'Sorali Therapy (à partir de)',        150,  700, 165.00, 0, 3),
    (p_salon_id, v_svc_lissages, 'Fit Tanino (à partir de)',            150,  800, 100.00, 0, 4),
    (p_salon_id, v_svc_lissages, 'Green (à partir de)',                 150,  900, 140.00, 0, 5),
    (p_salon_id, v_svc_lissages, 'Goldery (à partir de)',               150, 1200, 233.33, 0, 6),
    (p_salon_id, v_svc_lissages, 'Black Diamond Premium (à partir de)', 150, 1500, 200.00, 0, 7),
    (p_salon_id, v_svc_lissages, 'Racine (à partir de)',                120,  500,  80.00, 0, 8),
    -- Extensions (5 variantes)
    (p_salon_id, v_svc_extensions, 'Mèche par mèche anneaux (par unité)', 180,   50,  17.00, 0, 1),
    (p_salon_id, v_svc_extensions, 'Bandes adhésives premium (par unité)', 180,  70,  25.00, 0, 2),
    (p_salon_id, v_svc_extensions, 'Mèche par mèche 6D',                   180,  20,  17.00, 0, 3),
    (p_salon_id, v_svc_extensions, 'Extension clips 100g',                  180, 1800, 800.00, 0, 4),
    (p_salon_id, v_svc_extensions, 'Extension en kératine (par unité)',     180,   50,  18.00, 0, 5),
    -- Coiffures Invitées (5 variantes)
    (p_salon_id, v_svc_invitees, 'Demi chignon (à partir de)',                        90,  150, 2.00, 0, 1),
    (p_salon_id, v_svc_invitees, 'Coiffure invitée (à partir de)',                    90,  300, 2.00, 0, 2),
    (p_salon_id, v_svc_invitees, 'Babyliss (à partir de)',                            60,  120, 5.00, 0, 3),
    (p_salon_id, v_svc_invitees, 'Babyliss Wavy (à partir de)',                       60,  150, 5.00, 0, 4),
    (p_salon_id, v_svc_invitees, 'Demi chignon + location extensions (à partir de)', 120,  300, 0.00, 0, 5);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all existing salons
SELECT add_coiffure_services(id) FROM salons;

-- ═══════════════════════════════════════════════════════════════
-- Update seed_salon_demo_data:
--   - Remove 3 demo coiffure services (Coupe Femme, Balayage, Brushing)
--   - Call add_coiffure_services instead
--   - Resolve new service IDs for appointments
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION seed_salon_demo_data(p_salon_id UUID, p_owner_id UUID)
RETURNS VOID AS $$
DECLARE
  -- Service category IDs
  v_cat_coiffure UUID;  -- resolved after add_coiffure_services
  v_cat_soins    UUID := gen_random_uuid();

  -- Service IDs (Soins only — Coiffure services come from add_coiffure_services)
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
  -- (Coiffure is created by add_coiffure_services — only Soins here)
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
  -- Amina  → Brushing Court     (20 min, 30.00)
  -- Sarah  → Coloration Racine  (50 min, 200.00)
  -- Nadia  → Soin Visage complet (unchanged)
  -- Yasmin → Manucure           (unchanged)
  -- Fatima → Brushing Long      (35 min, 50.00)
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
```

- [ ] **Step 2: Push migration to remote Supabase**

```bash
supabase db push
```

Expected output: migration `20260331200000_seed_coiffure_services` applied successfully (no errors).

- [ ] **Step 3: Verify services exist in the database**

Run in Supabase Studio SQL editor (or via CLI):

```sql
SELECT s.name AS service, COUNT(sv.id) AS variant_count
FROM services s
JOIN service_variants sv ON sv.service_id = s.id
JOIN service_categories sc ON sc.id = s.category_id
WHERE sc.name = 'Coiffure'
  AND s.deleted_at IS NULL
  AND sv.deleted_at IS NULL
GROUP BY s.name
ORDER BY s.name;
```

Expected: 8 rows — Brushing (6), Coiffures Invitées (5), Coloration (5), Coupes (3), Extensions (5), Lissages Protéines (8), Shampoings (4), Soins Capillaires (7). Total variants = 43.

Also verify demo services are soft-deleted (should return 0 rows):

```sql
SELECT name FROM services
WHERE name IN ('Coupe Femme', 'Balayage', 'Brushing')
  AND deleted_at IS NULL;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260331200000_seed_coiffure_services.sql
git commit -m "feat: add real coiffure services via migration (8 services, 43 variants)"
```
