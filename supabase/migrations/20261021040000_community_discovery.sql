-- Phase 3B. Local only. Public content is an explicit owner-approved snapshot.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.community_directory (
 server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'unlisted' CHECK(status IN ('unlisted','listed','suspended')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 name text NOT NULL, description text NOT NULL, icon_url text, banner_url text,
 category text NOT NULL CHECK(category IN ('gaming','technology','creative','education','social','other')),
 language text NOT NULL DEFAULT '', interests text[] NOT NULL DEFAULT '{}',
 public_rules text[] NOT NULL DEFAULT '{}',
 admission text NOT NULL DEFAULT 'approval' CHECK(admission IN ('direct','approval')),
 published_at timestamptz, featured_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_directory_recent ON public.community_directory(published_at DESC,server_id DESC) WHERE status='listed';
CREATE INDEX community_directory_category ON public.community_directory(category,language,published_at DESC,server_id DESC) WHERE status='listed';
CREATE INDEX community_directory_search ON public.community_directory USING gin(to_tsvector('simple',name||' '||description));
CREATE INDEX community_directory_interests ON public.community_directory USING gin(interests);
CREATE TABLE public.community_join_requests (
 server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('pending','approved','rejected','withdrawn')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 PRIMARY KEY(server_id,user_id)
);
CREATE INDEX community_join_requests_pending ON public.community_join_requests(server_id,created_at,user_id) WHERE status='pending';
ALTER TABLE public.community_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;
-- RPC-only: callers cannot bypass rate limits/projection with arbitrary REST selects.
REVOKE ALL ON public.community_directory, public.community_join_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.community_directory,public.community_join_requests TO service_role;

CREATE FUNCTION public.community_is_discoverable(_server_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT FROM public.community_directory d JOIN public.server_community_settings c USING(server_id)
 JOIN public.servers s ON s.id=d.server_id WHERE d.server_id=_server_id AND d.status='listed' AND c.enabled
 AND d.published_by=s.owner_id AND NOT public.is_server_banned(s.id,s.owner_id));
$$;
REVOKE ALL ON FUNCTION public.community_is_discoverable(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_is_discoverable(uuid) TO authenticated;
CREATE POLICY directory_public_read ON public.community_directory FOR SELECT TO authenticated USING(public.community_is_discoverable(server_id));
CREATE POLICY directory_request_read ON public.community_join_requests FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.can_manage_community(server_id));

CREATE FUNCTION security_private.directory_projection(d public.community_directory) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('server_id',d.server_id,'name',d.name,'description',d.description,
 'icon_url',d.icon_url,'banner_url',d.banner_url,'category',d.category,'language',d.language,
 'interests',d.interests,'public_rules',d.public_rules,'admission',d.admission,
 'published_at',d.published_at,'featured',d.featured_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION security_private.directory_projection(public.community_directory) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.search_community_directory(_search text DEFAULT '',_category text DEFAULT '',_language text DEFAULT '',_interest text DEFAULT '',_before_time timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 12,_featured boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE rows jsonb; more boolean; search_query tsquery;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'directory_auth_required' USING ERRCODE='42501'; END IF;
 IF _search IS NULL OR char_length(_search)>100 OR _category IS NULL OR char_length(_category)>20 OR _language IS NULL OR char_length(_language)>35 OR _interest IS NULL OR char_length(_interest)>40 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 30 OR _featured IS NULL
 OR ((_before_time IS NULL)<>(_before_id IS NULL)) OR (_before_time IS NOT NULL AND NOT isfinite(_before_time)) THEN RAISE EXCEPTION 'directory_invalid_filter' USING ERRCODE='22023'; END IF;
 PERFORM security_private.consume_write_budget('directory_search',60,120);
 SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) INTO search_query FROM unnest(tsvector_to_array(to_tsvector('simple',_search))) term;
 WITH candidates AS (
 SELECT d.* FROM public.community_directory d WHERE d.status='listed' AND public.community_is_discoverable(d.server_id)
 AND (_search='' OR to_tsvector('simple',d.name||' '||d.description) @@ search_query)
 AND (_category='' OR d.category=_category) AND (_language='' OR d.language=lower(_language))
 AND (_interest='' OR d.interests @> ARRAY[lower(_interest)]) AND (NOT _featured OR d.featured_at IS NOT NULL)
 AND (_before_time IS NULL OR (d.published_at,d.server_id)<(_before_time,_before_id))
 ORDER BY d.published_at DESC,d.server_id DESC LIMIT _limit+1
 ), numbered AS (SELECT c.*,row_number() OVER(ORDER BY published_at DESC,server_id DESC) n FROM candidates c)
 SELECT coalesce(jsonb_agg(security_private.directory_projection(d) ORDER BY d.published_at DESC,d.server_id DESC) FILTER(WHERE n<=_limit),'[]'),coalesce(bool_or(n>_limit),false)
 INTO rows,more FROM numbered n JOIN public.community_directory d ON d.server_id=n.server_id;
 RETURN jsonb_build_object('items',rows,'has_more',more);
END $$;

CREATE FUNCTION public.get_public_community(_server_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.community_directory; req public.community_join_requests;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'directory_auth_required' USING ERRCODE='42501'; END IF;
 PERFORM security_private.consume_write_budget('directory_detail',60,120);
 SELECT * INTO d FROM public.community_directory WHERE server_id=_server_id AND public.community_is_discoverable(_server_id);
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO req FROM public.community_join_requests WHERE server_id=_server_id AND user_id=auth.uid();
 RETURN security_private.directory_projection(d)||jsonb_build_object('revision',d.revision,
 'my_membership',public.is_server_member(_server_id,auth.uid()),'can_join',NOT public.is_server_banned(_server_id,auth.uid()),
 'my_request',CASE WHEN req.server_id IS NULL THEN NULL ELSE jsonb_build_object('status',req.status,'revision',req.revision) END);
END $$;

CREATE FUNCTION public.get_community_discovery_settings(_server_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.community_directory;
BEGIN
 IF NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'directory_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.community_directory WHERE server_id=_server_id;
 RETURN jsonb_build_object('is_owner',public.is_server_owner(_server_id,auth.uid()),'listing',CASE WHEN d.server_id IS NULL THEN NULL ELSE security_private.directory_projection(d)||jsonb_build_object('status',d.status,'revision',d.revision) END);
END $$;

CREATE FUNCTION public.save_community_discovery(_server_id uuid,_payload jsonb,_expected_revision integer,_publish boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.community_directory; cfg public.server_community_settings; k text; a text; next_status text;
BEGIN
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF NOT public.is_server_owner(_server_id,auth.uid()) OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'directory_owner_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.server_community_settings WHERE server_id=_server_id;
 IF NOT coalesce(cfg.enabled,false) THEN RAISE EXCEPTION 'directory_inactive' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.community_directory WHERE server_id=_server_id FOR UPDATE;
 IF _expected_revision IS NULL OR _expected_revision<>coalesce(d.revision,0) THEN RAISE EXCEPTION 'directory_revision_conflict' USING ERRCODE='40001'; END IF;
 IF _publish IS NULL OR jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(_payload))<>10
 OR NOT (_payload ?& ARRAY['name','description','icon_url','banner_url','category','language','interests','public_rules','admission','consent']) THEN RAISE EXCEPTION 'directory_invalid_payload' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['name','description','category','language','admission'] LOOP
 IF jsonb_typeof(_payload->k) IS DISTINCT FROM 'string' OR (_payload->>k) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN RAISE EXCEPTION 'directory_invalid_text' USING ERRCODE='22023'; END IF; END LOOP;
 IF char_length(trim(_payload->>'name')) NOT BETWEEN 2 AND 100 OR char_length(trim(_payload->>'description')) NOT BETWEEN 20 AND 3000
 OR _payload->>'category' NOT IN ('gaming','technology','creative','education','social','other')
 OR (_payload->>'language') !~ '^([a-z]{2,3}(-[a-z0-9]{2,8})*)?$' OR char_length(_payload->>'language')>35
 OR _payload->>'admission' NOT IN ('direct','approval') OR jsonb_typeof(_payload->'consent') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'directory_invalid_text' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['icon_url','banner_url'] LOOP
 IF _payload->k<>'null'::jsonb AND (jsonb_typeof(_payload->k) IS DISTINCT FROM 'string' OR char_length(_payload->>k)>2048 OR (_payload->>k)!~ '^https://[^/@[:space:]]+([/:?#]|$)' OR (_payload->>k)~'^https://[^/]*@' OR (_payload->>k)~'[\x01-\x1F\x7F[:space:]]') THEN RAISE EXCEPTION 'directory_invalid_image' USING ERRCODE='22023'; END IF; END LOOP;
 FOREACH k IN ARRAY ARRAY['interests','public_rules'] LOOP
 IF jsonb_typeof(_payload->k) IS DISTINCT FROM 'array' OR jsonb_array_length(_payload->k)>10 THEN RAISE EXCEPTION 'directory_invalid_array' USING ERRCODE='22023'; END IF;
 FOR a IN SELECT value::text FROM jsonb_array_elements(_payload->k) LOOP
 IF jsonb_typeof(a::jsonb)<>'string' THEN RAISE EXCEPTION 'directory_invalid_array' USING ERRCODE='22023'; END IF; END LOOP;
 FOR a IN SELECT value FROM jsonb_array_elements_text(_payload->k) LOOP
 IF char_length(trim(a)) NOT BETWEEN 1 AND (CASE WHEN k='interests' THEN 40 ELSE 500 END) OR a~'[\x01-\x1F\x7F]' THEN RAISE EXCEPTION 'directory_invalid_array' USING ERRCODE='22023'; END IF; END LOOP; END LOOP;
 IF _publish AND (NOT (_payload->>'consent')::boolean OR jsonb_array_length(_payload->'public_rules')=0) THEN RAISE EXCEPTION 'directory_eligibility_required' USING ERRCODE='22023'; END IF;
 IF _publish AND d.status='suspended' THEN RAISE EXCEPTION 'directory_suspended' USING ERRCODE='42501'; END IF;
 PERFORM security_private.consume_write_budget('directory_save',60,10);
 next_status:=CASE WHEN d.status='suspended' THEN 'suspended' WHEN _publish THEN 'listed' ELSE 'unlisted' END;
 INSERT INTO public.community_directory(server_id,status,revision,published_by,name,description,icon_url,banner_url,category,language,interests,public_rules,admission,published_at)
 VALUES(_server_id,next_status,1,auth.uid(),trim(_payload->>'name'),trim(_payload->>'description'),_payload->>'icon_url',_payload->>'banner_url',_payload->>'category',_payload->>'language',ARRAY(SELECT DISTINCT lower(trim(value)) FROM jsonb_array_elements_text(_payload->'interests')),ARRAY(SELECT trim(value) FROM jsonb_array_elements_text(_payload->'public_rules')),_payload->>'admission',CASE WHEN _publish THEN clock_timestamp() ELSE NULL END)
 ON CONFLICT(server_id) DO UPDATE SET status=next_status,revision=community_directory.revision+1,published_by=auth.uid(),name=excluded.name,description=excluded.description,icon_url=excluded.icon_url,banner_url=excluded.banner_url,category=excluded.category,language=excluded.language,interests=excluded.interests,public_rules=excluded.public_rules,admission=excluded.admission,published_at=coalesce(community_directory.published_at,excluded.published_at),updated_at=clock_timestamp();
 PERFORM public.write_audit(_server_id,CASE WHEN _publish THEN 'community_directory_published' ELSE 'community_directory_unlisted' END,'server',_server_id,NULL,'{}');
 RETURN public.get_community_discovery_settings(_server_id);
END $$;

-- Shared existing MEMBER/membership model; no parallel identity or privileged role selection.
CREATE FUNCTION security_private.directory_admit(_server_id uuid,_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid; r public.roles;
BEGIN
 IF public.is_server_banned(_server_id,_user_id) THEN RAISE EXCEPTION 'directory_join_unavailable' USING ERRCODE='42501'; END IF;
 IF public.is_server_member(_server_id,_user_id) THEN RETURN; END IF;
 SELECT * INTO r FROM public.roles WHERE server_id=_server_id AND name='MEMBER' FOR SHARE;
 IF r.id IS NULL OR r.is_owner OR EXISTS(SELECT FROM jsonb_each(r.permissions) p WHERE p.value NOT IN ('false'::jsonb,'null'::jsonb) AND p.key NOT IN ('view_channel','read_messages','send_messages','connect','speak','use_voice_activity','stream','add_reactions','attach_files','embed_links','use_external_emojis')) THEN RAISE EXCEPTION 'directory_unsafe_default_role' USING ERRCODE='42501'; END IF;
 INSERT INTO public.server_members(server_id,user_id,joined_at) VALUES(_server_id,_user_id,clock_timestamp()) ON CONFLICT(server_id,user_id) DO NOTHING RETURNING id INTO m;
 IF m IS NOT NULL THEN INSERT INTO public.member_roles(member_id,role_id) VALUES(m,r.id) ON CONFLICT DO NOTHING; END IF;
END $$;
REVOKE ALL ON FUNCTION security_private.directory_admit(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.join_discovered_community(_server_id uuid,_expected_revision integer,_withdraw boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.community_directory; req public.community_join_requests;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'directory_auth_required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF NOT public.community_is_discoverable(_server_id) OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'directory_join_unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.community_directory WHERE server_id=_server_id FOR UPDATE;
 IF _expected_revision IS NULL OR _expected_revision<>d.revision THEN RAISE EXCEPTION 'directory_revision_conflict' USING ERRCODE='40001'; END IF;
 PERFORM security_private.consume_write_budget('directory_join',60,10);
 IF public.is_server_member(_server_id,auth.uid()) THEN RETURN jsonb_build_object('status','member','server_id',_server_id); END IF;
 SELECT * INTO req FROM public.community_join_requests WHERE server_id=_server_id AND user_id=auth.uid() FOR UPDATE;
 IF _withdraw IS TRUE THEN
 IF req.status='pending' THEN UPDATE public.community_join_requests SET status='withdrawn',revision=revision+1,updated_at=clock_timestamp() WHERE server_id=_server_id AND user_id=auth.uid(); END IF;
 RETURN jsonb_build_object('status','withdrawn','server_id',_server_id); END IF;
 IF _withdraw IS NULL THEN RAISE EXCEPTION 'directory_invalid_request' USING ERRCODE='22023'; END IF;
 IF d.admission='direct' THEN
 PERFORM security_private.directory_admit(_server_id,auth.uid());
 UPDATE public.community_join_requests SET status='approved',revision=revision+1,updated_at=clock_timestamp() WHERE server_id=_server_id AND user_id=auth.uid() AND status='pending';
 PERFORM public.write_audit(_server_id,'community_directory_joined','user',auth.uid(),NULL,'{}');
 RETURN jsonb_build_object('status','member','server_id',_server_id); END IF;
 IF req.status='pending' THEN RETURN jsonb_build_object('status','pending','server_id',_server_id); END IF;
 IF req.updated_at>clock_timestamp()-interval '1 day' THEN RAISE EXCEPTION 'directory_request_cooldown' USING ERRCODE='22023'; END IF;
 INSERT INTO public.community_join_requests(server_id,user_id,status) VALUES(_server_id,auth.uid(),'pending')
 ON CONFLICT(server_id,user_id) DO UPDATE SET status='pending',revision=community_join_requests.revision+1,created_at=clock_timestamp(),updated_at=clock_timestamp(),reviewed_by=NULL;
 RETURN jsonb_build_object('status','pending','server_id',_server_id);
END $$;

CREATE FUNCTION public.list_community_join_requests(_server_id uuid,_after_time timestamptz DEFAULT NULL,_after_id uuid DEFAULT NULL,_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE rows jsonb; more boolean;
BEGIN
 IF NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'directory_not_authorized' USING ERRCODE='42501'; END IF;
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 30 OR ((_after_time IS NULL)<>(_after_id IS NULL)) THEN RAISE EXCEPTION 'directory_invalid_filter' USING ERRCODE='22023'; END IF;
 PERFORM security_private.consume_write_budget('directory_requests_read',60,60);
 WITH q AS (SELECT r.user_id,r.revision,r.created_at,p.display_name,p.avatar_url FROM public.community_join_requests r JOIN public.profiles p ON p.id=r.user_id WHERE r.server_id=_server_id AND r.status='pending' AND (_after_time IS NULL OR (r.created_at,r.user_id)>(_after_time,_after_id)) ORDER BY r.created_at,r.user_id LIMIT _limit+1), n AS(SELECT *,row_number() OVER(ORDER BY created_at,user_id) num FROM q)
 SELECT coalesce(jsonb_agg(to_jsonb(n)-'num' ORDER BY created_at,user_id) FILTER(WHERE num<=_limit),'[]'),coalesce(bool_or(num>_limit),false) INTO rows,more FROM n;
 RETURN jsonb_build_object('items',rows,'has_more',more);
END $$;
CREATE FUNCTION public.review_community_join_request(_server_id uuid,_user_id uuid,_expected_revision integer,_approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE req public.community_join_requests;
BEGIN
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'directory_not_authorized' USING ERRCODE='42501'; END IF;
 IF NOT public.community_is_discoverable(_server_id) OR _approve IS NULL THEN RAISE EXCEPTION 'directory_join_unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO req FROM public.community_join_requests WHERE server_id=_server_id AND user_id=_user_id FOR UPDATE;
 IF req.server_id IS NULL OR _expected_revision IS DISTINCT FROM req.revision THEN RAISE EXCEPTION 'directory_revision_conflict' USING ERRCODE='40001'; END IF;
 IF req.status=(CASE WHEN _approve THEN 'approved' ELSE 'rejected' END) THEN RETURN; END IF;
 IF req.status<>'pending' THEN RAISE EXCEPTION 'directory_revision_conflict' USING ERRCODE='40001'; END IF;
 PERFORM security_private.consume_write_budget('directory_review',60,30);
 IF _approve THEN PERFORM security_private.directory_admit(_server_id,_user_id); END IF;
 UPDATE public.community_join_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,revision=revision+1,reviewed_by=auth.uid(),updated_at=clock_timestamp() WHERE server_id=_server_id AND user_id=_user_id;
 PERFORM public.write_audit(_server_id,CASE WHEN _approve THEN 'community_request_approved' ELSE 'community_request_rejected' END,'user',_user_id,NULL,'{}');
END $$;

-- Serialize only relevant bans against directory admission. Existing bans/actions stay intact.
CREATE FUNCTION security_private.directory_ban_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT FROM public.community_directory WHERE server_id=NEW.server_id) THEN PERFORM id FROM public.servers WHERE id=NEW.server_id FOR NO KEY UPDATE; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.directory_ban_lock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER directory_ban_lock BEFORE INSERT ON public.server_bans FOR EACH ROW EXECUTE FUNCTION security_private.directory_ban_lock();
-- Disabling also withdraws consent: reactivation alone never republishes.
CREATE FUNCTION security_private.directory_disable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.enabled AND NOT NEW.enabled THEN UPDATE public.community_directory SET status=CASE WHEN status='suspended' THEN status ELSE 'unlisted' END,revision=revision+1,updated_at=clock_timestamp() WHERE server_id=NEW.server_id; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.directory_disable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER directory_disable AFTER UPDATE OF enabled ON public.server_community_settings FOR EACH ROW EXECUTE FUNCTION security_private.directory_disable();
REVOKE ALL ON FUNCTION public.search_community_directory(text,text,text,text,timestamptz,uuid,integer,boolean),public.get_public_community(uuid),public.get_community_discovery_settings(uuid),public.save_community_discovery(uuid,jsonb,integer,boolean),public.join_discovered_community(uuid,integer,boolean),public.list_community_join_requests(uuid,timestamptz,uuid,integer),public.review_community_join_request(uuid,uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_community_directory(text,text,text,text,timestamptz,uuid,integer,boolean),public.get_public_community(uuid),public.get_community_discovery_settings(uuid),public.save_community_discovery(uuid,jsonb,integer,boolean),public.join_discovered_community(uuid,integer,boolean),public.list_community_join_requests(uuid,timestamptz,uuid,integer),public.review_community_join_request(uuid,uuid,integer,boolean) TO authenticated;
COMMIT;
