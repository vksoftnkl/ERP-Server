import { ItemMaster, ItemPriceMaster, ItemTaxMaster, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
import { ItemPriceDetailsService } from './item-price-details.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const ITEM_PRICE_ID = '019c6f6c-be87-7a11-8905-36092c46fd05';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const BASE_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd10';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd11';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46fd14';

type PrismaMock = {
  itemMaster: {
    findFirst: jest.Mock<Promise<ItemMaster | null>, [Prisma.ItemMasterFindFirstArgs]>;
  };
  itemPriceMaster: {
    findMany: jest.Mock<Promise<ItemPriceMaster[]>, [Prisma.ItemPriceMasterFindManyArgs]>;
  };
  itemTaxMaster: {
    findFirst: jest.Mock<Promise<ItemTaxMaster | null>, [Prisma.ItemTaxMasterFindFirstArgs]>;
  };
};

const makeItemMasterRecord = (overrides: Partial<ItemMaster> = {}): ItemMaster =>
  ({
    itemId: ITEM_ID,
    itemCompanyId: COMPANY_ID,
    itemBranchId: null,
    itemCode: 'ITEM-001',
    itemSku: 'SKU-001',
    itemNameEn: 'Sample Item',
    itemNameTa: null,
    itemAlias: null,
    itemStockType: 'FG',
    itemDefaultBarcode: null,
    itemGroupId: COMPANY_ID,
    itemCategoryId: null,
    itemBrandId: null,
    itemSectionId: null,
    itemCompanyCategoryId: null,
    itemMfgrId: null,
    itemSupplierId: null,
    itemCustGroup: null,
    itemBaseUnitId: BASE_UNIT_ID,
    itemIsService: false,
    itemIsBatchBased: false,
    itemIsExpiryItem: false,
    itemExpiryDays: null,
    itemIntimateBeforeDays: null,
    itemAllowSales: true,
    itemAllowSalesReturn: true,
    itemAllowPurchase: true,
    itemAllowPo: true,
    itemAllowSo: true,
    itemAllowNegStock: true,
    itemAllowNegativeSo: true,
    itemPriceList: false,
    itemWeighScale: false,
    itemRetailItem: true,
    itemIsKit: false,
    itemAutoBreak: false,
    itemAutoMake: false,
    itemAllowLoyalty: false,
    itemAllowPromo: false,
    itemHasOffer: false,
    itemDamagableProduct: false,
    itemIsDemand: false,
    itemAllowLoading: false,
    itemAllowFreight: false,
    itemRandomStock: false,
    itemBarcodeSticker: false,
    itemBarcodeStickerId: null,
    itemDefaultTaxId: TAX_ID,
    itemHsnCode: null,
    itemBatchConfig: 0,
    itemSortOrder: null,
    itemPhoto: null,
    itemImageUrl: null,
    itemNotes: null,
    itemStorageLocation: null,
    itemPackingItemIds: [],
    itemInclTax: true,
    itemIsActive: true,
    itemIsDeleted: false,
    itemCreatedOn: new Date('2026-03-25T10:00:00.000Z'),
    itemCreatedBy: USER_ID,
    itemModifiedOn: new Date('2026-03-25T10:00:00.000Z'),
    itemModifiedBy: USER_ID,
    ...overrides,
  }) as ItemMaster;

const makeItemPriceRecord = (overrides: Partial<ItemPriceMaster> = {}): ItemPriceMaster =>
  ({
    ipmId: ITEM_PRICE_ID,
    ipmCompanyId: COMPANY_ID,
    ipmBranchId: null,
    ipmItemId: ITEM_ID,
    ipmUcUnitId: UNIT_ID,
    ipmGodownId: GODOWN_ID,
    // The unit shape is read through the joined conversion row, not off the
    // price row, which no longer stores a copy of it.
    itemUnitConversion: {
      iucBaseUnitId: BASE_UNIT_ID,
      iucToBaseFactor: new Prisma.Decimal(12),
      iucUnitSlno: 2,
      iucUnitFactor: new Prisma.Decimal(6),
      iucIsDefaultUnit: true,
      iucIsBigUnit: true,
      iucIsBaseUnit: false,
    },
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

const makeItemTaxRecord = (overrides: Partial<ItemTaxMaster> = {}): ItemTaxMaster =>
  ({
    taxId: TAX_ID,
    taxName: 'GST 18%',
    taxCode: 'GST18',
    taxTaxabilityType: 'TAXABLE',
    taxIsReverseCharge: false,
    taxCgstPerc: new Prisma.Decimal(9),
    taxSgstPerc: new Prisma.Decimal(9),
    taxIgstPerc: new Prisma.Decimal(18),
    taxCgstPurPerc: new Prisma.Decimal(9),
    taxSgstPurPerc: new Prisma.Decimal(9),
    taxIgstPurPerc: new Prisma.Decimal(18),
    taxCessType: 'NONE',
    taxCessPerc: new Prisma.Decimal(0),
    taxCessUnit: new Prisma.Decimal(0),
    taxCessPurPerc: new Prisma.Decimal(0),
    taxCessPurUnit: new Prisma.Decimal(0),
    taxGstRateTotal: new Prisma.Decimal(18),
    taxSalesLedgerId: null,
    taxSalesReturnLedgerId: null,
    taxPurchaseLedgerId: null,
    taxPurchaseReturnLedgerId: null,
    taxCgstOutputLedgerId: null,
    taxSgstOutputLedgerId: null,
    taxIgstOutputLedgerId: null,
    taxCessOutputLedgerId: null,
    taxCgstInputLedgerId: null,
    taxSgstInputLedgerId: null,
    taxIgstInputLedgerId: null,
    taxCessInputLedgerId: null,
    taxIsActive: true,
    taxIsDeleted: false,
    taxSyncDate: null,
    taxCreatedOn: new Date('2026-03-25T10:00:00.000Z'),
    taxCreatedBy: USER_ID,
    taxModifiedOn: new Date('2026-03-25T10:00:00.000Z'),
    taxModifiedBy: USER_ID,
    ...overrides,
  }) as ItemTaxMaster;

describe('ItemPriceDetailsService', () => {
  let service: ItemPriceDetailsService;
  let prisma: PrismaMock;
  let itemUnitConversionService: { findByItemId: jest.Mock };

  beforeEach(() => {
    prisma = {
      itemMaster: {
        findFirst: jest.fn<Promise<ItemMaster | null>, [Prisma.ItemMasterFindFirstArgs]>(),
      },
      itemPriceMaster: {
        findMany: jest.fn<Promise<ItemPriceMaster[]>, [Prisma.ItemPriceMasterFindManyArgs]>(),
      },
      itemTaxMaster: {
        findFirst: jest.fn<Promise<ItemTaxMaster | null>, [Prisma.ItemTaxMasterFindFirstArgs]>(),
      },
    };

    itemUnitConversionService = {
      findByItemId: jest.fn().mockResolvedValue([]),
    };
    service = new ItemPriceDetailsService(
      prisma as unknown as PrismaService,
      itemUnitConversionService as unknown as ItemUnitConversionService,
    );
  });

  it('returns the item\'s unit conversions alongside the prices', async () => {
    // A price row only points at a conversion (ipm_uc_unit_id) and carries none
    // of its shape, so callers doing unit math need both halves in one response.
    const conversions = [
      { iuc_id: 'iuc-1', iuc_unit_id: 'unit-1', iuc_unit_factor: 6, iuc_to_base_factor: 12 },
    ];
    itemUnitConversionService.findByItemId.mockResolvedValue(conversions);
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemMasterRecord());
    prisma.itemPriceMaster.findMany.mockResolvedValue([makeItemPriceRecord()]);
    prisma.itemTaxMaster.findFirst.mockResolvedValue(makeItemTaxRecord());

    const result = await service.getByItemId(ITEM_ID);

    expect(itemUnitConversionService.findByItemId).toHaveBeenCalledWith(ITEM_ID);
    expect(result.item_unit_conversions).toEqual(conversions);
  });

  it('returns joined item, active prices, and default tax when fetching by item id', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemMasterRecord());
    prisma.itemPriceMaster.findMany.mockResolvedValue([makeItemPriceRecord()]);
    prisma.itemTaxMaster.findFirst.mockResolvedValue(makeItemTaxRecord());

    const result = await service.getByItemId(ITEM_ID);

    expect(prisma.itemMaster.findFirst).toHaveBeenCalledWith({
      where: {
        itemId: ITEM_ID,
        itemIsDeleted: false,
      },
    });
    expect(prisma.itemPriceMaster.findMany).toHaveBeenCalledWith({
      where: {
        ipmItemId: ITEM_ID,
        ipmIsDeleted: false,
      },
      include: { itemUnitConversion: true },
      orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
    });
    expect(prisma.itemTaxMaster.findFirst).toHaveBeenCalledWith({
      where: {
        taxId: TAX_ID,
        taxIsDeleted: false,
      },
    });
    expect(result).toMatchObject({
      item: {
        item_id: ITEM_ID,
        item_default_tax_id: TAX_ID,
      },
      item_prices: [
        expect.objectContaining({
          ipm_id: ITEM_PRICE_ID,
          ipm_item_id: ITEM_ID,
        }),
      ],
      item_tax: {
        tax_id: TAX_ID,
        tax_name: 'GST 18%',
      },
    });
  });
});
