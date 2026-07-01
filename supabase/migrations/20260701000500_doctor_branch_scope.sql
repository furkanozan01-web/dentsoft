DROP TRIGGER IF EXISTS assign_active_branch_before_insert ON public.doctors;
CREATE TRIGGER assign_active_branch_before_insert
  BEFORE INSERT ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION private.assign_active_branch();

DROP POLICY IF EXISTS doctors_branch_restriction ON public.doctors;
CREATE POLICY doctors_branch_restriction ON public.doctors
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.can_access_branch(branch_id))
  WITH CHECK (private.can_access_branch(branch_id));

CREATE INDEX IF NOT EXISTS doctors_branch_idx ON public.doctors(branch_id);
