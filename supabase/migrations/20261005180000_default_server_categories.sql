BEGIN;

-- The former fixed headings become ordinary rows. Preserve existing custom
-- categories and assigned channels; migrate only the old unassigned groups.
DO $$
DECLARE
  server_row record;
  text_category uuid;
  voice_category uuid;
  next_position integer;
BEGIN
  FOR server_row IN SELECT id FROM public.servers LOOP
    SELECT id INTO text_category FROM public.server_categories
      WHERE server_id=server_row.id AND lower(name)='canais de texto'
      ORDER BY position, created_at, id LIMIT 1;
    SELECT id INTO voice_category FROM public.server_categories
      WHERE server_id=server_row.id AND lower(name)='canais de voz'
      ORDER BY position, created_at, id LIMIT 1;
    SELECT coalesce(max(position),-1)+1 INTO next_position
      FROM public.server_categories WHERE server_id=server_row.id;
    IF text_category IS NULL THEN
      INSERT INTO public.server_categories(server_id,name,position)
        VALUES(server_row.id,'Canais de texto',next_position) RETURNING id INTO text_category;
      next_position := next_position+1;
    END IF;
    IF voice_category IS NULL THEN
      INSERT INTO public.server_categories(server_id,name,position)
        VALUES(server_row.id,'Canais de voz',next_position) RETURNING id INTO voice_category;
    END IF;
    UPDATE public.channels SET category_id=CASE WHEN type='voice' THEN voice_category ELSE text_category END
      WHERE server_id=server_row.id AND category_id IS NULL;
  END LOOP;
END $$;

-- Seed once when a server is created. Renaming/deleting categories later never
-- recreates them, and they use exactly the existing category RLS policies.
CREATE FUNCTION public.seed_server_categories() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.server_categories(server_id,name,position) VALUES
    (NEW.id,'Canais de texto',0),(NEW.id,'Canais de voz',1);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_server_categories() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER servers_seed_categories AFTER INSERT ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.seed_server_categories();

CREATE OR REPLACE FUNCTION public.create_server(_name text, _description text DEFAULT NULL::text, _icon_url text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid UUID := auth.uid();
  new_server_id UUID;
  owner_role_id UUID;
  new_member_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trim(COALESCE(_name,''))) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  INSERT INTO public.servers (owner_id, name, description, icon_url)
  VALUES (uid, trim(_name), NULLIF(trim(COALESCE(_description,'')), ''), NULLIF(trim(COALESCE(_icon_url,'')), ''))
  RETURNING id INTO new_server_id;
  INSERT INTO public.roles (server_id, name, color, position, permissions) VALUES
    (new_server_id, 'OWNER', '#22d3ee', 100, '{"administrator":true,"manage_server":true,"manage_roles":true,"manage_channels":true,"manage_members":true,"create_invite":true,"kick_members":true,"ban_members":true,"manage_messages":true,"manage_voice":true,"view_audit_log":true,"send_messages":true,"read_messages":true}'::jsonb)
    RETURNING id INTO owner_role_id;
  INSERT INTO public.roles (server_id, name, color, position, permissions) VALUES
    (new_server_id, 'ADMIN', '#a78bfa', 50, '{"administrator":false,"manage_server":true,"manage_roles":true,"manage_channels":true,"manage_members":true,"create_invite":true,"kick_members":true,"ban_members":true,"manage_messages":true,"manage_voice":true,"view_audit_log":true,"send_messages":true,"read_messages":true}'::jsonb),
    (new_server_id, 'MEMBER', '#8b95a5', 1, '{"administrator":false,"manage_server":false,"manage_roles":false,"manage_channels":false,"manage_members":false,"create_invite":false,"send_messages":true,"read_messages":true}'::jsonb);
  INSERT INTO public.server_members (server_id, user_id) VALUES (new_server_id, uid) RETURNING id INTO new_member_id;
  INSERT INTO public.member_roles (member_id, role_id) VALUES (new_member_id, owner_role_id);
  INSERT INTO public.channels (server_id, name, type, description, position, category_id)
    SELECT new_server_id, 'geral', 'text', 'Canal principal do servidor', 0, id
    FROM public.server_categories WHERE server_id=new_server_id AND position=0;
  RETURN new_server_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
