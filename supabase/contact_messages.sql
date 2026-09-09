-- Tecnophone Market — mensajes del formulario de contacto
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run

create table if not exists public.contact_messages (
  id         bigint generated always as identity primary key,
  name       text not null,
  email      text,
  phone      text,
  message    text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Cualquiera (sin loguearse) puede insertar un mensaje nuevo — es lo
-- que necesita el formulario público del sitio.
drop policy if exists "Anon can insert contact messages" on public.contact_messages;
create policy "Anon can insert contact messages"
  on public.contact_messages
  for insert
  to anon
  with check (true);

-- Solo usuarios logueados (el panel de admin) pueden leer, actualizar
-- (marcar como leído) o borrar mensajes.
drop policy if exists "Authenticated can read contact messages" on public.contact_messages;
create policy "Authenticated can read contact messages"
  on public.contact_messages
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can update contact messages" on public.contact_messages;
create policy "Authenticated can update contact messages"
  on public.contact_messages
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete contact messages" on public.contact_messages;
create policy "Authenticated can delete contact messages"
  on public.contact_messages
  for delete
  to authenticated
  using (true);

-- GRANTs explícitos: las políticas de arriba dicen QUÉ FILAS puede
-- tocar cada rol, pero Postgres exige además este permiso de tabla
-- aparte — el mismo paso que se nos pasó la primera vez con "products".
grant usage on schema public to anon, authenticated;
grant insert on public.contact_messages to anon;
grant select, update, delete on public.contact_messages to authenticated;
