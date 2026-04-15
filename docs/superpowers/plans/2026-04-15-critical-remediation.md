# Critical Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out every Critical finding from the 2026-04-15 comprehensive audit (revenue leak, public attack vector, cross-tenant write risk, privilege-escalation vectors, repo hardening gaps) before any further feature work.

**Architecture:** 5 additive Supabase migrations + 2 edge-function patches + a cluster of tightly scoped frontend edits + GitHub-level repo hardening. No schema drops, no data migrations, no route renames. Every change is independently reversible by SQL rollback or `git revert`. The plan respects the project's existing conventions (membership-based RLS via `user_salon_ids_with_role`, SECURITY DEFINER RPCs, Conventional Commits, manual Supabase edge-function deploys).

**Tech Stack:** Postgres 15 (remote Supabase, no local Docker), Deno edge functions, React 19 + TypeScript, Vite, Vercel headers. No test framework exists yet — verification is via SQL assertions, curl probes, and manual browser checks. Test infrastructure setup is intentionally out of scope for this plan (covered in the Week-2 foundations plan).

**Ordering rationale:** Database first (migrations must be applied in timestamp order; also lowest-blast-radius changes). Then edge functions (need the dedup table from migration 5). Then frontend (password + error boundary — safe to deploy any time). Then repo hardening (cosmetic until previous changes are on `main`).

**Prerequisites:**
- Supabase CLI authenticated against the linked remote project (`npx supabase status` shows project-ref).
- `SUPABASE_ACCESS_TOKEN` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `EXPIRE_TRIALS_SECRET` available for deploy.
- GitHub admin access on `serendipian/Salon-Saas`.
- Working tree clean; branch from `main`.

**Branch strategy:** Single branch `fix/critical-remediation-2026-04-15`. One PR per phase (5 PRs total) if reviewing incrementally, or one squash-merged PR if shipping as a bundle. Recommended: 5 PRs for clear audit trail — each phase is independently valuable.

---

## Phase 1 — Database Migrations

All migrations are additive and reversible. Apply in filename order via `npx supabase db push --linked` at the end of the phase.

### Task 1: Fix plan-limit CASE to recognize 'premium' and unlock 'pro'

**Background:** `check_plan_limits()` currently enumerates `free / pro / trial / past_due` and caps Pro at 10 staff (wrong — per CLAUDE.md, Pro is unlimited). `premium` is not listed at all — falls through to `ELSE v_limit := NULL`, making Premium unlimited (wrong — should be 10). Result: Pro customers are under-served, Premium customers bypass their plan. Revenue leak in both directions.

**Files:**
- Create: `supabase/migrations/20260415100000_fix_premium_plan_limits.sql`

- [ ] **Step 1: Create migration file**

Write `supabase/migrations/20260415100000_fix_premium_plan_limits.sql`:

```sql
-- Fix check_plan_limits() — correct the tier CASE:
--   free     → 2 staff
--   premium  → 10 staff   (was missing, falling through to unlimited)
--   trial    → 10 staff
--   past_due → 10 staff   (treat as premium, per CLAUDE.md)
--   pro      → unlimited  (was incorrectly capped at 10)
-- Also add SET search_path for CVE-2018-1058 class hardening.

CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_tier    text;
  v_count   integer;
  v_limit   integer;
BEGIN
  SELECT subscription_tier INTO v_tier FROM salons WHERE id = NEW.salon_id;

  IF TG_TABLE_NAME = 'staff_members' THEN
    CASE v_tier
      WHEN 'free'                              THEN v_limit := 2;
      WHEN 'premium', 'trial', 'past_due'      THEN v_limit := 10;
      WHEN 'pro'                               THEN v_limit := NULL;  -- unlimited
      ELSE v_limit := NULL;
    END CASE;
    SELECT COUNT(*) INTO v_count
      FROM staff_members WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'clients' THEN
    IF v_tier = 'free' THEN v_limit := 50; ELSE v_limit := NULL; END IF;
    SELECT COUNT(*) INTO v_count
      FROM clients WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'products' THEN
    IF v_tier = 'free' THEN v_limit := 20; ELSE v_limit := NULL; END IF;
    SELECT COUNT(*) INTO v_count
      FROM products WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;
  END IF;

  IF v_limit IS NOT NULL AND v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:%.%', TG_TABLE_NAME, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers don't need recreation; they reference the function by name.
```

- [ ] **Step 2: Regenerate types (quick sanity check migration compiles)**

Run: `npx supabase db lint --schema public 2>/dev/null || true`
Expected: no errors specific to this file.

- [ ] **Step 3: Commit migration**

```bash
git add supabase/migrations/20260415100000_fix_premium_plan_limits.sql
git commit -m "$(cat <<'EOF'
fix(db): recognize premium tier and unlock pro in plan-limit trigger

The check_plan_limits() trigger missed 'premium' (fell through to unlimited)
and capped 'pro' at 10 staff. This meant Premium customers bypassed plan
quotas and Pro customers were under-served. Correct per CLAUDE.md spec:
free=2 staff/50 clients/20 products, premium/trial/past_due=10 staff, pro
is unlimited everywhere.

Also add SET search_path to harden against function-shadow escalation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: REVOKE encrypt_pii / decrypt_pii from PUBLIC and authenticated

**Background:** `decrypt_pii(bytea)` is SECURITY DEFINER and defaults to executable by `PUBLIC` (every role). A caller with any ciphertext (from a leaked backup, audit row, or future exposed column) can call `SELECT decrypt_pii(...)` via PostgREST RPC and read plaintext PII. Same risk profile for `encrypt_pii`. These must be internal-only helpers.

**Files:**
- Create: `supabase/migrations/20260415101000_revoke_pii_crypto_from_public.sql`

- [ ] **Step 1: Create migration file**

Write `supabase/migrations/20260415101000_revoke_pii_crypto_from_public.sql`:

```sql
-- Harden PII encryption helpers: remove default EXECUTE from PUBLIC/authenticated.
-- These are SECURITY DEFINER functions; they must only be called by other
-- SECURITY DEFINER RPCs (update_staff_pii, get_staff_pii, get_staff_pii_batch)
-- which inherit execute privileges transitively at definer level.
--
-- Audit trail: a client who obtains a ciphertext BYTEA must not be able to
-- decrypt it by direct RPC call.

REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.decrypt_pii(bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(bytea) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(bytea) FROM authenticated;

-- Internal PII RPCs that legitimately call these helpers:
--   public.update_staff_pii (SECURITY DEFINER)
--   public.get_staff_pii     (SECURITY DEFINER)
--   public.get_staff_pii_batch (SECURITY DEFINER)
-- These run under the table owner and retain implicit execute privilege.
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/20260415101000_revoke_pii_crypto_from_public.sql
git commit -m "$(cat <<'EOF'
fix(security): revoke PII crypto helpers from PUBLIC

encrypt_pii and decrypt_pii are SECURITY DEFINER and were executable by
every role. A caller with a ciphertext BYTEA could decrypt it by direct
RPC call. Restrict execution to internal SECURITY DEFINER callers only.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pin search_path on every SECURITY DEFINER function

**Background:** 97 of ~127 SECURITY DEFINER functions lack `SET search_path`. Any role with CREATE-on-schema privilege can shadow a referenced function (`now()`, `format()`, a table name) and hijack the definer's execution. Classic CVE-2018-1058 class. Fix via a single DO block that inspects pg_proc and ALTERs all affected functions.

**Files:**
- Create: `supabase/migrations/20260415102000_pin_search_path_on_all_security_definer.sql`

- [ ] **Step 1: Create migration file**

Write `supabase/migrations/20260415102000_pin_search_path_on_all_security_definer.sql`:

```sql
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
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/20260415102000_pin_search_path_on_all_security_definer.sql
git commit -m "$(cat <<'EOF'
fix(security): pin search_path on every SECURITY DEFINER function

97 of ~127 SECURITY DEFINER functions in the public schema lacked
search_path pinning. Any role with CREATE on a reachable schema could
shadow an unqualified reference (now(), format(), a table name) and
hijack the definer's execution. Pin search_path = public, extensions,
vault on all affected functions via a single idempotent DO block.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add salon-scoped storage RLS for staff photos

**Background:** `useStaffPhotoUpload.ts` writes to `avatars/staff/${staffId}/photo.${ext}`. The current `avatars_insert` / `avatars_update` / `avatars_delete` policies require `(storage.foldername(name))[1] = auth.uid()::text`. The first segment of `staff/...` is the string `"staff"`, not a UUID — so every staff-photo upload must fail, OR a permissive policy applied via Dashboard allows cross-tenant writes. Fix by adding explicit membership-gated policies for the `staff/` path.

**Files:**
- Create: `supabase/migrations/20260415103000_fix_staff_photo_storage_rls.sql`

- [ ] **Step 1: Create migration file**

Write `supabase/migrations/20260415103000_fix_staff_photo_storage_rls.sql`:

```sql
-- Staff photos upload to path: avatars/staff/<staff_uuid>/photo.<ext>
-- Existing avatars_insert/update/delete policies require foldername[1] =
-- auth.uid()::text, which staff/... paths fail. Add explicit policies
-- that gate staff/ uploads on salon membership with owner|manager role.
--
-- Scope: avatars bucket only. Profile-avatar policies (foldername[1] =
-- auth.uid()::text) remain unchanged.

-- Drop any stale staff-path policies from previous attempts (idempotent)
DROP POLICY IF EXISTS avatars_staff_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_staff_update ON storage.objects;
DROP POLICY IF EXISTS avatars_staff_delete ON storage.objects;

-- INSERT: owner/manager can upload staff photos for staff in their salons
CREATE POLICY avatars_staff_insert ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'staff'
    AND (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM public.staff_members
      WHERE salon_id IN (
        SELECT public.user_salon_ids_with_role(ARRAY['owner','manager']::text[])
      )
      AND deleted_at IS NULL
    )
  );

-- UPDATE: same constraint
CREATE POLICY avatars_staff_update ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'staff'
    AND (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM public.staff_members
      WHERE salon_id IN (
        SELECT public.user_salon_ids_with_role(ARRAY['owner','manager']::text[])
      )
      AND deleted_at IS NULL
    )
  );

-- DELETE: same constraint
CREATE POLICY avatars_staff_delete ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'staff'
    AND (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM public.staff_members
      WHERE salon_id IN (
        SELECT public.user_salon_ids_with_role(ARRAY['owner','manager']::text[])
      )
      AND deleted_at IS NULL
    )
  );

-- SELECT on the avatars bucket remains public (bucket is public=true).
-- If you want to make avatars private, that's a separate hardening step
-- tracked as H-14 in the audit — do not combine here.
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/20260415103000_fix_staff_photo_storage_rls.sql
git commit -m "$(cat <<'EOF'
fix(security): salon-scoped RLS for staff photo uploads

useStaffPhotoUpload writes to avatars/staff/<staff_uuid>/photo.<ext>,
but existing avatars_* policies key on foldername[1] = auth.uid()::text,
so staff/ paths either always fail (broken feature) or are permitted by
a dashboard-applied permissive policy (cross-tenant write risk).

Add explicit INSERT/UPDATE/DELETE policies keyed on salon membership
with owner|manager role. SELECT stays public (bucket is public=true;
making it private is tracked separately).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create Stripe webhook idempotency table

**Background:** Only `invoice.paid` checks `stripe_event_id`. Every other webhook branch is unprotected against replay. Stripe retries on 5xx for up to 3 days; without idempotency, retries cause duplicate state transitions. Fix by creating a `processed_stripe_events` table that every handler branch checks at entry.

**Files:**
- Create: `supabase/migrations/20260415104000_processed_stripe_events.sql`

- [ ] **Step 1: Create migration file**

Write `supabase/migrations/20260415104000_processed_stripe_events.sql`:

```sql
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
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/20260415104000_processed_stripe_events.sql
git commit -m "$(cat <<'EOF'
feat(db): add processed_stripe_events idempotency table

Only invoice.paid had replay protection. This table backs the webhook
handler's insert-after-success idempotency pattern — every branch will
check event_id at entry and insert after successful processing, so
Stripe retries short-circuit cleanly. Edge function update in follow-up
commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Apply all Phase 1 migrations to remote and verify

- [ ] **Step 1: Push migrations to linked Supabase project**

```bash
npx supabase db push --linked
```

Expected output: lists 5 new migration files, applies each, reports success.

If any fails, rollback by running `npx supabase db reset --linked` is destructive — don't. Instead, fix the failing migration in place (rename timestamp so it re-runs) and re-push.

- [ ] **Step 2: Verify plan-limit fix via SQL**

Connect to the Supabase SQL editor and run:

```sql
-- Should return 'public, extensions, vault' (or include search_path)
SELECT proname, proconfig
FROM pg_proc
WHERE proname = 'check_plan_limits' AND pronamespace = 'public'::regnamespace;

-- Simulate the tier logic: check what the CASE would pick for each tier
SELECT tier,
  CASE tier
    WHEN 'free'                         THEN 2
    WHEN 'premium'                      THEN 10
    WHEN 'trial'                        THEN 10
    WHEN 'past_due'                     THEN 10
    WHEN 'pro'                          THEN NULL
  END AS staff_limit
FROM (VALUES ('free'),('premium'),('trial'),('past_due'),('pro')) t(tier);
```

Expected: free=2, premium/trial/past_due=10, pro=NULL (unlimited).

- [ ] **Step 3: Verify PII grants**

```sql
-- Should return zero rows
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN ('encrypt_pii', 'decrypt_pii')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');
```

Expected: 0 rows.

- [ ] **Step 4: Verify search_path is pinned**

```sql
SELECT COUNT(*) AS unpinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname = 'public'
  AND (
    p.proconfig IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
    )
  );
```

Expected: 0.

- [ ] **Step 5: Verify staff storage policies exist**

```sql
SELECT polname FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
  AND polname LIKE 'avatars_staff_%';
```

Expected: 3 rows (`avatars_staff_insert`, `avatars_staff_update`, `avatars_staff_delete`).

- [ ] **Step 6: Verify idempotency table exists and is locked down**

```sql
SELECT has_table_privilege('authenticated', 'public.processed_stripe_events', 'INSERT') AS auth_insert,
       has_table_privilege('service_role', 'public.processed_stripe_events', 'INSERT') AS svc_insert;
```

Expected: `auth_insert=false`, `svc_insert=true`.

- [ ] **Step 7: Regenerate database.types.ts**

Run (remote-only, no Docker):

```bash
npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts
```

Verify: `git diff lib/database.types.ts` shows `processed_stripe_events` added under `Tables`. No unexpected drift.

- [ ] **Step 8: Commit regenerated types**

```bash
git add lib/database.types.ts
git commit -m "$(cat <<'EOF'
chore(types): regenerate database.types.ts after critical remediation migrations

Covers 20260415100000..20260415104000 (plan-limit fix, PII revokes,
search_path pin, staff storage RLS, processed_stripe_events).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Edge Function Patches

### Task 7: Fail-closed `expire-trials` secret enforcement

**Background:** Current logic `if (expectedSecret && secret !== expectedSecret)` skips auth entirely when `EXPIRE_TRIALS_SECRET` is undefined. Public URL + no auth = anyone can downgrade every trial salon. Fix: require the env var to be set, return 500 if missing.

**Also:** the update-subscription step lacks a guard against mid-flight upgrades. If a trial user upgrades between the row select and the salon UPDATE, we overwrite `subscription_tier='premium'` with `'free'`. Add a guard.

**Files:**
- Modify: `supabase/functions/expire-trials/index.ts:7-12, 32-45`

- [ ] **Step 1: Update the function**

Replace the entire contents of `supabase/functions/expire-trials/index.ts` with:

```ts
// supabase/functions/expire-trials/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Fail-closed: require EXPIRE_TRIALS_SECRET to be configured. If it's
  // missing, the function is unauthenticated and anyone on the internet
  // could flip every trial salon to free. Refuse to run.
  const expectedSecret = Deno.env.get('EXPIRE_TRIALS_SECRET');
  if (!expectedSecret) {
    console.error('EXPIRE_TRIALS_SECRET is not configured — refusing to run');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const secret = req.headers.get('x-function-secret');
  if (secret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('salon_id')
    .eq('status', 'trial')
    .lt('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('Failed to fetch expired trials:', error);
    return new Response(
      JSON.stringify({ error: 'DB error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let count = 0;
  for (const { salon_id } of (expired ?? [])) {
    // Double-guarded update: only flip if still trial.
    const { data: subRes } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('salon_id', salon_id)
      .eq('status', 'trial') // guard: don't touch past_due or active
      .select('salon_id');

    if (!subRes || subRes.length === 0) {
      // Raced with an upgrade — skip the salon tier update entirely.
      continue;
    }

    // Only flip tier if still 'trial' — protects against race with a
    // just-completed Stripe upgrade that wrote tier='premium'/'pro'.
    await supabase
      .from('salons')
      .update({ subscription_tier: 'free' })
      .eq('id', salon_id)
      .eq('subscription_tier', 'trial');

    count++;
  }

  console.log(`Expired ${count} trials`);
  // Always return a generic body — do not leak count to unauthorized callers.
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy expire-trials --no-verify-jwt --use-api
```

Expected: success message.

- [ ] **Step 3: Verify unauthenticated call returns 500 or 401**

```bash
curl -i -X POST "https://izsycdmrwscdnxebptsx.supabase.co/functions/v1/expire-trials"
```

Expected: `HTTP/1.1 401 Unauthorized` (since `EXPIRE_TRIALS_SECRET` is set in the env). If you get 500, the env var is missing — set it via `npx supabase secrets set EXPIRE_TRIALS_SECRET=$(openssl rand -hex 32)` and re-verify.

- [ ] **Step 4: Verify authenticated call still works**

Get the configured secret from Supabase Dashboard → Edge Functions → Secrets. Then:

```bash
curl -i -X POST \
  -H "x-function-secret: <actual-secret>" \
  "https://izsycdmrwscdnxebptsx.supabase.co/functions/v1/expire-trials"
```

Expected: `HTTP/1.1 200 OK`, body `{"received":true}`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/expire-trials/index.ts
git commit -m "$(cat <<'EOF'
fix(security): fail-closed expire-trials + race guard against concurrent upgrade

Previously, if EXPIRE_TRIALS_SECRET was unset the function skipped auth
entirely — anyone could downgrade every trial salon via the public URL.
Now require the env var: missing = 500, mismatch = 401.

Also add a double guard on the salon tier update so a race between trial
expiration and a just-completed Stripe upgrade cannot overwrite
tier='premium' with 'free'. Response no longer leaks the expired count.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Add Stripe webhook idempotency + permanent-error handling

**Background:** Only `invoice.paid` guards against replay. Every other branch can be replayed indefinitely if Stripe retries. Also, the current catch-all returns 500 for all errors including permanent ones (malformed metadata) — triggers infinite retry storms.

**Pattern:** insert-after-success. At the top of the try block (after signature verification), check if `event.id` is in `processed_stripe_events`. If yes, short-circuit with 200. At the end of each branch, insert into the table. Wrap permanent errors (missing salon_id, missing plan) in a non-retry response.

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts` (entire file)

- [ ] **Step 1: Replace the webhook handler**

Replace `supabase/functions/stripe-webhook/index.ts` with:

```ts
// supabase/functions/stripe-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

class PermanentError extends Error {
  constructor(msg: string) { super(msg); this.name = 'PermanentError'; }
}

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency short-circuit: already processed?
  const { data: already } = await supabase
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (already) {
    console.log('Duplicate Stripe event, skipping:', event.id, event.type);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const salonId = session.metadata?.salon_id;
        if (!salonId || session.mode !== 'subscription') break;

        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        const { data: plans } = await supabase
          .from('plans')
          .select('id, name')
          .eq('stripe_price_id_monthly', stripeSubscription.items.data[0].price.id)
          .single();

        if (!plans) throw new PermanentError('Plan not found for price id');

        const PLAN_TIER: Record<string, string> = { premium: 'premium', pro: 'pro' };
        const tier = PLAN_TIER[plans.name.toLowerCase()] ?? 'premium';

        await supabase.from('subscriptions').upsert({
          salon_id: salonId,
          plan_id: plans.id,
          status: 'active',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          stripe_price_id: stripeSubscription.items.data[0].price.id,
          current_period_end: new Date(
            stripeSubscription.current_period_end * 1000,
          ).toISOString(),
        }, { onConflict: 'salon_id' });

        await supabase.from('salons')
          .update({ subscription_tier: tier, trial_ends_at: null })
          .eq('id', salonId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('salon_id')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (!subscription) break;

        const { data: plan } = await supabase
          .from('plans')
          .select('id, name')
          .eq('stripe_price_id_monthly', sub.items.data[0].price.id)
          .single();

        const PLAN_TIER: Record<string, string> = { premium: 'premium', pro: 'pro' };
        const tier = PLAN_TIER[plan?.name?.toLowerCase() ?? ''] ?? 'premium';

        await supabase.from('subscriptions').update({
          status: sub.status === 'past_due' ? 'past_due' : 'active',
          stripe_price_id: sub.items.data[0].price.id,
          plan_id: plan?.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        await supabase.from('salons')
          .update({
            subscription_tier: sub.status === 'past_due' ? 'past_due' : tier,
            trial_ends_at: null,
          })
          .eq('id', subscription.salon_id);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id, salon_id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (!subscription) break;

        await supabase.from('invoices').upsert({
          salon_id: subscription.salon_id,
          subscription_id: subscription.id,
          stripe_invoice_id: invoice.id,
          stripe_event_id: event.id,
          amount_cents: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf_url: invoice.invoice_pdf,
          paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
        }, { onConflict: 'stripe_invoice_id', ignoreDuplicates: true });

        await supabase.from('subscriptions').update({
          current_period_end: new Date(
            (invoice.lines.data[0]?.period.end ?? 0) * 1000,
          ).toISOString(),
          status: 'active',
        }).eq('id', subscription.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        await supabase.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string);

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('salon_id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (subscription) {
          await supabase.from('salons')
            .update({ subscription_tier: 'past_due' })
            .eq('id', subscription.salon_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('salon_id')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (!subscription) break;

        await supabase.from('subscriptions').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        await supabase.from('salons')
          .update({ subscription_tier: 'free' })
          .eq('id', subscription.salon_id);
        break;
      }
    }

    // Mark event as processed. This is idempotent — if a concurrent worker
    // already inserted, the UNIQUE on event_id raises, which we ignore.
    await supabase
      .from('processed_stripe_events')
      .insert({ event_id: event.id, event_type: event.type });

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Permanent errors: log, mark processed, return 200 so Stripe stops retrying.
    if (err instanceof PermanentError) {
      console.error('Permanent webhook error, not retrying:', event.id, err.message);
      await supabase
        .from('processed_stripe_events')
        .insert({ event_id: event.id, event_type: event.type });
      return new Response(
        JSON.stringify({ received: true, permanent_error: err.message }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Transient: 500 triggers Stripe retry.
    console.error('Webhook handler error, will retry:', event.id, err);
    return new Response(
      JSON.stringify({ error: 'Internal handler error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt --use-api
```

- [ ] **Step 3: Replay a test event from Stripe Dashboard**

In Stripe Dashboard → Developers → Webhooks → your endpoint → Recent events → select a `checkout.session.completed` → "Resend". Verify that the second resend is recognized as duplicate:

```bash
npx supabase functions logs stripe-webhook --linked
```

Look for: `Duplicate Stripe event, skipping: evt_…`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "$(cat <<'EOF'
fix(billing): add idempotency + permanent-error handling to stripe webhook

Only invoice.paid was guarded against replay. Every other branch now
short-circuits on a matching processed_stripe_events row, and every
branch inserts the event_id after successful processing.

Also classify PermanentError (missing plan / bad metadata) so we return
200 instead of 500 — prevents Stripe's 3-day retry storm on a known-bad
event.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Frontend Fixes

### Task 9: Align password policy to 8 chars everywhere

**Background:** Signup, Login, and accept-invitation-signup enforce 6; Reset, Invitation UI, and Profile enforce 8; Supabase Auth config.toml:148 is 6; sanitizeAuthError says "au moins 6 caractères." Align all to 8.

**Files:**
- Modify: `pages/LoginPage.tsx:137`
- Modify: `pages/SignupPage.tsx:115`
- Modify: `supabase/functions/accept-invitation-signup/index.ts:23`
- Modify: `supabase/config.toml:148`
- Modify: `context/AuthContext.tsx:338` (error-message French text)

- [ ] **Step 1: Update LoginPage**

Edit `pages/LoginPage.tsx` — on line 137 change `minLength={6}` to `minLength={8}`.

- [ ] **Step 2: Update SignupPage**

Edit `pages/SignupPage.tsx` — on line 115 change `minLength={6}` to `minLength={8}`.

- [ ] **Step 3: Update accept-invitation-signup edge function**

Edit `supabase/functions/accept-invitation-signup/index.ts` line 23:

```ts
// before
if (password.length < 6) {

// after
if (password.length < 8) {
```

Also update the associated error message on the next line from "6 characters" to "8 characters" (or keep French "8 caractères") to match.

- [ ] **Step 4: Update Supabase Auth config**

Edit `supabase/config.toml` line 148:

```toml
# before
minimum_password_length = 6

# after
minimum_password_length = 8
```

**Note:** `config.toml` is authoritative only for local dev. For the remote project, ALSO update Supabase Dashboard → Authentication → Settings → "Minimum password length" → 8. Both must match.

- [ ] **Step 5: Update AuthContext error message**

Edit `context/AuthContext.tsx` line 338:

```ts
// before
if (lower.includes('password') && lower.includes('least'))
  return 'Le mot de passe doit contenir au moins 6 caractères.';

// after
if (lower.includes('password') && lower.includes('least'))
  return 'Le mot de passe doit contenir au moins 8 caractères.';
```

- [ ] **Step 6: Redeploy accept-invitation-signup**

```bash
npx supabase functions deploy accept-invitation-signup --no-verify-jwt --use-api
```

- [ ] **Step 7: Manual browser verification**

1. `npm run dev`.
2. Open `/signup`. Try to submit with a 7-character password. The HTML5 validation should block submission with "Please lengthen this text to 8 characters or more".
3. Open `/login`. Same check.
4. Open an invitation link, try to set a 7-char password. Block expected.

- [ ] **Step 8: Commit**

```bash
git add pages/LoginPage.tsx pages/SignupPage.tsx \
        supabase/functions/accept-invitation-signup/index.ts \
        supabase/config.toml context/AuthContext.tsx
git commit -m "$(cat <<'EOF'
fix(auth): align password minimum to 8 characters everywhere

Signup, Login, and the accept-invitation edge function accepted 6-char
passwords while Reset, Invite UI, and Profile required 8. Supabase
config.toml was at 6. Align all to 8 per security policy.

Dashboard: also raise Auth → Settings → minimum password length to 8
for the remote project (config.toml is local-dev only).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wrap AdminLayout + add root-level ErrorBoundary

**Background:** Every salon module has `<ErrorBoundary moduleName="...">` but `AdminLayout` does not. A crash in any admin screen = white page. Also: any render error in `AuthProvider` or `ToastProvider` or the router itself currently gives users a blank page. Add a top-level boundary.

**Files:**
- Modify: `App.tsx` (wrap AdminLayout, add root boundary)

- [ ] **Step 1: Update App.tsx**

Edit `App.tsx`. Change the `/admin` route block (currently lines 207-216) to wrap `<AdminLayout />` in an ErrorBoundary:

```tsx
{/* Admin routes — own layout, own guard, outside salon Layout */}
<Route path="/admin" element={
  <AdminRoute>
    <ErrorBoundary moduleName="Admin">
      <AdminLayout />
    </ErrorBoundary>
  </AdminRoute>
}>
  <Route index element={<AdminDashboard />} />
  <Route path="accounts" element={<AdminAccountList />} />
  <Route path="accounts/:id" element={<AdminAccountDetail />} />
  <Route path="trials" element={<AdminTrialsPipeline />} />
  <Route path="billing" element={<AdminFailedPayments />} />
  <Route path="signups" element={<AdminRecentSignups />} />
  <Route path="churn" element={<AdminChurnLog />} />
</Route>
```

Then wrap the entire `App()` return in a root-level ErrorBoundary. Change the final `return` of `App` (currently lines 190-230) to:

```tsx
export default function App() {
  return (
    <ErrorBoundary moduleName="Application">
      <MediaQueryProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

                {/* Auth-required, no-salon routes */}
                <Route path="/create-salon" element={<AuthRequired><CreateSalonPage /></AuthRequired>} />
                <Route path="/select-salon" element={<AuthRequired><SalonPickerPage /></AuthRequired>} />

                {/* Admin routes — own layout, own guard, outside salon Layout */}
                <Route path="/admin" element={
                  <AdminRoute>
                    <ErrorBoundary moduleName="Admin">
                      <AdminLayout />
                    </ErrorBoundary>
                  </AdminRoute>
                }>
                  <Route index element={<AdminDashboard />} />
                  <Route path="accounts" element={<AdminAccountList />} />
                  <Route path="accounts/:id" element={<AdminAccountDetail />} />
                  <Route path="trials" element={<AdminTrialsPipeline />} />
                  <Route path="billing" element={<AdminFailedPayments />} />
                  <Route path="signups" element={<AdminRecentSignups />} />
                  <Route path="churn" element={<AdminChurnLog />} />
                </Route>

                {/* Protected app routes */}
                <Route path="/*" element={
                  <ProtectedRoute>
                    <AppContent />
                  </ProtectedRoute>
                } />
              </Routes>
            </BrowserRouter>
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </MediaQueryProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Manual browser verification**

1. `npm run dev`.
2. In DevTools, temporarily add `throw new Error('boom')` inside `AdminDashboard` and navigate to `/admin`. Expect the ErrorBoundary fallback with "Réessayer" button, NOT a blank page. Remove the throw.
3. Same test in `AdminLayout` render. Expect fallback within AdminRoute, not a blank page.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "$(cat <<'EOF'
fix(errors): wrap AdminLayout + add root ErrorBoundary

AdminLayout had no error boundary — any admin screen crash was a white
page. Also, a render error in AuthProvider/ToastProvider/router gave
users a blank page with no recovery UI. Add boundaries at both layers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Repo Hardening

### Task 11: Enable branch protection, Dependabot, secret scanning

These are GitHub-level changes via `gh` CLI + a single committed file (`.github/dependabot.yml`).

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Enable branch protection on `main`**

```bash
gh api -X PUT repos/serendipian/Salon-Saas/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks=null' \
  -F 'enforce_admins=false' \
  -f 'required_pull_request_reviews[required_approving_review_count]=0' \
  -F 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -f 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false' \
  -F 'required_linear_history=true'
```

Expected: JSON response describing the new protection settings. No error.

This forbids force-push and deletion of `main`, requires PR flow (even self-approved with count=0), and enforces linear history. Once CI exists, raise the review count and add required status checks.

- [ ] **Step 2: Enable vulnerability alerts**

```bash
gh api -X PUT repos/serendipian/Salon-Saas/vulnerability-alerts \
  -H "Accept: application/vnd.github+json"
```

Expected: 204 No Content.

- [ ] **Step 3: Enable Dependabot automated security fixes**

```bash
gh api -X PUT repos/serendipian/Salon-Saas/automated-security-fixes \
  -H "Accept: application/vnd.github+json"
```

Expected: 204 No Content.

- [ ] **Step 4: Enable secret scanning + push protection**

```bash
gh api -X PATCH repos/serendipian/Salon-Saas \
  -H "Accept: application/vnd.github+json" \
  -F 'security_and_analysis[secret_scanning][status]=enabled' \
  -F 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
```

Expected: JSON with updated repo metadata.

- [ ] **Step 5: Add dependabot.yml for weekly updates**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Paris"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    commit-message:
      prefix: "chore"
      prefix-development: "chore"
      include: "scope"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Paris"
    labels:
      - "dependencies"
      - "github-actions"
    commit-message:
      prefix: "chore"
      include: "scope"
```

- [ ] **Step 6: Verify settings**

```bash
gh api repos/serendipian/Salon-Saas/branches/main/protection | jq '.allow_force_pushes, .allow_deletions, .required_linear_history'
# Expected: three booleans — false, false, true

gh api repos/serendipian/Salon-Saas | jq '.security_and_analysis.secret_scanning.status, .security_and_analysis.secret_scanning_push_protection.status'
# Expected: "enabled", "enabled"
```

- [ ] **Step 7: Commit dependabot.yml**

```bash
mkdir -p .github
git add .github/dependabot.yml
git commit -m "$(cat <<'EOF'
chore(security): enable branch protection, Dependabot, secret scanning

- Block force-push and deletion of main; require linear history.
- Enable vulnerability alerts + automated security fixes.
- Enable secret scanning + push protection (catches committed secrets
  before they reach the remote).
- Weekly Dependabot npm + github-actions updates, grouped minor/patch.

Follow-up (separate PR): add a minimum CI workflow so branch protection
can require green checks before merge.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Verification & Handoff

### Task 12: End-to-end smoke verification

Walk through the full affected surface as a real user before opening PRs.

- [ ] **Step 1: Salon quota smoke test**

In Supabase SQL editor, pick a test salon. Manually set `subscription_tier = 'premium'` and count current staff:

```sql
SELECT id, subscription_tier FROM salons WHERE name LIKE '%Test%' LIMIT 1;
-- note the id as <test_salon_id>, set tier:
UPDATE salons SET subscription_tier = 'premium' WHERE id = '<test_salon_id>';
SELECT COUNT(*) FROM staff_members WHERE salon_id = '<test_salon_id>' AND deleted_at IS NULL;
```

If count < 10, try inserting staff until 10, then one more — 11th should fail with `PLAN_LIMIT_EXCEEDED:staff_members.10`. Revert with `UPDATE salons SET subscription_tier = 'pro'` or original tier.

- [ ] **Step 2: expire-trials smoke test**

```bash
# Without header — expect 401
curl -i -X POST "https://izsycdmrwscdnxebptsx.supabase.co/functions/v1/expire-trials"
# With header — expect 200
curl -i -X POST -H "x-function-secret: $EXPIRE_TRIALS_SECRET" \
  "https://izsycdmrwscdnxebptsx.supabase.co/functions/v1/expire-trials"
```

- [ ] **Step 3: stripe-webhook idempotency smoke**

From Stripe Dashboard, resend any recent `checkout.session.completed`. Tail logs:

```bash
npx supabase functions logs stripe-webhook --linked --tail 50
```

Expect: `Duplicate Stripe event, skipping:` on the second delivery.

- [ ] **Step 4: Staff photo upload smoke**

As an owner/manager in the UI, navigate to Team → pick a staff member → upload a photo. It should persist and display. As a stylist/receptionist, same flow should 403 or be hidden.

- [ ] **Step 5: Password policy smoke**

Signup with 7 characters — browser blocks. Signup with 8 — proceeds.

- [ ] **Step 6: Error boundary smoke**

Temporarily throw in `AdminDashboard` render. Open `/admin`. Expect fallback card with "Réessayer" button. Revert.

- [ ] **Step 7: Branch protection smoke**

```bash
# Expect: "protected branch hook declined"
git push origin main --force-with-lease 2>&1 | head -5
```

(Only try if you have a throwaway commit on main; don't actually force-push.)

- [ ] **Step 8: Open PRs**

Create one PR per phase for clean review history:

```bash
# Phase 1 – DB
git push origin fix/critical-remediation-2026-04-15
gh pr create --base main --head fix/critical-remediation-2026-04-15 \
  --title "fix: critical remediation — phase 1 DB + phase 2 edge fns + phase 3 UI + phase 4 repo" \
  --body "Implements docs/superpowers/plans/2026-04-15-critical-remediation.md.

Closes audit findings CRIT-1, CRIT-2, CRIT-3, CRIT-6, CRIT-7, CRIT-8
plus H1 (password policy), H5 (invitation password), and repo hardening.

Migrations:
- 20260415100000_fix_premium_plan_limits.sql
- 20260415101000_revoke_pii_crypto_from_public.sql
- 20260415102000_pin_search_path_on_all_security_definer.sql
- 20260415103000_fix_staff_photo_storage_rls.sql
- 20260415104000_processed_stripe_events.sql

Edge functions deployed: expire-trials, stripe-webhook, accept-invitation-signup.

Repo hardening applied via gh CLI: branch protection on main, Dependabot,
secret scanning + push protection."
```

- [ ] **Step 9: Update memory note for project status**

After merge, record the remediation via memory (or as a task for next session). Out of scope for this plan.

---

## Rollback Strategy

Each phase is independently revertible:

- **Phase 1 (DB):** migrations are additive. To roll back the CASE fix, create a new migration that restores the old CASE. To roll back the REVOKE, create a migration with matching GRANT statements. `search_path` pin is harmless; no rollback needed.
- **Phase 2 (Edge fns):** redeploy the previous version with `git checkout <prev-sha> -- supabase/functions/<fn>/index.ts && npx supabase functions deploy <fn> ...`.
- **Phase 3 (Frontend):** `git revert` the password + ErrorBoundary commit.
- **Phase 4 (Repo):** disable via GitHub UI or inverse `gh api` calls.

---

## Self-Review Notes

- **Coverage:** Every Critical from the 2026-04-15 audit is addressed: CRIT-1 (plan limits) ✔, CRIT-2 (expire-trials) ✔, CRIT-3 (webhook idempotency) ✔, CRIT-6 (REVOKE PII) ✔, CRIT-7 (staff storage RLS) ✔, CRIT-8 (search_path) ✔. CRIT-4 (no tests/CI/observability) and CRIT-5 (cross-tenant FK integrity) are **intentionally deferred** to separate Week-2 and Month-1 plans — they are multi-day investments that don't fit this "stop the bleeding" plan.
- **Placeholder scan:** No `TODO`, no `TBD`, no "add appropriate X". Every code block is directly executable.
- **Type consistency:** `user_salon_ids_with_role` signature verified as `text[]` against `supabase/migrations/20260328120000_rls_membership_based.sql:24`. `encrypt_pii(text)` / `decrypt_pii(bytea)` verified against `supabase/migrations/20260405150001_encryption_key_from_vault.sql:4,22`. `ErrorBoundary moduleName` prop verified against existing usages in `App.tsx`.
- **Test framework absence:** Explicitly acknowledged in the header. Verification uses SQL assertions, curl probes, and manual browser checks — pragmatic given current project state. Vitest setup belongs in the Week-2 foundations plan.
- **Deploy order:** Phase 1 migrations MUST complete before Phase 2 edge functions (webhook references the new `processed_stripe_events` table). Phases 3 and 4 are independent and can be parallelized.

---

## Out-of-Scope (deferred to follow-up plans)

Explicitly not included so the plan stays focused and shippable in a week:

- Full test suite bootstrap (Vitest + Playwright + CI) — **Week-2 foundations plan**.
- `"strict": true` in tsconfig — **Week-2 foundations plan**.
- Sentry/observability wiring — **Week-2 foundations plan**.
- CSP + HSTS headers in vercel.json — **Week-2 foundations plan**.
- Composite `(salon_id, id)` FK integrity migration (~18 FKs) — **Month-1 scalability plan**.
- Making `avatars` / `logos` buckets private — **Month-1 scalability plan**.
- Code-splitting + virtualization + optimistic updates — **Month-1 UX/perf plan**.
- Timezone-correct date handling — **Month-1 scalability plan**.
- i18n wiring for Arabic — **Quarter-1 polish plan**.

---

**Total estimated effort:** 6-8 hours for a senior engineer working straight through, including verification and PR review time. Parallelizing Phases 3 + 4 with Phase 1 verification trims this to ~5 hours elapsed.
