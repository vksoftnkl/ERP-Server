import { BadRequestException } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

type PrismaMock = {
  $executeRaw: jest.Mock;
  auditScreen: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
};

type AuditLogCreateCallArgs = {
  data: Record<string, unknown>;
};

type RequestContextServiceMock = {
  getIpAddress: jest.Mock<string | null, []>;
  getUserId: jest.Mock<string | null, []>;
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: PrismaMock;
  let requestContextService: RequestContextServiceMock;

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn(),
      auditScreen: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    requestContextService = {
      getIpAddress: jest.fn<string | null, []>().mockReturnValue(null),
      getUserId: jest.fn<string | null, []>().mockReturnValue(null),
    };
    service = new AuditLogService(
      prisma as unknown as PrismaService,
      requestContextService as unknown as RequestContextService,
    );
  });

  const getCreateArgs = (prismaMock: PrismaMock): AuditLogCreateCallArgs => {
    const createCalls = prismaMock.auditLog.create.mock.calls as AuditLogCreateCallArgs[][];
    return createCalls[0][0];
  };

  it('captureScreenSnapshot returns null when no SQL-template snapshot is used', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 1,
    });

    const result = await service.captureScreenSnapshot({
      screenId: 1,
      keyNo: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    expect(result).toBeNull();
  });

  it('captureScreenSnapshot rejects unknown screen id', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue(null);

    await expect(
      service.captureScreenSnapshot({
        screenId: 1,
        keyNo: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logEntityChange accepts New action and writes insert payload only into original record', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
    });
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.logEntityChange({
      action: 'New',
      tableName: 'item_group_master',
      screenName: 'Item Group Master',
      modifiedRecord: {
        itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        itg_name: 'Raw Materials',
      },
      originalRecord: null,
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logAction).toBe('insert');
    expect(createArgs.data.logScreenId).toBe(10);
    expect(createArgs.data.logTableName).toBe('item_group_master');
    expect(createArgs.data.logPk).toBe('018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678');
    expect(createArgs.data.logOriginalRecord).toEqual({
      itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      itg_name: 'Raw Materials',
    });
    expect(createArgs.data.logModifiedRecord).toBeUndefined();
    expect(createArgs.data.logChangedFields).toBeUndefined();
  });

  it('logEntityChange writes original, modified and changed fields for update', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
    });
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.logEntityChange({
      action: 'update',
      tableName: 'item_group_master',
      screenName: 'Item Group Master',
      originalRecord: {
        itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        itg_name: 'Raw Materials',
      },
      modifiedRecord: {
        itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        itg_name: 'Finished Goods',
      },
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logAction).toBe('update');
    expect(createArgs.data.logOriginalRecord).toEqual({
      itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      itg_name: 'Raw Materials',
    });
    expect(createArgs.data.logModifiedRecord).toEqual({
      itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      itg_name: 'Finished Goods',
    });
    expect(createArgs.data.logChangedFields).toEqual({
      itg_name: {
        from: 'Raw Materials',
        to: 'Finished Goods',
      },
    });
  });

  it('createAuditLog supports cancel action', async () => {
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.createAuditLog({
      action: 'cancel',
      screenId: 10,
      tableName: 'item_group_master',
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logAction).toBe('cancel');
  });

  it('createAuditLog uses request-context user id and ip when explicit user id is invalid', async () => {
    requestContextService.getUserId.mockReturnValue('019d6f6c-be87-7a11-8905-36092c46fd06');
    requestContextService.getIpAddress.mockReturnValue('10.12.0.15');
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });
    prisma.$executeRaw.mockResolvedValue(1);

    await service.createAuditLog({
      action: 'insert',
      screenId: 10,
      tableName: 'item_group_master',
      userId: 'system',
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logUserId).toBe('019d6f6c-be87-7a11-8905-36092c46fd06');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('createAuditLog rejects unsupported delete action', async () => {
    await expect(
      service.createAuditLog({
        action: 'delete',
        screenId: 10,
        tableName: 'item_group_master',
        pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('list supports search and date filters', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
        logDate: new Date('2026-02-20T11:00:00.000Z'),
        logAction: 'insert',
        logScreenId: 10,
        logTableName: 'item_group_master',
        logPk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        logDisplayName: 'Raw Materials',
        logOriginalRecord: { itg_name: 'Raw Materials' },
        logModifiedRecord: null,
        logChangedFields: null,
        logUserId: null,
        logBranchId: null,
        logNotes: 'Item group created',
        auditScreen: {
          screenName: 'Item Group Master',
        },
      },
    ]);

    const result = await service.list({
      search: 'Raw',
      date_from: '2026-02-01',
      date_to: '2026-02-28',
      page: 1,
      limit: 20,
    });

    expect(prisma.auditLog.count).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
    expect(result.meta.total).toBe(1);
    expect(result.items[0].log_action).toBe('New');
  });

  it('list rejects invalid date range', async () => {
    await expect(
      service.list({
        date_from: '2026-03-01',
        date_to: '2026-02-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logEntityChange fails when modifiedRecord is missing and auto snapshot is unavailable', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
    });

    await expect(
      service.logEntityChange({
        action: 'update',
        tableName: 'item_group_master',
        screenName: 'Item Group Master',
        pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logEntityChange fails for update when originalRecord is missing', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
    });

    await expect(
      service.logEntityChange({
        action: 'update',
        tableName: 'item_group_master',
        screenName: 'Item Group Master',
        modifiedRecord: {
          itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
          itg_name: 'Finished Goods',
        },
        pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
