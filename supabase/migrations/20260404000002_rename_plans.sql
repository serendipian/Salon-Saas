-- Rename plans and update prices/price IDs
UPDATE plans SET
  name = 'Premium',
  price_monthly = 59.00,
  price_yearly = 590.00
WHERE name = 'Pro';

UPDATE plans SET
  name = 'Pro',
  price_monthly = 89.00,
  price_yearly = 890.00,
  stripe_price_id_monthly = 'price_1TII1yDZzKRaC8mnNJEE9W2Z'
WHERE name = 'Enterprise';
