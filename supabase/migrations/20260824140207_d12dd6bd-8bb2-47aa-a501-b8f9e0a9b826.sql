-- Student emergency contact extensions
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS father_contact text,
  ADD COLUMN IF NOT EXISTS guardian_name text;

-- Rooms
CREATE TABLE public.hostel_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number text NOT NULL,
  block text NOT NULL DEFAULT '',
  floor text,
  capacity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (block, room_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_rooms TO authenticated;
GRANT ALL ON public.hostel_rooms TO service_role;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY hostel_rooms_view ON public.hostel_rooms FOR SELECT TO authenticated USING (public.can('hostel','view'));
CREATE POLICY hostel_rooms_add ON public.hostel_rooms FOR INSERT TO authenticated WITH CHECK (public.can('hostel','add'));
CREATE POLICY hostel_rooms_edit ON public.hostel_rooms FOR UPDATE TO authenticated USING (public.can('hostel','edit')) WITH CHECK (public.can('hostel','edit'));
CREATE POLICY hostel_rooms_delete ON public.hostel_rooms FOR DELETE TO authenticated USING (public.can('hostel','delete'));

CREATE TRIGGER update_hostel_rooms_updated_at BEFORE UPDATE ON public.hostel_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allotment status
DO $$ BEGIN
  CREATE TYPE public.hostel_allotment_status AS ENUM ('active','vacated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.hostel_allotments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE RESTRICT,
  bed_number integer NOT NULL DEFAULT 1,
  admission_date date NOT NULL DEFAULT CURRENT_DATE,
  vacate_date date,
  status public.hostel_allotment_status NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hostel_allotments_active_bed_idx
  ON public.hostel_allotments (room_id, bed_number) WHERE status = 'active';
CREATE UNIQUE INDEX hostel_allotments_active_student_idx
  ON public.hostel_allotments (student_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_allotments TO authenticated;
GRANT ALL ON public.hostel_allotments TO service_role;
ALTER TABLE public.hostel_allotments ENABLE ROW LEVEL SECURITY;

CREATE POLICY hostel_allotments_view ON public.hostel_allotments FOR SELECT TO authenticated USING (public.can('hostel','view'));
CREATE POLICY hostel_allotments_add ON public.hostel_allotments FOR INSERT TO authenticated WITH CHECK (public.can('hostel','add'));
CREATE POLICY hostel_allotments_edit ON public.hostel_allotments FOR UPDATE TO authenticated USING (public.can('hostel','edit')) WITH CHECK (public.can('hostel','edit'));
CREATE POLICY hostel_allotments_delete ON public.hostel_allotments FOR DELETE TO authenticated USING (public.can('hostel','delete'));

CREATE TRIGGER update_hostel_allotments_updated_at BEFORE UPDATE ON public.hostel_allotments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hostel fees
CREATE SEQUENCE IF NOT EXISTS public.hostel_receipt_number_seq;

CREATE TABLE public.hostel_fee_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  allotment_id uuid NOT NULL REFERENCES public.hostel_allotments(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  period_month date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  receipt_number text NOT NULL DEFAULT ('HSTL-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.hostel_receipt_number_seq')::text, 4, '0')),
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (receipt_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_fee_transactions TO authenticated;
GRANT ALL ON public.hostel_fee_transactions TO service_role;
ALTER TABLE public.hostel_fee_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY hostel_fees_view ON public.hostel_fee_transactions FOR SELECT TO authenticated USING (public.can('hostel','view'));
CREATE POLICY hostel_fees_add ON public.hostel_fee_transactions FOR INSERT TO authenticated WITH CHECK (public.can('hostel','add'));
CREATE POLICY hostel_fees_edit ON public.hostel_fee_transactions FOR UPDATE TO authenticated USING (public.can('hostel','edit')) WITH CHECK (public.can('hostel','edit'));
CREATE POLICY hostel_fees_delete ON public.hostel_fee_transactions FOR DELETE TO authenticated USING (public.can('hostel','delete'));

CREATE TRIGGER update_hostel_fee_transactions_updated_at BEFORE UPDATE ON public.hostel_fee_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Default role permissions for the new module
INSERT INTO public.permissions (role, module, can_view, can_add, can_edit, can_delete)
SELECT r.role, 'hostel', v, a, e, d
FROM (VALUES
  ('super_admin', true, true, true, true),
  ('admin', true, true, true, true),
  ('principal', true, true, true, true),
  ('coe', true, false, false, false),
  ('coordinator', true, true, true, false),
  ('clerk', true, true, true, false),
  ('teacher', true, false, false, false)
) AS r(role, v, a, e, d)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.role = r.role AND p.module = 'hostel'
);

-- Hostel monthly fee default setting
INSERT INTO public.app_settings (key, value)
VALUES ('hostel_monthly_fee', '3000')
ON CONFLICT (key) DO NOTHING;