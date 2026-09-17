import { Module } from '@nestjs/common';
import { InsumosService } from './insumos.service';
import { InsumosController } from './insumos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InsumosController],
  providers: [InsumosService, PrismaService],
  exports: [InsumosService],
})
export class InsumosModule {}
