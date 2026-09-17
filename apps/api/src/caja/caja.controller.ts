import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CajaService } from './caja.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('cierres')
  findAllCierres() {
    return this.cajaService.findAllCierres();
  }

  @UseGuards(JwtAuthGuard)
  @Get('resumen-hoy')
  getResumenHoy() {
    return this.cajaService.getResumenHoy();
  }

  @UseGuards(JwtAuthGuard)
  @Post('cierre')
  cerrarCaja(
    @Body() dto: CreateCierreDto,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.cajaService.cerrarCaja(dto, user?.id, user);
  }
}
