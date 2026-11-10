-- Şube × ay × tür bazında işlem toplamları. SECURITY INVOKER: RLS (klinik + şube
-- izolasyonu) çağıran kullanıcı için aynen uygulanır. Satır sayısından bağımsızdır
-- (PostgREST 1000 satır sınırından etkilenmez).
CREATE OR REPLACE FUNCTION public.finance_totals()
RETURNS TABLE(branch_id bigint, month text, type text, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT t.branch_id, to_char(t.transaction_date, 'YYYY-MM') AS month, t.type, SUM(t.amount)::bigint AS total
  FROM public.transactions t
  WHERE t.clinic_id = public.get_my_clinic_id()
  GROUP BY t.branch_id, to_char(t.transaction_date, 'YYYY-MM'), t.type
$$;

REVOKE ALL ON FUNCTION public.finance_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_totals() TO authenticated;
