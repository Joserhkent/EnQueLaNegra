import { Module } from '@nestjs/common';
import { ResumenController } from './resumen.controller';
import { ResumenService } from './resumen.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ResumenController],
  providers: [ResumenService, PrismaService],
  exports: [ResumenService],
})
export class ResumenModule {}
