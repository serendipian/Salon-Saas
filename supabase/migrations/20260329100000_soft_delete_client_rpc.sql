-- RPC function for soft-deleting clients.
-- Uses SECURITY DEFINER to bypass RLS, with its own permission check.
CREATE OR REPLACE FUNCTION soft_delete_client(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Get client's salon
  SELECT salon_id INTO v_salon_id
  FROM clients WHERE id = p_client_id AND deleted_at IS NULL;

  IF v_salon_id IS NULL THEN
    RAISE EXCEPTION 'Client introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- Permission check: owner, manager, or receptionist
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_salon_id
      AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'receptionist')
      AND status = 'active'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE = '42501';
  END IF;

  -- Soft delete
  UPDATE clients
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_client_id AND deleted_at IS NULL;
END;
$$;
