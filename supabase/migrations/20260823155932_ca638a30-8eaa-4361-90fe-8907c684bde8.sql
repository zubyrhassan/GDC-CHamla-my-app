CREATE TABLE public.fee_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_type_id uuid REFERENCES public.fee_types(id),
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_charges TO authenticated;
GRANT ALL ON public.fee_charges TO service_role;

ALTER TABLE public.fee_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY fee_charges_admin_all ON public.fee_charges
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX fee_charges_student_idx ON public.fee_charges(student_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_fee_charges_updated_at
  BEFORE UPDATE ON public.fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fee_transactions
  ALTER COLUMN receipt_number
  SET DEFAULT ('GDC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('receipt_number_seq')::text, 4, '0'));

INSERT INTO public.app_settings (key, value)
VALUES ('college_logo_url', '')
ON CONFLICT (key) DO NOTHING;