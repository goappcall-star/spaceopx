-- Google authenticates identity first; the public profile is created only after
-- the user explicitly chooses a unique username. Existing accounts stay intact.
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_username text;
BEGIN
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    RETURN NEW;
  END IF;
  chosen_username := lower(trim(NEW.raw_user_meta_data->>'username'));
  IF chosen_username IS NULL OR chosen_username !~ '^[a-z0-9_.]{3,32}$' THEN
    RAISE EXCEPTION 'invalid_username_format';
  END IF;
  INSERT INTO public.profiles(id, username, display_name, avatar_url)
  VALUES (NEW.id, chosen_username,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''), chosen_username),
    NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_registration(chosen_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  normalized text := lower(trim(chosen_username));
  existing text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF normalized IS NULL OR normalized !~ '^[a-z0-9_.]{3,32}$' THEN
    RAISE EXCEPTION 'invalid_username_format';
  END IF;
  -- Serializes retries from the same account, while unique indexes arbitrate
  -- two different accounts competing for the same username.
  PERFORM 1 FROM auth.users WHERE id = caller FOR UPDATE;
  SELECT username INTO existing FROM public.profiles WHERE id = caller;
  IF FOUND THEN
    IF existing = normalized THEN RETURN; END IF;
    RAISE EXCEPTION 'registration_already_complete';
  END IF;
  INSERT INTO public.profiles(id, username, display_name)
  VALUES (caller, normalized, normalized);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_registration(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_registration(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.google_registration_ready()
RETURNS boolean LANGUAGE sql STABLE AS $ SELECT true $;
REVOKE ALL ON FUNCTION public.google_registration_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.google_registration_ready() TO anon, authenticated;
COMMIT;
