-- Finans > Defter: hakediş senkronu, sabit giderler ve firma ödeme ayrıntıları.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS doctor_id BIGINT REFERENCES public.doctors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT NOT NULL DEFAULT 'belirsiz',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'odendi',
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.doctor_payments
  ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS doctor_payments_transaction_id_key
  ON public.doctor_payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

ALTER TABLE public.clinic_debts
  ADD COLUMN IF NOT EXISTS payment_day SMALLINT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS last_paid_at DATE;

ALTER TABLE public.clinic_debts
  DROP CONSTRAINT IF EXISTS clinic_debts_payment_day_check;
ALTER TABLE public.clinic_debts
  ADD CONSTRAINT clinic_debts_payment_day_check
  CHECK (payment_day IS NULL OR payment_day BETWEEN 1 AND 31);

CREATE INDEX IF NOT EXISTS transactions_clinic_date_type_idx
  ON public.transactions(clinic_id, transaction_date, type);
CREATE INDEX IF NOT EXISTS transactions_clinic_partner_idx
  ON public.transactions(clinic_id, partner_id)
  WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_clinic_doctor_idx
  ON public.transactions(clinic_id, doctor_id)
  WHERE doctor_id IS NOT NULL;

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
BEGIN
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'Yetkisiz erişim'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Geçerli bir tutar girin'; END IF;

  SELECT name INTO v_doctor_name
  FROM public.doctors
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
  v_tx_id BIGINT;
BEGIN
  SELECT transaction_id INTO v_tx_id
  FROM public.doctor_payments
  WHERE clinic_id = v_clinic_id
    AND ((p_payment_id IS NOT NULL AND id = p_payment_id)
      OR (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id))
  LIMIT 1;

  IF FOUND THEN
    DELETE FROM public.doctor_payments
    WHERE clinic_id = v_clinic_id AND transaction_id = v_tx_id;
    DELETE FROM public.transactions
    WHERE clinic_id = v_clinic_id AND id = v_tx_id AND source_type = 'doctor_payment';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_clinic_debt(
  p_debt_id BIGINT,
  p_amount INTEGER,
  p_method TEXT DEFAULT NULL,
  p_account_name TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_clinic_id BIGINT := public.get_my_clinic_id();
  v_debt public.clinic_debts%ROWTYPE;
  v_paid INTEGER;
  v_tx_id BIGINT;
  v_next_due DATE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Geçerli bir tutar girin'; END IF;

  SELECT * INTO v_debt FROM public.clinic_debts
  WHERE id = p_debt_id AND clinic_id = v_clinic_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sabit gider bulunamadı'; END IF;

  v_paid := LEAST(v_debt.paid_amount + p_amount, v_debt.total_amount);
  INSERT INTO public.transactions (
    clinic_id, amount, method, type, transaction_date, description, category,
    recurring, account_name, payment_status, source_type
  ) VALUES (
    v_clinic_id, LEAST(p_amount, v_debt.total_amount - v_debt.paid_amount),
    COALESCE(NULLIF(p_method, ''), v_debt.payment_method, 'other'), 'expense', CURRENT_DATE,
    v_debt.title, 'Sabit Gider', NULLIF(v_debt.recurrence, 'tek_seferlik'),
    COALESCE(NULLIF(p_account_name, ''), v_debt.account_name), 'odendi', 'fixed_expense'
  ) RETURNING id INTO v_tx_id;

  IF v_paid >= v_debt.total_amount AND v_debt.recurrence IN ('aylik', 'yillik') THEN
    v_next_due := CASE WHEN v_debt.recurrence = 'aylik'
      THEN COALESCE(v_debt.due_date, CURRENT_DATE) + INTERVAL '1 month'
      ELSE COALESCE(v_debt.due_date, CURRENT_DATE) + INTERVAL '1 year' END;
    UPDATE public.clinic_debts SET paid_amount = 0, due_date = v_next_due,
      last_paid_at = CURRENT_DATE, status = 'active' WHERE id = v_debt.id;
  ELSE
    UPDATE public.clinic_debts SET paid_amount = v_paid, last_paid_at = CURRENT_DATE,
      status = CASE WHEN v_paid >= total_amount THEN 'paid' ELSE 'active' END
    WHERE id = v_debt.id;
  END IF;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_doctor_payment(BIGINT, INTEGER, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_doctor_payment_link(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_clinic_debt(BIGINT, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_doctor_payment(BIGINT, INTEGER, TEXT, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_doctor_payment_link(BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_clinic_debt(BIGINT, INTEGER, TEXT, TEXT) TO authenticated;
