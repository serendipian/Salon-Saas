-- Pin search_path on delete_appointments_bulk.
--
-- The function was created in migration 20260424180000 without a pinned
-- search_path. The original migration file has since been amended so fresh
-- resets produce a correctly-pinned function from the start, but any
-- environment where 20260424180000 was already applied before the amend
-- needs this ALTER to catch up. ALTER is idempotent — re-running against a
-- function that already has search_path set simply rewrites to the same
-- value.
--
-- Matches the repo-wide pattern established in 20260415102000 and
-- consistently applied in newer SECURITY DEFINER functions such as
-- 20260424150000. Defense against CVE-2018-1058 function-shadow
-- privilege escalation.

ALTER FUNCTION delete_appointments_bulk(UUID[], TEXT, TEXT)
  SET search_path = public, extensions, vault;
