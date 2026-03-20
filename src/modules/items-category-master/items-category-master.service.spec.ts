import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { categoryMaster, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemCategoryQueryDto } from './dto/list-item-category-query.dto';
import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import { ItemsCategoryMasterService } from './items-category-master.service';

const ITEM_CATEGORY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const PARENT_CATEGORY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45680';
const GRAND_PARENT_CATEGORY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45681';
const NEW_PARENT_CATEGORY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45682';
const CHILD_CATEGORY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45683';

type PrismaMock = {
  categoryMaster: {
    create: jest.Mock<Promise<categoryMaster>, [Prisma.categoryMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<categoryMaster | null>, [Prisma.categoryMasterFindFirstArgs]>;
    findMany: jest.Mock<Promise<categoryMaster[]>, [Prisma.categoryMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.categoryMasterCountArgs]>;
    update: jest.Mock<Promise<categoryMaster>, [Prisma.categoryMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.categoryMasterUpdateManyArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ConfiguredGridSqlServiceMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
};

const makeRecord = (overrides: Partial<categoryMaster> = {}): categoryMaster =>
  ({
    categoryId: ITEM_CATEGORY_ID,
    categoryName: 'Dairy',
    categoryAlias: 'DAI',
    categoryShort: 'DRY',
    categoryDescription: 'Dairy category',
    categoryParentId: null,
    categorySort: 1,
    categoryLevel: 0,
    categoryPathIdsCache: [],
    categoryTaxClaim: null,
    categoryDefaultTaxId: null,
    categoryDefaultHsn: null,
    categoryDefaultUomId: null,
    categoryPhoto: null,
    categoryPhotoUrl: null,
    categoryIsActive: true,
    categoryIsDeleted: false,
    categorySyncDate: null,
    categoryCreatedOn: new Date('2026-02-12T10:00:00.000Z'),
    categoryCreatedBy: 'tester',
    categoryModifiedOn: new Date('2026-02-12T10:00:00.000Z'),
    categoryModifiedBy: 'tester',
    ...overrides,
  }) as categoryMaster;

describe('ItemsCategoryMasterService', () => {
  let service: ItemsCategoryMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;

  beforeEach(() => {
    prisma = {
      categoryMaster: {
        create: jest.fn<Promise<categoryMaster>, [Prisma.categoryMasterCreateArgs]>(),
        findFirst: jest.fn<Promise<categoryMaster | null>, [Prisma.categoryMasterFindFirstArgs]>(),
        findMany: jest.fn<Promise<categoryMaster[]>, [Prisma.categoryMasterFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.categoryMasterCountArgs]>(),
        update: jest.fn<Promise<categoryMaster>, [Prisma.categoryMasterUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.categoryMasterUpdateManyArgs]>(),
      },
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };

    prisma.categoryMaster.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );
    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };
    configuredGridSqlService = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn().mockImplementation((candidates: unknown[]) => candidates),
      validateBaseSql: jest.fn(),
      runPagedQuery: jest.fn(),
    };

    service = new ItemsCategoryMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
    );
  });

  it('creates a root item category and stores self category_id in category_path_ids_cache', async () => {
    const createdRecord = makeRecord({ categoryPathIdsCache: [] });
    const createdWithPath = makeRecord({ categoryPathIdsCache: [ITEM_CATEGORY_ID] });

    prisma.categoryMaster.create.mockResolvedValue(createdRecord);
    prisma.categoryMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.categoryMaster.update.mockResolvedValueOnce(createdWithPath);
    prisma.categoryMaster.findFirst.mockResolvedValueOnce(createdWithPath);

    const input: SaveItemCategoryDto = {
      category_name: 'Dairy',
    };

    const result = await service.save(input);

    expect(prisma.categoryMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.categoryMaster.create.mock.calls[0][0];
    expect(createArgs.data.categoryName).toBe('Dairy');
    expect(result.category_id).toBe(ITEM_CATEGORY_ID);
    expect(result.category_path_ids_cache).toEqual([ITEM_CATEGORY_ID]);
  });

  it('updates an item category when category_id is provided', async () => {
    const existingRecord = makeRecord({ categoryPathIdsCache: [ITEM_CATEGORY_ID] });
    const updatedRecord = makeRecord({
      categoryName: 'Updated Category',
      categoryPathIdsCache: [ITEM_CATEGORY_ID],
    });

    prisma.categoryMaster.findFirst
      .mockResolvedValueOnce(existingRecord)
      .mockResolvedValueOnce(updatedRecord);
    prisma.categoryMaster.findMany.mockResolvedValueOnce([updatedRecord]);
    prisma.categoryMaster.update.mockResolvedValueOnce(updatedRecord);

    const input: SaveItemCategoryDto = {
      category_id: ITEM_CATEGORY_ID,
      category_name: 'Updated Category',
    };

    const result = await service.save(input);

    expect(prisma.categoryMaster.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.categoryMaster.update.mock.calls[0][0];
    expect(updateArgs.where.categoryId).toBe(ITEM_CATEGORY_ID);
    expect(updateArgs.data.categoryName).toBe('Updated Category');
    expect(updateArgs.data.categoryModifiedBy).toBe('system');
    expect(result.category_name).toBe('Updated Category');
  });

  it('rejects duplicate name with 409', async () => {
    prisma.categoryMaster.create.mockRejectedValue({ code: 'P2002' });

    const input: SaveItemCategoryDto = {
      category_name: 'Dairy',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects self-parent updates', async () => {
    prisma.categoryMaster.findFirst.mockResolvedValue(makeRecord());

    const input: SaveItemCategoryDto = {
      category_id: ITEM_CATEGORY_ID,
      category_name: 'Dairy',
      category_parent_id: ITEM_CATEGORY_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds newly created child id to parent and grandparent caches', async () => {
    const createdChild = makeRecord({
      categoryId: CHILD_CATEGORY_ID,
      categoryName: 'Child Category',
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [],
    });
    const childWithPath = makeRecord({
      categoryId: CHILD_CATEGORY_ID,
      categoryName: 'Child Category',
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [CHILD_CATEGORY_ID],
    });
    const parent = makeRecord({
      categoryId: PARENT_CATEGORY_ID,
      categoryParentId: GRAND_PARENT_CATEGORY_ID,
      categoryPathIdsCache: [PARENT_CATEGORY_ID],
    });
    const grandParent = makeRecord({
      categoryId: GRAND_PARENT_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [GRAND_PARENT_CATEGORY_ID],
    });

    prisma.categoryMaster.create.mockResolvedValue(createdChild);
    prisma.categoryMaster.findFirst
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(grandParent)
      .mockResolvedValueOnce(childWithPath);
    prisma.categoryMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parent, grandParent]);
    prisma.categoryMaster.update
      .mockResolvedValueOnce(childWithPath)
      .mockResolvedValueOnce(
        makeRecord({
          categoryId: PARENT_CATEGORY_ID,
          categoryParentId: GRAND_PARENT_CATEGORY_ID,
          categoryPathIdsCache: [PARENT_CATEGORY_ID, CHILD_CATEGORY_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          categoryId: GRAND_PARENT_CATEGORY_ID,
          categoryParentId: null,
          categoryPathIdsCache: [GRAND_PARENT_CATEGORY_ID, CHILD_CATEGORY_ID],
        }),
      );

    const result = await service.save({
      category_name: 'Child Category',
      category_parent_id: PARENT_CATEGORY_ID,
    });

    expect(result.category_id).toBe(CHILD_CATEGORY_ID);

    const parentUpdateArgs = prisma.categoryMaster.update.mock.calls[1][0];
    expect(parentUpdateArgs.where.categoryId).toBe(PARENT_CATEGORY_ID);
    expect(parentUpdateArgs.data.categoryPathIdsCache).toEqual([
      PARENT_CATEGORY_ID,
      CHILD_CATEGORY_ID,
    ]);

    const grandParentUpdateArgs = prisma.categoryMaster.update.mock.calls[2][0];
    expect(grandParentUpdateArgs.where.categoryId).toBe(GRAND_PARENT_CATEGORY_ID);
    expect(grandParentUpdateArgs.data.categoryPathIdsCache).toEqual([
      GRAND_PARENT_CATEGORY_ID,
      CHILD_CATEGORY_ID,
    ]);
  });

  it('does not duplicate ids when ancestor cache already contains child id', async () => {
    const createdChild = makeRecord({
      categoryId: CHILD_CATEGORY_ID,
      categoryName: 'Child Category',
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [],
    });
    const childWithPath = makeRecord({
      categoryId: CHILD_CATEGORY_ID,
      categoryName: 'Child Category',
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [CHILD_CATEGORY_ID],
    });
    const parentWithChildAlready = makeRecord({
      categoryId: PARENT_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [PARENT_CATEGORY_ID, CHILD_CATEGORY_ID],
    });

    prisma.categoryMaster.create.mockResolvedValue(createdChild);
    prisma.categoryMaster.findFirst
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(childWithPath);
    prisma.categoryMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parentWithChildAlready]);
    prisma.categoryMaster.update.mockResolvedValueOnce(childWithPath);

    await service.save({
      category_name: 'Child Category',
      category_parent_id: PARENT_CATEGORY_ID,
    });

    expect(prisma.categoryMaster.update).toHaveBeenCalledTimes(1);
  });

  it('moves subtree ids from old ancestors to new ancestors on reparent', async () => {
    const existing = makeRecord({
      categoryId: ITEM_CATEGORY_ID,
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [ITEM_CATEGORY_ID, CHILD_CATEGORY_ID],
    });
    const child = makeRecord({
      categoryId: CHILD_CATEGORY_ID,
      categoryParentId: ITEM_CATEGORY_ID,
      categoryPathIdsCache: [CHILD_CATEGORY_ID],
    });
    const updatedWithoutSelf = makeRecord({
      categoryId: ITEM_CATEGORY_ID,
      categoryName: 'Updated Category',
      categoryParentId: NEW_PARENT_CATEGORY_ID,
      categoryPathIdsCache: [CHILD_CATEGORY_ID],
    });
    const refreshedWithSelf = makeRecord({
      categoryId: ITEM_CATEGORY_ID,
      categoryName: 'Updated Category',
      categoryParentId: NEW_PARENT_CATEGORY_ID,
      categoryPathIdsCache: [CHILD_CATEGORY_ID, ITEM_CATEGORY_ID],
    });
    const oldParent = makeRecord({
      categoryId: PARENT_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [PARENT_CATEGORY_ID, ITEM_CATEGORY_ID, CHILD_CATEGORY_ID],
    });
    const newParent = makeRecord({
      categoryId: NEW_PARENT_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [NEW_PARENT_CATEGORY_ID],
    });

    prisma.categoryMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(refreshedWithSelf);
    prisma.categoryMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedWithoutSelf])
      .mockResolvedValueOnce([oldParent])
      .mockResolvedValueOnce([newParent]);
    prisma.categoryMaster.update
      .mockResolvedValueOnce(updatedWithoutSelf)
      .mockResolvedValueOnce(refreshedWithSelf)
      .mockResolvedValueOnce(
        makeRecord({
          categoryId: PARENT_CATEGORY_ID,
          categoryParentId: null,
          categoryPathIdsCache: [PARENT_CATEGORY_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          categoryId: NEW_PARENT_CATEGORY_ID,
          categoryParentId: null,
          categoryPathIdsCache: [NEW_PARENT_CATEGORY_ID, ITEM_CATEGORY_ID, CHILD_CATEGORY_ID],
        }),
      );

    const result = await service.save({
      category_id: ITEM_CATEGORY_ID,
      category_name: 'Updated Category',
      category_parent_id: NEW_PARENT_CATEGORY_ID,
    });

    expect(result.category_parent_id).toBe(NEW_PARENT_CATEGORY_ID);

    const oldParentUpdateArgs = prisma.categoryMaster.update.mock.calls[2][0];
    expect(oldParentUpdateArgs.where.categoryId).toBe(PARENT_CATEGORY_ID);
    expect(oldParentUpdateArgs.data.categoryPathIdsCache).toEqual([PARENT_CATEGORY_ID]);

    const newParentUpdateArgs = prisma.categoryMaster.update.mock.calls[3][0];
    expect(newParentUpdateArgs.where.categoryId).toBe(NEW_PARENT_CATEGORY_ID);
    expect(newParentUpdateArgs.data.categoryPathIdsCache).toEqual([
      NEW_PARENT_CATEGORY_ID,
      ITEM_CATEGORY_ID,
      CHILD_CATEGORY_ID,
    ]);
  });

  it('removes subtree ids from old ancestors when reparented to root', async () => {
    const existing = makeRecord({
      categoryId: ITEM_CATEGORY_ID,
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [ITEM_CATEGORY_ID],
    });
    const refreshed = makeRecord({
      categoryId: ITEM_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [ITEM_CATEGORY_ID],
    });
    const oldParent = makeRecord({
      categoryId: PARENT_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [PARENT_CATEGORY_ID, ITEM_CATEGORY_ID],
    });

    prisma.categoryMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(refreshed);
    prisma.categoryMaster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([refreshed])
      .mockResolvedValueOnce([oldParent]);
    prisma.categoryMaster.update.mockResolvedValueOnce(refreshed).mockResolvedValueOnce(
      makeRecord({
        categoryId: PARENT_CATEGORY_ID,
        categoryParentId: null,
        categoryPathIdsCache: [PARENT_CATEGORY_ID],
      }),
    );

    const result = await service.save({
      category_id: ITEM_CATEGORY_ID,
      category_name: 'Dairy',
      category_parent_id: null,
    });

    expect(result.category_parent_id).toBeNull();
    const oldParentUpdateArgs = prisma.categoryMaster.update.mock.calls[1][0];
    expect(oldParentUpdateArgs.where.categoryId).toBe(PARENT_CATEGORY_ID);
    expect(oldParentUpdateArgs.data.categoryPathIdsCache).toEqual([PARENT_CATEGORY_ID]);
  });

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.categoryMaster.findFirst.mockResolvedValue(null);

    await expect(service.getById(ITEM_CATEGORY_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.categoryMaster.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.categoryMaster.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.categoryId).toBe(ITEM_CATEGORY_ID);
    expect(findFirstArgs.where?.categoryIsDeleted).toBe(false);
  });

  it('excludes deleted rows in list', async () => {
    prisma.categoryMaster.count.mockResolvedValue(1);
    prisma.categoryMaster.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemCategoryQueryDto = {};

    const result = await service.list(query);

    expect(prisma.categoryMaster.count).toHaveBeenCalledTimes(1);
    const countArgs = prisma.categoryMaster.count.mock.calls[0][0];
    expect(countArgs.where?.categoryIsDeleted).toBe(false);
    expect(result.items).toEqual([
      {
        category_id: ITEM_CATEGORY_ID,
        category_name: 'Dairy',
      },
    ]);
  });

  it('applies pagination and search filters correctly', async () => {
    prisma.categoryMaster.count.mockResolvedValue(35);
    prisma.categoryMaster.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemCategoryQueryDto = {
      category_is_active: true,
      search: 'dairy',
      page: 2,
      limit: 10,
    };

    const result = await service.list(query);

    expect(prisma.categoryMaster.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.categoryMaster.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.where?.categoryIsDeleted).toBe(false);
    expect(findManyArgs.where?.categoryIsActive).toBe(true);
    expect(findManyArgs.where?.OR).toEqual([
      { categoryName: { contains: 'dairy', mode: 'insensitive' } },
      { categoryAlias: { contains: 'dairy', mode: 'insensitive' } },
      { categoryDescription: { contains: 'dairy', mode: 'insensitive' } },
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      total_pages: 4,
    });
    expect(result.items).toEqual([
      {
        category_id: ITEM_CATEGORY_ID,
        category_name: 'Dairy',
      },
    ]);
  });

  it('soft delete removes subtree ids from ancestor caches', async () => {
    const parent = makeRecord({
      categoryId: PARENT_CATEGORY_ID,
      categoryParentId: null,
      categoryPathIdsCache: [PARENT_CATEGORY_ID, ITEM_CATEGORY_ID, CHILD_CATEGORY_ID],
    });
    const node = makeRecord({
      categoryId: ITEM_CATEGORY_ID,
      categoryParentId: PARENT_CATEGORY_ID,
      categoryPathIdsCache: [ITEM_CATEGORY_ID, CHILD_CATEGORY_ID],
    });
    const child = makeRecord({
      categoryId: CHILD_CATEGORY_ID,
      categoryParentId: ITEM_CATEGORY_ID,
      categoryPathIdsCache: [CHILD_CATEGORY_ID],
    });

    prisma.categoryMaster.findFirst
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent);
    prisma.categoryMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([parent]);
    prisma.categoryMaster.updateMany.mockResolvedValue({ count: 1 });
    prisma.categoryMaster.update.mockResolvedValueOnce(
      makeRecord({
        categoryId: PARENT_CATEGORY_ID,
        categoryParentId: null,
        categoryPathIdsCache: [PARENT_CATEGORY_ID],
      }),
    );

    await expect(service.softDelete(ITEM_CATEGORY_ID)).resolves.toEqual({
      category_id: ITEM_CATEGORY_ID,
      deleted: true,
    });

    expect(prisma.categoryMaster.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.categoryMaster.updateMany.mock.calls[0][0];
    if (!updateManyArgs.where) {
      throw new Error('Expected updateMany where clause');
    }
    expect(updateManyArgs.where.categoryId).toBe(ITEM_CATEGORY_ID);
    expect(updateManyArgs.where.categoryIsDeleted).toBe(false);
    expect(updateManyArgs.data.categoryIsDeleted).toBe(true);
    expect(updateManyArgs.data.categoryModifiedBy).toBe('system');

    expect(prisma.categoryMaster.update).toHaveBeenCalledTimes(1);
    const ancestorUpdateArgs = prisma.categoryMaster.update.mock.calls[0][0];
    expect(ancestorUpdateArgs.where.categoryId).toBe(PARENT_CATEGORY_ID);
    expect(ancestorUpdateArgs.data.categoryPathIdsCache).toEqual([PARENT_CATEGORY_ID]);
  });

  it('rejects invalid base64 image input', async () => {
    const input: SaveItemCategoryDto = {
      category_name: 'Dairy',
      category_photo: 'not-valid-base64',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores valid base64 image input into categoryPhoto bytes', async () => {
    const createdRecord = makeRecord({
      categoryPhoto: Buffer.from('sample-image'),
      categoryPathIdsCache: [],
    });
    const refreshedRecord = makeRecord({
      categoryPhoto: Buffer.from('sample-image'),
      categoryPathIdsCache: [ITEM_CATEGORY_ID],
    });
    prisma.categoryMaster.create.mockResolvedValue(createdRecord);
    prisma.categoryMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.categoryMaster.update.mockResolvedValueOnce(refreshedRecord);
    prisma.categoryMaster.findFirst.mockResolvedValueOnce(refreshedRecord);

    const input: SaveItemCategoryDto = {
      category_name: 'Dairy',
      category_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    };

    await service.save(input);

    expect(prisma.categoryMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.categoryMaster.create.mock.calls[0][0];
    expect(createArgs.data.categoryPhoto).toEqual(new Uint8Array(Buffer.from('sample-image')));
  });
});
