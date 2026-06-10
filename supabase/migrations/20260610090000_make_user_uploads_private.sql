-- Make the user-uploads bucket private. Files are served through the
-- auth-checked proxy route at /api/files/[...path], which validates chat
-- ownership/visibility and redirects to a short-lived signed URL.
UPDATE storage.buckets SET public = false WHERE id = 'user-uploads';

DROP POLICY IF EXISTS "public_read_user_uploads" ON storage.objects;

-- Authenticated users may read their own files directly.
CREATE POLICY "users_select_own_files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
