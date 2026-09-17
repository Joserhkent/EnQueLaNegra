import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { ProductosModule } from './productos/productos.module';
import { InsumosModule } from './insumos/insumos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { CajaModule } from './caja/caja.module';
import { MesasModule } from './mesas/mesas.module';

@Module({
  imports: [
    AuthModule,
    ProductosModule,
    InsumosModule,
    PedidosModule,
    CajaModule,
    MesasModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
