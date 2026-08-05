import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionHold } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TransactionHoldService } from './transaction-hold.service';
import { SaveTransactionHoldDto } from './dto/save-transaction-hold.dto';
import {
  TransactionHoldConversion,
  TransactionHoldDeviceType,
  TransactionHoldDocType,
  TransactionHoldLockScope,
  TransactionHoldPayload,
  TransactionHoldStatus,
} from './types/transaction-hold-api.types';

const TH_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const OTHER_TH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';
const COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const ACC_YEAR = 2026;
const HOLD_DATE = new Date('2026-08-04T10:00:00.000Z');
const CONVERTED_AT = new Date('2026-08-04T11:30:00.000Z');

const makeHold = (overrides: Partial<TransactionHold> = {}): TransactionHold =>
  ({
    thId: TH_ID,
    thCompanyId: COMPANY_ID,
    thBranchId: BRANCH_ID,
    thAccYear: ACC_YEAR,
    thHoldNo: 'HLD-001',
    thHoldDate: HOLD_DATE,
    thDocType: 'SALE_INVOICE',
    thCounterId: COUNTER_ID,
    thSessionId: null,
    thUserId: USER_ID,
    thDeviceId: 'TILL-01',
    thDeviceType: 'DESKTOP',
    thCustomerName: null,
    thItemCount: 0,
    thTotalQty: new Prisma.Decimal('0.000'),
    thTotalAmount: new Prisma.Decimal('0.00'),
    thStatus: 'HELD',
    thHoldReason: null,
    thRemarks: null,
    thExpiresAt: null,
    thLockedBy: null,
    thLockedAt: null,
    thResumedBy: null,
    thResumedAt: null,
    thResumeCount: 0,
    thConvertedDocType: null,
    thConvertedDocId: null,
    thConvertedNo: null,
    thConvertedAt: null,
    thConvertedBy: null,
    thIsStockReserved: false,
    thUiState: null,
    thIsDeleted: false,
    thCreatedBy: USER_ID,
    thCreatedAt: HOLD_DATE,
    thModifiedBy: null,
    thModifiedAt: null,
    ...overrides,
  }) as TransactionHold;

const createDto = (overrides: Partial<SaveTransactionHoldDto> = {}): SaveTransactionHoldDto =>
  ({
    thCompanyId: COMPANY_ID,
    thBranchId: BRANCH_ID,
    thAccYear: ACC_YEAR,
    thHoldNo: 'HLD-001',
    thDeviceId: 'TILL-01',
    thDeviceType: 'DESKTOP',
    ...overrides,
  }) as SaveTransactionHoldDto;

type HoldCreateArgs = { data: Prisma.TransactionHoldUncheckedCreateInput };
type HoldUpdateArgs = {
  where: { thId: string };
  data: Prisma.TransactionHoldUncheckedUpdateInput;
};

const DEVICE_A = 'TILL-01';
const DEVICE_B = 'TILL-02';
const SCOPE: TransactionHoldLockScope = { thCompanyId: COMPANY_ID, thBranchId: BRANCH_ID };
const CONVERSION: TransactionHoldConversion = {
  thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
  thConvertedDocId: BILL_ID,
  thConvertedNo: 'INV-101',
};

type LockWhere = Record<string, unknown>;
type LockData = Record<string, unknown>;
type LockPrismaMock = {
  transactionHold: {
    findFirst: jest.Mock<Promise<TransactionHold | null>, [{ where: LockWhere }]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [{ where: LockWhere; data: LockData }]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: LockPrismaMock) => Promise<unknown>]>;
};

/**
 * One transaction_hold row backed by an in-memory store, with `updateMany`
 * behaving the way the DB row does: the WHERE predicate is checked and the row
 * mutated in the SAME synchronous step, so a second caller that already read a
 * now-stale copy of the row still fails the predicate — which is exactly the
 * compare-and-swap the lock relies on. `findFirst` reads the current state, so
 * a snapshot taken before an update is stale by the time it is used, as it is
 * against a real database.
 */
const createLockHarness = (overrides: Partial<TransactionHold> = {}) => {
  let row: TransactionHold = makeHold(overrides);
  const matches = (where: LockWhere): boolean =>
    Object.entries(where).every(
      ([field, value]) => (row as unknown as Record<string, unknown>)[field] === value,
    );
  const apply = (data: LockData): void => {
    const next = { ...row } as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && 'increment' in value) {
        next[field] = (next[field] as number) + (value as { increment: number }).increment;
        continue;
      }
      next[field] = value;
    }
    row = next as unknown as TransactionHold;
  };
  const prisma: LockPrismaMock = {
    transactionHold: {
      findFirst: jest.fn(({ where }: { where: LockWhere }) =>
        Promise.resolve(matches(where) ? ({ ...row } as TransactionHold) : null),
      ),
      updateMany: jest.fn(({ where, data }: { where: LockWhere; data: LockData }) => {
        if (!matches(where)) {
          return Promise.resolve({ count: 0 });
        }
        apply(data);
        return Promise.resolve({ count: 1 });
      }),
    },
    $transaction: jest.fn((cb: (tx: LockPrismaMock) => Promise<unknown>) => cb(prisma)),
  };
  const audit = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
  const service = new TransactionHoldService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogService,
    { loadCandidates: jest.fn() } as unknown as ConfiguredGridSqlService,
    { getUserId: () => USER_ID } as unknown as RequestContextService,
  );
  return { service, prisma, audit, row: () => row };
};

type PrismaMock = {
  transactionHold: {
    findFirst: jest.Mock<Promise<TransactionHold | null>, unknown[]>;
    findMany: jest.Mock<Promise<TransactionHold[]>, unknown[]>;
    count: jest.Mock<Promise<number>, unknown[]>;
    create: jest.Mock<Promise<TransactionHold>, [HoldCreateArgs]>;
    update: jest.Mock<Promise<TransactionHold>, [HoldUpdateArgs]>;
  };
  company: { findFirst: jest.Mock<Promise<{ compId: string } | null>, unknown[]> };
  branchMaster: { findFirst: jest.Mock<Promise<{ brId: string } | null>, unknown[]> };
  userMaster: { findFirst: jest.Mock<Promise<{ usrId: string } | null>, unknown[]> };
  userLoginSession: { findFirst: jest.Mock<Promise<{ ulsId: string } | null>, unknown[]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

describe('TransactionHoldService', () => {
  let service: TransactionHoldService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };
  let configuredGridSqlService: { loadCandidates: jest.Mock };

  beforeEach(() => {
    prisma = {
      transactionHold: {
        // Default: the hold looked up by id / the hold-no clash probe finds nothing.
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([makeHold()])),
        count: jest.fn(() => Promise.resolve(1)),
        create: jest.fn(({ data }: HoldCreateArgs) =>
          Promise.resolve(makeHold(data as unknown as Partial<TransactionHold>)),
        ),
        update: jest.fn(({ where, data }: HoldUpdateArgs) =>
          Promise.resolve(
            makeHold({ ...(data as unknown as Partial<TransactionHold>), thId: where.thId }),
          ),
        ),
      },
      company: { findFirst: jest.fn(() => Promise.resolve({ compId: COMPANY_ID })) },
      branchMaster: { findFirst: jest.fn(() => Promise.resolve({ brId: BRANCH_ID })) },
      userMaster: { findFirst: jest.fn(() => Promise.resolve({ usrId: USER_ID })) },
      userLoginSession: { findFirst: jest.fn(() => Promise.resolve({ ulsId: SESSION_ID })) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    // No configured grid for transaction_hold, so list() falls through to Prisma.
    configuredGridSqlService = { loadCandidates: jest.fn(() => Promise.resolve([])) };
    service = new TransactionHoldService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('stores the scope, stamps the hold date and audits the write', async () => {
      const payload = await service.save(
        createDto({ thCounterId: COUNTER_ID, thUserId: USER_ID, thItemCount: 3 }),
      );

      const { data } = prisma.transactionHold.create.mock.calls[0][0];
      expect(data).toMatchObject({
        thCompanyId: COMPANY_ID,
        thBranchId: BRANCH_ID,
        thAccYear: ACC_YEAR,
        thHoldNo: 'HLD-001',
        thDeviceId: 'TILL-01',
        thDeviceType: 'DESKTOP',
        thCounterId: COUNTER_ID,
        thItemCount: 3,
        thCreatedBy: USER_ID,
      });
      // Not sent — filled in rather than left to the column default.
      expect(data.thHoldDate).toBeInstanceOf(Date);
      expect(payload.thStatus).toBe(TransactionHoldStatus.HELD);
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('requires the fields a new hold cannot be created without', async () => {
      await expect(service.save(createDto({ thHoldNo: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ thCompanyId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ thAccYear: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ thDeviceId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    it('rejects a missing company, branch, user or session', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.branchMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.userMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto({ thUserId: USER_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      prisma.userLoginSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto({ thSessionId: SESSION_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    it('rejects a hold number already live in the same company / branch / year', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold({ thId: OTHER_TH_ID }));

      await expect(service.save(createDto())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    // ux_th_hold_no keys on the document type too, so the probe has to resolve
    // an omitted thDocType to the column default rather than ignore the column.
    it('probes the hold number per document type, defaulting to SALE_INVOICE', async () => {
      await service.save(createDto());

      expect(prisma.transactionHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: {
          thIsDeleted: false,
          thCompanyId: COMPANY_ID,
          thBranchId: BRANCH_ID,
          thAccYear: ACC_YEAR,
          thDocType: TransactionHoldDocType.SALE_INVOICE,
          thHoldNo: 'HLD-001',
        },
      });

      prisma.transactionHold.findFirst.mockClear();
      await service.save(createDto({ thDocType: TransactionHoldDocType.SALE_ORDER }));

      expect(prisma.transactionHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: { thDocType: TransactionHoldDocType.SALE_ORDER },
      });
    });

    it('rejects an expiry that is not after the hold date', async () => {
      await expect(
        service.save(
          createDto({ thHoldDate: HOLD_DATE, thExpiresAt: new Date('2026-08-04T09:00:00.000Z') }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // ck_th_converted — CONVERTED needs both the document it became and when.
    it('rejects a conversion trace that names no document', async () => {
      await expect(
        service.save(createDto({ thStatus: TransactionHoldStatus.CONVERTED })),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.save(
          createDto({
            thStatus: TransactionHoldStatus.CONVERTED,
            thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
            thConvertedDocId: BILL_ID,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(service.save(createDto({ thConvertedDocId: BILL_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // ck_th_status / ck_th_doc_type / ck_th_device_type
    it('rejects a value outside the enum sets', async () => {
      await expect(
        service.save(createDto({ thStatus: 'PARKED' as TransactionHoldStatus })),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.save(createDto({ thDocType: 'QUOTATION' as TransactionHoldDocType })),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.save(createDto({ thDeviceType: 'POS' as TransactionHoldDeviceType })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    // ck_th_total_amount — gross, never negative, while th_total_qty stays signed.
    it('rejects a negative total amount but allows a negative quantity', async () => {
      await expect(service.save(createDto({ thTotalAmount: -1 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      await service.save(
        createDto({ thDocType: TransactionHoldDocType.SALE_RETURN, thTotalQty: -2 }),
      );
      expect(prisma.transactionHold.create.mock.calls[0][0].data.thTotalQty).toBe(-2);
    });

    it('clears th_ui_state to SQL NULL rather than a JSON null', async () => {
      await service.save(createDto({ thUiState: null }));

      expect(prisma.transactionHold.create.mock.calls[0][0].data.thUiState).toBe(Prisma.DbNull);
    });
  });

  describe('update', () => {
    it('writes only the fields the request carries', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.save({ thId: TH_ID, thRemarks: 'Customer stepped out' });

      const { where, data } = prisma.transactionHold.update.mock.calls[0][0];
      expect(where).toEqual({ thId: TH_ID });
      expect(data).toMatchObject({ thRemarks: 'Customer stepped out', thModifiedBy: USER_ID });
      expect(data.thHoldNo).toBeUndefined();
      expect(data.thStatus).toBeUndefined();
    });

    it('re-checks the hold number when only the document type moves', async () => {
      prisma.transactionHold.findFirst
        .mockResolvedValueOnce(makeHold())
        // A SALE_ORDER hold already carries HLD-001 in this scope.
        .mockResolvedValueOnce(makeHold({ thId: OTHER_TH_ID, thDocType: 'SALE_ORDER' }));

      await expect(
        service.save({ thId: TH_ID, thDocType: TransactionHoldDocType.SALE_ORDER }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transactionHold.update).not.toHaveBeenCalled();
    });

    it('skips the hold-number probe when neither half of the pair changes', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.save({ thId: TH_ID, thHoldNo: 'HLD-001', thRemarks: 'same number' });

      // Only the lookup of the stored hold — no uniqueness probe.
      expect(prisma.transactionHold.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.transactionHold.update).toHaveBeenCalledTimes(1);
    });

    it('refuses to re-scope a stored hold', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      await expect(
        service.save({ thId: TH_ID, thCompanyId: OTHER_COMPANY_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());
      await expect(service.save({ thId: TH_ID, thAccYear: 2027 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transactionHold.update).not.toHaveBeenCalled();
    });

    it('refuses to reopen a hold that was already converted', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(
        makeHold({
          thStatus: 'CONVERTED',
          thConvertedDocType: 'SALE_INVOICE',
          thConvertedDocId: BILL_ID,
        }),
      );

      await expect(
        service.save({ thId: TH_ID, thStatus: TransactionHoldStatus.HELD }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transactionHold.update).not.toHaveBeenCalled();
    });

    it('stamps the conversion trace when the hold becomes a document', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      const payload = await service.save({
        thId: TH_ID,
        thStatus: TransactionHoldStatus.CONVERTED,
        thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
        thConvertedDocId: BILL_ID,
        thConvertedNo: 'INV-101',
        thConvertedAt: CONVERTED_AT,
      });

      expect(payload.thStatus).toBe(TransactionHoldStatus.CONVERTED);
      expect(payload.thConvertedDocId).toBe(BILL_ID);
      expect(payload.thConvertedNo).toBe('INV-101');
      expect(payload.thConvertedAt).toBe(CONVERTED_AT.toISOString());
    });

    // The stored row supplies whatever the payload leaves out, so a hold already
    // carrying its trace can be flipped to CONVERTED on its own.
    it('accepts CONVERTED when the stored row already carries the trace', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(
        makeHold({
          thConvertedDocType: 'SALE_INVOICE',
          thConvertedDocId: BILL_ID,
          thConvertedAt: CONVERTED_AT,
        }),
      );

      const payload = await service.save({
        thId: TH_ID,
        thStatus: TransactionHoldStatus.CONVERTED,
      });

      expect(payload.thStatus).toBe(TransactionHoldStatus.CONVERTED);
    });

    it('404s on an unknown or already deleted hold', async () => {
      await expect(service.save({ thId: TH_ID, thRemarks: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('read and delete', () => {
    it('404s when getById finds nothing live', async () => {
      await expect(service.getById(TH_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('filters the list on the query and never returns deleted holds', async () => {
      await service.list({ thCounterId: COUNTER_ID, thStatus: TransactionHoldStatus.HELD });

      const { where } = prisma.transactionHold.findMany.mock.calls[0][0] as {
        where: Prisma.TransactionHoldWhereInput;
      };
      expect(where.thIsDeleted).toBe(false);
      expect(where.AND).toEqual([
        { thCounterId: COUNTER_ID },
        { thStatus: TransactionHoldStatus.HELD },
      ]);
      // A filtered request must not be answered from the configured grid.
      expect(configuredGridSqlService.loadCandidates).not.toHaveBeenCalled();
    });

    it('treats a hold with no expiry as still valid', async () => {
      await service.list({ expired: false });

      const { where } = prisma.transactionHold.findMany.mock.calls[0][0] as {
        where: Prisma.TransactionHoldWhereInput;
      };
      const expiryFilter = (where.AND as Prisma.TransactionHoldWhereInput[])[0];
      expect(expiryFilter.OR).toHaveLength(2);
      expect((expiryFilter.OR as Prisma.TransactionHoldWhereInput[])[0]).toEqual({
        thExpiresAt: null,
      });
    });

    it('soft deletes without rewriting the status', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold({ thStatus: 'CONVERTED' }));

      const result = await service.softDelete(TH_ID);

      const { data } = prisma.transactionHold.update.mock.calls[0][0];
      expect(data).toMatchObject({ thIsDeleted: true, thModifiedBy: USER_ID });
      expect(data.thStatus).toBeUndefined();
      expect(result).toEqual({ thId: TH_ID, deleted: true });
    });

    it('404s when deleting a hold that is not live', async () => {
      await expect(service.softDelete(TH_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    // The recall screen greys out rows another till is on, so the list has to
    // carry the lock state, not just the summary columns.
    it('carries the lock state on every list row', async () => {
      prisma.transactionHold.findMany.mockResolvedValueOnce([
        makeHold({ thStatus: 'LOCKED', thLockedBy: DEVICE_A, thLockedAt: HOLD_DATE }),
      ]);

      // The recall screen always scopes to its own company / branch, which is
      // what ix_th_list covers and what takes the query onto the Prisma path.
      const result = await service.list({ thCompanyId: COMPANY_ID, thBranchId: BRANCH_ID });

      const [row] = result.items as TransactionHoldPayload[];
      expect(row.thStatus).toBe(TransactionHoldStatus.LOCKED);
      expect(row.thLockedBy).toBe(DEVICE_A);
      // …and the till / device the row is in use on, for "In use — <device>".
      expect(row.thCounterId).toBe(COUNTER_ID);
      expect(row.thDeviceId).toBe('TILL-01');
      // Nothing is narrowed away by a select clause.
      expect(prisma.transactionHold.findMany.mock.calls[0][0]).not.toHaveProperty('select');
    });
  });

  // ---------------------------------------------------------------------------
  // Device edit lock: HELD --resume--> LOCKED --convert--> CONVERTED
  //                                      └----release----> HELD
  // ---------------------------------------------------------------------------
  describe('device lock', () => {
    it('gives the lock to exactly one of two devices racing the same hold', async () => {
      const lock = createLockHarness();

      // Both calls read the row (still HELD for both — the read gates nothing)
      // before either writes; only the conditional update decides.
      const results = await Promise.allSettled([
        lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE),
        lock.service.resumeHold(TH_ID, DEVICE_B, SCOPE),
      ]);

      const won = results.filter((result) => result.status === 'fulfilled');
      const lost = results.filter((result) => result.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      const refusal = lost[0].reason as ConflictException;
      expect(refusal).toBeInstanceOf(ConflictException);
      // 409 names the device that actually holds it, so the till can say so.
      expect(refusal.getResponse()).toMatchObject({
        message: `Hold is LOCKED by device ${lock.row().thLockedBy ?? ''}`,
      });

      const winner = won[0].value;
      expect(lock.row().thStatus).toBe(TransactionHoldStatus.LOCKED);
      expect(lock.row().thLockedBy).toBe(winner.thLockedBy);
      // One transition, so one increment — the loser wrote nothing at all.
      expect(lock.row().thResumeCount).toBe(1);
    });

    it('hands the screen back on resume, including thUiState', async () => {
      const uiState = { cart: [{ item: 'PEN', qty: 2 }] };
      const lock = createLockHarness({ thUiState: uiState as Prisma.JsonValue });

      const resumed = await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);

      expect(resumed.thStatus).toBe(TransactionHoldStatus.LOCKED);
      expect(resumed.thLockedBy).toBe(DEVICE_A);
      expect(resumed.thResumedBy).toBe(DEVICE_A);
      expect(resumed.thLockedAt).not.toBeNull();
      expect(resumed.thUiState).toEqual(uiState);
      expect(lock.audit.logEntityChange).toHaveBeenCalledTimes(1);
    });

    // A dropped response or a double tap on the recall list must not read as a
    // second recall.
    it('is idempotent for the device that already holds the lock', async () => {
      const lock = createLockHarness();

      const first = await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);
      const again = await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);

      expect(first.thResumeCount).toBe(1);
      expect(again.thResumeCount).toBe(1);
      expect(again.thStatus).toBe(TransactionHoldStatus.LOCKED);
      expect(lock.row().thResumeCount).toBe(1);
      // The re-entrant path writes nothing, so no second audit entry.
      expect(lock.audit.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('releases back to HELD and clears the lock columns', async () => {
      const lock = createLockHarness();
      await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);

      const released = await lock.service.releaseHold(TH_ID, DEVICE_A, SCOPE);

      expect(released.thStatus).toBe(TransactionHoldStatus.HELD);
      expect(released.thLockedBy).toBeNull();
      expect(released.thLockedAt).toBeNull();
      // Who pulled it and how often is history, not lock state.
      expect(released.thResumedBy).toBe(DEVICE_A);
      expect(released.thResumeCount).toBe(1);
      // …and the freed hold can be taken by the other till.
      const taken = await lock.service.resumeHold(TH_ID, DEVICE_B, SCOPE);
      expect(taken.thLockedBy).toBe(DEVICE_B);
      expect(taken.thResumeCount).toBe(2);
    });

    it('refuses to let another device release or convert the lock', async () => {
      const lock = createLockHarness();
      await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);
      const before = lock.row();

      await expect(lock.service.releaseHold(TH_ID, DEVICE_B, SCOPE)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        lock.service.convertHold(TH_ID, DEVICE_B, SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Nothing moved: still LOCKED by the device that took it.
      expect(lock.row()).toEqual(before);
    });

    it('refuses to convert a hold no device holds', async () => {
      const lock = createLockHarness();

      await expect(
        lock.service.convertHold(TH_ID, DEVICE_A, SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(lock.row().thStatus).toBe(TransactionHoldStatus.HELD);
    });

    // Releasing a hold that is already free is what the caller asked for.
    it('treats releasing an already free hold as a no-op', async () => {
      const lock = createLockHarness();

      const released = await lock.service.releaseHold(TH_ID, DEVICE_A, SCOPE);

      expect(released.thStatus).toBe(TransactionHoldStatus.HELD);
      expect(lock.row().thModifiedAt).toBeNull();
    });

    it('stamps the conversion trace, drops the lock and closes the hold for good', async () => {
      const lock = createLockHarness();
      await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);

      const converted = await lock.service.convertHold(TH_ID, DEVICE_A, SCOPE, CONVERSION);

      expect(converted.thStatus).toBe(TransactionHoldStatus.CONVERTED);
      expect(converted.thConvertedDocType).toBe(TransactionHoldDocType.SALE_INVOICE);
      expect(converted.thConvertedDocId).toBe(BILL_ID);
      expect(converted.thConvertedNo).toBe('INV-101');
      expect(converted.thConvertedBy).toBe(USER_ID);
      expect(converted.thConvertedAt).not.toBeNull();
      expect(converted.thLockedBy).toBeNull();
      expect(converted.thLockedAt).toBeNull();

      // Terminal: neither the device that billed it nor any other can reopen it.
      await expect(lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(lock.service.resumeHold(TH_ID, DEVICE_B, SCOPE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(
        lock.service.convertHold(TH_ID, DEVICE_A, SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('never reaches a hold in another company or branch, or a deleted one', async () => {
      const lock = createLockHarness();

      await expect(
        lock.service.resumeHold(TH_ID, DEVICE_A, { ...SCOPE, thCompanyId: OTHER_COMPANY_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        lock.service.resumeHold(TH_ID, DEVICE_A, { ...SCOPE, thBranchId: OTHER_TH_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(lock.row().thStatus).toBe(TransactionHoldStatus.HELD);

      const deleted = createLockHarness({ thIsDeleted: true });
      await expect(deleted.service.resumeHold(TH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      // Every write is keyed on the full scope, not just the id.
      for (const [{ where }] of lock.prisma.transactionHold.updateMany.mock.calls) {
        expect(where).toMatchObject({
          thId: TH_ID,
          thCompanyId: expect.any(String) as unknown as string,
          thBranchId: expect.any(String) as unknown as string,
          thIsDeleted: false,
        });
      }
    });

    it('requires a usable device id', async () => {
      const lock = createLockHarness();

      await expect(lock.service.resumeHold(TH_ID, undefined, SCOPE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(lock.service.releaseHold(TH_ID, '   ', SCOPE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // th_locked_by is varchar(64) — a longer id would be truncated and then
      // never match itself on the ownership check.
      await expect(
        lock.service.convertHold(TH_ID, 'D'.repeat(65), SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(lock.prisma.transactionHold.updateMany).not.toHaveBeenCalled();
    });

    // Crash recovery, lock timeouts and the expiry job are deliberately out of
    // this module: a lock lasts until the device gives it back.
    it('never touches the expiry columns', async () => {
      const lock = createLockHarness({ thExpiresAt: new Date('2026-08-05T10:00:00.000Z') });

      await lock.service.resumeHold(TH_ID, DEVICE_A, SCOPE);
      await lock.service.releaseHold(TH_ID, DEVICE_A, SCOPE);

      for (const [{ data }] of lock.prisma.transactionHold.updateMany.mock.calls) {
        expect(data).not.toHaveProperty('thExpiresAt');
      }
      expect(lock.row().thExpiresAt).toEqual(new Date('2026-08-05T10:00:00.000Z'));
    });
  });
});
