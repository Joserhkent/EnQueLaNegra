import { ResumenService } from './resumen.service';
import { PrismaService } from '../prisma.service';
import { EstadoCaja, OrderStatus, PaymentMethod } from '@prisma/client';
import { RangoDashboard } from './dto/resumen-dashboard.dto';

describe('ResumenService - Pruebas Unitarias e Integración', () => {
  let service: ResumenService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres@localhost/enquelanegra_staging?host=/tmp&port=54329';
    prisma = new PrismaService();
    await prisma.onModuleInit();
    service = new ResumenService(prisma);
  });

  afterAll(async () => {
    await prisma.pago.deleteMany({
      where: { order: { code: { startsWith: 'ORD-RES-' } } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { code: { startsWith: 'ORD-RES-' } } },
    });
    await prisma.order.deleteMany({
      where: { code: { startsWith: 'ORD-RES-' } },
    });
    await prisma.cajaSesion.deleteMany({
      where: { id: { startsWith: 'SES-RES-' } },
    });
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    // Limpiar datos de prueba de tests
    await prisma.pago.deleteMany({
      where: { order: { code: { startsWith: 'ORD-RES-' } } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { code: { startsWith: 'ORD-RES-' } } },
    });
    await prisma.order.deleteMany({
      where: { code: { startsWith: 'ORD-RES-' } },
    });
    await prisma.cajaSesion.deleteMany({
      where: { id: { startsWith: 'SES-RES-' } },
    });
  });

  describe('1. Regla de Horario por día de la semana de la fechaNegocio', () => {
    it('Sábado 00:50 pero con fechaNegocio de Viernes -> eje 15:00 a 02:00', () => {
      // 2026-11-20 es Viernes
      const config = service.getHorarioConfig('2026-11-20');
      expect(config.diaSemana).toBe('VIERNES');
      expect(config.apertura).toBe(15);
      expect(config.cierre).toBe(1);

      const eje = service.generarEjeHorasCronologico(config.apertura, config.cierre, config.toleranciaMargen);
      expect(eje[0]).toBe(15);
      expect(eje).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]);
    });

    it('Sábado 15:00 con fechaNegocio de Sábado -> eje 12:00 a 02:00', () => {
      // 2026-11-21 es Sábado
      const config = service.getHorarioConfig('2026-11-21');
      expect(config.diaSemana).toBe('SÁBADO');
      expect(config.apertura).toBe(12);
      expect(config.cierre).toBe(1);

      const eje = service.generarEjeHorasCronologico(config.apertura, config.cierre, config.toleranciaMargen);
      expect(eje[0]).toBe(12);
      expect(eje).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]);
    });
  });

  describe('2. Cruce de Medianoche y Orden Cronológico Continuo', () => {
    it('Pagos a las 23:55, 00:00:00, 00:50 y 01:48 se agrupan en orden cronológico en la jornada', async () => {
      const fechaNegocio = '2026-11-20'; // Viernes

      // Crear sesión de prueba
      const sesion = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-MEDIANOCHE',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-20T20:00:00.000Z'), // 15:00 Lima
          fechaCierre: new Date('2026-11-21T07:00:00.000Z'),   // 02:00 Lima
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      // Crear órdenes y pagos simulando horas Lima
      // 1. 23:55 Lima (04:55 UTC del 21)
      const ord1 = await prisma.order.create({
        data: {
          code: 'ORD-RES-2355',
          total: 50,
          subtotal: 42.37,
          igv: 7.63,
          fecha: '2026-11-20',
          hora: '23:55',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 50,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-21T04:55:00.000Z'),
              cajaSesionId: sesion.id,
            },
          },
        },
      });

      // 2. 00:00:00 Lima (05:00 UTC del 21)
      const ord2 = await prisma.order.create({
        data: {
          code: 'ORD-RES-0000',
          total: 30,
          subtotal: 25.42,
          igv: 4.58,
          fecha: '2026-11-21',
          hora: '00:00',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 30,
              metodoPago: PaymentMethod.YAPE_PLIN,
              fecha: new Date('2026-11-21T05:00:00.000Z'),
              cajaSesionId: sesion.id,
            },
          },
        },
      });

      // 3. 00:50 Lima (05:50 UTC del 21)
      const ord3 = await prisma.order.create({
        data: {
          code: 'ORD-RES-0050',
          total: 20,
          subtotal: 16.95,
          igv: 3.05,
          fecha: '2026-11-21',
          hora: '00:50',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 20,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-21T05:50:00.000Z'),
              cajaSesionId: sesion.id,
            },
          },
        },
      });

      // 4. 01:48 Lima (06:48 UTC del 21)
      const ord4 = await prisma.order.create({
        data: {
          code: 'ORD-RES-0148',
          total: 40,
          subtotal: 33.9,
          igv: 6.1,
          fecha: '2026-11-21',
          hora: '01:48',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 40,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-21T06:48:00.000Z'),
              cajaSesionId: sesion.id,
            },
          },
        },
      });

      const res = await service.getDashboard({
        rango: RangoDashboard.JORNADA,
        fechaNegocio,
      });

      expect(res.kpis.totalVentas).toBe(140); // 50 + 30 + 20 + 40
      expect(res.kpis.totalComandas).toBe(4);
      expect(res.kpis.efectivoTotal).toBe(110); // 50 + 20 + 40
      expect(res.kpis.digitalTotal).toBe(30);   // 30 Yape

      // Verificar barras de hora:
      const barra23 = res.grafico.barras.find((b) => b.clave === '23')!;
      expect(barra23.total).toBe(50);
      expect(barra23.comandas).toBe(1);

      const barra0 = res.grafico.barras.find((b) => b.clave === '0')!;
      expect(barra0.total).toBe(50); // 30 (00:00) + 20 (00:50)
      expect(barra0.comandas).toBe(2);

      const barra1 = res.grafico.barras.find((b) => b.clave === '1')!;
      expect(barra1.total).toBe(40);
      expect(barra1.comandas).toBe(1);

      // Hora pico debe ser hora 23 o hora 0 (ambas con 50)
      expect(res.kpis.horaPico).not.toBeNull();
      expect(res.kpis.horaPico?.total).toBe(50);
    });
  });

  describe('3. Pago Parcial Entre Sesiones y Cuadre de Caja', () => {
    it('Mesa con pago parcial en sesión A y liquidación en sesión B: Resumen suma cada pago donde entró', async () => {
      const fechaNegocio = '2026-11-22';

      const sesionA = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-PARTIAL-A',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-22T20:00:00.000Z'),
          fechaCierre: new Date('2026-11-22T23:00:00.000Z'),
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      const sesionB = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-PARTIAL-B',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-22T23:05:00.000Z'),
          fechaCierre: new Date('2026-11-23T04:00:00.000Z'),
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      // Mesa de S/ 80 total: S/ 30 pagado en Sesión A, S/ 50 pagado en Sesión B
      const order = await prisma.order.create({
        data: {
          code: 'ORD-RES-MESA-PARTIAL',
          total: 80,
          subtotal: 67.8,
          igv: 12.2,
          fecha: '2026-11-22',
          hora: '17:30',
          fechaNegocio,
          cajaSesionId: sesionB.id, // Sesión final de liquidación
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: [
              {
                monto: 30,
                metodoPago: PaymentMethod.EFECTIVO,
                fecha: new Date('2026-11-22T21:00:00.000Z'), // 16:00 Lima (Sesión A)
                cajaSesionId: sesionA.id,
              },
              {
                monto: 50,
                metodoPago: PaymentMethod.YAPE_PLIN,
                fecha: new Date('2026-11-22T23:30:00.000Z'), // 18:30 Lima (Sesión B)
                cajaSesionId: sesionB.id,
              },
            ],
          },
        },
      });

      // El resumen de la jornada debe sumar ambos pagos (30 + 50 = 80)
      const res = await service.getDashboard({
        rango: RangoDashboard.JORNADA,
        fechaNegocio,
      });

      expect(res.kpis.totalVentas).toBe(80);
      expect(res.kpis.efectivoTotal).toBe(30);
      expect(res.kpis.digitalTotal).toBe(50);
      expect(res.kpis.totalComandas).toBe(1); // 1 comanda única
    });
  });

  describe('4. Exclusión de Pedidos Cancelados', () => {
    it('Un pedido cancelado no suma ventas ni figura en comandas del resumen', async () => {
      const fechaNegocio = '2026-11-23';

      const sesion = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-CANCELADO',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-23T20:00:00.000Z'),
          fechaCierre: new Date('2026-11-24T03:00:00.000Z'),
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      // Pedido activo de S/ 40
      await prisma.order.create({
        data: {
          code: 'ORD-RES-VALID',
          total: 40,
          subtotal: 33.9,
          igv: 6.1,
          fecha: '2026-11-23',
          hora: '16:00',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 40,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-23T21:00:00.000Z'),
              cajaSesionId: sesion.id,
            },
          },
        },
      });

      // Pedido cancelado de S/ 90
      await prisma.order.create({
        data: {
          code: 'ORD-RES-CANCEL',
          total: 90,
          subtotal: 76.27,
          igv: 13.73,
          fecha: '2026-11-23',
          hora: '16:30',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.CANCELADO,
          pagos: {
            create: {
              monto: 90,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-23T21:30:00.000Z'),
              cajaSesionId: sesion.id,
            },
          },
        },
      });

      const res = await service.getDashboard({
        rango: RangoDashboard.JORNADA,
        fechaNegocio,
      });

      expect(res.kpis.totalVentas).toBe(40); // Solo el válido
      expect(res.kpis.totalComandas).toBe(1);
    });
  });

  describe('5. Jornada Sin Ventas', () => {
    it('Devuelve todas las barras con 0px (sin barra artificial de 10%) y horaPico = null', async () => {
      const fechaNegocio = '2026-11-01'; // Jornada sin datos

      const res = await service.getDashboard({
        rango: RangoDashboard.JORNADA,
        fechaNegocio,
      });

      expect(res.kpis.totalVentas).toBe(0);
      expect(res.kpis.totalComandas).toBe(0);
      expect(res.kpis.ticketPromedio).toBe(0);
      expect(res.kpis.horaPico).toBeNull();
      expect(res.grafico.barras.every((b) => b.total === 0)).toBe(true);
    });
  });

  describe('6. Cobro Mixto en una Misma Hora', () => {
    it('Desglosa exactamente el efectivo y digital en el bucket de la hora', async () => {
      const fechaNegocio = '2026-11-24';

      const sesion = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-MIXTO',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-24T20:00:00.000Z'),
          fechaCierre: new Date('2026-11-25T03:00:00.000Z'),
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      // Venta a las 18:00 Lima (23:00 UTC): S/ 35 efectivo + S/ 15 Yape
      await prisma.order.create({
        data: {
          code: 'ORD-RES-MIXTO',
          total: 50,
          subtotal: 42.37,
          igv: 7.63,
          fecha: '2026-11-24',
          hora: '18:00',
          fechaNegocio,
          cajaSesionId: sesion.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: [
              {
                monto: 35,
                metodoPago: PaymentMethod.EFECTIVO,
                fecha: new Date('2026-11-24T23:00:00.000Z'),
                cajaSesionId: sesion.id,
              },
              {
                monto: 15,
                metodoPago: PaymentMethod.YAPE_PLIN,
                fecha: new Date('2026-11-24T23:00:00.000Z'),
                cajaSesionId: sesion.id,
              },
            ],
          },
        },
      });

      const res = await service.getDashboard({
        rango: RangoDashboard.JORNADA,
        fechaNegocio,
      });

      const barra18 = res.grafico.barras.find((b) => b.clave === '18')!;
      expect(barra18.total).toBe(50);
      expect(barra18.efectivo).toBe(35);
      expect(barra18.digital).toBe(15);
      expect(barra18.comandas).toBe(1);
    });
  });

  describe('7. Múltiples Sesiones en la Misma FechaNegocio', () => {
    it('Suma todas las sesiones con la misma fechaNegocio consolidando la jornada', async () => {
      const fechaNegocio = '2026-11-25';

      const s1 = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-MULTI-1',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-25T20:00:00.000Z'),
          fechaCierre: new Date('2026-11-25T23:00:00.000Z'),
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      const s2 = await prisma.cajaSesion.create({
        data: {
          id: 'SES-RES-MULTI-2',
          estado: EstadoCaja.CERRADA,
          montoInicial: 100,
          fechaApertura: new Date('2026-11-25T23:05:00.000Z'),
          fechaCierre: new Date('2026-11-26T03:00:00.000Z'),
          fechaNegocio,
          usuarioAperturaId: '95705cb1-e2d8-407c-98bc-62da23a35609',
        },
      });

      await prisma.order.create({
        data: {
          code: 'ORD-RES-S1',
          total: 55,
          subtotal: 46.61,
          igv: 8.39,
          fecha: '2026-11-25',
          hora: '16:00',
          fechaNegocio,
          cajaSesionId: s1.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 55,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-25T21:00:00.000Z'),
              cajaSesionId: s1.id,
            },
          },
        },
      });

      await prisma.order.create({
        data: {
          code: 'ORD-RES-S2',
          total: 65,
          subtotal: 55.08,
          igv: 9.92,
          fecha: '2026-11-25',
          hora: '20:00',
          fechaNegocio,
          cajaSesionId: s2.id,
          status: OrderStatus.ENTREGADO,
          pagos: {
            create: {
              monto: 65,
              metodoPago: PaymentMethod.EFECTIVO,
              fecha: new Date('2026-11-26T01:00:00.000Z'),
              cajaSesionId: s2.id,
            },
          },
        },
      });

      const res = await service.getDashboard({
        rango: RangoDashboard.JORNADA,
        fechaNegocio,
      });

      expect(res.kpis.totalVentas).toBe(120); // 55 + 65
      expect(res.kpis.totalComandas).toBe(2);
    });
  });
});
