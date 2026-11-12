import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CajaService } from './caja.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { MesasService } from '../mesas/mesas.service';
import { PrismaService } from '../prisma.service';
import { EstadoCaja, PaymentMethod } from '@prisma/client';

describe('CONCURRENCIA CON CÓDIGO REAL DE NESTJS (FOR SHARE vs FOR UPDATE)', () => {
  let cajaService: CajaService;
  let pedidosService: PedidosService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://postgres@localhost/enquelanegra_staging?host=/tmp&port=54329';
    prisma = new PrismaService();
    await prisma.onModuleInit();

    cajaService = new CajaService(prisma);
    pedidosService = new PedidosService(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    // Cerrar cualquier sesión abierta antes de cada prueba
    await prisma.cajaSesion.updateMany({
      where: { estado: EstadoCaja.ABIERTA },
      data: { estado: EstadoCaja.CERRADA, fechaCierre: new Date() },
    });
  });

  it('Dos llamadas concurrentes a cajaService.abrirCaja: solo UNA gana, la otra recibe CAJA_ANTERIOR_SIN_CERRAR', async () => {
    const promises = [
      cajaService.abrirCaja({ montoInicial: 100 }),
      cajaService.abrirCaja({ montoInicial: 100 }),
    ];

    const results = await Promise.allSettled(promises);

    const cumplidas = results.filter((r) => r.status === 'fulfilled');
    const rechazadas = results.filter((r) => r.status === 'rejected');

    expect(cumplidas.length).toBe(1);
    expect(rechazadas.length).toBe(1);

    const errorRechazo: any = (rechazadas[0] as PromiseRejectedResult).reason;
    expect(errorRechazo).toBeInstanceOf(BadRequestException);
    const response = errorRechazo.getResponse();
    expect(response.code).toBe('CAJA_ANTERIOR_SIN_CERRAR');

    // Comprobamos en base de datos que solo existe 1 caja ABIERTA
    const cajasAbiertas = await prisma.cajaSesion.count({
      where: { estado: EstadoCaja.ABIERTA },
    });
    expect(cajasAbiertas).toBe(1);
  });

  it('Transacción de cobro (FOR SHARE) contra Cierre de caja (FOR UPDATE): el cierre espera y no deja cobros huérfanos', async () => {
    // 1. Abrimos una caja limpia
    const sesion = await cajaService.abrirCaja({ montoInicial: 100 });

    // 2. Iniciamos simultáneamente un cobro y un cierre
    // El cobro hace un lock FOR SHARE, y el cierre hace FOR UPDATE
    let cobroFinalizado = false;
    let cierreFinalizado = false;

    const promesaCobro = prisma.$transaction(async (tx) => {
      const [caja] = await tx.$queryRaw<any[]>`
        SELECT * FROM "CajaSesion"
        WHERE "estado" = 'ABIERTA'::"EstadoCaja"
        FOR SHARE
        LIMIT 1
      `;
      expect(caja).toBeDefined();
      expect(caja.id).toBe(sesion.id);

      // Simulamos pequeña latencia en el cobro (100ms)
      await new Promise((r) => setTimeout(r, 100));

      const pago = await tx.pago.create({
        data: {
          orderId: '3e423df9-8b51-4c77-8e4e-e4b34b9a44a6',
          metodoPago: PaymentMethod.EFECTIVO,
          monto: 25.0,
          cajaSesionId: caja.id,
        },
      });
      cobroFinalizado = true;
      return pago;
    });

    const promesaCierre = (async () => {
      // Pequeño retardo de 20ms para que el cobro ya haya adquirido FOR SHARE
      await new Promise((r) => setTimeout(r, 20));
      const res = await cajaService.cerrarCajaSesion({
        efectivoReal: 125.0, // 100 base + 25 cobro
        fondoQueQueda: 100.0,
      });
      cierreFinalizado = true;
      return res;
    })();

    const [resPago, resCierre] = await Promise.all([promesaCobro, promesaCierre]);

    expect(cobroFinalizado).toBe(true);
    expect(cierreFinalizado).toBe(true);
    expect(resPago.cajaSesionId).toBe(sesion.id);
    expect(resCierre.estado).toBe(EstadoCaja.CERRADA);

    // 3. Un cobro posterior al cierre debe ser rechazado inmediatamente
    await expect(
      prisma.$transaction(async (tx) => {
        const [caja] = await tx.$queryRaw<any[]>`
          SELECT * FROM "CajaSesion"
          WHERE "estado" = 'ABIERTA'::"EstadoCaja"
          FOR SHARE
          LIMIT 1
        `;
        if (!caja) throw new BadRequestException('La caja está cerrada.');
      }),
    ).rejects.toThrow('La caja está cerrada.');
  });
});
