CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_select ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value) VALUES ('consecutive_absence_threshold', '15');

CREATE OR REPLACE FUNCTION public.check_consecutive_absences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold int;
  v_last_present date;
  v_streak int;
  v_status public.student_status;
BEGIN
  IF NEW.status <> 'absent' THEN
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
  WHERE student_id = NEW.student_id AND status = 'present';

  SELECT count(*) INTO v_streak
  FROM public.attendance_records
  WHERE student_id = NEW.student_id
    AND status = 'absent'
    AND (v_last_present IS NULL OR date > v_last_present);

  IF v_streak >= v_threshold THEN
    UPDATE public.students SET status = 'struck_off' WHERE id = NEW.student_id;

    INSERT INTO public.struck_off_events (student_id, struck_off_date, reason, consecutive_absences_at_time)
    VALUES (NEW.student_id, NEW.date, 'attendance', v_streak);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER attendance_auto_strike_off
AFTER INSERT OR UPDATE OF status ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.check_consecutive_absences();

ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;