ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.exam_is_open(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT finalized_at IS NULL FROM public.exams WHERE id = _exam_id), false)
$$;

DROP POLICY IF EXISTS exam_results_add ON public.exam_results;
CREATE POLICY exam_results_add ON public.exam_results
  FOR INSERT TO authenticated
  WITH CHECK (can('examinations','add') AND public.exam_is_open(exam_id));

DROP POLICY IF EXISTS exam_results_edit ON public.exam_results;
CREATE POLICY exam_results_edit ON public.exam_results
  FOR UPDATE TO authenticated
  USING (can('examinations','edit') AND public.exam_is_open(exam_id))
  WITH CHECK (can('examinations','edit') AND public.exam_is_open(exam_id));