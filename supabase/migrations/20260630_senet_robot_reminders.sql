-- Senet Robotu: taksit planı grupları
CREATE TABLE IF NOT EXISTS public.payment_plan_groups (
  id         BIGSERIAL    PRIMARY KEY,
  clinic_id  BIGINT       NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  patient_id BIGINT       NOT NULL REFERENCES public.patients(id)        ON DELETE CASCADE,
  title      TEXT         NOT NULL DEFAULT 'Senet Planı',
  interest_rate_bps INTEGER NOT NULL DEFAULT 0,  -- 100 = %1
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans
  ADD COLUMN IF NOT EXISTS group_id BIGINT REFERENCES public.payment_plan_groups(id) ON DELETE SET NULL;

-- Borç Özeti Hatırlatıcısı
CREATE TABLE IF NOT EXISTS public.patient_reminders (
  id            BIGSERIAL    PRIMARY KEY,
  clinic_id     UUID         NOT NULL REFERENCES public.clinics(id)   ON DELETE CASCADE,
  patient_id    BIGINT       NOT NULL REFERENCES public.patients(id)  ON DELETE CASCADE,
  reminder_date DATE         NOT NULL,
  note          TEXT,
  is_done       BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.payment_plan_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppg_clinic_isolation ON public.payment_plan_groups
  USING (clinic_id = get_my_clinic_id());

ALTER TABLE public.patient_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_clinic_isolation ON public.patient_reminders
  USING (clinic_id = get_my_clinic_id());
