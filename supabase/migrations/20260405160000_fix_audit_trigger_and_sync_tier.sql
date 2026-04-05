-- ============================================================
-- Fix audit_trigger() crash on salons table
-- Root cause: 20260405150000_security_audit_fixes.sql added PII scrubbing
-- but dropped the salons-table fix from 20260327110000 — the function
-- referenced NEW.salon_id which doesn't exist on the salons table.
-- This caused every Stripe webhook UPDATE on salons to silently fail,
-- leaving subscription_tier out of sync with actual Stripe state.
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_salon_id UUID;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_row JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_old := v_row;
    v_new := NULL;
  ELSE
    v_row := to_jsonb(NEW);
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    v_new := v_row;
  END IF;

  v_record_id := (v_row->>'id')::UUID;

  -- salons table uses its own id as the salon_id (no salon_id column)
  IF TG_TABLE_NAME = 'salons' THEN
    v_salon_id := v_record_id;
  ELSE
    v_salon_id := (v_row->>'salon_id')::UUID;
  END IF;

  -- Scrub PII columns from staff_members audit entries
  IF TG_TABLE_NAME = 'staff_members' THEN
    v_old := v_old - 'iban' - 'social_security_number' - 'base_salary';
    v_new := v_new - 'iban' - 'social_security_number' - 'base_salary';
  END IF;

  INSERT INTO audit_log (salon_id, table_name, record_id, action, old_data, new_data, performed_by)
  VALUES (v_salon_id, TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, auth.uid());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Re-sync subscription_tier from the subscriptions table.
-- Fixes any salons where the tier is stale due to the above bug.
-- Only updates salons that have a corresponding active subscription row.
-- ============================================================
UPDATE salons s
SET subscription_tier = CASE
  WHEN sub.status = 'past_due' THEN 'past_due'
  WHEN sub.status = 'active' AND p.name ILIKE '%pro%' THEN 'pro'
  WHEN sub.status = 'active' AND p.name ILIKE '%premium%' THEN 'premium'
  ELSE s.subscription_tier
END
FROM subscriptions sub
JOIN plans p ON p.id = sub.plan_id
WHERE sub.salon_id = s.id
  AND sub.status IN ('active', 'past_due');
