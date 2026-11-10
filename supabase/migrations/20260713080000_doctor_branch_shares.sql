-- Kasa (şube kasası) özelliği: hekim hissesini tekli alandan çoklu-şube
-- listesine taşır ve havuz bazlı kâr payı dağıtım RPC'sini ekler.

CREATE TABLE public.doctor_shares (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  doctor_id BIGINT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (rate_bps BETWEEN 0 AND 10000),
  start_date DATE,
  end_date DATE,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','quarterly','yearly')),
  profit_distribution_type TEXT NOT NULL DEFAULT 'profit_distribution'
    CHECK (profit_distribution_type IN ('expense','profit_distribution','partner_payment')),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT doctor_shares_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX doctor_shares_active_pair_idx
  ON public.doctor_shares (doctor_id, branch_id) WHERE is_active;
CREATE INDEX doctor_shares_branch_idx ON public.doctor_shares (clinic_id, branch_id) WHERE is_active;
CREATE INDEX doctor_shares_doctor_idx ON public.doctor_shares (doctor_id);

-- Backfill: mevcut tekli share_* alanlarından taşı.
-- share_branch_id NULL ise (klinik geneli), o kliniğin varsayılan şubesine yaz.
INSERT INTO public.doctor_shares (clinic_id, doctor_id, branch_id, rate_bps, start_date, end_date, period, profit_distribution_type, note)
SELECT d.clinic_id, d.id,
       COALESCE(d.share_branch_id, (SELECT b.id FROM public.branches b WHERE b.clinic_id = d.clinic_id AND b.is_default LIMIT 1)),
       d.share_rate_bps, d.share_start_date, d.share_end_date, d.share_period, d.profit_distribution_type, d.share_note
FROM public.doctors d
WHERE d.share_active AND d.share_rate_bps > 0
  AND COALESCE(d.share_branch_id, (SELECT b.id FROM public.branches b WHERE b.clinic_id = d.clinic_id AND b.is_default LIMIT 1)) IS NOT NULL;

ALTER TABLE public.doctors
  DROP COLUMN IF EXISTS share_active,
  DROP COLUMN IF EXISTS share_rate_bps,
  DROP COLUMN IF EXISTS share_start_date,
  DROP COLUMN IF EXISTS share_end_date,
  DROP COLUMN IF EXISTS share_branch_id,
  DROP COLUMN IF EXISTS share_period,
  DROP COLUMN IF EXISTS share_note,
  DROP COLUMN IF EXISTS profit_distribution_type;

ALTER TABLE public.doctor_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY doctor_shares_clinic_isolation ON public.doctor_shares
  USING (clinic_id = public.get_my_clinic_id());
CREATE POLICY doctor_shares_branch_restriction ON public.doctor_shares AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (private.can_access_branch(branch_id)) WITH CHECK (private.can_access_branch(branch_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_shares TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.doctor_shares_id_seq TO authenticated;

-- ─── Havuz bazlı kâr payı dağıtımı ─────────────────────────────────────────
-- Girilen toplam tutarı, seçili şubenin (tarih aralığı geçerli) aktif tüm
-- hissedarlarına oranlarına göre böler; her biri için record_doctor_payment
-- ile aynı iki-tablo (transactions + doctor_payments) yazım desenini uygular.
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
      AND (p.role IN ('admin','clinic_manager','responsible_manager') OR d.is_mesul_mudur = true)
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
