-- Add salon_memberships to the supabase_realtime publication so the
-- profile-side `useInvitation`/membership realtime subscription actually
-- receives changefeed events. Before this, the realtime gateway replied
-- with `system.error: "Unable to subscribe to changes with given
-- parameters. Please check Realtime is enabled..."` and the channel
-- silently produced no events.
--
-- Idempotent: ALTER PUBLICATION ADD TABLE errors if the table is already
-- a member, so wrap in a DO block that checks pg_publication_tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'salon_memberships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salon_memberships;
  END IF;
END
$$;
