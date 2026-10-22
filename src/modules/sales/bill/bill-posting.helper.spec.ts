import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { allocateVoucherSlno } from '../../../common/Sequence/voucher-sequence.helper';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import {
  deleteBillPosting,
  postBillToAccounts,
  syncBillPosting,
  type BillPostingSource,
} from './bill-posting.helper';
import { SaleBillErrorCode } from './types/sale-bill-error-codes';

jest.mock('../../../common/Sequence/voucher-sequence.helper', () => ({
  allocateVoucherSlno: jest.fn(),
}));

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46c301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46c302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46c303';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46c304';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46c305';
const SALESMAN_ID = '019c6f6c-be87-7a11-8905-36092c46c306';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46c307';
const ABL_ID = '019c6f6c-be87-7a11-8905-36092c46c308';
const ACTOR = '019c6f6c-be87-7a11-8905-36092c46c309';
const ACC_YEAR = '2026-2027';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const BILL_DATE = new Date('2026-10-19T00:00:00.000Z');
const BILL_DATETIME = new Date('2026-10-19T05:30:00.000Z');

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

const dec = (v: string | number) => new Prisma.Decimal(v);

const billOf = (overrides: Partial<BillPostingSource> = {}): BillPostingSource => ({
  sbId: BILL_ID,
  sbCompanyId: COMPANY_ID,
  sbAccYear: ACC_YEAR,
  sbBranchId: BRANCH_ID,
  sbTenantId: null,
  sbBillSlno: 42n,
  sbBillRefno: 'BIL/0042',
  sbUsrRefno: 'PO-7',
  sbBillDate: BILL_DATE,
  sbBillDatetime: BILL_DATETIME,
  sbDueDate: null,
  sbDueDays: 15,
  sbCustId: CUST_ID,
  sbUserId: USER_ID,
  sbSessionId: null,
  sbDeviceType: 'Desktop',
  sbDeviceId: 'raman',
  sbSalesmanId: [SALESMAN_ID],
  sbAgentId: null,
  sbBillAmt: dec('1180.00'),
  sbRoundOff: dec('0.20'),
  sbPaidAmt: dec('500.00'),
  sbRemarks: 'counter sale',
  sbStatus: 'POSTED',
  ...overrides,
});

const receivable = (overrides: object = {}) => ({
  ablId: ABL_ID,
  ablAccYear: ACC_YEAR,
  ablDocRefno: 'BIL/0042',
  ablAllocAmount: dec(0),
  ablDiscAmount: dec(0),
  ablWriteoffAmount: dec(0),
  ...overrides,
});

const allocate = allocateVoucherSlno as jest.Mock;

describe('bill-posting.helper', () => {
  let tx: {
    accVoucherHeader: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    accBillBalance: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    accBillAdjustment: { count: jest.Mock };
    accVoucher: { updateMany: jest.Mock };
  };
  const client = () => tx as unknown as Prisma.TransactionClient;
  const headerData = () =>
    (tx.accVoucherHeader.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const receivableData = () =>
    (tx.accBillBalance.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  beforeEach(() => {
    jest.clearAllMocks();
    allocate.mockResolvedValue(9001n);
    tx = {
      accVoucherHeader: {
        create: jest.fn().mockResolvedValue({ avhVoucherId: VOUCHER_ID }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      accBillBalance: {
        create: jest.fn().mockResolvedValue({ ablId: ABL_ID }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      accBillAdjustment: { count: jest.fn().mockResolvedValue(0) },
      accVoucher: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
  });

  describe('postBillToAccounts', () => {
    it.each([
      ['no bill number', { sbBillSlno: null }],
      ['no refno', { sbBillRefno: '' }],
    ])('refuses a bill with %s before taking a voucher serial', async (_case, overrides) => {
      const refusal = await refusalOf(
        postBillToAccounts(client(), billOf(overrides), 3, ACTOR, NOW),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbStatus', code: SaleBillErrorCode.NUMBER_MISSING }] },
      });
      expect(allocate).not.toHaveBeenCalled();
    });

    it('refuses a walk-in bill with no customer ledger', async () => {
      const refusal = await refusalOf(
        postBillToAccounts(client(), billOf({ sbCustId: null }), 3, ACTOR, NOW),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbCustId', code: SALES_ERROR_CODES.CUSTOMER_REQUIRED }] },
      });
      expect(tx.accVoucherHeader.create).not.toHaveBeenCalled();
    });

    it('raises the voucher under the bill’s own number and its receivable', async () => {
      const result = await postBillToAccounts(client(), billOf(), 3, ACTOR, NOW);

      expect(allocate).toHaveBeenCalledWith(tx, COMPANY_ID, ACC_YEAR);
      expect(headerData()).toMatchObject({
        avhCompanyId: COMPANY_ID,
        avhAccYear: ACC_YEAR,
        avhVoucherTypeId: 3,
        avhVoucherNo: 42n,
        avhVoucherSlno: 9001n,
        avhVoucherRefno: 'BIL/0042',
        avhVoucherDate: BILL_DATETIME,
        avhSrcModule: 'SALES',
        avhSrcDocType: 'BILL',
        avhSrcDocId: BILL_ID,
        avhUsrRefno: 'PO-7',
        avhDocAmount: dec('1180.00'),
        avhPartyId: CUST_ID,
        avhOppositeLedgerId: null,
        avhEmployeeId: [SALESMAN_ID],
        avhVoucherStatus: 'POSTED',
        avhStatusOn: NOW,
        avhStatusBy: USER_ID,
        avhPostedOn: NOW,
        avhDeviceType: 'DESKTOP',
        avhCreatedBy: ACTOR,
      });
      expect(receivableData()).toMatchObject({
        ablPartyId: CUST_ID,
        ablSalesmanId: SALESMAN_ID,
        ablBillType: 'SALES',
        ablSrcModule: 'SALES',
        ablSrcDocType: 'BILL',
        ablSrcDocId: BILL_ID,
        ablVoucherId: VOUCHER_ID,
        ablVoucherNo: 42n,
        ablDocRefno: 'BIL/0042',
        ablCreditDays: 15,
        ablDrCr: 'DR',
        ablBillAmount: dec('1180.00'),
        ablAllocAmount: dec('500.00'),
      });
      expect(result).toEqual({ voucherId: VOUCHER_ID, billId: ABL_ID, postedOn: NOW });
    });

    it('caps the seeded allocation at the bill — an overpayment stays on the tender', async () => {
      await postBillToAccounts(client(), billOf({ sbPaidAmt: dec('1500') }), 3, ACTOR, NOW);

      expect(receivableData().ablAllocAmount).toEqual(dec('1180.00'));
    });

    it('raises no receivable for a zero-value bill', async () => {
      const result = await postBillToAccounts(
        client(),
        billOf({ sbBillAmt: dec(0) }),
        3,
        ACTOR,
        NOW,
      );

      expect(tx.accBillBalance.create).not.toHaveBeenCalled();
      expect(result.billId).toBeNull();
    });

    it.each([
      ['web', 'WEB'],
      [' Mobile ', 'MOBILE'],
      ['POS', null],
      ['', null],
      [null, null],
    ])('maps device type %p to %p', async (deviceType, expected) => {
      await postBillToAccounts(client(), billOf({ sbDeviceType: deviceType }), 3, ACTOR, NOW);

      expect(headerData().avhDeviceType).toBe(expected);
    });

    it('defaults a missing salesman list and round-off rather than writing null', async () => {
      await postBillToAccounts(
        client(),
        billOf({ sbSalesmanId: null as unknown as string[], sbRoundOff: null }),
        3,
        ACTOR,
        NOW,
      );

      expect(headerData()).toMatchObject({ avhEmployeeId: [], avhRoundOff: 0 });
      expect(receivableData().ablSalesmanId).toBeNull();
    });
  });

  describe('syncBillPosting', () => {
    const live = { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR, avhPostedOn: NOW };

    it('posts a newly POSTED bill', async () => {
      const result = await syncBillPosting(client(), billOf(), 3, ACTOR, NOW);

      expect(result).toEqual({
        action: 'created',
        voucherId: VOUCHER_ID,
        billId: ABL_ID,
        postedOn: NOW,
      });
    });

    it('refuses to re-post a bill whose voucher was cancelled', async () => {
      tx.accVoucherHeader.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ avhVoucherId: VOUCHER_ID });

      const refusal = await refusalOf(syncBillPosting(client(), billOf(), 3, ACTOR, NOW));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbStatus', code: SaleBillErrorCode.CANCELLED_IN_ACCOUNTS }] },
      });
      expect(tx.accVoucherHeader.create).not.toHaveBeenCalled();
    });

    it('leaves a bill that is neither posted nor was', async () => {
      await expect(
        syncBillPosting(client(), billOf({ sbStatus: 'DRAFT' }), 3, ACTOR, NOW),
      ).resolves.toEqual({ action: 'unchanged', voucherId: null, billId: null, postedOn: null });
      expect(tx.accVoucherHeader.update).not.toHaveBeenCalled();
    });

    describe('an already-posted bill', () => {
      beforeEach(() => {
        tx.accVoucherHeader.findFirst.mockResolvedValue(live);
      });

      it('restates what can still change and keeps the voucher’s identity', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable());

        const result = await syncBillPosting(client(), billOf(), 3, ACTOR, NOW);

        const update = tx.accVoucherHeader.update.mock.calls[0][0] as {
          where: unknown;
          data: Record<string, unknown>;
        };
        expect(update.where).toEqual({
          avhVoucherId_avhAccYear: { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
        });
        expect(update.data).toMatchObject({
          avhDocAmount: dec('1180.00'),
          avhPartyId: CUST_ID,
          avhModifiedOn: NOW,
          avhModifiedBy: ACTOR,
        });
        expect(update.data).not.toHaveProperty('avhVoucherNo');
        expect(update.data).not.toHaveProperty('avhVoucherRefno');
        expect(update.data).not.toHaveProperty('avhPostedOn');
        expect(result).toEqual({ action: 'updated', voucherId: VOUCHER_ID, billId: ABL_ID, postedOn: NOW });
      });

      it('moves the seeded allocation with the tender while nothing is adjusted', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable());

        await syncBillPosting(client(), billOf({ sbPaidAmt: dec('800') }), 3, ACTOR, NOW);

        expect(tx.accBillBalance.update.mock.calls[0][0]).toMatchObject({
          where: { ablId_ablAccYear: { ablId: ABL_ID, ablAccYear: ACC_YEAR } },
          data: { ablBillAmount: dec('1180.00'), ablAllocAmount: dec('800') },
        });
        expect(tx.accBillAdjustment.count).toHaveBeenCalledWith({
          where: { abjBillId: ABL_ID, abjIsDeleted: false },
        });
      });

      it('leaves the allocation to the adjustment rows once any exist', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable({ ablAllocAmount: dec('300') }));
        tx.accBillAdjustment.count.mockResolvedValue(1);

        await syncBillPosting(client(), billOf(), 3, ACTOR, NOW);

        const data = (tx.accBillBalance.update.mock.calls[0][0] as { data: object }).data;
        expect(data).not.toHaveProperty('ablAllocAmount');
      });

      it('refuses an amount below what is already settled', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(
          receivable({
            ablAllocAmount: dec('600'),
            ablDiscAmount: dec('50'),
            ablWriteoffAmount: dec('10'),
          }),
        );

        const refusal = await refusalOf(
          syncBillPosting(client(), billOf({ sbBillAmt: dec('650') }), 3, ACTOR, NOW),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [{ field: 'sbBillAmt', code: SaleBillErrorCode.AMOUNT_BELOW_SETTLED }],
          },
        });
        expect(tx.accBillBalance.update).not.toHaveBeenCalled();
      });

      it('gives up the receivable of a bill edited down to nothing', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable());

        const result = await syncBillPosting(
          client(),
          billOf({ sbBillAmt: dec(0) }),
          3,
          ACTOR,
          NOW,
        );

        expect(tx.accBillBalance.update).toHaveBeenCalledWith({
          where: { ablId_ablAccYear: { ablId: ABL_ID, ablAccYear: ACC_YEAR } },
          data: { ablIsActive: false, ablIsDeleted: true, ablModifiedOn: NOW, ablModifiedBy: ACTOR },
        });
        expect(result.billId).toBeNull();
      });

      it('refuses to drop a receivable something was settled against', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable({ ablAllocAmount: dec('1') }));

        const refusal = await refusalOf(
          syncBillPosting(client(), billOf({ sbBillAmt: dec(0) }), 3, ACTOR, NOW),
        );

        expect(refusal.body).toMatchObject({
          errors: [{ code: SaleBillErrorCode.AMOUNT_BELOW_SETTLED }],
        });
      });

      it('raises the receivable a bill edited up from zero never had', async () => {
        const result = await syncBillPosting(
          client(),
          billOf({ sbPaidAmt: dec('2000') }),
          3,
          ACTOR,
          NOW,
        );

        expect(receivableData()).toMatchObject({
          ablVoucherId: VOUCHER_ID,
          ablVoucherNo: 42n,
          ablBillAmount: dec('1180.00'),
          ablAllocAmount: dec('1180.00'),
          ablCreatedBy: ACTOR,
        });
        expect(result.billId).toBe(ABL_ID);
      });

      it('refuses to raise that receivable without a bill number', async () => {
        const refusal = await refusalOf(
          syncBillPosting(client(), billOf({ sbBillSlno: null }), 3, ACTOR, NOW),
        );

        expect(refusal.body).toMatchObject({
          errors: [{ code: SaleBillErrorCode.NUMBER_MISSING }],
        });
      });

      it('refuses a customer removed from a posted bill', async () => {
        const refusal = await refusalOf(
          syncBillPosting(client(), billOf({ sbCustId: null }), 3, ACTOR, NOW),
        );

        expect(refusal.body).toMatchObject({
          errors: [{ field: 'sbCustId', code: SALES_ERROR_CODES.CUSTOMER_REQUIRED }],
        });
      });
    });

    describe('a bill that left POSTED', () => {
      beforeEach(() => {
        tx.accVoucherHeader.findFirst.mockResolvedValue(live);
      });

      it('retires the receivable and cancels the voucher with the operator’s reason', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable());

        const result = await syncBillPosting(
          client(),
          billOf({ sbStatus: 'DRAFT' }),
          3,
          ACTOR,
          NOW,
          'wrong customer',
        );

        expect(tx.accBillBalance.update.mock.calls[0][0]).toMatchObject({
          data: { ablIsDeleted: true },
        });
        expect(tx.accVoucherHeader.update).toHaveBeenCalledWith({
          where: { avhVoucherId_avhAccYear: { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR } },
          data: {
            avhVoucherStatus: 'CANCELLED',
            avhCancelReason: 'wrong customer',
            avhStatusOn: NOW,
            avhStatusBy: USER_ID,
            avhModifiedOn: NOW,
            avhModifiedBy: ACTOR,
          },
        });
        expect(result).toEqual({ action: 'cancelled', voucherId: null, billId: null, postedOn: null });
      });

      it('falls back to a default reason and cuts a long one at 250', async () => {
        await syncBillPosting(client(), billOf({ sbStatus: 'DRAFT' }), 3, ACTOR, NOW);
        await syncBillPosting(client(), billOf({ sbStatus: 'DRAFT' }), 3, ACTOR, NOW, 'x'.repeat(300));

        const reasons = tx.accVoucherHeader.update.mock.calls.map(
          (c) => (c[0] as { data: { avhCancelReason: string } }).data.avhCancelReason,
        );
        expect(reasons[0]).toBe('Sale bill is no longer posted');
        expect(reasons[1]).toHaveLength(250);
      });

      it('refuses to unpost a bill money was allocated against', async () => {
        tx.accBillBalance.findFirst.mockResolvedValue(receivable({ ablAllocAmount: dec('100') }));

        const refusal = await refusalOf(
          syncBillPosting(client(), billOf({ sbStatus: 'CANCELLED' }), 3, ACTOR, NOW),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ code: SaleBillErrorCode.AMOUNT_BELOW_SETTLED }] },
        });
        expect(tx.accVoucherHeader.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('deleteBillPosting', () => {
    const ref = { sbId: BILL_ID, sbCompanyId: COMPANY_ID, sbAccYear: ACC_YEAR };

    it('takes nothing out for a bill never posted', async () => {
      await expect(deleteBillPosting(client(), ref, ACTOR, NOW)).resolves.toEqual({
        voucherIds: [],
        billIds: [],
      });
      expect(tx.accVoucherHeader.findMany).toHaveBeenCalledWith({
        where: {
          avhCompanyId: COMPANY_ID,
          avhAccYear: ACC_YEAR,
          avhSrcModule: 'SALES',
          avhSrcDocType: 'BILL',
          avhSrcDocId: BILL_ID,
          avhIsDeleted: false,
        },
        select: { avhVoucherId: true, avhAccYear: true },
      });
    });

    it('deletes the receivable, the ledger lines and the header (cancelled and deleted)', async () => {
      tx.accVoucherHeader.findMany.mockResolvedValue([
        { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
      ]);
      // A counter payment seeded into alloc does not block the delete.
      tx.accBillBalance.findMany.mockResolvedValue([receivable({ ablAllocAmount: dec('500') })]);

      const result = await deleteBillPosting(client(), ref, ACTOR, NOW);

      expect(tx.accBillBalance.update.mock.calls[0][0]).toMatchObject({
        data: { ablIsDeleted: true, ablIsActive: false },
      });
      expect(tx.accVoucher.updateMany).toHaveBeenCalledWith({
        where: { avVoucherId: VOUCHER_ID, avAccYear: ACC_YEAR, avIsDeleted: false },
        data: { avIsActive: false, avIsDeleted: true, avModifiedOn: NOW, avModifiedBy: ACTOR },
      });
      expect(tx.accVoucherHeader.update.mock.calls[0][0]).toMatchObject({
        data: {
          avhVoucherStatus: 'CANCELLED',
          avhCancelReason: 'Sale bill deleted',
          avhStatusBy: ACTOR,
          avhIsActive: false,
          avhIsDeleted: true,
        },
      });
      expect(result).toEqual({ voucherIds: [VOUCHER_ID], billIds: [ABL_ID] });
    });

    it.each([
      ['a discount', { ablDiscAmount: dec('20') }],
      ['a write-off', { ablWriteoffAmount: dec('5') }],
    ])('refuses a bill with %s settled against it', async (_case, overrides) => {
      tx.accVoucherHeader.findMany.mockResolvedValue([
        { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
      ]);
      tx.accBillBalance.findMany.mockResolvedValue([receivable(overrides)]);

      const refusal = await refusalOf(deleteBillPosting(client(), ref, ACTOR, NOW));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sbId', code: SaleBillErrorCode.SETTLED_IN_ACCOUNTS }] },
      });
      expect(tx.accVoucherHeader.update).not.toHaveBeenCalled();
    });
  });
});
