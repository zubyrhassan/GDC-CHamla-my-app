-- These helpers are referenced inside RLS policies, so the calling role must be
-- able to execute them. They only return booleans about the current user.
GRANT EXECUTE ON FUNCTION public.can(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.exam_is_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;