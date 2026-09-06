-- Fix: "permission denied for table products" para usuarios logueados
-- Causa: admin_policies.sql creó las políticas RLS (select/insert/update/
-- delete) para el rol "authenticated", pero se omitió el GRANT de tabla
-- que Postgres exige por separado — igual que nos pasó antes con "anon".
-- Las políticas RLS controlan QUÉ FILAS puede tocar un rol; el GRANT
-- controla si el rol puede tocar la tabla en absoluto. Sin el GRANT,
-- Postgres corta el acceso antes incluso de evaluar las políticas RLS,
-- y por eso el error es "permission denied" en vez de simplemente
-- devolver 0 filas.
--
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products to authenticated;
