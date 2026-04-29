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
  $queryRawUnsafe: jest.Mock;
};

describe('MasterLookupService', () => {
  let service: MasterLookupService;
  let prisma: PrismaMock;

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
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    service = new MasterLookupService(prisma as unknown as PrismaService);
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'item_id',
            dropColumnsColumnAlias: 'Item Id',
            dropColumnsColumnFilter: false,
          },
          {
            dropColumnsColumnNo: 2,
            dropColumnsColumnName: 'item_name',
            dropColumnsColumnAlias: 'Item Name',
            dropColumnsColumnFilter: true,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { item_id: 'ITEM-1', item_name: 'Milk', item_code: 'MILK-001' },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('items', 'milk', 5);

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-1', name: 'Milk', item_id: 'ITEM-1', item_name: 'Milk', item_code: 'MILK-001' }],
    });
    expect(prisma.itemMaster.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0];
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'Cus group name',
            dropColumnsColumnAlias: 'cus grp name',
            dropColumnsColumnFilter: false,
          },
          {
            dropColumnsColumnNo: 2,
            dropColumnsColumnName: 'cust group Alias',
            dropColumnsColumnAlias: 'cust group Alias',
            dropColumnsColumnFilter: false,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        cgr_id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
        cgr_branch_id: null,
        cgr_name: 'Retail',
        cgr_alias: 'RTL',
      },
    ]);

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
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'cgr_id',
            dropColumnsColumnAlias: 'Customer Group Id',
            dropColumnsColumnFilter: false,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        cgr_id: '019cad4b-84db-7a76-a67f-41e7e6adb9ce',
      },
    ]);

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
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'item_id',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: true,
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

    const result = await service.getAllAccountsAndMasterNameIds('items', 'bread', 3);

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-2', name: 'Bread' }],
    });
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'Item Name',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: true,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('broken dropdown sql'));
    prisma.itemMaster.findMany.mockResolvedValue([
      {
        itemId: 'ITEM-3',
        itemNameEn: 'Butter',
      },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('items', 'butter', 3);

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-3', name: 'Butter' }],
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'item_id',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: false,
          },
          {
            dropColumnsColumnNo: 2,
            dropColumnsColumnName: 'item_name',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: true,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe
      .mockRejectedValueOnce(new Error('broken regional dropdown sql'))
      .mockResolvedValueOnce([
        {
          item_id: 'ITEM-4',
          item_name: 'Cheese',
        },
      ]);

    const result = await service.getAllAccountsAndMasterNameIds('items', 'cheese', 3);

    expect(result).toEqual({
      scope: 'masters',
      module: 'items',
      items: [{ id: 'ITEM-4', name: 'Cheese', item_id: 'ITEM-4', item_name: 'Cheese' }],
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(String(prisma.$queryRawUnsafe.mock.calls[0][0])).toContain(
      'SELECT item_id, item_name FROM regional_item_master',
    );
    expect(String(prisma.$queryRawUnsafe.mock.calls[1][0])).toContain(
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'br_id',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: false,
          },
          {
            dropColumnsColumnNo: 2,
            dropColumnsColumnName: 'br_name',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: true,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        br_id: 'BR-1',
        br_name: 'Main Branch',
      },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('branches');

    expect(result).toEqual({
      scope: 'accounts',
      module: 'branches',
      items: [{ id: 'BR-1', name: 'Main Branch', br_id: 'BR-1', br_name: 'Main Branch' }],
    });
    const [sql] = prisma.$queryRawUnsafe.mock.calls[0];
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
            dropColumnsColumnNo: 1,
            dropColumnsColumnName: 'comp_id',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: false,
          },
          {
            dropColumnsColumnNo: 2,
            dropColumnsColumnName: 'comp_name',
            dropColumnsColumnAlias: null,
            dropColumnsColumnFilter: true,
          },
        ],
      },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        comp_id: 'COMP-1',
        comp_name: 'Acme Pvt Ltd',
      },
    ]);

    const result = await service.getAllAccountsAndMasterNameIds('companies');

    expect(result).toEqual({
      scope: 'accounts',
      module: 'companies',
      items: [{ id: 'COMP-1', name: 'Acme Pvt Ltd', comp_id: 'COMP-1', comp_name: 'Acme Pvt Ltd' }],
    });
    const [sql] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(String(sql)).toContain('public.companys');
    expect(String(sql)).not.toContain('accounts.companys');
    expect(prisma.company.findMany).not.toHaveBeenCalled();
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
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.company.findMany).toHaveBeenCalledTimes(1);
  });
});
