import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { EstadoCaja, OrderStatus, PaymentMethod } from '@prisma/client';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';

@Injectable()
export class CajaService {
  constructor(private prisma: PrismaService) {}

  async getEstadoActual() {
    const activeSession = await this.prisma.cajaSesion.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
      include: {
        userApertura: { select: { id: true, name: true, username: true } },
      },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!activeSession) {
      const lastSession = await this.prisma.cajaSesion.findFirst({
        where: { estado: EstadoCaja.CERRADA },
        include: {
          userApertura: { select: { id: true, name: true, username: true } },
          userCierre: { select: { id: true, name: true, username: true } },
        },
        orderBy: { fechaCierre: 'desc' },
      });
      return { isOpen: false, sesion: null, lastSession };
    }

    const resumen = await this.calcularResumenSesion(activeSession);
    const efectivoEsperado = Number(
      (activeSession.montoInicial + resumen.efectivo).toFixed(2),
    );

    return {
      isOpen: true,
      sesion: activeSession,
      resumenActual: {
        montoInicial: activeSession.montoInicial,
        totalVendido: resumen.totalVendido,
        efectivoVentas: resumen.efectivo,
        yapePlin: resumen.yapePlin,
        tarjeta: resumen.tarjeta,
        efectivoEsperado,
        cantidadPedidos: resumen.cantidadPedidos,
      },
    };
  }

  async abrirCaja(
    dto: AbrirCajaDto,
    userId?: string,
    userObj?: AuthenticatedUser,
  ) {
    const activeSession = await this.prisma.cajaSesion.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
    });

    if (activeSession) {
      throw new BadRequestException(
        'Ya existe una caja abierta actualmente. Debe cerrarla antes de abrir una nueva.',
      );
    }

    return this.prisma.cajaSesion.create({
      data: {
        estado: EstadoCaja.ABIERTA,
        montoInicial: dto.montoInicial,
        usuarioAperturaId: userId,
        usuarioApertura: userObj?.name || 'Cajero POS',
        notasApertura: dto.notas,
      },
      include: {
        userApertura: { select: { id: true, name: true, username: true } },
      },
    });
  }

  async cerrarCajaSesion(
    dto: CerrarCajaDto,
    userId?: string,
    userObj?: AuthenticatedUser,
  ) {
    const activeSession = await this.prisma.cajaSesion.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!activeSession) {
      throw new BadRequestException('No hay ninguna caja abierta para cerrar.');
    }

    const resumen = await this.calcularResumenSesion(activeSession);
    const now = new Date();
    const efectivoEsperado = Number(
      (activeSession.montoInicial + resumen.efectivo).toFixed(2),
    );
    const efectivoReal =
      dto.efectivoReal !== undefined
        ? Number(dto.efectivoReal)
        : efectivoEsperado;
    const diferencia = Number((efectivoReal - efectivoEsperado).toFixed(2));

    const sessionCerrada = await this.prisma.cajaSesion.update({
      where: { id: activeSession.id },
      data: {
        estado: EstadoCaja.CERRADA,
        fechaCierre: now,
        usuarioCierreId: userId,
        usuarioCierre: userObj?.name || 'Administrador POS',
        totalVendido: resumen.totalVendido,
        efectivoVentas: resumen.efectivo,
        yapePlin: resumen.yapePlin,
        tarjeta: resumen.tarjeta,
        cantidadPedidos: resumen.cantidadPedidos,
        efectivoEsperado,
        efectivoReal,
        diferencia,
        notasCierre: dto.notas || 'Cierre de turno registrado',
      },
      include: {
        userApertura: { select: { id: true, name: true, username: true } },
        userCierre: { select: { id: true, name: true, username: true } },
      },
    });

    const hora = now.toTimeString().split(' ')[0].substring(0, 5);
    const fecha = now.toISOString().split('T')[0];
    await this.prisma.cierreCaja.create({
      data: {
        fecha,
        hora,
        totalVendido: resumen.totalVendido,
        efectivo: resumen.efectivo,
        yapePlin: resumen.yapePlin,
        tarjeta: resumen.tarjeta,
        cantidadPedidos: resumen.cantidadPedidos,
        usuarioId: userId,
        usuario: userObj?.name || 'Administrador POS',
        notas:
          dto.notas ||
          `Cierre de turno (Base: S/ ${activeSession.montoInicial.toFixed(2)}, Esperado: S/ ${efectivoEsperado.toFixed(2)}, Diferencia: S/ ${diferencia.toFixed(2)})`,
      },
    });

    return sessionCerrada;
  }

  async findAllSesiones() {
    return this.prisma.cajaSesion.findMany({
      include: {
        userApertura: { select: { id: true, name: true, username: true } },
        userCierre: { select: { id: true, name: true, username: true } },
      },
      orderBy: { fechaApertura: 'desc' },
    });
  }

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
      if (order.pagos && order.pagos.length > 0) {
        order.pagos.forEach((pago) => {
          if (pago.metodoPago === PaymentMethod.EFECTIVO)
            efectivo += pago.monto;
          if (pago.metodoPago === PaymentMethod.YAPE_PLIN)
            yapePlin += pago.monto;
          if (pago.metodoPago === PaymentMethod.TARJETA) tarjeta += pago.monto;
        });
      } else {
        if (order.paymentMethod === PaymentMethod.EFECTIVO)
          efectivo += order.total;
        else if (order.paymentMethod === PaymentMethod.YAPE_PLIN)
          yapePlin += order.total;
        else if (order.paymentMethod === PaymentMethod.TARJETA)
          tarjeta += order.total;
        else if (order.paymentMethod === PaymentMethod.MIXTO) {
          efectivo += order.montoEfectivo || 0;
          yapePlin += order.montoDigital || 0;
        }
      }
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

  async cerrarCajaLegacy(
    dto: CreateCierreDto,
    userId?: string,
    userObj?: AuthenticatedUser,
  ) {
    const activeSession = await this.prisma.cajaSesion.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
    });
    if (activeSession) {
      return this.cerrarCajaSesion({ notas: dto.notas }, userId, userObj);
    }

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
  private async calcularResumenSesion(session: { fechaApertura: Date }) {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: session.fechaApertura },
        status: { notIn: [OrderStatus.CANCELADO, OrderStatus.OPEN] },
      },
      include: { pagos: true },
    });

    let totalVendido = 0;
    let efectivo = 0;
    let yapePlin = 0;
    let tarjeta = 0;

    for (const order of orders) {
      totalVendido += order.total;

      if (order.pagos && order.pagos.length > 0) {
        for (const pago of order.pagos) {
          if (pago.metodoPago === PaymentMethod.EFECTIVO)
            efectivo += pago.monto;
          if (pago.metodoPago === PaymentMethod.YAPE_PLIN)
            yapePlin += pago.monto;
          if (pago.metodoPago === PaymentMethod.TARJETA) tarjeta += pago.monto;
        }
      } else {
        if (order.paymentMethod === PaymentMethod.EFECTIVO)
          efectivo += order.total;
        else if (order.paymentMethod === PaymentMethod.YAPE_PLIN)
          yapePlin += order.total;
        else if (order.paymentMethod === PaymentMethod.TARJETA)
          tarjeta += order.total;
        else if (order.paymentMethod === PaymentMethod.MIXTO) {
          efectivo += order.montoEfectivo || 0;
          yapePlin += order.montoDigital || 0;
        }
      }
    }

    return {
      totalVendido: Number(totalVendido.toFixed(2)),
      efectivo: Number(efectivo.toFixed(2)),
      yapePlin: Number(yapePlin.toFixed(2)),
      tarjeta: Number(tarjeta.toFixed(2)),
      cantidadPedidos: orders.length,
    };
  }
}
