-- Tedavi sekmesine alınan işlem "yapıldı" sayılır (planlama/faz işlemleri ayrı tablolarda tutulur).
-- Mevcut 'planned' tedaviler 'done' yapılır; tutar, ödeme ve hakediş rakamları değişmez.
update public.treatments set status = 'done', updated_at = now() where status = 'planned';
