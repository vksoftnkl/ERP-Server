import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemGroupMaster, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemsGroupMasterService } from './items-group-master.service';
const ITEM_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const PARENT_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const GRAND_PARENT_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45680';
const NEW_PARENT_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45681';
const CHILD_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45682';
type PrismaMock = {
  itemGroupMaster: {
    create: jest.Mock<Promise<ItemGroupMaster>, [Prisma.ItemGroupMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemGroupMaster | null>, [Prisma.ItemGroupMasterFindFirstArgs]>;
    findMany: jest.Mock<Promise<ItemGroupMaster[]>, [Prisma.ItemGroupMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemGroupMasterCountArgs]>;
    update: jest.Mock<Promise<ItemGroupMaster>, [Prisma.ItemGroupMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemGroupMasterUpdateManyArgs]>;
  };
  gridDetails: {
    findFirst: jest.Mock<
      Promise<{ gridSql: string | null } | null>,
      [Prisma.GridDetailsFindFirstArgs]
    >;
  };
  gridColumn: {
    findMany: jest.Mock<
      Promise<Array<{ gridColumnName: string; gridColumnNumber: number }>>,
      [Prisma.GridColumnFindManyArgs]
    >;
  };
  $queryRawUnsafe: jest.Mock<Promise<unknown>, [string, ...unknown[]]>;
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ConfiguredGridSqlServiceMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
};
const makeRecord = (overrides: Partial<ItemGroupMaster> = {}): ItemGroupMaster =>
  ({
    itgId: ITEM_GROUP_ID,
    itgName: 'Raw Materials',
    itgAlias: 'RM',
    itgShort: 'RAW',
    itgDescription: 'Default description',
    itgParentId: null,
    itgSort: 1,
    itgLevel: 0,
    itgPathIdsCache: [],
    itgTaxClaim: false,
    itgDefaultTaxId: null,
    itgDefaultHsn: null,
    itgDefaultUomId: null,
    itgPhoto: null,
    itgPhotoUrl: null,
    itgSyncDate: null,
    itgIsActive: true,
    itgIsDeleted: false,
    itgCreatedOn: new Date('2026-02-12T10:00:00.000Z'),
    itgCreatedBy: 'tester',
    itgModifiedOn: new Date('2026-02-12T10:00:00.000Z'),
    itgModifiedBy: 'tester',
    ...overrides,
  }) as ItemGroupMaster;
describe('ItemsGroupMasterService', () => {
  let service: ItemsGroupMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;
  beforeEach(() => {
    prisma = {
      itemGroupMaster: {
        create: jest.fn<Promise<ItemGroupMaster>, [Prisma.ItemGroupMasterCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemGroupMaster | null>,
          [Prisma.ItemGroupMasterFindFirstArgs]
        >(),
        findMany: jest.fn<Promise<ItemGroupMaster[]>, [Prisma.ItemGroupMasterFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.ItemGroupMasterCountArgs]>(),
        update: jest.fn<Promise<ItemGroupMaster>, [Prisma.ItemGroupMasterUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.ItemGroupMasterUpdateManyArgs]>(),
      },
      gridDetails: {
        findFirst: jest.fn<
          Promise<{ gridSql: string | null } | null>,
          [Prisma.GridDetailsFindFirstArgs]
        >(),
      },
      gridColumn: {
        findMany: jest.fn<
          Promise<Array<{ gridColumnName: string; gridColumnNumber: number }>>,
          [Prisma.GridColumnFindManyArgs]
        >(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string, ...unknown[]]>(),
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };
    prisma.gridDetails.findFirst.mockResolvedValue(null);
    prisma.gridColumn.findMany.mockResolvedValue([]);
    prisma.itemGroupMaster.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );
    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };
    configuredGridSqlService = {
      loadCandidates: jest.fn().mockImplementation(async (options: { tableName: string }) => {
        const where = {
          gridId: BigInt(1),
          gridIsDeleted: false,
          gridStatus: true,
          gridSql: {
            not: null,
          },
        };
        const configuredGrid = await prisma.gridDetails.findFirst({
          where,
          select: {
            gridSql: true,
          },
        });
        if (!configuredGrid?.gridSql) {
          return [];
        }

        return [
          {
            gridId: BigInt(1),
            gridSql: configuredGrid.gridSql,
          },
        ];
      }),
      filterPrimaryFromTable: jest.fn().mockImplementation((candidates: Array<unknown>) => candidates),
      validateBaseSql: jest
        .fn()
        .mockImplementation((options: { sql: string; tableName: string }) => {
          const normalizedSql = options.sql.trim().replace(/;+\s*$/g, '');
          if (!/^select\b/i.test(normalizedSql)) {
            return {
              isValid: false,
              message: 'Only SELECT query is allowed',
            };
          }
          if (normalizedSql.includes(';')) {
            return {
              isValid: false,
              message: 'Multiple statements are not allowed',
            };
          }
          if (/--|\/\*/.test(normalizedSql)) {
            return {
              isValid: false,
              message: 'Comments are not allowed in configured query',
            };
          }
          if (!new RegExp(`\\b${options.tableName}\\b`, 'i').test(normalizedSql)) {
            return {
              isValid: false,
              message: `Configured query must reference ${options.tableName} table`,
            };
          }
          return {
            isValid: true,
            normalizedSql,
          };
        }),
      runPagedQuery: jest.fn().mockImplementation(
        async (options: {
          baseSql: string;
          alias: string;
          params?: unknown[];
          limit: number;
          skip: number;
        }) => {
          const params = options.params ?? [];
          const countSql = `SELECT COUNT(*)::bigint AS total FROM (${options.baseSql}) AS ${options.alias}_count`;
          const rowsSql = `SELECT * FROM (${options.baseSql}) AS ${options.alias}_rows LIMIT $${
            params.length + 1
          } OFFSET $${params.length + 2}`;
          const [countResult, rows] = await Promise.all([
            prisma.$queryRawUnsafe(countSql, ...params),
            prisma.$queryRawUnsafe(rowsSql, ...params, options.limit, options.skip),
          ]);
          const totalRaw = (countResult as Array<{ total: bigint | number | string }>)[0]?.total;
          if (typeof totalRaw === 'bigint') {
            return { items: rows as unknown[], total: Number(totalRaw) };
          }
          if (typeof totalRaw === 'number') {
            return { items: rows as unknown[], total: Number.isFinite(totalRaw) ? totalRaw : 0 };
          }
          if (typeof totalRaw === 'string') {
            const parsed = Number(totalRaw);
            return { items: rows as unknown[], total: Number.isFinite(parsed) ? parsed : 0 };
          }
          return { items: rows as unknown[], total: 0 };
        },
      ),
    };

    service = new ItemsGroupMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
    );
  });
  it('creates an item group when itg_id is not provided', async () => {
    const createdRecord = makeRecord({ itgPathIdsCache: [] });
    const createdWithPath = makeRecord({ itgPathIdsCache: [ITEM_GROUP_ID] });
    prisma.itemGroupMaster.create.mockResolvedValue(createdRecord);
    prisma.itemGroupMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemGroupMaster.update.mockResolvedValueOnce(createdWithPath);
    prisma.itemGroupMaster.findFirst.mockResolvedValueOnce(createdWithPath);

    const input: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
    };
    const result = await service.save(input);
    expect(prisma.itemGroupMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemGroupMaster.create.mock.calls[0][0];
    expect(createArgs.data.itgName).toBe('Raw Materials');
    expect(result.itg_id).toBe(ITEM_GROUP_ID);
    expect(result.itg_path_ids_cache).toEqual([ITEM_GROUP_ID]);
  });
  it('fails create when audit logging fails (fail-closed)', async () => {
    const createdRecord = makeRecord({ itgPathIdsCache: [] });
    const createdWithPath = makeRecord({ itgPathIdsCache: [ITEM_GROUP_ID] });
    prisma.itemGroupMaster.create.mockResolvedValue(createdRecord);
    prisma.itemGroupMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemGroupMaster.update.mockResolvedValueOnce(createdWithPath);
    prisma.itemGroupMaster.findFirst.mockResolvedValueOnce(createdWithPath);
    (auditLogService.logEntityChange as jest.Mock).mockRejectedValueOnce(new Error('audit failed'));

    await expect(
      service.save({
        itg_name: 'Raw Materials',
      }),
    ).rejects.toThrow('audit failed');
  });
  it('updates an item group when itg_id is provided', async () => {
    const existingRecord = makeRecord({ itgPathIdsCache: [ITEM_GROUP_ID] });
    const updatedRecord = makeRecord({
      itgName: 'Updated Group',
      itgPathIdsCache: [ITEM_GROUP_ID],
    });
    prisma.itemGroupMaster.findFirst
      .mockResolvedValueOnce(existingRecord)
      .mockResolvedValueOnce(updatedRecord);
    prisma.itemGroupMaster.findMany.mockResolvedValueOnce([updatedRecord]);
    prisma.itemGroupMaster.update.mockResolvedValueOnce(updatedRecord);
    const input: SaveItemGroupDto = {
      itg_id: ITEM_GROUP_ID,
      itg_name: 'Updated Group',
    };
    const result = await service.save(input);
    expect(prisma.itemGroupMaster.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.itemGroupMaster.update.mock.calls[0][0];
    expect(updateArgs.where.itgId).toBe(ITEM_GROUP_ID);
    expect(updateArgs.data.itgName).toBe('Updated Group');
    expect(updateArgs.data.itgModifiedBy).toBe('system');
    expect(result.itg_name).toBe('Updated Group');
  });
  it('rejects duplicate name with 409', async () => {
    prisma.itemGroupMaster.create.mockRejectedValue({ code: 'P2002' });
    const input: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
    };
    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects self-parent updates', async () => {
    prisma.itemGroupMaster.findFirst.mockResolvedValue(makeRecord());
    const input: SaveItemGroupDto = {
      itg_id: ITEM_GROUP_ID,
      itg_name: 'Raw Materials',
      itg_parent_id: ITEM_GROUP_ID,
    };
    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('adds newly created child id to parent and grandparent caches', async () => {
    const createdChild = makeRecord({
      itgId: CHILD_GROUP_ID,
      itgName: 'Child Group',
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [],
    });
    const childWithPath = makeRecord({
      itgId: CHILD_GROUP_ID,
      itgName: 'Child Group',
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [CHILD_GROUP_ID],
    });
    const parent = makeRecord({
      itgId: PARENT_GROUP_ID,
      itgParentId: GRAND_PARENT_GROUP_ID,
      itgPathIdsCache: [PARENT_GROUP_ID],
    });
    const grandParent = makeRecord({
      itgId: GRAND_PARENT_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [GRAND_PARENT_GROUP_ID],
    });

    prisma.itemGroupMaster.create.mockResolvedValue(createdChild);
    prisma.itemGroupMaster.findFirst
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(grandParent)
      .mockResolvedValueOnce(childWithPath);
    prisma.itemGroupMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parent, grandParent]);
    prisma.itemGroupMaster.update
      .mockResolvedValueOnce(childWithPath)
      .mockResolvedValueOnce(
        makeRecord({
          itgId: PARENT_GROUP_ID,
          itgParentId: GRAND_PARENT_GROUP_ID,
          itgPathIdsCache: [PARENT_GROUP_ID, CHILD_GROUP_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          itgId: GRAND_PARENT_GROUP_ID,
          itgParentId: null,
          itgPathIdsCache: [GRAND_PARENT_GROUP_ID, CHILD_GROUP_ID],
        }),
      );

    const result = await service.save({
      itg_name: 'Child Group',
      itg_parent_id: PARENT_GROUP_ID,
    });

    expect(result.itg_id).toBe(CHILD_GROUP_ID);
    const parentUpdateArgs = prisma.itemGroupMaster.update.mock.calls[1][0];
    expect(parentUpdateArgs.where.itgId).toBe(PARENT_GROUP_ID);
    expect(parentUpdateArgs.data.itgPathIdsCache).toEqual([PARENT_GROUP_ID, CHILD_GROUP_ID]);

    const grandParentUpdateArgs = prisma.itemGroupMaster.update.mock.calls[2][0];
    expect(grandParentUpdateArgs.where.itgId).toBe(GRAND_PARENT_GROUP_ID);
    expect(grandParentUpdateArgs.data.itgPathIdsCache).toEqual([
      GRAND_PARENT_GROUP_ID,
      CHILD_GROUP_ID,
    ]);
  });
  it('does not duplicate ids when ancestor cache already contains a child id', async () => {
    const createdChild = makeRecord({
      itgId: CHILD_GROUP_ID,
      itgName: 'Child Group',
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [],
    });
    const childWithPath = makeRecord({
      itgId: CHILD_GROUP_ID,
      itgName: 'Child Group',
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [CHILD_GROUP_ID],
    });
    const parentWithChildAlready = makeRecord({
      itgId: PARENT_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [PARENT_GROUP_ID, CHILD_GROUP_ID],
    });

    prisma.itemGroupMaster.create.mockResolvedValue(createdChild);
    prisma.itemGroupMaster.findFirst
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(childWithPath);
    prisma.itemGroupMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parentWithChildAlready]);
    prisma.itemGroupMaster.update.mockResolvedValueOnce(childWithPath);

    await service.save({
      itg_name: 'Child Group',
      itg_parent_id: PARENT_GROUP_ID,
    });

    expect(prisma.itemGroupMaster.update).toHaveBeenCalledTimes(1);
  });
  it('moves subtree ids from old ancestors to new ancestors on reparent', async () => {
    const existing = makeRecord({
      itgId: ITEM_GROUP_ID,
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [ITEM_GROUP_ID, CHILD_GROUP_ID],
    });
    const child = makeRecord({
      itgId: CHILD_GROUP_ID,
      itgParentId: ITEM_GROUP_ID,
      itgPathIdsCache: [CHILD_GROUP_ID],
    });
    const updatedWithoutSelf = makeRecord({
      itgId: ITEM_GROUP_ID,
      itgName: 'Updated Group',
      itgParentId: NEW_PARENT_GROUP_ID,
      itgPathIdsCache: [CHILD_GROUP_ID],
    });
    const refreshed = makeRecord({
      itgId: ITEM_GROUP_ID,
      itgName: 'Updated Group',
      itgParentId: NEW_PARENT_GROUP_ID,
      itgPathIdsCache: [CHILD_GROUP_ID, ITEM_GROUP_ID],
    });
    const oldParent = makeRecord({
      itgId: PARENT_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [PARENT_GROUP_ID, ITEM_GROUP_ID, CHILD_GROUP_ID],
    });
    const newParent = makeRecord({
      itgId: NEW_PARENT_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [NEW_PARENT_GROUP_ID],
    });

    prisma.itemGroupMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(refreshed);
    prisma.itemGroupMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedWithoutSelf])
      .mockResolvedValueOnce([oldParent])
      .mockResolvedValueOnce([newParent]);
    prisma.itemGroupMaster.update
      .mockResolvedValueOnce(updatedWithoutSelf)
      .mockResolvedValueOnce(refreshed)
      .mockResolvedValueOnce(
        makeRecord({
          itgId: PARENT_GROUP_ID,
          itgParentId: null,
          itgPathIdsCache: [PARENT_GROUP_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          itgId: NEW_PARENT_GROUP_ID,
          itgParentId: null,
          itgPathIdsCache: [NEW_PARENT_GROUP_ID, ITEM_GROUP_ID, CHILD_GROUP_ID],
        }),
      );

    const result = await service.save({
      itg_id: ITEM_GROUP_ID,
      itg_name: 'Updated Group',
      itg_parent_id: NEW_PARENT_GROUP_ID,
    });

    expect(result.itg_parent_id).toBe(NEW_PARENT_GROUP_ID);
    const oldParentUpdateArgs = prisma.itemGroupMaster.update.mock.calls[2][0];
    expect(oldParentUpdateArgs.where.itgId).toBe(PARENT_GROUP_ID);
    expect(oldParentUpdateArgs.data.itgPathIdsCache).toEqual([PARENT_GROUP_ID]);

    const newParentUpdateArgs = prisma.itemGroupMaster.update.mock.calls[3][0];
    expect(newParentUpdateArgs.where.itgId).toBe(NEW_PARENT_GROUP_ID);
    expect(newParentUpdateArgs.data.itgPathIdsCache).toEqual([
      NEW_PARENT_GROUP_ID,
      ITEM_GROUP_ID,
      CHILD_GROUP_ID,
    ]);
  });
  it('removes subtree ids from old ancestors when reparented to root', async () => {
    const existing = makeRecord({
      itgId: ITEM_GROUP_ID,
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [ITEM_GROUP_ID],
    });
    const refreshed = makeRecord({
      itgId: ITEM_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [ITEM_GROUP_ID],
    });
    const oldParent = makeRecord({
      itgId: PARENT_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [PARENT_GROUP_ID, ITEM_GROUP_ID],
    });

    prisma.itemGroupMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(refreshed);
    prisma.itemGroupMaster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([refreshed])
      .mockResolvedValueOnce([oldParent]);
    prisma.itemGroupMaster.update.mockResolvedValueOnce(refreshed).mockResolvedValueOnce(
      makeRecord({
        itgId: PARENT_GROUP_ID,
        itgParentId: null,
        itgPathIdsCache: [PARENT_GROUP_ID],
      }),
    );

    const result = await service.save({
      itg_id: ITEM_GROUP_ID,
      itg_name: 'Raw Materials',
      itg_parent_id: null,
    });

    expect(result.itg_parent_id).toBeNull();
    const oldParentUpdateArgs = prisma.itemGroupMaster.update.mock.calls[1][0];
    expect(oldParentUpdateArgs.where.itgId).toBe(PARENT_GROUP_ID);
    expect(oldParentUpdateArgs.data.itgPathIdsCache).toEqual([PARENT_GROUP_ID]);
  });
  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.itemGroupMaster.findFirst.mockResolvedValue(null);
    await expect(service.getById(ITEM_GROUP_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.itemGroupMaster.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.itemGroupMaster.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.itgId).toBe(ITEM_GROUP_ID);
    expect(findFirstArgs.where?.itgIsDeleted).toBe(false);
  });
  it('excludes deleted rows in list', async () => {
    prisma.itemGroupMaster.count.mockResolvedValue(1);
    prisma.itemGroupMaster.findMany.mockResolvedValue([makeRecord()]);
    const query: ListItemGroupQueryDto = {};
    await service.list(query);
    expect(prisma.itemGroupMaster.count).toHaveBeenCalledTimes(1);
    const countArgs = prisma.itemGroupMaster.count.mock.calls[0][0];
    expect(countArgs.where?.itgIsDeleted).toBe(false);
  });
  it('applies pagination and search filters correctly', async () => {
    prisma.itemGroupMaster.count.mockResolvedValue(35);
    prisma.itemGroupMaster.findMany.mockResolvedValue([makeRecord()]);
    const query: ListItemGroupQueryDto = {
      itg_is_active: true,
      search: 'raw',
      page: 2,
      limit: 10,
    };
    const result = await service.list(query);
    expect(prisma.gridDetails.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.itemGroupMaster.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.itemGroupMaster.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.where?.itgIsDeleted).toBe(false);
    expect(findManyArgs.where?.itgIsActive).toBe(true);
    expect(findManyArgs.where?.OR).toEqual([
      { itgName: { contains: 'raw', mode: 'insensitive' } },
      { itgAlias: { contains: 'raw', mode: 'insensitive' } },
      { itgDescription: { contains: 'raw', mode: 'insensitive' } },
    ]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      total_pages: 4,
    });
  });
  it('uses configured grid_sql even when filters and search are provided', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT itg_id AS "item group id", itg_name AS "item group name", itg_alias AS "item group short", itg_description, itg_parent_id, itg_is_active FROM item_group_master WHERE itg_is_deleted = false',
    });
    prisma.gridColumn.findMany.mockResolvedValue([
      { gridColumnName: 'item group name', gridColumnNumber: 2 },
      { gridColumnName: 'item group short', gridColumnNumber: 3 },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ total: BigInt(1) }]).mockResolvedValueOnce([
      {
        'item group id': ITEM_GROUP_ID,
        'item group name': 'Raw Materials',
        'item group short': 'RM',
        itg_description: 'Default description',
        itg_parent_id: null,
        itg_is_active: true,
      },
    ]);

    const result = await service.list({
      itg_is_active: true,
      search: 'raw',
      page: 1,
      limit: 20,
    });
    expect(prisma.itemGroupMaster.findMany).not.toHaveBeenCalled();
    expect(prisma.itemGroupMaster.count).not.toHaveBeenCalled();
    expect(prisma.gridColumn.findMany).toHaveBeenCalledWith({
      where: {
        gridId: BigInt(1),
        gridColumnIsDeleted: false,
        gridColumnFilter: true,
        grid: {
          gridIsDeleted: false,
        },
      },
      orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
      select: {
        gridColumnName: true,
        gridColumnNumber: true,
      },
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE grid_kv.key = $2'),
      true,
      'item group name',
      '%raw%',
      'item group short',
      '%raw%',
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $6 OFFSET $7'),
      true,
      'item group name',
      '%raw%',
      'item group short',
      '%raw%',
      20,
      0,
    );
    expect(result.meta.total).toBe(1);
  });
  it('searches unquoted camelCase aliases from grid_sql using filtered grid columns', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT igm.itg_id AS itemGroupId, igm.itg_name AS itemGroupName, igm.itg_alias AS groupAlias, igm.itg_short AS groupShort, igm.itg_is_active AS isActive FROM item_group_master igm WHERE igm.itg_is_deleted = false',
    });
    prisma.gridColumn.findMany.mockResolvedValue([
      { gridColumnName: 'item group name', gridColumnNumber: 1 },
      { gridColumnName: 'item group short', gridColumnNumber: 2 },
      { gridColumnName: 'item group alias', gridColumnNumber: 3 },
      { gridColumnName: 'item group active', gridColumnNumber: 4 },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ total: BigInt(1) }]).mockResolvedValueOnce([
      {
        itemgroupid: ITEM_GROUP_ID,
        itemgroupname: 'Shoes',
        groupalias: 'Footwear',
        groupshort: 'SH',
        isactive: true,
      },
    ]);

    const result = await service.list({
      search: 'sh',
      page: 1,
      limit: 20,
    });

    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE grid_kv.key = $1'),
      'itemgroupname',
      '%sh%',
      'groupshort',
      '%sh%',
      'groupalias',
      '%sh%',
      'isactive',
      '%sh%',
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $9 OFFSET $10'),
      'itemgroupname',
      '%sh%',
      'groupshort',
      '%sh%',
      'groupalias',
      '%sh%',
      'isactive',
      '%sh%',
      20,
      0,
    );
    expect(result.meta.total).toBe(1);
  });
  it('dynamically includes newly added description field when filter is enabled', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT igm.itg_id AS itemGroupId, igm.itg_name AS itemGroupName, igm.itg_alias AS groupAlias, igm.itg_short AS groupShort, igm.itg_description AS itemGroupDesc FROM item_group_master igm WHERE igm.itg_is_deleted = false',
    });
    prisma.gridColumn.findMany.mockResolvedValue([
      { gridColumnName: 'item group description', gridColumnNumber: 5 },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ total: BigInt(1) }]).mockResolvedValueOnce([
      {
        itemgroupid: ITEM_GROUP_ID,
        itemgroupname: 'Shoes',
        groupalias: 'Footwear',
        groupshort: 'SH',
        itemgroupdesc: 'Leather shoes',
      },
    ]);

    const result = await service.list({
      search: 'leather',
      page: 1,
      limit: 20,
    });

    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE grid_kv.key = $1'),
      'itemgroupdesc',
      '%leather%',
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $3 OFFSET $4'),
      'itemgroupdesc',
      '%leather%',
      20,
      0,
    );
    expect(result.meta.total).toBe(1);
  });
  it('maps search fields by grid_column_number when names do not match sql fields', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT itg_name, itg_alias, itg_description, itg_short FROM item_group_master WHERE itg_is_deleted = false',
    });
    prisma.gridColumn.findMany.mockResolvedValue([
      { gridColumnName: 'column one', gridColumnNumber: 1 },
      { gridColumnName: 'column three', gridColumnNumber: 3 },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ total: BigInt(1) }]).mockResolvedValueOnce([
      {
        itg_name: 'Raw Materials',
        itg_alias: 'RM',
        itg_description: 'Default description',
        itg_short: 'RAW',
      },
    ]);
    await service.list({
      search: 'raw',
      page: 1,
      limit: 20,
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE grid_kv.key = $1'),
      'itg_name',
      '%raw%',
      'itg_description',
      '%raw%',
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $5 OFFSET $6'),
      'itg_name',
      '%raw%',
      'itg_description',
      '%raw%',
      20,
      0,
    );
  });
  it('uses configured grid_sql for plain get-all list', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT itg_id AS \"itemGroupId\", itg_name AS \"groupName\" FROM item_group_master WHERE itg_is_deleted = false',
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([{ itemGroupId: ITEM_GROUP_ID, groupName: 'Raw Materials' }]);
    const result = await service.list({});
    expect(prisma.gridDetails.findFirst).toHaveBeenCalledWith({
      where: {
        gridId: BigInt(1),
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
        },
      },
      select: {
        gridSql: true,
      },
    });
    expect(prisma.gridColumn.findMany).not.toHaveBeenCalled();
    expect(prisma.itemGroupMaster.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('COUNT(*)::bigint AS total'),
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $1 OFFSET $2'),
      20,
      0,
    );
    expect(result).toEqual({
      items: [{ itemGroupId: ITEM_GROUP_ID, groupName: 'Raw Materials' }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });
  it('rejects invalid configured grid_sql in list', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql: 'DELETE FROM item_group_master',
    });
    await expect(service.list({})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
  it('soft delete removes subtree ids from ancestor caches', async () => {
    const parent = makeRecord({
      itgId: PARENT_GROUP_ID,
      itgParentId: null,
      itgPathIdsCache: [PARENT_GROUP_ID, ITEM_GROUP_ID, CHILD_GROUP_ID],
    });
    const node = makeRecord({
      itgId: ITEM_GROUP_ID,
      itgParentId: PARENT_GROUP_ID,
      itgPathIdsCache: [ITEM_GROUP_ID, CHILD_GROUP_ID],
    });
    const child = makeRecord({
      itgId: CHILD_GROUP_ID,
      itgParentId: ITEM_GROUP_ID,
      itgPathIdsCache: [CHILD_GROUP_ID],
    });

    prisma.itemGroupMaster.findFirst
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent);
    prisma.itemGroupMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([parent]);
    prisma.itemGroupMaster.updateMany.mockResolvedValue({ count: 1 });
    prisma.itemGroupMaster.update.mockResolvedValueOnce(
      makeRecord({
        itgId: PARENT_GROUP_ID,
        itgParentId: null,
        itgPathIdsCache: [PARENT_GROUP_ID],
      }),
    );

    await expect(service.softDelete(ITEM_GROUP_ID)).resolves.toEqual({
      itg_id: ITEM_GROUP_ID,
      deleted: true,
    });
    expect(prisma.itemGroupMaster.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.itemGroupMaster.updateMany.mock.calls[0][0];
    if (!updateManyArgs.where) {
      throw new Error('Expected updateMany where clause');
    }
    expect(updateManyArgs.where.itgId).toBe(ITEM_GROUP_ID);
    expect(updateManyArgs.where.itgIsDeleted).toBe(false);
    expect(updateManyArgs.data.itgIsDeleted).toBe(true);
    expect(updateManyArgs.data.itgModifiedBy).toBe('system');

    expect(prisma.itemGroupMaster.update).toHaveBeenCalledTimes(1);
    const ancestorUpdateArgs = prisma.itemGroupMaster.update.mock.calls[0][0];
    expect(ancestorUpdateArgs.where.itgId).toBe(PARENT_GROUP_ID);
    expect(ancestorUpdateArgs.data.itgPathIdsCache).toEqual([PARENT_GROUP_ID]);
  });
  it('rejects invalid base64 image input', async () => {
    const input: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
      itg_photo: 'not-valid-base64',
    };
    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('stores valid base64 image input into itgPhoto bytes', async () => {
    const createdRecord = makeRecord({
      itgPhoto: Buffer.from('sample-image'),
      itgPathIdsCache: [],
    });
    const refreshedRecord = makeRecord({
      itgPhoto: Buffer.from('sample-image'),
      itgPathIdsCache: [ITEM_GROUP_ID],
    });
    prisma.itemGroupMaster.create.mockResolvedValue(createdRecord);
    prisma.itemGroupMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemGroupMaster.update.mockResolvedValueOnce(refreshedRecord);
    prisma.itemGroupMaster.findFirst.mockResolvedValueOnce(refreshedRecord);
    const input: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
      itg_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    };
    await service.save(input);
    expect(prisma.itemGroupMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemGroupMaster.create.mock.calls[0][0];
    expect(createArgs.data.itgPhoto).toEqual(new Uint8Array(Buffer.from('sample-image')));
  });
});
