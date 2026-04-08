# Security Notes

## Secrets in Source Control

### PII Encryption Key (RESOLVED — 2026-04-08)

**Status:** Rotated and secured. The old hardcoded key has been redacted from source control and can no longer decrypt any data.

**What was done:**
1. Migrated `encrypt_pii`/`decrypt_pii` to read from Supabase Vault (`vault.secrets`, name = `pii_encryption_key`) — see migration `20260405150001`
2. Generated a new 256-bit key and re-encrypted all 30 staff PII records in a single transaction
3. Updated Vault secret to the new key via `vault.update_secret()`
4. Verified decryption works end-to-end; confirmed old key returns "Wrong key or corrupt data"
5. Redacted the old key from `supabase/migrations/20260331000001_fix_encryption_key.sql`

**Current state:** The encryption key exists only in Supabase Vault (server-side, not in source control). The `encrypt_pii`/`decrypt_pii` SECURITY DEFINER functions read from `vault.decrypted_secrets` at runtime. All 33 PII records (30 active + 3 archived staff) verified decrypting correctly.

**Residual risk — git history:** The old key remains in git history (commits before `0654111`). Since the key was rotated, it cannot decrypt current data. However, any **Supabase database backup taken before 2026-04-08** could still be decrypted with the old key. If such backups are retained, treat them as sensitive. To fully purge the key from history, use `git filter-repo` or BFG Repo Cleaner followed by a force-push (optional — the key is now useless against live data).

### expire-trials Secret (RESOLVED)

**Status:** Redacted from source control. Secret lives in Edge Function env and pg_cron schedule (already applied to remote DB).

If the repo was ever pushed publicly while the secret was in the migration file, rotate it:
```bash
openssl rand -hex 32
supabase secrets set EXPIRE_TRIALS_SECRET=<new-value>
# Update pg_cron via Dashboard SQL editor
```

### Supabase Anon Key

**File:** `.env.local` (gitignored)
**Risk:** None — anon keys are designed to be public. RLS enforces all access control.

### Supabase Project URL

**Files:** Various migration files reference `izsycdmrwscdnxebptsx.supabase.co`
**Risk:** Low — the project URL is semi-public (visible in browser network tab). Security relies on RLS and auth, not URL obscurity.
