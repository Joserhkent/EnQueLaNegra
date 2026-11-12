import { CajaService } from './caja.service';
import { PrismaService } from '../prisma.service';
import { EstadoCaja, PaymentMethod, OrderStatus } from '@prisma/client';

describe('E2E CICLO COMPLETO DE CAJA: MEDIANOCHE, ARQUEO, RETIRO, REAPERTURA EN CERO', () => {
  let cajaService: CajaService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres@localhost/enquelanegra_staging?host=/tmp&port=54329';
    prisma = new PrismaService();
    await prisma.onModuleInit();
    cajaService = new CajaService(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    // Limpiar órdenes de prueba anteriores
    await prisma.pago.deleteMany({
      where: { order: { code: { startsWith: 'ORD-E2E-' } } },
    });
    await prisma.order.deleteMany({
      where: { code: { startsWith: 'ORD-E2E-' } },
    });

    // Cerrar cualquier caja abierta previa para iniciar con entorno limpio
    await prisma.cajaSesion.updateMany({
      where: { estado: EstadoCaja.ABIERTA },
      data: { estado: EstadoCaja.CERRADA, fechaCierre: new Date() },
    });
  });

  it('Ciclo completo: Apertura 15:00 -> Venta 23:55 -> Medianoche -> Venta 00:50 -> Cierre con fondoQueQueda=100 -> Reabrir con prefill=100 y totales en S/ 0.00', async () => {
    // =========================================================================
    // 1. VIERNES 15:00 LIMA (20:00 UTC) - Apertura de turno con S/ 100
    // =========================================================================
    const tApertura = new Date('2026-11-13T20:00:00.000Z'); // Viernes 15:00 Lima
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    jest.setSystemTime(tApertura);

    // Verificamos estado inicial antes de abrir
    const estadoInicial = await cajaService.getEstadoActual();
    expect(estadoInicial.isOpen).toBe(false);

    const realUser = {
      id: '95705cb1-e2d8-407c-98bc-62da23a35609',
      name: 'La Negra (Jefa)',
      username: 'admin',
      rol: { id: 'r1', nombre: 'Jefe' },
    };

    // Abrimos caja con fondo de S/ 100.00
    const sesionViernes = await cajaService.abrirCaja(
      { montoInicial: 100, notas: 'Apertura turno viernes' },
      realUser.id,
      realUser as any,
    );

    expect(sesionViernes.estado).toBe(EstadoCaja.ABIERTA);
    expect(sesionViernes.montoInicial).toBe(100);
    expect(sesionViernes.fechaNegocio).toBe('2026-11-13');

    // Estado inmediatamente después de abrir
    const estadoTrasApertura = await cajaService.getEstadoActual();
    expect(estadoTrasApertura.isOpen).toBe(true);
    expect(estadoTrasApertura.resumenActual?.montoInicial).toBe(100);
    expect(estadoTrasApertura.resumenActual?.totalVendido).toBe(0);
    expect(estadoTrasApertura.resumenActual?.efectivoVentas).toBe(0);
    expect(estadoTrasApertura.resumenActual?.yapePlin).toBe(0);
    expect(estadoTrasApertura.resumenActual?.efectivoEsperado).toBe(100);
    expect(estadoTrasApertura.esSesionOlvidada).toBe(false);

    // =========================================================================
    // 2. VIERNES 23:55 LIMA (SÁBADO 04:55 UTC) - Venta 1: S/ 50 en Efectivo
    // =========================================================================
    const tVenta1 = new Date('2026-11-14T04:55:00.000Z');
    jest.setSystemTime(tVenta1);

    // Creamos pedido y pago con FOR SHARE vinculado a la sesión activa
    const order1 = await prisma.$transaction(async (tx) => {
      const [activa] = await tx.$queryRaw<any[]>`
        SELECT * FROM "CajaSesion" WHERE "estado" = 'ABIERTA'::"EstadoCaja" FOR SHARE LIMIT 1
      `;
      const ord = await tx.order.create({
        data: {
          code: 'ORD-E2E-01',
          customer: 'Cliente Viernes Noche',
          subtotal: 50.0,
          igv: 0.0,
          total: 50.0,
          paymentMethod: PaymentMethod.EFECTIVO,
          status: OrderStatus.ENTREGADO,
          cajaSesionId: activa.id,
          fechaNegocio: activa.fechaNegocio,
          fecha: '2026-11-13',
          hora: '23:55',
        },
      });
      await tx.pago.create({
        data: {
          orderId: ord.id,
          monto: 50.0,
          metodoPago: PaymentMethod.EFECTIVO,
          cajaSesionId: activa.id,
        },
      });
      return ord;
    });

    const cobrosTrasVenta1 = await cajaService.getCobrosSesionActiva();
    expect(cobrosTrasVenta1.length).toBe(1);
    expect(cobrosTrasVenta1[0].montoCobradoEnSesion).toBe(50.0);
    expect(cobrosTrasVenta1[0].efectivoEnSesion).toBe(50.0);

    const estadoTrasVenta1 = await cajaService.getEstadoActual();
    expect(estadoTrasVenta1.resumenActual?.totalVendido).toBe(50.0);
    expect(estadoTrasVenta1.resumenActual?.efectivoVentas).toBe(50.0);
    expect(estadoTrasVenta1.resumenActual?.cantidadPedidos).toBe(1);

    // =========================================================================
    // 3. SÁBADO 00:50 LIMA (05:50 UTC) - CRUZANDO LA MEDIANOCHE
    // =========================================================================
    const tVenta2 = new Date('2026-11-14T05:50:00.000Z');
    jest.setSystemTime(tVenta2);

    // Comprobamos que a las 00:50 NO es sesión olvidada (corte es a las 06:00 a.m.)
    const estadoMedianoche = await cajaService.getEstadoActual();
    expect(estadoMedianoche.esSesionOlvidada).toBe(false);

    // Venta 2: Cobro mixto S/ 20 efectivo + S/ 15 Yape = S/ 35
    await prisma.$transaction(async (tx) => {
      const [activa] = await tx.$queryRaw<any[]>`
        SELECT * FROM "CajaSesion" WHERE "estado" = 'ABIERTA'::"EstadoCaja" FOR SHARE LIMIT 1
      `;
      const ord = await tx.order.create({
        data: {
          code: 'ORD-E2E-02',
          customer: 'Cliente Madrugada Post Medianoche',
          subtotal: 35.0,
          igv: 0.0,
          total: 35.0,
          paymentMethod: PaymentMethod.MIXTO,
          status: OrderStatus.ENTREGADO,
          cajaSesionId: activa.id,
          fechaNegocio: activa.fechaNegocio,
          fecha: '2026-11-14',
          hora: '00:50',
        },
      });
      await tx.pago.create({
        data: {
          orderId: ord.id,
          monto: 20.0,
          metodoPago: PaymentMethod.EFECTIVO,
          cajaSesionId: activa.id,
        },
      });
      await tx.pago.create({
        data: {
          orderId: ord.id,
          monto: 15.0,
          metodoPago: PaymentMethod.YAPE_PLIN,
          cajaSesionId: activa.id,
        },
      });
    });

    // Verificamos totales acumulados en la sesión que cruzó la medianoche
    const estadoTrasVenta2 = await cajaService.getEstadoActual();
    expect(estadoTrasVenta2.resumenActual?.totalVendido).toBe(85.0); // 50 + 35
    expect(estadoTrasVenta2.resumenActual?.efectivoVentas).toBe(70.0); // 50 + 20
    expect(estadoTrasVenta2.resumenActual?.yapePlin).toBe(15.0); // 15
    expect(estadoTrasVenta2.resumenActual?.efectivoEsperado).toBe(170.0); // 100 fondo + 70 efectivo

    // =========================================================================
    // 4. SÁBADO 01:05 LIMA (06:05 UTC) - CIERRE DE TURNO CON RETIRO Y FONDO
    // =========================================================================
    const tCierre = new Date('2026-11-14T06:05:00.000Z');
    jest.setSystemTime(tCierre);

    // Arqueo:
    // Efectivo contado en gaveta = S/ 170.00 (cuadre exacto)
    // Fondo que queda para siguiente turno = S/ 100.00
    // Efectivo retirado = S/ 70.00 (170 - 100)
    const sesionCerrada = await cajaService.cerrarCajaSesion(
      {
        efectivoReal: 170.0,
        fondoQueQueda: 100.0,
        notas: 'Cierre de turno normal post medianoche, cuadre exacto.',
      },
      realUser.id,
      realUser as any,
    );

    expect(sesionCerrada.estado).toBe(EstadoCaja.CERRADA);
    expect(sesionCerrada.efectivoEsperado).toBe(170.0);
    expect(sesionCerrada.efectivoReal).toBe(170.0);
    expect(sesionCerrada.diferencia).toBe(0.0);
    expect(sesionCerrada.fondoQueQueda).toBe(100.0);
    expect(sesionCerrada.efectivoRetirado).toBe(70.0);

    // =========================================================================
    // 5. SÁBADO 12:00 LIMA (17:00 UTC) - REAPERTURA DE SIGUIENTE JORNADA
    // =========================================================================
    const tSiguienteJornada = new Date('2026-11-14T17:00:00.000Z');
    jest.setSystemTime(tSiguienteJornada);

    // getEstadoActual con caja cerrada:
    const estadoAntesDeReabrir = await cajaService.getEstadoActual();
    expect(estadoAntesDeReabrir.isOpen).toBe(false);
    expect(estadoAntesDeReabrir.lastSession?.fondoQueQueda).toBe(100.0);

    // La UI toma lastSession.fondoQueQueda como prefill (S/ 100.00)
    const prefillSugerido = estadoAntesDeReabrir.lastSession?.fondoQueQueda ?? 0;
    expect(prefillSugerido).toBe(100.0);

    // El cajero abre la caja con los S/ 100 sugeridos
    const sesionSabado = await cajaService.abrirCaja(
      { montoInicial: prefillSugerido, notas: 'Apertura sábado mediodía' },
      realUser.id,
      realUser as any,
    );

    expect(sesionSabado.estado).toBe(EstadoCaja.ABIERTA);
    expect(sesionSabado.fechaNegocio).toBe('2026-11-14');
    expect(sesionSabado.montoInicial).toBe(100.0);

    // VERIFICACIÓN DEL PROBLEMA REPORTADO POR EL CLIENTE:
    // ¿Aparecen los S/ 85 o S/ 218 del día anterior? ¡NO!
    // Los totales deben estar en S/ 0.00 y solo debe figurar el fondo inicial de S/ 100.00:
    const estadoNuevaSesion = await cajaService.getEstadoActual();
    expect(estadoNuevaSesion.isOpen).toBe(true);
    expect(estadoNuevaSesion.resumenActual?.montoInicial).toBe(100.0);
    expect(estadoNuevaSesion.resumenActual?.totalVendido).toBe(0.0); // ¡CERO!
    expect(estadoNuevaSesion.resumenActual?.efectivoVentas).toBe(0.0); // ¡CERO!
    expect(estadoNuevaSesion.resumenActual?.yapePlin).toBe(0.0); // ¡CERO!
    expect(estadoNuevaSesion.resumenActual?.efectivoEsperado).toBe(100.0); // ¡Solo el fondo!
    expect(estadoNuevaSesion.resumenActual?.cantidadPedidos).toBe(0); // ¡CERO pedidos!

    // Y la lista de cobros de la sesión activa debe estar vacía
    const cobrosNuevaSesion = await cajaService.getCobrosSesionActiva();
    expect(cobrosNuevaSesion.length).toBe(0);

    jest.useRealTimers();
  });
});
