-- Aynı T.C. kimlik numarasıyla ikinci hasta kaydını engellemek için T.C.'nin tek yönlü özeti (HMAC-SHA256).
-- T.C. kendisi tc_enc içinde şifreli kalır; tc_hash yalnızca eşleştirme içindir.
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS tc_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS patients_clinic_tc_hash_uq ON public.patients (clinic_id, tc_hash) WHERE tc_hash IS NOT NULL;
