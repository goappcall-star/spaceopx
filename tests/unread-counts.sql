BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('80000000-0000-0000-0000-000000000001','unread-owner@example.test','{"username":"unreadowner","display_name":"Owner"}'),
 ('80000000-0000-0000-0000-000000000002','unread-reader@example.test','{"username":"unreadreader","display_name":"Reader"}'),
 ('80000000-0000-0000-0000-000000000003','unread-outsider@example.test','{"username":"unreadoutside","display_name":"Outside"}');
INSERT INTO servers(id,owner_id,name) VALUES ('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Unread room');
INSERT INTO server_members(server_id,user_id,joined_at) VALUES
 ('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001',now()-interval '1 hour'),
 ('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002',now()-interval '1 hour');
INSERT INTO channels(id,server_id,name,type) VALUES ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','chat','text');
INSERT INTO messages(id,channel_id,author_id,content,mentions,created_at) VALUES
 ('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','First','{}',now()-interval '2 minutes'),
 ('83000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Mention',ARRAY['80000000-0000-0000-0000-000000000002']::uuid[],now()-interval '1 minute'),
 ('83000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','Own message','{}',now());
INSERT INTO conversations(id,type,created_by,owner_id,name) VALUES
 ('85000000-0000-0000-0000-000000000001','group','80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Unread private');
INSERT INTO conversation_members(conversation_id,user_id,last_read_at) VALUES
 ('85000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001',now()-interval '1 hour'),
 ('85000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002',now()-interval '1 hour');
INSERT INTO direct_messages(id,conversation_id,sender_id,content,created_at) VALUES
 ('84000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Earlier private',now()-interval '2 minutes'),
 ('84000000-0000-0000-0000-000000000002','85000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Later private',now()-interval '1 minute');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.get_server_unread_counts() WHERE channel_id='82000000-0000-0000-0000-000000000001' AND unread_count=2 AND mention_count=1) THEN RAISE EXCEPTION 'Unread totals or mention count wrong'; END IF;
END $$;
SELECT public.mark_channel_read_through('82000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.get_server_unread_counts() WHERE channel_id='82000000-0000-0000-0000-000000000001' AND unread_count=1 AND mention_count=1) THEN RAISE EXCEPTION 'Read-through erased newer unseen message'; END IF;
END $$;
SELECT public.mark_channel_read_through('82000000-0000-0000-0000-000000000001',NULL);
SELECT public.mark_channel_read_through('82000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.get_server_unread_counts() WHERE channel_id='82000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Older read moved cursor backwards'; END IF;
END $$;
SELECT public.mark_conversation_read_through('85000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.list_conversation_overviews() WHERE id='85000000-0000-0000-0000-000000000001' AND unread_count=1) THEN RAISE EXCEPTION 'Private read erased later unseen message'; END IF;
END $$;
SELECT public.mark_conversation_read_through('85000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000002');
SELECT public.mark_conversation_read_through('85000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.list_conversation_overviews() WHERE id='85000000-0000-0000-0000-000000000001' AND unread_count=0) THEN RAISE EXCEPTION 'Private cursor moved backwards'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000003',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.get_server_unread_counts()) THEN RAISE EXCEPTION 'Unread RPC exposed another server'; END IF;
 BEGIN
   PERFORM public.mark_channel_read_through('82000000-0000-0000-0000-000000000001',NULL);
   RAISE EXCEPTION 'Unauthorized read accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.mark_conversation_read_through('85000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000002');
   RAISE EXCEPTION 'Unauthorized private read accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
-- Same authenticated session must lose access immediately after a role change.
INSERT INTO roles(id,server_id,name,permissions) VALUES
 ('86000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','Hidden','{"view_channel":false}');
INSERT INTO member_roles(member_id,role_id)
 SELECT id,'86000000-0000-0000-0000-000000000001' FROM server_members
 WHERE server_id='81000000-0000-0000-0000-000000000001' AND user_id='80000000-0000-0000-0000-000000000002';
DELETE FROM channel_read_states WHERE user_id='80000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.get_server_unread_counts()) OR EXISTS(SELECT FROM messages WHERE channel_id='82000000-0000-0000-0000-000000000001') OR EXISTS(SELECT FROM public.visible_message_channels()) THEN RAISE EXCEPTION 'Denied role leaked counts or messages'; END IF;
END $$;
RESET ROLE;
UPDATE roles SET permissions='{"view_channel":true}' WHERE id='86000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.get_server_unread_counts() WHERE unread_count=2 AND mention_count=1) THEN RAISE EXCEPTION 'Grant failed to restore correct counts'; END IF;
END $$;
RESET ROLE;
DELETE FROM server_members WHERE server_id='81000000-0000-0000-0000-000000000001' AND user_id='80000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.get_server_unread_counts()) OR EXISTS(SELECT FROM public.visible_message_channels()) OR EXISTS(SELECT FROM messages WHERE channel_id='82000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Removed member retained access'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.visible_message_channels()','EXECUTE') OR has_function_privilege('anon','public.get_server_unread_counts()','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC access'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='public.messages'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Message RLS disabled'; END IF;
END $$;
ROLLBACK;

