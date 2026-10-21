-- Community V1, phase 1. LOCAL ONLY until explicit production authorization.
-- Additive configuration: never recreate servers or rewrite their permissions/data.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$ BEGIN
  IF EXISTS (SELECT FROM public.roles WHERE permissions->'manage_community' = 'true'::jsonb) THEN
    RAISE EXCEPTION 'community_permission_preexists: review existing grants before applying';
  END IF;
END $$;

CREATE TABLE public.server_community_settings (
  server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  rules jsonb NOT NULL CHECK (jsonb_typeof(rules) = 'array'),
  rules_revision integer NOT NULL DEFAULT 1 CHECK (rules_revision > 0),
  welcome_channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  category_slug text NOT NULL CHECK (category_slug IN ('gaming','technology','creative','education','social','other')),
  interests text[] NOT NULL DEFAULT '{}' CHECK (cardinality(interests) <= 10),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  activated_at timestamptz,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disabled_at timestamptz,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX server_community_welcome_channel_idx ON public.server_community_settings(welcome_channel_id)
  WHERE welcome_channel_id IS NOT NULL;
ALTER TABLE public.server_community_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_community_settings FROM PUBLIC, anon, authenticated;
-- Administrative actor IDs are intentionally not readable via the member projection.
GRANT SELECT (server_id,enabled,rules,rules_revision,welcome_channel_id,category_slug,interests,
  revision,activated_at,disabled_at,created_at,updated_at)
  ON public.server_community_settings TO authenticated;

CREATE FUNCTION public.can_manage_community(_server_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.is_server_banned(_server_id,auth.uid())
    AND (public.is_server_owner(_server_id,auth.uid()) OR EXISTS (
      SELECT 1 FROM public.server_members m
      JOIN public.member_roles mr ON mr.member_id=m.id
      JOIN public.roles r ON r.id=mr.role_id AND r.server_id=m.server_id
      WHERE m.server_id=_server_id AND m.user_id=auth.uid()
        AND r.name <> 'MEMBER' AND NOT r.is_owner
        AND r.permissions->'manage_community' = 'true'::jsonb
    ));
$$;
REVOKE ALL ON FUNCTION public.can_manage_community(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_community(uuid) TO authenticated;

CREATE POLICY community_settings_read ON public.server_community_settings FOR SELECT TO authenticated
  USING (public.can_manage_community(server_id) OR
    (enabled AND public.is_server_member(server_id,auth.uid()) AND NOT public.is_server_banned(server_id,auth.uid())));

-- This guard only protects the NEW capability; it never backfills existing roles.
CREATE FUNCTION security_private.guard_community_role_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE before_grant boolean := false; after_grant boolean;
BEGIN
  after_grant := coalesce(NEW.permissions->'manage_community' = 'true'::jsonb,false);
  IF TG_OP='UPDATE' THEN
    before_grant := coalesce(OLD.permissions->'manage_community' = 'true'::jsonb,false);
  END IF;
  IF after_grant AND (NEW.name='MEMBER' OR NEW.is_owner) THEN
    RAISE EXCEPTION 'community_role_ineligible' USING ERRCODE='22023';
  END IF;
  IF before_grant IS DISTINCT FROM after_grant THEN
    -- Grant changes use the owner-checked RPC, which locks server before role.
    -- An invoker trigger retains the trusted definer's identity only inside that
    -- RPC; a browser cannot spoof current_user by altering JWT/custom settings.
    IF current_user <> pg_get_userbyid((SELECT proowner FROM pg_proc
      WHERE oid='public.set_community_role_permission(uuid,uuid,boolean)'::regprocedure)) THEN
      RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501';
    END IF;
    PERFORM id FROM public.servers WHERE id=NEW.server_id FOR UPDATE;
    IF NOT public.is_server_owner(NEW.server_id,auth.uid()) THEN
      RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.guard_community_role_permission() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER community_role_permission_guard BEFORE INSERT OR UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_community_role_permission();

CREATE FUNCTION security_private.guard_community_role_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE target_server uuid;
BEGIN
  IF TG_OP='UPDATE' AND NEW.member_id=OLD.member_id AND NEW.role_id=OLD.role_id THEN RETURN NEW; END IF;
  SELECT r.server_id INTO target_server FROM public.roles r WHERE r.id=NEW.role_id;
  IF target_server IS NOT NULL THEN
    PERFORM id FROM public.servers WHERE id=target_server FOR UPDATE;
    -- Serialize even currently unprivileged assignments with a concurrent grant.
    IF EXISTS (SELECT FROM public.roles WHERE id=NEW.role_id AND permissions->'manage_community'='true'::jsonb)
      AND NOT public.is_server_owner(target_server,auth.uid()) THEN
      RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION security_private.guard_community_role_assignment() FROM PUBLIC,anon,authenticated,service_role;
-- DELETE deliberately follows existing revocation/leave/kick/cascade rules.
CREATE TRIGGER community_role_assignment_guard BEFORE INSERT OR UPDATE ON public.member_roles
  FOR EACH ROW EXECUTE FUNCTION security_private.guard_community_role_assignment();

CREATE FUNCTION security_private.community_payload(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE item jsonb; rule_id uuid; text_value text; rule_ids uuid[] := '{}';
  rules_clean jsonb := '[]'; interests_clean text[] := '{}'; welcome_id uuid;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload)<>'object' OR octet_length(_payload::text)>65536 THEN
    RAISE EXCEPTION 'community_invalid_payload' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(_payload) k
    WHERE k NOT IN ('rules','welcome_channel_id','category_slug','interests'))
    OR NOT (_payload ?& ARRAY['rules','welcome_channel_id','category_slug','interests']) THEN
    RAISE EXCEPTION 'community_invalid_payload' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(_payload->'rules') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(_payload->'rules') NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_payload->'rules') LOOP
    IF jsonb_typeof(item)<>'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string'
      OR EXISTS(SELECT FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','text')) THEN
      RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023';
    END IF;
    BEGIN rule_id := (item->>'id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023';
    END;
    text_value := btrim(item->>'text');
    IF char_length(text_value) NOT BETWEEN 1 AND 1000 OR text_value ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'
      OR rule_id=ANY(rule_ids) THEN
      RAISE EXCEPTION 'community_invalid_rules' USING ERRCODE='22023';
    END IF;
    rule_ids := array_append(rule_ids,rule_id);
    rules_clean := rules_clean || jsonb_build_array(jsonb_build_object('id',rule_id,'text',text_value));
  END LOOP;
  IF jsonb_typeof(_payload->'welcome_channel_id') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'community_invalid_channel' USING ERRCODE='22023';
  END IF;
  BEGIN welcome_id := (_payload->>'welcome_channel_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'community_invalid_channel' USING ERRCODE='22023';
  END;
  IF jsonb_typeof(_payload->'category_slug') IS DISTINCT FROM 'string'
    OR (_payload->>'category_slug') NOT IN ('gaming','technology','creative','education','social','other') THEN
    RAISE EXCEPTION 'community_invalid_category' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(_payload->'interests') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'community_invalid_interests' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(_payload->'interests')>10 THEN
    RAISE EXCEPTION 'community_invalid_interests' USING ERRCODE='22023';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_payload->'interests') LOOP
    IF jsonb_typeof(item)<>'string' THEN RAISE EXCEPTION 'community_invalid_interests' USING ERRCODE='22023'; END IF;
    text_value := lower(btrim(item#>>'{}'));
    IF char_length(text_value) NOT BETWEEN 2 AND 30 OR text_value ~ '[\x01-\x1F\x7F]' THEN
      RAISE EXCEPTION 'community_invalid_interests' USING ERRCODE='22023';
    END IF;
    IF NOT text_value=ANY(interests_clean) THEN interests_clean := array_append(interests_clean,text_value); END IF;
  END LOOP;
  RETURN jsonb_build_object('rules',rules_clean,'welcome_channel_id',welcome_id,
    'category_slug',_payload->>'category_slug','interests',to_jsonb(interests_clean));
END $$;
REVOKE ALL ON FUNCTION security_private.community_payload(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION security_private.community_member_projection(_settings public.server_community_settings)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT to_jsonb(_settings) - ARRAY['activated_by','disabled_by'];
$$;
REVOKE ALL ON FUNCTION security_private.community_member_projection(public.server_community_settings) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_server_community(_server_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE allowed boolean; settings public.server_community_settings%ROWTYPE;
BEGIN
  allowed := public.can_manage_community(_server_id);
  IF auth.uid() IS NULL OR public.is_server_banned(_server_id,auth.uid()) OR
    (NOT allowed AND NOT public.is_server_member(_server_id,auth.uid())) THEN
    RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT * INTO settings FROM public.server_community_settings
    WHERE server_id=_server_id AND (enabled OR allowed);
  RETURN jsonb_build_object('can_manage',allowed,'is_owner',public.is_server_owner(_server_id,auth.uid()),
    'settings',CASE WHEN FOUND THEN security_private.community_member_projection(settings) ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.get_server_community(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_community(uuid) TO authenticated;

CREATE FUNCTION public.save_server_community(_server_id uuid,_payload jsonb,_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous public.server_community_settings%ROWTYPE; saved public.server_community_settings%ROWTYPE;
  clean jsonb; exists_before boolean; welcome_id uuid; action_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
  PERFORM id FROM public.servers WHERE id=_server_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_community(_server_id) THEN
    RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501';
  END IF;
  clean := security_private.community_payload(_payload);
  welcome_id := (clean->>'welcome_channel_id')::uuid;
  PERFORM id FROM public.channels WHERE id=welcome_id AND server_id=_server_id
    AND type IN ('text','announcement') FOR SHARE;
  IF NOT FOUND OR NOT public.has_channel_permission(welcome_id,auth.uid(),'view_channel') THEN
    RAISE EXCEPTION 'community_invalid_channel' USING ERRCODE='22023';
  END IF;
  SELECT * INTO previous FROM public.server_community_settings WHERE server_id=_server_id FOR UPDATE;
  exists_before := FOUND;
  IF _expected_revision IS NULL OR _expected_revision<>(CASE WHEN exists_before THEN previous.revision ELSE 0 END) THEN
    RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001';
  END IF;
  PERFORM security_private.consume_write_budget('community_save',60,30);
  IF exists_before AND previous.enabled AND previous.rules=clean->'rules'
    AND previous.welcome_channel_id=welcome_id AND previous.category_slug=clean->>'category_slug'
    AND to_jsonb(previous.interests)=clean->'interests' THEN
    RETURN security_private.community_member_projection(previous);
  END IF;
  IF NOT exists_before OR NOT previous.enabled THEN
    PERFORM security_private.consume_write_budget('community_toggle',600,10);
  END IF;
  action_name := CASE WHEN NOT exists_before OR NOT previous.enabled THEN 'community_activated' ELSE 'community_settings_updated' END;
  INSERT INTO public.server_community_settings(server_id,enabled,rules,rules_revision,welcome_channel_id,
    category_slug,interests,revision,activated_at,activated_by)
  VALUES (_server_id,true,clean->'rules',1,welcome_id,clean->>'category_slug',
    ARRAY(SELECT jsonb_array_elements_text(clean->'interests')),1,clock_timestamp(),auth.uid())
  ON CONFLICT(server_id) DO UPDATE SET enabled=true,rules=EXCLUDED.rules,
    rules_revision=previous.rules_revision+CASE WHEN previous.rules IS DISTINCT FROM EXCLUDED.rules THEN 1 ELSE 0 END,
    welcome_channel_id=EXCLUDED.welcome_channel_id,category_slug=EXCLUDED.category_slug,interests=EXCLUDED.interests,
    revision=previous.revision+1,updated_at=clock_timestamp()
  RETURNING * INTO saved;
  PERFORM public.write_audit(_server_id,action_name,'server',_server_id,NULL,
    jsonb_build_object('revision',saved.revision,'rules_revision',saved.rules_revision));
  RETURN security_private.community_member_projection(saved);
END $$;
REVOKE ALL ON FUNCTION public.save_server_community(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_server_community(uuid,jsonb,integer) TO authenticated;

CREATE FUNCTION public.disable_server_community(_server_id uuid,_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous public.server_community_settings%ROWTYPE; saved public.server_community_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_community(_server_id) THEN RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501'; END IF;
  PERFORM id FROM public.servers WHERE id=_server_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_community(_server_id) THEN
    RAISE EXCEPTION 'community_not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT * INTO previous FROM public.server_community_settings WHERE server_id=_server_id FOR UPDATE;
  IF NOT FOUND OR _expected_revision IS NULL OR _expected_revision<>previous.revision THEN
    RAISE EXCEPTION 'community_revision_conflict' USING ERRCODE='40001';
  END IF;
  PERFORM security_private.consume_write_budget('community_toggle',600,10);
  IF NOT previous.enabled THEN RETURN security_private.community_member_projection(previous); END IF;
  UPDATE public.server_community_settings SET enabled=false,revision=revision+1,
    disabled_at=clock_timestamp(),disabled_by=auth.uid(),updated_at=clock_timestamp()
    WHERE server_id=_server_id RETURNING * INTO saved;
  PERFORM public.write_audit(_server_id,'community_deactivated','server',_server_id,NULL,
    jsonb_build_object('revision',saved.revision));
  RETURN security_private.community_member_projection(saved);
END $$;
REVOKE ALL ON FUNCTION public.disable_server_community(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.disable_server_community(uuid,integer) TO authenticated;

CREATE FUNCTION public.set_community_role_permission(_server_id uuid,_role_id uuid,_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target public.roles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_server_owner(_server_id,auth.uid())
    OR public.is_server_banned(_server_id,auth.uid()) THEN
    RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM public.servers WHERE id=_server_id FOR UPDATE;
  IF NOT public.is_server_owner(_server_id,auth.uid()) OR public.is_server_banned(_server_id,auth.uid()) THEN
    RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO target FROM public.roles WHERE id=_role_id AND server_id=_server_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'community_role_ineligible' USING ERRCODE='22023'; END IF;
  IF _enabled IS NULL OR target.is_owner OR target.name='MEMBER' THEN
    RAISE EXCEPTION 'community_role_ineligible' USING ERRCODE='22023';
  END IF;
  PERFORM security_private.consume_write_budget('community_delegate',600,20);
  IF coalesce(target.permissions->'manage_community'='true'::jsonb,false)=_enabled THEN RETURN; END IF;
  UPDATE public.roles SET permissions=jsonb_set(permissions,'{manage_community}',to_jsonb(_enabled),true)
    WHERE id=_role_id;
  -- Existing role audit trigger records the actor and change under view_audit_log.
END $$;
REVOKE ALL ON FUNCTION public.set_community_role_permission(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_community_role_permission(uuid,uuid,boolean) TO authenticated;

COMMENT ON TABLE public.server_community_settings IS
  'Additive community configuration. Disabling retains data. No public discovery or voice XP.';
COMMIT;
