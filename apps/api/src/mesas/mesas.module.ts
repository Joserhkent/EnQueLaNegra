import { Module } from '@nestjs/common';
import { MesasService } from './mesas.service';
import { MesasController } from './mesas.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MesasController],
  providers: [MesasService, PrismaService],
  exports: [MesasService],
})
export class MesasModule {}
