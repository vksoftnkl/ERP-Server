import { HttpException } from '@nestjs/common';
import { Prisma, type SaleBill } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { appendTxnStatusLog } from '../../../common/txn-status-log/txn-status-log.helper';
import { appendTempCreditStatus } from '../../../common/txn-status-log/temp-credit-status';
import { assertBooksReconcile } from '../../accountsModule/reconcile/books-reconcile.guard';
import { TillEventCode } from '../../till/types/till-enum';
import { loadDayClosed } from '../posting/sales.guards';
import { SALES_VOUCHER_TYPE, TENDER_TYPE } from '../posting/sales-doc.utils';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { syncCounterAllocations } from './bill-counter-allocation.helper';
import { syncBillPdcRegister } from './bill-pdc-posting.helper';
import { BillRetenderService } from './bill-retender.service';
import type { RetenderBillDto } from './dto/bill-lifecycle.dto';

jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<object>('../posting/sales.guards'),
  loadDayClosed: jest.fn(),
}));
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(),
}));
jest.mock('../../../common/txn-status-log/temp-credit-status', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/temp-credit-status'),
  appendTempCreditStatus: jest.fn(),
}));
jest.mock('../../accountsModule/reconcile/books-reconcile.guard', () => ({
  assertBooksReconcile: jest.fn(),
}));
jest.mock('./bill-pdc-posting.helper', () => ({ syncBillPdcRegister: jest.fn() }));
jest.mock('./bill-counter-allocation.helper', () => ({ syncCounterAllocations: jest.fn() }));

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46c201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46c202';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46c203';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46c204';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46c205';
const UPI_ROW = '019c6f6c-be87-7a11-8905-36092c46c206';
const CASH_ROW = '019c6f6c-be87-7a11-8905-36092c46c207';
const NEW_ROW = '019c6f6c-be87-7a11-8905-36092c46c208';
const UPI_LEDGER = '019c6f6c-be87-7a11-8905-36092c46c209';
const CASH_LEDGER = '019c6f6c-be87-7a11-8905-36092c46c20a';
const BILL_VOUCHER = '019c6f6c-be87-7a11-8905-36092c46c20b';
const CONTRA_VOUCHER = '019c6f6c-be87-7a11-8905-36092c46c20c';
const ABL_ID = '019c6f6c-be87-7a11-8905-36092c46c20d';
const BILL_SESSION = '019c6f6c-be87-7a11-8905-36092c46c20e';
const LIVE_SESSION = '019c6f6c-be87-7a11-8905-36092c46c20f';
const CASH_TENDER = '019c6f6c-be87-7a11-8905-36092c46c210';
const ACC_YEAR = '2026-2027';
const KEYS = { sbId: BILL_ID, sbCompanyId: COMPANY_ID, sbBranchId: BRANCH_ID, sbAccYear: ACC_YEAR };

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

const billOf = (overrides: Partial<SaleBill> = {}): SaleBill =>
  ({
    sbId: BILL_ID,
    sbCompanyId: COMPANY_ID,
    sbBranchId: BRANCH_ID,
    sbTenantId: null,
    sbAccYear: ACC_YEAR,
    sbBillRefno: 'BIL/0042',
    sbBillDate: new Date('2026-10-19T00:00:00.000Z'),
    sbCustId: CUST_ID,
    sbUserId: USER_ID,
    sbDeviceId: 'raman',
    sbDeviceType: 'DESKTOP',
    sbSessionId: BILL_SESSION,
    sbStatus: 'POSTED',
    sbPostedVoucherId: BILL_VOUCHER,
    sbBillAmt: new Prisma.Decimal('1000.00'),
    sbAdvanceAmt: new Prisma.Decimal('0'),
    sbNoteAdjAmt: new Prisma.Decimal('0'),
    sbDraftCheques: null,
    ...overrides,
  }) as SaleBill;

/** A row of the FOR UPDATE read of the tender rows named to void. */
const lockedRow = (overrides: object = {}) => ({
  td_id: UPI_ROW,
  td_tender_id: 'upi-tender',
  td_tender_type_id: TENDER_TYPE.UPI,
  td_tender_ledger_id: UPI_LEDGER,
  td_amount: new Prisma.Decimal('500.00'),
  td_is_pdc: false,
  td_settle_status: null,
  td_is_voided: false,
  tnd_name: 'UPI',
  apd_status: null,
  ...overrides,
});

/** A tender payload as the tender service answers it. */
const tenderPayload = (overrides: object = {}) => ({
  tdId: NEW_ROW,
  tdRowNo: 3,
  tdTenderTypeId: TENDER_TYPE.CASH,
  tdTenderLedgerId: CASH_LEDGER,
  tdTenderName: 'Cash',
  tdAmount: new Prisma.Decimal('500.00'),
  tdIsDeleted: false,
  ...overrides,
});

const dayClosed = loadDayClosed as jest.Mock;
const statusLog = appendTxnStatusLog as jest.Mock;
const creditStatus = appendTempCreditStatus as jest.Mock;
const booksCheck = assertBooksReconcile as jest.Mock;
const pdcSync = syncBillPdcRegister as jest.Mock;
const counterSync = syncCounterAllocations as jest.Mock;

describe('BillRetenderService', () => {
  let lockRows: unknown[];
  let priorRetenders: bigint;
  let ablRows: unknown[];
  let liveTotals: unknown[];
  let tx: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    accTempCredit: { findMany: jest.Mock; updateMany: jest.Mock };
    saleBill: { update: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };
  let bills: { lockHeader: jest.Mock; getById: jest.Mock };
  let salesContext: { resolve: jest.Mock };
  let ctxRights: Record<string, boolean>;
  let tenders: { getByDocument: jest.Mock; syncDocumentTenders: jest.Mock };
  let legs: { postLegs: jest.Mock };
  let loyalty: { reverseRedeemForTender: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let recompute: { recomputeBills: jest.Mock };
  let till: { resolveForMoney: jest.Mock; logMoneyDoc: jest.Mock };
  let service: BillRetenderService;

  beforeEach(() => {
    jest.clearAllMocks();
    dayClosed.mockResolvedValue(false);
    statusLog.mockResolvedValue(undefined);
    creditStatus.mockResolvedValue(undefined);
    booksCheck.mockResolvedValue(undefined);
    pdcSync.mockResolvedValue([]);
    counterSync.mockResolvedValue(undefined);
    lockRows = [lockedRow()];
    priorRetenders = 1n;
    ablRows = [{ abl_id: ABL_ID, abl_acc_year: ACC_YEAR }];
    liveTotals = [{ tendered: new Prisma.Decimal('1000.00'), settled: new Prisma.Decimal('1000.00') }];
    tx = {
      // Routed on the SQL text; the voucher count is matched first because its
      // sub-select names acc_tender_detail too.
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('SALE_BILL_RETENDER')) return Promise.resolve([{ n: priorRetenders }]);
        if (sql.includes('FOR UPDATE OF t')) return Promise.resolve(lockRows);
        if (sql.includes('AS tendered')) return Promise.resolve(liveTotals);
        if (sql.includes('accounts.acc_bill_balance')) return Promise.resolve(ablRows);
        return Promise.resolve([]);
      }),
      $executeRaw: jest.fn().mockResolvedValue(1),
      accTempCredit: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      saleBill: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = { $transaction: jest.fn(async (callback: (t: unknown) => unknown) => callback(tx)) };
    bills = {
      lockHeader: jest.fn().mockResolvedValue(billOf()),
      getById: jest.fn().mockResolvedValue({ sbId: BILL_ID }),
    };
    ctxRights = { retender: true };
    salesContext = {
      resolve: jest.fn(async () => ({ actor: USER_ID, actorName: 'ravi', rights: ctxRights })),
    };
    tenders = {
      getByDocument: jest.fn().mockResolvedValue([
        tenderPayload({ tdId: CASH_ROW, tdRowNo: 1 }),
        tenderPayload({ tdId: UPI_ROW, tdRowNo: 2, tdTenderTypeId: TENDER_TYPE.UPI }),
      ]),
      syncDocumentTenders: jest.fn().mockResolvedValue([
        tenderPayload({ tdId: CASH_ROW, tdRowNo: 1 }),
        tenderPayload({ tdId: UPI_ROW, tdRowNo: 2, tdTenderTypeId: TENDER_TYPE.UPI }),
        tenderPayload(),
      ]),
    };
    legs = { postLegs: jest.fn().mockResolvedValue({ voucherId: CONTRA_VOUCHER }) };
    loyalty = { reverseRedeemForTender: jest.fn().mockResolvedValue(undefined) };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    recompute = { recomputeBills: jest.fn().mockResolvedValue(undefined) };
    till = {
      resolveForMoney: jest.fn().mockResolvedValue(null),
      logMoneyDoc: jest.fn().mockResolvedValue(undefined),
    };
    service = new BillRetenderService(
      prisma as unknown as PrismaService,
      bills as never,
      salesContext as never,
      tenders as never,
      legs as never,
      loyalty as never,
      audit as never,
      recompute as never,
      till as never,
    );
  });

  const dto = (overrides: Partial<RetenderBillDto> = {}): RetenderBillDto =>
    ({
      ...KEYS,
      voids: [{ tdId: UPI_ROW, reason: 'UPI_FAILED' }],
      tenders: [{ tdTenderId: CASH_TENDER, tdTenderTypeId: TENDER_TYPE.CASH, tdAmount: 500 }],
      remark: 'UPI failed at the counter',
      ...overrides,
    }) as unknown as RetenderBillDto;
  const contraCall = () =>
    legs.postLegs.mock.calls[0][1] as { header: Record<string, unknown>; legs: unknown[] };
  const headerUpdate = () =>
    (tx.saleBill.update.mock.calls.at(-1)![0] as { data: Record<string, unknown> }).data;
  /** The values interpolated into the n-th $executeRaw call. */
  const executedValues = (n: number) => tx.$executeRaw.mock.calls[n].slice(1) as unknown[];

  describe('refusals', () => {
    it('refuses a CANCELLED bill before reading any right', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus: 'CANCELLED' }));

      const refusal = await refusalOf(service.retender(dto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sbId', code: SALES_ERROR_CODES.BILL_CANCELLED }] },
      });
      expect(salesContext.resolve).not.toHaveBeenCalled();
    });

    it('judges its own right, not um_can_amend', async () => {
      ctxRights = { retender: false, amend: true };

      const refusal = await refusalOf(service.retender(dto()));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_RETENDER }] },
      });
    });

    it('refuses a bill whose day is closed — a day-book correction', async () => {
      dayClosed.mockResolvedValue(true);

      const refusal = await refusalOf(service.retender(dto()));

      expect(dayClosed).toHaveBeenCalledWith(tx, COMPANY_ID, BRANCH_ID, '2026-10-19');
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sbBillDate', code: SALES_ERROR_CODES.DAY_CLOSED }] },
      });
      expect(till.resolveForMoney).not.toHaveBeenCalled();
    });

    it('refuses nothing to void', async () => {
      const refusal = await refusalOf(service.retender(dto({ voids: [] })));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'voids', code: SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH }] },
      });
    });

    it('refuses a row that is not on this bill', async () => {
      const refusal = await refusalOf(
        service.retender(
          dto({
            voids: [
              { tdId: UPI_ROW, reason: 'UPI_FAILED' },
              { tdId: CASH_ROW, reason: 'OTHER' },
            ],
          } as never),
        ),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'voids', code: SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH }] },
      });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('counts a row named twice once', async () => {
      await service.retender(
        dto({
          voids: [
            { tdId: UPI_ROW, reason: 'UPI_FAILED' },
            { tdId: UPI_ROW, reason: 'UPI_FAILED' },
          ],
        } as never),
      );

      expect(legs.postLegs).toHaveBeenCalled();
    });

    it('refuses a row already voided', async () => {
      lockRows = [lockedRow({ td_is_voided: true })];

      const refusal = await refusalOf(service.retender(dto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'voids', code: SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH }] },
      });
    });

    it.each([
      ['a registered cheque the bank has', { apd_status: 'DEPOSITED' }],
      ['a settled post-dated tender', { td_is_pdc: true, td_settle_status: 'settled' }],
      ['a part-settled post-dated tender', { td_is_pdc: true, td_settle_status: 'PARTIAL' }],
    ])('sends %s to /cheques', async (_case, overrides) => {
      lockRows = [lockedRow({ td_tender_type_id: TENDER_TYPE.CHEQUE, ...overrides })];

      const refusal = await refusalOf(service.retender(dto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'voids', code: SALES_ERROR_CODES.RETENDER_PDC_MOVED }] },
      });
    });

    it('re-tenders a cheque still HELD', async () => {
      lockRows = [lockedRow({ td_tender_type_id: TENDER_TYPE.CHEQUE, apd_status: 'HELD' })];

      await expect(service.retender(dto())).resolves.toEqual({ sbId: BILL_ID });
    });

    it('refuses new tenders that do not add up to what was voided', async () => {
      const refusal = await refusalOf(
        service.retender(
          dto({ tenders: [{ tdTenderTypeId: TENDER_TYPE.CASH, tdAmount: 450 }] } as never),
        ),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [{ field: 'tenders', code: SALES_ERROR_CODES.RETENDER_AMOUNT_MISMATCH }],
        },
      });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('a POSTED bill', () => {
    it('voids the row in place and adds the new one in the money session', async () => {
      till.resolveForMoney.mockResolvedValue({ tssId: LIVE_SESSION });

      await service.retender(dto());

      // 1 · the void keeps the row, with its reason and who voided it.
      expect(executedValues(0)).toEqual([
        'UPI_FAILED',
        expect.any(Date),
        USER_ID,
        expect.any(Date),
        USER_ID,
        UPI_ROW,
        ACC_YEAR,
      ]);
      // 2 · the sync keeps every live row and adds the new one, stamped with
      //     the server's session, never the line's.
      const [, scope, rows, actor] = tenders.syncDocumentTenders.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        Record<string, unknown>[],
        string,
      ];
      expect(scope).toMatchObject({ tdSrcDocId: BILL_ID, tdSessionId: LIVE_SESSION, tdDrCr: 'DR' });
      expect(rows).toEqual([
        { tdId: CASH_ROW },
        { tdId: UPI_ROW },
        expect.objectContaining({ tdAmount: 500, tdSessionId: LIVE_SESSION }),
      ]);
      expect(actor).toBe(USER_ID);
      // The new row points at the row it replaces.
      expect(executedValues(1)).toEqual([UPI_ROW, NEW_ROW, ACC_YEAR]);
    });

    it('posts its own TndC contra: DR what happened, CR what did not', async () => {
      await service.retender(dto());

      expect(contraCall().header).toMatchObject({
        voucherTypeId: SALES_VOUCHER_TYPE.TENDER_CHANGE,
        srcModule: 'SALES',
        srcDocType: 'SALE_BILL_RETENDER',
        // Keyed on the voided row, so a second re-tender is its own document.
        srcDocId: UPI_ROW,
        docRefno: 'BIL/0042/RT2',
        docDate: '2026-10-19',
        docAmount: 500,
        partyId: CUST_ID,
        userId: USER_ID,
        sessionId: BILL_SESSION,
        remarks: 'UPI failed at the counter',
      });
      expect(contraCall().legs).toEqual([
        { ledgerId: CASH_LEDGER, drCr: 'DR', amount: 500, remarks: 'Cash' },
        { ledgerId: UPI_LEDGER, drCr: 'CR', amount: 500, remarks: 'UPI' },
      ]);
    });

    it('numbers the first re-tender RT1 and leaves a bill with no refno unnumbered', async () => {
      priorRetenders = 0n;
      await service.retender(dto());
      expect(contraCall().header.docRefno).toBe('BIL/0042/RT1');

      legs.postLegs.mockClear();
      bills.lockHeader.mockResolvedValue(billOf({ sbBillRefno: null }));
      await service.retender(dto());
      expect(contraCall().header.docRefno).toBeNull();
    });

    it('moves the party when the money goes onto or comes off credit', async () => {
      lockRows = [lockedRow({ td_tender_type_id: TENDER_TYPE.CREDIT, tnd_name: 'Credit' })];
      tenders.syncDocumentTenders.mockResolvedValue([
        tenderPayload({ tdId: UPI_ROW, tdTenderTypeId: TENDER_TYPE.CREDIT }),
        tenderPayload({ tdTenderTypeId: TENDER_TYPE.TEMP_CREDIT, tdTenderName: null }),
      ]);
      tenders.getByDocument.mockResolvedValue([
        tenderPayload({ tdId: UPI_ROW, tdTenderTypeId: TENDER_TYPE.CREDIT }),
      ]);

      await service.retender(dto());

      expect(contraCall().legs).toEqual([
        { ledgerId: CUST_ID, drCr: 'DR', amount: 500, remarks: 'Re-tendered to credit' },
        { ledgerId: CUST_ID, drCr: 'CR', amount: 500, remarks: 'Was on Credit' },
      ]);
    });

    it('posts loyalty on its role, both ways', async () => {
      lockRows = [lockedRow({ td_tender_type_id: TENDER_TYPE.LOYALTY })];
      tenders.syncDocumentTenders.mockResolvedValue([
        tenderPayload({ tdTenderTypeId: TENDER_TYPE.LOYALTY }),
      ]);
      tenders.getByDocument.mockResolvedValue([]);

      await service.retender(dto());

      expect(contraCall().legs).toEqual([
        expect.objectContaining({ role: 'LOYALTY_REDEMPTION', drCr: 'DR', amount: 500 }),
        expect.objectContaining({ role: 'LOYALTY_REDEMPTION', drCr: 'CR', amount: 500 }),
      ]);
    });

    it('registers the cheques against the contra and keeps the others on the bill', async () => {
      await service.retender(dto());

      expect(pdcSync).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sbId: BILL_ID }),
        { voucherId: CONTRA_VOUCHER, accYear: ACC_YEAR },
        USER_ID,
        expect.any(Date),
        { keepStoredVoucher: true, details: {} },
      );
    });

    it('moves the counter allocations through rows, then recomputes the receivable', async () => {
      await service.retender(dto());

      const args = counterSync.mock.calls[0][1] as {
        abl: unknown;
        partyId: string;
        voucherFor: (tdId: string) => unknown;
      };
      expect(args).toMatchObject({ abl: { ablId: ABL_ID, ablAccYear: ACC_YEAR }, partyId: CUST_ID });
      expect(args.voucherFor(NEW_ROW)).toEqual({ voucherId: CONTRA_VOUCHER, accYear: ACC_YEAR });
      expect(args.voucherFor(CASH_ROW)).toEqual({ voucherId: BILL_VOUCHER, accYear: ACC_YEAR });
      expect(recompute.recomputeBills).toHaveBeenCalledWith(tx, [
        { billId: ABL_ID, accYear: ACC_YEAR },
      ]);
    });

    it('names no voucher for a kept row of a bill that never stored one', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbPostedVoucherId: null }));

      await service.retender(dto());

      const args = counterSync.mock.calls[0][1] as { voucherFor: (tdId: string) => unknown };
      expect(args.voucherFor(CASH_ROW)).toBeNull();
    });

    it('skips the allocations when the bill has no receivable row', async () => {
      ablRows = [];

      await service.retender(dto());

      expect(counterSync).not.toHaveBeenCalled();
      expect(recompute.recomputeBills).not.toHaveBeenCalled();
    });

    it('rewrites the header caches from the live rows, as Decimals, by the login name', async () => {
      liveTotals = [{ tendered: new Prisma.Decimal('1000'), settled: new Prisma.Decimal('600') }];

      await service.retender(dto());

      expect(headerUpdate()).toMatchObject({
        sbTenderAmt: new Prisma.Decimal('1000.00'),
        sbPaidAmt: new Prisma.Decimal('600.00'),
        sbBalanceAmt: new Prisma.Decimal('400.00'),
        sbPayStatus: 'PARTIAL',
        sbModifiedBy: 'ravi',
      });
    });

    it('counts the set-offs as paid', async () => {
      bills.lockHeader.mockResolvedValue(
        billOf({
          sbAdvanceAmt: new Prisma.Decimal('300'),
          sbNoteAdjAmt: new Prisma.Decimal('100'),
        }),
      );
      liveTotals = [{ tendered: new Prisma.Decimal('600'), settled: new Prisma.Decimal('600') }];

      await service.retender(dto());

      expect(headerUpdate()).toMatchObject({
        sbPaidAmt: new Prisma.Decimal('1000.00'),
        sbBalanceAmt: new Prisma.Decimal('0.00'),
        sbPayStatus: 'PAID',
      });
    });

    it('reads a bill nothing settles as UNPAID', async () => {
      liveTotals = [{ tendered: null, settled: null }];

      await service.retender(dto());

      expect(headerUpdate()).toMatchObject({ sbPaidAmt: new Prisma.Decimal('0.00'), sbPayStatus: 'UNPAID' });
    });

    it('files RETENDERED, the till journal, the audit and the trial check', async () => {
      till.resolveForMoney.mockResolvedValue({ tssId: LIVE_SESSION });

      await service.retender(dto());

      expect(statusLog.mock.calls[0][1]).toMatchObject({
        srcDocId: BILL_ID,
        event: 'RETENDERED',
        fromStatus: 'POSTED',
        toStatus: 'POSTED',
        changedBy: USER_ID,
        remarks: 'UPI failed at the counter',
        sessionId: LIVE_SESSION,
      });
      expect(till.logMoneyDoc.mock.calls[0][1]).toMatchObject({
        sessionId: LIVE_SESSION,
        code: TillEventCode.RETENDER,
        srcDocType: 'SALE_BILL',
        srcDocId: BILL_ID,
        amount: new Prisma.Decimal('500'),
        payload: {
          billSessionId: BILL_SESSION,
          contraVoucherId: CONTRA_VOUCHER,
          voided: [{ tdId: UPI_ROW, amount: 500, tender: 'UPI' }],
          added: [{ tdId: NEW_ROW, amount: 500, tender: 'Cash' }],
        },
      });
      expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({
        action: 'update',
        tableName: 'acc_tender_detail',
        pk: BILL_ID,
        userId: USER_ID,
        notes: 'Re-tendered: UPI failed at the counter',
      });
      expect(booksCheck).toHaveBeenCalledWith(tx, {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [CUST_ID],
        vouchers: [{ voucherId: CONTRA_VOUCHER, accYear: ACC_YEAR }],
      });
      expect(bills.getById).toHaveBeenCalledWith(BILL_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
    });

    it('logs no till event when there is no session anywhere', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbSessionId: null }));

      await service.retender(dto());

      expect(till.logMoneyDoc).not.toHaveBeenCalled();
    });

    it('posts no contra for a bill with no customer', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbCustId: null }));

      await service.retender(dto());

      expect(legs.postLegs).not.toHaveBeenCalled();
      expect(booksCheck.mock.calls[0][1]).toMatchObject({ vouchers: [] });
    });
  });

  describe('what a voided row takes with it', () => {
    it('gives the points of a voided LOYALTY tender back', async () => {
      lockRows = [lockedRow({ td_tender_type_id: TENDER_TYPE.LOYALTY })];

      await service.retender(dto());

      expect(loyalty.reverseRedeemForTender).toHaveBeenCalledWith(
        tx,
        {
          docId: BILL_ID,
          accYear: ACC_YEAR,
          docType: 'SALE_BILL',
          docRefno: 'BIL/0042',
          tenderId: UPI_ROW,
        },
        { reason: 'Tender voided: UPI_FAILED', createdBy: USER_ID },
      );
    });

    it('cancels the temp credit of a voided TEMP_CR and logs each one’s own step', async () => {
      lockRows = [lockedRow({ td_tender_type_id: TENDER_TYPE.TEMP_CREDIT })];
      tx.accTempCredit.findMany.mockResolvedValue([
        {
          atcId: 'atc-1',
          atcStatus: 'OPEN',
          atcBalanceAmount: new Prisma.Decimal('500'),
          atcBillRefno: 'BIL/0042',
          atcTenantId: null,
        },
      ]);

      await service.retender(dto());

      expect(tx.accTempCredit.updateMany).toHaveBeenCalledWith({
        where: { atcTenderId: UPI_ROW, atcTenderAccYear: ACC_YEAR, atcIsDeleted: false },
        data: expect.objectContaining({
          atcStatus: 'CANCELLED',
          atcBalanceAmount: 0,
          atcRemarks: 'UPI failed at the counter',
          atcModifiedBy: USER_ID,
        }),
      });
      expect(creditStatus.mock.calls[0][1]).toMatchObject({
        credit: { atcId: 'atc-1', billRefno: 'BIL/0042' },
        event: 'CANCELLED',
        fromStatus: 'OPEN',
        toStatus: 'CANCELLED',
        remarks:
          'Tender voided: UPI_FAILED — UPI failed at the counter — balance 500.00 cleared',
      });
      expect(loyalty.reverseRedeemForTender).not.toHaveBeenCalled();
    });

    it('stamps no voided-by on a non-uuid actor', async () => {
      salesContext.resolve.mockResolvedValue({
        actor: 'system',
        actorName: 'system',
        rights: ctxRights,
      });

      await service.retender(dto());

      expect(executedValues(0)[2]).toBeNull();
      expect(executedValues(0)[4]).toBe('system');
    });
  });

  describe('a DRAFT bill', () => {
    beforeEach(() => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus: 'DRAFT', sbPostedVoucherId: null }));
    });

    it('swaps the tender rows and posts nothing', async () => {
      await service.retender(dto());

      expect(legs.postLegs).not.toHaveBeenCalled();
      expect(pdcSync).not.toHaveBeenCalled();
      expect(counterSync).not.toHaveBeenCalled();
      expect(statusLog.mock.calls[0][1]).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'DRAFT' });
      expect(booksCheck.mock.calls[0][1]).toMatchObject({ vouchers: [] });
    });

    it('keeps a new cheque’s details on the draft until /post', async () => {
      tenders.syncDocumentTenders.mockResolvedValue([
        tenderPayload({ tdId: CASH_ROW, tdRowNo: 1 }),
        tenderPayload({ tdId: UPI_ROW, tdRowNo: 2, tdTenderTypeId: TENDER_TYPE.UPI }),
        tenderPayload({ tdTenderTypeId: TENDER_TYPE.CHEQUE, tdRowNo: 3 }),
      ]);
      bills.lockHeader.mockResolvedValue(
        billOf({
          sbStatus: 'DRAFT',
          sbDraftCheques: { older: { drawerName: 'A', bankBranch: null, ifsc: null, micr: null } },
        }),
      );

      await service.retender(
        dto({
          tenders: [
            {
              tdTenderTypeId: TENDER_TYPE.CHEQUE,
              tdAmount: 500,
              cheque: { drawerName: 'Zeta Traders', ifsc: 'SBIN0000001' },
            },
          ],
        } as never),
      );

      expect(tx.saleBill.update.mock.calls[0][0]).toMatchObject({
        where: { sbId_sbAccYear: { sbId: BILL_ID, sbAccYear: ACC_YEAR } },
        data: {
          sbDraftCheques: {
            older: { drawerName: 'A', bankBranch: null, ifsc: null, micr: null },
            [NEW_ROW]: {
              drawerName: 'Zeta Traders',
              bankBranch: null,
              ifsc: 'SBIN0000001',
              micr: null,
            },
          },
        },
      });
      // The sync never sees `cheque`: it is not a column.
      const rows = tenders.syncDocumentTenders.mock.calls[0][2] as Record<string, unknown>[];
      expect(rows[2]).not.toHaveProperty('cheque');
    });
  });
});
