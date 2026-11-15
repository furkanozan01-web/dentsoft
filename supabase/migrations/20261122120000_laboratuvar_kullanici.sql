-- Laboratuvar kullanıcısı: bir iş ortağına (laboratuvar) bağlı, yalnızca kendi portalını kullanan dış kullanıcı.
-- GÜVENLİK: laboratuvar rolü RLS'te "kliniksiz" sayılır (get_my_clinic_id() NULL döner); böylece tarayıcıdan
-- doğrudan Supabase'e erişse bile hasta, finans vb. hiçbir tabloyu okuyamaz/yazamaz. Portal, sunucuda
-- service role ile ve yalnızca kendi iş ortağı kayıtlarıyla sınırlı çalışır.

alter table public.profiles
  add column if not exists partner_id bigint references public.business_partners(id) on delete set null;

create or replace function public.get_my_clinic_id()
returns bigint
language sql
stable security definer
set search_path to 'public'
as $function$
  select clinic_id from public.profiles where id = auth.uid() and role <> 'laboratuvar'
$function$;

-- Hızlı giriş kalemleri (örn. Porselen = birim fiyat); laboratuvar kendi kalemlerini yönetir
create table if not exists public.partner_quick_items (
  id bigserial primary key,
  clinic_id bigint not null references public.clinic_settings(id) on delete cascade,
  partner_id bigint not null references public.business_partners(id) on delete cascade,
  name text not null,
  unit_price integer not null check (unit_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists partner_quick_items_partner_idx on public.partner_quick_items (partner_id);

alter table public.partner_quick_items enable row level security;
drop policy if exists partner_quick_items_clinic_isolation on public.partner_quick_items;
create policy partner_quick_items_clinic_isolation on public.partner_quick_items
  for all
  using (clinic_id = (select public.get_my_clinic_id()))
  with check (clinic_id = (select public.get_my_clinic_id()));

-- İş ortağı hizmet kaydına adet / birim fiyat ve "laboratuvarın kendisi bildirdi" bilgisi
alter table public.partner_services
  add column if not exists quantity integer not null default 1,
  add column if not exists unit_price integer,
  add column if not exists reported_by_partner boolean not null default false;

-- Rol listesine 'laboratuvar' eklenir (yalnızca profiles; allowlist/role_permissions bu rolü kullanmaz)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['bashekim'::text, 'responsible_manager'::text, 'hekim'::text, 'asistan'::text, 'laboratuvar'::text]));
