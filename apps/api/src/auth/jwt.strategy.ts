import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'en-que-la-negra-pos-secret-key-2026',
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
