-- Repair: re-apply salon address/social columns that were recorded but not created
ALTER TABLE salons ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS tiktok TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS business_registration TEXT;
