-- Tecnophone Market — re-verificación de permisos de subida al bucket
-- "product-images". Seguro de correr aunque ya hayas ejecutado
-- storage_policies.sql antes: borra y vuelve a crear las políticas
-- (no duplica nada) y refuerza el GRANT por si faltaba.
--
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run

-- 1) GRANT de tabla (aparte de las políticas RLS, por si no se aplicó
--    la vez pasada o el proyecto no lo trae por defecto).
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

-- 2) Re-crea las políticas de RLS (por si alguna quedó mal aplicada).
drop policy if exists "Public read access on product-images" on storage.objects;
create policy "Public read access on product-images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated users can upload to product-images" on storage.objects;
create policy "Authenticated users can upload to product-images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can update product-images" on storage.objects;
create policy "Authenticated users can update product-images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can delete from product-images" on storage.objects;
create policy "Authenticated users can delete from product-images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');

-- 3) Diagnóstico: mirá el resultado de esto. Si "allowed_mime_types" no
--    es null y no incluye tipos como "image/png" o "image/jpeg", o si
--    "file_size_limit" es muy chico, el bucket mismo estaría rechazando
--    la subida sin que sea un tema de políticas.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'product-images';
