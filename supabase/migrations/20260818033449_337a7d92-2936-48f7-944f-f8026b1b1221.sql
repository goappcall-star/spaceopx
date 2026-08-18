
CREATE OR REPLACE FUNCTION public.shares_conversation_with(_other uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members a
    JOIN public.conversation_members b ON b.conversation_id = a.conversation_id
    WHERE a.user_id = _user_id AND b.user_id = _other
  )
$$;

CREATE OR REPLACE FUNCTION public.has_friendship_link(_other uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_low = LEAST(_other,_user_id) AND user_high = GREATEST(_other,_user_id)
      AND status IN ('pending','accepted')
  )
$$;

DROP POLICY "profiles_select_self_or_shared_server" ON public.profiles;
CREATE POLICY "profiles_select_visible" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.shares_server_with(id, auth.uid())
    OR public.has_friendship_link(id, auth.uid())
    OR public.shares_conversation_with(id, auth.uid())
  );

DROP POLICY "ugp_select" ON public.user_game_presence;
CREATE POLICY "ugp_select" ON public.user_game_presence FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.shares_server_with(user_id, auth.uid())
    OR public.has_friendship_link(user_id, auth.uid())
    OR public.shares_conversation_with(user_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.search_profiles(_q text)
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.status
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND length(coalesce(trim(_q), '')) >= 2
    AND (p.username ILIKE '%' || trim(_q) || '%' OR p.display_name ILIKE '%' || trim(_q) || '%')
    AND NOT public.is_blocked_between(auth.uid(), p.id)
  ORDER BY p.username
  LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.list_conversation_overviews()
RETURNS TABLE (
  id uuid,
  type text,
  name text,
  avatar_url text,
  owner_id uuid,
  updated_at timestamptz,
  last_read_at timestamptz,
  other_user_id uuid,
  member_count bigint,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender uuid,
  unread_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT c.*, cm.last_read_at
    FROM public.conversations c
    JOIN public.conversation_members cm
      ON cm.conversation_id = c.id AND cm.user_id = auth.uid()
    WHERE auth.uid() IS NOT NULL
  )
  SELECT
    m.id, m.type, m.name, m.avatar_url, m.owner_id, m.updated_at, m.last_read_at,
    (SELECT cm2.user_id FROM public.conversation_members cm2
      WHERE cm2.conversation_id = m.id AND cm2.user_id <> auth.uid() LIMIT 1) AS other_user_id,
    (SELECT count(*) FROM public.conversation_members cm3 WHERE cm3.conversation_id = m.id) AS member_count,
    lm.content, lm.created_at, lm.sender_id,
    (SELECT count(*) FROM public.direct_messages d
      WHERE d.conversation_id = m.id AND d.sender_id <> auth.uid()
        AND d.deleted_at IS NULL AND d.created_at > m.last_read_at) AS unread_count
  FROM mine m
  LEFT JOIN LATERAL (
    SELECT d.content, d.created_at, d.sender_id
    FROM public.direct_messages d
    WHERE d.conversation_id = m.id AND d.deleted_at IS NULL
    ORDER BY d.created_at DESC LIMIT 1
  ) lm ON true
  ORDER BY coalesce(lm.created_at, m.updated_at) DESC
$$;

REVOKE EXECUTE ON FUNCTION
  public.is_blocked_between(uuid, uuid),
  public.are_friends(uuid, uuid),
  public.has_friendship_link(uuid, uuid),
  public.shares_conversation_with(uuid, uuid),
  public.is_conversation_member(uuid, uuid),
  public.dm_conversation_id(uuid),
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, text),
  public.block_user(uuid),
  public.get_or_create_direct_conversation(uuid),
  public.create_group_conversation(text, uuid[]),
  public.add_group_member(uuid, uuid),
  public.remove_group_member(uuid, uuid),
  public.leave_group_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.search_profiles(text),
  public.list_conversation_overviews()
FROM anon, public;

GRANT EXECUTE ON FUNCTION
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, text),
  public.block_user(uuid),
  public.get_or_create_direct_conversation(uuid),
  public.create_group_conversation(text, uuid[]),
  public.add_group_member(uuid, uuid),
  public.remove_group_member(uuid, uuid),
  public.leave_group_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.search_profiles(text),
  public.list_conversation_overviews()
TO authenticated;
