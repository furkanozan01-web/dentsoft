-- Ödeme yöntemi kısıtı 'senet', 'check' (çek) ve 'firma_odemesi' değerlerini reddediyordu:
-- Firma Ödemesi ve Senet ile hasta ödemesi kaydedilemiyor, defterde Çek gideri kaydedilemiyordu.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_method_check
  CHECK (method IS NULL OR method = ANY (ARRAY['cash','card','transfer','check','senet','firma_odemesi','other']));
