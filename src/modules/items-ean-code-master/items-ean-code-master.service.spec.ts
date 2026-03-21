import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemEanCode, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ListItemEanCodeQueryDto } from './dto/list-item-ean-code-query.dto';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import { ItemsEanCodeMasterService } from './items-ean-code-master.service';

const EAN_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';

type PrismaMock = {
  itemEanCode: {
    create: jest.Mock<Promise<ItemEanCode>, [Prisma.ItemEanCodeCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemEanCode | null>, [Prisma.ItemEanCodeFindFirstArgs]>;
    findMany: jest.Mock<Promise<ItemEanCode[]>, [Prisma.ItemEanCodeFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemEanCodeCountArgs]>;
    update: jest.Mock<Promise<ItemEanCode>, [Prisma.ItemEanCodeUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemEanCodeUpdateManyArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

const makeRecord = (overrides: Partial<ItemEanCode> = {}): ItemEanCode =>
  ({
    eanId: EAN_ID,
    eanItemId: ITEM_ID,
    eanUnitId: UNIT_ID,
    eanCode: '8901234567890',
    eanGodownId: null,
    eanIsDefault: false,
    eanIsActive: true,
    eanIsDeleted: false,
    eanCreatedOn: new Date('2026-02-20T10:00:00.000Z'),
    eanCreatedBy: 'tester',
    eanModifiedOn: new Date('2026-02-20T10:00:00.000Z'),
    eanModifiedBy: 'tester',
    eanRemarks: null,
    ...overrides,
  }) as ItemEanCode;

describe('ItemsEanCodeMasterService', () => {
  let service: ItemsEanCodeMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: Pick<
    ConfiguredGridSqlService,
    'loadCandidates' | 'filterPrimaryFromTable'
  >;

  beforeEach(() => {
    prisma = {
      itemEanCode: {
        create: jest.fn<Promise<ItemEanCode>, [Prisma.ItemEanCodeCreateArgs]>(),
        findFirst: jest.fn<Promise<ItemEanCode | null>, [Prisma.ItemEanCodeFindFirstArgs]>(),
        findMany: jest.fn<Promise<ItemEanCode[]>, [Prisma.ItemEanCodeFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.ItemEanCodeCountArgs]>(),
        update: jest.fn<Promise<ItemEanCode>, [Prisma.ItemEanCodeUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.ItemEanCodeUpdateManyArgs]>(),
      },
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );
    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };
    configuredGridSqlService = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn().mockReturnValue([]),
    };

    service = new ItemsEanCodeMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as ConfiguredGridSqlService,
    );
  });

  it('creates an item ean code row', async () => {
    const createdRecord = makeRecord();
    prisma.itemEanCode.create.mockResolvedValue(createdRecord);

    const input: SaveItemEanCodeDto = {
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901234567890',
    };

    const result = await service.save(input);

    expect(prisma.itemEanCode.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.itemEanCode.create.mock.calls[0][0];
    expect(createArgs.data.eanItemId).toBe(ITEM_ID);
    expect(createArgs.data.eanUnitId).toBe(UNIT_ID);
    expect(createArgs.data.eanCode).toBe('8901234567890');
    expect(result.ean_id).toBe(EAN_ID);
  });

  it('updates an item ean code row when ean_id is provided', async () => {
    const existingRecord = makeRecord();
    const updatedRecord = makeRecord({ eanCode: '8901111111111' });

    prisma.itemEanCode.findFirst.mockResolvedValue(existingRecord);
    prisma.itemEanCode.update.mockResolvedValue(updatedRecord);

    const input: SaveItemEanCodeDto = {
      ean_id: EAN_ID,
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901111111111',
    };

    const result = await service.save(input);

    expect(prisma.itemEanCode.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.itemEanCode.update.mock.calls[0][0];
    expect(updateArgs.where.eanId).toBe(EAN_ID);
    expect(updateArgs.data.eanCode).toBe('8901111111111');
    expect(result.ean_code).toBe('8901111111111');
  });

  it('creates multiple item ean code rows from an array payload', async () => {
    const firstRecord = makeRecord();
    const secondRecord = makeRecord({
      eanId: '019c6f6c-be87-7a11-8905-36092c46fd10',
      eanCode: '8901111111111',
    });

    prisma.itemEanCode.create
      .mockResolvedValueOnce(firstRecord)
      .mockResolvedValueOnce(secondRecord);

    const result = await service.save([
      {
        ean_item_id: ITEM_ID,
        ean_unit_id: UNIT_ID,
        ean_code: '8901234567890',
      },
      {
        ean_item_id: ITEM_ID,
        ean_unit_id: UNIT_ID,
        ean_code: '8901111111111',
      },
    ]);

    expect(prisma.itemEanCode.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      expect.objectContaining({ ean_id: EAN_ID }),
      expect.objectContaining({ ean_id: '019c6f6c-be87-7a11-8905-36092c46fd10' }),
    ]);
  });

  it('normalizes old defaults when a new default ean is created in same scope', async () => {
    const createdDefault = makeRecord({
      eanGodownId: GODOWN_ID,
      eanIsDefault: true,
    });
    prisma.itemEanCode.create.mockResolvedValue(createdDefault);
    prisma.itemEanCode.updateMany.mockResolvedValue({ count: 1 });

    const input: SaveItemEanCodeDto = {
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901234567890',
      ean_godown_id: GODOWN_ID,
      ean_is_default: true,
    };

    await service.save(input);

    expect(prisma.itemEanCode.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.itemEanCode.updateMany.mock.calls[0][0];
    expect(updateManyArgs.where?.eanItemId).toBe(ITEM_ID);
    expect(updateManyArgs.where?.eanUnitId).toBe(UNIT_ID);
    expect(updateManyArgs.where?.eanGodownId).toBe(GODOWN_ID);
    expect(updateManyArgs.where?.eanIsDefault).toBe(true);
    expect(updateManyArgs.where?.eanId).toEqual({ not: EAN_ID });
    expect(updateManyArgs.data.eanIsDefault).toBe(false);
  });

  it('rejects duplicate ean_code with 409', async () => {
    prisma.itemEanCode.create.mockRejectedValue({ code: 'P2002' });

    const input: SaveItemEanCodeDto = {
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901234567890',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects foreign key violations with 400', async () => {
    prisma.itemEanCode.create.mockRejectedValue({ code: 'P2003' });

    const input: SaveItemEanCodeDto = {
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901234567890',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty ean_code', async () => {
    const input: SaveItemEanCodeDto = {
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '   ',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.itemEanCode.findFirst.mockResolvedValue(null);

    await expect(service.getById(EAN_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.itemEanCode.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.itemEanCode.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.eanId).toBe(EAN_ID);
    expect(findFirstArgs.where?.eanIsDeleted).toBe(false);
  });

  it('applies pagination and search filters correctly', async () => {
    prisma.itemEanCode.count.mockResolvedValue(35);
    prisma.itemEanCode.findMany.mockResolvedValue([makeRecord()]);

    const query: ListItemEanCodeQueryDto = {
      ean_item_id: ITEM_ID,
      ean_is_active: true,
      ean_is_default: false,
      search: '8901',
      page: 2,
      limit: 10,
    };

    const result = await service.list(query);

    expect(prisma.itemEanCode.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.itemEanCode.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.where?.eanIsDeleted).toBe(false);
    expect(findManyArgs.where?.eanItemId).toBe(ITEM_ID);
    expect(findManyArgs.where?.eanIsActive).toBe(true);
    expect(findManyArgs.where?.eanIsDefault).toBe(false);
    expect(findManyArgs.where?.OR).toEqual([
      { eanCode: { contains: '8901', mode: 'insensitive' } },
      { eanRemarks: { contains: '8901', mode: 'insensitive' } },
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      total_pages: 4,
    });
  });

  it('soft delete updates ean_is_deleted and audit fields', async () => {
    const existing = makeRecord();
    prisma.itemEanCode.findFirst.mockResolvedValue(existing);
    prisma.itemEanCode.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.softDelete(EAN_ID)).resolves.toEqual({
      ean_id: EAN_ID,
      deleted: true,
    });

    expect(prisma.itemEanCode.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.itemEanCode.updateMany.mock.calls[0][0];
    expect(updateManyArgs.where?.eanId).toBe(EAN_ID);
    expect(updateManyArgs.where?.eanIsDeleted).toBe(false);
    expect(updateManyArgs.data.eanIsDeleted).toBe(true);
    expect(updateManyArgs.data.eanModifiedBy).toBe('system');
  });

  it('soft deletes multiple item ean codes from an array payload', async () => {
    prisma.itemEanCode.findFirst.mockResolvedValueOnce(makeRecord()).mockResolvedValueOnce(
      makeRecord({
        eanId: '019c6f6c-be87-7a11-8905-36092c46fd10',
        eanCode: '8901111111111',
      }),
    );
    prisma.itemEanCode.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.softDelete([EAN_ID, '019c6f6c-be87-7a11-8905-36092c46fd10']),
    ).resolves.toEqual([
      {
        ean_id: EAN_ID,
        deleted: true,
      },
      {
        ean_id: '019c6f6c-be87-7a11-8905-36092c46fd10',
        deleted: true,
      },
    ]);

    expect(prisma.itemEanCode.updateMany).toHaveBeenCalledTimes(2);
  });
});
