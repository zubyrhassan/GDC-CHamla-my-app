ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS semester_number integer,
  ADD COLUMN IF NOT EXISTS session text;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_semester_number_check CHECK (semester_number IS NULL OR (semester_number BETWEEN 1 AND 4)),
  ADD CONSTRAINT classes_session_check CHECK (session IS NULL OR session IN ('Spring','Fall'));

CREATE UNIQUE INDEX IF NOT EXISTS classes_program_name_unique ON public.classes (program_id, lower(name));