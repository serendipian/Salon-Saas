-- supabase/migrations/20260403000001b_billing_tables_fixes.sql
-- Supplementary fixes for 20260403000001_billing_tables.sql (already applied to remote DB)

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_salon ON invoices(salon_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);

-- Fix invoices.subscription_id to cascade on delete
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subscription_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;

-- Drop and recreate RLS policies with owner/manager restriction
DROP POLICY IF EXISTS "salon members read own subscription" ON subscriptions;
CREATE POLICY "owners and managers read own subscription"
  ON subscriptions FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

DROP POLICY IF EXISTS "salon members read own invoices" ON invoices;
CREATE POLICY "owners and managers read own invoices"
  ON invoices FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
