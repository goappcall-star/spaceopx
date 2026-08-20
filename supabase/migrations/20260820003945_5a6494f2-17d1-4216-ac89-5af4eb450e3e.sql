ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS input_device_id text,
  ADD COLUMN IF NOT EXISTS output_device_id text,
  ADD COLUMN IF NOT EXISTS input_volume integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS output_volume integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS ptt_key text NOT NULL DEFAULT 'KeyV';

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_input_mode_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_input_mode_check CHECK (input_mode IN ('open', 'ptt'));

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_input_volume_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_input_volume_check CHECK (input_volume BETWEEN 0 AND 200);

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_output_volume_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_output_volume_check CHECK (output_volume BETWEEN 0 AND 200);