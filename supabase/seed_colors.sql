-- Tecnophone Market — colores de ejemplo para el catálogo actual
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
--
-- Convención: un solo color = unidad usada única.
--             varios separados por coma = modelo nuevo sellado con opciones.
--
-- NOTA: los productos 1, 2, 3, 5 y 6 (iPhone 12, 13, 14 Pro, 16 y 16 Pro)
-- ya tienen un color cargado por vos desde el panel de admin (Azul, Verde,
-- Dorado, Blanco y Morado respectivamente) — no los toco para no pisar lo
-- que ya elegiste. Este script solo completa los 4 que seguían vacíos.

update public.products set color = 'Negro' where id = 4; -- iPhone 15 128GB (usado)

update public.products set color = 'Negro Zafiro, Gris Mármol, Violeta Cobalto, Ámbar'
  where id = 7; -- Samsung Galaxy S24 (nuevo sellado)
update public.products set color = 'Negro, Verde Bosque, Lavanda'
  where id = 8; -- Xiaomi Redmi Note 14 (nuevo sellado)
update public.products set color = 'Lavanda'
  where id = 9; -- Samsung Galaxy S23 (usado)
