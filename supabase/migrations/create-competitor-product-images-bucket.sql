insert into storage.buckets (id, name, public)
values ('competitor-product-images', 'competitor-product-images', true)
on conflict (id) do nothing;

drop policy if exists "competitor product images owner read" on storage.objects;
create policy "competitor product images owner read" on storage.objects
for select using (
  bucket_id = 'competitor-product-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "competitor product images owner insert" on storage.objects;
create policy "competitor product images owner insert" on storage.objects
for insert with check (
  bucket_id = 'competitor-product-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "competitor product images owner update" on storage.objects;
create policy "competitor product images owner update" on storage.objects
for update using (
  bucket_id = 'competitor-product-images'
  and auth.uid()::text = split_part(name, '/', 1)
) with check (
  bucket_id = 'competitor-product-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "competitor product images owner delete" on storage.objects;
create policy "competitor product images owner delete" on storage.objects
for delete using (
  bucket_id = 'competitor-product-images'
  and auth.uid()::text = split_part(name, '/', 1)
);
