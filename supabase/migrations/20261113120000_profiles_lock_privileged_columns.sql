-- Güvenlik: kullanıcı kendi profilindeki yetki sütunlarını (role, clinic_id, branch_id,
-- active_branch_id, doctor_id, access_level) istemciden değiştirememeli.
-- Rol / şube değişiklikleri yalnızca sunucu tarafında (service role) yapılır.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;
