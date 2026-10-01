CREATE OR REPLACE FUNCTION public.save_attendance(
  _student_ids uuid[],
  _date date,
  _status public.attendance_status,
  _lecture_number integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _student_ids IS NULL OR cardinality(_student_ids) = 0 THEN
    RETURN;
  END IF;

  IF _lecture_number < 1 THEN
    RAISE EXCEPTION 'Lecture number must be at least 1';
  END IF;

  IF NOT public.can('attendance', 'add') AND NOT public.can('attendance', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to mark attendance';
  END IF;

  IF NOT public.is_admin() AND (_date < CURRENT_DATE - 3 OR _date > CURRENT_DATE + 1) THEN
    RAISE EXCEPTION 'Teachers can only mark attendance for today or the last 3 days';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    WHERE ar.student_id = ANY(_student_ids)
      AND ar.date = _date
      AND ar.lecture_number = _lecture_number
  ) AND NOT public.can('attendance', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to edit attendance';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_student_ids) AS requested(student_id)
    LEFT JOIN public.students s ON s.id = requested.student_id
    WHERE s.id IS NULL OR s.status IS DISTINCT FROM 'active'
  ) THEN
    RAISE EXCEPTION 'Attendance can only be marked for active students';
  END IF;

  UPDATE public.attendance_records
  SET status = _status,
      marked_by = auth.uid()
  WHERE student_id = ANY(_student_ids)
    AND date = _date
    AND lecture_number = _lecture_number;

  INSERT INTO public.attendance_records (
    student_id,
    date,
    status,
    lecture_number,
    marked_by
  )
  SELECT DISTINCT
    requested.student_id,
    _date,
    _status,
    _lecture_number,
    auth.uid()
  FROM unnest(_student_ids) AS requested(student_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    WHERE ar.student_id = requested.student_id
      AND ar.date = _date
      AND ar.lecture_number = _lecture_number
  );
END;
$$;