-- Transactional fixture, safe before or after the other disposable suites.
BEGIN;
SELECT community_test.actor(8);
SELECT public.save_server_community(community_test.id('b'),community_test.payload('b'),coalesce((SELECT revision FROM public.server_community_settings WHERE server_id=community_test.id('b')),0));
UPDATE security_private.community_xp_policy SET enabled=true;
UPDATE security_private.community_objective_verifiers SET enabled=true;
SELECT community_test.assert(public.get_community_objectives(community_test.id('b'))#>>'{missions,0,status}'='available','configured verifier exposes available state with zero progress');
INSERT INTO security_private.community_verified_activities VALUES('d4b40000-0000-0000-0000-000000000001',community_test.id('b'),'backend_verified_activity',gen_random_uuid(),clock_timestamp(),clock_timestamp()+interval '1 hour');
SELECT public.consume_verified_community_activity(community_test.id('b'),'d4b40000-0000-0000-0000-000000000001');
SELECT community_test.assert(public.get_community_objectives(community_test.id('b'))#>>'{missions,0,status}'='in_progress','one distinct evidence is in progress');
UPDATE security_private.community_objective_verifiers SET enabled=false;
SELECT community_test.assert(public.get_community_objectives(community_test.id('b'))#>>'{missions,0,status}'='unavailable','revoked verifier marks incomplete mission unavailable');
SELECT community_test.assert(public.get_community_objectives(community_test.id('b'))#>>'{missions,0,progress}'='1','revocation retains real prior progress');
ROLLBACK;
