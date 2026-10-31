-- Presentación de compra de cada insumo (lata, bolsa, pollo…) y cuánto trae en su
-- unidad de medida. Opcional: los insumos existentes quedan sin presentación.
ALTER TABLE "Insumo" ADD COLUMN "presentacionNombre" TEXT;
ALTER TABLE "Insumo" ADD COLUMN "presentacionCantidad" DOUBLE PRECISION;
