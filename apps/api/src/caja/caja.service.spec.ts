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
      cajaSesion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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

    it('rechaza abrir caja si ya existe una abierta', async () => {
      prisma.cajaSesion.findFirst.mockResolvedValue({
        id: 'sesion-activa',
        estado: EstadoCaja.ABIERTA,
      });

      await expect(service.abrirCaja({ montoInicial: 50 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.cajaSesion.create).not.toHaveBeenCalled();
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
      prisma.cajaSesion.findFirst.mockResolvedValue(activeSession);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          total: 50,
          paymentMethod: 'EFECTIVO',
          pagos: [],
        },
      ]);
      prisma.cajaSesion.update.mockImplementation(({ data }) => ({
        ...activeSession,
        ...data,
      }));
      prisma.cierreCaja.create.mockResolvedValue({});

      const res = await service.cerrarCajaSesion({ efectivoReal: 150 });
      expect(res.estado).toBe(EstadoCaja.CERRADA);
      expect(res.efectivoEsperado).toBe(150);
      expect(res.efectivoReal).toBe(150);
      expect(res.diferencia).toBe(0);
    });

    it('rechaza cerrar si hay mesas con cuenta abierta', async () => {
      prisma.cajaSesion.findFirst.mockResolvedValue({
        id: 'sesion-1',
        estado: EstadoCaja.ABIERTA,
        montoInicial: 100,
        fechaApertura: new Date(),
      });
      prisma.order.count.mockResolvedValue(1);

      await expect(service.cerrarCajaSesion({})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.cajaSesion.update).not.toHaveBeenCalled();
    });

    it('rechaza cerrar si no hay caja abierta', async () => {
      prisma.cajaSesion.findFirst.mockResolvedValue(null);

      await expect(service.cerrarCajaSesion({})).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
