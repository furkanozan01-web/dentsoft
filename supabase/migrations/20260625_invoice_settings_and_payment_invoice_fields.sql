-- Migration: invoice settings + payment invoice metadata
-- Aciklama: Fatura gonderim kurumu ve odeme uzerinden e-fatura/e-SMM kaydi icin ek alanlar.

ALTER TABLE clinic_settings
  ADD COLUMN IF NOT EXISTS invoice_institution TEXT DEFAULT NULL;

ALTER TABLE clinic_settings
  ALTER COLUMN vat_rate SET DEFAULT 1000;

UPDATE clinic_settings
SET vat_rate = 1000
WHERE vat_rate IS NULL OR vat_rate = 2000;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_institution TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_line_description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_amount INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_vat_rate INTEGER DEFAULT NULL;
