REVOKE ALL ON FUNCTION public.exam_is_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exam_is_open(uuid) TO authenticated, service_role;