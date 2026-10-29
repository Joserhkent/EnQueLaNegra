import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma.service';

interface ItemEntrante {
  productoId?: string;
  sku: string;
}

// Resuelve los productos de una comanda contra el catálogo y toma de ahí el precio,
// nombre y sku reales (no los que manda el navegador). El frontend a veces manda el
// sku en `productoId`, por eso se busca por ambos. Un producto inexistente o agotado
// se rechaza con 400 en vez de reventar con un error de clave foránea (500).
export async function resolverProductos<T extends ItemEntrante>(
  prisma: PrismaService,
  items: T[],
) {
  const claves = [
    ...new Set(items.flatMap((i) => [i.productoId, i.sku].filter(Boolean))),
  ] as string[];
  const productos = await prisma.producto.findMany({
    where: { OR: [{ id: { in: claves } }, { sku: { in: claves } }] },
    select: {
      id: true,
      sku: true,
      nombre: true,
      precio: true,
      isAvailable: true,
    },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));
  const porSku = new Map(productos.map((p) => [p.sku, p]));

  return items.map((item) => {
    const producto =
      (item.productoId &&
        (porId.get(item.productoId) ?? porSku.get(item.productoId))) ||
      porSku.get(item.sku);
    if (!producto) {
      throw new BadRequestException(
        `El producto "${item.sku}" no existe en el catálogo`,
      );
    }
    if (!producto.isAvailable) {
      throw new BadRequestException(
        `"${producto.nombre}" está agotado o no disponible`,
      );
    }
    return {
      ...item,
      productoId: producto.id,
      sku: producto.sku,
      nombre: producto.nombre,
      precio: producto.precio,
    };
  });
}
