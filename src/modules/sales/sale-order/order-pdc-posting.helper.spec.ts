import { Prisma } from '@prisma/client';
import { cancelDocPdcRegister, syncDocPdcRegister } from '../posting/pdc-register.helper';
import {
  CHEQUE_TENDER_TYPE_ID,
  OrderPdcSource,
  OrderPdcTenderLine,
  cancelOrderPdcRegister,
  syncOrderPdcRegister,
} from './order-pdc-posting.helper';

// The register itself is the shared posting helper's (and another suite's); this
// file only maps an order onto it, so that mapping is what is pinned here.
jest.mock('../posting/pdc-register.helper', () => ({
  ...jest.requireActual<object>('../posting/pdc-register.helper'),
  syncDocPdcRegister: jest.fn(() => Promise.resolve(['apd-1'])),
  cancelDocPdcRegister: jest.fn(() => Promise.resolve(['apd-2'])),
}));

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a202';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a203';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46a204';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a205';
const SALESMAN_A = '019c6f6c-be87-7a11-8905-36092c46a206';
const SALESMAN_B = '019c6f6c-be87-7a11-8905-36092c46a207';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46a208';
const ACC_YEAR = '2026-2027';
const ORDER_DATE = new Date('2026-10-10T00:00:00.000Z');
const NOW = new Date('2026-10-19T06:00:00.000Z');

const order = (overrides: Partial<OrderPdcSource> = {}): OrderPdcSource => ({
  soId: ORDER_ID,
  soCompanyId: COMPANY_ID,
  soBranchId: BRANCH_ID,
  soTenantId: null,
  soAccYear: ACC_YEAR,
  soOrderRefno: 'sor00101',
  soOrderDate: ORDER_DATE,
  soCustId: CUST_ID,
  soCustName: 'Ravi Stores',
  soSalesmanId: [SALESMAN_A, SALESMAN_B],
  soUserId: USER_ID,
  ...overrides,
});

const TX = {} as Prisma.TransactionClient;

describe('order-pdc-posting.helper', () => {
  beforeEach(() => jest.clearAllMocks());

  it('re-exports the cheque tender type the register keys on', () => {
    expect(CHEQUE_TENDER_TYPE_ID).toBe(5);
  });

  describe('syncOrderPdcRegister', () => {
    it("hands the register the order as a SALES / SALES_ORDER document with the order's rules", async () => {
      const tenders = [{ tdId: 'td-1' }] as unknown as OrderPdcTenderLine[];
      const voucher = { voucherId: VOUCHER_ID, accYear: ACC_YEAR };

      await expect(
        syncOrderPdcRegister(TX, order(), tenders, voucher, 'cashier', NOW),
      ).resolves.toEqual(['apd-1']);

      expect(jest.mocked(syncDocPdcRegister)).toHaveBeenCalledWith(
        TX,
        {
          srcModule: 'SALES',
          srcDocType: 'SALES_ORDER',
          docId: ORDER_ID,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          tenantId: null,
          accYear: ACC_YEAR,
          refno: 'sor00101',
          docDate: ORDER_DATE,
          // Customer and ledger share a primary key.
          partyId: CUST_ID,
          partyName: 'Ravi Stores',
          // The register carries one salesman; the order's first one.
          salesmanId: SALESMAN_A,
          userId: USER_ID,
        },
        // An order refuses a cheque dated before it and does not check the window.
        { label: 'order', refuseBackdated: true, checkDateWindow: false },
        tenders,
        voucher,
        'cashier',
        NOW,
        { removedReason: 'Cheque no longer tendered on the sale order' },
      );
    });

    it('names no salesman when the order has none', async () => {
      await syncOrderPdcRegister(TX, order({ soSalesmanId: [] }), [], null, 'cashier', NOW);

      expect(jest.mocked(syncDocPdcRegister).mock.calls[0][1]).toMatchObject({
        salesmanId: null,
      });
    });
  });

  describe('cancelOrderPdcRegister', () => {
    const ref = { soId: ORDER_ID, soCompanyId: COMPANY_ID, soAccYear: ACC_YEAR };
    const doc = {
      srcModule: 'SALES',
      srcDocType: 'SALES_ORDER',
      docId: ORDER_ID,
      accYear: ACC_YEAR,
    };

    it('only cancels the instruments of an order that stopped holding money', async () => {
      await expect(
        cancelOrderPdcRegister(TX, ref, 'unposted', USER_ID, 'cashier', NOW),
      ).resolves.toEqual(['apd-2']);

      expect(jest.mocked(cancelDocPdcRegister)).toHaveBeenCalledWith(
        TX,
        doc,
        expect.objectContaining({ label: 'order' }),
        'Sale order no longer holds tendered money',
        false,
        USER_ID,
        'cashier',
        NOW,
      );
    });

    it('cancels and retires the instruments of a deleted order', async () => {
      await cancelOrderPdcRegister(TX, ref, 'deleted', null, 'cashier', NOW);

      expect(jest.mocked(cancelDocPdcRegister)).toHaveBeenCalledWith(
        TX,
        doc,
        expect.anything(),
        'Sale order deleted',
        true,
        null,
        'cashier',
        NOW,
      );
    });
  });
});
