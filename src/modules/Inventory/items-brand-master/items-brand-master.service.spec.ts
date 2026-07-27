import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemBrandMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemsBrandMasterService } from './items-brand-master.service';

const BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const PARENT_BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const GRAND_PARENT_BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45680';
const NEW_PARENT_BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45681';
const CHILD_BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45682';

type PrismaMock = {
  itemBrandMaster: {
    create: jest.Mock<Promise<ItemBrandMaster>, [Prisma.ItemBrandMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemBrandMaster | null>, [Prisma.ItemBrandMasterFindFirstArgs]>;
    findMany: jest.Mock<Promise<ItemBrandMaster[]>, [Prisma.ItemBrandMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemBrandMasterCountArgs]>;
    update: jest.Mock<Promise<ItemBrandMaster>, [Prisma.ItemBrandMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemBrandMasterUpdateManyArgs]>;
  };
  gridDetails: {
    findFirst: jest.Mock<
      Promise<{ gridSql: string | null } | null>,
      [Prisma.GridDetailsFindFirstArgs]
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

const makeRecord = (overrides: Partial<ItemBrandMaster> = {}): ItemBrandMaster =>
  ({
    brand_id: BRAND_ID,
    brand_name: 'Acme',
    brand_alias: 'AC',
    brand_short: 'ACM',
    brand_description: 'Default description',
    brand_photo: null,
    brand_photo_url: null,
    brand_parent_id: null,
    brand_sort: 1,
    brand_level: 0,
    brand_path_ids: [],
    brand_is_active: true,
    brand_is_deleted: false,
    brand_sync_date: null,
    brand_created_on: new Date('2026-02-12T10:00:00.000Z'),
    brand_created_by: 'tester',
    brand_modified_on: new Date('2026-02-12T10:00:00.000Z'),
    brand_modified_by: 'tester',
    ...overrides,
  }) as ItemBrandMaster;

describe('ItemsBrandMasterService', () => {
  let service: ItemsBrandMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;
  let requestContextService: { getUserId: jest.Mock };

  beforeEach(() => {
    prisma = {
      itemBrandMaster: {
        create: jest.fn<Promise<ItemBrandMaster>, [Prisma.ItemBrandMasterCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemBrandMaster | null>,
          [Prisma.ItemBrandMasterFindFirstArgs]
        >(),
        findMany: jest.fn<Promise<ItemBrandMaster[]>, [Prisma.ItemBrandMasterFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.ItemBrandMasterCountArgs]>(),
        update: jest.fn<Promise<ItemBrandMaster>, [Prisma.ItemBrandMasterUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.ItemBrandMasterUpdateManyArgs]>(),
      },
      gridDetails: {
        findFirst: jest.fn<
          Promise<{ gridSql: string | null } | null>,
          [Prisma.GridDetailsFindFirstArgs]
        >(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string, ...unknown[]]>(),
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };
    prisma.gridDetails.findFirst.mockResolvedValue(null);
    prisma.itemBrandMaster.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );
    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };
    configuredGridSqlService = {
      loadCandidates: jest.fn().mockImplementation(async (options: { tableName: string }) => {
        const configuredGrid = await prisma.gridDetails.findFirst({
          where: {
            gridIsDeleted: false,
            gridStatus: true,
            gridSql: {
              not: null,
              contains: options.tableName,
              mode: 'insensitive',
            },
          },
          orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
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
      filterPrimaryFromTable: jest
        .fn()
        .mockImplementation((candidates: Array<unknown>) => candidates),
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
      runPagedQuery: jest
        .fn()
        .mockImplementation(
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

    requestContextService = {
      getUserId: jest.fn().mockReturnValue(null),
    };

    service = new ItemsBrandMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      requestContextService as never,
    );
  });

  it('creates a root item brand and stores self brand_id in brand_path_ids', async () => {
    const createdRecord = makeRecord({ brand_path_ids: [] });
    const createdWithPath = makeRecord({ brand_path_ids: [BRAND_ID] });

    prisma.itemBrandMaster.create.mockResolvedValue(createdRecord);
    prisma.itemBrandMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemBrandMaster.update.mockResolvedValueOnce(createdWithPath);
    prisma.itemBrandMaster.findFirst.mockResolvedValueOnce(createdWithPath);

    const input: SaveItemBrandDto = {
      brand_name: 'Acme',
    };

    const result = await service.save(input);

    expect(prisma.itemBrandMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemBrandMaster.create.mock.calls[0][0];
    expect(createArgs.data.brand_name).toBe('Acme');
    expect(result.brand_id).toBe(BRAND_ID);
    expect(result.brand_path_ids).toEqual([BRAND_ID]);
  });

  it('updates an item brand when brand_id is provided', async () => {
    const existingRecord = makeRecord({ brand_path_ids: [BRAND_ID] });
    const updatedRecord = makeRecord({
      brand_name: 'Updated Brand',
      brand_path_ids: [BRAND_ID],
    });

    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(existingRecord)
      .mockResolvedValueOnce(updatedRecord);
    prisma.itemBrandMaster.findMany.mockResolvedValueOnce([updatedRecord]);
    prisma.itemBrandMaster.update.mockResolvedValueOnce(updatedRecord);

    const input: SaveItemBrandDto = {
      brand_id: BRAND_ID,
      brand_name: 'Updated Brand',
    };

    const result = await service.save(input);

    expect(prisma.itemBrandMaster.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.itemBrandMaster.update.mock.calls[0][0];
    expect(updateArgs.where.brand_id).toBe(BRAND_ID);
    expect(updateArgs.data.brand_name).toBe('Updated Brand');
    expect(updateArgs.data.brand_modified_by).toBe(DEFAULT_ACTOR);
    expect(result.brand_name).toBe('Updated Brand');
  });

  it('rejects duplicate name with 409', async () => {
    prisma.itemBrandMaster.create.mockRejectedValue({ code: 'P2002' });

    const input: SaveItemBrandDto = {
      brand_name: 'Acme',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects self-parent updates', async () => {
    prisma.itemBrandMaster.findFirst.mockResolvedValue(makeRecord());

    const input: SaveItemBrandDto = {
      brand_id: BRAND_ID,
      brand_name: 'Acme',
      brand_parent_id: BRAND_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds newly created child id to parent and grandparent caches', async () => {
    const createdChild = makeRecord({
      brand_id: CHILD_BRAND_ID,
      brand_name: 'Child Brand',
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [],
    });
    const childWithPath = makeRecord({
      brand_id: CHILD_BRAND_ID,
      brand_name: 'Child Brand',
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [CHILD_BRAND_ID],
    });
    const parent = makeRecord({
      brand_id: PARENT_BRAND_ID,
      brand_parent_id: GRAND_PARENT_BRAND_ID,
      brand_path_ids: [PARENT_BRAND_ID],
    });
    const grandParent = makeRecord({
      brand_id: GRAND_PARENT_BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [GRAND_PARENT_BRAND_ID],
    });

    prisma.itemBrandMaster.create.mockResolvedValue(createdChild);
    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(grandParent)
      .mockResolvedValueOnce(childWithPath);
    prisma.itemBrandMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parent, grandParent]);
    prisma.itemBrandMaster.update
      .mockResolvedValueOnce(childWithPath)
      .mockResolvedValueOnce(
        makeRecord({
          brand_id: PARENT_BRAND_ID,
          brand_parent_id: GRAND_PARENT_BRAND_ID,
          brand_path_ids: [PARENT_BRAND_ID, CHILD_BRAND_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          brand_id: GRAND_PARENT_BRAND_ID,
          brand_parent_id: null,
          brand_path_ids: [GRAND_PARENT_BRAND_ID, CHILD_BRAND_ID],
        }),
      );

    const result = await service.save({
      brand_name: 'Child Brand',
      brand_parent_id: PARENT_BRAND_ID,
    });

    expect(result.brand_id).toBe(CHILD_BRAND_ID);

    const parentUpdateArgs = prisma.itemBrandMaster.update.mock.calls[1][0];
    expect(parentUpdateArgs.where.brand_id).toBe(PARENT_BRAND_ID);
    expect(parentUpdateArgs.data.brand_path_ids).toEqual([PARENT_BRAND_ID, CHILD_BRAND_ID]);

    const grandParentUpdateArgs = prisma.itemBrandMaster.update.mock.calls[2][0];
    expect(grandParentUpdateArgs.where.brand_id).toBe(GRAND_PARENT_BRAND_ID);
    expect(grandParentUpdateArgs.data.brand_path_ids).toEqual([
      GRAND_PARENT_BRAND_ID,
      CHILD_BRAND_ID,
    ]);
  });

  it('does not duplicate ids when ancestor cache already contains child id', async () => {
    const createdChild = makeRecord({
      brand_id: CHILD_BRAND_ID,
      brand_name: 'Child Brand',
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [],
    });
    const childWithPath = makeRecord({
      brand_id: CHILD_BRAND_ID,
      brand_name: 'Child Brand',
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [CHILD_BRAND_ID],
    });
    const parentWithChildAlready = makeRecord({
      brand_id: PARENT_BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [PARENT_BRAND_ID, CHILD_BRAND_ID],
    });

    prisma.itemBrandMaster.create.mockResolvedValue(createdChild);
    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(childWithPath);
    prisma.itemBrandMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parentWithChildAlready]);
    prisma.itemBrandMaster.update.mockResolvedValueOnce(childWithPath);

    await service.save({
      brand_name: 'Child Brand',
      brand_parent_id: PARENT_BRAND_ID,
    });

    expect(prisma.itemBrandMaster.update).toHaveBeenCalledTimes(1);
  });

  it('moves subtree ids from old ancestors to new ancestors on reparent', async () => {
    const existing = makeRecord({
      brand_id: BRAND_ID,
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [BRAND_ID, CHILD_BRAND_ID],
    });
    const child = makeRecord({
      brand_id: CHILD_BRAND_ID,
      brand_parent_id: BRAND_ID,
      brand_path_ids: [CHILD_BRAND_ID],
    });
    const updatedWithoutSelf = makeRecord({
      brand_id: BRAND_ID,
      brand_name: 'Updated Brand',
      brand_parent_id: NEW_PARENT_BRAND_ID,
      brand_path_ids: [CHILD_BRAND_ID],
    });
    const refreshedWithSelf = makeRecord({
      brand_id: BRAND_ID,
      brand_name: 'Updated Brand',
      brand_parent_id: NEW_PARENT_BRAND_ID,
      brand_path_ids: [CHILD_BRAND_ID, BRAND_ID],
    });
    const oldParent = makeRecord({
      brand_id: PARENT_BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [PARENT_BRAND_ID, BRAND_ID, CHILD_BRAND_ID],
    });
    const newParent = makeRecord({
      brand_id: NEW_PARENT_BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [NEW_PARENT_BRAND_ID],
    });

    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(refreshedWithSelf);
    prisma.itemBrandMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedWithoutSelf])
      .mockResolvedValueOnce([oldParent])
      .mockResolvedValueOnce([newParent]);
    prisma.itemBrandMaster.update
      .mockResolvedValueOnce(updatedWithoutSelf)
      .mockResolvedValueOnce(refreshedWithSelf)
      .mockResolvedValueOnce(
        makeRecord({
          brand_id: PARENT_BRAND_ID,
          brand_parent_id: null,
          brand_path_ids: [PARENT_BRAND_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          brand_id: NEW_PARENT_BRAND_ID,
          brand_parent_id: null,
          brand_path_ids: [NEW_PARENT_BRAND_ID, BRAND_ID, CHILD_BRAND_ID],
        }),
      );

    const result = await service.save({
      brand_id: BRAND_ID,
      brand_name: 'Updated Brand',
      brand_parent_id: NEW_PARENT_BRAND_ID,
    });

    expect(result.brand_parent_id).toBe(NEW_PARENT_BRAND_ID);

    const oldParentUpdateArgs = prisma.itemBrandMaster.update.mock.calls[2][0];
    expect(oldParentUpdateArgs.where.brand_id).toBe(PARENT_BRAND_ID);
    expect(oldParentUpdateArgs.data.brand_path_ids).toEqual([PARENT_BRAND_ID]);

    const newParentUpdateArgs = prisma.itemBrandMaster.update.mock.calls[3][0];
    expect(newParentUpdateArgs.where.brand_id).toBe(NEW_PARENT_BRAND_ID);
    expect(newParentUpdateArgs.data.brand_path_ids).toEqual([
      NEW_PARENT_BRAND_ID,
      BRAND_ID,
      CHILD_BRAND_ID,
    ]);
  });

  it('removes subtree ids from old ancestors when reparented to root', async () => {
    const existing = makeRecord({
      brand_id: BRAND_ID,
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [BRAND_ID],
    });
    const refreshed = makeRecord({
      brand_id: BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [BRAND_ID],
    });
    const oldParent = makeRecord({
      brand_id: PARENT_BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [PARENT_BRAND_ID, BRAND_ID],
    });

    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(refreshed);
    prisma.itemBrandMaster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([refreshed])
      .mockResolvedValueOnce([oldParent]);
    prisma.itemBrandMaster.update.mockResolvedValueOnce(refreshed).mockResolvedValueOnce(
      makeRecord({
        brand_id: PARENT_BRAND_ID,
        brand_parent_id: null,
        brand_path_ids: [PARENT_BRAND_ID],
      }),
    );

    const result = await service.save({
      brand_id: BRAND_ID,
      brand_name: 'Acme',
      brand_parent_id: null,
    });

    expect(result.brand_parent_id).toBeNull();
    const oldParentUpdateArgs = prisma.itemBrandMaster.update.mock.calls[1][0];
    expect(oldParentUpdateArgs.where.brand_id).toBe(PARENT_BRAND_ID);
    expect(oldParentUpdateArgs.data.brand_path_ids).toEqual([PARENT_BRAND_ID]);
  });

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.itemBrandMaster.findFirst.mockResolvedValue(null);

    await expect(service.getById(BRAND_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.itemBrandMaster.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.itemBrandMaster.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.brand_id).toBe(BRAND_ID);
    expect(findFirstArgs.where?.brand_is_deleted).toBe(false);
  });
  it('toggleDelete removes subtree ids from ancestor caches', async () => {
    const parent = makeRecord({
      brand_id: PARENT_BRAND_ID,
      brand_parent_id: null,
      brand_path_ids: [PARENT_BRAND_ID, BRAND_ID, CHILD_BRAND_ID],
    });
    const node = makeRecord({
      brand_id: BRAND_ID,
      brand_parent_id: PARENT_BRAND_ID,
      brand_path_ids: [BRAND_ID, CHILD_BRAND_ID],
    });
    const child = makeRecord({
      brand_id: CHILD_BRAND_ID,
      brand_parent_id: BRAND_ID,
      brand_path_ids: [CHILD_BRAND_ID],
    });

    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent);
    prisma.itemBrandMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([parent]);
    prisma.itemBrandMaster.updateMany.mockResolvedValue({ count: 1 });
    prisma.itemBrandMaster.update.mockResolvedValueOnce(
      makeRecord({
        brand_id: PARENT_BRAND_ID,
        brand_parent_id: null,
        brand_path_ids: [PARENT_BRAND_ID],
      }),
    );

    await expect(service.toggleDelete(BRAND_ID)).resolves.toEqual({
      brand_id: BRAND_ID,
      deleted: true,
    });

    expect(prisma.itemBrandMaster.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.itemBrandMaster.updateMany.mock.calls[0][0];
    if (!updateManyArgs.where) {
      throw new Error('Expected updateMany where clause');
    }
    expect(updateManyArgs.where.brand_id).toBe(BRAND_ID);
    expect(updateManyArgs.where.brand_is_deleted).toBe(false);
    expect(updateManyArgs.data.brand_is_deleted).toBe(true);
    expect(updateManyArgs.data.brand_modified_by).toBe(DEFAULT_ACTOR);

    expect(prisma.itemBrandMaster.update).toHaveBeenCalledTimes(1);
    const ancestorUpdateArgs = prisma.itemBrandMaster.update.mock.calls[0][0];
    expect(ancestorUpdateArgs.where.brand_id).toBe(PARENT_BRAND_ID);
    expect(ancestorUpdateArgs.data.brand_path_ids).toEqual([PARENT_BRAND_ID]);
  });

  it('toggleDelete restores a previously deleted brand', async () => {
    prisma.itemBrandMaster.findFirst
      .mockResolvedValueOnce(makeRecord({ brand_is_deleted: true, brand_parent_id: null }))
      .mockResolvedValueOnce(null);
    prisma.itemBrandMaster.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.toggleDelete(BRAND_ID)).resolves.toEqual({
      brand_id: BRAND_ID,
      deleted: false,
    });

    const updateManyArgs = prisma.itemBrandMaster.updateMany.mock.calls[0][0];
    if (!updateManyArgs.where) {
      throw new Error('Expected updateMany where clause');
    }
    expect(updateManyArgs.where.brand_id).toBe(BRAND_ID);
    expect(updateManyArgs.where.brand_is_deleted).toBe(true);
    expect(updateManyArgs.data.brand_is_deleted).toBe(false);
  });

  it('rejects invalid base64 image input', async () => {
    const input: SaveItemBrandDto = {
      brand_name: 'Acme',
      brand_photo: 'not-valid-base64',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores valid base64 image input into brand_photo bytes', async () => {
    const createdRecord = makeRecord({
      brand_photo: Buffer.from('sample-image'),
      brand_path_ids: [],
    });
    const refreshedRecord = makeRecord({
      brand_photo: Buffer.from('sample-image'),
      brand_path_ids: [BRAND_ID],
    });

    prisma.itemBrandMaster.create.mockResolvedValue(createdRecord);
    prisma.itemBrandMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemBrandMaster.update.mockResolvedValueOnce(refreshedRecord);
    prisma.itemBrandMaster.findFirst.mockResolvedValueOnce(refreshedRecord);

    const input: SaveItemBrandDto = {
      brand_name: 'Acme',
      brand_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    };

    await service.save(input);

    expect(prisma.itemBrandMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemBrandMaster.create.mock.calls[0][0];
    expect(createArgs.data.brand_photo).toEqual(new Uint8Array(Buffer.from('sample-image')));
  });
});
