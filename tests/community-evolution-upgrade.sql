BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.community_achievement_unlocks WHERE server_id=(SELECT id FROM security_private.community_4c_upgrade_fixture))<>2 THEN RAISE EXCEPTION '4C upgrade fixture must have real prior 4B milestones'; END IF;
 IF EXISTS(SELECT FROM public.community_reward_unlocks WHERE server_id=(SELECT id FROM security_private.community_4c_upgrade_fixture)) THEN RAISE EXCEPTION '4C must never backfill old cosmetics'; END IF;
END $$;
ROLLBACK;
