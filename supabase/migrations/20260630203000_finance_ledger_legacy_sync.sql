-- Eski hakediş ödemelerini Defter giderleriyle eşleştir ve bağlantılı silmeyi düzelt.

CREATE INDEX IF NOT EXISTS transactions_doctor_id_idx ON public.transactions(doctor_id);
CREATE INDEX IF NOT EXISTS clinic_debts_clinic_id_idx ON public.clinic_debts(clinic_id);
CREATE INDEX IF NOT EXISTS doctor_payments_clinic_id_idx ON public.doctor_payments(clinic_id);

DO $$
DECLARE
  v_payment RECORD;
  v_transaction_id BIGINT;
BEGIN
  FOR v_payment IN
    SELECT dp.*, d.name AS doctor_name
    FROM public.doctor_payments dp
    JOIN public.doctors d ON d.id = dp.doctor_id AND d.clinic_id = dp.clinic_id
    WHERE dp.transaction_id IS NULL
  LOOP
    INSERT INTO public.transactions (
      clinic_id, doctor_id, amount, method, type, transaction_date,
      description, category, account_name, payment_status, source_type
    ) VALUES (
      v_payment.clinic_id, v_payment.doctor_id, v_payment.amount, v_payment.method,
      'expense', v_payment.payment_date,
      COALESCE(NULLIF(trim(v_payment.note), ''), 'Dt. ' || v_payment.doctor_name || ' hakediş ödemesi'),
      'Hekim Hakediş',
      CASE WHEN v_payment.method = 'cash' THEN 'Kasa' WHEN v_payment.method = 'transfer' THEN 'Banka' ELSE NULL END,
      'odendi', 'doctor_payment'
    ) RETURNING id INTO v_transaction_id;

    UPDATE public.doctor_payments
    SET transaction_id = v_transaction_id
    WHERE id = v_payment.id AND transaction_id IS NULL;
  END LOOP;
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
BEGIN
  SELECT id, transaction_id INTO v_selected_payment_id, v_transaction_id
  FROM public.doctor_payments
  WHERE clinic_id = v_clinic_id
    AND ((p_payment_id IS NOT NULL AND id = p_payment_id)
      OR (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id))
  LIMIT 1;

  IF v_selected_payment_id IS NOT NULL THEN
    DELETE FROM public.doctor_payments
    WHERE id = v_selected_payment_id AND clinic_id = v_clinic_id;
    IF v_transaction_id IS NOT NULL THEN
      DELETE FROM public.transactions
      WHERE id = v_transaction_id AND clinic_id = v_clinic_id AND source_type = 'doctor_payment';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_doctor_payment_link(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_doctor_payment_link(BIGINT, BIGINT) TO authenticated;
