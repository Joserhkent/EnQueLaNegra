import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { OrderStatus, PaymentMethod, EstadoCaja, CajaSesion, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { formatFecha, formatHora, getFechaNegocio, getHoraCorteSesion, verificarSesionOlvidada } from '../common/date';

const toCents = (n: number | null | undefined) => Math.round((Number(n) || 0) * 100);
const fromCents = (c: number) => Math.round(c) / 100;

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
        where: {
          estado: EstadoCaja.CERRADA,
          id: { not: 'legacy-session-migracion' },
        },
        include: {
          userApertura: { select: { id: true, name: true, username: true } },
          userCierre: { select: { id: true, name: true, username: true } },
        },
        orderBy: { fechaCierre: 'desc' },
      });
      return {
        isOpen: false,
        sesion: null,
        lastSession,
      };
    }

    const esSesionOlvidada = verificarSesionOlvidada(activeSession.fechaNegocio, new Date());

    const resumen = await this.calcularResumenSesionTx(this.prisma, activeSession.id);
    const efectivoEsperado = fromCents(
      toCents(activeSession.montoInicial) + toCents(resumen.efectivo),
    );

    return {
      isOpen: true,
      sesion: activeSession,
      esSesionOlvidada,
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
    const fechaNegocio = getFechaNegocio();
    const hoyLima = formatFecha(new Date());

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Bloqueo pesimista FOR UPDATE en PostgreSQL para evitar dos aperturas concurrentes
        const [activeSession] = await tx.$queryRaw<CajaSesion[]>`
          SELECT * FROM "CajaSesion"
          WHERE "estado" = 'ABIERTA'::"EstadoCaja"
          FOR UPDATE
          LIMIT 1
        `;

        if (activeSession) {
          const fn = activeSession.fechaNegocio || formatFecha(activeSession.fechaApertura);
          const esSesionAnterior = verificarSesionOlvidada(fn, new Date());
          throw new BadRequestException({
            code: 'CAJA_ANTERIOR_SIN_CERRAR',
            esSesionAnterior,
            fechaSesion: activeSession.fechaNegocio,
            sesionId: activeSession.id,
            message: 'Existe una sesión de caja abierta actualmente. Debe realizar el arqueo y cierre antes de abrir una nueva.',
          });
        }

        return tx.cajaSesion.create({
          data: {
            estado: EstadoCaja.ABIERTA,
            montoInicial: dto.montoInicial,
            fechaNegocio,
            usuarioAperturaId: userId,
            usuarioApertura: userObj?.name || 'Cajero POS',
            notasApertura: dto.notas,
          },
          include: {
            userApertura: { select: { id: true, name: true, username: true } },
          },
        });
      });
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('caja_sesion_unica_abierta_idx')) {
        throw new BadRequestException({
          code: 'CAJA_ANTERIOR_SIN_CERRAR',
          message: 'Existe una sesión de caja abierta actualmente. Debe realizar el arqueo y cierre antes de abrir una nueva.',
        });
      }
      throw err;
    }
  }

  async cerrarCajaSesion(
    dto: CerrarCajaDto,
    userId?: string,
    userObj?: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Bloqueo FOR UPDATE de la caja abierta
      const [activeSession] = await tx.$queryRaw<CajaSesion[]>`
        SELECT * FROM "CajaSesion"
        WHERE "estado" = 'ABIERTA'::"EstadoCaja"
        FOR UPDATE
        LIMIT 1
      `;

      if (!activeSession) {
        throw new BadRequestException('No hay ninguna caja abierta para cerrar.');
      }

      // 2. Mesas con cuenta abierta en salón (OPEN)
      const mesasAbiertas = await tx.order.count({
        where: { status: OrderStatus.OPEN },
      });
      if (mesasAbiertas > 0) {
        throw new BadRequestException(
          `Hay ${mesasAbiertas} mesa(s) con cuenta abierta. Cóbralas o libéralas antes de cerrar la caja.`,
        );
      }

      // 3. Comandas activas en cocina (PREPARACION, PENDIENTE, LISTO)
      const comandasPendientes = await tx.order.findMany({
        where: {
          cajaSesionId: activeSession.id,
          status: { in: [OrderStatus.PENDIENTE, OrderStatus.PREPARACION, OrderStatus.LISTO] },
        },
        select: { id: true, code: true, status: true },
      });

      if (comandasPendientes.length > 0) {
        const rawRole =
          typeof userObj?.rol === 'object' && userObj?.rol?.nombre
            ? userObj.rol.nombre
            : typeof userObj?.rol === 'string'
              ? userObj.rol
              : (userObj as any)?.role || '';
        const esJefe = ['jefe', 'admin', 'administrador', 'jefa'].some((r) =>
          rawRole.toLowerCase().includes(r),
        );
        const forzar = Boolean(dto.forzarCierreConPendientes);

        if (!esJefe || !forzar) {
          const codes = comandasPendientes.map((p) => p.code).join(', ');
          throw new BadRequestException({
            code: 'PEDIDOS_PENDIENTES_EN_COCINA',
            message: `Hay ${comandasPendientes.length} comanda(s) activas en cocina (${codes}). Debe completarlas o cancelarlas antes de cerrar la caja. Solo el Jefe puede forzar el cierre.`,
            comandasPendientes,
          });
        }

        if (!dto.notas || dto.notas.trim().length < 5) {
          throw new BadRequestException(
            'Para forzar el cierre con comandas pendientes es obligatorio ingresar el motivo en las notas (mínimo 5 caracteres).',
          );
        }
      }

      if (dto.efectivoReal === undefined || dto.efectivoReal === null || isNaN(dto.efectivoReal)) {
        throw new BadRequestException('El efectivo contado en gaveta (efectivoReal) es obligatorio.');
      }
      if (dto.fondoQueQueda === undefined || dto.fondoQueQueda === null || isNaN(dto.fondoQueQueda)) {
        throw new BadRequestException('El fondo que queda en gaveta (fondoQueQueda) es obligatorio.');
      }

      // 4. Arqueo y cálculo en centavos enteros
      const resumen = await this.calcularResumenSesionTx(tx, activeSession.id);
      const esperadoCents = toCents(activeSession.montoInicial) + toCents(resumen.efectivo);
      const realCents = toCents(dto.efectivoReal);
      const fondoQuedaCents = toCents(dto.fondoQueQueda);

      if (fondoQuedaCents < 0 || fondoQuedaCents > realCents) {
        throw new BadRequestException(
          `El fondo a dejar (S/ ${fromCents(fondoQuedaCents).toFixed(2)}) debe estar entre 0 y el efectivo contado (S/ ${fromCents(realCents).toFixed(2)}).`,
        );
      }

      const diferenciaCents = realCents - esperadoCents;
      const efectivoRetiradoCents = realCents - fondoQuedaCents;

      if (Math.abs(diferenciaCents) > 0 && (!dto.notas || dto.notas.trim().length < 3)) {
        throw new BadRequestException(
          'El arqueo presenta una diferencia (faltante o sobrante). Debe ingresar una nota obligatoria que justifique el descuadre.',
        );
      }

      const now = new Date();
      const sessionCerrada = await tx.cajaSesion.update({
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
          efectivoEsperado: fromCents(esperadoCents),
          efectivoReal: fromCents(realCents),
          diferencia: fromCents(diferenciaCents),
          fondoQueQueda: fromCents(fondoQuedaCents),
          efectivoRetirado: fromCents(efectivoRetiradoCents),
          notasCierre: dto.notas || 'Cierre de turno registrado',
        },
        include: {
          userApertura: { select: { id: true, name: true, username: true } },
          userCierre: { select: { id: true, name: true, username: true } },
        },
      });

      // Compatibilidad continua con CierreCaja
      await tx.cierreCaja.create({
        data: {
          fecha: formatFecha(now),
          hora: formatHora(now),
          totalVendido: resumen.totalVendido,
          efectivo: resumen.efectivo,
          yapePlin: resumen.yapePlin,
          tarjeta: resumen.tarjeta,
          cantidadPedidos: resumen.cantidadPedidos,
          usuarioId: userId,
          usuario: userObj?.name || 'Administrador POS',
          notas:
            dto.notas ||
            `Cierre de turno (Base: S/ ${activeSession.montoInicial.toFixed(2)}, Esperado: S/ ${fromCents(esperadoCents).toFixed(2)}, Diferencia: S/ ${fromCents(diferenciaCents).toFixed(2)})`,
        },
      });

      return sessionCerrada;
    });
  }

  async getCobrosSesionActiva() {
    const activeSession = await this.prisma.cajaSesion.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!activeSession) {
      return [];
    }

    return this.getCobrosDeSesion(activeSession.id);
  }

  async getCobrosDeSesion(sessionId: string) {
    const pagos = await this.prisma.pago.findMany({
      where: { cajaSesionId: sessionId },
      include: {
        order: {
          include: {
            table: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    // Agrupar pagos por pedido para mostrar el total cobrado en ESTA sesión
    const grupos = new Map<string, {
      id: string;
      code: string;
      customer: string;
      type: string;
      status: string;
      paymentMethod: string;
      orderTotal: number;
      montoCobradoEnSesion: number;
      efectivoEnSesion: number;
      digitalEnSesion: number;
      fecha: string;
      hora: string;
      pagos: any[];
    }>();

    for (const p of pagos) {
      const order = p.order;
      if (!grupos.has(order.id)) {
        grupos.set(order.id, {
          id: order.id,
          code: order.code,
          customer: order.customer,
          type: order.type,
          status: order.status,
          paymentMethod: order.paymentMethod,
          orderTotal: order.total,
          montoCobradoEnSesion: 0,
          efectivoEnSesion: 0,
          digitalEnSesion: 0,
          fecha: order.fecha,
          hora: order.hora,
          pagos: [],
        });
      }

      const item = grupos.get(order.id)!;
      item.pagos.push(p);

      const montoCents = toCents(p.monto);
      if (p.metodoPago === PaymentMethod.EFECTIVO) {
        item.efectivoEnSesion = fromCents(toCents(item.efectivoEnSesion) + montoCents);
      } else {
        item.digitalEnSesion = fromCents(toCents(item.digitalEnSesion) + montoCents);
      }
      item.montoCobradoEnSesion = fromCents(toCents(item.efectivoEnSesion) + toCents(item.digitalEnSesion));
    }

    return Array.from(grupos.values());
  }

  async findAllSesiones() {
    return this.prisma.cajaSesion.findMany({
      where: { id: { not: 'legacy-session-migracion' } },
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
    const todayStr = formatFecha();

    const ordersToday = await this.prisma.order.findMany({
      where: {
        fecha: todayStr,
        status: { notIn: [OrderStatus.CANCELADO, OrderStatus.OPEN] },
      },
      include: { pagos: true },
    });

    let totalVendidoCents = 0;
    let efectivoCents = 0;
    let yapePlinCents = 0;
    let tarjetaCents = 0;

    ordersToday.forEach((order) => {
      totalVendidoCents += toCents(order.total);
      if (order.pagos && order.pagos.length > 0) {
        order.pagos.forEach((pago) => {
          if (pago.metodoPago === PaymentMethod.EFECTIVO) efectivoCents += toCents(pago.monto);
          if (pago.metodoPago === PaymentMethod.YAPE_PLIN) yapePlinCents += toCents(pago.monto);
          if (pago.metodoPago === PaymentMethod.TARJETA) tarjetaCents += toCents(pago.monto);
        });
      } else {
        if (order.paymentMethod === PaymentMethod.EFECTIVO) efectivoCents += toCents(order.total);
        else if (order.paymentMethod === PaymentMethod.YAPE_PLIN) yapePlinCents += toCents(order.total);
        else if (order.paymentMethod === PaymentMethod.TARJETA) tarjetaCents += toCents(order.total);
        else if (order.paymentMethod === PaymentMethod.MIXTO) {
          efectivoCents += toCents(order.montoEfectivo);
          yapePlinCents += toCents(order.montoDigital);
        }
      }
    });

    return {
      fecha: todayStr,
      totalVendido: fromCents(totalVendidoCents),
      efectivo: fromCents(efectivoCents),
      yapePlin: fromCents(yapePlinCents),
      tarjeta: fromCents(tarjetaCents),
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
      const resumen = await this.calcularResumenSesionTx(this.prisma, activeSession.id);
      const montoInicialNum = Number(activeSession.montoInicial || 0);
      const efectivoEsperado = Number(
        (montoInicialNum + resumen.efectivo).toFixed(2),
      );
      return this.cerrarCajaSesion(
        {
          notas: dto.notas,
          efectivoReal: efectivoEsperado,
          fondoQueQueda: 0,
        },
        userId,
        userObj,
      );
    }

    const resumen = await this.getResumenHoy();
    const now = new Date();
    const hora = formatHora(now);

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

  private async calcularResumenSesionTx(
    client: Prisma.TransactionClient | PrismaService,
    sessionId: string,
  ) {
    const pagos = await client.pago.findMany({
      where: { cajaSesionId: sessionId },
    });

    let efectivoCents = 0;
    let yapePlinCents = 0;
    let tarjetaCents = 0;
    const orderIds = new Set<string>();

    for (const p of pagos) {
      orderIds.add(p.orderId);
      const m = toCents(p.monto);
      if (p.metodoPago === PaymentMethod.EFECTIVO) efectivoCents += m;
      else if (p.metodoPago === PaymentMethod.YAPE_PLIN) yapePlinCents += m;
      else if (p.metodoPago === PaymentMethod.TARJETA) tarjetaCents += m;
    }

    const totalVendidoCents = efectivoCents + yapePlinCents + tarjetaCents;

    return {
      totalVendido: fromCents(totalVendidoCents),
      efectivo: fromCents(efectivoCents),
      yapePlin: fromCents(yapePlinCents),
      tarjeta: fromCents(tarjetaCents),
      cantidadPedidos: orderIds.size,
    };
  }
}
