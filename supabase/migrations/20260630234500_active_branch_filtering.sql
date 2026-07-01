-- Yetki verilen şubeler ile o anda seçili olan şubeyi birbirinden ayırır.

CREATE OR REPLACE FUNCTION private.can_list_branch(p_branch_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.branches b ON b.id = p_branch_id AND b.clinic_id = p.clinic_id
    WHERE p.id = (SELECT auth.uid())
      AND (
        p.role IN ('admin','clinic_manager') OR p.access_level = 'all'
        OR p.branch_id = p_branch_id
        OR EXISTS (
          SELECT 1 FROM public.user_branch_access uba
          WHERE uba.user_id = p.id AND uba.branch_id = p_branch_id AND uba.clinic_id = p.clinic_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_branch(p_branch_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.branches b ON b.id = p_branch_id AND b.clinic_id = p.clinic_id
    WHERE p.id = (SELECT auth.uid())
      AND private.can_list_branch(p_branch_id)
      AND (
        p.active_branch_id = p_branch_id
        OR (p.active_branch_id IS NULL AND (p.role IN ('admin','clinic_manager') OR p.access_level = 'all'))
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_list_branch(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_list_branch(BIGINT) TO authenticated;

DROP POLICY IF EXISTS branches_select_access ON public.branches;
CREATE POLICY branches_select_access ON public.branches FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND private.can_list_branch(id));
