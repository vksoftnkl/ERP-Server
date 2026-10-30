import { HttpException } from '@nestjs/common';
import { Prisma, TxnHold } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SaveTxnHoldDto } from './dto/save-txn-hold.dto';
import { TxnHoldService } from './txn-hold.service';
import { TxnHoldConversion, TxnHoldErrorCode, TxnHoldLockScope } from './types/txn-hold-api.types';

/**
 * Notes 119: the till words its box by `errors[].code` alone. txn-hold.service
 * .spec.ts pins the behaviour of each rule; this spec pins the status, field and
 * code every refusal answers with, plus the list filters and the unique-violation
 * fallback it does not reach.
 */
const TXH_ID = '019c6f6c-be87-7a11-8905-36092c46e901';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e902';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e903';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e904';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e905';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46e906';
const OTHER_DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46e907';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46e908';
const STAFF_ID = '019c6f6c-be87-7a11-8905-36092c46e909';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46e90a';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e90b';
const ACC_YEAR = '2026-2027';
const HOLD_ON = new Date('2026-08-04T10:00:00.000Z');

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

const hold = (overrides: Partial<TxnHold> = {}): TxnHold => ({
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
  txhDeviceId: DEVICE_ID,
  txhCounterId: null,
  txhSessionId: null,
  txhHeldBy: USER_ID,
  txhPartyType: null,
  txhPartyId: null,
  txhPartyName: null,
  txhPartyMobile: null,
  txhStaffId: null,
  txhRefLabel: null,
  txhItemCount: 0,
  txhTotalQty: new Prisma.Decimal(0),
  txhNetAmount: new Prisma.Decimal(0),
  txhPayload: { cart: [] },
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
});

const createDto = (overrides: Record<string, unknown> = {}): SaveTxnHoldDto =>
  ({
    txhCompanyId: COMPANY_ID,
    txhBranchId: BRANCH_ID,
    txhAccYear: ACC_YEAR,
    txhSrcModule: 'POS',
    txhDocType: 'SALE_BILL',
    txhDeviceId: DEVICE_ID,
    txhHeldBy: USER_ID,
    txhPayload: { cart: [] },
    ...overrides,
  }) as unknown as SaveTxnHoldDto;

const SCOPE: TxnHoldLockScope = { txhCompanyId: COMPANY_ID, txhBranchId: BRANCH_ID };
const CONVERSION: TxnHoldConversion = { txhConvertedDocId: BILL_ID, txhConvertedAccYear: ACC_YEAR };

describe('TxnHoldService — refusal codes', () => {
  let prisma: {
    txnHold: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    company: { findFirst: jest.Mock };
    branchMaster: { findFirst: jest.Mock };
    deviceMaster: { findFirst: jest.Mock };
    userMaster: { findFirst: jest.Mock };
    userLoginSession: { findFirst: jest.Mock };
    employeeMaster: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let grid: { loadCandidates: jest.Mock };
  let userId: string | null;
  let service: TxnHoldService;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      txnHold: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(async ({ data }: { data: Partial<TxnHold> }) => hold(data)),
        update: jest.fn(async ({ data }: { data: Partial<TxnHold> }) => hold(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      company: { findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brId: BRANCH_ID }) },
      deviceMaster: {
        findFirst: jest.fn().mockResolvedValue({ devId: DEVICE_ID, devIsBlocked: false }),
      },
      userMaster: { findFirst: jest.fn().mockResolvedValue({ usrId: USER_ID }) },
      userLoginSession: { findFirst: jest.fn().mockResolvedValue({ ulsId: SESSION_ID }) },
      employeeMaster: { findFirst: jest.fn().mockResolvedValue({ empId: STAFF_ID }) },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    grid = { loadCandidates: jest.fn().mockResolvedValue([]) };
    service = new TxnHoldService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as never,
      grid as never,
      { getUserId: () => userId } as never,
    );
  });

  /** The one stored hold every read of an update / lease path finds. */
  const storeHold = (overrides: Partial<TxnHold> = {}) =>
    prisma.txnHold.findFirst.mockResolvedValue(hold(overrides));
  const update = (extra: Record<string, unknown>) =>
    service.save({ txhId: TXH_ID, ...extra } as unknown as SaveTxnHoldDto);

  describe('create — before the transaction opens', () => {
    it.each([
      ['txhCompanyId', { txhCompanyId: undefined }],
      ['txhBranchId', { txhBranchId: '' }],
      ['txhAccYear', { txhAccYear: undefined }],
      ['txhSrcModule', { txhSrcModule: undefined }],
      ['txhDocType', { txhDocType: undefined }],
      ['txhDeviceId', { txhDeviceId: undefined }],
      ['txhHeldBy', { txhHeldBy: undefined }],
    ])('answers 400 HOLD_FIELD_REQUIRED on a missing %s', async (field, extra) => {
      const refusal = await refusalOf(service.save(createDto(extra)));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field, code: TxnHoldErrorCode.FIELD_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 400 HOLD_ACC_YEAR_INVALID on a year with no partition shape', async () => {
      const refusal = await refusalOf(service.save(createDto({ txhAccYear: '2026-27' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txhAccYear', code: TxnHoldErrorCode.ACC_YEAR_INVALID }] },
      });
    });

    it('trims a padded year before it is stored', async () => {
      await service.save(createDto({ txhAccYear: ` ${ACC_YEAR} ` }));

      expect(prisma.txnHold.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ txhAccYear: ACC_YEAR }) as object,
      });
    });

    it.each([
      ['missing', undefined],
      ['an array', [1, 2]],
      ['a string', 'cart'],
    ])('answers 400 HOLD_PAYLOAD_INVALID on a payload that is %s', async (_label, payload) => {
      const refusal = await refusalOf(service.save(createDto({ txhPayload: payload })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txhPayload', code: TxnHoldErrorCode.PAYLOAD_INVALID }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create — the masters it points at', () => {
    it.each([
      ['company', 'txhCompanyId', TxnHoldErrorCode.COMPANY_NOT_FOUND],
      ['branchMaster', 'txhBranchId', TxnHoldErrorCode.BRANCH_NOT_FOUND],
      ['deviceMaster', 'txhDeviceId', TxnHoldErrorCode.DEVICE_NOT_FOUND],
      ['userMaster', 'txhHeldBy', TxnHoldErrorCode.USER_NOT_FOUND],
      ['userLoginSession', 'txhSessionId', TxnHoldErrorCode.SESSION_NOT_FOUND],
      ['employeeMaster', 'txhStaffId', TxnHoldErrorCode.STAFF_NOT_FOUND],
    ] as const)('answers 400 when the %s row is not live', async (table, field, code) => {
      prisma[table].findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save(createDto({ txhSessionId: SESSION_ID, txhStaffId: STAFF_ID })),
      );

      expect(refusal).toMatchObject({ status: 400, body: { errors: [{ field, code }] } });
      expect(prisma.txnHold.create).not.toHaveBeenCalled();
    });

    it('answers 403 HOLD_DEVICE_BLOCKED for a blocked till', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue({ devId: DEVICE_ID, devIsBlocked: true });

      const refusal = await refusalOf(service.save(createDto()));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ field: 'txhDeviceId', code: TxnHoldErrorCode.DEVICE_BLOCKED }] },
      });
    });

    it('does not look a session or staff member up when none is named', async () => {
      await service.save(createDto());

      expect(prisma.userLoginSession.findFirst).not.toHaveBeenCalled();
      expect(prisma.employeeMaster.findFirst).not.toHaveBeenCalled();
    });

    it('answers 409 HOLD_NO_DUPLICATE and HOLD_SLNO_DUPLICATE on the numbers already live', async () => {
      prisma.txnHold.findFirst.mockResolvedValueOnce({ txhId: 'other' });
      const number = await refusalOf(service.save(createDto({ txhHoldNo: 'HLD-001' })));
      expect(number).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'txhHoldNo', code: TxnHoldErrorCode.HOLD_NO_DUPLICATE }] },
      });

      prisma.txnHold.findFirst.mockResolvedValueOnce({ txhId: 'other' });
      const serial = await refusalOf(service.save(createDto({ txhHoldSlno: 7 })));
      expect(serial).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'txhHoldSlno', code: TxnHoldErrorCode.SLNO_DUPLICATE }] },
      });
    });

    it('answers a unique violation that slipped past the probes as 409 HOLD_DUPLICATE', async () => {
      prisma.txnHold.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const refusal = await refusalOf(service.save(createDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'txhHoldNo', code: TxnHoldErrorCode.DUPLICATE }] },
      });
    });

    it('rethrows a failure that is not a unique violation', async () => {
      const failure = new Error('connection reset');
      prisma.txnHold.create.mockRejectedValue(failure);

      await expect(service.save(createDto())).rejects.toBe(failure);
    });
  });

  describe('the value rules, judged on the row that will be written', () => {
    it.each([
      ['txhKind', { txhKind: 'DRAFT' }],
      ['txhSrcModule', { txhSrcModule: 'HR' }],
      ['txhDocType', { txhDocType: 'INVOICE' }],
      ['txhPartyType', { txhPartyType: 'VENDOR' }],
    ])('answers 400 HOLD_VALUE_NOT_ALLOWED on %s', async (field, extra) => {
      const refusal = await refusalOf(service.save(createDto(extra)));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field, code: TxnHoldErrorCode.VALUE_NOT_ALLOWED }] },
      });
    });

    it('answers 400 HOLD_PARTY_TYPE_REQUIRED on a party id with no type', async () => {
      const refusal = await refusalOf(service.save(createDto({ txhPartyId: PARTY_ID })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txhPartyType', code: TxnHoldErrorCode.PARTY_TYPE_REQUIRED }] },
      });
    });

    it.each(['txhItemCount', 'txhTotalQty', 'txhNetAmount', 'txhPrintCount'])(
      'answers 400 HOLD_AMOUNT_NEGATIVE on a negative %s',
      async (field) => {
        const refusal = await refusalOf(service.save(createDto({ [field]: -1 })));

        expect(refusal.status).toBe(400);
        expect(refusal.body).toMatchObject({
          errors: expect.arrayContaining([
            expect.objectContaining({ field, code: TxnHoldErrorCode.AMOUNT_NEGATIVE }),
          ]) as unknown[],
        });
      },
    );

    it('answers 400 HOLD_EXPIRY_BEFORE_HOLD on an expiry at the hold instant', async () => {
      const refusal = await refusalOf(
        service.save(createDto({ txhHoldOn: HOLD_ON, txhExpiresOn: HOLD_ON })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txhExpiresOn', code: TxnHoldErrorCode.EXPIRY_BEFORE_HOLD }] },
      });
    });

    it('answers 400 HOLD_PRINT_STAMP_INVALID on a print instant with no prints', async () => {
      const refusal = await refusalOf(service.save(createDto({ txhLastPrintedOn: HOLD_ON })));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'txhLastPrintedOn', code: TxnHoldErrorCode.PRINT_STAMP_INVALID }],
        },
      });
    });

    it.each(['LOCKED', 'CONVERTED'])(
      'answers 400 HOLD_STATUS_NOT_SETTABLE on a payload that sets %s',
      async (status) => {
        const refusal = await refusalOf(service.save(createDto({ txhStatus: status })));

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [{ field: 'txhStatus', code: TxnHoldErrorCode.STATUS_NOT_SETTABLE, status }],
          },
        });
      },
    );

    it('collects every broken value rule in one answer', async () => {
      const refusal = await refusalOf(
        service.save(createDto({ txhKind: 'DRAFT', txhPartyId: PARTY_ID, txhNetAmount: -5 })),
      );

      expect(
        (refusal.body as { errors: Array<{ code: string }> }).errors.map((error) => error.code),
      ).toEqual([
        TxnHoldErrorCode.VALUE_NOT_ALLOWED,
        TxnHoldErrorCode.PARTY_TYPE_REQUIRED,
        TxnHoldErrorCode.AMOUNT_NEGATIVE,
      ]);
    });
  });

  describe('update', () => {
    it('answers 404 HOLD_NOT_FOUND on the id', async () => {
      const refusal = await refusalOf(update({ txhRemarks: 'x' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              field: 'txhId',
              message: `No active hold found with id ${TXH_ID}`,
              code: TxnHoldErrorCode.NOT_FOUND,
            },
          ],
        },
      });
    });

    it('answers 400 HOLD_SCOPE_IMMUTABLE once per field that moves', async () => {
      storeHold();

      const refusal = await refusalOf(
        update({ txhCompanyId: OTHER_COMPANY_ID, txhAccYear: '2025-2026' }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'txhCompanyId', code: TxnHoldErrorCode.SCOPE_IMMUTABLE },
            { field: 'txhAccYear', code: TxnHoldErrorCode.SCOPE_IMMUTABLE },
          ],
        },
      });
    });

    it('takes a resent scope that matches a space-padded stored year', async () => {
      storeHold({ txhAccYear: `${ACC_YEAR} ` });

      await update({ txhCompanyId: COMPANY_ID, txhAccYear: ACC_YEAR, txhRemarks: 'x' });

      expect(prisma.txnHold.update).toHaveBeenCalled();
    });

    it('answers 400 when a re-pointed device or operator is not live', async () => {
      storeHold();
      prisma.deviceMaster.findFirst.mockResolvedValue(null);
      const device = await refusalOf(update({ txhDeviceId: OTHER_DEVICE_ID }));
      expect(device.body).toMatchObject({
        errors: [{ field: 'txhDeviceId', code: TxnHoldErrorCode.DEVICE_NOT_FOUND }],
      });

      prisma.userMaster.findFirst.mockResolvedValue(null);
      const operator = await refusalOf(update({ txhHeldBy: USER_ID }));
      expect(operator.body).toMatchObject({
        errors: [{ field: 'txhHeldBy', code: TxnHoldErrorCode.USER_NOT_FOUND }],
      });
    });

    it('answers 409 HOLD_CLOSED on an attempt to reopen a finished hold', async () => {
      storeHold({ txhStatus: 'EXPIRED' });

      const refusal = await refusalOf(update({ txhStatus: 'HELD' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'txhStatus', code: TxnHoldErrorCode.CLOSED, status: 'EXPIRED' }],
        },
      });
    });

    it('judges a lone print count on the stored print instant', async () => {
      storeHold({ txhPrintCount: 1, txhLastPrintedOn: HOLD_ON });

      await update({ txhPrintCount: 2 });

      expect(prisma.txnHold.update).toHaveBeenCalled();
    });
  });

  describe('getById and softDelete', () => {
    it('answers 404 HOLD_NOT_FOUND on both', async () => {
      for (const call of [service.getById(TXH_ID), service.softDelete(TXH_ID, ACC_YEAR)]) {
        const refusal = await refusalOf(call);
        expect(refusal).toMatchObject({
          status: 404,
          body: { errors: [{ field: 'txhId', code: TxnHoldErrorCode.NOT_FOUND }] },
        });
      }
    });
  });

  describe('list', () => {
    it.each(['holdOnFrom', 'holdOnTo'])(
      'answers 400 HOLD_DATE_INVALID on a %s that does not parse',
      async (field) => {
        const refusal = await refusalOf(service.list({ [field]: 'yesterday' }));

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field, code: TxnHoldErrorCode.DATE_INVALID }] },
        });
      },
    );

    it('ANDs every structured filter under the live-row guard', async () => {
      await service.list({
        page: 1,
        limit: 20,
        search: ' token 7 ',
        txhCompanyId: COMPANY_ID,
        txhStatus: 'HELD',
        holdOnFrom: '2026-08-01T00:00:00.000Z',
        holdOnTo: '2026-08-31T23:59:59.000Z',
        stockReserved: true,
      } as never);

      const { where } = prisma.txnHold.findMany.mock.calls[0][0] as {
        where: { txhIsDeleted: boolean; AND: unknown[] };
      };
      expect(where.txhIsDeleted).toBe(false);
      expect(where.AND).toEqual([
        {
          OR: [
            { txhHoldNo: { contains: 'token 7', mode: 'insensitive' } },
            { txhPartyName: { contains: 'token 7', mode: 'insensitive' } },
            { txhPartyMobile: { contains: 'token 7', mode: 'insensitive' } },
            { txhRefLabel: { contains: 'token 7', mode: 'insensitive' } },
            { txhRemarks: { contains: 'token 7', mode: 'insensitive' } },
          ],
        },
        { txhCompanyId: COMPANY_ID },
        { txhStatus: 'HELD' },
        { txhHoldOn: { gte: new Date('2026-08-01T00:00:00.000Z') } },
        { txhHoldOn: { lte: new Date('2026-08-31T23:59:59.000Z') } },
        { txhIsStockReserved: true },
      ]);
      expect(prisma.txnHold.count).toHaveBeenCalledWith({ where });
      expect(grid.loadCandidates).not.toHaveBeenCalled();
    });

    it('reads expired holds as those whose expiry has passed', async () => {
      await service.list({ expired: true });

      const { where } = prisma.txnHold.findMany.mock.calls[0][0] as {
        where: { AND: Array<{ txhExpiresOn: { lt: Date } }> };
      };
      expect(where.AND[0].txhExpiresOn.lt).toBeInstanceOf(Date);
    });

    it('pages newest first with a stable tie-break', async () => {
      await service.list({ page: 3, limit: 10, txhKind: 'HOLD' } as never);

      expect(prisma.txnHold.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ txhHoldOn: 'desc' }, { txhId: 'desc' }],
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('the lease', () => {
    it('answers 400 HOLD_DEVICE_REQUIRED / HOLD_DEVICE_INVALID on the X-Device-Id header', async () => {
      for (const [deviceId, code] of [
        [undefined, TxnHoldErrorCode.DEVICE_REQUIRED],
        ['   ', TxnHoldErrorCode.DEVICE_REQUIRED],
        ['TILL-01', TxnHoldErrorCode.DEVICE_INVALID],
      ] as const) {
        const refusal = await refusalOf(service.resumeHold(TXH_ID, deviceId, SCOPE));
        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'txhDeviceId', code }] },
        });
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 400 HOLD_OPERATOR_REQUIRED when nobody is logged in', async () => {
      userId = 'SYSTEM';

      const refusal = await refusalOf(service.resumeHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txhLockedBy', code: TxnHoldErrorCode.OPERATOR_REQUIRED }] },
      });
    });

    it('answers 404 HOLD_NOT_FOUND on a hold outside the tenant scope', async () => {
      const refusal = await refusalOf(service.resumeHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'txhId', code: TxnHoldErrorCode.NOT_FOUND }] },
      });
    });

    it('answers 400 HOLD_TEMPLATE_NOT_LEASABLE on a template', async () => {
      storeHold({ txhKind: 'TEMPLATE' });

      const refusal = await refusalOf(service.resumeHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txhKind', code: TxnHoldErrorCode.TEMPLATE_NOT_LEASABLE }] },
      });
    });

    it('answers 409 HOLD_LOCKED_ELSEWHERE with the device and the lease end', async () => {
      const leaseEnd = new Date('2026-08-04T10:15:00.000Z');
      storeHold({
        txhStatus: 'LOCKED',
        txhLockedDeviceId: OTHER_DEVICE_ID,
        txhLockExpiresOn: leaseEnd,
      });

      const refusal = await refusalOf(service.resumeHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'txhLockedDeviceId',
              code: TxnHoldErrorCode.LOCKED_ELSEWHERE,
              status: 'LOCKED',
              lockedDeviceId: OTHER_DEVICE_ID,
              lockExpiresOn: leaseEnd.toISOString(),
            },
          ],
        },
      });
    });

    it('answers 409 HOLD_NOT_RESUMABLE on a hold that is not HELD', async () => {
      storeHold({ txhStatus: 'RESUMED' });

      const refusal = await refusalOf(service.resumeHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'txhStatus', code: TxnHoldErrorCode.NOT_RESUMABLE }] },
      });
    });

    it('answers 403 HOLD_NOT_LEASED_HERE to a release from the wrong device', async () => {
      storeHold({ txhStatus: 'LOCKED', txhLockedDeviceId: OTHER_DEVICE_ID });

      const refusal = await refusalOf(service.releaseHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 403,
        body: {
          errors: [
            {
              field: 'txhLockedDeviceId',
              code: TxnHoldErrorCode.NOT_LEASED_HERE,
              lockedDeviceId: OTHER_DEVICE_ID,
            },
          ],
        },
      });
    });

    it('answers 409 HOLD_CLOSED to a conversion of a finished hold', async () => {
      storeHold({ txhStatus: 'CONVERTED' });

      const refusal = await refusalOf(service.convertHold(TXH_ID, DEVICE_ID, SCOPE, CONVERSION));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'txhStatus', code: TxnHoldErrorCode.CLOSED }] },
      });
    });

    it('answers 400 HOLD_CONVERSION_INVALID once per missing half of the trail', async () => {
      const refusal = await refusalOf(
        service.convertHold(TXH_ID, DEVICE_ID, SCOPE, {
          txhConvertedDocId: '',
          txhConvertedAccYear: '2026',
        }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'txhConvertedDocId', code: TxnHoldErrorCode.CONVERSION_INVALID },
            { field: 'txhConvertedAccYear', code: TxnHoldErrorCode.CONVERSION_INVALID },
          ],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 409 HOLD_CLOSED to a force release of a finished hold', async () => {
      storeHold({ txhStatus: 'CANCELLED' });

      const refusal = await refusalOf(service.forceReleaseHold(TXH_ID, DEVICE_ID, SCOPE));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'txhStatus', code: TxnHoldErrorCode.CLOSED }] },
      });
    });
  });
});
