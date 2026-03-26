-- Subscription Plans (global reference data)
-- Runs on local and staging ONLY. Never production.
INSERT INTO plans (id, name, max_staff, max_clients, max_products, features, price_monthly, price_yearly, active)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001', 'Free', 2, 50, 20,
    '{"analytics": false, "api_access": false, "custom_branding": false}'::jsonb,
    0, 0, true
  ),
  (
    'a0000000-0000-0000-0000-000000000002', 'Pro', 10, NULL, NULL,
    '{"analytics": true, "api_access": false, "custom_branding": true}'::jsonb,
    29.99, 299.99, true
  ),
  (
    'a0000000-0000-0000-0000-000000000003', 'Enterprise', NULL, NULL, NULL,
    '{"analytics": true, "api_access": true, "custom_branding": true}'::jsonb,
    79.99, 799.99, true
  );
