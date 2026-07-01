-- Cover foreign keys used by research and social media delete/join paths.

CREATE INDEX IF NOT EXISTS idx_research_saved_searches_created_by
  ON public.research_saved_searches (created_by);

CREATE INDEX IF NOT EXISTS idx_patient_tags_created_by
  ON public.patient_tags (created_by);

CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_created_by
  ON public.patient_tag_assignments (created_by);
CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_tag_clinic
  ON public.patient_tag_assignments (tag_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_patient_media_consents_patient
  ON public.patient_media_consents (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_media_consents_created_by
  ON public.patient_media_consents (created_by);

CREATE INDEX IF NOT EXISTS idx_social_media_assets_patient
  ON public.social_media_assets (patient_id);
CREATE INDEX IF NOT EXISTS idx_social_media_assets_source_image
  ON public.social_media_assets (source_patient_image_id);
CREATE INDEX IF NOT EXISTS idx_social_media_assets_consent_clinic
  ON public.social_media_assets (consent_id, clinic_id);
CREATE INDEX IF NOT EXISTS idx_social_media_assets_created_by
  ON public.social_media_assets (created_by);

CREATE INDEX IF NOT EXISTS idx_social_content_packages_created_by
  ON public.social_content_packages (created_by);

CREATE INDEX IF NOT EXISTS idx_social_content_items_package_clinic
  ON public.social_content_items (package_id, clinic_id);
CREATE INDEX IF NOT EXISTS idx_social_content_items_asset_clinic
  ON public.social_content_items (asset_id, clinic_id);
