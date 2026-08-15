-- Channel-aware permission resolution -------------------------------------
CREATE OR REPLACE FUNCTION public.has_channel_permission(_channel_id uuid, _user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.server_members sm ON sm.server_id = c.server_id AND sm.user_id = _user_id
    LEFT JOIN public.member_roles mr ON mr.member_id = sm.id
    LEFT JOIN public.roles r ON r.id = mr.role_id
    WHERE c.id = _channel_id
      AND (
        public.is_server_owner(c.server_id, _user_id)
        OR COALESCE((r.permissions->>'administrator')::boolean, false)
        OR COALESCE((r.permissions->>'manage_server')::boolean, false)
        OR COALESCE((r.permissions->>_perm)::boolean, false)
        -- baseline permissions every member has unless explicitly revoked
        OR (_perm IN ('view_channel','send_messages','connect','speak')
            AND COALESCE((r.permissions->>_perm)::boolean, true))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.channel_server_id(_channel_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT server_id FROM public.channels WHERE id = _channel_id $$;

CREATE OR REPLACE FUNCTION public.is_text_channel(_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.channels WHERE id = _channel_id AND type IN ('text','announcement')) $$;

-- Messages ------------------------------------------------------------------
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  mentions uuid[] NOT NULL DEFAULT '{}',
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_channel_created_idx ON public.messages (channel_id, created_at DESC);
CREATE INDEX messages_author_idx ON public.messages (author_id);
CREATE INDEX messages_reply_idx ON public.messages (reply_to_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_members ON public.messages
  FOR SELECT TO authenticated
  USING (public.has_channel_permission(channel_id, auth.uid(), 'view_channel'));

CREATE POLICY messages_insert_members ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_text_channel(channel_id)
    AND public.has_channel_permission(channel_id, auth.uid(), 'send_messages')
  );

CREATE POLICY messages_update_own ON public.messages
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY messages_delete_own_or_admin ON public.messages
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.can_manage_server(public.channel_server_id(channel_id), auth.uid())
  );

CREATE TRIGGER messages_set_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.message_channel_id(_message_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT channel_id FROM public.messages WHERE id = _message_id $$;

-- Reactions -----------------------------------------------------------------
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX message_reactions_message_idx ON public.message_reactions (message_id);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reactions_select_members ON public.message_reactions
  FOR SELECT TO authenticated
  USING (public.has_channel_permission(public.message_channel_id(message_id), auth.uid(), 'view_channel'));

CREATE POLICY reactions_insert_own ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_channel_permission(public.message_channel_id(message_id), auth.uid(), 'view_channel')
  );

CREATE POLICY reactions_delete_own ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Read states ---------------------------------------------------------------
CREATE TABLE public.channel_read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_read_states TO authenticated;
GRANT ALL ON public.channel_read_states TO service_role;

ALTER TABLE public.channel_read_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_states_all_own ON public.channel_read_states
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_channel_permission(channel_id, auth.uid(), 'view_channel')
  );

CREATE TRIGGER channel_read_states_set_updated_at
  BEFORE UPDATE ON public.channel_read_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime ------------------------------------------------------------------
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;