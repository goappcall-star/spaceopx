BEGIN;
CREATE OR REPLACE FUNCTION public.notify_server_mentions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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

CREATE OR REPLACE FUNCTION public.get_server_unread_counts()
RETURNS TABLE(server_id uuid,channel_id uuid,unread_count bigint,mention_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 WITH actor AS MATERIALIZED (SELECT auth.uid() AS id),
 allowed AS MATERIALIZED (
 SELECT c.server_id,c.id,coalesce(rs.last_read_at,member.joined_at) AS since,actor.id AS actor_id
 FROM actor
 JOIN public.server_members member ON member.user_id=actor.id
 JOIN public.channels c ON c.server_id=member.server_id AND c.type='text'
 LEFT JOIN public.channel_read_states rs ON rs.channel_id=c.id AND rs.user_id=actor.id
 WHERE c.id IN (SELECT public.visible_message_channels())
 )
 SELECT c.server_id,c.id,counts.unread,counts.mentions
 FROM allowed c CROSS JOIN LATERAL (
 SELECT count(*) AS unread,count(*) FILTER(WHERE c.actor_id=ANY(m.mentions)) AS mentions
 FROM public.messages m
 WHERE m.channel_id=c.id AND m.created_at>c.since AND m.author_id<>c.actor_id
 OFFSET 0
 ) counts WHERE counts.unread>0
$$;

DROP TRIGGER message_everyone_mention ON public.messages;
DROP FUNCTION security_private.set_everyone_mention();
ALTER TABLE public.messages DROP COLUMN mentions_everyone;
COMMIT;
