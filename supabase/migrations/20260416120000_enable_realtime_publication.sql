-- Enable Supabase Realtime broadcasts for all business tables.
-- Without this, INSERT/UPDATE/DELETE events are never sent to clients
-- and the app's useRealtimeSync hooks are no-ops.
--
-- Idempotent: uses a DO block that skips tables already in the publication.

DO $$
DECLARE
  t text;
  tables_to_publish text[] := ARRAY[
    'appointments',
    'appointment_groups',
    'transactions',
    'transaction_items',
    'transaction_payments',
    'clients',
    'expenses',
    'recurring_expenses',
    'products',
    'product_categories',
    'services',
    'service_variants',
    'service_categories',
    'staff_members',
    'staff_payouts',
    'suppliers',
    'salons',
    'invitations'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_publish
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
