import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { getJwtSecret } from './jwt-secret';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no autorizado o inactivo');
    }

    return user;
  }
}
