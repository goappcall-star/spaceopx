-- =========================================================
-- SecureChat foundation
-- =========================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_status_check CHECK (status IN ('online','idle','offline')),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_.]{3,32}$')
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
  icon_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);
CREATE INDEX server_members_user_idx ON public.server_members(user_id);
CREATE INDEX server_members_server_idx ON public.server_members(server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_members TO authenticated;
GRANT ALL ON public.server_members TO service_role;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b95a5',
  position INTEGER NOT NULL DEFAULT 0,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
CREATE INDEX roles_server_idx ON public.roles(server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.server_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, role_id)
);
CREATE INDEX member_roles_member_idx ON public.member_roles(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_roles TO authenticated;
GRANT ALL ON public.member_roles TO service_role;
ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','voice','announcement','forum')),
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX channels_server_idx ON public.channels(server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.server_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX server_invites_server_idx ON public.server_invites(server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_invites TO authenticated;
GRANT ALL ON public.server_invites TO service_role;
ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS (avoid recursive RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_server_member(_server_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members m
    WHERE m.server_id = _server_id AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_server_role(_server_id UUID, _user_id UUID, _roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.server_members m
    JOIN public.member_roles mr ON mr.member_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    WHERE m.server_id = _server_id
      AND m.user_id = _user_id
      AND r.name = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_server(_server_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_server_role(_server_id, _user_id, ARRAY['OWNER','ADMIN']);
$$;

CREATE OR REPLACE FUNCTION public.is_server_owner(_server_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.servers s WHERE s.id = _server_id AND s.owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.member_server_id(_member_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT server_id FROM public.server_members WHERE id = _member_id;
$$;

CREATE OR REPLACE FUNCTION public.shares_server_with(_other_user UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members a
    JOIN public.server_members b ON b.server_id = a.server_id
    WHERE a.user_id = _user_id AND b.user_id = _other_user
  );
$$;

-- =========================================================
-- POLICIES
-- =========================================================
CREATE POLICY "profiles_select_self_or_shared_server" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_server_with(id, auth.uid()));

CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "servers_select_members" ON public.servers
  FOR SELECT TO authenticated
  USING (public.is_server_member(id, auth.uid()));

CREATE POLICY "servers_insert_owner" ON public.servers
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "servers_update_admins" ON public.servers
  FOR UPDATE TO authenticated
  USING (public.can_manage_server(id, auth.uid()))
  WITH CHECK (public.can_manage_server(id, auth.uid()));

CREATE POLICY "servers_delete_owner" ON public.servers
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "server_members_select_same_server" ON public.server_members
  FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));

CREATE POLICY "server_members_insert_admins" ON public.server_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_server(server_id, auth.uid()));

CREATE POLICY "server_members_update" ON public.server_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_server(server_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.can_manage_server(server_id, auth.uid()));

CREATE POLICY "server_members_delete" ON public.server_members
  FOR DELETE TO authenticated
  USING (
    NOT public.is_server_owner(server_id, user_id)
    AND (user_id = auth.uid() OR public.can_manage_server(server_id, auth.uid()))
  );

CREATE POLICY "roles_select_members" ON public.roles
  FOR SELECT TO authenticated USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "roles_insert_admins" ON public.roles
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_server(server_id, auth.uid()));
CREATE POLICY "roles_update_admins" ON public.roles
  FOR UPDATE TO authenticated
  USING (public.can_manage_server(server_id, auth.uid()) AND name <> 'OWNER')
  WITH CHECK (public.can_manage_server(server_id, auth.uid()) AND name <> 'OWNER');
CREATE POLICY "roles_delete_admins" ON public.roles
  FOR DELETE TO authenticated
  USING (public.can_manage_server(server_id, auth.uid()) AND name NOT IN ('OWNER','MEMBER'));

CREATE POLICY "member_roles_select_members" ON public.member_roles
  FOR SELECT TO authenticated
  USING (public.is_server_member(public.member_server_id(member_id), auth.uid()));
CREATE POLICY "member_roles_insert_admins" ON public.member_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_server(public.member_server_id(member_id), auth.uid()));
CREATE POLICY "member_roles_delete_admins" ON public.member_roles
  FOR DELETE TO authenticated
  USING (public.can_manage_server(public.member_server_id(member_id), auth.uid()));

CREATE POLICY "channels_select_members" ON public.channels
  FOR SELECT TO authenticated USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "channels_insert_admins" ON public.channels
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_server(server_id, auth.uid()));
CREATE POLICY "channels_update_admins" ON public.channels
  FOR UPDATE TO authenticated
  USING (public.can_manage_server(server_id, auth.uid()))
  WITH CHECK (public.can_manage_server(server_id, auth.uid()));
CREATE POLICY "channels_delete_admins" ON public.channels
  FOR DELETE TO authenticated USING (public.can_manage_server(server_id, auth.uid()));

CREATE POLICY "invites_select_members" ON public.server_invites
  FOR SELECT TO authenticated USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "invites_insert_admins" ON public.server_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_server(server_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "invites_delete_admins" ON public.server_invites
  FOR DELETE TO authenticated USING (public.can_manage_server(server_id, auth.uid()));

-- =========================================================
-- TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER servers_set_updated_at BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER channels_set_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user'),
    '[^a-zA-Z0-9_.]', '', 'g'));
  IF char_length(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;
  base_username := left(base_username, 24);
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = final_username) LOOP
    suffix := suffix + 1;
    final_username := left(base_username, 24) || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- TRANSACTIONAL RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_server(_name TEXT, _description TEXT DEFAULT NULL, _icon_url TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    (new_server_id, 'OWNER', '#22d3ee', 100, '{"administrator":true,"manage_server":true,"manage_roles":true,"manage_channels":true,"manage_members":true,"create_invite":true,"send_messages":true,"read_messages":true}'::jsonb)
    RETURNING id INTO owner_role_id;

  INSERT INTO public.roles (server_id, name, color, position, permissions) VALUES
    (new_server_id, 'ADMIN', '#a78bfa', 50, '{"administrator":false,"manage_server":true,"manage_roles":true,"manage_channels":true,"manage_members":true,"create_invite":true,"send_messages":true,"read_messages":true}'::jsonb),
    (new_server_id, 'MEMBER', '#8b95a5', 1, '{"administrator":false,"manage_server":false,"manage_roles":false,"manage_channels":false,"manage_members":false,"create_invite":false,"send_messages":true,"read_messages":true}'::jsonb);

  INSERT INTO public.server_members (server_id, user_id) VALUES (new_server_id, uid) RETURNING id INTO new_member_id;
  INSERT INTO public.member_roles (member_id, role_id) VALUES (new_member_id, owner_role_id);

  INSERT INTO public.channels (server_id, name, type, description, position)
  VALUES (new_server_id, 'geral', 'text', 'Canal principal do servidor', 0);

  RETURN new_server_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_server(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_server(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_server_invite(_server_id UUID, _max_uses INTEGER DEFAULT NULL, _expires_in_hours INTEGER DEFAULT 168)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  new_code TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.can_manage_server(_server_id, uid) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  LOOP
    new_code := lower(encode(gen_random_bytes(6), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.server_invites WHERE code = new_code);
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
REVOKE ALL ON FUNCTION public.create_server_invite(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_server_invite(UUID, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invite_preview(_code TEXT)
RETURNS TABLE (server_id UUID, server_name TEXT, server_icon_url TEXT, server_description TEXT, member_count BIGINT, already_member BOOLEAN, valid BOOLEAN, reason TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.server_invites%ROWTYPE;
  srv public.servers%ROWTYPE;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

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
    EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = srv.id AND m.user_id = uid),
    CASE
      WHEN inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN false
      WHEN inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN false
      ELSE true END,
    CASE
      WHEN inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN 'invite_expired'
      WHEN inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN 'invite_exhausted'
      ELSE 'ok' END;
END;
$$;
REVOKE ALL ON FUNCTION public.get_invite_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_server_by_invite(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;
  IF inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN RAISE EXCEPTION 'invite_exhausted'; END IF;

  IF EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = inv.server_id AND m.user_id = uid) THEN
    RETURN inv.server_id;
  END IF;

  INSERT INTO public.server_members (server_id, user_id) VALUES (inv.server_id, uid) RETURNING id INTO new_member_id;

  SELECT id INTO member_role_id FROM public.roles WHERE server_id = inv.server_id AND name = 'MEMBER';
  IF member_role_id IS NOT NULL THEN
    INSERT INTO public.member_roles (member_id, role_id) VALUES (new_member_id, member_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.server_invites SET uses = uses + 1 WHERE id = inv.id;

  RETURN inv.server_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_server_by_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(TEXT) TO authenticated;