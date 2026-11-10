-- Güvenlik: anon artık sync_tdb_tariffs çağıramaz; sabit search_path.
REVOKE EXECUTE ON FUNCTION public.sync_tdb_tariffs(bigint, bigint, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_tdb_tariffs(bigint, bigint, jsonb) TO authenticated, service_role;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.check_prescription_safety(text, text[]) SET search_path = public;

-- RLS: auth.uid() satır başına değil bir kez hesaplanır.
ALTER POLICY profiles_own ON public.profiles USING (id = (select auth.uid()));
ALTER POLICY peri_audit_log_insert ON public.peri_audit_log
  WITH CHECK (clinic_id = (SELECT profiles.clinic_id FROM public.profiles WHERE profiles.id = (select auth.uid())));
ALTER POLICY peri_audit_log_select ON public.peri_audit_log
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.clinic_id = peri_audit_log.clinic_id AND profiles.role = 'bashekim'));

-- Performans: sık kullanılan tablolardaki eksik yabancı anahtar dizinleri.
CREATE INDEX IF NOT EXISTS treatments_doctor_id_fkidx ON public.treatments (doctor_id);
CREATE INDEX IF NOT EXISTS treatments_tariff_id_fkidx ON public.treatments (tariff_id);
CREATE INDEX IF NOT EXISTS transactions_treatment_id_fkidx ON public.transactions (treatment_id);
CREATE INDEX IF NOT EXISTS transactions_partner_id_fkidx ON public.transactions (partner_id);
CREATE INDEX IF NOT EXISTS transactions_linked_tx_fkidx ON public.transactions (linked_transaction_id);
CREATE INDEX IF NOT EXISTS profiles_doctor_id_fkidx ON public.profiles (doctor_id);
CREATE INDEX IF NOT EXISTS prescriptions_doctor_id_fkidx ON public.prescriptions (doctor_id);
CREATE INDEX IF NOT EXISTS prescriptions_clinic_id_fkidx ON public.prescriptions (clinic_id);
CREATE INDEX IF NOT EXISTS payment_plans_group_id_fkidx ON public.payment_plans (group_id);
CREATE INDEX IF NOT EXISTS payment_plans_clinic_id_fkidx ON public.payment_plans (clinic_id);
CREATE INDEX IF NOT EXISTS payment_plan_groups_patient_fkidx ON public.payment_plan_groups (patient_id);
CREATE INDEX IF NOT EXISTS tariffs_profile_id_fkidx ON public.tariffs (profile_id);
CREATE INDEX IF NOT EXISTS patient_reminders_patient_fkidx ON public.patient_reminders (patient_id);
CREATE INDEX IF NOT EXISTS clinical_notes_doctor_fkidx ON public.clinical_notes (doctor_id);
CREATE INDEX IF NOT EXISTS treatment_plans_clinic_fkidx ON public.treatment_plans (clinic_id);
CREATE INDEX IF NOT EXISTS doctor_shares_branch_fkidx ON public.doctor_shares (branch_id);
