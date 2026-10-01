-- Revoke direct execute on internal SECURITY DEFINER helpers from API roles.
REVOKE ALL ON FUNCTION public.can(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_permission(uuid, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.exam_is_open(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.check_consecutive_absences() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_role() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Keep the intentional RPC callable, but only for signed-in users.
REVOKE ALL ON FUNCTION public.save_attendance(uuid[], date, public.attendance_status, integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.save_attendance(uuid[], date, public.attendance_status, integer) TO authenticated;