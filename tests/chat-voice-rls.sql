
INSERT INTO profiles VALUES(test_id(10),'owner','Owner'),(test_id(11),'nico','Nico'),(test_id(12),'mod','Mod'),(test_id(13),'other','Other');
INSERT INTO servers VALUES(test_id(1),test_id(10)),(test_id(2),test_id(13));
INSERT INTO channels VALUES(test_id(101),test_id(1),'Voice A','voice'),(test_id(102),test_id(1),'Voice B','voice'),(test_id(103),test_id(2),'Other','voice'),(test_id(104),test_id(1),'chat','text');
INSERT INTO server_members VALUES(test_id(30),test_id(1),test_id(10)),(test_id(31),test_id(1),test_id(11)),(test_id(32),test_id(1),test_id(12));
INSERT INTO roles VALUES(test_id(20),'{"manage_voice":true}');
INSERT INTO member_roles VALUES(test_id(32),test_id(20));
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',test_id(11)::text,true);
DO $$ BEGIN
  PERFORM request_voice_move(test_id(12),test_id(101),test_id(102),'session');
  RAISE EXCEPTION 'ordinary member unexpectedly allowed';
EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'not_authorized' THEN RAISE; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',test_id(12)::text,true);
SELECT request_voice_move(test_id(11),test_id(101),test_id(102),'session');
DO $$ BEGIN
  PERFORM request_voice_move(test_id(11),test_id(101),test_id(103),'session');
  RAISE EXCEPTION 'cross-server destination unexpectedly allowed';
EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'invalid_destination' THEN RAISE; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',test_id(13)::text,true);
DO $$ BEGIN IF (SELECT count(*) FROM voice_move_requests) <> 0 THEN RAISE EXCEPTION 'voice request leaked'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',test_id(11)::text,true);
DO $$ BEGIN IF (SELECT count(*) FROM voice_move_requests) <> 1 THEN RAISE EXCEPTION 'target cannot read move'; END IF; END $$;
RESET ROLE;
INSERT INTO messages VALUES(test_id(40),test_id(104),test_id(10),'Hi @nico',ARRAY[test_id(11),test_id(13)]);
INSERT INTO messages VALUES(test_id(41),test_id(104),test_id(10),'Hi @nicolas',ARRAY[test_id(11)]);
DO $$ BEGIN IF (SELECT count(*) FROM server_mention_notifications) <> 1 THEN RAISE EXCEPTION 'mention boundary or membership validation failed'; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',test_id(13)::text,true);
DO $$ BEGIN IF (SELECT count(*) FROM server_mention_notifications) <> 0 THEN RAISE EXCEPTION 'mention leaked'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',test_id(11)::text,true);
DO $$ BEGIN IF (SELECT count(*) FROM server_mention_notifications) <> 1 THEN RAISE EXCEPTION 'mention unavailable for recipient'; END IF; END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Voice permission, cross-server, recipient RLS and mention validation passed' AS result;
