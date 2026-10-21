-- Only the upgrade database, immediately before 4C; real 4B unlocks already exist.
BEGIN;
SELECT set_config('request.jwt.claim.sub','d4b00000-0000-0000-0000-000000000001',true);
CREATE TEMP TABLE old4b_server AS SELECT public.create_server('Comunidade 4B anterior à 4C') id;
SELECT public.save_server_community(id,jsonb_build_object('rules','[{"id":"d4c00000-0000-0000-0000-000000000009","text":"Respeite as pessoas."}]'::jsonb,'welcome_channel_id',(SELECT id FROM public.channels WHERE server_id=old4b_server.id AND type='text' ORDER BY position LIMIT 1),'category_slug','gaming','interests','[]'::jsonb),0) FROM old4b_server;
SELECT public.save_community_discovery(s.id,f.payload,0,true) FROM old4b_server s CROSS JOIN security_private.community_4b_upgrade_fixture f;
CREATE TABLE security_private.community_4c_upgrade_fixture AS SELECT id FROM old4b_server;
COMMIT;
