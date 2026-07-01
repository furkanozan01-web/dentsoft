CREATE INDEX IF NOT EXISTS idx_clinical_notes_clinic_patient_created
  ON public.clinical_notes (clinic_id, patient_id, created_at DESC);
