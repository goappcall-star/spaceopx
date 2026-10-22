-- Local preparation only. Preserve the existing transactional creation function.
BEGIN;
ALTER TABLE public.servers ADD COLUMN theme text NOT NULL DEFAULT 'other'
 CHECK (theme IN ('gaming','technology','study','art','other'));
CREATE FUNCTION public.create_server_with_options(
 _name text, _description text DEFAULT NULL, _icon_url text DEFAULT NULL,
 _visibility text DEFAULT 'private', _theme text DEFAULT 'other'
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
 IF _visibility IS NULL OR _visibility NOT IN ('public','private') OR _theme IS NULL OR _theme NOT IN ('gaming','technology','study','art','other') THEN
  RAISE EXCEPTION 'invalid_server_options' USING ERRCODE='22023';
 END IF;
 sid := public.create_server(_name, _description, _icon_url);
 -- Runs under the caller's RLS, after the existing function assigns OWNER.
 UPDATE public.servers SET visibility=_visibility, theme=_theme WHERE id=sid AND owner_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_server_with_options(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_server_with_options(text,text,text,text,text) TO authenticated;
COMMIT;
-- Reversal: remove the wrapper RPC, then (only after preserving any desired theme
-- metadata and returning clients to create_server) remove the new theme column.
-- No destructive rollback is automatically executed.
