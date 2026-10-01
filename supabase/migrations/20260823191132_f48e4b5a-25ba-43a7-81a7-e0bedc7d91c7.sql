CREATE TABLE public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, program_id, class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_classes TO authenticated;
GRANT ALL ON public.teacher_classes TO service_role;

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_classes_select ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY teacher_classes_insert ON public.teacher_classes
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY teacher_classes_update ON public.teacher_classes
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin())
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY teacher_classes_delete ON public.teacher_classes
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());