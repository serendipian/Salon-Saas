-- Add icon column to service_categories for user-selected category icons.
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS icon TEXT;
