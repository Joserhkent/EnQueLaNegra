import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import {
  OrderStatus,
  OrderType,
  MovimientoTipo,
  PaymentMethod,
  Prisma,
} from '@prisma/client';

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

  async create(dto: CreatePedidoDto, userId?: string) {
    const now = new Date();
    // Usa fecha/hora LOCAL del servidor, no UTC (toISOString desplaza el día en las noches, ya que Perú es UTC-5)
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Resuelve todos los productoId faltantes en UNA sola consulta (antes se hacía
    // una por ítem, dos veces — una para descontar inventario y otra para guardar).
    const skusToResolve = dto.items
      .filter((i) => !i.productoId && i.sku)
      .map((i) => i.sku);
    const resolvedBySku = skusToResolve.length
      ? await this.prisma.producto.findMany({
          where: { sku: { in: skusToResolve } },
          select: { id: true, sku: true },
        })
      : [];
    const skuToId = new Map(resolvedBySku.map((p) => [p.sku, p.id]));
    const itemsWithProductoId = dto.items.map((item) => ({
      ...item,
      productoId: item.productoId || skuToId.get(item.sku) || '',
    }));

    // Insumo -> cantidad total a descontar, calculado en memoria (1 sola consulta
    // para todas las recetas involucradas, agrupando ítems repetidos).
    const deducciones =
      await this.buildInventoryDeductions(itemsWithProductoId);

    // Total de productos + extras cobrados aparte
    const total = itemsWithProductoId.reduce((acc, item) => {
      const itemTotal = item.precio * item.cantidad;
      const extrasTotal = (item.extras ?? []).reduce(
        (accExtra, extra) =>
          accExtra + (extra.precioExtra ?? 0) * (extra.cantidad ?? 1),
        0,
      );
      return acc + itemTotal + extrasTotal;
    }, 0);

    // IGV Perú 18%
    const subtotal = Math.round((total / 1.18) * 100) / 100;
    const igv = Math.round((total - subtotal) * 100) / 100;

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
            })),
          }
        : undefined,
    }));

    const codeLabel = dto.code ?? 'Nuevo Pedido';

    // Crear el pedido y descontar el inventario son escrituras a tablas distintas
    // sin dependencia entre sí — se disparan juntas en vez de una tras otra.
    const [order] = await Promise.all([
      this.prisma.order.create({
        data: {
          code: dto.code ?? `#ORD-${Date.now()}`,
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
      this.applyInventoryDeductions(
        deducciones,
        userId,
        `Venta comanda ${codeLabel}`,
      ),
    ]);

    return order;
  }

  async updateStatus(id: string, newStatus: OrderStatus) {
    const order = await this.findOne(id);

    if (order.status === newStatus) {
      return order;
    }

    // El inventario ya se descuenta al CREAR el pedido, no al marcarlo como entregado.

    return this.prisma.order.update({
      where: { id },
      data: { status: newStatus },
      include: ORDER_INCLUDE,
    });
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
        acumular(extra.insumoId, (extra.cantidad ?? 1) * item.cantidad);
      }
    }

    return deducciones;
  }

  private async applyInventoryDeductions(
    deducciones: Map<string, number>,
    userId: string | undefined,
    motivo: string,
  ) {
    if (deducciones.size === 0) return;

    await Promise.all([
      ...[...deducciones.entries()].map(([insumoId, cantidad]) =>
        this.prisma.insumo.update({
          where: { id: insumoId },
          data: { stockActual: { decrement: cantidad } },
        }),
      ),
      this.prisma.movimientoStock.createMany({
        data: [...deducciones.entries()].map(([insumoId, cantidad]) => ({
          insumoId,
          tipo: MovimientoTipo.SALIDA,
          cantidad,
          motivo,
          usuario: 'Sistema POS Automático',
          usuarioId: userId,
        })),
      }),
    ]);
  }
}
