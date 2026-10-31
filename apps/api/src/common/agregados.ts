import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type ExtraEntrante = {
  insumoId: string;
  cantidad?: number;
  precioExtra?: number;
  agregadoId?: string;
  consumo?: number;
};

// Completa los extras que vienen de un agregado con sus datos reales (insumo,
// precio y cuánto gasta), en una sola consulta. Así el precio no depende del
// celular que hizo el pedido y el stock se descuenta en la cantidad correcta.
export async function resolverAgregados(
  prisma: PrismaService,
  items: { extras?: ExtraEntrante[] }[],
) {
  const extras = items.flatMap((i) => i.extras ?? []);
  // Todo extra debe venir de un agregado de la carta. Uno suelto traería el
  // insumo, la cantidad y el precio que quiera el cliente (p. ej. carne a S/ 0).
  if (extras.some((e) => !e.agregadoId)) {
    throw new BadRequestException(
      'Uno de los agregados ya no está disponible. Actualiza la pantalla.',
    );
  }
  const ids = [
    ...new Set(extras.map((e) => e.agregadoId).filter(Boolean)),
  ] as string[];
  if (ids.length === 0) return;

  const agregados = await prisma.agregado.findMany({
    where: { id: { in: ids } },
  });
  const porId = new Map(agregados.map((a) => [a.id, a]));
  for (const extra of extras) {
    if (!extra.agregadoId) continue;
    const agregado = porId.get(extra.agregadoId);
    if (!agregado || !agregado.activo) {
      throw new BadRequestException(
        'Uno de los agregados ya no está disponible. Actualiza la pantalla.',
      );
    }
    extra.insumoId = agregado.insumoId;
    // Un agregado es una porción por plato; la cantidad no la decide el cliente
    extra.cantidad = 1;
    extra.precioExtra = agregado.precio;
    extra.consumo = agregado.consumo;
  }
}
