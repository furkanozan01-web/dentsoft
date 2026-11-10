-- distribute_branch_profit ilk halinde eski (kaldırılmış) rol adlarını
-- ('admin','clinic_manager') kontrol ediyordu — bu, rol sistemi Aşama 1'de
-- record_doctor_payment için düzeltilmişti ama yeni fonksiyona eski
-- migration dosyasından kopyalanırken atlandı. Canlı rol sözlüğü artık
-- bashekim/responsible_manager/hekim/asistan; aynı düzeltmeyi burada da uygula.

CREATE OR REPLACE FUNCTION public.distribute_branch_profit(
  p_branch_id BIGINT,
  p_total_amount INTEGER,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE(doctor_id BIGINT, amount INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_clinic_id BIGINT := public.get_my_clinic_id();
  v_can_manage BOOLEAN;
  v_branch_name TEXT;
  v_share RECORD;
  v_share_amount INTEGER;
  v_category TEXT;
  v_source_type TEXT;
  v_transaction_id BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id AND d.clinic_id = p.clinic_id
    WHERE p.id = auth.uid() AND p.clinic_id = v_clinic_id
      AND (p.role IN ('bashekim','responsible_manager') OR d.is_mesul_mudur = true)
  ) INTO v_can_manage;
  IF NOT COALESCE(v_can_manage, false) THEN RAISE EXCEPTION 'Kâr payı dağıtma yetkiniz yok'; END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN RAISE EXCEPTION 'Geçerli bir tutar girin'; END IF;

  SELECT name INTO v_branch_name FROM public.branches WHERE id = p_branch_id AND clinic_id = v_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Şube bu klinikte bulunamadı'; END IF;

  FOR v_share IN
    SELECT ds.doctor_id, ds.rate_bps, ds.profit_distribution_type, d.name AS doctor_name, d.payment_account
    FROM public.doctor_shares ds
    JOIN public.doctors d ON d.id = ds.doctor_id AND d.clinic_id = v_clinic_id
    WHERE ds.clinic_id = v_clinic_id AND ds.branch_id = p_branch_id AND ds.is_active
      AND (ds.start_date IS NULL OR ds.start_date <= COALESCE(p_payment_date, CURRENT_DATE))
      AND (ds.end_date IS NULL OR ds.end_date >= COALESCE(p_payment_date, CURRENT_DATE))
  LOOP
    v_share_amount := floor(p_total_amount * v_share.rate_bps / 10000.0)::INTEGER;
    IF v_share_amount <= 0 THEN CONTINUE; END IF;

    v_category := CASE v_share.profit_distribution_type
      WHEN 'expense' THEN 'Hekim Kâr Payı Gideri'
      WHEN 'partner_payment' THEN 'Ortak Ödemesi'
      ELSE 'Kâr Dağıtımı' END;
    v_source_type := CASE v_share.profit_distribution_type
      WHEN 'expense' THEN 'doctor_payment'
      WHEN 'partner_payment' THEN 'partner_payment'
      ELSE 'profit_distribution' END;

    INSERT INTO public.transactions (
      clinic_id, amount, method, type, transaction_date, description, category,
      doctor_id, account_name, payment_status, source_type, branch_id
    ) VALUES (
      v_clinic_id, v_share_amount, 'cash', 'expense', COALESCE(p_payment_date, CURRENT_DATE),
      COALESCE(NULLIF(trim(p_note), ''), v_branch_name || ' kasası kâr payı dağıtımı — Dt. ' || v_share.doctor_name),
      v_category, v_share.doctor_id, v_share.payment_account, 'odendi', v_source_type, p_branch_id
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO public.doctor_payments (
      clinic_id, doctor_id, amount, payment_type, method, payment_date, note,
      transaction_id, account_name, created_by, earning_period, branch_id
    ) VALUES (
      v_clinic_id, v_share.doctor_id, v_share_amount, 'kar_payi', 'cash', COALESCE(p_payment_date, CURRENT_DATE),
      NULLIF(trim(p_note), ''), v_transaction_id, v_share.payment_account, auth.uid(),
      to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYYY-MM'), p_branch_id
    );

    doctor_id := v_share.doctor_id;
    amount := v_share_amount;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.distribute_branch_profit(BIGINT, INTEGER, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distribute_branch_profit(BIGINT, INTEGER, DATE, TEXT) TO authenticated;
