-- Tecnophone Market — soporte para varias fotos por producto
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run
--
-- "image_url" pasa a "image_urls" y ahora puede guardar varias URLs
-- separadas por coma (misma convención que ya usamos en "color").
-- Renombrar una columna no cambia sus datos ni sus permisos —
-- las URLs que ya tenías cargadas quedan intactas como "lista de una".

alter table public.products rename column image_url to image_urls;
