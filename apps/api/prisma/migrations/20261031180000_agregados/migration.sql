-- Agregados editables (antes estaban fijos en el código)
CREATE TABLE "Agregado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "insumoId" TEXT NOT NULL,
    "consumo" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agregado_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Agregado" ADD CONSTRAINT "Agregado_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cuánto insumo gasta cada extra; los extras ya vendidos quedan como estaban (1)
ALTER TABLE "OrderItemExtra" ADD COLUMN "consumo" DOUBLE PRECISION NOT NULL DEFAULT 1;
