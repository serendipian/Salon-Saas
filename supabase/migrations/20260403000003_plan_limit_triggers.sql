-- supabase/migrations/20260403000003_plan_limit_triggers.sql

-- Trigger function that checks plan limits before INSERT
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
      WHEN 'free'                        THEN v_limit := 2;
      WHEN 'pro', 'trial', 'past_due'   THEN v_limit := 10;
      ELSE v_limit := NULL; -- enterprise: unlimited
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

-- Attach to tables
CREATE OR REPLACE TRIGGER staff_members_plan_limit
  BEFORE INSERT ON staff_members
  FOR EACH ROW EXECUTE FUNCTION check_plan_limits();

CREATE OR REPLACE TRIGGER clients_plan_limit
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION check_plan_limits();

CREATE OR REPLACE TRIGGER products_plan_limit
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION check_plan_limits();
