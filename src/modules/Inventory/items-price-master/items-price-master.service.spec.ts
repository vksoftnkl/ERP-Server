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
const IUC_ID = '019c6f6c-be87-7a11-8905-36092c46fd12';
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
/**
 * item_price_master stores no copy of the UOM shape (base unit, factors, slno,
 * is_* flags) — item_unit_conversion owns it, and the price row only points at
 * it through ipm_uc_unit_id — so a price record needs no conversion joined.
 */
const makeItemPriceRecord = (overrides: Partial<ItemPriceMaster> = {}): ItemPriceMaster =>
  ({
    ipmId: ITEM_PRICE_ID,
    ipmCompanyId: COMPANY_ID,
    ipmBranchId: null,
    ipmItemId: ITEM_ID,
    ipmUcUnitId: IUC_ID,
    ipmGodownId: GODOWN_ID,
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
    iucId: IUC_ID,
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
        findFirst: jest.fn<Promise<ItemPriceMaster | null>, [Prisma.ItemPriceMasterFindFirstArgs]>(),
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
  it('writes only the conversion id, never a copy of the unit shape', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemPriceMaster.create.mockResolvedValue(makeItemPriceRecord());
    const input: SaveItemPriceDto = {
      ipm_company_id: COMPANY_ID,
      ipm_item_id: ITEM_ID,
      ipm_uc_unit_id: IUC_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
      ipm_created_by: USER_ID,
    };
    const result = await service.save(input);
    // The conversion must belong to the item being priced — the FK alone would
    // let a price point at another item's unit.
    expect(prisma.itemUnitConversion.findFirst).toHaveBeenCalledWith({
      where: {
        iucId: IUC_ID,
        iucItemId: ITEM_ID,
        iucIsDeleted: false,
      },
      select: { iucId: true, iucUomRemarks: true },
    });
    const createArgs = prisma.itemPriceMaster.create.mock.calls[0][0];
    expect(createArgs.data.ipmUcUnitId).toBe(IUC_ID);
    // item_price_master carries no copy of the unit shape, so the write must
    // not try to set those columns and the read must not report them.
    for (const column of [
      'ipmBaseUnitId',
      'ipmToBaseFactor',
      'ipmUnitSlno',
      'ipmUnitFactor',
      'ipmIsDefaultUnit',
      'ipmIsBigUnit',
      'ipmIsBaseUnit',
    ]) {
      expect(createArgs.data).not.toHaveProperty(column);
    }
    expect(createArgs).not.toHaveProperty('include');
    // The unit's own remark seeds the price row when the caller sends none.
    expect(createArgs.data.ipmUomRemarks).toBe('Carton');
    expect(result.ipm_uc_unit_id).toBe(IUC_ID);
    for (const field of [
      'ipm_unit_id',
      'ipm_base_unit_id',
      'ipm_to_base_factor',
      'ipm_unit_slno',
      'ipm_unit_factor',
      'ipm_is_default_unit',
      'ipm_is_big_unit',
      'ipm_is_base_unit',
    ]) {
      expect(result).not.toHaveProperty(field);
    }
  });
  it('keeps an explicit UOM remark instead of the conversion row\'s on update', async () => {
    prisma.itemUnitConversion.findFirst.mockResolvedValue(makeItemUnitConversionRecord());
    prisma.itemPriceMaster.findFirst.mockResolvedValueOnce(
      makeItemPriceRecord({ ipmUomRemarks: null }),
    );
    prisma.itemPriceMaster.update.mockResolvedValue(
      makeItemPriceRecord({ ipmUomRemarks: 'Manual UOM note' }),
    );
    const input: SaveItemPriceDto = {
      ipm_id: ITEM_PRICE_ID,
      ipm_company_id: COMPANY_ID,
      ipm_item_id: ITEM_ID,
      ipm_uc_unit_id: IUC_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
      ipm_uom_remarks: 'Manual UOM note',
      ipm_updated_by: USER_ID,
    };
    await service.save(input);
    const updateArgs = prisma.itemPriceMaster.update.mock.calls[0][0];
    expect(updateArgs.data.ipmUcUnitId).toBe(IUC_ID);
    expect(updateArgs.data.ipmUomRemarks).toBe('Manual UOM note');
  });
  it('rejects a conversion id that belongs to no live conversion row of the item', async () => {
    // ipm_uc_unit_id is a FK to item_unit_conversion(iuc_id); rejecting here
    // names the field instead of surfacing an opaque foreign-key violation.
    prisma.itemUnitConversion.findFirst.mockResolvedValue(null);
    const input: SaveItemPriceDto = {
      ipm_item_id: ITEM_ID,
      ipm_uc_unit_id: IUC_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_profit_type: 'MANUAL',
    };
    await expect(service.save(input)).rejects.toThrow(BadRequestException);
    expect(prisma.itemPriceMaster.create).not.toHaveBeenCalled();
  });
});