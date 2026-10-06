INSERT INTO servers VALUES(test_id(1),test_id(10)),(test_id(2),test_id(11));
INSERT INTO channels(id,server_id,name,type,is_afk) VALUES(test_id(100),test_id(1),'AFK','voice',true);
DO $$ BEGIN
  INSERT INTO channels(id,server_id,name,type,is_afk) VALUES(test_id(101),test_id(1),'Second AFK','voice',true);
  RAISE EXCEPTION 'second AFK unexpectedly allowed';
EXCEPTION WHEN unique_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO channels(id,server_id,name,type,is_afk) VALUES(test_id(102),test_id(2),'Text AFK','text',true);
  RAISE EXCEPTION 'text AFK unexpectedly allowed';
EXCEPTION WHEN check_violation THEN NULL; END $$;
INSERT INTO channels(id,server_id,name,type,is_afk) VALUES(test_id(103),test_id(2),'Other AFK','voice',true);
DELETE FROM channels WHERE id=test_id(100);
INSERT INTO channels(id,server_id,name,type,is_afk) VALUES(test_id(104),test_id(1),'Replacement AFK','voice',true);
ROLLBACK;
SELECT 'AFK constraints and recreation passed' AS result;
