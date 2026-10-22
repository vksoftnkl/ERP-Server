import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { coverPostedVoucher, retireMoneyLineRows } from '../../../common/posting/money-lines';
import {
  allocateVoucherNumber,
  allocateVoucherSlno,
} from '../../../common/Sequence/voucher-sequence.helper';
import { assertBooksReconcile } from '../../accountsModule/reconcile/books-reconcile.guard';
import { cancelOrderPdcRegister, syncOrderPdcRegister } from './order-pdc-posting.helper';
import {
  ORDER_ADVANCE_VCHR_TYPE_ID,
  OrderAdvancePostingSource,
  OrderAdvanceTenderLine,
  deleteOrderAdvancePosting,
  postOrderAdvanceToAccounts,
  readOrderAdvanceBalance,
  syncOrderAdvancePosting,
} from './order-advance-posting.helper';
import { SaleOrderErrorCode } from './types/sale-order-error-codes';

// Every collaborator that reads a table this mock does not model — the number
// series, the money-line cover, the books trial check and the cheque register —
// has its own tests. Here they only have to be asked for, in the right order.
jest.mock('../../../common/posting/money-lines', () => ({
  ...jest.requireActual<object>('../../../common/posting/money-lines'),
  coverPostedVoucher: jest.fn(() => Promise.resolve()),
  retireMoneyLineRows: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../common/Sequence/voucher-sequence.helper', () => ({
  ...jest.requireActual<object>('../../../common/Sequence/voucher-sequence.helper'),
  allocateVoucherNumber: jest.fn(() => Promise.resolve({ lastNo: 101n, refno: 'arc00101' })),
  allocateVoucherSlno: jest.fn(() => Promise.resolve(5501n)),
}));
jest.mock('../../accountsModule/reconcile/books-reconcile.guard', () => ({
  ...jest.requireActual<object>('../../accountsModule/reconcile/books-reconcile.guard'),
  assertBooksReconcile: jest.fn(() => Promise.resolve()),
}));
jest.mock('./order-pdc-posting.helper', () => ({
  ...jest.requireActual<object>('./order-pdc-posting.helper'),
  syncOrderPdcRegister: jest.fn(() => Promise.resolve([])),
  cancelOrderPdcRegister: jest.fn(() => Promise.resolve([])),
}));

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a401';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a402';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a403';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46a404';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a405';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46a406';
const ADVANCE_LEDGER = '019c6f6c-be87-7a11-8905-36092c46a407';
const CASH_LEDGER = '019c6f6c-be87-7a11-8905-36092c46a408';
const CARD_LEDGER = '019c6f6c-be87-7a11-8905-36092c46a409';
const SURCHARGE_LEDGER = '019c6f6c-be87-7a11-8905-36092c46a40a';
const MASTER_SURCHARGE_LEDGER = '019c6f6c-be87-7a11-8905-36092c46a40b';
const CASH_TENDER = '019c6f6c-be87-7a11-8905-36092c46a40c';
const CARD_TENDER = '019c6f6c-be87-7a11-8905-36092c46a40d';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46a40e';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46a40f';
const ACC_YEAR = '2026-2027';
const ORDER_DATE = new Date('2026-10-18T00:00:00.000Z');
const ORDER_DATETIME = new Date('2026-10-18T05:30:00.000Z');
const NOW = new Date('2026-10-19T06:00:00.000Z');
const D = (value: string | number) => new Prisma.Decimal(value);

const order = (overrides: Partial<OrderAdvancePostingSource> = {}): OrderAdvancePostingSource => ({
  soId: ORDER_ID,
  soCompanyId: COMPANY_ID,
  soBranchId: BRANCH_ID,
  soTenantId: null,
  soAccYear: ACC_YEAR,
  soOrderRefno: 'sor00101',
  soUsrRefno: null,
  soOrderDate: ORDER_DATE,
  soOrderDatetime: ORDER_DATETIME,
  soCustName: 'Ravi Stores',
  soOrderAmt: D('10000.00'),
  soRoundOff: D('0.00'),
  soCustId: CUST_ID,
  soAdvanceLedgerId: ADVANCE_LEDGER,
  soAdvanceRecdAmt: D(0),
  soAdvanceAdjustedAmt: D(0),
  soAdvanceRefundAmt: D(0),
  soAdvanceForfeitAmt: D(0),
  soSalesmanId: [],
  soAgentId: null,
  soUserId: USER_ID,
  soSessionId: null,
  soDeviceId: DEVICE_ID,
  soRemarks: null,
  soStatus: 'CONFIRMED',
  ...overrides,
});

const tender = (overrides: Partial<OrderAdvanceTenderLine> = {}): OrderAdvanceTenderLine => ({
  tdId: 'td-1',
  tdRowNo: 1,
  tdTenderId: CASH_TENDER,
  tdTenderTypeId: 1,
  tdTenderLedgerId: CASH_LEDGER,
  tdAmount: D('500.00'),
  tdSurchargeAmt: D('0.00'),
  tdSurchargeLedgerId: null,
  tdTotalAmt: D('500.00'),
  tdRefNo: null,
  tdNotes: null,
  tdInstrumentDate: null,
  tdBankName: null,
  tdSettleLedgerId: null,
  ...overrides,
});

const cardTender = (overrides: Partial<OrderAdvanceTenderLine> = {}) =>
  tender({
    tdId: 'td-2',
    tdRowNo: 2,
    tdTenderId: CARD_TENDER,
    tdTenderLedgerId: CARD_LEDGER,
    tdAmount: D('1000.00'),
    tdSurchargeAmt: D('20.00'),
    tdSurchargeLedgerId: SURCHARGE_LEDGER,
    tdTotalAmt: D('1020.00'),
    tdRefNo: 'RRN 4471',
    ...overrides,
  });

const LIVE = {
  avhVoucherId: VOUCHER_ID,
  avhAccYear: ACC_YEAR,
  avhVoucherNo: 77n,
  avhVoucherRefno: 'arc00077',
  avhVoucherDate: ORDER_DATETIME,
  avhPostedOn: new Date('2026-10-18T05:31:00.000Z'),
};

const STORED_BILL = {
  ablId: BILL_ID,
  ablAccYear: ACC_YEAR,
  ablDocRefno: 'sor00101',
  ablAllocAmount: D(0),
  ablDiscAmount: D(0),
  ablWriteoffAmount: D(0),
};

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

type TxMock = {
  accVoucherHeader: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  accVoucher: { create: jest.Mock; updateMany: jest.Mock };
  accTenderMaster: { findMany: jest.Mock };
  accTenderDetail: { updateMany: jest.Mock };
  accBillBalance: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    aggregate: jest.Mock;
  };
  accBillAdjustment: { count: jest.Mock };
};

describe('order-advance-posting.helper', () => {
  let tx: TxMock;
  // The header lookups differ only in the status they ask for: a live receipt
  // (not CANCELLED) or a cancelled one blocking a re-post.
  let liveVoucher: typeof LIVE | null;
  let cancelledVoucher: { avhVoucherId: string } | null;

  beforeEach(() => {
    jest.clearAllMocks();
    liveVoucher = null;
    cancelledVoucher = null;
    let lineNo = 0;
    tx = {
      accVoucherHeader: {
        create: jest.fn().mockResolvedValue({ avhVoucherId: VOUCHER_ID }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(({ where }: { where: { avhVoucherStatus: unknown } }) =>
          Promise.resolve(where.avhVoucherStatus === 'CANCELLED' ? cancelledVoucher : liveVoucher),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      accVoucher: {
        create: jest.fn(() => Promise.resolve({ avId: `av-${++lineNo}` })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      accTenderMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { tndId: CARD_TENDER, tndName: 'Card', tndSurchargeLedgerId: MASTER_SURCHARGE_LEDGER },
          ]),
      },
      accTenderDetail: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      accBillBalance: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ ablId: BILL_ID }),
        update: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn(),
      },
      accBillAdjustment: { count: jest.fn().mockResolvedValue(0) },
    };
  });

  const TX = () => tx as unknown as Prisma.TransactionClient;
  const lineData = (n: number) =>
    (tx.accVoucher.create.mock.calls[n][0] as { data: Record<string, unknown> }).data;
  const headerUpdates = () =>
    tx.accVoucherHeader.update.mock.calls.map(
      ([args]) => (args as { data: Record<string, unknown> }).data,
    );

  describe('postOrderAdvanceToAccounts', () => {
    it('numbers a receipt of its own type, born DRAFT and never told its totals', async () => {
      await postOrderAdvanceToAccounts(TX(), order(), [tender()], 'cashier', NOW);

      expect(jest.mocked(allocateVoucherNumber)).toHaveBeenCalledWith(TX(), {
        vchrTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
        documentDate: ORDER_DATE,
      });
      // The serial runs across every voucher type in the company and year.
      expect(jest.mocked(allocateVoucherSlno)).toHaveBeenCalledWith(TX(), COMPANY_ID, ACC_YEAR);
      const { data } = tx.accVoucherHeader.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({
        avhVoucherTypeId: 5,
        avhVoucherNo: 101n,
        avhVoucherSlno: 5501n,
        avhVoucherRefno: 'arc00101',
        avhVoucherDate: ORDER_DATETIME,
        avhSrcModule: 'SALES',
        avhSrcDocType: 'SALES_ORDER',
        avhSrcDocId: ORDER_ID,
        avhDocRefno: 'sor00101',
        avhDocAmount: D('10000.00'),
        avhPartyId: CUST_ID,
        avhOppositeLedgerId: ADVANCE_LEDGER,
        avhEmployeeId: [],
        avhVoucherStatus: 'DRAFT',
        avhCreatedBy: 'cashier',
      });
      // The totals are DERIVED by the trigger from the legs.
      expect(data).not.toHaveProperty('avhTotalDebit');
      expect(data).not.toHaveProperty('avhTotalCredit');
    });

    it('flips the header to POSTED only once every leg is in', async () => {
      await postOrderAdvanceToAccounts(TX(), order(), [tender(), cardTender()], 'cashier', NOW);

      expect(headerUpdates()).toEqual([
        {
          avhVoucherStatus: 'POSTED',
          avhStatusOn: NOW,
          avhStatusBy: USER_ID,
          avhPostedOn: NOW,
        },
      ]);
      const lastLeg = Math.max(...tx.accVoucher.create.mock.invocationCallOrder);
      expect(tx.accVoucherHeader.update.mock.invocationCallOrder[0]).toBeGreaterThan(lastLeg);
    });

    it('writes each tender as DR money, CR advance and CR surcharge, numbered across the voucher', async () => {
      const result = await postOrderAdvanceToAccounts(
        TX(),
        order(),
        // Out of row order on purpose: the voucher follows tdRowNo.
        [cardTender(), tender()],
        'cashier',
        NOW,
      );

      expect(tx.accVoucher.create).toHaveBeenCalledTimes(5);
      expect(lineData(0)).toMatchObject({
        avRowNo: 1,
        avDrCr: 'DR',
        avLedgerId: CASH_LEDGER,
        avOppLedgerId: ADVANCE_LEDGER,
        avAmount: D('500.00'),
        avRemarks: 'Advance against order sor00101',
      });
      expect(lineData(1)).toMatchObject({ avRowNo: 2, avDrCr: 'CR', avLedgerId: ADVANCE_LEDGER });
      expect(lineData(2)).toMatchObject({
        avRowNo: 3,
        avDrCr: 'DR',
        avLedgerId: CARD_LEDGER,
        avAmount: D('1020.00'),
        avRemarks: 'Advance against order sor00101 (RRN 4471)',
      });
      expect(lineData(3)).toMatchObject({ avRowNo: 4, avDrCr: 'CR', avAmount: D('1000.00') });
      // The line's own snapshot wins over the tender master's surcharge ledger.
      expect(lineData(4)).toMatchObject({
        avRowNo: 5,
        avDrCr: 'CR',
        avLedgerId: SURCHARGE_LEDGER,
        avOppLedgerId: CARD_LEDGER,
        avAmount: D('20.00'),
        avRemarks: 'Surcharge on Advance against order sor00101 (RRN 4471)',
      });
      expect(result).toMatchObject({
        voucherId: VOUCHER_ID,
        voucherRefno: 'arc00101',
        lineIds: ['av-1', 'av-2', 'av-3', 'av-4', 'av-5'],
        totalAmount: D('1520.00'),
        billId: BILL_ID,
      });
    });

    it('reads the surcharge ledger off the tender master when the line snapshotted none', async () => {
      await postOrderAdvanceToAccounts(
        TX(),
        order(),
        [cardTender({ tdSurchargeLedgerId: null })],
        'cashier',
        NOW,
      );

      expect(lineData(2)).toMatchObject({ avLedgerId: MASTER_SURCHARGE_LEDGER });
    });

    it('drops a zero-value tender rather than writing a zero leg', async () => {
      await postOrderAdvanceToAccounts(
        TX(),
        order(),
        [tender(), tender({ tdId: 'td-9', tdRowNo: 9, tdAmount: D(0), tdTotalAmt: D(0) })],
        'cashier',
        NOW,
      );

      expect(tx.accVoucher.create).toHaveBeenCalledTimes(2);
    });

    it("credits the customer's own ledger when the order names no advance ledger", async () => {
      await postOrderAdvanceToAccounts(
        TX(),
        order({ soAdvanceLedgerId: null }),
        [tender()],
        'c',
        NOW,
      );

      expect(lineData(1)).toMatchObject({ avDrCr: 'CR', avLedgerId: CUST_ID });
    });

    it('stamps the tenders, covers the money lines and registers any cheque', async () => {
      await postOrderAdvanceToAccounts(TX(), order(), [tender()], 'cashier', NOW);

      expect(tx.accTenderDetail.updateMany).toHaveBeenCalledWith({
        where: {
          tdSrcModule: 'SALES',
          tdSrcDocType: 'SALES_ORDER',
          tdSrcDocId: ORDER_ID,
          tdIsDeleted: false,
        },
        data: { tdVoucherId: VOUCHER_ID },
      });
      expect(jest.mocked(coverPostedVoucher)).toHaveBeenCalledWith(
        TX(),
        { voucherId: VOUCHER_ID, accYear: ACC_YEAR },
        { createdBy: 'cashier' },
      );
      expect(jest.mocked(syncOrderPdcRegister)).toHaveBeenCalledWith(
        TX(),
        expect.objectContaining({ soId: ORDER_ID }),
        [expect.objectContaining({ tdId: 'td-1' })],
        { voucherId: VOUCHER_ID, accYear: ACC_YEAR },
        'cashier',
        NOW,
      );
    });

    it('opens a CR ADVANCE outstanding worth the money held, without the surcharge', async () => {
      await postOrderAdvanceToAccounts(TX(), order(), [cardTender()], 'cashier', NOW);

      const { data } = tx.accBillBalance.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({
        ablPartyId: CUST_ID,
        ablBillType: 'ADVANCE',
        ablSrcModule: 'SALES',
        ablSrcDocType: 'SALES_ORDER',
        ablSrcDocId: ORDER_ID,
        ablSrcAccYear: ACC_YEAR,
        ablVoucherId: VOUCHER_ID,
        ablVoucherTypeId: 5,
        ablVoucherNo: 101n,
        ablDocRefno: 'sor00101',
        ablDrCr: 'CR',
        ablBillAmount: D('1000.00'),
        ablNarration: 'Advance received against order sor00101',
        ablAllocAmount: D(0),
      });
    });

    it("prefers the order's stated advance over the tenders", async () => {
      await postOrderAdvanceToAccounts(
        TX(),
        order({ soAdvanceRecdAmt: D('450.00') }),
        [tender()],
        'cashier',
        NOW,
      );

      expect(tx.accBillBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ablBillAmount: D('450.00') }) as object,
        }),
      );
    });

    it('seeds the allocation with what the roll-ups already used, never more than the bill', async () => {
      await postOrderAdvanceToAccounts(
        TX(),
        order({
          soAdvanceRecdAmt: D('500.00'),
          soAdvanceRefundAmt: D('300.00'),
          soAdvanceForfeitAmt: D('400.00'),
        }),
        [tender()],
        'cashier',
        NOW,
      );

      expect(tx.accBillBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ablAllocAmount: D('500.00') }) as object,
        }),
      );
    });

    it('opens no outstanding for a tender that was pure surcharge', async () => {
      const result = await postOrderAdvanceToAccounts(
        TX(),
        order(),
        [cardTender({ tdAmount: D(0), tdTotalAmt: D('20.00') })],
        'cashier',
        NOW,
      );

      // DR the card, CR the surcharge — and no CR to the advance ledger.
      expect(tx.accVoucher.create).toHaveBeenCalledTimes(2);
      expect(lineData(1)).toMatchObject({ avLedgerId: SURCHARGE_LEDGER });
      expect(tx.accBillBalance.create).not.toHaveBeenCalled();
      expect(result.billId).toBeNull();
    });

    it('refuses a surcharge no ledger will take, before writing anything', async () => {
      tx.accTenderMaster.findMany.mockResolvedValue([
        { tndId: CARD_TENDER, tndName: 'Card', tndSurchargeLedgerId: null },
      ]);

      const refusal = await refusalOf(
        postOrderAdvanceToAccounts(
          TX(),
          order(),
          [cardTender({ tdSurchargeLedgerId: null })],
          'cashier',
          NOW,
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'tenders', code: SaleOrderErrorCode.SURCHARGE_LEDGER_MISSING }],
        },
      });
      expect(JSON.stringify(refusal.body)).toContain('Tender line 2 (Card)');
      expect(tx.accVoucherHeader.create).not.toHaveBeenCalled();
      expect(jest.mocked(allocateVoucherNumber)).not.toHaveBeenCalled();
    });

    it.each([
      ['the advance ledger', tender({ tdTenderLedgerId: ADVANCE_LEDGER })],
      ['its own surcharge ledger', cardTender({ tdSurchargeLedgerId: CARD_LEDGER })],
    ])('refuses a tender paid into %s', async (_label, line) => {
      const refusal = await refusalOf(
        postOrderAdvanceToAccounts(TX(), order(), [line], 'cashier', NOW),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: SaleOrderErrorCode.TENDER_LEDGER_CLASH }] },
      });
      expect(tx.accVoucherHeader.create).not.toHaveBeenCalled();
    });
  });

  describe('syncOrderAdvancePosting', () => {
    it('does nothing for an order that took no money and had no receipt', async () => {
      await expect(syncOrderAdvancePosting(TX(), order(), [], 'cashier', NOW)).resolves.toEqual({
        action: 'unchanged',
        voucherId: null,
        billId: null,
        pdcIds: [],
        totalAmount: null,
        postedOn: null,
      });
      expect(jest.mocked(assertBooksReconcile)).not.toHaveBeenCalled();
    });

    it('posts a first receipt and runs the books check over the customer', async () => {
      const result = await syncOrderAdvancePosting(TX(), order(), [tender()], 'cashier', NOW);

      expect(result).toMatchObject({ action: 'created', voucherId: VOUCHER_ID, billId: BILL_ID });
      expect(jest.mocked(assertBooksReconcile)).toHaveBeenCalledWith(TX(), {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        ledgerIds: [CUST_ID],
        vouchers: [{ voucherId: VOUCHER_ID, accYear: ACC_YEAR }],
      });
    });

    it('refuses to post again an order whose receipt was cancelled before', async () => {
      cancelledVoucher = { avhVoucherId: VOUCHER_ID };

      const refusal = await refusalOf(
        syncOrderAdvancePosting(TX(), order(), [tender()], 'cashier', NOW),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: SaleOrderErrorCode.ADVANCE_RECEIPT_CANCELLED }] },
      });
      expect(tx.accVoucherHeader.create).not.toHaveBeenCalled();
    });

    describe('with a live receipt', () => {
      beforeEach(() => {
        liveVoucher = LIVE;
        tx.accBillBalance.findFirst.mockResolvedValue(STORED_BILL);
      });

      it('re-syncs it in place: same number, legs rebuilt, posted-on kept', async () => {
        const result = await syncOrderAdvancePosting(
          TX(),
          order(),
          [tender({ tdAmount: D('700.00'), tdTotalAmt: D('700.00') })],
          'cashier',
          NOW,
        );

        expect(result).toMatchObject({
          action: 'updated',
          voucherId: VOUCHER_ID,
          billId: BILL_ID,
          totalAmount: D('700.00'),
          postedOn: LIVE.avhPostedOn,
        });
        expect(tx.accVoucherHeader.create).not.toHaveBeenCalled();
        const [reopened, posted] = headerUpdates();
        expect(reopened).toMatchObject({ avhVoucherStatus: 'DRAFT', avhModifiedBy: 'cashier' });
        expect(reopened).not.toHaveProperty('avhTotalDebit');
        expect(posted).toEqual({
          avhVoucherStatus: 'POSTED',
          avhStatusOn: NOW,
          avhStatusBy: USER_ID,
        });
        // Old legs retired before the new ones are written from row 1.
        expect(tx.accVoucher.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
          tx.accVoucher.create.mock.invocationCallOrder[0],
        );
        expect(lineData(0)).toMatchObject({
          avRowNo: 1,
          avVoucherNo: 77n,
          avVoucherRefno: 'arc00077',
          avAmount: D('700.00'),
        });
        expect(jest.mocked(retireMoneyLineRows)).toHaveBeenCalledWith(TX(), VOUCHER_ID, 'cashier');
        expect(tx.accBillBalance.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { ablId_ablAccYear: { ablId: BILL_ID, ablAccYear: ACC_YEAR } },
            data: expect.objectContaining({
              ablBillAmount: D('700.00'),
              ablVoucherNo: 77n,
              ablAllocAmount: D(0),
            }) as object,
          }),
        );
      });

      it('gives the outstanding up when an edit leaves only surcharge on the receipt', async () => {
        const pureSurcharge = cardTender({
          tdAmount: D('0.00'),
          tdSurchargeAmt: D('20.00'),
          tdTotalAmt: D('20.00'),
        });

        const result = await syncOrderAdvancePosting(
          TX(),
          order(),
          [pureSurcharge],
          'cashier',
          NOW,
        );

        // The receipt stays (it still moved money); only the customer's credit goes.
        expect(result).toMatchObject({ action: 'updated', voucherId: VOUCHER_ID, billId: null });
        expect(tx.accBillAdjustment.count).toHaveBeenCalledWith({
          where: { abjBillId: BILL_ID, abjIsDeleted: false },
        });
        expect(tx.accBillBalance.update).toHaveBeenCalledWith({
          where: { ablId_ablAccYear: { ablId: BILL_ID, ablAccYear: ACC_YEAR } },
          data: {
            ablIsActive: false,
            ablIsDeleted: true,
            ablModifiedOn: NOW,
            ablModifiedBy: 'cashier',
          },
        });
        expect(tx.accBillBalance.create).not.toHaveBeenCalled();
      });

      it('refuses to drop an outstanding that an invoice has already drawn on', async () => {
        tx.accBillAdjustment.count.mockResolvedValue(1);
        const pureSurcharge = cardTender({
          tdAmount: D('0.00'),
          tdSurchargeAmt: D('20.00'),
          tdTotalAmt: D('20.00'),
        });

        const refusal = await refusalOf(
          syncOrderAdvancePosting(TX(), order(), [pureSurcharge], 'cashier', NOW),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'tenders', code: SaleOrderErrorCode.ADVANCE_SETTLED }] },
        });
        expect(tx.accBillBalance.update).not.toHaveBeenCalled();
      });

      it('leaves the allocation to the adjustments once one exists', async () => {
        tx.accBillAdjustment.count.mockResolvedValue(1);

        await syncOrderAdvancePosting(TX(), order(), [tender()], 'cashier', NOW);

        const { data } = tx.accBillBalance.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        };
        expect(data).not.toHaveProperty('ablAllocAmount');
      });

      it('refuses to cut the advance below what is already settled against it', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue({
          ...STORED_BILL,
          ablAllocAmount: D('400.00'),
          ablDiscAmount: D('50.00'),
        });

        const refusal = await refusalOf(
          syncOrderAdvancePosting(
            TX(),
            order(),
            [tender({ tdAmount: D('300.00'), tdTotalAmt: D('300.00') })],
            'cashier',
            NOW,
          ),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [{ field: 'soAdvanceRecdAmt', code: SaleOrderErrorCode.ADVANCE_SETTLED }],
          },
        });
        expect(JSON.stringify(refusal.body)).toContain('already has 450 settled');
        expect(tx.accBillBalance.update).not.toHaveBeenCalled();
      });

      it('cancels the receipt of a cancelled order and gives the outstanding up', async () => {
        tx.accBillBalance.findMany.mockResolvedValue([STORED_BILL]);

        const result = await syncOrderAdvancePosting(
          TX(),
          order({ soStatus: 'CANCELLED' }),
          [tender()],
          'cashier',
          NOW,
        );

        expect(result).toEqual({
          action: 'cancelled',
          voucherId: null,
          billId: null,
          pdcIds: [],
          totalAmount: null,
          postedOn: null,
        });
        expect(tx.accBillBalance.update).toHaveBeenCalledWith({
          where: { ablId_ablAccYear: { ablId: BILL_ID, ablAccYear: ACC_YEAR } },
          data: {
            ablIsActive: false,
            ablIsDeleted: true,
            ablModifiedOn: NOW,
            ablModifiedBy: 'cashier',
          },
        });
        expect(jest.mocked(cancelOrderPdcRegister)).toHaveBeenCalledWith(
          TX(),
          expect.objectContaining({ soId: ORDER_ID }),
          'unposted',
          USER_ID,
          'cashier',
          NOW,
        );
        expect(headerUpdates()).toEqual([
          {
            avhVoucherStatus: 'CANCELLED',
            avhCancelReason: 'Sale order no longer holds tendered money',
            avhStatusOn: NOW,
            avhStatusBy: USER_ID,
            avhModifiedOn: NOW,
            avhModifiedBy: 'cashier',
          },
        ]);
        expect(tx.accTenderDetail.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ data: { tdVoucherId: null } }),
        );
        // The books are checked against the voucher just cancelled.
        expect(jest.mocked(assertBooksReconcile)).toHaveBeenCalledWith(
          TX(),
          expect.objectContaining({ vouchers: [{ voucherId: VOUCHER_ID, accYear: ACC_YEAR }] }),
        );
      });

      it('refuses to cancel a receipt whose advance was settled, touching nothing', async () => {
        tx.accBillBalance.findMany.mockResolvedValue([STORED_BILL]);
        tx.accBillAdjustment.count.mockResolvedValue(1);

        const refusal = await refusalOf(syncOrderAdvancePosting(TX(), order(), [], 'cashier', NOW));

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'tenders', code: SaleOrderErrorCode.ADVANCE_SETTLED }] },
        });
        expect(tx.accVoucherHeader.update).not.toHaveBeenCalled();
        expect(jest.mocked(cancelOrderPdcRegister)).not.toHaveBeenCalled();
      });
    });
  });

  describe('deleteOrderAdvancePosting', () => {
    const REF = { soId: ORDER_ID, soCompanyId: COMPANY_ID, soAccYear: ACC_YEAR };

    it('retires the receipt, its legs, the outstanding and the cheques', async () => {
      tx.accVoucherHeader.findMany.mockResolvedValue([
        { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
      ]);
      tx.accBillBalance.findMany.mockResolvedValue([STORED_BILL]);
      jest.mocked(cancelOrderPdcRegister).mockResolvedValueOnce(['apd-1']);

      await expect(deleteOrderAdvancePosting(TX(), REF, 'cashier', NOW)).resolves.toEqual({
        voucherIds: [VOUCHER_ID],
        billIds: [BILL_ID],
        pdcIds: ['apd-1'],
      });
      expect(jest.mocked(cancelOrderPdcRegister)).toHaveBeenCalledWith(
        TX(),
        REF,
        'deleted',
        null,
        'cashier',
        NOW,
      );
      expect(tx.accVoucher.updateMany).toHaveBeenCalledWith({
        where: { avVoucherId: VOUCHER_ID, avAccYear: ACC_YEAR, avIsDeleted: false },
        data: { avIsActive: false, avIsDeleted: true, avModifiedOn: NOW, avModifiedBy: 'cashier' },
      });
      expect(headerUpdates()).toEqual([
        {
          avhVoucherStatus: 'CANCELLED',
          avhCancelReason: 'Sale order deleted',
          avhStatusOn: NOW,
          avhStatusBy: 'cashier',
          avhIsActive: false,
          avhIsDeleted: true,
          avhModifiedOn: NOW,
          avhModifiedBy: 'cashier',
        },
      ]);
      expect(jest.mocked(assertBooksReconcile)).toHaveBeenCalledWith(TX(), {
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        vouchers: [{ voucherId: VOUCHER_ID, accYear: ACC_YEAR }],
      });
    });

    it('skips the books check for an order that never took money', async () => {
      await expect(deleteOrderAdvancePosting(TX(), REF, 'cashier', NOW)).resolves.toEqual({
        voucherIds: [],
        billIds: [],
        pdcIds: [],
      });
      expect(jest.mocked(assertBooksReconcile)).not.toHaveBeenCalled();
    });

    it('refuses an advance with a discount or write-off against it', async () => {
      tx.accBillBalance.findMany.mockResolvedValue([
        { ...STORED_BILL, ablWriteoffAmount: D('10.00') },
      ]);

      const refusal = await refusalOf(deleteOrderAdvancePosting(TX(), REF, 'cashier', NOW));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: SaleOrderErrorCode.ADVANCE_SETTLED }] },
      });
      expect(tx.accVoucherHeader.update).not.toHaveBeenCalled();
    });
  });

  describe('readOrderAdvanceBalance', () => {
    it('answers null for an order with no ADVANCE row', async () => {
      tx.accBillBalance.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _sum: { ablBillAmount: null, ablPendingAmount: null },
      });

      await expect(readOrderAdvanceBalance(TX(), { soId: ORDER_ID })).resolves.toBeNull();
      expect(tx.accBillBalance.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ablSrcModule: 'SALES',
            ablSrcDocType: 'SALES_ORDER',
            ablSrcDocId: ORDER_ID,
            ablBillType: 'ADVANCE',
            ablIsDeleted: false,
          },
        }),
      );
    });

    it('sums the face and what is still pending as decimals', async () => {
      tx.accBillBalance.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _sum: { ablBillAmount: D('1000.00'), ablPendingAmount: D('250.50') },
      });

      await expect(readOrderAdvanceBalance(TX(), { soId: ORDER_ID })).resolves.toEqual({
        billAmount: D('1000.00'),
        pendingAmount: D('250.50'),
      });
    });
  });
});
