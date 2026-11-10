-- sync_tdb_tariffs SECURITY DEFINER idi ve tarifeleri yalnızca profile_id'ye göre
-- siliyordu; klinik/yetki kontrolü yoktu. Artık klinik oturumdan alınır,
-- çağıran bashekim olmalı, profil bu kliniğe ait TDB profili olmalı.

CREATE OR REPLACE FUNCTION public.sync_tdb_tariffs(p_profile_id bigint, p_clinic_id bigint, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id bigint := public.get_my_clinic_id();
BEGIN
  IF v_clinic_id IS NULL OR p_clinic_id IS DISTINCT FROM v_clinic_id THEN
    RAISE EXCEPTION 'Yetkisiz erişim';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND clinic_id = v_clinic_id AND role = 'bashekim'
  ) THEN
    RAISE EXCEPTION 'Bu işlem için yönetici yetkisi gerekir';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tariff_profiles WHERE id = p_profile_id AND clinic_id = v_clinic_id AND source = 'tdb'
  ) THEN
    RAISE EXCEPTION 'Profil bulunamadı';
  END IF;

  DELETE FROM public.tariffs WHERE profile_id = p_profile_id AND clinic_id = v_clinic_id;

  INSERT INTO public.tariffs (clinic_id, profile_id, category, treatment_name, price, currency, is_active)
  SELECT v_clinic_id, p_profile_id,
    (item ->> 'category')::text,
    (item ->> 'treatment_name')::text,
    (item ->> 'price')::bigint,
    coalesce((item ->> 'currency')::text, 'TRY'),
    true
  FROM jsonb_array_elements(p_items) AS item;
END;
$function$;
