DROP POLICY IF EXISTS games_select_authenticated ON public.games;
CREATE POLICY games_select_authenticated
ON public.games
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS badges_select_authenticated ON public.badges;
CREATE POLICY badges_select_authenticated
ON public.badges
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS avatars_read_authenticated ON storage.objects;
CREATE POLICY avatars_read_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS banners_read_authenticated ON storage.objects;
CREATE POLICY banners_read_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'banners'
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS game_assets_read_authenticated ON storage.objects;
CREATE POLICY game_assets_read_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'game-assets'
  AND owner_id = (SELECT auth.uid()::text)
);