-- ═══════════════════════════════════════════════════════════════
-- Insert the 9 staff members missing from the original seed.
-- The original add_casa_staff() returned early because 'Anas Boukdir'
-- already existed, so most staff were never inserted.
-- Each INSERT is guarded individually to be idempotent.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  p_salon_id   UUID := 'b9f129fc-becf-4b03-989b-3e07251d8df1';

  v_cat_coiffure UUID[];
  v_cat_autres   UUID[];

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
  SELECT ARRAY(
    SELECT id FROM service_categories
    WHERE salon_id = p_salon_id AND name = 'Coiffure' AND deleted_at IS NULL
  ) INTO v_cat_coiffure;

  SELECT ARRAY(
    SELECT id FROM service_categories
    WHERE salon_id = p_salon_id AND name != 'Coiffure' AND deleted_at IS NULL
  ) INTO v_cat_autres;

  -- ── Coiffure team ──────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Amine' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Amine', '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
      '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
      jsonb_set(v_base, '{thursday}', v_off),
      'bg-indigo-100 text-indigo-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Soumia' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Soumia', '', 'Stylist', 'CDI', encrypt_pii('5000'), 44.0, 0,
      '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
      jsonb_set(v_base, '{sunday}', v_off),
      'bg-rose-100 text-rose-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Khadija' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Khadija', '', 'Stylist', 'Freelance', encrypt_pii('3500'), 44.0, 0,
      '[{"target":700,"bonus":50}]'::jsonb, v_cat_coiffure,
      jsonb_set(v_base, '{sunday}', v_off),
      'bg-pink-100 text-pink-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Wiam' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Wiam', '', 'Stylist', 'Freelance', encrypt_pii('3500'), 44.0, 0,
      '[{"target":600,"bonus":50}]'::jsonb, v_cat_coiffure,
      jsonb_set(v_base, '{sunday}', v_off),
      'bg-purple-100 text-purple-700', true, CURRENT_DATE);
  END IF;

  -- ── Autres Catégories team ──────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Rym' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Rym', '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
      '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
      jsonb_set(v_base, '{friday}', v_off),
      'bg-teal-100 text-teal-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Nouhaila' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Nouhaila', '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
      '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
      jsonb_set(v_base, '{tuesday}', v_off),
      'bg-cyan-100 text-cyan-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Nora' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Nora', '', 'Stylist', 'CDI', encrypt_pii('4000'), 44.0, 0,
      '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
      jsonb_set(v_base, '{wednesday}', v_off),
      'bg-orange-100 text-orange-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Nisrine' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Nisrine', '', 'Stylist', 'CDI', encrypt_pii('5000'), 44.0, 0,
      '[{"target":600,"bonus":50}]'::jsonb, v_cat_autres,
      jsonb_set(v_base, '{sunday}', v_off),
      'bg-lime-100 text-lime-700', true, CURRENT_DATE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE salon_id = p_salon_id AND first_name = 'Doha' AND deleted_at IS NULL) THEN
    INSERT INTO staff_members (salon_id, first_name, last_name, role, contract_type, base_salary, weekly_hours, commission_rate, bonus_tiers, skills, schedule, color, active, start_date)
    VALUES (p_salon_id, 'Doha', '', 'Stylist', 'Freelance', encrypt_pii('4000'), 44.0, 0,
      '[{"target":400,"bonus":50}]'::jsonb, v_cat_autres,
      jsonb_set(v_base, '{sunday}', v_off),
      'bg-fuchsia-100 text-fuchsia-700', true, CURRENT_DATE);
  END IF;

END;
$$;
