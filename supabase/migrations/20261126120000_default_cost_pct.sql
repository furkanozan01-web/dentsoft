-- Varsayılan masraf oranı: tedavide masraf (cost) girilmemişse hakedişte ücretin bu yüzdesi masraf sayılır.
-- Baz puan: 1000 = %10. Değer Ayarlar > Tarife > "Varsayılan masraf oranı" alanından değiştirilir.
alter table public.clinic_settings
  add column if not exists default_cost_bps integer not null default 1000
  check (default_cost_bps between 0 and 10000);
