-- PERİ ajan araç erişim logu
-- Her hassas tool çağrısında (özellikle anamnez_getir) bu tabloya kayıt düşülür.
-- Kişisel veri içermez: hasta adı değil patient_id, user adı değil user_id.

CREATE TABLE IF NOT EXISTS peri_audit_log (
  id          bigserial    PRIMARY KEY,
  clinic_id   integer      NOT NULL,
  user_id     uuid         NOT NULL,
  patient_id  integer,
  tool_name   text         NOT NULL,
  created_at  timestamptz  DEFAULT now()
);

ALTER TABLE peri_audit_log ENABLE ROW LEVEL SECURITY;

-- Herkes kendi kliniğine insert edebilir
CREATE POLICY "peri_audit_log_insert"
  ON peri_audit_log FOR INSERT
  WITH CHECK (
    clinic_id = (
      SELECT clinic_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Sadece admin / manager okuyabilir
CREATE POLICY "peri_audit_log_select"
  ON peri_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND clinic_id = peri_audit_log.clinic_id
        AND role IN ('admin', 'manager')
    )
  );
