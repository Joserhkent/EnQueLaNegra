/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks de Prisma tipados como any */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CajaService } from './caja.service';
import { PrismaService } from '../prisma.service';
import { EstadoCaja } from '@prisma/client';

describe('CajaService', () => {
  let service: CajaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      $queryRaw: jest.fn(),
      cajaSesion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      cierreCaja: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [CajaService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CajaService>(CajaService);
  });

  describe('abrirCaja', () => {
    it('abre una caja exitosamente cuando no hay ninguna abierta', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.cajaSesion.findFirst.mockResolvedValue(null);
      prisma.cajaSesion.create.mockResolvedValue({
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        usuarioApertura: 'Admin',
      });

      const res = await service.abrirCaja({ montoInicial: 100 });
      expect(res.estado).toBe(EstadoCaja.ABIERTA);
      expect(prisma.cajaSesion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            montoInicial: 100,
            estado: EstadoCaja.ABIERTA,
          }),
        }),
      );
    });

    it('rechaza abrir caja si ya existe una abierta y evalúa esSesionAnterior a las 00:50 (false) y 06:01 (true)', async () => {
      const activeSession = {
        id: 'sesion-activa',
        estado: EstadoCaja.ABIERTA,
        fechaNegocio: '2026-11-13',
      };
      prisma.$queryRaw.mockResolvedValue([activeSession]);
      prisma.cajaSesion.findFirst.mockResolvedValue(activeSession);

      // A las 00:50 Lima (05:50 UTC) -> esSesionAnterior debe ser false
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-11-14T05:50:00.000Z'));

      try {
        await service.abrirCaja({ montoInicial: 50 });
        fail('Debió lanzar error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.code).toBe('CAJA_ANTERIOR_SIN_CERRAR');
        expect(resp.esSesionAnterior).toBe(false);
      }

      // A las 06:01 Lima (11:01 UTC) -> esSesionAnterior debe ser true
      jest.setSystemTime(new Date('2026-11-14T11:01:00.000Z'));

      try {
        await service.abrirCaja({ montoInicial: 50 });
        fail('Debió lanzar error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.code).toBe('CAJA_ANTERIOR_SIN_CERRAR');
        expect(resp.esSesionAnterior).toBe(true);
      }

      jest.useRealTimers();
    });
  });

  describe('cerrarCajaSesion', () => {
    it('cierra la caja y calcula arqueo con cuadre exacto', async () => {
      const activeSession = {
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
        usuarioApertura: 'Cajero',
      };
      prisma.$queryRaw.mockResolvedValue([activeSession]);
      prisma.cajaSesion.findFirst.mockResolvedValue(activeSession);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockImplementation(({ where }) => {
        if (where?.status?.in) {
          return []; // Sin comandas pendientes
        }
        return [
          {
            id: 'ord-1',
            total: 50,
            paymentMethod: 'EFECTIVO',
            pagos: [],
          },
        ];
      });
      prisma.pago.findMany.mockResolvedValue([
        {
          id: 'p-1',
          monto: 50,
          metodoPago: 'EFECTIVO',
          orderId: 'ord-1',
        },
      ]);
      prisma.cajaSesion.update.mockImplementation(({ data }) => ({
        ...activeSession,
        ...data,
      }));
      prisma.cierreCaja.create.mockResolvedValue({});

      const res = await service.cerrarCajaSesion({ efectivoReal: 150, fondoQueQueda: 100 });
      expect(res.estado).toBe(EstadoCaja.CERRADA);
      expect(res.efectivoEsperado).toBe(150);
      expect(res.efectivoReal).toBe(150);
      expect(res.diferencia).toBe(0);
    });

    it('rechaza cerrar si falta efectivoReal o fondoQueQueda (campos obligatorios)', async () => {
      const activeSession = { id: 's1', estado: EstadoCaja.ABIERTA, montoInicial: 100 };
      prisma.$queryRaw.mockResolvedValue([activeSession]);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([]);

      await expect(service.cerrarCajaSesion({} as any)).rejects.toThrow(
        'El efectivo contado en gaveta (efectivoReal) es obligatorio.',
      );

      await expect(service.cerrarCajaSesion({ efectivoReal: 150 } as any)).rejects.toThrow(
        'El fondo que queda en gaveta (fondoQueQueda) es obligatorio.',
      );
    });

    it('rechaza cerrar si hay mesas con cuenta abierta', async () => {
      prisma.$queryRaw.mockResolvedValue([{
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
      }]);
      prisma.cajaSesion.findFirst.mockResolvedValue({
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
      });
      prisma.order.count.mockResolvedValue(1);

      await expect(
        service.cerrarCajaSesion({ efectivoReal: 100, fondoQueQueda: 100 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cajaSesion.update).not.toHaveBeenCalled();
    });

    it('rechaza cerrar si no hay caja abierta', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.cajaSesion.findFirst.mockResolvedValue(null);

      await expect(
        service.cerrarCajaSesion({ efectivoReal: 100, fondoQueQueda: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza forzar cierre con comandas pendientes si el usuario NO es Jefe', async () => {
      const activeSession = {
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
      };
      prisma.$queryRaw.mockResolvedValue([activeSession]);
      prisma.order.count.mockResolvedValue(0); // mesas abiertas = 0
      prisma.order.findMany.mockImplementation(({ where }) => {
        if (where?.status?.in) {
          // comandas pendientes en cocina
          return [{ id: 'cmd-1', code: 'C-01', status: 'PREPARACION' }];
        }
        return [];
      });

      // Usuario mozo/cajero (no Jefe)
      const userMozo = { id: 'u1', username: 'mozo', rol: 'mozo' };

      await expect(
        service.cerrarCajaSesion(
          { forzarCierreConPendientes: true, notas: 'Forzando' },
          userMozo.id,
          userMozo,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza forzar cierre con comandas pendientes si es Jefe pero falta la nota de cierre', async () => {
      const activeSession = {
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
      };
      prisma.$queryRaw.mockResolvedValue([activeSession]);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockImplementation(({ where }) => {
        if (where?.status?.in) {
          return [{ id: 'cmd-1', code: 'C-01', status: 'PREPARACION' }];
        }
        return [];
      });

      const userJefe = { id: 'u2', username: 'jefa', rol: 'Jefe' };

      await expect(
        service.cerrarCajaSesion(
          { forzarCierreConPendientes: true, notas: '' },
          userJefe.id,
          userJefe,
        ),
      ).rejects.toThrow('Para forzar el cierre con comandas pendientes es obligatorio');
    });

    it('permite forzar cierre con comandas pendientes si es Jefe y tiene nota de cierre', async () => {
      const activeSession = {
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
      };
      prisma.$queryRaw.mockResolvedValue([activeSession]);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockImplementation(({ where }) => {
        if (where?.status?.in) {
          return [{ id: 'cmd-1', code: 'C-01', status: 'PREPARACION' }];
        }
        return []; // pedidos cobrados
      });
      prisma.cajaSesion.update.mockResolvedValue({
        ...activeSession,
        estado: EstadoCaja.CERRADA,
      });
      prisma.cierreCaja.create.mockResolvedValue({});

      const userJefe = { id: 'u2', username: 'jefa', rol: 'Jefe' };

      const res = await service.cerrarCajaSesion(
        {
          efectivoReal: 100,
          fondoQueQueda: 100,
          forzarCierreConPendientes: true,
          notas: 'Mesas ya pagaron, cocina apagada',
        },
        userJefe.id,
        userJefe,
      );
      expect(res.estado).toBe(EstadoCaja.CERRADA);
    });
  });

  describe('calcularResumenSesionTx (suma directa de Pago sin JOIN con Order, inmune a fan-out)', () => {
    it('calcula la suma exacta con 3 pedidos y 4 pagos sin multiplicar montos', async () => {
      // Pedido 1: Pago A (S/ 17.50 efectivo) + Pago B (S/ 22.50 yape) = S/ 40.00
      // Pedido 2: Pago C (S/ 47.00 efectivo) = S/ 47.00
      // Pedido 3: Pago D (S/ 35.00 efectivo) = S/ 35.00
      // Total esperado: 17.5 + 22.5 + 47 + 35 = S/ 122.00 (Efectivo: 99.50, Yape: 22.50, Pedidos: 3)
      // En un JOIN con fan-out daría 122 * 3 = S/ 366.00. Con suma directa da S/ 122.00
      const pagosSimulados = [
        { id: 'p1', orderId: 'ord-1', monto: 17.5, metodoPago: 'EFECTIVO', cajaSesionId: 'sesion-test' },
        { id: 'p2', orderId: 'ord-1', monto: 22.5, metodoPago: 'YAPE_PLIN', cajaSesionId: 'sesion-test' },
        { id: 'p3', orderId: 'ord-2', monto: 47.0, metodoPago: 'EFECTIVO', cajaSesionId: 'sesion-test' },
        { id: 'p4', orderId: 'ord-3', monto: 35.0, metodoPago: 'EFECTIVO', cajaSesionId: 'sesion-test' },
      ];

      prisma.pago.findMany.mockResolvedValue(pagosSimulados);

      // Invocamos el método privado a través de any
      const resumen = await (service as any).calcularResumenSesionTx(prisma, 'sesion-test');

      expect(resumen.totalVendido).toBe(122.0); // Exacto, NO 366
      expect(resumen.efectivo).toBe(99.5);
      expect(resumen.yapePlin).toBe(22.5);
      expect(resumen.tarjeta).toBe(0.0);
      expect(resumen.cantidadPedidos).toBe(3);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });
  });
});
