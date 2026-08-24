DROP POLICY IF EXISTS server_assets_read ON storage.objects;
CREATE POLICY server_assets_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'server-assets' AND public.is_server_member((storage.foldername(name))[1]::uuid, auth.uid()));

DROP POLICY IF EXISTS server_assets_insert ON storage.objects;
CREATE POLICY server_assets_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'server-assets' AND public.has_server_permission((storage.foldername(name))[1]::uuid, auth.uid(), 'manage_server'));

DROP POLICY IF EXISTS server_assets_update ON storage.objects;
CREATE POLICY server_assets_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'server-assets' AND public.has_server_permission((storage.foldername(name))[1]::uuid, auth.uid(), 'manage_server'))
  WITH CHECK (bucket_id = 'server-assets' AND public.has_server_permission((storage.foldername(name))[1]::uuid, auth.uid(), 'manage_server'));

DROP POLICY IF EXISTS server_assets_delete ON storage.objects;
CREATE POLICY server_assets_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'server-assets' AND public.has_server_permission((storage.foldername(name))[1]::uuid, auth.uid(), 'manage_server'));