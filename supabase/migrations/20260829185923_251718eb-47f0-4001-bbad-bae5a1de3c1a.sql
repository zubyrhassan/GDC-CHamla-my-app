ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS fine_exempt boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.apply_absentee_fine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount numeric;
  v_session text;
  v_start date;
  v_old_session text;
BEGIN
  SELECT COALESCE(NULLIF(value, '')::numeric, 20) INTO v_amount FROM public.app_settings WHERE key = 'absentee_fine_amount';
  v_amount := COALESCE(v_amount, 20);
  SELECT NULLIF(value, '') INTO v_session FROM public.app_settings WHERE key = 'current_session_label';
  v_session := COALESCE(v_session, 'Current session');
  SELECT NULLIF(value, '')::date INTO v_start FROM public.app_settings WHERE key = 'session_start_date';

  IF TG_OP = 'DELETE' THEN
    SELECT session_label INTO v_old_session FROM public.absentee_fines WHERE attendance_record_id = OLD.id;
    DELETE FROM public.absentee_fines WHERE attendance_record_id = OLD.id;
    IF v_old_session IS NOT NULL THEN
      PERFORM public.sync_absentee_fine_due(OLD.student_id, v_old_session);
    END IF;
    RETURN NULL;
  END IF;

  IF NEW.status = 'absent' AND COALESCE(NEW.fine_exempt, false) = false AND (v_start IS NULL OR NEW.date >= v_start) THEN
    INSERT INTO public.absentee_fines (student_id, attendance_record_id, amount, date, lecture_number, session_label)
    VALUES (NEW.student_id, NEW.id, v_amount, NEW.date, NEW.lecture_number, v_session)
    ON CONFLICT (attendance_record_id) DO UPDATE
      SET date = EXCLUDED.date,
          lecture_number = EXCLUDED.lecture_number,
          student_id = EXCLUDED.student_id;
    PERFORM public.sync_absentee_fine_due(NEW.student_id, v_session);
  ELSE
    SELECT session_label INTO v_old_session FROM public.absentee_fines WHERE attendance_record_id = NEW.id;
    IF v_old_session IS NOT NULL THEN
      DELETE FROM public.absentee_fines WHERE attendance_record_id = NEW.id;
      PERFORM public.sync_absentee_fine_due(NEW.student_id, v_old_session);
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_attendance(_student_ids uuid[], _date date, _status attendance_status, _lecture_number integer DEFAULT 1, _fine_exempt boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      fine_exempt = CASE WHEN _status = 'absent' THEN COALESCE(_fine_exempt, false) ELSE false END,
      marked_by = auth.uid()
  WHERE student_id = ANY(_student_ids)
    AND date = _date
    AND lecture_number = _lecture_number;

  INSERT INTO public.attendance_records (
    student_id,
    date,
    status,
    lecture_number,
    fine_exempt,
    marked_by
  )
  SELECT DISTINCT
    requested.student_id,
    _date,
    _status,
    _lecture_number,
    CASE WHEN _status = 'absent' THEN COALESCE(_fine_exempt, false) ELSE false END,
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
$function$;

REVOKE ALL ON FUNCTION public.apply_absentee_fine() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_attendance(uuid[], date, attendance_status, integer, boolean) TO authenticated;