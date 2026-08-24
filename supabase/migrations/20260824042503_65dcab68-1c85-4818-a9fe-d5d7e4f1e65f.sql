-- 1. Server profile / access / interactions -------------------------------
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS interactions jsonb NOT NULL DEFAULT
    '{"allow_messages":true,"allow_reactions":true,"allow_mentions":true,"allow_member_invites":false,"allow_member_dms":true}'::jsonb;

ALTER TABLE public.servers DROP CONSTRAINT IF EXISTS servers_visibility_check;
ALTER TABLE public.servers ADD CONSTRAINT servers_visibility_check
  CHECK (visibility IN ('public','private'));

-- 2. Permission resolution -------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_server_permission(_server_id uuid, _user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_server_owner(_server_id, _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.server_members m
      JOIN public.member_roles mr ON mr.member_id = m.id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE m.server_id = _server_id
        AND m.user_id = _user_id
        AND (
          COALESCE((r.permissions->>'administrator')::boolean, false)
          OR COALESCE((r.permissions->>_perm)::boolean, false)
        )
    );
$$;

-- can_manage_server keeps its name but becomes permission-aware.
CREATE OR REPLACE FUNCTION public.can_manage_server(_server_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_server_permission(_server_id, _user_id, 'manage_server');
$$;

-- Backfill the new permission keys on existing management roles.
UPDATE public.roles
   SET permissions = permissions || '{"kick_members":true,"ban_members":true,"manage_messages":true,"manage_voice":true,"view_audit_log":true}'::jsonb
 WHERE COALESCE((permissions->>'administrator')::boolean, false)
    OR COALESCE((permissions->>'manage_server')::boolean, false);

-- New servers: ADMIN template gains the new permissions.
CREATE OR REPLACE FUNCTION public.create_server(_name text, _description text DEFAULT NULL::text, _icon_url text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  new_server_id UUID;
  owner_role_id UUID;
  new_member_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trim(COALESCE(_name,''))) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;

  INSERT INTO public.servers (owner_id, name, description, icon_url)
  VALUES (uid, trim(_name), NULLIF(trim(COALESCE(_description,'')), ''), NULLIF(trim(COALESCE(_icon_url,'')), ''))
  RETURNING id INTO new_server_id;

  INSERT INTO public.roles (server_id, name, color, position, permissions) VALUES
    (new_server_id, 'OWNER', '#22d3ee', 100, '{"administrator":true,"manage_server":true,"manage_roles":true,"manage_channels":true,"manage_members":true,"create_invite":true,"kick_members":true,"ban_members":true,"manage_messages":true,"manage_voice":true,"view_audit_log":true,"send_messages":true,"read_messages":true}'::jsonb)
    RETURNING id INTO owner_role_id;

  INSERT INTO public.roles (server_id, name, color, position, permissions) VALUES
    (new_server_id, 'ADMIN', '#a78bfa', 50, '{"administrator":false,"manage_server":true,"manage_roles":true,"manage_channels":true,"manage_members":true,"create_invite":true,"kick_members":true,"ban_members":true,"manage_messages":true,"manage_voice":true,"view_audit_log":true,"send_messages":true,"read_messages":true}'::jsonb),
    (new_server_id, 'MEMBER', '#8b95a5', 1, '{"administrator":false,"manage_server":false,"manage_roles":false,"manage_channels":false,"manage_members":false,"create_invite":false,"send_messages":true,"read_messages":true}'::jsonb);

  INSERT INTO public.server_members (server_id, user_id) VALUES (new_server_id, uid) RETURNING id INTO new_member_id;
  INSERT INTO public.member_roles (member_id, role_id) VALUES (new_member_id, owner_role_id);

  INSERT INTO public.channels (server_id, name, type, description, position)
  VALUES (new_server_id, 'geral', 'text', 'Canal principal do servidor', 0);

  RETURN new_server_id;
END;
$$;

-- 3. Granular policies -----------------------------------------------------
DROP POLICY IF EXISTS roles_insert_admins ON public.roles;
CREATE POLICY roles_insert_admins ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'manage_roles') AND name <> 'OWNER');
DROP POLICY IF EXISTS roles_update_admins ON public.roles;
CREATE POLICY roles_update_admins ON public.roles FOR UPDATE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'manage_roles') AND name <> 'OWNER')
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'manage_roles') AND name <> 'OWNER');
DROP POLICY IF EXISTS roles_delete_admins ON public.roles;
CREATE POLICY roles_delete_admins ON public.roles FOR DELETE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'manage_roles') AND name <> ALL (ARRAY['OWNER','MEMBER']));

DROP POLICY IF EXISTS member_roles_insert_admins ON public.member_roles;
CREATE POLICY member_roles_insert_admins ON public.member_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_server_permission(public.member_server_id(member_id), auth.uid(), 'manage_members')
    AND NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.name = 'OWNER')
  );
DROP POLICY IF EXISTS member_roles_delete_admins ON public.member_roles;
CREATE POLICY member_roles_delete_admins ON public.member_roles FOR DELETE TO authenticated
  USING (
    public.has_server_permission(public.member_server_id(member_id), auth.uid(), 'manage_members')
    AND NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.name = 'OWNER')
  );

DROP POLICY IF EXISTS server_members_delete ON public.server_members;
CREATE POLICY server_members_delete ON public.server_members FOR DELETE TO authenticated
  USING (
    NOT public.is_server_owner(server_id, user_id)
    AND (user_id = auth.uid() OR public.has_server_permission(server_id, auth.uid(), 'kick_members'))
  );

DROP POLICY IF EXISTS managers_create_bans ON public.server_bans;
CREATE POLICY managers_create_bans ON public.server_bans FOR INSERT TO authenticated
  WITH CHECK (
    public.has_server_permission(server_id, auth.uid(), 'ban_members')
    AND user_id <> auth.uid()
    AND NOT public.is_server_owner(server_id, user_id)
  );
DROP POLICY IF EXISTS managers_delete_bans ON public.server_bans;
CREATE POLICY managers_delete_bans ON public.server_bans FOR DELETE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'ban_members'));

DROP POLICY IF EXISTS invites_insert_admins ON public.server_invites;
CREATE POLICY invites_insert_admins ON public.server_invites FOR INSERT TO authenticated
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'create_invite') AND created_by = auth.uid());
DROP POLICY IF EXISTS invites_delete_admins ON public.server_invites;
CREATE POLICY invites_delete_admins ON public.server_invites FOR DELETE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'create_invite'));

-- invite RPC follows the create_invite permission too
CREATE OR REPLACE FUNCTION public.create_server_invite(_server_id uuid, _max_uses integer DEFAULT NULL::integer, _expires_in_hours integer DEFAULT 168)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  uid UUID := auth.uid();
  new_code TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_server_permission(_server_id, uid, 'create_invite') THEN RAISE EXCEPTION 'not_authorized'; END IF;

  LOOP
    new_code := lower(substr(replace(replace(encode(extensions.gen_random_bytes(8), 'base64'), '/', ''), '+', ''), 1, 10));
    EXIT WHEN length(new_code) = 10
      AND NOT EXISTS (SELECT 1 FROM public.server_invites WHERE code = new_code);
  END LOOP;

  INSERT INTO public.server_invites (server_id, code, created_by, max_uses, expires_at)
  VALUES (
    _server_id, new_code, uid,
    CASE WHEN _max_uses IS NOT NULL AND _max_uses > 0 THEN _max_uses ELSE NULL END,
    CASE WHEN _expires_in_hours IS NOT NULL AND _expires_in_hours > 0 THEN now() + make_interval(hours => _expires_in_hours) ELSE NULL END
  );

  RETURN new_code;
END;
$$;

-- 4. Audit log -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  target_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_auditors ON public.audit_logs;
CREATE POLICY audit_logs_select_auditors ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'view_audit_log'));
-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER triggers write here.

CREATE INDEX IF NOT EXISTS audit_logs_server_created_idx ON public.audit_logs (server_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.write_audit(
  _server_id uuid, _action text, _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL, _target_label text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.audit_logs (server_id, actor_id, action, target_type, target_id, target_label, metadata)
  VALUES (_server_id, auth.uid(), _action, _target_type, _target_id, _target_label, COALESCE(_metadata,'{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public.write_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_servers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE changed jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit(NEW.id, 'server_created', 'server', NEW.id, NEW.name, '{}'::jsonb);
    RETURN NEW;
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN changed := changed || jsonb_build_object('name', NEW.name); END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN changed := changed || jsonb_build_object('description', COALESCE(NEW.description,'')); END IF;
  IF NEW.icon_url IS DISTINCT FROM OLD.icon_url THEN changed := changed || jsonb_build_object('icon', NEW.icon_url IS NOT NULL); END IF;
  IF NEW.banner_url IS DISTINCT FROM OLD.banner_url THEN changed := changed || jsonb_build_object('banner', NEW.banner_url IS NOT NULL); END IF;
  IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN changed := changed || jsonb_build_object('visibility', NEW.visibility); END IF;
  IF NEW.interactions IS DISTINCT FROM OLD.interactions THEN changed := changed || jsonb_build_object('interactions', NEW.interactions); END IF;
  IF changed <> '{}'::jsonb THEN
    PERFORM public.write_audit(NEW.id, CASE WHEN changed ? 'visibility' OR changed ? 'interactions' THEN 'settings_updated' ELSE 'server_updated' END,
      'server', NEW.id, NEW.name, changed);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_roles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit(NEW.server_id, 'role_created', 'role', NEW.id, NEW.name, jsonb_build_object('color', NEW.color));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.write_audit(NEW.server_id,
      CASE WHEN NEW.permissions IS DISTINCT FROM OLD.permissions THEN 'role_permissions_updated' ELSE 'role_updated' END,
      'role', NEW.id, NEW.name,
      jsonb_build_object('color', NEW.color, 'position', NEW.position));
    RETURN NEW;
  END IF;
  PERFORM public.write_audit(OLD.server_id, 'role_deleted', 'role', OLD.id, OLD.name, '{}'::jsonb);
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_invites() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit(NEW.server_id, 'invite_created', 'invite', NEW.id, NEW.code,
      jsonb_build_object('max_uses', NEW.max_uses, 'expires_at', NEW.expires_at));
    RETURN NEW;
  END IF;
  PERFORM public.write_audit(OLD.server_id, 'invite_revoked', 'invite', OLD.id, OLD.code, '{}'::jsonb);
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_member_removed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uname text;
BEGIN
  SELECT username INTO uname FROM public.profiles WHERE id = OLD.user_id;
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id THEN
    PERFORM public.write_audit(OLD.server_id, 'member_kicked', 'user', OLD.user_id, uname, '{}'::jsonb);
  ELSE
    PERFORM public.write_audit(OLD.server_id, 'member_left', 'user', OLD.user_id, uname, '{}'::jsonb);
  END IF;
  RETURN OLD;
END; $$;

-- Banning also removes membership, and is audited.
CREATE OR REPLACE FUNCTION public.audit_bans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uname text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT username INTO uname FROM public.profiles WHERE id = NEW.user_id;
    DELETE FROM public.server_members WHERE server_id = NEW.server_id AND user_id = NEW.user_id;
    PERFORM public.write_audit(NEW.server_id, 'member_banned', 'user', NEW.user_id, uname,
      jsonb_build_object('reason', COALESCE(NEW.reason,'')));
    RETURN NEW;
  END IF;
  SELECT username INTO uname FROM public.profiles WHERE id = OLD.user_id;
  PERFORM public.write_audit(OLD.server_id, 'member_unbanned', 'user', OLD.user_id, uname, '{}'::jsonb);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS servers_audit ON public.servers;
CREATE TRIGGER servers_audit AFTER INSERT OR UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.audit_servers();
DROP TRIGGER IF EXISTS roles_audit ON public.roles;
CREATE TRIGGER roles_audit AFTER INSERT OR UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.audit_roles();
DROP TRIGGER IF EXISTS invites_audit ON public.server_invites;
CREATE TRIGGER invites_audit AFTER INSERT OR DELETE ON public.server_invites FOR EACH ROW EXECUTE FUNCTION public.audit_invites();
DROP TRIGGER IF EXISTS members_audit ON public.server_members;
CREATE TRIGGER members_audit AFTER DELETE ON public.server_members FOR EACH ROW EXECUTE FUNCTION public.audit_member_removed();
DROP TRIGGER IF EXISTS bans_audit ON public.server_bans;
CREATE TRIGGER bans_audit AFTER INSERT OR DELETE ON public.server_bans FOR EACH ROW EXECUTE FUNCTION public.audit_bans();

-- 5. Audit-log reader with actor/target profiles ---------------------------
CREATE OR REPLACE FUNCTION public.list_server_audit_logs(_server_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, action text, target_type text, target_id uuid, target_label text,
  metadata jsonb, created_at timestamptz,
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT l.id, l.action, l.target_type, l.target_id, l.target_label, l.metadata, l.created_at,
         l.actor_id, p.username, p.display_name, p.avatar_url
  FROM public.audit_logs l
  LEFT JOIN public.profiles p ON p.id = l.actor_id
  WHERE l.server_id = _server_id
    AND public.has_server_permission(_server_id, auth.uid(), 'view_audit_log')
  ORDER BY l.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 100), 300);
$$;

CREATE OR REPLACE FUNCTION public.list_server_bans(_server_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, username text, display_name text, avatar_url text,
  reason text, created_at timestamptz, banned_by uuid, banned_by_username text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, b.user_id, p.username, p.display_name, p.avatar_url,
         b.reason, b.created_at, b.banned_by, bp.username
  FROM public.server_bans b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.profiles bp ON bp.id = b.banned_by
  WHERE b.server_id = _server_id
    AND public.has_server_permission(_server_id, auth.uid(), 'ban_members')
  ORDER BY b.created_at DESC;
$$;

-- 6. Invite preview exposes the banner ------------------------------------
DROP FUNCTION IF EXISTS public.get_invite_preview(text);
CREATE OR REPLACE FUNCTION public.get_invite_preview(_code text)
RETURNS TABLE(server_id uuid, server_name text, server_icon_url text, server_banner_url text,
              server_description text, member_count bigint, already_member boolean, valid boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  inv public.server_invites%ROWTYPE;
  srv public.servers%ROWTYPE;
  uid UUID := auth.uid();
BEGIN
  SELECT * INTO inv FROM public.server_invites WHERE code = lower(trim(_code));
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::BIGINT, false, false, 'invite_not_found';
    RETURN;
  END IF;

  SELECT * INTO srv FROM public.servers WHERE id = inv.server_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::BIGINT, false, false, 'server_not_found';
    RETURN;
  END IF;

  RETURN QUERY SELECT
    srv.id, srv.name, srv.icon_url, srv.banner_url, srv.description,
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
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_server_audit_logs(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_server_bans(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_server_permission(uuid, uuid, text) TO authenticated;