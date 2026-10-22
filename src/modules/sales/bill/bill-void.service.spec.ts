import { HttpException } from '@nestjs/common';
import { Prisma, type SaleBill, type TillVoid } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { loadRights, NO_RIGHTS } from '../../../common/posting/rights';
import { throwTill } from '../../till/till-errors';
import { TILL_MENU, TillErrorCode, TillEventCode } from '../../till/types/till-enum';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { BillVoidService } from './bill-void.service';
import type { VoidBillDto } from './dto/bill-lifecycle.dto';

jest.mock('../../../common/posting/rights', () => ({
  ...jest.requireActual<object>('../../../common/posting/rights'),
  loadRights: jest.fn(),
}));

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46c101';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46c102';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46c103';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46c104';
const CASHIER_ID = '019c6f6c-be87-7a11-8905-36092c46c105';
const SUPERVISOR_ID = '019c6f6c-be87-7a11-8905-36092c46c106';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46c107';
const REASON_ID = '019c6f6c-be87-7a11-8905-36092c46c108';
const VOID_ID = '019c6f6c-be87-7a11-8905-36092c46c109';
const REVERSAL_ID = '019c6f6c-be87-7a11-8905-36092c46c10a';
const COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46c10b';
const DAY_ID = '019c6f6c-be87-7a11-8905-36092c46c10c';
const APPROVAL_ID = '019c6f6c-be87-7a11-8905-36092c46c10d';
const ACC_YEAR = '2026-2027';
const KEYS = { sbId: BILL_ID, sbCompanyId: COMPANY_ID, sbBranchId: BRANCH_ID, sbAccYear: ACC_YEAR };
const POSTED_ON = new Date('2026-10-19T05:00:00.000Z');

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

/** A $queryRaw stand-in that answers by the first route whose text appears in the SQL. */
const routedRaw = (routes: [string, unknown][]) =>
  jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    const hit = routes.find(([needle]) => sql.includes(needle));
    return Promise.resolve(hit ? hit[1] : []);
  });

const billOf = (overrides: Partial<SaleBill> = {}): SaleBill =>
  ({
    sbId: BILL_ID,
    sbCompanyId: COMPANY_ID,
    sbBranchId: BRANCH_ID,
    sbTenantId: null,
    sbAccYear: ACC_YEAR,
    sbBillRefno: 'BIL/0042',
    sbBillDate: new Date('2026-10-19T00:00:00.000Z'),
    sbBillDatetime: new Date('2026-10-19T04:30:00.000Z'),
    sbBillAmt: new Prisma.Decimal('1180.00'),
    sbStatus: 'POSTED',
    sbSessionId: SESSION_ID,
    sbDeviceId: 'raman',
    ...overrides,
  }) as SaleBill;

const voidRow = (overrides: Partial<TillVoid> = {}): TillVoid =>
  ({
    tvdId: VOID_ID,
    tvdSessionId: SESSION_ID,
    tvdCashierId: CASHIER_ID,
    tvdVoidedBy: CASHIER_ID,
    tvdVoidedOn: new Date('2026-10-19T05:12:00.000Z'),
    tvdAmount: new Prisma.Decimal('1180.00'),
    tvdCashAmount: new Prisma.Decimal('500.00'),
    tvdReasonId: REASON_ID,
    tvdNote: null,
    tvdPostedOn: POSTED_ON,
    tvdMinutesAfterPost: 12,
    tvdWasPrinted: true,
    tvdPrintCount: 1,
    tvdLastPrintedOn: new Date('2026-10-19T05:01:00.000Z'),
    tvdPrintFailed: false,
    tvdSessionVoidNo: 1,
    tvdApprovalId: null,
    tvdReversalVoucherId: REVERSAL_ID,
    tvdReversalAccYear: ACC_YEAR,
    ...overrides,
  }) as TillVoid;

const sessionRow = (tssStatus = 'OPEN') => ({
  tssId: SESSION_ID,
  tssAccYear: ACC_YEAR,
  tssCompanyId: COMPANY_ID,
  tssBranchId: BRANCH_ID,
  tssSessionNo: 'S/0007',
  tssStatus,
  tssOperatorId: CASHIER_ID,
});

const lockedSession = {
  ...sessionRow(),
  tssCounterId: COUNTER_ID,
  tssDayId: DAY_ID,
  tssDeviceId: DEVICE_ID,
};

const reasonRow = (overrides: object = {}) => ({
  trsId: REASON_ID,
  trsCode: 'WRONG_ITEM',
  trsName: 'Wrong item billed',
  trsNeedsNote: false,
  ...overrides,
});

const rights = loadRights as jest.Mock;

describe('BillVoidService', () => {
  let prisma: {
    tillVoid: { findFirst: jest.Mock; count: jest.Mock; create: jest.Mock };
    tillSession: { findFirst: jest.Mock };
    tillReason: { findFirst: jest.Mock; findMany: jest.Mock };
    saleBill: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let bills: { lockHeader: jest.Mock };
  let lifecycle: { cancelIn: jest.Mock };
  let salesContext: { resolve: jest.Mock };
  let requestContext: { getDeviceId: jest.Mock };
  let till: { lockLive: jest.Mock };
  let approvals: { assessGate: jest.Mock; throwApprovalRequired: jest.Mock; settleGate: jest.Mock };
  let events: { log: jest.Mock };
  let ctxRights: Record<string, boolean>;
  let service: BillVoidService;

  const printRows = [
    { on: new Date('2026-10-19T05:01:00.000Z'), status: 'SUCCESS', mode: 'PRINT', purpose: 'SALE_INVOICE', copy_no: 1 },
    { on: new Date('2026-10-19T05:03:00.000Z'), status: 'FAILED', mode: 'REPRINT', purpose: 'SALE_INVOICE', copy_no: 2 },
    { on: new Date('2026-10-19T05:04:00.000Z'), status: 'SUCCESS', mode: 'REPRINT', purpose: 'SALE_RECEIPT', copy_no: 3 },
  ];
  const defaultRoutes = (): [string, unknown][] => [
    ['FROM public.print_log', printRows],
    ['FROM public.txn_status_log', [{ on: POSTED_ON }]],
    ['FROM accounts.acc_tender_detail', [{ cash: '500.00' }]],
    [
      'FROM (SELECT 1) x',
      [{ reason_code: 'WRONG_ITEM', reason_name: 'Wrong item billed', voided_by: 'ravi', cashier: 'ravi' }],
    ],
    ['FROM accounts.acc_voucher_header', [{ refno: 'REV/0003' }]],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-10-19T05:12:30.000Z'), doNotFake: ['nextTick'] });
    rights.mockResolvedValue({ ...NO_RIGHTS });
    ctxRights = { view: true, cancel: true };
    prisma = {
      tillVoid: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn(async ({ data }: { data: Partial<TillVoid> }) =>
          voidRow({ ...data, tvdId: VOID_ID }),
        ),
      },
      tillSession: { findFirst: jest.fn().mockResolvedValue(sessionRow()) },
      tillReason: {
        findFirst: jest.fn().mockResolvedValue(reasonRow()),
        findMany: jest.fn().mockResolvedValue([reasonRow()]),
      },
      saleBill: { findFirst: jest.fn().mockResolvedValue(billOf()) },
      $queryRaw: routedRaw(defaultRoutes()),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    bills = { lockHeader: jest.fn().mockResolvedValue(billOf()) };
    lifecycle = {
      cancelIn: jest
        .fn()
        .mockResolvedValue({ reversalRefno: 'REV/0003', reversalVoucherId: REVERSAL_ID }),
    };
    salesContext = {
      resolve: jest.fn(async () => ({
        actor: CASHIER_ID,
        actorName: 'ravi',
        rights: ctxRights,
      })),
    };
    requestContext = { getDeviceId: jest.fn().mockReturnValue(DEVICE_ID) };
    till = { lockLive: jest.fn().mockResolvedValue(lockedSession) };
    approvals = {
      assessGate: jest.fn().mockResolvedValue({ state: 'NONE' }),
      throwApprovalRequired: jest.fn(() =>
        throwTill(TillErrorCode.APPROVAL_REQUIRED, 'needs an approval', 'approvalId'),
      ),
      settleGate: jest.fn().mockResolvedValue(null),
    };
    events = { log: jest.fn().mockResolvedValue(undefined) };
    service = new BillVoidService(
      prisma as unknown as PrismaService,
      bills as never,
      lifecycle as never,
      salesContext as never,
      requestContext as never,
      till as never,
      approvals as never,
      events as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const dto = (overrides: Partial<VoidBillDto> = {}): VoidBillDto =>
    ({ ...KEYS, reasonId: REASON_ID, ...overrides }) as VoidBillDto;
  const createdVoid = () =>
    (prisma.tillVoid.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const loggedEvent = () => events.log.mock.calls[0][1] as Record<string, unknown>;

  describe('void', () => {
    it('cancels through the lifecycle, stamps the evidence once and logs BILL_VOID', async () => {
      const result = await service.void(dto({ note: '  customer changed mind  ' }));

      expect(lifecycle.cancelIn).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sbId: BILL_ID }),
        expect.objectContaining({ actor: CASHIER_ID }),
        'Wrong item billed — customer changed mind',
        expect.any(Date),
        { action: 'void' },
      );
      expect(createdVoid()).toMatchObject({
        tvdSrcDocType: 'SALE_BILL',
        tvdSrcDocId: BILL_ID,
        tvdSrcDocRefno: 'BIL/0042',
        tvdSessionId: SESSION_ID,
        tvdDeviceId: DEVICE_ID,
        tvdCashierId: CASHIER_ID,
        tvdVoidedBy: CASHIER_ID,
        tvdAmount: new Prisma.Decimal('1180.00'),
        tvdCashAmount: new Prisma.Decimal('500.00'),
        tvdReasonId: REASON_ID,
        tvdNote: 'customer changed mind',
        tvdPostedOn: POSTED_ON,
        tvdMinutesAfterPost: 12,
        // Two SUCCESS rows; the FAILED reprint is flagged, not counted.
        tvdWasPrinted: true,
        tvdPrintCount: 2,
        tvdLastPrintedOn: new Date('2026-10-19T05:04:00.000Z'),
        tvdPrintFailed: true,
        // Two voids already in the session: this is the third.
        tvdSessionVoidNo: 3,
        tvdApprovalId: null,
        tvdReversalVoucherId: REVERSAL_ID,
        tvdReversalAccYear: ACC_YEAR,
        // The text column takes the login name.
        tvdCreatedBy: 'ravi',
      });
      expect(loggedEvent()).toMatchObject({
        code: TillEventCode.BILL_VOID,
        sessionId: SESSION_ID,
        dayId: DAY_ID,
        counterId: COUNTER_ID,
        deviceId: DEVICE_ID,
        userId: CASHIER_ID,
        srcDocType: 'SALE_BILL',
        srcDocId: BILL_ID,
        reasonId: REASON_ID,
        payload: expect.objectContaining({
          amount: 1180,
          cash: 500,
          reason: 'WRONG_ITEM',
          voidNo: 3,
          reversalVoucherRefno: 'REV/0003',
          bySupervisor: false,
        }),
      });
      expect(result).toMatchObject({
        sbId: BILL_ID,
        sbStatus: 'CANCELLED',
        reversalVoucherRefno: 'REV/0003',
        void: { tvdId: VOID_ID, reasonCode: 'WRONG_ITEM', cashier: 'ravi', amount: 1180 },
      });
    });

    it('answers a bill already voided from its stored row, writing nothing', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus: 'CANCELLED' }));
      prisma.tillVoid.findFirst.mockResolvedValue(voidRow());

      const result = await service.void(dto());

      expect(result).toMatchObject({
        sbStatus: 'CANCELLED',
        voidedOn: '2026-10-19T05:12:00.000Z',
        reversalVoucherRefno: 'REV/0003',
      });
      expect(lifecycle.cancelIn).not.toHaveBeenCalled();
      expect(prisma.tillVoid.create).not.toHaveBeenCalled();
      expect(events.log).not.toHaveBeenCalled();
    });

    it.each([
      ['CANCELLED', /already cancelled/],
      ['DRAFT', /Only a POSTED bill can be voided/],
    ])('refuses a %s bill that was never voided', async (sbStatus, message) => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus }));

      const refusal = await refusalOf(service.void(dto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            { field: 'sbId', code: TillErrorCode.VOID_NOT_POSTED, status: sbStatus, message },
          ],
        },
      });
      expect(salesContext.resolve).not.toHaveBeenCalled();
    });

    it('refuses a user without menu 12 Cancel', async () => {
      ctxRights.cancel = false;

      const refusal = await refusalOf(service.void(dto()));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CANCEL }] },
      });
      expect(prisma.tillSession.findFirst).not.toHaveBeenCalled();
    });

    it.each([
      ['no session id', { sbSessionId: null }],
      ['a session id that is not a uuid', { sbSessionId: 'client-run-42' }],
    ])('sends a bill with %s to /bills/cancel', async (_case, overrides) => {
      bills.lockHeader.mockResolvedValue(billOf(overrides));

      const refusal = await refusalOf(service.void(dto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sbId', code: TillErrorCode.VOID_NO_SESSION }] },
      });
      expect(prisma.tillSession.findFirst).not.toHaveBeenCalled();
    });

    it('sends a bill whose session row is gone to /bills/cancel', async () => {
      prisma.tillSession.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.void(dto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: TillErrorCode.VOID_NO_SESSION }] },
      });
    });

    it.each(['COUNTING', 'PENDING_APPROVAL', 'CLOSED'])(
      'sends a bill of a %s session to a sale return',
      async (status) => {
        prisma.tillSession.findFirst.mockResolvedValue(sessionRow(status));

        const refusal = await refusalOf(service.void(dto()));

        expect(refusal).toMatchObject({
          status: 409,
          body: {
            errors: [
              {
                field: 'sbId',
                code: TillErrorCode.VOID_SESSION_CLOSED,
                sessionNo: 'S/0007',
                status,
              },
            ],
          },
        });
        expect(till.lockLive).not.toHaveBeenCalled();
      },
    );

    it('voids a SUSPENDED session’s bill too', async () => {
      prisma.tillSession.findFirst.mockResolvedValue(sessionRow('SUSPENDED'));

      await expect(service.void(dto())).resolves.toMatchObject({ sbStatus: 'CANCELLED' });
    });

    it('locks the session as its cashier on a uuid device, without supervisor rights', async () => {
      await service.void(dto());

      expect(rights).toHaveBeenCalledWith(prisma, CASHIER_ID, TILL_MENU.SESSIONS);
      expect(till.lockLive).toHaveBeenCalledWith(
        prisma,
        { companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR, tssId: SESSION_ID },
        { userId: CASHIER_ID, actorName: 'ravi', deviceId: DEVICE_ID },
        { supervisor: false },
      );
    });

    it('reads a device header that is not a uuid as no device', async () => {
      requestContext.getDeviceId.mockReturnValue('raman');

      await service.void(dto());

      expect(till.lockLive.mock.calls[0][2]).toMatchObject({ deviceId: null });
      expect(createdVoid().tvdDeviceId).toBeNull();
      // The journal falls back to the session's own device.
      expect(loggedEvent().deviceId).toBe(DEVICE_ID);
    });

    it('lets a Till Sessions OVERRIDE holder void another cashier’s bill and says so', async () => {
      rights.mockResolvedValue({ ...NO_RIGHTS, override: true });
      salesContext.resolve.mockResolvedValue({
        actor: SUPERVISOR_ID,
        actorName: 'meena',
        rights: ctxRights,
      });

      await service.void(dto());

      expect(till.lockLive.mock.calls[0][3]).toEqual({ supervisor: true });
      expect(createdVoid()).toMatchObject({ tvdCashierId: CASHIER_ID, tvdVoidedBy: SUPERVISOR_ID });
      expect(loggedEvent().payload).toMatchObject({ bySupervisor: true, cashierId: CASHIER_ID });
    });

    it.each([
      [TillErrorCode.SESSION_NOT_YOURS, /belongs to another cashier/],
      [TillErrorCode.SESSION_WRONG_DEVICE, /driven from the device it was opened on/],
    ])('rewords the till’s %s as a void refusal', async (code, message) => {
      till.lockLive.mockImplementation(() => throwTill(code, 'till says no', 'tssId'));

      const refusal = await refusalOf(service.void(dto()));

      expect(refusal).toMatchObject({
        status: 403,
        body: {
          errors: [
            {
              field: 'sbId',
              code: TillErrorCode.VOID_NOT_ALLOWED,
              message,
              sessionNo: 'S/0007',
              because: code,
            },
          ],
        },
      });
      expect(lifecycle.cancelIn).not.toHaveBeenCalled();
    });

    it('passes any other lock refusal through unchanged', async () => {
      till.lockLive.mockImplementation(() =>
        throwTill(TillErrorCode.SESSION_NOT_OPEN, 'not live', 'tssId'),
      );

      const refusal = await refusalOf(service.void(dto()));

      expect(refusal.body).toMatchObject({
        errors: [{ code: TillErrorCode.SESSION_NOT_OPEN }],
      });
    });

    it('asks for an active VOID_BILL reason of the company or the house', async () => {
      prisma.tillReason.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.void(dto()));

      expect(prisma.tillReason.findFirst).toHaveBeenCalledWith({
        where: {
          trsId: REASON_ID,
          trsIsDeleted: false,
          trsIsActive: true,
          trsCategory: 'VOID_BILL',
          OR: [{ trsCompanyId: null }, { trsCompanyId: COMPANY_ID }],
        },
      });
      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'reasonId', code: TillErrorCode.REASON_INVALID }] },
      });
    });

    it('refuses a blank note on a reason that needs one', async () => {
      prisma.tillReason.findFirst.mockResolvedValue(reasonRow({ trsNeedsNote: true }));

      const refusal = await refusalOf(service.void(dto({ note: '   ' })));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'note', code: TillErrorCode.REASON_INVALID }] },
      });
      expect(lifecycle.cancelIn).not.toHaveBeenCalled();
    });

    it('asks the gate with the evidence, and refuses with 428 before any unwind', async () => {
      approvals.assessGate.mockResolvedValue({ state: 'REFUSE', need: { minRole: 'X' }, rule: {} });

      const refusal = await refusalOf(service.void(dto({ approvalId: APPROVAL_ID })));

      expect(approvals.assessGate.mock.calls[0][1]).toMatchObject({
        event: 'VOID_BILL',
        onDate: '2026-10-19',
        amount: new Prisma.Decimal('1180.00'),
        requesterId: CASHIER_ID,
        sessionId: SESSION_ID,
        counterId: COUNTER_ID,
        srcDocType: 'SALE_BILL',
        srcDocId: BILL_ID,
        approvalId: APPROVAL_ID,
        field: 'approvalId',
        count: 3,
        payload: { printed: true, printCount: 2, minutesAfterPost: 12, voidNo: 3 },
      });
      expect(refusal).toMatchObject({
        status: 428,
        body: { errors: [{ code: TillErrorCode.APPROVAL_REQUIRED }] },
      });
      expect(lifecycle.cancelIn).not.toHaveBeenCalled();
      expect(prisma.tillVoid.create).not.toHaveBeenCalled();
    });

    it('stamps the approval the gate settled on the row and the event', async () => {
      approvals.assessGate.mockResolvedValue({ state: 'APPROVED', tapId: APPROVAL_ID });
      approvals.settleGate.mockResolvedValue(APPROVAL_ID);

      await service.void(dto({ approvalId: APPROVAL_ID }));

      expect(createdVoid().tvdApprovalId).toBe(APPROVAL_ID);
      expect(loggedEvent()).toMatchObject({ approvalId: APPROVAL_ID });
    });

    it('reads a bill never printed and with no POSTED step from its own datetime', async () => {
      prisma.$queryRaw = routedRaw([
        ['FROM public.print_log', []],
        ['FROM public.txn_status_log', [{ on: null }]],
        ['FROM accounts.acc_tender_detail', [{ cash: null }]],
      ]);
      lifecycle.cancelIn.mockResolvedValue({ reversalRefno: null, reversalVoucherId: null });

      await service.void(dto());

      expect(createdVoid()).toMatchObject({
        tvdWasPrinted: false,
        tvdPrintCount: 0,
        tvdLastPrintedOn: null,
        tvdPrintFailed: false,
        tvdPostedOn: new Date('2026-10-19T04:30:00.000Z'),
        tvdMinutesAfterPost: 42,
        tvdCashAmount: new Prisma.Decimal(0),
        tvdReversalVoucherId: null,
        tvdReversalAccYear: null,
      });
    });

    it('never reads a negative number of minutes after the post', async () => {
      prisma.$queryRaw = routedRaw([
        ['FROM public.txn_status_log', [{ on: new Date('2026-10-19T06:00:00.000Z') }]],
      ]);

      await service.void(dto());

      expect(createdVoid().tvdMinutesAfterPost).toBe(0);
    });
  });

  describe('check', () => {
    it('answers 404 for a bill that is not there', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.check(KEYS));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sbId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
    });

    it('refuses a user without menu 12 View', async () => {
      ctxRights.view = false;

      const refusal = await refusalOf(service.check(KEYS));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_VIEW }] },
      });
    });

    it('offers a live session’s bill to its cashier on its device, with the evidence', async () => {
      prisma.tillSession.findFirst
        .mockResolvedValueOnce(sessionRow())
        .mockResolvedValueOnce({ tssDeviceId: DEVICE_ID });

      const answer = await service.check(KEYS);

      expect(answer).toMatchObject({
        route: 'VOID',
        code: null,
        canVoid: true,
        amount: 1180,
        cashAmount: 500,
        session: { tssId: SESSION_ID, sessionNo: 'S/0007', status: 'OPEN' },
        postedOn: POSTED_ON.toISOString(),
        minutesAfterPost: 12,
        printed: true,
        printCount: 2,
        printFailed: true,
        lastPrintedOn: '2026-10-19T05:04:00.000Z',
        nextVoidNo: 3,
        reasons: [
          { reasonId: REASON_ID, code: 'WRONG_ITEM', name: 'Wrong item billed', needsNote: false },
        ],
        void: null,
      });
      expect((answer.prints as unknown[])[1]).toEqual({
        on: '2026-10-19T05:03:00.000Z',
        status: 'FAILED',
        mode: 'REPRINT',
        purpose: 'SALE_INVOICE',
        copyNo: 2,
      });
      // Reads only.
      expect(prisma.tillVoid.create).not.toHaveBeenCalled();
      expect(lifecycle.cancelIn).not.toHaveBeenCalled();
    });

    it('does not offer the void to the cashier on another device', async () => {
      prisma.tillSession.findFirst
        .mockResolvedValueOnce(sessionRow())
        .mockResolvedValueOnce({ tssDeviceId: '019c6f6c-be87-7a11-8905-36092c46c1ff' });

      await expect(service.check(KEYS)).resolves.toMatchObject({ route: 'VOID', canVoid: false });
    });

    it('offers it to a supervisor whoever opened the session', async () => {
      rights.mockResolvedValue({ ...NO_RIGHTS, override: true });
      salesContext.resolve.mockResolvedValue({
        actor: SUPERVISOR_ID,
        actorName: 'meena',
        rights: ctxRights,
      });

      await expect(service.check(KEYS)).resolves.toMatchObject({ canVoid: true });
    });

    it('does not offer it without menu 12 Cancel', async () => {
      ctxRights.cancel = false;
      prisma.tillSession.findFirst
        .mockResolvedValueOnce(sessionRow())
        .mockResolvedValueOnce({ tssDeviceId: DEVICE_ID });

      await expect(service.check(KEYS)).resolves.toMatchObject({ route: 'VOID', canVoid: false });
    });

    it.each([
      ['a voided bill', { sbStatus: 'CANCELLED' }, voidRow(), sessionRow(), 'VOIDED', null],
      ['a plain cancel', { sbStatus: 'CANCELLED' }, null, sessionRow(), 'CANCELLED', TillErrorCode.VOID_NOT_POSTED],
      ['a draft', { sbStatus: 'DRAFT' }, null, sessionRow(), 'NOT_POSTED', TillErrorCode.VOID_NOT_POSTED],
      ['no till session', { sbSessionId: null }, null, null, 'CANCEL', TillErrorCode.VOID_NO_SESSION],
      ['a counted session', {}, null, sessionRow('COUNTING'), 'RETURN', TillErrorCode.VOID_SESSION_CLOSED],
    ])('routes %s', async (_case, bill, existing, session, route, code) => {
      prisma.saleBill.findFirst.mockResolvedValue(billOf(bill));
      prisma.tillVoid.findFirst.mockResolvedValue(existing);
      prisma.tillSession.findFirst.mockResolvedValue(session);

      const answer = await service.check(KEYS);

      expect(answer).toMatchObject({ route, code, canVoid: false });
    });

    it('carries the stored void row on a voided bill', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(billOf({ sbStatus: 'CANCELLED' }));
      prisma.tillVoid.findFirst.mockResolvedValue(voidRow());

      const answer = await service.check(KEYS);

      expect(answer.void).toMatchObject({
        tvdId: VOID_ID,
        voidedOn: '2026-10-19T05:12:00.000Z',
        amount: 1180,
        cashAmount: 500,
        reasonName: 'Wrong item billed',
        voidedByName: 'ravi',
        wasPrinted: true,
        sessionVoidNo: 1,
        reversalVoucherId: REVERSAL_ID,
      });
    });

    it('answers no next void number when the bill has no session', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(billOf({ sbSessionId: null }));

      const answer = await service.check(KEYS);

      expect(answer).toMatchObject({ session: null, nextVoidNo: null });
      expect(prisma.tillVoid.count).not.toHaveBeenCalled();
    });
  });
});
