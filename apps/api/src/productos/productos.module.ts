import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProductosController],
  providers: [ProductosService, PrismaService],
  exports: [ProductosService],
})
export class ProductosModule {}
