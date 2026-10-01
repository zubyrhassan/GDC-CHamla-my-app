CREATE POLICY college_assets_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'college-assets');

CREATE POLICY college_assets_admin_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'college-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'college-assets' AND public.is_admin());