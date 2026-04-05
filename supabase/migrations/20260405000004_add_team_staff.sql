-- ═══════════════════════════════════════════════════════════════
-- Migration: Add Casa de Chicas team (12 staff members)
-- AUTO-ENT → Freelance (closest contract type in schema)
-- DIM OU LUN → Sunday rest day (can be changed in app)
-- Salary stored via encrypt_pii(); bonus = 50 DH per threshold
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_casa_staff(p_salon_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cat_coiffure UUID[];
  v_cat_autres   UUID[];

  -- All 7 days open: each person's rest day is closed via jsonb_set
  v_base JSONB := '{
    "monday":    {"isOpen": true, "start": "09:00", "end": "18:00"},
    "tuesday":   {"isOpen": true, "start": "09:00", "end": "18:00"},
    "wednesday": {"isOpen": true, "start": "09:00", "end": "18:00"},
    "thursday":  {"isOpen": true, "start": "09:00", "end": "18:00"},
    "friday":    {"isOpen": true, "start": "09:00", "end": "18:00"},
    "saturday":  {"isOpen": true, "start": "09:00", "end": "18:00"},
    "sunday":    {"isOpen": true, "start": "09:00", "end": "18:00"}
  }'::jsonb;

  v_off JSONB := '{"isOpen": false, "start": "09:00", "end": "18:00"}'::jsonb;
BEGIN
  -- Idempotency: skip if already seeded for this salon
  IF EXISTS (
    SELECT 1 FROM staff_members
    WHERE salon_id = p_salon_id AND first_name = 'Anas' AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- Coiffure skills
  SELECT ARRAY(
    SELECT id FROM service_categories
    WHERE salon_id = p_salon_id AND name = 'Coiffure' AND deleted_at IS NULL
  ) INTO v_cat_coiffure;

  -- All other category skills (Onglerie, Épilation, Bien Être, Cils, Soins, etc.)
  SELECT ARRAY(
    SELECT id FROM service_categories
    WHERE salon_id = p_salon_id AND name != 'Coiffure' AND deleted_at IS NULL
  ) INTO v_cat_autres;

  INSERT INTO staff_members (
    salon_id, first_name, last_name, role,
    contract_type, base_salary, weekly_hours, commission_rate,
    bonus_tiers, skills, schedule, color, active, start_date
  ) VALUES
    -- ── Coiffure team ──────────────────────────────────────────
    -- Anas · CDI · Tuesday off · bonus 50/700
    (p_salon_id, 'Anas',     '', 'Stylist', 'CDI',      encrypt_pii('5000'), 44.0, 0,
     '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
     jsonb_set(v_base, '{tuesday}',   v_off),
     'bg-blue-100 text-blue-700',     true, CURRENT_DATE),

    -- Amine · Freelance · Thursday off · bonus 50/700
    (p_salon_id, 'Amine',    '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
     '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
     jsonb_set(v_base, '{thursday}',  v_off),
     'bg-indigo-100 text-indigo-700', true, CURRENT_DATE),

    -- Soumia · CDI · Sun or Mon off → Sunday · bonus 50/700
    (p_salon_id, 'Soumia',   '', 'Stylist', 'CDI',      encrypt_pii('5000'), 44.0, 0,
     '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
     jsonb_set(v_base, '{sunday}',    v_off),
     'bg-rose-100 text-rose-700',     true, CURRENT_DATE),

    -- Khadija · Freelance · Sun or Mon off → Sunday · bonus 50/700
    (p_salon_id, 'Khadija',  '', 'Stylist', 'Freelance', encrypt_pii('3500'), 44.0, 0,
     '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
     jsonb_set(v_base, '{sunday}',    v_off),
     'bg-pink-100 text-pink-700',     true, CURRENT_DATE),

    -- Wiam · Freelance · Sunday off · bonus 50/600
    (p_salon_id, 'Wiam',     '', 'Stylist', 'Freelance', encrypt_pii('3500'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_coiffure,
     jsonb_set(v_base, '{sunday}',    v_off),
     'bg-purple-100 text-purple-700', true, CURRENT_DATE),

    -- ── Autres Catégories team ─────────────────────────────────
    -- Yasmine · Freelance · Thursday off · bonus 50/600
    (p_salon_id, 'Yasmine',  '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{thursday}',  v_off),
     'bg-amber-100 text-amber-700',   true, CURRENT_DATE),

    -- Rym · Freelance · Friday off · bonus 50/600
    (p_salon_id, 'Rym',      '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{friday}',    v_off),
     'bg-teal-100 text-teal-700',     true, CURRENT_DATE),

    -- Aziza · CDI · Monday off · bonus 50/600
    (p_salon_id, 'Aziza',    '', 'Stylist', 'CDI',      encrypt_pii('4000'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{monday}',    v_off),
     'bg-emerald-100 text-emerald-700', true, CURRENT_DATE),

    -- Nouhaila · Freelance · Tuesday off · bonus 50/600
    (p_salon_id, 'Nouhaila', '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{tuesday}',   v_off),
     'bg-cyan-100 text-cyan-700',     true, CURRENT_DATE),

    -- Nora · CDI · Wednesday off · bonus 50/600
    (p_salon_id, 'Nora',     '', 'Stylist', 'CDI',      encrypt_pii('4000'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{wednesday}', v_off),
     'bg-orange-100 text-orange-700', true, CURRENT_DATE),

    -- Nisrine · CDI · Sunday off · bonus 50/600
    (p_salon_id, 'Nisrine',  '', 'Stylist', 'CDI',      encrypt_pii('5000'), 44.0, 0,
     '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{sunday}',    v_off),
     'bg-lime-100 text-lime-700',     true, CURRENT_DATE),

    -- Doha · Freelance · Sunday off · bonus 50/400
    (p_salon_id, 'Doha',     '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
     '[{"target":400,"bonus":50}]'::jsonb, v_cat_autres,
     jsonb_set(v_base, '{sunday}',    v_off),
     'bg-fuchsia-100 text-fuchsia-700', true, CURRENT_DATE);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bypass the plan-limit trigger for this bulk seed insert.
-- The 12 real staff members exceed the 10-staff trial/premium cap.
-- Upgrade the salon to Pro via the billing UI after this migration runs.
ALTER TABLE staff_members DISABLE TRIGGER staff_members_plan_limit;
SELECT add_casa_staff(id) FROM salons;
ALTER TABLE staff_members ENABLE TRIGGER staff_members_plan_limit;
