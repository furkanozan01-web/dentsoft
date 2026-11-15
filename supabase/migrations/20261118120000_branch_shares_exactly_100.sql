-- Hisse oranları şube bazlıdır ve bir şubenin hissedar toplamı TAM %100 olmalıdır (eksik veya fazla olamaz).
-- Yazma yalnızca bu fonksiyonla yapılır: şubenin tüm hissedarlarını tek seferde, toplam %100 ise kaydeder.

create or replace function public.set_branch_shares(p_branch_id bigint, p_shares jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic bigint := public.get_my_clinic_id();
  v_role text;
  v_total integer := 0;
  v_seen bigint[] := '{}';
  v_old jsonb;
  e jsonb;
  v_doctor bigint;
  v_rate integer;
begin
  select role into v_role from public.profiles where id = auth.uid() and clinic_id = v_clinic;
  if v_role is distinct from 'bashekim' then
    raise exception 'Hisse oranlarını yalnızca başhekim belirleyebilir';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and clinic_id = v_clinic) then
    raise exception 'Şube bu klinikte bulunamadı';
  end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'En az bir hissedar gerekli';
  end if;

  for e in select * from jsonb_array_elements(p_shares) loop
    v_doctor := (e->>'doctor_id')::bigint;
    v_rate := (e->>'rate_bps')::integer;
    if v_doctor is null or v_rate is null or v_rate < 1 or v_rate > 10000 then
      raise exception 'Hisse oranı yüzde 0,01 ile yüzde 100 arasında olmalı';
    end if;
    if v_doctor = any (v_seen) then
      raise exception 'Aynı hissedar bir şubede birden fazla kez eklenemez';
    end if;
    if not exists (select 1 from public.doctors where id = v_doctor and clinic_id = v_clinic and status <> 'deleted') then
      raise exception 'Hissedar bu klinikte bulunamadı';
    end if;
    v_seen := v_seen || v_doctor;
    v_total := v_total + v_rate;
  end loop;

  if v_total <> 10000 then
    raise exception 'Hisse toplamı tam yüzde 100 olmalı (şu an yüzde %)', to_char(v_total / 100.0, 'FM990D00');
  end if;

  select coalesce(jsonb_object_agg(doctor_id::text, jsonb_build_object('t', profit_distribution_type, 'n', note)), '{}'::jsonb)
    into v_old
    from public.doctor_shares
   where clinic_id = v_clinic and branch_id = p_branch_id;

  delete from public.doctor_shares where clinic_id = v_clinic and branch_id = p_branch_id;

  for e in select * from jsonb_array_elements(p_shares) loop
    v_doctor := (e->>'doctor_id')::bigint;
    insert into public.doctor_shares (clinic_id, doctor_id, branch_id, rate_bps, period, profit_distribution_type, note, is_active)
    values (
      v_clinic, v_doctor, p_branch_id, (e->>'rate_bps')::integer, 'monthly',
      coalesce(v_old->(v_doctor::text)->>'t', 'profit_distribution'),
      v_old->(v_doctor::text)->>'n',
      true
    );
  end loop;
end;
$$;

revoke all on function public.set_branch_shares(bigint, jsonb) from public, anon;
grant execute on function public.set_branch_shares(bigint, jsonb) to authenticated;

-- Doğrudan tablo yazımı kapatılır (toplam kontrolü atlanmasın); okuma değişmez
revoke insert, update, delete on public.doctor_shares from anon, authenticated;
