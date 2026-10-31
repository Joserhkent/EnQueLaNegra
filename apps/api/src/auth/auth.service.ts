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
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto/usuario.dto';
import { ROLES_ADMIN } from './jefe.guard';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Los usuarios se guardan en minúsculas: «Carlos» y «carlos» son el mismo
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username.trim(), mode: 'insensitive' } },
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

  // Solo para el Jefe (JefeGuard en el controlador). Nunca devuelve el hash.
  async listarUsuarios() {
    const usuarios = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        active: true,
        turn: true,
        rolId: true,
        rol: { select: { nombre: true } },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return usuarios.map(({ rol, ...u }) => ({
      ...u,
      role: rol.nombre.toLowerCase(),
      rolNombre: rol.nombre,
    }));
  }

  listarRoles() {
    return this.prisma.rol.findMany({
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }

  private async assertUsuarioLibre(username: string, exceptoId?: string) {
    const otro = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        ...(exceptoId ? { id: { not: exceptoId } } : {}),
      },
    });
    if (otro) {
      throw new BadRequestException(
        `El usuario «${username}» ya existe (${otro.name}${otro.active ? '' : ', desactivado'}). Elige otro.`,
      );
    }
  }

  private async rolOError(rolId: string) {
    const rol = await this.prisma.rol.findUnique({ where: { id: rolId } });
    if (!rol) throw new BadRequestException('Elige un rol que exista');
    return rol;
  }

  private esAdmin = (nombreRol: string) =>
    ROLES_ADMIN.includes(nombreRol.toLowerCase());

  async crearUsuario(dto: CrearUsuarioDto) {
    await this.rolOError(dto.rolId);
    await this.assertUsuarioLibre(dto.username);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        password: await hash(dto.password, BCRYPT_ROUNDS),
        rolId: dto.rolId,
        turn: dto.turn || null,
      },
    });
    return { id: user.id };
  }

  // Editar datos, rol o activar/desactivar. Nunca se borra un usuario: sus ventas,
  // movimientos y cierres de caja siguen mostrando quién los hizo (como Toast).
  async actualizarUsuario(
    id: string,
    dto: ActualizarUsuarioDto,
    actorId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { rol: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (id === actorId && dto.active === false) {
      throw new BadRequestException('No puedes desactivar tu propio usuario');
    }
    if (dto.username && dto.username !== user.username) {
      await this.assertUsuarioLibre(dto.username, id);
    }
    const rolNuevo = dto.rolId ? await this.rolOError(dto.rolId) : user.rol;

    // Siempre debe quedar al menos un administrador activo que pueda entrar
    const dejaDeSerAdminActivo =
      this.esAdmin(user.rol.nombre) &&
      user.active &&
      (dto.active === false || !this.esAdmin(rolNuevo.nombre));
    if (dejaDeSerAdminActivo) {
      const otrosAdmins = await this.prisma.user.count({
        where: {
          id: { not: id },
          active: true,
          rol: {
            nombre: { in: ROLES_ADMIN, mode: 'insensitive' },
          },
        },
      });
      if (otrosAdmins === 0) {
        throw new BadRequestException(
          'Debe quedar al menos un Jefe activo. Nombra otro Jefe antes de cambiar este usuario.',
        );
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        username: dto.username,
        rolId: dto.rolId,
        turn: dto.turn === undefined ? undefined : dto.turn || null,
        active: dto.active,
      },
    });
    return { ok: true };
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
