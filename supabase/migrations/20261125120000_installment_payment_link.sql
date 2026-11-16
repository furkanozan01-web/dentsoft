-- Taksit ödemesi ile hasta ödemesi (transactions) birbirine bağlanır: ödeme silinirse taksit yeniden "ödenmemiş" olur.

alter table public.payment_plans
  add column if not exists transaction_id bigint references public.transactions(id) on delete set null;
create index if not exists payment_plans_transaction_id_idx on public.payment_plans (transaction_id) where transaction_id is not null;

create or replace function public.reopen_installment_on_payment_delete()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  update public.payment_plans
  set paid = false, paid_at = null, transaction_id = null, updated_at = now()
  where transaction_id = old.id;
  return old;
end;
$function$;

drop trigger if exists reopen_installment_before_payment_delete on public.transactions;
create trigger reopen_installment_before_payment_delete
  before delete on public.transactions
  for each row
  when (old.type = 'payment')
  execute function public.reopen_installment_on_payment_delete();
