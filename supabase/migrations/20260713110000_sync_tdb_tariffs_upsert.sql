-- sync_tdb_tariffs eskiden profilin tüm tarifelerini silip yeniden ekliyordu:
--   * treatments.tariff_id ON DELETE SET NULL -> tedavilerin tarife bağlantısı kayboluyordu,
--   * treatment_plan_items.tariff_item_id kısıtlaması -> silme hata verip senkronizasyon başarısız oluyordu,
--   * tariff_price_history CASCADE ile siliniyordu.
-- Artık yerinde güncelle-veya-ekle (upsert): eşleşen satırın id'si ve özel alanları (visual_schema, süre,
-- renk…) korunur, yalnızca fiyat/para birimi TDB değerine çekilir; listede olmayan kalemlere dokunulmaz.
-- Yetki kontrolleri (oturumdan klinik, bashekim rolü, profil sahipliği) aynen korunur.

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

  -- Gelen kalemler (aynı kategori+ad tekrar ederse sonuncusu geçerli)
  CREATE TEMP TABLE _tdb_incoming ON COMMIT DROP AS
  SELECT DISTINCT ON (category, treatment_name) category, treatment_name, price, currency
  FROM (
    SELECT (item ->> 'category')::text AS category,
           (item ->> 'treatment_name')::text AS treatment_name,
           (item ->> 'price')::bigint AS price,
           coalesce((item ->> 'currency')::text, 'TRY') AS currency
    FROM jsonb_array_elements(p_items) AS item
  ) s
  ORDER BY category, treatment_name;

  -- Mevcut kalemleri yerinde güncelle: id, tedavi/plan bağlantıları ve özel alanlar korunur.
  UPDATE public.tariffs t
  SET price = i.price, currency = i.currency, is_active = true
  FROM _tdb_incoming i
  WHERE t.profile_id = p_profile_id AND t.clinic_id = v_clinic_id
    AND t.category IS NOT DISTINCT FROM i.category
    AND t.treatment_name = i.treatment_name
    AND (t.price IS DISTINCT FROM i.price OR t.currency IS DISTINCT FROM i.currency OR t.is_active IS DISTINCT FROM true);

  -- Yeni kalemleri ekle. Listede olmayan mevcut kalemlere (örn. kullanıcının eklediği özel işlemler) dokunulmaz.
  INSERT INTO public.tariffs (clinic_id, profile_id, category, treatment_name, price, currency, is_active)
  SELECT v_clinic_id, p_profile_id, i.category, i.treatment_name, i.price, i.currency, true
  FROM _tdb_incoming i
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tariffs t
    WHERE t.profile_id = p_profile_id AND t.clinic_id = v_clinic_id
      AND t.category IS NOT DISTINCT FROM i.category AND t.treatment_name = i.treatment_name
  );
END;
$function$;
