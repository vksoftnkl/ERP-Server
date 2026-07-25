import { BadRequestException } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { getAuditScreenSql } from './audit-screen-sql.constants';

type PrismaMock = {
  $executeRaw: jest.Mock;
  itemGroupMaster: {
    findMany: jest.Mock;
  };
  itemTaxMaster: {
    findMany: jest.Mock;
  };
  unit: {
    findMany: jest.Mock;
  };
  branchMaster: {
    findMany: jest.Mock;
  };
  userMaster: {
    findMany: jest.Mock;
  };
  itemUnitConversion: {
    findMany: jest.Mock;
  };
  itemPriceMaster: {
    findMany: jest.Mock;
  };
  itemEanCode: {
    findMany: jest.Mock;
  };
  itemReorder: {
    findMany: jest.Mock;
  };
  auditScreen: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
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

type AuditLogFindManyCallArgs = {
  where: Record<string, unknown>;
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
      itemGroupMaster: {
        findMany: jest.fn(),
      },
      itemTaxMaster: {
        findMany: jest.fn(),
      },
      unit: {
        findMany: jest.fn(),
      },
      branchMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      itemUnitConversion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      itemPriceMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      itemEanCode: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      itemReorder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditScreen: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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

  const getListWhere = (prismaMock: PrismaMock): Record<string, unknown> => {
    const findManyCalls = prismaMock.auditLog.findMany.mock.calls as AuditLogFindManyCallArgs[][];
    return findManyCalls[0][0].where;
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

  it('logEntityChange serializes bigint values in audit payloads', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
    });
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.logEntityChange({
      action: 'New',
      tableName: 'item_batch_master',
      screenName: 'Opening Stock',
      modifiedRecord: {
        btm_id: '019d6f6c-be87-7a11-8905-36092c46fd06',
        btm_batch_no: 'BATCH-1',
        btm_row_version: BigInt(1),
      },
      originalRecord: null,
      pk: '019d6f6c-be87-7a11-8905-36092c46fd06',
    });

    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logOriginalRecord).toEqual({
      btm_id: '019d6f6c-be87-7a11-8905-36092c46fd06',
      btm_batch_no: 'BATCH-1',
      btm_row_version: '1',
    });
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

  it('logEntityChange projects audit payloads to the screenAuditSql field names', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
      screenAuditSql:
        'SELECT itg_id, itg_name AS item_name, itg_status FROM inventory.item_group_master',
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
        itemName: 'Raw Materials',
        itg_status: true,
        ignored_field: 'before',
      },
      modifiedRecord: {
        itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        itemName: 'Finished Goods',
        itg_status: true,
        ignored_field: 'after',
      },
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logOriginalRecord).toEqual({
      itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      item_name: 'Raw Materials',
      itg_status: true,
    });
    expect(createArgs.data.logModifiedRecord).toEqual({
      itg_id: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      item_name: 'Finished Goods',
      itg_status: true,
    });
    expect(createArgs.data.logChangedFields).toEqual({
      item_name: {
        from: 'Raw Materials',
        to: 'Finished Goods',
      },
    });
  });

  it('logEntityChange maps source payload fields into human-readable screenAuditSql aliases', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 10,
      screenAuditSql:
        'SELECT itg_name AS "Item Group Name", itg_alias AS "Item Group Alias" FROM inventory.item_group_master',
    });
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.logEntityChange({
      action: 'update',
      tableName: 'item_group_master',
      screenName: 'Item Group Master',
      originalRecord: {
        itg_name: 'Raw Materials',
        itg_alias: 'RM',
      },
      modifiedRecord: {
        itg_name: 'Coffee Powder',
        itg_alias: 'CP',
      },
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logOriginalRecord).toEqual({
      'Item Group Name': 'Raw Materials',
      'Item Group Alias': 'RM',
    });
    expect(createArgs.data.logModifiedRecord).toEqual({
      'Item Group Name': 'Coffee Powder',
      'Item Group Alias': 'CP',
    });
    expect(createArgs.data.logChangedFields).toEqual({
      'Item Group Name': {
        from: 'Raw Materials',
        to: 'Coffee Powder',
      },
      'Item Group Alias': {
        from: 'RM',
        to: 'CP',
      },
    });
  });

  it('logEntityChange creates missing audit screens with configured screenAuditSql', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue(null);
    prisma.auditScreen.create.mockResolvedValue({
      screenId: 11,
      screenAuditSql: getAuditScreenSql('Units Master'),
    });
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.logEntityChange({
      action: 'New',
      tableName: 'item_unit_master',
      screenName: 'Units Master',
      modifiedRecord: {
        unit_name: 'Box',
        unit_is_active: true,
      },
      originalRecord: null,
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    expect(prisma.auditScreen.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        screenName: 'Units Master',
        screenAuditSql: getAuditScreenSql('Units Master'),
      }),
      select: {
        screenId: true,
        screenAuditSql: true,
      },
    });
  });

  it('logEntityChange backfills configured screenAuditSql for existing audit screens', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 12,
      screenName: 'State Master',
      screenAuditSql: null,
    });
    prisma.auditScreen.update.mockResolvedValue({
      screenId: 12,
      screenAuditSql: getAuditScreenSql('State Master'),
    });
    prisma.auditLog.create.mockResolvedValue({
      logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
    });

    await service.logEntityChange({
      action: 'update',
      tableName: 'state_master',
      screenName: 'State Master',
      originalRecord: {
        stm_name: 'Kerala',
        stm_is_active: true,
      },
      modifiedRecord: {
        stm_name: 'Karnataka',
        stm_is_active: true,
      },
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    expect(prisma.auditScreen.update).toHaveBeenCalledWith({
      where: {
        screenId: 12,
      },
      data: {
        screenAuditSql: getAuditScreenSql('State Master'),
      },
      select: {
        screenId: true,
        screenAuditSql: true,
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

    await service.createAuditLog({
      action: 'insert',
      screenId: 10,
      tableName: 'item_group_master',
      userId: 'system',
      pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
    });

    const createArgs = getCreateArgs(prisma);
    expect(createArgs.data.logUserId).toBe('019d6f6c-be87-7a11-8905-36092c46fd06');
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

  it('list filters by exact screen_name and record_pk', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
        logDate: new Date('2026-02-20T11:00:00.000Z'),
        logAction: 'update',
        logScreenId: 10,
        logTableName: 'item_group_master',
        logPk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        logDisplayName: 'Raw Materials',
        logOriginalRecord: { itg_name: 'Raw Materials' },
        logModifiedRecord: { itg_name: 'Finished Goods' },
        logChangedFields: {
          itg_name: {
            from: 'Raw Materials',
            to: 'Finished Goods',
          },
        },
        logUserId: null,
        logBranchId: null,
        logNotes: 'Updated item group',
        auditScreen: {
          screenName: 'Item Group Master',
        },
      },
    ]);

    const result = await service.list({
      screen_name: 'Item Group Master',
      record_pk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
      page: 1,
      limit: 20,
      include_total: true,
    });

    const expectedWhere = {
      AND: [
        {
          auditScreen: {
            is: {
              screenName: 'Item Group Master',
            },
          },
          logPk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        },
      ],
    };
    expect(prisma.auditLog.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].screen_name).toBe('Item Group Master');
    expect(result.items[0].log_pk).toBe('Raw Materials');
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
        logUserId: '019d6f6c-be87-7a11-8905-36092c46fd06',
        logBranchId: '019d6f6c-be87-7a11-8905-36092c46fd07',
        logNotes: 'Item group created',
        auditScreen: {
          screenName: 'Item Group Master',
        },
      },
    ]);
    prisma.userMaster.findMany.mockResolvedValue([
      {
        usrId: '019d6f6c-be87-7a11-8905-36092c46fd06',
        usrDisplayName: 'Admin User',
      },
    ]);
    prisma.branchMaster.findMany.mockResolvedValue([
      {
        brId: '019d6f6c-be87-7a11-8905-36092c46fd07',
        brName: 'Head Office',
      },
    ]);

    const result = await service.list({
      search: 'Raw',
      date_from: '2026-02-01',
      date_to: '2026-02-28',
      page: 1,
      limit: 20,
      include_total: true,
    });

    expect(prisma.auditLog.count).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.userMaster.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.branchMaster.findMany).toHaveBeenCalledTimes(1);
    expect(result.meta.total).toBe(1);
    expect(result.items[0].log_action).toBe('New');
    expect(result.items[0].log_pk).toBe('Raw Materials');
    expect(result.items[0].log_user_id).toBeNull();
    expect(result.items[0].log_user_name).toBe('Admin User');
    expect(result.items[0].log_branch_id).toBeNull();
    expect(result.items[0].log_branch_name).toBe('Head Office');
    expect(result.items[0].log_original_record).toEqual({
      'Item Group Name': 'Raw Materials',
    });
  });

  it('list returns an empty result set when the per-record filters match nothing', async () => {
    prisma.auditLog.count.mockResolvedValue(0);
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.list({
      screen_name: 'Item Group Master',
      record_pk: 'missing-record',
      page: 1,
      limit: 20,
      include_total: true,
    });

    expect(result).toEqual({
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
        next_cursor: null,
      },
    });
    // No rows means no ids to enrich, so the name lookups run against empty sets.
    expect(prisma.userMaster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usrId: { in: [] } } }),
    );
    expect(prisma.branchMaster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { brId: { in: [] } } }),
    );
  });

  it('list resolves configured audit reference fields to names inside audit payloads', async () => {
    const parentGroupId = '019d6f6c-be87-7a11-8905-36092c46fd10';
    const currentGroupId = '019d6f6c-be87-7a11-8905-36092c46fd11';
    const nextParentGroupId = '019d6f6c-be87-7a11-8905-36092c46fd12';
    const defaultTaxId = '019d6f6c-be87-7a11-8905-36092c46fd13';
    const oldUnitId = '019d6f6c-be87-7a11-8905-36092c46fd14';
    const newUnitId = '019d6f6c-be87-7a11-8905-36092c46fd15';

    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
        logDate: new Date('2026-02-20T11:00:00.000Z'),
        logAction: 'update',
        logScreenId: 10,
        logTableName: 'item_group_master',
        logPk: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678',
        logDisplayName: null,
        logOriginalRecord: {
          itg_name: 'Beverages',
          itg_parent_id: parentGroupId,
          itg_path_ids_cache: [parentGroupId, currentGroupId],
          itg_default_tax_id: defaultTaxId,
          itg_default_uom_id: oldUnitId,
        },
        logModifiedRecord: {
          itg_name: 'Cold Drinks',
          itg_parent_id: nextParentGroupId,
          itg_path_ids_cache: [nextParentGroupId, currentGroupId],
          itg_default_tax_id: defaultTaxId,
          itg_default_uom_id: newUnitId,
        },
        logChangedFields: {
          itg_parent_id: {
            from: parentGroupId,
            to: nextParentGroupId,
          },
          itg_default_uom_id: {
            from: oldUnitId,
            to: newUnitId,
          },
        },
        logUserId: null,
        logBranchId: null,
        logNotes: 'Item group updated',
        auditScreen: {
          screenName: 'Item Group Master',
        },
      },
    ]);
    prisma.itemGroupMaster.findMany.mockResolvedValue([
      { itgId: parentGroupId, itgName: 'Parent Group A' },
      { itgId: currentGroupId, itgName: 'Current Group' },
      { itgId: nextParentGroupId, itgName: 'Parent Group B' },
    ]);
    prisma.itemTaxMaster.findMany.mockResolvedValue([
      { taxId: defaultTaxId, taxName: 'GST 18%' },
    ]);
    prisma.unit.findMany.mockResolvedValue([
      { unit_id: oldUnitId, unit_name: 'Box' },
      { unit_id: newUnitId, unit_name: 'Carton' },
    ]);

    const result = await service.list({
      page: 1,
      limit: 20,
    });

    expect(prisma.itemGroupMaster.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.itemTaxMaster.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.unit.findMany).toHaveBeenCalledTimes(1);
    expect(result.items[0].log_display_name).toBe('Cold Drinks');
    expect(result.items[0].log_pk).toBe('Cold Drinks');
    expect(result.items[0].log_original_record).toEqual({
      'Item Group Name': 'Beverages',
      'Parent Group ID': 'Parent Group A',
      'Path IDs Cache': ['Parent Group A', 'Current Group'],
      'Default Tax ID': 'GST 18%',
      'Default UOM ID': 'Box',
    });
    expect(result.items[0].log_modified_record).toEqual({
      'Item Group Name': 'Cold Drinks',
      'Parent Group ID': 'Parent Group B',
      'Path IDs Cache': ['Parent Group B', 'Current Group'],
      'Default Tax ID': 'GST 18%',
      'Default UOM ID': 'Carton',
    });
    expect(result.items[0].log_changed_fields).toEqual({
      'Parent Group ID': {
        from: 'Parent Group A',
        to: 'Parent Group B',
      },
      'Default UOM ID': {
        from: 'Box',
        to: 'Carton',
      },
    });
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

  it('list widens an Item Master record filter to its child screens', async () => {
    const itemId = '019f9412-0b08-7c22-b88b-4eae922d5269';
    const iucId = '019f9412-0b08-7c22-b88b-4eae922d5270';
    const ipmId = '019f9412-0b08-7c22-b88b-4eae922d5271';
    const eanId = '019f9412-0b08-7c22-b88b-4eae922d5272';
    const irId = '019f9412-0b08-7c22-b88b-4eae922d5273';

    prisma.itemUnitConversion.findMany.mockResolvedValue([{ iucId }]);
    prisma.itemPriceMaster.findMany.mockResolvedValue([{ ipmId }]);
    prisma.itemEanCode.findMany.mockResolvedValue([{ eanId }]);
    prisma.itemReorder.findMany.mockResolvedValue([{ irId }]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list({
      screen_name: 'Item Master',
      record_pk: itemId,
      page: 1,
      limit: 20,
    });

    const where = getListWhere(prisma) as { AND: { OR: unknown[] }[] };

    expect(where.AND[0].OR).toEqual([
      { auditScreen: { is: { screenName: 'Item Master' } }, logPk: itemId },
      {
        auditScreen: { is: { screenName: 'Item Unit Conversion Master' } },
        logPk: { in: [iucId] },
      },
      { auditScreen: { is: { screenName: 'Item Price Master' } }, logPk: { in: [ipmId] } },
      { auditScreen: { is: { screenName: 'Item EAN Code Master' } }, logPk: { in: [eanId] } },
      { auditScreen: { is: { screenName: 'Item Reorder Master' } }, logPk: { in: [irId] } },
    ]);
  });

  it('list keeps a plain record filter for screens without child screens', async () => {
    const itgId = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list({
      screen_name: 'Item Group Master',
      record_pk: itgId,
      page: 1,
      limit: 20,
    });

    const where = getListWhere(prisma) as { AND: unknown[] };

    expect(where.AND).toEqual([
      { auditScreen: { is: { screenName: 'Item Group Master' } }, logPk: itgId },
    ]);
    expect(prisma.itemUnitConversion.findMany).not.toHaveBeenCalled();
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
