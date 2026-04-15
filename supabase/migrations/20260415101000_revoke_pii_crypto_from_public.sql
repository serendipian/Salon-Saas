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
