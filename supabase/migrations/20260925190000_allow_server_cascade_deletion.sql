-- Child DELETE triggers must not write audit rows for a deleted server.
-- Keep normal role/member/invite/ban auditing intact.
CREATE OR REPLACE FUNCTION public.write_audit(
  _server_id uuid, _action text, _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL, _target_label text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.audit_logs (server_id, actor_id, action, target_type, target_id, target_label, metadata)
  SELECT _server_id, auth.uid(), _action, _target_type, _target_id, _target_label, COALESCE(_metadata, '{}'::jsonb)
  WHERE EXISTS (SELECT 1 FROM public.servers WHERE id = _server_id);
$$;

REVOKE EXECUTE ON FUNCTION public.write_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
