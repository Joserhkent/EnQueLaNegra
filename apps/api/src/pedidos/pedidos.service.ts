import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import {
  OrderStatus,
  OrderType,
  MovimientoTipo,
  PaymentMethod,
  ItemKitchenStatus,
  Prisma,
} from '@prisma/client';
import { formatFecha, formatHora } from '../common/date';
import { itemLineTotal, splitIgv } from '../common/order-totals';
import { resolverProductos } from '../common/productos';
import { resolverAgregados } from '../common/agregados';
import {
  assertStockSuficiente,
  descontarStock,
  esSinStock,
  sinStockConcurrente,
} from '../common/stock';

function esCodigoDuplicado(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('code')
  );
}

const ORDER_INCLUDE = {
  items: { include: { extras: { include: { insumo: true } } } },
  pagos: true,
  user: { select: { id: true, name: true, username: true } },
} satisfies Prisma.OrderInclude;

type OrderWithItemsAndExtras = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

@Injectable()
export class PedidosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.order.findMany({
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<OrderWithItemsAndExtras> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
    }

    return order;
  }

  private async assertCajaAbierta() {
    const activeCaja = await this.prisma.cajaSesion.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!activeCaja) {
      throw new BadRequestException(
        'La caja está cerrada. Debe abrir un turno de caja antes de realizar pedidos.',
      );
    }
  }

  async create(dto: CreatePedidoDto, userId?: string) {
    await this.assertCajaAbierta();
    const now = new Date();
    // Fecha/hora de Perú (UTC-5), no UTC del servidor ni toISOString (desplaza el día en las noches)
    const fecha = formatFecha(now);
    const hora = formatHora(now);

    // Productos resueltos contra el catálogo en UNA sola consulta, con su precio real.
    await resolverAgregados(this.prisma, dto.items);
    const itemsWithProductoId = await resolverProductos(this.prisma, dto.items);

    // Insumo -> cantidad total a descontar, calculado en memoria (1 sola consulta
    // para todas las recetas involucradas, agrupando ítems repetidos).
    const deducciones =
      await this.buildInventoryDeductions(itemsWithProductoId);
    await assertStockSuficiente(this.prisma, deducciones);

    // Total de productos + extras (por unidad) cobrados aparte, con IGV Perú 18%
    const { total, subtotal, igv } = splitIgv(
      itemsWithProductoId.reduce(
        (acc, item) =>
          acc + itemLineTotal(item.precio, item.cantidad, item.extras),
        0,
      ),
    );

    // 1. Normalización de OrderType (Enum de Prisma)
    const rawType = (dto.type || 'MESA').toUpperCase();
    const orderType: OrderType =
      OrderType[rawType as keyof typeof OrderType] ?? OrderType.MESA;

    // 2. Normalización de PaymentMethod (Enum de Prisma)
    let paymentMethod: PaymentMethod = PaymentMethod.EFECTIVO;
    if (dto.paymentMethod) {
      const rawPayment = dto.paymentMethod
        .toUpperCase()
        .replace('/', '_')
        .replace(/\s+/g, '_');

      paymentMethod =
        PaymentMethod[rawPayment as keyof typeof PaymentMethod] ??
        PaymentMethod.EFECTIVO;
    }

    const isMixto = paymentMethod === PaymentMethod.MIXTO;
    if (isMixto) {
      const sumaMixta = (dto.montoEfectivo ?? 0) + (dto.montoDigital ?? 0);
      if (Math.abs(sumaMixta - total) > 0.01) {
        throw new BadRequestException(
          `El pago mixto debe sumar exactamente S/ ${total.toFixed(2)}`,
        );
      }
    }

    const pagosData: Prisma.PagoCreateWithoutOrderInput[] = isMixto
      ? [
          { metodoPago: PaymentMethod.EFECTIVO, monto: dto.montoEfectivo ?? 0 },
          { metodoPago: PaymentMethod.YAPE_PLIN, monto: dto.montoDigital ?? 0 },
        ].filter((p) => p.monto > 0)
      : [{ metodoPago: paymentMethod, monto: total }];

    const itemsFormatted = itemsWithProductoId.map((item) => ({
      productoId: item.productoId,
      sku: item.sku,
      nombre: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad,
      subtotal: item.precio * item.cantidad,
      notas: item.notas,
      extras: item.extras?.length
        ? {
            create: item.extras.map((extra) => ({
              insumoId: extra.insumoId,
              cantidad: extra.cantidad ?? 1,
              precioExtra: extra.precioExtra ?? 0,
              consumo: extra.consumo ?? 1,
            })),
          }
        : undefined,
    }));

    // Pedido e inventario van en una sola transacción: si algo falla no queda un
    // pedido sin descontar stock (ni stock descontado sin pedido).
    const crear = (code: string) =>
      this.prisma.$transaction([
        this.prisma.order.create({
          data: {
            code,
            customer: dto.customer ?? 'Cliente Mostrador',
            type: orderType,
            status: OrderStatus.PREPARACION,
            paymentMethod,
            montoEfectivo: isMixto ? (dto.montoEfectivo ?? 0) : undefined,
            montoDigital: isMixto ? (dto.montoDigital ?? 0) : undefined,
            subtotal,
            igv,
            total,
            userId,
            fecha,
            hora,
            items: {
              create: itemsFormatted,
            },
            pagos: {
              create: pagosData,
            },
          },
          include: ORDER_INCLUDE,
        }),
        ...this.buildInventoryOps(deducciones, userId, `Venta comanda ${code}`),
      ]);

    // El código lo propone el navegador a partir de los pedidos que tiene cargados;
    // con dos dispositivos a la vez puede repetirse. En ese caso se usa uno único
    // en vez de perder el pedido (la transacción anterior no dejó nada a medias).
    const codigoPropuesto = dto.code ?? `#ORD-${Date.now()}`;
    try {
      const [order] = await crear(codigoPropuesto);
      return order;
    } catch (error) {
      if (esSinStock(error)) throw sinStockConcurrente();
      if (!esCodigoDuplicado(error)) throw error;
      try {
        const [order] = await crear(`#ORD-${Date.now()}`);
        return order;
      } catch (reintento) {
        if (esSinStock(reintento)) throw sinStockConcurrente();
        throw reintento;
      }
    }
  }

  async updateStatus(id: string, newStatus: OrderStatus, userId?: string) {
    const order = await this.findOne(id);

    if (order.status === newStatus) {
      return order;
    }
    // Las cuentas de mesa se cierran solo con el cobro (libera la mesa y registra
    // los pagos); cambiarlas desde aquí dejaría la mesa ocupada con una orden cerrada.
    if (order.status === OrderStatus.OPEN || newStatus === OrderStatus.OPEN) {
      throw new BadRequestException(
        'Las cuentas de mesa abiertas se gestionan desde Mesas (cobrar o liberar)',
      );
    }
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException(
        `El pedido ${order.code} ya fue cancelado y no se puede reabrir`,
      );
    }

    // El inventario ya se descuenta al CREAR el pedido, no al marcarlo como entregado.
    const actualizar = this.prisma.order.update({
      where: { id },
      data: { status: newStatus },
      include: ORDER_INCLUDE,
    });

    // Cancelado antes de que cocina lo prepare: los insumos no se usaron, se devuelve
    // exactamente lo que se descontó al crearlo. Si ya estaba LISTO, se gastaron.
    if (
      newStatus === OrderStatus.CANCELADO &&
      order.status === OrderStatus.PREPARACION
    ) {
      const salidas = await this.prisma.movimientoStock.groupBy({
        by: ['insumoId'],
        where: {
          motivo: `Venta comanda ${order.code}`,
          tipo: MovimientoTipo.SALIDA,
        },
        _sum: { cantidad: true },
      });
      const devoluciones = new Map(
        salidas.map((s) => [s.insumoId, s._sum.cantidad ?? 0]),
      );
      const [actualizado] = await this.prisma.$transaction([
        actualizar,
        ...this.buildInventoryOps(
          devoluciones,
          userId,
          `Cancelación comanda ${order.code}`,
          MovimientoTipo.ENTRADA,
        ),
      ]);
      return actualizado;
    }

    return actualizar;
  }
  async updateItemKitchenStatus(
    orderId: string,
    itemId: string,
    kitchenStatus: string,
  ) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.orderId !== orderId) {
      throw new NotFoundException('Ítem no encontrado en este pedido');
    }

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { kitchenStatus: kitchenStatus as ItemKitchenStatus },
    });

    return this.findOne(orderId);
  }

  // Separado en dos pasos (calcular vs. escribir) para poder disparar la escritura
  // en paralelo con la creación del pedido, en vez de una detrás de otra. Antes
  // esto hacía ~3 consultas por cada insumo de cada ítem (findUnique + update +
  // create, secuencial) — con la base de datos en Supabase (red, no un archivo
  // local), encadenar 10-15 round-trips seguidos es justo el lag que se sentía
  // al crear un pedido.
  private async buildInventoryDeductions(
    items: (CreatePedidoDto['items'][number] & { productoId?: string })[],
  ): Promise<Map<string, number>> {
    const productoIds = [
      ...new Set(
        items.map((i) => i.productoId).filter((id): id is string => !!id),
      ),
    ];

    const recetas = productoIds.length
      ? await this.prisma.recetaItem.findMany({
          where: { productoId: { in: productoIds } },
        })
      : [];
    const recetaPorProducto = new Map<string, typeof recetas>();
    for (const r of recetas) {
      if (!recetaPorProducto.has(r.productoId))
        recetaPorProducto.set(r.productoId, []);
      recetaPorProducto.get(r.productoId)!.push(r);
    }

    const deducciones = new Map<string, number>();
    const acumular = (insumoId: string, cantidad: number) => {
      deducciones.set(insumoId, (deducciones.get(insumoId) ?? 0) + cantidad);
    };

    for (const item of items) {
      if (item.productoId) {
        for (const recipeItem of recetaPorProducto.get(item.productoId) ?? []) {
          acumular(
            recipeItem.insumoId,
            recipeItem.cantidadRequerida * item.cantidad,
          );
        }
      }
      for (const extra of item.extras ?? []) {
        acumular(
          extra.insumoId,
          (extra.consumo ?? 1) * (extra.cantidad ?? 1) * item.cantidad,
        );
      }
    }

    return deducciones;
  }

  private buildInventoryOps(
    deducciones: Map<string, number>,
    userId: string | undefined,
    motivo: string,
    tipo: MovimientoTipo = MovimientoTipo.SALIDA,
  ) {
    if (deducciones.size === 0) return [];
    return [
      ...[...deducciones.entries()].map(([insumoId, cantidad]) =>
        tipo === MovimientoTipo.SALIDA
          ? descontarStock(this.prisma, insumoId, cantidad)
          : this.prisma.insumo.update({
              where: { id: insumoId },
              data: { stockActual: { increment: cantidad } },
            }),
      ),
      this.prisma.movimientoStock.createMany({
        data: [...deducciones.entries()].map(([insumoId, cantidad]) => ({
          insumoId,
          tipo,
          cantidad,
          motivo,
          usuario: 'Sistema POS Automático',
          usuarioId: userId,
        })),
      }),
    ];
  }
}
