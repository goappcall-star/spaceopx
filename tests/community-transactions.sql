BEGIN;
-- A failure in the shared audit must roll back the entire activation and budget.
CREATE FUNCTION community_test.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.action='community_activated' THEN RAISE EXCEPTION 'synthetic_audit_failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER synthetic_community_audit_failure BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION community_test.fail_audit();
SET LOCAL ROLE authenticated;
SELECT community_test.actor(8);
SELECT community_test.denied($q$SELECT public.save_server_community(community_test.id('b'),community_test.payload('b'),0)$q$,'P0001','synthetic_audit_failure');
SELECT community_test.assert(get_server_community(community_test.id('b'))->'settings'='null'::jsonb,'audit failure rolls back activation');
SELECT community_test.actor(7);
SELECT community_test.denied($q$SELECT public.set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),true)$q$,'42501','community_owner_required');
SELECT community_test.denied($q$SELECT public.set_community_role_permission(community_test.id('a'),'00000000-0000-0000-0000-000000000000',true)$q$,'42501','community_owner_required');
RESET ROLE;
SELECT community_test.assert(NOT EXISTS(SELECT FROM security_private.write_windows WHERE action LIKE 'community_%'),'failed activation rolls back write budgets');
SELECT community_test.assert(NOT has_function_privilege('anon','public.get_server_community(uuid)','EXECUTE'),'anon cannot invoke community reads');
SELECT community_test.assert(NOT has_function_privilege('anon','public.save_server_community(uuid,jsonb,integer)','EXECUTE'),'anon cannot invoke community mutations');
ROLLBACK;
\echo 'PASS: transactional rollback, nonmember role privacy and anonymous grants'
