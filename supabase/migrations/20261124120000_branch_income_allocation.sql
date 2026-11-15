-- Hastadan alınan ücret, tedaviyi yapan hekimlerin bağlı olduğu şubelerin kasalarına ücret payı oranında paylaştırılır.
-- (Eskiden tamamı ödemenin kaydedildiği şubeye düşüyordu; diğer şubelerin hissedarları kâr payı alamıyordu.)

create or replace function public.alloc_payment_branches()
returns table(tx_id bigint, branch_id bigint, amount bigint)
language sql
stable
set search_path to 'public'
as $function$
  with pay as (
    select t.id, t.patient_id, t.amount, t.branch_id
    from public.transactions t
    where t.clinic_id = public.get_my_clinic_id()
      and t.type = 'payment'
      and t.patient_id is not null
      and coalesce(t.method, '') <> 'firma_odemesi'
  ),
  w as (
    select tr.patient_id, coalesce(d.branch_id, p.branch_id) as branch_id, sum(tr.fee)::bigint as fee
    from public.treatments tr
    join public.patients p on p.id = tr.patient_id
    left join public.doctors d on d.id = tr.doctor_id
    where tr.clinic_id = public.get_my_clinic_id()
      and tr.status <> 'cancelled'
      and tr.fee > 0
      and tr.patient_id in (select patient_id from pay)
    group by tr.patient_id, coalesce(d.branch_id, p.branch_id)
  ),
  tot as (select patient_id, sum(fee) as total from w group by patient_id),
  a as (
    select pay.id as tx_id, w.branch_id, pay.amount,
           floor(pay.amount::numeric * w.fee / tot.total)::bigint as base,
           row_number() over (partition by pay.id order by w.fee desc, w.branch_id nulls last) as rn
    from pay
    join w on w.patient_id = pay.patient_id
    join tot on tot.patient_id = pay.patient_id
  )
  select a.tx_id,
         coalesce(a.branch_id, t.branch_id) as branch_id,
         (a.base + case when a.rn = 1 then a.amount - sum(a.base) over (partition by a.tx_id) else 0 end)::bigint as amount
  from a
  join public.transactions t on t.id = a.tx_id
  union all
  select pay.id, pay.branch_id, pay.amount::bigint
  from pay
  where not exists (select 1 from tot where tot.patient_id = pay.patient_id)
$function$;

-- Şube / ay / tür toplamları: hasta ödemeleri paylaştırılmış haliyle
create or replace function public.finance_totals()
returns table(branch_id bigint, month text, type text, total bigint)
language sql
stable
set search_path to 'public'
as $function$
  select x.branch_id, x.month, x.type, sum(x.total)::bigint as total
  from (
    select t.branch_id, to_char(t.transaction_date, 'YYYY-MM') as month, t.type, t.amount::bigint as total
    from public.transactions t
    where t.clinic_id = public.get_my_clinic_id()
      and not (t.type = 'payment' and t.patient_id is not null and coalesce(t.method, '') <> 'firma_odemesi')
    union all
    select a.branch_id, to_char(t.transaction_date, 'YYYY-MM'), 'payment', a.amount
    from public.alloc_payment_branches() a
    join public.transactions t on t.id = a.tx_id
  ) x
  group by x.branch_id, x.month, x.type
$function$;

create or replace function public.finance_kasa_totals()
returns table(branch_id bigint, method text, type text, total bigint)
language sql
stable
set search_path to 'public'
as $function$
  select x.branch_id, x.method, x.type, sum(x.total)::bigint as total
  from (
    select t.branch_id, coalesce(t.method, 'other') as method, t.type, t.amount::bigint as total
    from public.transactions t
    where t.clinic_id = public.get_my_clinic_id()
      and not (t.type = 'payment' and t.patient_id is not null and coalesce(t.method, '') <> 'firma_odemesi')
    union all
    select a.branch_id, coalesce(t.method, 'other'), 'payment', a.amount
    from public.alloc_payment_branches() a
    join public.transactions t on t.id = a.tx_id
  ) x
  group by x.branch_id, x.method, x.type
$function$;

-- Kâr payı dağıtımı: kasa bakiyesi paylaştırılmış gelirle hesaplanır
create or replace function public.distribute_branch_profit(
  p_branch_id bigint,
  p_total_amount integer,
  p_payment_date date default current_date,
  p_note text default null
)
returns table(doctor_id bigint, amount integer)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_clinic_id bigint := public.get_my_clinic_id();
  v_can_manage boolean;
  v_branch_name text;
  v_share record;
  v_share_amount bigint;
  v_total_out bigint := 0;
  v_rate_total bigint := 0;
  v_balance bigint;
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

  select coalesce(sum(floor(p_total_amount::bigint * ds.rate_bps / 10000.0)::bigint), 0) into v_total_out
  from public.doctor_shares ds
  join public.doctors d on d.id = ds.doctor_id and d.clinic_id = v_clinic_id
  where ds.clinic_id = v_clinic_id and ds.branch_id = p_branch_id and ds.is_active
    and (ds.start_date is null or ds.start_date <= coalesce(p_payment_date, current_date))
    and (ds.end_date is null or ds.end_date >= coalesce(p_payment_date, current_date));

  -- Şube kasası = paylaştırılmış gelir − gider
  select coalesce(sum(case when f.type = 'payment' then f.total when f.type in ('expense','refund') then -f.total else 0 end), 0)
  into v_balance
  from public.finance_totals() f
  where f.branch_id = p_branch_id;

  if v_total_out > v_balance then
    raise exception 'Kasada yeterli bakiye yok (dağıtılacak: % ₺, kasa bakiyesi: % ₺)',
      to_char(v_total_out / 100.0, 'FM999G999G990D00'), to_char(v_balance / 100.0, 'FM999G999G990D00');
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
      coalesce(nullif(trim(p_note), ''), v_branch_name || ' kasası kâr payı dağıtımı — Dt. ' || v_share.doctor_name),
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

-- Hekim ödemesi / kâr payı silinince bağlı gider kaydı da silinir (eskiden yalnızca source_type 'doctor_payment' olanlar siliniyordu;
-- kâr dağıtımı gideri kalıyor ve dağıtım geri alınamıyordu)
create or replace function public.delete_doctor_payment_link(p_transaction_id bigint default null, p_payment_id bigint default null)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_clinic_id bigint := public.get_my_clinic_id();
  v_selected_payment_id bigint;
  v_transaction_id bigint;
  v_can_manage boolean;
begin
  select exists (
    select 1 from public.profiles p
    left join public.doctors d on d.id = p.doctor_id and d.clinic_id = p.clinic_id
    where p.id = auth.uid() and p.clinic_id = v_clinic_id
      and (p.role = 'bashekim' or d.is_mesul_mudur = true)
  ) into v_can_manage;
  if not coalesce(v_can_manage, false) then raise exception 'Hakediş ödemesi silme yetkiniz yok'; end if;

  select id, transaction_id into v_selected_payment_id, v_transaction_id
  from public.doctor_payments
  where clinic_id = v_clinic_id
    and ((p_payment_id is not null and id = p_payment_id)
      or (p_transaction_id is not null and transaction_id = p_transaction_id))
  limit 1;

  if v_selected_payment_id is not null then
    delete from public.doctor_payments where id = v_selected_payment_id and clinic_id = v_clinic_id;
    if v_transaction_id is not null then
      delete from public.transactions
      where id = v_transaction_id and clinic_id = v_clinic_id
        and source_type in ('doctor_payment', 'profit_distribution', 'partner_payment');
    end if;
  end if;
end;
$function$;
