BEGIN;
CREATE SCHEMA community_test;
CREATE FUNCTION community_test.assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'UPGRADE ASSERTION: %',label; END IF; END $$;
SELECT community_test.assert(NOT EXISTS(SELECT FROM public.community_achievement_unlocks WHERE server_id=(SELECT server_id FROM security_private.community_4b_upgrade_fixture)),'migration did not backfill old milestones');
SELECT set_config('request.jwt.claim.sub','d4b00000-0000-0000-0000-000000000001',true);
SELECT public.save_server_community(f.server_id,jsonb_build_object('rules','[{"id":"d4b00000-0000-0000-0000-000000000002","text":"Respeite as pessoas."}]'::jsonb,'welcome_channel_id',(SELECT id FROM public.channels WHERE server_id=f.server_id AND type='text' ORDER BY position LIMIT 1),'category_slug','gaming','interests','[]'::jsonb),2) FROM security_private.community_4b_upgrade_fixture f;
SELECT public.save_community_discovery(server_id,payload,2,true) FROM security_private.community_4b_upgrade_fixture;
SELECT community_test.assert(NOT EXISTS(SELECT FROM public.community_achievement_unlocks WHERE server_id=(SELECT server_id FROM security_private.community_4b_upgrade_fixture)),'reactivation and republication do not manufacture retroactive awards');
ROLLBACK;
