-- Synthetic identities in a freshly created LOCAL test database only.
CREATE SCHEMA community_test;
CREATE TABLE community_test.ids(name text PRIMARY KEY,id uuid NOT NULL);
GRANT USAGE ON SCHEMA community_test TO authenticated,anon;
GRANT SELECT,INSERT ON community_test.ids TO authenticated;
CREATE FUNCTION community_test.user_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('c1000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION community_test.actor(n integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub',community_test.user_id(n)::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
END $$;
CREATE FUNCTION community_test.id(key text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM community_test.ids WHERE name=key;
$$;
CREATE FUNCTION community_test.assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'COMMUNITY ASSERTION: %',label; END IF;
END $$;
CREATE FUNCTION community_test.denied(statement text, expected_state text, marker text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE=expected_state AND position(marker in SQLERRM)>0 THEN caught:=true; ELSE RAISE; END IF;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Expected denial: %',statement; END IF;
END $$;
CREATE FUNCTION community_test.payload(key text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('rules',jsonb_build_array(jsonb_build_object(
    'id','c9000000-0000-0000-0000-000000000001','text','Respeite os participantes.')),
    'welcome_channel_id',community_test.id(key||'-welcome'),'category_slug','gaming',
    'interests',jsonb_build_array(' jogos ','Jogos','coop'));
$$;

INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT community_test.user_id(n),'communitytest'||n||'@example.test',
  jsonb_build_object('username','communitytest'||n,'display_name','Community Test '||n)
FROM generate_series(1,8) n;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT community_test.actor(1);
INSERT INTO community_test.ids VALUES ('a',public.create_server('Comunidade técnica A'));
SELECT community_test.actor(8);
INSERT INTO community_test.ids VALUES ('b',public.create_server('Servidor comum B'));
COMMIT;

INSERT INTO community_test.ids SELECT 'a-welcome',id FROM public.channels WHERE server_id=community_test.id('a') AND type='text' ORDER BY position LIMIT 1;
INSERT INTO community_test.ids SELECT 'b-welcome',id FROM public.channels WHERE server_id=community_test.id('b') AND type='text' ORDER BY position LIMIT 1;
INSERT INTO community_test.ids SELECT 'a-member-role',id FROM public.roles WHERE server_id=community_test.id('a') AND name='MEMBER';

BEGIN;
SET LOCAL ROLE authenticated;
SELECT community_test.actor(1);
INSERT INTO community_test.ids VALUES ('invite',gen_random_uuid());
-- Keep the real invitation string in a separate local-only table.
CREATE TEMP TABLE invite_code AS SELECT public.create_server_invite(community_test.id('a')) AS code;
SELECT community_test.actor(2); SELECT public.join_server_by_invite((SELECT code FROM invite_code));
SELECT community_test.actor(3); SELECT public.join_server_by_invite((SELECT code FROM invite_code));
SELECT community_test.actor(4); SELECT public.join_server_by_invite((SELECT code FROM invite_code));
SELECT community_test.actor(5); SELECT public.join_server_by_invite((SELECT code FROM invite_code));
SELECT community_test.actor(6); SELECT public.join_server_by_invite((SELECT code FROM invite_code));
SELECT community_test.actor(1);
INSERT INTO public.roles(id,server_id,name,permissions) VALUES
 ('c2000000-0000-0000-0000-000000000001',community_test.id('a'),'Gestores da comunidade','{}'),
 ('c2000000-0000-0000-0000-000000000002',community_test.id('a'),'Administrador geral','{"administrator":true}'),
 ('c2000000-0000-0000-0000-000000000003',community_test.id('a'),'Gestor de cargos','{"manage_roles":true,"manage_members":true}');
INSERT INTO community_test.ids VALUES ('delegate-role','c2000000-0000-0000-0000-000000000001');
INSERT INTO public.member_roles(member_id,role_id)
SELECT m.id,r.id FROM public.server_members m CROSS JOIN public.roles r
WHERE m.server_id=community_test.id('a') AND r.server_id=m.server_id AND
  ((m.user_id=community_test.user_id(2) AND r.name='Gestores da comunidade') OR
   (m.user_id=community_test.user_id(3) AND r.name='Administrador geral') OR
   (m.user_id=community_test.user_id(4) AND r.name='Gestor de cargos'));
INSERT INTO public.messages(channel_id,author_id,content)
VALUES (community_test.id('a-welcome'),community_test.user_id(1),'Mensagem técnica de fixture. Preservar.');
COMMIT;

CREATE FUNCTION community_test.snapshot() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'servers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.servers t),
    'channels',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.channels t),
    'categories',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.server_categories t),
    'members',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.server_members t),
    'roles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.roles t),
    'assignments',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.member_roles t),
    'invites',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.server_invites t),
    'messages',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.messages t),
    'xp',(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM public.user_xp t),
    'badges',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.user_badges t));
$$;

CREATE FUNCTION community_test.invite(key text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT code FROM public.server_invites WHERE server_id=community_test.id(key) ORDER BY created_at LIMIT 1;
$$;
