-- İzinler: "Hesap" ve Finans (Bilgi, Borçlar, Defter, Bakiye) şube ve tüm olarak ayrılır.
-- Mevcut değerler her iki yeni kaynağa aynen kopyalanır (davranış değişmez); sonra eski kaynaklar silinir.
do $$
declare
  m record;
  suffix text;
begin
  for m in
    select * from (values
      ('hesap', 'hesap'),
      ('finans_bilgi', 'finans_bilgi'),
      ('finans_borclar', 'finans_borclar'),
      ('finans_defter', 'finans_defter'),
      ('finans_bakiye', 'finans_bakiye')
    ) as t(old_key, base)
  loop
    foreach suffix in array array['_sube', '_tum'] loop
      insert into public.role_permissions (clinic_id, role_name, resource, can_view, can_create, can_update, can_delete)
      select clinic_id, role_name, m.base || suffix, can_view, can_create, can_update, can_delete
      from public.role_permissions where resource = m.old_key
      on conflict (clinic_id, role_name, resource) do nothing;
    end loop;
    delete from public.role_permissions where resource = m.old_key;

    -- Kişiye özel istisnalar da aynı şekilde
    foreach suffix in array array['_sube', '_tum'] loop
      insert into public.user_permissions (clinic_id, user_id, resource, can_view, can_create, can_update, can_delete)
      select clinic_id, user_id, m.base || suffix, can_view, can_create, can_update, can_delete
      from public.user_permissions where resource = m.old_key
      on conflict do nothing;
    end loop;
    delete from public.user_permissions where resource = m.old_key;
  end loop;
end $$;
