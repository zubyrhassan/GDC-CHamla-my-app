CREATE OR REPLACE FUNCTION public.dashboard_stats(_days integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session text;
  v_start date;
  v_from date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can('students', 'view') AND NOT public.can('attendance', 'view') THEN
    RAISE EXCEPTION 'You do not have permission to view dashboard statistics';
  END IF;

  SELECT COALESCE(NULLIF(value, ''), 'Current session') INTO v_session
  FROM public.app_settings WHERE key = 'current_session_label';
  v_session := COALESCE(v_session, 'Current session');

  SELECT NULLIF(value, '')::date INTO v_start
  FROM public.app_settings WHERE key = 'session_start_date';

  v_from := GREATEST(COALESCE(v_start, CURRENT_DATE - COALESCE(_days, 180)), CURRENT_DATE - COALESCE(_days, 180));

  SELECT jsonb_build_object(
    'session_label', v_session,
    'attendance_daily', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'date')
      FROM (
        SELECT jsonb_build_object(
                 'date', date::text,
                 'present', count(*) FILTER (WHERE status = 'present'),
                 'absent', count(*) FILTER (WHERE status = 'absent'),
                 'leave', count(*) FILTER (WHERE status = 'leave'),
                 'total', count(*)
               ) AS x
        FROM public.attendance_records
        WHERE date >= v_from
        GROUP BY date
      ) s
    ), '[]'::jsonb),
    'fees_monthly', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'month')
      FROM (
        SELECT jsonb_build_object(
                 'month', to_char(date_trunc('month', payment_date), 'YYYY-MM'),
                 'collected', COALESCE(sum(amount), 0)
               ) AS x
        FROM public.fee_transactions
        WHERE payment_date >= (CURRENT_DATE - INTERVAL '11 months')::date
        GROUP BY date_trunc('month', payment_date)
      ) s
    ), '[]'::jsonb),
    'dues_monthly', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'month')
      FROM (
        SELECT jsonb_build_object(
                 'month', to_char(date_trunc('month', due_date), 'YYYY-MM'),
                 'charged', COALESCE(sum(amount), 0)
               ) AS x
        FROM public.fee_dues
        WHERE due_date >= (CURRENT_DATE - INTERVAL '11 months')::date
        GROUP BY date_trunc('month', due_date)
      ) s
    ), '[]'::jsonb),
    'fees_total_charged', COALESCE((SELECT sum(amount) FROM public.fee_dues), 0)
      + COALESCE((SELECT sum(amount) FROM public.fee_charges), 0),
    'fees_total_collected', COALESCE((SELECT sum(amount) FROM public.fee_transactions), 0),
    'enrollment', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'students')::int DESC)
      FROM (
        SELECT jsonb_build_object(
                 'program', COALESCE(p.name, 'Unassigned'),
                 'students', count(*)
               ) AS x
        FROM public.students s
        LEFT JOIN public.programs p ON p.id = s.program_id
        WHERE s.status = 'active'
        GROUP BY p.name
      ) s
    ), '[]'::jsonb),
    'students', jsonb_build_object(
      'total', (SELECT count(*) FROM public.students),
      'active', (SELECT count(*) FROM public.students WHERE status = 'active'),
      'struck_off', (SELECT count(*) FROM public.students WHERE status = 'struck_off'),
      'hostel', (SELECT count(*) FROM public.hostel_allotments WHERE status = 'active')
    ),
    'exam_averages', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'exam_date')
      FROM (
        SELECT jsonb_build_object(
                 'exam', e.name,
                 'exam_date', e.exam_date::text,
                 'average', round(avg(
                   CASE WHEN COALESCE(es.total_marks, e.total_marks) > 0
                        THEN r.marks_obtained / COALESCE(es.total_marks, e.total_marks) * 100
                        ELSE NULL END
                 )::numeric, 1),
                 'students', count(DISTINCT r.student_id)
               ) AS x
        FROM public.exam_results r
        JOIN public.exams e ON e.id = r.exam_id
        LEFT JOIN public.exam_subjects es ON es.id = r.exam_subject_id
        GROUP BY e.id, e.name, e.exam_date
        ORDER BY e.exam_date DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb),
    'fines', (
      SELECT jsonb_build_object(
        'accrued', COALESCE(sum(GREATEST(amount - COALESCE(waived_amount, 0), 0)), 0),
        'count', count(*),
        'monthly', COALESCE((
          SELECT jsonb_agg(y ORDER BY y->>'month')
          FROM (
            SELECT jsonb_build_object(
                     'month', to_char(date_trunc('month', date), 'YYYY-MM'),
                     'amount', COALESCE(sum(GREATEST(amount - COALESCE(waived_amount, 0), 0)), 0)
                   ) AS y
            FROM public.absentee_fines
            WHERE session_label = v_session
            GROUP BY date_trunc('month', date)
          ) t
        ), '[]'::jsonb)
      )
      FROM public.absentee_fines
      WHERE session_label = v_session
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(integer) TO authenticated;