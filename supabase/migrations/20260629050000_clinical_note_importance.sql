ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS important_dismissed BOOLEAN NOT NULL DEFAULT false;
