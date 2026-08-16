-- 1. profiles expansion
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS custom_status TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT 'neon_cyan';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('online','idle','dnd','offline'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 300);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_custom_status_len CHECK (custom_status IS NULL OR char_length(custom_status) <= 120);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_accent_check
  CHECK (accent_color IN ('neon_red','neon_purple','neon_blue','neon_green','neon_cyan','neon_orange'));

-- 2. games
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY games_select_authenticated ON public.games FOR SELECT TO authenticated USING (true);

INSERT INTO public.games (name, slug) VALUES
  ('Counter-Strike 2','counter-strike-2'),
  ('Valorant','valorant'),
  ('Fortnite','fortnite'),
  ('Minecraft','minecraft'),
  ('League of Legends','league-of-legends'),
  ('EA FC 26','ea-fc-26'),
  ('GTA V','gta-v'),
  ('Roblox','roblox'),
  ('Apex Legends','apex-legends')
ON CONFLICT (slug) DO NOTHING;

-- 3. favorite games
CREATE TABLE IF NOT EXISTS public.user_favorite_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_games TO authenticated;
GRANT ALL ON public.user_favorite_games TO service_role;
ALTER TABLE public.user_favorite_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY ufg_select ON public.user_favorite_games FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_server_with(user_id, auth.uid()));
CREATE POLICY ufg_write ON public.user_favorite_games FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_favorite_games_limit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_favorite_games WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'favorite_games_limit';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ufg_limit BEFORE INSERT ON public.user_favorite_games
  FOR EACH ROW EXECUTE FUNCTION public.enforce_favorite_games_limit();

-- 4. game presence (current state only)
CREATE TABLE IF NOT EXISTS public.user_game_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('playing','paused','stopped')),
  started_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_game_presence TO authenticated;
GRANT ALL ON public.user_game_presence TO service_role;
ALTER TABLE public.user_game_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY ugp_select ON public.user_game_presence FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_server_with(user_id, auth.uid()));
CREATE POLICY ugp_write ON public.user_game_presence FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER ugp_set_updated_at BEFORE UPDATE ON public.user_game_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. XP (read-only from the app)
CREATE TABLE IF NOT EXISTS public.user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_xp TO authenticated;
GRANT ALL ON public.user_xp TO service_role;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_xp_select ON public.user_xp FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_server_with(user_id, auth.uid()));

-- 6. badges
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY badges_select_authenticated ON public.badges FOR SELECT TO authenticated USING (true);

INSERT INTO public.badges (slug, name, description, rarity) VALUES
  ('FIRST_SERVER','Primeiro Servidor','Criou seu primeiro servidor.','common'),
  ('FIRST_MESSAGE','Primeira Mensagem','Enviou sua primeira mensagem.','common'),
  ('FIRST_VOICE','Primeira Voz','Entrou pela primeira vez em um canal de voz.','common'),
  ('VETERAN','Veterano','Conta antiga / usuário veterano.','epic'),
  ('FOUNDER','Fundador','Criou um servidor.','rare')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_badges_select ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_server_with(user_id, auth.uid()));

-- 7. preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accent_color TEXT NOT NULL DEFAULT 'neon_cyan'
    CHECK (accent_color IN ('neon_red','neon_purple','neon_blue','neon_green','neon_cyan','neon_orange')),
  glow_enabled BOOLEAN NOT NULL DEFAULT true,
  animations_enabled BOOLEAN NOT NULL DEFAULT true,
  sounds_enabled BOOLEAN NOT NULL DEFAULT false,
  transparency_level TEXT NOT NULL DEFAULT 'medium' CHECK (transparency_level IN ('none','low','medium','high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefs_all_own ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER prefs_set_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. XP / level functions (centralised formula)
CREATE OR REPLACE FUNCTION public.xp_for_level(_level INTEGER)
RETURNS BIGINT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (100 * GREATEST(_level, 1))::BIGINT;
$$;

CREATE OR REPLACE FUNCTION public.level_from_xp(_xp BIGINT)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE lvl INTEGER := 1; remaining BIGINT := GREATEST(COALESCE(_xp,0),0);
BEGIN
  WHILE remaining >= public.xp_for_level(lvl) AND lvl < 1000 LOOP
    remaining := remaining - public.xp_for_level(lvl);
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_xp(_user_id UUID, _amount INTEGER)
RETURNS public.user_xp LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.user_xp%ROWTYPE;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  INSERT INTO public.user_xp (user_id, xp, level) VALUES (_user_id, _amount, public.level_from_xp(_amount))
  ON CONFLICT (user_id) DO UPDATE
    SET xp = public.user_xp.xp + _amount,
        level = public.level_from_xp(public.user_xp.xp + _amount),
        updated_at = now()
  RETURNING * INTO row;
  RETURN row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_badge(_user_id UUID, _slug TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bid UUID;
BEGIN
  SELECT id INTO bid FROM public.badges WHERE slug = _slug;
  IF bid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_badges (user_id, badge_id) VALUES (_user_id, bid)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- 9. real event hooks: message sent, server created, voice join is app-side
CREATE OR REPLACE FUNCTION public.on_message_sent_rewards()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_xp(NEW.author_id, 5);
  PERFORM public.grant_badge(NEW.author_id, 'FIRST_MESSAGE');
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_rewards AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_sent_rewards();

CREATE OR REPLACE FUNCTION public.on_server_created_rewards()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_xp(NEW.owner_id, 50);
  PERFORM public.grant_badge(NEW.owner_id, 'FIRST_SERVER');
  PERFORM public.grant_badge(NEW.owner_id, 'FOUNDER');
  RETURN NEW;
END;
$$;
CREATE TRIGGER servers_rewards AFTER INSERT ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.on_server_created_rewards();

-- 10. realtime for presence/profile changes
ALTER TABLE public.user_game_presence REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
