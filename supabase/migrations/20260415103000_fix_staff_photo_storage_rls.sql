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
