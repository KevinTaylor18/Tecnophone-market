-- Tecnophone Market — permisos del bucket "product-images" (Storage)
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run
--
-- Asume que el bucket "product-images" ya existe y está marcado como
-- público (así lo mencionaste). Estas políticas viven en storage.objects
-- y son aparte de las políticas de la tabla public.products.
--
-- A diferencia de public.products, las tablas de storage (storage.objects,
-- storage.buckets) ya vienen con los GRANTs de tabla configurados por
-- Supabase de fábrica para "anon" y "authenticated" — no hace falta
-- repetir el paso de GRANT que sí necesitamos para nuestras propias
-- tablas. Si igual te llegara a aparecer "permission denied" al usarlo,
-- avisame y lo revisamos.

-- Cualquiera puede VER los archivos de este bucket (ya lo permite el
-- flag "público" del bucket para las URLs directas; esta política lo
-- deja explícito también para quien liste/lea vía la API del cliente).
create policy "Public read access on product-images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');

-- Solo usuarios logueados pueden subir archivos nuevos al bucket.
create policy "Authenticated users can upload to product-images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Solo usuarios logueados pueden reemplazar un archivo existente
-- (por si en algún momento subís con upsert:true).
create policy "Authenticated users can update product-images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- Solo usuarios logueados pueden borrar archivos del bucket.
create policy "Authenticated users can delete from product-images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');
