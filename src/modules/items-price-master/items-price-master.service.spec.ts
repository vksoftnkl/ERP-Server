import { BadRequestException } from '@nestjs/common';
import { ItemPriceMaster, ItemUnitConversion, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import { ItemsPriceMasterService } from './items-price-master.service';

const ITEM_PRICE_ID = '019c6f6c-be87-7a11-8905-36092c46fd05';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const BASE_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd10';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd11';

type PrismaMock = {
  itemPriceMaster: {
    create: jest.Mock<Promise<ItemPriceMaster>, [Prisma.ItemPriceMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemPriceMaster | null>, [Prisma.ItemPriceMasterFindFirstArgs]>;
    update: jest.Mock<Promise<ItemPriceMaster>, [Prisma.ItemPriceMasterUpdateArgs]>;
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

const makeItemPriceRecord = (
  overrides: Partial<ItemPriceMaster> = {},
): ItemPriceMaster =>
  ({
    ipmId: ITEM_PRICE_ID,
    ipmCompanyId: COMPANY_ID,
    ipmBranchId: null,
    ipmItemId: ITEM_ID,
    ipmUnitId: UNIT_ID,
    ipmGodownId: GODOWN_ID,
    ipmBaseUnitId: BASE_UNIT_ID,
    ipmToBaseFactor: new Prisma.Decimal(12),
    ipmUnitSlno: 2,
    ipmUnitFactor: new Prisma.Decimal(6),
    ipmIsDefaultUnit: true,
    ipmIsBigUnit: true,
    ipmIsBaseUnit: false,
    ipmCostPrice: new Prisma.Decimal(25),
    ipmCostWot: new Prisma.Decimal(25),
    ipmSalesPriceA: new Prisma.Decimal(30),
    ipmSalesPriceB: new Prisma.Decimal(0),
    ipmSalesPriceC: new Prisma.Decimal(0),
    ipmSalesPriceD: new Prisma.Decimal(0),
    ipmPriceAWot: new Prisma.Decimal(30),
    ipmPriceBWot: new Prisma.Decimal(0),
    ipmPriceCWot: new Prisma.Decimal(0),
    ipmPriceDWot: new Prisma.Decimal(0),
    ipmPriceAMarkupPerc: new Prisma.Decimal(0),
    ipmPriceBMarkupPerc: new Prisma.Decimal(0),
    ipmPriceCMarkupPerc: new Prisma.Decimal(0),
    ipmPriceDMarkupPerc: new Prisma.Decimal(0),
    ipmMaxPrice: new Prisma.Decimal(0),
    ipmMinPrice: new Prisma.Decimal(0),
    ipmDiscPerc: new Prisma.Decimal(0),
    ipmDiscQty: new Prisma.Decimal(0),
    ipmAddlCess: new Prisma.Decimal(0),
    ipmProfitType: 'MANUAL',
    ipmRoundOff: new Prisma.Decimal(0),
    ipmLoadingCharge: new Prisma.Decimal(0),
    ipmFreightCharge: new Prisma.Decimal(0),
    ipmLoyaltyPoints: new Prisma.Decimal(0),
    ipmUomRemarks: 'Carton',
    ipmCostRemarks: null,
    ipmIsActive: true,
    ipmIsDeleted: false,
    ipmSyncDate: null,
    ipmCreatedOn: new Date('2026-03-25T10:00:00.000Z'),
    ipmCreatedBy: USER_ID,
    ipmUpdatedOn: new Date('2026-03-25T10:00:00.000Z'),
    ipmUpdatedBy: USER_ID,
    ...overrides,
  }) as ItemPriceMaster;

const makeItemUnitConversionRecord = (
  overrides: Partial<ItemUnitConversion> = {},
): ItemUnitConversion =>
  ({
    iucId: '019c6f6c-be87-7a11-8905-36092c46fd12',
    iucCompanyId: COMPANY_ID,
    iucItemId: ITEM_ID,
    iucUnitId: UNIT_ID,
    iucBaseUnitId: BASE_UNIT_ID,
    iucToBaseFactor: new Prisma.Decimal(12),
    iucUnitSlno: 2,
    iulUnitFactor: new Prisma.Decimal(6),
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

describe('ItemsPriceMasterService', () => {
  let service: ItemsPriceMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;

  beforeEach(() => {
    prisma = {
      itemPriceMaster: {
        create: jest.fn<Promise<ItemPriceMaster>, [Prisma.ItemPriceMasterCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemPriceMaster | null>,
          [Prisma.ItemPriceMasterFindFirstArgs]
        >(),
        update: jest.fn<Promise<ItemPriceMaster>, [Prisma.ItemPriceMasterUpdateArgs]>(),
      },
      itemUnitConversion: {
        count: jest.fn<Promise<number>, [Prisma.ItemUnitConversionCountArgs]>(),
        create: jest.fn<Promise<ItemUnitConversion>, [Prisma.ItemUnitConversionCreateArgs]>(),
        findFirst: jest.fn<
          Promise<ItemUnitConversion | null>,
          [Prisma.ItemUnitConversionFindFirstArgs]
        >(),
        findMany: jest.fn<
          Promise<ItemUnitConversion[]>,
          [Prisma.ItemUnitConversionFindManyArgs]
        >(),
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

    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };

    configuredGridSqlService = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn().mockImplementation((candidates: unknown[]) => candidates),
      validateBaseSql: jest.fn(),
      runPagedQuery: jest.fn(),
    };

    service = new ItemsPriceMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
    );
  });

  it('creates item prices with structural UOM fields copied from item unit conversion', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemPriceMaster.create.mockResolvedValue(makeItemPriceRecord());

    const input: SaveItemPriceDto = {
      ipm_company_id: COMPANY_ID,
      ipm_item_id: ITEM_ID,
      ipm_unit_id: UNIT_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_base_unit_id: null,
      ipm_to_base_factor: 1,
      ipm_unit_slno: 0,
      ipm_unit_factor: 1,
      ipm_is_default_unit: false,
      ipm_is_big_unit: false,
      ipm_is_base_unit: false,
      ipm_profit_type: 'MANUAL',
      ipm_created_by: USER_ID,
    };

    const result = await service.save(input);

    expect(prisma.itemUnitConversion.findFirst).toHaveBeenCalledWith({
      where: {
        iucItemId: ITEM_ID,
        iucUnitId: UNIT_ID,
        iucIsActive: true,
        iucIsDeleted: false,
      },
    });

    const createArgs = prisma.itemPriceMaster.create.mock.calls[0][0];
    expect(createArgs.data.ipmBaseUnitId).toBe(BASE_UNIT_ID);
    expect(createArgs.data.ipmToBaseFactor).toEqual(new Prisma.Decimal(12));
    expect(createArgs.data.ipmUnitSlno).toBe(2);
    expect(createArgs.data.ipmUnitFactor).toEqual(new Prisma.Decimal(6));
    expect(createArgs.data.ipmIsDefaultUnit).toBe(true);
    expect(createArgs.data.ipmIsBigUnit).toBe(true);
    expect(createArgs.data.ipmIsBaseUnit).toBe(false);
    expect(createArgs.data.ipmUomRemarks).toBe('Carton');
    expect(result).toMatchObject({
      ipm_base_unit_id: BASE_UNIT_ID,
      ipm_to_base_factor: 12,
      ipm_unit_slno: 2,
      ipm_unit_factor: 6,
    });
  });

  it('keeps explicit UOM remarks while syncing structural fields during updates', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemPriceMaster.findFirst.mockResolvedValueOnce(
      makeItemPriceRecord({
        ipmBaseUnitId: null,
        ipmToBaseFactor: new Prisma.Decimal(1),
        ipmUnitSlno: 0,
        ipmUnitFactor: new Prisma.Decimal(1),
        ipmIsDefaultUnit: false,
        ipmIsBigUnit: false,
        ipmIsBaseUnit: false,
        ipmUomRemarks: null,
      }),
    );
    prisma.itemPriceMaster.update.mockResolvedValue(
      makeItemPriceRecord({
        ipmUomRemarks: 'Manual UOM note',
      }),
    );

    const input: SaveItemPriceDto = {
      ipm_id: ITEM_PRICE_ID,
      ipm_company_id: COMPANY_ID,
      ipm_item_id: ITEM_ID,
      ipm_unit_id: UNIT_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
      ipm_uom_remarks: 'Manual UOM note',
      ipm_updated_by: USER_ID,
    };

    await service.save(input);

    const updateArgs = prisma.itemPriceMaster.update.mock.calls[0][0];
    expect(updateArgs.data.ipmBaseUnitId).toBe(BASE_UNIT_ID);
    expect(updateArgs.data.ipmToBaseFactor).toEqual(new Prisma.Decimal(12));
    expect(updateArgs.data.ipmUnitSlno).toBe(2);
    expect(updateArgs.data.ipmUnitFactor).toEqual(new Prisma.Decimal(6));
    expect(updateArgs.data.ipmIsDefaultUnit).toBe(true);
    expect(updateArgs.data.ipmIsBigUnit).toBe(true);
    expect(updateArgs.data.ipmIsBaseUnit).toBe(false);
    expect(updateArgs.data.ipmUomRemarks).toBe('Manual UOM note');
  });

  it('rejects saves when no active item unit conversion exists for the selected item and unit', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(null);

    const input: SaveItemPriceDto = {
      ipm_item_id: ITEM_ID,
      ipm_unit_id: UNIT_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.itemPriceMaster.create).not.toHaveBeenCalled();
  });

  it('rejects saves when ipm_company_id does not match item unit conversion company', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());

    const input: SaveItemPriceDto = {
      ipm_company_id: '019c6f6c-be87-7a11-8905-36092c46fd13',
      ipm_item_id: ITEM_ID,
      ipm_unit_id: UNIT_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.itemPriceMaster.create).not.toHaveBeenCalled();
  });

  it('creates item unit conversions through the item price service', async () => {
    prisma.itemUnitConversion.create.mockResolvedValue(makeItemUnitConversionRecord());

    const result = await service.saveItemUnitConversions({
      iuc_company_id: COMPANY_ID,
      iuc_item_id: ITEM_ID,
      iuc_unit_id: UNIT_ID,
      iuc_base_unit_id: BASE_UNIT_ID,
      iuc_to_base_factor: 12,
      iuc_unit_slno: 2,
      iul_unit_factor: 6,
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

  it('rejects invalid base-unit conversion rows', async () => {
    await expect(
      service.saveItemUnitConversions({
        iuc_company_id: COMPANY_ID,
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
        iuc_is_base_unit: true,
        iuc_to_base_factor: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.itemUnitConversion.create).not.toHaveBeenCalled();
  });

  it('soft deletes item unit conversions through the item price service', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemUnitConversion.update.mockResolvedValue(
      makeItemUnitConversionRecord({
        iucIsDeleted: true,
        iucUpdatedOn: new Date('2026-03-25T11:00:00.000Z'),
        iucUpdatedBy: USER_ID,
      }),
    );

    await expect(service.deleteItemUnitConversions('019c6f6c-be87-7a11-8905-36092c46fd12')).resolves
      .toEqual({
        iuc_id: '019c6f6c-be87-7a11-8905-36092c46fd12',
        deleted: true,
      });
  });
});
