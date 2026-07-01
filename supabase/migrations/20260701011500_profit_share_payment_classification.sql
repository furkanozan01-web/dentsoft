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
  v_profit_type TEXT;
  v_transaction_id BIGINT;
  v_payment_id BIGINT;
  v_can_manage BOOLEAN;
  v_category TEXT;
  v_source_type TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id AND d.clinic_id = p.clinic_id
    WHERE p.id = auth.uid() AND p.clinic_id = v_clinic_id
      AND (p.role IN ('admin','clinic_manager','responsible_manager') OR d.is_mesul_mudur = true)
  ) INTO v_can_manage;
  IF NOT COALESCE(v_can_manage, false) THEN RAISE EXCEPTION 'Hakediş ödemesi yapma yetkiniz yok'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Geçerli bir tutar girin'; END IF;

  SELECT name, payment_account, profit_distribution_type
    INTO v_doctor_name, v_default_account, v_profit_type
  FROM public.doctors WHERE id = p_doctor_id AND clinic_id = v_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hekim bu klinikte bulunamadı'; END IF;

  v_category := CASE p_payment_type
    WHEN 'kar_payi' THEN CASE v_profit_type WHEN 'expense' THEN 'Hekim Kâr Payı Gideri' WHEN 'partner_payment' THEN 'Ortak Ödemesi' ELSE 'Kâr Dağıtımı' END
    WHEN 'garantor' THEN 'Garantör Tamamlama'
    WHEN 'prim' THEN 'Hekim Primi'
    WHEN 'maas' THEN 'Hekim Maaşı'
    ELSE 'Hekim Hakediş' END;
  v_source_type := CASE p_payment_type
    WHEN 'kar_payi' THEN CASE v_profit_type WHEN 'expense' THEN 'doctor_payment' WHEN 'partner_payment' THEN 'partner_payment' ELSE 'profit_distribution' END
    ELSE 'doctor_payment' END;

  INSERT INTO public.transactions (
    clinic_id, amount, method, type, transaction_date, description, category,
    doctor_id, account_name, payment_status, source_type
  ) VALUES (
    v_clinic_id, p_amount, COALESCE(NULLIF(p_method, ''), 'cash'), 'expense', COALESCE(p_payment_date, CURRENT_DATE),
    COALESCE(NULLIF(trim(p_note), ''), 'Dt. ' || v_doctor_name || ' ' || lower(v_category)),
    v_category, p_doctor_id,
    COALESCE(v_default_account, CASE WHEN p_method = 'cash' THEN 'Kasa' WHEN p_method = 'transfer' THEN 'Banka' ELSE NULL END),
    'odendi', v_source_type
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.doctor_payments (
    clinic_id, doctor_id, amount, payment_type, method, payment_date, note,
    transaction_id, account_name, created_by, earning_period
  ) VALUES (
    v_clinic_id, p_doctor_id, p_amount,
    CASE WHEN p_payment_type IN ('maas','ara_odeme','mahsuplasma','avans','prim','garantor','kar_payi','duzeltme') THEN p_payment_type ELSE 'ara_odeme' END,
    COALESCE(NULLIF(p_method, ''), 'cash'), COALESCE(p_payment_date, CURRENT_DATE), NULLIF(trim(p_note), ''),
    v_transaction_id, v_default_account, auth.uid(), to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYYY-MM')
  ) RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_doctor_payment(BIGINT, INTEGER, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_doctor_payment(BIGINT, INTEGER, TEXT, TEXT, DATE, TEXT) TO authenticated;
