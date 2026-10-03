import { GridDetails } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PgService } from '../../database/pg/pg.service';
import { GridDetailsService } from './grid-details.service';
import { gridDeviceTypeEnum } from './types/grid-detail-enum';

type PrismaMock = {
  gridDetails: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    update: jest.Mock;
  };
  gridColumn: {
    updateMany: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};
type PgMock = {
  query: jest.Mock;
};

const makeRecord = (overrides: Partial<GridDetails> = {}): GridDetails => ({
  gridId: 7n,
  gridName: 'Item Brand Master',
  gridDescription: 'Item brand grid',
  gridSortColumn: null,
  gridSortOrder: null,
  gridDeviceType: null,
  gridSql: 'SELECT brand_id FROM inventory.item_brand_master',
  gridStatus: true,
  gridIsDeleted: false,
  gridCreatedOn: new Date('2026-06-13T10:00:00.000Z'),
  gridCreatedBy: null,
  gridModifiedOn: null,
  gridModifiedBy: null,
  gridSyncOn: null,
  ...overrides,
});

/** Any real uuid; the mock only has to recognise it. */
const COLUMN_ID = '019f07d3-a1e0-7d2f-9d64-1d566dec2cff';

const makeAuditLogService = () => ({
  logEntityChange: jest.fn().mockResolvedValue(undefined),
});

const makeRequestContextService = () => ({
  getUserId: jest.fn().mockReturnValue(null),
});

describe('GridDetailsService', () => {
  let prisma: PrismaMock;
  let pg: PgMock;
  let configuredGridSqlService: ConfiguredGridSqlService;
  let service: GridDetailsService;

  beforeEach(() => {
    prisma = {
      gridDetails: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        update: jest.fn(),
      },
      gridColumn: {
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ gridColumnId: COLUMN_ID }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    pg = {
      query: jest.fn(),
    };
    configuredGridSqlService = new ConfiguredGridSqlService(
      prisma as unknown as PrismaService,
      pg as unknown as PgService,
    );
    service = new GridDetailsService(
      prisma as unknown as PrismaService,
      configuredGridSqlService,
      makeAuditLogService() as never,
      makeRequestContextService() as never,
    );
  });

  it('normalizes and stores grid_sql queries without probing the database', async () => {
    const record = makeRecord({
      gridSql: 'SELECT brand_id, brand_name FROM inventory.item_brand_master',
    });
    prisma.gridDetails.create.mockResolvedValueOnce(record);
    prisma.gridDetails.findFirstOrThrow.mockResolvedValueOnce({ ...record, columns: [] });

    const result = await service.save({
      grid_name: 'Item Brand Master',
      grid_sql: '  SELECT brand_id, brand_name FROM inventory.item_brand_master;  ',
      grid_device_type: gridDeviceTypeEnum.DESKTOP,
    });

    expect(pg.query).not.toHaveBeenCalled();
    expect(prisma.gridDetails.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gridName: 'Item Brand Master',
        gridSql: 'SELECT brand_id, brand_name FROM inventory.item_brand_master',
      }),
    });
    expect(result.grid_sql).toBe('SELECT brand_id, brand_name FROM inventory.item_brand_master');
  });

  it('preserves valid raw sql formatting when saving', async () => {
    const sql =
      'SELECT brand_id,\n       brand_name\nFROM inventory.item_brand_master\nORDER BY brand_name';
    const record = makeRecord({ gridSql: sql });
    prisma.gridDetails.create.mockResolvedValueOnce(record);
    prisma.gridDetails.findFirstOrThrow.mockResolvedValueOnce({ ...record, columns: [] });

    const result = await service.save({
      grid_name: 'Item Brand Master',
      grid_sql: `  ${sql};  `,
      grid_device_type: gridDeviceTypeEnum.DESKTOP,
    });

    expect(pg.query).not.toHaveBeenCalled();
    expect(prisma.gridDetails.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ gridSql: sql }),
    });
    expect(result.grid_sql).toBe(sql);
  });

  it('stores grid_sql referencing columns that do not exist without executing it', async () => {
    const sql = 'SELECT section_menu_id FROM inventory.item_brand_master';
    const record = makeRecord({ gridSql: sql });
    prisma.gridDetails.create.mockResolvedValueOnce(record);
    prisma.gridDetails.findFirstOrThrow.mockResolvedValueOnce({ ...record, columns: [] });

    const result = await service.save({
      grid_name: 'Item Brand Master',
      grid_sql: sql,
      grid_device_type: gridDeviceTypeEnum.DESKTOP,
    });

    expect(pg.query).not.toHaveBeenCalled();
    expect(result.grid_sql).toBe(sql);
  });

  it('strips inline comments from grid_sql and stores the cleaned query', async () => {
    const record = makeRecord({ gridSql: 'SELECT brand_id FROM inventory.item_brand_master' });
    prisma.gridDetails.create.mockResolvedValueOnce(record);
    prisma.gridDetails.findFirstOrThrow.mockResolvedValueOnce({ ...record, columns: [] });

    const result = await service.save({
      grid_name: 'Item Brand Master',
      grid_sql: 'SELECT brand_id -- the id\nFROM inventory.item_brand_master -- your acc year',
      grid_device_type: gridDeviceTypeEnum.DESKTOP,
    });

    expect(pg.query).not.toHaveBeenCalled();
    const storedSql = prisma.gridDetails.create.mock.calls[0][0].data.gridSql as string;
    expect(storedSql).not.toContain('--');
    expect(storedSql).toContain('SELECT brand_id');
    expect(storedSql).toContain('FROM inventory.item_brand_master');
    expect(result.grid_sql).toBe('SELECT brand_id FROM inventory.item_brand_master');
  });

  it('rejects grid_sql without a top-level from table', async () => {
    await expect(
      service.save({
        grid_name: 'Ad hoc Grid',
        grid_sql: 'SELECT 1',
        grid_device_type: gridDeviceTypeEnum.DESKTOP,
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
    expect(pg.query).not.toHaveBeenCalled();
    expect(prisma.gridDetails.create).not.toHaveBeenCalled();
  });

  it('stores the pixel width a dragged column was left at, and nothing else', async () => {
    // What the browser sends: the width it laid the column out at, on its own.
    await service.updateColumnWidths({
      columns: [{ grid_column_id: COLUMN_ID, grid_column_px: '246px' }],
    });

    expect(prisma.gridColumn.update).toHaveBeenCalledWith({
      where: { gridColumnId: COLUMN_ID },
      data: { gridColumnPx: '246px' },
    });
  });

  it('writes both widths when a caller sends both', async () => {
    await service.updateColumnWidths({
      columns: [{ grid_column_id: COLUMN_ID, grid_column_width: 30.75, grid_column_px: '246px' }],
    });

    expect(prisma.gridColumn.update).toHaveBeenCalledWith({
      where: { gridColumnId: COLUMN_ID },
      data: { gridColumnWidth: 30.75, gridColumnPx: '246px' },
    });
  });

  it('leaves a stored pixel width alone when the caller sends the fraction only', async () => {
    // The desktop client posts `grid_column_width` by itself; that must not wipe
    // the exact width the browser saved.
    await service.updateColumnWidths({
      columns: [{ grid_column_id: COLUMN_ID, grid_column_width: 31.5 }],
    });

    expect(prisma.gridColumn.update).toHaveBeenCalledWith({
      where: { gridColumnId: COLUMN_ID },
      data: { gridColumnWidth: 31.5 },
    });
  });
  // ── replace_columns ───────────────────────────────────────────────────────
  // The defect these pin: the retire step used to soft-delete every live column
  // NOT NAMED BY ID IN THE PAYLOAD. A replacement set sent without ids -- the
  // normal shape -- therefore deleted the rows the same save had just inserted,
  // leaving the grid with no live columns at all and every `search` answering
  // zero rows. Grids 113, 114 and 115 were in exactly that state on 2026-09-23.
  it('retires the columns a replace save did not carry, and not the ones it just created', async () => {
    const record = makeRecord();
    const existingId = '019f07d3-a1e0-7d2f-9d64-1d566dec2c01';
    prisma.gridDetails.findFirst.mockResolvedValueOnce(record);
    prisma.gridDetails.update.mockResolvedValueOnce(record);
    // What was live BEFORE the save: one column, which this payload replaces.
    prisma.gridColumn.findMany.mockResolvedValueOnce([{ gridColumnId: existingId }]);
    prisma.gridDetails.findFirstOrThrow.mockResolvedValueOnce({ ...record, columns: [] });

    await service.save({
      grid_id: '7',
      grid_name: 'Item Brand Master',
      grid_device_type: gridDeviceTypeEnum.DESKTOP,
      replace_columns: true,
      grid_columns: [
        { grid_column_number: 1, grid_column_name: 'Code' },
        { grid_column_number: 2, grid_column_name: 'Name' },
      ],
    });

    // Both new columns were created ...
    expect(prisma.gridColumn.create).toHaveBeenCalledTimes(2);
    // ... and only the pre-existing row was retired, by id.
    expect(prisma.gridColumn.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.gridColumn.updateMany).toHaveBeenCalledWith({
      where: {
        gridId: 7n,
        gridColumnIsDeleted: false,
        gridColumnId: { in: [existingId] },
      },
      data: expect.objectContaining({ gridColumnIsDeleted: true }),
    });
  });

  it('retires nothing when a replace save carries every live column by id', async () => {
    const record = makeRecord();
    prisma.gridDetails.findFirst.mockResolvedValueOnce(record);
    prisma.gridDetails.update.mockResolvedValueOnce(record);
    prisma.gridColumn.findMany.mockResolvedValueOnce([{ gridColumnId: COLUMN_ID }]);
    prisma.gridDetails.findFirstOrThrow.mockResolvedValueOnce({ ...record, columns: [] });

    await service.save({
      grid_id: '7',
      grid_name: 'Item Brand Master',
      grid_device_type: gridDeviceTypeEnum.DESKTOP,
      replace_columns: true,
      grid_columns: [
        { grid_column_id: COLUMN_ID, grid_column_number: 1, grid_column_name: 'Code' },
      ],
    });

    expect(prisma.gridColumn.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { gridColumnId: COLUMN_ID } }),
    );
    expect(prisma.gridColumn.updateMany).not.toHaveBeenCalled();
  });
});
