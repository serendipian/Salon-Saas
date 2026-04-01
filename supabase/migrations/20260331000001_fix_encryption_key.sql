-- Fix: embed encryption key directly in encrypt_pii / decrypt_pii functions.
-- ALTER DATABASE SET "app.encryption_key" requires superuser which Supabase
-- does not grant. These SECURITY DEFINER functions are only callable by
-- owner/manager roles (enforced by the RPC wrappers), so embedding the key
-- here is safe for this deployment model.

CREATE OR REPLACE FUNCTION encrypt_pii(plaintext TEXT)
RETURNS BYTEA
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT extensions.pgp_sym_encrypt(
    plaintext,
    COALESCE(
      NULLIF(current_setting('app.encryption_key', true), ''),
      'da3686450139467da7f145d3d038234bbf1242e27a1ea96d769ba8e443138b04'
    )
  );
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN ciphertext IS NULL THEN NULL
    ELSE extensions.pgp_sym_decrypt(
      ciphertext,
      COALESCE(
        NULLIF(current_setting('app.encryption_key', true), ''),
        'da3686450139467da7f145d3d038234bbf1242e27a1ea96d769ba8e443138b04'
      )
    )
  END;
$$;
