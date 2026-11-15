-- İş ortaklarından satın alma (örn. implant) ve taksitli ödeme: her taksit Borçlar'da ayrı kalem olarak görünür.
alter table public.clinic_debts
  add column if not exists partner_id bigint references public.business_partners(id),
  add column if not exists partner_service_id bigint references public.partner_services(id),
  add column if not exists installment_no smallint,
  add column if not exists installment_total smallint;

create index if not exists clinic_debts_partner_service_idx on public.clinic_debts (partner_service_id);

-- Borç ödemesi: firmaya bağlı borçta gider kaydı da firmaya (iş ortağına) bağlanır; tüm taksitler ödenince satın alma "ödendi" olur.
create or replace function public.pay_clinic_debt(p_debt_id bigint, p_amount integer, p_method text default null::text, p_account_name text default null::text)
 returns bigint
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
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Geçerli bir tutar girin'; end if;

  select * into v_debt from public.clinic_debts
  where id = p_debt_id and clinic_id = v_clinic_id and status = 'active'
  for update;
  if not found then raise exception 'Borç bulunamadı'; end if;

  v_paid := least(v_debt.paid_amount + p_amount, v_debt.total_amount);
  v_pay := least(p_amount, v_debt.total_amount - v_debt.paid_amount);

  insert into public.transactions (
    clinic_id, amount, method, type, transaction_date, description, category,
    recurring, account_name, payment_status, source_type, partner_id, partner_service_id, branch_id
  ) values (
    v_clinic_id, v_pay,
    coalesce(nullif(p_method, ''), v_debt.payment_method, 'other'), 'expense', current_date,
    v_debt.title,
    case when v_debt.partner_id is not null then 'Firma Ödemesi' else 'Sabit Gider' end,
    nullif(v_debt.recurrence, 'tek_seferlik'),
    coalesce(nullif(p_account_name, ''), v_debt.account_name), 'odendi',
    case when v_debt.partner_id is not null then 'company_payment' else 'fixed_expense' end,
    v_debt.partner_id, v_debt.partner_service_id, v_debt.branch_id
  ) returning id into v_tx_id;

  if v_paid >= v_debt.total_amount and v_debt.recurrence in ('aylik', 'yillik') then
    v_next_due := case when v_debt.recurrence = 'aylik'
      then coalesce(v_debt.due_date, current_date) + interval '1 month'
      else coalesce(v_debt.due_date, current_date) + interval '1 year' end;
    update public.clinic_debts set paid_amount = 0, due_date = v_next_due,
      last_paid_at = current_date, status = 'active' where id = v_debt.id;
  else
    update public.clinic_debts set paid_amount = v_paid, last_paid_at = current_date,
      status = case when v_paid >= total_amount then 'paid' else 'active' end
    where id = v_debt.id;
  end if;

  -- Satın almanın tüm taksitleri ödendiyse hizmet kaydı "ödendi" olur
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
