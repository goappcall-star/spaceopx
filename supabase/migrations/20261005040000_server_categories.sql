BEGIN;
CREATE TABLE public.server_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, server_id)
);
ALTER TABLE public.server_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_categories TO authenticated;
GRANT ALL ON public.server_categories TO service_role;
CREATE POLICY categories_read ON public.server_categories FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY categories_create ON public.server_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'manage_channels'));
CREATE POLICY categories_update ON public.server_categories FOR UPDATE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'manage_channels'))
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'manage_channels'));
CREATE POLICY categories_delete ON public.server_categories FOR DELETE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'manage_channels'));
ALTER TABLE public.channels ADD COLUMN category_id uuid;
-- Composite key forbids assigning a channel to another server's category.
ALTER TABLE public.channels ADD CONSTRAINT channels_category_server_fkey
  FOREIGN KEY (category_id, server_id) REFERENCES public.server_categories(id, server_id)
  ON DELETE SET NULL (category_id);
CREATE INDEX channels_category_position_idx ON public.channels(server_id, category_id, position);
CREATE INDEX categories_server_position_idx ON public.server_categories(server_id, position);
DROP POLICY channels_insert_admins ON public.channels;
DROP POLICY channels_update_admins ON public.channels;
DROP POLICY channels_delete_admins ON public.channels;
CREATE POLICY channels_insert_admins ON public.channels FOR INSERT TO authenticated
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'manage_channels'));
CREATE POLICY channels_update_admins ON public.channels FOR UPDATE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'manage_channels'))
  WITH CHECK (public.has_server_permission(server_id, auth.uid(), 'manage_channels'));
CREATE POLICY channels_delete_admins ON public.channels FOR DELETE TO authenticated
  USING (public.has_server_permission(server_id, auth.uid(), 'manage_channels'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='server_categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_categories;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='channels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
