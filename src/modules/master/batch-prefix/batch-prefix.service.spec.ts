import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BatchPrefix, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { BatchPrefixService } from './batch-prefix.service';
import { SaveBatchPrefixDto } from './dto/save-batch-prefix.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
import { BATCH_PREFIX_ERROR } from './types/batch-prefix-error-codes';

const PREFIX_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const OTHER_PREFIX_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b0ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makePrefix = (overrides: Partial<BatchPrefix> = {}): BatchPrefix => ({
  id: PREFIX_ID,
  prefixUsed: 'KR',
  syncDate: null,
  createdBy: USER_ID,
  createdOn: CREATED_ON,
  modifiedBy: null,
  modifiedOn: null,
  ...overrides,
});

type PrefixCreateArgs = { data: Prisma.BatchPrefixUncheckedCreateInput };
type PrefixUpdateArgs = { where: { id: string }; data: Prisma.BatchPrefixUncheckedUpdateInput };
type PrefixFindArgs = { where: Record<string, unknown>; select?: Record<string, boolean> };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  batchPrefix: {
    findUnique: jest.Mock<Promise<BatchPrefix | null>, [{ where: { id: string } }]>;
    findFirst: jest.Mock<Promise<{ id: string } | null>, [PrefixFindArgs]>;
    findMany: jest.Mock<Promise<BatchPrefix[]>, [unknown]>;
    count: jest.Mock<Promise<number>, [unknown]>;
    create: jest.Mock<Promise<BatchPrefix>, [PrefixCreateArgs]>;
    update: jest.Mock<Promise<BatchPrefix>, [PrefixUpdateArgs]>;
    delete: jest.Mock<Promise<BatchPrefix>, [{ where: { id: string } }]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

type GridMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
  loadPrimaryGridStyles: jest.Mock;
};

/** The refusal body a thrown HttpException carries. */
const bodyOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getResponse();
    throw error;
  }
  throw new Error('expected the call to refuse');
};

const DUPLICATE_BODY = {
  success: false,
  message: 'Batch prefix already exists',
  errors: [
    {
      field: 'prefixUsed',
      message: 'Duplicate prefixUsed is not allowed',
      code: BATCH_PREFIX_ERROR.DUPLICATE,
    },
  ],
};

const notFoundBody = (id: string) => ({
  success: false,
  message: 'Batch prefix not found',
  errors: [
    {
      field: 'id',
      message: `No batch prefix found with id ${id}`,
      code: BATCH_PREFIX_ERROR.NOT_FOUND,
    },
  ],
});

describe('BatchPrefixService', () => {
  let service: BatchPrefixService;
  let prisma: PrismaMock;
  let grid: GridMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      batchPrefix: {
        findUnique: jest.fn<Promise<BatchPrefix | null>, [{ where: { id: string } }]>(() =>
          Promise.resolve(null),
        ),
        // Default: no other row holds the prefix.
        findFirst: jest.fn<Promise<{ id: string } | null>, [PrefixFindArgs]>(() =>
          Promise.resolve(null),
        ),
        findMany: jest.fn<Promise<BatchPrefix[]>, [unknown]>(() => Promise.resolve([makePrefix()])),
        count: jest.fn<Promise<number>, [unknown]>(() => Promise.resolve(1)),
        create: jest.fn(({ data }: PrefixCreateArgs) =>
          Promise.resolve(makePrefix({ ...(data as unknown as Partial<BatchPrefix>) })),
        ),
        update: jest.fn(({ where, data }: PrefixUpdateArgs) =>
          Promise.resolve(
            makePrefix({ ...(data as unknown as Partial<BatchPrefix>), id: where.id }),
          ),
        ),
        delete: jest.fn<Promise<BatchPrefix>, [{ where: { id: string } }]>(() =>
          Promise.resolve(makePrefix()),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    grid = {
      // Default: no configured grid, so list falls back to Prisma.
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({
        isValid: true,
        normalizedSql: 'SELECT * FROM batches_prefix',
      })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      loadPrimaryGridStyles: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new BatchPrefixService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      grid as unknown as ConfiguredGridSqlService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no id)', () => {
    it('trims the prefix, clears the sync date and stamps the creator', async () => {
      const payload = await service.save({ prefixUsed: '  KR ' });

      expect(prisma.batchPrefix.create.mock.calls[0][0].data).toEqual({
        prefixUsed: 'KR',
        syncDate: null,
        createdBy: USER_ID,
        createdOn: expect.any(Date) as Date,
      });
      expect(payload).toMatchObject({
        id: PREFIX_ID,
        prefixUsed: 'KR',
        syncDate: null,
        createdBy: USER_ID,
        modifiedBy: null,
        modifiedOn: null,
      });
      expect(prisma.batchPrefix.update).not.toHaveBeenCalled();
    });

    it('stores a sent sync date as a Date and returns it as ISO', async () => {
      const payload = await service.save({ prefixUsed: 'KR', syncDate: '2026-10-03T09:00:00Z' });

      expect(prisma.batchPrefix.create.mock.calls[0][0].data.syncDate).toEqual(
        new Date('2026-10-03T09:00:00.000Z'),
      );
      expect(payload.syncDate).toBe('2026-10-03T09:00:00.000Z');
    });

    it('refuses a sync date that is not a date with BATCH_PREFIX_DATE_INVALID', async () => {
      const promise = service.save({ prefixUsed: 'KR', syncDate: 'yesterday' });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'syncDate',
            message: 'syncDate must be a valid ISO-8601 date-time',
            code: BATCH_PREFIX_ERROR.DATE_INVALID,
          },
        ],
      });
      expect(prisma.batchPrefix.create).not.toHaveBeenCalled();
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save({ prefixUsed: 'KR' });

      expect(prisma.batchPrefix.create.mock.calls[0][0].data.createdBy).toBe(DEFAULT_ACTOR);
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe(DEFAULT_ACTOR);
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save({ prefixUsed: 'KR' });

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'batch prefix',
        screenName: 'Batch Prefix',
        screenType: 'master',
        pk: PREFIX_ID,
        displayName: 'KR',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Batch prefix created',
      });
      expect(client).toBe(prisma);
    });

    it('checks the prefix against every row in any letter case', async () => {
      await service.save({ prefixUsed: 'kr' });

      expect(prisma.batchPrefix.findFirst).toHaveBeenCalledWith({
        where: { prefixUsed: { equals: 'kr', mode: 'insensitive' } },
        select: { id: true },
      });
    });

    it('refuses a prefix another row holds with BATCH_PREFIX_DUPLICATE', async () => {
      prisma.batchPrefix.findFirst.mockResolvedValueOnce({ id: OTHER_PREFIX_ID });

      const promise = service.save({ prefixUsed: 'KR' });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual(DUPLICATE_BODY);
      expect(prisma.batchPrefix.create).not.toHaveBeenCalled();
    });

    it('refuses a blank prefix with BATCH_PREFIX_PREFIX_EMPTY', async () => {
      const promise = service.save({ prefixUsed: '   ' });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'prefixUsed',
            message: 'prefixUsed must not be empty',
            code: BATCH_PREFIX_ERROR.PREFIX_EMPTY,
          },
        ],
      });
      expect(prisma.batchPrefix.findFirst).not.toHaveBeenCalled();
    });

    it('answers a unique violation on the insert as the duplicate', async () => {
      prisma.batchPrefix.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(bodyOf(service.save({ prefixUsed: 'KR' }))).resolves.toEqual(DUPLICATE_BODY);
    });

    it('lets any other failure through unchanged', async () => {
      const failure = new Error('connection reset');
      prisma.batchPrefix.create.mockRejectedValueOnce(failure);

      await expect(service.save({ prefixUsed: 'KR' })).rejects.toBe(failure);
    });
  });

  describe('save — update (id sent)', () => {
    beforeEach(() => {
      prisma.batchPrefix.findUnique.mockResolvedValue(makePrefix());
    });

    it('updates the row with the trimmed prefix and stamps the modifier', async () => {
      const payload = await service.save({ id: PREFIX_ID, prefixUsed: ' KRT ' });

      expect(prisma.batchPrefix.findUnique).toHaveBeenCalledWith({ where: { id: PREFIX_ID } });
      const { where, data } = prisma.batchPrefix.update.mock.calls[0][0];
      expect(where).toEqual({ id: PREFIX_ID });
      expect(data).toEqual({
        prefixUsed: 'KRT',
        modifiedBy: USER_ID,
        modifiedOn: expect.any(Date) as Date,
      });
      expect(payload).toMatchObject({ id: PREFIX_ID, prefixUsed: 'KRT', modifiedBy: USER_ID });
      expect(prisma.batchPrefix.create).not.toHaveBeenCalled();
    });

    it('skips its own row when checking the prefix', async () => {
      await service.save({ id: PREFIX_ID, prefixUsed: 'KR' });

      expect(prisma.batchPrefix.findFirst).toHaveBeenCalledWith({
        where: { prefixUsed: { equals: 'KR', mode: 'insensitive' }, id: { not: PREFIX_ID } },
        select: { id: true },
      });
    });

    it.each([
      ['sets a sent date', '2026-10-03T09:00:00Z', new Date('2026-10-03T09:00:00.000Z')],
      ['clears it on null', null, null],
    ])('syncDate: %s', async (_label, syncDate, expected) => {
      await service.save({ id: PREFIX_ID, prefixUsed: 'KR', syncDate });

      expect(prisma.batchPrefix.update.mock.calls[0][0].data.syncDate).toEqual(expected);
    });

    it('leaves the sync date alone when the body does not carry it', async () => {
      await service.save({ id: PREFIX_ID, prefixUsed: 'KR' });

      expect(prisma.batchPrefix.update.mock.calls[0][0].data).not.toHaveProperty('syncDate');
    });

    it('leaves the sync date alone when a piped body leaves it out', async () => {
      const dto = (await createHouseValidationPipe().transform(
        { id: PREFIX_ID, prefixUsed: 'KR' },
        { type: 'body', metatype: SaveBatchPrefixDto },
      )) as SaveBatchPrefixDto;
      expect(Object.prototype.hasOwnProperty.call(dto, 'syncDate')).toBe(true);

      await service.save(dto);

      expect(prisma.batchPrefix.update.mock.calls[0][0].data).not.toHaveProperty('syncDate');
    });

    it('refuses a sync date that is not a date', async () => {
      await expect(
        bodyOf(service.save({ id: PREFIX_ID, prefixUsed: 'KR', syncDate: 'soon' })),
      ).resolves.toMatchObject({ errors: [{ code: BATCH_PREFIX_ERROR.DATE_INVALID }] });
      expect(prisma.batchPrefix.update).not.toHaveBeenCalled();
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save({ id: PREFIX_ID, prefixUsed: 'KRT' });

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        tableName: 'batch prefix',
        pk: PREFIX_ID,
        displayName: 'KRT',
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Batch prefix updated',
      });
      expect(entry.originalRecord).toMatchObject({ prefixUsed: 'KR' });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no row', async () => {
      prisma.batchPrefix.findUnique.mockResolvedValue(null);

      const promise = service.save({ id: PREFIX_ID, prefixUsed: 'KR' });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual(notFoundBody(PREFIX_ID));
      expect(prisma.batchPrefix.update).not.toHaveBeenCalled();
    });

    it('refuses a prefix another row holds', async () => {
      prisma.batchPrefix.findFirst.mockResolvedValueOnce({ id: OTHER_PREFIX_ID });

      await expect(bodyOf(service.save({ id: PREFIX_ID, prefixUsed: 'XX' }))).resolves.toEqual(
        DUPLICATE_BODY,
      );
      expect(prisma.batchPrefix.update).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('falls back to the table when no grid is configured, oldest-first by prefix', async () => {
      prisma.batchPrefix.count.mockResolvedValueOnce(45);

      const result = await service.list({});

      expect(grid.loadCandidates).toHaveBeenCalledWith({ tableName: 'batch prefix' });
      expect(prisma.batchPrefix.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ prefixUsed: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      });
      expect(prisma.batchPrefix.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        items: [expect.objectContaining({ id: PREFIX_ID, prefixUsed: 'KR' })],
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      });
    });

    it('pages by page and limit', async () => {
      await service.list({ page: 3, limit: 10 });

      expect(prisma.batchPrefix.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('searches prefix, creator and modifier with the trimmed text', async () => {
      await service.list({ search: '  kr ' });

      const where = {
        OR: [
          { prefixUsed: { contains: 'kr', mode: 'insensitive' } },
          { createdBy: { contains: 'kr', mode: 'insensitive' } },
          { modifiedBy: { contains: 'kr', mode: 'insensitive' } },
        ],
      };
      expect(prisma.batchPrefix.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(prisma.batchPrefix.count).toHaveBeenCalledWith({ where });
    });

    it('reads a blank search as no search', async () => {
      await service.list({ search: '   ' });

      expect(prisma.batchPrefix.count).toHaveBeenCalledWith({ where: {} });
    });

    it('attaches the grid styles when the screen has them', async () => {
      const styles = [{ columnName: 'prefix_used' }];
      grid.loadPrimaryGridStyles.mockResolvedValueOnce(styles);

      await expect(service.list({})).resolves.toMatchObject({ styles });
      expect(grid.loadPrimaryGridStyles).toHaveBeenCalledWith('batch prefix');
    });

    it('answers from the configured grid when one is set up, without touching the table', async () => {
      grid.loadCandidates.mockResolvedValueOnce([
        { gridId: 9n, gridSql: 'SELECT * FROM batches_prefix' },
      ]);
      grid.runPagedQuery.mockResolvedValueOnce({ items: [{ prefix_used: 'KR' }], total: 1 });

      const result = await service.list({ search: 'kr', page: 2, limit: 5 });

      expect(grid.runPagedQuery).toHaveBeenCalledWith({
        baseSql: 'SELECT * FROM batches_prefix',
        alias: 'batch_prefix_grid',
        search: 'kr',
        limit: 5,
        skip: 5,
        gridId: 9n,
      });
      expect(result).toEqual({
        items: [{ prefix_used: 'KR' }],
        meta: { page: 2, limit: 5, total: 1, total_pages: 1 },
      });
      expect(prisma.batchPrefix.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the row with every timestamp as ISO', async () => {
      prisma.batchPrefix.findUnique.mockResolvedValueOnce(
        makePrefix({ modifiedBy: USER_ID, modifiedOn: MODIFIED_ON }),
      );

      await expect(service.getById(PREFIX_ID)).resolves.toEqual({
        id: PREFIX_ID,
        prefixUsed: 'KR',
        syncDate: null,
        createdBy: USER_ID,
        createdOn: CREATED_ON.toISOString(),
        modifiedBy: USER_ID,
        modifiedOn: MODIFIED_ON.toISOString(),
      });
    });

    it('sends a missing created stamp as null', async () => {
      prisma.batchPrefix.findUnique.mockResolvedValueOnce(makePrefix({ createdOn: null }));

      await expect(service.getById(PREFIX_ID)).resolves.toMatchObject({ createdOn: null });
    });

    it('refuses an id with no row', async () => {
      await expect(bodyOf(service.getById(PREFIX_ID))).resolves.toEqual(notFoundBody(PREFIX_ID));
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      prisma.batchPrefix.findUnique.mockResolvedValue(makePrefix());
    });

    // The table has no soft-delete column: the row goes.
    it('removes the row and files a cancel audit row holding what was there', async () => {
      await expect(service.delete(PREFIX_ID)).resolves.toEqual({ id: PREFIX_ID, deleted: true });

      expect(prisma.batchPrefix.delete).toHaveBeenCalledWith({ where: { id: PREFIX_ID } });
      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        tableName: 'batch prefix',
        pk: PREFIX_ID,
        displayName: 'KR',
        modifiedRecord: null,
        userId: USER_ID,
        notes: 'Batch prefix deleted',
      });
      expect(entry.originalRecord).toMatchObject({ id: PREFIX_ID, prefixUsed: 'KR' });
      expect(client).toBe(prisma);
    });

    it('names a row with no prefix by its id in the audit', async () => {
      prisma.batchPrefix.findUnique.mockResolvedValue(makePrefix({ prefixUsed: null }));

      await service.delete(PREFIX_ID);

      expect(auditLogService.logEntityChange.mock.calls[0][0].displayName).toBe(PREFIX_ID);
    });

    it('refuses an id with no row and deletes nothing', async () => {
      prisma.batchPrefix.findUnique.mockResolvedValue(null);

      await expect(bodyOf(service.delete(PREFIX_ID))).resolves.toEqual(notFoundBody(PREFIX_ID));
      expect(prisma.batchPrefix.delete).not.toHaveBeenCalled();
    });

    // Someone else deleted it between the read and the delete.
    it('answers a P2025 from the delete as not found', async () => {
      prisma.batchPrefix.delete.mockRejectedValueOnce(
        Object.assign(new Error('Record to delete does not exist'), { code: 'P2025' }),
      );

      const promise = service.delete(PREFIX_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual(notFoundBody(PREFIX_ID));
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('lets any other failure through unchanged', async () => {
      const failure = Object.assign(new Error('FK violated'), { code: 'P2003' });
      prisma.batchPrefix.delete.mockRejectedValueOnce(failure);

      await expect(service.delete(PREFIX_ID)).rejects.toBe(failure);
    });
  });
});
