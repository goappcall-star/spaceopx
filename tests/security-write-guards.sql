BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('10000000-0000-0000-0000-000000000001','owner@example.test','{"username":"owner","display_name":"Owner"}'),
 ('10000000-0000-0000-0000-000000000002','member@example.test','{"username":"member","display_name":"Member"}'),
 ('10000000-0000-0000-0000-000000000003','other@example.test','{"username":"other","display_name":"Other"}');
INSERT INTO servers(id,owner_id,name) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Room A'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Room B');
INSERT INTO server_members(id,server_id,user_id) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003');
INSERT INTO channels(id,server_id,name,type) VALUES
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','general','text'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','private','text');
INSERT INTO conversations(id,type,created_by,owner_id,name) VALUES
 ('50000000-0000-0000-0000-000000000001','group','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Group A'),
 ('50000000-0000-0000-0000-000000000002','group','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Group B');
INSERT INTO conversation_members(conversation_id,user_id) VALUES
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003');
INSERT INTO messages(id,channel_id,author_id,content) VALUES
 ('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Hello'),
 ('60000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Private');
INSERT INTO direct_messages(id,conversation_id,sender_id,content) VALUES
 ('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Hello'),
 ('70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Private');
CREATE FUNCTION public.expect_security_error(command text, expected text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE=expected THEN RETURN; END IF;
    RAISE EXCEPTION 'Unexpected state: %, expected %; %',SQLSTATE,expected,SQLERRM;
  END;
  RAISE EXCEPTION 'Unsafe action succeeded: %',command;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SELECT expect_security_error($q$UPDATE server_members SET server_id='20000000-0000-0000-0000-000000000002' WHERE id='30000000-0000-0000-0000-000000000002'$q$,'42501');
SELECT expect_security_error($q$UPDATE conversation_members SET conversation_id='50000000-0000-0000-0000-000000000002' WHERE user_id=auth.uid()$q$,'42501');
SELECT expect_security_error($q$UPDATE messages SET channel_id='40000000-0000-0000-0000-000000000002' WHERE id='60000000-0000-0000-0000-000000000001'$q$,'42501');
SELECT expect_security_error($q$UPDATE direct_messages SET conversation_id='50000000-0000-0000-0000-000000000002' WHERE id='70000000-0000-0000-0000-000000000001'$q$,'42501');
SELECT expect_security_error($q$UPDATE profiles SET avatar_url='javascript:alert(1)' WHERE id=auth.uid()$q$,'22023');
SELECT expect_security_error($q$INSERT INTO messages(channel_id,author_id,content) VALUES('40000000-0000-0000-0000-000000000001',auth.uid(),repeat('x',4001))$q$,'22023');
SELECT expect_security_error($q$INSERT INTO messages(channel_id,author_id,content,mentions) VALUES('40000000-0000-0000-0000-000000000001',auth.uid(),'Hi',ARRAY['10000000-0000-0000-0000-000000000003']::uuid[])$q$,'22023');
SELECT expect_security_error($q$INSERT INTO messages(channel_id,author_id,content,reply_to_id) VALUES('40000000-0000-0000-0000-000000000001',auth.uid(),'Hi','60000000-0000-0000-0000-000000000002')$q$,'22023');
SELECT expect_security_error($q$INSERT INTO messages(channel_id,author_id,content,attachments) VALUES('40000000-0000-0000-0000-000000000001',auth.uid(),'Hi','{}')$q$,'22023');
SELECT expect_security_error($q$INSERT INTO direct_messages(conversation_id,sender_id,content) VALUES('50000000-0000-0000-0000-000000000002',auth.uid(),'Intruder')$q$,'42501');
SELECT expect_security_error('SELECT * FROM security_private.write_windows','42501');
SELECT expect_security_error($q$SELECT public.award_xp(auth.uid(),1000)$q$,'42501');
DO $$ BEGIN
  IF NOT public.can_use_realtime_topic('voice:20000000-0000-0000-0000-000000000001',false) THEN RAISE EXCEPTION 'Own server realtime denied'; END IF;
  IF public.can_use_realtime_topic('voice:20000000-0000-0000-0000-000000000002',false) THEN RAISE EXCEPTION 'Foreign server realtime allowed'; END IF;
  IF public.can_use_realtime_topic('rtc:40000000-0000-0000-0000-000000000002',true) THEN RAISE EXCEPTION 'Foreign voice signaling allowed'; END IF;
  IF NOT public.can_use_realtime_topic('rtc:40000000-0000-0000-0000-000000000001',true) THEN RAISE EXCEPTION 'Own voice signaling denied'; END IF;
  IF public.can_use_realtime_topic('calls:user:10000000-0000-0000-0000-000000000001',false) THEN RAISE EXCEPTION 'Another inbox readable'; END IF;
  IF NOT public.can_use_realtime_topic('calls:user:10000000-0000-0000-0000-000000000001',true) THEN RAISE EXCEPTION 'Allowed ring denied'; END IF;
  IF public.can_use_realtime_topic('callsig:10000000-0000-0000-0000-000000000001-10000000-0000-0000-0000-000000000003-abc123',false) THEN RAISE EXCEPTION 'Another pair control readable'; END IF;
  IF public.can_use_realtime_topic('rtc:group-call-50000000-0000-0000-0000-000000000002',false) THEN RAISE EXCEPTION 'Another group voice readable'; END IF;
  IF public.can_use_realtime_topic('typing:not-a-uuid',true) THEN RAISE EXCEPTION 'Malformed topic accepted'; END IF;
  IF EXISTS(SELECT FROM messages WHERE channel_id='40000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Private channel visible'; END IF;
  IF EXISTS(SELECT FROM direct_messages WHERE conversation_id='50000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Private conversation visible'; END IF;
END $$;
UPDATE server_members SET nickname='New nickname' WHERE user_id=auth.uid();
UPDATE profiles SET bio='Safe biography', avatar_url='https://example.test/avatar.png' WHERE id=auth.uid();
UPDATE messages SET content='Edited safely' WHERE id='60000000-0000-0000-0000-000000000001';
INSERT INTO messages(channel_id,author_id,content) VALUES('40000000-0000-0000-0000-000000000001',auth.uid(),'New message');
INSERT INTO message_reactions(message_id,user_id,emoji) VALUES('60000000-0000-0000-0000-000000000001',auth.uid(),'👍');
UPDATE direct_messages SET deleted_at=now(),content='',attachments='[]' WHERE id='70000000-0000-0000-0000-000000000001';
SELECT public.mark_conversation_read('50000000-0000-0000-0000-000000000001');

RESET ROLE;
-- Seed both possible burst windows so crossing a clock boundary cannot weaken this test.
INSERT INTO security_private.write_windows(user_id,action,window_seconds,window_start,requests)
  SELECT '10000000-0000-0000-0000-000000000002','messages',10,floor(extract(epoch FROM clock_timestamp())/10)::bigint+offset_value,10
  FROM generate_series(0,1) offset_value
  ON CONFLICT(user_id,action,window_seconds,window_start) DO UPDATE SET requests=10;
SET LOCAL ROLE authenticated;
SELECT expect_security_error($q$INSERT INTO messages(channel_id,author_id,content) VALUES('40000000-0000-0000-0000-000000000001',auth.uid(),'Spam')$q$,'P0001');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
-- Latest real create_server RPC plus owner-role editing/categories still work.
SELECT public.create_server('Security test room');
UPDATE roles SET name='Proprietário',color='#abcdef' WHERE is_owner AND server_id IN (SELECT id FROM servers WHERE name='Security test room');
INSERT INTO server_categories SELECT * FROM server_categories WHERE server_id IN (SELECT id FROM servers WHERE name='Security test room')
  ON CONFLICT(id) DO UPDATE SET position=excluded.position+1,created_at=excluded.created_at,server_id=excluded.server_id;
SELECT public.leave_group_conversation('50000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM conversations WHERE id='50000000-0000-0000-0000-000000000001' AND owner_id='10000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Owner succession broken'; END IF;
  IF EXISTS(SELECT FROM storage.buckets WHERE id IN ('avatars','banners') AND file_size_limit<>4194304) THEN RAISE EXCEPTION 'Image limits missing'; END IF;
END $$;
ROLLBACK;
