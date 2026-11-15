-- Borç ödemesi ile Defter gideri bağlanır (gider silinirse borç geri açılır) + Kasa'nın ödeme yöntemine göre dökümü.

alter table public.transactions
  add column if not exists clinic_debt_id bigint references public.clinic_debts(id) on delete set null;

create index if not exists transactions_clinic_debt_id_idx on public.transactions (clinic_debt_id) where clinic_debt_id is not null;

drop function if exists public.pay_clinic_debt(bigint, integer, text, text);

create or replace function public.pay_clinic_debt(
  p_debt_id bigint,
  p_amount integer,
  p_method text default null,
  p_account_name text default null,
  p_date date default null
) returns bigint
language plpgsql
set search_path to 'public'
as $function$
declare
  v_clinic_id bigint := public.get_my_clinic_id();
  v_debt public.clinic_debts%rowtype;
  v_paid integer;
  v_tx_id bigint;
  v_next_due date;
  v_pay integer;
  v_date date := coalesce(p_date, (now() at time zone 'Europe/Istanbul')::date);
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Geçerli bir tutar girin'; end if;

  select * into v_debt from public.clinic_debts
  where id = p_debt_id and clinic_id = v_clinic_id and status = 'active'
  for update;
  if not found then raise exception 'Borç bulunamadı'; end if;

  v_paid := least(v_debt.paid_amount + p_amount, v_debt.total_amount);
  v_pay := least(p_amount, v_debt.total_amount - v_debt.paid_amount);
  if v_pay <= 0 then raise exception 'Bu borç zaten ödenmiş'; end if;

  insert into public.transactions (
    clinic_id, amount, method, type, transaction_date, description, category,
    recurring, account_name, payment_status, source_type, partner_id, partner_service_id, branch_id, clinic_debt_id
  ) values (
    v_clinic_id, v_pay,
    coalesce(nullif(p_method, ''), v_debt.payment_method, 'other'), 'expense', v_date,
    v_debt.title,
    case when v_debt.partner_id is not null then 'Firma Ödemesi' else 'Sabit Gider' end,
    nullif(v_debt.recurrence, 'tek_seferlik'),
    coalesce(nullif(p_account_name, ''), v_debt.account_name), 'odendi',
    case when v_debt.partner_id is not null then 'company_payment' else 'fixed_expense' end,
    v_debt.partner_id, v_debt.partner_service_id, v_debt.branch_id, v_debt.id
  ) returning id into v_tx_id;

  if v_paid >= v_debt.total_amount and v_debt.recurrence in ('aylik', 'yillik') then
    v_next_due := case when v_debt.recurrence = 'aylik'
      then coalesce(v_debt.due_date, v_date) + interval '1 month'
      else coalesce(v_debt.due_date, v_date) + interval '1 year' end;
    update public.clinic_debts set paid_amount = 0, due_date = v_next_due,
      last_paid_at = v_date, status = 'active' where id = v_debt.id;
  else
    update public.clinic_debts set paid_amount = v_paid, last_paid_at = v_date,
      status = case when v_paid >= total_amount then 'paid' else 'active' end
    where id = v_debt.id;
  end if;

  if v_debt.partner_service_id is not null and v_paid >= v_debt.total_amount then
    if not exists (
      select 1 from public.clinic_debts d
      where d.partner_service_id = v_debt.partner_service_id and d.id <> v_debt.id and d.status = 'active'
    ) then
      update public.partner_services set payment_status = 'odendi' where id = v_debt.partner_service_id and clinic_id = v_clinic_id;
    end if;
  end if;

  return v_tx_id;
end;
$function$;

-- Defterden bir borç ödemesi silinince borcun ödenen tutarı geri alınır (tek seferlik borçlar için).
create or replace function public.revert_debt_payment(p_transaction_id bigint)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_clinic_id bigint := public.get_my_clinic_id();
  v_tx public.transactions%rowtype;
begin
  select * into v_tx from public.transactions
  where id = p_transaction_id and clinic_id = v_clinic_id and type = 'expense' for update;
  if not found then raise exception 'Gider kaydı bulunamadı'; end if;

  if v_tx.clinic_debt_id is not null then
    update public.clinic_debts
    set paid_amount = greatest(paid_amount - v_tx.amount, 0),
        status = case when status = 'paid' then 'active' else status end
    where id = v_tx.clinic_debt_id and clinic_id = v_clinic_id;
    if exists (select 1 from public.clinic_debts where id = v_tx.clinic_debt_id and partner_service_id is not null) then
      update public.partner_services set payment_status = 'bekliyor'
      where id = (select partner_service_id from public.clinic_debts where id = v_tx.clinic_debt_id)
        and clinic_id = v_clinic_id;
    end if;
  end if;

  delete from public.transactions where id = p_transaction_id and clinic_id = v_clinic_id;
end;
$function$;

-- Kasa dökümü: şube + ödeme yöntemi + tür bazında tüm zamanlar toplamı
create or replace function public.finance_kasa_totals()
returns table(branch_id bigint, method text, type text, total bigint)
language sql
stable
set search_path to 'public'
as $function$
  select t.branch_id, coalesce(t.method, 'other') as method, t.type, sum(t.amount)::bigint as total
  from public.transactions t
  where t.clinic_id = public.get_my_clinic_id()
  group by t.branch_id, coalesce(t.method, 'other'), t.type
$function$;
