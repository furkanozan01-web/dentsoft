-- Migration: tariffs.color
-- Aciklama: Randevu takviminde tedaviye gore renk kodu kullanimi icin tarife rengi.

ALTER TABLE tariffs
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tariffs_color_hex_chk'
  ) THEN
    ALTER TABLE tariffs
      ADD CONSTRAINT tariffs_color_hex_chk
      CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;
