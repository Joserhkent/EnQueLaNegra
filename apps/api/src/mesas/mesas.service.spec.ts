import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { MesasService } from './mesas.service';
import { TableStatus } from '@prisma/client';

describe('MesasService', () => {
  const mainTable = {
    id: 'table-1',
    number: 1,
    capacity: 2,
    status: TableStatus.AVAILABLE,
    currentOrderId: null,
    joinedToId: null,
    joinedTables: [],
  };
  const otherTable = {
    id: 'table-2',
    number: 2,
    capacity: 5,
    status: TableStatus.AVAILABLE,
    currentOrderId: null,
    joinedToId: null,
    joinedTables: [],
  };

  const makeService = async (tables = [mainTable, otherTable]) => {
    const transactionClient = {
      table: {
        findMany: jest.fn().mockResolvedValue(tables),
        findUnique: jest.fn().mockResolvedValue(mainTable),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...mainTable,
          joinedTables: [otherTable],
        }),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(mainTable),
        delete: jest.fn().mockResolvedValue(mainTable),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      table: {
        findFirst: jest.fn().mockResolvedValue({ number: 9 }),
        findUnique: jest.fn().mockResolvedValue(mainTable),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue(mainTable),
        create: jest.fn().mockResolvedValue({
          id: 'table-10',
          number: 10,
          capacity: 4,
          status: TableStatus.AVAILABLE,
          currentOrderId: null,
          joinedTables: [],
        }),
      },
      cajaSesion: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'sesion-1', estado: 'ABIERTA' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(
          async (
            callback: (tx: typeof transactionClient) => Promise<unknown>,
          ) => callback(transactionClient),
        ),
    };
    const module = await Test.createTestingModule({
      providers: [MesasService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return {
      service: module.get(MesasService),
      prisma,
      transactionClient,
    };
  };

  it('creates a mesa with the next number and requested capacity', async () => {
    const { service, prisma } = await makeService();

    await service.create({ capacity: 4 });

    expect(prisma.table.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { number: 10, capacity: 4 },
      }),
    );
  });

  it('joins available tables under one main table', async () => {
    const { service, transactionClient } = await makeService();

    const result = await service.join('table-1', { tableIds: ['table-2'] });

    expect(transactionClient.table.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { joinedToId: 'table-1' },
      }),
    );
    expect(result.joinedTables).toHaveLength(1);
  });

  it('rejects joining a table that is already occupied', async () => {
    const occupiedTable = { ...otherTable, status: TableStatus.OCCUPIED };
    const { service, transactionClient } = await makeService([
      mainTable,
      occupiedTable,
    ]);

    await expect(
      service.join('table-1', { tableIds: ['table-2'] }),
    ).rejects.toThrow(BadRequestException);
    expect(transactionClient.table.updateMany).not.toHaveBeenCalled();
  });

  it('updates the capacity of an available, unjoined table', async () => {
    const { service, prisma } = await makeService();

    await service.update('table-1', { capacity: 6 });

    expect(prisma.table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'table-1' },
        data: { capacity: 6 },
      }),
    );
  });

  it('preserves historical orders when deleting an available table', async () => {
    const { service, transactionClient } = await makeService();

    await service.remove('table-1');

    expect(transactionClient.order.updateMany).toHaveBeenCalledWith({
      where: { tableId: 'table-1' },
      data: { tableId: null },
    });
    expect(transactionClient.table.delete).toHaveBeenCalledWith({
      where: { id: 'table-1' },
    });
  });
});
