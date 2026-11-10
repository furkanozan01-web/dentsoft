-- doctor_payments.payment_type CHECK kısıtı yalnızca ara_odeme/mahsuplasma/
-- avans/prim değerlerine izin veriyordu — ancak record_doctor_payment() RPC'si
-- (ve EarningsDashboard/Kasa UI'ları) maas/garantor/kar_payi/duzeltme
-- değerlerini de üretiyor. Bu tür bir ödeme kaydedilmeye çalışıldığında
-- (örn. kâr payı dağıtımı, maaş ödemesi) sessizce constraint violation
-- hatası veriyordu. Kısıtı gerçek uygulama alanıyla eşleştir.

ALTER TABLE public.doctor_payments DROP CONSTRAINT doctor_payments_payment_type_check;
ALTER TABLE public.doctor_payments ADD CONSTRAINT doctor_payments_payment_type_check
  CHECK (payment_type = ANY (ARRAY['maas'::text, 'ara_odeme'::text, 'mahsuplasma'::text, 'avans'::text, 'prim'::text, 'garantor'::text, 'kar_payi'::text, 'duzeltme'::text]));
