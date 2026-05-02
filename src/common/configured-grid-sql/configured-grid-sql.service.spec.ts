import { PrismaService } from '../../database/prisma/prisma.service';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';

type PrismaMock = {
  gridDetails: {
    findMany: jest.Mock;
  };
  gridColumn: {
    findMany: jest.Mock;
  };
  $queryRawUnsafe: jest.Mock;
};

describe('ConfiguredGridSqlService', () => {
  let service: ConfiguredGridSqlService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      gridDetails: {
        findMany: jest.fn(),
      },
      gridColumn: {
        findMany: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
    };

    service = new ConfiguredGridSqlService(prisma as unknown as PrismaService);
  });

  it('loads configured candidates by table name', async () => {
    prisma.gridDetails.findMany.mockResolvedValue([
      {
        gridId: 1n,
        gridSql: 'SELECT * FROM units',
      },
    ]);

    const result = await service.loadCandidates({ tableName: 'units' });

    expect(result).toHaveLength(1);
    expect(prisma.gridDetails.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gridIsDeleted: false,
          gridStatus: true,
          gridSql: {
            not: null,
          },
          OR: [
            {
              gridSql: expect.objectContaining({
                contains: 'units',
                mode: 'insensitive',
              }),
            },
          ],
        }),
      }),
    );
  });

  it('matches display-style table names to underscored configured SQL table names', async () => {
    prisma.gridDetails.findMany.mockResolvedValue([
      {
        gridId: 21n,
        gridSql: 'SELECT * FROM sales.area_master WHERE arm_is_deleted = false',
      },
    ]);

    const candidates = await service.loadCandidates({ tableName: 'area master' });
    const primaryCandidates = service.filterPrimaryFromTable(candidates, 'area master');
    const validation = service.validateBaseSql({
      sql: 'SELECT * FROM sales.area_master WHERE arm_is_deleted = false',
      tableName: 'area master',
    });

    expect(candidates).toHaveLength(1);
    expect(primaryCandidates).toEqual([
      {
        gridId: 21n,
        gridSql: 'SELECT * FROM sales.area_master WHERE arm_is_deleted = false',
      },
    ]);
    expect(validation).toEqual({
      isValid: true,
      normalizedSql: 'SELECT * FROM sales.area_master WHERE arm_is_deleted = false',
    });
    expect(prisma.gridDetails.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              gridSql: expect.objectContaining({
                contains: 'area master',
                mode: 'insensitive',
              }),
            },
            {
              gridSql: expect.objectContaining({
                contains: 'area_master',
                mode: 'insensitive',
              }),
            },
          ],
        }),
      }),
    );
  });

  it('filters candidates where top-level from table matches', () => {
    const result = service.filterPrimaryFromTable(
      [
        {
          gridId: 1n,
          gridSql: 'SELECT * FROM units u',
        },
        {
          gridId: 2n,
          gridSql: 'SELECT * FROM account_groups',
        },
      ],
      'units',
    );

    expect(result).toEqual([
      {
        gridId: 1n,
        gridSql: 'SELECT * FROM units u',
      },
    ]);
  });

  it('filters schema-qualified candidates by their top-level from table', () => {
    const result = service.filterPrimaryFromTable(
      [
        {
          gridId: 1n,
          gridSql: 'SELECT * FROM public.companys c',
        },
        {
          gridId: 2n,
          gridSql: 'SELECT * FROM accounts.account_groups',
        },
      ],
      'companys',
    );

    expect(result).toEqual([
      {
        gridId: 1n,
        gridSql: 'SELECT * FROM public.companys c',
      },
    ]);
  });

  it('rejects non-select sql', () => {
    const result = service.validateBaseSql({
      sql: 'DELETE FROM units',
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Only SELECT query is allowed',
    });
  });

  it('rejects sql with semicolon', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM units; SELECT 1',
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Multiple statements are not allowed',
    });
  });

  it('rejects sql with comments', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM units -- bad',
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Comments are not allowed in configured query',
    });
  });

  it('rejects sql with forbidden write tokens', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM units WHERE EXISTS (SELECT 1 FROM x WHERE x.y = update)',
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Write/DDL statements are not allowed',
    });
  });

  it('rejects sql without table reference', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM account_groups',
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Configured query must reference units table',
    });
  });

  it('rejects configured sql with the wrong primary table schema', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM accounts.companys',
      tableName: 'companys',
      primaryTableSchema: 'public',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Configured query must reference public.companys',
    });
  });

  it('allows configured sql with the expected primary table schema', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM public.companys',
      tableName: 'companys',
      primaryTableSchema: 'public',
    });

    expect(result).toEqual({
      isValid: true,
      normalizedSql: 'SELECT * FROM public.companys',
    });
  });

  it('allows unqualified configured sql when validating the primary table schema', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM companys',
      tableName: 'companys',
      primaryTableSchema: 'public',
    });

    expect(result).toEqual({
      isValid: true,
      normalizedSql: 'SELECT * FROM companys',
    });
  });

  it('rejects positional parameters in sql', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM units WHERE unit_id = $1',
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Positional parameters are not allowed in configured query',
    });
  });

  it('preserves valid raw sql formatting apart from trimming a trailing semicolon', () => {
    const result = service.validateBaseSql({
      sql: `  SELECT unit_id,
         unit_name
FROM units
ORDER BY unit_name;  `,
      tableName: 'units',
    });

    expect(result).toEqual({
      isValid: true,
      normalizedSql: `SELECT unit_id,
         unit_name
FROM units
ORDER BY unit_name`,
    });
  });

  it('applies extra forbidden patterns', () => {
    const result = service.validateBaseSql({
      sql: 'SELECT * FROM units WHERE unit_id = 1',
      tableName: 'units',
      extraForbiddenPatterns: [
        {
          pattern:
            /\b(?:[a-z_][a-z0-9_$]*\s*\.\s*)?(unit_id|unit_base_unit_id)\s*=\s*[-+]?\d+\b/i,
          message: 'Configured query compares unit UUID fields with numeric values',
        },
      ],
    });

    expect(result).toEqual({
      isValid: false,
      message: 'Configured query compares unit UUID fields with numeric values',
    });
  });

  it('runs paged query and returns rows + total', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          total: '3',
        },
      ])
      .mockResolvedValueOnce([
        { id: 1 },
        { id: 2 },
      ]);

    const result = await service.runPagedQuery<{ id: number }>({
      baseSql: 'SELECT * FROM units',
      alias: 'unit_grid',
      params: [],
      limit: 20,
      skip: 0,
    });

    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      total: 3,
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('maps filter-enabled grid columns to configured sql output fields', async () => {
    prisma.gridColumn.findMany.mockResolvedValue([
      {
        gridColumnName: 'Customer name',
        gridColumnNumber: 1,
      },
      {
        gridColumnName: 'Mobile',
        gridColumnNumber: 4,
      },
    ]);

    const result = await service.getSearchableFieldNames(
      10n,
      'SELECT cus_name, cus_code, cus_city, cus_phone1 FROM sales.customers',
    );

    expect(result).toEqual(['cus_name', 'cus_phone1']);
    expect(prisma.gridColumn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gridId: 10n,
          gridColumnFilter: true,
        }),
      }),
    );
  });

  it('builds a searchable wrapper query over configured grid sql fields', () => {
    const result = service.buildSearchSql({
      baseSql: 'SELECT cus_name, cus_code FROM sales.customers',
      alias: 'customer_grid',
      search: 'sun',
      searchableFieldNames: ['cus_name'],
    });

    expect(result.params).toEqual(['cus_name', '%sun%']);
    expect(result.sql).toContain('SELECT * FROM (SELECT cus_name, cus_code FROM sales.customers) AS customer_grid');
    expect(result.sql).toContain('grid_kv.key = $1');
    expect(result.sql).toContain('grid_kv.value ILIKE $2');
  });

  it('applies configured searchable grid columns when running a searched paged query', async () => {
    prisma.gridColumn.findMany
      .mockResolvedValueOnce([
        {
          gridColumnName: 'Customer name',
          gridColumnNumber: 1,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          total: '1',
        },
      ])
      .mockResolvedValueOnce([{ cus_name: 'SUN ELECTRONICS G' }]);

    const result = await service.runPagedQuery<{ cus_name: string }>({
      baseSql: 'SELECT cus_name, cus_code FROM sales.customers',
      alias: 'customer_grid',
      search: 'sun',
      gridId: 10n,
      limit: 20,
      skip: 0,
    });

    expect(result).toEqual({
      items: [{ cus_name: 'SUN ELECTRONICS G' }],
      total: 1,
      styles: [],
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('grid_kv.value ILIKE $2'),
      'cus_name',
      '%sun%',
    );
  });

  it('checks whether a configured query is executable', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await expect(service.assertBaseSqlExecutable('SELECT * FROM units', 'unit_grid')).resolves.toBe(
      undefined,
    );

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT * FROM (SELECT * FROM units) AS unit_grid LIMIT 0',
    );
  });
});
