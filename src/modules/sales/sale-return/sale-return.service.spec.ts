import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { syncBillAdjustments } from '../../../common/posting/bill-adjustment.helper';
import { TxnStatusEvent } from '../../../common/txn-status-log/txn-status-log.helper';
import { buildReturnLegs } from '../posting/sales-leg.sources';
import {
  assertAccYearWritable,
  assertAmendable,
  assertSalesmen,
  assertVoucherPartitionExists,
  loadDayClosed,
  loadDeclaredLocks,
} from '../posting/sales.guards';
import { SALES_SETTING_DEFAULTS, type SalesSettings } from '../posting/sales.settings';
import { SALES_ERROR_CODES, type RightsBlock } from '../posting/types/posting.types';
import { SaleReturnService } from './sale-return.service';
import type { SaveSaleReturnDto } from './dto/save-sale-return.dto';

// The guards that read the database are replaced; refuse/warn stay real, so
// what a run collects is exactly what the service raised.
jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<typeof import('../posting/sales.guards')>('../posting/sales.guards'),
  assertAccYearWritable: jest.fn(),
  assertVoucherPartitionExists: jest.fn(),
  assertSalesmen: jest.fn(),
  assertAmendable: jest.fn(),
  loadDayClosed: jest.fn(),
  loadDeclaredLocks: jest.fn(),
}));
// The leg builder belongs to the posting module; here only what it is handed matters.
jest.mock('../posting/sales-leg.sources', () => ({
  ...jest.requireActual<typeof import('../posting/sales-leg.sources')>(
    '../posting/sales-leg.sources',
  ),
  buildReturnLegs: jest.fn(() => [{ role: 'RETURN_LEGS' }]),
}));
jest.mock('../../../common/posting/bill-adjustment.helper', () => ({
  syncBillAdjustments: jest.fn(),
}));

const SR_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e004';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46e005';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e006';
const BILL_LINE = '019c6f6c-be87-7a11-8905-36092c46e007';
const OTHER_BILL_LINE = '019c6f6c-be87-7a11-8905-36092c46e008';
const LINE_A = '019c6f6c-be87-7a11-8905-36092c46e009';
const LINE_B = '019c6f6c-be87-7a11-8905-36092c46e00a';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46e00b';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46e00c';
const REVERSAL_ID = '019c6f6c-be87-7a11-8905-36092c46e00d';
const GDR_ID = '019c6f6c-be87-7a11-8905-36092c46e00e';
const CN_ABL_ID = '019c6f6c-be87-7a11-8905-36092c46e00f';
const BILL_ABL_ID = '019c6f6c-be87-7a11-8905-36092c46e010';
const OTHER_CN_ABL_ID = '019c6f6c-be87-7a11-8905-36092c46e011';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46e012';
const COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46e013';
const LIVE_SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46e014';
const LIVE_COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46e015';
const MEMBER_ID = '019c6f6c-be87-7a11-8905-36092c46e016';
const ACC_YEAR = '2026-2027';
const TODAY = new Date().toISOString().slice(0, 10);
const PAST = '2026-04-02';
const FUTURE = '2999-01-01';
const CASH = 1;
const CREDIT = 8;

const D = (v: number | string) => new Prisma.Decimal(v);

const KEYS = { srId: SR_ID, srCompanyId: COMPANY_ID, srBranchId: BRANCH_ID, srAccYear: ACC_YEAR };

const srRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...KEYS,
  srTenantId: null,
  srStatus: 'DRAFT',
  srReturnRefno: 'srt00009',
  srReturnSlno: 9n,
  srReturnDate: new Date(`${TODAY}T00:00:00.000Z`),
  srReturnDatetime: new Date(`${TODAY}T06:00:00.000Z`),
  srCustId: CUST_ID,
  srCustName: 'Acme Traders',
  srDeviceId: 'till-1',
  srBillMode: null,
  srSessionId: SESSION_ID,
  srCounterId: COUNTER_ID,
  srUserId: USER_ID,
  srSalesmanId: null,
  srAgentId: null,
  srIsAgainstBill: true,
  srBillId: BILL_ID,
  srBillAccYear: ACC_YEAR,
  srBillRefno: 'bil00101',
  srSettleMode: 'ADVANCE',
  srReturnAmt: D('590.00'),
  srTaxableAmt: D('500.00'),
  srRoundOff: D(0),
  srReturnReason: 'Damaged in transit',
  srPosStcd: '33',
  srRevisionNo: 1,
  srPostedVoucherId: null,
  ...overrides,
});

const srItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sriId: LINE_A,
  sriLineNo: 1,
  sriItemId: ITEM_ID,
  sriItemUnitId: '019c6f6c-be87-7a11-8905-36092c46e0a1',
  sriGodownId: '019c6f6c-be87-7a11-8905-36092c46e0a2',
  sriBillItemId: BILL_LINE,
  sriLotId: null,
  sriBucket: null,
  sriCondition: null,
  sriIsService: false,
  sriIsFree: false,
  sriReturnQty: D(1),
  sriFreeQty: D(0),
  sriWeightQty: null,
  sriToBaseFactor: D(1),
  sriMaxPrice: null,
  sriRate: D(500),
  sriCostPrice: D(320),
  sriTaxPerc: D(18),
  sriTaxId: '019c6f6c-be87-7a11-8905-36092c46e0a3',
  sriTaxableAmt: D(500),
  sriCgstAmt: D(45),
  sriSgstAmt: D(45),
  sriIgstAmt: D(0),
  sriCessAmt: D(0),
  sriNetAmt: D(590),
  sriSchDiscAmt: D(0),
  sriBillSchAmt: D(0),
  ...overrides,
});

const tender = (typeId: number, amount: number) => ({
  tdTenderTypeId: typeId,
  tdTenderLedgerId: `ledger-${typeId}`,
  tdTenderName: `tender ${typeId}`,
  tdAmount: D(amount),
});

const ALL_RIGHTS: RightsBlock = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  print: true,
  export: true,
  post: true,
  cancel: true,
  amend: true,
  override: false,
  retender: false,
};

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(
  promise: Promise<unknown>,
): Promise<{ status: number; body: { message: string; errors: Record<string, unknown>[] } }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return {
    status: error.getStatus(),
    body: error.getResponse() as { message: string; errors: Record<string, unknown>[] },
  };
}

describe('SaleReturnService', () => {
  /** What the raw queries answer, per test. */
  let db: {
    bill: Record<string, unknown> | null;
    masters: { item_id: string; item_allow_sales_return: boolean; item_name_en: string }[];
    soldLines: { sbi_id: string; sold: Prisma.Decimal; returned: Prisma.Decimal | null }[];
    billAbl: Record<string, unknown> | null;
    liveAdjustments: Record<string, unknown>[];
    creditApplied: bigint;
    adjustedBills: Record<string, unknown>[];
    billLines: Record<string, unknown>[];
  };
  let tx: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
    accBillBalance: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let store: Record<string, jest.Mock>;
  let ctx: {
    actor: string;
    actorName: string;
    settings: SalesSettings;
    cogsMode: 'PERPETUAL' | 'PERIODIC';
    rights: RightsBlock;
  };
  let salesContext: { actor: jest.Mock; resolve: jest.Mock; rights: jest.Mock };
  let statutory: { creditNoteCutoff: jest.Mock; withinCancelWindow: jest.Mock };
  let legs: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let register: { registerIdOf: jest.Mock; write: jest.Mock; cancel: jest.Mock };
  let stock: { post: jest.Mock; cancel: jest.Mock };
  let blocks: { build: jest.Mock; gstRows: jest.Mock };
  let transportBand: { write: jest.Mock };
  let loyalty: { clawbackForReturn: jest.Mock; reverseForCancel: jest.Mock };
  let promo: { reverse: jest.Mock };
  let gst: { enqueueAfterPost: jest.Mock; cancelIrn: jest.Mock; cancelEwb: jest.Mock };
  let till: { resolveForMoney: jest.Mock; stampTenderRows: jest.Mock };
  let service: SaleReturnService;
  let row: Record<string, unknown>;
  let items: Record<string, unknown>[];
  let tenders: ReturnType<typeof tender>[];

  beforeEach(() => {
    // The module-level mocks would otherwise carry their calls from test to test.
    jest.clearAllMocks();
    jest.mocked(loadDayClosed).mockResolvedValue(false);
    jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: false });
    jest.mocked(assertAmendable).mockResolvedValue(undefined);
    jest.mocked(syncBillAdjustments).mockReset();
    jest.mocked(buildReturnLegs).mockClear();

    db = {
      bill: {
        sb_id: BILL_ID,
        sb_acc_year: ACC_YEAR,
        sb_status: 'POSTED',
        sb_bill_refno: 'bil00101',
        sb_bill_date: new Date(`${TODAY}T00:00:00.000Z`),
        sb_bill_amt: D(2360),
        sb_taxable_amt: D(2000),
        sb_cust_id: CUST_ID,
        sb_loyalty_member_id: null,
        sb_loyalty_earn_points: D(0),
        sb_returned_amt: D(0),
      },
      masters: [{ item_id: ITEM_ID, item_allow_sales_return: true, item_name_en: 'Steel Tumbler' }],
      soldLines: [{ sbi_id: BILL_LINE, sold: D(4), returned: null }],
      billAbl: {
        abl_id: BILL_ABL_ID,
        abl_pending_amount: D(2360),
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(0),
      },
      liveAdjustments: [],
      creditApplied: 0n,
      adjustedBills: [],
      billLines: [],
    };
    tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('FROM sales.sale_bill WHERE')) return db.bill ? [db.bill] : [];
        if (sql.includes('inventory.item_master WHERE')) return db.masters;
        if (sql.includes('AS "billItemId"')) return db.billLines;
        if (sql.includes('b.sbi_bill_qty AS sold')) return db.soldLines;
        if (sql.includes('COUNT(*) AS n')) return [{ n: db.creditApplied }];
        if (sql.includes('k.abl_doc_refno')) return db.adjustedBills;
        if (sql.includes('j.abj_against_bill_acc_year')) return db.liveAdjustments;
        if (sql.includes('FROM accounts.acc_bill_balance')) return db.billAbl ? [db.billAbl] : [];
        if (sql.includes('comp_einvoice_applicable')) {
          return [{ comp_state_code: '33', comp_einvoice_applicable: false }];
        }
        if (sql.includes('accounts.acc_voucher_header'))
          return [{ avh_voucher_refno: 'srt-r-0002' }];
        return [];
      }),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
      accBillBalance: {
        create: jest.fn().mockResolvedValue({ ablId: CN_ABL_ID }),
        findFirst: jest.fn().mockResolvedValue({ ablId: CN_ABL_ID }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    row = srRow();
    items = [srItem()];
    tenders = [];
    store = {
      saveDraft: jest.fn(async (_tx: unknown, body: Record<string, unknown>) =>
        srRow({ ...body, srId: body.srId ?? SR_ID }),
      ),
      keysOf: jest.fn((r: Record<string, unknown>) => ({
        id: r.srId,
        companyId: r.srCompanyId,
        branchId: r.srBranchId,
        accYear: r.srAccYear,
      })),
      lock: jest.fn(async () => row),
      findOrThrow: jest.fn(async () => row),
      deleteDraft: jest.fn().mockResolvedValue(undefined),
      loadItems: jest.fn(async () => items),
      loadCharges: jest.fn().mockResolvedValue([]),
      loadTenders: jest.fn(async () => tenders),
      loadTransport: jest.fn().mockResolvedValue(null),
      plain: jest.fn((r: Record<string, unknown>) => ({ ...r })),
      updateItem: jest.fn().mockResolvedValue(undefined),
      setStatus: jest.fn(
        async (
          _tx: unknown,
          r: Record<string, unknown>,
          status: string,
          extra: Record<string, unknown>,
        ) => ({ ...r, srStatus: status, ...extra }),
      ),
      trail: jest.fn().mockResolvedValue(undefined),
      auditChange: jest.fn().mockResolvedValue(undefined),
    };
    ctx = {
      actor: USER_ID,
      actorName: 'cashier1',
      settings: { ...SALES_SETTING_DEFAULTS, backdateMode: 'ALLOW' },
      cogsMode: 'PERPETUAL',
      rights: { ...ALL_RIGHTS },
    };
    salesContext = {
      actor: jest.fn().mockReturnValue(USER_ID),
      resolve: jest.fn(async () => ctx),
      rights: jest.fn(async () => ctx.rights),
    };
    statutory = {
      creditNoteCutoff: jest.fn().mockResolvedValue({ limit: null, cutoff: null, passed: false }),
      withinCancelWindow: jest
        .fn()
        .mockResolvedValue({ limit: null, within: true, hoursElapsed: 1 }),
    };
    legs = {
      postLegs: jest
        .fn()
        .mockResolvedValue({ voucherId: VOUCHER_ID, voucherLastNo: 31n, voucherRefno: 'SRt31' }),
      reverseLegs: jest.fn().mockResolvedValue({ voucherId: REVERSAL_ID }),
    };
    register = {
      registerIdOf: jest.fn().mockResolvedValue(null),
      write: jest
        .fn()
        .mockResolvedValue({ gdrId: GDR_ID, einvoiceApplicable: true, ewaybillApplicable: false }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    stock = {
      post: jest.fn().mockResolvedValue({
        costByLine: new Map(),
        lotByLine: new Map(),
        cogsTotal: 320,
      }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    blocks = {
      build: jest
        .fn()
        .mockResolvedValue({ posting: { status: 'POSTED' }, locks: { editable: {} } }),
      gstRows: jest
        .fn()
        .mockResolvedValue({ irnGeneratedOn: new Date(), ewbGeneratedOn: new Date() }),
    };
    transportBand = { write: jest.fn().mockResolvedValue({ direction: 'INWARD' }) };
    loyalty = {
      clawbackForReturn: jest.fn().mockResolvedValue({ clawedBack: 12 }),
      reverseForCancel: jest.fn().mockResolvedValue(undefined),
    };
    promo = { reverse: jest.fn().mockResolvedValue(undefined) };
    gst = {
      enqueueAfterPost: jest.fn(),
      cancelIrn: jest.fn().mockResolvedValue(undefined),
      cancelEwb: jest.fn().mockResolvedValue(undefined),
    };
    till = {
      resolveForMoney: jest.fn().mockResolvedValue(null),
      stampTenderRows: jest.fn().mockResolvedValue(undefined),
    };

    service = new SaleReturnService(
      tx as unknown as PrismaService,
      salesContext as never,
      statutory as never,
      legs as never,
      register as never,
      stock as never,
      blocks as never,
      transportBand as never,
      loyalty as never,
      promo as never,
      gst as never,
      {} as never,
      {} as never,
      {} as never,
      till as never,
    );
    // The document store is built inside the constructor; swap in the mock.
    (service as unknown as { store: unknown }).store = store;
  });

  const lastSetStatus = () =>
    store.setStatus.mock.calls.at(-1) as [unknown, unknown, string, Record<string, unknown>];
  /** The raw queries whose SQL contains a fragment. */
  const queriesWith = (fragment: string) =>
    tx.$queryRaw.mock.calls.filter(([strings]) =>
      (strings as string[]).join('?').includes(fragment),
    );
  const billReads = () => queriesWith('FROM sales.sale_bill WHERE').length;
  const refusalsOf = async (overrides: Record<string, unknown> = {}, lines = items) => {
    const result = await service.validate({
      ...srRow(),
      items: lines,
      ...overrides,
    } as unknown as SaveSaleReturnDto);
    return result as {
      ok: boolean;
      refusals: { code: string; field?: string; line?: number; statutory?: unknown }[];
      warnings: { code: string; level: string }[];
    };
  };

  describe('save', () => {
    const saveBody = (overrides: Record<string, unknown> = {}) =>
      ({
        ...KEYS,
        srId: undefined,
        srBillId: BILL_ID,
        srBillAccYear: ACC_YEAR,
        ...overrides,
      }) as unknown as SaveSaleReturnDto;
    const savedBody = () => store.saveDraft.mock.calls[0][1] as Record<string, unknown>;

    it('fills the bill reference, date and customer from the bill it is against', async () => {
      await service.save(saveBody());

      expect(savedBody()).toMatchObject({
        srIsAgainstBill: true,
        srBillRefno: 'bil00101',
        srBillDate: TODAY,
        srCustId: CUST_ID,
      });
    });

    it('keeps what the client sent over what the bill says', async () => {
      await service.save(saveBody({ srBillRefno: 'typed', srCustId: 'someone-else' }));

      expect(savedBody()).toMatchObject({ srBillRefno: 'typed', srCustId: 'someone-else' });
    });

    it('does not read the bill for a return marked as not against one', async () => {
      await service.save(saveBody({ srIsAgainstBill: false }));

      // The read-back /get still runs its own queries; the bill is not among them.
      expect(billReads()).toBe(0);
      expect(savedBody()).not.toHaveProperty('srBillRefno');
      expect(savedBody()).toMatchObject({ srIsAgainstBill: false });
    });

    it('needs both the bill id and its year before it reads the bill', async () => {
      await service.save(saveBody({ srBillAccYear: undefined }));

      expect(billReads()).toBe(0);
      expect(savedBody()).not.toHaveProperty('srBillRefno');
    });

    it('saves the body as sent when the bill it names is not found', async () => {
      db.bill = null;

      await service.save(saveBody());

      expect(billReads()).toBe(1);
      expect(savedBody()).not.toHaveProperty('srIsAgainstBill');
      expect(savedBody()).not.toHaveProperty('srBillRefno');
    });

    it('saves under the request user and answers with the read-back', async () => {
      const result = await service.save(saveBody());

      expect(store.saveDraft).toHaveBeenCalledWith(
        tx,
        expect.any(Object),
        USER_ID,
        expect.any(Date),
        expect.any(Object),
      );
      expect(store.findOrThrow).toHaveBeenCalledWith(tx, {
        id: SR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });
      expect(result).toMatchObject({ srId: SR_ID, rights: ALL_RIGHTS });
    });

    it('stamps the return time only when the client sent none', async () => {
      await service.save(saveBody());
      const hooks = store.saveDraft.mock.calls[0][4] as {
        beforeWrite: (data: Record<string, unknown>) => void;
      };

      const fresh: Record<string, unknown> = {};
      hooks.beforeWrite(fresh);
      const sent: Record<string, unknown> = { srReturnDatetime: 'kept' };
      hooks.beforeWrite(sent);

      expect(fresh.srReturnDatetime).toBeInstanceOf(Date);
      expect(sent.srReturnDatetime).toBe('kept');
    });
  });

  describe('get', () => {
    it('adds the settlement, the claw-backs and how much of the credit is spoken for', async () => {
      row = srRow({
        srStatus: 'POSTED',
        srRefundAmt: D(100),
        srAdjustedAmt: D(200),
        srCreditAmt: D(290),
        srLoyaltyReversePoints: D(12),
        srPromoClawbackAmt: D('15.50'),
      });
      db.creditApplied = 2n;
      db.adjustedBills = [{ abl_id: BILL_ABL_ID, abl_doc_refno: 'bil00101', amount: D(200) }];

      const result = await service.get({
        id: SR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });

      expect(blocks.build).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'POSTED', allocations: 2 }),
        tx,
      );
      expect(result.posting).toEqual({
        status: 'POSTED',
        settlement: {
          refunded: 100,
          adjusted: 200,
          credited: 290,
          adjustedBills: [{ ablId: BILL_ABL_ID, refno: 'bil00101', amount: 200 }],
        },
        loyaltyReversed: 12,
        promoClawback: 15.5,
      });
    });
  });

  it('turns the decimals of the bill lines into numbers', async () => {
    db.billLines = [
      { billItemId: BILL_LINE, billQty: D('4.000'), returnedQty: D(1), itemName: 'Cup' },
    ];

    await expect(service.billLines(BILL_ID, ACC_YEAR)).resolves.toEqual([
      { billItemId: BILL_LINE, billQty: 4, returnedQty: 1, itemName: 'Cup' },
    ]);
  });

  it('deletes a draft through the store and says so', async () => {
    await expect(service.delete(KEYS)).resolves.toEqual({ srId: SR_ID, deleted: true });
    expect(store.deleteDraft).toHaveBeenCalledWith(
      tx,
      { id: SR_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR },
      USER_ID,
      expect.any(Date),
    );
  });

  describe('the guards (through /validate)', () => {
    it('passes a clean return against a posted bill', async () => {
      await expect(refusalsOf()).resolves.toMatchObject({ ok: true, refusals: [], warnings: [] });
      expect(salesContext.resolve).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, branchId: BRANCH_ID, deviceId: 'till-1' },
        13,
      );
    });

    it('refuses a future date, and warns on a past one under WARN', async () => {
      expect((await refusalsOf({ srReturnDate: FUTURE })).refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, field: 'srReturnDate' }),
      ]);

      ctx.settings.backdateMode = 'WARN';
      db.bill!.sb_bill_date = new Date(`${PAST}T00:00:00.000Z`);
      expect((await refusalsOf({ srReturnDate: PAST })).warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, level: 'WARN' }),
      ]);
    });

    it('refuses once the books for the return date are closed', async () => {
      jest.mocked(loadDayClosed).mockResolvedValue(true);

      expect((await refusalsOf()).refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.DAY_CLOSED }),
      ]);
    });

    it('refuses a return with no customer, and one with no lines', async () => {
      const { refusals } = await refusalsOf({ srCustId: null }, []);

      expect(refusals.map((r) => r.field)).toEqual(['srCustId', 'items']);
    });

    it('refuses a settlement mode that is not CASH, ADJUST or ADVANCE', async () => {
      const { refusals } = await refusalsOf({ srSettleMode: 'cheque' });

      expect(refusals).toEqual([
        expect.objectContaining({
          field: 'srSettleMode',
          message: 'srSettleMode must be CASH, ADJUST or ADVANCE (got CHEQUE)',
        }),
      ]);
    });

    it('refuses an item that does not accept sales returns, naming the line', async () => {
      db.masters = [
        { item_id: ITEM_ID, item_allow_sales_return: false, item_name_en: 'Gift card' },
      ];

      expect((await refusalsOf()).refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_ITEM_NOT_ALLOWED,
          line: 1,
          message: 'Line 1: Gift card does not accept sales returns',
        }),
      ]);
    });

    it('refuses free goods coming back when sales.free_return_allowed is off', async () => {
      ctx.settings.freeReturnAllowed = false;

      expect((await refusalsOf({}, [srItem({ sriIsFree: true })])).refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.FREE_RETURN_OFF, line: 1 }),
      ]);
    });

    it.each([
      ['missing', null],
      ['still a DRAFT', 'DRAFT'],
    ])('refuses a return against a bill that is %s', async (_label, status) => {
      db.bill = status === null ? null : { ...db.bill, sb_status: status };

      expect((await refusalsOf()).refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED,
          field: 'srBillId',
        }),
      ]);
    });

    it('warns when the bill is older than the return window', async () => {
      ctx.settings.returnWindowDays = 7;
      db.bill!.sb_bill_date = new Date('2026-04-01T00:00:00.000Z');

      const { warnings } = await refusalsOf({ srReturnDate: '2026-04-20' });

      expect(warnings).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_WINDOW,
          message: 'The bill is 19 days old; the return window is 7 days',
        }),
      ]);
    });

    it.each([
      ['REFUSE', 'refusals'],
      ['WARN', 'warnings'],
    ] as const)(
      'raises the s.34(2) credit-note cut-off as the limit says (%s)',
      async (enforce, list) => {
        statutory.creditNoteCutoff.mockResolvedValue({
          passed: true,
          cutoff: '2026-11-30',
          limit: {
            code: 'GST_CN_CUTOFF',
            valueText: '30 Nov',
            effectiveFrom: '2017-07-01',
            isCompanyOverride: false,
            enforce,
          },
        });

        const result = await refusalsOf();

        expect(result[list]).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.CREDIT_NOTE_CUTOFF,
            statutory: {
              code: 'GST_CN_CUTOFF',
              value: '30 Nov',
              effectiveFrom: '2017-07-01',
              isCompanyOverride: false,
            },
          }),
        ]);
      },
    );

    it('refuses taking back more than the bill line still has, across return lines', async () => {
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(4), returned: D(2) }];

      const { refusals } = await refusalsOf({}, [
        srItem({ sriReturnQty: D(1), sriFreeQty: D(0) }),
        srItem({ sriId: LINE_B, sriLineNo: 2, sriReturnQty: D(1), sriFreeQty: D(1) }),
      ]);

      expect(refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_OVER_QTY,
          message: 'Bill line has 2 returnable; this return takes 3',
        }),
      ]);
    });

    it('refuses a line naming a bill line that is not on the bill', async () => {
      const { refusals } = await refusalsOf({}, [srItem({ sriBillItemId: OTHER_BILL_LINE })]);

      expect(refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_OVER_QTY,
          message: `Bill line ${OTHER_BILL_LINE} is not on this bill`,
        }),
      ]);
    });

    it('warns that an ADJUST against a settled bill becomes an open credit', async () => {
      db.billAbl = { abl_pending_amount: D(0) };

      const { warnings, refusals } = await refusalsOf({ srSettleMode: 'ADJUST' });

      expect(refusals).toEqual([]);
      expect(warnings).toEqual([expect.objectContaining({ code: SALES_ERROR_CODES.CN_APPLIED })]);
    });

    it('refuses ADJUST on a return that is not against a bill', async () => {
      const { refusals } = await refusalsOf({ srSettleMode: 'ADJUST', srIsAgainstBill: false });

      expect(refusals).toEqual([
        expect.objectContaining({
          field: 'srSettleMode',
          message: 'ADJUST needs a bill to adjust against — this return is not against a bill',
        }),
      ]);
    });

    it('refuses a CASH settlement whose tenders do not add up to the return', async () => {
      tenders = [tender(CASH, 500)];

      expect((await refusalsOf({ srSettleMode: 'CASH' })).refusals).toEqual([
        expect.objectContaining({
          field: 'tenders',
          message: 'CASH settlement: tenders total 500 against a return of 590',
        }),
      ]);

      tenders = [tender(CASH, 400), tender(CREDIT, 190)];
      expect((await refusalsOf({ srSettleMode: 'CASH' })).refusals).toEqual([]);
    });

    it('checks the year is writable and its voucher partition exists, naming srAccYear', async () => {
      await refusalsOf();

      expect(assertAccYearWritable).toHaveBeenCalledWith(tx, COMPANY_ID, ACC_YEAR, 'srAccYear');
      expect(assertVoucherPartitionExists).toHaveBeenCalledWith(tx, ACC_YEAR, 'srAccYear');
    });

    it('refuses a backdated return outright under sales.backdate_mode REFUSE', async () => {
      ctx.settings.backdateMode = 'REFUSE';

      expect((await refusalsOf({ srReturnDate: PAST })).refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.BACKDATE,
          message: `This return is dated ${PAST}, before today`,
        }),
      ]);
    });

    it('checks the salesmen only when the return names some', async () => {
      await refusalsOf({ srSalesmanId: [] });
      expect(assertSalesmen).toHaveBeenLastCalledWith(tx, COMPANY_ID, null, {
        field: 'srSalesmanId',
      });

      await refusalsOf({ srSalesmanId: [USER_ID] });
      expect(assertSalesmen).toHaveBeenLastCalledWith(tx, COMPANY_ID, [USER_ID], {
        field: 'srSalesmanId',
      });
    });

    it('numbers the lines a validate body leaves unnumbered by their position', async () => {
      db.masters = [
        { item_id: ITEM_ID, item_allow_sales_return: false, item_name_en: 'Gift card' },
      ];

      const { refusals } = await refusalsOf({}, [
        srItem({ sriLineNo: undefined }),
        srItem({ sriId: LINE_B, sriLineNo: undefined }),
      ]);

      expect(refusals.map((r) => r.line)).toEqual([1, 2]);
    });

    it('stays quiet about the return window when it is switched off (0 days)', async () => {
      ctx.settings.returnWindowDays = 0;
      db.bill!.sb_bill_date = new Date('2020-01-01T00:00:00.000Z');

      expect((await refusalsOf()).warnings).toEqual([]);
    });

    it('does not check quantities or the bill on a return that is not against one', async () => {
      db.bill = null;

      const result = await refusalsOf({ srIsAgainstBill: false, srBillId: null });

      expect(result).toMatchObject({ ok: true, refusals: [] });
      expect(billReads()).toBe(0);
      expect(statutory.creditNoteCutoff).not.toHaveBeenCalled();
    });

    it('skips a line that names no bill line when it sums what is taken back', async () => {
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(1), returned: null }];

      const { refusals } = await refusalsOf({}, [
        srItem(),
        srItem({ sriId: LINE_B, sriLineNo: 2, sriBillItemId: null, sriReturnQty: D(5) }),
      ]);

      expect(refusals).toEqual([]);
    });

    it('treats a missing settlement mode as ADJUST, which needs a bill', async () => {
      const { refusals } = await refusalsOf({ srSettleMode: null, srIsAgainstBill: false });

      expect(refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.AMOUNT_MISMATCH, field: 'srSettleMode' }),
      ]);
    });
  });

  describe('post — warnings and overrides', () => {
    beforeEach(() => {
      ctx.settings.returnWindowDays = 7;
      db.bill!.sb_bill_date = new Date('2026-04-01T00:00:00.000Z');
      row = srRow({ srReturnDate: new Date('2026-04-20T00:00:00.000Z') });
    });

    it('refuses an un-overridden warning on /post with a 422', async () => {
      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.RETURN_WINDOW, field: 'srBillId' }] },
      });
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('refuses an override sent by a user who may not override', async () => {
      const refusal = await refusalOf(
        service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.RETURN_WINDOW] }),
      );

      expect(refusal.status).toBe(422);
    });

    it('posts once a user who may override overrides the warning', async () => {
      ctx.rights.override = true;

      await service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.RETURN_WINDOW] });

      expect(lastSetStatus()[2]).toBe('POSTED');
    });
  });

  describe('post — the gates', () => {
    it('does nothing to a return that is already POSTED', async () => {
      row = srRow({ srStatus: 'POSTED' });

      await service.post(KEYS);

      expect(salesContext.resolve).not.toHaveBeenCalled();
      expect(stock.post).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });

    it('refuses a CANCELLED return with a 409', async () => {
      row = srRow({ srStatus: 'CANCELLED' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'srId', code: SALES_ERROR_CODES.DOC_CANCELLED }] },
      });
    });

    it('refuses a user without the Post right before touching the till', async () => {
      ctx.rights.post = false;

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_POST }] },
      });
      expect(till.resolveForMoney).not.toHaveBeenCalled();
    });

    it('answers every guard refusal at once with a 422 and posts nothing', async () => {
      row = srRow({ srCustId: null, srSettleMode: 'BARTER' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(422);
      expect(refusal.body.message).toBe('Sale return cannot be posted');
      expect(refusal.body.errors.map((e) => e.field)).toEqual(['srCustId', 'srSettleMode']);
      expect(stock.post).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });
  });

  describe('post — the till (D7 / notes 122)', () => {
    it('asks the till for the cash a CASH refund takes out of the drawer', async () => {
      row = srRow({ srSettleMode: 'CASH' });
      tenders = [tender(CASH, 400), tender(CASH, 100), tender(CREDIT, 90)];

      await service.post(KEYS);

      const [, scope] = till.resolveForMoney.mock.calls[0] as [
        unknown,
        { cashOut: Prisma.Decimal; sessionId: string; field: string },
      ];
      expect(scope).toMatchObject({ sessionId: SESSION_ID, field: 'srSessionId' });
      expect(scope.cashOut.equals(D(500))).toBe(true);
    });

    it('takes nothing out of the drawer for a return that is not refunded in cash', async () => {
      tenders = [tender(CASH, 590)];

      await service.post(KEYS);

      const [, scope] = till.resolveForMoney.mock.calls[0] as [
        unknown,
        { cashOut: Prisma.Decimal },
      ];
      expect(scope.cashOut.equals(0)).toBe(true);
      expect(store.loadTenders.mock.invocationCallOrder[0]).toBeGreaterThan(
        till.resolveForMoney.mock.invocationCallOrder[0],
      );
    });

    it('moves the return into the live session of the counter it is posted at', async () => {
      till.resolveForMoney.mockResolvedValue({
        tssId: LIVE_SESSION_ID,
        tssAccYear: ACC_YEAR,
        tssCounterId: LIVE_COUNTER_ID,
        tssDeviceId: 'till-2',
        tssOperatorId: USER_ID,
        businessDate: TODAY,
      });

      await service.post(KEYS);

      const values = tx.$executeRaw.mock.calls[0].slice(1) as unknown[];
      expect(values.slice(0, 3)).toEqual([LIVE_SESSION_ID, LIVE_COUNTER_ID, 'cashier1']);
      expect(till.stampTenderRows).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ tssId: LIVE_SESSION_ID }),
        { srcDocType: 'SALE_RETURN', srcDocId: SR_ID, accYear: ACC_YEAR },
        'cashier1',
      );
      expect(stock.post).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sessionId: LIVE_SESSION_ID }),
        USER_ID,
        expect.any(Date),
      );
    });

    it('does not rewrite the header when the return is already in that session', async () => {
      till.resolveForMoney.mockResolvedValue({
        tssId: SESSION_ID,
        tssAccYear: ACC_YEAR,
        tssCounterId: COUNTER_ID,
        tssDeviceId: 'till-1',
        tssOperatorId: USER_ID,
        businessDate: TODAY,
      });

      await service.post(KEYS);

      const headerUpdates = tx.$executeRaw.mock.calls.filter(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_return'),
      );
      expect(headerUpdates).toHaveLength(0);
      expect(till.stampTenderRows).toHaveBeenCalled();
    });
  });

  describe('post — what a posted return leaves behind', () => {
    const settlement = () => lastSetStatus()[3];
    const cnRow = () =>
      (tx.accBillBalance.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;

    it('brings the goods back into the bucket their condition says', async () => {
      items = [
        srItem(),
        srItem({ sriId: LINE_B, sriLineNo: 2, sriCondition: 'DAMAGED' }),
        srItem({ sriId: 'l3', sriLineNo: 3, sriCondition: 'SCRAP' }),
        srItem({ sriId: 'l4', sriLineNo: 4, sriCondition: 'EXPIRED', sriBucket: 'SALEABLE' }),
        srItem({ sriId: 'l5', sriLineNo: 5, sriIsService: true }),
      ];
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(10), returned: null }];

      await service.post(KEYS);

      const [, doc] = stock.post.mock.calls[0] as [
        unknown,
        { direction: string; txnType: string; lines: { lineId: string; bucket: string }[] },
      ];
      expect(doc).toMatchObject({ direction: 'IN', txnType: 'SALE_RETURN' });
      expect(doc.lines.map((l) => [l.lineId, l.bucket])).toEqual([
        [LINE_A, 'SALEABLE'],
        [LINE_B, 'DAMAGED'],
        ['l3', 'QUARANTINE'],
        ['l4', 'SALEABLE'],
      ]);
    });

    it('hands the leg builder the refund tenders only for a CASH return, and COGS only under PERPETUAL', async () => {
      ctx.cogsMode = 'PERIODIC';

      await service.post(KEYS);

      expect(buildReturnLegs).toHaveBeenCalledWith(
        expect.objectContaining({
          partyLedgerId: CUST_ID,
          supplyNature: 'INTRA',
          salesAmount: 500,
          tenders: [],
          cogsAmount: 0,
        }),
      );
    });

    it('posts the legs on an SRt voucher, with the device code only for a POS return', async () => {
      row = srRow({ srBillMode: 'POS' });

      await service.post(KEYS);

      expect(legs.postLegs).toHaveBeenCalledWith(tx, {
        header: expect.objectContaining({
          voucherTypeId: 18,
          srcDocType: 'SALE_RETURN',
          srcDocId: SR_ID,
          docAmount: 590,
          partyId: CUST_ID,
          deviceCode: 'till-1',
          presetRefno: 'srt00009',
          presetNo: 9n,
        }) as object,
        legs: [{ role: 'RETURN_LEGS' }],
      });
    });

    it('writes a CREDIT_NOTE register row with sign −1 and queues its IRN', async () => {
      await service.post(KEYS);

      expect(register.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          docType: 'CREDIT_NOTE',
          tranNature: 'SALES_RETURN',
          docSign: -1,
          docRefNo: 'bil00101',
          taxability: 'TAXABLE',
          billValue: 590,
        }),
        { companyEinvoiceFlag: false, interState: false },
      );
      expect(gst.enqueueAfterPost).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        einvoice: true,
        ewaybill: false,
      });
    });

    it('leaves an ADVANCE return as an open credit the customer holds', async () => {
      await service.post(KEYS);

      expect(cnRow()).toMatchObject({
        ablBillType: 'SALES_RETURN',
        ablSrcDocType: 'SALE_RETURN',
        ablSrcDocId: SR_ID,
        ablDrCr: 'CR',
        ablVoucherId: VOUCHER_ID,
        ablVoucherNo: 9n,
        ablBillAmount: D('590.00'),
        ablAllocAmount: D('0.00'),
      });
      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(settlement()).toMatchObject({
        srPostedVoucherId: VOUCHER_ID,
        srTotalCost: D('320.00'),
        srRefundAmt: D('0.00'),
        srAdjustedAmt: D('0.00'),
        srCreditAmt: D('590.00'),
        srSettleStatus: 'CREDITED',
      });
    });

    it('refunds a CASH return through its tenders, a credit tender excepted', async () => {
      row = srRow({ srSettleMode: 'CASH' });
      tenders = [tender(CASH, 590)];

      await service.post(KEYS);

      expect(buildReturnLegs).toHaveBeenCalledWith(
        expect.objectContaining({
          tenders: [expect.objectContaining({ tenderTypeId: CASH, amount: 590, isCredit: false })],
          cogsAmount: 320,
        }),
      );
      expect(cnRow()).toMatchObject({ ablAllocAmount: D('590.00') });
      expect(settlement()).toMatchObject({
        srRefundAmt: D('590.00'),
        srCreditAmt: D('0.00'),
        srSettleStatus: 'REFUNDED',
      });
    });

    it('calls a CASH return part-refunded to credit PARTIAL', async () => {
      row = srRow({ srSettleMode: 'CASH' });
      tenders = [tender(CASH, 400), tender(CREDIT, 190)];

      await service.post(KEYS);

      expect(settlement()).toMatchObject({
        srRefundAmt: D('400.00'),
        srCreditAmt: D('190.00'),
        srSettleStatus: 'PARTIAL',
      });
    });

    it('sets an ADJUST return off against the bill, keeping the set-offs the bill already has', async () => {
      row = srRow({ srSettleMode: 'ADJUST' });
      db.billAbl = {
        abl_id: BILL_ABL_ID,
        abl_pending_amount: D(1000),
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(1360),
      };
      db.liveAdjustments = [
        {
          abj_against_bill_id: OTHER_CN_ABL_ID,
          abj_against_bill_acc_year: `${ACC_YEAR} `,
          abj_amount: D(360),
        },
      ];

      await service.post(KEYS);

      const [, billCtx, adjustments, actor] = jest.mocked(syncBillAdjustments).mock.calls[0];
      expect(billCtx).toMatchObject({
        billId: BILL_ABL_ID,
        billAccYear: ACC_YEAR,
        partyId: CUST_ID,
        userId: USER_ID,
      });
      // The tenders alone: the allocation less the set-offs it already carries.
      expect(billCtx.paidAmount.equals(D(1000))).toBe(true);
      expect(adjustments).toEqual([
        { againstBillId: OTHER_CN_ABL_ID, againstBillAccYear: ACC_YEAR, amount: 360 },
        { againstBillId: CN_ABL_ID, againstBillAccYear: ACC_YEAR, amount: 590 },
      ]);
      expect(actor).toBe(USER_ID);
      expect(settlement()).toMatchObject({
        srAdjustedAmt: D('590.00'),
        srCreditAmt: D('0.00'),
        srSettleStatus: 'ADJUSTED',
      });
    });

    it('adjusts only what the bill still owes and leaves the rest as credit', async () => {
      row = srRow({ srSettleMode: 'ADJUST' });
      db.billAbl = {
        abl_id: BILL_ABL_ID,
        abl_pending_amount: D(200),
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(100),
      };
      db.liveAdjustments = [
        {
          abj_against_bill_id: OTHER_CN_ABL_ID,
          abj_against_bill_acc_year: ACC_YEAR,
          abj_amount: D(300),
        },
      ];

      await service.post(KEYS);

      const [, billCtx, adjustments] = jest.mocked(syncBillAdjustments).mock.calls[0];
      // Never below nothing paid.
      expect(billCtx.paidAmount.equals(0)).toBe(true);
      expect(adjustments?.at(-1)).toMatchObject({ againstBillId: CN_ABL_ID, amount: 200 });
      expect(settlement()).toMatchObject({
        srAdjustedAmt: D('200.00'),
        srCreditAmt: D('390.00'),
        srSettleStatus: 'PARTIAL',
      });
    });

    it('claws back the loyalty the returned share earned', async () => {
      db.bill = {
        ...db.bill,
        sb_loyalty_member_id: MEMBER_ID,
        sb_loyalty_earn_points: D(48),
        sb_taxable_amt: D(2000),
      };

      await service.post(KEYS);

      expect(loyalty.clawbackForReturn).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docId: SR_ID, memberId: MEMBER_ID, docRefno: 'srt00009' }),
        0.25,
        { earnedOnBill: 48, createdBy: USER_ID },
      );
      expect(settlement()).toMatchObject({ srLoyaltyReversePoints: D(12) });
    });

    it('claws back no loyalty when the bill earned none', async () => {
      await service.post(KEYS);

      expect(loyalty.clawbackForReturn).not.toHaveBeenCalled();
      expect(settlement()).toMatchObject({ srLoyaltyReversePoints: D(0) });
    });

    it("adds the return to the bill's returned amount under the operator's name", async () => {
      db.bill = { ...db.bill, sb_returned_amt: D('100.25') };

      await service.post(KEYS);

      const update = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill'),
      )!;
      expect(update.slice(1)).toEqual([
        690.25,
        690.25,
        expect.any(Date),
        'cashier1',
        BILL_ID,
        ACC_YEAR,
      ]);
    });

    it('reports the promotion benefit taken back, but only on a return against a bill', async () => {
      items = [srItem({ sriSchDiscAmt: D('10.10'), sriBillSchAmt: D('5.20') })];
      await service.post(KEYS);
      expect(settlement()).toMatchObject({ srPromoClawbackAmt: D('15.30') });

      store.setStatus.mockClear();
      row = srRow({ srBillId: null, srIsAgainstBill: false });
      await service.post(KEYS);
      expect(settlement()).toMatchObject({ srPromoClawbackAmt: D('0.00') });
    });

    it('marks the return POSTED last and leaves the trail', async () => {
      await service.post(KEYS);

      expect(lastSetStatus()[2]).toBe('POSTED');
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        TxnStatusEvent.POSTED,
        'DRAFT',
        'POSTED',
        USER_ID,
        expect.any(Date),
        null,
      );
      expect(store.auditChange).toHaveBeenCalledWith(
        tx,
        row,
        'approve',
        { srStatus: 'DRAFT' },
        expect.objectContaining({ srStatus: 'POSTED', gdrId: GDR_ID, credited: 590 }),
        USER_ID,
        'Sale return posted (voucher SRt31)',
      );
    });
  });

  describe('cancel', () => {
    const cancelDto = { ...KEYS, reason: 'Posted twice' };

    beforeEach(() => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });
    });

    it('answers a return already CANCELLED with its state and does nothing', async () => {
      row = srRow({ srStatus: 'CANCELLED' });

      await expect(service.cancel(cancelDto)).resolves.toEqual({
        id: SR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
        srStatus: 'CANCELLED',
      });
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('refuses a DRAFT: a draft is deleted, not cancelled', async () => {
      row = srRow();

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DOC_NOT_DRAFT }] },
      });
    });

    it('refuses a user without the Cancel right', async () => {
      ctx.rights.cancel = false;

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CANCEL }] },
      });
    });

    it('refuses once somebody has spent the credit note', async () => {
      db.creditApplied = 1n;

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'srId', code: SALES_ERROR_CODES.CN_APPLIED }] },
      });
      expect(legs.reverseLegs).not.toHaveBeenCalled();
    });

    it('refuses once the books for the return date are closed', async () => {
      jest.mocked(loadDayClosed).mockResolvedValue(true);

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DAY_CLOSED }] },
      });
    });

    it('refuses a credit-note IRN past its cancellation window', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: true, ewbLive: false });
      statutory.withinCancelWindow.mockResolvedValue({
        limit: null,
        within: false,
        hoursElapsed: 30,
      });

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'posting.irn',
              code: SALES_ERROR_CODES.IRN_WINDOW_PASSED,
              message:
                "The credit note IRN's cancellation window has passed — it cannot be cancelled now",
            },
          ],
        },
      });
      expect(gst.cancelIrn).not.toHaveBeenCalled();
    });

    it('cancels a live IRN and e-way bill inside their windows first', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: true, ewbLive: true });

      await service.cancel(cancelDto);

      const expected = {
        gdrId: GDR_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        reason: 'Posted twice',
      };
      expect(gst.cancelIrn).toHaveBeenCalledWith(expected);
      expect(gst.cancelEwb).toHaveBeenCalledWith(expected);
    });

    it('reverses everything the post did and retires the credit', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      row = srRow({
        srStatus: 'POSTED',
        srPostedVoucherId: VOUCHER_ID,
        srSettleMode: 'ADJUST',
        srReturnAmt: D(590),
      });
      db.bill = { ...db.bill, sb_returned_amt: D(590) };
      db.liveAdjustments = [
        { abj_against_bill_id: CN_ABL_ID, abj_against_bill_acc_year: ACC_YEAR, abj_amount: D(590) },
        {
          abj_against_bill_id: OTHER_CN_ABL_ID,
          abj_against_bill_acc_year: ACC_YEAR,
          abj_amount: D(100),
        },
      ];
      db.billAbl = { abl_id: BILL_ABL_ID, abl_bill_amount: D(2360), abl_alloc_amount: D(1690) };

      const result = await service.cancel(cancelDto);

      expect(legs.reverseLegs).toHaveBeenCalledWith(
        tx,
        VOUCHER_ID,
        ACC_YEAR,
        'Posted twice',
        USER_ID,
      );
      expect(stock.cancel).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docId: SR_ID, direction: 'IN', txnType: 'SALE_RETURN' }),
        USER_ID,
        'Posted twice',
        expect.any(Date),
      );
      expect(register.cancel).toHaveBeenCalledWith(tx, GDR_ID, ACC_YEAR, 'Posted twice', USER_ID);
      // The bill keeps every set-off but this note's; paid is the allocation less all of them.
      const [, billCtx, kept] = jest.mocked(syncBillAdjustments).mock.calls[0];
      expect(billCtx.paidAmount.equals(D(1000))).toBe(true);
      expect(kept).toEqual([
        { againstBillId: OTHER_CN_ABL_ID, againstBillAccYear: ACC_YEAR, amount: 100 },
      ]);
      const billUpdate = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill'),
      )!;
      expect(billUpdate.slice(1, 6)).toEqual([0, 0, 0, expect.any(Date), 'cashier1']);
      expect(tx.accBillBalance.update).toHaveBeenCalledWith({
        where: { ablId_ablAccYear: { ablId: CN_ABL_ID, ablAccYear: ACC_YEAR } },
        data: expect.objectContaining({
          ablIsActive: false,
          ablIsDeleted: true,
          ablNarration: 'Posted twice',
          ablModifiedBy: USER_ID,
        }) as object,
      });
      expect(loyalty.reverseForCancel).toHaveBeenCalledWith(
        tx,
        { docId: SR_ID, accYear: ACC_YEAR, docType: 'SALE_RETURN', docRefno: 'srt00009' },
        { reason: 'Posted twice', createdBy: USER_ID },
      );
      expect(promo.reverse).toHaveBeenCalledWith(
        tx,
        { docId: SR_ID, accYear: ACC_YEAR },
        'Posted twice',
        USER_ID,
      );
      expect(lastSetStatus()[2]).toBe('CANCELLED');
      expect(result).toMatchObject({ srStatus: 'CANCELLED', reversalVoucherRefno: 'srt-r-0002' });
    });

    it('refuses a live e-way bill past its cancellation window', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: true });
      statutory.withinCancelWindow.mockResolvedValue({
        limit: null,
        within: false,
        hoursElapsed: 30,
      });

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'posting.ewb', code: SALES_ERROR_CODES.EWB_WINDOW_PASSED }] },
      });
      expect(gst.cancelEwb).not.toHaveBeenCalled();
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('treats a live IRN with no generation time as past its window', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: true, ewbLive: false });
      blocks.gstRows.mockResolvedValue({ irnGeneratedOn: null, ewbGeneratedOn: null });

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.IRN_WINDOW_PASSED }),
      ]);
      expect(statutory.withinCancelWindow).not.toHaveBeenCalled();
    });

    it('has nothing to reverse on the books or the register when the post left neither', async () => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: null });

      const result = await service.cancel(cancelDto);

      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(register.cancel).not.toHaveBeenCalled();
      expect(stock.cancel).toHaveBeenCalled();
      expect(result).toMatchObject({ srStatus: 'CANCELLED', reversalVoucherRefno: null });
    });

    it('leaves the bill alone when the return was not against one, but still retires the credit', async () => {
      row = srRow({ srStatus: 'POSTED', srBillId: null, srIsAgainstBill: false });

      await service.cancel(cancelDto);

      expect(billReads()).toBe(0);
      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(tx.accBillBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ablId_ablAccYear: { ablId: CN_ABL_ID, ablAccYear: ACC_YEAR } },
        }),
      );
    });

    it("never takes the bill's returned amount below nothing", async () => {
      db.bill = { ...db.bill, sb_returned_amt: D(100) };

      await service.cancel(cancelDto);

      const billUpdate = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill'),
      )!;
      expect(billUpdate[1]).toBe(0);
    });

    it('retires no credit row when the post left none', async () => {
      tx.accBillBalance.findFirst.mockResolvedValue(null);

      await service.cancel(cancelDto);

      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(tx.accBillBalance.update).not.toHaveBeenCalled();
      expect(loyalty.reverseForCancel).toHaveBeenCalled();
    });

    it('marks it CANCELLED and files the reason on the trail and the audit', async () => {
      await service.cancel(cancelDto);

      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        TxnStatusEvent.CANCELLED,
        'POSTED',
        'CANCELLED',
        USER_ID,
        expect.any(Date),
        'Posted twice',
      );
      expect(store.auditChange).toHaveBeenCalledWith(
        tx,
        row,
        'cancel',
        { srStatus: 'POSTED' },
        { srStatus: 'CANCELLED' },
        USER_ID,
        'Sale return cancelled: Posted twice',
      );
    });
  });

  describe('amend', () => {
    const amendDto = (overrides: Record<string, unknown> = {}) =>
      ({
        ...KEYS,
        srCustId: CUST_ID,
        baseRevision: 1,
        editRemark: 'Wrong quantity',
        overrides: [],
        ...overrides,
      }) as never;

    beforeEach(() => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });
    });

    it.each([
      ['DRAFT', SALES_ERROR_CODES.DOC_NOT_DRAFT],
      ['CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED],
    ])('refuses a %s return', async (status, code) => {
      row = srRow({ srStatus: status });

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ code }] } });
    });

    it('refuses a user without the Amend right', async () => {
      ctx.rights.amend = false;

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_AMEND }] },
      });
    });

    it('refuses when sales.allow_posted_amend is off', async () => {
      ctx.settings.allowPostedAmend = false;

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.AMEND_OFF }] },
      });
    });

    it('refuses an amend built on a stale revision', async () => {
      const refusal = await refusalOf(service.amend(amendDto({ baseRevision: 3 })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'baseRevision', code: SALES_ERROR_CODES.REVISION_STALE }] },
      });
    });

    it('lets the declared-document lock refuse it', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(assertAmendable).mockRejectedValue(new HttpException('declared', 409));

      await expect(service.amend(amendDto())).rejects.toThrow('declared');
      expect(assertAmendable).toHaveBeenCalledWith(tx, GDR_ID);
      expect(legs.reverseLegs).not.toHaveBeenCalled();
    });

    it('unwinds, clears the settlement, saves over the same id and re-posts as the next revision', async () => {
      await service.amend(amendDto({ srReturnReason: 'Corrected' }));

      expect(store.setStatus.mock.calls[0].slice(2, 4)).toEqual([
        'DRAFT',
        {
          srPostedVoucherId: null,
          srRefundAmt: 0,
          srAdjustedAmt: 0,
          srCreditAmt: 0,
          srSettleStatus: 'PENDING',
          srLoyaltyReversePoints: 0,
          srPromoClawbackAmt: 0,
        },
      ]);
      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(saved).toMatchObject({ srId: SR_ID, srReturnReason: 'Corrected' });
      expect(saved).not.toHaveProperty('baseRevision');
      expect(saved).not.toHaveProperty('editRemark');
      expect(lastSetStatus()[3]).toMatchObject({ srRevisionNo: 2 });
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        TxnStatusEvent.AMENDED,
        'POSTED',
        'DRAFT',
        USER_ID,
        expect.any(Date),
        'Wrong quantity',
      );
      expect(gst.enqueueAfterPost).toHaveBeenCalledTimes(1);
    });

    it('refuses the amend when the new body fails the guards', async () => {
      store.saveDraft.mockImplementation(async (_tx: unknown, body: Record<string, unknown>) =>
        srRow({ ...body, srCustId: null }),
      );

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal.status).toBe(422);
      expect(refusal.body.message).toBe('Sale return cannot be amended');
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });

    it('words a passed IRN window for an amend', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: true, ewbLive: false });
      statutory.withinCancelWindow.mockResolvedValue({
        limit: null,
        within: false,
        hoursElapsed: 30,
      });

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.IRN_WINDOW_PASSED,
          message:
            "The credit note IRN's cancellation window has passed — it cannot be amended now",
        }),
      ]);
    });

    it('refuses once somebody has spent the credit note, before unwinding anything', async () => {
      db.creditApplied = 1n;

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.CN_APPLIED }),
      ]);
      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it('unwinds under an "Amended:" reason and audits the before and after', async () => {
      await service.amend(amendDto());

      expect(legs.reverseLegs).toHaveBeenCalledWith(
        tx,
        VOUCHER_ID,
        ACC_YEAR,
        'Amended: Wrong quantity',
        USER_ID,
      );
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        TxnStatusEvent.POSTED,
        'DRAFT',
        'POSTED',
        USER_ID,
        expect.any(Date),
        'Re-posted as revision 2',
      );
      expect(store.auditChange).toHaveBeenLastCalledWith(
        tx,
        expect.objectContaining({ srId: SR_ID }),
        'update',
        expect.objectContaining({ srStatus: 'POSTED' }),
        expect.objectContaining({ srId: SR_ID }),
        USER_ID,
        'Sale return amended to revision 2: Wrong quantity',
      );
    });
  });

  describe('transport', () => {
    const transportDto = {
      ...KEYS,
      transport: { transporterName: 'VRL', direction: 'OUTWARD' },
    } as never;

    it('refuses a CANCELLED return', async () => {
      row = srRow({ srStatus: 'CANCELLED' });

      const refusal = await refusalOf(service.transport(transportDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DOC_CANCELLED }] },
      });
    });

    it('always writes the band as INWARD, whatever the client sent', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);

      await service.transport(transportDto);

      expect(transportBand.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docType: 'SALE_RETURN', docId: SR_ID, docRefno: 'srt00009' }),
        { transporterName: 'VRL', direction: 'INWARD' },
        USER_ID,
        { gdrId: GDR_ID, now: expect.any(Date) },
      );
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        'TRANSPORT_EDITED',
        'DRAFT',
        'DRAFT',
        USER_ID,
        expect.any(Date),
        null,
      );
    });
  });
});
