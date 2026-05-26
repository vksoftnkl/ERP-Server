import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemSectionMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemsSectionMasterService } from './items-section-master.service';

const ITEM_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const PARENT_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45680';
const GRAND_PARENT_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45681';
const NEW_PARENT_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45682';
const CHILD_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45683';

type PrismaMock = {
  itemSectionMaster: {
    create: jest.Mock<Promise<ItemSectionMaster>, [Prisma.ItemSectionMasterCreateArgs]>;
    findFirst: jest.Mock<
      Promise<ItemSectionMaster | null>,
      [Prisma.ItemSectionMasterFindFirstArgs]
    >;
    findMany: jest.Mock<Promise<ItemSectionMaster[]>, [Prisma.ItemSectionMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemSectionMasterCountArgs]>;
    update: jest.Mock<Promise<ItemSectionMaster>, [Prisma.ItemSectionMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemSectionMasterUpdateManyArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ConfiguredGridSqlServiceMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
};

const makeRecord = (overrides: Partial<ItemSectionMaster> = {}): ItemSectionMaster =>
  ({
    secId: ITEM_SECTION_ID,
    secName: 'Dairy',
    secAlias: 'DAI',
    secShort: 'DRY',
    secDescription: 'Dairy section',
    secParentId: null,
    secSort: 1,
    secLevel: 1,
    secPathIds: [],
    secPosition: 1,
    secColorCode: '#FFFFFF',
    secIcon: 'milk',
    secPhoto: null,
    secPhotoUrl: null,
    secIsActive: true,
    secIsDeleted: false,
    secSyncDate: null,
    secCreatedOn: new Date('2026-02-12T10:00:00.000Z'),
    secCreatedBy: 'tester',
    secModifiedOn: new Date('2026-02-12T10:00:00.000Z'),
    secModifiedBy: 'tester',
    ...overrides,
  }) as ItemSectionMaster;

describe('ItemsSectionMasterService', () => {
  let service: ItemsSectionMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;

  beforeEach(() => {
    prisma = {
      itemSectionMaster: {
        create: jest.fn<Promise<ItemSectionMaster>, [Prisma.ItemSectionMasterCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemSectionMaster | null>,
          [Prisma.ItemSectionMasterFindFirstArgs]
        >(),
        findMany: jest.fn<Promise<ItemSectionMaster[]>, [Prisma.ItemSectionMasterFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.ItemSectionMasterCountArgs]>(),
        update: jest.fn<Promise<ItemSectionMaster>, [Prisma.ItemSectionMasterUpdateArgs]>(),
        updateMany: jest.fn<
          Promise<Prisma.BatchPayload>,
          [Prisma.ItemSectionMasterUpdateManyArgs]
        >(),
      },
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };

    prisma.itemSectionMaster.findMany.mockResolvedValue([]);
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

    service = new ItemsSectionMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
    );
  });

  it('creates a root item section and stores self sec_id in sec_path_ids', async () => {
    const createdRecord = makeRecord({ secPathIds: [] });
    const createdWithPath = makeRecord({ secPathIds: [ITEM_SECTION_ID] });

    prisma.itemSectionMaster.create.mockResolvedValue(createdRecord);
    prisma.itemSectionMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemSectionMaster.update.mockResolvedValueOnce(createdWithPath);
    prisma.itemSectionMaster.findFirst.mockResolvedValueOnce(createdWithPath);

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_level: 999,
    };

    const result = await service.save(input);

    expect(prisma.itemSectionMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemSectionMaster.create.mock.calls[0][0];
    expect(createArgs.data.secName).toBe('Dairy');
    expect(createArgs.data.secLevel).toBe(1);
    expect(result.sec_id).toBe(ITEM_SECTION_ID);
    expect(result.sec_path_ids).toEqual([ITEM_SECTION_ID]);
  });

  it('updates an item section when sec_id is provided', async () => {
    const existingRecord = makeRecord({ secPathIds: [ITEM_SECTION_ID] });
    const updatedRecord = makeRecord({
      secName: 'Updated Section',
      secPathIds: [ITEM_SECTION_ID],
    });

    prisma.itemSectionMaster.findFirst
      .mockResolvedValueOnce(existingRecord)
      .mockResolvedValueOnce(updatedRecord);
    prisma.itemSectionMaster.findMany.mockResolvedValueOnce([updatedRecord]);
    prisma.itemSectionMaster.update.mockResolvedValueOnce(updatedRecord);

    const input: SaveItemSectionDto = {
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Updated Section',
    };

    const result = await service.save(input);

    expect(prisma.itemSectionMaster.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.itemSectionMaster.update.mock.calls[0][0];
    expect(updateArgs.where.secId).toBe(ITEM_SECTION_ID);
    expect(updateArgs.data.secName).toBe('Updated Section');
    expect(updateArgs.data.secModifiedBy).toBe('system');
    expect(result.sec_name).toBe('Updated Section');
  });

  it('rejects duplicate name with 409', async () => {
    prisma.itemSectionMaster.create.mockRejectedValue({ code: 'P2002' });

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects self-parent updates', async () => {
    prisma.itemSectionMaster.findFirst.mockResolvedValue(makeRecord());

    const input: SaveItemSectionDto = {
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Dairy',
      sec_parent_id: ITEM_SECTION_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds newly created child id to parent and grandparent caches', async () => {
    const createdChild = makeRecord({
      secId: CHILD_SECTION_ID,
      secName: 'Child Section',
      secParentId: PARENT_SECTION_ID,
      secPathIds: [],
    });
    const childWithPath = makeRecord({
      secId: CHILD_SECTION_ID,
      secName: 'Child Section',
      secParentId: PARENT_SECTION_ID,
      secPathIds: [CHILD_SECTION_ID],
    });
    const parent = makeRecord({
      secId: PARENT_SECTION_ID,
      secParentId: GRAND_PARENT_SECTION_ID,
      secPathIds: [PARENT_SECTION_ID],
    });
    const grandParent = makeRecord({
      secId: GRAND_PARENT_SECTION_ID,
      secParentId: null,
      secPathIds: [GRAND_PARENT_SECTION_ID],
    });

    prisma.itemSectionMaster.create.mockResolvedValue(createdChild);
    prisma.itemSectionMaster.findFirst
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(grandParent)
      .mockResolvedValueOnce(childWithPath);
    prisma.itemSectionMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parent, grandParent]);
    prisma.itemSectionMaster.update
      .mockResolvedValueOnce(childWithPath)
      .mockResolvedValueOnce(
        makeRecord({
          secId: PARENT_SECTION_ID,
          secParentId: GRAND_PARENT_SECTION_ID,
          secPathIds: [PARENT_SECTION_ID, CHILD_SECTION_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          secId: GRAND_PARENT_SECTION_ID,
          secParentId: null,
          secPathIds: [GRAND_PARENT_SECTION_ID, CHILD_SECTION_ID],
        }),
      );

    const result = await service.save({
      sec_name: 'Child Section',
      sec_parent_id: PARENT_SECTION_ID,
    });

    const createArgs = prisma.itemSectionMaster.create.mock.calls[0][0];
    expect(createArgs.data.secLevel).toBe(2);
    expect(result.sec_id).toBe(CHILD_SECTION_ID);

    const parentUpdateArgs = prisma.itemSectionMaster.update.mock.calls[1][0];
    expect(parentUpdateArgs.where.secId).toBe(PARENT_SECTION_ID);
    expect(parentUpdateArgs.data.secPathIds).toEqual([PARENT_SECTION_ID, CHILD_SECTION_ID]);

    const grandParentUpdateArgs = prisma.itemSectionMaster.update.mock.calls[2][0];
    expect(grandParentUpdateArgs.where.secId).toBe(GRAND_PARENT_SECTION_ID);
    expect(grandParentUpdateArgs.data.secPathIds).toEqual([
      GRAND_PARENT_SECTION_ID,
      CHILD_SECTION_ID,
    ]);
  });

  it('does not duplicate ids when ancestor cache already contains child id', async () => {
    const createdChild = makeRecord({
      secId: CHILD_SECTION_ID,
      secName: 'Child Section',
      secParentId: PARENT_SECTION_ID,
      secPathIds: [],
    });
    const childWithPath = makeRecord({
      secId: CHILD_SECTION_ID,
      secName: 'Child Section',
      secParentId: PARENT_SECTION_ID,
      secPathIds: [CHILD_SECTION_ID],
    });
    const parentWithChildAlready = makeRecord({
      secId: PARENT_SECTION_ID,
      secParentId: null,
      secPathIds: [PARENT_SECTION_ID, CHILD_SECTION_ID],
    });

    prisma.itemSectionMaster.create.mockResolvedValue(createdChild);
    prisma.itemSectionMaster.findFirst
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(parentWithChildAlready)
      .mockResolvedValueOnce(childWithPath);
    prisma.itemSectionMaster.findMany
      .mockResolvedValueOnce([createdChild])
      .mockResolvedValueOnce([parentWithChildAlready]);
    prisma.itemSectionMaster.update.mockResolvedValueOnce(childWithPath);

    await service.save({
      sec_name: 'Child Section',
      sec_parent_id: PARENT_SECTION_ID,
    });

    expect(prisma.itemSectionMaster.update).toHaveBeenCalledTimes(1);
  });

  it('moves subtree ids from old ancestors to new ancestors on reparent', async () => {
    const existing = makeRecord({
      secId: ITEM_SECTION_ID,
      secParentId: PARENT_SECTION_ID,
      secPathIds: [ITEM_SECTION_ID, CHILD_SECTION_ID],
    });
    const child = makeRecord({
      secId: CHILD_SECTION_ID,
      secParentId: ITEM_SECTION_ID,
      secPathIds: [CHILD_SECTION_ID],
    });
    const updatedWithoutSelf = makeRecord({
      secId: ITEM_SECTION_ID,
      secName: 'Updated Section',
      secParentId: NEW_PARENT_SECTION_ID,
      secPathIds: [CHILD_SECTION_ID],
    });
    const refreshedWithSelf = makeRecord({
      secId: ITEM_SECTION_ID,
      secName: 'Updated Section',
      secParentId: NEW_PARENT_SECTION_ID,
      secPathIds: [CHILD_SECTION_ID, ITEM_SECTION_ID],
    });
    const oldParent = makeRecord({
      secId: PARENT_SECTION_ID,
      secParentId: null,
      secPathIds: [PARENT_SECTION_ID, ITEM_SECTION_ID, CHILD_SECTION_ID],
    });
    const newParent = makeRecord({
      secId: NEW_PARENT_SECTION_ID,
      secParentId: null,
      secPathIds: [NEW_PARENT_SECTION_ID],
    });

    prisma.itemSectionMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(newParent)
      .mockResolvedValueOnce(refreshedWithSelf);
    prisma.itemSectionMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedWithoutSelf])
      .mockResolvedValueOnce([oldParent])
      .mockResolvedValueOnce([newParent]);
    prisma.itemSectionMaster.update
      .mockResolvedValueOnce(updatedWithoutSelf)
      .mockResolvedValueOnce(refreshedWithSelf)
      .mockResolvedValueOnce(
        makeRecord({
          secId: PARENT_SECTION_ID,
          secParentId: null,
          secPathIds: [PARENT_SECTION_ID],
        }),
      )
      .mockResolvedValueOnce(
        makeRecord({
          secId: NEW_PARENT_SECTION_ID,
          secParentId: null,
          secPathIds: [NEW_PARENT_SECTION_ID, ITEM_SECTION_ID, CHILD_SECTION_ID],
        }),
      );

    const result = await service.save({
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Updated Section',
      sec_parent_id: NEW_PARENT_SECTION_ID,
    });

    const updateArgs = prisma.itemSectionMaster.update.mock.calls[0][0];
    expect(updateArgs.data.secLevel).toBe(2);
    expect(result.sec_parent_id).toBe(NEW_PARENT_SECTION_ID);

    const oldParentUpdateArgs = prisma.itemSectionMaster.update.mock.calls[2][0];
    expect(oldParentUpdateArgs.where.secId).toBe(PARENT_SECTION_ID);
    expect(oldParentUpdateArgs.data.secPathIds).toEqual([PARENT_SECTION_ID]);

    const newParentUpdateArgs = prisma.itemSectionMaster.update.mock.calls[3][0];
    expect(newParentUpdateArgs.where.secId).toBe(NEW_PARENT_SECTION_ID);
    expect(newParentUpdateArgs.data.secPathIds).toEqual([
      NEW_PARENT_SECTION_ID,
      ITEM_SECTION_ID,
      CHILD_SECTION_ID,
    ]);
  });

  it('removes subtree ids from old ancestors when reparented to root', async () => {
    const existing = makeRecord({
      secId: ITEM_SECTION_ID,
      secParentId: PARENT_SECTION_ID,
      secPathIds: [ITEM_SECTION_ID],
    });
    const refreshed = makeRecord({
      secId: ITEM_SECTION_ID,
      secParentId: null,
      secPathIds: [ITEM_SECTION_ID],
    });
    const oldParent = makeRecord({
      secId: PARENT_SECTION_ID,
      secParentId: null,
      secPathIds: [PARENT_SECTION_ID, ITEM_SECTION_ID],
    });

    prisma.itemSectionMaster.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(oldParent)
      .mockResolvedValueOnce(refreshed);
    prisma.itemSectionMaster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([refreshed])
      .mockResolvedValueOnce([oldParent]);
    prisma.itemSectionMaster.update.mockResolvedValueOnce(refreshed).mockResolvedValueOnce(
      makeRecord({
        secId: PARENT_SECTION_ID,
        secParentId: null,
        secPathIds: [PARENT_SECTION_ID],
      }),
    );

    const result = await service.save({
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Dairy',
      sec_parent_id: null,
    });

    const updateArgs = prisma.itemSectionMaster.update.mock.calls[0][0];
    expect(updateArgs.data.secLevel).toBe(1);
    expect(result.sec_parent_id).toBeNull();
    const oldParentUpdateArgs = prisma.itemSectionMaster.update.mock.calls[1][0];
    expect(oldParentUpdateArgs.where.secId).toBe(PARENT_SECTION_ID);
    expect(oldParentUpdateArgs.data.secPathIds).toEqual([PARENT_SECTION_ID]);
  });

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.itemSectionMaster.findFirst.mockResolvedValue(null);

    await expect(service.getById(ITEM_SECTION_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.itemSectionMaster.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.itemSectionMaster.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.secId).toBe(ITEM_SECTION_ID);
    expect(findFirstArgs.where?.secIsDeleted).toBe(false);
  });
  it('soft delete removes subtree ids from ancestor caches', async () => {
    const parent = makeRecord({
      secId: PARENT_SECTION_ID,
      secParentId: null,
      secPathIds: [PARENT_SECTION_ID, ITEM_SECTION_ID, CHILD_SECTION_ID],
    });
    const node = makeRecord({
      secId: ITEM_SECTION_ID,
      secParentId: PARENT_SECTION_ID,
      secPathIds: [ITEM_SECTION_ID, CHILD_SECTION_ID],
    });
    const child = makeRecord({
      secId: CHILD_SECTION_ID,
      secParentId: ITEM_SECTION_ID,
      secPathIds: [CHILD_SECTION_ID],
    });

    prisma.itemSectionMaster.findFirst
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent);
    prisma.itemSectionMaster.findMany
      .mockResolvedValueOnce([child])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([parent]);
    prisma.itemSectionMaster.updateMany.mockResolvedValue({ count: 1 });
    prisma.itemSectionMaster.update.mockResolvedValueOnce(
      makeRecord({
        secId: PARENT_SECTION_ID,
        secParentId: null,
        secPathIds: [PARENT_SECTION_ID],
      }),
    );

    await expect(service.softDelete(ITEM_SECTION_ID)).resolves.toEqual({
      sec_id: ITEM_SECTION_ID,
      deleted: true,
    });

    expect(prisma.itemSectionMaster.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.itemSectionMaster.updateMany.mock.calls[0][0];
    if (!updateManyArgs.where) {
      throw new Error('Expected updateMany where clause');
    }
    expect(updateManyArgs.where.secId).toBe(ITEM_SECTION_ID);
    expect(updateManyArgs.where.secIsDeleted).toBe(false);
    expect(updateManyArgs.data.secIsDeleted).toBe(true);
    expect(updateManyArgs.data.secModifiedBy).toBe('system');

    expect(prisma.itemSectionMaster.update).toHaveBeenCalledTimes(1);
    const ancestorUpdateArgs = prisma.itemSectionMaster.update.mock.calls[0][0];
    expect(ancestorUpdateArgs.where.secId).toBe(PARENT_SECTION_ID);
    expect(ancestorUpdateArgs.data.secPathIds).toEqual([PARENT_SECTION_ID]);
  });

  it('rejects invalid base64 image input', async () => {
    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_photo: 'not-valid-base64',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores valid base64 image input into secPhoto bytes', async () => {
    const createdRecord = makeRecord({ secPhoto: Buffer.from('sample-image'), secPathIds: [] });
    const refreshedRecord = makeRecord({
      secPhoto: Buffer.from('sample-image'),
      secPathIds: [ITEM_SECTION_ID],
    });
    prisma.itemSectionMaster.create.mockResolvedValue(createdRecord);
    prisma.itemSectionMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemSectionMaster.update.mockResolvedValueOnce(refreshedRecord);
    prisma.itemSectionMaster.findFirst.mockResolvedValueOnce(refreshedRecord);

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    };

    await service.save(input);

    expect(prisma.itemSectionMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemSectionMaster.create.mock.calls[0][0];
    expect(createArgs.data.secPhoto).toEqual(new Uint8Array(Buffer.from('sample-image')));
  });

  it('stores raw photo bytes into secPhoto without base64 conversion', async () => {
    const rawPhoto = Buffer.from('sample-image');
    const createdRecord = makeRecord({ secPhoto: rawPhoto, secPathIds: [] });
    const refreshedRecord = makeRecord({ secPhoto: rawPhoto, secPathIds: [ITEM_SECTION_ID] });
    prisma.itemSectionMaster.create.mockResolvedValue(createdRecord);
    prisma.itemSectionMaster.findMany.mockResolvedValueOnce([createdRecord]);
    prisma.itemSectionMaster.update.mockResolvedValueOnce(refreshedRecord);
    prisma.itemSectionMaster.findFirst.mockResolvedValueOnce(refreshedRecord);

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_photo: rawPhoto,
    };

    await service.save(input);

    expect(prisma.itemSectionMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemSectionMaster.create.mock.calls[0][0];
    expect(createArgs.data.secPhoto).toEqual(new Uint8Array(rawPhoto));
  });
});
