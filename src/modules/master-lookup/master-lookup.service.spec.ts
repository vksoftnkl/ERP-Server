import { PgService } from '../../database/pg/pg.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MasterLookupService } from './master-lookup.service';

type PrismaMock = {
  dropdownDetails: {
    findMany: jest.Mock;
  };
  custGroup: {
    findMany: jest.Mock;
  };
  itemMaster: {
    findMany: jest.Mock;
  };
  company: {
    findMany: jest.Mock;
  };
};

type PgMock = {
  queryReadOnly: jest.Mock;
};

const pgRows = (rows: unknown[]) => ({ rows });

describe('MasterLookupService', () => {
  let service: MasterLookupService;
  let prisma: PrismaMock;
  let pg: PgMock;

  beforeEach(() => {
    prisma = {
      dropdownDetails: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      custGroup: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      itemMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      company: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    pg = {
      queryReadOnly: jest.fn().mockResolvedValue(pgRows([])),
    };

    service = new MasterLookupService(prisma as unknown as PrismaService, pg as unknown as PgService);
  });

  it('uses configured regional dropdown SQL and dropdown columns for module lookups', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 1,
        dropdownName: 'Item Master',
        dropdownSql: 'SELECT item_id, item_name FROM item_master',
        dropdownSqlRegional:
          'SELECT regional_item_id AS item_id, regional_item_name AS item_name, FROM regional_items',
        dropdownSortColumn: 'item_name',
        dropdownSortOrder: 'DESC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'item_id',
            dropdownColumnsAlias: 'Item Id',
            dropdownColumnsFilter: false,
          },
          {
            dropdownColumnsNo: 2,
            dropdownColumnsName: 'item_name',
            dropdownColumnsAlias: 'Item Name',
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockResolvedValue(pgRows([
      { item_id: 'ITEM-1', item_name: 'Milk', item_code: 'MILK-001' },
    ]));

    const result = await service.getAllAccountsAndMasterNameIds('items');

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-1', name: 'Milk', item_id: 'ITEM-1', item_name: 'Milk', item_code: 'MILK-001' }],
    });
    expect(prisma.itemMaster.findMany).not.toHaveBeenCalled();
    expect(pg.queryReadOnly).toHaveBeenCalledTimes(1);

    const [sql, ...params] = pg.queryReadOnly.mock.calls[0];
    expect(String(sql)).toContain('SELECT regional_item_id AS item_id');
    expect(String(sql)).toContain('regional_item_name AS item_name FROM regional_items');
    expect(String(sql)).not.toContain(', FROM regional_items');
    expect(params).toEqual([]);
  });

  it('prefers actual SQL row keys when dropdown columns only contain display labels', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 3,
        dropdownName: 'customerGroups',
        dropdownSql: 'SELECT cgr_id, cgr_branch_id, cgr_name, cgr_alias FROM sales.cust_groups',
        dropdownSqlRegional: null,
        dropdownSortColumn: 'Cus group name',
        dropdownSortOrder: 'ASC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'Cus group name',
            dropdownColumnsAlias: 'cus grp name',
            dropdownColumnsFilter: false,
          },
          {
            dropdownColumnsNo: 2,
            dropdownColumnsName: 'cust group Alias',
            dropdownColumnsAlias: 'cust group Alias',
            dropdownColumnsFilter: false,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockResolvedValue(pgRows([
      {
        cgr_id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
        cgr_branch_id: null,
        cgr_name: 'Retail',
        cgr_alias: 'RTL',
      },
    ]));

    const result = await service.getAllAccountsAndMasterNameIds('customerGroups');

    expect(result).toEqual({
      scope: 'masters',
      module: 'customerGroups',
      items: [
        {
          id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
          name: 'Retail',
          cgr_id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
          cgr_branch_id: null,
          cgr_name: 'Retail',
          cgr_alias: 'RTL',
        },
      ],
    });
    expect(pg.queryReadOnly).toHaveBeenCalledTimes(1);
    expect(prisma.custGroup.findMany).not.toHaveBeenCalled();
  });

  it('does not substitute id into name for configured dropdown SQL rows', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 8,
        dropdownName: 'customerGroups',
        dropdownSql: 'SELECT cgr_id FROM sales.cust_groups',
        dropdownSqlRegional: null,
        dropdownSortColumn: null,
        dropdownSortOrder: null,
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'cgr_id',
            dropdownColumnsAlias: 'Customer Group Id',
            dropdownColumnsFilter: false,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockResolvedValue(pgRows([
      {
        cgr_id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
      },
    ]));

    const result = await service.getAllAccountsAndMasterNameIds('customerGroups');

    expect(result).toEqual({
      scope: 'masters',
      module: 'customerGroups',
      items: [
        {
          id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
          name: '',
          cgr_id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
        },
      ],
    });
    expect(pg.queryReadOnly).toHaveBeenCalledTimes(1);
    expect(prisma.custGroup.findMany).not.toHaveBeenCalled();
  });

  it('falls back to Prisma table queries when configured dropdown SQL is unusable', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 1,
        dropdownName: 'Item',
        dropdownSql: 'tet',
        dropdownSqlRegional: null,
        dropdownSortColumn: null,
        dropdownSortOrder: null,
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'item_id',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    prisma.itemMaster.findMany.mockResolvedValue([
      {
        itemId: 'ITEM-2',
        itemNameEn: 'Bread',
      },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('items');

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-2', name: 'Bread' }],
    });
    expect(pg.queryReadOnly).not.toHaveBeenCalled();
    expect(prisma.itemMaster.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to Prisma table queries when configured dropdown SQL execution fails', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 1,
        dropdownName: 'Item',
        dropdownSql: 'SELECT item_id, item_name FROM item_master',
        dropdownSqlRegional: null,
        dropdownSortColumn: 'Item Name',
        dropdownSortOrder: 'ASC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'Item Name',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockRejectedValue(new Error('broken dropdown sql'));
    prisma.itemMaster.findMany.mockResolvedValue([
      {
        itemId: 'ITEM-3',
        itemNameEn: 'Butter',
      },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('items');

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-3', name: 'Butter' }],
    });
    expect(pg.queryReadOnly).toHaveBeenCalledTimes(1);
    expect(prisma.itemMaster.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to dropdown_sql when dropdown_sql_regional execution fails', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 1,
        dropdownName: 'Item',
        dropdownSql: 'SELECT item_id, item_name FROM item_master',
        dropdownSqlRegional: 'SELECT item_id, item_name FROM regional_item_master',
        dropdownSortColumn: 'item_name',
        dropdownSortOrder: 'ASC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'item_id',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: false,
          },
          {
            dropdownColumnsNo: 2,
            dropdownColumnsName: 'item_name',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    pg.queryReadOnly
      .mockRejectedValueOnce(new Error('broken regional dropdown sql'))
      .mockResolvedValueOnce(pgRows([
        {
          item_id: 'ITEM-4',
          item_name: 'Cheese',
        },
      ]));

    const result = await service.getAllAccountsAndMasterNameIds('items');

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-4', name: 'Cheese', item_id: 'ITEM-4', item_name: 'Cheese' }],
    });
    expect(pg.queryReadOnly).toHaveBeenCalledTimes(2);
    expect(String(pg.queryReadOnly.mock.calls[0][0])).toContain(
      'SELECT item_id, item_name FROM regional_item_master',
    );
    expect(String(pg.queryReadOnly.mock.calls[1][0])).toContain(
      'SELECT item_id, item_name FROM item_master',
    );
    expect(prisma.itemMaster.findMany).not.toHaveBeenCalled();
  });

  it('rewrites stale configured table names before executing dropdown SQL', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 9,
        dropdownName: 'Branches',
        dropdownSql:
          'SELECT br_id, br_name FROM accounts.branch_master UNION SELECT unit_id, unit_name FROM inventory.units',
        dropdownSqlRegional: null,
        dropdownSortColumn: 'br_name',
        dropdownSortOrder: 'ASC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'br_id',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: false,
          },
          {
            dropdownColumnsNo: 2,
            dropdownColumnsName: 'br_name',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockResolvedValue(pgRows([
      {
        br_id: 'BR-1',
        br_name: 'Main Branch',
      },
    ]));

    const result = await service.getAllAccountsAndMasterNameIds('branches');

    expect(result).toEqual({
      scope: 'accounts',
      module: 'branches',
      items: [{ id: 'BR-1', name: 'Main Branch', br_id: 'BR-1', br_name: 'Main Branch' }],
    });
    const [sql] = pg.queryReadOnly.mock.calls[0];
    expect(String(sql)).toContain('public.branch_master');
    expect(String(sql)).toContain('inventory.item_unit_master');
    expect(String(sql)).not.toContain('accounts.branch_master');
    expect(String(sql)).not.toContain('inventory.units');
  });

  it('rewrites stale configured company table names before executing dropdown SQL', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 10,
        dropdownName: 'Companies',
        dropdownSql: 'SELECT comp_id, comp_name FROM accounts.companys',
        dropdownSqlRegional: null,
        dropdownSortColumn: 'comp_name',
        dropdownSortOrder: 'ASC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'comp_id',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: false,
          },
          {
            dropdownColumnsNo: 2,
            dropdownColumnsName: 'comp_name',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockResolvedValue(pgRows([
      {
        comp_id: 'COMP-1',
        comp_name: 'Acme Pvt Ltd',
      },
    ]));

    const result = await service.getAllAccountsAndMasterNameIds('companies');

    expect(result).toEqual({
      scope: 'accounts',
      module: 'companies',
      items: [{ id: 'COMP-1', name: 'Acme Pvt Ltd', comp_id: 'COMP-1', comp_name: 'Acme Pvt Ltd' }],
    });
    const [sql] = pg.queryReadOnly.mock.calls[0];
    expect(String(sql)).toContain('public.companys');
    expect(String(sql)).not.toContain('accounts.companys');
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('matches configured dropdown records by master page display names', async () => {
    prisma.dropdownDetails.findMany.mockResolvedValue([
      {
        dropdownId: 11,
        dropdownName: 'GSP Service Master',
        dropdownSql: 'SELECT ttm_type_id, ttm_type_name FROM accounts.acc_tender_types',
        dropdownSqlRegional: null,
        dropdownSortColumn: 'ttm_type_name',
        dropdownSortOrder: 'ASC',
        dropdownColumns: [
          {
            dropdownColumnsNo: 1,
            dropdownColumnsName: 'ttm_type_id',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: false,
          },
          {
            dropdownColumnsNo: 2,
            dropdownColumnsName: 'ttm_type_name',
            dropdownColumnsAlias: null,
            dropdownColumnsFilter: true,
          },
        ],
      },
    ]);
    pg.queryReadOnly.mockResolvedValue(pgRows([
      {
        ttm_type_id: 1,
        ttm_type_name: 'E-Invoice',
      },
    ]));

    const result = await service.getAllAccountsAndMasterNameIds('tenderTypes');

    expect(result).toEqual({
      scope: 'accounts',
      module: 'tenderTypes',
      items: [{ id: '1', name: 'E-Invoice', ttm_type_id: 1, ttm_type_name: 'E-Invoice' }],
    });
    expect(pg.queryReadOnly).toHaveBeenCalledTimes(1);
  });

  it('falls back to Prisma table queries when no dropdown mapping exists for the module', async () => {
    prisma.company.findMany.mockResolvedValue([
      {
        compId: 'COMP-1',
        compName: 'Acme Pvt Ltd',
      },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('companies');

    expect(result).toEqual({
      scope: 'accounts',
      module: 'companies',
      items: [{ id: 'COMP-1', name: 'Acme Pvt Ltd' }],
    });
    expect(pg.queryReadOnly).not.toHaveBeenCalled();
    expect(prisma.company.findMany).toHaveBeenCalledTimes(1);
  });

  describe('getItemPriceLookup', () => {
    const ITEM_ID = 'ITEM-1';
    const priceRow = (ipmId: string, slno: number, priceA: number, branchId: string | null = null) => ({
      ipmId,
      ipmItemId: ITEM_ID,
      ipmBranchId: branchId,
      ipmUcUnitId: `IUC-${slno}`,
      ipmGodownId: null,
      ipmCostPrice: 0,
      ipmCostWot: 0,
      ipmSalesPriceA: priceA,
      ipmSalesPriceB: 0,
      ipmSalesPriceC: 0,
      ipmSalesPriceD: 0,
      ipmMinPrice: 0,
      ipmMaxPrice: 0,
      ipmDiscPerc: 0,
      ipmDiscQty: 0,
      ipmAddlCess: 0,
      ipmLoyaltyPoints: 0,
      itemUnitConversion: {
        iucUnitId: `UNIT-${slno}`,
        iucUnitSlno: slno,
        iucBaseUnitId: 'UNIT-BASE',
        iucToBaseFactor: slno,
        unit: { unit_name: `UNIT-${slno}`, unit_weight: 0, unit_loading: 0, unit_decimal_count: 2 },
      },
    });

    const itemRow = (overrides: Record<string, unknown> = {}) => ({
      itemId: ITEM_ID,
      itemNameEn: 'A001',
      itemNameTa: null,
      itemCode: 'A001',
      itemSku: null,
      itemDefaultBarcode: null,
      itemGroupId: 'GRP-1',
      itemCategoryId: null,
      itemDefaultTaxId: null,
      itemRetailItem: false,
      itemAllowPromo: false,
      itemAllowFreight: true,
      itemAllowLoading: true,
      itemAllowLoyalty: false,
      itemAllowNegStock: false,
      itemIsService: false,
      itemWeighScale: false,
      itemBatchConfig: 0,
      ...overrides,
    });

    const mockItemPricePrisma = (item: unknown, rows: unknown[]) => {
      Object.assign(prisma as unknown as Record<string, unknown>, {
        itemMaster: { ...prisma.itemMaster, findFirst: jest.fn().mockResolvedValue(item) },
        itemPriceMaster: { findMany: jest.fn().mockResolvedValue(rows) },
        godownLocation: { findFirst: jest.fn().mockResolvedValue(null) },
        itemTaxMaster: { findFirst: jest.fn().mockResolvedValue(null) },
        company: { ...prisma.company, findFirst: jest.fn().mockResolvedValue(null) },
        custItemRate: { findFirst: jest.fn().mockResolvedValue(null) },
        itemReorder: { findFirst: jest.fn().mockResolvedValue(null) },
        itemStockBalance: { aggregate: jest.fn() },
      });
    };

    it('picks the lowest-slno price row as the base unit when slno numbering starts at 1', async () => {
      // item_unit_conversion numbers an item's units from 1, so the legacy
      // "base unit = slno 0" rule found nothing and the lookup 404'd.
      mockItemPricePrisma(itemRow(), [priceRow('IPM-2', 2, 250), priceRow('IPM-1', 1, 115)]);

      const result = await service.getItemPriceLookup({
        item_id: ITEM_ID,
        price_level: 1,
      } as never);

      expect(result.unit_rate_id).toBe('IPM-1');
      expect(result.sales_price).toBe(115);
    });

    it('prefers the branch rate over the branch-less one pricing the same unit', async () => {
      // A NULL-branch row prices every branch, but the branch's own rate is the
      // more specific of the two and must not be shadowed by it.
      mockItemPricePrisma(itemRow(), [
        priceRow('IPM-BRANCH', 1, 115, 'BRANCH-1'),
        priceRow('IPM-ALL', 1, 0, null),
      ]);

      const result = await service.getItemPriceLookup({
        item_id: ITEM_ID,
        branch_id: 'BRANCH-1',
        price_level: 1,
      } as never);

      expect(result.unit_rate_id).toBe('IPM-BRANCH');
      expect(result.sales_price).toBe(115);
    });

    it('falls back to a branch-less rate for a unit the branch does not price', async () => {
      mockItemPricePrisma(itemRow(), [
        priceRow('IPM-BRANCH', 1, 115, 'BRANCH-1'),
        priceRow('IPM-ALL', 2, 250, null),
      ]);

      const result = await service.getItemPriceLookup({
        item_id: ITEM_ID,
        branch_id: 'BRANCH-1',
        unit_id: 'UNIT-2',
        price_level: 1,
      } as never);

      expect(result.unit_rate_id).toBe('IPM-ALL');
      expect(result.sales_price).toBe(250);
    });

    it('picks the highest-slno price row for a retail item', async () => {
      mockItemPricePrisma(itemRow({ itemRetailItem: true }), [
        priceRow('IPM-1', 1, 115),
        priceRow('IPM-2', 2, 250),
      ]);

      const result = await service.getItemPriceLookup({
        item_id: ITEM_ID,
        price_level: 1,
      } as never);

      expect(result.unit_rate_id).toBe('IPM-2');
    });

    it('returns the to-base factor of the selected unit conversion row', async () => {
      mockItemPricePrisma(itemRow(), [priceRow('IPM-1', 1, 115), priceRow('IPM-2', 2, 250)]);

      const result = await service.getItemPriceLookup({
        item_id: ITEM_ID,
        unit_id: 'UNIT-2',
        price_level: 1,
      } as never);

      expect(result.unit_id).toBe('UNIT-2');
      expect(result.base_unit_id).toBe('UNIT-BASE');
      expect(result.base_factor).toBe(2);
    });

    it('zeroes unit_loading when the item does not allow loading', async () => {
      mockItemPricePrisma(itemRow({ itemAllowLoading: false }), [priceRow('IPM-1', 1, 115)]);

      const result = await service.getItemPriceLookup({
        item_id: ITEM_ID,
        price_level: 1,
      } as never);
      expect(result.unit_loading).toBe(0);
    });
  });
});
