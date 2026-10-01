CREATE TYPE public.fee_due_status AS ENUM ('unpaid','partial','paid');

CREATE TABLE public.fee_dues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_type_id uuid REFERENCES public.fee_types(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  session_label text NOT NULL DEFAULT '',
  status public.fee_due_status NOT NULL DEFAULT 'unpaid',
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fee_dues_unique_charge_idx
  ON public.fee_dues (student_id, fee_type_id, session_label);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_dues TO authenticated;
GRANT ALL ON public.fee_dues TO service_role;
ALTER TABLE public.fee_dues ENABLE ROW LEVEL SECURITY;

CREATE POLICY fee_dues_view ON public.fee_dues FOR SELECT TO authenticated USING (public.can('fees','view'));
CREATE POLICY fee_dues_add ON public.fee_dues FOR INSERT TO authenticated WITH CHECK (public.can('fees','add'));
CREATE POLICY fee_dues_edit ON public.fee_dues FOR UPDATE TO authenticated USING (public.can('fees','edit')) WITH CHECK (public.can('fees','edit'));
CREATE POLICY fee_dues_delete ON public.fee_dues FOR DELETE TO authenticated USING (public.can('fees','delete'));

CREATE TRIGGER update_fee_dues_updated_at BEFORE UPDATE ON public.fee_dues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fee_transactions
  ADD COLUMN IF NOT EXISTS fee_due_id uuid REFERENCES public.fee_dues(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.refresh_fee_due_status(_due_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_paid numeric;
BEGIN
  IF _due_id IS NULL THEN RETURN; END IF;

  SELECT amount INTO v_amount FROM public.fee_dues WHERE id = _due_id;
  IF v_amount IS NULL THEN RETURN; END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_paid
  FROM public.fee_transactions WHERE fee_due_id = _due_id;

  UPDATE public.fee_dues
  SET status = CASE
        WHEN v_paid <= 0 THEN 'unpaid'::public.fee_due_status
        WHEN v_paid >= v_amount THEN 'paid'::public.fee_due_status
        ELSE 'partial'::public.fee_due_status
      END
  WHERE id = _due_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_fee_due_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_fee_due_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.refresh_fee_due_status(OLD.fee_due_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.refresh_fee_due_status(NEW.fee_due_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_fee_due_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER fee_transactions_sync_due
AFTER INSERT OR UPDATE OR DELETE ON public.fee_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_fee_due_status();