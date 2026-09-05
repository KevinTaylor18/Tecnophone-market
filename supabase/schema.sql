-- Tecnophone Market — tabla de catálogo
-- Ejecutar una sola vez en: Supabase Dashboard > SQL Editor > New query > Run
-- Proyecto: vkglwajqvxizxfcqfdsd

create table if not exists public.products (
  id             bigint generated always as identity primary key,
  group_key      text not null check (group_key in ('usados', 'nuevos', 'otras')),
  title          text not null,
  condition_label text,
  original_price numeric(12,2),
  current_price  numeric(12,2) not null,
  installment_label text,
  discount_label text,
  image_url      text,
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Habilita RLS y permite SOLO lectura pública (el sitio usa la clave "anon").
-- Nadie puede insertar, editar ni borrar productos con esa clave.
alter table public.products enable row level security;

drop policy if exists "Public read access" on public.products;
create policy "Public read access"
  on public.products
  for select
  to anon
  using (is_active = true);

-- La política RLS de arriba controla QUÉ filas puede ver "anon", pero
-- Postgres además exige un permiso de tabla aparte para poder leerla:
grant usage on schema public to anon;
grant select on public.products to anon;

-- Carga el catálogo actual (9 equipos). Si volvés a correr este script,
-- primero vacía la tabla para no duplicar filas:
-- truncate public.products restart identity;

insert into public.products
  (group_key, title, condition_label, original_price, current_price, installment_label, discount_label, sort_order)
values
  ('usados', 'iPhone 12 128GB',       'Usado · Batería 91%',  649990.00,  579990.00, 'Hasta 6 cuotas sin interés', '10% off pagando en efectivo', 1),
  ('usados', 'iPhone 13 128GB',       'Usado · Batería 88%',  899990.00,  819990.00, 'Hasta 6 cuotas sin interés', '10% off pagando en efectivo', 2),
  ('usados', 'iPhone 14 Pro 256GB',   'Usado · Batería 94%', 1399990.00, 1249990.00, 'Hasta 12 cuotas fijas',      '10% off pagando en efectivo', 3),
  ('usados', 'iPhone 15 128GB',       'Usado · Batería 100%',1549990.00, 1429990.00, 'Hasta 12 cuotas fijas',      '10% off pagando en efectivo', 4),
  ('nuevos', 'iPhone 16 128GB',       'Nuevo · Sellado',     1999990.00, 1859990.00, 'Hasta 12 cuotas fijas',      '10% off pagando en efectivo', 1),
  ('nuevos', 'iPhone 16 Pro 256GB',   'Nuevo · Sellado',     2749990.00, 2589990.00, 'Hasta 12 cuotas fijas',      '10% off pagando en efectivo', 2),
  ('otras',  'Samsung Galaxy S24',    'Nuevo · Sellado',     1299990.00, 1179990.00, 'Hasta 12 cuotas fijas',      '10% off pagando en efectivo', 1),
  ('otras',  'Xiaomi Redmi Note 14',  'Nuevo · Sellado',      549990.00,  489990.00, 'Hasta 6 cuotas sin interés', '10% off pagando en efectivo', 2),
  ('otras',  'Samsung Galaxy S23',    'Usado · Batería 92%',  899990.00,  789990.00, 'Hasta 6 cuotas sin interés', '10% off pagando en efectivo', 3);
