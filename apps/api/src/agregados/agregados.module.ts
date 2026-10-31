import { Module } from '@nestjs/common';
import { AgregadosController } from './agregados.controller';
import { AgregadosService } from './agregados.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AgregadosController],
  providers: [AgregadosService, PrismaService],
})
export class AgregadosModule {}
