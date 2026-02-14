import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemSectionMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemSectionQueryDto } from './dto/list-item-section-query.dto';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemsSectionMasterService } from './items-section-master.service';

const ITEM_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const PARENT_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45680';
const COMPANY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45681';
const OTHER_COMPANY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45682';

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
    updateMany: jest.Mock<
      Promise<Prisma.BatchPayload>,
      [Prisma.ItemSectionMasterUpdateManyArgs]
    >;
  };
};

const makeRecord = (overrides: Partial<ItemSectionMaster> = {}): ItemSectionMaster =>
  ({
    secId: ITEM_SECTION_ID,
    secName: 'Dairy',
    secAlias: 'DAI',
    secShort: 'DRY',
    secDescription: 'Dairy section',
    secCompanyId: COMPANY_ID,
    secParentId: null,
    secSort: 1,
    secLevel: 0,
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

  beforeEach(() => {
    prisma = {
      itemSectionMaster: {
        create: jest.fn<Promise<ItemSectionMaster>, [Prisma.ItemSectionMasterCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemSectionMaster | null>,
          [Prisma.ItemSectionMasterFindFirstArgs]
        >(),
        findMany: jest.fn<
          Promise<ItemSectionMaster[]>,
          [Prisma.ItemSectionMasterFindManyArgs]
        >(),
        count: jest.fn<Promise<number>, [Prisma.ItemSectionMasterCountArgs]>(),
        update: jest.fn<Promise<ItemSectionMaster>, [Prisma.ItemSectionMasterUpdateArgs]>(),
        updateMany: jest.fn<
          Promise<Prisma.BatchPayload>,
          [Prisma.ItemSectionMasterUpdateManyArgs]
        >(),
      },
    };

    service = new ItemsSectionMasterService(prisma as unknown as PrismaService);
  });

  it('creates an item section when sec_id is not provided', async () => {
    prisma.itemSectionMaster.create.mockResolvedValue(makeRecord());

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_company_id: COMPANY_ID,
    };

    const result = await service.save(input);

    expect(prisma.itemSectionMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemSectionMaster.create.mock.calls[0][0];
    expect(createArgs.data.secName).toBe('Dairy');
    expect(createArgs.data.secCompanyId).toBe(COMPANY_ID);
    expect(result.sec_id).toBe(ITEM_SECTION_ID);
  });

  it('updates an item section when sec_id is provided', async () => {
    prisma.itemSectionMaster.findFirst.mockResolvedValue(makeRecord());
    prisma.itemSectionMaster.update.mockResolvedValue(makeRecord({ secName: 'Updated Section' }));

    const input: SaveItemSectionDto = {
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Updated Section',
      sec_company_id: COMPANY_ID,
    };

    const result = await service.save(input);

    expect(prisma.itemSectionMaster.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.itemSectionMaster.update.mock.calls[0][0];
    expect(updateArgs.where.secId).toBe(ITEM_SECTION_ID);
    expect(updateArgs.data.secName).toBe('Updated Section');
    expect(updateArgs.data.secCompanyId).toBe(COMPANY_ID);
    expect(updateArgs.data.secModifiedBy).toBe('system');
    expect(result.sec_name).toBe('Updated Section');
  });

  it('rejects duplicate name with 409', async () => {
    prisma.itemSectionMaster.create.mockRejectedValue({ code: 'P2002' });

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_company_id: COMPANY_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects self-parent updates', async () => {
    prisma.itemSectionMaster.findFirst.mockResolvedValue(makeRecord());

    const input: SaveItemSectionDto = {
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Dairy',
      sec_company_id: COMPANY_ID,
      sec_parent_id: ITEM_SECTION_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects parent section from another company', async () => {
    prisma.itemSectionMaster.findFirst.mockResolvedValue(
      makeRecord({
        secId: PARENT_SECTION_ID,
        secCompanyId: OTHER_COMPANY_ID,
      }),
    );

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_company_id: COMPANY_ID,
      sec_parent_id: PARENT_SECTION_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.itemSectionMaster.findFirst.mockResolvedValue(null);

    await expect(service.getById(ITEM_SECTION_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.itemSectionMaster.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.itemSectionMaster.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.secId).toBe(ITEM_SECTION_ID);
    expect(findFirstArgs.where?.secIsDeleted).toBe(false);
  });

  it('excludes deleted rows in list', async () => {
    prisma.itemSectionMaster.count.mockResolvedValue(1);
    prisma.itemSectionMaster.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemSectionQueryDto = {};

    await service.list(query);

    expect(prisma.itemSectionMaster.count).toHaveBeenCalledTimes(1);
    const countArgs = prisma.itemSectionMaster.count.mock.calls[0][0];
    expect(countArgs.where?.secIsDeleted).toBe(false);
  });

  it('applies company, pagination, and search filters correctly', async () => {
    prisma.itemSectionMaster.count.mockResolvedValue(35);
    prisma.itemSectionMaster.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemSectionQueryDto = {
      sec_company_id: COMPANY_ID,
      sec_is_active: true,
      search: 'dairy',
      page: 2,
      limit: 10,
    };

    const result = await service.list(query);

    expect(prisma.itemSectionMaster.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.itemSectionMaster.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.where?.secIsDeleted).toBe(false);
    expect(findManyArgs.where?.secCompanyId).toBe(COMPANY_ID);
    expect(findManyArgs.where?.secIsActive).toBe(true);
    expect(findManyArgs.where?.OR).toEqual([
      { secName: { contains: 'dairy', mode: 'insensitive' } },
      { secAlias: { contains: 'dairy', mode: 'insensitive' } },
      { secDescription: { contains: 'dairy', mode: 'insensitive' } },
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      total_pages: 4,
    });
  });

  it('soft deletes item sections instead of physical removal', async () => {
    prisma.itemSectionMaster.updateMany.mockResolvedValue({ count: 1 });

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
  });

  it('rejects invalid base64 image input', async () => {
    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_company_id: COMPANY_ID,
      sec_photo: 'not-valid-base64',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores valid base64 image input into secPhoto bytes', async () => {
    prisma.itemSectionMaster.create.mockResolvedValue(
      makeRecord({ secPhoto: Buffer.from('sample-image') }),
    );

    const input: SaveItemSectionDto = {
      sec_name: 'Dairy',
      sec_company_id: COMPANY_ID,
      sec_photo: 'data:image/png;base64,c2FtcGxlLWltYWdl',
    };

    await service.save(input);

    expect(prisma.itemSectionMaster.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemSectionMaster.create.mock.calls[0][0];
    expect(createArgs.data.secPhoto).toEqual(new Uint8Array(Buffer.from('sample-image')));
  });
});
