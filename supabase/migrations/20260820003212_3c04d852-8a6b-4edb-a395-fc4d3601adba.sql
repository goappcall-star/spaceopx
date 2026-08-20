-- Normalize existing usernames to lowercase (safe: creation already lowercases)
UPDATE public.profiles SET username = lower(username) WHERE username <> lower(username);

-- Case-insensitive uniqueness guaranteed by the database
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username));

-- Format validation + immutability
CREATE OR REPLACE FUNCTION public.enforce_username_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.username := lower(trim(NEW.username));
    IF NEW.username !~ '^[a-z0-9_.]{3,32}$' THEN
      RAISE EXCEPTION 'invalid_username_format';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'username_is_permanent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_username_rules ON public.profiles;
CREATE TRIGGER profiles_username_rules
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_rules();