DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['payment_plans','payment_plan_groups'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL', table_name);
    EXECUTE format(
      'UPDATE public.%I t SET branch_id = COALESCE((SELECT p.branch_id FROM public.patients p WHERE p.id = t.patient_id), (SELECT b.id FROM public.branches b WHERE b.clinic_id = t.clinic_id AND b.is_default LIMIT 1)) WHERE t.branch_id IS NULL',
      table_name
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(branch_id)', table_name || '_branch_idx', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS assign_active_branch_before_insert ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER assign_active_branch_before_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.assign_active_branch()', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_branch_restriction', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.can_access_branch(branch_id)) WITH CHECK (private.can_access_branch(branch_id))',
      table_name || '_branch_restriction', table_name
    );
  END LOOP;
END $$;
