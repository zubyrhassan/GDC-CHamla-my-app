CREATE POLICY "student_photos_read_staff"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'student-photos');

CREATE POLICY "student_photos_insert_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-photos' AND public.is_admin());

CREATE POLICY "student_photos_update_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'student-photos' AND public.is_admin())
WITH CHECK (bucket_id = 'student-photos' AND public.is_admin());

CREATE POLICY "student_photos_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'student-photos' AND public.is_admin());