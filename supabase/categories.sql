-- Tecnophone Market — categorías del catálogo, editables desde el admin
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run
--
-- Antes de esto, las categorías ("usados", "nuevos", "otras") estaban
-- fijas en el código (index.html y admin.html) y limitadas por un CHECK
-- en products.group_key. Esta tabla las vuelve datos editables: agregar
-- una categoría nueva pasa a ser una fila más acá, sin tocar código.

create table if not exists public.categories (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text not null unique,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Migra las 3 categorías actuales con los mismos slugs que ya usa
-- products.group_key — así ningún producto existente queda sin
-- categoría válida. "on conflict do nothing" hace que correr este
-- script de nuevo no duplique filas ni pise cambios que ya hayas hecho.
insert into public.categories (name, slug, sort_order) values
  ('iPhones usados', 'usados', 1),
  ('iPhones nuevos', 'nuevos', 2),
  ('Otras marcas',   'otras',  3)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────
-- Relación con products: reemplaza el CHECK fijo por una foreign key
-- ─────────────────────────────────────────────────────────────────
-- products.group_key seguía llamándose igual y guardando los mismos
-- valores de texto de siempre — no se toca ni un dato de products. Lo
-- único que cambia es CÓMO se valida: antes un CHECK con la lista de 3
-- valores fija en el código SQL; ahora una foreign key contra
-- categories.slug, que crece sola a medida que agregás categorías.
--
-- Buscamos y borramos el CHECK existente por su definición (no por un
-- nombre fijo) para no depender de cómo Postgres lo haya nombrado.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.products'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%group_key%'
  loop
    execute format('alter table public.products drop constraint %I', con.conname);
  end loop;
end $$;

-- "on update cascade": si el día de mañana renombrás el slug de una
-- categoría ya creada, todos los productos que la usaban se actualizan
-- solos, en la misma operación — nunca quedan con un group_key viejo.
-- Sin "on delete", Postgres rechaza borrar una categoría mientras haya
-- productos usándola (comportamiento por default = RESTRICT).
alter table public.products
  add constraint products_group_key_fkey
  foreign key (group_key) references public.categories(slug)
  on update cascade;

-- ─────────────────────────────────────────────────────────────────
-- RLS: lectura pública de categorías activas, edición solo logueado
-- ─────────────────────────────────────────────────────────────────
alter table public.categories enable row level security;

drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories"
  on public.categories
  for select
  to anon
  using (is_active = true);

drop policy if exists "Authenticated can read categories" on public.categories;
create policy "Authenticated can read categories"
  on public.categories
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can insert categories" on public.categories;
create policy "Authenticated can insert categories"
  on public.categories
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update categories" on public.categories;
create policy "Authenticated can update categories"
  on public.categories
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete categories" on public.categories;
create policy "Authenticated can delete categories"
  on public.categories
  for delete
  to authenticated
  using (true);

-- GRANTs explícitos: las políticas de arriba dicen QUÉ FILAS puede
-- tocar cada rol, pero Postgres exige además este permiso de tabla
-- aparte — el mismo paso que se nos pasó la primera vez con "products".
grant usage on schema public to anon, authenticated;
grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;
