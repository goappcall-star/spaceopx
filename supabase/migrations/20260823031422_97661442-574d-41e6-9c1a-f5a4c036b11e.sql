CREATE OR REPLACE FUNCTION public.create_server_invite(_server_id uuid, _max_uses integer DEFAULT NULL::integer, _expires_in_hours integer DEFAULT 168)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  uid UUID := auth.uid();
  new_code TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.can_manage_server(_server_id, uid) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  LOOP
    -- 10 chars from a cryptographically random 8-byte value (base32-ish, url safe).
    new_code := lower(substr(replace(replace(encode(extensions.gen_random_bytes(8), 'base64'), '/', ''), '+', ''), 1, 10));
    EXIT WHEN length(new_code) = 10
      AND NOT EXISTS (SELECT 1 FROM public.server_invites WHERE code = new_code);
  END LOOP;

  INSERT INTO public.server_invites (server_id, code, created_by, max_uses, expires_at)
  VALUES (
    _server_id, new_code, uid,
    CASE WHEN _max_uses IS NOT NULL AND _max_uses > 0 THEN _max_uses ELSE NULL END,
    CASE WHEN _expires_in_hours IS NOT NULL AND _expires_in_hours > 0 THEN now() + make_interval(hours => _expires_in_hours) ELSE NULL END
  );

  RETURN new_code;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, integer, integer) TO authenticated;