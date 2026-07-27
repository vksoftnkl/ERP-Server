import { BadRequestException } from '@nestjs/common';
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
import { ItemMasterUpdateService } from './item-master-update.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46aa01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46aa02';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46aa03';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46aa04';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46aa05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46aa06';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46aa07';
const CATEGORY_ID = '019c6f6c-be87-7a11-8905-36092c46aa08';
const BASE_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46aa09';
const OTHER_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46aa99';
// A second unit the item has no item_unit_conversion row for.
const UNMAPPED_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46aa10';
// item_unit_conversion PKs. item_ean_codes.ean_unit_id and item_reorders.ir_unit_id
// store one of these, NOT a unit_id — the child save mocks stamp them on create,
// standing in for the real services' uuidv7() default.
const IUC_ID = '019c6f6c-be87-7a11-8905-36092c46ab01';

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
    itemInclusiveOfTax: false,
    itemIsActive: true,
    itemIsDeleted: false,
    itemCreatedOn: new Date('2026-03-25T10:00:00.000Z'),
    itemCreatedBy: USER_ID,
    itemModifiedOn: new Date('2026-03-25T10:00:00.000Z'),
    itemModifiedBy: USER_ID,
    ...overrides,
  }) as ItemMaster;

// The composite name-resolver batch-loads each reference master via findMany.
type LookupMock = { findMany: jest.Mock<Promise<Array<Record<string, unknown>>>, [unknown]> };
const makeLookup = (): LookupMock => ({
  findMany: jest.fn<Promise<Array<Record<string, unknown>>>, [unknown]>().mockResolvedValue([]),
});

type PrismaMock = {
  itemMaster: {
    create: jest.Mock<Promise<ItemMaster>, [Prisma.ItemMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemMaster | null>, [Prisma.ItemMasterFindFirstArgs]>;
    update: jest.Mock<Promise<ItemMaster>, [Prisma.ItemMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [Prisma.ItemMasterUpdateManyArgs]>;
  };
  company: LookupMock;
  branchMaster: LookupMock;
  unit: LookupMock;
  godownLocation: LookupMock;
  itemGroupMaster: LookupMock;
  categoryMaster: LookupMock;
  itemBrandMaster: LookupMock;
  itemSectionMaster: LookupMock;
  supplier: LookupMock;
  custGroup: LookupMock;
  itemTaxMaster: LookupMock;
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ChildServiceMock = {
  save: jest.Mock;
  findByItemId: jest.Mock;
  findIdsByItemId: jest.Mock;
  toggleDelete: jest.Mock;
};

// The first array of dtos passed to a child service's save(), typed for assertions.
const savedRows = (mock: jest.Mock): Array<Record<string, unknown>> =>
  (mock.mock.calls as unknown as unknown[][])[0][0] as Array<Record<string, unknown>>;

describe('ItemsMasterService composite endpoints', () => {
  let service: ItemsMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let requestContextService: {
    [K in 'getUserId' | 'getCompanyId']: jest.Mock<ReturnType<RequestContextService[K]>, []>;
  };
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
        updateMany: jest
          .fn<Promise<{ count: number }>, [Prisma.ItemMasterUpdateManyArgs]>()
          .mockResolvedValue({ count: 1 }),
      },
      company: makeLookup(),
      branchMaster: makeLookup(),
      unit: makeLookup(),
      godownLocation: makeLookup(),
      itemGroupMaster: makeLookup(),
      categoryMaster: makeLookup(),
      itemBrandMaster: makeLookup(),
      itemSectionMaster: makeLookup(),
      supplier: makeLookup(),
      custGroup: makeLookup(),
      itemTaxMaster: makeLookup(),
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
    requestContextService = {
      getUserId: jest.fn().mockReturnValue(USER_ID),
      // Unscoped (super-admin) token, so item_company_id comes from the body.
      getCompanyId: jest.fn().mockReturnValue(null),
    };

    // Child save mocks echo the injected dtos back as "payloads", stamping the
    // row's PK when the dto has none (the real services let the DB default it).
    // Saved rows are also recorded so findByItemId echoes them afterwards,
    // matching the diff-sync flow (fetch existing -> save -> re-fetch); it
    // starts empty, so every payload row is treated as a create. toggleDelete
    // echoes ids as {*_id, deleted: true}; all mocks are overridden per test
    // where relevant.
    const makeChildServiceMock = (idField: string, generatedId: string): ChildServiceMock => {
      const saved: Record<string, unknown>[] = [];
      return {
        save: jest.fn((dtos: unknown) => {
          const rows = (Array.isArray(dtos) ? dtos : [dtos]).map(
            (dto: Record<string, unknown>) => ({
              ...dto,
              [idField]: dto[idField] ?? generatedId,
            }),
          );
          saved.push(...rows);
          return Promise.resolve(rows);
        }),
        findByItemId: jest.fn(() => Promise.resolve([...saved])),
        findIdsByItemId: jest.fn().mockResolvedValue([]),
        toggleDelete: jest.fn((ids: string[]) =>
          Promise.resolve(ids.map((id) => ({ [idField]: id, deleted: true }))),
        ),
      };
    };
    unitConversionService = makeChildServiceMock('iuc_id', IUC_ID);
    priceService = makeChildServiceMock('ipm_id', 'p1');
    eanCodeService = makeChildServiceMock('ean_id', 'e1');
    reorderService = makeChildServiceMock('ir_id', 'r1');

    const itemMasterUpdateService = new ItemMasterUpdateService(
      unitConversionService as unknown as ItemUnitConversionService,
      priceService as unknown as ItemsPriceMasterService,
      eanCodeService as unknown as ItemsEanCodeMasterService,
      reorderService as unknown as ItemsReorderMasterService,
    );

    service = new ItemsMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      requestContextService as unknown as RequestContextService,
      unitConversionService as unknown as ItemUnitConversionService,
      priceService as unknown as ItemsPriceMasterService,
      eanCodeService as unknown as ItemsEanCodeMasterService,
      reorderService as unknown as ItemsReorderMasterService,
      itemMasterUpdateService,
    );
  });

  const fullCompositeDto = (): SaveItemCompositeDto => ({
    item_company_id: COMPANY_ID,
    item_name_en: 'Widget',
    item_group_id: GROUP_ID,
    unit_conversions: [{ iuc_unit_id: UNIT_ID }],
    prices: [{ ipm_uc_unit_id: UNIT_ID, ipm_godown_id: GODOWN_ID, ipm_profit_type: 'MANUAL' }],
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

  it('saves children in dependency order: unit conversions, then prices, then EAN codes', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const order: string[] = [];
    // Record the call order but delegate to the mock's real behavior, so the
    // saved conversion rows still exist for the EAN unit resolution downstream.
    const trackOrder = (mock: jest.Mock, label: string): void => {
      const original = mock.getMockImplementation() as (dtos: unknown) => Promise<unknown>;
      mock.mockImplementation((dtos: unknown) => {
        order.push(label);
        return original(dtos);
      });
    };
    trackOrder(unitConversionService.save, 'unit_conversions');
    trackOrder(priceService.save, 'prices');
    trackOrder(eanCodeService.save, 'ean_codes');

    await service.saveComposite(fullCompositeDto());

    // Conversions must land before EAN codes: the EAN rows store an iuc_id from them.
    expect(order).toEqual(['unit_conversions', 'prices', 'ean_codes']);
  });

  it('injected parent item_id overwrites any client-supplied child item_id', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.unit_conversions = [{ iuc_unit_id: UNIT_ID, iuc_item_id: OTHER_ITEM_ID }];
    dto.prices = [
      {
        ipm_uc_unit_id: UNIT_ID,
        ipm_godown_id: GODOWN_ID,
        ipm_profit_type: 'MANUAL',
        ipm_item_id: OTHER_ITEM_ID,
      },
    ];

    await service.saveComposite(dto);

    expect(savedRows(unitConversionService.save)[0].iuc_item_id).toBe(ITEM_ID);
    expect(savedRows(priceService.save)[0].ipm_item_id).toBe(ITEM_ID);
  });

  it('injects the parent item_id into EVERY row of a multi-row collection', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.prices = [
      { ipm_uc_unit_id: UNIT_ID, ipm_godown_id: GODOWN_ID, ipm_profit_type: 'MANUAL' },
      {
        ipm_uc_unit_id: UNIT_ID,
        ipm_godown_id: GODOWN_ID,
        ipm_profit_type: 'MANUAL',
        ipm_item_id: OTHER_ITEM_ID,
      },
    ];

    await service.saveComposite(dto);

    const savedPrices = savedRows(priceService.save);
    expect(savedPrices).toHaveLength(2);
    expect(savedPrices.every((row) => row.ipm_item_id === ITEM_ID)).toBe(true);
  });

  it('routes to the update flow when item_id is present', async () => {
    const existing = makeItemRecord();
    prisma.itemMaster.findFirst.mockResolvedValue(existing);
    prisma.itemMaster.update.mockResolvedValue(makeItemRecord({ itemNameEn: 'Widget v2' }));

    const dto = fullCompositeDto();
    dto.item_id = ITEM_ID;
    dto.item_name_en = 'Widget v2';

    const result = await service.saveComposite(dto);

    expect(prisma.itemMaster.update).toHaveBeenCalledTimes(1);
    expect(prisma.itemMaster.create).not.toHaveBeenCalled();
    expect(result.item.item_name_en).toBe('Widget v2');
    // Children still linked to the same (updated) item id
    expect(savedRows(priceService.save)[0].ipm_item_id).toBe(ITEM_ID);
  });

  it('always takes item_company_id from the body, ignoring the token company', async () => {
    // Even when the token carries a company, it must never silently override
    // (or stand in for) the body's item_company_id.
    requestContextService.getCompanyId.mockReturnValue('019c6f6c-be87-7a11-8905-36092c46aaff');
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    await service.saveComposite({
      item_company_id: COMPANY_ID,
      item_name_en: 'Widget',
      item_group_id: GROUP_ID,
    });

    expect(prisma.itemMaster.create.mock.calls[0][0].data.itemCompanyId).toBe(COMPANY_ID);
  });

  it('creates with a null company when the body omits item_company_id', async () => {
    // The company scope is optional (item_company_id is nullable): an omitted
    // company is stored as null rather than borrowed from the token.
    requestContextService.getCompanyId.mockReturnValue('019c6f6c-be87-7a11-8905-36092c46aaff');
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    await service.saveComposite({
      item_name_en: 'Widget',
      item_group_id: GROUP_ID,
    } as SaveItemCompositeDto);

    expect(prisma.itemMaster.create.mock.calls[0][0].data.itemCompanyId).toBeNull();
  });

  it('updates with a null company when the body omits item_company_id', async () => {
    requestContextService.getCompanyId.mockReturnValue('019c6f6c-be87-7a11-8905-36092c46aaff');
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord());
    prisma.itemMaster.update.mockResolvedValue(makeItemRecord());

    const { item_company_id: _omitted, ...rest } = fullCompositeDto();
    const dto = { ...rest, item_id: ITEM_ID } as SaveItemCompositeDto;

    await service.saveComposite(dto);

    expect(prisma.itemMaster.update.mock.calls[0][0].data.itemCompanyId).toBeNull();
  });

  it('does not call child services when no child arrays are provided', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    const result = await service.saveComposite({
      item_company_id: COMPANY_ID,
      item_name_en: 'Widget',
      item_group_id: GROUP_ID,
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

  it('runs the item and every child on ONE transaction, so a child failure rolls the item back', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    priceService.save.mockRejectedValue(new Error('price validation failed'));

    await expect(service.saveComposite(fullCompositeDto())).rejects.toThrow(
      'price validation failed',
    );

    // One transaction spans the whole save, and the failure escapes it: the item
    // insert and the earlier children are rolled back with it, not left behind.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Later children never ran.
    expect(eanCodeService.save).not.toHaveBeenCalled();
    expect(reorderService.save).not.toHaveBeenCalled();
    // The children that did run were handed the caller's transaction, not left
    // to open their own (which would commit independently of the rollback).
    const tx = unitConversionService.save.mock.calls[0][1] as unknown;
    expect(tx).toBeDefined();
  });

  it('stores the unit conversion iuc_id — not the raw unit_id — in the EAN unit column', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    await service.saveComposite(fullCompositeDto());

    // The payload named UNIT_ID; the conversion row saved for that unit is IUC_ID,
    // and that is what lands in item_ean_codes.ean_unit_id (a FK to iuc_id).
    expect(savedRows(unitConversionService.save)[0].iuc_unit_id).toBe(UNIT_ID);
    expect(savedRows(eanCodeService.save)[0].ean_unit_id).toBe(IUC_ID);
  });

  it('stores the unit conversion iuc_id in the reorder unit column, and leaves a null unit null', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.reorders = [
      { ir_unit_id: UNIT_ID, ir_min_level: 5 },
      // No unit scoping: the global rule, which must stay null rather than resolve.
      { ir_min_level: 1 },
    ];

    await service.saveComposite(dto);

    const savedReorders = savedRows(reorderService.save);
    expect(savedReorders[0].ir_unit_id).toBe(IUC_ID);
    expect(savedReorders[1].ir_unit_id).toBeUndefined();
  });

  it('accepts a unit column that already holds an iuc_id (a getComposite response echoed back)', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.ean_codes = [{ ean_unit_id: IUC_ID, ean_code: '890123456789' }];

    await service.saveComposite(dto);

    expect(savedRows(eanCodeService.save)[0].ean_unit_id).toBe(IUC_ID);
  });

  it('stores the unit conversion iuc_id — not the raw unit_id — in the price unit column', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());

    // The payload names UNIT_ID; ipm_uc_unit_id is a FK to iuc_id, so the
    // item's conversion row for that unit is what must land in the column.
    await service.saveComposite(fullCompositeDto());

    expect(savedRows(priceService.save)[0].ipm_uc_unit_id).toBe(IUC_ID);
  });

  it('saves a price with no godown as a global row', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    // ipm_godown_id is optional: omitted means the price applies to every godown.
    dto.prices = [{ ipm_uc_unit_id: UNIT_ID, ipm_profit_type: 'MANUAL' }];

    await service.saveComposite(dto);

    const saved = savedRows(priceService.save)[0];
    expect(saved.ipm_godown_id).toBeUndefined();
    expect(saved.ipm_uc_unit_id).toBe(IUC_ID);
  });

  it('accepts a price unit column that already holds an iuc_id', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.prices = [{ ipm_uc_unit_id: IUC_ID, ipm_godown_id: GODOWN_ID, ipm_profit_type: 'MANUAL' }];

    await service.saveComposite(dto);

    expect(savedRows(priceService.save)[0].ipm_uc_unit_id).toBe(IUC_ID);
  });

  it('rejects a price whose unit has no conversion row, and saves nothing', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.prices = [
      { ipm_uc_unit_id: UNMAPPED_UNIT_ID, ipm_godown_id: GODOWN_ID, ipm_profit_type: 'MANUAL' },
    ];

    await expect(service.saveComposite(dto)).rejects.toThrow(BadRequestException);

    expect(priceService.save).not.toHaveBeenCalled();
  });

  it('rejects an EAN code whose unit has no conversion row, and saves nothing', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.ean_codes = [{ ean_unit_id: UNMAPPED_UNIT_ID, ean_code: '890123456789' }];

    await expect(service.saveComposite(dto)).rejects.toThrow(BadRequestException);

    // Thrown inside the transaction, so the item and the conversions it did write
    // roll back; the EAN rows themselves never reached the database.
    expect(eanCodeService.save).not.toHaveBeenCalled();
    expect(reorderService.save).not.toHaveBeenCalled();
  });

  it('rejects a reorder whose unit has no conversion row', async () => {
    prisma.itemMaster.create.mockResolvedValue(makeItemRecord());
    const dto = fullCompositeDto();
    dto.reorders = [{ ir_unit_id: UNMAPPED_UNIT_ID, ir_min_level: 5 }];

    await expect(service.saveComposite(dto)).rejects.toThrow(BadRequestException);

    expect(reorderService.save).not.toHaveBeenCalled();
  });

  it('resolves EAN/reorder units against conversions the item already has when none are sent', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord());
    prisma.itemMaster.update.mockResolvedValue(makeItemRecord());
    // Conversions omitted from the payload -> untouched, but still the source of
    // truth for resolving the EAN row's unit, so they are re-read from the item.
    unitConversionService.findByItemId.mockResolvedValue([
      { iuc_id: IUC_ID, iuc_item_id: ITEM_ID, iuc_unit_id: UNIT_ID },
    ]);

    await service.saveComposite({
      item_id: ITEM_ID,
      item_company_id: COMPANY_ID,
      item_name_en: 'Widget',
      item_group_id: GROUP_ID,
      ean_codes: [{ ean_unit_id: UNIT_ID, ean_code: '890123456789' }],
    });

    expect(unitConversionService.save).not.toHaveBeenCalled();
    expect(savedRows(eanCodeService.save)[0].ean_unit_id).toBe(IUC_ID);
  });

  it('getComposite assembles the item with all child collections fetched by item id', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord());
    unitConversionService.findByItemId.mockResolvedValue([{ iuc_id: 'uc1' }]);
    priceService.findByItemId.mockResolvedValue([{ ipm_id: 'p1' }, { ipm_id: 'p2' }]);
    eanCodeService.findByItemId.mockResolvedValue([{ ean_id: 'e1' }]);
    reorderService.findByItemId.mockResolvedValue([{ ir_id: 'r1' }]);

    const result = await service.getComposite(ITEM_ID);

    expect(unitConversionService.findByItemId).toHaveBeenCalledWith(ITEM_ID);
    expect(priceService.findByItemId).toHaveBeenCalledWith(ITEM_ID);
    expect(eanCodeService.findByItemId).toHaveBeenCalledWith(ITEM_ID);
    expect(reorderService.findByItemId).toHaveBeenCalledWith(ITEM_ID);

    expect(result.item.item_id).toBe(ITEM_ID);
    expect(result.unit_conversions).toHaveLength(1);
    expect(result.prices).toHaveLength(2);
    expect(result.ean_codes).toHaveLength(1);
    expect(result.reorders).toHaveLength(1);
  });

  it('getComposite resolves foreign-key names onto the item and every child row', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(
      makeItemRecord({ itemBranchId: BRANCH_ID, itemCategoryId: CATEGORY_ID }),
    );
    unitConversionService.findByItemId.mockResolvedValue([
      {
        iuc_id: IUC_ID,
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: BASE_UNIT_ID,
      },
    ]);
    priceService.findByItemId.mockResolvedValue([
      {
        ipm_id: 'p1',
        ipm_company_id: COMPANY_ID,
        ipm_branch_id: BRANCH_ID,
        ipm_item_id: ITEM_ID,
        ipm_uc_unit_id: IUC_ID,
        ipm_godown_id: GODOWN_ID,
      },
    ]);
    // ipm_uc_unit_id / ean_unit_id / ir_unit_id hold an iuc_id, so their unit name is
    // resolved by hopping through the conversion row above to UNIT_ID.
    eanCodeService.findByItemId.mockResolvedValue([
      { ean_id: 'e1', ean_item_id: ITEM_ID, ean_unit_id: IUC_ID },
    ]);
    reorderService.findByItemId.mockResolvedValue([
      {
        ir_id: 'r1',
        ir_branch_id: BRANCH_ID,
        ir_item_id: ITEM_ID,
        ir_unit_id: IUC_ID,
        ir_godown_id: GODOWN_ID,
      },
    ]);

    prisma.company.findMany.mockResolvedValue([{ compId: COMPANY_ID, compName: 'Acme' }]);
    prisma.branchMaster.findMany.mockResolvedValue([{ brId: BRANCH_ID, brName: 'HQ' }]);
    prisma.unit.findMany.mockResolvedValue([
      { unit_id: UNIT_ID, unit_name: 'PCS' },
      { unit_id: BASE_UNIT_ID, unit_name: 'BOX' },
    ]);
    prisma.godownLocation.findMany.mockResolvedValue([{ gdlId: GODOWN_ID, gdlName: 'Main Store' }]);
    prisma.itemGroupMaster.findMany.mockResolvedValue([{ itgId: GROUP_ID, itgName: 'Hardware' }]);
    prisma.categoryMaster.findMany.mockResolvedValue([{ categoryId: CATEGORY_ID, categoryName: 'Tools' }]);

    const result = await service.getComposite(ITEM_ID);

    // Item: resolved names sit alongside the ids; the id is preserved.
    expect(result.item.item_company_id).toBe(COMPANY_ID);
    expect(result.item.item_company_name).toBe('Acme');
    expect(result.item.item_branch_name).toBe('HQ');
    expect(result.item.item_group_name).toBe('Hardware');
    expect(result.item.item_category_name).toBe('Tools');
    expect(result.item.item_base_unit_name).toBe('PCS');
    // Null id and columns with no master table resolve to null (not undefined).
    expect(result.item.item_supplier_name).toBeNull();
    expect(result.item.item_default_tax_name).toBeNull();

    // Children: distinct refs resolved.
    expect(result.unit_conversions[0].iuc_unit_name).toBe('PCS');
    expect(result.unit_conversions[0].iuc_base_unit_name).toBe('BOX');

    expect(result.prices[0].ipm_branch_name).toBe('HQ');
    // The stored iuc_id is rewritten to the unit-master id behind it, exactly
    // like the ean/reorder rows.
    expect(result.prices[0].ipm_uc_unit_id).toBe(UNIT_ID);
    expect(result.prices[0].ipm_unit_name).toBe('PCS');
    expect(result.prices[0].ipm_godown_name).toBe('Main Store');

    expect(result.ean_codes[0].ean_unit_id).toBe(UNIT_ID);
    expect(result.ean_codes[0].ean_unit_name).toBe('PCS');

    expect(result.reorders[0].ir_branch_name).toBe('HQ');
    expect(result.reorders[0].ir_unit_id).toBe(UNIT_ID);
    expect(result.reorders[0].ir_unit_name).toBe('PCS');
    expect(result.reorders[0].ir_godown_name).toBe('Main Store');

    // Reference tables are batch-loaded once each (no per-row N+1).
    expect(prisma.unit.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.godownLocation.findMany).toHaveBeenCalledTimes(1);
  });

  it('getComposite yields a null name when the referenced master row is missing', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord());
    // itemBaseUnitId is UNIT_ID but the unit lookup returns nothing.
    prisma.unit.findMany.mockResolvedValue([]);

    const result = await service.getComposite(ITEM_ID);

    expect(result.item.item_base_unit_id).toBe(UNIT_ID);
    expect(result.item.item_base_unit_name).toBeNull();
  });

  it('getComposite returns empty child arrays when the item has no children', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord());

    const result = await service.getComposite(ITEM_ID);

    expect(result.unit_conversions).toEqual([]);
    expect(result.prices).toEqual([]);
    expect(result.ean_codes).toEqual([]);
    expect(result.reorders).toEqual([]);
  });

  it('getComposite throws NotFound and does not query children when the item is missing', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(null);

    await expect(service.getComposite(ITEM_ID)).rejects.toThrow();

    expect(unitConversionService.findByItemId).not.toHaveBeenCalled();
    expect(priceService.findByItemId).not.toHaveBeenCalled();
    expect(eanCodeService.findByItemId).not.toHaveBeenCalled();
    expect(reorderService.findByItemId).not.toHaveBeenCalled();
  });

  it('toggleDeleteComposite soft-deletes an active item and cascades to its currently active children', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord({ itemIsDeleted: false }));
    unitConversionService.findIdsByItemId.mockResolvedValue(['uc1']);
    priceService.findIdsByItemId.mockResolvedValue(['p1', 'p2']);
    eanCodeService.findIdsByItemId.mockResolvedValue(['e1']);
    reorderService.findIdsByItemId.mockResolvedValue(['r1']);

    const result = await service.toggleDeleteComposite(ITEM_ID);

    // Children are looked up in their OLD (active) state, i.e. isDeleted=false
    expect(unitConversionService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, false);
    expect(priceService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, false);
    expect(eanCodeService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, false);
    expect(reorderService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, false);

    // Every matched child id is toggled (soft deleted)
    expect(unitConversionService.toggleDelete).toHaveBeenCalledWith(['uc1']);
    expect(priceService.toggleDelete).toHaveBeenCalledWith(['p1', 'p2']);
    expect(eanCodeService.toggleDelete).toHaveBeenCalledWith(['e1']);
    expect(reorderService.toggleDelete).toHaveBeenCalledWith(['r1']);

    expect(result.item).toEqual({ item_id: ITEM_ID, deleted: true });
    expect(result.unit_conversions).toHaveLength(1);
    expect(result.prices).toHaveLength(2);
    expect(result.ean_codes).toHaveLength(1);
    expect(result.reorders).toHaveLength(1);
  });

  it('toggleDeleteComposite restores a deleted item and cascades to its currently deleted children', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord({ itemIsDeleted: true }));
    unitConversionService.findIdsByItemId.mockResolvedValue(['uc1']);

    const result = await service.toggleDeleteComposite(ITEM_ID);

    // Children are looked up in their OLD (deleted) state, i.e. isDeleted=true
    expect(unitConversionService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, true);
    expect(priceService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, true);
    expect(eanCodeService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, true);
    expect(reorderService.findIdsByItemId).toHaveBeenCalledWith(ITEM_ID, true);

    expect(result.item).toEqual({ item_id: ITEM_ID, deleted: false });
  });

  it('toggleDeleteComposite skips a child service entirely when it has no matching rows', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(makeItemRecord({ itemIsDeleted: false }));
    // All findIdsByItemId mocks default to [] from beforeEach

    const result = await service.toggleDeleteComposite(ITEM_ID);

    expect(unitConversionService.toggleDelete).not.toHaveBeenCalled();
    expect(priceService.toggleDelete).not.toHaveBeenCalled();
    expect(eanCodeService.toggleDelete).not.toHaveBeenCalled();
    expect(reorderService.toggleDelete).not.toHaveBeenCalled();
    expect(result.unit_conversions).toEqual([]);
    expect(result.prices).toEqual([]);
    expect(result.ean_codes).toEqual([]);
    expect(result.reorders).toEqual([]);
  });

  it('toggleDeleteComposite throws NotFound and never queries or toggles children when the item is missing', async () => {
    prisma.itemMaster.findFirst.mockResolvedValue(null);

    await expect(service.toggleDeleteComposite(ITEM_ID)).rejects.toThrow();

    expect(unitConversionService.findIdsByItemId).not.toHaveBeenCalled();
    expect(priceService.toggleDelete).not.toHaveBeenCalled();
  });
});
