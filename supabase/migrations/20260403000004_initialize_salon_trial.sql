-- supabase/migrations/20260403000004_initialize_salon_trial.sql

CREATE OR REPLACE FUNCTION initialize_salon_trial(p_salon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pro_plan_id uuid;
BEGIN
  SELECT id INTO v_pro_plan_id FROM plans WHERE name = 'Pro' LIMIT 1;

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

-- Grant execute to authenticated users (called from client after salon creation)
GRANT EXECUTE ON FUNCTION initialize_salon_trial(uuid) TO authenticated;
