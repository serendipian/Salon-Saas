-- Add service_settings JSONB column to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS service_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN salons.service_settings IS 'Service module settings: defaultDuration, defaultVariantName, showCostsInList, defaultView';
