import { BadRequestException } from '@nestjs/common';
import { ItemPriceMaster, ItemUnitConversion, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
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
const makeItemPriceRecord = (overrides: Partial<ItemPriceMaster> = {}): ItemPriceMaster =>
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
    service = new ItemsPriceMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as never,
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
      // No ipm_unit_factor: supplying one routes the save down the chain-walk
      // branch, which never consults the stored conversion row this test is about.
      ipm_is_default_unit: false,
      ipm_is_big_unit: false,
      ipm_is_base_unit: false,
      ipm_profit_type: 'MANUAL',
      ipm_created_by: USER_ID,
    };
    const result = await service.save(input);
    // ipm_unit_id may name either the unit or the conversion row itself.
    expect(prisma.itemUnitConversion.findFirst).toHaveBeenCalledWith({
      where: {
        iucItemId: ITEM_ID,
        OR: [{ iucUnitId: UNIT_ID }, { iucId: UNIT_ID }],
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
  it('rejects a price whose unit has no conversion row, instead of synthesising one', async () => {
    // ipm_unit_id is a FK to item_unit_conversion(iuc_id), so there is no id to
    // store when the item has no conversion row for the unit: the old
    // request-derived fallback can no longer produce a writable row.
    prisma.itemUnitConversion.findFirst.mockResolvedValue(null);
    const input: SaveItemPriceDto = {
      ipm_item_id: ITEM_ID,
      ipm_unit_id: UNIT_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
    };
    await expect(service.save(input)).rejects.toThrow(BadRequestException);
    expect(prisma.itemPriceMaster.create).not.toHaveBeenCalled();
  });
  it('rejects a unit-factor payload whose unit has no conversion row', async () => {
    // Same FK constraint on the explicit-unit-factor path, which walks the
    // item's conversion chain and previously synthesised a snapshot on a miss.
    prisma.itemUnitConversion.findFirst.mockResolvedValue(null);
    prisma.itemUnitConversion.findMany.mockResolvedValue([]);
    await expect(
      service.save({
        ipm_item_id: ITEM_ID,
        ipm_unit_id: UNIT_ID,
        ipm_godown_id: GODOWN_ID,
        ipm_base_unit_id: BASE_UNIT_ID,
        ipm_profit_type: 'MANUAL',
        ipm_unit_slno: 3,
        ipm_unit_factor: 4,
        ipm_is_big_unit: true,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.itemPriceMaster.create).not.toHaveBeenCalled();
  });
});