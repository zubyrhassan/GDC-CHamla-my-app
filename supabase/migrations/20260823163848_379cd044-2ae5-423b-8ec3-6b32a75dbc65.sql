CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  total_marks numeric NOT NULL DEFAULT 100,
  exam_date date NOT NULL DEFAULT CURRENT_DATE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY exams_select ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY exams_admin_all ON public.exams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained numeric NOT NULL DEFAULT 0,
  remarks text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_results TO authenticated;
GRANT ALL ON public.exam_results TO service_role;

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_results_select ON public.exam_results FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_results_admin_all ON public.exam_results FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER update_exam_results_updated_at BEFORE UPDATE ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX exam_results_exam_id_idx ON public.exam_results(exam_id);