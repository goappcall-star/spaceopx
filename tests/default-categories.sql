DO $$ BEGIN
  IF (SELECT count(*) FROM public.server_categories WHERE server_id='00000000-0000-0000-0000-000000000001')<>3 THEN RAISE EXCEPTION 'Default categories not migrated'; END IF;
  IF (SELECT count(*) FROM public.server_categories WHERE server_id='00000000-0000-0000-0000-000000000002')<>2 THEN RAISE EXCEPTION 'Existing named category duplicated'; END IF;
  IF (SELECT category_id FROM public.channels WHERE name='custom')<>'00000000-0000-0000-0000-000000000020' THEN RAISE EXCEPTION 'Custom channel moved'; END IF;
  IF EXISTS(SELECT 1 FROM public.channels c JOIN public.server_categories cat ON c.category_id=cat.id WHERE (c.name='texto' AND cat.name<>'Canais de texto') OR (c.name='voz' AND cat.name<>'Canais de voz')) THEN RAISE EXCEPTION 'Wrong default group'; END IF;
  IF EXISTS(SELECT 1 FROM public.channels WHERE category_id IS NULL) THEN RAISE EXCEPTION 'Unassigned old channels'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000010';
UPDATE public.server_categories SET name='Texto editado',position=4 WHERE server_id='00000000-0000-0000-0000-000000000001' AND name='Canais de texto';
UPDATE public.server_categories SET name='Voz editada',position=0 WHERE server_id='00000000-0000-0000-0000-000000000001' AND name='Canais de voz';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.server_categories WHERE name='Texto editado' AND position=4) OR NOT EXISTS(SELECT 1 FROM public.server_categories WHERE name='Voz editada' AND position=0) THEN RAISE EXCEPTION 'Manager cannot rename/reorder defaults'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
DO $$ BEGIN
  UPDATE public.server_categories SET name='Illegal';
  IF FOUND THEN RAISE EXCEPTION 'Member could edit defaults'; END IF;
END $$;
-- create_server is SECURITY DEFINER, preserving the existing creation contract.
SELECT public.create_server('Novo servidor');
RESET ROLE;
DO $$ DECLARE new_id uuid; BEGIN
  SELECT id INTO new_id FROM public.servers WHERE name='Novo servidor';
  IF (SELECT count(*) FROM public.server_categories WHERE server_id=new_id)<>2 THEN RAISE EXCEPTION 'New defaults absent'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.channels c JOIN public.server_categories cat ON cat.id=c.category_id WHERE c.server_id=new_id AND c.name='geral' AND cat.name='Canais de texto') THEN RAISE EXCEPTION 'Initial channel not assigned'; END IF;
  DELETE FROM public.server_categories WHERE server_id=new_id;
  IF EXISTS(SELECT 1 FROM public.server_categories WHERE server_id=new_id) THEN RAISE EXCEPTION 'Deleted defaults recreated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.channels WHERE server_id=new_id AND category_id IS NULL) THEN RAISE EXCEPTION 'Category deletion lost channel'; END IF;
END $$;
SELECT 'PASS: existing/new defaults, channel preservation, rename, reorder and RLS';
