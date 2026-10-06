SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',test_id(3)::text,true);
DO $$ BEGIN
 BEGIN PERFORM set_voice_restriction(test_id(10),test_id(4),'muted',true); RAISE EXCEPTION 'MOD allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_authorized' THEN RAISE; END IF; END;
 BEGIN PERFORM request_voice_move(test_id(4),test_id(20),test_id(21),'session'); RAISE EXCEPTION 'MOD move allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_authorized' THEN RAISE; END IF; END;
 UPDATE roles SET name='Forged owner' WHERE id=test_id(41);
 IF EXISTS(SELECT 1 FROM roles WHERE id=test_id(41) AND name<>'OWNER') THEN RAISE EXCEPTION 'MOD renamed owner'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',test_id(2)::text,true);
SELECT set_voice_restriction(test_id(10),test_id(4),'muted',true);
SELECT set_voice_restriction(test_id(10),test_id(4),'deafened',true);
SELECT set_voice_restriction(test_id(10),test_id(4),'muted',false);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM voice_restrictions WHERE user_id=test_id(4) AND NOT muted AND deafened) THEN RAISE EXCEPTION 'independent flags failed'; END IF;
 BEGIN PERFORM set_voice_restriction(test_id(10),test_id(1),'muted',true); RAISE EXCEPTION 'owner silenced'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_target' THEN RAISE; END IF; END;
 BEGIN PERFORM request_voice_move(test_id(4),test_id(20),test_id(22),'session'); RAISE EXCEPTION 'cross-server allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_destination' THEN RAISE; END IF; END;
END $$;
SELECT request_voice_move(test_id(4),test_id(20),test_id(21),'session');
SELECT request_voice_move(test_id(4),test_id(20),null,'session');
SELECT set_config('request.jwt.claim.sub',test_id(1)::text,true);
UPDATE roles SET name='Fundador',color='#f472b6' WHERE id=test_id(41);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM roles WHERE id=test_id(41) AND name='Fundador' AND is_owner AND color='#f472b6') THEN RAISE EXCEPTION 'owner cosmetics failed'; END IF;
 BEGIN UPDATE roles SET permissions='{}' WHERE id=test_id(41); RAISE EXCEPTION 'owner lost privileges'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected_role' THEN RAISE; END IF; END;
 BEGIN UPDATE roles SET is_owner=false WHERE id=test_id(41); RAISE EXCEPTION 'identity changed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'protected_role' THEN RAISE; END IF; END;
 DELETE FROM roles WHERE id=test_id(41);
 IF NOT EXISTS(SELECT 1 FROM roles WHERE id=test_id(41) AND is_owner) THEN RAISE EXCEPTION 'renamed owner deleted'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM voice_move_requests WHERE action='disconnect' AND destination_channel_id IS NULL) THEN RAISE EXCEPTION 'disconnect missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM voice_move_requests WHERE action='move' AND destination_channel_id=test_id(21)) THEN RAISE EXCEPTION 'move missing'; END IF;
END $$;
ROLLBACK;
