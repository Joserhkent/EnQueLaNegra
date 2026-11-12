-- SCRIPT DE ROLLBACK (DOWN) - MIGRACIÓN P0
-- Deshace la migración P0 sin borrar ventas, pedidos ni cobros creados con posterioridad al despliegue.

-- 1. Eliminar restricciones de llave foránea e índices nuevos
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_cajaSesionId_fkey";
ALTER TABLE "Pago" DROP CONSTRAINT IF EXISTS "Pago_cajaSesionId_fkey";

DROP INDEX IF EXISTS "caja_sesion_unica_abierta_idx";
DROP INDEX IF EXISTS "idx_order_cajasesionid";
DROP INDEX IF EXISTS "idx_pago_cajasesionid";
DROP INDEX IF EXISTS "idx_order_fechanegocio";

-- 2. Restaurar estado, fechaCierre y notasCierre de CajaSesion previos a la normalización
--    NOTA: Solo restaura las sesiones forzadas por la migración ('Cierre encadenado de normalización retroactiva pre-P0')
--    Si una caja fue cerrada legítimamente post-migración, NO se reabre.
--    NO se tocan Order ni Pago para no destruir ventas generadas post-migración.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '_mantenimiento' AND table_name = 'backup_cajasesion_p0') THEN
    UPDATE "CajaSesion" s
    SET "estado" = b."estado",
        "fechaCierre" = b."fechaCierre",
        "notasCierre" = b."notasCierre"
    FROM _mantenimiento.backup_cajasesion_p0 b
    WHERE s.id = b.id
      AND s."notasCierre" = 'Cierre encadenado de normalización retroactiva pre-P0';

    -- Eliminar la sesión legacy si fue creada durante la migración
    DELETE FROM "CajaSesion" WHERE id = 'legacy-session-migracion';
  END IF;
END $$;

-- 3. Eliminar columnas añadidas en Order, Pago y CajaSesion
ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "cajaSesionId",
  DROP COLUMN IF EXISTS "fechaNegocio";

ALTER TABLE "Pago"
  DROP COLUMN IF EXISTS "cajaSesionId";

ALTER TABLE "CajaSesion"
  DROP COLUMN IF EXISTS "fechaNegocio",
  DROP COLUMN IF EXISTS "fondoQueQueda",
  DROP COLUMN IF EXISTS "efectivoRetirado";

-- 4. Registro en Prisma Migrate (a ejecutar desde CLI):
-- npx prisma migrate resolve --rolled-back 20261111180000_caja_sesion_trazabilidad
