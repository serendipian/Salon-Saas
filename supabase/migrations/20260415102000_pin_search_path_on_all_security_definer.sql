-- Pin search_path on every SECURITY DEFINER function in public schema
-- that doesn't already have one set. Defense against function-shadow
-- privilege escalation (CVE-2018-1058 class).
--
-- Affected functions discovered at migration time. The DO block is
-- idempotent: it only alters functions whose proconfig does not already
-- contain a search_path setting.

DO $$
DECLARE
  f RECORD;
  sql text;
  cnt integer := 0;
BEGIN
  FOR f IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true                            -- SECURITY DEFINER
      AND n.nspname = 'public'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    sql := format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions, vault',
      f.schema_name, f.func_name, f.args
    );
    EXECUTE sql;
    cnt := cnt + 1;
  END LOOP;

  RAISE NOTICE 'Pinned search_path on % SECURITY DEFINER functions', cnt;
END $$;
