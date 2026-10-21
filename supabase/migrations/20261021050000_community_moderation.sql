-- Phase 3C. Local only, additive, opt-in filters. No platform staff is provisioned here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE security_private.platform_safety_staff(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,enabled boolean NOT NULL DEFAULT true,assigned_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE security_private.platform_safety_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_private.platform_safety_staff FROM PUBLIC,anon,authenticated;
GRANT ALL ON security_private.platform_safety_staff TO service_role;
CREATE TABLE security_private.platform_safety_identity_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,operation text NOT NULL,database_operator text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE security_private.platform_safety_identity_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_private.platform_safety_identity_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION security_private.audit_platform_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO security_private.platform_safety_identity_audit(user_id,operation,database_operator) VALUES(CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END,TG_OP,session_user);RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION security_private.audit_platform_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER platform_identity_audit AFTER INSERT OR UPDATE OR DELETE ON security_private.platform_safety_staff FOR EACH ROW EXECUTE FUNCTION security_private.audit_platform_identity();
CREATE TABLE public.community_moderator_roles(role_id uuid PRIMARY KEY REFERENCES public.roles(id) ON DELETE CASCADE,server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,capabilities text[] NOT NULL CHECK(capabilities<@ARRAY['reports','warnings','members','security','history']::text[]),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX community_moderator_roles_server ON public.community_moderator_roles(server_id);
CREATE TABLE public.community_security_settings(server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,revision integer NOT NULL DEFAULT 1,enabled boolean NOT NULL DEFAULT false,burst_limit integer NOT NULL DEFAULT 8 CHECK(burst_limit BETWEEN 3 AND 30),repeat_limit integer NOT NULL DEFAULT 3 CHECK(repeat_limit BETWEEN 2 AND 10),mentions_limit integer NOT NULL DEFAULT 8 CHECK(mentions_limit BETWEEN 1 AND 30),blocked_domains text[] NOT NULL DEFAULT '{}' CHECK(cardinality(blocked_domains)<=50));
CREATE TABLE public.community_reports(id uuid PRIMARY KEY,server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,scope text NOT NULL CHECK(scope IN ('community','platform')),kind text NOT NULL CHECK(kind IN ('message','member','event','notice','directory')),target_id uuid NOT NULL,channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,category text NOT NULL CHECK(category IN ('spam','harassment','unsafe','privacy','other')),description text,evidence text,evidence_until timestamptz NOT NULL DEFAULT (now()+interval '30 days'),private_until timestamptz NOT NULL DEFAULT (now()+interval '90 days'),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),revision integer NOT NULL DEFAULT 1,reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX community_report_duplicate ON public.community_reports(server_id,reporter_id,kind,target_id) WHERE status='pending';
CREATE INDEX community_report_queue ON public.community_reports(scope,server_id,status,created_at DESC,id DESC);
CREATE INDEX community_report_retention ON public.community_reports(private_until);
CREATE TABLE public.community_warnings(id uuid PRIMARY KEY,server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,reason text NOT NULL,reason_until timestamptz NOT NULL DEFAULT (now()+interval '90 days'),status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX community_warnings_server ON public.community_warnings(server_id,created_at DESC,id DESC);
CREATE TABLE public.community_moderation_decisions(id uuid PRIMARY KEY,server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,scope text NOT NULL CHECK(scope IN ('community','platform')),entity_id uuid NOT NULL,actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,action text NOT NULL,reason text,reason_until timestamptz NOT NULL DEFAULT (now()+interval '90 days'),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX community_decisions_history ON public.community_moderation_decisions(scope,server_id,created_at DESC,id DESC);
CREATE INDEX community_warning_retention ON public.community_warnings(reason_until);
CREATE INDEX community_decision_retention ON public.community_moderation_decisions(reason_until);
CREATE INDEX community_report_evidence_retention ON public.community_reports(evidence_until) WHERE evidence IS NOT NULL;
DO $$DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['community_moderator_roles','community_security_settings','community_reports','community_warnings','community_moderation_decisions'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
END LOOP; END $$;
ALTER TABLE public.community_directory ADD COLUMN last_public_presentation jsonb,ADD COLUMN public_snapshot_until timestamptz;
ALTER TABLE public.community_directory ADD COLUMN suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.community_directory d SET last_public_presentation=security_private.directory_projection(d),public_snapshot_until=clock_timestamp()+interval '90 days' WHERE d.status='listed';
CREATE FUNCTION security_private.directory_public_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NEW.status='listed' THEN NEW.last_public_presentation:=security_private.directory_projection(NEW);NEW.public_snapshot_until:=clock_timestamp()+interval '90 days';
 ELSIF TG_OP='UPDATE' THEN NEW.last_public_presentation:=OLD.last_public_presentation;NEW.public_snapshot_until:=OLD.public_snapshot_until; END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.directory_public_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER directory_public_snapshot BEFORE INSERT OR UPDATE OF status,name,description,icon_url,banner_url,category,language,interests,public_rules,admission,featured_at ON public.community_directory FOR EACH ROW EXECUTE FUNCTION security_private.directory_public_snapshot();

CREATE FUNCTION public.has_platform_safety_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT FROM security_private.platform_safety_staff WHERE user_id=auth.uid() AND enabled) $$;
CREATE FUNCTION security_private.require_platform_safety() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM user_id FROM security_private.platform_safety_staff WHERE user_id=auth.uid() AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
END $$;
REVOKE ALL ON FUNCTION security_private.require_platform_safety() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.can_moderate_community(_server_id uuid,_capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT _capability=ANY(ARRAY['reports','warnings','members','security','history']) AND auth.uid() IS NOT NULL AND NOT public.is_server_banned(_server_id,auth.uid()) AND EXISTS(SELECT FROM public.server_community_settings WHERE server_id=_server_id AND enabled)
 AND (public.is_server_owner(_server_id,auth.uid()) OR EXISTS(SELECT FROM public.community_moderator_roles g JOIN public.roles r ON r.id=g.role_id AND r.server_id=g.server_id JOIN public.member_roles mr ON mr.role_id=r.id JOIN public.server_members m ON m.id=mr.member_id AND m.server_id=r.server_id WHERE g.server_id=_server_id AND m.user_id=auth.uid() AND _capability=ANY(g.capabilities)));
$$;
CREATE FUNCTION public.community_moderation_access(_server_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('platform',public.has_platform_safety_access(),'owner',public.is_server_owner(_server_id,auth.uid()),'capabilities',coalesce((SELECT jsonb_agg(c) FROM unnest(ARRAY['reports','warnings','members','security','history']) c WHERE public.can_moderate_community(_server_id,c)),'[]'));
$$;
CREATE POLICY report_read ON public.community_reports FOR SELECT TO authenticated USING(((reporter_id=auth.uid() AND private_until>now()) OR scope='community' AND public.can_moderate_community(server_id,'reports')) AND (kind NOT IN ('message','event') OR channel_id IS NOT NULL AND public.has_channel_permission(channel_id,auth.uid(),'view_channel')) OR scope='platform' AND public.has_platform_safety_access());
CREATE POLICY warning_read ON public.community_warnings FOR SELECT TO authenticated USING(target_user_id=auth.uid() OR public.can_moderate_community(server_id,'warnings'));
CREATE POLICY decision_read ON public.community_moderation_decisions FOR SELECT TO authenticated USING(scope='platform' AND public.has_platform_safety_access() OR scope='community' AND public.can_moderate_community(server_id,'history'));
CREATE POLICY moderator_grants_read ON public.community_moderator_roles FOR SELECT TO authenticated USING(public.can_moderate_community(server_id,'security'));
CREATE POLICY security_settings_read ON public.community_security_settings FOR SELECT TO authenticated USING(public.can_moderate_community(server_id,'security'));

CREATE FUNCTION security_private.guard_moderation_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE s uuid;BEGIN
 SELECT server_id INTO s FROM public.roles WHERE id=NEW.role_id;
 PERFORM id FROM public.servers WHERE id=s FOR UPDATE;
 IF EXISTS(SELECT FROM public.community_moderator_roles WHERE role_id=NEW.role_id AND cardinality(capabilities)>0) AND NOT public.is_server_owner(s,auth.uid()) THEN RAISE EXCEPTION 'moderation_owner_required' USING ERRCODE='42501'; END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.guard_moderation_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER moderation_assignment_guard BEFORE INSERT OR UPDATE ON public.member_roles FOR EACH ROW EXECUTE FUNCTION security_private.guard_moderation_assignment();
CREATE OR REPLACE FUNCTION security_private.community_role_selectable(r public.roles) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT NOT r.is_owner AND r.name NOT IN ('OWNER','ADMIN','MEMBER') AND NOT EXISTS(SELECT FROM jsonb_each(r.permissions) p WHERE p.value='true'::jsonb AND p.key NOT IN ('view_channel','read_messages','send_messages','connect','speak')) AND NOT EXISTS(SELECT FROM public.community_moderator_roles WHERE role_id=r.id AND cardinality(capabilities)>0);
$$;
CREATE FUNCTION public.set_community_moderator_role(_server_id uuid,_role_id uuid,_capabilities text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE r public.roles;BEGIN
 PERFORM id FROM public.servers WHERE id=_server_id FOR UPDATE;
 IF NOT public.is_server_owner(_server_id,auth.uid()) OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'moderation_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT FROM public.server_community_settings WHERE server_id=_server_id AND enabled) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.roles WHERE id=_role_id AND server_id=_server_id FOR UPDATE;
 IF r.id IS NULL OR r.name IN ('OWNER','MEMBER') OR r.is_owner OR _capabilities IS NULL OR cardinality(_capabilities)>5 OR EXISTS(SELECT FROM unnest(_capabilities) c WHERE c IS NULL OR c NOT IN ('reports','warnings','members','security','history')) THEN RAISE EXCEPTION 'moderation_invalid_grant' USING ERRCODE='22023'; END IF;
 PERFORM security_private.consume_write_budget('moderation_grants',60,10);
 INSERT INTO public.community_moderator_roles(role_id,server_id,capabilities) VALUES(_role_id,_server_id,ARRAY(SELECT DISTINCT unnest(_capabilities))) ON CONFLICT(role_id) DO UPDATE SET capabilities=excluded.capabilities,updated_at=clock_timestamp();
 PERFORM public.write_audit(_server_id,'community_moderator_role_updated','role',_role_id,r.name,jsonb_build_object('capabilities',_capabilities));
END $$;
CREATE FUNCTION public.get_community_security(_server_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE cfg public.community_security_settings;BEGIN
 IF NOT public.can_moderate_community(_server_id,'security') THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO cfg FROM public.community_security_settings WHERE server_id=_server_id;
 RETURN jsonb_build_object('settings',CASE WHEN cfg.server_id IS NULL THEN jsonb_build_object('revision',0,'enabled',false,'burst_limit',8,'repeat_limit',3,'mentions_limit',8,'blocked_domains','[]'::jsonb) ELSE to_jsonb(cfg)-'server_id' END,'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('role_id',g.role_id,'capabilities',g.capabilities,'name',r.name)) FROM public.community_moderator_roles g JOIN public.roles r ON r.id=g.role_id WHERE g.server_id=_server_id),'[]'));
END $$;
CREATE FUNCTION public.save_community_security(_server_id uuid,_payload jsonb,_expected_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE cfg public.community_security_settings;v text;BEGIN
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF NOT public.can_moderate_community(_server_id,'security') THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.community_security_settings WHERE server_id=_server_id FOR UPDATE;
 IF _expected_revision IS DISTINCT FROM coalesce(cfg.revision,0) THEN RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(_payload))<>5 OR NOT _payload ?& ARRAY['enabled','burst_limit','repeat_limit','mentions_limit','blocked_domains'] OR jsonb_typeof(_payload->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'moderation_invalid_settings' USING ERRCODE='22023'; END IF;
 FOREACH v IN ARRAY ARRAY['burst_limit','repeat_limit','mentions_limit'] LOOP IF jsonb_typeof(_payload->v) IS DISTINCT FROM 'number' OR (_payload->>v)!~'^[0-9]{1,2}$' THEN RAISE EXCEPTION 'moderation_invalid_settings' USING ERRCODE='22023'; END IF;END LOOP;
 IF jsonb_typeof(_payload->'blocked_domains') IS DISTINCT FROM 'array' OR jsonb_array_length(_payload->'blocked_domains')>50 THEN RAISE EXCEPTION 'moderation_invalid_domains' USING ERRCODE='22023'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements_text(_payload->'blocked_domains') LOOP IF char_length(v)>253 OR v!~'^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$' THEN RAISE EXCEPTION 'moderation_invalid_domains' USING ERRCODE='22023'; END IF;END LOOP;
 PERFORM security_private.consume_write_budget('moderation_settings',60,10);
 INSERT INTO public.community_security_settings(server_id,enabled,burst_limit,repeat_limit,mentions_limit,blocked_domains) VALUES(_server_id,(_payload->>'enabled')::boolean,(_payload->>'burst_limit')::integer,(_payload->>'repeat_limit')::integer,(_payload->>'mentions_limit')::integer,ARRAY(SELECT DISTINCT value FROM jsonb_array_elements_text(_payload->'blocked_domains'))) ON CONFLICT(server_id) DO UPDATE SET enabled=excluded.enabled,burst_limit=excluded.burst_limit,repeat_limit=excluded.repeat_limit,mentions_limit=excluded.mentions_limit,blocked_domains=excluded.blocked_domains,revision=community_security_settings.revision+1;
 PERFORM public.write_audit(_server_id,'community_security_updated','server',_server_id,NULL,'{}');
END $$;

CREATE FUNCTION public.submit_community_report(_id uuid,_server_id uuid,_kind text,_target_id uuid,_category text,_description text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE e text;ch uuid;prev public.community_reports;cfg public.server_community_settings;BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF _id IS NULL OR _target_id IS NULL OR _kind IS NULL OR _kind NOT IN ('message','member','event','notice','directory') OR _category IS NULL OR _category NOT IN ('spam','harassment','unsafe','privacy','other') OR _description IS NULL OR char_length(_description)>2000 OR _description~'[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN RAISE EXCEPTION 'moderation_invalid_report' USING ERRCODE='22023';END IF;
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF _kind='directory' THEN
 IF _target_id<>_server_id OR NOT public.community_is_discoverable(_server_id) THEN RAISE EXCEPTION 'moderation_target_unavailable' USING ERRCODE='42501';END IF;
 SELECT left(d.name||E'\n'||d.description,1000) INTO e FROM public.community_directory d WHERE server_id=_server_id;
 ELSE
 SELECT * INTO cfg FROM public.server_community_settings WHERE server_id=_server_id AND enabled;
 IF cfg.server_id IS NULL OR NOT public.is_server_member(_server_id,auth.uid()) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF _kind='message' THEN SELECT left(m.content,1000),m.channel_id INTO e,ch FROM public.messages m JOIN public.channels c ON c.id=m.channel_id WHERE m.id=_target_id AND c.server_id=_server_id AND public.has_channel_permission(c.id,auth.uid(),'view_channel');
 ELSIF _kind='member' THEN SELECT p.display_name INTO e FROM public.server_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.server_id=_server_id AND m.user_id=_target_id;
 ELSIF _kind='event' THEN SELECT left(title||E'\n'||description,1000),channel_id INTO e,ch FROM public.community_events WHERE id=_target_id AND server_id=_server_id AND public.can_view_community_event(id);
 ELSE SELECT left(n->>'title'||E'\n'||(n->>'body'),1000) INTO e FROM jsonb_array_elements(cfg.experience->'notices') n WHERE n->>'id'=_target_id::text;END IF;
 IF e IS NULL THEN RAISE EXCEPTION 'moderation_target_unavailable' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO prev FROM public.community_reports WHERE id=_id;
 IF prev.id IS NOT NULL THEN IF prev.reporter_id=auth.uid() AND prev.server_id=_server_id AND prev.kind=_kind AND prev.target_id=_target_id AND prev.category=_category AND prev.description=_description THEN RETURN prev.id; END IF;RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001';END IF;
 SELECT * INTO prev FROM public.community_reports WHERE server_id=_server_id AND reporter_id=auth.uid() AND kind=_kind AND target_id=_target_id AND status='pending';
 IF prev.id IS NOT NULL THEN RETURN prev.id; END IF;
 IF EXISTS(SELECT FROM public.community_reports WHERE server_id=_server_id AND reporter_id=auth.uid() AND kind=_kind AND target_id=_target_id AND created_at>clock_timestamp()-interval '1 day') THEN RAISE EXCEPTION 'moderation_report_cooldown' USING ERRCODE='22023';END IF;
 PERFORM security_private.consume_write_budget('moderation_reports',3600,10);
 INSERT INTO public.community_reports(id,server_id,scope,kind,target_id,channel_id,reporter_id,category,description,evidence) VALUES(_id,_server_id,CASE WHEN _kind='directory' THEN 'platform' ELSE 'community' END,_kind,_target_id,ch,auth.uid(),_category,_description,e) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001'; END IF;RETURN _id;
END $$;

CREATE FUNCTION public.list_community_reports(_server_id uuid DEFAULT NULL,_status text DEFAULT 'pending',_search text DEFAULT '',_before_time timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20,_mine boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE result jsonb;BEGIN
 IF auth.uid() IS NULL OR (_mine IS NOT TRUE AND CASE WHEN _server_id IS NULL THEN NOT public.has_platform_safety_access() ELSE NOT public.can_moderate_community(_server_id,'reports') END) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF _status IS NULL OR _status NOT IN ('','pending','resolved','dismissed') OR _search IS NULL OR char_length(_search)>100 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 30 OR ((_before_time IS NULL)<>(_before_id IS NULL)) OR _mine IS NULL THEN RAISE EXCEPTION 'moderation_invalid_filter' USING ERRCODE='22023';END IF;
 PERFORM security_private.consume_write_budget('moderation_report_list',60,90);
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(q.value ORDER BY q.created_at DESC,q.id DESC),'[]'),'has_more',count(*)>_limit) INTO result FROM (
 SELECT r.id,r.created_at,jsonb_build_object('id',r.id,'server_id',r.server_id,'kind',r.kind,'target_id',CASE WHEN r.private_until>now() THEN r.target_id ELSE '00000000-0000-0000-0000-000000000000'::uuid END,'category',r.category,'status',r.status,'revision',r.revision,'created_at',r.created_at,'reviewed_by',CASE WHEN r.private_until>now() THEN r.reviewed_by ELSE NULL END,
 'description',CASE WHEN r.private_until>now() THEN r.description ELSE NULL END,'evidence',CASE WHEN r.evidence_until>now() THEN r.evidence ELSE NULL END,'evidence_until',r.evidence_until,
 'decisions',coalesce((SELECT jsonb_agg(jsonb_build_object('action',d.action,'reason',CASE WHEN d.reason_until>now() THEN d.reason ELSE NULL END,'actor_id',CASE WHEN d.reason_until>now() THEN d.actor_id ELSE NULL END,'created_at',d.created_at) ORDER BY d.created_at) FROM public.community_moderation_decisions d WHERE d.entity_id=r.id AND d.scope=r.scope),'[]')) value
 FROM public.community_reports r WHERE ((_server_id IS NULL AND r.scope='platform') OR (r.scope='community' AND r.server_id=_server_id))
 AND (NOT _mine OR r.reporter_id=auth.uid() AND r.private_until>now()) AND (_status='' OR r.status=_status)
 AND (_search='' OR r.id::text LIKE '%'||_search||'%' OR r.category LIKE '%'||_search||'%')
 AND (r.scope='platform' OR r.kind NOT IN ('message','event') OR r.channel_id IS NOT NULL AND public.has_channel_permission(r.channel_id,auth.uid(),'view_channel'))
 AND (_before_time IS NULL OR (r.created_at,r.id)<(_before_time,_before_id)) ORDER BY r.created_at DESC,r.id DESC LIMIT _limit+1
 ) q;
 -- Drop the look-ahead item; preserve deterministic cursor order.
 RETURN jsonb_set(result,'{items}',coalesce((SELECT jsonb_agg(x.value ORDER BY x.ordinality) FROM jsonb_array_elements(result->'items') WITH ORDINALITY x WHERE x.ordinality<=_limit),'[]'));
END $$;

CREATE FUNCTION public.review_community_report(_id uuid,_expected_revision integer,_status text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE r public.community_reports;BEGIN
 SELECT * INTO r FROM public.community_reports WHERE id=_id;
 PERFORM id FROM public.servers WHERE id=r.server_id FOR NO KEY UPDATE;
 SELECT * INTO r FROM public.community_reports WHERE id=_id FOR UPDATE;
 IF r.scope='platform' THEN PERFORM security_private.require_platform_safety();END IF;
 IF r.id IS NULL OR (CASE WHEN r.scope='platform' THEN NOT public.has_platform_safety_access() ELSE NOT public.can_moderate_community(r.server_id,'reports') OR (r.kind IN ('message','event') AND (r.channel_id IS NULL OR NOT public.has_channel_permission(r.channel_id,auth.uid(),'view_channel'))) END) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF r.reporter_id=auth.uid() OR r.kind='member' AND r.target_id=auth.uid() OR r.scope='platform' AND public.is_server_owner(r.server_id,auth.uid()) THEN RAISE EXCEPTION 'moderation_independent_review_required' USING ERRCODE='42501';END IF;
 IF _expected_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001';END IF;
 IF _status IS NULL OR _status NOT IN ('resolved','dismissed') OR _reason IS NULL OR char_length(trim(_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'moderation_invalid_decision' USING ERRCODE='22023';END IF;
 IF r.status=_status THEN RETURN;END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001';END IF;
 PERFORM security_private.consume_write_budget('moderation_reviews',60,30);
 UPDATE public.community_reports SET status=_status,reviewed_by=auth.uid(),revision=revision+1,updated_at=clock_timestamp() WHERE id=_id;
 INSERT INTO public.community_moderation_decisions(id,server_id,scope,entity_id,actor_id,action,reason) VALUES(gen_random_uuid(),r.server_id,r.scope,r.id,auth.uid(),'report_'||_status,trim(_reason));
 IF r.scope='community' THEN PERFORM public.write_audit(r.server_id,'community_report_reviewed','report',r.id,NULL,jsonb_build_object('status',_status));END IF;
END $$;

CREATE FUNCTION security_private.moderation_target(_server_id uuid,_target uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$DECLARE actor_rank integer;target_rank integer;BEGIN
 IF _target IS NULL OR _target=auth.uid() OR public.is_server_owner(_server_id,_target) OR NOT public.is_server_member(_server_id,_target) THEN RAISE EXCEPTION 'moderation_protected_target' USING ERRCODE='42501';END IF;
 IF public.is_server_owner(_server_id,auth.uid()) THEN RETURN;END IF;
 SELECT coalesce(max(r.position),0) INTO actor_rank FROM public.server_members m JOIN public.member_roles mr ON mr.member_id=m.id JOIN public.roles r ON r.id=mr.role_id WHERE m.server_id=_server_id AND m.user_id=auth.uid();
 SELECT coalesce(max(r.position),0) INTO target_rank FROM public.server_members m JOIN public.member_roles mr ON mr.member_id=m.id JOIN public.roles r ON r.id=mr.role_id WHERE m.server_id=_server_id AND m.user_id=_target;
 IF target_rank>=actor_rank OR EXISTS(SELECT FROM public.server_members m JOIN public.member_roles mr ON mr.member_id=m.id JOIN public.community_moderator_roles g ON g.role_id=mr.role_id WHERE m.server_id=_server_id AND m.user_id=_target AND cardinality(g.capabilities)>0) THEN RAISE EXCEPTION 'moderation_protected_target' USING ERRCODE='42501';END IF;
END $$;
REVOKE ALL ON FUNCTION security_private.moderation_target(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.moderate_community_member(_action_id uuid,_server_id uuid,_target uuid,_action text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE prev public.community_moderation_decisions;BEGIN
 PERFORM id FROM public.servers WHERE id=_server_id FOR UPDATE;
 IF _action IS NULL OR _action NOT IN ('warn','kick','ban') OR _action_id IS NULL OR _reason IS NULL OR char_length(trim(_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'moderation_invalid_action' USING ERRCODE='22023';END IF;
 IF NOT public.can_moderate_community(_server_id,CASE WHEN _action='warn' THEN 'warnings' ELSE 'members' END) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO prev FROM public.community_moderation_decisions WHERE id=_action_id;
 IF prev.id IS NOT NULL THEN IF prev.server_id=_server_id AND prev.entity_id=_target AND prev.actor_id=auth.uid() AND prev.action=_action AND prev.reason=trim(_reason) THEN RETURN;END IF;RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001';END IF;
 PERFORM security_private.moderation_target(_server_id,_target);
 IF _action='warn' AND EXISTS(SELECT FROM public.community_warnings WHERE server_id=_server_id AND target_user_id=_target AND author_id=auth.uid() AND reason=trim(_reason) AND status='active' AND created_at>clock_timestamp()-interval '1 day') THEN RETURN;END IF;
 PERFORM security_private.consume_write_budget('moderation_sanctions',60,10);
 IF _action='warn' THEN INSERT INTO public.community_warnings(id,server_id,target_user_id,author_id,reason) VALUES(_action_id,_server_id,_target,auth.uid(),trim(_reason));
 ELSIF _action='ban' THEN INSERT INTO public.server_bans(server_id,user_id,banned_by,reason) VALUES(_server_id,_target,auth.uid(),trim(_reason)) ON CONFLICT(server_id,user_id) DO NOTHING;
 ELSE DELETE FROM public.server_members WHERE server_id=_server_id AND user_id=_target;END IF;
 INSERT INTO public.community_moderation_decisions(id,server_id,scope,entity_id,actor_id,action,reason) VALUES(_action_id,_server_id,'community',_target,auth.uid(),_action,trim(_reason));
 PERFORM public.write_audit(_server_id,'community_member_'||_action,'user',_target,NULL,'{}');
END $$;
CREATE FUNCTION public.review_community_warning(_id uuid,_expected_revision integer,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE w public.community_warnings;BEGIN
 SELECT * INTO w FROM public.community_warnings WHERE id=_id;
 PERFORM id FROM public.servers WHERE id=w.server_id FOR UPDATE;
 SELECT * INTO w FROM public.community_warnings WHERE id=_id FOR UPDATE;
 IF w.id IS NULL OR NOT public.can_moderate_community(w.server_id,'warnings') THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF w.reason_until<=now() THEN RAISE EXCEPTION 'moderation_target_unavailable' USING ERRCODE='42501';END IF;
 IF w.author_id=auth.uid() OR w.target_user_id=auth.uid() THEN RAISE EXCEPTION 'moderation_independent_review_required' USING ERRCODE='42501';END IF;
 IF w.revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001';END IF;
 IF _reason IS NULL OR char_length(trim(_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'moderation_invalid_decision' USING ERRCODE='22023';END IF;
 IF w.status='revoked' THEN RETURN;END IF;
 PERFORM security_private.consume_write_budget('moderation_warning_review',60,20);
 UPDATE public.community_warnings SET status='revoked',revision=revision+1 WHERE id=_id;
 INSERT INTO public.community_moderation_decisions VALUES(gen_random_uuid(),w.server_id,'community',w.id,auth.uid(),'warning_revoked',trim(_reason),now()+interval '90 days',now());
 PERFORM public.write_audit(w.server_id,'community_warning_revoked','warning',w.id,NULL,'{}');
END $$;
CREATE FUNCTION public.list_community_moderation_history(_server_id uuid DEFAULT NULL,_mode text DEFAULT 'history',_before_time timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE result jsonb;BEGIN
 IF _mode IS NULL OR _mode NOT IN ('history','warnings','mine') OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 30 OR ((_before_time IS NULL)<>(_before_id IS NULL)) THEN RAISE EXCEPTION 'moderation_invalid_filter' USING ERRCODE='22023';END IF;
 IF auth.uid() IS NULL OR (_mode<>'mine' AND CASE WHEN _server_id IS NULL THEN NOT public.has_platform_safety_access() ELSE NOT public.can_moderate_community(_server_id,CASE WHEN _mode='warnings' THEN 'warnings' ELSE 'history' END) END) THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 PERFORM security_private.consume_write_budget('moderation_history',60,90);
 IF _mode IN ('warnings','mine') THEN
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',w.id,'target_user_id',CASE WHEN w.reason_until>now() THEN w.target_user_id ELSE NULL END,'actor_id',CASE WHEN w.reason_until>now() THEN w.author_id ELSE NULL END,'reason',CASE WHEN w.reason_until>now() THEN w.reason ELSE NULL END,'status',w.status,'revision',w.revision,'created_at',w.created_at,'decisions',coalesce((SELECT jsonb_agg(jsonb_build_object('action',d.action,'actor_id',CASE WHEN d.reason_until>now() THEN d.actor_id ELSE NULL END,'reason',CASE WHEN d.reason_until>now() THEN d.reason ELSE NULL END,'created_at',d.created_at) ORDER BY d.created_at) FROM public.community_moderation_decisions d WHERE d.entity_id=w.id AND d.scope='community'),'[]')) ORDER BY w.created_at DESC,w.id DESC),'[]'),'has_more',count(*)>_limit) INTO result FROM(SELECT * FROM public.community_warnings WHERE server_id=_server_id AND (_mode<>'mine' OR target_user_id=auth.uid()) AND (_before_time IS NULL OR (created_at,id)<(_before_time,_before_id)) ORDER BY created_at DESC,id DESC LIMIT _limit+1) w;
 ELSE
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',d.id,'entity_id',CASE WHEN d.reason_until>now() THEN d.entity_id ELSE '00000000-0000-0000-0000-000000000000'::uuid END,'actor_id',CASE WHEN d.reason_until>now() THEN d.actor_id ELSE NULL END,'action',d.action,'reason',CASE WHEN d.reason_until>now() THEN d.reason ELSE NULL END,'created_at',d.created_at) ORDER BY d.created_at DESC,d.id DESC),'[]'),'has_more',count(*)>_limit) INTO result FROM(SELECT * FROM public.community_moderation_decisions WHERE CASE WHEN _server_id IS NULL THEN scope='platform' ELSE scope='community' AND server_id=_server_id END AND (_before_time IS NULL OR (created_at,id)<(_before_time,_before_id)) ORDER BY created_at DESC,id DESC LIMIT _limit+1) d;END IF;
 RETURN jsonb_set(result,'{items}',coalesce((SELECT jsonb_agg(x.value ORDER BY x.ordinality) FROM jsonb_array_elements(result->'items') WITH ORDINALITY x WHERE x.ordinality<=_limit),'[]'));
END $$;

CREATE FUNCTION public.get_platform_directory_review(_server_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d public.community_directory;BEGIN
 IF NOT public.has_platform_safety_access() THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 PERFORM security_private.consume_write_budget('platform_directory_read',60,60);
 SELECT * INTO d FROM public.community_directory WHERE server_id=_server_id AND published_at IS NOT NULL;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('server_id',d.server_id,'revision',d.revision,'status',d.status,'featured',d.featured_at IS NOT NULL,'presentation',CASE WHEN d.status='listed' OR d.public_snapshot_until>now() THEN d.last_public_presentation ELSE NULL END);
END $$;
CREATE FUNCTION public.moderate_platform_directory(_server_id uuid,_expected_revision integer,_action text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d public.community_directory;BEGIN
 PERFORM id FROM public.servers WHERE id=_server_id FOR UPDATE;
 SELECT * INTO d FROM public.community_directory WHERE server_id=_server_id FOR UPDATE;
 PERFORM security_private.require_platform_safety();
 IF NOT public.has_platform_safety_access() THEN RAISE EXCEPTION 'moderation_not_authorized' USING ERRCODE='42501';END IF;
 IF public.is_server_owner(_server_id,auth.uid()) THEN RAISE EXCEPTION 'moderation_independent_review_required' USING ERRCODE='42501';END IF;
 IF d.server_id IS NULL OR d.published_at IS NULL THEN RAISE EXCEPTION 'moderation_target_unavailable' USING ERRCODE='42501';END IF;
 IF d.revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'moderation_conflict' USING ERRCODE='40001';END IF;
 IF _action IS NULL OR _action NOT IN ('suspend','restore','remove_feature') OR _reason IS NULL OR char_length(trim(_reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'moderation_invalid_decision' USING ERRCODE='22023';END IF;
 IF _action='restore' AND d.suspended_by=auth.uid() THEN RAISE EXCEPTION 'moderation_independent_review_required' USING ERRCODE='42501';END IF;
 IF _action='suspend' AND d.status='suspended' OR _action='restore' AND d.status<>'suspended' OR _action='remove_feature' AND d.featured_at IS NULL THEN RETURN;END IF;
 PERFORM security_private.consume_write_budget('platform_directory_actions',60,20);
 UPDATE public.community_directory SET status=CASE WHEN _action='suspend' THEN 'suspended' WHEN _action='restore' THEN 'unlisted' ELSE status END,suspended_by=CASE WHEN _action='suspend' THEN auth.uid() WHEN _action='restore' THEN NULL ELSE suspended_by END,featured_at=NULL,revision=revision+1,updated_at=clock_timestamp() WHERE server_id=_server_id;
 INSERT INTO public.community_moderation_decisions VALUES(gen_random_uuid(),_server_id,'platform',_server_id,auth.uid(),'directory_'||_action,trim(_reason),now()+interval '90 days',now());
END $$;

CREATE INDEX community_spam_author_time ON public.messages(author_id,created_at DESC);
CREATE FUNCTION security_private.community_spam_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE s uuid;cfg public.community_security_settings;n integer;host text;domain text;BEGIN
 IF TG_OP='UPDATE' AND NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.mentions IS NOT DISTINCT FROM OLD.mentions THEN RETURN NEW;END IF;
 SELECT c.server_id INTO s FROM public.channels c WHERE c.id=NEW.channel_id;
 SELECT f.* INTO cfg FROM public.community_security_settings f JOIN public.server_community_settings c USING(server_id) WHERE f.server_id=s AND f.enabled AND c.enabled;
 IF cfg.server_id IS NULL THEN RETURN NEW;END IF;
 -- Same author/server serialization prevents concurrent inserts from racing the counters.
 PERFORM pg_advisory_xact_lock(hashtextextended('community-spam:'||s::text||':'||NEW.author_id::text,0));
 IF TG_OP='UPDATE' THEN PERFORM security_private.consume_write_budget('community_message_edits:'||s::text,10,cfg.burst_limit);END IF;
 SELECT count(*) INTO n FROM public.messages m JOIN public.channels c ON c.id=m.channel_id WHERE m.author_id=NEW.author_id AND c.server_id=s AND m.id<>NEW.id AND m.created_at>=clock_timestamp()-interval '10 seconds';
 IF n>=cfg.burst_limit THEN RAISE EXCEPTION 'community_spam_rate' USING ERRCODE='P0001';END IF;
 IF length(trim(NEW.content))>0 THEN SELECT count(*) INTO n FROM public.messages m JOIN public.channels c ON c.id=m.channel_id WHERE m.author_id=NEW.author_id AND c.server_id=s AND m.id<>NEW.id AND m.created_at>=clock_timestamp()-interval '60 seconds' AND lower(regexp_replace(trim(m.content),'\s+',' ','g'))=lower(regexp_replace(trim(NEW.content),'\s+',' ','g'));
 IF n>=cfg.repeat_limit THEN RAISE EXCEPTION 'community_spam_repeat' USING ERRCODE='P0001';END IF;END IF;
 SELECT count(*) INTO n FROM regexp_matches(NEW.content,'@[[:alnum:]_]+','g');
 IF greatest(n,cardinality(NEW.mentions))>cfg.mentions_limit THEN RAISE EXCEPTION 'community_spam_mentions' USING ERRCODE='P0001';END IF;
 FOR host IN SELECT lower(regexp_replace(regexp_replace(m[1],'^.*@',''),':[0-9]+$','')) FROM regexp_matches(NEW.content,'https?://([^/[:space:]?#]+)','gi') m LOOP
 host:=rtrim(host,'.');FOREACH domain IN ARRAY cfg.blocked_domains LOOP IF host=domain OR right(host,length(domain)+1)='.'||domain THEN RAISE EXCEPTION 'community_spam_link' USING ERRCODE='P0001';END IF;END LOOP;END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.community_spam_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER community_spam_guard BEFORE INSERT OR UPDATE OF content,mentions ON public.messages FOR EACH ROW EXECUTE FUNCTION security_private.community_spam_guard();

CREATE FUNCTION public.prune_community_moderation_data(_limit integer DEFAULT 100) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE n integer:=0;k integer;BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'moderation_invalid_limit' USING ERRCODE='22023';END IF;
 WITH rows AS(SELECT id FROM public.community_reports WHERE evidence IS NOT NULL AND evidence_until<=now() OR private_until<=now() AND (description IS NOT NULL OR reporter_id IS NOT NULL OR reviewed_by IS NOT NULL OR channel_id IS NOT NULL OR target_id<>'00000000-0000-0000-0000-000000000000') ORDER BY created_at LIMIT _limit FOR UPDATE SKIP LOCKED) UPDATE public.community_reports r SET evidence=CASE WHEN evidence_until<=now() THEN NULL ELSE evidence END,description=CASE WHEN private_until<=now() THEN NULL ELSE description END,reporter_id=CASE WHEN private_until<=now() THEN NULL ELSE reporter_id END,reviewed_by=CASE WHEN private_until<=now() THEN NULL ELSE reviewed_by END,channel_id=CASE WHEN private_until<=now() THEN NULL ELSE channel_id END,target_id=CASE WHEN private_until<=now() THEN '00000000-0000-0000-0000-000000000000'::uuid ELSE target_id END,status=CASE WHEN private_until<=now() AND status='pending' THEN 'dismissed' ELSE status END FROM rows WHERE r.id=rows.id;GET DIAGNOSTICS k=ROW_COUNT;n:=n+k;
 WITH rows AS(SELECT id FROM public.community_warnings WHERE reason_until<=now() AND (reason<>'' OR target_user_id IS NOT NULL OR author_id IS NOT NULL) LIMIT _limit FOR UPDATE SKIP LOCKED) UPDATE public.community_warnings w SET reason='',target_user_id=NULL,author_id=NULL FROM rows WHERE w.id=rows.id;GET DIAGNOSTICS k=ROW_COUNT;n:=n+k;
 WITH rows AS(SELECT id FROM public.community_moderation_decisions WHERE reason_until<=now() AND (reason IS NOT NULL OR actor_id IS NOT NULL OR entity_id<>'00000000-0000-0000-0000-000000000000') LIMIT _limit FOR UPDATE SKIP LOCKED) UPDATE public.community_moderation_decisions d SET reason=NULL,actor_id=NULL,entity_id='00000000-0000-0000-0000-000000000000' FROM rows WHERE d.id=rows.id;GET DIAGNOSTICS k=ROW_COUNT;n:=n+k;
 WITH rows AS(SELECT server_id FROM public.community_directory WHERE status<>'listed' AND public_snapshot_until<=now() AND last_public_presentation IS NOT NULL LIMIT _limit FOR UPDATE SKIP LOCKED) UPDATE public.community_directory d SET last_public_presentation=NULL FROM rows WHERE d.server_id=rows.server_id;GET DIAGNOSTICS k=ROW_COUNT;n:=n+k;
 WITH rows AS(SELECT id FROM security_private.platform_safety_identity_audit WHERE created_at<=now()-interval '90 days' AND user_id IS NOT NULL LIMIT _limit FOR UPDATE SKIP LOCKED) UPDATE security_private.platform_safety_identity_audit a SET user_id=NULL FROM rows WHERE a.id=rows.id;GET DIAGNOSTICS k=ROW_COUNT;RETURN n+k;
END $$;
REVOKE ALL ON FUNCTION public.prune_community_moderation_data(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_community_moderation_data(integer) TO service_role;
DO $$DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=ANY(ARRAY['has_platform_safety_access','can_moderate_community','community_moderation_access','set_community_moderator_role','get_community_security','save_community_security','submit_community_report','list_community_reports','review_community_report','moderate_community_member','review_community_warning','list_community_moderation_history','get_platform_directory_review','moderate_platform_directory']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);END LOOP;END $$;
COMMIT;
