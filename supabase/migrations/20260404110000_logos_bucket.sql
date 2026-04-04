-- Create logos storage bucket for salon logo uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS policies for logos bucket

-- Anyone can view logos (public bucket)
CREATE POLICY "Public logo read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Owner/manager can upload logos for their salon
CREATE POLICY "Owner/manager can upload salon logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT sm.salon_id::text
    FROM salon_memberships sm
    WHERE sm.profile_id = auth.uid()
      AND sm.role IN ('owner', 'manager')
      AND sm.status = 'active'
      AND sm.deleted_at IS NULL
  )
);

-- Owner/manager can update (overwrite) logos for their salon
CREATE POLICY "Owner/manager can update salon logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT sm.salon_id::text
    FROM salon_memberships sm
    WHERE sm.profile_id = auth.uid()
      AND sm.role IN ('owner', 'manager')
      AND sm.status = 'active'
      AND sm.deleted_at IS NULL
  )
);

-- Owner/manager can delete logos for their salon
CREATE POLICY "Owner/manager can delete salon logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT sm.salon_id::text
    FROM salon_memberships sm
    WHERE sm.profile_id = auth.uid()
      AND sm.role IN ('owner', 'manager')
      AND sm.status = 'active'
      AND sm.deleted_at IS NULL
  )
);
