import { BadRequestException } from '@nestjs/common';
import { ItemUnitConversion, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ItemUnitConversionService } from './item-unit-conversion.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const BASE_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd11';

type PrismaMock = {
  itemMaster: {
    findFirst: jest.Mock<
      Promise<{ itemBaseUnitId: string | null } | null>,
      [Prisma.ItemMasterFindFirstArgs]
    >;
  };
  itemUnitConversion: {
    count: jest.Mock<Promise<number>, [Prisma.ItemUnitConversionCountArgs]>;
    create: jest.Mock<Promise<ItemUnitConversion>, [Prisma.ItemUnitConversionCreateArgs]>;
    findFirst: jest.Mock<
      Promise<ItemUnitConversion | null>,
      [Prisma.ItemUnitConversionFindFirstArgs]
    >;
    findMany: jest.Mock<Promise<ItemUnitConversion[]>, [Prisma.ItemUnitConversionFindManyArgs]>;
    update: jest.Mock<Promise<ItemUnitConversion>, [Prisma.ItemUnitConversionUpdateArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ConfiguredGridSqlServiceMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
};

const makeItemUnitConversionRecord = (
  overrides: Partial<ItemUnitConversion> = {},
): ItemUnitConversion =>
  ({
    iucId: '019c6f6c-be87-7a11-8905-36092c46fd12',
    iucItemId: ITEM_ID,
    iucUnitId: UNIT_ID,
    iucBaseUnitId: BASE_UNIT_ID,
    iucToBaseFactor: new Prisma.Decimal(12),
    iucUnitSlno: 2,
    iucUnitFactor: new Prisma.Decimal(6),
    iucIsDefaultUnit: true,
    iucIsBaseUnit: false,
    iucIsBigUnit: true,
    iucUomWeight: new Prisma.Decimal(0),
    iucUomRemarks: 'Carton',
    iucIsActive: true,
    iucIsDeleted: false,
    iucSyncDate: null,
    iucCreatedOn: new Date('2026-03-25T10:00:00.000Z'),
    iucCreatedBy: USER_ID,
    iucUpdatedOn: null,
    iucUpdatedBy: null,
    ...overrides,
  }) as ItemUnitConversion;

describe('ItemUnitConversionService', () => {
  let service: ItemUnitConversionService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;

  beforeEach(() => {
    prisma = {
      itemMaster: {
        findFirst: jest.fn<
          Promise<{ itemBaseUnitId: string | null } | null>,
          [Prisma.ItemMasterFindFirstArgs]
        >(),
      },
      itemUnitConversion: {
        count: jest.fn<Promise<number>, [Prisma.ItemUnitConversionCountArgs]>(),
        create: jest.fn<Promise<ItemUnitConversion>, [Prisma.ItemUnitConversionCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemUnitConversion | null>,
          [Prisma.ItemUnitConversionFindFirstArgs]
        >(),
        findMany: jest.fn<Promise<ItemUnitConversion[]>, [Prisma.ItemUnitConversionFindManyArgs]>(),
        update: jest.fn<Promise<ItemUnitConversion>, [Prisma.ItemUnitConversionUpdateArgs]>(),
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
    prisma.itemUnitConversion.findMany.mockResolvedValue([]);

    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };

    configuredGridSqlService = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn().mockImplementation((candidates: unknown[]) => candidates),
      validateBaseSql: jest.fn(),
      runPagedQuery: jest.fn(),
    };

    service = new ItemUnitConversionService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as never,
    );
  });

  it('creates item unit conversions', async () => {
    prisma.itemUnitConversion.create.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemMaster.findFirst.mockResolvedValue({
      itemBaseUnitId: BASE_UNIT_ID,
    });

    const result = await service.save({
      iuc_item_id: ITEM_ID,
      iuc_unit_id: UNIT_ID,
      iuc_base_unit_id: BASE_UNIT_ID,
      iuc_to_base_factor: 12,
      iuc_unit_slno: 2,
      iuc_unit_factor: 6,
      iuc_is_default_unit: true,
      iuc_is_big_unit: true,
      iuc_created_by: USER_ID,
    });

    expect(prisma.itemUnitConversion.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      iuc_item_id: ITEM_ID,
      iuc_unit_id: UNIT_ID,
      iuc_base_unit_id: BASE_UNIT_ID,
      iuc_to_base_factor: 12,
      iuc_unit_slno: 2,
    });
  });

  it('derives cumulative to-base factors from step unit factors across a batch', async () => {
    const tertiaryUnitId = '019c6f6c-be87-7a11-8905-36092c46fd15';
    prisma.itemUnitConversion.create
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucUnitId: BASE_UNIT_ID,
          iucBaseUnitId: BASE_UNIT_ID,
          iucUnitSlno: 1,
          iucIsBaseUnit: true,
          iucToBaseFactor: new Prisma.Decimal(1),
          iucUnitFactor: new Prisma.Decimal(1),
        }),
      )
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucId: '019c6f6c-be87-7a11-8905-36092c46fd16',
          iucUnitId: UNIT_ID,
          iucBaseUnitId: BASE_UNIT_ID,
          iucUnitSlno: 2,
          iucIsBaseUnit: false,
          iucToBaseFactor: new Prisma.Decimal(10),
          iucUnitFactor: new Prisma.Decimal(10),
        }),
      )
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucId: '019c6f6c-be87-7a11-8905-36092c46fd17',
          iucUnitId: tertiaryUnitId,
          iucBaseUnitId: BASE_UNIT_ID,
          iucUnitSlno: 3,
          iucIsBaseUnit: false,
          iucToBaseFactor: new Prisma.Decimal(60),
          iucUnitFactor: new Prisma.Decimal(6),
        }),
      );

    await service.save([
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: BASE_UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 1,
        iuc_is_base_unit: true,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 2,
        iuc_unit_factor: 10,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: tertiaryUnitId,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 3,
        iuc_unit_factor: 6,
        iuc_created_by: USER_ID,
      },
    ]);

    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: BASE_UNIT_ID,
          iucToBaseFactor: 1,
          iucUnitFactor: 1,
        }),
      }),
    );
    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: UNIT_ID,
          iucToBaseFactor: 10,
          iucUnitFactor: 10,
        }),
      }),
    );
    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: tertiaryUnitId,
          iucToBaseFactor: 60,
          iucUnitFactor: 6,
        }),
      }),
    );
  });

  it('derives step unit factors from cumulative to-base factors across a batch', async () => {
    const tertiaryUnitId = '019c6f6c-be87-7a11-8905-36092c46fd22';
    prisma.itemUnitConversion.create
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucUnitId: BASE_UNIT_ID,
          iucBaseUnitId: BASE_UNIT_ID,
          iucUnitSlno: 1,
          iucIsBaseUnit: true,
          iucToBaseFactor: new Prisma.Decimal(1),
          iucUnitFactor: new Prisma.Decimal(1),
        }),
      )
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucId: '019c6f6c-be87-7a11-8905-36092c46fd23',
          iucUnitId: UNIT_ID,
          iucBaseUnitId: BASE_UNIT_ID,
          iucUnitSlno: 2,
          iucIsBaseUnit: false,
          iucToBaseFactor: new Prisma.Decimal(10),
          iucUnitFactor: new Prisma.Decimal(10),
        }),
      )
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucId: '019c6f6c-be87-7a11-8905-36092c46fd24',
          iucUnitId: tertiaryUnitId,
          iucBaseUnitId: BASE_UNIT_ID,
          iucUnitSlno: 3,
          iucIsBaseUnit: false,
          iucToBaseFactor: new Prisma.Decimal(60),
          iucUnitFactor: new Prisma.Decimal(6),
        }),
      );

    await service.save([
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: BASE_UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 1,
        iuc_is_base_unit: true,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 2,
        iuc_to_base_factor: 10,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: tertiaryUnitId,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 3,
        iuc_to_base_factor: 60,
        iuc_created_by: USER_ID,
      },
    ]);

    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: UNIT_ID,
          iucToBaseFactor: 10,
          iucUnitFactor: 10,
        }),
      }),
    );
    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: tertiaryUnitId,
          iucToBaseFactor: 60,
          iucUnitFactor: 6,
        }),
      }),
    );
  });

  it('derives a new row cumulative factor from persisted item unit conversion rows', async () => {
    const tertiaryUnitId = '019c6f6c-be87-7a11-8905-36092c46fd18';
    prisma.itemUnitConversion.findMany.mockResolvedValue([
      makeItemUnitConversionRecord({
        iucId: '019c6f6c-be87-7a11-8905-36092c46fd19',
        iucUnitId: BASE_UNIT_ID,
        iucBaseUnitId: BASE_UNIT_ID,
        iucUnitSlno: 1,
        iucIsBaseUnit: true,
        iucToBaseFactor: new Prisma.Decimal(1),
        iucUnitFactor: new Prisma.Decimal(1),
      }),
      makeItemUnitConversionRecord({
        iucId: '019c6f6c-be87-7a11-8905-36092c46fd20',
        iucUnitId: UNIT_ID,
        iucBaseUnitId: BASE_UNIT_ID,
        iucUnitSlno: 2,
        iucIsBaseUnit: false,
        iucToBaseFactor: new Prisma.Decimal(10),
        iucUnitFactor: new Prisma.Decimal(10),
      }),
    ]);
    prisma.itemUnitConversion.create.mockResolvedValue(
      makeItemUnitConversionRecord({
        iucId: '019c6f6c-be87-7a11-8905-36092c46fd21',
        iucUnitId: tertiaryUnitId,
        iucBaseUnitId: BASE_UNIT_ID,
        iucUnitSlno: 3,
        iucIsBaseUnit: false,
        iucToBaseFactor: new Prisma.Decimal(60),
        iucUnitFactor: new Prisma.Decimal(6),
      }),
    );

    await service.save({
      iuc_item_id: ITEM_ID,
      iuc_unit_id: tertiaryUnitId,
      iuc_base_unit_id: BASE_UNIT_ID,
      iuc_unit_slno: 3,
      iuc_unit_factor: 6,
      iuc_created_by: USER_ID,
    });

    expect(prisma.itemUnitConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: tertiaryUnitId,
          iucToBaseFactor: 60,
          iucUnitFactor: 6,
        }),
      }),
    );
  });

  it('derives missing base-unit ids from a base-unit row elsewhere in the same batch', async () => {
    const secondaryUnitId = '019c6f6c-be87-7a11-8905-36092c46fd13';
    prisma.itemUnitConversion.create
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucUnitId: secondaryUnitId,
          iucBaseUnitId: BASE_UNIT_ID,
          iucIsBaseUnit: false,
        }),
      )
      .mockResolvedValueOnce(
        makeItemUnitConversionRecord({
          iucId: '019c6f6c-be87-7a11-8905-36092c46fd14',
          iucUnitId: BASE_UNIT_ID,
          iucBaseUnitId: BASE_UNIT_ID,
          iucIsBaseUnit: true,
          iucToBaseFactor: new Prisma.Decimal(1),
          iucUnitFactor: new Prisma.Decimal(1),
        }),
      );

    const result = await service.save([
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: secondaryUnitId,
        iuc_to_base_factor: 12,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: BASE_UNIT_ID,
        iuc_is_base_unit: true,
      },
    ]);

    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: secondaryUnitId,
          iucBaseUnitId: BASE_UNIT_ID,
        }),
      }),
    );
    expect(prisma.itemUnitConversion.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          iucUnitId: BASE_UNIT_ID,
          iucBaseUnitId: BASE_UNIT_ID,
        }),
      }),
    );
    expect(result).toHaveLength(2);
  });

  it('rejects invalid base-unit conversion rows', async () => {
    await expect(
      service.save({
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_is_base_unit: true,
        iuc_to_base_factor: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.itemUnitConversion.create).not.toHaveBeenCalled();
  });

  it('soft deletes item unit conversions', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemUnitConversion.update.mockResolvedValue(
      makeItemUnitConversionRecord({
        iucIsDeleted: true,
        iucUpdatedOn: new Date('2026-03-25T11:00:00.000Z'),
        iucUpdatedBy: USER_ID,
      }),
    );

    await expect(service.toggleDelete('019c6f6c-be87-7a11-8905-36092c46fd12')).resolves.toEqual({
      iuc_id: '019c6f6c-be87-7a11-8905-36092c46fd12',
      deleted: true,
    });
  });

  it('restores a previously deleted item unit conversion', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(
      makeItemUnitConversionRecord({ iucIsDeleted: true }),
    );
    prisma.itemUnitConversion.update.mockResolvedValue(
      makeItemUnitConversionRecord({
        iucIsDeleted: false,
        iucUpdatedOn: new Date('2026-03-25T11:00:00.000Z'),
        iucUpdatedBy: USER_ID,
      }),
    );

    await expect(service.toggleDelete('019c6f6c-be87-7a11-8905-36092c46fd12')).resolves.toEqual({
      iuc_id: '019c6f6c-be87-7a11-8905-36092c46fd12',
      deleted: false,
    });

    const updateArgs = prisma.itemUnitConversion.update.mock.calls[0][0];
    expect(updateArgs.data.iucIsDeleted).toBe(false);
  });
});
