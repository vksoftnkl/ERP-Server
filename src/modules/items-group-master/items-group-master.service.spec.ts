import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemsGroupMasterService } from './items-group-master.service';

const ITEM_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';

type PrismaMock = {
  itemGroupMaster: {
    create: jest.Mock<Promise<ItemGroupMaster>, [Prisma.ItemGroupMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemGroupMaster | null>, [Prisma.ItemGroupMasterFindFirstArgs]>;
    findMany: jest.Mock<Promise<ItemGroupMaster[]>, [Prisma.ItemGroupMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemGroupMasterCountArgs]>;
    update: jest.Mock<Promise<ItemGroupMaster>, [Prisma.ItemGroupMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemGroupMasterUpdateManyArgs]>;
  };
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
    };

    service = new ItemsGroupMasterService(prisma as unknown as PrismaService);
  });

  it('creates an item group when itg_id is not provided', async () => {
    prisma.itemGroupMaster.create.mockResolvedValue(makeRecord());

    const input: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
    };

    const result = await service.save(input);

    expect(prisma.itemGroupMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemGroupMaster.create.mock.calls[0][0];
    expect(createArgs.data.itgName).toBe('Raw Materials');
    expect(result.itg_id).toBe(ITEM_GROUP_ID);
  });

  it('updates an item group when itg_id is provided', async () => {
    prisma.itemGroupMaster.findFirst.mockResolvedValue(makeRecord());
    prisma.itemGroupMaster.update.mockResolvedValue(makeRecord({ itgName: 'Updated Group' }));

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

  it('soft deletes item groups instead of physical removal', async () => {
    prisma.itemGroupMaster.updateMany.mockResolvedValue({ count: 1 });

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
  });

  it('rejects invalid base64 image input', async () => {
    const input: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
      itg_photo: 'not-valid-base64',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores valid base64 image input into itgPhoto bytes', async () => {
    prisma.itemGroupMaster.create.mockResolvedValue(
      makeRecord({ itgPhoto: Buffer.from('sample-image') }),
    );

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
