-- Kasa sistemi kaldırıldı: kâr payı dağıtımı artık kasa bakiyesine bağlı değil (elle girilen tutar dağıtılır).
-- Tek fark: "Kasada yeterli bakiye yok" kontrolü silindi; diğer her şey aynı.
CREATE OR REPLACE FUNCTION public.distribute_branch_profit(p_branch_id bigint, p_total_amount integer, p_payment_date date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL::text)
 RETURNS TABLE(doctor_id bigint, amount integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_clinic_id bigint := public.get_my_clinic_id();
  v_can_manage boolean;
  v_branch_name text;
  v_share record;
  v_share_amount bigint;
  v_rate_total bigint := 0;
  v_category text;
  v_source_type text;
  v_transaction_id bigint;
begin
  select exists (
    select 1 from public.profiles p
    left join public.doctors d on d.id = p.doctor_id and d.clinic_id = p.clinic_id
    where p.id = auth.uid() and p.clinic_id = v_clinic_id
      and (p.role in ('bashekim','responsible_manager') or d.is_mesul_mudur = true)
  ) into v_can_manage;
  if not coalesce(v_can_manage, false) then raise exception 'Kâr payı dağıtma yetkiniz yok'; end if;
  if p_total_amount is null or p_total_amount <= 0 then raise exception 'Geçerli bir tutar girin'; end if;

  select name into v_branch_name from public.branches where id = p_branch_id and clinic_id = v_clinic_id;
  if not found then raise exception 'Şube bu klinikte bulunamadı'; end if;

  select coalesce(sum(ds.rate_bps), 0) into v_rate_total
  from public.doctor_shares ds
  join public.doctors d on d.id = ds.doctor_id and d.clinic_id = v_clinic_id
  where ds.clinic_id = v_clinic_id and ds.branch_id = p_branch_id and ds.is_active
    and (ds.start_date is null or ds.start_date <= coalesce(p_payment_date, current_date))
    and (ds.end_date is null or ds.end_date >= coalesce(p_payment_date, current_date));
  if v_rate_total <> 10000 then
    raise exception 'Şubenin hisse toplamı yüzde 100 değil (yüzde %). Ayarlar → Klinik bölümünden hissedarları düzeltin',
      to_char(v_rate_total / 100.0, 'FM990D00');
  end if;

  for v_share in
    select ds.doctor_id, ds.rate_bps, ds.profit_distribution_type, d.name as doctor_name, d.payment_account
    from public.doctor_shares ds
    join public.doctors d on d.id = ds.doctor_id and d.clinic_id = v_clinic_id
    where ds.clinic_id = v_clinic_id and ds.branch_id = p_branch_id and ds.is_active
      and (ds.start_date is null or ds.start_date <= coalesce(p_payment_date, current_date))
      and (ds.end_date is null or ds.end_date >= coalesce(p_payment_date, current_date))
  loop
    v_share_amount := floor(p_total_amount::bigint * v_share.rate_bps / 10000.0)::bigint;
    if v_share_amount <= 0 then continue; end if;

    v_category := case v_share.profit_distribution_type
      when 'expense' then 'Hekim Kâr Payı Gideri'
      when 'partner_payment' then 'Ortak Ödemesi'
      else 'Kâr Dağıtımı' end;
    v_source_type := case v_share.profit_distribution_type
      when 'expense' then 'doctor_payment'
      when 'partner_payment' then 'partner_payment'
      else 'profit_distribution' end;

    insert into public.transactions (
      clinic_id, amount, method, type, transaction_date, description, category,
      doctor_id, account_name, payment_status, source_type, branch_id
    ) values (
      v_clinic_id, v_share_amount::integer, 'cash', 'expense', coalesce(p_payment_date, current_date),
      coalesce(nullif(trim(p_note), ''), v_branch_name || ' kâr payı dağıtımı — Dt. ' || v_share.doctor_name),
      v_category, v_share.doctor_id, v_share.payment_account, 'odendi', v_source_type, p_branch_id
    ) returning id into v_transaction_id;

    insert into public.doctor_payments (
      clinic_id, doctor_id, amount, payment_type, method, payment_date, note,
      transaction_id, account_name, created_by, earning_period, branch_id
    ) values (
      v_clinic_id, v_share.doctor_id, v_share_amount::integer, 'kar_payi', 'cash', coalesce(p_payment_date, current_date),
      nullif(trim(p_note), ''), v_transaction_id, v_share.payment_account, auth.uid(),
      to_char(coalesce(p_payment_date, current_date), 'YYYY-MM'), p_branch_id
    );

    doctor_id := v_share.doctor_id;
    amount := v_share_amount::integer;
    return next;
  end loop;
end;
$function$;
