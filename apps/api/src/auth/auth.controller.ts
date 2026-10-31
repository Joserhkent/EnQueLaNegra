import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto, RestablecerPasswordDto } from './dto/password.dto';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto/usuario.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JefeGuard } from './jefe.guard';
import { GetUser } from './get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@GetUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  cambiarPassword(
    @GetUser('id') userId: string,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(userId, dto);
  }

  @UseGuards(JwtAuthGuard, JefeGuard)
  @Get('usuarios')
  listarUsuarios() {
    return this.authService.listarUsuarios();
  }

  @UseGuards(JwtAuthGuard, JefeGuard)
  @Get('roles')
  listarRoles() {
    return this.authService.listarRoles();
  }

  @UseGuards(JwtAuthGuard, JefeGuard)
  @Post('usuarios')
  crearUsuario(@Body() dto: CrearUsuarioDto) {
    return this.authService.crearUsuario(dto);
  }

  @UseGuards(JwtAuthGuard, JefeGuard)
  @Patch('usuarios/:id')
  actualizarUsuario(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @GetUser('id') actorId: string,
  ) {
    return this.authService.actualizarUsuario(id, dto, actorId);
  }

  @UseGuards(JwtAuthGuard, JefeGuard)
  @Patch('usuarios/:id/password')
  restablecerPassword(
    @Param('id') id: string,
    @Body() dto: RestablecerPasswordDto,
  ) {
    return this.authService.restablecerPassword(id, dto);
  }
}
