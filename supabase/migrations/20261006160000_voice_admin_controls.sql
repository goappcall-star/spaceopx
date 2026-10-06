-- Stable identity: renaming the owner's role must not remove its protections.
ALTER TABLE public.roles ADD COLUMN is_owner boolean NOT NULL DEFAULT false;
UPDATE public.roles SET is_owner=true WHERE name='OWNER';
CREATE UNIQUE INDEX one_owner_role_per_server ON public.roles(server_id) WHERE is_owner;
CREATE FUNCTION public.protect_owner_role() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    -- create_server runs as SECURITY DEFINER; direct client inserts cannot forge this role.
    IF NEW.name='OWNER' AND current_user<>'authenticated' THEN NEW.is_owner=true;
    ELSIF NEW.is_owner OR NEW.name='OWNER' THEN RAISE EXCEPTION 'not_authorized'; END IF;
  ELSE
    IF NEW.is_owner IS DISTINCT FROM OLD.is_owner OR NEW.server_id<>OLD.server_id THEN RAISE EXCEPTION 'protected_role'; END IF;
    IF OLD.is_owner AND (NOT public.is_server_owner(OLD.server_id,auth.uid())
      OR NEW.permissions IS DISTINCT FROM OLD.permissions OR NEW.position<>OLD.position) THEN RAISE EXCEPTION 'protected_role'; END IF;
    IF NOT OLD.is_owner AND NEW.name='OWNER' THEN RAISE EXCEPTION 'protected_role'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_owner_role BEFORE INSERT OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.protect_owner_role();
DROP POLICY roles_update_admins ON public.roles;
CREATE POLICY roles_update_admins ON public.roles FOR UPDATE TO authenticated
 USING ((is_owner AND public.is_server_owner(server_id,auth.uid())) OR (NOT is_owner AND public.has_server_permission(server_id,auth.uid(),'manage_roles')))
 WITH CHECK ((is_owner AND public.is_server_owner(server_id,auth.uid())) OR (NOT is_owner AND public.has_server_permission(server_id,auth.uid(),'manage_roles')));
DROP POLICY roles_delete_admins ON public.roles;
CREATE POLICY roles_delete_admins ON public.roles FOR DELETE TO authenticated
 USING (NOT is_owner AND name<>'MEMBER' AND public.has_server_permission(server_id,auth.uid(),'manage_roles'));
DROP POLICY member_roles_insert_admins ON public.member_roles;
CREATE POLICY member_roles_insert_admins ON public.member_roles FOR INSERT TO authenticated
 WITH CHECK (public.has_server_permission(public.member_server_id(member_id),auth.uid(),'manage_members')
 AND NOT EXISTS(SELECT 1 FROM public.roles WHERE id=role_id AND is_owner));
DROP POLICY member_roles_delete_admins ON public.member_roles;
CREATE POLICY member_roles_delete_admins ON public.member_roles FOR DELETE TO authenticated
 USING (public.has_server_permission(public.member_server_id(member_id),auth.uid(),'manage_members')
 AND NOT EXISTS(SELECT 1 FROM public.roles WHERE id=role_id AND is_owner));

CREATE TABLE public.voice_restrictions (
 server_id uuid NOT NULL REFERENCES public.servers ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
 muted boolean NOT NULL DEFAULT false,
 deafened boolean NOT NULL DEFAULT false,
 PRIMARY KEY(server_id,user_id)
);
ALTER TABLE public.voice_restrictions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.voice_restrictions TO authenticated;
CREATE POLICY voice_restrictions_members ON public.voice_restrictions FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.server_members WHERE server_id=voice_restrictions.server_id AND user_id=auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_restrictions;
CREATE FUNCTION public.set_voice_restriction(_server uuid,_user uuid,_kind text,_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_server_permission(_server,auth.uid(),'administrator') THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF _kind NOT IN ('muted','deafened') OR _enabled IS NULL OR NOT EXISTS(SELECT 1 FROM public.server_members WHERE server_id=_server AND user_id=_user)
  OR public.is_server_owner(_server,_user) THEN RAISE EXCEPTION 'invalid_target'; END IF;
 INSERT INTO public.voice_restrictions(server_id,user_id,muted,deafened)
 VALUES(_server,_user,_kind='muted' AND _enabled,_kind='deafened' AND _enabled)
 ON CONFLICT(server_id,user_id) DO UPDATE SET
 muted=CASE WHEN _kind='muted' THEN _enabled ELSE voice_restrictions.muted END,
 deafened=CASE WHEN _kind='deafened' THEN _enabled ELSE voice_restrictions.deafened END;
END $$;
REVOKE ALL ON FUNCTION public.set_voice_restriction(uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_voice_restriction(uuid,uuid,text,boolean) TO authenticated;

ALTER TABLE public.voice_move_requests ADD COLUMN action text NOT NULL DEFAULT 'move' CHECK(action IN ('move','disconnect'));
ALTER TABLE public.voice_move_requests ALTER COLUMN destination_channel_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.request_voice_move(_user_id uuid,_source uuid,_destination uuid,_session text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; result uuid;
BEGIN
 SELECT server_id INTO sid FROM public.channels WHERE id=_source AND type='voice';
 IF sid IS NULL OR auth.uid() IS NULL OR _source=_destination OR _session IS NULL OR length(_session) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_voice_move'; END IF;
 IF NOT public.has_server_permission(sid,auth.uid(),'administrator') THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF public.is_server_owner(sid,_user_id) AND auth.uid()<>_user_id THEN RAISE EXCEPTION 'invalid_target'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.server_members WHERE server_id=sid AND user_id=_user_id) THEN RAISE EXCEPTION 'invalid_target'; END IF;
 IF _destination IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public.channels WHERE id=_destination AND server_id=sid AND type='voice')
 OR NOT public.has_channel_permission(_destination,_user_id,'connect')) THEN RAISE EXCEPTION 'invalid_destination'; END IF;
 DELETE FROM public.voice_move_requests WHERE created_at<now()-interval '1 day';
 INSERT INTO public.voice_move_requests(recipient_id,actor_id,server_id,source_channel_id,destination_channel_id,voice_session_id,action)
 VALUES(_user_id,auth.uid(),sid,_source,_destination,_session,CASE WHEN _destination IS NULL THEN 'disconnect' ELSE 'move' END) RETURNING id INTO result;
 RETURN result;
END $$;
NOTIFY pgrst,'reload schema';
