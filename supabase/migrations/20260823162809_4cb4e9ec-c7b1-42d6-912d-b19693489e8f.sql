-- 1. classes lookup
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY classes_select ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY classes_admin_all ON public.classes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.classes (name) VALUES ('Grade 11'), ('Grade 12');

-- 2. students.class_id
ALTER TABLE public.students ADD COLUMN class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

-- 3. leave status
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'leave';

-- 4. lecture number
ALTER TABLE public.attendance_records ADD COLUMN lecture_number integer NOT NULL DEFAULT 1;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.attendance_records'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.attendance_records DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.attendance_records_student_id_date_key;
DROP INDEX IF EXISTS public.attendance_student_date_idx;

CREATE UNIQUE INDEX attendance_student_date_lecture_key
  ON public.attendance_records (student_id, date, lecture_number);