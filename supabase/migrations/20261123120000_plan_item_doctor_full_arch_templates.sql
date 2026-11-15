-- Planlama/Faz kalemlerinde işlemi yapacak hekim; "Tüm Çene Porselen / Zirkonyum" tedavi şablonları.

alter table public.treatment_plan_items
  add column if not exists doctor_id bigint references public.doctors(id) on delete set null;

-- Tüm çene restorasyon şablonları: her tarife profiline (yoksa) eklenir; fiyatı klinik Ayarlar > Tarife'den girer.
insert into public.tariffs (clinic_id, profile_id, treatment_name, category, price, visual_schema, application_region, is_active, currency)
select p.clinic_id, p.id, v.name, 'Protez', 0, v.schema, 'Tüm çene', true, 'TRY'
from public.tariff_profiles p
cross join (values
  ('Tüm Çene Porselen Kuron', 'crown'),
  ('Tüm Çene Zirkonyum Kuron', 'zirconium')
) as v(name, schema)
where not exists (
  select 1 from public.tariffs t where t.profile_id = p.id and t.treatment_name = v.name
);
