-- Ιδιωτικός κάδος για εικόνες σημειώσεων (πρόσβαση μόνο με signed URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','image/heic'])
on conflict (id) do nothing;

-- Κάθε χρήστης βλέπει και γράφει μόνο στον δικό του φάκελο (πρώτο τμήμα = user_id)
create policy "own note images read" on storage.objects
  for select using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own note images insert" on storage.objects
  for insert with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own note images delete" on storage.objects
  for delete using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
