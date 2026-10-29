import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto, RestablecerPasswordDto } from './dto/password.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        rol: true,
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException(
        'Credenciales inválidas o usuario inactivo',
      );
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      rol: user.rol.nombre,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.rol.nombre.toLowerCase(),
        turn: user.turn,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        rol: {
          include: {
            permisos: {
              include: {
                permiso: {
                  include: { modulo: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const { password: _password, ...result } = user;
    return result;
  }

  // Cada usuario cambia la suya: se exige la actual para que una sesión olvidada
  // abierta no baste para apropiarse de la cuenta. Las sesiones abiertas siguen
  // válidas hasta que vence su token (1 día).
  async cambiarPassword(userId: string, dto: CambiarPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    if (!(await compare(dto.actual, user.password))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (await compare(dto.nueva, user.password)) {
      throw new BadRequestException(
        'La contraseña nueva debe ser distinta de la actual',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await hash(dto.nueva, BCRYPT_ROUNDS) },
    });
    return { ok: true };
  }

  // Solo para el Jefe (JefeGuard en el controlador): lista para restablecer
  // contraseñas. Nunca devuelve el hash.
  async listarUsuarios() {
    const usuarios = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        active: true,
        rol: { select: { nombre: true } },
      },
      orderBy: { name: 'asc' },
    });
    return usuarios.map(({ rol, ...u }) => ({
      ...u,
      role: rol.nombre.toLowerCase(),
    }));
  }

  // El Jefe pone una contraseña nueva a otro usuario (p. ej. el mesonero la olvidó)
  async restablecerPassword(userId: string, dto: RestablecerPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await hash(dto.nueva, BCRYPT_ROUNDS) },
    });
    return { ok: true };
  }
}
