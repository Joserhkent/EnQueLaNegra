import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getSystemStatus() {
    const [insumosCount, productosCount, usersCount, ordersCount] = await Promise.all([
      this.prisma.insumo.count(),
      this.prisma.producto.count(),
      this.prisma.user.count(),
      this.prisma.order.count(),
    ]);

    return {
      system: 'En que la Negra POS API',
      status: 'online',
      schedule: 'Todos los días',
      database: {
        type: 'PostgreSQL (Supabase + Prisma)',
        users: usersCount,
        insumosBase: insumosCount,
        productosCarta: productosCount,
        pedidosTotales: ordersCount,
      },
      endpoints: {
        insumos: '/api/insumos',
        productos: '/api/productos',
        pedidos: '/api/pedidos',
        mesas: '/api/tables',
      },
    };
  }
}