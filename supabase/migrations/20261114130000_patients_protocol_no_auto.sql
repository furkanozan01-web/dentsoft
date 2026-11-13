-- Protokol numarası: her yeni hastaya otomatik, P0001 biçiminde (4 hane), klinik başına benzersiz.
-- 1) Mevcut hastalar kayıt sırasına göre yeniden numaralanır.
with ordered as (
  select id, row_number() over (partition by clinic_id order by coalesce(reg_date, created_at::date), created_at, id) as rn
  from public.patients
)
update public.patients p
set protocol_no = 'P' || lpad(o.rn::text, 4, '0')
from ordered o
where o.id = p.id;

-- 2) Eşzamanlı kayıtlarda çift numara olmasın
create unique index if not exists patients_clinic_protocol_uidx
  on public.patients (clinic_id, protocol_no)
  where protocol_no is not null;

-- 3) Numara boşsa eklemede otomatik ata (RLS'ten bağımsız görmek için security definer)
create or replace function private.assign_protocol_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if new.protocol_no is null or new.protocol_no = '' then
    perform pg_advisory_xact_lock(hashtext('patients_protocol_' || new.clinic_id::text));
    select coalesce(max(substr(protocol_no, 2)::integer), 0) + 1
      into n
      from public.patients
     where clinic_id = new.clinic_id and protocol_no ~ '^P[0-9]+$';
    new.protocol_no := 'P' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists assign_protocol_no_before_insert on public.patients;
create trigger assign_protocol_no_before_insert
  before insert on public.patients
  for each row execute function private.assign_protocol_no();
