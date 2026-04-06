import { PrismaService } from '../../database/prisma/prisma.service';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';

type PrismaMock = {
  gridDetails: {
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
          gridSql: expect.objectContaining({
            contains: 'units',
            mode: 'insensitive',
          }),
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
