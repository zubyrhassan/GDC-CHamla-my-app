CREATE OR REPLACE FUNCTION public.check_consecutive_absences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_threshold int;
  v_last_present date;
  v_streak int;
  v_status public.student_status;
BEGIN
  IF NEW.status <> 'absent' OR NEW.lecture_number <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(value, '')::int, 15) INTO v_threshold
  FROM public.app_settings WHERE key = 'consecutive_absence_threshold';
  IF v_threshold IS NULL OR v_threshold < 1 THEN
    v_threshold := 15;
  END IF;

  SELECT status INTO v_status FROM public.students WHERE id = NEW.student_id;
  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT max(date) INTO v_last_present
  FROM public.attendance_records
  WHERE student_id = NEW.student_id AND status = 'present' AND lecture_number = 1;

  SELECT count(*) INTO v_streak
  FROM public.attendance_records
  WHERE student_id = NEW.student_id
    AND status = 'absent'
    AND lecture_number = 1
    AND (v_last_present IS NULL OR date > v_last_present);

  IF v_streak >= v_threshold THEN
    UPDATE public.students SET status = 'struck_off' WHERE id = NEW.student_id;

    INSERT INTO public.struck_off_events (student_id, struck_off_date, reason, consecutive_absences_at_time)
    VALUES (NEW.student_id, NEW.date, 'attendance', v_streak);
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_consecutive_absences() FROM anon, authenticated;