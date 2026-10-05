-- Preserve existing styles; add original LobbyX frames without changing RLS.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_frame_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_frame_check CHECK (
  profile_frame IN ('none','aurora','cosmic','royal','ember','sakura',
    'crimson-flow','shadow-rise','celestial-energy','void-eye','thunderstorm','crimson-moon','neon-impact','spirit-flame')
);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_frame_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_frame_check CHECK (
  avatar_frame IN ('default','neon','orbit','royal',
    'crimson-flow','shadow-rise','celestial-energy','void-eye','thunderstorm','crimson-moon','neon-impact','spirit-flame')
);
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS frame_animations_enabled boolean NOT NULL DEFAULT true;
NOTIFY pgrst, 'reload schema';
