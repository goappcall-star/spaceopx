-- Reject cross-server role assignments, including writes made by privileged services.
CREATE OR REPLACE FUNCTION public.validate_member_role_server()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.server_members m JOIN public.roles r ON r.server_id=m.server_id
    WHERE m.id=NEW.member_id AND r.id=NEW.role_id
  ) THEN RAISE EXCEPTION 'role_server_mismatch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS member_role_server_integrity ON public.member_roles;
CREATE TRIGGER member_role_server_integrity BEFORE INSERT OR UPDATE ON public.member_roles
FOR EACH ROW EXECUTE FUNCTION public.validate_member_role_server();

-- Ignore invalid legacy associations rather than granting permissions across servers.
CREATE OR REPLACE FUNCTION public.has_server_permission(_server_id uuid, _user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_server_owner(_server_id,_user_id) OR EXISTS (
    SELECT 1 FROM public.server_members m
    JOIN public.member_roles mr ON mr.member_id=m.id
    JOIN public.roles r ON r.id=mr.role_id AND r.server_id=m.server_id
    WHERE m.server_id=_server_id AND m.user_id=_user_id
    AND (COALESCE((r.permissions->>'administrator')::boolean,false)
      OR COALESCE((r.permissions->>_perm)::boolean,false))
  );
$$;

-- Match the client: explicit grants win; otherwise any explicit baseline denial wins.
CREATE OR REPLACE FUNCTION public.has_channel_permission(_channel_id uuid, _user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.server_members m ON m.server_id=c.server_id AND m.user_id=_user_id
    WHERE c.id=_channel_id AND (
      public.is_server_owner(c.server_id,_user_id)
      OR EXISTS (
        SELECT 1 FROM public.member_roles mr
        JOIN public.roles r ON r.id=mr.role_id AND r.server_id=m.server_id
        WHERE mr.member_id=m.id AND (
          COALESCE((r.permissions->>'administrator')::boolean,false)
          OR COALESCE((r.permissions->>'manage_server')::boolean,false)
          OR COALESCE((r.permissions->>_perm)::boolean,false)
        )
      )
      OR (_perm IN ('view_channel','send_messages','connect','speak') AND NOT EXISTS (
        SELECT 1 FROM public.member_roles mr
        JOIN public.roles r ON r.id=mr.role_id AND r.server_id=m.server_id
        WHERE mr.member_id=m.id AND (r.permissions->>_perm)::boolean IS FALSE
      ))
    )
  );
$$;
