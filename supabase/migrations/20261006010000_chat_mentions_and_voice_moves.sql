CREATE TABLE public.server_mention_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  author_name text NOT NULL, channel_name text NOT NULL, content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recipient_id,message_id)
);
ALTER TABLE public.server_mention_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.server_mention_notifications TO authenticated;
CREATE POLICY mention_recipient ON public.server_mention_notifications FOR SELECT TO authenticated
  USING (recipient_id=auth.uid() AND public.has_channel_permission(channel_id,auth.uid(),'view_channel'));
CREATE FUNCTION public.notify_server_mentions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.server_mention_notifications(recipient_id,message_id,channel_id,server_id,author_name,channel_name,content)
  SELECT DISTINCT p.id,NEW.id,c.id,c.server_id,a.display_name,c.name,left(NEW.content,240)
  FROM public.profiles p JOIN public.server_members sm ON sm.user_id=p.id
  JOIN public.channels c ON c.server_id=sm.server_id AND c.id=NEW.channel_id
  JOIN public.profiles a ON a.id=NEW.author_id
  WHERE p.id=ANY(NEW.mentions) AND p.id<>NEW.author_id
    AND lower(p.username) IN (SELECT lower(m[1]) FROM regexp_matches(NEW.content,'(?:^|[^a-zA-Z0-9_.@-])@([a-zA-Z0-9_.-]+)','g') AS m)
    AND public.has_channel_permission(c.id,p.id,'view_channel');
  RETURN NEW;
END $$;
CREATE TRIGGER message_mention_notification AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_server_mentions();
REVOKE ALL ON FUNCTION public.notify_server_mentions() FROM PUBLIC;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_mention_notifications;

CREATE TABLE public.voice_move_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  source_channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  destination_channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  voice_session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_move_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX voice_move_recipient_created ON public.voice_move_requests(recipient_id,created_at DESC);
GRANT SELECT ON public.voice_move_requests TO authenticated;
CREATE POLICY voice_move_recipient ON public.voice_move_requests FOR SELECT TO authenticated USING(recipient_id=auth.uid());
CREATE FUNCTION public.request_voice_move(_user_id uuid,_source uuid,_destination uuid,_session text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; result uuid;
BEGIN
  SELECT server_id INTO sid FROM public.channels WHERE id=_source AND type='voice';
  IF sid IS NULL OR auth.uid() IS NULL OR _source=_destination OR _session IS NULL OR length(_session) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_voice_move'; END IF;
  IF NOT (public.has_server_permission(sid,auth.uid(),'manage_voice') OR public.has_channel_permission(_source,auth.uid(),'move_members')) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.channels WHERE id=_destination AND server_id=sid AND type='voice')
    OR NOT EXISTS(SELECT 1 FROM public.server_members WHERE server_id=sid AND user_id=_user_id)
    OR NOT public.has_channel_permission(_destination,_user_id,'connect') THEN RAISE EXCEPTION 'invalid_destination'; END IF;
  DELETE FROM public.voice_move_requests WHERE created_at<now()-interval '1 day';
  INSERT INTO public.voice_move_requests(recipient_id,actor_id,server_id,source_channel_id,destination_channel_id,voice_session_id)
    VALUES(_user_id,auth.uid(),sid,_source,_destination,_session) RETURNING id INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.request_voice_move(uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_voice_move(uuid,uuid,uuid,text) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_move_requests;
NOTIFY pgrst,'reload schema';
