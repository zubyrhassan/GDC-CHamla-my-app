
INSERT INTO public.permissions (role, module, can_view, can_add, can_edit, can_delete) VALUES
  ('super_admin','website',true,true,true,true),
  ('principal','website',true,true,true,true),
  ('coordinator','website',true,true,true,false),
  ('coe','website',true,false,false,false),
  ('clerk','website',true,false,false,false),
  ('teacher','website',false,false,false,false)
ON CONFLICT DO NOTHING;

CREATE TABLE public.site_settings (
  id text PRIMARY KEY DEFAULT 'main',
  college_name text NOT NULL DEFAULT 'Government Degree College Chamla',
  logo_url text,
  whatsapp_number text,
  whatsapp_default_message text DEFAULT 'Assalam-o-Alaikum, I would like to know about admissions at GDC Chamla.',
  facebook_page_url text NOT NULL DEFAULT 'https://www.facebook.com/gdcchamlabuner',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_single_row CHECK (id = 'main')
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_settings_read ON public.site_settings FOR SELECT USING (true);
CREATE POLICY site_settings_write ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.can('website','add'));
CREATE POLICY site_settings_update ON public.site_settings FOR UPDATE TO authenticated USING (public.can('website','edit')) WITH CHECK (public.can('website','edit'));
INSERT INTO public.site_settings (id) VALUES ('main');
CREATE TRIGGER site_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.site_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  subtitle text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_banners TO authenticated;
GRANT ALL ON public.site_banners TO service_role;
ALTER TABLE public.site_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_banners_read ON public.site_banners FOR SELECT USING (true);
CREATE POLICY site_banners_add ON public.site_banners FOR INSERT TO authenticated WITH CHECK (public.can('website','add'));
CREATE POLICY site_banners_edit ON public.site_banners FOR UPDATE TO authenticated USING (public.can('website','edit')) WITH CHECK (public.can('website','edit'));
CREATE POLICY site_banners_delete ON public.site_banners FOR DELETE TO authenticated USING (public.can('website','delete'));
CREATE TRIGGER site_banners_updated BEFORE UPDATE ON public.site_banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campus_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campus_gallery TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campus_gallery TO authenticated;
GRANT ALL ON public.campus_gallery TO service_role;
ALTER TABLE public.campus_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY campus_gallery_read ON public.campus_gallery FOR SELECT USING (true);
CREATE POLICY campus_gallery_add ON public.campus_gallery FOR INSERT TO authenticated WITH CHECK (public.can('website','add'));
CREATE POLICY campus_gallery_edit ON public.campus_gallery FOR UPDATE TO authenticated USING (public.can('website','edit')) WITH CHECK (public.can('website','edit'));
CREATE POLICY campus_gallery_delete ON public.campus_gallery FOR DELETE TO authenticated USING (public.can('website','delete'));
CREATE TRIGGER campus_gallery_updated BEFORE UPDATE ON public.campus_gallery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.faculty_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  designation text,
  department text,
  photo_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faculty_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faculty_members TO authenticated;
GRANT ALL ON public.faculty_members TO service_role;
ALTER TABLE public.faculty_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY faculty_read ON public.faculty_members FOR SELECT USING (true);
CREATE POLICY faculty_add ON public.faculty_members FOR INSERT TO authenticated WITH CHECK (public.can('website','add'));
CREATE POLICY faculty_edit ON public.faculty_members FOR UPDATE TO authenticated USING (public.can('website','edit')) WITH CHECK (public.can('website','edit'));
CREATE POLICY faculty_delete ON public.faculty_members FOR DELETE TO authenticated USING (public.can('website','delete'));
CREATE TRIGGER faculty_members_updated BEFORE UPDATE ON public.faculty_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admission_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  application_deadline date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admission_announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_announcements TO authenticated;
GRANT ALL ON public.admission_announcements TO service_role;
ALTER TABLE public.admission_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY admissions_read ON public.admission_announcements FOR SELECT USING (true);
CREATE POLICY admissions_add ON public.admission_announcements FOR INSERT TO authenticated WITH CHECK (public.can('website','add'));
CREATE POLICY admissions_edit ON public.admission_announcements FOR UPDATE TO authenticated USING (public.can('website','edit')) WITH CHECK (public.can('website','edit'));
CREATE POLICY admissions_delete ON public.admission_announcements FOR DELETE TO authenticated USING (public.can('website','delete'));
CREATE TRIGGER admission_announcements_updated BEFORE UPDATE ON public.admission_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY site_media_public_read ON storage.objects FOR SELECT USING (bucket_id = 'site-media');
CREATE POLICY site_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.can('website','add'));
CREATE POLICY site_media_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-media' AND public.can('website','edit')) WITH CHECK (bucket_id = 'site-media' AND public.can('website','edit'));
CREATE POLICY site_media_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-media' AND public.can('website','delete'));
