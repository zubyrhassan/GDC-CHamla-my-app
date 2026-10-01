-- 1. Waivers on absentee fines (absence history preserved)
ALTER TABLE public.absentee_fines
  ADD COLUMN IF NOT EXISTS waived_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waived_at timestamptz,
  ADD COLUMN IF NOT EXISTS waived_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS waive_reason text;

CREATE TABLE IF NOT EXISTS public.fine_waiver_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_label text NOT NULL,
  amount numeric NOT NULL,
  fines_affected integer NOT NULL DEFAULT 0,
  reason text,
  performed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fine_waiver_events TO authenticated;
GRANT ALL ON public.fine_waiver_events TO service_role;
ALTER TABLE public.fine_waiver_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fine_waiver_events_view ON public.fine_waiver_events;
CREATE POLICY fine_waiver_events_view ON public.fine_waiver_events FOR SELECT TO authenticated USING (public.can('fees', 'view'));
DROP POLICY IF EXISTS fine_waiver_events_add ON public.fine_waiver_events;
CREATE POLICY fine_waiver_events_add ON public.fine_waiver_events FOR INSERT TO authenticated WITH CHECK (public.can('fees', 'edit'));

-- fine dues roll-up now nets out waived amounts
CREATE OR REPLACE FUNCTION public.sync_absentee_fine_due(_student_id uuid, _session text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fee_type uuid;
  v_total numeric;
  v_due_id uuid;
  v_paid numeric;
BEGIN
  IF _student_id IS NULL OR _session IS NULL THEN RETURN; END IF;

  SELECT id INTO v_fee_type FROM public.fee_types WHERE lower(name) = 'absentee fine' LIMIT 1;
  IF v_fee_type IS NULL THEN RETURN; END IF;

  SELECT COALESCE(sum(GREATEST(amount - COALESCE(waived_amount, 0), 0)), 0) INTO v_total
  FROM public.absentee_fines
  WHERE student_id = _student_id AND session_label = _session;

  SELECT id INTO v_due_id FROM public.fee_dues
  WHERE student_id = _student_id AND fee_type_id = v_fee_type AND session_label = _session;

  IF v_total <= 0 THEN
    IF v_due_id IS NOT NULL THEN
      SELECT COALESCE(sum(amount), 0) INTO v_paid FROM public.fee_transactions WHERE fee_due_id = v_due_id;
      IF v_paid <= 0 THEN
        DELETE FROM public.fee_dues WHERE id = v_due_id;
      ELSE
        UPDATE public.fee_dues SET amount = 0 WHERE id = v_due_id;
        PERFORM public.refresh_fee_due_status(v_due_id);
      END IF;
    END IF;
    RETURN;
  END IF;

  IF v_due_id IS NULL THEN
    INSERT INTO public.fee_dues (student_id, fee_type_id, amount, due_date, session_label, notes)
    VALUES (_student_id, v_fee_type, v_total, CURRENT_DATE, _session, 'Auto-generated from absentee fines')
    RETURNING id INTO v_due_id;
  ELSE
    UPDATE public.fee_dues SET amount = v_total WHERE id = v_due_id;
  END IF;

  PERFORM public.refresh_fee_due_status(v_due_id);
END;
$function$;

-- waive/restore action
CREATE OR REPLACE FUNCTION public.waive_absentee_fines(_student_ids uuid[], _session text, _amount numeric, _reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student uuid;
  v_remaining numeric;
  v_row record;
  v_take numeric;
  v_applied numeric;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.can('fees', 'edit') THEN RAISE EXCEPTION 'You do not have permission to waive fines'; END IF;
  IF _student_ids IS NULL OR cardinality(_student_ids) = 0 OR _session IS NULL THEN RETURN; END IF;

  FOREACH v_student IN ARRAY _student_ids LOOP
    v_applied := 0;
    v_count := 0;

    IF _amount IS NULL THEN
      -- full waiver
      UPDATE public.absentee_fines
      SET waived_amount = amount, waived_at = now(), waived_by = auth.uid(), waive_reason = _reason
      WHERE student_id = v_student AND session_label = _session AND COALESCE(waived_amount, 0) < amount;
      SELECT COALESCE(sum(waived_amount), 0), count(*) INTO v_applied, v_count
      FROM public.absentee_fines WHERE student_id = v_student AND session_label = _session AND waived_amount > 0;
    ELSIF _amount <= 0 THEN
      -- restore: clear all waivers
      UPDATE public.absentee_fines
      SET waived_amount = 0, waived_at = NULL, waived_by = NULL, waive_reason = NULL
      WHERE student_id = v_student AND session_label = _session AND COALESCE(waived_amount, 0) > 0;
    ELSE
      v_remaining := _amount;
      FOR v_row IN
        SELECT id, amount, COALESCE(waived_amount, 0) AS waived
        FROM public.absentee_fines
        WHERE student_id = v_student AND session_label = _session AND COALESCE(waived_amount, 0) < amount
        ORDER BY date, lecture_number
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_row.amount - v_row.waived, v_remaining);
        UPDATE public.absentee_fines
        SET waived_amount = v_row.waived + v_take, waived_at = now(), waived_by = auth.uid(), waive_reason = _reason
        WHERE id = v_row.id;
        v_remaining := v_remaining - v_take;
        v_applied := v_applied + v_take;
        v_count := v_count + 1;
      END LOOP;
    END IF;

    PERFORM public.sync_absentee_fine_due(v_student, _session);

    INSERT INTO public.fine_waiver_events (student_id, session_label, amount, fines_affected, reason, performed_by)
    VALUES (v_student, _session, COALESCE(v_applied, 0), COALESCE(v_count, 0), _reason, auth.uid());
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.waive_absentee_fines(uuid[], text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waive_absentee_fines(uuid[], text, numeric, text) TO authenticated;

-- 2. Session audit trail
CREATE TABLE IF NOT EXISTS public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  new_session_label text NOT NULL,
  previous_session_label text,
  start_date date NOT NULL,
  archived_fine_count integer NOT NULL DEFAULT 0,
  archived_fine_amount numeric NOT NULL DEFAULT 0,
  archived_absences integer NOT NULL DEFAULT 0,
  started_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.session_events TO authenticated;
GRANT ALL ON public.session_events TO service_role;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_events_view ON public.session_events;
CREATE POLICY session_events_view ON public.session_events FOR SELECT TO authenticated USING (public.can('settings', 'view') OR public.is_admin());
DROP POLICY IF EXISTS session_events_add ON public.session_events;
CREATE POLICY session_events_add ON public.session_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 3. Class timetable
CREATE TABLE IF NOT EXISTS public.class_timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  teacher_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time,
  subject text,
  lecture_number integer NOT NULL DEFAULT 1,
  room text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_timetable TO authenticated;
GRANT ALL ON public.class_timetable TO service_role;
ALTER TABLE public.class_timetable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS class_timetable_view ON public.class_timetable;
CREATE POLICY class_timetable_view ON public.class_timetable FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS class_timetable_add ON public.class_timetable;
CREATE POLICY class_timetable_add ON public.class_timetable FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS class_timetable_edit ON public.class_timetable;
CREATE POLICY class_timetable_edit ON public.class_timetable FOR UPDATE TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS class_timetable_delete ON public.class_timetable;
CREATE POLICY class_timetable_delete ON public.class_timetable FOR DELETE TO authenticated USING (public.is_admin());
DROP TRIGGER IF EXISTS update_class_timetable_updated_at ON public.class_timetable;
CREATE TRIGGER update_class_timetable_updated_at BEFORE UPDATE ON public.class_timetable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Admins can assign classes to any teacher
DROP POLICY IF EXISTS teacher_classes_admin_all ON public.teacher_classes;
CREATE POLICY teacher_classes_admin_all ON public.teacher_classes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());