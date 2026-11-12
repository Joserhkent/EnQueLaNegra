-- MIGRACIÓN P0: Trazabilidad de Caja por Sesión, Fecha de Negocio y Arqueo Profesional

-- 1. Esquema privado de mantenimiento para respaldo previo
CREATE SCHEMA IF NOT EXISTS _mantenimiento;

CREATE TABLE IF NOT EXISTS _mantenimiento.backup_cajasesion_p0 AS SELECT * FROM "CajaSesion";
CREATE TABLE IF NOT EXISTS _mantenimiento.backup_order_p0 AS SELECT * FROM "Order";
CREATE TABLE IF NOT EXISTS _mantenimiento.backup_pago_p0 AS SELECT * FROM "Pago";

-- 2. Modificaciones estructurales en CajaSesion
ALTER TABLE "CajaSesion"
  ADD COLUMN IF NOT EXISTS "fechaNegocio" TEXT,
  ADD COLUMN IF NOT EXISTS "fondoQueQueda" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "efectivoRetirado" DOUBLE PRECISION DEFAULT 0;

-- Poblar fechaNegocio para sesiones existentes con conversión robusta (UTC -> America/Lima) y corte 06:00
UPDATE "CajaSesion"
SET "fechaNegocio" = TO_CHAR(
  CASE 
    WHEN EXTRACT(HOUR FROM (("fechaApertura" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')) < 6 
    THEN (("fechaApertura" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima') - INTERVAL '1 day'
    ELSE (("fechaApertura" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')
  END,
  'YYYY-MM-DD'
)
WHERE "fechaNegocio" IS NULL;

ALTER TABLE "CajaSesion" ALTER COLUMN "fechaNegocio" SET NOT NULL;

-- 3. Modificaciones estructurales en Order y Pago
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "cajaSesionId" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaNegocio" TEXT;

ALTER TABLE "Pago"
  ADD COLUMN IF NOT EXISTS "cajaSesionId" TEXT;

-- 4. Foreign Keys e Índices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_cajaSesionId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_cajaSesionId_fkey"
      FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pago_cajaSesionId_fkey') THEN
    ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cajaSesionId_fkey"
      FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_order_cajasesionid" ON "Order"("cajaSesionId");
CREATE INDEX IF NOT EXISTS "idx_pago_cajasesionid" ON "Pago"("cajaSesionId");
CREATE INDEX IF NOT EXISTS "idx_order_fechanegocio" ON "Order"("fechaNegocio");

-- 5. Normalización y Cierre encadenado de sesiones ABIERTAS antiguas evitando solapamientos
WITH sesiones_abiertas_ordenadas AS (
  SELECT id, "fechaApertura",
         LEAD("fechaApertura") OVER (ORDER BY "fechaApertura" ASC) AS fecha_siguiente
  FROM "CajaSesion"
  WHERE estado = 'ABIERTA'
)
UPDATE "CajaSesion" s
SET estado = 'CERRADA',
    "fechaCierre" = so.fecha_siguiente,
    "notasCierre" = 'Cierre encadenado de normalización retroactiva pre-P0'
FROM sesiones_abiertas_ordenadas so
WHERE s.id = so.id AND so.fecha_siguiente IS NOT NULL;

-- Índice Único Parcial: Garantiza una sola sesión ABIERTA en PostgreSQL
CREATE UNIQUE INDEX IF NOT EXISTS "caja_sesion_unica_abierta_idx"
  ON "CajaSesion" ("estado")
  WHERE ("estado" = 'ABIERTA');

-- 6. Backfill Retrocompatible:
-- A) Pagos de la sesión actualmente ABIERTA (prioritario)
UPDATE "Pago" p
SET "cajaSesionId" = s.id
FROM "CajaSesion" s
WHERE p."cajaSesionId" IS NULL
  AND s.estado = 'ABIERTA'
  AND p."fecha" >= s."fechaApertura";

-- B) Pagos de sesiones CERRADAS
UPDATE "Pago" p
SET "cajaSesionId" = s.id
FROM "CajaSesion" s
WHERE p."cajaSesionId" IS NULL
  AND s.estado = 'CERRADA'
  AND p."fecha" >= s."fechaApertura"
  AND p."fecha" <= s."fechaCierre";

-- C) Backfill de Order derivado de sus Pago (asignando la sesión del último pago del pedido)
WITH ultimo_pago_pedido AS (
  SELECT DISTINCT ON ("orderId") "orderId", "cajaSesionId"
  FROM "Pago"
  WHERE "cajaSesionId" IS NOT NULL
  ORDER BY "orderId", "fecha" DESC
)
UPDATE "Order" o
SET "cajaSesionId" = up."cajaSesionId",
    "fechaNegocio" = s."fechaNegocio"
FROM ultimo_pago_pedido up
JOIN "CajaSesion" s ON s.id = up."cajaSesionId"
WHERE o.id = up."orderId"
  AND o."cajaSesionId" IS NULL;

-- D) Pedidos sin pagos (cancelados o cuentas abiertas): asociar por createdAt
UPDATE "Order" o
SET "cajaSesionId" = s.id,
    "fechaNegocio" = s."fechaNegocio"
FROM "CajaSesion" s
WHERE o."cajaSesionId" IS NULL
  AND s.estado = 'ABIERTA'
  AND o."createdAt" >= s."fechaApertura";

UPDATE "Order" o
SET "cajaSesionId" = s.id,
    "fechaNegocio" = s."fechaNegocio"
FROM "CajaSesion" s
WHERE o."cajaSesionId" IS NULL
  AND s.estado = 'CERRADA'
  AND o."createdAt" >= s."fechaApertura"
  AND o."createdAt" <= s."fechaCierre";

-- E) Sesión Legacy para huérfanos acotada por MIN y MAX reales
DO $$
DECLARE
  min_pago_fecha TIMESTAMP;
  max_pago_fecha TIMESTAMP;
  legacy_fecha_negocio TEXT;
BEGIN
  SELECT MIN("fecha"), MAX("fecha")
  INTO min_pago_fecha, max_pago_fecha
  FROM "Pago"
  WHERE "cajaSesionId" IS NULL;

  IF min_pago_fecha IS NOT NULL THEN
    legacy_fecha_negocio := TO_CHAR(
      CASE 
        WHEN EXTRACT(HOUR FROM ((min_pago_fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')) < 6 
        THEN ((min_pago_fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima') - INTERVAL '1 day'
        ELSE ((min_pago_fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')
      END,
      'YYYY-MM-DD'
    );

    INSERT INTO "CajaSesion" (
      "id", "estado", "montoInicial", "fechaApertura", "fechaCierre", "fechaNegocio",
      "usuarioApertura", "usuarioCierre", "notasCierre", "createdAt", "updatedAt"
    )
    VALUES (
      'legacy-session-migracion', 'CERRADA', 0, min_pago_fecha, max_pago_fecha, legacy_fecha_negocio,
      'Sistema (Migración)', 'Sistema (Migración)', 'Sesión histórica para cobros previos a P0', min_pago_fecha, max_pago_fecha
    )
    ON CONFLICT (id) DO NOTHING;

    UPDATE "Pago"
    SET "cajaSesionId" = 'legacy-session-migracion'
    WHERE "cajaSesionId" IS NULL;

    UPDATE "Order"
    SET "cajaSesionId" = 'legacy-session-migracion',
        "fechaNegocio" = legacy_fecha_negocio
    WHERE "cajaSesionId" IS NULL;
  END IF;
END $$;
