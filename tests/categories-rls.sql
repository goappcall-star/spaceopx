INSERT INTO public.server_categories(id,server_id,name) VALUES ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','Other server');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
DO $$ BEGIN
  BEGIN INSERT INTO public.server_categories(server_id,name) VALUES ('00000000-0000-0000-0000-000000000001','Denied'); RAISE EXCEPTION 'Member could create a category'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.server_categories) THEN RAISE EXCEPTION 'Member saw another server category'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000010';
INSERT INTO public.server_categories(id,server_id,name,position) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','Games',1);
UPDATE public.server_categories SET name='Renamed' WHERE id='00000000-0000-0000-0000-000000000021';
INSERT INTO public.channels(id,server_id,name,category_id) VALUES ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','voice','00000000-0000-0000-0000-000000000021');
DO $$ BEGIN
  BEGIN UPDATE public.channels SET category_id='00000000-0000-0000-0000-000000000022' WHERE id='00000000-0000-0000-0000-000000000031'; RAISE EXCEPTION 'Cross-server assignment allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN INSERT INTO public.server_categories(server_id,name) VALUES ('00000000-0000-0000-0000-000000000001',' '); RAISE EXCEPTION 'Empty name allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
DO $$ BEGIN
  UPDATE public.server_categories SET name='Illegal'; IF FOUND THEN RAISE EXCEPTION 'Member could rename'; END IF;
  DELETE FROM public.server_categories; IF FOUND THEN RAISE EXCEPTION 'Member could delete'; END IF;
  UPDATE public.channels SET category_id=NULL; IF FOUND THEN RAISE EXCEPTION 'Member could reassign'; END IF;
  IF (SELECT count(*) FROM public.server_categories)<>1 THEN RAISE EXCEPTION 'Member cannot read own server categories'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000010';
DELETE FROM public.server_categories WHERE id='00000000-0000-0000-0000-000000000021';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.channels WHERE id='00000000-0000-0000-0000-000000000031' AND category_id IS NULL AND server_id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Deleting category did not preserve channel'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000099';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.server_categories) OR EXISTS(SELECT 1 FROM public.channels) THEN RAISE EXCEPTION 'Outsider read server structure'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('channels','server_categories'))<>2 THEN RAISE EXCEPTION 'Realtime publication missing'; END IF; END $$;
SELECT 'PASS: category create/rename/delete, member/outsider RLS, cross-server FK, channel preservation, Realtime publication';
