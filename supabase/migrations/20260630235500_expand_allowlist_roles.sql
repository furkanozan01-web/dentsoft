ALTER TABLE public.admin_email_allowlist
  DROP CONSTRAINT IF EXISTS admin_email_allowlist_role_check;
ALTER TABLE public.admin_email_allowlist
  ADD CONSTRAINT admin_email_allowlist_role_check CHECK (role IN (
    'admin','doctor','assistant','secretary','clinic_manager','responsible_manager','finance','viewer'
  ));
