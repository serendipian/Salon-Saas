-- supabase/migrations/20260403000001_billing_tables.sql

-- 1. Add 'past_due' to salons.subscription_tier check constraint
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_subscription_tier_check;
ALTER TABLE salons ADD CONSTRAINT salons_subscription_tier_check
  CHECK (subscription_tier IN ('trial', 'free', 'pro', 'enterprise', 'past_due'));

-- 2. subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id               uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  plan_id                uuid NOT NULL REFERENCES plans(id),
  status                 text NOT NULL CHECK (status IN ('trial','active','past_due','cancelled')),
  billing_cycle          text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_price_id        text,
  currency               text NOT NULL DEFAULT 'eur',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_salon_id_unique UNIQUE (salon_id)
);

-- 3. invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  subscription_id      uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id    text NOT NULL UNIQUE,
  stripe_event_id      text NOT NULL UNIQUE,
  amount_cents         integer NOT NULL,
  currency             text NOT NULL DEFAULT 'eur',
  status               text NOT NULL CHECK (status IN ('paid','open','uncollectible')),
  hosted_invoice_url   text,
  invoice_pdf_url      text,
  paid_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. updated_at trigger for subscriptions (reuse existing trigger function)
CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_salon ON invoices(salon_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);

-- 6. RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners and managers read own subscription"
  ON subscriptions FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

CREATE POLICY "owners and managers read own invoices"
  ON invoices FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- Edge Functions use service role — no INSERT/UPDATE policies needed for app users
