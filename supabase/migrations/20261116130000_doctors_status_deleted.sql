-- Hekim "silme" = gizleme: listelerden kalkar, geçmiş kayıtları (tedavi, ödeme, reçete, hakediş) korunur.
alter table public.doctors drop constraint if exists doctors_status_check;
alter table public.doctors
  add constraint doctors_status_check check (status = any (array['active'::text, 'passive'::text, 'deleted'::text]));
