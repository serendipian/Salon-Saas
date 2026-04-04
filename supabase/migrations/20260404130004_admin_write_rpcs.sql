-- supabase/migrations/20260404130004_admin_write_rpcs.sql

-- Extend a salon's trial by N days
CREATE OR REPLACE FUNCTION admin_extend_trial(p_salon_id uuid, p_days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();

  -- Reset tier to trial if it expired
  UPDATE salons
  SET subscription_tier = 'trial', updated_at = now()
  WHERE id = p_salon_id AND subscription_tier != 'trial';

  -- Extend trial_ends_at from now (if expired) or from current end date
  UPDATE subscriptions
  SET
    trial_ends_at = CASE
      WHEN trial_ends_at IS NULL OR trial_ends_at < now()
        THEN now() + (p_days || ' days')::interval
      ELSE trial_ends_at + (p_days || ' days')::interval
    END,
    updated_at = now()
  WHERE salon_id = p_salon_id;
END;
$$;

-- Manually override a salon's plan tier (blocked if active Stripe subscription exists)
CREATE OR REPLACE FUNCTION admin_set_plan(p_salon_id uuid, p_tier text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();

  IF p_tier NOT IN ('trial', 'free', 'premium', 'pro', 'past_due') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  -- Block override if salon has an active Stripe subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE salon_id = p_salon_id
      AND status = 'active'
      AND stripe_subscription_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot override active Stripe subscription. Use Stripe dashboard to change plans.';
  END IF;

  UPDATE salons
  SET subscription_tier = p_tier, updated_at = now()
  WHERE id = p_salon_id;
END;
$$;

-- Suspend a salon (app-level only, Stripe untouched)
CREATE OR REPLACE FUNCTION admin_suspend_salon(p_salon_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();
  UPDATE salons SET is_suspended = true, updated_at = now() WHERE id = p_salon_id;
END;
$$;

-- Reactivate a suspended salon
CREATE OR REPLACE FUNCTION admin_reactivate_salon(p_salon_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_admin();
  UPDATE salons SET is_suspended = false, updated_at = now() WHERE id = p_salon_id;
END;
$$;
