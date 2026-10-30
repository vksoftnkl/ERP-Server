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
    // The item-live check (notes 137 D1).
    findMany: jest.Mock;
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
): ItemUnitConversion => ({
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
});

describe('ItemUnitConversionService', () => {
  let service: ItemUnitConversionService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;
  let requestContextService: { getUserId: jest.Mock };

  beforeEach(() => {
    prisma = {
      itemMaster: {
        findFirst: jest.fn<
          Promise<{ itemBaseUnitId: string | null } | null>,
          [Prisma.ItemMasterFindFirstArgs]
        >(),
        // Every item named is live unless a test says otherwise.
        findMany: jest.fn((args: { where: { itemId: { in: string[] } } }) =>
          Promise.resolve(args.where.itemId.in.map((itemId) => ({ itemId }))),
        ),
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

    requestContextService = { getUserId: jest.fn().mockReturnValue(null) };
    service = new ItemUnitConversionService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as never,
      requestContextService as never,
    );
  });

  // The item's stored rows, answering the where they are read with: the
  // base-row lock (notes 138) reads only iuc_is_base_unit = true.
  const mockPersistedRows = (rows: ItemUnitConversion[]) =>
    prisma.itemUnitConversion.findMany.mockImplementation((args) =>
      Promise.resolve(
        rows.filter(
          (row) =>
            args.where?.iucIsBaseUnit === undefined ||
            row.iucIsBaseUnit === args.where.iucIsBaseUnit,
        ),
      ),
    );

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

  // Notes 50 #2 / 67: no actor in the payload means the request's user, not NULL.
  it('stamps the request user as created_by / updated_by when the payload names none', async () => {
    requestContextService.getUserId.mockReturnValue(USER_ID);
    prisma.itemUnitConversion.create.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemMaster.findFirst.mockResolvedValue({ itemBaseUnitId: BASE_UNIT_ID });

    await service.save({
      iuc_item_id: ITEM_ID,
      iuc_unit_id: UNIT_ID,
      iuc_base_unit_id: BASE_UNIT_ID,
    });

    const data = prisma.itemUnitConversion.create.mock.calls[0][0].data;
    expect(data.iucCreatedBy).toBe(USER_ID);
    expect(data.iucUpdatedBy).toBe(USER_ID);
  });

  /**
   * Notes 147 A — the item card's rule: the list runs from the biggest unit
   * down, a row's unit factor is how many of it make one of the row above, and
   * to-base = base cumulative / row cumulative. 99d0a468 had inverted it.
   */
  const created = (n: number) =>
    (prisma.itemUnitConversion.create.mock.calls[n - 1][0] as { data: Record<string, unknown> })
      .data;
  const echoCreate = () =>
    prisma.itemUnitConversion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeItemUnitConversionRecord(data as never)),
    );

  it('Bottle (1) / PCS (10, base) stores 1 Bottle = 10 PCS — the item card keyed it so', async () => {
    echoCreate();

    await service.save([
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 1,
        iuc_unit_factor: 1,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: BASE_UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 2,
        iuc_unit_factor: 10,
        iuc_is_base_unit: true,
        iuc_created_by: USER_ID,
      },
    ]);

    expect(created(1)).toMatchObject({ iucUnitId: UNIT_ID, iucToBaseFactor: 10, iucUnitFactor: 1 });
    expect(created(2)).toMatchObject({
      iucUnitId: BASE_UNIT_ID,
      iucToBaseFactor: 1,
      iucUnitFactor: 10,
      iucIsBaseUnit: true,
    });
  });

  it('derives cumulative to-base factors from step unit factors across a batch', async () => {
    // Box (1) / Strip (10) / Tablet (6, base): 1 Box = 10 Strips = 60 Tablets.
    const stripUnitId = '019c6f6c-be87-7a11-8905-36092c46fd15';
    echoCreate();

    await service.save([
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 1,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: stripUnitId,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 2,
        iuc_unit_factor: 10,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: BASE_UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 3,
        iuc_unit_factor: 6,
        iuc_is_base_unit: true,
        iuc_created_by: USER_ID,
      },
    ]);

    expect(created(1)).toMatchObject({ iucUnitId: UNIT_ID, iucToBaseFactor: 60, iucUnitFactor: 1 });
    expect(created(2)).toMatchObject({
      iucUnitId: stripUnitId,
      iucToBaseFactor: 6,
      iucUnitFactor: 10,
    });
    expect(created(3)).toMatchObject({
      iucUnitId: BASE_UNIT_ID,
      iucToBaseFactor: 1,
      iucUnitFactor: 6,
    });
  });

  it('derives step unit factors from cumulative to-base factors across a batch', async () => {
    const stripUnitId = '019c6f6c-be87-7a11-8905-36092c46fd22';
    echoCreate();

    await service.save([
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 1,
        iuc_to_base_factor: 60,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: stripUnitId,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 2,
        iuc_to_base_factor: 6,
        iuc_created_by: USER_ID,
      },
      {
        iuc_item_id: ITEM_ID,
        iuc_unit_id: BASE_UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_unit_slno: 3,
        iuc_to_base_factor: 1,
        iuc_is_base_unit: true,
        iuc_created_by: USER_ID,
      },
    ]);

    expect(created(1)).toMatchObject({ iucToBaseFactor: 60, iucUnitFactor: 1 });
    expect(created(2)).toMatchObject({ iucToBaseFactor: 6, iucUnitFactor: 10 });
    expect(created(3)).toMatchObject({ iucToBaseFactor: 1, iucUnitFactor: 6 });
  });

  it('a row below the base is a smaller unit: its to-base factor is a fraction', async () => {
    // Persisted Box (1) / PCS (10, base); a Half-piece row under PCS with
    // factor 2 is 2 halves to a PCS: 0.5.
    const halfUnitId = '019c6f6c-be87-7a11-8905-36092c46fd18';
    mockPersistedRows([
      makeItemUnitConversionRecord({
        iucId: '019c6f6c-be87-7a11-8905-36092c46fd19',
        iucUnitId: UNIT_ID,
        iucBaseUnitId: BASE_UNIT_ID,
        iucUnitSlno: 1,
        iucIsBaseUnit: false,
        iucToBaseFactor: new Prisma.Decimal(10),
        iucUnitFactor: new Prisma.Decimal(1),
      }),
      makeItemUnitConversionRecord({
        iucId: '019c6f6c-be87-7a11-8905-36092c46fd20',
        iucUnitId: BASE_UNIT_ID,
        iucBaseUnitId: BASE_UNIT_ID,
        iucUnitSlno: 2,
        iucIsBaseUnit: true,
        iucToBaseFactor: new Prisma.Decimal(1),
        iucUnitFactor: new Prisma.Decimal(10),
      }),
    ]);
    echoCreate();

    await service.save({
      iuc_item_id: ITEM_ID,
      iuc_unit_id: halfUnitId,
      iuc_base_unit_id: BASE_UNIT_ID,
      iuc_unit_slno: 3,
      iuc_unit_factor: 2,
      iuc_created_by: USER_ID,
    });

    expect(created(1)).toMatchObject({
      iucUnitId: halfUnitId,
      iucToBaseFactor: 0.5,
      iucUnitFactor: 2,
    });
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

  describe('a saved base unit is locked (notes 138 A1)', () => {
    const BASE_IUC_ID = '019c6f6c-be87-7a11-8905-36092c46fd30';
    const OTHER_IUC_ID = '019c6f6c-be87-7a11-8905-36092c46fd31';
    const baseRow = makeItemUnitConversionRecord({
      iucId: BASE_IUC_ID,
      iucUnitId: BASE_UNIT_ID,
      iucBaseUnitId: BASE_UNIT_ID,
      iucUnitSlno: 1,
      iucIsBaseUnit: true,
      iucIsDefaultUnit: false,
      iucIsBigUnit: false,
      iucToBaseFactor: new Prisma.Decimal(1),
      iucUnitFactor: new Prisma.Decimal(1),
    });
    const otherRow = makeItemUnitConversionRecord({
      iucId: OTHER_IUC_ID,
      iucUnitSlno: 2,
      iucToBaseFactor: new Prisma.Decimal(12),
      iucUnitFactor: new Prisma.Decimal(12),
    });

    beforeEach(() => mockPersistedRows([otherRow, baseRow]));

    it.each([
      [
        'the base row re-pointed at another unit',
        { iuc_id: BASE_IUC_ID, iuc_unit_id: UNIT_ID },
        'iuc_unit_id',
      ],
      [
        'the base row un-marked',
        { iuc_id: BASE_IUC_ID, iuc_unit_id: BASE_UNIT_ID, iuc_is_base_unit: false },
        'iuc_is_base_unit',
      ],
      [
        'another row marked base',
        { iuc_id: OTHER_IUC_ID, iuc_unit_id: UNIT_ID, iuc_is_base_unit: true },
        'iuc_is_base_unit',
      ],
      [
        'a new row marked base',
        { iuc_unit_id: '019c6f6c-be87-7a11-8905-36092c46fd32', iuc_is_base_unit: true },
        'iuc_is_base_unit',
      ],
      [
        'a row naming another base unit',
        { iuc_id: OTHER_IUC_ID, iuc_unit_id: UNIT_ID, iuc_base_unit_id: UNIT_ID },
        'iuc_base_unit_id',
      ],
    ])('refuses %s with 409 and writes nothing', async (_case, row, field) => {
      await expect(service.save({ iuc_item_id: ITEM_ID, ...row })).rejects.toMatchObject({
        status: 409,
        response: { errors: [{ field, code: 'ITEM_BASE_UNIT_LOCKED' }] },
      });
      expect(prisma.itemUnitConversion.update).not.toHaveBeenCalled();
      expect(prisma.itemUnitConversion.create).not.toHaveBeenCalled();
    });

    it('names the row of an array save by its index', async () => {
      await expect(
        service.save([
          { iuc_item_id: ITEM_ID, iuc_id: OTHER_IUC_ID, iuc_unit_id: UNIT_ID },
          { iuc_item_id: ITEM_ID, iuc_id: BASE_IUC_ID, iuc_unit_id: UNIT_ID },
        ]),
      ).rejects.toMatchObject({
        response: { errors: [{ field: '1.iuc_unit_id', code: 'ITEM_BASE_UNIT_LOCKED' }] },
      });
    });

    it("still takes a new factor on another row, and the base row's weight", async () => {
      prisma.itemUnitConversion.findFirst.mockImplementation((args) =>
        Promise.resolve(args.where?.iucId === BASE_IUC_ID ? baseRow : otherRow),
      );
      prisma.itemUnitConversion.update.mockImplementation((args) =>
        Promise.resolve(args.where.iucId === BASE_IUC_ID ? baseRow : otherRow),
      );

      await service.save([
        {
          iuc_item_id: ITEM_ID,
          iuc_id: OTHER_IUC_ID,
          iuc_unit_id: UNIT_ID,
          iuc_unit_slno: 2,
          iuc_unit_factor: 24,
        },
        {
          iuc_item_id: ITEM_ID,
          iuc_id: BASE_IUC_ID,
          iuc_unit_id: BASE_UNIT_ID,
          iuc_unit_slno: 1,
          iuc_unit_factor: 1,
          iuc_uom_weight: 2,
        },
      ]);

      expect(prisma.itemUnitConversion.update).toHaveBeenCalledTimes(2);
      const [otherUpdate, baseUpdate] = prisma.itemUnitConversion.update.mock.calls.map(
        ([args]) => args.data,
      );
      // The row sits BELOW the base (slno 2 under slno 1), so under the item
      // card's rule (notes 147 A) its 24 is 24 of it to one base unit.
      expect(otherUpdate).toMatchObject({
        iucUnitId: UNIT_ID,
        iucBaseUnitId: BASE_UNIT_ID,
        iucUnitFactor: 24,
        iucToBaseFactor: 0.041666667,
      });
      expect(baseUpdate).toMatchObject({
        iucUnitId: BASE_UNIT_ID,
        iucIsBaseUnit: true,
        iucUomWeight: 2,
      });
    });

    it('refuses to delete the base row', async () => {
      prisma.itemUnitConversion.findFirst.mockResolvedValue(baseRow);
      prisma.itemMaster.findFirst.mockResolvedValue({ itemBaseUnitId: BASE_UNIT_ID });

      await expect(service.delete(BASE_IUC_ID)).rejects.toMatchObject({
        status: 409,
        response: { errors: [{ field: 'iuc_id', code: 'ITEM_BASE_UNIT_LOCKED' }] },
      });
      expect(prisma.itemUnitConversion.update).not.toHaveBeenCalled();
    });
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
