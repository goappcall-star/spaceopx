-- Shared cosmetics belong to profiles so other users see the same decoration.
-- Existing own-profile UPDATE policies remain in effect; no new grants or roles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nameplate text NOT NULL DEFAULT 'none'
    CHECK (nameplate IN ('none', 'aurora', 'cosmic', 'royal', 'ember', 'sakura')),
  ADD COLUMN IF NOT EXISTS profile_frame text NOT NULL DEFAULT 'none'
    CHECK (profile_frame IN ('none', 'aurora', 'cosmic', 'royal', 'ember', 'sakura'));
NOTIFY pgrst, 'reload schema';
