-- Partner ve hakediş kayıtlarındaki yabancı anahtar sorgularını hızlandırır.

CREATE INDEX IF NOT EXISTS doctor_payments_created_by_idx
  ON public.doctor_payments(created_by);

CREATE INDEX IF NOT EXISTS partner_services_partner_id_idx
  ON public.partner_services(partner_id);

CREATE INDEX IF NOT EXISTS partner_services_patient_id_idx
  ON public.partner_services(patient_id);

CREATE INDEX IF NOT EXISTS partner_services_doctor_id_idx
  ON public.partner_services(doctor_id);

CREATE INDEX IF NOT EXISTS partner_services_created_by_idx
  ON public.partner_services(created_by);
