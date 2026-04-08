-- Fix: expire-trials pg_cron job was sending no auth header, so the Edge Function
-- always returned 401 and trials were never expiring.
--
-- This migration updates the cron schedule to include the x-function-secret header.
-- IMPORTANT: After running this migration, set EXPIRE_TRIALS_SECRET in the Edge Function env
-- to match the value below. You can generate a new secret with: openssl rand -hex 32
--
-- To change the secret later:
-- 1. Update this migration's header value (or create a new migration)
-- 2. Update the Edge Function env: EXPIRE_TRIALS_SECRET=<new-value>
-- 3. Redeploy: npx supabase functions deploy expire-trials --no-verify-jwt --use-api

-- Remove old schedule
select cron.unschedule('expire-trials-daily');

-- Re-create with auth header
-- NOTE: Replace 'CHANGE_ME_TO_A_REAL_SECRET' with the actual secret you set in Edge Function env
select cron.schedule(
  'expire-trials-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://izsycdmrwscdnxebptsx.supabase.co/functions/v1/expire-trials',
    headers := '{"Content-Type": "application/json", "x-function-secret": "CHANGE_ME_TO_A_REAL_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
