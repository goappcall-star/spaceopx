
CREATE POLICY "dm_attachments_select_members" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dm-attachments'
    AND public.is_conversation_member(NULLIF(split_part(name, '/', 1), '')::uuid, auth.uid())
  );

CREATE POLICY "dm_attachments_insert_members" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dm-attachments'
    AND owner = auth.uid()
    AND public.is_conversation_member(NULLIF(split_part(name, '/', 1), '')::uuid, auth.uid())
  );

CREATE POLICY "dm_attachments_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dm-attachments' AND owner = auth.uid());
