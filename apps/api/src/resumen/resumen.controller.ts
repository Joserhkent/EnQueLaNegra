import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResumenService } from './resumen.service';
import { ResumenQueryDto } from './dto/resumen-dashboard.dto';
import { ComandasQueryDto } from './dto/comandas-query.dto';

@Controller('resumen')
@UseGuards(JwtAuthGuard)
export class ResumenController {
  constructor(private readonly resumenService: ResumenService) {}

  @Get('dashboard')
  getDashboard(@Query() query: ResumenQueryDto) {
    return this.resumenService.getDashboard(query);
  }

  @Get('comandas')
  getComandas(@Query() query: ComandasQueryDto) {
    return this.resumenService.getComandas(query);
  }
}
