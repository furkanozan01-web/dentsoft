-- Klinik ayarları, kullanıcı-hekim entegrasyonu ve çok şubeli yapı.

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS authorized_person TEXT,
  ADD COLUMN IF NOT EXISTS unit_count INTEGER NOT NULL DEFAULT 1 CHECK (unit_count > 0),
  ADD COLUMN IF NOT EXISTS bank_fee_bps INTEGER NOT NULL DEFAULT 0 CHECK (bank_fee_bps BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.branches (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  authorized_person TEXT,
  unit_count INTEGER NOT NULL DEFAULT 1 CHECK (unit_count > 0),
  work_start TIME NOT NULL DEFAULT '09:00',
  work_end TIME NOT NULL DEFAULT '18:00',
  bank_accounts TEXT,
  cash_accounts TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, code)
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS branches_one_default_per_clinic_idx
  ON public.branches(clinic_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS branches_clinic_idx ON public.branches(clinic_id);

INSERT INTO public.branches (clinic_id, name, code, phone, email, address, authorized_person, unit_count, work_start, work_end, is_default)
SELECT cs.id, cs.clinic_name || ' Merkez', 'MERKEZ', cs.phone, cs.email, cs.address,
       cs.authorized_person, cs.unit_count, COALESCE(cs.work_start, '09:00')::time,
       COALESCE(cs.work_end, '18:00')::time, true
FROM public.clinic_settings cs
WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.clinic_id = cs.id);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'admin','doctor','assistant','secretary','clinic_manager','responsible_manager','finance','viewer','user'
  ));
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'branch' CHECK (access_level IN ('branch','assigned','all'));

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Diş Hekimi';

ALTER TABLE public.admin_email_allowlist
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'branch' CHECK (access_level IN ('branch','assigned','all')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_branch_access (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  clinic_id BIGINT NOT NULL REFERENCES public.clinic_settings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, branch_id)
);
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS user_branch_access_clinic_idx ON public.user_branch_access(clinic_id);

UPDATE public.profiles p SET
  branch_id = COALESCE(p.branch_id, b.id),
  active_branch_id = COALESCE(p.active_branch_id, b.id),
  access_level = CASE WHEN p.role IN ('admin','clinic_manager') THEN 'all' ELSE p.access_level END
FROM public.branches b WHERE b.clinic_id = p.clinic_id AND b.is_default;

UPDATE public.doctors d SET branch_id = b.id
FROM public.branches b WHERE b.clinic_id = d.clinic_id AND b.is_default AND d.branch_id IS NULL;

UPDATE public.admin_email_allowlist a SET branch_id = b.id,
  access_level = CASE WHEN a.role IN ('admin','clinic_manager') THEN 'all' ELSE a.access_level END
FROM public.branches b WHERE b.clinic_id = a.clinic_id AND b.is_default AND a.branch_id IS NULL;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'patients','appointments','treatments','transactions','doctor_payments',
    'partner_services','clinic_debts','business_partners'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL', table_name);
    EXECUTE format(
      'UPDATE public.%I t SET branch_id = b.id FROM public.branches b WHERE b.clinic_id = t.clinic_id AND b.is_default AND t.branch_id IS NULL',
      table_name
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(branch_id)', table_name || '_branch_idx', table_name);
  END LOOP;
END $$;

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
      AND (
        p.role IN ('admin','clinic_manager') OR p.access_level = 'all'
        OR p.active_branch_id = p_branch_id
        OR EXISTS (
          SELECT 1 FROM public.user_branch_access uba
          WHERE uba.user_id = p.id AND uba.branch_id = p_branch_id AND uba.clinic_id = p.clinic_id
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION private.can_access_branch(BIGINT) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_branch(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION private.current_branch_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(p.active_branch_id, p.branch_id)
  FROM public.profiles p WHERE p.id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION private.current_branch_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_branch_id() TO authenticated;

CREATE OR REPLACE FUNCTION private.assign_active_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN NEW.branch_id := private.current_branch_id(); END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'patients','appointments','treatments','transactions','doctor_payments',
    'partner_services','clinic_debts','business_partners'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS assign_active_branch_before_insert ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER assign_active_branch_before_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.assign_active_branch()',
      table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_branch_restriction', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.can_access_branch(branch_id)) WITH CHECK (private.can_access_branch(branch_id))',
      table_name || '_branch_restriction', table_name
    );
  END LOOP;
END $$;

CREATE POLICY branches_select_access ON public.branches FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND private.can_access_branch(id));
CREATE POLICY branches_admin_write ON public.branches FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','clinic_manager')
  ))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','clinic_manager')
  ));

CREATE POLICY user_branch_access_select ON public.user_branch_access FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (clinic_id = (SELECT public.get_my_clinic_id()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','clinic_manager')
  )));
CREATE POLICY user_branch_access_admin_write ON public.user_branch_access FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','clinic_manager')
  ))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','clinic_manager')
  ));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id BIGINT;
  v_role TEXT;
  v_full_name TEXT;
  v_doctor_id BIGINT;
  v_branch_id BIGINT;
  v_access_level TEXT;
BEGIN
  SELECT clinic_id, role, full_name, doctor_id, branch_id, access_level
    INTO v_clinic_id, v_role, v_full_name, v_doctor_id, v_branch_id, v_access_level
  FROM public.admin_email_allowlist
  WHERE email = lower(NEW.email) AND is_active;

  IF NOT FOUND THEN
    v_clinic_id := (NEW.raw_user_meta_data->>'clinic_id')::BIGINT;
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'assistant');
    v_full_name := NEW.raw_user_meta_data->>'full_name';
    v_doctor_id := NULLIF(NEW.raw_user_meta_data->>'doctor_id', '')::BIGINT;
    v_branch_id := NULLIF(NEW.raw_user_meta_data->>'branch_id', '')::BIGINT;
    v_access_level := COALESCE(NEW.raw_user_meta_data->>'access_level', 'branch');
  END IF;

  INSERT INTO public.profiles (id, full_name, clinic_id, role, doctor_id, branch_id, active_branch_id, access_level)
  VALUES (
    NEW.id, COALESCE(v_full_name, split_part(NEW.email, '@', 1)), v_clinic_id,
    COALESCE(v_role, 'assistant'), v_doctor_id, v_branch_id, v_branch_id,
    COALESCE(v_access_level, 'branch')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hook_before_user_created(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email TEXT;
BEGIN
  v_email := lower(event->'user'->>'email');
  IF v_email LIKE '%@dentsoft.local' THEN RETURN '{}'::JSONB; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_email_allowlist WHERE email = v_email AND is_active) THEN
    RETURN '{}'::JSONB;
  END IF;
  RETURN jsonb_build_object('error', jsonb_build_object(
    'message', 'Bu sisteme kayıt yetkisine sahip değilsiniz.', 'http_code', 403
  ));
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches, public.user_branch_access TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.branches_id_seq TO authenticated;
