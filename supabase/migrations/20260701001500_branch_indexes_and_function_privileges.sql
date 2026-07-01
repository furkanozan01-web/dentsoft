CREATE INDEX IF NOT EXISTS profiles_branch_idx ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS profiles_active_branch_idx ON public.profiles(active_branch_id);
CREATE INDEX IF NOT EXISTS admin_email_allowlist_branch_idx ON public.admin_email_allowlist(branch_id);
CREATE INDEX IF NOT EXISTS admin_email_allowlist_clinic_idx ON public.admin_email_allowlist(clinic_id);
CREATE INDEX IF NOT EXISTS admin_email_allowlist_doctor_idx ON public.admin_email_allowlist(doctor_id);

REVOKE EXECUTE ON FUNCTION public.get_my_clinic_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(JSONB) TO supabase_auth_admin;
