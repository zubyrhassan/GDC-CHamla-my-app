ALTER TABLE public.exam_results DROP CONSTRAINT exam_results_exam_id_student_id_key;

CREATE UNIQUE INDEX exam_results_exam_student_paper_key
  ON public.exam_results (exam_id, student_id, exam_subject_id) NULLS NOT DISTINCT;