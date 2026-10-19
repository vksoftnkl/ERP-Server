import { HttpException } from '@nestjs/common';
import { Prisma, Uitable, UitableColumns } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { UiTableMasterService } from './ui-table-master.service';
import { UiTableMasterErrorCode } from './types/ui-table-master-error-codes';

/** Any id the mock recognises; the column is looked up before it is written. */
const COLUMN_ID = '4217';

type PrismaMock = {
  uitableColumns: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('UiTableMasterService.updateColumnWidths', () => {
  let prisma: PrismaMock;
  let service: UiTableMasterService;

  beforeEach(() => {
    prisma = {
      uitableColumns: {
        findFirst: jest.fn().mockResolvedValue({ uiTblClmId: BigInt(COLUMN_ID) }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    service = new UiTableMasterService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as never,
      { getUserId: jest.fn().mockReturnValue(null) } as never,
    );
  });

  const writtenData = () =>
    (prisma.uitableColumns.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  it('stores the pixel width a dragged column was left at, and nothing else', async () => {
    // What the grids send: the width the browser laid the column out at, alone.
    await service.updateColumnWidths({
      columns: [{ uiTblClmId: COLUMN_ID, uiTblClmPx: '212px' }],
    });

    const data = writtenData();
    expect(data.uiTblClmPx).toBe('212px');
    expect(data).not.toHaveProperty('uiTblClmColumnWidth');
  });

  it('leaves a stored pixel width alone when the caller sends the fraction only', async () => {
    // The desktop client posts `uiTblClmColumnWidth` by itself; that must not
    // wipe the exact width the browser saved.
    await service.updateColumnWidths({
      columns: [{ uiTblClmId: COLUMN_ID, uiTblClmColumnWidth: 11.5 }],
    });

    const data = writtenData();
    expect(data.uiTblClmColumnWidth).toBe(11.5);
    expect(data).not.toHaveProperty('uiTblClmPx');
  });

  it('writes both widths when a caller sends both', async () => {
    await service.updateColumnWidths({
      columns: [{ uiTblClmId: COLUMN_ID, uiTblClmColumnWidth: 11.5, uiTblClmPx: '212px' }],
    });

    const data = writtenData();
    expect(data.uiTblClmColumnWidth).toBe(11.5);
    expect(data.uiTblClmPx).toBe('212px');
  });
});

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f801';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const tableRow = (overrides: Partial<Uitable> = {}): Uitable => ({
  uiTblId: 7n,
  uiTblName: 'Sale bill items',
  uiTblEditable: true,
  uiTblIsActive: true,
  uiTblIsDeleted: false,
  uiTblSyncDate: null,
  uiTblCreatedOn: STAMP,
  uiTblCreatedBy: USER_ID,
  uiTblModifiedOn: STAMP,
  uiTblModifiedBy: USER_ID,
  uiTblDeviceType: 'Desktop',
  uiTblSyncOn: null,
  ...overrides,
});

const columnRow = (overrides: Partial<UitableColumns> = {}): UitableColumns => ({
  uiTblClmId: 70n,
  uiTblClmNo: 1n,
  uiTblClmTableId: 7n,
  uiTblClmName: 'Item',
  uiTblClmColumnWidth: new Prisma.Decimal('12.5'),
  uiTblClmColumnVisibility: true,
  uiTblClmColumnFocus: false,
  uiTblClmColumnPosition: 1,
  uiTblClmColumnNecessity: true,
  uiTblClmNextColumn: null,
  uiTblClmPreviousColumn: null,
  uiTblClmPx: '212px',
  uiTblClmIsActive: true,
  uiTblClmIsDeleted: false,
  uiTblClmSyncDate: null,
  uiTblClmCreatedOn: STAMP,
  uiTblClmCreatedBy: USER_ID,
  uiTblClmModifiedOn: STAMP,
  uiTblClmModifiedBy: USER_ID,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

type FullPrismaMock = {
  uitable: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  uitableColumns: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('UiTableMasterService', () => {
  let prisma: FullPrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: UiTableMasterService;
  let nextColumnId: bigint;

  beforeEach(() => {
    nextColumnId = 900n;
    prisma = {
      uitable: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ ...tableRow(), uiTableColumns: [columnRow()] }),
        create: jest.fn().mockResolvedValue(tableRow()),
        update: jest.fn().mockResolvedValue(tableRow()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      uitableColumns: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async () => columnRow({ uiTblClmId: nextColumnId++ })),
        update: jest.fn().mockResolvedValue(columnRow()),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (callback: (tx: FullPrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new UiTableMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('ids', () => {
    it.each([
      ['getById', (s: UiTableMasterService) => s.getById('7a'), 'uiTblId'],
      ['softDelete', (s: UiTableMasterService) => s.softDelete(''), 'uiTblId'],
      ['softDeleteColumn', (s: UiTableMasterService) => s.softDeleteColumn('-1'), 'uiTblClmId'],
    ])('%s refuses an id that is not a whole number', async (_name, call, field) => {
      const refusal = await refusalOf(call(service));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field, code: UiTableMasterErrorCode.ID_INVALID }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('reads live tables with their live columns in column order', async () => {
      await service.list({});

      expect(prisma.uitable.findMany).toHaveBeenCalledWith({
        where: { uiTblIsDeleted: false },
        orderBy: { uiTblId: 'asc' },
        include: {
          uiTableColumns: {
            where: { uiTblClmIsDeleted: false },
            orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
          },
        },
      });
    });

    it('prefers uiTableId over uiTblId and searches the name loosely', async () => {
      await service.list({ uiTableId: '7', uiTblId: '8', search: '  sale ' });

      expect(prisma.uitable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            uiTblIsDeleted: false,
            uiTblId: 7n,
            uiTblName: { contains: 'sale', mode: 'insensitive' },
          },
        }),
      );
    });

    it('turns big ints into text and the decimal width into a number', async () => {
      prisma.uitable.findMany.mockResolvedValue([
        {
          ...tableRow(),
          uiTableColumns: [columnRow(), columnRow({ uiTblClmNo: null, uiTblClmColumnWidth: null })],
        },
      ]);

      const { items } = await service.list({});

      expect(items[0]).toMatchObject({
        uiTblId: '7',
        uiTblDeviceType: 'Desktop',
        uiTblCreatedOn: STAMP.toISOString(),
        columns: [
          { uiTblClmId: '70', uiTblClmNo: '1', uiTblClmTableId: '7', uiTblClmColumnWidth: 12.5 },
          { uiTblClmNo: '', uiTblClmColumnWidth: null },
        ],
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live table', async () => {
      const refusal = await refusalOf(service.getById('7'));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'uiTblId', code: UiTableMasterErrorCode.NOT_FOUND }] },
      });
    });

    it('returns the table with its columns', async () => {
      prisma.uitable.findFirst.mockResolvedValue({ ...tableRow(), uiTableColumns: [columnRow()] });

      await expect(service.getById(' 7 ')).resolves.toMatchObject({
        uiTblId: '7',
        columns: [{ uiTblClmName: 'Item' }],
      });
      expect(prisma.uitable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uiTblId: 7n, uiTblIsDeleted: false } }),
      );
    });
  });

  describe('save — create (no uiTblId)', () => {
    it('refuses a blank name', async () => {
      const refusal = await refusalOf(service.save({ uiTblName: '   ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'uiTblName', code: UiTableMasterErrorCode.NAME_REQUIRED }] },
      });
    });

    it('refuses a name another live table holds', async () => {
      prisma.uitable.findFirst.mockResolvedValue({ uiTblId: 3n });

      const refusal = await refusalOf(service.save({ uiTblName: 'sale bill items' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: UiTableMasterErrorCode.NAME_DUPLICATE }] },
      });
      expect(prisma.uitable.create).not.toHaveBeenCalled();
    });

    it('creates the table and its columns, then answers with the re-read table', async () => {
      const payload = await service.save({
        uiTblName: ' Sale bill items ',
        uiTblEditable: true,
        uiTblColumns: [
          { uiTblClmName: ' Item ', uiTblClmNo: '1', uiTblClmPx: '212px' },
          { uiTblClmName: 'Qty' },
        ],
      });

      expect(prisma.uitable.create).toHaveBeenCalledWith({
        data: {
          uiTblName: 'Sale bill items',
          uiTblCreatedOn: expect.any(Date),
          uiTblCreatedBy: USER_ID,
          uiTblEditable: true,
        },
      });
      expect(prisma.uitableColumns.create).toHaveBeenNthCalledWith(1, {
        data: {
          uiTblClmName: 'Item',
          uiTblClmTableId: 7n,
          uiTblClmCreatedOn: expect.any(Date),
          uiTblClmCreatedBy: USER_ID,
          uiTblClmNo: 1n,
          uiTblClmPx: '212px',
        },
      });
      expect(prisma.uitableColumns.create).toHaveBeenCalledTimes(2);
      expect(payload.columns).toHaveLength(1);
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'ui tables',
        pk: '7',
        originalRecord: null,
        modifiedRecord: payload,
      });
    });

    it('refuses a column with a blank name and creates nothing after it', async () => {
      const refusal = await refusalOf(
        service.save({ uiTblName: 'Grid', uiTblColumns: [{ uiTblClmName: '  ' }] }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'uiTblClmName', code: UiTableMasterErrorCode.COLUMN_NAME_REQUIRED }],
        },
      });
      expect(prisma.uitableColumns.create).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.uitable.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ uiTblName: 'Grid' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'uiTblName', code: UiTableMasterErrorCode.NAME_DUPLICATE }] },
      });
    });
  });

  describe('save — update (uiTblId present)', () => {
    beforeEach(() => {
      prisma.uitable.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          // The existence read names the id; the duplicate-name read does not.
          'uiTblName' in where ? null : tableRow(),
      );
    });

    it('refuses an id with no live table', async () => {
      prisma.uitable.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save({ uiTblId: '7', uiTblName: 'X' }));

      expect(refusal.status).toBe(404);
      expect(prisma.uitable.update).not.toHaveBeenCalled();
    });

    it('leaves the name alone when the update sends none', async () => {
      await service.save({ uiTblId: '7', uiTblName: '', uiTblIsActive: false });

      expect(prisma.uitable.update).toHaveBeenCalledWith({
        where: { uiTblId: 7n },
        data: {
          uiTblModifiedOn: expect.any(Date),
          uiTblModifiedBy: USER_ID,
          uiTblIsActive: false,
        },
      });
      expect(prisma.uitable.findFirst).toHaveBeenCalledTimes(1);
    });

    it('renames after checking the name against every other table', async () => {
      await service.save({ uiTblId: '7', uiTblName: ' Sale items ' });

      expect(prisma.uitable.findFirst).toHaveBeenLastCalledWith({
        where: {
          uiTblIsDeleted: false,
          uiTblName: { equals: 'Sale items', mode: 'insensitive' },
          uiTblId: { not: 7n },
        },
        select: { uiTblId: true },
      });
      expect(prisma.uitable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ uiTblName: 'Sale items' }) as object,
        }),
      );
    });

    it('updates the columns it names, creates the new ones, and leaves the rest alone', async () => {
      await service.save({
        uiTblId: '7',
        uiTblColumns: [{ uiTblClmId: '70', uiTblClmName: 'Item' }, { uiTblClmName: 'Rate' }],
      } as never);

      expect(prisma.uitableColumns.update).toHaveBeenCalledWith({
        where: { uiTblClmId: 70n },
        data: {
          uiTblClmName: 'Item',
          uiTblClmTableId: 7n,
          uiTblClmModifiedOn: expect.any(Date),
          uiTblClmModifiedBy: USER_ID,
        },
      });
      expect(prisma.uitableColumns.create).toHaveBeenCalledTimes(1);
      expect(prisma.uitableColumns.updateMany).not.toHaveBeenCalled();
    });

    it('on replaceColumns soft-deletes every column it did not just keep or create', async () => {
      await service.save({
        uiTblId: '7',
        replaceColumns: true,
        uiTblColumns: [{ uiTblClmId: '70', uiTblClmName: 'Item' }, { uiTblClmName: 'Rate' }],
      } as never);

      expect(prisma.uitableColumns.updateMany).toHaveBeenCalledWith({
        where: {
          uiTblClmTableId: 7n,
          uiTblClmIsDeleted: false,
          uiTblClmId: { notIn: [70n, 900n] },
        },
        data: {
          uiTblClmIsDeleted: true,
          uiTblClmIsActive: false,
          uiTblClmModifiedOn: expect.any(Date),
          uiTblClmModifiedBy: USER_ID,
        },
      });
    });

    it('on replaceColumns with an empty list soft-deletes every column', async () => {
      await service.save({ uiTblId: '7', replaceColumns: true, uiTblColumns: [] } as never);

      expect(prisma.uitableColumns.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uiTblClmTableId: 7n, uiTblClmIsDeleted: false } }),
      );
    });

    it('audits the update against the stored table', async () => {
      const payload = await service.save({ uiTblId: '7', uiTblEditable: false } as never);

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: '7',
        originalRecord: expect.objectContaining({ uiTblId: '7', columns: [] }),
        modifiedRecord: payload,
      });
    });
  });

  describe('updateVisibilitySettings', () => {
    it('refuses a column id with no live column', async () => {
      const refusal = await refusalOf(
        service.updateVisibilitySettings({ columns: [{ uiTblClmId: '70' }] }),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [{ field: 'uiTblClmId', code: UiTableMasterErrorCode.COLUMN_NOT_FOUND }],
        },
      });
    });

    it('writes every layout field sent, a null included, and nothing else', async () => {
      prisma.uitableColumns.findFirst.mockResolvedValue({ uiTblClmId: 70n });

      const result = await service.updateVisibilitySettings({
        columns: [
          { uiTblClmId: '70', uiTblClmColumnVisibility: false, uiTblClmNextColumn: null },
          { uiTblClmId: '71', uiTblClmColumnPosition: 3 },
        ],
      });

      expect(result).toEqual({ updated: 2 });
      expect(prisma.uitableColumns.update).toHaveBeenNthCalledWith(1, {
        where: { uiTblClmId: 70n },
        data: {
          uiTblClmModifiedOn: expect.any(Date),
          uiTblClmModifiedBy: USER_ID,
          uiTblClmColumnVisibility: false,
          uiTblClmNextColumn: null,
        },
      });
      expect(prisma.uitableColumns.update).toHaveBeenNthCalledWith(2, {
        where: { uiTblClmId: 71n },
        data: {
          uiTblClmModifiedOn: expect.any(Date),
          uiTblClmModifiedBy: USER_ID,
          uiTblClmColumnPosition: 3,
        },
      });
    });
  });

  describe('updateColumnWidths', () => {
    it('refuses a column id with no live column', async () => {
      const refusal = await refusalOf(
        service.updateColumnWidths({ columns: [{ uiTblClmId: '70', uiTblClmPx: '90px' }] }),
      );

      expect(refusal.status).toBe(404);
      expect(prisma.uitableColumns.update).not.toHaveBeenCalled();
    });

    it('counts the columns it wrote', async () => {
      prisma.uitableColumns.findFirst.mockResolvedValue({ uiTblClmId: 70n });

      await expect(
        service.updateColumnWidths({
          columns: [
            { uiTblClmId: '70', uiTblClmPx: '90px' },
            { uiTblClmId: '71', uiTblClmColumnWidth: 4 },
          ],
        }),
      ).resolves.toEqual({ updated: 2 });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live table', async () => {
      const refusal = await refusalOf(service.softDelete('7'));

      expect(refusal.status).toBe(404);
      expect(prisma.uitable.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.uitable.findFirst.mockResolvedValue(tableRow());
      prisma.uitable.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete('7'));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the table deleted and audits it under a fallback name when it has none', async () => {
      prisma.uitable.findFirst.mockResolvedValue(tableRow({ uiTblName: null }));

      await expect(service.softDelete('7')).resolves.toEqual({ uiTblId: '7', deleted: true });
      expect(prisma.uitable.updateMany).toHaveBeenCalledWith({
        where: { uiTblId: 7n, uiTblIsDeleted: false },
        data: {
          uiTblIsDeleted: true,
          uiTblIsActive: false,
          uiTblModifiedOn: expect.any(Date),
          uiTblModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'UI Table 7',
        modifiedRecord: expect.objectContaining({ uiTblIsDeleted: true }),
      });
    });
  });

  describe('softDeleteColumn', () => {
    it('refuses an id with no live column', async () => {
      const refusal = await refusalOf(service.softDeleteColumn('70'));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: UiTableMasterErrorCode.COLUMN_NOT_FOUND }] },
      });
    });

    it('marks the column deleted and audits it against the column table', async () => {
      prisma.uitableColumns.findFirst.mockResolvedValue(columnRow({ uiTblClmName: '  ' }));

      await expect(service.softDeleteColumn('70')).resolves.toEqual({
        uiTblClmId: '70',
        deleted: true,
      });
      expect(prisma.uitableColumns.update).toHaveBeenCalledWith({
        where: { uiTblClmId: 70n },
        data: {
          uiTblClmIsDeleted: true,
          uiTblClmIsActive: false,
          uiTblClmModifiedOn: expect.any(Date),
          uiTblClmModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        tableName: 'ui table columns',
        displayName: 'UI table column 70',
        modifiedRecord: expect.objectContaining({ uiTblClmIsDeleted: true }),
      });
    });
  });
});
