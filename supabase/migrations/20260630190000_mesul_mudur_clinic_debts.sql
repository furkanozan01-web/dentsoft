-- is_mesul_mudur: hangi hekimin tüm hakediş verilerini görebileceğini belirler
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS is_mesul_mudur BOOLEAN NOT NULL DEFAULT false;

-- Klinik borçları (sabit giderler, kredi ödemeleri, vb.)
CREATE TABLE IF NOT EXISTS public.clinic_debts (
  id            BIGSERIAL    PRIMARY KEY,
  clinic_id     BIGINT       NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  title         TEXT         NOT NULL,
  total_amount  INTEGER      NOT NULL,  -- kuruş
  paid_amount   INTEGER      NOT NULL DEFAULT 0,  -- kuruş
  due_date      DATE,
  recurrence    TEXT         NOT NULL DEFAULT 'tek_seferlik',  -- tek_seferlik | aylik | yillik
  notes         TEXT,
  status        TEXT         NOT NULL DEFAULT 'active',  -- active | paid | cancelled
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_debts_clinic_isolation ON public.clinic_debts
  USING (clinic_id = get_my_clinic_id());
