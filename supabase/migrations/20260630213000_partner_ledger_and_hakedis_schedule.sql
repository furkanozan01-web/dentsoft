-- İş ortakları hizmet/borç takibi ve hakediş ödeme planı alanları.

ALTER TABLE public.business_partners
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS tax_info TEXT,
  ADD COLUMN IF NOT EXISTS bank_info TEXT;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS salary_day SMALLINT,
  ADD COLUMN IF NOT EXISTS payment_account TEXT;
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_salary_day_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_salary_day_check
  CHECK (salary_day IS NULL OR salary_day BETWEEN 1 AND 31);

ALTER TABLE public.doctor_payments
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS earning_period TEXT;

CREATE TABLE IF NOT EXISTS public.partner_services (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  partner_id BIGINT NOT NULL REFERENCES public.business_partners(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  patient_id BIGINT REFERENCES public.patients(id) ON DELETE SET NULL,
  doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  vat_status TEXT NOT NULL DEFAULT 'kdv_dahil',
  invoice_status TEXT NOT NULL DEFAULT 'bekliyor',
  payment_status TEXT NOT NULL DEFAULT 'bekliyor',
  description TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_services_clinic_isolation ON public.partner_services
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE INDEX IF NOT EXISTS partner_services_clinic_partner_idx
  ON public.partner_services(clinic_id, partner_id, service_date DESC);
CREATE INDEX IF NOT EXISTS partner_services_due_idx
  ON public.partner_services(clinic_id, due_date)
  WHERE payment_status <> 'odendi';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS partner_service_id BIGINT REFERENCES public.partner_services(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS transactions_partner_service_idx ON public.transactions(partner_service_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_services TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.partner_services_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.record_doctor_payment(
  p_doctor_id BIGINT,
  p_amount INTEGER,
  p_payment_type TEXT,
  p_method TEXT,
  p_payment_date DATE,
  p_note TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_clinic_id BIGINT := public.get_my_clinic_id();
  v_doctor_name TEXT;
  v_default_account TEXT;
  v_transaction_id BIGINT;
  v_payment_id BIGINT;
  v_can_manage BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p LEFT JOIN public.doctors d ON d.id = p.doctor_id AND d.clinic_id = p.clinic_id
    WHERE p.id = auth.uid() AND p.clinic_id = v_clinic_id AND (p.role = 'admin' OR d.is_mesul_mudur = true)
  ) INTO v_can_manage;
  IF NOT COALESCE(v_can_manage, false) THEN RAISE EXCEPTION 'Hakediş ödemesi yapma yetkiniz yok'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Geçerli bir tutar girin'; END IF;

  SELECT name, payment_account INTO v_doctor_name, v_default_account FROM public.doctors
  WHERE id = p_doctor_id AND clinic_id = v_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hekim bu klinikte bulunamadı'; END IF;

  INSERT INTO public.transactions (
    clinic_id, amount, method, type, transaction_date, description, category,
    doctor_id, account_name, payment_status, source_type
  ) VALUES (
    v_clinic_id, p_amount, COALESCE(NULLIF(p_method, ''), 'cash'), 'expense', COALESCE(p_payment_date, CURRENT_DATE),
    COALESCE(NULLIF(trim(p_note), ''), 'Dt. ' || v_doctor_name || ' hakediş ödemesi'),
    'Hekim Hakediş', p_doctor_id,
    COALESCE(v_default_account, CASE WHEN p_method = 'cash' THEN 'Kasa' WHEN p_method = 'transfer' THEN 'Banka' ELSE NULL END),
    'odendi', 'doctor_payment'
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.doctor_payments (
    clinic_id, doctor_id, amount, payment_type, method, payment_date, note,
    transaction_id, account_name, created_by, earning_period
  ) VALUES (
    v_clinic_id, p_doctor_id, p_amount,
    CASE WHEN p_payment_type IN ('maas','ara_odeme','mahsuplasma','avans','prim','duzeltme') THEN p_payment_type ELSE 'ara_odeme' END,
    COALESCE(NULLIF(p_method, ''), 'cash'), COALESCE(p_payment_date, CURRENT_DATE), NULLIF(trim(p_note), ''),
    v_transaction_id, v_default_account, auth.uid(), to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYYY-MM')
  ) RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_doctor_payment(BIGINT, INTEGER, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_doctor_payment(BIGINT, INTEGER, TEXT, TEXT, DATE, TEXT) TO authenticated;
