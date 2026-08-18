
-- ============================================================ BLOCKS
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_select_own" ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());
CREATE POLICY "blocks_insert_own" ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "blocks_delete_own" ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

-- ============================================================ FRIENDSHIPS
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  user_low uuid GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)) STORED,
  user_high uuid GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_status_valid CHECK (status IN ('pending','accepted','declined','cancelled')),
  CONSTRAINT friendships_unique_pair UNIQUE (user_low, user_high)
);
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE TRIGGER friendships_set_updated_at BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND user_low = LEAST(_a, _b) AND user_high = GREATEST(_a, _b)
  )
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(_addressee uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _row public.friendships;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _me = _addressee THEN RAISE EXCEPTION 'cannot friend yourself'; END IF;
  IF public.is_blocked_between(_me, _addressee) THEN RAISE EXCEPTION 'blocked'; END IF;

  SELECT * INTO _row FROM public.friendships
   WHERE user_low = LEAST(_me,_addressee) AND user_high = GREATEST(_me,_addressee);

  IF _row.id IS NULL THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (_me, _addressee, 'pending') RETURNING id INTO _row.id;
    RETURN _row.id;
  END IF;

  IF _row.status = 'accepted' THEN RETURN _row.id; END IF;
  IF _row.status = 'pending' THEN
    IF _row.addressee_id = _me THEN
      UPDATE public.friendships SET status = 'accepted' WHERE id = _row.id;
    END IF;
    RETURN _row.id;
  END IF;

  UPDATE public.friendships
     SET status = 'pending', requester_id = _me, addressee_id = _addressee
   WHERE id = _row.id;
  RETURN _row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_friendship_id uuid, _action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _row public.friendships;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _row FROM public.friendships WHERE id = _friendship_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _me <> _row.requester_id AND _me <> _row.addressee_id THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _action = 'accept' THEN
    IF _row.status <> 'pending' OR _row.addressee_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE public.friendships SET status = 'accepted' WHERE id = _row.id;
  ELSIF _action = 'decline' THEN
    IF _row.status <> 'pending' OR _row.addressee_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE public.friendships SET status = 'declined' WHERE id = _row.id;
  ELSIF _action = 'cancel' THEN
    IF _row.status <> 'pending' OR _row.requester_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
    DELETE FROM public.friendships WHERE id = _row.id;
  ELSIF _action = 'remove' THEN
    IF _row.status <> 'accepted' THEN RAISE EXCEPTION 'forbidden'; END IF;
    DELETE FROM public.friendships WHERE id = _row.id;
  ELSE
    RAISE EXCEPTION 'invalid action';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_user(_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR _me = _target THEN RAISE EXCEPTION 'invalid'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (_me, _target)
    ON CONFLICT DO NOTHING;
  DELETE FROM public.friendships
   WHERE user_low = LEAST(_me,_target) AND user_high = GREATEST(_me,_target);
  RETURN true;
END;
$$;

-- ============================================================ CONVERSATIONS
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dm_low uuid,
  dm_high uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_type_valid CHECK (type IN ('direct','group'))
);
CREATE UNIQUE INDEX conversations_direct_pair_idx ON public.conversations (dm_low, dm_high)
  WHERE type = 'direct';

CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direct_messages_conversation_created_idx
  ON public.direct_messages (conversation_id, created_at DESC);

CREATE TABLE public.direct_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, UPDATE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.direct_message_reactions TO authenticated;
GRANT ALL ON public.conversations, public.conversation_members, public.direct_messages, public.direct_message_reactions TO service_role;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.dm_conversation_id(_message_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT conversation_id FROM public.direct_messages WHERE id = _message_id
$$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_member" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "conversations_update_owner" ON public.conversations FOR UPDATE TO authenticated
  USING (type = 'group' AND owner_id = auth.uid())
  WITH CHECK (type = 'group' AND owner_id = auth.uid());

CREATE POLICY "conv_members_select" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "conv_members_update_self" ON public.conversation_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "dm_select_member" ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "dm_insert_member" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_members cm
      JOIN public.conversations c ON c.id = cm.conversation_id
      WHERE cm.conversation_id = direct_messages.conversation_id
        AND c.type = 'direct'
        AND cm.user_id <> auth.uid()
        AND public.is_blocked_between(auth.uid(), cm.user_id)
    )
  );
CREATE POLICY "dm_update_own" ON public.direct_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE POLICY "dm_reactions_select" ON public.direct_message_reactions FOR SELECT TO authenticated
  USING (public.is_conversation_member(public.dm_conversation_id(message_id), auth.uid()));
CREATE POLICY "dm_reactions_insert_own" ON public.direct_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
    AND public.is_conversation_member(public.dm_conversation_id(message_id), auth.uid()));
CREATE POLICY "dm_reactions_delete_own" ON public.direct_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER direct_messages_set_updated_at BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER direct_messages_touch_conversation AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();

-- ============================================================ RPCs
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid; _low uuid; _high uuid;
BEGIN
  IF _me IS NULL OR _me = _other THEN RAISE EXCEPTION 'invalid'; END IF;
  IF public.is_blocked_between(_me, _other) THEN RAISE EXCEPTION 'blocked'; END IF;
  _low := LEAST(_me,_other); _high := GREATEST(_me,_other);

  SELECT id INTO _id FROM public.conversations
   WHERE type='direct' AND dm_low=_low AND dm_high=_high;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  INSERT INTO public.conversations (type, created_by, owner_id, dm_low, dm_high)
  VALUES ('direct', _me, NULL, _low, _high) RETURNING id INTO _id;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_id, _me), (_id, _other);
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_conversation(_name text, _member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid; _m uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'name required'; END IF;

  INSERT INTO public.conversations (type, name, created_by, owner_id)
  VALUES ('group', trim(_name), _me, _me) RETURNING id INTO _id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (_id, _me);

  FOREACH _m IN ARRAY coalesce(_member_ids, ARRAY[]::uuid[]) LOOP
    IF _m <> _me AND NOT public.is_blocked_between(_me, _m) AND public.are_friends(_me, _m) THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (_id, _m) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_group_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _c public.conversations;
BEGIN
  SELECT * INTO _c FROM public.conversations WHERE id = _conversation_id;
  IF _c.id IS NULL OR _c.type <> 'group' THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _c.owner_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.is_blocked_between(_me, _user_id) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF NOT public.are_friends(_me, _user_id) THEN RAISE EXCEPTION 'not a friend'; END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_conversation_id, _user_id) ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _c public.conversations;
BEGIN
  SELECT * INTO _c FROM public.conversations WHERE id = _conversation_id;
  IF _c.id IS NULL OR _c.type <> 'group' THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _c.owner_id <> _me OR _user_id = _me THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.conversation_members
   WHERE conversation_id = _conversation_id AND user_id = _user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_group_conversation(_conversation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _c public.conversations; _next uuid;
BEGIN
  SELECT * INTO _c FROM public.conversations WHERE id = _conversation_id;
  IF _c.id IS NULL OR _c.type <> 'group' THEN RAISE EXCEPTION 'invalid'; END IF;
  IF NOT public.is_conversation_member(_conversation_id, _me) THEN RAISE EXCEPTION 'forbidden'; END IF;

  DELETE FROM public.conversation_members
   WHERE conversation_id = _conversation_id AND user_id = _me;

  IF _c.owner_id = _me THEN
    SELECT user_id INTO _next FROM public.conversation_members
     WHERE conversation_id = _conversation_id ORDER BY joined_at LIMIT 1;
    IF _next IS NULL THEN
      DELETE FROM public.conversations WHERE id = _conversation_id;
    ELSE
      UPDATE public.conversations SET owner_id = _next WHERE id = _conversation_id;
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  UPDATE public.conversation_members SET last_read_at = now()
   WHERE conversation_id = _conversation_id AND user_id = _me;
  RETURN true;
END;
$$;

-- ============================================================ REALTIME
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.direct_message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
