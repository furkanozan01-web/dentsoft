-- Hekim "göreve başlama tarihi": sabit maaş birikimi (alacak) bu tarihten itibaren hesaplanır.
-- Boş bırakılırsa birikim içinde bulunulan aydan başlar.
alter table public.doctors add column if not exists start_date date;
comment on column public.doctors.start_date is 'Göreve başlama tarihi: sabit maaş birikimi bu tarihten başlar (boşsa bu aydan).';
