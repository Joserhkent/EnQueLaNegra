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

    // 🎯 Descuenta el inventario (receta BOM + extras) al MOMENTO de crear el pedido,
    // 🎯 Descuenta el inventario (receta BOM + extras) al MOMENTO de crear el pedido,
    // no al entregarlo. Se hace antes de crear el Order en BD.
    console.log(
      '🔥🔥🔥 INICIANDO DESCUENTO DE INVENTARIO AL CREAR PEDIDO 🔥🔥🔥',
    );
    await this.deductInventoryForNewOrder(dto, userId);
    console.log('✅✅✅ DESCUENTO DE INVENTARIO COMPLETADO ✅✅✅');

    // Total de productos + extras cobrados aparte
    const total = dto.items.reduce((acc, item) => {
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

    // 🎯 3. RESOLVER PRODUCTO ID (Evita que productoId llegue como undefined)
    const itemsFormatted = await Promise.all(
      dto.items.map(async (item) => {
        let finalProductoId = item.productoId;

        // Si no viene productoId pero sí sku, lo buscamos en la BD
        if (!finalProductoId && item.sku) {
          const prod = await this.prisma.producto.findFirst({
            where: { sku: item.sku },
            select: { id: true },
          });
          if (prod) {
            finalProductoId = prod.id;
          }
        }

        return {
          productoId: finalProductoId,
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
        };
      }),
    );

    return this.prisma.order.create({
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
    });
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

  // 🎯 Nueva versión: descuenta inventario ANTES de crear el pedido, usando el DTO directamente
  private async deductInventoryForNewOrder(
    dto: CreatePedidoDto,
    userId?: string,
  ) {
    const codeLabel = dto.code ?? 'Nuevo Pedido';

    for (const item of dto.items) {
      // Resuelve el productoId (por si viene vacío pero sí hay sku)
      let productoId = item.productoId;
      if (!productoId && item.sku) {
        const prod = await this.prisma.producto.findFirst({
          where: { sku: item.sku },
          select: { id: true },
        });
        if (prod) productoId = prod.id;
      }

      // 1. Descuenta la receta base (BOM) del producto
      if (productoId) {
        const receta = await this.prisma.recetaItem.findMany({
          where: { productoId },
        });

        for (const recipeItem of receta) {
          const qtyNeeded = recipeItem.cantidadRequerida * item.cantidad;
          await this.descontarInsumo(
            recipeItem.insumoId,
            qtyNeeded,
            `Venta comanda ${codeLabel}`,
            userId,
          );
        }
      }

      // 2. Descuenta los extras/cremas seleccionados manualmente en el ítem
      for (const extra of item.extras ?? []) {
        const qtyNeeded = (extra.cantidad ?? 1) * item.cantidad;
        await this.descontarInsumo(
          extra.insumoId,
          qtyNeeded,
          `Extra en comanda ${codeLabel}`,
          userId,
        );
      }
    }
  }

  private async descontarInsumo(
    insumoId: string,
    cantidad: number,
    motivo: string,
    userId?: string,
  ) {
    const targetInsumo = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
    });

    if (!targetInsumo) return;

    const newStock = Math.max(0, targetInsumo.stockActual - cantidad);

    await this.prisma.insumo.update({
      where: { id: insumoId },
      data: { stockActual: newStock },
    });

    await this.prisma.movimientoStock.create({
      data: {
        insumoId,
        tipo: MovimientoTipo.SALIDA,
        cantidad,
        motivo,
        usuario: 'Sistema POS Automático',
        usuarioId: userId,
      },
    });
  }
}
