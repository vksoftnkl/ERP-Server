import { HttpException } from '@nestjs/common';
import { DropdownColumns, DropdownDetails, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { DropdownDetailsService } from './dropdown-details.service';
import { DropdownDetailErrorCode } from './types/dropdown-detail-enum.types';

type PrismaMock = {
  dropdownDetails: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  dropdownColumns: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
};
type GridSqlMock = {
  extractTopLevelFromTableName: jest.Mock;
  validateBaseSql: jest.Mock;
  substituteGridPrm: jest.Mock;
  deriveSearchableFieldNamesFromColumns: jest.Mock;
  runPagedQuery: jest.Mock;
};

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a206';
/** Any real uuid; the mock only has to recognise it. */
const COLUMN_ID = '019f07d3-a1e0-7d2f-9d64-1d566dec2cff';
const OTHER_COLUMN_ID = '019f07d3-a1e0-7d2f-9d64-1d566dec2c01';
const SQL = 'SELECT item_id, item_name FROM inventory.item_master';
const CREATED_ON = new Date('2026-06-13T10:00:00.000Z');

const makeDropdown = (overrides: Partial<DropdownDetails> = {}): DropdownDetails => ({
  dropdownId: 7,
  dropdownName: 'Item Master Dropdown',
  dropdownDescription: null,
  dropdownSql: SQL,
  dropdownSortOrder: null,
  dropdownSortColumn: null,
  dropdownCompletion: null,
  dropdownSqlRegional: null,
  dropdownMaxVisibleItems: 10,
  dropdownShowHeader: true,
  dropdownWidth: null,
  dropdownDeviceType: null,
  dropdownCreatedOn: CREATED_ON,
  dropdownCreatedBy: USER_ID,
  dropdownModifiedOn: null,
  dropdownModifiedBy: null,
  dropdownSyncOn: null,
  ...overrides,
});

const makeColumn = (overrides: Partial<DropdownColumns> = {}): DropdownColumns => ({
  dropdownColumnsId: COLUMN_ID,
  dropdownColumnsDropdownId: 7,
  dropdownColumnsNo: 1,
  dropdownColumnsDataType: 'string',
  dropdownColumnsName: 'item_name',
  dropdownColumnsAlias: null,
  dropdownColumnsWidth: null,
  dropdownColumnsVisiblity: true,
  dropdownColumnsAllignment: null,
  dropdownColumnsFilter: false,
  dropdownColumnsSqlName: null,
  dropdownColumnsCreatedOn: CREATED_ON,
  dropdownColumnsModifiedOn: null,
  dropdownColumnsCreatedBy: USER_ID,
  dropdownColumnsModifiedBy: null,
  dropdownColumnsSyncOn: null,
  ...overrides,
});

const withColumns = (record: DropdownDetails, columns: DropdownColumns[] = []) => ({
  ...record,
  dropdownColumns: columns,
});

/** Awaits a call the service must refuse and hands back the HttpException it threw. */
async function refusalOf(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('expected the call to be refused');
}

const codeOf = (error: HttpException): string =>
  (error.getResponse() as { errors: { code: string }[] }).errors[0].code;

describe('DropdownDetailsService', () => {
  let prisma: PrismaMock;
  let gridSql: GridSqlMock;
  let auditLog: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: DropdownDetailsService;

  beforeEach(() => {
    prisma = {
      dropdownDetails: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      dropdownColumns: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ dropdownColumnsId: COLUMN_ID }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    gridSql = {
      extractTopLevelFromTableName: jest.fn().mockReturnValue('inventory.item_master'),
      validateBaseSql: jest.fn(({ sql }: { sql: string }) => ({
        isValid: true,
        normalizedSql: sql,
      })),
      substituteGridPrm: jest.fn(),
      deriveSearchableFieldNamesFromColumns: jest.fn().mockReturnValue(['item_name']),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [{ item_id: 1 }], total: 1 }),
    };
    auditLog = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new DropdownDetailsService(
      prisma as unknown as PrismaService,
      auditLog as never,
      context as never,
      gridSql as unknown as ConfiguredGridSqlService,
    );
  });

  // ── save: create ──────────────────────────────────────────────────────────
  describe('save (create)', () => {
    it('creates the dropdown and its columns, audits it as New, and returns the stored row', async () => {
      const created = makeDropdown();
      prisma.dropdownDetails.create.mockResolvedValueOnce(created);
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(
        withColumns(created, [makeColumn()]),
      );

      const result = await service.save({
        dropdown_name: '  Item Master Dropdown  ',
        dropdown_sql: `  ${SQL}  `,
        dropdown_columns: [
          {
            dropdown_columns_no: 1,
            dropdown_columns_data_type: ' string ',
            dropdown_columns_name: ' item_name ',
          },
        ],
      });

      // Optional fields the body did not carry are not written at all.
      expect(prisma.dropdownDetails.create).toHaveBeenCalledWith({
        data: {
          dropdownName: 'Item Master Dropdown',
          dropdownSql: SQL,
          dropdownCreatedBy: USER_ID,
          dropdownModifiedBy: null,
        },
      });
      expect(prisma.dropdownColumns.create).toHaveBeenCalledWith({
        data: {
          dropdownColumnsName: 'item_name',
          dropdownColumnsDropdownId: 7,
          dropdownColumnsNo: 1,
          dropdownColumnsDataType: 'string',
          dropdownColumnsCreatedBy: USER_ID,
          dropdownColumnsModifiedBy: null,
        },
      });
      expect(prisma.dropdownDetails.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { dropdownId: 7 } }),
      );
      expect(auditLog.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'dropdown details',
          screenName: 'Dropdown Details',
          pk: '7',
          displayName: 'Item Master Dropdown',
          originalRecord: null,
          modifiedRecord: result,
          userId: USER_ID,
        }),
        prisma,
      );
      expect(result.dropdown_id).toBe('7');
      expect(result.columns).toHaveLength(1);
    });

    it('writes every optional field the body carried, explicit nulls included', async () => {
      const created = makeDropdown();
      prisma.dropdownDetails.create.mockResolvedValueOnce(created);
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(created));

      await service.save({
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        dropdown_description: null,
        dropdown_sort_order: 'asc',
        dropdown_sort_column: 'item_name',
        dropdown_completion: 'item_name',
        dropdown_sql_regional: null,
        dropdown_max_visible_items: 15,
        dropdown_show_header: false,
        dropdown_width: 300,
        dropdown_device_type: 'Desktop',
      });

      expect(prisma.dropdownDetails.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dropdownDescription: null,
          dropdownSortOrder: 'asc',
          dropdownSortColumn: 'item_name',
          dropdownCompletion: 'item_name',
          dropdownSqlRegional: null,
          dropdownMaxVisibleItems: 15,
          dropdownShowHeader: false,
          dropdownWidth: 300,
          dropdownDeviceType: 'Desktop',
        }),
      });
    });

    it('stamps the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);
      const created = makeDropdown({ dropdownCreatedBy: DEFAULT_ACTOR });
      prisma.dropdownDetails.create.mockResolvedValueOnce(created);
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(created));

      await service.save({ dropdown_name: 'Item Master Dropdown', dropdown_sql: SQL });

      expect(prisma.dropdownDetails.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dropdownCreatedBy: DEFAULT_ACTOR }),
      });
      expect(auditLog.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ userId: DEFAULT_ACTOR }),
        prisma,
      );
    });

    it('writes no columns when the body carries none', async () => {
      const created = makeDropdown();
      prisma.dropdownDetails.create.mockResolvedValueOnce(created);
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(created));

      await service.save({
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        dropdown_columns: [],
      });

      expect(prisma.dropdownColumns.create).not.toHaveBeenCalled();
      expect(prisma.dropdownColumns.update).not.toHaveBeenCalled();
    });

    it('writes the optional column fields the body carried', async () => {
      const created = makeDropdown();
      prisma.dropdownDetails.create.mockResolvedValueOnce(created);
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(created));

      await service.save({
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        dropdown_columns: [
          {
            dropdown_columns_no: 1,
            dropdown_columns_data_type: 'string',
            dropdown_columns_name: 'item_name',
            dropdown_columns_alias: 'Item Name',
            dropdown_columns_width: 180,
            dropdown_columns_visiblity: false,
            dropdown_columns_allignment: 'left',
            dropdown_columns_filter: true,
            dropdown_columns_sql_name: null,
          },
        ],
      });

      expect(prisma.dropdownColumns.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dropdownColumnsAlias: 'Item Name',
          dropdownColumnsWidth: 180,
          dropdownColumnsVisiblity: false,
          dropdownColumnsAllignment: 'left',
          dropdownColumnsFilter: true,
          dropdownColumnsSqlName: null,
        }),
      });
    });

    it.each([
      [
        'a blank column name',
        { dropdown_columns_name: '   ', dropdown_columns_data_type: 'string' },
        'dropdown_columns_name',
        DropdownDetailErrorCode.COLUMN_NAME_REQUIRED,
      ],
      [
        'a blank column data type',
        { dropdown_columns_name: 'item_name', dropdown_columns_data_type: '  ' },
        'dropdown_columns_data_type',
        DropdownDetailErrorCode.COLUMN_DATA_TYPE_REQUIRED,
      ],
    ])('refuses %s and audits nothing', async (_label, column, field, code) => {
      prisma.dropdownDetails.create.mockResolvedValueOnce(makeDropdown());

      const error = await refusalOf(
        service.save({
          dropdown_name: 'Item Master Dropdown',
          dropdown_sql: SQL,
          dropdown_columns: [{ dropdown_columns_no: 1, ...column }],
        }),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Validation failed',
        errors: [{ field, message: `${field} must not be empty`, code }],
      });
      expect(prisma.dropdownColumns.create).not.toHaveBeenCalled();
      expect(auditLog.logEntityChange).not.toHaveBeenCalled();
    });
  });

  // ── save: update ──────────────────────────────────────────────────────────
  describe('save (update)', () => {
    it('updates the dropdown as the request user and audits the before and after', async () => {
      const existing = makeDropdown({ dropdownName: 'Old Name' });
      const stored = makeDropdown({ dropdownModifiedBy: USER_ID });
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(existing);
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(stored));

      const result = await service.save({
        dropdown_id: '7',
        dropdown_name: ' Item Master Dropdown ',
        dropdown_sql: ` ${SQL} `,
      });

      expect(prisma.dropdownDetails.findFirst).toHaveBeenCalledWith({ where: { dropdownId: 7 } });
      expect(prisma.dropdownDetails.update).toHaveBeenCalledWith({
        where: { dropdownId: 7 },
        data: {
          dropdownName: 'Item Master Dropdown',
          dropdownSql: SQL,
          dropdownModifiedBy: USER_ID,
        },
      });
      expect(prisma.dropdownDetails.create).not.toHaveBeenCalled();
      expect(auditLog.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          tableName: 'dropdown details',
          pk: '7',
          displayName: 'Item Master Dropdown',
          originalRecord: expect.objectContaining({ dropdown_name: 'Old Name', columns: [] }),
          modifiedRecord: result,
          userId: USER_ID,
        }),
        prisma,
      );
      expect(result.dropdown_modified_by).toBe(USER_ID);
    });

    it('answers 404 for a dropdown that does not exist and writes nothing', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(null);

      const error = await refusalOf(
        service.save({ dropdown_id: '99', dropdown_name: 'X', dropdown_sql: SQL }),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Dropdown details not found',
        errors: [
          {
            field: 'dropdown_id',
            message: 'No dropdown details found with id 99',
            code: DropdownDetailErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.dropdownDetails.update).not.toHaveBeenCalled();
      expect(auditLog.logEntityChange).not.toHaveBeenCalled();
    });

    it('leaves the columns alone when the body carries no dropdown_columns', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(makeDropdown());
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(makeDropdown()));

      await service.save({
        dropdown_id: '7',
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        replace_columns: true,
      });

      expect(prisma.dropdownColumns.deleteMany).not.toHaveBeenCalled();
      expect(prisma.dropdownColumns.create).not.toHaveBeenCalled();
      expect(prisma.dropdownColumns.update).not.toHaveBeenCalled();
    });

    it('updates a column sent with an id and creates one sent without', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(makeDropdown());
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(makeDropdown()));

      await service.save({
        dropdown_id: '7',
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        dropdown_columns: [
          {
            dropdown_columns_id: ` ${COLUMN_ID} `,
            dropdown_columns_no: 1,
            dropdown_columns_data_type: 'string',
            dropdown_columns_name: 'item_name',
          },
          {
            dropdown_columns_no: 2,
            dropdown_columns_data_type: 'number',
            dropdown_columns_name: 'item_id',
          },
        ],
      });

      expect(prisma.dropdownColumns.update).toHaveBeenCalledWith({
        where: { dropdownColumnsId: COLUMN_ID },
        data: {
          dropdownColumnsName: 'item_name',
          dropdownColumnsDropdownId: 7,
          dropdownColumnsNo: 1,
          dropdownColumnsDataType: 'string',
          dropdownColumnsModifiedBy: USER_ID,
        },
      });
      expect(prisma.dropdownColumns.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dropdownColumnsName: 'item_id',
          dropdownColumnsNo: 2,
          dropdownColumnsCreatedBy: USER_ID,
        }),
      });
      // Without replace_columns nothing is pruned.
      expect(prisma.dropdownColumns.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses a column id that is not a uuid', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(makeDropdown());

      const error = await refusalOf(
        service.save({
          dropdown_id: '7',
          dropdown_name: 'Item Master Dropdown',
          dropdown_sql: SQL,
          dropdown_columns: [
            {
              dropdown_columns_id: 'not-a-uuid',
              dropdown_columns_no: 1,
              dropdown_columns_data_type: 'string',
              dropdown_columns_name: 'item_name',
            },
          ],
        }),
      );

      expect(error.getStatus()).toBe(400);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.COLUMN_ID_INVALID);
      expect(prisma.dropdownColumns.update).not.toHaveBeenCalled();
    });

    // ── replace_columns ─────────────────────────────────────────────────────
    // The prune must run BEFORE the upsert: new columns carry no id, so a prune
    // after it would delete the rows the same save had just inserted.
    it('prunes the columns a replace save did not carry, before writing the new ones', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(makeDropdown());
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(makeDropdown()));

      await service.save({
        dropdown_id: '7',
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        replace_columns: true,
        dropdown_columns: [
          {
            dropdown_columns_id: COLUMN_ID,
            dropdown_columns_no: 1,
            dropdown_columns_data_type: 'string',
            dropdown_columns_name: 'item_name',
          },
          {
            dropdown_columns_no: 2,
            dropdown_columns_data_type: 'number',
            dropdown_columns_name: 'item_id',
          },
        ],
      });

      expect(prisma.dropdownColumns.deleteMany).toHaveBeenCalledWith({
        where: {
          dropdownColumnsDropdownId: 7,
          dropdownColumnsId: { notIn: [COLUMN_ID] },
        },
      });
      const pruneOrder = prisma.dropdownColumns.deleteMany.mock.invocationCallOrder[0];
      expect(pruneOrder).toBeLessThan(prisma.dropdownColumns.update.mock.invocationCallOrder[0]);
      expect(pruneOrder).toBeLessThan(prisma.dropdownColumns.create.mock.invocationCallOrder[0]);
    });

    it('prunes every stored column when a replace save carries none by id', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(makeDropdown());
      prisma.dropdownDetails.findFirstOrThrow.mockResolvedValueOnce(withColumns(makeDropdown()));

      await service.save({
        dropdown_id: '7',
        dropdown_name: 'Item Master Dropdown',
        dropdown_sql: SQL,
        replace_columns: true,
        dropdown_columns: [
          {
            dropdown_columns_no: 1,
            dropdown_columns_data_type: 'string',
            dropdown_columns_name: 'item_name',
          },
        ],
      });

      expect(prisma.dropdownColumns.deleteMany).toHaveBeenCalledWith({
        where: { dropdownColumnsDropdownId: 7 },
      });
      expect(prisma.dropdownColumns.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── dropdown id parsing (shared by save, getById, delete, list, run) ─────
  it.each([
    ['letters', 'abc', 'dropdown_id must be a numeric id'],
    ['a negative number', '-1', 'dropdown_id must be a numeric id'],
    ['a decimal', '1.5', 'dropdown_id must be a numeric id'],
    ['blank', '   ', 'dropdown_id must be a numeric id'],
    ['zero', '0', 'dropdown_id must be a positive numeric id'],
    ['beyond a safe integer', '9007199254740993', 'dropdown_id must be a positive numeric id'],
  ])(
    'refuses a dropdown id that is %s without touching the database',
    async (_label, id, message) => {
      const error = await refusalOf(service.getById(id));

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Validation error',
        errors: [{ field: 'dropdown_id', message, code: DropdownDetailErrorCode.ID_INVALID }],
      });
      expect(prisma.dropdownDetails.findFirst).not.toHaveBeenCalled();
    },
  );

  // ── getById ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('maps the stored row and its columns to the snake_case payload', async () => {
      const modifiedOn = new Date('2026-06-14T11:30:00.000Z');
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(
        withColumns(
          makeDropdown({
            dropdownDescription: 'Items',
            dropdownSortOrder: 'asc',
            dropdownWidth: 300,
            dropdownDeviceType: 'Desktop',
            dropdownModifiedOn: modifiedOn,
            dropdownModifiedBy: USER_ID,
          }),
          [
            makeColumn({
              dropdownColumnsAlias: 'Item Name',
              dropdownColumnsWidth: new Prisma.Decimal('180.50'),
              dropdownColumnsSqlName: 'item_name',
              dropdownColumnsSyncOn: modifiedOn,
            }),
          ],
        ),
      );

      const result = await service.getById(' 7 ');

      expect(prisma.dropdownDetails.findFirst).toHaveBeenCalledWith({
        where: { dropdownId: 7 },
        include: {
          dropdownColumns: {
            orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
          },
        },
      });
      expect(result).toEqual({
        dropdown_id: '7',
        dropdown_name: 'Item Master Dropdown',
        dropdown_description: 'Items',
        dropdown_sql: SQL,
        dropdown_sort_order: 'asc',
        dropdown_sort_column: null,
        dropdown_completion: null,
        dropdown_sql_regional: null,
        dropdown_max_visible_items: 10,
        dropdown_show_header: true,
        dropdown_width: 300,
        dropdown_device_type: 'Desktop',
        dropdown_created_on: '2026-06-13T10:00:00.000Z',
        dropdown_created_by: USER_ID,
        dropdown_modified_on: '2026-06-14T11:30:00.000Z',
        dropdown_modified_by: USER_ID,
        dropdown_sync_on: null,
        columns: [
          {
            dropdown_columns_id: COLUMN_ID,
            dropdown_columns_dropdown_id: '7',
            dropdown_columns_no: 1,
            dropdown_columns_data_type: 'string',
            dropdown_columns_name: 'item_name',
            dropdown_columns_alias: 'Item Name',
            dropdown_columns_width: 180.5,
            dropdown_columns_visiblity: true,
            dropdown_columns_allignment: null,
            dropdown_columns_filter: false,
            dropdown_columns_sql_name: 'item_name',
            dropdown_columns_created_on: '2026-06-13T10:00:00.000Z',
            dropdown_columns_created_by: USER_ID,
            dropdown_columns_modified_on: null,
            dropdown_columns_modified_by: null,
            dropdown_columns_sync_on: '2026-06-14T11:30:00.000Z',
          },
        ],
      });
    });

    it('answers 404 for a dropdown that does not exist', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(null);

      const error = await refusalOf(service.getById('42'));

      expect(error.getStatus()).toBe(404);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.NOT_FOUND);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('lists every dropdown by name when no filter is sent', async () => {
      prisma.dropdownDetails.findMany.mockResolvedValueOnce([
        withColumns(makeDropdown(), [makeColumn()]),
      ]);

      const result = await service.list({});

      expect(prisma.dropdownDetails.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ dropdownName: 'asc' }, { dropdownId: 'asc' }],
        include: {
          dropdownColumns: {
            orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
          },
        },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        dropdown_id: '7',
        columns: [{ dropdown_columns_id: COLUMN_ID }],
      });
    });

    it('filters by dropdownId, and takes dropdown_id when that is all the caller sent', async () => {
      await service.list({ dropdownId: '7' });
      await service.list({ dropdown_id: '8' });
      await service.list({ dropdownId: '7', dropdown_id: '8' });

      const wheres = prisma.dropdownDetails.findMany.mock.calls.map(([args]) => args.where);
      expect(wheres).toEqual([{ dropdownId: 7 }, { dropdownId: 8 }, { dropdownId: 7 }]);
    });

    it('searches name and description case-insensitively on the trimmed term', async () => {
      await service.list({ search: '  item  ' });

      expect(prisma.dropdownDetails.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { dropdownName: { contains: 'item', mode: 'insensitive' } },
              { dropdownDescription: { contains: 'item', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('ignores a blank search', async () => {
      await service.list({ search: '   ' });

      expect(prisma.dropdownDetails.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('refuses a dropdown id that is not numeric', async () => {
      const error = await refusalOf(service.list({ dropdownId: 'x' }));

      expect(error.getStatus()).toBe(400);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.ID_INVALID);
      expect(prisma.dropdownDetails.findMany).not.toHaveBeenCalled();
    });
  });

  // ── run ───────────────────────────────────────────────────────────────────
  describe('run', () => {
    beforeEach(() => {
      prisma.dropdownDetails.findFirst.mockResolvedValue({ dropdownId: 7, dropdownSql: SQL });
    });

    it('runs the stored SQL on page 1 of 20 by default', async () => {
      const result = await service.run({ dropdown_id: '7' });

      expect(prisma.dropdownDetails.findFirst).toHaveBeenCalledWith({
        where: { dropdownId: 7 },
        select: { dropdownId: true, dropdownSql: true },
      });
      expect(gridSql.validateBaseSql).toHaveBeenCalledWith({
        sql: SQL,
        tableName: 'inventory.item_master',
      });
      expect(gridSql.substituteGridPrm).not.toHaveBeenCalled();
      expect(prisma.dropdownColumns.findMany).not.toHaveBeenCalled();
      expect(gridSql.runPagedQuery).toHaveBeenCalledWith({
        baseSql: SQL,
        alias: 'cdropdown',
        search: undefined,
        limit: 20,
        skip: 0,
        searchableFieldNames: undefined,
      });
      expect(result).toEqual({ items: [{ item_id: 1 }], meta: { page: 1, limit: 20, total: 1 } });
    });

    it('skips the rows of the earlier pages', async () => {
      const result = await service.run({ dropdown_id: '7', page: 3, limit: 10 });

      expect(gridSql.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, skip: 20 }),
      );
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 1 });
    });

    it('runs the normalized SQL the validator hands back', async () => {
      gridSql.validateBaseSql.mockReturnValueOnce({
        isValid: true,
        normalizedSql: 'SELECT 1 FROM t',
      });

      await service.run({ dropdown_id: '7' });

      expect(gridSql.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ baseSql: 'SELECT 1 FROM t' }),
      );
    });

    it('validates against an empty table name when the SQL has no top-level FROM', async () => {
      gridSql.extractTopLevelFromTableName.mockReturnValueOnce(null);

      await service.run({ dropdown_id: '7' });

      expect(gridSql.validateBaseSql).toHaveBeenCalledWith({ sql: SQL, tableName: '' });
    });

    it('binds dropdown_param into the SQL before running it', async () => {
      const bound = `${SQL} WHERE branch_id = 1`;
      gridSql.substituteGridPrm.mockReturnValueOnce(bound);

      await service.run({
        dropdown_id: '7',
        dropdown_param: '{"branch_id":1,"name":"x","active":true,"parent":null}',
      });

      expect(gridSql.substituteGridPrm).toHaveBeenCalledWith(SQL, {
        branch_id: 1,
        name: 'x',
        active: true,
        parent: null,
      });
      expect(gridSql.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ baseSql: bound }),
      );
    });

    it('searches only the columns the dropdown marks searchable', async () => {
      const bound = `${SQL} WHERE branch_id = 1`;
      gridSql.substituteGridPrm.mockReturnValueOnce(bound);
      prisma.dropdownColumns.findMany.mockResolvedValueOnce([
        {
          dropdownColumnsFilter: true,
          dropdownColumnsSqlName: 'item_name',
          dropdownColumnsNo: 1,
          dropdownColumnsName: 'Item Name',
        },
      ]);

      await service.run({ dropdown_id: '7', search: 'soap', dropdown_param: '{"branch_id":1}' });

      expect(prisma.dropdownColumns.findMany).toHaveBeenCalledWith({
        where: { dropdownColumnsDropdownId: 7 },
        orderBy: { dropdownColumnsNo: 'asc' },
        select: {
          dropdownColumnsFilter: true,
          dropdownColumnsSqlName: true,
          dropdownColumnsNo: true,
          dropdownColumnsName: true,
        },
      });
      // The searchable names are derived against the SQL that will actually run.
      expect(gridSql.deriveSearchableFieldNamesFromColumns).toHaveBeenCalledWith(
        [{ filter: true, sqlFieldName: 'item_name', columnNumber: 1, columnName: 'Item Name' }],
        bound,
      );
      expect(gridSql.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'soap', searchableFieldNames: ['item_name'] }),
      );
    });

    it('loads no columns for a blank search', async () => {
      await service.run({ dropdown_id: '7', search: '   ' });

      expect(prisma.dropdownColumns.findMany).not.toHaveBeenCalled();
      expect(gridSql.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchableFieldNames: undefined }),
      );
    });

    it('answers 404 for a dropdown that does not exist', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(null);

      const error = await refusalOf(service.run({ dropdown_id: '42' }));

      expect(error.getStatus()).toBe(404);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.NOT_FOUND);
      expect(gridSql.runPagedQuery).not.toHaveBeenCalled();
    });

    it('refuses a dropdown with no SQL configured', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce({ dropdownId: 7, dropdownSql: '   ' });

      const error = await refusalOf(service.run({ dropdown_id: '7' }));

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Invalid dropdown SQL configuration',
        errors: [
          {
            field: 'dropdown_sql',
            message: 'Dropdown 7 has no configured SQL',
            code: DropdownDetailErrorCode.SQL_MISSING,
          },
        ],
      });
      expect(gridSql.validateBaseSql).not.toHaveBeenCalled();
    });

    it('refuses SQL the read-only validator rejects, with its reason', async () => {
      gridSql.validateBaseSql.mockReturnValueOnce({
        isValid: false,
        message: 'Only SELECT query is allowed',
      });

      const error = await refusalOf(service.run({ dropdown_id: '7' }));

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Invalid dropdown SQL configuration',
        errors: [
          {
            field: 'dropdown_sql',
            message: 'Only SELECT query is allowed',
            code: DropdownDetailErrorCode.SQL_INVALID,
          },
        ],
      });
      expect(gridSql.runPagedQuery).not.toHaveBeenCalled();
    });

    it.each([
      ['is not JSON', '{branch_id:1}', DropdownDetailErrorCode.PARAM_NOT_JSON],
      ['is an array', '[1,2]', DropdownDetailErrorCode.PARAM_NOT_OBJECT],
      ['is null', 'null', DropdownDetailErrorCode.PARAM_NOT_OBJECT],
      ['is a bare string', '"branch"', DropdownDetailErrorCode.PARAM_NOT_OBJECT],
      [
        'has a key that is not an identifier',
        '{"branch-id":1}',
        DropdownDetailErrorCode.PARAM_NAME_INVALID,
      ],
      [
        'has a key opening with a digit',
        '{"1branch":1}',
        DropdownDetailErrorCode.PARAM_NAME_INVALID,
      ],
      [
        'has an object value',
        '{"branch":{"id":1}}',
        DropdownDetailErrorCode.PARAM_VALUE_UNSUPPORTED,
      ],
      ['has an array value', '{"branch":[1]}', DropdownDetailErrorCode.PARAM_VALUE_UNSUPPORTED],
      [
        'has a number that overflows to Infinity',
        '{"branch":1e999}',
        DropdownDetailErrorCode.PARAM_VALUE_NOT_FINITE,
      ],
    ])(
      'refuses a dropdown_param that %s before reading the dropdown',
      async (_label, param, code) => {
        const error = await refusalOf(service.run({ dropdown_id: '7', dropdown_param: param }));

        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          success: false,
          message: 'Validation error',
          errors: [{ field: 'dropdown_param', code }],
        });
        expect(prisma.dropdownDetails.findFirst).not.toHaveBeenCalled();
        expect(gridSql.runPagedQuery).not.toHaveBeenCalled();
      },
    );

    // dropdown_sql is not executed at save time, so a broken query first fails here.
    it.each([
      [
        'an Error, with its whitespace collapsed',
        new Error('relation "inventory.item_master"\n   does not exist'),
        'dropdown_sql could not be executed: relation "inventory.item_master" does not exist',
      ],
      [
        'a plain object carrying a message',
        { message: '  syntax error at or near "FROM"  ' },
        'dropdown_sql could not be executed: syntax error at or near "FROM"',
      ],
      ['something with no message', 'boom', 'dropdown_sql could not be executed'],
    ])(
      'turns a database failure thrown as %s into a coded 400',
      async (_label, thrown, message) => {
        gridSql.runPagedQuery.mockRejectedValueOnce(thrown);

        const error = await refusalOf(service.run({ dropdown_id: '7' }));

        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toEqual({
          success: false,
          message: 'Invalid dropdown SQL configuration',
          errors: [{ field: 'dropdown_sql', message, code: DropdownDetailErrorCode.SQL_FAILED }],
        });
      },
    );
  });

  // ── column settings ───────────────────────────────────────────────────────
  describe.each([
    {
      method: 'updateColumnWidths',
      run: (s: DropdownDetailsService, ids: string[]) =>
        s.updateColumnWidths({
          columns: ids.map((id) => ({ dropdown_columns_id: id, dropdown_columns_width: 120 })),
        }),
      data: { dropdownColumnsWidth: 120 },
    },
    {
      method: 'updateFilterSettings',
      run: (s: DropdownDetailsService, ids: string[]) =>
        s.updateFilterSettings({
          columns: ids.map((id) => ({ dropdown_columns_id: id, dropdown_columns_filter: true })),
        }),
      data: { dropdownColumnsFilter: true },
    },
    {
      method: 'updateVisibilitySettings',
      run: (s: DropdownDetailsService, ids: string[]) =>
        s.updateVisibilitySettings({
          columns: ids.map((id) => ({
            dropdown_columns_id: id,
            dropdown_columns_visiblity: false,
          })),
        }),
      data: { dropdownColumnsVisiblity: false },
    },
  ])('$method', ({ run, data }) => {
    const call = (ids: string[]) => run(service, ids);

    it('writes only its own setting on every column and counts them', async () => {
      await expect(call([COLUMN_ID, OTHER_COLUMN_ID])).resolves.toEqual({ updated: 2 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.dropdownColumns.update).toHaveBeenNthCalledWith(1, {
        where: { dropdownColumnsId: COLUMN_ID },
        data,
      });
      expect(prisma.dropdownColumns.update).toHaveBeenNthCalledWith(2, {
        where: { dropdownColumnsId: OTHER_COLUMN_ID },
        data,
      });
    });

    it('updates nothing for an empty list', async () => {
      await expect(call([])).resolves.toEqual({ updated: 0 });

      expect(prisma.dropdownColumns.update).not.toHaveBeenCalled();
    });

    it('answers 404 at the first column that does not exist', async () => {
      prisma.dropdownColumns.findFirst
        .mockResolvedValueOnce({ dropdownColumnsId: COLUMN_ID })
        .mockResolvedValueOnce(null);

      const error = await refusalOf(call([COLUMN_ID, OTHER_COLUMN_ID]));

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Dropdown column not found',
        errors: [
          {
            field: 'dropdown_columns_id',
            message: `No dropdown column found with id ${OTHER_COLUMN_ID}`,
            code: DropdownDetailErrorCode.COLUMN_NOT_FOUND,
          },
        ],
      });
      expect(prisma.dropdownColumns.update).toHaveBeenCalledTimes(1);
    });

    it('refuses a column id that is not a uuid', async () => {
      const error = await refusalOf(call(['12']));

      expect(error.getStatus()).toBe(400);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.COLUMN_ID_INVALID);
      expect(prisma.dropdownColumns.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('deletes the dropdown and audits it as a cancel', async () => {
      const existing = makeDropdown();
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(existing);

      await expect(service.delete('7')).resolves.toEqual({ dropdown_id: '7', deleted: true });

      expect(prisma.dropdownDetails.delete).toHaveBeenCalledWith({ where: { dropdownId: 7 } });
      expect(auditLog.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          tableName: 'dropdown details',
          screenName: 'Dropdown Details',
          pk: '7',
          displayName: 'Item Master Dropdown',
          originalRecord: expect.objectContaining({ dropdown_id: '7', columns: [] }),
          modifiedRecord: expect.objectContaining({ dropdown_id: '7', columns: [] }),
          userId: USER_ID,
          notes: 'Dropdown details deleted',
        }),
        prisma,
      );
    });

    it('answers 404 for a dropdown that does not exist and deletes nothing', async () => {
      prisma.dropdownDetails.findFirst.mockResolvedValueOnce(null);

      const error = await refusalOf(service.delete('42'));

      expect(error.getStatus()).toBe(404);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.NOT_FOUND);
      expect(prisma.dropdownDetails.delete).not.toHaveBeenCalled();
      expect(auditLog.logEntityChange).not.toHaveBeenCalled();
    });

    it('refuses a missing id before opening a transaction', async () => {
      const error = await refusalOf(service.delete(''));

      expect(error.getStatus()).toBe(400);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.ID_INVALID);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── deleteColumn ──────────────────────────────────────────────────────────
  describe('deleteColumn', () => {
    it('deletes the column and audits it under the column table', async () => {
      const existing = makeColumn();
      prisma.dropdownColumns.findFirst.mockResolvedValueOnce(existing);

      await expect(service.deleteColumn(COLUMN_ID)).resolves.toEqual({
        dropdown_columns_id: COLUMN_ID,
        deleted: true,
      });

      expect(prisma.dropdownColumns.delete).toHaveBeenCalledWith({
        where: { dropdownColumnsId: COLUMN_ID },
      });
      expect(auditLog.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          tableName: 'dropdown column',
          screenName: 'Dropdown Details',
          pk: COLUMN_ID,
          displayName: 'item_name',
          originalRecord: expect.objectContaining({ dropdown_columns_id: COLUMN_ID }),
          modifiedRecord: expect.objectContaining({ dropdown_columns_id: COLUMN_ID }),
          userId: USER_ID,
          notes: 'Dropdown column deleted',
        }),
        prisma,
      );
    });

    it('answers 404 for a column that does not exist and deletes nothing', async () => {
      prisma.dropdownColumns.findFirst.mockResolvedValueOnce(null);

      const error = await refusalOf(service.deleteColumn(COLUMN_ID));

      expect(error.getStatus()).toBe(404);
      expect(codeOf(error)).toBe(DropdownDetailErrorCode.COLUMN_NOT_FOUND);
      expect(prisma.dropdownColumns.delete).not.toHaveBeenCalled();
    });

    it('refuses a missing id before opening a transaction', async () => {
      const error = await refusalOf(service.deleteColumn(''));

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Validation error',
        errors: [
          {
            field: 'dropdown_columns_id',
            message: 'dropdown_columns_id must be a valid UUID',
            code: DropdownDetailErrorCode.COLUMN_ID_INVALID,
          },
        ],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
