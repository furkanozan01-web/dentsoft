-- Migration: tariffs.duration_minutes + clinic_settings.logo_url
-- Tarih: 2026-06-23
-- Açıklama: Randevu süresi ve klinik logo alanları eklendi

-- tariffs tablosuna süre kolonu ekle (nullable, dakika cinsinden)
ALTER TABLE tariffs
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT NULL;

-- clinic_settings tablosuna logo URL kolonu ekle
ALTER TABLE clinic_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;
