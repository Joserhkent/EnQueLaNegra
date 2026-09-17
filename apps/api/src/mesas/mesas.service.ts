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
  Prisma,
} from '@prisma/client';
import { OpenTableDto } from './dto/open-table.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { CheckoutDto } from './dto/checkout.dto';

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

    return this.getTableDetail(table.id);
  }

  async addItems(tableId: string, dto: AddItemsDto, userId?: string) {
    const table = await this.getTableOrThrow(tableId);

    if (!table.currentOrderId) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }

    const lastItem = await this.prisma.orderItem.findFirst({
      where: { orderId: table.currentOrderId },
      orderBy: { ronda: 'desc' },
    });
    const ronda = (lastItem?.ronda ?? 0) + 1;
    const motivo = `Mesa ${table.number} · ronda ${ronda}`;

    await this.deductInventoryForItems(dto.items, userId, motivo);

    const itemsFormatted = await Promise.all(
      dto.items.map(async (item) => {
        let productoId = item.productoId;
        if (!productoId && item.sku) {
          const prod = await this.prisma.producto.findFirst({
            where: { sku: item.sku },
            select: { id: true },
          });
          if (prod) productoId = prod.id;
        }

        return {
          productoId,
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
        };
      }),
    );

    await this.prisma.order.update({
      where: { id: table.currentOrderId },
      data: { items: { create: itemsFormatted } },
    });

    await this.recalcOrderTotals(table.currentOrderId);

    // Si ya se había pedido la pre-cuenta y llega una tanda nueva, vuelve a "consumiendo"
    if (table.status === TableStatus.BILLING) {
      await this.prisma.table.update({
        where: { id: table.id },
        data: { status: TableStatus.OCCUPIED },
      });
    }

    return this.getTableDetail(table.id);
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

  async checkout(tableId: string, dto: CheckoutDto, userId?: string) {
    const table = await this.getTableOrThrow(tableId);

    if (!table.currentOrderId) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: table.currentOrderId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Cuenta de la mesa no encontrada');
    if (order.items.length === 0) {
      throw new BadRequestException(
        'No se puede cobrar una mesa sin ítems registrados',
      );
    }

    const paymentMethod =
      PaymentMethod[dto.paymentMethod as unknown as keyof typeof PaymentMethod] ??
      PaymentMethod.EFECTIVO;
    const isMixto = paymentMethod === PaymentMethod.MIXTO;

    const pagosData: Prisma.PagoCreateWithoutOrderInput[] = isMixto
      ? [
          { metodoPago: PaymentMethod.EFECTIVO, monto: dto.montoEfectivo ?? 0 },
          { metodoPago: PaymentMethod.YAPE_PLIN, monto: dto.montoDigital ?? 0 },
        ].filter((p) => p.monto > 0)
      : [{ metodoPago: paymentMethod, monto: order.total }];

    const now = new Date();

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.ENTREGADO,
        paymentMethod,
        montoEfectivo: isMixto ? dto.montoEfectivo ?? 0 : undefined,
        montoDigital: isMixto ? dto.montoDigital ?? 0 : undefined,
        fecha: formatFecha(now),
        hora: formatHora(now),
        userId: userId ?? order.userId ?? undefined,
        pagos: { create: pagosData },
      },
      include: ORDER_INCLUDE,
    });

    await this.prisma.table.update({
      where: { id: table.id },
      data: { status: TableStatus.AVAILABLE, currentOrderId: null },
    });

    return updatedOrder;
  }

  private async getTableOrThrow(tableId: string) {
    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    return table;
  }

  private async getTableDetail(tableId: string) {
    return this.prisma.table.findUnique({
      where: { id: tableId },
      include: TABLE_INCLUDE,
    });
  }

  private async recalcOrderTotals(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { extras: true },
    });

    const total = items.reduce((acc, item) => {
      const extrasTotal = item.extras.reduce(
        (sum, extra) => sum + extra.precioExtra * extra.cantidad,
        0,
      );
      return acc + item.subtotal + extrasTotal;
    }, 0);

    // IGV Perú 18%
    const subtotal = Math.round((total / 1.18) * 100) / 100;
    const igv = Math.round((total - subtotal) * 100) / 100;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { total, subtotal, igv },
    });
  }

  private async deductInventoryForItems(
    items: AddItemsDto['items'],
    userId: string | undefined,
    motivo: string,
  ) {
    for (const item of items) {
      let productoId = item.productoId;
      if (!productoId && item.sku) {
        const prod = await this.prisma.producto.findFirst({
          where: { sku: item.sku },
          select: { id: true },
        });
        if (prod) productoId = prod.id;
      }

      if (productoId) {
        const receta = await this.prisma.recetaItem.findMany({
          where: { productoId },
        });
        for (const recipeItem of receta) {
          await this.descontarInsumo(
            recipeItem.insumoId,
            recipeItem.cantidadRequerida * item.cantidad,
            motivo,
            userId,
          );
        }
      }

      for (const extra of item.extras ?? []) {
        await this.descontarInsumo(
          extra.insumoId,
          (extra.cantidad ?? 1) * item.cantidad,
          `Extra en ${motivo}`,
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
    const insumo = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
    });
    if (!insumo) return;

    const newStock = Math.max(0, insumo.stockActual - cantidad);

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
