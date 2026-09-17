import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';

@Injectable()
export class CajaService {
  constructor(private prisma: PrismaService) {}

  async findAllCierres() {
    return this.prisma.cierreCaja.findMany({
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getResumenHoy() {
    const todayStr = new Date().toISOString().split('T')[0];

    const ordersToday = await this.prisma.order.findMany({
      where: {
        fecha: todayStr,
        status: { notIn: [OrderStatus.CANCELADO, OrderStatus.OPEN] },
      },
      include: { pagos: true },
    });

    let totalVendido = 0;
    let efectivo = 0;
    let yapePlin = 0;
    let tarjeta = 0;

    ordersToday.forEach((order) => {
      totalVendido += order.total;
      order.pagos.forEach((pago) => {
        if (pago.metodoPago === PaymentMethod.EFECTIVO) efectivo += pago.monto;
        if (pago.metodoPago === PaymentMethod.YAPE_PLIN) yapePlin += pago.monto;
        if (pago.metodoPago === PaymentMethod.TARJETA) tarjeta += pago.monto;
      });
    });

    return {
      fecha: todayStr,
      totalVendido,
      efectivo,
      yapePlin,
      tarjeta,
      cantidadPedidos: ordersToday.length,
    };
  }

  async cerrarCaja(
    dto: CreateCierreDto,
    userId?: string,
    userObj?: AuthenticatedUser,
  ) {
    const resumen = await this.getResumenHoy();
    const now = new Date();
    const hora = now.toTimeString().split(' ')[0].substring(0, 5);

    return this.prisma.cierreCaja.create({
      data: {
        fecha: resumen.fecha,
        hora,
        totalVendido: resumen.totalVendido,
        efectivo: resumen.efectivo,
        yapePlin: resumen.yapePlin,
        tarjeta: resumen.tarjeta,
        cantidadPedidos: resumen.cantidadPedidos,
        usuarioId: userId,
        usuario: userObj?.name || 'Administrador POS',
        notas: dto.notas || 'Cierre de turno registrado',
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });
  }
}
