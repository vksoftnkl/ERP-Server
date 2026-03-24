import { ItemMaster, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemQueryDto } from './dto/list-item-query.dto';
import { ItemsMasterService } from './items-master.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';

type PrismaMock = {
  itemMaster: {
    count: jest.Mock<Promise<number>, [Prisma.ItemMasterCountArgs]>;
    findMany: jest.Mock<Promise<ItemMaster[]>, [Prisma.ItemMasterFindManyArgs]>;
  };
};

type ConfiguredGridSqlServiceMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
};

const makeRecord = (overrides: Partial<ItemMaster> = {}): ItemMaster =>
  ({
    itemId: ITEM_ID,
    itemCompanyId: COMPANY_ID,
    itemBranchId: null,
    itemCode: 'ITM-001',
    itemSku: 'SKU-001',
    itemNameEn: 'Soap',
    itemNameTa: null,
    itemAlias: 'Bath Soap',
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
    itemAllowNegStock: false,
    itemAllowNegativeSo: false,
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
    itemSortOrder: 1,
    itemPhoto: null,
    itemImageUrl: null,
    itemNotes: null,
    itemStorageLocation: null,
    itemPackingItemIds: [],
    itemIsActive: true,
    itemIsDeleted: false,
    itemCreatedOn: new Date('2026-03-01T08:00:00.000Z'),
    itemCreatedBy: 'system',
    itemModifiedOn: new Date('2026-03-01T08:00:00.000Z'),
    itemModifiedBy: 'system',
    ...overrides,
  }) as ItemMaster;

describe('ItemsMasterService', () => {
  let service: ItemsMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;

  beforeEach(() => {
    prisma = {
      itemMaster: {
        count: jest.fn<Promise<number>, [Prisma.ItemMasterCountArgs]>(),
        findMany: jest.fn<Promise<ItemMaster[]>, [Prisma.ItemMasterFindManyArgs]>(),
      },
    };

    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };

    configuredGridSqlService = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn().mockImplementation((candidates: unknown[]) => candidates),
      validateBaseSql: jest.fn(),
      runPagedQuery: jest.fn(),
    };

    service = new ItemsMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
    );
  });

  it('uses configured grid rows when no structured filters are provided', async () => {
    configuredGridSqlService.loadCandidates.mockResolvedValue([
      { gridId: 1n, gridSql: 'SELECT * FROM inventory.item_master' },
    ]);
    configuredGridSqlService.validateBaseSql.mockReturnValue({
      isValid: true,
      normalizedSql: 'SELECT * FROM inventory.item_master',
    });
    configuredGridSqlService.runPagedQuery.mockResolvedValue({
      items: [{ item_id: ITEM_ID, item_name_en: 'Configured Soap' }],
      total: 1,
      styles: [{ color: '#111111' }],
    });

    const result = await service.list({});

    expect(configuredGridSqlService.runPagedQuery).toHaveBeenCalledTimes(1);
    expect(prisma.itemMaster.count).not.toHaveBeenCalled();
    expect(result.items).toEqual([{ item_id: ITEM_ID, item_name_en: 'Configured Soap' }]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    });
  });

  it('falls back to prisma listing when no configured grid is available', async () => {
    prisma.itemMaster.count.mockResolvedValue(1);
    prisma.itemMaster.findMany.mockResolvedValue([makeRecord()]);

    const result = await service.list({});

    expect(configuredGridSqlService.runPagedQuery).not.toHaveBeenCalled();
    expect(prisma.itemMaster.count).toHaveBeenCalledWith({
      where: { itemIsDeleted: false },
    });
    expect(prisma.itemMaster.findMany).toHaveBeenCalledWith({
      where: { itemIsDeleted: false },
      orderBy: [{ itemSortOrder: 'asc' }, { itemNameEn: 'asc' }],
      skip: 0,
      take: 20,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      item_id: ITEM_ID,
      item_company_id: COMPANY_ID,
      item_name_en: 'Soap',
    });
    expect(result.meta.total).toBe(1);
  });

  it('skips configured grid and applies prisma filters when search is provided', async () => {
    configuredGridSqlService.loadCandidates.mockResolvedValue([
      { gridId: 1n, gridSql: 'SELECT * FROM inventory.item_master' },
    ]);
    configuredGridSqlService.validateBaseSql.mockReturnValue({
      isValid: true,
      normalizedSql: 'SELECT * FROM inventory.item_master',
    });
    prisma.itemMaster.count.mockResolvedValue(1);
    prisma.itemMaster.findMany.mockResolvedValue([
      makeRecord({ itemNameEn: 'Search Match', itemAlias: 'Matched Alias' }),
    ]);

    const query: ListItemQueryDto = {
      search: 'match',
    };

    const result = await service.list(query);

    expect(configuredGridSqlService.runPagedQuery).not.toHaveBeenCalled();
    expect(prisma.itemMaster.count).toHaveBeenCalledWith({
      where: {
        itemIsDeleted: false,
        OR: [
          { itemNameEn: { contains: 'match', mode: 'insensitive' } },
          { itemCode: { contains: 'match', mode: 'insensitive' } },
          { itemSku: { contains: 'match', mode: 'insensitive' } },
          { itemAlias: { contains: 'match', mode: 'insensitive' } },
          { itemDefaultBarcode: { contains: 'match', mode: 'insensitive' } },
          { itemHsnCode: { contains: 'match', mode: 'insensitive' } },
          { itemNotes: { contains: 'match', mode: 'insensitive' } },
        ],
      },
    });
    expect(result.items[0]).toMatchObject({
      item_name_en: 'Search Match',
    });
  });
});
