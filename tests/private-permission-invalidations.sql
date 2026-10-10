BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('90000000-0000-0000-0000-000000000001','permission-owner@example.test','{"username":"permissionowner","display_name":"Owner"}'),
 ('90000000-0000-0000-0000-000000000002','permission-member@example.test','{"username":"permissionmember","display_name":"Member"}'),
 ('90000000-0000-0000-0000-000000000003','permission-outside@example.test','{"username":"permissionoutside","display_name":"Outside"}');
INSERT INTO servers(id,owner_id,name) VALUES
 ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','Permission room'),
 ('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','Other room');
INSERT INTO server_members(id,server_id,user_id) VALUES
 ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001'),
 ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002'),
 ('92000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003');
CREATE TEMP TABLE invalidation_before AS SELECT * FROM public.permission_invalidations;
INSERT INTO roles(id,server_id,name) VALUES
 ('93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Permission test');
INSERT INTO member_roles(member_id,role_id) VALUES
 ('92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001');
UPDATE roles SET permissions='{"administrator":true}' WHERE id='93000000-0000-0000-0000-000000000001';
DELETE FROM roles WHERE id='93000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.permission_invalidations i JOIN invalidation_before b USING(user_id)
   WHERE i.user_id='90000000-0000-0000-0000-000000000003' AND i.revision<>b.revision) THEN
   RAISE EXCEPTION 'Cross-server invalidation'; END IF;
 IF EXISTS(SELECT FROM public.permission_invalidations i JOIN invalidation_before b USING(user_id)
   WHERE i.user_id IN ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002') AND i.revision<=b.revision) THEN
   RAISE EXCEPTION 'Role events lost'; END IF;
END $$;
UPDATE invalidation_before SET revision=(SELECT revision FROM public.permission_invalidations i WHERE i.user_id=invalidation_before.user_id);
DELETE FROM server_members WHERE id='92000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT i.revision<=b.revision FROM public.permission_invalidations i JOIN invalidation_before b USING(user_id)
 WHERE user_id='90000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Removed recipient not notified'; END IF;
 IF NOT EXISTS(SELECT FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='permission_invalidations') THEN RAISE EXCEPTION 'Publication missing'; END IF;
 IF EXISTS(SELECT FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('server_members','roles','member_roles')) THEN RAISE EXCEPTION 'Unsafe raw role publication'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.permission_invalidations)<>1 THEN RAISE EXCEPTION 'Recipient isolation failed'; END IF;
 IF has_table_privilege(current_user,'public.permission_invalidations','INSERT') OR
    has_table_privilege(current_user,'public.permission_invalidations','UPDATE') OR
    has_table_privilege(current_user,'public.permission_invalidations','DELETE') OR
    has_function_privilege(current_user,'public.invalidate_server_permissions()','EXECUTE') THEN
   RAISE EXCEPTION 'Client can forge invalidations'; END IF;
 IF NOT public.can_use_realtime_topic('read-states:90000000-0000-0000-0000-000000000002',false) OR
    public.can_use_realtime_topic('read-states:90000000-0000-0000-0000-000000000001',false) OR
    public.can_use_realtime_topic('read-states:90000000-0000-0000-0000-000000000002',true) THEN
    RAISE EXCEPTION 'Private topic authorization failed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_table_privilege(current_user,'public.permission_invalidations','SELECT') THEN RAISE EXCEPTION 'Anonymous access'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
