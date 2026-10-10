BEGIN;
CREATE FUNCTION public.get_server_unread_counts()
RETURNS TABLE(server_id uuid,channel_id uuid,unread_count bigint,mention_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT c.server_id,c.id,count(m.id),count(m.id) FILTER(WHERE auth.uid()=ANY(m.mentions))
 FROM public.channels c
 JOIN public.server_members member ON member.server_id=c.server_id AND member.user_id=auth.uid()
 LEFT JOIN public.channel_read_states rs ON rs.channel_id=c.id AND rs.user_id=auth.uid()
 JOIN public.messages m ON m.channel_id=c.id AND m.author_id<>auth.uid()
   AND m.created_at>coalesce(rs.last_read_at,member.joined_at)
 WHERE c.type='text' AND public.has_channel_permission(c.id,auth.uid(),'view_channel')
 GROUP BY c.server_id,c.id
$$;
CREATE FUNCTION public.mark_channel_read_through(_channel_id uuid,_message_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE stamp timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_channel_permission(_channel_id,auth.uid(),'view_channel') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF _message_id IS NULL THEN stamp:=statement_timestamp();
 ELSE SELECT created_at INTO stamp FROM public.messages WHERE id=_message_id AND channel_id=_channel_id;
   IF stamp IS NULL THEN RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.channel_read_states AS current(channel_id,user_id,last_read_message_id,last_read_at)
 VALUES(_channel_id,auth.uid(),_message_id,stamp)
 ON CONFLICT(channel_id,user_id) DO UPDATE SET
   last_read_message_id=CASE WHEN excluded.last_read_at>=current.last_read_at THEN excluded.last_read_message_id ELSE current.last_read_message_id END,
   last_read_at=greatest(current.last_read_at,excluded.last_read_at)
   WHERE excluded.last_read_at>current.last_read_at;
END $$;
CREATE FUNCTION public.mark_conversation_read_through(_conversation_id uuid,_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE stamp timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_conversation_member(_conversation_id,auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT created_at INTO stamp FROM public.direct_messages WHERE id=_message_id AND conversation_id=_conversation_id AND deleted_at IS NULL;
 IF stamp IS NULL THEN RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023'; END IF;
 UPDATE public.conversation_members SET last_read_at=greatest(last_read_at,stamp)
 WHERE conversation_id=_conversation_id AND user_id=auth.uid() AND last_read_at<stamp;
END $$;
REVOKE ALL ON FUNCTION public.get_server_unread_counts(),public.mark_channel_read_through(uuid,uuid),public.mark_conversation_read_through(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_server_unread_counts(),public.mark_channel_read_through(uuid,uuid),public.mark_conversation_read_through(uuid,uuid) TO authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS(
  SELECT FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='channel_read_states'
 ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_read_states; END IF;
END $$;
COMMIT;
