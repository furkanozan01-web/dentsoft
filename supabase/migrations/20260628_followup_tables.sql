-- Takip sekmesi: uzun süreli tedavi adım takibi
-- 3 tablo: followup_templates, treatment_followups, followup_steps

-- Kliniğe özgü hazır şablonlar (opsiyonel, ileride şablon yönetimi için)
CREATE TABLE IF NOT EXISTS followup_templates (
  id          SERIAL PRIMARY KEY,
  clinic_id   INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  steps       JSONB   NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE followup_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY followup_templates_clinic_isolation ON followup_templates
  FOR ALL USING (clinic_id = get_my_clinic_id());

-- Hastaya bağlı takip planı
CREATE TABLE IF NOT EXISTS treatment_followups (
  id          SERIAL PRIMARY KEY,
  clinic_id   INTEGER NOT NULL,
  patient_id  INTEGER NOT NULL REFERENCES patients(id),
  title       TEXT    NOT NULL,
  start_date  DATE    NOT NULL,
  notes       TEXT,
  status      TEXT    NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE treatment_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY treatment_followups_clinic_isolation ON treatment_followups
  FOR ALL USING (clinic_id = get_my_clinic_id());

-- Takip planının her aşaması
CREATE TABLE IF NOT EXISTS followup_steps (
  id             SERIAL PRIMARY KEY,
  clinic_id      INTEGER NOT NULL,
  followup_id    INTEGER NOT NULL REFERENCES treatment_followups(id) ON DELETE CASCADE,
  title          TEXT    NOT NULL,
  scheduled_date DATE,
  completed_at   TIMESTAMPTZ,
  notes          TEXT,
  step_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE followup_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY followup_steps_clinic_isolation ON followup_steps
  FOR ALL USING (clinic_id = get_my_clinic_id());

-- İndeksler
CREATE INDEX IF NOT EXISTS treatment_followups_patient_id_idx ON treatment_followups(patient_id);
CREATE INDEX IF NOT EXISTS followup_steps_followup_id_idx ON followup_steps(followup_id);
CREATE INDEX IF NOT EXISTS followup_steps_scheduled_date_idx ON followup_steps(scheduled_date);
