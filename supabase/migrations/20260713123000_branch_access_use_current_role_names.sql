-- Şube erişim yardımcıları hâlâ kaldırılmış rol adlarını ('admin','clinic_manager') kontrol ediyordu.
-- Başhekim yalnızca access_level='all' sayesinde erişebiliyordu; şube kısıtlı bir başhekim
-- hiçbir şubeyi göremezdi. Güncel rol adı 'bashekim' kullanılır; başka mantık değişmedi.

CREATE OR REPLACE FUNCTION private.can_list_branch(p_branch_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.branches b ON b.id = p_branch_id AND b.clinic_id = p.clinic_id
    WHERE p.id = (SELECT auth.uid())
      AND (
        p.role = 'bashekim' OR p.access_level = 'all'
        OR p.branch_id = p_branch_id
        OR EXISTS (
          SELECT 1 FROM public.user_branch_access uba
          WHERE uba.user_id = p.id AND uba.branch_id = p_branch_id AND uba.clinic_id = p.clinic_id
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_branch(p_branch_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.branches b ON b.id = p_branch_id AND b.clinic_id = p.clinic_id
    WHERE p.id = (SELECT auth.uid())
      AND private.can_list_branch(p_branch_id)
      AND (
        p.active_branch_id = p_branch_id
        OR (p.active_branch_id IS NULL AND (p.role = 'bashekim' OR p.access_level = 'all'))
      )
  );
$function$;
