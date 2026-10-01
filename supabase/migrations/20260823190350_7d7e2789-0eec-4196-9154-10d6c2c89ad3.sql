-- 1. Attendance uniqueness: one mark per student, per date, per lecture.
DELETE FROM public.attendance_records a
USING public.attendance_records b
WHERE a.ctid < b.ctid
  AND a.student_id = b.student_id
  AND a.date = b.date
  AND a.lecture_number = b.lecture_number;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_date_lecture_key
  ON public.attendance_records (student_id, date, lecture_number);

-- 2. Semester classes for every Associate Degree program.
INSERT INTO public.classes (name, program_id, semester_number, session, active)
SELECT 'Semester ' || s.n || ' (' || t.session || ')', p.id, s.n, t.session, true
FROM public.programs p
CROSS JOIN (VALUES (1), (2), (3), (4)) AS s(n)
CROSS JOIN (VALUES ('Spring'), ('Fall')) AS t(session)
WHERE p.type = 'ad_program'
  AND NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.program_id = p.id AND c.semester_number = s.n AND c.session = t.session
  );