CREATE POLICY "avatars_read_authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "banners_read_authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'banners');
CREATE POLICY "banners_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "banners_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "banners_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "game_assets_read_authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'game-assets');
