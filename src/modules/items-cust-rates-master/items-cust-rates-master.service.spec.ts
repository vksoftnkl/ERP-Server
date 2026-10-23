import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { CustItemRate, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SaveItemCustRateDto } from './dto/save-item-cust-rate.dto';
import { ItemsCustRatesMasterService } from './items-cust-rates-master.service';
import { ItemCustRateErrorCode } from './types/item-cust-rate-error-codes';

const RATE_ID = '019c6f6c-be87-7a11-8905-36092c46c101';
const CUSTOMER_ID = '019c6f6c-be87-7a11-8905-36092c46c102';
const UNIT_RATE_ID = '019c6f6c-be87-7a11-8905-36092c46c103';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46c104';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46c1ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeRate = (overrides: Partial<CustItemRate> = {}): CustItemRate => ({
  csrId: RATE_ID,
  csrBranchId: null,
  csrCustomerId: CUSTOMER_ID,
  csrUnitRateId: UNIT_RATE_ID,
  csrRateType: 'FIXED',
  csrItemRate: new Prisma.Decimal('125.50'),
  csrDiscPerc: new Prisma.Decimal('2.50'),
  csrDiscQty: new Prisma.Decimal('0'),
  csrPriceLevel: null,
  csrValidFrom: null,
  csrValidTo: null,
  csrPriority: 0,
  csrIsActive: true,
  csrIsDeleted: false,
  csrCreatedOn: CREATED_ON,
  csrCreatedBy: USER_ID,
  csrModifiedOn: MODIFIED_ON,
  csrModifiedBy: USER_ID,
  csrUploadedAt: null,
  csrUploadedBy: null,
  csrRemarks: null,
  csrSyncDate: null,
  ...overrides,
});

const createDto = (overrides: Partial<SaveItemCustRateDto> = {}): SaveItemCustRateDto => ({
  csr_customer_id: CUSTOMER_ID,
  csr_unit_rate_id: UNIT_RATE_ID,
  ...overrides,
});

type RateCreateArgs = { data: Prisma.CustItemRateUncheckedCreateInput };
type RateUpdateArgs = { where: { csrId: string }; data: Prisma.CustItemRateUncheckedUpdateInput };
type RateFindArgs = { where: Record<string, unknown> };
type RateUpdateManyArgs = { where: unknown; data: Record<string, unknown> };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  custItemRate: {
    findFirst: jest.Mock<Promise<CustItemRate | null>, [RateFindArgs]>;
    create: jest.Mock<Promise<CustItemRate>, [RateCreateArgs]>;
    update: jest.Mock<Promise<CustItemRate>, [RateUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [RateUpdateManyArgs]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
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

const VALID_TO_BEFORE_FROM_BODY = {
  success: false,
  message: 'Validation failed',
  errors: [
    {
      field: 'csr_valid_to',
      code: ItemCustRateErrorCode.VALID_TO_BEFORE_FROM,
      message: 'csr_valid_to must be greater than or equal to csr_valid_from',
    },
  ],
};

describe('ItemsCustRatesMasterService', () => {
  let service: ItemsCustRatesMasterService;
  let prisma: PrismaMock;
  let grid: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      custItemRate: {
        findFirst: jest.fn<Promise<CustItemRate | null>, [RateFindArgs]>(() =>
          Promise.resolve(null),
        ),
        create: jest.fn(({ data }: RateCreateArgs) =>
          Promise.resolve(makeRate({ ...(data as unknown as Partial<CustItemRate>) })),
        ),
        update: jest.fn(({ where, data }: RateUpdateArgs) =>
          Promise.resolve(
            makeRate({ ...(data as unknown as Partial<CustItemRate>), csrId: where.csrId }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [RateUpdateManyArgs]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    grid = {
      loadCandidates: jest
        .fn()
        .mockResolvedValue([{ gridId: 4n, gridSql: 'SELECT * FROM cust_item_rates' }]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({
        isValid: true,
        normalizedSql: 'SELECT * FROM cust_item_rates',
      })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [{ csr_id: RATE_ID }], total: 41 }),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new ItemsCustRatesMasterService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      grid as unknown as ConfiguredGridSqlService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no csr_id)', () => {
    it('writes the customer and unit rate, the optional fields sent, and stamps the creator', async () => {
      await service.save(
        createDto({
          csr_branch_id: BRANCH_ID,
          csr_rate_type: 'FIXED',
          csr_item_rate: 125.5,
          csr_disc_perc: 2.5,
          csr_disc_qty: 0,
          csr_price_level: 'B',
          csr_valid_from: '2026-10-01',
          csr_valid_to: '2026-12-31',
          csr_priority: 2,
          csr_is_active: true,
          csr_uploaded_at: '2026-10-01T10:00:00Z',
          csr_uploaded_by: 'importer',
          csr_remarks: 'Diwali rate',
        }),
      );

      expect(prisma.custItemRate.create.mock.calls[0][0].data).toEqual({
        csrCustomerId: CUSTOMER_ID,
        csrUnitRateId: UNIT_RATE_ID,
        csrCreatedOn: expect.any(Date) as Date,
        csrCreatedBy: USER_ID,
        csrBranchId: BRANCH_ID,
        csrRateType: 'FIXED',
        csrItemRate: 125.5,
        csrDiscPerc: 2.5,
        csrDiscQty: 0,
        csrPriceLevel: 'B',
        csrValidFrom: new Date('2026-10-01'),
        csrValidTo: new Date('2026-12-31'),
        csrPriority: 2,
        csrIsActive: true,
        csrUploadedAt: new Date('2026-10-01T10:00:00Z'),
        csrUploadedBy: 'importer',
        csrRemarks: 'Diwali rate',
      });
    });

    it('leaves every optional field out when the body does not carry it', async () => {
      await service.save(createDto());

      expect(Object.keys(prisma.custItemRate.create.mock.calls[0][0].data).sort()).toEqual([
        'csrCreatedBy',
        'csrCreatedOn',
        'csrCustomerId',
        'csrUnitRateId',
      ]);
    });

    it('returns money as numbers and dates as ISO', async () => {
      prisma.custItemRate.create.mockResolvedValueOnce(
        makeRate({ csrValidFrom: new Date('2026-10-01T00:00:00.000Z') }),
      );

      const payload = await service.save(createDto());

      expect(payload).toMatchObject({
        csr_id: RATE_ID,
        csr_item_rate: 125.5,
        csr_disc_perc: 2.5,
        csr_disc_qty: 0,
        csr_valid_from: '2026-10-01T00:00:00.000Z',
        csr_valid_to: null,
        csr_created_on: CREATED_ON.toISOString(),
        csr_modified_on: MODIFIED_ON.toISOString(),
        csr_uploaded_at: null,
      });
    });

    it.each([
      [
        'the body actor over the request user',
        { csr_created_by: ' importer ' },
        USER_ID,
        'importer',
      ],
      ['the request user when the body names none', {}, USER_ID, USER_ID],
      ['the default actor when there is neither', {}, undefined, DEFAULT_ACTOR],
    ])('stamps %s', async (_label, extra, contextUser, expected) => {
      userId = contextUser;

      await service.save(createDto(extra));

      expect(prisma.custItemRate.create.mock.calls[0][0].data.csrCreatedBy).toBe(expected);
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe(expected);
    });

    it('files a New audit row named customer:unit-rate inside the same transaction', async () => {
      const payload = await service.save(createDto());

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'cust item rates',
        screenName: 'Item Customer Rate Master',
        screenType: 'master',
        pk: RATE_ID,
        displayName: `${CUSTOMER_ID}:${UNIT_RATE_ID}`,
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Item customer rate created',
      });
      expect(client).toBe(prisma);
    });

    it('refuses a valid-to before the valid-from before opening a transaction', async () => {
      const promise = service.save(
        createDto({ csr_valid_from: '2026-12-31', csr_valid_to: '2026-10-01' }),
      );

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual(VALID_TO_BEFORE_FROM_BODY);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('accepts a one-day window', async () => {
      await service.save(createDto({ csr_valid_from: '2026-10-01', csr_valid_to: '2026-10-01' }));

      expect(prisma.custItemRate.create).toHaveBeenCalledTimes(1);
    });

    it.each(['csr_valid_from', 'csr_valid_to', 'csr_uploaded_at'] as const)(
      'refuses a %s that is not a date',
      async (field) => {
        const promise = service.save(createDto({ [field]: 'someday' }));

        await expect(bodyOf(promise)).resolves.toEqual({
          success: false,
          message: 'Validation failed',
          errors: [
            {
              field,
              code: ItemCustRateErrorCode.DATE_INVALID,
              message: `${field} must be a valid date`,
            },
          ],
        });
        expect(prisma.custItemRate.create).not.toHaveBeenCalled();
      },
    );

    it('answers a unique violation as ITEM_CUST_RATE_DUPLICATE', async () => {
      prisma.custItemRate.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const promise = service.save(createDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Item customer rate already exists',
        errors: [
          {
            field: 'csr_id',
            code: ItemCustRateErrorCode.DUPLICATE,
            message: 'Duplicate item customer rate is not allowed',
          },
        ],
      });
    });

    it('answers a foreign-key violation as ITEM_CUST_RATE_REFERENCE_INVALID', async () => {
      prisma.custItemRate.create.mockRejectedValueOnce(
        Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
      );

      const promise = service.save(createDto());

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Invalid relation reference',
        errors: [
          {
            field: 'csr_customer_id',
            code: ItemCustRateErrorCode.REFERENCE_INVALID,
            message: 'Referenced relation does not exist',
          },
        ],
      });
    });

    it('lets any other failure through unchanged', async () => {
      const failure = new Error('connection reset');
      prisma.custItemRate.create.mockRejectedValueOnce(failure);

      await expect(service.save(createDto())).rejects.toBe(failure);
    });
  });

  describe('save — update (csr_id sent)', () => {
    beforeEach(() => {
      prisma.custItemRate.findFirst.mockResolvedValue(
        makeRate({
          csrValidFrom: new Date('2026-10-01T00:00:00.000Z'),
          csrValidTo: new Date('2026-12-31T00:00:00.000Z'),
        }),
      );
    });

    it('updates the live row and stamps the modifier', async () => {
      const payload = await service.save(createDto({ csr_id: RATE_ID, csr_item_rate: 130 }));

      expect(prisma.custItemRate.findFirst).toHaveBeenCalledWith({
        where: { csrId: RATE_ID, csrIsDeleted: false },
      });
      const { where, data } = prisma.custItemRate.update.mock.calls[0][0];
      expect(where).toEqual({ csrId: RATE_ID });
      expect(data).toEqual({
        csrCustomerId: CUSTOMER_ID,
        csrUnitRateId: UNIT_RATE_ID,
        csrItemRate: 130,
        csrModifiedOn: expect.any(Date) as Date,
        csrModifiedBy: USER_ID,
      });
      expect(payload).toMatchObject({ csr_id: RATE_ID, csr_item_rate: 130 });
      expect(prisma.custItemRate.create).not.toHaveBeenCalled();
    });

    it('clears a date sent as null', async () => {
      await service.save(createDto({ csr_id: RATE_ID, csr_valid_to: null }));

      expect(prisma.custItemRate.update.mock.calls[0][0].data.csrValidTo).toBeNull();
    });

    // The stored valid-from still bounds a valid-to sent on its own.
    it('checks a new valid-to against the stored valid-from', async () => {
      const promise = service.save(createDto({ csr_id: RATE_ID, csr_valid_to: '2026-09-30' }));

      await expect(bodyOf(promise)).resolves.toEqual(VALID_TO_BEFORE_FROM_BODY);
      expect(prisma.custItemRate.update).not.toHaveBeenCalled();
    });

    it('checks a new valid-from against the stored valid-to', async () => {
      await expect(
        bodyOf(service.save(createDto({ csr_id: RATE_ID, csr_valid_from: '2027-01-01' }))),
      ).resolves.toEqual(VALID_TO_BEFORE_FROM_BODY);
    });

    it('lets an open-ended window through once one end is cleared', async () => {
      await service.save(
        createDto({ csr_id: RATE_ID, csr_valid_from: '2027-01-01', csr_valid_to: null }),
      );

      expect(prisma.custItemRate.update).toHaveBeenCalledTimes(1);
    });

    it('stamps the body modifier over the request user, in the audit too', async () => {
      await service.save(createDto({ csr_id: RATE_ID, csr_modified_by: 'importer' }));

      expect(prisma.custItemRate.update.mock.calls[0][0].data.csrModifiedBy).toBe('importer');
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe('importer');
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save(createDto({ csr_id: RATE_ID, csr_item_rate: 130 }));

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        tableName: 'cust item rates',
        pk: RATE_ID,
        displayName: `${CUSTOMER_ID}:${UNIT_RATE_ID}`,
        modifiedRecord: payload,
        notes: 'Item customer rate updated',
      });
      expect(entry.originalRecord).toMatchObject({ csr_item_rate: 125.5 });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no live row', async () => {
      prisma.custItemRate.findFirst.mockResolvedValue(null);

      const promise = service.save(createDto({ csr_id: RATE_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Item customer rate not found',
        errors: [
          {
            field: 'csr_id',
            message: `No active item customer rate found with id ${RATE_ID}`,
            code: ItemCustRateErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.custItemRate.update).not.toHaveBeenCalled();
    });

    it('answers a foreign-key violation on the write as a bad reference', async () => {
      prisma.custItemRate.update.mockRejectedValueOnce(
        Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
      );

      await expect(bodyOf(service.save(createDto({ csr_id: RATE_ID })))).resolves.toMatchObject({
        errors: [{ code: ItemCustRateErrorCode.REFERENCE_INVALID }],
      });
    });
  });

  describe('list', () => {
    it('reads the configured grid, paged and searched', async () => {
      const result = await service.list({ search: 'fixed', page: 2, limit: 20 });

      expect(grid.loadCandidates).toHaveBeenCalledWith({ tableName: 'cust item rates' });
      expect(grid.runPagedQuery).toHaveBeenCalledWith({
        baseSql: 'SELECT * FROM cust_item_rates',
        alias: 'item_cust_rate_grid',
        search: 'fixed',
        limit: 20,
        skip: 20,
        gridId: 4n,
      });
      expect(result).toEqual({
        items: [{ csr_id: RATE_ID }],
        meta: { page: 2, limit: 20, total: 41, total_pages: 3 },
      });
    });

    it('defaults to the first 20 rows', async () => {
      await service.list({});

      expect(grid.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, skip: 0 }),
      );
    });

    // There is no table fallback: the screen needs its grid.
    it('refuses when no grid is configured for the screen', async () => {
      grid.loadCandidates.mockResolvedValueOnce([]);

      const promise = service.list({});

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        success: false,
        message: 'No configured grid found for item customer rate list',
      });
    });
  });

  describe('getById', () => {
    it('reads a live row only', async () => {
      prisma.custItemRate.findFirst.mockResolvedValueOnce(makeRate());

      await expect(service.getById(RATE_ID)).resolves.toMatchObject({
        csr_id: RATE_ID,
        csr_customer_id: CUSTOMER_ID,
        csr_unit_rate_id: UNIT_RATE_ID,
        csr_is_deleted: false,
      });
      expect(prisma.custItemRate.findFirst).toHaveBeenCalledWith({
        where: { csrId: RATE_ID, csrIsDeleted: false },
      });
    });

    it('refuses an id with no live row', async () => {
      await expect(bodyOf(service.getById(RATE_ID))).resolves.toMatchObject({
        errors: [{ field: 'csr_id', code: ItemCustRateErrorCode.NOT_FOUND }],
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.custItemRate.findFirst.mockResolvedValue(makeRate());
    });

    it('marks the live row deleted, stamps who did it and files a cancel audit row', async () => {
      await expect(service.softDelete(RATE_ID)).resolves.toEqual({
        csr_id: RATE_ID,
        deleted: true,
      });

      const [{ where, data }] = prisma.custItemRate.updateMany.mock.calls[0];
      expect(where).toEqual({ csrId: RATE_ID, csrIsDeleted: false });
      expect(data).toEqual({
        csrIsDeleted: true,
        csrModifiedOn: expect.any(Date) as Date,
        csrModifiedBy: USER_ID,
      });
      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: RATE_ID,
        userId: USER_ID,
        notes: 'Item customer rate soft deleted',
      });
      expect(entry.originalRecord).toMatchObject({ csr_is_deleted: false });
      expect(entry.modifiedRecord).toMatchObject({ csr_is_deleted: true });
      expect(client).toBe(prisma);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.softDelete(RATE_ID);

      expect(prisma.custItemRate.updateMany.mock.calls[0][0].data.csrModifiedBy).toBe(
        DEFAULT_ACTOR,
      );
    });

    it('refuses an id with no live row and writes nothing', async () => {
      prisma.custItemRate.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(RATE_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.custItemRate.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.custItemRate.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(RATE_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
