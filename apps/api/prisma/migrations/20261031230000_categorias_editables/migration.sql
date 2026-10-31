-- Cada categoría de la carta dice si sus platos aceptan agregados y notas de comida.
-- Antes se decidía por el nombre en el código: renombrar «Jugos» le habría dado agregados.
ALTER TABLE "Categoria" ADD COLUMN "aceptaAgregados" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Categoria" SET "aceptaAgregados" = false
WHERE tipo = 'PRODUCTO'
  AND nombre IN ('Agregados', 'Batidos', 'Jugos', 'Refrescos', 'Bebidas en lata', 'Gaseosas y otras bebidas');

-- «Agregados» se mostraba siempre al final por código; ahora el orden lo decide la jefa,
-- así que se deja al final de una vez.
UPDATE "Categoria" SET orden = 100000 WHERE tipo = 'PRODUCTO' AND nombre = 'Agregados';

-- Orden consecutivo y sin empates (había categorías con el mismo número)
WITH numeradas AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tipo ORDER BY orden, nombre) - 1 AS n
  FROM "Categoria"
)
UPDATE "Categoria" c SET orden = numeradas.n FROM numeradas WHERE c.id = numeradas.id;
