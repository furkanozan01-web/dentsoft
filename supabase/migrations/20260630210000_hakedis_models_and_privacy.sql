-- Hakediş: yeni ödeme modelleri ve hekim bazlı ödeme gizliliği.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS guarantee_amount INTEGER,
  ADD COLUMN IF NOT EXISTS bonus_amount INTEGER,
  ADD COLUMN IF NOT EXISTS per_transaction_amount INTEGER;

ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_payment_model_check;
ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_payment_model_check
  CHECK (payment_model IS NULL OR payment_model IN (
    'salary', 'commission', 'hybrid', 'guarantee', 'bonus', 'per_transaction', 'revenue'
  ));

DROP POLICY IF EXISTS doctor_payments_clinic_isolation ON public.doctor_payments;

CREATE POLICY doctor_payments_select_authorized
  ON public.doctor_payments FOR SELECT TO authenticated
  USING (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.doctors manager ON manager.id = p.doctor_id AND manager.clinic_id = p.clinic_id
      WHERE p.id = (SELECT auth.uid())
        AND p.clinic_id = doctor_payments.clinic_id
        AND (p.role = 'admin' OR p.doctor_id = doctor_payments.doctor_id OR manager.is_mesul_mudur = true)
    )
  );

CREATE POLICY doctor_payments_insert_authorized
  ON public.doctor_payments FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.doctors manager ON manager.id = p.doctor_id AND manager.clinic_id = p.clinic_id
      WHERE p.id = (SELECT auth.uid())
        AND p.clinic_id = doctor_payments.clinic_id
        AND (p.role = 'admin' OR manager.is_mesul_mudur = true)
    )
  );

CREATE POLICY doctor_payments_update_authorized
  ON public.doctor_payments FOR UPDATE TO authenticated
  USING (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.doctors manager ON manager.id = p.doctor_id AND manager.clinic_id = p.clinic_id
      WHERE p.id = (SELECT auth.uid()) AND p.clinic_id = doctor_payments.clinic_id
        AND (p.role = 'admin' OR manager.is_mesul_mudur = true)
    )
  )
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY doctor_payments_delete_authorized
  ON public.doctor_payments FOR DELETE TO authenticated
  USING (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.doctors manager ON manager.id = p.doctor_id AND manager.clinic_id = p.clinic_id
      WHERE p.id = (SELECT auth.uid()) AND p.clinic_id = doctor_payments.clinic_id
        AND (p.role = 'admin' OR manager.is_mesul_mudur = true)
    )
  );

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
  v_transaction_id BIGINT;
  v_payment_id BIGINT;
  v_can_manage BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id AND d.clinic_id = p.clinic_id
    WHERE p.id = auth.uid() AND p.clinic_id = v_clinic_id
      AND (p.role = 'admin' OR d.is_mesul_mudur = true)
  ) INTO v_can_manage;
  IF NOT COALESCE(v_can_manage, false) THEN RAISE EXCEPTION 'Hakediş ödemesi yapma yetkiniz yok'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Geçerli bir tutar girin'; END IF;

  SELECT name INTO v_doctor_name FROM public.doctors
  WHERE id = p_doctor_id AND clinic_id = v_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hekim bu klinikte bulunamadı'; END IF;

  INSERT INTO public.transactions (
    clinic_id, amount, method, type, transaction_date, description,
    category, doctor_id, account_name, payment_status, source_type
  ) VALUES (
    v_clinic_id, p_amount, COALESCE(NULLIF(p_method, ''), 'cash'), 'expense',
    COALESCE(p_payment_date, CURRENT_DATE),
    COALESCE(NULLIF(trim(p_note), ''), 'Dt. ' || v_doctor_name || ' hakediş ödemesi'),
    'Hekim Hakediş', p_doctor_id,
    CASE WHEN p_method = 'cash' THEN 'Kasa' WHEN p_method = 'transfer' THEN 'Banka' ELSE NULL END,
    'odendi', 'doctor_payment'
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.doctor_payments (
    clinic_id, doctor_id, amount, payment_type, method, payment_date, note, transaction_id
  ) VALUES (
    v_clinic_id, p_doctor_id, p_amount,
    CASE WHEN p_payment_type IN ('maas','ara_odeme','mahsuplasma','avans','prim','duzeltme')
      THEN p_payment_type ELSE 'ara_odeme' END,
    COALESCE(NULLIF(p_method, ''), 'cash'), COALESCE(p_payment_date, CURRENT_DATE),
    NULLIF(trim(p_note), ''), v_transaction_id
  ) RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_doctor_payment_link(p_transaction_id BIGINT DEFAULT NULL, p_payment_id BIGINT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_clinic_id BIGINT := public.get_my_clinic_id();
  v_selected_payment_id BIGINT;
  v_transaction_id BIGINT;
  v_can_manage BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id AND d.clinic_id = p.clinic_id
    WHERE p.id = auth.uid() AND p.clinic_id = v_clinic_id
      AND (p.role = 'admin' OR d.is_mesul_mudur = true)
  ) INTO v_can_manage;
  IF NOT COALESCE(v_can_manage, false) THEN RAISE EXCEPTION 'Hakediş ödemesi silme yetkiniz yok'; END IF;

  SELECT id, transaction_id INTO v_selected_payment_id, v_transaction_id
  FROM public.doctor_payments
  WHERE clinic_id = v_clinic_id
    AND ((p_payment_id IS NOT NULL AND id = p_payment_id)
      OR (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id))
  LIMIT 1;

  IF v_selected_payment_id IS NOT NULL THEN
    DELETE FROM public.doctor_payments WHERE id = v_selected_payment_id AND clinic_id = v_clinic_id;
    IF v_transaction_id IS NOT NULL THEN
      DELETE FROM public.transactions
      WHERE id = v_transaction_id AND clinic_id = v_clinic_id AND source_type = 'doctor_payment';
    END IF;
  END IF;
END;
$$;
