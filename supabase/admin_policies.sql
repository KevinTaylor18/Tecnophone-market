-- Tecnophone Market — permisos de administración del catálogo
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run
-- Requisito para que esto sea seguro: los usuarios "authenticated" deben
-- crearse SOLO a mano desde Authentication > Users (no dejar habilitado
-- el registro público de cuentas) — ver checklist al final del archivo.

-- Los usuarios logueados pueden LEER el catálogo completo (incluidos
-- productos inactivos, a diferencia del público que solo ve is_active=true).
-- Sin esta política, un admin logueado no podría ver nada para editar:
-- la política "Public read access" existente es "to anon" únicamente,
-- y no aplica al rol "authenticated".
create policy "Authenticated users can read"
  on public.products
  for select
  to authenticated
  using (true);

-- Los usuarios logueados pueden editar productos existentes.
create policy "Authenticated users can update"
  on public.products
  for update
  to authenticated
  using (true)
  with check (true);

-- Los usuarios logueados pueden crear productos nuevos.
create policy "Authenticated users can insert"
  on public.products
  for insert
  to authenticated
  with check (true);

-- Los usuarios logueados pueden borrar productos.
create policy "Authenticated users can delete"
  on public.products
  for delete
  to authenticated
  using (true);

-- Las políticas de arriba controlan QUÉ FILAS puede tocar "authenticated",
-- pero al igual que con "anon", Postgres exige además un GRANT de tabla
-- aparte para poder tocarla. Sin esto, cualquier operación falla con
-- "permission denied for table products" antes de llegar a evaluar RLS.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- CHECKLIST antes de dar esto por seguro (revisar una sola vez):
--
-- 1. Dashboard > Authentication > Sign In / Providers:
--    confirmá que el registro público esté deshabilitado (o que no
--    exista ningún formulario de "crear cuenta" en el sitio). Estas
--    políticas asumen que la ÚNICA forma de obtener una cuenta es que
--    vos la crees a mano en Authentication > Users.
--
-- 2. Cualquier cuenta "authenticated" que crees (para vos o para un
--    cliente autorizado) va a tener permiso TOTAL para editar, crear
--    y borrar CUALQUIER producto — no hay distinción de roles entre
--    "admin" y "cliente autorizado". Si en el futuro querés que un
--    cliente autorizado solo pueda, por ejemplo, editar pero no
--    borrar, avisame y armamos una tabla de roles en vez de esto.
-- ─────────────────────────────────────────────────────────────────
