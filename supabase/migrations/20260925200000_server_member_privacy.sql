-- Personal preference, scoped to the authenticated member.
ALTER TABLE public.server_members ADD COLUMN IF NOT EXISTS allow_member_dms boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_server_dm_privacy(_server_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed boolean;
BEGIN
  SELECT allow_member_dms INTO allowed FROM public.server_members
    WHERE server_id = _server_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN allowed;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_server_dm_privacy(_server_id uuid, _allow boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.server_members SET allow_member_dms = _allow
    WHERE server_id = _server_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN _allow;
END;
$$;

-- A disabled preference on ANY shared server blocks non-friend DMs.
-- Enforce on message insertion as well as conversation creation, so existing
-- conversations cannot bypass a recipient's updated choice.
CREATE OR REPLACE FUNCTION public.enforce_server_dm_privacy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender uuid; recipient uuid; conversation_type text;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    IF NEW.type <> 'direct' THEN RETURN NEW; END IF;
    sender := NEW.created_by;
    recipient := CASE WHEN NEW.dm_low = sender THEN NEW.dm_high ELSE NEW.dm_low END;
  ELSE
    SELECT type, CASE WHEN dm_low = NEW.sender_id THEN dm_high ELSE dm_low END
      INTO conversation_type, recipient FROM public.conversations WHERE id = NEW.conversation_id;
    IF conversation_type <> 'direct' THEN RETURN NEW; END IF;
    sender := NEW.sender_id;
  END IF;
  IF NOT public.are_friends(sender, recipient) AND EXISTS (
    SELECT 1 FROM public.server_members receiver
    JOIN public.server_members author ON author.server_id = receiver.server_id
    WHERE receiver.user_id = recipient AND author.user_id = sender
      AND NOT receiver.allow_member_dms
  ) THEN
    RAISE EXCEPTION 'server_dm_privacy' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_server_privacy ON public.conversations;
CREATE TRIGGER conversations_server_privacy BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_server_dm_privacy();
DROP TRIGGER IF EXISTS messages_server_privacy ON public.direct_messages;
CREATE TRIGGER messages_server_privacy BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_server_dm_privacy();

REVOKE ALL ON FUNCTION public.get_server_dm_privacy(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_server_dm_privacy(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_server_dm_privacy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_server_dm_privacy(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_server_dm_privacy() FROM PUBLIC, anon, authenticated;
