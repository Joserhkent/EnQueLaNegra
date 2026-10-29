import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CajaService } from './caja.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Get('estado')
  getEstadoActual() {
    return this.cajaService.getEstadoActual();
  }

  @Post('abrir')
  abrirCaja(@Body() dto: AbrirCajaDto, @GetUser() user?: AuthenticatedUser) {
    return this.cajaService.abrirCaja(dto, user?.id, user);
  }

  @Post('cerrar')
  cerrarCaja(@Body() dto: CerrarCajaDto, @GetUser() user?: AuthenticatedUser) {
    return this.cajaService.cerrarCajaSesion(dto, user?.id, user);
  }

  @Get('sesiones')
  findAllSesiones() {
    return this.cajaService.findAllSesiones();
  }

  @Get('cierres')
  findAllCierres() {
    return this.cajaService.findAllCierres();
  }

  @Get('resumen-hoy')
  getResumenHoy() {
    return this.cajaService.getResumenHoy();
  }

  // Compatibilidad legacy
  @Post('cierre')
  cierreLegacy(
    @Body() dto: CreateCierreDto,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.cajaService.cerrarCajaLegacy(dto, user?.id, user);
  }
}
