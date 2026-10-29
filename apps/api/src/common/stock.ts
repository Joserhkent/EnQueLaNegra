import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma.service';

// Margen para cantidades decimales de receta (0.15 kg, etc.)
const EPS = 1e-6;

// No se vende lo que no hay: antes de descontar se revisa que cada insumo alcance
// y se rechaza con un mensaje que dice qué falta.
export async function assertStockSuficiente(
  prisma: PrismaService,
  deducciones: Map<string, number>,
) {
  const ids = [...deducciones.entries()]
    .filter(([, cantidad]) => cantidad > 0)
    .map(([id]) => id);
  if (ids.length === 0) return;

  const insumos = await prisma.insumo.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, stockActual: true, unidadMedida: true },
  });
  const faltantes = insumos
    .filter((i) => i.stockActual + EPS < (deducciones.get(i.id) ?? 0))
    .map(
      (i) =>
        `${i.nombre} (quedan ${Math.max(0, i.stockActual)} ${i.unidadMedida}, se necesitan ${deducciones.get(i.id)})`,
    );
  if (faltantes.length) {
    throw new BadRequestException(
      `Sin stock suficiente: ${faltantes.join('; ')}`,
    );
  }
}

// Descuento que solo se aplica si hay stock: si otra venta se lo llevó entre el
// chequeo y la escritura, no encuentra la fila (P2025) y la transacción entera se
// deshace en vez de dejar el insumo en negativo.
export function descontarStock(
  prisma: PrismaService,
  insumoId: string,
  cantidad: number,
) {
  return prisma.insumo.update({
    where: { id: insumoId, stockActual: { gte: cantidad - EPS } },
    data: { stockActual: { decrement: cantidad } },
  });
}

export function esSinStock(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

export const sinStockConcurrente = () =>
  new BadRequestException(
    'Otro pedido acaba de usar el stock de un insumo. Revisa el inventario y vuelve a intentar.',
  );
