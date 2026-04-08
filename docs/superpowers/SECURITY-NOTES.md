# Security Notes

## Secrets in Source Control

### PII Encryption Key (PRE-EXISTING — HIGH RISK)

**File:** `supabase/migrations/20260331000001_fix_encryption_key.sql`
**Key:** `da3686450139467da7f145d3d038234bbf1242e27a1ea96d769ba8e443138b04`

This is the pgcrypto symmetric key used to encrypt/decrypt staff PII (salary, IBAN, SSN). It is hardcoded as a fallback in the `encrypt_pii` and `decrypt_pii` SQL functions.

**Why it's there:** Supabase doesn't grant superuser access, so `ALTER DATABASE SET "app.encryption_key"` isn't available. The key was embedded directly as a fallback in SECURITY DEFINER functions.

**Risk:** Anyone with read access to this repository can decrypt all staff PII stored in the database.

**Recommended fix (future session):**
1. Use Supabase Vault (`vault.secrets`) to store the key — accessible from SQL but not in source control
2. Update `encrypt_pii`/`decrypt_pii` to read from Vault instead of hardcoded fallback
3. Rotate the key and re-encrypt all existing PII data
4. Redact the key from the migration file (it's already applied)

This requires careful planning since re-encryption affects all existing PII data. Do NOT attempt without a backup.

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
