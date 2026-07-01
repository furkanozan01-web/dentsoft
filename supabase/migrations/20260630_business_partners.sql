-- İş Ortakları tablosu
CREATE TABLE IF NOT EXISTS public.business_partners (
  id             BIGSERIAL    PRIMARY KEY,
  clinic_id      BIGINT       NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  name           TEXT         NOT NULL,
  partner_type   TEXT         NOT NULL DEFAULT 'diger',
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  notes          TEXT,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.business_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY bp_clinic_isolation ON public.business_partners
  USING (clinic_id = get_my_clinic_id());

-- Transactions: döviz + iş ortağı sütunları
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS original_currency     TEXT    DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS original_amount       INTEGER,
  ADD COLUMN IF NOT EXISTS exchange_rate         NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS partner_id            BIGINT  REFERENCES public.business_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_transaction_id BIGINT  REFERENCES public.transactions(id)     ON DELETE SET NULL;
