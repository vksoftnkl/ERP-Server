import { ItemMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
import { ItemsPriceMasterService } from '../items-price-master/items-price-master.service';
import { ItemsEanCodeMasterService } from '../items-ean-code-master/items-ean-code-master.service';
import { ItemsReorderMasterService } from '../items-reorder-master/items-reorder-master.service';
import { SaveItemCompositeDto } from './dto/save-item-composite.dto';
import { ItemsMasterService } from './items-master.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46aa01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46aa02';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46aa03';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46aa04';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46aa05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46aa06';
const OTHER_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46aa99';

const makeItemRecord = (overrides: Partial<ItemMaster> = {}): ItemMaster =>
  ({
    itemId: ITEM_ID,
    itemCompanyId: COMPANY_ID,
    itemBranchId: null,
    itemCode: null,
    itemSku: null,
    itemNameEn: 'Widget',
    itemNameTa: null,
    itemAlias: null,
    itemStockType: 'FG',
    itemDefaultBarcode: null,
    itemGroupId: GROUP_ID,
    itemCategoryId: null,
    itemBrandId: null,
    itemSectionId: null,
    itemCompanyCategoryId: null,
    itemMfgrId: null,
    itemSupplierId: null,
    itemCustGroup: null,
    itemBaseUnitId: UNIT_ID,
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
    itemDefaultTaxId: null,
    itemHsnCode: null,
    itemBatchConfig: 0,
    itemSortOrder: null,
    itemPhoto: null,
    itemImageUrl: null,
    itemNotes: null,
    itemStorageLocation: null,
    itemPackingItemIds: [],
    itemIsActive: true,
    itemIsDeleted: false,
    itemCreatedOn: new Date('2026-03-25T10:00:00.000Z'),
    itemCreatedBy: USER_ID,
    itemModifiedOn: new Date('2026-03-25T10:00:00.000Z'),
    itemModifiedBy: USER_ID,
    ...overrides,
  }) as ItemMaster;

type PrismaMock = {
  itemMaster: {
    create: jest.Mock<Promise<ItemMaster>, [Prisma.ItemMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemMaster | null>, [Prisma.ItemMasterFindFirstArgs]>;
    update: jest.Mock<Promise<ItemMaster>, [Prisma.ItemMasterUpdateArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ChildServiceMock = { save: jest.Mock };

// The first array of dtos passed to a child service's save(), typed for assertions.
const savedRows = (mock: jest.Mock): Array<Record<string, unknown>> =>
  (mock.mock.calls as unknown as unknown[][])[0][0] as Array<Record<string, unknown>>;

describe('ItemsMasterService.saveComposite', () => {
  let service: ItemsMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let requestContextService: Pick<RequestContextService, 'getUserId'>;
  let unitConversionService: ChildServiceMock;
  let priceService: ChildServiceMock;
  let eanCodeService: ChildServiceMock;
  let reorderService: ChildServiceMock;

  beforeEach(() => {
    prisma = {
      itemMaster: {
        create: jest.fn<Promise<ItemMaster>, [Prisma.ItemMasterCreateArgs]>(),
        findFirst: jest.fn<Promise<ItemMaster | null>, [Prisma.ItemMasterFindFirstArgs]>(),
        update: jest.fn<Promise<ItemMaster>, [Prisma.ItemMasterUpdateArgs]>(),
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

    auditLogService = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    requestContextService = { getUserId: jest.fn().mockReturnValue(USER_ID) };

    // Child mocks echo the injected dtos back as "payloads" so the response and
    // the injection can both be asserted from the same call.
    unitConversionService = { save: jest.fn((dtos: unknown) => Promise.resolve(dtos)) };
    priceService = { save: jest.fn((dtos: unknown) => Promise.resolve(dtos)) };
    eanCodeService = { save: jest.fn((dtos: unknown) => Promise.resolve(dtos)) };
    reorderService = { save: jest.fn((dtos: unknown) => Promise.resolve(dtos)) };

    service = new ItemsMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      requestContextService as RequestContextService,
      unitConversionService as unknown as ItemUnitConversionService,
      priceService as unknown as ItemsPriceMasterService,
      eanCodeService as unknown as ItemsEanCodeMasterService,
      reorderService as unknown as ItemsReorderMasterService,
    );
  });

  const fullCompositeDto = (): SaveItemCompositeDto => ({
    item: {
      item_company_id: COMPANY_ID,
      item_name_en: 'Widget',
      item_group_id: GROUP_ID,
    },
    unit_conversions: [{ iuc_company_id: COMPANY_ID, iuc_unit_id: UNIT_ID }],
    prices: [{ ipm_unit_id: UNIT_ID, ipm_godown_id: GODOWN_ID, ipm_profit_type: 'MANUAL' }],
    ean_codes: [{ ean_unit_id: UNIT_ID, ean_code: '890123456789' }],
    reorders: [{ ir_min_level: 5 }],
  });

  it('creates the item then all children in dependency order with the parent item_id injected', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    const result = await service.saveComposite(fullCompositeDto());

    // Item created (not updated)
    expect(prisma.itemMaster.create).toHaveBeenCalledTimes(1);
    expect(prisma.itemMaster.update).not.toHaveBeenCalled();

    // Every child collection saved exactly once
    expect(unitConversionService.save).toHaveBeenCalledTimes(1);
    expect(priceService.save).toHaveBeenCalledTimes(1);
    expect(eanCodeService.save).toHaveBeenCalledTimes(1);
    expect(reorderService.save).toHaveBeenCalledTimes(1);

    // Parent item_id injected into every child row
    expect(savedRows(unitConversionService.save)).toEqual([
      expect.objectContaining({ iuc_item_id: ITEM_ID, iuc_unit_id: UNIT_ID }),
    ]);
    expect(savedRows(priceService.save)).toEqual([
      expect.objectContaining({ ipm_item_id: ITEM_ID, ipm_godown_id: GODOWN_ID }),
    ]);
    expect(savedRows(eanCodeService.save)).toEqual([
      expect.objectContaining({ ean_item_id: ITEM_ID, ean_code: '890123456789' }),
    ]);
    expect(savedRows(reorderService.save)).toEqual([
      expect.objectContaining({ ir_item_id: ITEM_ID, ir_min_level: 5 }),
    ]);

    // Response assembles the item plus all child collections
    expect(result.item.item_id).toBe(ITEM_ID);
    expect(result.unit_conversions).toHaveLength(1);
    expect(result.prices).toHaveLength(1);
    expect(result.ean_codes).toHaveLength(1);
    expect(result.reorders).toHaveLength(1);
  });

  it('saves prices only after unit conversions (order matters)', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const order: string[] = [];
    unitConversionService.save.mockImplementation((dtos: unknown) => {
      order.push('unit_conversions');
      return Promise.resolve(dtos);
    });
    priceService.save.mockImplementation((dtos: unknown) => {
      order.push('prices');
      return Promise.resolve(dtos);
    });

    await service.saveComposite(fullCompositeDto());

    expect(order).toEqual(['unit_conversions', 'prices']);
  });

  it('injected parent item_id overwrites any client-supplied child item_id', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.unit_conversions = [
      { iuc_company_id: COMPANY_ID, iuc_unit_id: UNIT_ID, iuc_item_id: OTHER_ITEM_ID },
    ];
    dto.prices = [
      {
        ipm_unit_id: UNIT_ID,
        ipm_godown_id: GODOWN_ID,
        ipm_profit_type: 'MANUAL',
        ipm_item_id: OTHER_ITEM_ID,
      },
    ];

    await service.saveComposite(dto);

    expect(savedRows(unitConversionService.save)[0].iuc_item_id).toBe(ITEM_ID);
    expect(savedRows(priceService.save)[0].ipm_item_id).toBe(ITEM_ID);
  });

  it('routes to the update flow when item_id is present', async () => {
    const existing = makeItemRecord();
    prisma.itemMaster.findFirst.mockResolvedValue(existing);
    prisma.itemMaster.update.mockResolvedValue(makeItemRecord({ itemNameEn: 'Widget v2' }));

    const dto = fullCompositeDto();
    dto.item.item_id = ITEM_ID;
    dto.item.item_name_en = 'Widget v2';

    const result = await service.saveComposite(dto);

    expect(prisma.itemMaster.update).toHaveBeenCalledTimes(1);
    expect(prisma.itemMaster.create).not.toHaveBeenCalled();
    expect(result.item.item_name_en).toBe('Widget v2');
    // Children still linked to the same (updated) item id
    expect(savedRows(priceService.save)[0].ipm_item_id).toBe(ITEM_ID);
  });

  it('does not call child services when no child arrays are provided', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    const result = await service.saveComposite({
      item: {
        item_company_id: COMPANY_ID,
        item_name_en: 'Widget',
        item_group_id: GROUP_ID,
      },
    });

    expect(unitConversionService.save).not.toHaveBeenCalled();
    expect(priceService.save).not.toHaveBeenCalled();
    expect(eanCodeService.save).not.toHaveBeenCalled();
    expect(reorderService.save).not.toHaveBeenCalled();
    expect(result.unit_conversions).toEqual([]);
    expect(result.prices).toEqual([]);
    expect(result.ean_codes).toEqual([]);
    expect(result.reorders).toEqual([]);
  });

  it('propagates a child failure after the item is already persisted (non-atomic / orphan)', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    priceService.save.mockRejectedValue(new Error('price validation failed'));

    await expect(service.saveComposite(fullCompositeDto())).rejects.toThrow(
      'price validation failed',
    );

    // Item and the earlier child (unit conversions) were already persisted;
    // later children (EAN, reorder) never ran.
    expect(prisma.itemMaster.create).toHaveBeenCalledTimes(1);
    expect(unitConversionService.save).toHaveBeenCalledTimes(1);
    expect(eanCodeService.save).not.toHaveBeenCalled();
    expect(reorderService.save).not.toHaveBeenCalled();
  });
});
