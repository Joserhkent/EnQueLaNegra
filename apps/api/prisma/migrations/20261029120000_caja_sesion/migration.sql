-- La tabla de sesiones de caja se creó en Supabase con `prisma db push` y nunca tuvo
-- migración: una base nueva creada con `prisma migrate deploy` quedaba sin ella.
-- Es idempotente para poder aplicarse también sobre bases donde ya existe.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoCaja') THEN
    CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CajaSesion" (
    "id" TEXT NOT NULL,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "montoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioAperturaId" TEXT,
    "usuarioApertura" TEXT NOT NULL DEFAULT 'Cajero',
    "notasApertura" TEXT,
    "fechaCierre" TIMESTAMP(3),
    "usuarioCierreId" TEXT,
    "usuarioCierre" TEXT,
    "totalVendido" DOUBLE PRECISION DEFAULT 0,
    "efectivoVentas" DOUBLE PRECISION DEFAULT 0,
    "yapePlin" DOUBLE PRECISION DEFAULT 0,
    "tarjeta" DOUBLE PRECISION DEFAULT 0,
    "cantidadPedidos" INTEGER DEFAULT 0,
    "efectivoEsperado" DOUBLE PRECISION DEFAULT 0,
    "efectivoReal" DOUBLE PRECISION,
    "diferencia" DOUBLE PRECISION,
    "notasCierre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CajaSesion_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CajaSesion_usuarioAperturaId_fkey') THEN
    ALTER TABLE "CajaSesion" ADD CONSTRAINT "CajaSesion_usuarioAperturaId_fkey"
      FOREIGN KEY ("usuarioAperturaId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CajaSesion_usuarioCierreId_fkey') THEN
    ALTER TABLE "CajaSesion" ADD CONSTRAINT "CajaSesion_usuarioCierreId_fkey"
      FOREIGN KEY ("usuarioCierreId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
