-- Community 3A: LOCAL ONLY. No directory, moderation, cron installation or voice changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.community_events (
 id uuid PRIMARY KEY, server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
 channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
 title text NOT NULL, description text NOT NULL DEFAULT '', cover_url text,
 starts_at timestamptz NOT NULL, ends_at timestamptz, timezone text NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR ends_at>starts_at)
);
CREATE INDEX community_events_page ON public.community_events(server_id,status,starts_at,id);
CREATE INDEX community_events_channel ON public.community_events(channel_id) WHERE channel_id IS NOT NULL;
CREATE TABLE public.community_event_rsvps (
 event_id uuid NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.server_members(id) ON DELETE CASCADE,
 response text NOT NULL CHECK(response IN ('interested','going','none')),
 notify boolean NOT NULL DEFAULT false,
 notified_revision integer NOT NULL DEFAULT 0, reminded_revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,member_id)
);
CREATE INDEX community_event_rsvp_counts ON public.community_event_rsvps(event_id,response);
CREATE INDEX community_event_rsvp_member ON public.community_event_rsvps(member_id,event_id);
CREATE INDEX community_event_rsvp_pending ON public.community_event_rsvps(event_id,notified_revision,reminded_revision,member_id) WHERE notify AND response<>'none';
CREATE TABLE public.community_event_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.server_members(id) ON DELETE CASCADE,
 revision integer NOT NULL, kind text NOT NULL CHECK(kind IN ('updated','cancelled','reminder')),
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE(event_id,member_id,revision,kind)
);
CREATE INDEX community_event_notification_inbox ON public.community_event_notifications(member_id,created_at DESC,id);
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_event_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_events,public.community_event_rsvps,public.community_event_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,server_id,channel_id,title,description,cover_url,starts_at,ends_at,timezone,status,revision,created_at,updated_at) ON public.community_events TO authenticated;
GRANT SELECT ON public.community_event_rsvps,public.community_event_notifications TO authenticated;

CREATE FUNCTION public.can_view_community_event(_event_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT FROM public.community_events e JOIN public.server_community_settings c ON c.server_id=e.server_id
 WHERE e.id=_event_id AND c.enabled AND auth.uid() IS NOT NULL AND public.is_server_member(e.server_id,auth.uid())
 AND NOT public.is_server_banned(e.server_id,auth.uid())
 AND ((e.channel_id IS NOT NULL AND public.has_channel_permission(e.channel_id,auth.uid(),'view_channel'))
 OR (e.channel_id IS NULL AND public.can_manage_community(e.server_id))));
$$;
REVOKE ALL ON FUNCTION public.can_view_community_event(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_community_event(uuid) TO authenticated;
CREATE POLICY community_events_read ON public.community_events FOR SELECT TO authenticated USING(public.can_view_community_event(id));
CREATE POLICY community_event_rsvp_self ON public.community_event_rsvps FOR SELECT TO authenticated
 USING(public.can_view_community_event(event_id) AND EXISTS(SELECT FROM public.server_members m WHERE m.id=member_id AND m.user_id=auth.uid()));
CREATE POLICY community_event_notification_self ON public.community_event_notifications FOR SELECT TO authenticated
 USING(public.can_view_community_event(event_id) AND EXISTS(SELECT FROM public.server_members m WHERE m.id=member_id AND m.user_id=auth.uid()));

CREATE FUNCTION security_private.community_event_projection(e public.community_events) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',e.id,'server_id',e.server_id,'channel_id',e.channel_id,'title',e.title,
 'description',e.description,'cover_url',e.cover_url,'starts_at',e.starts_at,'ends_at',e.ends_at,'timezone',e.timezone,
 'status',e.status,'revision',e.revision,'created_at',e.created_at,'updated_at',e.updated_at,
 'interested_count',(SELECT count(*) FROM public.community_event_rsvps r JOIN public.server_members m ON m.id=r.member_id
 WHERE r.event_id=e.id AND r.response='interested' AND NOT public.is_server_banned(e.server_id,m.user_id) AND public.has_channel_permission(e.channel_id,m.user_id,'view_channel')),
 'going_count',(SELECT count(*) FROM public.community_event_rsvps r JOIN public.server_members m ON m.id=r.member_id
 WHERE r.event_id=e.id AND r.response='going' AND NOT public.is_server_banned(e.server_id,m.user_id) AND public.has_channel_permission(e.channel_id,m.user_id,'view_channel')),
 'my_response',coalesce((SELECT r.response FROM public.community_event_rsvps r JOIN public.server_members m ON m.id=r.member_id WHERE r.event_id=e.id AND m.user_id=auth.uid()),'none'),
 'my_notify',coalesce((SELECT r.notify FROM public.community_event_rsvps r JOIN public.server_members m ON m.id=r.member_id WHERE r.event_id=e.id AND m.user_id=auth.uid()),false));
$$;
REVOKE ALL ON FUNCTION security_private.community_event_projection(public.community_events) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.list_community_events(_server_id uuid,_mode text DEFAULT 'upcoming',_after_start timestamptz DEFAULT NULL,_after_id uuid DEFAULT NULL,_limit integer DEFAULT 12)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE items jsonb; more boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_server_member(_server_id,auth.uid()) OR public.is_server_banned(_server_id,auth.uid()) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 IF _mode IS NULL OR _mode NOT IN ('upcoming','past','cancelled') OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 30 OR (_after_start IS NULL)<>(_after_id IS NULL) THEN RAISE EXCEPTION 'community_event_invalid_page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(security_private.community_event_projection(s)),'[]') INTO items FROM (
  SELECT e.* FROM public.community_events e WHERE e.server_id=_server_id AND public.can_view_community_event(e.id)
  AND CASE _mode WHEN 'cancelled' THEN e.status='cancelled' WHEN 'past' THEN e.status='scheduled' AND coalesce(e.ends_at,e.starts_at)<now() ELSE e.status='scheduled' AND coalesce(e.ends_at,e.starts_at)>=now() END
  AND (_after_id IS NULL OR CASE WHEN _mode='past' THEN (e.starts_at,e.id)<(_after_start,_after_id) ELSE (e.starts_at,e.id)>(_after_start,_after_id) END)
  ORDER BY CASE WHEN _mode='past' THEN e.starts_at END DESC, CASE WHEN _mode='past' THEN e.id END DESC,
   CASE WHEN _mode<>'past' THEN e.starts_at END,CASE WHEN _mode<>'past' THEN e.id END LIMIT _limit+1
 ) s;
 more:=jsonb_array_length(items)>_limit;
 IF more THEN items:=items-_limit; END IF;
 RETURN jsonb_build_object('items',items,'has_more',more,'can_manage',public.can_manage_community(_server_id) AND EXISTS(SELECT FROM public.server_community_settings WHERE server_id=_server_id AND enabled));
END $$;
REVOKE ALL ON FUNCTION public.list_community_events(uuid,text,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_community_events(uuid,text,timestamptz,uuid,integer) TO authenticated;

CREATE FUNCTION public.save_community_event(_server_id uuid,_event_id uuid,_payload jsonb,_expected_revision integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous public.community_events%ROWTYPE; saved public.community_events%ROWTYPE; cid uuid; st timestamptz; en timestamptz; exists_before boolean;
BEGIN
 IF NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.servers WHERE id=_server_id FOR NO KEY UPDATE;
 IF NOT public.can_manage_community(_server_id) OR NOT EXISTS(SELECT FROM public.server_community_settings WHERE server_id=_server_id AND enabled) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 IF _event_id IS NULL OR _payload IS NULL OR jsonb_typeof(_payload)<>'object' OR octet_length(_payload::text)>32768 OR (SELECT count(*) FROM jsonb_object_keys(_payload))<>7
 OR NOT (_payload ?& ARRAY['title','description','cover_url','channel_id','starts_at','ends_at','timezone']) THEN RAISE EXCEPTION 'community_event_invalid_payload' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(_payload->'title') IS DISTINCT FROM 'string' OR char_length(btrim(_payload->>'title')) NOT BETWEEN 1 AND 120
 OR jsonb_typeof(_payload->'description') IS DISTINCT FROM 'string' OR char_length(_payload->>'description')>4000
 OR ((_payload->>'title')||(_payload->>'description')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN RAISE EXCEPTION 'community_event_invalid_text' USING ERRCODE='22023'; END IF;
 IF _payload->'cover_url'<>'null'::jsonb AND (jsonb_typeof(_payload->'cover_url') IS DISTINCT FROM 'string' OR char_length(_payload->>'cover_url')>8192
 OR (_payload->>'cover_url') !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR (_payload->>'cover_url') ~ '^https://[^/]*@|[\x01-\x1F\x7F[:space:]]') THEN RAISE EXCEPTION 'community_event_invalid_cover' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(_payload->'timezone') IS DISTINCT FROM 'string' OR NOT EXISTS(SELECT FROM pg_timezone_names WHERE name=_payload->>'timezone') THEN RAISE EXCEPTION 'community_event_invalid_timezone' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(_payload->'channel_id') IS DISTINCT FROM 'string' OR jsonb_typeof(_payload->'starts_at') IS DISTINCT FROM 'string'
 OR (jsonb_typeof(_payload->'ends_at') NOT IN ('string','null')) OR (_payload->>'starts_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
 OR (_payload->'ends_at'<>'null'::jsonb AND (_payload->>'ends_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') THEN RAISE EXCEPTION 'community_event_invalid_time' USING ERRCODE='22023'; END IF;
 BEGIN cid:=(_payload->>'channel_id')::uuid; st:=(_payload->>'starts_at')::timestamptz; en:=(_payload->>'ends_at')::timestamptz;
 EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'community_event_invalid_time' USING ERRCODE='22023'; END;
 IF NOT isfinite(st) OR (en IS NOT NULL AND (NOT isfinite(en) OR en<=st)) THEN RAISE EXCEPTION 'community_event_invalid_time' USING ERRCODE='22023'; END IF;
 SELECT * INTO previous FROM public.community_events WHERE id=_event_id FOR UPDATE; exists_before:=FOUND;
 IF exists_before AND (previous.server_id<>_server_id OR NOT public.can_view_community_event(previous.id)) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 IF _expected_revision IS NULL OR (NOT exists_before AND _expected_revision<>0) OR (exists_before AND _expected_revision<>previous.revision AND NOT (_expected_revision=0 AND previous.revision=1)) THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 IF exists_before AND previous.status='cancelled' THEN RAISE EXCEPTION 'community_event_cancelled' USING ERRCODE='22023'; END IF;
 PERFORM id FROM public.channels WHERE id=cid AND server_id=_server_id AND type IN ('text','voice','announcement') FOR SHARE;
 IF NOT FOUND OR NOT public.has_channel_permission(cid,auth.uid(),'view_channel') THEN RAISE EXCEPTION 'community_invalid_channel' USING ERRCODE='22023'; END IF;
 IF st<=clock_timestamp() AND (NOT exists_before OR st IS DISTINCT FROM previous.starts_at) THEN RAISE EXCEPTION 'community_event_past_start' USING ERRCODE='22023'; END IF;
 PERFORM security_private.consume_write_budget('community_event_save',60,20);
 IF exists_before AND previous.title=btrim(_payload->>'title') AND previous.description=_payload->>'description' AND previous.cover_url IS NOT DISTINCT FROM _payload->>'cover_url'
 AND previous.channel_id=cid AND previous.starts_at=st AND previous.ends_at IS NOT DISTINCT FROM en AND previous.timezone=_payload->>'timezone' THEN RETURN security_private.community_event_projection(previous); END IF;
 IF exists_before AND _expected_revision=0 THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 IF NOT exists_before THEN
  INSERT INTO public.community_events(id,server_id,channel_id,title,description,cover_url,starts_at,ends_at,timezone,created_by,updated_by)
  VALUES(_event_id,_server_id,cid,btrim(_payload->>'title'),_payload->>'description',_payload->>'cover_url',st,en,_payload->>'timezone',auth.uid(),auth.uid())
  ON CONFLICT(id) DO NOTHING RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 ELSE
  UPDATE public.community_events SET channel_id=cid,title=btrim(_payload->>'title'),description=_payload->>'description',cover_url=_payload->>'cover_url',
   starts_at=st,ends_at=en,timezone=_payload->>'timezone',revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=_event_id RETURNING * INTO saved;
 END IF;
 PERFORM public.write_audit(_server_id,CASE WHEN exists_before THEN 'community_event_updated' ELSE 'community_event_created' END,'event',saved.id,saved.title,jsonb_build_object('revision',saved.revision));
 RETURN security_private.community_event_projection(saved);
END $$;
REVOKE ALL ON FUNCTION public.save_community_event(uuid,uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_community_event(uuid,uuid,jsonb,integer) TO authenticated;
CREATE FUNCTION public.cancel_community_event(_event_id uuid,_expected_revision integer) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e public.community_events%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.community_events WHERE id=_event_id;
 IF NOT FOUND OR NOT public.can_manage_community(e.server_id) OR NOT public.can_view_community_event(e.id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.servers WHERE id=e.server_id FOR NO KEY UPDATE;
 SELECT * INTO e FROM public.community_events WHERE id=_event_id FOR UPDATE;
 IF e.id IS NULL OR NOT public.can_manage_community(e.server_id) OR NOT public.can_view_community_event(e.id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 IF _expected_revision IS NULL OR _expected_revision<>e.revision THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 PERFORM security_private.consume_write_budget('community_event_cancel',60,10);
 IF e.status='cancelled' THEN RETURN; END IF;
 UPDATE public.community_events SET status='cancelled',revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=e.id;
 PERFORM public.write_audit(e.server_id,'community_event_cancelled','event',e.id,e.title,'{}');
END $$;
REVOKE ALL ON FUNCTION public.cancel_community_event(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_community_event(uuid,integer) TO authenticated;

CREATE FUNCTION public.respond_community_event(_event_id uuid,_expected_revision integer,_response text,_notify boolean) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e public.community_events%ROWTYPE; mid uuid;
BEGIN
 SELECT * INTO e FROM public.community_events WHERE id=_event_id;
 IF NOT FOUND OR NOT public.can_view_community_event(_event_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.servers WHERE id=e.server_id FOR NO KEY UPDATE;
 SELECT id INTO mid FROM public.server_members WHERE server_id=e.server_id AND user_id=auth.uid() FOR UPDATE;
 SELECT * INTO e FROM public.community_events WHERE id=_event_id FOR SHARE;
 IF mid IS NULL OR NOT public.can_view_community_event(_event_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 IF _expected_revision IS NULL OR _expected_revision<>e.revision THEN RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001'; END IF;
 IF e.status='cancelled' OR coalesce(e.ends_at,e.starts_at)<=clock_timestamp() THEN RAISE EXCEPTION 'community_event_closed' USING ERRCODE='22023'; END IF;
 IF _response IS NULL OR _response NOT IN ('interested','going','none') OR _notify IS NULL THEN RAISE EXCEPTION 'community_event_invalid_response' USING ERRCODE='22023'; END IF;
 PERFORM security_private.consume_write_budget('community_event_rsvp',60,30);
 INSERT INTO public.community_event_rsvps(event_id,member_id,response,notify,notified_revision) VALUES(e.id,mid,_response,_notify AND _response<>'none',e.revision)
 ON CONFLICT(event_id,member_id) DO UPDATE SET response=EXCLUDED.response,notify=EXCLUDED.notify,notified_revision=e.revision,updated_at=clock_timestamp();
END $$;
REVOKE ALL ON FUNCTION public.respond_community_event(uuid,integer,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_community_event(uuid,integer,text,boolean) TO authenticated;

-- Trusted worker only. Persistent rows are the schedule; no browser timer creates deliveries.
-- Run periodically in an explicitly configured scheduler later. No cron/job is installed here.
CREATE FUNCTION public.dispatch_community_event_notifications(_limit integer DEFAULT 100) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE item record; total integer:=0;
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'community_event_invalid_batch' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT r.event_id,r.member_id,e.revision,e.status,e.starts_at,r.notified_revision,r.reminded_revision
 FROM public.community_event_rsvps r JOIN public.community_events e ON e.id=r.event_id
 JOIN public.server_members m ON m.id=r.member_id AND m.server_id=e.server_id
 JOIN public.server_community_settings c ON c.server_id=e.server_id AND c.enabled
 WHERE r.notify AND r.response<>'none' AND NOT public.is_server_banned(e.server_id,m.user_id)
 AND e.channel_id IS NOT NULL AND public.has_channel_permission(e.channel_id,m.user_id,'view_channel')
 AND (r.notified_revision<e.revision OR (e.status='scheduled' AND r.reminded_revision<e.revision AND e.starts_at>clock_timestamp() AND e.starts_at<=clock_timestamp()+interval '15 minutes'))
 ORDER BY e.starts_at,e.id,r.member_id LIMIT _limit FOR UPDATE OF r SKIP LOCKED FOR SHARE OF e SKIP LOCKED
 LOOP
  IF item.notified_revision<item.revision THEN
   INSERT INTO public.community_event_notifications(event_id,member_id,revision,kind)
   VALUES(item.event_id,item.member_id,item.revision,CASE WHEN item.status='cancelled' THEN 'cancelled' ELSE 'updated' END) ON CONFLICT DO NOTHING;
  END IF;
  IF item.status='scheduled' AND item.reminded_revision<item.revision AND item.starts_at>clock_timestamp() AND item.starts_at<=clock_timestamp()+interval '15 minutes' THEN
   INSERT INTO public.community_event_notifications(event_id,member_id,revision,kind) VALUES(item.event_id,item.member_id,item.revision,'reminder') ON CONFLICT DO NOTHING;
   UPDATE public.community_event_rsvps SET reminded_revision=item.revision WHERE event_id=item.event_id AND member_id=item.member_id;
  END IF;
  UPDATE public.community_event_rsvps SET notified_revision=item.revision WHERE event_id=item.event_id AND member_id=item.member_id;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_community_event_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_community_event_notifications(integer) TO service_role;
CREATE FUNCTION public.list_my_community_event_notifications() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(s.item),'[]') FROM (SELECT jsonb_build_object('id',n.id,'event_id',e.id,'server_id',e.server_id,'title',e.title,'kind',n.kind,'created_at',n.created_at,'starts_at',e.starts_at) AS item
 FROM public.community_event_notifications n JOIN public.server_members m ON m.id=n.member_id
 JOIN public.community_events e ON e.id=n.event_id
 WHERE m.user_id=auth.uid() AND n.read_at IS NULL AND public.can_view_community_event(e.id)
 ORDER BY n.created_at DESC,n.id LIMIT 20) s;
$$;
REVOKE ALL ON FUNCTION public.list_my_community_event_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_community_event_notifications() TO authenticated;
CREATE FUNCTION public.read_community_event_notifications(_ids uuid[]) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF auth.uid() IS NULL OR _ids IS NULL OR cardinality(_ids)>20 THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
 PERFORM security_private.consume_write_budget('community_event_read',60,60);
 UPDATE public.community_event_notifications n SET read_at=clock_timestamp() FROM public.server_members m
 WHERE n.id=ANY(_ids) AND n.read_at IS NULL AND m.id=n.member_id AND m.user_id=auth.uid() AND public.can_view_community_event(n.event_id);
END $$;
REVOKE ALL ON FUNCTION public.read_community_event_notifications(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_community_event_notifications(uuid[]) TO authenticated;
COMMIT;
