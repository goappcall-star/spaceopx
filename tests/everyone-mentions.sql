BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT ('91000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'mention'||i||'@example.test', jsonb_build_object('username','mention'||i,'display_name','Mention '||i)
FROM generate_series(1,63) i;
INSERT INTO servers(id,owner_id,name) VALUES
 ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Everyone local test'),
 ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000063','Other local test');
INSERT INTO server_members(server_id,user_id,joined_at)
SELECT '92000000-0000-0000-0000-000000000001',('91000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,now()-interval '1 hour'
FROM generate_series(1,62) i;
INSERT INTO server_members(server_id,user_id) VALUES ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000063');
INSERT INTO channels(id,server_id,name,type) VALUES ('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','technical','text');
INSERT INTO roles(id,server_id,name,permissions) VALUES ('94000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','No view','{"view_channel":false}');
INSERT INTO member_roles(member_id,role_id)
SELECT id,'94000000-0000-0000-0000-000000000001' FROM server_members WHERE user_id='91000000-0000-0000-0000-000000000062';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
INSERT INTO messages(id,channel_id,author_id,content,mentions) VALUES ('95000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Aviso **@TODOS**!','{}');
INSERT INTO messages(id,channel_id,author_id,content,mentions_everyone) VALUES ('95000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Normal email@todos @todos123',true);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM server_mention_notifications WHERE message_id='95000000-0000-0000-0000-000000000001')<>60 THEN RAISE EXCEPTION 'Expected 60 eligible recipients'; END IF;
 IF (SELECT mentions_everyone FROM messages WHERE id='95000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Spoofed flag accepted'; END IF;
 IF EXISTS(SELECT FROM server_mention_notifications WHERE recipient_id IN ('91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000062','91000000-0000-0000-0000-000000000063')) THEN RAISE EXCEPTION 'Private or own notification leaked'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM server_mention_notifications)<>1 THEN RAISE EXCEPTION 'Recipient isolation failed'; END IF;
 IF NOT EXISTS(SELECT FROM get_server_unread_counts() WHERE channel_id='93000000-0000-0000-0000-000000000001' AND mention_count=1 AND unread_count=2) THEN RAISE EXCEPTION 'Everyone unread count failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000062',true);
DO $$ BEGIN IF EXISTS(SELECT FROM server_mention_notifications) OR EXISTS(SELECT FROM get_server_unread_counts()) THEN RAISE EXCEPTION 'Hidden channel leaked'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000063',true);
DO $$ BEGIN IF EXISTS(SELECT FROM server_mention_notifications) OR EXISTS(SELECT FROM get_server_unread_counts()) THEN RAISE EXCEPTION 'Other server leaked'; END IF; END $$;
ROLLBACK;
