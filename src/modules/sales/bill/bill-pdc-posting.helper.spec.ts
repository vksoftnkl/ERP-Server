import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertDocPdcHeld,
  cancelDocPdcRegister,
  syncDocPdcRegister,
  type PdcDocumentRules,
  type StoredPdcRow,
} from '../posting/pdc-register.helper';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import {
  assertBillPdcHeld,
  cancelBillPdcRegister,
  syncBillPdcRegister,
  type BillPdcSource,
} from './bill-pdc-posting.helper';

jest.mock('../posting/pdc-register.helper', () => ({
  ...jest.requireActual<object>('../posting/pdc-register.helper'),
  syncDocPdcRegister: jest.fn(),
  cancelDocPdcRegister: jest.fn(),
  assertDocPdcHeld: jest.fn(),
}));

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46b301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b303';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46b304';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b305';
const SALESMAN_ID = '019c6f6c-be87-7a11-8905-36092c46b306';
const CHEQUE_ROW = '019c6f6c-be87-7a11-8905-36092c46b307';
const OTHER_CHEQUE_ROW = '019c6f6c-be87-7a11-8905-36092c46b308';
const ACC_YEAR = '2026-2027';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const BILL_DATE = new Date('2026-10-19T00:00:00.000Z');

const billOf = (overrides: Partial<BillPdcSource> = {}): BillPdcSource => ({
  sbId: BILL_ID,
  sbCompanyId: COMPANY_ID,
  sbBranchId: BRANCH_ID,
  sbTenantId: null,
  sbAccYear: ACC_YEAR,
  sbBillRefno: 'BIL/0042',
  sbBillDate: BILL_DATE,
  sbCustId: CUST_ID,
  sbCustName: 'Zeta Traders',
  sbSalesmanId: [SALESMAN_ID],
  sbUserId: USER_ID,
  ...overrides,
});

const chequeRow = (td_id: string, td_row_no: number) => ({
  td_id,
  td_row_no,
  td_tender_type_id: 5,
  td_total_amt: '1500.00',
  td_ref_no: '000123',
  td_instrument_date: BILL_DATE,
  td_bank_name: 'SBI',
  td_settle_ledger_id: null,
  td_notes: null,
});

const syncMock = syncDocPdcRegister as jest.Mock;
const cancelMock = cancelDocPdcRegister as jest.Mock;
const assertMock = assertDocPdcHeld as jest.Mock;

describe('bill-pdc-posting.helper', () => {
  let queryRaw: jest.Mock;
  const tx = () => ({ $queryRaw: queryRaw }) as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw = jest.fn().mockResolvedValue([chequeRow(CHEQUE_ROW, 1)]);
    syncMock.mockResolvedValue(['apd-1']);
    cancelMock.mockResolvedValue(['apd-1']);
    assertMock.mockResolvedValue(undefined);
  });

  describe('syncBillPdcRegister', () => {
    it('registers nothing for a bill with no customer ledger', async () => {
      await expect(
        syncBillPdcRegister(tx(), billOf({ sbCustId: null }), { voucherId: 'v', accYear: ACC_YEAR }, 'u', NOW),
      ).resolves.toEqual([]);
      expect(queryRaw).not.toHaveBeenCalled();
      expect(syncMock).not.toHaveBeenCalled();
    });

    it("reads the bill's live cheque rows, voided ones left out", async () => {
      await syncBillPdcRegister(tx(), billOf(), { voucherId: 'v', accYear: ACC_YEAR }, 'u', NOW);

      const [strings, ...values] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      const sql = strings.join('?');
      expect(sql).toContain('td_is_voided = false');
      expect(sql).toContain('td_is_deleted = false');
      expect(values).toEqual(expect.arrayContaining(['SALES', 'SALE_BILL', BILL_ID, ACC_YEAR, 5]));
    });

    it('registers the cheques against the voucher, the party being the customer ledger', async () => {
      const voucher = { voucherId: 'voucher-1', accYear: ACC_YEAR };

      await expect(
        syncBillPdcRegister(tx(), billOf(), voucher, 'cashier', NOW, { keepStoredVoucher: true }),
      ).resolves.toEqual(['apd-1']);

      const [, doc, rules, tenders, passedVoucher, actor, now, opts] = syncMock.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        PdcDocumentRules,
        Record<string, unknown>[],
        unknown,
        string,
        Date,
        Record<string, unknown>,
      ];
      expect(doc).toEqual({
        srcModule: 'SALES',
        srcDocType: 'SALE_BILL',
        docId: BILL_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        tenantId: null,
        refno: 'BIL/0042',
        docDate: BILL_DATE,
        partyId: CUST_ID,
        partyName: 'Zeta Traders',
        salesmanId: SALESMAN_ID,
        userId: USER_ID,
      });
      expect(rules).toMatchObject({ label: 'bill', refuseBackdated: false, checkDateWindow: true });
      expect(tenders).toEqual([
        {
          tdId: CHEQUE_ROW,
          tdRowNo: 1,
          tdTenderTypeId: 5,
          tdTotalAmt: new Prisma.Decimal('1500.00'),
          tdRefNo: '000123',
          tdInstrumentDate: BILL_DATE,
          tdBankName: 'SBI',
          tdSettleLedgerId: null,
          tdNotes: null,
        },
      ]);
      expect(passedVoucher).toBe(voucher);
      expect(actor).toBe('cashier');
      expect(now).toBe(NOW);
      expect(opts).toEqual({
        keepStoredVoucher: true,
        removedReason: 'Cheque no longer tendered on the sale bill',
      });
    });

    it('puts the cheque details on the rows they name and leaves the others without', async () => {
      queryRaw.mockResolvedValue([chequeRow(CHEQUE_ROW, 1), chequeRow(OTHER_CHEQUE_ROW, 2)]);
      const detail = { drawerName: 'Ravi', bankBranch: null, ifsc: null, micr: null };

      await syncBillPdcRegister(tx(), billOf(), { voucherId: 'v', accYear: ACC_YEAR }, 'u', NOW, {
        details: { [CHEQUE_ROW]: detail },
      });

      const tenders = syncMock.mock.calls[0][3] as Record<string, unknown>[];
      expect(tenders[0].cheque).toEqual(detail);
      expect(tenders[1]).not.toHaveProperty('cheque');
    });

    it('falls back to the bill id for the refno and names no user or salesman it cannot', async () => {
      await syncBillPdcRegister(
        tx(),
        billOf({ sbBillRefno: null, sbUserId: 'raman', sbSalesmanId: [] }),
        { voucherId: 'v', accYear: ACC_YEAR },
        'u',
        NOW,
      );

      expect(syncMock.mock.calls[0][1]).toMatchObject({
        refno: BILL_ID,
        userId: null,
        salesmanId: null,
      });
    });
  });

  describe('cancelBillPdcRegister', () => {
    it("cancels the bill's cheques with the reason, by the user when the bill names one", async () => {
      await cancelBillPdcRegister(tx(), billOf(), 'customer returned goods', 'cashier', NOW);

      expect(cancelMock).toHaveBeenCalledWith(
        expect.anything(),
        { srcModule: 'SALES', srcDocType: 'SALE_BILL', docId: BILL_ID, accYear: ACC_YEAR },
        expect.objectContaining({ label: 'bill' }),
        'Sale bill cancelled: customer returned goods',
        false,
        USER_ID,
        'cashier',
        NOW,
      );
    });

    it('stamps no status user when the bill carries a login name instead of an id', async () => {
      await cancelBillPdcRegister(tx(), billOf({ sbUserId: 'raman' }), 'x', 'cashier', NOW);

      expect(cancelMock.mock.calls[0][5]).toBeNull();
    });
  });

  describe('assertBillPdcHeld', () => {
    it("asks the register about the bill's own cheques", async () => {
      await assertBillPdcHeld(tx(), billOf());

      expect(assertMock).toHaveBeenCalledWith(
        expect.anything(),
        { srcModule: 'SALES', srcDocType: 'SALE_BILL', docId: BILL_ID, accYear: ACC_YEAR },
        expect.objectContaining({ label: 'bill' }),
      );
    });

    it('words a moved cheque as a 409 SALES_BILL_PDC_MOVED on the tenders', async () => {
      await assertBillPdcHeld(tx(), billOf());
      const rules = assertMock.mock.calls[0][2] as PdcDocumentRules;
      const row: StoredPdcRow = {
        apdId: 'apd-1',
        apdAccYear: ACC_YEAR,
        apdTenderId: CHEQUE_ROW,
        apdInstrumentNo: '000123',
        apdStatus: 'DEPOSITED',
      };

      let caught: unknown;
      try {
        rules.onMoved!(row, 'removed');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpException);
      const error = caught as HttpException;
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errors: [
          {
            field: 'tenders',
            code: SALES_ERROR_CODES.BILL_PDC_MOVED,
            message: expect.stringContaining('Cheque 000123 on this bill is DEPOSITED') as string,
          },
        ],
      });
    });
  });
});
