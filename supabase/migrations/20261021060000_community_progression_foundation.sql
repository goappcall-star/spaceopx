-- Phase 4A only. No browser scoring, automatic earners, missions or paid boosts.
-- Curve definitions are immutable. New versions apply only to new accounts.
CREATE TABLE security_private.community_xp_curves (
  version integer PRIMARY KEY CHECK(version > 0),
  base_xp integer NOT NULL CHECK(base_xp BETWEEN 100 AND 1000000),
  step_xp integer NOT NULL CHECK(step_xp BETWEEN 0 AND 1000000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO security_private.community_xp_curves VALUES(1,1000,500,DEFAULT);
CREATE TABLE security_private.community_xp_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  curve_version integer NOT NULL REFERENCES security_private.community_xp_curves(version),
  activity_xp integer NOT NULL CHECK(activity_xp BETWEEN 1 AND 10000),
  daily_cap integer NOT NULL CHECK(daily_cap BETWEEN 1 AND 100000),
  weekly_cap integer NOT NULL CHECK(weekly_cap BETWEEN 1 AND 700000),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  CHECK(daily_cap <= weekly_cap)
);
INSERT INTO security_private.community_xp_policy VALUES(true,false,1,100,500,2000,1);
CREATE TABLE security_private.community_xp_policy_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 previous_policy jsonb NOT NULL, next_policy jsonb NOT NULL,
 operator text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION security_private.audit_community_xp_policy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 NEW.revision:=OLD.revision+1;
 INSERT INTO security_private.community_xp_policy_audit(previous_policy,next_policy,operator)
 VALUES(to_jsonb(OLD),to_jsonb(NEW),session_user);
 RETURN NEW;
END $$;
CREATE TRIGGER community_xp_policy_audit BEFORE UPDATE ON security_private.community_xp_policy
FOR EACH ROW EXECUTE FUNCTION security_private.audit_community_xp_policy();
REVOKE ALL ON security_private.community_xp_policy_audit FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION security_private.audit_community_xp_policy() FROM PUBLIC,anon,authenticated,service_role;
-- No producer is enabled/provisioned in 4A. A future verifier must write a fact
-- only after independently proving legitimate activity; no RSVP/message/voice hooks.
CREATE TABLE security_private.community_verified_activities (
  id uuid PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  source text NOT NULL CHECK(source='backend_verified_activity'),
  evidence_key uuid NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK(expires_at > verified_at AND expires_at <= verified_at + interval '24 hours')
);
CREATE TABLE public.community_xp_accounts (
  server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
  xp bigint NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 1000000000000),
  curve_version integer NOT NULL REFERENCES security_private.community_xp_curves(version),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.community_xp_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL UNIQUE REFERENCES security_private.community_verified_activities(id) ON DELETE CASCADE,
  awarded_xp integer NOT NULL CHECK(awarded_xp BETWEEN 0 AND 10000),
  requested_xp integer NOT NULL CHECK(requested_xp BETWEEN 1 AND 10000),
  outcome text NOT NULL CHECK(outcome IN ('granted','capped')),
  total_after bigint NOT NULL,
  policy_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(awarded_xp<=requested_xp),
  CHECK((outcome='granted')=(awarded_xp>0))
);
CREATE INDEX community_xp_ledger_server_page ON public.community_xp_ledger(server_id,id DESC);
CREATE INDEX community_xp_ledger_caps ON public.community_xp_ledger(server_id,created_at) INCLUDE(awarded_xp);
ALTER TABLE public.community_xp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_xp_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_xp_accounts,public.community_xp_ledger FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON security_private.community_xp_curves,security_private.community_xp_policy,security_private.community_verified_activities FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION security_private.community_xp_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  -- Preserve the pre-existing explicit server deletion flow; disable never deletes.
  IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('community_verified_activities','community_xp_ledger') THEN
    IF NOT EXISTS(SELECT FROM public.servers WHERE id=OLD.server_id) THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'community_xp_immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER community_xp_curves_immutable BEFORE UPDATE OR DELETE ON security_private.community_xp_curves
FOR EACH ROW EXECUTE FUNCTION security_private.community_xp_immutable();
CREATE TRIGGER community_xp_facts_immutable BEFORE UPDATE OR DELETE ON security_private.community_verified_activities
FOR EACH ROW EXECUTE FUNCTION security_private.community_xp_immutable();
CREATE TRIGGER community_xp_ledger_immutable BEFORE UPDATE OR DELETE ON public.community_xp_ledger
FOR EACH ROW EXECUTE FUNCTION security_private.community_xp_immutable();

CREATE FUNCTION security_private.community_xp_visible(_server_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT FROM public.server_community_settings c JOIN public.server_members m USING(server_id)
  WHERE c.server_id=_server_id AND c.enabled AND m.user_id=auth.uid()
  AND NOT EXISTS(SELECT FROM public.server_bans b WHERE b.server_id=c.server_id AND b.user_id=auth.uid()));
$$;
CREATE FUNCTION security_private.community_xp_summary(_server_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.community_xp_accounts%ROWTYPE; c security_private.community_xp_curves%ROWTYPE;
 p security_private.community_xp_policy%ROWTYPE; lvl bigint:=1; floor_xp bigint:=0; needed bigint;
BEGIN
 SELECT * INTO p FROM security_private.community_xp_policy;
 SELECT * INTO a FROM public.community_xp_accounts WHERE server_id=_server_id;
 SELECT * INTO STRICT c FROM security_private.community_xp_curves WHERE version=coalesce(a.curve_version,p.curve_version);
 -- Bounded logarithmic search: threshold(L)=base*(L-1)+step*(L-1)*(L-2)/2.
 DECLARE lo bigint:=1; hi bigint:=10000000002; mid bigint; threshold_xp numeric; BEGIN
 WHILE lo+1<hi LOOP
  mid:=(lo+hi)/2;
  threshold_xp:=c.base_xp::numeric*(mid-1)+c.step_xp::numeric*(mid-1)*(mid-2)/2;
  IF threshold_xp<=coalesce(a.xp,0) THEN lo:=mid; ELSE hi:=mid; END IF;
 END LOOP; lvl:=lo; END;
 floor_xp:=(c.base_xp::numeric*(lvl-1)+c.step_xp::numeric*(lvl-1)*(lvl-2)/2)::bigint;
 needed:=c.base_xp::bigint+c.step_xp::bigint*(lvl-1);
 RETURN jsonb_build_object('server_id',_server_id,'xp',coalesce(a.xp,0),'level',lvl,
  'level_floor',floor_xp,'next_level_xp',floor_xp+needed,'curve_version',c.version,
  'earning_enabled',p.enabled,'daily_cap',p.daily_cap,'weekly_cap',p.weekly_cap);
END $$;

CREATE FUNCTION public.get_community_progression(_server_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT security_private.community_xp_visible(_server_id) THEN
  RAISE EXCEPTION 'community_progression_forbidden' USING ERRCODE='42501'; END IF;
 RETURN security_private.community_xp_summary(_server_id);
END $$;
CREATE FUNCTION public.list_community_xp_history(_server_id uuid,_before bigint DEFAULT NULL,_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT security_private.community_xp_visible(_server_id) OR NOT public.can_manage_community(_server_id) THEN
  RAISE EXCEPTION 'community_progression_forbidden' USING ERRCODE='42501'; END IF;
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 OR (_before IS NOT NULL AND _before<=0) THEN
  RAISE EXCEPTION 'community_progression_invalid_page' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q)-'sort_id' ORDER BY q.sort_id DESC),'[]'::jsonb) FROM (
  SELECT id AS sort_id,id::text,awarded_xp,requested_xp,outcome,total_after,policy_revision,created_at
  FROM public.community_xp_ledger WHERE server_id=_server_id AND (_before IS NULL OR id<_before)
  ORDER BY id DESC LIMIT _limit) q);
END $$;

-- Trusted worker/DB operator only. Input is an existing attestation ID, never points.
-- Row locks serialize XP, period caps, and community disable against existing server lock.
CREATE FUNCTION security_private.community_xp_allowance(_requested integer,_daily integer,_weekly integer,_day_used bigint,_week_used bigint,_total bigint) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT greatest(0,least(_requested,_daily-_day_used,_weekly-_week_used,1000000000000-_total))::integer;
$$;
REVOKE ALL ON FUNCTION security_private.community_xp_allowance(integer,integer,integer,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.consume_verified_community_activity(_server_id uuid,_activity_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p security_private.community_xp_policy%ROWTYPE; f security_private.community_verified_activities%ROWTYPE;
 a public.community_xp_accounts%ROWTYPE; entry public.community_xp_ledger%ROWTYPE;
 t timestamptz; day_xp bigint; week_xp bigint; amount integer;
BEGIN
 PERFORM 1 FROM public.servers WHERE id=_server_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'community_progression_missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO f FROM security_private.community_verified_activities WHERE id=_activity_id;
 IF NOT FOUND OR f.server_id<>_server_id THEN
  RAISE EXCEPTION 'community_activity_unverified' USING ERRCODE='22023'; END IF;
 SELECT * INTO entry FROM public.community_xp_ledger WHERE activity_id=_activity_id;
 IF FOUND THEN RETURN jsonb_build_object('id',entry.id::text,'awarded_xp',entry.awarded_xp,'outcome',entry.outcome,'replayed',true); END IF;
 IF NOT EXISTS(SELECT FROM public.server_community_settings WHERE server_id=_server_id AND enabled) THEN
  RAISE EXCEPTION 'community_progression_disabled' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT p FROM security_private.community_xp_policy FOR SHARE;
 IF NOT p.enabled THEN RAISE EXCEPTION 'community_xp_source_disabled' USING ERRCODE='42501'; END IF;
 t:=clock_timestamp();
 IF f.verified_at>t OR f.expires_at<=t THEN RAISE EXCEPTION 'community_activity_expired' USING ERRCODE='22023'; END IF;
 INSERT INTO public.community_xp_accounts(server_id,curve_version) VALUES(_server_id,p.curve_version) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT a FROM public.community_xp_accounts WHERE server_id=_server_id FOR UPDATE;
 SELECT coalesce(sum(awarded_xp) FILTER(WHERE created_at>=date_trunc('day',t AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),coalesce(sum(awarded_xp),0)
 INTO day_xp,week_xp FROM public.community_xp_ledger WHERE server_id=_server_id
 AND created_at>=date_trunc('week',t AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 amount:=security_private.community_xp_allowance(p.activity_xp,p.daily_cap,p.weekly_cap,day_xp,week_xp,a.xp);
 UPDATE public.community_xp_accounts SET xp=xp+amount,updated_at=t WHERE server_id=_server_id;
 INSERT INTO public.community_xp_ledger(server_id,activity_id,awarded_xp,requested_xp,outcome,total_after,policy_revision,created_at)
 VALUES(_server_id,_activity_id,amount,p.activity_xp,CASE WHEN amount>0 THEN 'granted' ELSE 'capped' END,a.xp+amount,p.revision,t) RETURNING * INTO entry;
 RETURN jsonb_build_object('id',entry.id::text,'awarded_xp',amount,'outcome',entry.outcome,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION security_private.community_xp_immutable(),security_private.community_xp_visible(uuid),security_private.community_xp_summary(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_community_progression(uuid),public.list_community_xp_history(uuid,bigint,integer),public.consume_verified_community_activity(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_community_progression(uuid),public.list_community_xp_history(uuid,bigint,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_verified_community_activity(uuid,uuid) TO service_role;
-- No UPDATE/DELETE grants, feature activation, retroactive backfill or individual XP changes.
NOTIFY pgrst,'reload schema';
