import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CajaService } from './caja.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('estado')
  getEstadoActual() {
    return this.cajaService.getEstadoActual();
  }

  @UseGuards(JwtAuthGuard)
  @Post('abrir')
  abrirCaja(@Body() dto: AbrirCajaDto, @GetUser() user?: AuthenticatedUser) {
    return this.cajaService.abrirCaja(dto, user?.id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cerrar')
  cerrarCajaSesion(
    @Body() dto: CerrarCajaDto,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.cajaService.cerrarCajaSesion(dto, user?.id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sesiones')
  findAllSesiones() {
    return this.cajaService.findAllSesiones();
  }

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
  cierreLegacy(
    @Body() dto: CreateCierreDto,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.cajaService.cerrarCajaLegacy(dto, user?.id, user);
  }
}
