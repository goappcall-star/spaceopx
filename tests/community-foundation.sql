BEGIN;
SET LOCAL ROLE authenticated;
SELECT community_test.actor(1);
SELECT community_test.assert((get_server_community(community_test.id('a'))->>'can_manage')::boolean,'owner can manage');
SELECT community_test.assert(get_server_community(community_test.id('a'))->'settings'='null'::jsonb,'ordinary server has no configuration');

SELECT community_test.actor(3);
SELECT community_test.assert(public.has_server_permission(community_test.id('a'),auth.uid(),'manage_community'),'generic administrator shortcut exists');
SELECT community_test.assert(NOT public.can_manage_community(community_test.id('a')),'community does not inherit administrator');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),0)$q$,'42501','community_not_authorized');
SELECT community_test.denied($q$UPDATE public.roles SET permissions=permissions||'{"manage_community":true}' WHERE id=community_test.id('delegate-role')$q$,'42501','community_owner_required');
SELECT community_test.denied($q$INSERT INTO public.roles(server_id,name,permissions) VALUES (community_test.id('a'),'Self grant','{"manage_community":true}')$q$,'42501','community_owner_required');

SELECT community_test.actor(1);
SELECT community_test.denied($q$SELECT public.set_community_role_permission(community_test.id('a'),community_test.id('a-member-role'),true)$q$,'22023','community_role_ineligible');
SELECT public.set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),true);
SELECT community_test.actor(2);
SELECT community_test.assert(public.can_manage_community(community_test.id('a')),'explicitly delegated role can manage');
SELECT community_test.denied($q$SELECT public.set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),false)$q$,'42501','community_owner_required');
SELECT community_test.actor(4);
SELECT community_test.denied($q$INSERT INTO public.member_roles(member_id,role_id) SELECT id,community_test.id('delegate-role') FROM public.server_members WHERE server_id=community_test.id('a') AND user_id=auth.uid()$q$,'42501','community_owner_required');
WITH moved AS (UPDATE public.member_roles SET member_id=(SELECT id FROM public.server_members WHERE server_id=community_test.id('a') AND user_id=auth.uid()) WHERE role_id=community_test.id('delegate-role') RETURNING *)
SELECT community_test.assert((SELECT count(*) FROM moved)=0,'existing RLS blocks direct assignment transfer');
-- Editing unrelated fields of a privileged role preserves ordinary role administration.
UPDATE public.roles SET color='#a78bfa' WHERE id=community_test.id('delegate-role');

SELECT community_test.actor(1);
SELECT community_test.denied($q$UPDATE public.roles SET name='MEMBER' WHERE id=community_test.id('delegate-role')$q$,'22023','community_role_ineligible');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('b'),0)$q$,'22023','community_invalid_channel');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a')||'{"enabled":true}',0)$q$,'22023','community_invalid_payload');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a')||'{"rules":[]}',0)$q$,'22023','community_invalid_rules');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a')||'{"category_slug":"unknown"}',0)$q$,'22023','community_invalid_category');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a')||'{"interests":[{"bad":true}]}',0)$q$,'22023','community_invalid_interests');
SELECT community_test.denied($q$INSERT INTO public.server_community_settings(server_id,rules,category_slug) VALUES(community_test.id('a'),'[]','gaming')$q$,'42501','');

RESET ROLE;
CREATE TEMP TABLE before_conversion AS SELECT community_test.snapshot() AS state;
SET LOCAL ROLE authenticated;
SELECT community_test.actor(2);
SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),0);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,revision}')='1','activation revision');
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,interests}')='["jogos", "coop"]','interests normalized and deduplicated');
SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),1);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,revision}')='1','same revision/payload is idempotent');

SAVEPOINT before_new_join;
SELECT community_test.actor(7);
SELECT public.join_server_by_invite(community_test.invite('a'));
SELECT community_test.assert(NOT public.can_manage_community(community_test.id('a')),'new invited member never receives community power');
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,enabled}')='true','existing invite works for an active community');
ROLLBACK TO SAVEPOINT before_new_join;
SELECT community_test.actor(5);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,enabled}')='true','member sees active configuration');
SELECT community_test.assert(NOT (get_server_community(community_test.id('a'))->'settings' ? 'activated_by'),'RPC does not expose admin actor IDs');
SELECT community_test.denied($q$SELECT activated_by FROM public.server_community_settings$q$,'42501','');
SELECT community_test.assert((SELECT count(*) FROM public.server_community_settings WHERE enabled)=1,'allowed member projection works');
SELECT community_test.assert(NOT EXISTS(SELECT FROM public.audit_logs),'regular member cannot read administrative audit');
SELECT community_test.denied($q$UPDATE public.server_community_settings SET enabled=false WHERE server_id=community_test.id('a')$q$,'42501','');
SELECT community_test.denied($q$SELECT public.disable_server_community(community_test.id('a'),1)$q$,'42501','community_not_authorized');
SELECT community_test.actor(7);
SELECT community_test.denied($q$SELECT public.get_server_community(community_test.id('a'))$q$,'42501','community_not_authorized');
SELECT community_test.assert(NOT EXISTS(SELECT server_id FROM public.server_community_settings),'RLS hides other-server configuration');
SELECT community_test.actor(8);
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),1)$q$,'42501','community_not_authorized');

SELECT community_test.actor(1);
SELECT public.disable_server_community(community_test.id('a'),1);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,revision}')='2','disable increments revision');
SELECT public.disable_server_community(community_test.id('a'),2);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,revision}')='2','disable is idempotent');
SELECT community_test.actor(5);
SELECT community_test.assert(get_server_community(community_test.id('a'))->'settings'='null'::jsonb,'disabled settings hidden from regular member');
SELECT community_test.assert(NOT EXISTS(SELECT server_id FROM public.server_community_settings),'RLS hides disabled configuration');

SELECT community_test.actor(1);
SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),2);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,rules_revision}')='1','reactivation retains rules revision');
SELECT public.save_server_community(community_test.id('a'),community_test.payload('a')||'{"category_slug":"social"}',3);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,rules_revision}')='1','category edit is not rules revision');
SELECT public.save_server_community(community_test.id('a'),jsonb_set(community_test.payload('a'),'{rules,0,text}','"Nova regra técnica."'),4);
SELECT community_test.assert((get_server_community(community_test.id('a'))#>>'{settings,rules_revision}')='2','changed rule increments rules revision');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),3)$q$,'40001','community_revision_conflict');
SELECT public.disable_server_community(community_test.id('a'),5);
RESET ROLE;
SELECT community_test.assert(community_test.snapshot()=(SELECT state FROM before_conversion),'all original rows, IDs, visibility, permissions, invites, messages, XP and badges preserved');
SELECT community_test.assert((SELECT count(*) FROM audit_logs WHERE action='community_activated')=2,'only real activation transitions audited');
SELECT community_test.assert((SELECT count(*) FROM audit_logs WHERE action='community_deactivated')=2,'only real disable transitions audited');
SELECT community_test.assert((SELECT count(*) FROM audit_logs WHERE action='community_settings_updated')=2,'real settings edits audited');

SET LOCAL ROLE authenticated;
SELECT community_test.actor(1);
SELECT public.set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),false);
SELECT community_test.actor(2);
SELECT community_test.assert(NOT public.can_manage_community(community_test.id('a')),'revocation immediately enforced in backend');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),6)$q$,'42501','community_not_authorized');
SELECT community_test.actor(1);
SELECT public.set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),true);
SAVEPOINT before_role_removal;
SELECT community_test.actor(4);
DELETE FROM public.roles WHERE id=community_test.id('delegate-role');
SELECT community_test.actor(2);
SELECT community_test.assert(NOT public.can_manage_community(community_test.id('a')),'ordinary role removal revokes delegation without being blocked');
ROLLBACK TO SAVEPOINT before_role_removal;
SAVEPOINT before_leave;
SELECT community_test.actor(2);
DELETE FROM public.server_members WHERE server_id=community_test.id('a') AND user_id=auth.uid();
SELECT community_test.assert(NOT public.can_manage_community(community_test.id('a')),'leaving with a privileged role remains possible');
ROLLBACK TO SAVEPOINT before_leave;
SELECT community_test.actor(1);
INSERT INTO public.server_bans(server_id,user_id,banned_by,reason)
VALUES(community_test.id('a'),community_test.user_id(2),auth.uid(),'Synthetic test');
SELECT community_test.actor(2);
SELECT community_test.assert(NOT public.can_manage_community(community_test.id('a')),'ban removes community power');
SELECT community_test.denied($q$SELECT public.get_server_community(community_test.id('a'))$q$,'42501','community_not_authorized');

-- Removing a welcome channel does not block ordinary channel administration.
SELECT community_test.actor(1);
DELETE FROM public.channels WHERE id=community_test.id('a-welcome');
SELECT community_test.assert((get_server_community(community_test.id('a'))#>'{settings,welcome_channel_id}')='null'::jsonb,'removed welcome channel clears FK safely');
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),6)$q$,'22023','community_invalid_channel');

SELECT community_test.actor(8);
DO $$ DECLARE hit boolean := false;
BEGIN
  PERFORM public.save_server_community(community_test.id('b'),community_test.payload('b'),0);
  FOR i IN 1..31 LOOP
    BEGIN PERFORM public.save_server_community(community_test.id('b'),community_test.payload('b'),1);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF position('Muitos envios' IN SQLERRM)=0 THEN RAISE; END IF;
      hit:=true; EXIT;
    END;
  END LOOP;
  PERFORM community_test.assert(hit,'server-side rate budget enforced on repeated no-op calls');
END $$;
SELECT community_test.assert((get_server_community(community_test.id('b'))#>>'{settings,revision}')='1','rate limited repeats do not duplicate or increment configuration');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT community_test.denied($q$SELECT public.get_server_community(community_test.id('a'))$q$,'42501','');
SELECT community_test.denied($q$SELECT server_id FROM public.server_community_settings$q$,'42501','');
RESET ROLE;
SELECT community_test.assert(NOT has_function_privilege('authenticated','security_private.community_payload(jsonb)','EXECUTE'),'private payload helper not callable');
SELECT community_test.assert(NOT has_table_privilege('authenticated','public.server_community_settings','INSERT'),'no direct table insert grant');
ROLLBACK;
\echo 'PASS: community foundation permissions, atomicity, RLS, preservation, revisions, delegation, lifecycle and rate limits'
