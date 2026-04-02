import { BadRequestException } from '@nestjs/common';
import { GridDetails } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GridDetailsService } from './grid-details.service';

type PrismaMock = {
  gridDetails: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $queryRawUnsafe: jest.Mock;
  $transaction: jest.Mock;
};

const makeRecord = (overrides: Partial<GridDetails> = {}): GridDetails => ({
  gridId: 7n,
  gridName: 'Item Brand Master',
  gridDescription: 'Item brand grid',
  gridSortColumn: null,
  gridSortOrder: null,
  gridSql: 'SELECT brand_id FROM inventory.item_brand_master',
  gridStatus: true,
  gridIsDeleted: false,
  ...overrides,
});

describe('GridDetailsService', () => {
  let prisma: PrismaMock;
  let configuredGridSqlService: ConfiguredGridSqlService;
  let service: GridDetailsService;

  beforeEach(() => {
    prisma = {
      gridDetails: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };

    configuredGridSqlService = new ConfiguredGridSqlService(prisma as unknown as PrismaService);
    service = new GridDetailsService(
      prisma as unknown as PrismaService,
      configuredGridSqlService,
    );
  });

  it('normalizes and stores executable grid_sql queries', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
    prisma.gridDetails.create.mockResolvedValueOnce(
      makeRecord({
        gridSql: 'SELECT brand_id, brand_name FROM inventory.item_brand_master',
      }),
    );

    const result = await service.save({
      grid_name: 'Item Brand Master',
      grid_sql: '  SELECT brand_id, brand_name FROM inventory.item_brand_master;  ',
    });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT * FROM (SELECT brand_id, brand_name FROM inventory.item_brand_master) AS grid_sql_validation LIMIT 0',
    );
    expect(prisma.gridDetails.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gridName: 'Item Brand Master',
        gridSql: 'SELECT brand_id, brand_name FROM inventory.item_brand_master',
      }),
    });
    expect(result.grid_sql).toBe('SELECT brand_id, brand_name FROM inventory.item_brand_master');
  });

  it('rejects grid_sql that cannot be executed', async () => {
    prisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('syntax error at or near "FROM"'));

    try {
      await service.save({
        grid_name: 'Item Brand Master',
        grid_sql: 'SELECT brand_id, brand_name, FROM inventory.item_brand_master',
      });
      throw new Error('Expected save to reject');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toMatchObject({
        response: {
          success: false,
          message: 'Invalid grid_sql configuration',
          errors: [
            expect.objectContaining({
              field: 'grid_sql',
              message: expect.stringContaining('syntax error at or near "FROM"'),
            }),
          ],
        },
      });
    }
  });

  it('rejects grid_sql without a top-level from table', async () => {
    await expect(
      service.save({
        grid_name: 'Ad hoc Grid',
        grid_sql: 'SELECT 1',
      }),
    ).rejects.toMatchObject({
      response: {
        success: false,
        message: 'Invalid grid_sql configuration',
        errors: [
          {
            field: 'grid_sql',
            message: 'grid_sql must be a SELECT query with a top-level FROM table',
          },
        ],
      },
    });

    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.gridDetails.create).not.toHaveBeenCalled();
  });
});
