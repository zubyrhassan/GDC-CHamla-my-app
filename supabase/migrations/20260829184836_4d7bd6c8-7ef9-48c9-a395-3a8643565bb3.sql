INSERT INTO public.app_settings (key, value)
VALUES
  ('absentee_fine_amount', '20'),
  ('current_session_label', to_char(CURRENT_DATE, 'YYYY') || CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN ' Fall' ELSE ' Spring' END),
  ('session_start_date', to_char(date_trunc('year', CURRENT_DATE), 'YYYY-MM-DD'))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.fee_types (name, default_amount, active)
SELECT 'Absentee Fine', 20, true
WHERE NOT EXISTS (SELECT 1 FROM public.fee_types WHERE lower(name) = 'absentee fine');

CREATE TABLE public.absentee_fines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_record_id uuid NOT NULL UNIQUE REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL,
  lecture_number integer NOT NULL DEFAULT 1,
  session_label text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX absentee_fines_student_session_idx ON public.absentee_fines (student_id, session_label);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absentee_fines TO authenticated;
GRANT ALL ON public.absentee_fines TO service_role;
ALTER TABLE public.absentee_fines ENABLE ROW LEVEL SECURITY;

CREATE POLICY absentee_fines_view ON public.absentee_fines FOR SELECT TO authenticated USING (public.can('fees','view') OR public.can('attendance','view'));
CREATE POLICY absentee_fines_add ON public.absentee_fines FOR INSERT TO authenticated WITH CHECK (public.can('fees','add'));
CREATE POLICY absentee_fines_edit ON public.absentee_fines FOR UPDATE TO authenticated USING (public.can('fees','edit')) WITH CHECK (public.can('fees','edit'));
CREATE POLICY absentee_fines_delete ON public.absentee_fines FOR DELETE TO authenticated USING (public.can('fees','delete'));

CREATE OR REPLACE FUNCTION public.sync_absentee_fine_due(_student_id uuid, _session text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_type uuid;
  v_total numeric;
  v_due_id uuid;
  v_paid numeric;
BEGIN
  IF _student_id IS NULL OR _session IS NULL THEN RETURN; END IF;

  SELECT id INTO v_fee_type FROM public.fee_types WHERE lower(name) = 'absentee fine' LIMIT 1;
  IF v_fee_type IS NULL THEN RETURN; END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_total
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
$$;

REVOKE EXECUTE ON FUNCTION public.sync_absentee_fine_due(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_absentee_fine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NEW.status = 'absent' AND (v_start IS NULL OR NEW.date >= v_start) THEN
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
$$;

REVOKE EXECUTE ON FUNCTION public.apply_absentee_fine() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER attendance_absentee_fine
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.apply_absentee_fine();