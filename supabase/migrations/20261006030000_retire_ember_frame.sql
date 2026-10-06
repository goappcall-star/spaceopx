-- Retire only Chama. Existing identifiers and permissions are preserved.
UPDATE public.profiles SET profile_frame='none' WHERE profile_frame='ember';
UPDATE public.profiles SET nameplate='none' WHERE nameplate='ember';
CREATE FUNCTION public.normalize_retired_ember() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.profile_frame='ember' THEN NEW.profile_frame='none'; END IF;
IF NEW.nameplate='ember' THEN NEW.nameplate='none'; END IF; RETURN NEW; END $$;
CREATE TRIGGER retired_ember_compat BEFORE INSERT OR UPDATE OF profile_frame,nameplate ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_retired_ember();
REVOKE ALL ON FUNCTION public.normalize_retired_ember() FROM PUBLIC;
NOTIFY pgrst,'reload schema';
