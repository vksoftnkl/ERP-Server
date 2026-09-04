import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TxnHold } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnHoldService } from './txn-hold.service';
import { SaveTxnHoldDto } from './dto/save-txn-hold.dto';
import {
  TxnHoldConversion,
  TxnHoldDocType,
  TxnHoldKind,
  TxnHoldLockScope,
  TxnHoldPartyType,
  TxnHoldSrcModule,
  TxnHoldStatus,
} from './types/txn-hold-api.types';

const TXH_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const OTHER_TXH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const OTHER_USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';
const COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe0a';
const STAFF_ID = '019c6f6c-be87-7a11-8905-36092c46fe0b';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46fe0c';
const DEVICE_A = '019c6f6c-be87-7a11-8905-36092c46fe11';
const DEVICE_B = '019c6f6c-be87-7a11-8905-36092c46fe12';
const ACC_YEAR = '2026-2027';
const HOLD_ON = new Date('2026-08-04T10:00:00.000Z');
const PAYLOAD = { cart: [{ item: 'PEN', qty: 2 }] };

const makeHold = (overrides: Partial<TxnHold> = {}): TxnHold =>
  ({
    txhId: TXH_ID,
    txhCompanyId: COMPANY_ID,
    txhBranchId: BRANCH_ID,
    txhTenantId: null,
    txhAccYear: ACC_YEAR,
    txhKind: 'HOLD',
    txhSrcModule: 'POS',
    txhDocType: 'SALE_BILL',
    txhHoldNo: 'HLD-001',
    txhHoldSlno: 1,
    txhHoldOn: HOLD_ON,
    txhDeviceId: DEVICE_A,
    txhCounterId: COUNTER_ID,
    txhSessionId: null,
    txhHeldBy: USER_ID,
    txhPartyType: null,
    txhPartyId: null,
    txhPartyName: null,
    txhPartyMobile: null,
    txhStaffId: null,
    txhRefLabel: null,
    txhItemCount: 0,
    txhTotalQty: new Prisma.Decimal('0.000'),
    txhNetAmount: new Prisma.Decimal('0.00'),
    txhPayload: PAYLOAD,
    txhPayloadVersion: 1,
    txhRevision: 1,
    txhStatus: 'HELD',
    txhHoldReason: null,
    txhRemarks: null,
    txhExpiresOn: null,
    txhLockedBy: null,
    txhLockedDeviceId: null,
    txhLockedOn: null,
    txhLockExpiresOn: null,
    txhLockToken: null,
    txhResumedBy: null,
    txhResumedOn: null,
    txhResumeCount: 0,
    txhConvertedDocId: null,
    txhConvertedAccYear: null,
    txhConvertedRefno: null,
    txhConvertedOn: null,
    txhConvertedBy: null,
    txhIsStockReserved: false,
    txhPrintCount: 0,
    txhLastPrintedOn: null,
    txhIsDeleted: false,
    txhSyncDate: null,
    txhCreatedOn: HOLD_ON,
    txhCreatedBy: USER_ID,
    txhModifiedOn: null,
    txhModifiedBy: null,
    ...overrides,
  }) as TxnHold;

const createDto = (overrides: Partial<SaveTxnHoldDto> = {}): SaveTxnHoldDto =>
  ({
    txhCompanyId: COMPANY_ID,
    txhBranchId: BRANCH_ID,
    txhAccYear: ACC_YEAR,
    txhSrcModule: TxnHoldSrcModule.POS,
    txhDocType: TxnHoldDocType.SALE_BILL,
    txhHoldNo: 'HLD-001',
    txhHoldSlno: 1,
    txhDeviceId: DEVICE_A,
    txhHeldBy: USER_ID,
    txhPayload: PAYLOAD,
    ...overrides,
  }) as SaveTxnHoldDto;

type HoldCreateArgs = { data: Prisma.TxnHoldUncheckedCreateInput };
type HoldUpdateArgs = {
  where: { txhId_txhAccYear: { txhId: string; txhAccYear: string } };
  data: Prisma.TxnHoldUncheckedUpdateInput;
};

const SCOPE: TxnHoldLockScope = { txhCompanyId: COMPANY_ID, txhBranchId: BRANCH_ID };
const CONVERSION: TxnHoldConversion = {
  txhConvertedDocId: BILL_ID,
  txhConvertedAccYear: ACC_YEAR,
  txhConvertedRefno: 'INV-101',
};

type LockWhere = Record<string, unknown>;
type LockData = Record<string, unknown>;
type LockPrismaMock = {
  txnHold: {
    findFirst: jest.Mock<Promise<TxnHold | null>, [{ where: LockWhere }]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [{ where: LockWhere; data: LockData }]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: LockPrismaMock) => Promise<unknown>]>;
};

/**
 * One txn_hold row backed by an in-memory store, with `updateMany` behaving the
 * way the DB row does: the WHERE predicate is checked and the row mutated in the
 * SAME synchronous step, so a second caller that already read a now-stale copy
 * of the row still fails the predicate — which is exactly the compare-and-swap
 * the lease relies on. `findFirst` reads the current state, so a snapshot taken
 * before an update is stale by the time it is used, as it is against a real
 * database.
 */
const createLeaseHarness = (overrides: Partial<TxnHold> = {}) => {
  let row: TxnHold = makeHold(overrides);
  const fieldMatches = (field: string, value: unknown): boolean => {
    const stored = (row as unknown as Record<string, unknown>)[field];
    if (value !== null && typeof value === 'object') {
      const filter = value as Record<string, unknown>;
      // The only Prisma filters these paths use beyond plain equality.
      if ('in' in filter) return (filter.in as readonly unknown[]).includes(stored);
      if ('lt' in filter) {
        return stored instanceof Date && stored.getTime() < (filter.lt as Date).getTime();
      }
      if ('not' in filter) return stored !== filter.not;
    }
    return stored === value;
  };
  const matches = (where: LockWhere): boolean =>
    Object.entries(where).every(([field, value]) => {
      if (field === 'OR') {
        return (value as LockWhere[]).some((branch) => matches(branch));
      }
      return fieldMatches(field, value);
    });
  const apply = (data: LockData): void => {
    const next = { ...row } as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && 'increment' in value) {
        next[field] = (next[field] as number) + (value as { increment: number }).increment;
        continue;
      }
      next[field] = value;
    }
    row = next as unknown as TxnHold;
  };
  const prisma: LockPrismaMock = {
    txnHold: {
      findFirst: jest.fn(({ where }: { where: LockWhere }) =>
        Promise.resolve(matches(where) ? ({ ...row } as TxnHold) : null),
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
  const audit = {
    logEntityChange: jest.fn<Promise<void>, [{ notes?: string | null }]>(() =>
      Promise.resolve(undefined),
    ),
  };
  const service = new TxnHoldService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogService,
    { loadCandidates: jest.fn() } as unknown as ConfiguredGridSqlService,
    { getUserId: () => USER_ID } as unknown as RequestContextService,
  );
  return { service, prisma, audit, row: () => row };
};

type PrismaMock = {
  txnHold: {
    findFirst: jest.Mock<Promise<TxnHold | null>, unknown[]>;
    findMany: jest.Mock<Promise<TxnHold[]>, unknown[]>;
    count: jest.Mock<Promise<number>, unknown[]>;
    create: jest.Mock<Promise<TxnHold>, [HoldCreateArgs]>;
    update: jest.Mock<Promise<TxnHold>, [HoldUpdateArgs]>;
  };
  company: { findFirst: jest.Mock<Promise<{ compId: string } | null>, unknown[]> };
  branchMaster: { findFirst: jest.Mock<Promise<{ brId: string } | null>, unknown[]> };
  deviceMaster: {
    findFirst: jest.Mock<Promise<{ devId: string; devIsBlocked: boolean } | null>, unknown[]>;
  };
  userMaster: { findFirst: jest.Mock<Promise<{ usrId: string } | null>, unknown[]> };
  userLoginSession: { findFirst: jest.Mock<Promise<{ ulsId: string } | null>, unknown[]> };
  employeeMaster: { findFirst: jest.Mock<Promise<{ empId: string } | null>, unknown[]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

describe('TxnHoldService', () => {
  let service: TxnHoldService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };
  let configuredGridSqlService: { loadCandidates: jest.Mock };

  beforeEach(() => {
    prisma = {
      txnHold: {
        // Default: the hold looked up by id / the uniqueness probes find nothing.
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([makeHold()])),
        count: jest.fn(() => Promise.resolve(1)),
        create: jest.fn(({ data }: HoldCreateArgs) =>
          Promise.resolve(makeHold(data as unknown as Partial<TxnHold>)),
        ),
        update: jest.fn(({ where, data }: HoldUpdateArgs) =>
          Promise.resolve(
            makeHold({
              ...(data as unknown as Partial<TxnHold>),
              txhId: where.txhId_txhAccYear.txhId,
              txhAccYear: where.txhId_txhAccYear.txhAccYear,
            }),
          ),
        ),
      },
      company: { findFirst: jest.fn(() => Promise.resolve({ compId: COMPANY_ID })) },
      branchMaster: { findFirst: jest.fn(() => Promise.resolve({ brId: BRANCH_ID })) },
      deviceMaster: {
        findFirst: jest.fn(() => Promise.resolve({ devId: DEVICE_A, devIsBlocked: false })),
      },
      userMaster: { findFirst: jest.fn(() => Promise.resolve({ usrId: USER_ID })) },
      userLoginSession: { findFirst: jest.fn(() => Promise.resolve({ ulsId: SESSION_ID })) },
      employeeMaster: { findFirst: jest.fn(() => Promise.resolve({ empId: STAFF_ID })) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    // No configured grid for txn_hold, so list() falls through to Prisma.
    configuredGridSqlService = { loadCandidates: jest.fn(() => Promise.resolve([])) };
    service = new TxnHoldService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('stores the scope and the document identity, stamps the instant and audits it', async () => {
      const payload = await service.save(
        createDto({ txhCounterId: COUNTER_ID, txhItemCount: 3, txhRefLabel: 'table 7' }),
      );

      const { data } = prisma.txnHold.create.mock.calls[0][0];
      expect(data).toMatchObject({
        txhCompanyId: COMPANY_ID,
        txhBranchId: BRANCH_ID,
        txhAccYear: ACC_YEAR,
        txhSrcModule: TxnHoldSrcModule.POS,
        txhDocType: TxnHoldDocType.SALE_BILL,
        txhHoldNo: 'HLD-001',
        txhHoldSlno: 1,
        txhDeviceId: DEVICE_A,
        txhHeldBy: USER_ID,
        txhCounterId: COUNTER_ID,
        txhItemCount: 3,
        txhRefLabel: 'table 7',
        txhPayload: PAYLOAD,
      });
      expect(data.txhHoldOn).toBeInstanceOf(Date);
      expect(payload.txhAccYear).toBe(ACC_YEAR);
      expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'New', pk: payload.txhId }),
        expect.anything(),
      );
    });

    it('requires the fields a new hold cannot be created without', async () => {
      const required: Array<keyof SaveTxnHoldDto> = [
        'txhCompanyId',
        'txhBranchId',
        'txhAccYear',
        'txhSrcModule',
        'txhDocType',
        'txhDeviceId',
        'txhHeldBy',
        'txhPayload',
      ];
      for (const field of required) {
        const dto = createDto();
        delete dto[field];
        await expect(service.save(dto)).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    // Only a HOLD prints a token slip, so the number and the device serial are
    // optional: an AUTOSAVE snapshot or a TEMPLATE parks unnumbered rather than
    // burning a slot in the device's series on a throwaway value.
    it('parks an unnumbered hold and probes neither number index', async () => {
      const dto = createDto();
      delete dto.txhHoldNo;
      delete dto.txhHoldSlno;

      await service.save(dto);

      const { data } = prisma.txnHold.create.mock.calls[0][0];
      expect(data.txhHoldNo).toBeNull();
      expect(data.txhHoldSlno).toBeNull();
      // Only the existence probes (company / branch / device / operator) ran —
      // NULLs are distinct to a unique index, so there is nothing to collide
      // with and no uniqueness query to make.
      const probedANumber = prisma.txnHold.findFirst.mock.calls
        .map((call) => (call[0] as { where: Record<string, unknown> }).where)
        .some((where) => 'txhHoldNo' in where || 'txhHoldSlno' in where);
      expect(probedANumber).toBe(false);
    });

    // The partition key: a year that is not YYYY-YYYY has no partition to land
    // in, and Postgres would answer "no partition of relation txn_hold found for
    // row" — which names neither the field nor the fix.
    it('refuses an accounting year that is not YYYY-YYYY', async () => {
      await expect(service.save(createDto({ txhAccYear: '2026' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    it('rejects a missing company, branch, device, session or employee', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.branchMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.deviceMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.userLoginSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto({ txhSessionId: SESSION_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      prisma.employeeMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto({ txhStaffId: STAFF_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    // fk_txh_device is RESTRICT, so the row would be accepted — but a till that
    // has been blocked has no business parking new work.
    it('refuses a blocked till', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValueOnce({
        devId: DEVICE_A,
        devIsBlocked: true,
      });

      await expect(service.save(createDto())).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    // ux_txh_hold_no and ux_txh_device_slno are partial, so Prisma cannot see
    // them; both rules are restated to answer a 409 naming the field.
    it('rejects a hold number or a device serial already live this year', async () => {
      prisma.txnHold.findFirst.mockResolvedValueOnce(makeHold({ txhId: OTHER_TXH_ID }));
      await expect(service.save(createDto())).rejects.toBeInstanceOf(ConflictException);

      prisma.txnHold.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeHold({ txhId: OTHER_TXH_ID }));
      await expect(service.save(createDto())).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    it('probes each unique index on the key it is actually built from', async () => {
      await service.save(createDto());

      expect(prisma.txnHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: {
          txhIsDeleted: false,
          txhCompanyId: COMPANY_ID,
          txhBranchId: BRANCH_ID,
          txhAccYear: ACC_YEAR,
          txhDocType: TxnHoldDocType.SALE_BILL,
          txhHoldNo: 'HLD-001',
        },
      });
      expect(prisma.txnHold.findFirst.mock.calls[1][0]).toMatchObject({
        where: {
          txhIsDeleted: false,
          txhAccYear: ACC_YEAR,
          txhDeviceId: DEVICE_A,
          txhDocType: TxnHoldDocType.SALE_BILL,
          txhHoldSlno: 1,
        },
      });
    });

    it('rejects an expiry that is not after the hold instant', async () => {
      await expect(
        service.save(
          createDto({
            txhHoldOn: HOLD_ON,
            txhExpiresOn: new Date(HOLD_ON.getTime() - 1000),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    it('rejects a value outside the enum sets', async () => {
      for (const dto of [
        createDto({ txhKind: 'PARKED' as TxnHoldKind }),
        createDto({ txhSrcModule: 'HR' as TxnHoldSrcModule }),
        createDto({ txhDocType: 'JOB_CARD' as TxnHoldDocType }),
        createDto({ txhStatus: 'PENDING' as TxnHoldStatus }),
        createDto({ txhPartyType: 'VENDOR' as TxnHoldPartyType, txhPartyId: PARTY_ID }),
      ]) {
        await expect(service.save(dto)).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    // ck_txh_party_typed — the reference is polymorphic, so an id with no type
    // names no master at all. A type with no id is fine: a walk-in customer.
    it('refuses a party id with no party type, and allows a type with no id', async () => {
      await expect(service.save(createDto({ txhPartyId: PARTY_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      await expect(
        service.save(
          createDto({ txhPartyType: TxnHoldPartyType.CUSTOMER, txhPartyName: 'Walk-in' }),
        ),
      ).resolves.toMatchObject({ txhPartyType: TxnHoldPartyType.CUSTOMER });
    });

    // ck_txh_printed — the count and the instant answer the same question.
    it('refuses a print count that contradicts the printed instant', async () => {
      await expect(service.save(createDto({ txhPrintCount: 2 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.save(createDto({ txhLastPrintedOn: new Date() })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.save(createDto({ txhPrintCount: 1, txhLastPrintedOn: new Date() })),
      ).resolves.toMatchObject({ txhPrintCount: 1 });
    });

    // The lease and the conversion trail are whole blocks the DB checks together
    // (ck_txh_locked_status / ck_txh_converted_status), so the CRUD route may
    // not move a status that needs one.
    it('refuses to put a hold into LOCKED or CONVERTED through the save payload', async () => {
      await expect(
        service.save(createDto({ txhStatus: TxnHoldStatus.LOCKED })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.save(createDto({ txhStatus: TxnHoldStatus.CONVERTED })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    it('rejects a payload that is not a JSON object', async () => {
      for (const bad of [null, [1, 2, 3], 'cart']) {
        await expect(
          service.save(createDto({ txhPayload: bad as unknown as Record<string, unknown> })),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });
  });

  // ux_txh_autosave allows ONE live snapshot per screen, and the screen posts a
  // fresh one every few seconds — so a repeat post has to overwrite the row in
  // place rather than collide with it.
  describe('autosave', () => {
    const autosaveDto = (overrides: Partial<SaveTxnHoldDto> = {}) =>
      createDto({ txhKind: TxnHoldKind.AUTOSAVE, ...overrides });

    it('creates the first snapshot for a screen like any other hold', async () => {
      await service.save(autosaveDto());

      expect(prisma.txnHold.create).toHaveBeenCalledTimes(1);
      expect(prisma.txnHold.create.mock.calls[0][0].data).toMatchObject({
        txhKind: TxnHoldKind.AUTOSAVE,
      });
    });

    it('overwrites the live snapshot in place and bumps the revision', async () => {
      const live = makeHold({
        txhKind: 'AUTOSAVE',
        txhRevision: 4,
        txhHoldNo: 'AUT-001',
        txhHoldSlno: 9,
      });
      prisma.txnHold.findFirst.mockResolvedValueOnce(live);

      await service.save(autosaveDto({ txhHoldNo: 'AUT-002', txhItemCount: 7 }));

      expect(prisma.txnHold.create).not.toHaveBeenCalled();
      const { where, data } = prisma.txnHold.update.mock.calls[0][0];
      // The composite primary key: id alone does not name a row.
      expect(where).toEqual({ txhId_txhAccYear: { txhId: TXH_ID, txhAccYear: ACC_YEAR } });
      expect(data.txhRevision).toEqual({ increment: 1 });
      expect(data.txhItemCount).toBe(7);
      // The identity it was created with is not rewritten — the screen is
      // re-posting the same parked work, not a new one.
      expect(data).not.toHaveProperty('txhHoldNo');
      expect(data).not.toHaveProperty('txhHoldSlno');
      // And it stays the row the next post will find.
      expect(data).not.toHaveProperty('txhKind');
      expect(data).not.toHaveProperty('txhStatus');
    });

    it('looks the snapshot up on exactly the key ux_txh_autosave is built from', async () => {
      await service.save(autosaveDto());

      expect(prisma.txnHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: {
          txhKind: TxnHoldKind.AUTOSAVE,
          txhStatus: TxnHoldStatus.HELD,
          txhIsDeleted: false,
          txhAccYear: ACC_YEAR,
          txhDeviceId: DEVICE_A,
          txhHeldBy: USER_ID,
          txhDocType: TxnHoldDocType.SALE_BILL,
        },
      });
    });
  });

  describe('update', () => {
    it('writes only the fields the request carries, and counts the revision', async () => {
      prisma.txnHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.save({ txhId: TXH_ID, txhRemarks: 'back in a minute' } as SaveTxnHoldDto);

      const { where, data } = prisma.txnHold.update.mock.calls[0][0];
      expect(where).toEqual({ txhId_txhAccYear: { txhId: TXH_ID, txhAccYear: ACC_YEAR } });
      expect(data).toMatchObject({ txhRemarks: 'back in a minute' });
      expect(data.txhRevision).toEqual({ increment: 1 });
      expect(data).not.toHaveProperty('txhHoldNo');
    });

    it('re-checks the hold number when only the document type moves', async () => {
      prisma.txnHold.findFirst
        .mockResolvedValueOnce(makeHold())
        .mockResolvedValueOnce(makeHold({ txhId: OTHER_TXH_ID }));

      await expect(
        service.save({
          txhId: TXH_ID,
          txhDocType: TxnHoldDocType.SALES_ORDER,
        } as SaveTxnHoldDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.txnHold.update).not.toHaveBeenCalled();
    });

    it('skips both uniqueness probes when nothing they key on changes', async () => {
      prisma.txnHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.save({ txhId: TXH_ID, txhRemarks: 'x' } as SaveTxnHoldDto);

      expect(prisma.txnHold.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.txnHold.update).toHaveBeenCalledTimes(1);
    });

    // The year is half the primary key AND the partition key: re-scoping a hold
    // would mean moving the row to another partition under a new identity.
    it('refuses to re-scope a stored hold', async () => {
      prisma.txnHold.findFirst.mockResolvedValue(makeHold());

      for (const change of [
        { txhCompanyId: OTHER_COMPANY_ID },
        { txhBranchId: OTHER_TXH_ID },
        { txhAccYear: '2027-2028' },
      ]) {
        await expect(
          service.save({ txhId: TXH_ID, ...change } as SaveTxnHoldDto),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(prisma.txnHold.update).not.toHaveBeenCalled();
    });

    it('refuses to reopen a hold that is already closed', async () => {
      for (const closed of ['CONVERTED', 'EXPIRED', 'CANCELLED', 'ABANDONED']) {
        prisma.txnHold.findFirst.mockResolvedValueOnce(makeHold({ txhStatus: closed }));
        await expect(
          service.save({ txhId: TXH_ID, txhStatus: TxnHoldStatus.HELD } as SaveTxnHoldDto),
        ).rejects.toBeInstanceOf(ConflictException);
      }
      expect(prisma.txnHold.update).not.toHaveBeenCalled();
    });

    it('404s on an unknown or already deleted hold', async () => {
      await expect(
        service.save({ txhId: TXH_ID, txhRemarks: 'x' } as SaveTxnHoldDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('read and delete', () => {
    it('404s when getById finds nothing live', async () => {
      await expect(service.getById(TXH_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('prunes to one partition when the year is known', async () => {
      prisma.txnHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.getById(TXH_ID, ACC_YEAR);

      expect(prisma.txnHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: { txhId: TXH_ID, txhIsDeleted: false, txhAccYear: ACC_YEAR },
      });
    });

    it('filters the list on the query and never returns deleted holds', async () => {
      await service.list({
        txhCompanyId: COMPANY_ID,
        txhAccYear: ACC_YEAR,
        txhKind: TxnHoldKind.HOLD,
        txhStatus: TxnHoldStatus.HELD,
        txhPartyMobile: '9876543210',
      });

      const { where, orderBy } = prisma.txnHold.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
        orderBy: unknown;
      };
      expect(where.txhIsDeleted).toBe(false);
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { txhCompanyId: COMPANY_ID },
          { txhAccYear: ACC_YEAR },
          { txhKind: TxnHoldKind.HOLD },
          { txhStatus: TxnHoldStatus.HELD },
          { txhPartyMobile: '9876543210' },
        ]),
      );
      expect(orderBy).toEqual([{ txhHoldOn: 'desc' }, { txhId: 'desc' }]);
    });

    it('treats a hold with no expiry as still valid', async () => {
      await service.list({ expired: false });

      const { where } = prisma.txnHold.findMany.mock.calls[0][0] as {
        where: { AND: Array<Record<string, unknown>> };
      };
      expect(where.AND[0]).toEqual({
        OR: [{ txhExpiresOn: null }, { txhExpiresOn: { gte: expect.any(Date) as Date } }],
      });
    });

    it('soft deletes on the composite key without rewriting the status', async () => {
      prisma.txnHold.findFirst.mockResolvedValueOnce(makeHold({ txhStatus: 'CONVERTED' }));

      await expect(service.softDelete(TXH_ID)).resolves.toEqual({ txhId: TXH_ID, deleted: true });

      const { where, data } = prisma.txnHold.update.mock.calls[0][0];
      expect(where).toEqual({ txhId_txhAccYear: { txhId: TXH_ID, txhAccYear: ACC_YEAR } });
      expect(data).toMatchObject({ txhIsDeleted: true });
      expect(data).not.toHaveProperty('txhStatus');
    });

    it('404s when deleting a hold that is not live', async () => {
      await expect(service.softDelete(TXH_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('lease', () => {
    it('gives the lease to exactly one of two devices racing the same hold', async () => {
      const { service: leaseService, row } = createLeaseHarness();

      const [first, second] = await Promise.allSettled([
        leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE),
        leaseService.resumeHold(TXH_ID, DEVICE_B, SCOPE),
      ]);

      const winners = [first, second].filter((r) => r.status === 'fulfilled');
      const losers = [first, second].filter((r) => r.status === 'rejected');
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0].reason).toBeInstanceOf(ConflictException);
      expect(row().txhStatus).toBe('LOCKED');
      expect(row().txhResumeCount).toBe(1);
    });

    it('hands the screen back with a lease that ends, and a token to prove it', async () => {
      const { service: leaseService, row } = createLeaseHarness();

      const resumed = await leaseService.resumeHold(TXH_ID, DEVICE_A, {
        ...SCOPE,
        lockTtlSeconds: 60,
      });

      expect(resumed.txhPayload).toEqual(PAYLOAD);
      expect(resumed.txhStatus).toBe(TxnHoldStatus.LOCKED);
      // The whole block moves together — ck_txh_lock_block accepts all five set
      // or all five null, nothing in between.
      expect(resumed.txhLockedBy).toBe(USER_ID);
      expect(resumed.txhLockedDeviceId).toBe(DEVICE_A);
      expect(resumed.txhLockToken).toEqual(expect.any(String));
      expect(new Date(resumed.txhLockExpiresOn!).getTime()).toBe(
        new Date(resumed.txhLockedOn!).getTime() + 60_000,
      );
      expect(row().txhResumeCount).toBe(1);
    });

    it('is idempotent for the device that already holds the lease', async () => {
      const { service: leaseService, row } = createLeaseHarness();

      const first = await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);
      const again = await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);

      expect(again.txhStatus).toBe(TxnHoldStatus.LOCKED);
      expect(row().txhResumeCount).toBe(1);
      // A retry must not extend the lease either, or a stuck till could hold a
      // cart for ever by retrying.
      expect(again.txhLockExpiresOn).toBe(first.txhLockExpiresOn);
      expect(again.txhLockToken).toBe(first.txhLockToken);
    });

    // The whole point of a lease: a till that died mid-edit does not strand the
    // cart, and no operator has to know to force-release it.
    it('takes over a lease that has already lapsed', async () => {
      const { service: leaseService, row } = createLeaseHarness({
        txhStatus: 'LOCKED',
        txhLockedBy: OTHER_USER_ID,
        txhLockedDeviceId: DEVICE_B,
        txhLockedOn: new Date('2026-08-05T08:00:00.000Z'),
        txhLockExpiresOn: new Date('2026-08-05T08:15:00.000Z'),
        txhLockToken: '019c6f6c-be87-7a11-8905-36092c46fe99',
      });

      const resumed = await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);

      expect(resumed.txhLockedDeviceId).toBe(DEVICE_A);
      expect(row().txhLockedBy).toBe(USER_ID);
    });

    it('refuses to lease a hold under a live lease held elsewhere', async () => {
      const { service: leaseService } = createLeaseHarness({
        txhStatus: 'LOCKED',
        txhLockedBy: OTHER_USER_ID,
        txhLockedDeviceId: DEVICE_B,
        txhLockedOn: new Date(),
        txhLockExpiresOn: new Date(Date.now() + 600_000),
        txhLockToken: '019c6f6c-be87-7a11-8905-36092c46fe99',
      });

      await expect(leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    // A TEMPLATE is copied on resume, so leasing one would take a starting point
    // out of circulation.
    it('will not lease a template', async () => {
      const { service: leaseService } = createLeaseHarness({ txhKind: 'TEMPLATE' });

      await expect(leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('releases back to HELD and clears the whole lease block', async () => {
      const { service: leaseService, row } = createLeaseHarness();

      const resumed = await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);
      const released = await leaseService.releaseHold(TXH_ID, DEVICE_A, {
        ...SCOPE,
        txhLockToken: resumed.txhLockToken,
      });

      expect(released.txhStatus).toBe(TxnHoldStatus.HELD);
      expect(released.txhLockedBy).toBeNull();
      expect(released.txhLockedDeviceId).toBeNull();
      expect(released.txhLockedOn).toBeNull();
      expect(released.txhLockExpiresOn).toBeNull();
      expect(released.txhLockToken).toBeNull();
      // The history of who pulled it and how often is not erased with the lease.
      expect(row().txhResumedBy).toBe(USER_ID);
      expect(row().txhResumeCount).toBe(1);
    });

    it('refuses to let another device release or convert the lease', async () => {
      const { service: leaseService } = createLeaseHarness();
      await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);

      await expect(leaseService.releaseHold(TXH_ID, DEVICE_B, SCOPE)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        leaseService.convertHold(TXH_ID, DEVICE_B, SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // The right device with the wrong token is a till spending a lease that was
    // taken away from it and handed back.
    it('refuses a stale lock token from the right device', async () => {
      const { service: leaseService } = createLeaseHarness();
      await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);

      await expect(
        leaseService.releaseHold(TXH_ID, DEVICE_A, {
          ...SCOPE,
          txhLockToken: '019c6f6c-be87-7a11-8905-36092c46fe98',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to convert a hold no device holds', async () => {
      const { service: leaseService } = createLeaseHarness();

      await expect(
        leaseService.convertHold(TXH_ID, DEVICE_A, SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('treats releasing an already free hold as a no-op', async () => {
      const { service: leaseService, row } = createLeaseHarness();

      const released = await leaseService.releaseHold(TXH_ID, DEVICE_A, SCOPE);

      expect(released.txhStatus).toBe(TxnHoldStatus.HELD);
      expect(row().txhModifiedOn).toBeNull();
    });

    it('stamps the conversion trail, drops the lease and closes the hold for good', async () => {
      const { service: leaseService, row } = createLeaseHarness();
      await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);

      const converted = await leaseService.convertHold(TXH_ID, DEVICE_A, SCOPE, CONVERSION);

      expect(converted.txhStatus).toBe(TxnHoldStatus.CONVERTED);
      // ck_txh_converted_block wants the whole trail: which document, in which
      // year, when, and by whom.
      expect(converted.txhConvertedDocId).toBe(BILL_ID);
      expect(converted.txhConvertedAccYear).toBe(ACC_YEAR);
      expect(converted.txhConvertedRefno).toBe('INV-101');
      expect(converted.txhConvertedOn).toEqual(expect.any(String));
      expect(converted.txhConvertedBy).toBe(USER_ID);
      expect(converted.txhLockToken).toBeNull();
      expect(row().txhStatus).toBe('CONVERTED');

      // Terminal: it can be neither resumed nor billed a second time.
      await expect(leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(
        leaseService.convertHold(TXH_ID, DEVICE_A, SCOPE, CONVERSION),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a conversion that names no document or no year', async () => {
      const { service: leaseService } = createLeaseHarness();
      await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);

      for (const conversion of [
        { ...CONVERSION, txhConvertedDocId: '' },
        { ...CONVERSION, txhConvertedAccYear: '2026' },
      ]) {
        await expect(
          leaseService.convertHold(TXH_ID, DEVICE_A, SCOPE, conversion),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('never reaches a hold in another company or branch, or a deleted one', async () => {
      const { service: leaseService } = createLeaseHarness();

      await expect(
        leaseService.resumeHold(TXH_ID, DEVICE_A, {
          txhCompanyId: OTHER_COMPANY_ID,
          txhBranchId: BRANCH_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      // A year that is not this row's is the same answer: it lives in another
      // partition as far as the caller is concerned.
      await expect(
        leaseService.resumeHold(TXH_ID, DEVICE_A, { ...SCOPE, txhAccYear: '2027-2028' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const { service: deletedService } = createLeaseHarness({ txhIsDeleted: true });
      await expect(deletedService.resumeHold(TXH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // txh_locked_device_id is a uuid FK to fixed.device_master now, not the free
    // text the old table carried.
    it('requires a device id, and one that is a uuid', async () => {
      const { service: leaseService } = createLeaseHarness();

      for (const bad of [undefined, '', '   ', 'TILL-01']) {
        await expect(leaseService.resumeHold(TXH_ID, bad, SCOPE)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        await expect(leaseService.releaseHold(TXH_ID, bad, SCOPE)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        await expect(
          leaseService.convertHold(TXH_ID, bad, SCOPE, CONVERSION),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    // txh_locked_by is a uuid column, so there has to be somebody to name as the
    // holder.
    it('will not lease a hold for an unauthenticated caller', async () => {
      const { prisma: leasePrisma } = createLeaseHarness();
      const anonymous = new TxnHoldService(
        leasePrisma as unknown as PrismaService,
        { logEntityChange: jest.fn() } as unknown as AuditLogService,
        { loadCandidates: jest.fn() } as unknown as ConfiguredGridSqlService,
        { getUserId: () => null } as unknown as RequestContextService,
      );

      await expect(anonymous.resumeHold(TXH_ID, DEVICE_A, SCOPE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('force release', () => {
    it('lets another device take the lease away, and says so in the audit', async () => {
      const { service: leaseService, audit, row } = createLeaseHarness();
      await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);
      audit.logEntityChange.mockClear();

      const freed = await leaseService.forceReleaseHold(TXH_ID, DEVICE_B, SCOPE);

      expect(freed.txhStatus).toBe(TxnHoldStatus.HELD);
      expect(row().txhLockedDeviceId).toBeNull();
      const { notes } = audit.logEntityChange.mock.calls[0][0] as { notes: string };
      expect(notes).toContain(DEVICE_B);
      expect(notes).toContain(DEVICE_A);
    });

    // A row a client drove into RESUMED through the CRUD route holds no lease,
    // so it is un-resumable (409) and un-releasable (403) — this is what frees it.
    it('frees a RESUMED hold that nothing else can', async () => {
      const { service: leaseService, row } = createLeaseHarness({ txhStatus: 'RESUMED' });

      await expect(leaseService.forceReleaseHold(TXH_ID, DEVICE_B, SCOPE)).resolves.toMatchObject({
        txhStatus: TxnHoldStatus.HELD,
      });
      expect(row().txhStatus).toBe('HELD');
    });

    it('will not force a closed hold back open', async () => {
      for (const closed of ['CONVERTED', 'EXPIRED', 'CANCELLED', 'ABANDONED']) {
        const { service: leaseService } = createLeaseHarness({ txhStatus: closed });
        await expect(leaseService.forceReleaseHold(TXH_ID, DEVICE_B, SCOPE)).rejects.toBeInstanceOf(
          ConflictException,
        );
      }
    });

    it('forces only inside the tenant scope, and no-ops on a free hold', async () => {
      const { service: leaseService, row } = createLeaseHarness();

      await expect(
        leaseService.forceReleaseHold(TXH_ID, DEVICE_B, {
          txhCompanyId: OTHER_COMPANY_ID,
          txhBranchId: BRANCH_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(leaseService.forceReleaseHold(TXH_ID, DEVICE_B, SCOPE)).resolves.toMatchObject({
        txhStatus: TxnHoldStatus.HELD,
      });
      expect(row().txhModifiedOn).toBeNull();
    });

    it('still requires a device id to force', async () => {
      const { service: leaseService } = createLeaseHarness();

      await expect(leaseService.forceReleaseHold(TXH_ID, undefined, SCOPE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // The lease and the sweeper's expiry are different clocks: giving the lease
    // back does not make the hold live longer or lapse sooner.
    it('never touches the expiry columns', async () => {
      const expiresOn = new Date('2026-08-06T10:00:00.000Z');
      const { service: leaseService, row } = createLeaseHarness({ txhExpiresOn: expiresOn });

      await leaseService.resumeHold(TXH_ID, DEVICE_A, SCOPE);
      await leaseService.forceReleaseHold(TXH_ID, DEVICE_B, SCOPE);

      expect(row().txhExpiresOn).toBe(expiresOn);
    });
  });
});
