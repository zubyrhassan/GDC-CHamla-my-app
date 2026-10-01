DROP POLICY IF EXISTS attendance_add ON public.attendance_records;
CREATE POLICY attendance_add ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (
  can('attendance','add') AND (
    is_admin() OR (date >= (CURRENT_DATE - 3) AND date <= (CURRENT_DATE + 1))
  )
);

DROP POLICY IF EXISTS attendance_edit ON public.attendance_records;
CREATE POLICY attendance_edit ON public.attendance_records
FOR UPDATE TO authenticated
USING (
  can('attendance','edit') AND (is_admin() OR date >= (CURRENT_DATE - 3))
)
WITH CHECK (
  can('attendance','edit') AND (
    is_admin() OR (date >= (CURRENT_DATE - 3) AND date <= (CURRENT_DATE + 1))
  )
);