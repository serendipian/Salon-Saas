-- Use Supabase Vault for PII encryption key instead of app.encryption_key
-- The key is stored as vault secret named 'pii_encryption_key'

CREATE OR REPLACE FUNCTION encrypt_pii(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'pii_encryption_key not found in vault — cannot encrypt PII';
  END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'pii_encryption_key not found in vault — cannot decrypt PII';
  END IF;
  RETURN extensions.pgp_sym_decrypt(ciphertext, v_key);
END;
$$;
