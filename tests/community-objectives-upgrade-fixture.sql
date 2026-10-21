-- Called ONLY by the disposable database runner, immediately before migration 4B.
-- Existing activation/publication must not receive retroactive achievements.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('d4b00000-0000-0000-0000-000000000001','upgrade4b@example.test','{"username":"upgrade4b","display_name":"Upgrade synthetic"}');
CREATE TABLE security_private.community_4b_upgrade_fixture(server_id uuid PRIMARY KEY,payload jsonb NOT NULL);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d4b00000-0000-0000-0000-000000000001',true);
CREATE TEMP TABLE upgrade4b AS SELECT public.create_server('Anterior à Fase 4B') id;
SELECT public.save_server_community(id,jsonb_build_object('rules','[{"id":"d4b00000-0000-0000-0000-000000000002","text":"Respeite as pessoas."}]'::jsonb,'welcome_channel_id',(SELECT id FROM public.channels WHERE server_id=upgrade4b.id AND type='text' ORDER BY position LIMIT 1),'category_slug','gaming','interests','[]'::jsonb),0) FROM upgrade4b;
CREATE TEMP TABLE upgrade4b_payload AS SELECT jsonb_build_object('name','Comunidade anterior','description','Publicação sintética anterior à instalação da Fase 4B.','icon_url',NULL,'banner_url',NULL,'category','gaming','language','pt-br','interests','[]'::jsonb,'public_rules','["Respeito."]'::jsonb,'admission','approval','consent',true) value;
SELECT public.save_community_discovery(id,(SELECT value FROM upgrade4b_payload),0,true) FROM upgrade4b;
SELECT public.disable_server_community(id,1) FROM upgrade4b;
RESET ROLE;
INSERT INTO security_private.community_4b_upgrade_fixture SELECT id,(SELECT value FROM upgrade4b_payload) FROM upgrade4b;
COMMIT;
