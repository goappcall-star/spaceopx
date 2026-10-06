ALTER TABLE public.channels ADD COLUMN is_afk boolean NOT NULL DEFAULT false;
ALTER TABLE public.channels ADD CONSTRAINT afk_requires_voice CHECK (NOT is_afk OR type='voice');
CREATE UNIQUE INDEX one_afk_channel_per_server ON public.channels(server_id) WHERE is_afk;
NOTIFY pgrst,'reload schema';
