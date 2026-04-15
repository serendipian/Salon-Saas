-- Fix check_plan_limits() — correct the tier CASE:
--   free     → 2 staff
--   premium  → 10 staff   (was missing, falling through to unlimited)
--   trial    → 10 staff
--   past_due → 10 staff   (treat as premium, per CLAUDE.md)
--   pro      → unlimited  (was incorrectly capped at 10)
-- Also add SET search_path for CVE-2018-1058 class hardening.

CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_tier    text;
  v_count   integer;
  v_limit   integer;
BEGIN
  SELECT subscription_tier INTO v_tier FROM salons WHERE id = NEW.salon_id;

  IF TG_TABLE_NAME = 'staff_members' THEN
    CASE v_tier
      WHEN 'free'                              THEN v_limit := 2;
      WHEN 'premium', 'trial', 'past_due'      THEN v_limit := 10;
      WHEN 'pro'                               THEN v_limit := NULL;  -- unlimited
      ELSE v_limit := NULL;
    END CASE;
    SELECT COUNT(*) INTO v_count
      FROM staff_members WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'clients' THEN
    IF v_tier = 'free' THEN v_limit := 50; ELSE v_limit := NULL; END IF;
    SELECT COUNT(*) INTO v_count
      FROM clients WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'products' THEN
    IF v_tier = 'free' THEN v_limit := 20; ELSE v_limit := NULL; END IF;
    SELECT COUNT(*) INTO v_count
      FROM products WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;
  END IF;

  IF v_limit IS NOT NULL AND v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:%.%', TG_TABLE_NAME, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers don't need recreation; they reference the function by name.
