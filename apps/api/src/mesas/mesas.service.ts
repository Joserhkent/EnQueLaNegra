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
import { CreateTableDto } from './dto/create-table.dto';
import { JoinTablesDto } from './dto/join-tables.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { formatFecha, formatHora } from '../common/date';
import { itemLineTotal, round2, splitIgv } from '../common/order-totals';
import { resolverProductos } from '../common/productos';
import {
  assertStockSuficiente,
  descontarStock,
  esSinStock,
  sinStockConcurrente,
} from '../common/stock';

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
  joinedTables: true,
} satisfies Prisma.TableInclude;

// Ítems con extras y pagos de la cuenta abierta: base para recalcular el total
// de la orden en vez de arrastrar el que ya estaba guardado.
const ORDER_EDIT_INCLUDE = {
  items: { include: { extras: true } },
  pagos: true,
} satisfies Prisma.OrderInclude;

type EditableItem = Prisma.OrderItemGetPayload<{
  include: { extras: true };
}>;

function sumLineTotals(items: EditableItem[]): number {
  return items.reduce(
    (acc, i) => acc + itemLineTotal(i.precio, i.cantidad, i.extras),
    0,
  );
}

function sumPagos(pagos: { monto: number }[]): number {
  return round2(pagos.reduce((sum, p) => sum + p.monto, 0));
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

  async create(dto: CreateTableDto) {
    const lastTable = await this.prisma.table.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const table = await this.prisma.table.create({
      data: { number: (lastTable?.number ?? 0) + 1, capacity: dto.capacity },
      include: TABLE_INCLUDE,
    });
    return table;
  }

  async update(tableId: string, dto: UpdateTableDto) {
    if (dto.number === undefined && dto.capacity === undefined) {
      throw new BadRequestException(
        'Indica el número o la cantidad de sillas que deseas cambiar',
      );
    }
    const table = await this.getTableOrThrow(tableId);
    if (
      table.status !== TableStatus.AVAILABLE ||
      table.currentOrderId !== null ||
      table.joinedToId !== null
    ) {
      throw new BadRequestException(
        'Solo puedes editar una mesa disponible y que no esté unida a otra',
      );
    }
    const hasJoinedTables = await this.prisma.table.count({
      where: { joinedToId: tableId },
    });
    if (hasJoinedTables > 0) {
      throw new BadRequestException(
        'Separa el grupo de mesas antes de editar la mesa principal',
      );
    }

    return this.prisma.table.update({
      where: { id: tableId },
      data: dto,
      include: TABLE_INCLUDE,
    });
  }

  async remove(tableId: string) {
    return this.prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({ where: { id: tableId } });
      if (!table) throw new NotFoundException('Mesa no encontrada');
      if (
        table.status !== TableStatus.AVAILABLE ||
        table.currentOrderId !== null ||
        table.joinedToId !== null
      ) {
        throw new BadRequestException(
          'Solo puedes eliminar una mesa disponible y que no esté unida a otra',
        );
      }
      const hasJoinedTables = await tx.table.count({
        where: { joinedToId: tableId },
      });
      if (hasJoinedTables > 0) {
        throw new BadRequestException(
          'Separa el grupo de mesas antes de eliminar la mesa principal',
        );
      }

      await tx.order.updateMany({
        where: { tableId },
        data: { tableId: null },
      });
      await tx.table.delete({ where: { id: tableId } });
      return { id: tableId, deleted: true };
    });
  }

  async join(tableId: string, dto: JoinTablesDto) {
    if (dto.tableIds.includes(tableId)) {
      throw new BadRequestException(
        'Selecciona la mesa principal solo una vez',
      );
    }

    const tableIds = [tableId, ...dto.tableIds];
    const joinedTable = await this.prisma.$transaction(
      async (tx) => {
        const tables = await tx.table.findMany({
          where: { id: { in: tableIds } },
          include: { joinedTables: { select: { id: true } } },
        });
        if (tables.length !== tableIds.length) {
          throw new NotFoundException('Una o más mesas no existen');
        }

        const mainTable = tables.find((table) => table.id === tableId)!;
        const tablesToJoin = tables.filter((table) => table.id !== tableId);
        const unavailable = tables.find(
          (table) =>
            table.status !== TableStatus.AVAILABLE ||
            table.currentOrderId !== null ||
            table.joinedToId !== null,
        );
        if (unavailable) {
          throw new BadRequestException(
            `La mesa ${unavailable.number} no está disponible para unirse`,
          );
        }

        const existingMembers = tables.flatMap((table) =>
          table.joinedTables.map((member) => member.id),
        );
        const membersToReassign = [
          ...new Set([
            ...existingMembers,
            ...tablesToJoin.map((table) => table.id),
          ]),
        ];
        const groupsToFlatten = tables.map((table) => table.id);

        const claimedMainTable = await tx.table.updateMany({
          where: {
            id: mainTable.id,
            status: TableStatus.AVAILABLE,
            currentOrderId: null,
            joinedToId: null,
          },
          data: { updatedAt: new Date() },
        });
        if (claimedMainTable.count !== 1) {
          throw new BadRequestException(
            `La mesa ${mainTable.number} ya no está disponible para unirse`,
          );
        }

        const updatedMembers = await tx.table.updateMany({
          where: {
            id: { in: membersToReassign },
            status: TableStatus.AVAILABLE,
            currentOrderId: null,
            OR: [{ joinedToId: null }, { joinedToId: { in: groupsToFlatten } }],
          },
          data: { joinedToId: mainTable.id },
        });
        if (updatedMembers.count !== membersToReassign.length) {
          throw new BadRequestException(
            'Una o más mesas ya no están disponibles para unirse',
          );
        }

        return tx.table.findUniqueOrThrow({
          where: { id: mainTable.id },
          include: TABLE_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return joinedTable;
  }

  async unjoin(tableId: string) {
    const table = await this.getTableOrThrow(tableId);

    if (table.joinedToId) {
      const parentId = table.joinedToId;
      await this.prisma.table.update({
        where: { id: table.id },
        data: { joinedToId: null },
      });
      return this.getTableDetail(parentId);
    }

    const count = await this.prisma.table.count({
      where: { joinedToId: table.id },
    });

    if (count === 0) {
      throw new BadRequestException('Esta mesa no tiene mesas unidas');
    }

    await this.prisma.table.updateMany({
      where: { joinedToId: table.id },
      data: { joinedToId: null },
    });

    return this.getTableDetail(table.id);
  }

  private async assertCajaAbierta(accion = 'realizar esta acción') {
    const activeCaja = await this.prisma.cajaSesion.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!activeCaja) {
      throw new BadRequestException(
        `La caja está cerrada. Debe abrir un turno de caja antes de ${accion}.`,
      );
    }
  }

  async open(tableId: string, dto: OpenTableDto, userId?: string) {
    await this.assertCajaAbierta('abrir mesas');
    const table = await this.getTableOrThrow(tableId);

    if (table.joinedToId) {
      throw new BadRequestException(
        'Esta mesa pertenece a un grupo; abre la mesa principal',
      );
    }
    if (table.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException(
        `La mesa ${table.number} ya está ocupada o en proceso de cobro`,
      );
    }

    const now = new Date();

    // La mesa se "reclama" con un updateMany condicionado al estado: si dos
    // aperturas simultáneas llegan a la vez, solo una gana y la otra recibe error
    // (antes ambas creaban una orden y una quedaba huérfana).
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.table.updateMany({
        where: {
          id: table.id,
          status: TableStatus.AVAILABLE,
          currentOrderId: null,
          joinedToId: null,
        },
        data: { status: TableStatus.OCCUPIED },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          `La mesa ${table.number} ya está ocupada o en proceso de cobro`,
        );
      }
      const created = await tx.order.create({
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
      await tx.table.update({
        where: { id: table.id },
        data: { currentOrderId: created.id },
      });
      return created;
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
    await this.assertCajaAbierta('enviar pedidos a cocina');
    // La mesa (con su orden actual y el último ítem, para calcular la ronda) y los
    // productos del catálogo (con su precio real) se consultan a la vez.
    const [table, itemsWithProductoId] = await Promise.all([
      this.prisma.table.findUnique({
        where: { id: tableId },
        include: {
          currentOrder: {
            include: { items: { orderBy: { ronda: 'desc' }, take: 1 } },
          },
        },
      }),
      resolverProductos(this.prisma, dto.items),
    ]);

    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }

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
    const tandaTotal = itemsWithProductoId.reduce(
      (acc, item) =>
        acc + itemLineTotal(item.precio, item.cantidad, item.extras),
      0,
    );
    const { total, subtotal, igv } = splitIgv(
      table.currentOrder.total + tandaTotal,
    );

    // Ítems, descuento de inventario (stock + kardex) y vuelta a "consumiendo" van
    // en una sola transacción: o se guarda la tanda completa o no se guarda nada.
    const [updatedOrder] = await this.prisma
      .$transaction([
        this.prisma.order.update({
          where: { id: table.currentOrderId },
          data: { items: { create: itemsFormatted }, total, subtotal, igv },
          include: ORDER_INCLUDE,
        }),
        ...(await this.buildDeductionOps(itemsWithProductoId, userId, motivo)),
        // Si ya se había pedido la pre-cuenta y llega una tanda nueva, vuelve a "consumiendo"
        ...(table.status === TableStatus.BILLING
          ? [
              this.prisma.table.update({
                where: { id: table.id },
                data: { status: TableStatus.OCCUPIED },
              }),
            ]
          : []),
      ])
      .catch((error: unknown) => {
        throw esSinStock(error) ? sinStockConcurrente() : error;
      });

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

  async partialPayment(
    tableId: string,
    dto: PartialPaymentDto,
    userId?: string,
  ) {
    await this.assertCajaAbierta('registrar pagos');
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
      throw new BadRequestException('No se puede registrar un pago sin ítems');
    }

    const paymentMethod = dto.paymentMethod as PaymentMethod;
    if (paymentMethod === PaymentMethod.MIXTO) {
      throw new BadRequestException(
        'Un pago parcial se registra con un solo método (efectivo, Yape/Plin o tarjeta)',
      );
    }
    const paid = sumPagos(order.pagos);
    const remaining = Math.max(0, Math.round((order.total - paid) * 100) / 100);
    const amount = Math.round(dto.monto * 100) / 100;

    if (amount > remaining) {
      throw new BadRequestException(
        `El pago no puede superar el saldo pendiente de S/ ${remaining.toFixed(2)}`,
      );
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
      remainingAmount: Math.max(
        0,
        Math.round((remaining - amount) * 100) / 100,
      ),
    };
  }

  async checkout(tableId: string, dto: CheckoutDto, userId?: string) {
    await this.assertCajaAbierta('cobrar y cerrar mesas');
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: { currentOrder: { include: ORDER_INCLUDE } },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada');

    if (!table.currentOrderId || !table.currentOrder) {
      // Si la mesa no tiene una orden asociada pero estaba marcada como ocupada, se libera limpiamente
      await this.prisma.$transaction([
        this.prisma.table.update({
          where: { id: table.id },
          data: { status: TableStatus.AVAILABLE, currentOrderId: null },
        }),
        this.prisma.table.updateMany({
          where: { joinedToId: table.id },
          data: { joinedToId: null },
        }),
      ]);
      return {
        id: table.id,
        code: `#MESA-${table.number}`,
        customer: `Mesa ${table.number}`,
        type: 'MESA',
        status: OrderStatus.CANCELADO,
        subtotal: 0,
        igv: 0,
        total: 0,
        items: [],
        pagos: [],
      };
    }

    const order = table.currentOrder;
    if (order.items.length === 0) {
      // Si la mesa no tiene ítems registrados (se abrió por error o el cliente se retiró sin consumir),
      // se desvinculan las mesas agrupadas, se libera la mesa y se elimina la orden vacía de la BD.
      await this.prisma.$transaction([
        this.prisma.table.update({
          where: { id: table.id },
          data: { status: TableStatus.AVAILABLE, currentOrderId: null },
        }),
        this.prisma.table.updateMany({
          where: { joinedToId: table.id },
          data: { joinedToId: null },
        }),
      ]);
      await this.prisma.order.delete({ where: { id: order.id } });

      return {
        ...order,
        status: OrderStatus.CANCELADO,
        items: [],
        pagos: [],
      };
    }

    const paymentMethod = dto.paymentMethod as PaymentMethod;
    const isMixto = paymentMethod === PaymentMethod.MIXTO;
    const paidBefore = sumPagos(order.pagos);
    const remainingBefore = Math.max(
      0,
      Math.round((order.total - paidBefore) * 100) / 100,
    );
    const mixedAmount = (dto.montoEfectivo ?? 0) + (dto.montoDigital ?? 0);

    if (
      isMixto &&
      remainingBefore > 0 &&
      Math.abs(mixedAmount - remainingBefore) > 0.01
    ) {
      throw new BadRequestException(
        `El pago mixto debe sumar exactamente S/ ${remainingBefore.toFixed(2)}`,
      );
    }

    const pagosData: Prisma.PagoCreateWithoutOrderInput[] =
      remainingBefore <= 0
        ? []
        : isMixto
          ? [
              {
                metodoPago: PaymentMethod.EFECTIVO,
                monto: dto.montoEfectivo ?? 0,
              },
              {
                metodoPago: PaymentMethod.YAPE_PLIN,
                monto: dto.montoDigital ?? 0,
              },
            ].filter((p) => p.monto > 0)
          : [{ metodoPago: paymentMethod, monto: remainingBefore }];

    const now = new Date();

    // El pedido pasa a ENTREGADO y la mesa vuelve a AVAILABLE en el mismo golpe —
    // son escrituras a tablas distintas sin dependencia entre sí.
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
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
      });
      await tx.table.update({
        where: { id: table.id },
        data: { status: TableStatus.AVAILABLE, currentOrderId: null },
      });
      await tx.table.updateMany({
        where: { joinedToId: table.id },
        data: { joinedToId: null },
      });
      return updatedOrder;
    });

    return updatedOrder;
  }

  // Carga la mesa con su cuenta (ítems, extras y pagos) y el ítem a modificar.
  private async loadItemContext(tableId: string, itemId: string) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: { currentOrder: { include: ORDER_EDIT_INCLUDE } },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (!table.currentOrderId || !table.currentOrder) {
      throw new BadRequestException(
        `La mesa ${table.number} no tiene una cuenta abierta`,
      );
    }
    const item = table.currentOrder.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(
        'Ítem no encontrado en la cuenta de esta mesa',
      );
    }
    return { table, order: table.currentOrder, item };
  }

  // Nunca se puede dejar una cuenta por debajo de lo ya cobrado.
  private assertNoPagadoDeMas(nuevoTotal: number, pagos: { monto: number }[]) {
    const paid = sumPagos(pagos);
    if (round2(nuevoTotal) < paid) {
      throw new BadRequestException(
        `La cuenta ya tiene S/ ${paid.toFixed(2)} pagados; no se puede reducir a S/ ${round2(nuevoTotal).toFixed(2)}`,
      );
    }
  }

  // Corrige un ítem ya creado (cantidad y/o notas) — para cuando el mesero se
  // equivoca al armar una tanda y ya se envió. Ajusta inventario por la
  // diferencia (no por el total) y recalcula el total desde los ítems de la
  // cuenta, con la misma regla que al agregarlos (extras por unidad).
  async updateItem(
    tableId: string,
    itemId: string,
    dto: UpdateItemDto,
    userId?: string,
  ) {
    const { table, order, item } = await this.loadItemContext(tableId, itemId);

    const nuevaCantidad = dto.cantidad ?? item.cantidad;
    const cantidadDelta = nuevaCantidad - item.cantidad;

    const itemsDespues = order.items.map((i) =>
      i.id === itemId ? { ...i, cantidad: nuevaCantidad } : i,
    );
    const { total, subtotal, igv } = splitIgv(sumLineTotals(itemsDespues));
    this.assertNoPagadoDeMas(total, order.pagos);

    const motivo = `Corrección de ítem — Mesa ${table.number}`;
    const inventoryOps =
      cantidadDelta !== 0
        ? await this.buildAdjustOps(item, cantidadDelta, userId, motivo)
        : [];

    const [updatedOrder] = await this.prisma
      .$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: {
            total,
            subtotal,
            igv,
            items: {
              update: {
                where: { id: itemId },
                data: {
                  cantidad: nuevaCantidad,
                  subtotal: item.precio * nuevaCantidad,
                  notas: dto.notas,
                  kitchenStatus: dto.kitchenStatus as ItemKitchenStatus,
                },
              },
            },
          },
          include: ORDER_INCLUDE,
        }),
        ...inventoryOps,
      ])
      .catch((error: unknown) => {
        throw esSinStock(error) ? sinStockConcurrente() : error;
      });

    return { ...table, currentOrder: updatedOrder };
  }

  // Quita un ítem agregado por error. Revierte el inventario que se había
  // descontado al agregarlo (como si nunca se hubiera pedido). Si era el
  // último ítem de la cuenta, la mesa vuelve a estar libre en vez de quedar
  // "ocupada" con una orden vacía — misma regla que rige al abrir la mesa.
  async removeItem(tableId: string, itemId: string, userId?: string) {
    const { table, order, item } = await this.loadItemContext(tableId, itemId);

    const restantes = order.items.filter((i) => i.id !== itemId);
    const { total, subtotal, igv } = splitIgv(sumLineTotals(restantes));
    // También cubre el caso de vaciar una cuenta que ya tiene pagos: borrar la
    // orden borraría esos pagos en cascada.
    this.assertNoPagadoDeMas(total, order.pagos);

    const motivo = `Eliminación de ítem — Mesa ${table.number}`;
    const inventoryOps = await this.buildAdjustOps(
      item,
      -item.cantidad,
      userId,
      motivo,
    );

    if (restantes.length === 0) {
      // El pedido queda vacío: primero se libera la mesa (la FK de Table
      // apunta a Order) y recién entonces se borra la orden vacía, en cascada
      // con su único ítem — mismo orden usado para limpiar mesas fantasma.
      await this.prisma.$transaction([
        ...inventoryOps,
        this.prisma.table.update({
          where: { id: table.id },
          data: { status: TableStatus.AVAILABLE, currentOrderId: null },
        }),
        this.prisma.table.updateMany({
          where: { joinedToId: table.id },
          data: { joinedToId: null },
        }),
        this.prisma.order.delete({ where: { id: order.id } }),
      ]);
      return this.getTableDetail(table.id);
    }

    const [updatedOrder] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: { total, subtotal, igv, items: { delete: { id: itemId } } },
        include: ORDER_INCLUDE,
      }),
      ...inventoryOps,
    ]);

    return { ...table, currentOrder: updatedOrder };
  }

  // Operaciones de inventario por la DIFERENCIA de cantidad de un ítem ya existente
  // (positiva = se pidió más, se descuenta más; negativa = se quitó cantidad
  // o se eliminó el ítem entero, se repone stock). Reutiliza la misma receta
  // que se usó para descontar al crear el ítem. Se devuelven sin ejecutar para
  // que el llamador las agrupe en una transacción.
  private async buildAdjustOps(
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

    if (deltas.size === 0) return [];

    const tipo =
      cantidadDelta > 0 ? MovimientoTipo.SALIDA : MovimientoTipo.ENTRADA;
    // Subir la cantidad también consume stock: no se permite si no alcanza
    if (cantidadDelta > 0) await assertStockSuficiente(this.prisma, deltas);

    return [
      ...[...deltas.entries()].map(([insumoId, cantidad]) =>
        cantidadDelta > 0
          ? descontarStock(this.prisma, insumoId, cantidad)
          : this.prisma.insumo.update({
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
    ];
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
  private async buildDeductionOps(
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

    if (deducciones.size === 0) return [];
    await assertStockSuficiente(this.prisma, deducciones);

    return [
      ...[...deducciones.entries()].map(([insumoId, cantidad]) =>
        descontarStock(this.prisma, insumoId, cantidad),
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
    ];
  }
}
