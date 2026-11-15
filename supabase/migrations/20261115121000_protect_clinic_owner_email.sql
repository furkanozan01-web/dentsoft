-- Klinik sahibi e-postası (firmayı belirler) istemciden değiştirilemez; yalnızca sunucu (service role) yazar.
create or replace function private.protect_owner_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_email is distinct from old.owner_email and auth.role() in ('authenticated', 'anon') then
    raise exception 'Klinik sahibi e-postası istemciden değiştirilemez';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_owner_email_before_update on public.clinic_settings;
create trigger protect_owner_email_before_update
  before update on public.clinic_settings
  for each row execute function private.protect_owner_email();
