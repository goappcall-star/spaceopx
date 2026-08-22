CREATE TABLE IF NOT EXISTS public.server_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.server_bans TO authenticated;
GRANT ALL ON public.server_bans TO service_role;

ALTER TABLE public.server_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_bans" ON public.server_bans
  FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));

CREATE POLICY "managers_create_bans" ON public.server_bans
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_server(server_id, auth.uid()) AND user_id <> auth.uid());

CREATE POLICY "managers_delete_bans" ON public.server_bans
  FOR DELETE TO authenticated
  USING (public.can_manage_server(server_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.is_server_banned(_server_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_bans b
    WHERE b.server_id = _server_id AND b.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_invite_preview(_code text)
RETURNS TABLE(server_id uuid, server_name text, server_icon_url text, server_description text, member_count bigint, already_member boolean, valid boolean, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.server_invites%ROWTYPE;
  srv public.servers%ROWTYPE;
  uid UUID := auth.uid();
BEGIN
  SELECT * INTO inv FROM public.server_invites WHERE code = lower(trim(_code));
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::BIGINT, false, false, 'invite_not_found';
    RETURN;
  END IF;

  SELECT * INTO srv FROM public.servers WHERE id = inv.server_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::BIGINT, false, false, 'server_not_found';
    RETURN;
  END IF;

  RETURN QUERY SELECT
    srv.id, srv.name, srv.icon_url, srv.description,
    (SELECT count(*) FROM public.server_members m WHERE m.server_id = srv.id),
    (uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = srv.id AND m.user_id = uid)),
    CASE
      WHEN uid IS NOT NULL AND public.is_server_banned(srv.id, uid) THEN false
      WHEN inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN false
      WHEN inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN false
      ELSE true END,
    CASE
      WHEN uid IS NOT NULL AND public.is_server_banned(srv.id, uid) THEN 'user_banned'
      WHEN inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN 'invite_expired'
      WHEN inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN 'invite_exhausted'
      ELSE 'ok' END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_server_by_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  inv public.server_invites%ROWTYPE;
  member_role_id UUID;
  new_member_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO inv FROM public.server_invites WHERE code = lower(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.servers WHERE id = inv.server_id) THEN RAISE EXCEPTION 'server_not_found'; END IF;
  IF public.is_server_banned(inv.server_id, uid) THEN RAISE EXCEPTION 'user_banned'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;

  IF EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = inv.server_id AND m.user_id = uid) THEN
    RETURN inv.server_id;
  END IF;

  IF inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN RAISE EXCEPTION 'invite_exhausted'; END IF;

  INSERT INTO public.server_members (server_id, user_id) VALUES (inv.server_id, uid) RETURNING id INTO new_member_id;

  SELECT id INTO member_role_id FROM public.roles WHERE server_id = inv.server_id AND name = 'MEMBER';
  IF member_role_id IS NOT NULL THEN
    INSERT INTO public.member_roles (member_id, role_id) VALUES (new_member_id, member_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.server_invites SET uses = uses + 1 WHERE id = inv.id;

  RETURN inv.server_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text) TO authenticated;