REVOKE ALL ON FUNCTION public.waive_absentee_fines(uuid[], text, numeric, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.waive_absentee_fines(uuid[], text, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.save_attendance(uuid[], date, attendance_status, integer, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_attendance(uuid[], date, attendance_status, integer, boolean) TO authenticated;