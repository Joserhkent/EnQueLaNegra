import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  OrderStatus,
  TableStatus,
  PaymentMethod,
  MovimientoTipo,
  ItemKitchenStatus,
  Prisma,
} from '@prisma/client';
import { OpenTableDto } from './dto/open-table.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PartialPaymentDto } from './dto/partial-payment.dto';

const ORDER_INCLUDE = {
  items: {
    include: { extras: { include: { insumo: true } } },
    orderBy: { createdAt: 'asc' },
  },
  pagos: true,
  user: { select: { id: true, name: true, username: true } },
} satisfies Prisma.OrderInclude;

const TABLE_INCLUDE = {
  currentOrder: { include: ORDER_INCLUDE },
} satisfies Prisma.TableInclude;

function formatFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

@Injectable()
export class MesasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.table.findMany({
      orderBy: { number: 'asc' },
      include: TABLE_INCLUDE,
    });
  }

  async open(tableId: string, dto: OpenTableDto, userId?: string) {
    const table = await this.getTableOrThrow(tableId);

    if (table.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException(
        `La mesa ${table.number} ya está ocupada o en proceso de cobro`,
      );
    }

    const now = new Date();

    const order = await this.prisma.order.create({
      data: {
        code: `#MESA-${table.number}-${Date.now()}`,
        customer: dto.customer?.trim() || `Mesa ${table.number}`,
        type: 'MESA',
        status: OrderStatus.OPEN,
        paymentMethod: PaymentMethod.EFECTIVO,
        subtotal: 0,
        igv: 0,
        total: 0,
        userId,
        tableId: table.id,
        fecha: formatFecha(now),
        hora: formatHora(now),
      },
    });

    await this.prisma.table.update({
      where: { id: table.id },
      data: { status: TableStatus.OCCUPIED, currentOrderId: order.id },
    });

    // Una mesa recién abierta no tiene ítems/pagos todavía — se arma la respuesta
    // con lo que ya tenemos en vez de una vuelta más a la base solo para releerlo.
    return {
      ...table,
      status: TableStatus.OCCUPIED,
      currentOrderId: order.id,
      currentOrder: { ...order, items: [], pagos: [], user: null },
    };
  }

  async addItems(tableId: string, dto: AddItemsDto, userId?: string) {
    // Todo lo que no depende de un resultado previo se dispara junto: traer la
    // mesa (con su orden actual y el último ítem, para calcular la ronda) y
    // resolver los sku->productoId que falten (caso raro; el frontend ya manda
    // productoId casi siempre, así que esto normalmente no hace ninguna consulta).
    const skusToResolve = [
      ...new Set(
        dto.items.filter((i) => !i.productoId && i.sku).map((i) => i.sku),
      ),
    ];
    const [table, resolvedBySku] = await Promise.all([
      this.prisma.table.findUnique({
        where: { id: tableId },
        include: {
          currentOrder: {
            include: { items: { orderBy: { ronda: 'desc' }, take: 1 } },
          },
        },
      }),
      skusToResolve.length
        ? this.prisma.producto.findMany({
            where: { sku: { in: skusToResolve } },
            select: { id: true, sku: true },
          })
        : Promise.resolve<{ id: string; sku: string }[]>([]),
    ]);

    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }

    const skuToId = new Map<string, string>(
      resolvedBySku.map((p) => [p.sku, p.id]),
    );
    const itemsWithProductoId = dto.items.map((item) => ({
      ...item,
      productoId: item.productoId || skuToId.get(item.sku) || '',
    }));

    const ronda = (table.currentOrder.items[0]?.ronda ?? 0) + 1;
    const motivo = `Mesa ${table.number} · ronda ${ronda}`;

    const itemsFormatted = itemsWithProductoId.map((item) => ({
      productoId: item.productoId,
      sku: item.sku,
      nombre: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad,
      subtotal: item.precio * item.cantidad,
      notas: item.notas,
      ronda,
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

    // Total calculado en memoria (ya tenemos precio/cantidad/extras del DTO) para
    // no tener que releer los ítems de la orden y recalcular desde cero.
    const tandaTotal = itemsWithProductoId.reduce((acc, item) => {
      const extrasTotal = (item.extras ?? []).reduce(
        (sum, e) => sum + (e.precioExtra ?? 0) * (e.cantidad ?? 1),
        0,
      );
      return acc + item.precio * item.cantidad + extrasTotal;
    }, 0);
    const total = table.currentOrder.total + tandaTotal;
    // IGV Perú 18%
    const subtotal = Math.round((total / 1.18) * 100) / 100;
    const igv = Math.round((total - subtotal) * 100) / 100;

    // El descuento de inventario (updates de stock + kardex) y la inserción de los
    // ítems son escrituras independientes entre sí — se disparan juntas en vez de
    // una detrás de otra.
    const [updatedOrder] = await Promise.all([
      this.prisma.order.update({
        where: { id: table.currentOrderId },
        data: { items: { create: itemsFormatted }, total, subtotal, igv },
        include: ORDER_INCLUDE,
      }),
      this.deductInventoryForItems(itemsWithProductoId, userId, motivo),
      // Si ya se había pedido la pre-cuenta y llega una tanda nueva, vuelve a "consumiendo"
      table.status === TableStatus.BILLING
        ? this.prisma.table.update({
            where: { id: table.id },
            data: { status: TableStatus.OCCUPIED },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...table,
      status:
        table.status === TableStatus.BILLING
          ? TableStatus.OCCUPIED
          : table.status,
      currentOrder: updatedOrder,
    };
  }

  async preBill(tableId: string) {
    const table = await this.getTableOrThrow(tableId);

    if (!table.currentOrderId) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }

    await this.prisma.table.update({
      where: { id: table.id },
      data: { status: TableStatus.BILLING },
    });

    return this.getTableDetail(table.id);
  }

  async partialPayment(tableId: string, dto: PartialPaymentDto, userId?: string) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: { currentOrder: { include: ORDER_INCLUDE } },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(`La mesa ${table.number} no tiene una cuenta abierta`);
    }

    const order = table.currentOrder;
    if (order.items.length === 0) {
      throw new BadRequestException('No se puede registrar un pago sin ítems');
    }

    const paymentMethod =
      PaymentMethod[dto.paymentMethod as unknown as keyof typeof PaymentMethod] ?? PaymentMethod.EFECTIVO;
    const paid = order.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    const remaining = Math.max(0, Math.round((order.total - paid) * 100) / 100);
    const amount = Math.round(dto.monto * 100) / 100;

    if (amount > remaining) {
      throw new BadRequestException(`El pago no puede superar el saldo pendiente de S/ ${remaining.toFixed(2)}`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        userId: userId ?? order.userId ?? undefined,
        pagos: { create: { metodoPago: paymentMethod, monto: amount } },
      },
      include: ORDER_INCLUDE,
    });

    return {
      ...table,
      currentOrder: updatedOrder,
      paidAmount: paid + amount,
      remainingAmount: Math.max(0, Math.round((remaining - amount) * 100) / 100),
    };
  }

  async checkout(tableId: string, dto: CheckoutDto, userId?: string) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: { currentOrder: { include: ORDER_INCLUDE } },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada');

    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }

    const order = table.currentOrder;
    if (order.items.length === 0) {
      throw new BadRequestException(
        'No se puede cobrar una mesa sin ítems registrados',
      );
    }

    const paymentMethod =
      PaymentMethod[
        dto.paymentMethod as unknown as keyof typeof PaymentMethod
      ] ?? PaymentMethod.EFECTIVO;
    const isMixto = paymentMethod === PaymentMethod.MIXTO;
    const paidBefore = order.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    const remainingBefore = Math.max(0, Math.round((order.total - paidBefore) * 100) / 100);
    const mixedAmount = (dto.montoEfectivo ?? 0) + (dto.montoDigital ?? 0);

    if (isMixto && remainingBefore > 0 && Math.abs(mixedAmount - remainingBefore) > 0.01) {
      throw new BadRequestException(`El pago mixto debe sumar exactamente S/ ${remainingBefore.toFixed(2)}`);
    }

    const pagosData: Prisma.PagoCreateWithoutOrderInput[] =
      remainingBefore <= 0
        ? []
        : isMixto
          ? [
              { metodoPago: PaymentMethod.EFECTIVO, monto: dto.montoEfectivo ?? 0 },
              { metodoPago: PaymentMethod.YAPE_PLIN, monto: dto.montoDigital ?? 0 },
            ].filter((p) => p.monto > 0)
          : [{ metodoPago: paymentMethod, monto: remainingBefore }];

    const now = new Date();

    // El pedido pasa a ENTREGADO y la mesa vuelve a AVAILABLE en el mismo golpe —
    // son escrituras a tablas distintas sin dependencia entre sí.
    const [updatedOrder] = await Promise.all([
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ENTREGADO,
          paymentMethod,
          montoEfectivo: isMixto ? (dto.montoEfectivo ?? 0) : undefined,
          montoDigital: isMixto ? (dto.montoDigital ?? 0) : undefined,
          fecha: formatFecha(now),
          hora: formatHora(now),
          userId: userId ?? order.userId ?? undefined,
          pagos: { create: pagosData },
        },
        include: ORDER_INCLUDE,
      }),
      this.prisma.table.update({
        where: { id: table.id },
        data: { status: TableStatus.AVAILABLE, currentOrderId: null },
      }),
    ]);

    return updatedOrder;
  }

  // Corrige un ítem ya creado (cantidad y/o notas) — para cuando el mesero se
  // equivoca al armar una tanda y ya se envió. Ajusta inventario por la
  // diferencia (no por el total) y recalcula el total de la orden en memoria.
  async updateItem(
    tableId: string,
    itemId: string,
    dto: UpdateItemDto,
    userId?: string,
  ) {
    const [table, item] = await Promise.all([
      this.prisma.table.findUnique({
        where: { id: tableId },
        include: { currentOrder: true },
      }),
      this.prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { extras: true },
      }),
    ]);

    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }
    if (!item || item.orderId !== table.currentOrderId) {
      throw new NotFoundException(
        'Ítem no encontrado en la cuenta de esta mesa',
      );
    }

    const nuevaCantidad = dto.cantidad ?? item.cantidad;
    const cantidadDelta = nuevaCantidad - item.cantidad;
    const nuevoSubtotalItem = item.precio * nuevaCantidad;
    const extrasSubtotalPorUnidad = item.extras.reduce(
      (sum, e) => sum + e.precioExtra * e.cantidad,
      0,
    );
    const totalDelta =
      nuevoSubtotalItem -
      item.subtotal +
      extrasSubtotalPorUnidad * cantidadDelta;

    const nuevoTotal = table.currentOrder.total + totalDelta;
    const nuevoSubtotal = Math.round((nuevoTotal / 1.18) * 100) / 100;
    const nuevoIgv = Math.round((nuevoTotal - nuevoSubtotal) * 100) / 100;
    const motivo = `Corrección de ítem — Mesa ${table.number}`;

    const [, updatedOrder] = await Promise.all([
      cantidadDelta !== 0
        ? this.adjustInventoryForItem(item, cantidadDelta, userId, motivo)
        : Promise.resolve(null),
      this.prisma.order.update({
        where: { id: table.currentOrderId },
        data: {
          total: nuevoTotal,
          subtotal: nuevoSubtotal,
          igv: nuevoIgv,
          items: {
            update: {
              where: { id: itemId },
              data: {
                cantidad: nuevaCantidad,
                subtotal: nuevoSubtotalItem,
                notas: dto.notas,
                kitchenStatus: dto.kitchenStatus as ItemKitchenStatus,
              },
            },
          },
        },
        include: ORDER_INCLUDE,
      }),
    ]);

    return { ...table, currentOrder: updatedOrder };
  }

  // Quita un ítem agregado por error. Revierte el inventario que se había
  // descontado al agregarlo (como si nunca se hubiera pedido). Si era el
  // último ítem de la cuenta, la mesa vuelve a estar libre en vez de quedar
  // "ocupada" con una orden vacía — misma regla que rige al abrir la mesa.
  async removeItem(tableId: string, itemId: string, userId?: string) {
    const [table, item] = await Promise.all([
      this.prisma.table.findUnique({
        where: { id: tableId },
        include: { currentOrder: true },
      }),
      this.prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { extras: true },
      }),
    ]);

    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }
    if (!item || item.orderId !== table.currentOrderId) {
      throw new NotFoundException(
        'Ítem no encontrado en la cuenta de esta mesa',
      );
    }

    const motivo = `Eliminación de ítem — Mesa ${table.number}`;
    await this.adjustInventoryForItem(item, -item.cantidad, userId, motivo);

    const remainingCount = await this.prisma.orderItem.count({
      where: { orderId: table.currentOrderId, id: { not: itemId } },
    });

    if (remainingCount === 0) {
      // El pedido queda vacío: primero se libera la mesa (la FK de Table
      // apunta a Order) y recién entonces se borra la orden vacía, en cascada
      // con su único ítem — mismo orden usado para limpiar mesas fantasma.
      await this.prisma.table.update({
        where: { id: table.id },
        data: { status: TableStatus.AVAILABLE, currentOrderId: null },
      });
      await this.prisma.order.delete({ where: { id: table.currentOrderId } });
      return {
        ...table,
        status: TableStatus.AVAILABLE,
        currentOrderId: null,
        currentOrder: null,
      };
    }

    const extrasTotalDelItem =
      item.extras.reduce((sum, e) => sum + e.precioExtra * e.cantidad, 0) *
      item.cantidad;
    const nuevoTotal =
      table.currentOrder.total - (item.subtotal + extrasTotalDelItem);
    const nuevoSubtotal = Math.round((nuevoTotal / 1.18) * 100) / 100;
    const nuevoIgv = Math.round((nuevoTotal - nuevoSubtotal) * 100) / 100;

    const updatedOrder = await this.prisma.order.update({
      where: { id: table.currentOrderId },
      data: {
        total: nuevoTotal,
        subtotal: nuevoSubtotal,
        igv: nuevoIgv,
        items: { delete: { id: itemId } },
      },
      include: ORDER_INCLUDE,
    });

    return { ...table, currentOrder: updatedOrder };
  }

  // Ajusta el inventario por la DIFERENCIA de cantidad de un ítem ya existente
  // (positiva = se pidió más, se descuenta más; negativa = se quitó cantidad
  // o se eliminó el ítem entero, se repone stock). Reutiliza la misma receta
  // que se usó para descontar al crear el ítem.
  private async adjustInventoryForItem(
    item: {
      productoId: string;
      extras: { insumoId: string; cantidad: number }[];
    },
    cantidadDelta: number,
    userId: string | undefined,
    motivo: string,
  ) {
    const recetas = await this.prisma.recetaItem.findMany({
      where: { productoId: item.productoId },
    });

    const deltas = new Map<string, number>();
    const acumular = (insumoId: string, cantidad: number) => {
      deltas.set(insumoId, (deltas.get(insumoId) ?? 0) + cantidad);
    };
    for (const r of recetas)
      acumular(r.insumoId, r.cantidadRequerida * cantidadDelta);
    for (const e of item.extras)
      acumular(e.insumoId, e.cantidad * cantidadDelta);

    if (deltas.size === 0) return;

    const tipo =
      cantidadDelta > 0 ? MovimientoTipo.SALIDA : MovimientoTipo.ENTRADA;

    await Promise.all([
      ...[...deltas.entries()].map(([insumoId, cantidad]) =>
        this.prisma.insumo.update({
          where: { id: insumoId },
          data: { stockActual: { decrement: cantidad } },
        }),
      ),
      this.prisma.movimientoStock.createMany({
        data: [...deltas.entries()].map(([insumoId, cantidad]) => ({
          insumoId,
          tipo,
          cantidad: Math.abs(cantidad),
          motivo,
          usuario: 'Sistema POS Automático',
          usuarioId: userId,
        })),
      }),
    ]);
  }

  private async getTableOrThrow(tableId: string) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    return table;
  }

  private async getTableDetail(tableId: string) {
    return this.prisma.table.findUnique({
      where: { id: tableId },
      include: TABLE_INCLUDE,
    });
  }

  // Descuenta el inventario de TODA la tanda en un puñado de consultas en vez de
  // ~3 por cada insumo de cada ítem (findUnique + update + create, secuencial).
  // Con la base de datos ahora en Supabase (red, no un archivo local), cada
  // round-trip pesa de verdad — encadenar 10-15 de forma secuencial es justo el
  // "lag" que se siente al enviar una tanda. Aquí: 1 consulta para TODAS las
  // recetas, deducciones agrupadas por insumo, updates atómicos en paralelo
  // (`decrement`, sin leer antes) y un solo `createMany` para el kardex.
  private async deductInventoryForItems(
    items: (AddItemsDto['items'][number] & { productoId?: string })[],
    userId: string | undefined,
    motivo: string,
  ) {
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

    // insumoId -> cantidad total a descontar (suma de todos los ítems/extras de la tanda)
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

    if (deducciones.size === 0) return;

    await Promise.all(
      [...deducciones.entries()].map(([insumoId, cantidad]) =>
        this.prisma.insumo.update({
          where: { id: insumoId },
          data: { stockActual: { decrement: cantidad } },
        }),
      ),
    );

    await this.prisma.movimientoStock.createMany({
      data: [...deducciones.entries()].map(([insumoId, cantidad]) => ({
        insumoId,
        tipo: MovimientoTipo.SALIDA,
        cantidad,
        motivo,
        usuario: 'Sistema POS Automático',
        usuarioId: userId,
      })),
    });
  }
}
