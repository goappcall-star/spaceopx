-- Existing users retain the undecorated avatar. Existing profiles RLS applies.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_frame text NOT NULL DEFAULT 'default'
  CHECK (avatar_frame IN ('default', 'neon', 'orbit', 'royal'));
NOTIFY pgrst, 'reload schema';
