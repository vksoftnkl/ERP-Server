import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemBrandMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemBrandQueryDto } from './dto/list-item-brand-query.dto';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemsBrandMasterService } from './items-brand-master.service';

const BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';

type PrismaMock = {
  itemBrandMaster: {
    create: jest.Mock<Promise<ItemBrandMaster>, [Prisma.ItemBrandMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemBrandMaster | null>, [Prisma.ItemBrandMasterFindFirstArgs]>;
    findMany: jest.Mock<Promise<ItemBrandMaster[]>, [Prisma.ItemBrandMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemBrandMasterCountArgs]>;
    update: jest.Mock<Promise<ItemBrandMaster>, [Prisma.ItemBrandMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemBrandMasterUpdateManyArgs]>;
  };
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
    };

    service = new ItemsBrandMasterService(prisma as unknown as PrismaService);
  });

  it('creates an item brand when brand_id is not provided', async () => {
    prisma.itemBrandMaster.create.mockResolvedValue(makeRecord());

    const input: SaveItemBrandDto = {
      brand_name: 'Acme',
    };

    const result = await service.save(input);

    expect(prisma.itemBrandMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemBrandMaster.create.mock.calls[0][0];
    expect(createArgs.data.brand_name).toBe('Acme');
    expect(result.brand_id).toBe(BRAND_ID);
  });

  it('updates an item brand when brand_id is provided', async () => {
    prisma.itemBrandMaster.findFirst.mockResolvedValue(makeRecord());
    prisma.itemBrandMaster.update.mockResolvedValue(makeRecord({ brand_name: 'Updated Brand' }));

    const input: SaveItemBrandDto = {
      brand_id: BRAND_ID,
      brand_name: 'Updated Brand',
    };

    const result = await service.save(input);

    expect(prisma.itemBrandMaster.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.itemBrandMaster.update.mock.calls[0][0];
    expect(updateArgs.where.brand_id).toBe(BRAND_ID);
    expect(updateArgs.data.brand_name).toBe('Updated Brand');
    expect(updateArgs.data.brand_modified_by).toBe('system');
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

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.itemBrandMaster.findFirst.mockResolvedValue(null);

    await expect(service.getById(BRAND_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.itemBrandMaster.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.itemBrandMaster.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.brand_id).toBe(BRAND_ID);
    expect(findFirstArgs.where?.brand_is_deleted).toBe(false);
  });

  it('excludes deleted rows in list', async () => {
    prisma.itemBrandMaster.count.mockResolvedValue(1);
    prisma.itemBrandMaster.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemBrandQueryDto = {};

    await service.list(query);

    expect(prisma.itemBrandMaster.count).toHaveBeenCalledTimes(1);
    const countArgs = prisma.itemBrandMaster.count.mock.calls[0][0];
    expect(countArgs.where?.brand_is_deleted).toBe(false);
  });

  it('applies pagination and search filters correctly', async () => {
    prisma.itemBrandMaster.count.mockResolvedValue(35);
    prisma.itemBrandMaster.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemBrandQueryDto = {
      brand_is_active: true,
      search: 'ac',
      page: 2,
      limit: 10,
    };

    const result = await service.list(query);

    expect(prisma.itemBrandMaster.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.itemBrandMaster.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.where?.brand_is_deleted).toBe(false);
    expect(findManyArgs.where?.brand_is_active).toBe(true);
    expect(findManyArgs.where?.OR).toEqual([
      { brand_name: { contains: 'ac', mode: 'insensitive' } },
      { brand_alias: { contains: 'ac', mode: 'insensitive' } },
      { brand_description: { contains: 'ac', mode: 'insensitive' } },
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      total_pages: 4,
    });
  });

  it('soft deletes item brands instead of physical removal', async () => {
    prisma.itemBrandMaster.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.softDelete(BRAND_ID)).resolves.toEqual({
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
    expect(updateManyArgs.data.brand_modified_by).toBe('system');
  });

  it('rejects invalid base64 image input', async () => {
    const input: SaveItemBrandDto = {
      brand_name: 'Acme',
      brand_photo: 'not-valid-base64',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores valid base64 image input into brand_photo bytes', async () => {
    prisma.itemBrandMaster.create.mockResolvedValue(
      makeRecord({ brand_photo: Buffer.from('sample-image') }),
    );

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
