BEGIN;
-- The SELECT rule is unchanged: only channels visible to the authenticated actor.
-- Compute the allowed set once per statement instead of once per message row.
-- No caller-supplied user id; fixed search_path and no anonymous execution.
CREATE FUNCTION public.visible_message_channels()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.id FROM public.channels c
 JOIN public.server_members member ON member.server_id=c.server_id
 WHERE member.user_id=(SELECT auth.uid())
 AND public.has_channel_permission(c.id,(SELECT auth.uid()),'view_channel')
$$;
REVOKE ALL ON FUNCTION public.visible_message_channels() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.visible_message_channels() TO authenticated;
ALTER POLICY messages_select_members ON public.messages
 USING (channel_id IN (SELECT public.visible_message_channels()));

-- Keep the RPC SECURITY INVOKER: message RLS is still enforced by PostgreSQL.
-- A parameterized channel/time range excludes read history before aggregation.
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
COMMIT;
