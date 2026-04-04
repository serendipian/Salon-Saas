-- pg_cron must be enabled in the Supabase Dashboard (Extensions) before this runs.
-- Once enabled, apply this migration via: supabase db push --linked
--
-- Alternatively, set the schedule directly in:
-- Supabase Dashboard → Edge Functions → expire-trials → Schedule → 0 2 * * *

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'expire-trials-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://izsycdmrwscdnxebptsx.supabase.co/functions/v1/expire-trials',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
