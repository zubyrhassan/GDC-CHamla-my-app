-- 1. New role values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coe';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'clerk';

-- 2. Role default permissions
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON public.permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Per-person overrides
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean,
  can_add boolean,
  can_edit boolean,
  can_delete boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_permission_overrides_updated_at BEFORE UPDATE ON public.user_permission_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Super admin helper (legacy 'admin' keeps full power)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text IN ('super_admin', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text IN ('super_admin', 'admin')
  )
$$;

-- 5. Permission resolution: override first, then role default
CREATE OR REPLACE FUNCTION public.get_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_val boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  SELECT role::text INTO v_role FROM public.profiles WHERE id = _user_id;
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role IN ('super_admin', 'admin') THEN RETURN true; END IF;

  SELECT CASE _action
           WHEN 'view' THEN can_view
           WHEN 'add' THEN can_add
           WHEN 'edit' THEN can_edit
           WHEN 'delete' THEN can_delete
         END
    INTO v_val
  FROM public.user_permission_overrides
  WHERE profile_id = _user_id AND module = _module;

  IF v_val IS NOT NULL THEN RETURN v_val; END IF;

  SELECT CASE _action
           WHEN 'view' THEN can_view
           WHEN 'add' THEN can_add
           WHEN 'edit' THEN can_edit
           WHEN 'delete' THEN can_delete
         END
    INTO v_val
  FROM public.permissions
  WHERE role = v_role AND module = _module;

  RETURN COALESCE(v_val, false);
END; $$;

CREATE OR REPLACE FUNCTION public.can(_module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_permission(auth.uid(), _module, _action)
$$;

-- 6. Policies on the permission tables themselves
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_super_admin_write ON public.permissions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY overrides_select ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_super_admin());
CREATE POLICY overrides_super_admin_write ON public.user_permission_overrides FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 7. Seed role defaults
INSERT INTO public.permissions (role, module, can_view, can_add, can_edit, can_delete) VALUES
  ('super_admin','students',true,true,true,true),
  ('super_admin','attendance',true,true,true,true),
  ('super_admin','examinations',true,true,true,true),
  ('super_admin','fees',true,true,true,true),
  ('super_admin','struck_off',true,true,true,true),
  ('super_admin','settings',true,true,true,true),
  ('super_admin','reports',true,true,true,true),

  ('principal','students',true,false,false,false),
  ('principal','attendance',true,false,false,false),
  ('principal','examinations',true,false,false,false),
  ('principal','fees',true,false,false,false),
  ('principal','struck_off',true,false,false,false),
  ('principal','settings',false,false,false,false),
  ('principal','reports',true,false,false,false),

  ('coe','students',true,false,false,false),
  ('coe','attendance',true,false,false,false),
  ('coe','examinations',true,true,true,true),
  ('coe','fees',false,false,false,false),
  ('coe','struck_off',true,false,false,false),
  ('coe','settings',false,false,false,false),
  ('coe','reports',true,false,false,false),

  ('coordinator','students',true,true,true,false),
  ('coordinator','attendance',true,true,true,false),
  ('coordinator','examinations',true,false,false,false),
  ('coordinator','fees',false,false,false,false),
  ('coordinator','struck_off',true,false,false,false),
  ('coordinator','settings',false,false,false,false),
  ('coordinator','reports',true,false,false,false),

  ('clerk','students',true,true,true,false),
  ('clerk','attendance',true,true,true,false),
  ('clerk','examinations',true,false,false,false),
  ('clerk','fees',true,true,true,false),
  ('clerk','struck_off',true,false,false,false),
  ('clerk','settings',false,false,false,false),
  ('clerk','reports',true,false,false,false),

  ('teacher','students',true,false,false,false),
  ('teacher','attendance',true,true,true,false),
  ('teacher','examinations',true,false,false,false),
  ('teacher','fees',false,false,false,false),
  ('teacher','struck_off',false,false,false,false),
  ('teacher','settings',false,false,false,false),
  ('teacher','reports',false,false,false,false);

-- 8. Rebuild data policies on permission checks
DROP POLICY IF EXISTS students_admin_all ON public.students;
DROP POLICY IF EXISTS students_select ON public.students;
CREATE POLICY students_view ON public.students FOR SELECT TO authenticated USING (public.can('students','view'));
CREATE POLICY students_add ON public.students FOR INSERT TO authenticated WITH CHECK (public.can('students','add'));
CREATE POLICY students_edit ON public.students FOR UPDATE TO authenticated USING (public.can('students','edit')) WITH CHECK (public.can('students','edit'));
CREATE POLICY students_delete ON public.students FOR DELETE TO authenticated USING (public.can('students','delete'));

DROP POLICY IF EXISTS attendance_admin_all ON public.attendance_records;
DROP POLICY IF EXISTS attendance_select ON public.attendance_records;
DROP POLICY IF EXISTS attendance_teacher_insert ON public.attendance_records;
DROP POLICY IF EXISTS attendance_teacher_update ON public.attendance_records;
CREATE POLICY attendance_view ON public.attendance_records FOR SELECT TO authenticated USING (public.can('attendance','view'));
CREATE POLICY attendance_add ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    public.can('attendance','add')
    AND (public.is_admin() OR (date >= (CURRENT_DATE - 3) AND date <= CURRENT_DATE))
  );
CREATE POLICY attendance_edit ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.can('attendance','edit') AND (public.is_admin() OR date >= (CURRENT_DATE - 3)))
  WITH CHECK (
    public.can('attendance','edit')
    AND (public.is_admin() OR (date >= (CURRENT_DATE - 3) AND date <= CURRENT_DATE))
  );
CREATE POLICY attendance_delete ON public.attendance_records FOR DELETE TO authenticated USING (public.can('attendance','delete'));

DROP POLICY IF EXISTS exams_admin_all ON public.exams;
DROP POLICY IF EXISTS exams_select ON public.exams;
CREATE POLICY exams_view ON public.exams FOR SELECT TO authenticated USING (public.can('examinations','view'));
CREATE POLICY exams_add ON public.exams FOR INSERT TO authenticated WITH CHECK (public.can('examinations','add'));
CREATE POLICY exams_edit ON public.exams FOR UPDATE TO authenticated USING (public.can('examinations','edit')) WITH CHECK (public.can('examinations','edit'));
CREATE POLICY exams_delete ON public.exams FOR DELETE TO authenticated USING (public.can('examinations','delete'));

DROP POLICY IF EXISTS exam_results_admin_all ON public.exam_results;
DROP POLICY IF EXISTS exam_results_select ON public.exam_results;
CREATE POLICY exam_results_view ON public.exam_results FOR SELECT TO authenticated USING (public.can('examinations','view'));
CREATE POLICY exam_results_add ON public.exam_results FOR INSERT TO authenticated WITH CHECK (public.can('examinations','add'));
CREATE POLICY exam_results_edit ON public.exam_results FOR UPDATE TO authenticated USING (public.can('examinations','edit')) WITH CHECK (public.can('examinations','edit'));
CREATE POLICY exam_results_delete ON public.exam_results FOR DELETE TO authenticated USING (public.can('examinations','delete'));

DROP POLICY IF EXISTS fee_transactions_admin_all ON public.fee_transactions;
CREATE POLICY fee_transactions_view ON public.fee_transactions FOR SELECT TO authenticated USING (public.can('fees','view'));
CREATE POLICY fee_transactions_add ON public.fee_transactions FOR INSERT TO authenticated WITH CHECK (public.can('fees','add'));
CREATE POLICY fee_transactions_edit ON public.fee_transactions FOR UPDATE TO authenticated USING (public.can('fees','edit')) WITH CHECK (public.can('fees','edit'));
CREATE POLICY fee_transactions_delete ON public.fee_transactions FOR DELETE TO authenticated USING (public.can('fees','delete'));

DROP POLICY IF EXISTS fee_charges_admin_all ON public.fee_charges;
CREATE POLICY fee_charges_view ON public.fee_charges FOR SELECT TO authenticated USING (public.can('fees','view'));
CREATE POLICY fee_charges_add ON public.fee_charges FOR INSERT TO authenticated WITH CHECK (public.can('fees','add'));
CREATE POLICY fee_charges_edit ON public.fee_charges FOR UPDATE TO authenticated USING (public.can('fees','edit')) WITH CHECK (public.can('fees','edit'));
CREATE POLICY fee_charges_delete ON public.fee_charges FOR DELETE TO authenticated USING (public.can('fees','delete'));

DROP POLICY IF EXISTS struck_off_admin_all ON public.struck_off_events;
CREATE POLICY struck_off_view ON public.struck_off_events FOR SELECT TO authenticated USING (public.can('struck_off','view'));
CREATE POLICY struck_off_add ON public.struck_off_events FOR INSERT TO authenticated WITH CHECK (public.can('struck_off','add'));
CREATE POLICY struck_off_edit ON public.struck_off_events FOR UPDATE TO authenticated USING (public.can('struck_off','edit')) WITH CHECK (public.can('struck_off','edit'));
CREATE POLICY struck_off_delete ON public.struck_off_events FOR DELETE TO authenticated USING (public.can('struck_off','delete'));