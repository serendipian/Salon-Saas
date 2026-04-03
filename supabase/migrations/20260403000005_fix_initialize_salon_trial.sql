-- supabase/migrations/20260403000005_fix_initialize_salon_trial.sql
-- Fix: add NULL guard for Pro plan + ownership check

CREATE OR REPLACE FUNCTION initialize_salon_trial(p_salon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pro_plan_id uuid;
BEGIN
  -- Authorization: caller must be owner of the salon
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id
      AND profile_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: must be salon owner to initialize trial';
  END IF;

  -- Look up Pro plan
  SELECT id INTO v_pro_plan_id FROM plans WHERE name = 'Pro' LIMIT 1;

  -- Guard: plans table must have a Pro entry
  IF v_pro_plan_id IS NULL THEN
    RAISE EXCEPTION 'Pro plan not found in plans table — ensure seed data is applied';
  END IF;

  INSERT INTO subscriptions (salon_id, plan_id, status, trial_ends_at)
  VALUES (
    p_salon_id,
    v_pro_plan_id,
    'trial',
    now() + interval '14 days'
  )
  ON CONFLICT (salon_id) DO NOTHING;

  UPDATE salons SET subscription_tier = 'trial' WHERE id = p_salon_id;
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_salon_trial(uuid) TO authenticated;
