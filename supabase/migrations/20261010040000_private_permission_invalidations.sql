-- Prepared locally. Requires explicit production authorization.
BEGIN;
-- One bounded row per recipient, no server/member/role IDs or message contents.
-- No FK cascade DELETE: clients subscribe exclusively to INSERT/UPDATE.
CREATE TABLE public.permission_invalidations (
  user_id uuid PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1
);
ALTER TABLE public.permission_invalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.permission_invalidations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.permission_invalidations TO authenticated;
CREATE POLICY permission_invalidations_self ON public.permission_invalidations
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.invalidate_server_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE before_row jsonb; after_row jsonb; server_ids uuid[]; recipients uuid[];
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND before_row = after_row THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'member_roles' THEN
    SELECT array_agg(DISTINCT server_id) INTO server_ids
    FROM public.server_members WHERE id IN (
      (before_row->>'member_id')::uuid, (after_row->>'member_id')::uuid);
  ELSE
    server_ids := ARRAY[(before_row->>'server_id')::uuid, (after_row->>'server_id')::uuid];
  END IF;
  SELECT array_agg(DISTINCT user_id) INTO recipients
  FROM public.server_members WHERE server_id = ANY(server_ids);
  IF TG_TABLE_NAME = 'server_members' THEN
    -- The removed member must learn about revocation after losing membership.
    recipients := coalesce(recipients, '{}'::uuid[]) || ARRAY[
      (before_row->>'user_id')::uuid, (after_row->>'user_id')::uuid];
  END IF;
  INSERT INTO public.permission_invalidations AS existing(user_id, revision)
    SELECT DISTINCT recipient, 1 FROM unnest(recipients) recipient
    WHERE recipient IS NOT NULL
    ORDER BY recipient
  ON CONFLICT(user_id) DO UPDATE SET revision = existing.revision + 1;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_server_permissions() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER server_members_permission_invalidation AFTER INSERT OR UPDATE OR DELETE
  ON public.server_members FOR EACH ROW EXECUTE FUNCTION public.invalidate_server_permissions();
CREATE TRIGGER roles_permission_invalidation AFTER INSERT OR UPDATE OR DELETE
  ON public.roles FOR EACH ROW EXECUTE FUNCTION public.invalidate_server_permissions();
CREATE TRIGGER member_roles_permission_invalidation AFTER INSERT OR UPDATE OR DELETE
  ON public.member_roles FOR EACH ROW EXECUTE FUNCTION public.invalidate_server_permissions();
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'Expected supabase_realtime publication is missing';
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.permission_invalidations;
END $$;
-- Preserve the complete existing authorization function, adding only our
-- read-only, self-scoped topic. Abort on unexpected schema drift.
DO $$ DECLARE definition text; marker text := '  -- These topics carry postgres_changes only. No client broadcast writes.';
BEGIN
  definition := pg_get_functiondef('public.can_use_realtime_topic(text,boolean)'::regprocedure);
  IF position(marker IN definition)=0 OR position('read-states:' IN definition)>0 THEN
    RAISE EXCEPTION 'Unexpected realtime authorization definition; review before applying';
  END IF;
  EXECUTE replace(definition, marker,
    '  IF topic_name LIKE ''read-states:%'' THEN RETURN NOT writing AND substr(topic_name,13)::uuid=actor; END IF;' || chr(10) || marker);
END $$;
COMMIT;
