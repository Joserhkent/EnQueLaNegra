import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            insumo: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
            producto: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
            user: { count: jest.fn().mockResolvedValue(0) },
            order: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the system status', async () => {
      const result = await appController.getSystemStatus();
      expect(result.system).toBe('En que la Negra POS API');
      expect(result.status).toBe('online');
    });
  });
});
