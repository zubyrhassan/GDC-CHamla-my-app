-- 1. Portal accounts -------------------------------------------------------
CREATE TABLE public.student_portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  login_id text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('student','parent')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_portal_accounts TO authenticated;
GRANT ALL ON public.student_portal_accounts TO service_role;
ALTER TABLE public.student_portal_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_student_portal_accounts_updated_at
BEFORE UPDATE ON public.student_portal_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.portal_student_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT student_id FROM public.student_portal_accounts WHERE user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.portal_student_id() TO authenticated;

CREATE POLICY "Staff view portal accounts" ON public.student_portal_accounts
FOR SELECT TO authenticated USING (public.can('students','view'));
CREATE POLICY "Staff create portal accounts" ON public.student_portal_accounts
FOR INSERT TO authenticated WITH CHECK (public.can('students','add'));
CREATE POLICY "Staff update portal accounts" ON public.student_portal_accounts
FOR UPDATE TO authenticated USING (public.can('students','edit'));
CREATE POLICY "Staff delete portal accounts" ON public.student_portal_accounts
FOR DELETE TO authenticated USING (public.can('students','delete'));
CREATE POLICY "Portal user reads own account" ON public.student_portal_accounts
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. Do not create staff profiles for portal signups ------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'portal', '') IN ('student', 'parent') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'admin'::public.app_role ELSE 'teacher'::public.app_role END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- 3. Read-only portal policies ---------------------------------------------
CREATE POLICY "Portal reads own student" ON public.students
FOR SELECT TO authenticated USING (id = public.portal_student_id());

CREATE POLICY "Portal reads own attendance" ON public.attendance_records
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own fines" ON public.absentee_fines
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own dues" ON public.fee_dues
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own payments" ON public.fee_transactions
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own results" ON public.exam_results
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own strikes" ON public.struck_off_events
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own allotment" ON public.hostel_allotments
FOR SELECT TO authenticated USING (student_id = public.portal_student_id());

CREATE POLICY "Portal reads own hostel fees" ON public.hostel_fee_transactions
FOR SELECT TO authenticated USING (
  allotment_id IN (SELECT id FROM public.hostel_allotments WHERE student_id = public.portal_student_id())
);

CREATE POLICY "Portal reads programs" ON public.programs
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads classes" ON public.classes
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads fee types" ON public.fee_types
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads exams" ON public.exams
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads hostel rooms" ON public.hostel_rooms
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads timetable" ON public.class_timetable
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads settings" ON public.app_settings
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);
CREATE POLICY "Portal reads staff names" ON public.profiles
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);

-- 4. Multi-subject exams ----------------------------------------------------
CREATE TABLE public.exam_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_marks numeric NOT NULL DEFAULT 100,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subjects TO authenticated;
GRANT ALL ON public.exam_subjects TO service_role;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_exam_subjects_updated_at
BEFORE UPDATE ON public.exam_subjects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff view exam subjects" ON public.exam_subjects
FOR SELECT TO authenticated USING (public.can('examinations','view'));
CREATE POLICY "Staff add exam subjects" ON public.exam_subjects
FOR INSERT TO authenticated WITH CHECK (public.can('examinations','add') AND public.exam_is_open(exam_id));
CREATE POLICY "Staff edit exam subjects" ON public.exam_subjects
FOR UPDATE TO authenticated USING (public.can('examinations','edit') AND public.exam_is_open(exam_id));
CREATE POLICY "Staff delete exam subjects" ON public.exam_subjects
FOR DELETE TO authenticated USING (public.can('examinations','delete') AND public.exam_is_open(exam_id));
CREATE POLICY "Portal reads exam subjects" ON public.exam_subjects
FOR SELECT TO authenticated USING (public.portal_student_id() IS NOT NULL);

ALTER TABLE public.exam_results
  ADD COLUMN exam_subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE CASCADE;

CREATE INDEX idx_exam_results_subject ON public.exam_results(exam_subject_id);
CREATE INDEX idx_exam_subjects_exam ON public.exam_subjects(exam_id);