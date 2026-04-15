-- Stripe webhook idempotency table.
-- Every webhook handler branch checks this table at entry and short-circuits
-- if the event.id has been seen. Insert happens after successful processing
-- so that a mid-handler crash allows Stripe to retry cleanly.
--
-- Retention: we keep events for 90 days as a forensic trail; older rows
-- are deleted by a scheduled cron (wired in a separate migration once
-- pg_cron jobs are consolidated).

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id     text        PRIMARY KEY,
  event_type   text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON public.processed_stripe_events(processed_at);

-- Only service_role touches this table; no client access.
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Deny-all for authenticated / anon; service_role bypasses RLS.
CREATE POLICY processed_stripe_events_no_client_access
  ON public.processed_stripe_events
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.processed_stripe_events FROM authenticated, anon;
GRANT SELECT, INSERT ON public.processed_stripe_events TO service_role;

COMMENT ON TABLE public.processed_stripe_events IS
  'Stripe webhook idempotency: insert-after-success pattern. '
  'Any event.id already present short-circuits the handler.';
