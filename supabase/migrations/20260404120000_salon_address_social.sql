-- Break address into structured fields and add social media + business fields

-- Structured address fields
ALTER TABLE salons ADD COLUMN street TEXT;
ALTER TABLE salons ADD COLUMN city TEXT;
ALTER TABLE salons ADD COLUMN postal_code TEXT;
ALTER TABLE salons ADD COLUMN country TEXT;
ALTER TABLE salons ADD COLUMN neighborhood TEXT;

-- Contact
ALTER TABLE salons ADD COLUMN whatsapp TEXT;

-- Social media
ALTER TABLE salons ADD COLUMN instagram TEXT;
ALTER TABLE salons ADD COLUMN facebook TEXT;
ALTER TABLE salons ADD COLUMN tiktok TEXT;
ALTER TABLE salons ADD COLUMN google_maps_url TEXT;

-- Business registration (generic — SIRET, ICE, CRN, etc.)
ALTER TABLE salons ADD COLUMN business_registration TEXT;
