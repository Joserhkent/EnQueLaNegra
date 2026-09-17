import { Module } from '@nestjs/common';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CajaController],
  providers: [CajaService, PrismaService],
  exports: [CajaService],
})
export class CajaModule {}
