-- Preserve the original tariff fee and allow completed accounts to be hidden.
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS original_fee INTEGER,
  ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;

UPDATE public.treatments
SET original_fee = fee
WHERE original_fee IS NULL;

UPDATE public.treatments
SET is_closed = false
WHERE is_closed IS NULL;
