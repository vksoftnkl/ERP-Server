import { HttpException } from '@nestjs/common';
import { Prisma, SaleBill } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { loadDayClosed } from '../posting/sales.guards';
import { TENDER_TYPE } from '../posting/sales-doc.utils';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { BillReadService } from './bill-read.service';
import type { BillPayload } from './types/bill-api.types';
import { SaleBillErrorCode } from './types/sale-bill-error-codes';

jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<object>('../posting/sales.guards'),
  loadDayClosed: jest.fn(),
}));

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46b701';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b702';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b703';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46b704';
const WALK_IN_ID = '019c6f6c-be87-7a11-8905-36092c46b705';
const MEMBER_ID = '019c6f6c-be87-7a11-8905-36092c46b706';
const ACC_YEAR = '2026-2027';
const KEYS = { sbId: BILL_ID, sbCompanyId: COMPANY_ID, sbBranchId: BRANCH_ID, sbAccYear: ACC_YEAR };
const DAY = 86_400_000;

const dateDaysAgo = (n: number) => new Date(Date.now() - n * DAY);
const isoDaysAgo = (n: number) => dateDaysAgo(n).toISOString().slice(0, 10);

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

const dayClosed = loadDayClosed as jest.Mock;

describe('BillReadService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    saleBill: { findFirst: jest.Mock };
    accTempCredit: { findMany: jest.Mock };
  };
  let salesContext: { settings: jest.Mock; rights: jest.Mock };
  let docBlocks: { build: jest.Mock };
  let transportBand: { read: jest.Mock };
  let statutory: { limit: jest.Mock };
  let loyalty: { preview: jest.Mock };
  let service: BillReadService;

  beforeEach(() => {
    jest.clearAllMocks();
    dayClosed.mockResolvedValue(false);
    prisma = {
      $queryRaw: routedRaw([]),
      saleBill: { findFirst: jest.fn().mockResolvedValue(null) },
      accTempCredit: { findMany: jest.fn().mockResolvedValue([]) },
    };
    salesContext = {
      settings: jest
        .fn()
        .mockResolvedValue({ defaultCustomerId: WALK_IN_ID, creditLimitMode: 'WARN' }),
      rights: jest.fn().mockResolvedValue({ view: true }),
    };
    docBlocks = { build: jest.fn().mockResolvedValue({ posting: { p: 1 }, locks: { l: 1 } }) };
    transportBand = { read: jest.fn().mockResolvedValue(null) };
    statutory = { limit: jest.fn().mockResolvedValue({ value: 30 }) };
    loyalty = { preview: jest.fn() };
    service = new BillReadService(
      prisma as unknown as PrismaService,
      salesContext as never,
      docBlocks as never,
      transportBand as never,
      statutory as never,
      loyalty as never,
    );
  });

  describe('tenderContext', () => {
    const header = (sbStatus = 'POSTED') => ({
      sbBillRefno: 'BIL/0042',
      sbBillDate: new Date('2026-10-19T00:00:00.000Z'),
      sbCustName: 'Zeta Traders',
      sbBillAmt: new Prisma.Decimal('1180.00'),
      sbPaidAmt: new Prisma.Decimal('1180.00'),
      sbBalanceAmt: new Prisma.Decimal('0'),
      sbStatus,
      sbCompanyId: COMPANY_ID,
      sbBranchId: BRANCH_ID,
    });
    const tenderRow = (overrides: object) => ({
      td_id: 'td',
      tnd_name: 'Cash',
      td_tender_id: 'tender',
      td_tender_type_id: TENDER_TYPE.CASH,
      td_amount: new Prisma.Decimal('100'),
      td_is_pdc: false,
      td_settle_status: null,
      td_is_voided: false,
      td_replaces_id: null,
      apd_status: null,
      ...overrides,
    });

    it('refuses a bill that is not there', async () => {
      const refusal = await refusalOf(service.tenderContext(KEYS));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sbId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
    });

    it('lists every tender row with what the dialog needs to know about it', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(header());
      prisma.$queryRaw = routedRaw([
        [
          'FROM accounts.acc_tender_detail t',
          [
            tenderRow({ td_id: 'cash' }),
            tenderRow({ td_id: 'held', td_tender_type_id: TENDER_TYPE.CHEQUE, apd_status: 'HELD' }),
            tenderRow({ td_id: 'banked', td_tender_type_id: TENDER_TYPE.CHEQUE, apd_status: 'DEPOSITED' }),
            tenderRow({ td_id: 'pdc', td_is_pdc: true, td_settle_status: 'settled' }),
            tenderRow({ td_id: 'points', td_tender_type_id: TENDER_TYPE.LOYALTY }),
            tenderRow({ td_id: 'temp', td_tender_type_id: TENDER_TYPE.TEMP_CREDIT, td_is_voided: true, td_replaces_id: 'cash' }),
          ],
        ],
      ]);

      const context = await service.tenderContext(KEYS);

      expect(context).toMatchObject({
        sbBillRefno: 'BIL/0042',
        sbBillDate: '2026-10-19',
        sbBillAmt: 1180,
        sbPaidAmt: 1180,
        sbBalanceAmt: 0,
        canRetender: true,
        reason: null,
      });
      const tenders = context.tenders as Record<string, unknown>[];
      expect(tenders.map((t) => [t.tdId, t.pdcMoved])).toEqual([
        ['cash', false],
        ['held', false],
        ['banked', true],
        ['pdc', true],
        ['points', false],
        ['temp', false],
      ]);
      expect(tenders[4]).toMatchObject({ isLoyalty: true, isTempCredit: false });
      expect(tenders[5]).toMatchObject({
        isTempCredit: true,
        isVoided: true,
        replacesId: 'cash',
        tdAmount: 100,
      });
    });

    it('says why a cancelled bill cannot be re-tendered', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(header('CANCELLED'));

      await expect(service.tenderContext(KEYS)).resolves.toMatchObject({
        canRetender: false,
        reason: 'bill cancelled',
      });
    });

    it('says why a bill of a closed day cannot be re-tendered', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(header());
      dayClosed.mockResolvedValue(true);

      await expect(service.tenderContext(KEYS)).resolves.toMatchObject({
        canRetender: false,
        reason: 'day closed',
      });
      expect(dayClosed).toHaveBeenCalledWith(prisma, COMPANY_ID, BRANCH_ID, '2026-10-19');
    });
  });

  describe('partyContext', () => {
    const customer = (overrides: object = {}) => ({
      cus_id: PARTY_ID,
      cus_name: 'Zeta Traders',
      cus_gst_type: 'REGULAR',
      cus_gst_no: '33ABCDE1234F1Z5',
      cus_state_code: '33',
      cus_pan_no: null,
      cus_pan_verified_on: null,
      cus_form60_on: null,
      cus_credit_allowed: true,
      cus_price_level_id: 2,
      cus_credit_amt_limit: new Prisma.Decimal('10000'),
      cus_credit_bill_limit: 3,
      cus_credit_days: 30,
      cus_group_id: 'group-1',
      cus_addr1: '12 Main Rd',
      cus_addr2: '  ',
      cus_addr3: 'T Nagar',
      cus_city: 'Chennai',
      cus_pin: '600017',
      cus_phone1: '9876543210',
      cus_area_id: 'area-1',
      cus_default_salesman: 'emp-1',
      cus_freight_charge: true,
      cus_loading_charge: false,
      cus_unloading_charge: false,
      cus_allow_discount: true,
      cus_allow_promotion: true,
      cus_allow_loyalty: true,
      arm_name: 'Central',
      arm_distance_km: 4,
      emp_name: 'Kumar',
      ...overrides,
    });
    const query = (billDate: string | null = isoDaysAgo(0)) => ({
      partyId: PARTY_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: ACC_YEAR,
      billDate,
    });
    const routes = (overrides: Record<string, unknown> = {}): [string, unknown][] =>
      Object.entries({
        'FROM sales.customers c': [customer()],
        'SUM(abl_pending_amount) AS pending': [
          { pending: new Prisma.Decimal('12500.456'), bills: 3n, oldest: dateDaysAgo(45) },
        ],
        'SUM(td_amount) AS cash': [{ cash: new Prisma.Decimal('1999.999') }],
        "abl_dr_cr = 'CR'": [
          {
            abl_id: 'adv-1',
            abl_acc_year: '2026-2027 ',
            abl_doc_refno: 'ADV/1',
            abl_pending_amount: new Prisma.Decimal('500'),
            abl_doc_date: new Date('2026-10-01T00:00:00.000Z'),
            abl_bill_type: 'ADVANCE',
          },
          {
            abl_id: 'cn-1',
            abl_acc_year: '2026-2027',
            abl_doc_refno: 'SR/7',
            abl_pending_amount: new Prisma.Decimal('75'),
            abl_doc_date: new Date('2026-10-02T00:00:00.000Z'),
            abl_bill_type: 'SALES_RETURN',
          },
        ],
        'FROM sales.loyalty_member': [],
        'FROM accounts.acc_ship_addrs': [
          {
            saa_id: 'ship-1',
            saa_trade_name: null,
            saa_contact_name: 'Godown',
            saa_addr1: 'Plot 4',
            saa_addr2: null,
            saa_addr3: 'Ambattur',
            saa_location: 'Chennai',
            saa_pin: '600053',
            saa_state_code: '33',
            saa_gstin: null,
            saa_is_default: true,
            saa_phone: null,
            saa_distance_km: new Prisma.Decimal('18.5'),
          },
        ],
        'FROM accounts.acc_temp_credit': [
          {
            atc_id: 'atc-1',
            atc_bill_refno: 'BIL/0040',
            atc_balance_amount: new Prisma.Decimal('250'),
            atc_due_date: new Date('2026-10-25T00:00:00.000Z'),
            atc_mobile: '9876543210',
            atc_name: 'Ravi',
          },
        ],
        'AS orders': [{ dc: 2n, orders: 1n }],
        ...overrides,
      });

    it('refuses a party that is not a customer', async () => {
      prisma.$queryRaw = routedRaw(routes({ 'FROM sales.customers c': [] }));

      const refusal = await refusalOf(service.partyContext(query()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'partyId', code: SaleBillErrorCode.CUSTOMER_NOT_FOUND }] },
      });
    });

    it('answers the party, its credit standing and everything the bill screen picks from', async () => {
      prisma.$queryRaw = routedRaw(routes());

      const context = await service.partyContext(query());

      expect(context.party).toMatchObject({
        ledId: PARTY_ID,
        isWalkIn: false,
        addr: '12 Main Rd, T Nagar',
        place: 'Chennai',
        areaName: 'Central',
        distanceKm: 4,
        salesmanName: 'Kumar',
        defaultPriceLevel: 2,
      });
      expect(context.credit).toEqual({
        limitAmount: 10000,
        limitBills: 3,
        creditDays: 30,
        used: 12500.46,
        openBills: 3,
        oldestOpenDays: 45,
        amtExceeded: true,
        billExceeded: true,
        daysExceeded: true,
        mode: 'WARN',
      });
      expect(context.cashToday).toBe(2000);
      expect(context.advances).toEqual([
        { ablId: 'adv-1', ablAccYear: '2026-2027', refno: 'ADV/1', pending: 500, date: '2026-10-01' },
      ]);
      expect(context.creditNotes).toEqual([
        { ablId: 'cn-1', ablAccYear: '2026-2027', refno: 'SR/7', pending: 75, date: '2026-10-02' },
      ]);
      expect(context.loyalty).toBeNull();
      expect(context.shipTo).toEqual([
        {
          saaId: 'ship-1',
          name: 'Godown',
          addr: 'Plot 4, Ambattur',
          place: 'Chennai',
          pin: '600053',
          stcd: '33',
          gstin: null,
          phone: null,
          distanceKm: 18.5,
          isDefault: true,
        },
      ]);
      expect(context.tempCredits).toEqual([
        {
          atcId: 'atc-1',
          billRefno: 'BIL/0040',
          name: 'Ravi',
          mobile: '9876543210',
          balance: 250,
          dueDate: '2026-10-25',
        },
      ]);
      expect(context.openSources).toEqual({ dc: 2, orders: 1 });
      expect(loyalty.preview).not.toHaveBeenCalled();
    });

    it('raises no credit flag when the customer has no limits', async () => {
      prisma.$queryRaw = routedRaw(
        routes({
          'FROM sales.customers c': [
            customer({ cus_credit_amt_limit: null, cus_credit_bill_limit: null, cus_credit_days: null }),
          ],
        }),
      );

      const { credit } = await service.partyContext(query());

      expect(credit).toMatchObject({
        limitAmount: 0,
        limitBills: 0,
        creditDays: 0,
        amtExceeded: false,
        billExceeded: false,
        daysExceeded: false,
      });
    });

    it('reads a party with nothing open as owing nothing', async () => {
      prisma.$queryRaw = routedRaw(
        routes({ 'SUM(abl_pending_amount) AS pending': [{ pending: null, bills: 0n, oldest: null }] }),
      );

      const { credit } = await service.partyContext(query(null));

      expect(credit).toMatchObject({ used: 0, openBills: 0, oldestOpenDays: 0 });
    });

    it('marks the walk-in customer and an address it has none of as null', async () => {
      prisma.$queryRaw = routedRaw(
        routes({
          'FROM sales.customers c': [
            customer({ cus_id: WALK_IN_ID, cus_addr1: null, cus_addr2: '', cus_addr3: null }),
          ],
        }),
      );

      const { party } = await service.partyContext({ ...query(), partyId: WALK_IN_ID });

      expect(party).toMatchObject({ isWalkIn: true, addr: null });
    });

    it("previews an enrolled member's points for the bill date", async () => {
      prisma.$queryRaw = routedRaw(
        routes({
          'FROM sales.loyalty_member': [
            { lmb_id: MEMBER_ID, lmb_card_no: 'LC-1', lmb_balance_points: new Prisma.Decimal(80), lmb_lsc_id: 's' },
          ],
        }),
      );
      loyalty.preview.mockResolvedValue({
        balance: 80,
        redeemable: 50,
        rate: 0.5,
        minPoints: 10,
        maxPoints: null,
        maxRedeemAmount: 100,
        multiple: 5,
        schemeId: 'scheme-1',
        allowPointRedeem: true,
      });

      const { loyalty: block } = await service.partyContext(query('2026-10-19'));

      expect(loyalty.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          custId: PARTY_ID,
          docDate: '2026-10-19',
          docType: 'SALE_BILL',
          memberId: MEMBER_ID,
          custGroupId: 'group-1',
          lines: [],
        }),
      );
      expect(block).toEqual({
        memberId: MEMBER_ID,
        cardNo: 'LC-1',
        balance: 80,
        redeemable: 50,
        rate: 0.5,
        minPoints: 10,
        maxPoints: null,
        maxRedeemPerc: null,
        maxRedeemAmount: 100,
        multiple: 5,
        schemeId: 'scheme-1',
        allowPointRedeem: true,
      });
    });
  });

  describe('openSources', () => {
    const line = (doc: string, lineNo: number, docDate: Date | null, overrides: object = {}) => ({
      doc_id: doc,
      acc_year: '2026-2027 ',
      refno: `${doc}-ref`,
      doc_date: docDate,
      purpose: 'SUPPLY',
      line_id: `${doc}-${lineNo}`,
      line_no: lineNo,
      item_id: 'item-1',
      item_name: 'Rice 25kg',
      unit_id: 'unit-1',
      unit_name: 'BAG',
      lot_id: null,
      batch_no: null,
      godown_id: 'godown-1',
      doc_qty: new Prisma.Decimal('10'),
      open_qty: new Prisma.Decimal('4'),
      rate: new Prisma.Decimal('1250.5'),
      tax_id: 'tax-5',
      tax_perc: new Prisma.Decimal('5'),
      hsn_code: '1006',
      free_qty: null,
      allow_negative_stock: true,
      ...overrides,
    });
    const q = { companyId: COMPANY_ID, branchId: BRANCH_ID, partyId: PARTY_ID };

    it("groups challan lines by challan, flags those past the window and those not for supply", async () => {
      prisma.$queryRaw = routedRaw([
        [
          'FROM sales.sale_dc h',
          [
            line('dc-1', 1, dateDaysAgo(40)),
            line('dc-1', 2, dateDaysAgo(40)),
            line('dc-2', 1, dateDaysAgo(5), { purpose: 'APPROVAL' }),
          ],
        ],
      ]);

      const docs = await service.openSources({ ...q, kind: 'DC', accYear: ACC_YEAR });

      expect(statutory.limit).toHaveBeenCalledWith(
        COMPANY_ID,
        'DC_RETURN_WINDOW_DAYS',
        isoDaysAgo(0),
      );
      expect(docs).toHaveLength(2);
      expect(docs[0]).toMatchObject({
        docId: 'dc-1',
        accYear: '2026-2027',
        ageDays: 40,
        pastWindow: true,
        convertRequired: false,
      });
      expect(docs[0].lines.map((l) => l.lineId)).toEqual(['dc-1-1', 'dc-1-2']);
      expect(docs[0].lines[0]).toEqual({
        lineId: 'dc-1-1',
        lineNo: 1,
        itemId: 'item-1',
        itemName: 'Rice 25kg',
        unitId: 'unit-1',
        unitName: 'BAG',
        lotId: null,
        batchNo: null,
        godownId: 'godown-1',
        docQty: 10,
        openQty: 4,
        freeQty: 0,
        rate: 1250.5,
        taxId: 'tax-5',
        taxPerc: 5,
        hsnCode: '1006',
        allowNegativeStock: true,
      });
      expect(docs[1]).toMatchObject({ docId: 'dc-2', pastWindow: false, convertRequired: true });
    });

    it('flags nothing as past the window when the company sets no window', async () => {
      statutory.limit.mockResolvedValue(null);
      prisma.$queryRaw = routedRaw([['FROM sales.sale_dc h', [line('dc-1', 1, dateDaysAgo(400))]]]);

      const [doc] = await service.openSources({ ...q, kind: 'DC' });

      expect(doc.pastWindow).toBe(false);
    });

    it('lists open order lines with their age, never past a window', async () => {
      prisma.$queryRaw = routedRaw([
        ['FROM sales.sale_order h', [line('so-1', 1, dateDaysAgo(3), { purpose: null, allow_negative_stock: false })]],
      ]);

      const docs = await service.openSources({ ...q, kind: 'ORDER' });

      expect(statutory.limit).not.toHaveBeenCalled();
      expect(docs).toEqual([
        expect.objectContaining({ docId: 'so-1', ageDays: 3, pastWindow: false, purpose: null }),
      ]);
      expect(docs[0]).not.toHaveProperty('convertRequired');
      expect(docs[0].lines[0].allowNegativeStock).toBe(false);
    });
  });

  describe('lockCounts', () => {
    it('reads the returns and the allocations that lock a bill as numbers', async () => {
      const client = { $queryRaw: routedRaw([['AS allocations', [{ returns: 1n, allocations: 2n }]]]) };

      await expect(
        service.lockCounts(client as never, { sbId: BILL_ID, sbAccYear: ACC_YEAR } as SaleBill),
      ).resolves.toEqual({ returns: 1, allocations: 2 });
    });

    it('reads no row as nothing locking it', async () => {
      const client = { $queryRaw: routedRaw([]) };

      await expect(
        service.lockCounts(client as never, { sbId: BILL_ID, sbAccYear: ACC_YEAR } as SaleBill),
      ).resolves.toEqual({ returns: 0, allocations: 0 });
    });
  });

  describe('decorate', () => {
    const bill = {
      sbId: BILL_ID,
      sbStatus: 'POSTED',
      sbCompanyId: COMPANY_ID,
      sbBranchId: BRANCH_ID,
      sbAccYear: ACC_YEAR,
      sbBillDate: new Date('2026-10-19T00:00:00.000Z'),
      sbPostedVoucherId: 'voucher-1',
      sbDocRegisterId: 'gdr-1',
      sbCogsAmt: new Prisma.Decimal('800'),
      sbLoyaltyEarned: new Prisma.Decimal('12'),
      sbLoyaltyRedeemed: null,
    } as unknown as SaleBill;
    const payload = { sbId: BILL_ID } as unknown as BillPayload;

    beforeEach(() => {
      prisma.$queryRaw = routedRaw([
        ['AS allocations', [{ returns: 0n, allocations: 1n }]],
        [
          'WITH refs AS',
          [
            {
              kind: 'SALES_ORDER',
              doc_id: 'so-1',
              acc_year: '2026-2027 ',
              refno: 'SO/9',
              doc_date: new Date('2026-10-10T00:00:00.000Z'),
              lines: 2n,
              taken_qty: new Prisma.Decimal('6'),
              open_after: null,
            },
          ],
        ],
        [
          'abj_against_bill_id',
          [
            {
              abj_against_bill_id: 'adv-1',
              abj_against_bill_acc_year: '2026-2027 ',
              refno: 'ADV/1',
              abj_amount: new Prisma.Decimal('300'),
              abj_adj_type: 'ADVANCE_ADJUST',
            },
          ],
        ],
      ]);
      prisma.accTempCredit.findMany.mockResolvedValue([
        {
          atcId: 'atc-1',
          atcName: 'Ravi',
          atcMobile: '98',
          atcBalanceAmount: new Prisma.Decimal('50'),
          atcDueDate: new Date('2026-10-25T00:00:00.000Z'),
          atcStatus: 'OPEN',
        },
      ]);
    });

    it('adds the posting, lock, rights, source, credit and set-off blocks', async () => {
      const decorated = await service.decorate(bill, payload);

      expect(docBlocks.build).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'POSTED',
          docDate: '2026-10-19',
          voucherId: 'voucher-1',
          registerId: 'gdr-1',
          cogsAmt: 800,
          loyaltyEarned: 12,
          loyaltyRedeemed: 0,
          returns: 0,
          allocations: 1,
        }),
        prisma,
      );
      expect(decorated).toMatchObject({
        sbId: BILL_ID,
        posting: { p: 1 },
        locks: { l: 1 },
        rights: { view: true },
        sources: [
          {
            kind: 'ORDER',
            docId: 'so-1',
            accYear: '2026-2027',
            refno: 'SO/9',
            date: '2026-10-10',
            lines: 2,
            takenQty: 6,
            openQtyAfter: null,
          },
        ],
        tempCredits: [
          { atcId: 'atc-1', name: 'Ravi', mobile: '98', balance: 50, dueDate: '2026-10-25', status: 'OPEN' },
        ],
        adjustments: [
          { againstBillId: 'adv-1', againstBillAccYear: '2026-2027', refno: 'ADV/1', amount: 300, adjType: 'ADVANCE_ADJUST' },
        ],
        transport: null,
        sbShipName: null,
        sbLrNo: null,
      });
    });

    it('adds each line its batch size / colour / model, by item and folded batch (textile E3.3)', async () => {
      const routed = prisma.$queryRaw as jest.Mock;
      prisma.$queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
        strings.join('?').includes('stock.stock_batch_detail')
          ? Promise.resolve([
              {
                itemId: 'item-1',
                batchNo: 'CBE26-00001',
                sizeId: 'size-xl',
                sizeName: 'XL',
                colourId: 'colour-m',
                colourName: 'Maroon',
                model: 'Slim fit',
              },
            ])
          : routed(strings, ...values),
      );
      const withLines = {
        sbId: BILL_ID,
        items: [
          { sbiItemId: 'item-1', sbiBatchNo: ' cbe26-00001' },
          { sbiItemId: 'item-2', sbiBatchNo: 'CBE26-00001' },
          { sbiItemId: 'item-3', sbiBatchNo: null },
        ],
      } as unknown as BillPayload;

      const decorated = await service.decorate(bill, withLines);

      expect(decorated.items).toEqual([
        expect.objectContaining({
          sbiSizeName: 'XL',
          sbiColourName: 'Maroon',
          sbiModel: 'Slim fit',
        }),
        // Another item's line with the same batch text shows nothing.
        expect.objectContaining({ sbiSizeName: null, sbiColourName: null, sbiModel: null }),
        expect.objectContaining({ sbiSizeName: null, sbiColourName: null, sbiModel: null }),
      ]);
    });

    it('lifts the transport band into the flat ship-to and transporter fields', async () => {
      transportBand.read.mockResolvedValue({
        mode: 'ROAD',
        transporterId: 't-1',
        transporterName: 'Fast Movers',
        transporterGstin: null,
        lrNo: 'LR-9',
        lrDate: '2026-10-19',
        distanceKm: 12,
        from: { godownId: 'godown-1', branchId: BRANCH_ID },
        to: {
          addrId: 'ship-1',
          name: 'Godown',
          addr: 'Plot 4',
          place: 'Chennai',
          pin: '600053',
          phone: null,
          stcd: '33',
          gstin: null,
        },
      });

      const decorated = await service.decorate(bill, payload, prisma as never);

      expect(decorated).toMatchObject({
        sbShipAddrId: 'ship-1',
        sbShipName: 'Godown',
        sbShipPin: '600053',
        sbDispatchGodownId: 'godown-1',
        sbDispatchBranchId: BRANCH_ID,
        sbTransportMode: 'ROAD',
        sbTransporterName: 'Fast Movers',
        sbLrNo: 'LR-9',
        sbDistanceKm: 12,
      });
    });
  });
});
