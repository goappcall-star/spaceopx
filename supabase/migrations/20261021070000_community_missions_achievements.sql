-- 4B: additive, no backfill, no verifier/XP activation, no individual progression.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.community_reward_catalog (
 id text PRIMARY KEY CHECK(id ~ '^[a-z][a-z0-9_]{2,63}$'),
 kind text NOT NULL CHECK(kind IN ('seal','theme','banner','frame','highlight')),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 description text NOT NULL CHECK(length(description)<=500),
 usable boolean NOT NULL DEFAULT false CHECK(NOT usable)
);
-- No cosmetic assets or usable rewards are seeded. Integration belongs to 4C.
CREATE TABLE public.community_objective_keys (
 id text PRIMARY KEY CHECK(id ~ '^[a-z][a-z0-9_]{2,63}$'),
 kind text NOT NULL CHECK(kind IN ('mission','achievement')),
 criterion text NOT NULL CHECK(criterion IN ('verified_activity','first_activation','first_publication')),
 cadence text NOT NULL CHECK(cadence IN ('daily','weekly','permanent')),
 CHECK((kind='mission' AND criterion='verified_activity' AND cadence IN ('daily','weekly'))
 OR (kind='achievement' AND criterion IN ('first_activation','first_publication') AND cadence='permanent'))
);
CREATE TABLE public.community_objective_versions (
 objective_id text NOT NULL REFERENCES public.community_objective_keys(id),
 version integer NOT NULL CHECK(version>0),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 1000),
 target integer NOT NULL CHECK(target BETWEEN 1 AND 10000),
 category text NOT NULL CHECK(category IN ('foundation','participation')),
 rarity text NOT NULL CHECK(rarity IN ('common','rare','epic','legendary')),
 reward_xp integer NOT NULL DEFAULT 0 CHECK(reward_xp BETWEEN 0 AND 10000),
 reward_id text REFERENCES public.community_reward_catalog(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(objective_id,version)
);
CREATE TABLE security_private.community_objective_active (
 objective_id text PRIMARY KEY REFERENCES public.community_objective_keys(id),
 version integer NOT NULL,
 FOREIGN KEY(objective_id,version) REFERENCES public.community_objective_versions(objective_id,version)
);
CREATE TABLE security_private.community_objective_verifiers (
 source text PRIMARY KEY CHECK(source='verified_activity'),
 enabled boolean NOT NULL DEFAULT false,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO security_private.community_objective_verifiers VALUES('verified_activity',false,DEFAULT);
CREATE TABLE public.community_mission_progress (
 id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 objective_id text NOT NULL,
 version integer NOT NULL,
 period_start timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>period_start),
 progress integer NOT NULL DEFAULT 0 CHECK(progress>=0),
 completed_at timestamptz,
 reward_activity_id uuid UNIQUE,
 PRIMARY KEY(server_id,objective_id,period_start),
 FOREIGN KEY(objective_id,version) REFERENCES public.community_objective_versions(objective_id,version)
);
CREATE INDEX community_mission_history_page ON public.community_mission_progress(server_id,id DESC);
ALTER TABLE public.community_mission_progress ADD UNIQUE(id,server_id);
CREATE TABLE security_private.community_mission_evidence (
 mission_id bigint NOT NULL,
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 activity_id uuid NOT NULL REFERENCES security_private.community_verified_activities(id) ON DELETE CASCADE,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(mission_id,activity_id),
 FOREIGN KEY(mission_id,server_id) REFERENCES public.community_mission_progress(id,server_id) ON DELETE CASCADE
);
ALTER TABLE security_private.community_mission_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_private.community_mission_evidence FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.community_achievement_unlocks (
 id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 objective_id text NOT NULL,
 version integer NOT NULL,
 unlocked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(server_id,objective_id),
 FOREIGN KEY(objective_id,version) REFERENCES public.community_objective_versions(objective_id,version)
);
CREATE TABLE public.community_reward_unlocks (
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 reward_id text NOT NULL REFERENCES public.community_reward_catalog(id),
 objective_id text NOT NULL,
 version integer NOT NULL,
 unlocked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(server_id,reward_id),
 FOREIGN KEY(objective_id,version) REFERENCES public.community_objective_versions(objective_id,version)
);
CREATE INDEX community_achievement_recent ON public.community_achievement_unlocks(server_id,unlocked_at DESC,objective_id);
CREATE TABLE security_private.community_objective_config_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity text NOT NULL, previous_value jsonb, next_value jsonb,
 operator text NOT NULL DEFAULT session_user, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION security_private.community_objective_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('community_achievement_unlocks','community_reward_unlocks','community_mission_evidence') THEN
  IF NOT EXISTS(SELECT FROM public.servers WHERE id=OLD.server_id) THEN RETURN OLD; END IF;
 END IF;
 RAISE EXCEPTION 'community_objective_immutable' USING ERRCODE='23514';
END $$;
CREATE FUNCTION security_private.community_objective_version_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT FROM public.community_objective_keys WHERE id=NEW.objective_id AND kind='achievement')
 AND (NEW.target<>1 OR NEW.reward_xp<>0) THEN RAISE EXCEPTION 'community_achievement_no_xp' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER objective_version_guard BEFORE INSERT ON public.community_objective_versions
FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_version_guard();
CREATE FUNCTION security_private.community_objective_config_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 -- Serialize backend catalog changes; at most eight active mission IDs per cadence.
 PERFORM pg_advisory_xact_lock(4837204);
 IF TG_TABLE_NAME='community_objective_active' THEN
  IF TG_OP='UPDATE' AND NEW.objective_id<>OLD.objective_id THEN RAISE EXCEPTION 'community_objective_immutable' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT FROM public.community_objective_keys k WHERE k.id=NEW.objective_id AND kind='mission')
  AND (SELECT count(*) FROM security_private.community_objective_active a JOIN public.community_objective_keys k ON k.id=a.objective_id
    WHERE k.kind='mission' AND k.cadence=(SELECT cadence FROM public.community_objective_keys WHERE id=NEW.objective_id) AND a.objective_id<>NEW.objective_id)>=8 THEN
   RAISE EXCEPTION 'community_mission_catalog_limit' USING ERRCODE='23514'; END IF;
 END IF;
 INSERT INTO security_private.community_objective_config_audit(entity,previous_value,next_value)
 VALUES(TG_TABLE_NAME,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER objective_active_guard BEFORE INSERT OR UPDATE ON security_private.community_objective_active FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_config_guard();
CREATE TRIGGER objective_verifier_guard BEFORE UPDATE ON security_private.community_objective_verifiers FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_config_guard();

INSERT INTO public.community_objective_keys VALUES
 ('verified_daily','mission','verified_activity','daily'),('verified_weekly','mission','verified_activity','weekly'),
 ('community_foundation','achievement','first_activation','permanent'),('community_publication','achievement','first_publication','permanent');
INSERT INTO public.community_objective_versions(objective_id,version,name,description,target,category,rarity,reward_xp) VALUES
 ('verified_daily',1,'Participação verificada · diária','Concluir 3 atividades legítimas comprovadas por um verificador confiável. Fonte ainda não integrada.',3,'participation','common',150),
 ('verified_weekly',1,'Participação verificada · semanal','Concluir 10 atividades legítimas comprovadas por um verificador confiável. Fonte ainda não integrada.',10,'participation','rare',500),
 ('community_foundation',1,'Nossa comunidade','Primeira ativação registrada após a instalação da Fase 4B. Sem concessão retroativa ou XP.',1,'foundation','common',0),
 ('community_publication',1,'Portas abertas','Primeira publicação autorizada pelo proprietário no diretório após a instalação da Fase 4B. Sem concessão retroativa ou XP.',1,'foundation','rare',0);
INSERT INTO security_private.community_objective_active SELECT objective_id,version FROM public.community_objective_versions;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['community_reward_catalog','community_objective_keys','community_objective_versions','community_achievement_unlocks','community_reward_unlocks'] LOOP
  EXECUTE format('CREATE TRIGGER objective_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_immutable()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['community_reward_catalog','community_objective_keys','community_objective_versions','community_mission_progress','community_achievement_unlocks','community_reward_unlocks'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
REVOKE ALL ON security_private.community_objective_active,security_private.community_objective_verifiers,security_private.community_objective_config_audit FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE security_private.community_objective_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_private.community_objective_verifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_private.community_objective_config_audit ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER objective_active_no_delete BEFORE DELETE ON security_private.community_objective_active FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_immutable();
CREATE TRIGGER objective_verifier_no_delete BEFORE DELETE ON security_private.community_objective_verifiers FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_immutable();
CREATE TRIGGER objective_config_audit_immutable BEFORE UPDATE OR DELETE ON security_private.community_objective_config_audit FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_immutable();
CREATE TRIGGER objective_evidence_immutable BEFORE UPDATE OR DELETE ON security_private.community_mission_evidence FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_immutable();

CREATE FUNCTION security_private.community_mission_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ DECLARE goal integer; BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT FROM public.servers WHERE id=OLD.server_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'community_mission_immutable' USING ERRCODE='23514';
 END IF;
 SELECT target INTO STRICT goal FROM public.community_objective_versions WHERE objective_id=NEW.objective_id AND version=NEW.version;
 IF NEW.progress>goal OR (NEW.completed_at IS NULL)<>(NEW.progress<goal) THEN RAISE EXCEPTION 'community_mission_invalid_progress' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['progress','completed_at','reward_activity_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['progress','completed_at','reward_activity_id']) OR NEW.progress<OLD.progress
   OR (OLD.completed_at IS NOT NULL AND ((to_jsonb(NEW)-'reward_activity_id') IS DISTINCT FROM (to_jsonb(OLD)-'reward_activity_id') OR OLD.reward_activity_id IS NOT NULL)) THEN
   RAISE EXCEPTION 'community_mission_immutable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER community_mission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.community_mission_progress FOR EACH ROW EXECUTE FUNCTION security_private.community_mission_guard();

CREATE FUNCTION security_private.community_unlock_achievement(_server uuid,_criterion text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d record;
BEGIN
 FOR d IN SELECT v.* FROM security_private.community_objective_active a
 JOIN public.community_objective_keys k ON k.id=a.objective_id
 JOIN public.community_objective_versions v USING(objective_id,version)
 WHERE k.kind='achievement' AND k.criterion=_criterion ORDER BY a.objective_id FOR SHARE OF a LOOP
  INSERT INTO public.community_achievement_unlocks(server_id,objective_id,version) VALUES(_server,d.objective_id,d.version) ON CONFLICT DO NOTHING;
  IF FOUND AND d.reward_id IS NOT NULL THEN
   INSERT INTO public.community_reward_unlocks(server_id,reward_id,objective_id,version) VALUES(_server,d.reward_id,d.objective_id,d.version) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION security_private.community_achievement_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_TABLE_NAME='server_community_settings' THEN
  -- INSERT only: reactivation of an existing community is never a first activation.
  IF NEW.enabled AND auth.uid()=NEW.activated_by AND public.can_manage_community(NEW.server_id) THEN
   PERFORM security_private.community_unlock_achievement(NEW.server_id,'first_activation'); END IF;
 ELSE
  IF NEW.status<>'listed' OR NEW.published_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN IF OLD.published_at IS NOT NULL THEN RETURN NEW; END IF; END IF;
  IF auth.uid()=NEW.published_by AND EXISTS(SELECT FROM public.servers WHERE id=NEW.server_id AND owner_id=auth.uid())
  AND public.community_is_discoverable(NEW.server_id) THEN
   PERFORM security_private.community_unlock_achievement(NEW.server_id,'first_publication'); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER community_achievement_activation AFTER INSERT ON public.server_community_settings FOR EACH ROW EXECUTE FUNCTION security_private.community_achievement_event();
CREATE TRIGGER community_achievement_publication AFTER INSERT OR UPDATE OF status,published_at ON public.community_directory FOR EACH ROW EXECUTE FUNCTION security_private.community_achievement_event();

-- Reuse the existing attestation, account and ledger. Only the backend can bind
-- a mission reward to a completed instance; it never counts as a new activity.
ALTER TABLE security_private.community_verified_activities DROP CONSTRAINT community_verified_activities_source_check;
ALTER TABLE security_private.community_verified_activities ADD CONSTRAINT community_verified_activities_source_check CHECK(source IN ('backend_verified_activity','community_mission_reward'));
ALTER TABLE public.community_mission_progress ADD CONSTRAINT community_mission_reward_fact FOREIGN KEY(reward_activity_id) REFERENCES security_private.community_verified_activities(id);
CREATE FUNCTION security_private.community_mission_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d record; p public.community_mission_progress%ROWTYPE; start_at timestamptz; end_at timestamptz; reward uuid; now_at timestamptz:=NEW.created_at;
BEGIN
 IF NOT EXISTS(SELECT FROM security_private.community_verified_activities WHERE id=NEW.activity_id AND source='backend_verified_activity') THEN RETURN NEW; END IF;
 PERFORM 1 FROM security_private.community_objective_verifiers WHERE source='verified_activity' AND enabled FOR SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 FOR d IN SELECT k.cadence,v.* FROM security_private.community_objective_active a
 JOIN public.community_objective_keys k ON k.id=a.objective_id
 JOIN public.community_objective_versions v USING(objective_id,version)
 WHERE k.kind='mission' AND k.criterion='verified_activity' ORDER BY a.objective_id FOR SHARE OF a LOOP
  start_at:=date_trunc(CASE WHEN d.cadence='daily' THEN 'day' ELSE 'week' END,now_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  end_at:=start_at+CASE WHEN d.cadence='daily' THEN interval '24 hours' ELSE interval '168 hours' END;
  INSERT INTO public.community_mission_progress(server_id,objective_id,version,period_start,expires_at) VALUES(NEW.server_id,d.objective_id,d.version,start_at,end_at) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT p FROM public.community_mission_progress WHERE server_id=NEW.server_id AND objective_id=d.objective_id AND period_start=start_at FOR UPDATE;
  IF p.completed_at IS NOT NULL THEN CONTINUE; END IF;
  INSERT INTO security_private.community_mission_evidence(mission_id,server_id,activity_id) VALUES(p.id,NEW.server_id,NEW.activity_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN CONTINUE; END IF;
  -- The instance pins its original version for the entire period.
  SELECT v.*,d.cadence AS cadence INTO d FROM public.community_objective_versions v WHERE objective_id=p.objective_id AND version=p.version;
  UPDATE public.community_mission_progress SET progress=least(progress+1,d.target),completed_at=CASE WHEN progress+1>=d.target THEN now_at ELSE NULL END
   WHERE id=p.id RETURNING * INTO p;
  IF p.completed_at IS NOT NULL THEN
   IF d.reward_id IS NOT NULL THEN
    INSERT INTO public.community_reward_unlocks(server_id,reward_id,objective_id,version) VALUES(NEW.server_id,d.reward_id,d.objective_id,d.version) ON CONFLICT DO NOTHING;
   END IF;
   IF d.reward_xp>0 THEN
    reward:=gen_random_uuid();
    INSERT INTO security_private.community_verified_activities(id,server_id,source,evidence_key,verified_at,expires_at)
     VALUES(reward,NEW.server_id,'community_mission_reward',gen_random_uuid(),clock_timestamp(),clock_timestamp()+interval '1 hour');
    UPDATE public.community_mission_progress SET reward_activity_id=reward WHERE id=p.id;
    PERFORM public.consume_verified_community_activity(NEW.server_id,reward);
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER community_mission_from_ledger AFTER INSERT ON public.community_xp_ledger FOR EACH ROW EXECUTE FUNCTION security_private.community_mission_event();

CREATE OR REPLACE FUNCTION public.consume_verified_community_activity(_server_id uuid,_activity_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p security_private.community_xp_policy%ROWTYPE; f security_private.community_verified_activities%ROWTYPE;
 a public.community_xp_accounts%ROWTYPE; entry public.community_xp_ledger%ROWTYPE;
 t timestamptz; day_xp bigint; week_xp bigint; amount integer; requested integer;
BEGIN
 PERFORM 1 FROM public.servers WHERE id=_server_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'community_progression_missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO f FROM security_private.community_verified_activities WHERE id=_activity_id;
 IF NOT FOUND OR f.server_id<>_server_id THEN RAISE EXCEPTION 'community_activity_unverified' USING ERRCODE='22023'; END IF;
 SELECT * INTO entry FROM public.community_xp_ledger WHERE activity_id=_activity_id;
 IF FOUND THEN RETURN jsonb_build_object('id',entry.id::text,'awarded_xp',entry.awarded_xp,'outcome',entry.outcome,'replayed',true); END IF;
 IF NOT EXISTS(SELECT FROM public.server_community_settings WHERE server_id=_server_id AND enabled) THEN RAISE EXCEPTION 'community_progression_disabled' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT p FROM security_private.community_xp_policy FOR SHARE;
 IF NOT p.enabled THEN RAISE EXCEPTION 'community_xp_source_disabled' USING ERRCODE='42501'; END IF;
 t:=clock_timestamp();
 IF f.verified_at>t OR f.expires_at<=t THEN RAISE EXCEPTION 'community_activity_expired' USING ERRCODE='22023'; END IF;
 IF f.source='backend_verified_activity' THEN requested:=p.activity_xp;
 ELSIF f.source='community_mission_reward' THEN
  SELECT v.reward_xp INTO requested FROM public.community_mission_progress m JOIN public.community_objective_versions v USING(objective_id,version)
   WHERE m.server_id=_server_id AND m.reward_activity_id=_activity_id AND m.completed_at IS NOT NULL;
  IF requested IS NULL OR requested<=0 THEN RAISE EXCEPTION 'community_reward_unbound' USING ERRCODE='22023'; END IF;
 ELSE RAISE EXCEPTION 'community_activity_unverified' USING ERRCODE='22023'; END IF;
 INSERT INTO public.community_xp_accounts(server_id,curve_version) VALUES(_server_id,p.curve_version) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT a FROM public.community_xp_accounts WHERE server_id=_server_id FOR UPDATE;
 SELECT coalesce(sum(awarded_xp) FILTER(WHERE created_at>=date_trunc('day',t AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),coalesce(sum(awarded_xp),0)
 INTO day_xp,week_xp FROM public.community_xp_ledger WHERE server_id=_server_id AND created_at>=date_trunc('week',t AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 amount:=security_private.community_xp_allowance(requested,p.daily_cap,p.weekly_cap,day_xp,week_xp,a.xp);
 UPDATE public.community_xp_accounts SET xp=xp+amount,updated_at=t WHERE server_id=_server_id;
 INSERT INTO public.community_xp_ledger(server_id,activity_id,awarded_xp,requested_xp,outcome,total_after,policy_revision,created_at)
 VALUES(_server_id,_activity_id,amount,requested,CASE WHEN amount>0 THEN 'granted' ELSE 'capped' END,a.xp+amount,p.revision,t) RETURNING * INTO entry;
 RETURN jsonb_build_object('id',entry.id::text,'awarded_xp',amount,'outcome',entry.outcome,'replayed',false);
END $$;

-- RPC-only projections: no participant identities or private attestation metadata.
CREATE FUNCTION security_private.community_mission_projection(m public.community_mission_progress) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',m.id::text,'objective_id',m.objective_id,'version',m.version,'name',v.name,'description',v.description,
 'cadence',k.cadence,'target',v.target,'progress',m.progress,'period_start',m.period_start,'expires_at',m.expires_at,'completed_at',m.completed_at,
 'status',CASE WHEN m.completed_at IS NOT NULL THEN 'completed' WHEN m.expires_at<=statement_timestamp() THEN 'expired' ELSE 'in_progress' END,
 'reward_xp',v.reward_xp,'awarded_xp',l.awarded_xp,'reward_id',v.reward_id)
 FROM public.community_objective_versions v JOIN public.community_objective_keys k ON k.id=v.objective_id
 LEFT JOIN public.community_xp_ledger l ON l.activity_id=m.reward_activity_id WHERE v.objective_id=m.objective_id AND v.version=m.version;
$$;
CREATE FUNCTION public.get_community_objectives(_server_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d record; m public.community_mission_progress%ROWTYPE; missions jsonb:='[]'; start_at timestamptz; end_at timestamptz; result jsonb; enabled boolean;
BEGIN
 IF NOT security_private.community_xp_visible(_server_id) THEN RAISE EXCEPTION 'community_progression_forbidden' USING ERRCODE='42501'; END IF;
 SELECT p.enabled AND v.enabled INTO enabled FROM security_private.community_xp_policy p CROSS JOIN security_private.community_objective_verifiers v WHERE v.source='verified_activity';
 FOR d IN SELECT k.cadence,v.* FROM security_private.community_objective_active a JOIN public.community_objective_keys k ON k.id=a.objective_id
 JOIN public.community_objective_versions v USING(objective_id,version) WHERE k.kind='mission' ORDER BY a.objective_id LOOP
  start_at:=date_trunc(CASE WHEN d.cadence='daily' THEN 'day' ELSE 'week' END,statement_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  end_at:=start_at+CASE WHEN d.cadence='daily' THEN interval '24 hours' ELSE interval '168 hours' END;
  SELECT * INTO m FROM public.community_mission_progress WHERE server_id=_server_id AND objective_id=d.objective_id AND period_start=start_at;
  IF FOUND THEN result:=security_private.community_mission_projection(m);
  ELSE result:=jsonb_build_object('id',NULL,'objective_id',d.objective_id,'version',d.version,'name',d.name,'description',d.description,'cadence',d.cadence,
   'target',d.target,'progress',0,'period_start',start_at,'expires_at',end_at,'completed_at',NULL,'status','available','reward_xp',d.reward_xp,'awarded_xp',NULL,'reward_id',d.reward_id); END IF;
  IF NOT coalesce(enabled,false) AND result->>'status'<>'completed' THEN result:=jsonb_set(result,'{status}','"unavailable"'); END IF;
  missions:=missions||jsonb_build_array(result);
 END LOOP;
 RETURN jsonb_build_object('server_id',_server_id,'missions',missions,'verifier_enabled',coalesce(enabled,false),
  'recent_achievements',(SELECT coalesce(jsonb_agg(q.value ORDER BY q.unlocked_at DESC,q.objective_id),'[]') FROM (
    SELECT u.unlocked_at,u.objective_id,jsonb_build_object('objective_id',u.objective_id,'version',u.version,'name',v.name,'description',v.description,'criterion',k.criterion,'category',v.category,'rarity',v.rarity,'unlocked_at',u.unlocked_at,'reward_id',v.reward_id) value
    FROM public.community_achievement_unlocks u JOIN public.community_objective_versions v USING(objective_id,version) JOIN public.community_objective_keys k ON k.id=u.objective_id WHERE u.server_id=_server_id ORDER BY u.unlocked_at DESC,u.objective_id LIMIT 3)q));
END $$;
CREATE FUNCTION public.list_community_achievements(_server_id uuid,_after text DEFAULT '',_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT security_private.community_xp_visible(_server_id) THEN RAISE EXCEPTION 'community_progression_forbidden' USING ERRCODE='42501'; END IF;
 IF _after IS NULL OR length(_after)>64 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'community_objective_invalid_page' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(q.value ORDER BY q.objective_id),'[]') FROM (
 SELECT k.id objective_id,jsonb_build_object('objective_id',k.id,'version',v.version,'name',v.name,'description',v.description,'criterion',k.criterion,'category',v.category,'rarity',v.rarity,'unlocked_at',u.unlocked_at,'reward_id',v.reward_id) value
 FROM security_private.community_objective_active a JOIN public.community_objective_keys k ON k.id=a.objective_id
 LEFT JOIN public.community_achievement_unlocks u ON u.objective_id=k.id AND u.server_id=_server_id
 JOIN public.community_objective_versions v ON v.objective_id=k.id AND v.version=coalesce(u.version,a.version)
 WHERE k.kind='achievement' AND k.id>_after ORDER BY k.id LIMIT _limit)q);
END $$;
CREATE FUNCTION public.list_community_mission_history(_server_id uuid,_before bigint DEFAULT NULL,_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT security_private.community_xp_visible(_server_id) THEN RAISE EXCEPTION 'community_progression_forbidden' USING ERRCODE='42501'; END IF;
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 OR (_before IS NOT NULL AND _before<=0) THEN RAISE EXCEPTION 'community_objective_invalid_page' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(security_private.community_mission_projection(q) ORDER BY q.id DESC),'[]') FROM (
 SELECT * FROM public.community_mission_progress m WHERE server_id=_server_id AND (completed_at IS NOT NULL OR expires_at<=statement_timestamp()) AND (_before IS NULL OR id<_before) ORDER BY id DESC LIMIT _limit)q);
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='security_private' AND p.proname IN (
 'community_objective_immutable','community_objective_version_guard','community_objective_config_guard','community_mission_guard','community_unlock_achievement','community_achievement_event','community_mission_event','community_mission_projection') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.get_community_objectives(uuid),public.list_community_achievements(uuid,text,integer),public.list_community_mission_history(uuid,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_community_objectives(uuid),public.list_community_achievements(uuid,text,integer),public.list_community_mission_history(uuid,bigint,integer) TO authenticated;
-- CREATE OR REPLACE preserves the 4A consumer ACL; reaffirm it explicitly.
REVOKE ALL ON FUNCTION public.consume_verified_community_activity(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_verified_community_activity(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
