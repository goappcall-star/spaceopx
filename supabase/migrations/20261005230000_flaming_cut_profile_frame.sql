-- Add the imported profile-only overlay without changing avatars, roles or RLS.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_frame_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_frame_check CHECK (
  profile_frame IN ('none','aurora','cosmic','royal','ember','sakura',
    'crimson-flow','shadow-rise','celestial-energy','void-eye','thunderstorm',
    'crimson-moon','neon-impact','spirit-flame','flaming-cut')
);
NOTIFY pgrst, 'reload schema';
