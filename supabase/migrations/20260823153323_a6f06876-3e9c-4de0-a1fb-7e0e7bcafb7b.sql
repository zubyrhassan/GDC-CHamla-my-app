-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
CREATE TYPE public.program_type AS ENUM ('stream', 'ad_program');
CREATE TYPE public.student_status AS ENUM ('active', 'struck_off', 'graduated', 'left');
CREATE TYPE public.board_reg_status AS ENUM ('not_started', 'submitted', 'confirmed');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'teacher',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Prevent self role escalation
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_profile_role_trg BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Programs
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type public.program_type NOT NULL DEFAULT 'stream',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_select" ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "programs_admin_all" ON public.programs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.programs (name, type) VALUES
  ('Pre-Medical', 'stream'),
  ('Pre-Engineering', 'stream'),
  ('Arts & Humanities', 'stream'),
  ('Neuroscience', 'stream'),
  ('AD Computer Science', 'ad_program'),
  ('AD Urdu', 'ad_program');

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  father_name TEXT,
  cnic_bform TEXT,
  date_of_birth DATE,
  gender TEXT,
  photo_url TEXT,
  student_contact TEXT,
  guardian_contact TEXT,
  address TEXT,
  email TEXT,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  session TEXT,
  section TEXT,
  status public.student_status NOT NULL DEFAULT 'active',
  admission_date DATE DEFAULT CURRENT_DATE,
  board_registration_number TEXT,
  board_registration_status public.board_reg_status NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_select" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "students_admin_all" ON public.students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Attendance
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL,
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_admin_all" ON public.attendance_records FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "attendance_teacher_insert" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND date >= CURRENT_DATE - 3 AND date <= CURRENT_DATE);
CREATE POLICY "attendance_teacher_update" ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') AND date >= CURRENT_DATE - 3)
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND date >= CURRENT_DATE - 3 AND date <= CURRENT_DATE);

-- Fee types
CREATE TABLE public.fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_types TO authenticated;
GRANT ALL ON public.fee_types TO service_role;
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_types_select" ON public.fee_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_types_admin_all" ON public.fee_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Fee transactions
CREATE SEQUENCE public.receipt_number_seq START 1000;
CREATE TABLE public.fee_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_number TEXT NOT NULL UNIQUE DEFAULT ('RCPT-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0')),
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_transactions TO authenticated;
GRANT ALL ON public.fee_transactions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.receipt_number_seq TO authenticated, service_role;
ALTER TABLE public.fee_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_transactions_admin_all" ON public.fee_transactions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Struck off events
CREATE TABLE public.struck_off_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  struck_off_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL DEFAULT 'manual',
  consecutive_absences_at_time INTEGER,
  reinstated BOOLEAN NOT NULL DEFAULT false,
  reinstated_date DATE,
  readmission_fee_transaction_id UUID REFERENCES public.fee_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.struck_off_events TO authenticated;
GRANT ALL ON public.struck_off_events TO service_role;
ALTER TABLE public.struck_off_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "struck_off_admin_all" ON public.struck_off_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_students_program ON public.students(program_id);
CREATE INDEX idx_attendance_date ON public.attendance_records(date);
CREATE INDEX idx_fee_tx_student ON public.fee_transactions(student_id);