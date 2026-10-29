import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Exporta la carta actual de la base (categorías, insumos, productos y recetas) a
// prisma/seed-data/carta.json, que es lo que carga el seed. Solo LEE la base.
// Uso: npm run carta:exportar  (después de cambiar la carta desde el POS)
const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main() {
  const [categorias, insumos, productos] = await Promise.all([
    prisma.categoria.findMany({ orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }] }),
    prisma.insumo.findMany({ include: { categoria: true }, orderBy: { id: 'asc' } }),
    prisma.producto.findMany({
      include: { categoria: true, recetaItems: { orderBy: { insumoId: 'asc' } } },
      orderBy: { sku: 'asc' },
    }),
  ]);

  const carta = {
    categorias: categorias.map((c) => ({ nombre: c.nombre, tipo: c.tipo, orden: c.orden })),
    insumos: insumos.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      categoria: i.categoria.nombre,
      unidadMedida: i.unidadMedida,
      stockActual: i.stockActual,
      stockMinimo: i.stockMinimo,
      costoUnitario: i.costoUnitario,
    })),
    productos: productos.map((p) => ({
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria.nombre,
      precio: p.precio,
      isAvailable: p.isAvailable,
      isPopular: p.isPopular,
      descripcion: p.descripcion,
      iconoEmoji: p.iconoEmoji,
      receta: p.recetaItems.map((r) => ({ insumoId: r.insumoId, cantidad: r.cantidadRequerida })),
    })),
  };

  const destino = join(__dirname, 'seed-data', 'carta.json');
  writeFileSync(destino, JSON.stringify(carta, null, 2) + '\n');
  console.log(
    `✅ Carta exportada: ${carta.categorias.length} categorías, ${carta.insumos.length} insumos, ${carta.productos.length} productos → ${destino}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Error exportando la carta:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
