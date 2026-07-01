-- Allow an explicitly confirmed patient deletion to remove all patient-linked records.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey,
  ADD CONSTRAINT appointments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.clinical_notes
  DROP CONSTRAINT IF EXISTS clinical_notes_patient_id_fkey,
  ADD CONSTRAINT clinical_notes_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.patient_images
  DROP CONSTRAINT IF EXISTS patient_images_patient_id_fkey,
  ADD CONSTRAINT patient_images_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.payment_plans
  DROP CONSTRAINT IF EXISTS payment_plans_patient_id_fkey,
  ADD CONSTRAINT payment_plans_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_patient_id_fkey,
  ADD CONSTRAINT prescriptions_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.treatment_followups
  DROP CONSTRAINT IF EXISTS treatment_followups_patient_id_fkey,
  ADD CONSTRAINT treatment_followups_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.followup_steps
  DROP CONSTRAINT IF EXISTS followup_steps_followup_id_fkey,
  ADD CONSTRAINT followup_steps_followup_id_fkey
    FOREIGN KEY (followup_id) REFERENCES public.treatment_followups(id) ON DELETE CASCADE;

ALTER TABLE public.treatment_plans
  DROP CONSTRAINT IF EXISTS treatment_plans_patient_id_fkey,
  ADD CONSTRAINT treatment_plans_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.treatment_plan_items
  DROP CONSTRAINT IF EXISTS treatment_plan_items_plan_id_fkey,
  ADD CONSTRAINT treatment_plan_items_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES public.treatment_plans(id) ON DELETE CASCADE;

ALTER TABLE public.treatment_plan_items
  DROP CONSTRAINT IF EXISTS treatment_plan_items_copied_from_id_fkey,
  ADD CONSTRAINT treatment_plan_items_copied_from_id_fkey
    FOREIGN KEY (copied_from_id) REFERENCES public.treatment_plan_items(id) ON DELETE SET NULL;

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_patient_id_fkey,
  ADD CONSTRAINT treatments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_patient_id_fkey,
  ADD CONSTRAINT transactions_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_treatment_id_fkey,
  ADD CONSTRAINT transactions_treatment_id_fkey
    FOREIGN KEY (treatment_id) REFERENCES public.treatments(id) ON DELETE SET NULL;

ALTER TABLE public.social_content_items
  DROP CONSTRAINT IF EXISTS social_content_items_asset_clinic_fkey,
  ADD CONSTRAINT social_content_items_asset_clinic_fkey
    FOREIGN KEY (asset_id, clinic_id)
    REFERENCES public.social_media_assets(id, clinic_id) ON DELETE CASCADE;

ALTER TABLE public.social_media_assets
  DROP CONSTRAINT IF EXISTS social_media_assets_consent_clinic_fkey,
  ADD CONSTRAINT social_media_assets_consent_clinic_fkey
    FOREIGN KEY (consent_id, clinic_id)
    REFERENCES public.patient_media_consents(id, clinic_id) ON DELETE CASCADE;

ALTER TABLE public.social_media_assets
  DROP CONSTRAINT IF EXISTS social_media_assets_patient_id_fkey,
  ADD CONSTRAINT social_media_assets_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
