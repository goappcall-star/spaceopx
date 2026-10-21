-- Local 4C. No XP changes, backfill, verifier activation or remote deployment.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
ALTER TABLE public.community_reward_catalog DROP CONSTRAINT community_reward_catalog_usable_check;
CREATE TABLE security_private.community_cosmetic_assets (
 reward_id text PRIMARY KEY REFERENCES public.community_reward_catalog(id),
 slot text NOT NULL CHECK(slot IN ('theme','banner','seal','frame','highlight')),
 render_key text NOT NULL UNIQUE CHECK(render_key IN ('orbit_theme','grid_banner','foundation_seal','orbit_frame','lime_highlight')),
 required_objective text NOT NULL REFERENCES public.community_objective_keys(id)
);
INSERT INTO public.community_reward_catalog VALUES
 ('lx_orbit_theme','theme','Órbita violeta','Paleta local roxa e verde-limão, sem animação.',true),
 ('lx_grid_banner','banner','Horizonte orbital','Geometria original leve sobre a Home.',true),
 ('lx_foundation_seal','seal','Selo de fundação','Selo vetorial original da comunidade.',true),
 ('lx_orbit_frame','frame','Moldura orbital','Contorno decorativo estático da identidade.',true),
 ('lx_lime_highlight','highlight','Destaque limão','Detalhe visual estático da comunidade.',true);
INSERT INTO security_private.community_cosmetic_assets VALUES
 ('lx_orbit_theme','theme','orbit_theme','community_publication'),
 ('lx_grid_banner','banner','grid_banner','community_publication'),
 ('lx_foundation_seal','seal','foundation_seal','community_foundation'),
 ('lx_orbit_frame','frame','orbit_frame','verified_weekly'),
 ('lx_lime_highlight','highlight','lime_highlight','community_foundation');
ALTER TABLE security_private.community_cosmetic_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_private.community_cosmetic_assets FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER community_cosmetic_assets_immutable BEFORE UPDATE OR DELETE ON security_private.community_cosmetic_assets FOR EACH ROW EXECUTE FUNCTION security_private.community_objective_immutable();
CREATE TABLE public.community_cosmetic_selection (
 server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
 selection jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(selection)='object' AND selection-ARRAY['theme','banner','seal','frame','highlight']='{}'::jsonb),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.community_cosmetic_selection ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_cosmetic_selection FROM PUBLIC,anon,authenticated,service_role;
-- Only future unlock/completion transitions produce cosmetic contracts. No INSERT SELECT backfill.
CREATE FUNCTION security_private.community_cosmetic_unlock_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_TABLE_NAME='community_mission_progress' THEN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT FROM security_private.community_xp_policy p CROSS JOIN security_private.community_objective_verifiers v WHERE p.enabled AND v.enabled) THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO public.community_reward_unlocks(server_id,reward_id,objective_id,version)
 SELECT NEW.server_id,a.reward_id,NEW.objective_id,NEW.version FROM security_private.community_cosmetic_assets a
 WHERE a.required_objective=NEW.objective_id ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER cosmetic_new_achievement AFTER INSERT ON public.community_achievement_unlocks FOR EACH ROW EXECUTE FUNCTION security_private.community_cosmetic_unlock_event();
CREATE TRIGGER cosmetic_new_mission AFTER UPDATE OF completed_at ON public.community_mission_progress FOR EACH ROW EXECUTE FUNCTION security_private.community_cosmetic_unlock_event();
CREATE FUNCTION security_private.community_cosmetic_eligible(_server uuid,_reward text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM security_private.community_cosmetic_assets a JOIN public.community_reward_catalog r ON r.id=a.reward_id
 JOIN public.community_reward_unlocks u ON u.reward_id=a.reward_id AND u.server_id=_server AND u.objective_id=a.required_objective
 JOIN public.community_objective_keys k ON k.id=u.objective_id
 WHERE a.reward_id=_reward AND r.usable AND r.kind=a.slot AND (
 (k.kind='achievement' AND EXISTS(SELECT FROM public.community_achievement_unlocks x WHERE x.server_id=_server AND x.objective_id=u.objective_id AND x.version=u.version)) OR
 (k.kind='mission' AND EXISTS(SELECT FROM public.community_mission_progress m WHERE m.server_id=_server AND m.objective_id=u.objective_id AND m.version=u.version AND m.completed_at IS NOT NULL)
 AND EXISTS(SELECT FROM security_private.community_xp_policy p CROSS JOIN security_private.community_objective_verifiers v WHERE p.enabled AND v.enabled))));
$$;
CREATE FUNCTION public.get_community_cosmetics(_server_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE s public.community_cosmetic_selection%ROWTYPE; BEGIN
 IF NOT security_private.community_xp_visible(_server_id) THEN RAISE EXCEPTION 'community_progression_forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.community_cosmetic_selection WHERE server_id=_server_id;
 RETURN jsonb_build_object('server_id',_server_id,'revision',coalesce(s.revision,0),'can_manage',public.can_manage_community(_server_id),
 'selection',coalesce(s.selection,'{}'),'equipped',(SELECT coalesce(jsonb_object_agg(a.slot,a.render_key),'{}') FROM security_private.community_cosmetic_assets a WHERE coalesce(s.selection,'{}')->>a.slot=a.reward_id AND security_private.community_cosmetic_eligible(_server_id,a.reward_id)),
 'items',(SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'description',r.description,'slot',a.slot,'render_key',a.render_key,
 'owned',EXISTS(SELECT FROM public.community_reward_unlocks u WHERE u.server_id=_server_id AND u.reward_id=r.id),
 'available',security_private.community_cosmetic_eligible(_server_id,r.id),'requires_mission',k.kind='mission') ORDER BY r.id)
 FROM security_private.community_cosmetic_assets a JOIN public.community_reward_catalog r ON r.id=a.reward_id JOIN public.community_objective_keys k ON k.id=a.required_objective));
END $$;
CREATE FUNCTION public.equip_community_cosmetic(_server_id uuid,_slot text,_reward_id text,_expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE s public.community_cosmetic_selection%ROWTYPE; next_selection jsonb; BEGIN
 IF NOT security_private.community_xp_visible(_server_id) OR NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_cosmetic_forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.servers WHERE id=_server_id FOR UPDATE;
 IF NOT security_private.community_xp_visible(_server_id) OR NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_cosmetic_forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM security_private.community_xp_policy FOR SHARE;
 PERFORM 1 FROM security_private.community_objective_verifiers FOR SHARE;
 SELECT * INTO s FROM public.community_cosmetic_selection WHERE server_id=_server_id FOR UPDATE;
 IF _expected_revision IS NULL OR _expected_revision<>coalesce(s.revision,0) THEN RAISE EXCEPTION 'community_cosmetic_revision_conflict' USING ERRCODE='40001'; END IF;
 IF _slot IS NULL OR _slot NOT IN ('theme','banner','seal','frame','highlight') THEN RAISE EXCEPTION 'community_cosmetic_invalid_slot' USING ERRCODE='22023'; END IF;
 IF _reward_id IS NOT NULL AND (NOT EXISTS(SELECT FROM security_private.community_cosmetic_assets WHERE reward_id=_reward_id AND slot=_slot) OR NOT security_private.community_cosmetic_eligible(_server_id,_reward_id)) THEN RAISE EXCEPTION 'community_cosmetic_locked' USING ERRCODE='42501'; END IF;
 next_selection:=CASE WHEN _reward_id IS NULL THEN coalesce(s.selection,'{}')-_slot ELSE jsonb_set(coalesce(s.selection,'{}'),ARRAY[_slot],to_jsonb(_reward_id)) END;
 IF next_selection=coalesce(s.selection,'{}') THEN RETURN public.get_community_cosmetics(_server_id); END IF;
 PERFORM security_private.consume_write_budget('community_cosmetic_save',60,20);
 INSERT INTO public.community_cosmetic_selection(server_id,selection,revision) VALUES(_server_id,next_selection,1)
 ON CONFLICT(server_id) DO UPDATE SET selection=excluded.selection,revision=community_cosmetic_selection.revision+1,updated_at=clock_timestamp();
 PERFORM public.write_audit(_server_id,'community_cosmetic_changed','server',_server_id,NULL,jsonb_build_object('slot',_slot,'reward_id',_reward_id));
 RETURN public.get_community_cosmetics(_server_id);
END $$;
CREATE INDEX community_xp_statistics ON public.community_xp_ledger(server_id,created_at,id);
CREATE FUNCTION public.get_community_statistics(_server_id uuid,_from date,_to date,_before bigint DEFAULT NULL,_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE start_at timestamptz; end_at timestamptz; BEGIN
 IF NOT security_private.community_xp_visible(_server_id) OR NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_statistics_forbidden' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to<=_from OR _to-_from>93 OR _to>(statement_timestamp() AT TIME ZONE 'UTC')::date+1 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 OR (_before IS NOT NULL AND _before<=0) THEN RAISE EXCEPTION 'community_statistics_invalid_period' USING ERRCODE='22023'; END IF;
 start_at:=_from::timestamp AT TIME ZONE 'UTC';end_at:=_to::timestamp AT TIME ZONE 'UTC';
 RETURN jsonb_build_object('server_id',_server_id,'from',_from,'to',_to,'progression',security_private.community_xp_summary(_server_id),
 'xp_received',(SELECT coalesce(sum(awarded_xp),0) FROM public.community_xp_ledger WHERE server_id=_server_id AND created_at>=start_at AND created_at<end_at),
 'missions_completed',(SELECT count(*) FROM public.community_mission_progress WHERE server_id=_server_id AND completed_at>=start_at AND completed_at<end_at),
 'achievements_unlocked',(SELECT count(*) FROM public.community_achievement_unlocks WHERE server_id=_server_id AND unlocked_at>=start_at AND unlocked_at<end_at),
 'members_current',(SELECT count(*) FROM public.server_members WHERE server_id=_server_id),'member_growth',NULL,'events_realized',NULL,'attendance_verified',NULL,
 'events_created',(SELECT count(*) FROM public.community_events e WHERE e.server_id=_server_id AND created_at>=start_at AND created_at<end_at AND public.can_view_community_event(e.id)),
 'events_scheduled',(SELECT count(*) FROM public.community_events e WHERE e.server_id=_server_id AND status='scheduled' AND starts_at>=start_at AND starts_at<end_at AND public.can_view_community_event(e.id)),
 'events_cancelled',(SELECT count(*) FROM public.community_events e WHERE e.server_id=_server_id AND status='cancelled' AND updated_at>=start_at AND updated_at<end_at AND public.can_view_community_event(e.id)),
 'rsvp_going',(SELECT count(*) FROM public.community_event_rsvps r JOIN public.community_events e ON e.id=r.event_id WHERE e.server_id=_server_id AND e.status='scheduled' AND e.starts_at>=start_at AND e.starts_at<end_at AND r.response='going' AND public.can_view_community_event(e.id)),
 'daily',(SELECT coalesce(jsonb_agg(jsonb_build_object('day',q.day_bucket,'xp',q.xp,'balance',q.balance) ORDER BY q.day_bucket),'[]') FROM (
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day_bucket,sum(awarded_xp) xp,(array_agg(total_after ORDER BY id DESC))[1] balance FROM public.community_xp_ledger WHERE server_id=_server_id AND created_at>=start_at AND created_at<end_at GROUP BY 1)q),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(q)-'sort_id' ORDER BY q.sort_id DESC),'[]') FROM (SELECT id sort_id,id::text,awarded_xp,requested_xp,total_after,created_at FROM public.community_xp_ledger WHERE server_id=_server_id AND created_at>=start_at AND created_at<end_at AND (_before IS NULL OR id<_before) ORDER BY id DESC LIMIT _limit)q));
END $$;
REVOKE ALL ON FUNCTION security_private.community_cosmetic_unlock_event(),security_private.community_cosmetic_eligible(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_community_cosmetics(uuid),public.equip_community_cosmetic(uuid,text,text,integer),public.get_community_statistics(uuid,date,date,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_community_cosmetics(uuid),public.equip_community_cosmetic(uuid,text,text,integer),public.get_community_statistics(uuid,date,date,bigint,integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
