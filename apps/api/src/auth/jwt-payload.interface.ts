import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username: string;
  rol: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  turn?: string | null;
  rol?: {
    id: string;
    nombre: string;
  };
}

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: AuthenticatedUser;
}
