-- Run ONLY against an empty, isolated local PostgreSQL database, with ON_ERROR_STOP=1.
BEGIN;
CREATE TABLE public.servers(id uuid PRIMARY KEY, owner_id uuid);
CREATE TABLE public.server_members(id uuid PRIMARY KEY, server_id uuid REFERENCES public.servers, user_id uuid);
CREATE TABLE public.roles(id uuid PRIMARY KEY, server_id uuid REFERENCES public.servers, permissions jsonb);
CREATE TABLE public.member_roles(member_id uuid REFERENCES public.server_members, role_id uuid REFERENCES public.roles);
CREATE TABLE public.channels(id uuid PRIMARY KEY, server_id uuid REFERENCES public.servers);
CREATE FUNCTION public.is_server_owner(s uuid,u uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS(SELECT 1 FROM public.servers WHERE id=s AND owner_id=u);
$$;
INSERT INTO public.servers VALUES
('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003');
INSERT INTO public.server_members VALUES
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.channels VALUES ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
INSERT INTO public.roles VALUES
('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','{"speak":false}'),
('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','{}'),
('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','{"speak":true}'),
('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','{"administrator":true}');
-- Deliberately seed a legacy invalid assignment before installing the new guard.
INSERT INTO public.member_roles SELECT '20000000-0000-0000-0000-000000000001',id FROM public.roles WHERE id<>'40000000-0000-0000-0000-000000000003';
\ir ../supabase/migrations/20261007010000_audit_role_permission_integrity.sql
DO $$
DECLARE s uuid='00000000-0000-0000-0000-000000000001'; c uuid='30000000-0000-0000-0000-000000000001';
u uuid='10000000-0000-0000-0000-000000000002'; m uuid='20000000-0000-0000-0000-000000000001';
BEGIN
  IF public.has_server_permission(s,u,'administrator') THEN RAISE EXCEPTION 'cross-server admin granted'; END IF;
  IF public.has_channel_permission(c,u,'speak') THEN RAISE EXCEPTION 'baseline denial bypassed'; END IF;
  IF NOT public.has_channel_permission(c,u,'connect') THEN RAISE EXCEPTION 'baseline missing'; END IF;
  IF public.has_channel_permission(c,'10000000-0000-0000-0000-000000000004','connect') THEN RAISE EXCEPTION 'non-member granted'; END IF;
  IF NOT public.has_channel_permission(c,'10000000-0000-0000-0000-000000000001','speak') THEN RAISE EXCEPTION 'owner denied'; END IF;
  INSERT INTO public.member_roles VALUES(m,'40000000-0000-0000-0000-000000000003');
  IF NOT public.has_channel_permission(c,u,'speak') THEN RAISE EXCEPTION 'explicit grant denied'; END IF;
  BEGIN
    INSERT INTO public.member_roles VALUES(m,'40000000-0000-0000-0000-000000000004');
    RAISE EXCEPTION 'cross-server insert accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.member_roles SET role_id='40000000-0000-0000-0000-000000000004' WHERE role_id='40000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'cross-server update accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  DELETE FROM public.member_roles WHERE member_id=m;
  IF NOT public.has_channel_permission(c,u,'speak') THEN RAISE EXCEPTION 'roleless baseline denied'; END IF;
END;
$$;
ROLLBACK;
