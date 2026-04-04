-- Rename internal subscription_tier identifiers to match display names:
--   'pro'        → 'premium'   (the 59€ Premium plan)
--   'enterprise' → 'pro'       (the 89€ Pro plan)
--
-- Order matters: rename 'pro' → 'premium' before 'enterprise' → 'pro'
-- to avoid a collision where both values briefly become 'pro'.

-- 1. Drop old CHECK constraint (will be recreated with new values)
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_subscription_tier_check;

-- 2. Migrate existing data
UPDATE salons SET subscription_tier = 'premium'   WHERE subscription_tier = 'pro';
UPDATE salons SET subscription_tier = 'pro'        WHERE subscription_tier = 'enterprise';

-- 3. Add new CHECK constraint
ALTER TABLE salons ADD CONSTRAINT salons_subscription_tier_check
  CHECK (subscription_tier IN ('trial', 'free', 'premium', 'pro', 'past_due'));

-- 4. Update plan-limits trigger function with new tier names
CREATE OR REPLACE FUNCTION check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_tier    text;
  v_count   integer;
  v_limit   integer;
BEGIN
  SELECT subscription_tier INTO v_tier FROM salons WHERE id = NEW.salon_id;

  IF TG_TABLE_NAME = 'staff_members' THEN
    CASE v_tier
      WHEN 'free'                            THEN v_limit := 2;
      WHEN 'premium', 'trial', 'past_due'   THEN v_limit := 10;
      ELSE v_limit := NULL; -- pro: unlimited
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
$$ LANGUAGE plpgsql;
