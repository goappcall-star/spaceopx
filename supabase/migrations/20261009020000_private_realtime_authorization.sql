-- Coordinate with the new WEB/Desktop clients before disabling public access.
-- Database-change delivery still uses each public table's existing RLS.
BEGIN;
CREATE FUNCTION public.can_use_realtime_topic(topic_name text, writing boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); identifier text; resource uuid; first_user uuid; second_user uuid; other_user uuid;
BEGIN
  IF actor IS NULL OR topic_name IS NULL OR length(topic_name)>1024 THEN RETURN false; END IF;
  IF topic_name IN ('presence:global','calls:presence') THEN RETURN true; END IF;
  IF topic_name LIKE 'calls:user:%' THEN
    resource:=substr(topic_name,12)::uuid;
    IF NOT writing THEN RETURN resource=actor; END IF;
    other_user:=resource;
  ELSIF topic_name LIKE 'callsig:%' OR topic_name LIKE 'rtc:call-%' THEN
    identifier:=CASE WHEN topic_name LIKE 'callsig:%' THEN substr(topic_name,9) ELSE substr(topic_name,10) END;
    IF identifier !~ '^[a-f0-9-]{36}-[a-f0-9-]{36}-[a-z0-9]{1,20}$' THEN RETURN false; END IF;
    first_user:=substr(identifier,1,36)::uuid; second_user:=substr(identifier,38,36)::uuid;
    IF actor NOT IN (first_user,second_user) THEN RETURN false; END IF;
    other_user:=CASE WHEN actor=first_user THEN second_user ELSE first_user END;
  END IF;
  IF other_user IS NOT NULL THEN
    IF other_user=actor THEN RETURN true; END IF;
    RETURN NOT public.is_blocked_between(actor,other_user) AND (
      public.are_friends(actor,other_user) OR (
        public.shares_server_with(other_user,actor) AND NOT EXISTS(
          SELECT 1 FROM public.server_members receiver JOIN public.server_members sender ON sender.server_id=receiver.server_id
          WHERE receiver.user_id=other_user AND sender.user_id=actor AND NOT receiver.allow_member_dms)));
  END IF;
  IF topic_name LIKE 'voice:%' THEN RETURN public.is_server_member(substr(topic_name,7)::uuid,actor); END IF;
  IF topic_name LIKE 'group-call:%' THEN RETURN public.is_conversation_member(substr(topic_name,12)::uuid,actor); END IF;
  IF topic_name LIKE 'rtc:group-call-%' THEN RETURN public.is_conversation_member(substr(topic_name,16)::uuid,actor); END IF;
  IF topic_name LIKE 'rtc:%' THEN RETURN public.has_channel_permission(substr(topic_name,5)::uuid,actor,'connect') AND public.has_channel_permission(substr(topic_name,5)::uuid,actor,'view_channel'); END IF;
  IF topic_name LIKE 'typing:%' THEN
    resource:=substr(topic_name,8)::uuid;
    RETURN public.is_conversation_member(resource,actor) OR public.has_channel_permission(resource,actor,CASE WHEN writing THEN 'send_messages' ELSE 'view_channel' END);
  END IF;
  -- These topics carry postgres_changes only. No client broadcast writes.
  IF writing THEN RETURN false; END IF;
  IF topic_name LIKE 'channel-messages:%' THEN RETURN public.has_channel_permission(substr(topic_name,18)::uuid,actor,'view_channel'); END IF;
  IF topic_name LIKE 'dm:%' THEN RETURN public.is_conversation_member(substr(topic_name,4)::uuid,actor); END IF;
  IF topic_name LIKE 'channel-structure:%' THEN RETURN public.is_server_member(split_part(topic_name,':',2)::uuid,actor); END IF;
  IF topic_name LIKE 'mentions:%' THEN RETURN substr(topic_name,10)::uuid=actor; END IF;
  IF topic_name LIKE 'voice-moves:%' THEN RETURN substr(topic_name,13)::uuid=actor; END IF;
  IF topic_name LIKE 'social:friendships:%' OR topic_name LIKE 'social:conversations:%' THEN RETURN split_part(topic_name,':',3)::uuid=actor; END IF;
  IF topic_name LIKE 'voice-restrictions:%' THEN RETURN split_part(topic_name,':',array_length(string_to_array(topic_name,':'),1))::uuid=actor; END IF;
  IF topic_name LIKE 'game-presence:%' THEN RETURN true; END IF;
  RETURN false;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.can_use_realtime_topic(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_use_realtime_topic(text,boolean) TO authenticated;

CREATE POLICY lobbyx_realtime_receive ON realtime.messages FOR SELECT TO authenticated
  USING (extension IN ('broadcast','presence') AND public.can_use_realtime_topic(realtime.topic(),false));
CREATE POLICY lobbyx_realtime_send ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (extension IN ('broadcast','presence') AND public.can_use_realtime_topic(realtime.topic(),true));
-- Existing permissive policies must not silently reopen other rooms.
CREATE POLICY lobbyx_realtime_receive_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_use_realtime_topic(realtime.topic(),false));
CREATE POLICY lobbyx_realtime_send_guard ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_use_realtime_topic(realtime.topic(),true));
COMMIT;
