import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-payload.interface';

const ROLES_ADMIN = ['jefe', 'admin', 'administrador'];

// Debe usarse después de JwtAuthGuard (necesita request.user).
@Injectable()
export class JefeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.rol?.nombre.toLowerCase();
    if (!role || !ROLES_ADMIN.includes(role)) {
      throw new ForbiddenException(
        'Solo el administrador puede realizar esta acción',
      );
    }
    return true;
  }
}
