ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS tc_enc TEXT,
  ADD COLUMN IF NOT EXISTS diploma_date DATE,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS guarantee_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guarantee_period TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS guarantee_method TEXT NOT NULL DEFAULT 'minimum_total',
  ADD COLUMN IF NOT EXISTS guarantee_note TEXT,
  ADD COLUMN IF NOT EXISTS share_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_rate_bps INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_start_date DATE,
  ADD COLUMN IF NOT EXISTS share_end_date DATE,
  ADD COLUMN IF NOT EXISTS share_branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_period TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS share_note TEXT,
  ADD COLUMN IF NOT EXISTS profit_distribution_type TEXT NOT NULL DEFAULT 'profit_distribution';

ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_guarantee_period_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_guarantee_period_check
  CHECK (guarantee_period IN ('monthly','quarterly','yearly'));
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_guarantee_method_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_guarantee_method_check
  CHECK (guarantee_method IN ('minimum_total','commission_only'));
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_share_rate_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_share_rate_check
  CHECK (share_rate_bps BETWEEN 0 AND 10000);
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_share_dates_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_share_dates_check
  CHECK (share_end_date IS NULL OR share_start_date IS NULL OR share_end_date >= share_start_date);
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_share_period_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_share_period_check
  CHECK (share_period IN ('monthly','quarterly','yearly'));
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_profit_distribution_type_check;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_profit_distribution_type_check
  CHECK (profit_distribution_type IN ('expense','profit_distribution','partner_payment'));

CREATE INDEX IF NOT EXISTS doctors_share_branch_idx ON public.doctors(share_branch_id);

-- Eski model seçimlerini bağımsız alanlara dönüştürür; mevcut tutarlar korunur.
UPDATE public.doctors
SET guarantee_active = true
WHERE payment_model = 'guarantee' AND COALESCE(guarantee_amount, 0) > 0;
