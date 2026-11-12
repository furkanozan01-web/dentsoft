-- 1) Hata: p_total_amount (integer) * rate_bps (integer) 32 bit'e sığmadığı için büyük dağıtımlar
--    'integer out of range' ile çöküyordu (%100 hissede 2.147 TL üstü, %40 hissede 5.368 TL üstü). Hesap bigint ile yapılır.
-- 2) Dağıtılacak toplam, şubenin kasa bakiyesini (gelir − gider/iade) aşamaz.
CREATE OR REPLACE FUNCTION public.distribute_branch_profit(
  p_branch_id BIGINT,
  p_total_amount INTEGER,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE(doctor_id BIGINT, amount INTEGER)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id BIGINT := public.get_my_clinic_id();
  v_can_manage BOOLEAN;
  v_branch_name TEXT;
  v_share RECORD;
  v_share_amount BIGINT;
  v_total_out BIGINT := 0;
  v_balance BIGINT;
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

  -- Ön kontrol: fiilen ödenecek toplam kasa bakiyesini aşıyor mu?
  SELECT COALESCE(SUM(floor(p_total_amount::bigint * ds.rate_bps / 10000.0)::bigint), 0) INTO v_total_out
  FROM public.doctor_shares ds
  JOIN public.doctors d ON d.id = ds.doctor_id AND d.clinic_id = v_clinic_id
  WHERE ds.clinic_id = v_clinic_id AND ds.branch_id = p_branch_id AND ds.is_active
    AND (ds.start_date IS NULL OR ds.start_date <= COALESCE(p_payment_date, CURRENT_DATE))
    AND (ds.end_date IS NULL OR ds.end_date >= COALESCE(p_payment_date, CURRENT_DATE));

  SELECT COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount WHEN t.type IN ('expense','refund') THEN -t.amount ELSE 0 END), 0)
  INTO v_balance
  FROM public.transactions t
  WHERE t.clinic_id = v_clinic_id AND t.branch_id = p_branch_id;

  IF v_total_out > v_balance THEN
    RAISE EXCEPTION 'Kasada yeterli bakiye yok (dağıtılacak: % ₺, kasa bakiyesi: % ₺)',
      to_char(v_total_out / 100.0, 'FM999G999G990D00'), to_char(v_balance / 100.0, 'FM999G999G990D00');
  END IF;

  FOR v_share IN
    SELECT ds.doctor_id, ds.rate_bps, ds.profit_distribution_type, d.name AS doctor_name, d.payment_account
    FROM public.doctor_shares ds
    JOIN public.doctors d ON d.id = ds.doctor_id AND d.clinic_id = v_clinic_id
    WHERE ds.clinic_id = v_clinic_id AND ds.branch_id = p_branch_id AND ds.is_active
      AND (ds.start_date IS NULL OR ds.start_date <= COALESCE(p_payment_date, CURRENT_DATE))
      AND (ds.end_date IS NULL OR ds.end_date >= COALESCE(p_payment_date, CURRENT_DATE))
  LOOP
    v_share_amount := floor(p_total_amount::bigint * v_share.rate_bps / 10000.0)::bigint;
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
      v_clinic_id, v_share_amount::integer, 'cash', 'expense', COALESCE(p_payment_date, CURRENT_DATE),
      COALESCE(NULLIF(trim(p_note), ''), v_branch_name || ' kasası kâr payı dağıtımı — Dt. ' || v_share.doctor_name),
      v_category, v_share.doctor_id, v_share.payment_account, 'odendi', v_source_type, p_branch_id
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO public.doctor_payments (
      clinic_id, doctor_id, amount, payment_type, method, payment_date, note,
      transaction_id, account_name, created_by, earning_period, branch_id
    ) VALUES (
      v_clinic_id, v_share.doctor_id, v_share_amount::integer, 'kar_payi', 'cash', COALESCE(p_payment_date, CURRENT_DATE),
      NULLIF(trim(p_note), ''), v_transaction_id, v_share.payment_account, auth.uid(),
      to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYYY-MM'), p_branch_id
    );

    doctor_id := v_share.doctor_id;
    amount := v_share_amount::integer;
    RETURN NEXT;
  END LOOP;
END;
$function$;
