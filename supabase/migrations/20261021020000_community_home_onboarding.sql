-- LOCAL/ISOLATED ONLY. Phase 2 extends the existing community, never servers or voice.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.server_community_settings
  ADD COLUMN experience jsonb NOT NULL DEFAULT '{"home_enabled":true,"intro":"","banner_url":null,"notices":[],"featured_channels":[],"modules":["notices","voice","channels","interests","events"],"welcome_enabled":true,"welcome_text":"Bem-vindo à comunidade!","rules_enabled":true,"rules_required":false,"interests_enabled":true,"channels_enabled":true,"roles_enabled":false,"role_ids":[]}',
  ADD COLUMN experience_revision integer NOT NULL DEFAULT 1 CHECK(experience_revision>0),
  ADD COLUMN screening_since timestamptz;
CREATE OR REPLACE FUNCTION security_private.community_member_projection(_settings public.server_community_settings)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT to_jsonb(_settings)-'activated_by'-'disabled_by'-'experience'-'experience_revision'-'screening_since';
$$;
-- No column grant for the raw configuration: member RPC projects channel references.
CREATE TABLE public.community_rule_revisions (
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 revision integer NOT NULL, rules jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(server_id,revision)
);
INSERT INTO public.community_rule_revisions(server_id,revision,rules)
 SELECT server_id,rules_revision,rules FROM public.server_community_settings;
CREATE TABLE public.community_member_onboarding (
 member_id uuid PRIMARY KEY REFERENCES public.server_members(id) ON DELETE CASCADE,
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 accepted_revision integer, interests text[] NOT NULL DEFAULT '{}', selected_roles uuid[] NOT NULL DEFAULT '{}',
 completed_revision integer, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(server_id,accepted_revision) REFERENCES public.community_rule_revisions(server_id,revision)
);
CREATE INDEX community_onboarding_server_idx ON public.community_member_onboarding(server_id,member_id);
ALTER TABLE public.community_rule_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_member_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_rule_revisions,public.community_member_onboarding FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.community_rule_revisions,public.community_member_onboarding TO authenticated;
CREATE POLICY community_onboarding_self ON public.community_member_onboarding FOR SELECT TO authenticated
 USING(EXISTS(SELECT FROM public.server_members m WHERE m.id=member_id AND m.server_id=community_member_onboarding.server_id
  AND m.user_id=auth.uid()) AND NOT public.is_server_banned(server_id,auth.uid()));
CREATE POLICY community_rules_history ON public.community_rule_revisions FOR SELECT TO authenticated
 USING(public.can_manage_community(server_id) OR EXISTS(SELECT FROM public.community_member_onboarding o
  WHERE o.server_id=community_rule_revisions.server_id AND o.accepted_revision=revision));
CREATE FUNCTION security_private.snapshot_community_rules() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO public.community_rule_revisions(server_id,revision,rules) VALUES(NEW.server_id,NEW.rules_revision,NEW.rules)
 ON CONFLICT DO NOTHING; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION security_private.snapshot_community_rules() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER community_rules_snapshot AFTER INSERT OR UPDATE OF rules,rules_revision ON public.server_community_settings
 FOR EACH ROW EXECUTE FUNCTION security_private.snapshot_community_rules();

-- Re-enabling never retroactively screens people who arrived while this was a common server.
CREATE FUNCTION security_private.community_screening_reactivated() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF NEW.enabled AND NOT OLD.enabled AND (NEW.experience->>'rules_required')::boolean THEN
  NEW.screening_since:=clock_timestamp();
 END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION security_private.community_screening_reactivated() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER community_screening_reactivated BEFORE UPDATE OF enabled ON public.server_community_settings
 FOR EACH ROW EXECUTE FUNCTION security_private.community_screening_reactivated();
CREATE FUNCTION security_private.community_role_selectable(r public.roles) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT NOT r.is_owner AND r.name NOT IN ('OWNER','ADMIN','MEMBER') AND NOT EXISTS(
 SELECT FROM jsonb_each(r.permissions) p WHERE p.value='true'::jsonb
 AND p.key NOT IN ('view_channel','read_messages','send_messages','connect','speak'));
$$;
REVOKE ALL ON FUNCTION security_private.community_role_selectable(public.roles) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.save_community_experience(_server_id uuid,_payload jsonb,_expected_revision integer)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cfg public.server_community_settings%ROWTYPE; k text; arr text; x jsonb; rid uuid;
BEGIN
 IF NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.server_community_settings WHERE server_id=_server_id FOR UPDATE;
 IF NOT FOUND OR NOT cfg.enabled THEN RAISE EXCEPTION 'community_inactive' USING ERRCODE='22023'; END IF;
 IF _expected_revision IS NULL OR _expected_revision<>cfg.experience_revision THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 IF _payload IS NULL OR jsonb_typeof(_payload)<>'object' OR octet_length(_payload::text)>32768
  OR (SELECT count(*) FROM jsonb_object_keys(_payload))<>14
  OR NOT (_payload ?& ARRAY['intro','banner_url','notices','featured_channels','modules','welcome_enabled','welcome_text','rules_enabled','rules_required','interests_enabled','channels_enabled','roles_enabled','role_ids','home_enabled']) THEN
  RAISE EXCEPTION 'community_invalid_experience' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['welcome_enabled','rules_enabled','rules_required','interests_enabled','channels_enabled','roles_enabled','home_enabled'] LOOP
  IF jsonb_typeof(_payload->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'community_invalid_experience' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (_payload->>'rules_required')::boolean AND NOT (_payload->>'rules_enabled')::boolean THEN RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['intro','welcome_text'] LOOP
  IF jsonb_typeof(_payload->k) IS DISTINCT FROM 'string' OR char_length(_payload->>k)>2000 OR (_payload->>k) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN RAISE EXCEPTION 'community_invalid_experience' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF _payload->'banner_url'<>'null'::jsonb AND (jsonb_typeof(_payload->'banner_url') IS DISTINCT FROM 'string'
  OR char_length(_payload->>'banner_url')>8192 OR (_payload->>'banner_url') !~ '^https://[^/@[:space:]]+([/:?#]|$)'
  OR (_payload->>'banner_url') ~ '^https://[^/]*@' OR (_payload->>'banner_url') ~ '[\x01-\x1F\x7F[:space:]]') THEN RAISE EXCEPTION 'community_invalid_banner' USING ERRCODE='22023'; END IF;
 FOREACH arr IN ARRAY ARRAY['featured_channels','role_ids','modules','notices'] LOOP
  IF jsonb_typeof(_payload->arr) IS DISTINCT FROM 'array' OR jsonb_array_length(_payload->arr)>10
   OR (SELECT count(*) FROM jsonb_array_elements(_payload->arr))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(_payload->arr)) THEN RAISE EXCEPTION 'community_invalid_experience' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_array_length(_payload->'modules')<>5 OR EXISTS(SELECT FROM jsonb_array_elements_text(_payload->'modules') t WHERE t NOT IN ('notices','voice','channels','interests','events')) THEN RAISE EXCEPTION 'community_invalid_modules' USING ERRCODE='22023'; END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(_payload->'featured_channels') LOOP
  rid:= (x#>>'{}')::uuid;
  PERFORM id FROM public.channels WHERE id=rid AND server_id=_server_id FOR SHARE;
  IF NOT FOUND OR NOT public.has_channel_permission(rid,auth.uid(),'view_channel') THEN RAISE EXCEPTION 'community_invalid_channel' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(_payload->'role_ids') LOOP
  rid:=(x#>>'{}')::uuid;
  PERFORM id FROM public.roles r WHERE id=rid AND server_id=_server_id AND security_private.community_role_selectable(r) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'community_role_ineligible' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_array_length(_payload->'notices')>5 THEN RAISE EXCEPTION 'community_invalid_notices' USING ERRCODE='22023'; END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(_payload->'notices') LOOP
  IF jsonb_typeof(x)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(x))<>3
   OR NOT (x ?& ARRAY['id','title','body']) OR jsonb_typeof(x->'id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(x->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'body') IS DISTINCT FROM 'string'
   OR char_length(btrim(x->>'title')) NOT BETWEEN 1 AND 100 OR char_length(btrim(x->>'body')) NOT BETWEEN 1 AND 2000
   OR ((x->>'title')||(x->>'body')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN RAISE EXCEPTION 'community_invalid_notices' USING ERRCODE='22023'; END IF;
  rid:=(x->>'id')::uuid;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(_payload->'notices'))<>jsonb_array_length(_payload->'notices') THEN RAISE EXCEPTION 'community_invalid_notices' USING ERRCODE='22023'; END IF;
 PERFORM security_private.consume_write_budget('community_experience',60,20);
 IF cfg.experience=_payload THEN RETURN cfg.experience_revision; END IF;
 UPDATE public.server_community_settings SET experience=_payload,experience_revision=experience_revision+1,
  screening_since=CASE WHEN (_payload->>'rules_required')::boolean AND NOT coalesce((cfg.experience->>'rules_required')::boolean,false) THEN clock_timestamp() ELSE screening_since END,
  updated_at=clock_timestamp() WHERE server_id=_server_id RETURNING experience_revision INTO cfg.experience_revision;
 PERFORM public.write_audit(_server_id,'community_experience_updated','server',_server_id,NULL,jsonb_build_object('revision',cfg.experience_revision));
 RETURN cfg.experience_revision;
END $$;
REVOKE ALL ON FUNCTION public.save_community_experience(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_community_experience(uuid,jsonb,integer) TO authenticated;

CREATE FUNCTION public.get_community_experience(_server_id uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cfg public.server_community_settings%ROWTYPE; m public.server_members%ROWTYPE; data jsonb; progress jsonb;
BEGIN
 SELECT * INTO m FROM public.server_members WHERE server_id=_server_id AND user_id=auth.uid();
 IF auth.uid() IS NULL OR m.id IS NULL OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.server_community_settings WHERE server_id=_server_id;
 IF NOT FOUND OR NOT cfg.enabled THEN RETURN NULL; END IF;
 data:=cfg.experience;
 IF NOT public.can_manage_community(_server_id) THEN
  data:=jsonb_set(data,'{featured_channels}',coalesce((SELECT jsonb_agg(v) FROM jsonb_array_elements(data->'featured_channels') v
   JOIN public.channels c ON c.id=(v#>>'{}')::uuid WHERE c.server_id=_server_id AND public.has_channel_permission(c.id,auth.uid(),'view_channel')),'[]'));
 END IF;
 -- Recheck roles on every read; changing permissions never makes an unsafe role selectable.
 data:=jsonb_set(data,'{role_ids}',coalesce((SELECT jsonb_agg(v) FROM jsonb_array_elements(data->'role_ids') v
  JOIN public.roles r ON r.id=(v#>>'{}')::uuid WHERE r.server_id=_server_id AND security_private.community_role_selectable(r)),'[]'));
 SELECT to_jsonb(o)-'member_id'-'server_id' INTO progress FROM public.community_member_onboarding o WHERE member_id=m.id;
 RETURN jsonb_build_object('server_id',_server_id,'experience',data,'revision',cfg.experience_revision,
 'rules',cfg.rules,'rules_revision',cfg.rules_revision,'interests',cfg.interests,'progress',progress,
 'screened',cfg.screening_since IS NOT NULL AND m.joined_at>=cfg.screening_since,
 'can_manage',public.can_manage_community(_server_id));
END $$;
REVOKE ALL ON FUNCTION public.get_community_experience(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_experience(uuid) TO authenticated;

CREATE FUNCTION public.save_community_onboarding(_server_id uuid,_experience_revision integer,_rules_revision integer,
 _accept_rules boolean,_interests text[],_role_ids uuid[],_complete boolean) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cfg public.server_community_settings%ROWTYPE; m public.server_members%ROWTYPE; rid uuid; interest text; accepted integer; prev public.community_member_onboarding%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_server_member(_server_id,auth.uid()) OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 SELECT * INTO m FROM public.server_members WHERE server_id=_server_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.server_community_settings WHERE server_id=_server_id FOR UPDATE;
 IF NOT FOUND OR NOT cfg.enabled THEN RAISE EXCEPTION 'community_inactive' USING ERRCODE='22023'; END IF;
 IF _experience_revision IS NULL OR _rules_revision IS NULL OR _experience_revision<>cfg.experience_revision OR _rules_revision<>cfg.rules_revision THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 IF _accept_rules IS NULL OR _complete IS NULL OR _interests IS NULL OR _role_ids IS NULL OR cardinality(_interests)>10 OR cardinality(_role_ids)>10
 OR cardinality(_interests)<>(SELECT count(DISTINCT i) FROM unnest(_interests) i) OR cardinality(_role_ids)<>(SELECT count(DISTINCT i) FROM unnest(_role_ids) i) THEN RAISE EXCEPTION 'community_invalid_onboarding' USING ERRCODE='22023'; END IF;
 IF NOT (cfg.experience->>'interests_enabled')::boolean AND cardinality(_interests)>0 OR NOT (cfg.experience->>'roles_enabled')::boolean AND cardinality(_role_ids)>0 THEN RAISE EXCEPTION 'community_invalid_onboarding' USING ERRCODE='22023'; END IF;
 FOREACH interest IN ARRAY _interests LOOP IF interest IS NULL OR NOT interest=ANY(cfg.interests) THEN RAISE EXCEPTION 'community_invalid_interests' USING ERRCODE='22023'; END IF; END LOOP;
 SELECT * INTO prev FROM public.community_member_onboarding WHERE member_id=m.id;
 accepted:=prev.accepted_revision;
 IF _accept_rules THEN
  IF NOT (cfg.experience->>'rules_enabled')::boolean THEN RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023'; END IF;
  accepted:=cfg.rules_revision;
 END IF;
 IF _complete AND (cfg.experience->>'rules_required')::boolean AND accepted IS DISTINCT FROM cfg.rules_revision THEN RAISE EXCEPTION 'community_rules_required' USING ERRCODE='42501'; END IF;
 -- Only currently selected, currently safe, allowed roles can be assigned. Lock before recheck.
 FOREACH rid IN ARRAY _role_ids LOOP
  PERFORM id FROM public.roles r WHERE id=rid AND server_id=_server_id FOR SHARE;
  IF NOT FOUND OR NOT (cfg.experience->'role_ids' @> to_jsonb(ARRAY[rid])) OR NOT EXISTS(SELECT FROM public.roles r WHERE id=rid AND security_private.community_role_selectable(r)) THEN RAISE EXCEPTION 'community_role_ineligible' USING ERRCODE='22023'; END IF;
 END LOOP;
 PERFORM security_private.consume_write_budget('community_onboarding',60,30);
 -- Selected roles are granted only on completion, never while saving an interrupted draft.
 IF _complete THEN
  INSERT INTO public.member_roles(member_id,role_id) SELECT m.id,unnest(_role_ids) ON CONFLICT(member_id,role_id) DO NOTHING;
 END IF;
 INSERT INTO public.community_member_onboarding(member_id,server_id,accepted_revision,interests,selected_roles,completed_revision)
 VALUES(m.id,_server_id,accepted,_interests,_role_ids,CASE WHEN _complete THEN cfg.experience_revision ELSE NULL END)
 ON CONFLICT(member_id) DO UPDATE SET accepted_revision=EXCLUDED.accepted_revision,interests=EXCLUDED.interests,
 selected_roles=EXCLUDED.selected_roles,completed_revision=EXCLUDED.completed_revision,updated_at=clock_timestamp();
END $$;
REVOKE ALL ON FUNCTION public.save_community_onboarding(uuid,integer,integer,boolean,text[],uuid[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_community_onboarding(uuid,integer,integer,boolean,text[],uuid[],boolean) TO authenticated;

-- A narrow, database-enforced text screening gate for NEW arrivals. Existing members,
-- voice/media and server/channel permission helpers are unchanged.
CREATE FUNCTION public.community_text_allowed(_server_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT NOT EXISTS(SELECT FROM public.server_community_settings cfg
 JOIN public.server_members m ON m.server_id=cfg.server_id AND m.user_id=auth.uid()
 WHERE cfg.server_id=_server_id AND cfg.enabled AND (cfg.experience->>'rules_required')::boolean
 AND cfg.screening_since IS NOT NULL AND m.joined_at>=cfg.screening_since
 AND NOT public.is_server_owner(_server_id,auth.uid())
 AND NOT EXISTS(SELECT FROM public.community_member_onboarding o WHERE o.member_id=m.id AND o.accepted_revision=cfg.rules_revision));
$$;
REVOKE ALL ON FUNCTION public.community_text_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_text_allowed(uuid) TO authenticated;
CREATE POLICY community_messages_insert ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(public.community_text_allowed((SELECT c.server_id FROM public.channels c WHERE c.id=channel_id)));
CREATE POLICY community_messages_update ON public.messages AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(public.community_text_allowed((SELECT c.server_id FROM public.channels c WHERE c.id=channel_id)));
CREATE POLICY community_reactions_insert ON public.message_reactions AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(public.community_text_allowed((SELECT c.server_id FROM public.messages m JOIN public.channels c ON c.id=m.channel_id WHERE m.id=message_id)));
COMMIT;
