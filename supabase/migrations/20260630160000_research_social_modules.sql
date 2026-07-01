-- Research and social media foundations.
-- All patient-linked records are isolated by clinic_id and protected with RLS.

CREATE TABLE IF NOT EXISTS public.research_saved_searches (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  visible_columns JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(visible_columns) = 'array'),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_tags (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 48),
  color TEXT NOT NULL DEFAULT '#0F766E' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name),
  UNIQUE (id, clinic_id)
);

CREATE TABLE IF NOT EXISTS public.patient_tag_assignments (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_tag_assignments_tag_clinic_fkey
    FOREIGN KEY (tag_id, clinic_id) REFERENCES public.patient_tags(id, clinic_id) ON DELETE CASCADE,
  UNIQUE (patient_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.patient_media_consents (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  consent_date DATE NOT NULL,
  expires_at DATE,
  revoked_at TIMESTAMPTZ,
  document_path TEXT,
  scope TEXT NOT NULL DEFAULT 'social_media',
  platforms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, clinic_id),
  CHECK (expires_at IS NULL OR expires_at >= consent_date),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.social_media_assets (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  patient_id BIGINT REFERENCES public.patients(id) ON DELETE SET NULL,
  source_patient_image_id BIGINT REFERENCES public.patient_images(id) ON DELETE SET NULL,
  consent_id BIGINT,
  storage_bucket TEXT NOT NULL CHECK (storage_bucket IN ('patient-images', 'social-media')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  category TEXT NOT NULL DEFAULT 'bilgilendirici',
  caption TEXT,
  patient_related BOOLEAN NOT NULL DEFAULT false,
  identity_visible BOOLEAN NOT NULL DEFAULT false,
  face_visible BOOLEAN NOT NULL DEFAULT false,
  is_before_after BOOLEAN NOT NULL DEFAULT false,
  publish_eligible BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_media_assets_consent_clinic_fkey
    FOREIGN KEY (consent_id, clinic_id) REFERENCES public.patient_media_consents(id, clinic_id) ON DELETE RESTRICT,
  UNIQUE (id, clinic_id),
  UNIQUE (clinic_id, storage_bucket, storage_path),
  CHECK (NOT patient_related OR patient_id IS NOT NULL),
  CHECK (NOT publish_eligible OR NOT patient_related OR consent_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.social_content_packages (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description TEXT,
  hashtags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  platforms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  publication_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'awaiting_approval', 'ready', 'published', 'archived')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, clinic_id)
);

CREATE TABLE IF NOT EXISTS public.social_content_items (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL,
  asset_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_content_items_package_clinic_fkey
    FOREIGN KEY (package_id, clinic_id) REFERENCES public.social_content_packages(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT social_content_items_asset_clinic_fkey
    FOREIGN KEY (asset_id, clinic_id) REFERENCES public.social_media_assets(id, clinic_id) ON DELETE RESTRICT,
  UNIQUE (package_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_research_saved_searches_clinic_user
  ON public.research_saved_searches (clinic_id, created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_tags_clinic_name
  ON public.patient_tags (clinic_id, name);
CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_clinic_patient
  ON public.patient_tag_assignments (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_clinic_tag
  ON public.patient_tag_assignments (clinic_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_patient_media_consents_clinic_patient_status
  ON public.patient_media_consents (clinic_id, patient_id, status, consent_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_media_assets_clinic_category
  ON public.social_media_assets (clinic_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_media_assets_clinic_patient
  ON public.social_media_assets (clinic_id, patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_content_packages_clinic_status
  ON public.social_content_packages (clinic_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_content_items_clinic_package
  ON public.social_content_items (clinic_id, package_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_research_social_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_social_asset_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  consent_valid BOOLEAN;
BEGIN
  IF NEW.patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'Patient does not belong to the active clinic';
  END IF;

  IF NEW.source_patient_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patient_images i
    WHERE i.id = NEW.source_patient_image_id
      AND i.clinic_id = NEW.clinic_id
      AND (NEW.patient_id IS NULL OR i.patient_id = NEW.patient_id)
  ) THEN
    RAISE EXCEPTION 'Source image does not belong to the active clinic and patient';
  END IF;

  IF NEW.patient_related THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = NEW.patient_id AND p.clinic_id = NEW.clinic_id
    ) THEN
      RAISE EXCEPTION 'Patient does not belong to the active clinic';
    END IF;

    IF NEW.publish_eligible THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.patient_media_consents c
        WHERE c.id = NEW.consent_id
          AND c.clinic_id = NEW.clinic_id
          AND c.patient_id = NEW.patient_id
          AND c.status = 'active'
          AND c.consent_date <= CURRENT_DATE
          AND (c.expires_at IS NULL OR c.expires_at >= CURRENT_DATE)
      ) INTO consent_valid;

      IF NOT consent_valid THEN
        RAISE EXCEPTION 'An active patient media consent is required';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_social_content_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.social_media_assets a
    LEFT JOIN public.patient_media_consents c
      ON c.id = a.consent_id AND c.clinic_id = a.clinic_id
    WHERE a.id = NEW.asset_id
      AND a.clinic_id = NEW.clinic_id
      AND a.publish_eligible = true
      AND (
        a.patient_related = false
        OR (
          c.patient_id = a.patient_id
          AND c.status = 'active'
          AND c.consent_date <= CURRENT_DATE
          AND (c.expires_at IS NULL OR c.expires_at >= CURRENT_DATE)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Asset is not eligible for social media publishing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_research_saved_searches_updated_at ON public.research_saved_searches;
CREATE TRIGGER trg_research_saved_searches_updated_at
  BEFORE UPDATE ON public.research_saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_research_social_updated_at();

DROP TRIGGER IF EXISTS trg_patient_media_consents_updated_at ON public.patient_media_consents;
CREATE TRIGGER trg_patient_media_consents_updated_at
  BEFORE UPDATE ON public.patient_media_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_research_social_updated_at();

DROP TRIGGER IF EXISTS trg_social_media_assets_updated_at ON public.social_media_assets;
CREATE TRIGGER trg_social_media_assets_updated_at
  BEFORE UPDATE ON public.social_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_research_social_updated_at();

DROP TRIGGER IF EXISTS trg_social_content_packages_updated_at ON public.social_content_packages;
CREATE TRIGGER trg_social_content_packages_updated_at
  BEFORE UPDATE ON public.social_content_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_research_social_updated_at();

DROP TRIGGER IF EXISTS trg_social_media_assets_validate_consent ON public.social_media_assets;
CREATE TRIGGER trg_social_media_assets_validate_consent
  BEFORE INSERT OR UPDATE ON public.social_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.validate_social_asset_consent();

DROP TRIGGER IF EXISTS trg_social_content_items_validate ON public.social_content_items;
CREATE TRIGGER trg_social_content_items_validate
  BEFORE INSERT OR UPDATE ON public.social_content_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_social_content_item();

ALTER TABLE public.research_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_media_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY research_saved_searches_select ON public.research_saved_searches
  FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY research_saved_searches_insert ON public.research_saved_searches
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY research_saved_searches_update ON public.research_saved_searches
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY research_saved_searches_delete ON public.research_saved_searches
  FOR DELETE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()));

CREATE POLICY patient_tags_select ON public.patient_tags
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY patient_tags_insert ON public.patient_tags
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY patient_tags_update ON public.patient_tags
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY patient_tags_delete ON public.patient_tags
  FOR DELETE TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY patient_tag_assignments_select ON public.patient_tag_assignments
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY patient_tag_assignments_insert ON public.patient_tag_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id AND p.clinic_id = (SELECT public.get_my_clinic_id())
    )
  );
CREATE POLICY patient_tag_assignments_delete ON public.patient_tag_assignments
  FOR DELETE TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY patient_media_consents_select ON public.patient_media_consents
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY patient_media_consents_insert ON public.patient_media_consents
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id AND p.clinic_id = (SELECT public.get_my_clinic_id())
    )
  );
CREATE POLICY patient_media_consents_update ON public.patient_media_consents
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()))
  WITH CHECK (
    clinic_id = (SELECT public.get_my_clinic_id())
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id AND p.clinic_id = (SELECT public.get_my_clinic_id())
    )
  );
CREATE POLICY patient_media_consents_delete ON public.patient_media_consents
  FOR DELETE TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY social_media_assets_select ON public.social_media_assets
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_media_assets_insert ON public.social_media_assets
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY social_media_assets_update ON public.social_media_assets
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_media_assets_delete ON public.social_media_assets
  FOR DELETE TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY social_content_packages_select ON public.social_content_packages
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_content_packages_insert ON public.social_content_packages
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND created_by = (SELECT auth.uid()));
CREATE POLICY social_content_packages_update ON public.social_content_packages
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_content_packages_delete ON public.social_content_packages
  FOR DELETE TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY social_content_items_select ON public.social_content_items
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_content_items_insert ON public.social_content_items
  FOR INSERT TO authenticated WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_content_items_update ON public.social_content_items
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()));
CREATE POLICY social_content_items_delete ON public.social_content_items
  FOR DELETE TO authenticated USING (clinic_id = (SELECT public.get_my_clinic_id()));

-- Explicit Data API grants are required by newer Supabase projects.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_saved_searches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.patient_tag_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_media_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.research_saved_searches_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.patient_tags_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.patient_tag_assignments_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.patient_media_consents_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.social_media_assets_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.social_content_packages_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.social_content_items_id_seq TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('social-media', 'social-media', false, 20971520,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']),
  ('consent-documents', 'consent-documents', false, 10485760,
   ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY social_media_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
CREATE POLICY social_media_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
CREATE POLICY social_media_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  )
  WITH CHECK (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
CREATE POLICY social_media_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );

CREATE POLICY consent_documents_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'consent-documents'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
CREATE POLICY consent_documents_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consent-documents'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
CREATE POLICY consent_documents_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'consent-documents'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  )
  WITH CHECK (
    bucket_id = 'consent-documents'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
CREATE POLICY consent_documents_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'consent-documents'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_clinic_id())::text
  );
