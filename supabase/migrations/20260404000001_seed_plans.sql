-- supabase/migrations/20260404000001_seed_plans.sql
-- Seed subscription plans (runs only if table is empty)

INSERT INTO plans (id, name, max_staff, max_clients, max_products, features, price_monthly, price_yearly, stripe_price_id_monthly, active)
SELECT * FROM (VALUES
  (
    gen_random_uuid(),
    'Free',
    2, 50, 20,
    '{"analytics": false, "api_access": false, "custom_branding": false}'::jsonb,
    0::numeric, 0::numeric,
    NULL::text,
    true
  ),
  (
    gen_random_uuid(),
    'Pro',
    10, NULL::integer, NULL::integer,
    '{"analytics": true, "api_access": false, "custom_branding": true}'::jsonb,
    29.99::numeric, 299.99::numeric,
    'price_1TIH1jDZzKRaC8mnYRLDmm32'::text,
    true
  ),
  (
    gen_random_uuid(),
    'Enterprise',
    NULL::integer, NULL::integer, NULL::integer,
    '{"analytics": true, "api_access": true, "custom_branding": true}'::jsonb,
    79.99::numeric, 799.99::numeric,
    NULL::text,
    true
  )
) AS v(id, name, max_staff, max_clients, max_products, features, price_monthly, price_yearly, stripe_price_id_monthly, active)
WHERE NOT EXISTS (SELECT 1 FROM plans LIMIT 1);
