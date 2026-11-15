-- Tarifeye masraf (kuruş) eklenir: lab, malzeme vb. Hekim komisyonu masraf düşüldükten sonraki kâr üzerinden hesaplanır.
alter table public.tariffs add column if not exists cost integer not null default 0;
comment on column public.tariffs.cost is 'Tedavi masrafı (kuruş): lab, malzeme vb. Hekim komisyonu masraf düşüldükten sonraki kâr üzerinden hesaplanır.';
