REVOKE EXECUTE ON FUNCTION public.get_my_clinic_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_clinic_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.provision_clinic(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_clinic(TEXT, TEXT, TEXT, TEXT) TO service_role;
