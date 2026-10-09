-- Apply to staging first. This migration does not contain keys or modify voice presence.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
-- Reassert the original XP privilege boundary after schema imports/default grants.
-- Message/server triggers still invoke this internally as their trusted owner.
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer) FROM PUBLIC, anon, authenticated;
CREATE SCHEMA IF NOT EXISTS security_private;
REVOKE ALL ON SCHEMA security_private FROM PUBLIC, anon, authenticated;
CREATE TABLE security_private.write_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_seconds integer NOT NULL,
  window_start bigint NOT NULL,
  requests integer NOT NULL CHECK (requests > 0),
  PRIMARY KEY (user_id, action, window_seconds, window_start)
);
ALTER TABLE security_private.write_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_private.write_windows FROM PUBLIC, anon, authenticated;

CREATE FUNCTION security_private.consume_write_budget(action_name text, seconds integer, maximum integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := auth.uid(); bucket bigint; used integer;
BEGIN
  -- Trusted maintenance without a user JWT is not a browser action.
  IF actor IS NULL THEN RETURN; END IF;
  bucket := floor(extract(epoch FROM clock_timestamp()) / seconds)::bigint;
  -- Keep at most the current and previous window per user/action/interval.
  DELETE FROM security_private.write_windows WHERE user_id=actor AND action=action_name
    AND window_seconds=seconds AND window_start < bucket-1;
  INSERT INTO security_private.write_windows AS w VALUES (actor,action_name,seconds,bucket,1)
    ON CONFLICT (user_id,action,window_seconds,window_start)
    DO UPDATE SET requests=w.requests+1 RETURNING requests INTO used;
  IF used > maximum THEN
    RAISE EXCEPTION 'Muitos envios. Aguarde alguns instantes e tente novamente.' USING ERRCODE='P0001';
  END IF;
END $$;
REVOKE ALL ON FUNCTION security_private.consume_write_budget(text,integer,integer) FROM PUBLIC, anon, authenticated;

-- RLS controls rows; this guard also prevents replacing the row's identity.
-- Upserts may include immutable columns when their values do not change.
CREATE FUNCTION security_private.guard_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE column_name text;
BEGIN
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW)->column_name) IS DISTINCT FROM (to_jsonb(OLD)->column_name) THEN
      RAISE EXCEPTION 'Não é permitido alterar a identidade deste registro.' USING ERRCODE='42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER security_identity BEFORE UPDATE ON public.server_members
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','server_id','user_id','joined_at','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','channel_id','author_id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','conversation_id','sender_id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','conversation_id','user_id','joined_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','owner_id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','server_id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','server_id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.server_categories
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','server_id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','created_at');
CREATE TRIGGER security_identity BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_identity('id','type','dm_low','dm_high','created_at');

-- A departed participant must not edit messages in a conversation they cannot see.
DROP POLICY messages_update_own ON public.messages;
CREATE POLICY messages_update_own ON public.messages FOR UPDATE TO authenticated
  USING (author_id=auth.uid() AND public.has_channel_permission(channel_id,auth.uid(),'view_channel') AND public.has_channel_permission(channel_id,auth.uid(),'send_messages'))
  WITH CHECK (author_id=auth.uid() AND public.has_channel_permission(channel_id,auth.uid(),'view_channel') AND public.has_channel_permission(channel_id,auth.uid(),'send_messages'));
DROP POLICY dm_update_own ON public.direct_messages;
CREATE POLICY dm_update_own ON public.direct_messages FOR UPDATE TO authenticated
  USING (sender_id=auth.uid() AND public.is_conversation_member(conversation_id,auth.uid()))
  WITH CHECK (sender_id=auth.uid() AND public.is_conversation_member(conversation_id,auth.uid()));

CREATE FUNCTION security_private.validate_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE row_data jsonb := to_jsonb(NEW); previous jsonb := '{}'::jsonb;
  column_name text; value text; maximum integer; item jsonb; container_id uuid; reply_container uuid;
BEGIN
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  -- Only validate changed fields, preserving unrelated edits to legacy records.
  FOREACH column_name IN ARRAY ARRAY['name','display_name','nickname','bio','custom_status','description','content','emoji','avatar_url','banner_url','icon_url','color'] LOOP
    IF NOT (row_data ? column_name) OR (TG_OP='UPDATE' AND row_data->column_name IS NOT DISTINCT FROM previous->column_name) THEN CONTINUE; END IF;
    value := row_data->>column_name;
    IF value IS NULL THEN CONTINUE; END IF;
    maximum := CASE column_name WHEN 'content' THEN 4000 WHEN 'bio' THEN 1000 WHEN 'description' THEN 1000
      WHEN 'custom_status' THEN 128 WHEN 'emoji' THEN 32 WHEN 'nickname' THEN 60 WHEN 'display_name' THEN 60
      WHEN 'avatar_url' THEN 8192 WHEN 'banner_url' THEN 8192 WHEN 'icon_url' THEN 8192 WHEN 'color' THEN 7 ELSE 80 END;
    IF char_length(value)>maximum OR value ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN
      RAISE EXCEPTION 'Campo inválido ou muito longo: %.',column_name USING ERRCODE='22023';
    END IF;
    IF column_name IN ('name','display_name','emoji') AND char_length(btrim(value))=0 THEN
      RAISE EXCEPTION 'Campo obrigatório: %.',column_name USING ERRCODE='22023';
    END IF;
    IF column_name IN ('avatar_url','banner_url','icon_url') AND value<>'' AND
      (value !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR value ~ '^https://[^/]*@' OR value ~ '[[:space:]]') THEN
      RAISE EXCEPTION 'A imagem precisa usar uma URL HTTPS sem credenciais.' USING ERRCODE='22023';
    END IF;
    IF column_name='color' AND value !~ '^#[0-9a-fA-F]{6}$' THEN
      RAISE EXCEPTION 'Cor inválida.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF TG_TABLE_NAME='roles' AND (TG_OP='INSERT' OR row_data->'permissions' IS DISTINCT FROM previous->'permissions') AND
    (jsonb_typeof(row_data->'permissions')<>'object' OR octet_length((row_data->'permissions')::text)>16384) THEN
    RAISE EXCEPTION 'Permissões inválidas.' USING ERRCODE='22023';
  END IF;
  IF TG_TABLE_NAME='roles' AND (TG_OP='INSERT' OR row_data->'permissions' IS DISTINCT FROM previous->'permissions') THEN
    IF EXISTS(SELECT FROM jsonb_each(row_data->'permissions') AS permission_entries WHERE jsonb_typeof(permission_entries.value)<>'boolean') THEN
      RAISE EXCEPTION 'As permissões precisam ser booleanas.' USING ERRCODE='22023';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('messages','direct_messages') THEN
    IF TG_OP='INSERT' OR NEW.attachments IS DISTINCT FROM OLD.attachments THEN
      IF jsonb_typeof(NEW.attachments)<>'array' OR jsonb_array_length(NEW.attachments)>10 THEN
        RAISE EXCEPTION 'Use no máximo 10 anexos.' USING ERRCODE='22023';
      END IF;
      FOR item IN SELECT * FROM jsonb_array_elements(NEW.attachments) LOOP
        IF jsonb_typeof(item)<>'object' OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR
          jsonb_typeof(item->'path') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'size') IS DISTINCT FROM 'number' OR
          coalesce(item->>'kind','') NOT IN ('image','file') OR
          coalesce(item->>'mime','') NOT IN ('image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','application/zip','application/json') OR
          coalesce(item->>'size','') !~ '^[0-9]{1,8}$' OR char_length(coalesce(item->>'name','')) NOT BETWEEN 1 AND 255 OR
          char_length(coalesce(item->>'path','')) NOT BETWEEN 1 AND 512 OR item->>'path' ~ '(\.\.|[\\:])' OR item->>'path' LIKE '/%' THEN
          RAISE EXCEPTION 'Anexo inválido.' USING ERRCODE='22023';
        END IF;
        IF (item->>'size')::bigint NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Anexo muito grande.' USING ERRCODE='22023'; END IF;
      END LOOP;
    END IF;
    IF TG_OP='INSERT' OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id THEN
      IF NEW.reply_to_id IS NOT NULL THEN
        IF TG_TABLE_NAME='messages' THEN
          container_id:=(row_data->>'channel_id')::uuid;
          SELECT channel_id INTO reply_container FROM public.messages WHERE id=NEW.reply_to_id;
        ELSE
          container_id:=(row_data->>'conversation_id')::uuid;
          SELECT conversation_id INTO reply_container FROM public.direct_messages WHERE id=NEW.reply_to_id;
        END IF;
        IF reply_container IS DISTINCT FROM container_id THEN RAISE EXCEPTION 'A resposta precisa pertencer à mesma conversa.' USING ERRCODE='22023'; END IF;
      END IF;
    END IF;
    IF TG_TABLE_NAME='messages' THEN
      IF cardinality(NEW.mentions)>50 THEN RAISE EXCEPTION 'Use no máximo 50 menções.' USING ERRCODE='22023'; END IF;
      IF TG_OP='INSERT' OR row_data->'mentions' IS DISTINCT FROM previous->'mentions' THEN
        IF EXISTS(SELECT 1 FROM unnest(NEW.mentions) AS mentioned(id) WHERE NOT EXISTS(
          SELECT 1 FROM public.server_members sm JOIN public.channels c ON c.server_id=sm.server_id
          WHERE c.id=(row_data->>'channel_id')::uuid AND sm.user_id=mentioned.id)) THEN
          RAISE EXCEPTION 'Só é possível mencionar membros deste servidor.' USING ERRCODE='22023';
        END IF;
      END IF;
    END IF;
    -- Soft-deleted DMs intentionally contain no text or files.
    IF coalesce(row_data->>'deleted_at','')='' AND char_length(btrim(NEW.content))=0 AND jsonb_array_length(NEW.attachments)=0 THEN
      RAISE EXCEPTION 'Escreva uma mensagem ou adicione um anexo.' USING ERRCODE='22023';
    END IF;
    IF TG_OP='INSERT' THEN
      -- Shared across server/private chat, not one quota per room.
      PERFORM security_private.consume_write_budget('messages',10,10);
      PERFORM security_private.consume_write_budget('messages',60,60);
    ELSE PERFORM security_private.consume_write_budget('message_edits',60,120); END IF;
  ELSIF TG_TABLE_NAME IN ('message_reactions','direct_message_reactions') AND TG_OP='INSERT' THEN
    PERFORM security_private.consume_write_budget('reactions',60,120);
  ELSIF TG_TABLE_NAME='servers' AND TG_OP='INSERT' THEN
    PERFORM security_private.consume_write_budget('create_servers',3600,5);
  ELSIF TG_TABLE_NAME='server_invites' AND TG_OP='INSERT' THEN
    PERFORM security_private.consume_write_budget('create_invites',3600,30);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.validate_write() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','servers','channels','server_categories','server_members','roles','conversations','messages','direct_messages','message_reactions','direct_message_reactions','server_invites'] LOOP
    EXECUTE format('CREATE TRIGGER security_validate BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION security_private.validate_write()',table_name);
  END LOOP;
END $$;

-- Storage enforces these limits even when a caller bypasses file pickers.
UPDATE storage.buckets SET file_size_limit=4194304, allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp','image/gif'] WHERE id IN ('avatars','banners');
UPDATE storage.buckets SET file_size_limit=8388608, allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp','image/gif'] WHERE id='server-assets';
UPDATE storage.buckets SET file_size_limit=10485760, allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','application/zip','application/json'] WHERE id IN ('attachments','dm-attachments');
COMMIT;
