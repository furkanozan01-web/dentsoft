-- Giriş: E-posta (klinik sahibi, firmayı belirler) + kullanıcı adı + şifre.
-- Aynı e-posta altında farklı kullanıcılar farklı kullanıcı adıyla girer.

-- Klinik sahibinin e-postası: hangi firmanın açılacağını belirler (benzersiz)
alter table public.clinic_settings add column if not exists owner_email text;
create unique index if not exists clinic_settings_owner_email_uidx
  on public.clinic_settings (lower(owner_email)) where owner_email is not null;

-- Kullanıcı adı: klinik içinde benzersiz (büyük/küçük harf duyarsız)
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_clinic_username_uidx
  on public.profiles (clinic_id, lower(username)) where username is not null;

-- Mevcut ana hesap: başhekim profilinin e-postası klinik sahibi e-postası olur, kullanıcı adı 'bashekim'
update public.clinic_settings c
set owner_email = lower(u.email)
from public.profiles p
join auth.users u on u.id = p.id
where p.clinic_id = c.id and p.role = 'bashekim' and c.owner_email is null;

update public.profiles
set username = 'bashekim'
where role = 'bashekim' and username is null;
