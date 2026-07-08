
-- Rewrite has_role as SECURITY INVOKER. Callers only ever check their own
-- rows, and the existing user_roles SELECT policy already allows a user to
-- read their own role rows, so this remains functionally identical for
-- policy use while removing the definer-executable surface.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Rewrite is_staff to (a) require a real staff-level role and (b) run as
-- SECURITY INVOKER. Previously any authenticated user with any role at all
-- passed this check, exposing audit_logs, api_logs, and fraud_alerts
-- (including realtime) to non-staff.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin'::public.app_role,
                   'auditor'::public.app_role,
                   'support'::public.app_role)
  )
$$;
