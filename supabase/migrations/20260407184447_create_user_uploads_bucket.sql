-- Create the user-uploads storage bucket
-- Public = true so getPublicUrl() works for serving files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5 MB (matches MAX_UPLOAD_SIZE_BYTES)
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated users can upload files to their own directory
CREATE POLICY "users_insert_own_files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: anyone can read files (bucket is public)
CREATE POLICY "public_read_user_uploads"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'user-uploads');

-- Policy: users can update their own files
CREATE POLICY "users_update_own_files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can delete their own files
CREATE POLICY "users_delete_own_files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
