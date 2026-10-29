/* eslint-disable @typescript-eslint/no-unsafe-argument -- mocks de Prisma tipados como any */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';

describe('AuthService (White-box & Integration Tests)', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  const mockUserAdmin = {
    id: 'u-1',
    name: 'La Negra (Jefa)',
    username: 'admin',
    password: '',
    active: true,
    turn: 'Turno Noche',
    rol: { nombre: 'Jefe' },
  };

  const mockUserEmpleado = {
    id: 'u-2',
    name: 'Juan Carlos (Mozo)',
    username: 'empleado',
    password: '',
    active: true,
    turn: 'Turno Noche',
    rol: { nombre: 'Empleado' },
  };

  beforeAll(async () => {
    mockUserAdmin.password = await bcrypt.hash('123456', 10);
    mockUserEmpleado.password = await bcrypt.hash('123456', 10);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('Black-box & White-box Auth Validation', () => {
    it('1. Should authenticate Jefe successfully with correct password "123456"', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserAdmin as any);

      const result = await authService.login({
        username: 'admin',
        password: '123456',
      });

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user).toEqual({
        id: 'u-1',
        name: 'La Negra (Jefa)',
        username: 'admin',
        role: 'jefe',
        turn: 'Turno Noche',
      });
    });

    it('2. Should authenticate Empleado successfully with correct password "123456"', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserEmpleado as any);

      const result = await authService.login({
        username: 'empleado',
        password: '123456',
      });

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user).toEqual({
        id: 'u-2',
        name: 'Juan Carlos (Mozo)',
        username: 'empleado',
        role: 'empleado',
        turn: 'Turno Noche',
      });
    });

    it('3. Should REJECT login with incorrect password for Empleado', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserEmpleado as any);

      await expect(
        authService.login({ username: 'empleado', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('4. Should REJECT login with incorrect password for Jefe', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserAdmin as any);

      await expect(
        authService.login({ username: 'admin', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('5. Should REJECT non-existent username', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(
        authService.login({ username: 'unknownuser', password: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('6. Should REJECT inactive user accounts', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUserEmpleado,
        active: false,
      } as any);

      await expect(
        authService.login({ username: 'empleado', password: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Cambio de contraseña', () => {
    it('cambia la contraseña y guarda solo el hash de la nueva', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserEmpleado as any);
      const update = jest.spyOn(prismaService.user, 'update');

      await authService.cambiarPassword('u-2', {
        actual: '123456',
        nueva: 'nuevaClave2026',
      });

      const guardada = (
        update.mock.calls[0][0] as { data: { password: string } }
      ).data.password;
      expect(guardada).not.toBe('nuevaClave2026');
      expect(await bcrypt.compare('nuevaClave2026', guardada)).toBe(true);
    });

    it('rechaza si la contraseña actual no es correcta', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserEmpleado as any);
      const update = jest.spyOn(prismaService.user, 'update');

      await expect(
        authService.cambiarPassword('u-2', {
          actual: 'equivocada',
          nueva: 'nuevaClave2026',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('rechaza repetir la misma contraseña', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserEmpleado as any);

      await expect(
        authService.cambiarPassword('u-2', {
          actual: '123456',
          nueva: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('el Jefe restablece la de otro usuario sin conocer la anterior', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUserEmpleado as any);
      const update = jest.spyOn(prismaService.user, 'update');

      await authService.restablecerPassword('u-2', { nueva: 'otraClave2026' });

      const guardada = (
        update.mock.calls[0][0] as { data: { password: string } }
      ).data.password;
      expect(await bcrypt.compare('otraClave2026', guardada)).toBe(true);
    });
  });
});
