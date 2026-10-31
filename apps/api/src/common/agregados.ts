import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type ExtraEntrante = {
  insumoId: string;
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
    extra.precioExtra = agregado.precio;
    extra.consumo = agregado.consumo;
  }
}
