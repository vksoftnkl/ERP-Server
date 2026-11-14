import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  addBillAdjustment,
  reverseBillAdjustmentsWith,
  syncBillAdjustments,
} from '../../../common/posting/bill-adjustment.helper';
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
import { SaleReturnService, SR_SPEC } from './sale-return.service';
import type { SaveSaleReturnDto } from './dto/save-sale-return.dto';
import { zeroParts, type BillChargeFacts, type LineParts } from './sale-return-money';
import type { UnwindAddBack } from './sale-return-bill-reader';

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
// The per-pair writers (S2): a return adds or takes back ONLY its own pair.
// syncBillAdjustments stays mocked so a test can prove it is never called —
// it would reverse and re-post every set-off the bill carries, re-stamping
// another note's Adjust at Post as if it were new.
jest.mock('../../../common/posting/bill-adjustment.helper', () => ({
  syncBillAdjustments: jest.fn(),
  addBillAdjustment: jest.fn(),
  reverseBillAdjustmentsWith: jest.fn(),
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
/** Another open bill of the same customer (popup 25's second row). */
const OTHER_BILL_ABL_ID = '019c6f6c-be87-7a11-8905-36092c46e017';
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

const D = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46e0a1';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46e0a2';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46e0a3';
/** One unit of the bill line. */
const PER_UNIT = {
  grossAmt: 500,
  netGross: 500,
  taxableAmt: 500,
  cgstAmt: 45,
  sgstAmt: 45,
  cogsAmt: 320,
};

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
  // Server-owned: a draft carries no session until /post stamps the device's.
  srSessionId: null,
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
    /** Bill balance rows by abl_id, for a test that sets off more than one bill. */
    billAblById: Record<string, Record<string, unknown>>;
    creditApplied: bigint;
    adjustedBills: Record<string, unknown>[];
    billLines: Record<string, unknown>[];
    /** The bill's charge rows, as the reader answers them. */
    billCharges: BillChargeFacts[];
    billTenderRows: Record<string, unknown>[];
    openBills: Record<string, unknown>[];
    approvals: Record<string, unknown>[];
    session: { status: string; sessionNo: string | null } | null;
    adjustedAtPost: { abl_id: string; abl_acc_year: string; abl_doc_refno?: string | null }[];
    returnedSum: Prisma.Decimal | null;
    /** Money Receipts allocated to the bill after it was raised (reader.receivedLater). */
    receivedLater: Prisma.Decimal;
    /** What the amend of a POSTED srId would unwind (reader.unwindAddBack); null = nothing posted. */
    unwound: UnwindAddBack | null;
    /** The saved return's own facts (savedFacts: customer, calc modes, settle mode); null = none saved. */
    saved: { cust: string | null; f: string | null; l: string | null; m: string | null } | null;
    /** The customer master row a no-bill return fills from (S5); null = not found. */
    customer: Record<string, unknown> | null;
  };
  /** The bill reader (sale-return-bill-reader.ts), answered from `db`. */
  let rd: Record<string, jest.Mock>;
  let chargeDetail: { syncDocumentCharges: jest.Mock };
  /** The tender writer: popup B's rows, and S1's drop of a non-refund's rows. */
  let tenderDetail: { syncDocumentTenders: jest.Mock };
  let approvals: {
    assessGate: jest.Mock;
    settleGate: jest.Mock;
    throwApprovalRequired: jest.Mock;
    withdrawForDocument: jest.Mock;
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
  let salesContext: {
    actor: jest.Mock;
    resolve: jest.Mock;
    rights: jest.Mock;
    settings: jest.Mock;
    values: jest.Mock;
  };
  let statutory: { creditNoteCutoff: jest.Mock; withinCancelWindow: jest.Mock };
  let legs: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let register: {
    registerIdOf: jest.Mock;
    write: jest.Mock;
    cancel: jest.Mock;
    retire: jest.Mock;
  };
  let stock: { post: jest.Mock; cancel: jest.Mock };
  let blocks: { build: jest.Mock; gstRows: jest.Mock };
  let transportBand: { write: jest.Mock };
  let loyalty: {
    clawbackForReturn: jest.Mock;
    reverseForCancel: jest.Mock;
    restoreRedeemForReturn: jest.Mock;
  };
  let promo: { reverse: jest.Mock };
  let gst: { enqueueAfterPost: jest.Mock; cancelIrn: jest.Mock; cancelEwb: jest.Mock };
  let till: { resolveForMoney: jest.Mock; stampTenderRows: jest.Mock };
  let audit: { logDocumentRevision: jest.Mock };
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
    // What the helper answers: the pair it posted / what came off the invoice.
    jest.mocked(addBillAdjustment).mockReset();
    jest.mocked(addBillAdjustment).mockImplementation(async (_tx, _ctx, adjustment) => ({
      againstBillId: adjustment.againstBillId,
      againstBillAccYear: adjustment.againstBillAccYear,
      amount: D(adjustment.amount),
      adjType: 'NOTE_ADJUST',
      settlementMode: 'CREDIT_NOTE',
    }));
    jest.mocked(reverseBillAdjustmentsWith).mockReset();
    jest.mocked(reverseBillAdjustmentsWith).mockResolvedValue(D(590));
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
      billAblById: {},
      creditApplied: 0n,
      adjustedBills: [],
      billLines: [],
      billCharges: [],
      // The bill was paid 2,360.00 in cash.
      billTenderRows: [
        {
          tdId: 'td-1',
          tenderId: 'tnd-cash',
          tenderTypeId: 1,
          name: 'Cash',
          ledgerId: 'ledger-1',
          amount: D(2360),
          unitsUsed: D(0),
          conversionRate: D(0),
        },
      ],
      openBills: [
        {
          ablId: BILL_ABL_ID,
          ablAccYear: ACC_YEAR,
          billType: 'SALES',
          refno: 'bil00101',
          docDate: TODAY,
          dueDate: TODAY,
          billAmount: D(2360),
          pending: D(2360),
          alloc: D(0),
          srcDocType: 'SALE_BILL',
          srcDocId: BILL_ID,
          srcAccYear: ACC_YEAR,
        },
      ],
      approvals: [],
      session: null,
      adjustedAtPost: [],
      returnedSum: null,
      receivedLater: D(0),
      unwound: null,
      saved: null,
      customer: null,
    };
    tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('sr_cust_id AS cust')) return db.saved ? [db.saved] : [];
        if (sql.includes('FROM sales.customers c')) return db.customer ? [db.customer] : [];
        // adjustedAtPost (OWN_ADJUST_AT_POST): the bills the note set off at its post.
        if (sql.includes('k.abl_created_on < n.abl_created_on')) return db.adjustedAtPost;
        if (sql.includes('SELECT SUM(sr_return_amt)')) return [{ amt: db.returnedSum }];
        if (sql.includes('FROM sales.sale_bill WHERE')) return db.bill ? [db.bill] : [];
        if (sql.includes('SELECT sb_returned_amt FROM sales.sale_bill'))
          return db.bill ? [{ sb_returned_amt: db.bill.sb_returned_amt }] : [];
        if (sql.includes('inventory.item_master WHERE')) return db.masters;
        if (sql.includes('AS "billItemId"')) return db.billLines;
        if (sql.includes('b.sbi_bill_qty AS sold')) return db.soldLines;
        if (sql.includes('COUNT(*) AS n')) return [{ n: db.creditApplied }];
        if (sql.includes('k.abl_doc_refno')) return db.adjustedBills;
        if (sql.includes('FROM accounts.acc_bill_balance')) {
          const one = db.billAblById[String(values[0])];
          if (one) return [one];
          return db.billAbl ? [db.billAbl] : [];
        }
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
      find: jest.fn(async () => row),
      findOrThrow: jest.fn(async () => row),
      deleteDraft: jest.fn().mockResolvedValue(undefined),
      loadItems: jest.fn(async () => items),
      loadCharges: jest.fn().mockResolvedValue([]),
      loadTenders: jest.fn(async () => tenders),
      loadTransport: jest.fn().mockResolvedValue(null),
      plain: jest.fn((r: Record<string, unknown>) => ({ ...r })),
      updateItem: jest.fn(
        async (_tx: unknown, item: Record<string, unknown>, data: Record<string, unknown>) => ({
          ...item,
          ...data,
        }),
      ),
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
      settings: jest.fn(async () => ctx.settings),
      values: jest.fn(async () => ({})),
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
      retire: jest.fn().mockResolvedValue(1),
      registerIdOf: jest.fn().mockResolvedValue(null),
      write: jest
        .fn()
        .mockResolvedValue({ gdrId: GDR_ID, einvoiceApplicable: true, ewaybillApplicable: false }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    stock = {
      // The engine books each line at the cost it was quoted (the bill's 320.00 a unit).
      post: jest.fn(
        async (
          _tx: unknown,
          doc: { lines: { lineId: string; qty: number; costRate: number | null }[] },
        ) => ({
          costByLine: new Map(
            doc.lines.map((l) => [l.lineId, Math.round(l.qty * (l.costRate ?? 0) * 100) / 100]),
          ),
          lotByLine: new Map(),
          cogsTotal: 320,
        }),
      ),
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
      restoreRedeemForReturn: jest.fn().mockResolvedValue({ rowsWritten: 0, pointsRestored: 0 }),
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
    chargeDetail = { syncDocumentCharges: jest.fn().mockResolvedValue([]) };
    tenderDetail = { syncDocumentTenders: jest.fn().mockResolvedValue([]) };
    let revNo = 0;
    audit = { logDocumentRevision: jest.fn(async () => ({ revNo: ++revNo })) };
    approvals = {
      assessGate: jest.fn(async () => ({ state: 'NONE' })),
      settleGate: jest.fn(async () => null),
      throwApprovalRequired: jest.fn(() => {
        throw new HttpException(
          { message: 'approval', errors: [{ code: 'TILL_APPROVAL_REQUIRED' }] },
          428,
        );
      }),
      withdrawForDocument: jest.fn(async () => ['tap-withdrawn']),
    };
    // One bill line per db.soldLines row, each unit 500.00 + 9 % + 9 %, cost 320.00.
    const partsOf = (q: Prisma.Decimal): LineParts => {
      const p = zeroParts();
      for (const [k, v] of Object.entries(PER_UNIT)) {
        p[k as keyof LineParts] = D(v).times(q);
      }
      return p;
    };
    const percent = {
      itemDiscPerc: D(0),
      splDiscPerc: D(0),
      schDiscPerc: D(0),
      billSchPerc: D(0),
      addlDisc1Perc: D(0),
      addlDisc2Perc: D(0),
      cashDiscPerc: D(0),
      taxPerc: D(18),
      cgstPerc: D(9),
      sgstPerc: D(9),
      igstPerc: D(0),
      cessPerc: D(0),
      acessPerc: D(0),
    };
    const lineOf = (l: { sbi_id: string; sold: Prisma.Decimal }, i: number) => ({
      billItemId: l.sbi_id,
      accYear: ACC_YEAR,
      lineNo: i + 1,
      itemId: ITEM_ID,
      itemUnitId: UNIT_ID,
      qty: l.sold,
      factor: D(1),
      parts: partsOf(l.sold),
      perUnit: {
        rate: D(500),
        ratePreTax: D(500),
        maxPrice: null,
        minPrice: null,
        actPrice: null,
        itemDiscQty: null,
        splDiscQty: null,
        schDiscQty: null,
        billSchQty: null,
        cessPerUnit: null,
        acessPerUnit: null,
      },
      percent,
      copy: {
        hsnCode: null,
        taxId: TAX_ID,
        isTaxIncl: false,
        isFree: false,
        freeType: null,
        isService: false,
        schemeId: null,
        schemeName: null,
        priceLevel: 1,
        eanCode: null,
        lotId: null,
        batchNo: null,
        batchDate: null,
        expiryDate: null,
        serialNo: null,
        salesmanId: null,
        promoUsageId: null,
        qtyPriceId: null,
        size: null,
        sizeUom: null,
      },
      itemName: 'Steel Tumbler',
      unitName: 'PCS',
      allowReturn: true,
      godownId: GODOWN_ID,
      unitWeight: null,
      lotBatchNo: null,
      lotExpiry: null,
      chrgAfterTax: D(0),
      netAmt: D(590).times(l.sold),
    });
    const billOf = (b: Record<string, unknown>) => ({
      sbId: b.sb_id,
      accYear: b.sb_acc_year,
      status: b.sb_status,
      refno: b.sb_bill_refno,
      date: (b.sb_bill_date as Date).toISOString().slice(0, 10),
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      billType: 'CREDIT',
      billMode: 'WHOLESALE',
      payMode: 'CREDIT',
      custId: b.sb_cust_id,
      custName: 'Acme Traders',
      custAddr: null,
      custPlace: null,
      custPin: null,
      custPhone: null,
      custGstin: null,
      custGstType: null,
      custStcd: null,
      posStcd: '33',
      stateName: null,
      priceLevel: 1,
      billAmt: b.sb_bill_amt,
      taxable: b.sb_taxable_amt,
      cashDisc: D(0),
      roundOff: D(0),
      roundOffStep: D(1),
      returnedAmt: b.sb_returned_amt,
      returnStatus: null,
      salesmanIds: [],
      loadmanIds: [],
      agentId: null,
      driverId: null,
      supervisorId: null,
      vehicleId: null,
      vehicleNo: null,
      hasFreight: false,
      hasLoad: false,
      hasUnload: false,
      freightCalcType: null,
      loadingCalcType: null,
      loyaltyMemberId: b.sb_loyalty_member_id,
      loyaltyEarnPoints: b.sb_loyalty_earn_points,
      agentCommAmt: D(0),
    });
    rd = {
      billHeader: jest.fn(async () => (db.bill ? billOf(db.bill) : null)),
      billLines: jest.fn(async () => db.soldLines.map(lineOf)),
      priorBack: jest.fn(
        async () =>
          new Map(
            db.soldLines
              .filter((l) => l.returned)
              .map((l) => [l.sbi_id, { base: l.returned!, parts: partsOf(l.returned!) }]),
          ),
      ),
      priorHeader: jest.fn(async () => ({
        roundOff: D(0),
        cashDisc: D(0),
        refund: D(0),
        pointsBackAmt: D(0),
        voucherShare: D(0),
        agentComm: D(0),
        loyaltyReversed: D(0),
        pointsBack: D(0),
      })),
      // D74 — the bill's EARN / REDEEM schemes; none by default (4 dp, as before).
      billLoyaltyRules: jest.fn(async () => ({ earn: null, redeem: null })),
      // N9 — the years the company may not write to; none by default.
      closedYears: jest.fn(async () => new Set<string>()),
      onDrafts: jest.fn(async () => new Map()),
      billCharges: jest.fn(async () => db.billCharges),
      units: jest.fn(
        async () =>
          new Map([
            [
              UNIT_ID,
              {
                itemUnitId: UNIT_ID,
                itemId: ITEM_ID,
                unitName: 'PCS',
                factor: D(1),
                weight: null,
                isBase: true,
              },
            ],
          ]),
      ),
      itemUnits: jest.fn(async () => new Map()),
      barcodes: jest.fn(async () => new Map()),
      lots: jest.fn(async () => new Map()),
      reason: jest.fn(async () => null),
      company: jest.fn(async () => ({ stateCode: '33', einvoice: false })),
      lastSale: jest.fn(async () => null),
      todayPrice: jest.fn(async () => ({
        rateWot: D(500),
        rate: D(590),
        taxId: TAX_ID,
        hsnCode: null,
        taxPerc: D(18),
        cessPerc: D(0),
        priceLevel: 1,
      })),
      returnCharges: jest.fn(async () => []),
      lockBillLines: jest.fn(async () => 1),
      lockBillCharges: jest.fn(async () => 0),
      billTenders: jest.fn(async () => ({
        money: D(0),
        points: D(0),
        pointsUnits: D(0),
        voucher: D(0),
        credit: D(2360),
      })),
      billDue: jest.fn(async () => D(2360)),
      billTenderRows: jest.fn(async () => db.billTenderRows),
      receivedLater: jest.fn(async () => db.receivedLater),
      // As the reader answers (its own spec proves it): each bill's pending plus
      // the add-back, a bill back at 0 dropped.
      openBills: jest.fn(
        async (_c: unknown, q: { addBack?: ReadonlyMap<string, Prisma.Decimal> | null }) =>
          db.openBills
            .map((b) => {
              const back = q.addBack?.get(String(b.ablId)) ?? D(0);
              return {
                ...b,
                pending: (b.pending as Prisma.Decimal).plus(back),
                alloc: (b.alloc as Prisma.Decimal).minus(back),
              };
            })
            .filter((b) => b.pending.gt(0)),
      ),
      unwindAddBack: jest.fn(async () => db.unwound),
      customerBalance: jest.fn(async () => D(5000)),
      approvalsOf: jest.fn(async () => db.approvals),
      sessionOf: jest.fn(async () => db.session),
      schemes: jest.fn(async () => new Map()),
      lineNames: jest.fn(async () => ({
        items: new Map([[ITEM_ID, 'Steel Tumbler']]),
        units: new Map([[UNIT_ID, 'PCS']]),
        godowns: new Map([[GODOWN_ID, 'Main Godown']]),
      })),
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
      audit as never,
      chargeDetail as never,
      tenderDetail as never,
      till as never,
      approvals as never,
    );
    // The document store is built inside the constructor; swap in the mock.
    (service as unknown as { store: unknown }).store = store;
    (service as unknown as { reader: unknown }).reader = rd;
  });

  const lastSetStatus = () =>
    store.setStatus.mock.calls.at(-1) as [unknown, unknown, string, Record<string, unknown>];
  const billReads = () => rd.billHeader.mock.calls.length;
  const refusalsOf = async (overrides: Record<string, unknown> = {}, lines = items) => {
    const result = await service.validate({
      ...srRow(),
      // The screen's total is checked only when it sends one (D45).
      srReturnAmt: undefined,
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

    it("keeps the client's bill refno, but the customer is always the bill's", async () => {
      await service.save(saveBody({ srBillRefno: 'typed', srCustId: 'someone-else' }));

      // The credit note is raised on the party the goods were sold to.
      expect(savedBody()).toMatchObject({ srBillRefno: 'typed', srCustId: CUST_ID });
    });

    it('writes the money it works out from the bill, never the money the client sent (D45)', async () => {
      await service.save(
        saveBody({
          srReturnAmt: 1,
          srTaxableAmt: 1,
          items: [srItem({ sriId: undefined, sriTaxableAmt: D(9999), sriNetAmt: D(9999) })],
        }),
      );

      const body = savedBody();
      expect(String(body.srReturnAmt)).toBe('590');
      expect(String(body.srTaxableAmt)).toBe('500');
      const [line] = body.items as Record<string, unknown>[];
      expect(String(line.sriTaxableAmt)).toBe('500');
      expect(String(line.sriNetAmt)).toBe('590');
      expect(String(line.sriCogsAmt)).toBe('320');
      expect(line).toMatchObject({
        sriBillItemId: BILL_LINE,
        sriRateSource: 'BILL',
        sriChrgAfterTax: D(0),
      });
    });

    it('numbers a new return from the device series (D16), not the voucher type', async () => {
      tx.$queryRaw.mockImplementationOnce(async () => []); // no row with that srId yet
      await service.save(saveBody());
      const hooks = store.saveDraft.mock.calls[0][4] as { numberFor: () => Promise<unknown> };

      expect(typeof hooks.numberFor).toBe('function');
    });

    it('refuses a new return without the Create right, and a draft re-save without Edit', async () => {
      ctx.rights.create = false;
      expect(await refusalOf(service.save(saveBody()))).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CREATE }] },
      });

      ctx.rights.create = true;
      ctx.rights.edit = false;
      tx.$queryRaw.mockImplementationOnce(async () => [{ sr_id: SR_ID }]);
      expect(await refusalOf(service.save(saveBody({ srId: SR_ID })))).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_EDIT }] },
      });
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it('works the money out from the stored lines when a re-save sends none', async () => {
      await service.save(saveBody({ srId: SR_ID, items: undefined }));

      expect(store.loadItems).toHaveBeenCalled();
      expect(String(savedBody().srReturnAmt)).toBe('590');
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

      expect(billReads()).toBeGreaterThan(0);
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

    it('names each line’s item, unit and godown (additive keys; a no-bill return reloads with them)', async () => {
      items = [
        srItem(),
        // a line whose godown is gone from the master: its name is null, the line stays
        srItem({ sriId: LINE_B, sriLineNo: 2, sriBillItemId: null, sriGodownId: 'gone' }),
      ];

      const result = (await service.get({
        id: SR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      })) as { items: Record<string, unknown>[] };

      expect(rd.lineNames).toHaveBeenCalledWith(tx, [
        { itemId: ITEM_ID, itemUnitId: UNIT_ID, godownId: GODOWN_ID },
        { itemId: ITEM_ID, itemUnitId: UNIT_ID, godownId: 'gone' },
      ]);
      expect(
        result.items.map((i) => [i.sriId, i.sriItemName, i.sriUnitName, i.sriGodownName]),
      ).toEqual([
        [LINE_A, 'Steel Tumbler', 'PCS', 'Main Godown'],
        [LINE_B, 'Steel Tumbler', 'PCS', null],
      ]);
      // every stored sri* key is still there
      expect(result.items[0]).toMatchObject({ sriItemId: ITEM_ID, sriReturnQty: D(1) });
    });
  });

  describe('bill-lines', () => {
    const q = { sbId: BILL_ID, sbAccYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

    it('answers the bill, each line with what is left in base units, and the charge rows', async () => {
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(4), returned: D(1) }];

      const out = (await service.billLines(q)) as {
        bill: Record<string, unknown>;
        lines: Record<string, unknown>[];
        charges: unknown[];
      };

      expect(out.bill).toMatchObject({ sbId: BILL_ID, refno: 'bil00101', due: 2360, refundCap: 0 });
      expect(out.lines[0]).toMatchObject({
        billItemId: BILL_LINE,
        billQty: 4,
        billQtyBase: 4,
        returnedQtyBase: 1,
        qtyLeftBase: 3,
        qtyLeft: 3,
        fullyReturned: false,
        taxableAmt: 2000,
        costPerBase: 320,
      });
      expect(out.charges).toEqual([]);
    });

    it('caps the refund by the money paid at the counter plus Receipts allocated since (user 11-13)', async () => {
      // A credit bill (billTenders.money 0) the customer paid 400.00 on by a Receipt.
      db.receivedLater = D(400);

      const out = (await service.billLines(q)) as { bill: Record<string, unknown> };

      expect(out.bill).toMatchObject({ receivedLater: 400, refundCap: 400 });
      expect(rd.receivedLater).toHaveBeenCalledWith(tx, expect.objectContaining({ sbId: BILL_ID }));
    });

    it('gives the due as the amend of a POSTED return on screen will see it: its own set-off back', async () => {
      db.unwound = { bills: new Map([[BILL_ABL_ID, D(590)]]), balance: D(590), partyId: CUST_ID };
      // Live, the bill owes 1,770.00; the reader adds the add-back for its receivable.
      rd.billDue.mockImplementation(
        async (_c: unknown, _b: unknown, back?: ReadonlyMap<string, Prisma.Decimal> | null) =>
          D(1770).plus(back?.get(BILL_ABL_ID) ?? 0),
      );

      const out = (await service.billLines({ ...q, srId: SR_ID })) as {
        bill: Record<string, unknown>;
      };

      expect(rd.unwindAddBack).toHaveBeenCalledWith(tx, SR_ID);
      expect(rd.billDue).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sbId: BILL_ID }),
        db.unwound.bills,
      );
      expect(out.bill).toMatchObject({ due: 2360 });
    });

    it('refuses a bill of another branch unless allBranches (D14), and a bill not posted', async () => {
      const other = { ...q, branchId: OTHER_BILL_LINE };
      expect((await refusalOf(service.billLines(other))).status).toBe(404);
      await expect(service.billLines({ ...other, allBranches: true })).resolves.toBeDefined();

      db.bill = { ...db.bill, sb_status: 'DRAFT' };
      expect(await refusalOf(service.billLines(q))).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED }] },
      });
    });

    it('needs the View right on menu 13', async () => {
      ctx.rights.view = false;
      expect(await refusalOf(service.billLines(q))).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_VIEW }] },
      });
    });
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
      const { refusals } = await refusalsOf(
        { srCustId: null, srIsAgainstBill: false, srBillId: null },
        [],
      );

      expect(refusals.map((r) => [r.field, r.code])).toEqual([
        ['srCustId', SALES_ERROR_CODES.CUSTOMER_REQUIRED],
        ['items', SALES_ERROR_CODES.RETURN_NO_LINES],
      ]);
    });

    it('refuses a total the screen shows that the server no longer agrees with (D45)', async () => {
      expect((await refusalsOf({ srReturnAmt: '590.00' })).refusals).toEqual([]);
      expect((await refusalsOf({ srReturnAmt: '591.00' })).refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.AMOUNT_MISMATCH, field: 'srReturnAmt' }),
      ]);
    });

    it('answers the preview the screen paints: lines, totals and charges, money from the bill', async () => {
      const result = (await service.validate({
        ...srRow(),
        items: [srItem({ sriTaxableAmt: D(1) })],
      } as unknown as SaveSaleReturnDto)) as { preview: Record<string, unknown> };

      expect(result.preview).toMatchObject({
        totals: {
          goods: 590,
          taxable: 500,
          cgst: 45,
          sgst: 45,
          roundOff: 0,
          creditNote: 590,
          cogs: 320,
        },
        lines: [
          expect.objectContaining({
            billItemId: BILL_LINE,
            taxableAmt: 500,
            takesRemainder: false,
          }),
        ],
        charges: [],
        emptiesBill: false,
      });
    });

    it('refuses a unit that is not one of the item’s, naming the line (D52)', async () => {
      const { refusals } = await refusalsOf({}, [srItem({ sriItemUnitId: OTHER_BILL_LINE })]);

      expect(refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.RETURN_UNIT, line: 1 }),
      ]);
    });

    it('needs the Create right', async () => {
      ctx.rights.create = false;
      expect(await refusalOf(refusalsOf())).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CREATE }] },
      });
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

    it("takes a scheme's free item back whatever sales.free_return_allowed says (D6)", async () => {
      ctx.settings.freeReturnAllowed = false;

      expect((await refusalsOf({}, [srItem({ sriIsFree: true })])).refusals).toEqual([]);
    });

    it('refuses a return with no bill when sales.free_return_allowed is off (D5)', async () => {
      ctx.settings.freeReturnAllowed = false;

      const { refusals } = await refusalsOf({ srIsAgainstBill: false, srBillId: null });

      expect(refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.RETURN_NO_BILL_OFF, field: 'srBillId' }),
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

      // Line 1 takes 1 of the 2 left; line 2 asks 2 of the 1 still left.
      expect(refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_OVER_QTY,
          line: 2,
          message: 'Line 2: 2 base units back, the bill line has 1 left (of 4)',
        }),
      ]);
    });

    it('refuses a line naming a bill line that is not on the bill', async () => {
      const { refusals } = await refusalsOf({}, [srItem({ sriBillItemId: OTHER_BILL_LINE })]);

      expect(refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_NOT_ON_BILL,
          line: 1,
          params: { bill: 'bil00101' },
        }),
      ]);
    });

    it('proposes Adjust this bill first, and leaves a settled bill’s note as credit (D1 / D2)', async () => {
      const proposed = (await service.validate({
        ...srRow({ srSettleMode: 'ADJUST' }),
        srReturnAmt: undefined,
        items,
      } as unknown as SaveSaleReturnDto)) as { preview: { settlement: Record<string, any> } };
      expect(proposed.preview.settlement).toMatchObject({
        mode: 'ADJUST',
        adjust: { adjustable: 590, adjusted: 590, leftAsCredit: 0 },
      });
      expect(proposed.preview.settlement.adjust.bills[0]).toMatchObject({
        ablId: BILL_ABL_ID,
        isThisBill: true,
        dueNow: 2360,
        adjustNow: 590,
        dueAfter: 1770,
      });

      db.openBills = [];
      const { refusals } = await refusalsOf({ srSettleMode: 'ADJUST' });
      expect(refusals).toEqual([]);
    });

    it('refuses a split over a bill’s due or the note, and a bill whose due moved (D2)', async () => {
      const over = await refusalsOf({
        srSettleMode: 'ADJUST',
        adjustments: [{ ablId: BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 600 }],
      });
      expect(over.refusals.map((r) => r.code)).toEqual([SALES_ERROR_CODES.RETURN_ADJUST_OVER]);

      const stale = await refusalsOf({
        srSettleMode: 'ADJUST',
        adjustments: [{ ablId: BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 100, dueNow: 2000 }],
      });
      expect(stale.refusals.map((r) => r.code)).toEqual([SALES_ERROR_CODES.RETURN_ADJUST_STALE]);
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

    it('refunds by cash, UPI or bank only, UPI / bank with their reference, and never over the money paid (D3 / D33)', async () => {
      const refund = (rows: Record<string, unknown>[]) =>
        refusalsOf({ srSettleMode: 'CASH', tenders: rows });

      // A part refund is fine: the rest stays a credit note (D34).
      expect((await refund([{ tdTenderTypeId: CASH, tdAmount: 500 }])).refusals).toEqual([]);
      expect(
        (await refund([{ tdTenderTypeId: CREDIT, tdAmount: 100 }])).refusals.map((r) => r.code),
      ).toEqual([SALES_ERROR_CODES.RETURN_REFUND_TENDER]);
      expect(
        (await refund([{ tdTenderTypeId: 3, tdAmount: 100 }])).refusals.map((r) => r.code),
      ).toEqual([SALES_ERROR_CODES.RETURN_REFUND_REF]);
      expect(
        (await refund([{ tdTenderTypeId: 3, tdAmount: 100, tdRefNo: 'UTR1' }])).refusals,
      ).toEqual([]);
      // The bill was paid 2,360.00 in cash; a 590.00 note refunds at most 590.00.
      expect((await refund([{ tdTenderTypeId: CASH, tdAmount: 600 }])).refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID,
          params: { value: '590.00' },
        }),
      ]);
      // A bill paid on credit was paid nothing in money: no refund at all.
      db.billTenderRows = [];
      expect(
        (await refund([{ tdTenderTypeId: CASH, tdAmount: 1 }])).refusals.map((r) => r.code),
      ).toEqual([SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID]);
    });

    it('counts Receipts allocated to a credit bill since in the refund cap, less earlier refunds (user 11-13)', async () => {
      // Paid on credit, then 400.00 by a Receipt; an earlier return refunded 150.00.
      db.billTenderRows = [];
      db.receivedLater = D(400);
      rd.priorHeader.mockResolvedValue({
        roundOff: D(0),
        cashDisc: D(0),
        refund: D(150),
        pointsBackAmt: D(0),
        voucherShare: D(0),
        agentComm: D(0),
      });
      const refund = async (amount: number) =>
        (await service.validate({
          ...srRow(),
          srReturnAmt: undefined,
          items,
          srSettleMode: 'CASH',
          tenders: [{ tdTenderTypeId: CASH, tdAmount: amount }],
        } as unknown as SaveSaleReturnDto)) as {
          refusals: { code: string; params?: unknown }[];
          preview: { settlement: { refund: Record<string, unknown> } };
        };

      const ok = await refund(250);
      expect(ok.refusals).toEqual([]);
      expect(ok.preview.settlement.refund).toMatchObject({
        paidInMoney: 400,
        receivedLater: 400,
        refundedBefore: 150,
        cap: 250,
        refundable: 250,
        refunded: 250,
      });

      expect((await refund(250.01)).refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID,
          params: { value: '250.00' },
        }),
      ]);

      // A Receipt later cancelled nets to nothing: back to no money paid.
      db.receivedLater = D(0);
      expect((await refund(1)).refusals.map((r) => r.code)).toEqual([
        SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID,
      ]);
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

    it('matches a line that names no bill line to the only bill line of its item', async () => {
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(1), returned: null }];

      const { refusals } = await refusalsOf({}, [
        srItem(),
        srItem({ sriId: LINE_B, sriLineNo: 2, sriBillItemId: null, sriReturnQty: D(5) }),
      ]);

      expect(refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.RETURN_OVER_QTY, line: 2 }),
      ]);
    });

    it('proposes a credit note when no settle mode is set and there is no bill to adjust (D4)', async () => {
      const result = (await service.validate({
        ...srRow({ srSettleMode: null, srIsAgainstBill: false, srBillId: null }),
        srReturnAmt: undefined,
        items: [srItem({ sriBillItemId: null })],
      } as unknown as SaveSaleReturnDto)) as {
        ok: boolean;
        preview: { settlement: { mode: string } };
      };

      expect(result.preview.settlement.mode).toBe('ADVANCE');
    });

    it('refuses Adjust on a return with no bill (SALES_RETURN_SETTLE_MODE)', async () => {
      const { refusals } = await refusalsOf(
        { srSettleMode: 'ADJUST', srIsAgainstBill: false, srBillId: null },
        [srItem({ sriBillItemId: null })],
      );

      expect(refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_SETTLE_MODE,
          field: 'srSettleMode',
        }),
      ]);
    });
  });

  describe('/validate of an amend (srId names a POSTED return)', () => {
    type Preview = {
      ok: boolean;
      refusals: { code: string; field?: string }[];
      preview: { settlement: Record<string, any>; customerBalance: Record<string, any> };
    };
    const amendPreview = async (overrides: Record<string, unknown> = {}) =>
      (await service.validate({
        ...srRow({ srSettleMode: 'ADJUST' }),
        srReturnAmt: undefined,
        items,
        ...overrides,
      } as unknown as SaveSaleReturnDto)) as Preview;

    beforeEach(() => {
      // The posted return set 590.00 of its note off against the bill at its
      // post: the bill owes 1,770.00 live; the note itself owes nothing.
      db.openBills = [{ ...db.openBills[0], pending: D(1770), alloc: D(590) }];
      db.unwound = {
        bills: new Map([[BILL_ABL_ID, D(590)]]),
        balance: D(590),
        partyId: CUST_ID,
      };
    });

    it('builds Adjust on the bills as the amend’s unwind leaves them: the full due, its proposal and caps', async () => {
      const out = await amendPreview();

      expect(rd.unwindAddBack).toHaveBeenCalledWith(tx, SR_ID);
      expect(rd.openBills).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ addBack: db.unwound!.bills, lock: false }),
      );
      expect(out.preview.settlement.adjust).toMatchObject({
        proposed: true,
        adjustable: 590,
        adjusted: 590,
        leftAsCredit: 0,
      });
      expect(out.preview.settlement.adjust.bills).toEqual([
        expect.objectContaining({
          ablId: BILL_ABL_ID,
          isThisBill: true,
          dueNow: 2360,
          adjustNow: 590,
          dueAfter: 1770,
        }),
      ]);
      // The customer's balance as the unwind leaves it, then after the amend.
      expect(out.preview.customerBalance).toEqual({ before: 5590, after: 5000 });
    });

    it('takes popup 25’s split at the figure it showed, and the strict dueNow check still refuses the live one', async () => {
      const shown = await amendPreview({
        adjustments: [{ ablId: BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 590, dueNow: 2360 }],
      });
      expect(shown.refusals).toEqual([]);

      const live = await amendPreview({
        adjustments: [{ ablId: BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 590, dueNow: 1770 }],
      });
      expect(live.refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.RETURN_ADJUST_STALE,
          field: 'adjustments[0].dueNow',
        }),
      ]);
    });

    it('lists again a bill this return cleared in full', async () => {
      // A 590.00 bill the posted return emptied: pending 0 live, so only the
      // add-back brings it into the list (the reader matches it by id).
      db.openBills = [{ ...db.openBills[0], billAmount: D(590), pending: D(0), alloc: D(590) }];

      const out = await amendPreview();

      expect(out.preview.settlement.adjust.bills).toEqual([
        expect.objectContaining({
          ablId: BILL_ABL_ID,
          dueNow: 590,
          adjustNow: 590,
          dueAfter: 0,
        }),
      ]);
    });

    it('adds no balance back for another customer', async () => {
      db.unwound = { ...db.unwound!, partyId: OTHER_BILL_LINE };

      const out = await amendPreview();

      expect(out.preview.customerBalance).toEqual({ before: 5000, after: 4410 });
    });

    it('previews a draft or a first post exactly as before: the live figures', async () => {
      db.unwound = null;
      db.openBills = [{ ...db.openBills[0], pending: D(2360), alloc: D(0) }];

      const out = await amendPreview();

      expect(rd.openBills).toHaveBeenCalledWith(tx, expect.objectContaining({ addBack: null }));
      expect(out.preview.settlement.adjust.bills[0]).toMatchObject({
        dueNow: 2360,
        adjustNow: 590,
      });
      expect(out.preview.customerBalance).toEqual({ before: 5000, after: 4410 });
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

  describe('post — the bill-line lock and the money (D45 / D51)', () => {
    it('locks the bill lines and charge rows before it reads what other returns took', async () => {
      await service.post(KEYS);

      expect(rd.lockBillLines).toHaveBeenCalledWith(tx, { sbId: BILL_ID, accYear: ACC_YEAR });
      expect(rd.lockBillCharges).toHaveBeenCalledWith(tx, { sbId: BILL_ID, accYear: ACC_YEAR });
      const locked = rd.lockBillLines.mock.invocationCallOrder[0];
      expect(locked).toBeLessThan(rd.lockBillCharges.mock.invocationCallOrder[0]);
      expect(locked).toBeLessThan(rd.priorBack.mock.invocationCallOrder[0]);
      // The return being posted never counts itself.
      expect(rd.priorBack).toHaveBeenCalledWith(tx, expect.anything(), SR_ID);
    });

    it('locks nothing on a return with no bill', async () => {
      row = srRow({ srBillId: null, srIsAgainstBill: false });

      await service.post(KEYS);

      expect(rd.lockBillLines).not.toHaveBeenCalled();
    });

    it('refuses a draft whose saved total the money no longer agrees with, and posts nothing', async () => {
      // Another return of the bill posted since this one was saved: 2 of 4 left.
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(4), returned: D(3) }];
      items = [srItem({ sriReturnQty: D(1) })];
      row = srRow({ srReturnAmt: D(600) });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.AMOUNT_MISMATCH, field: 'srReturnAmt' }] },
      });
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('writes the money back onto the lines, then posts the goods at the bill line’s cost (D54)', async () => {
      await service.post(KEYS);

      expect(store.updateItem).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sriId: LINE_A }),
        expect.objectContaining({ sriRateSource: 'BILL', sriCogsAmt: D(320) }),
      );
      const [, doc] = stock.post.mock.calls[0] as [
        unknown,
        { lines: { costRate: number | null; toBaseFactor: number }[] },
      ];
      expect(doc.lines[0]).toMatchObject({ costRate: 320, toBaseFactor: 1 });
      expect(String(lastSetStatus()[3].srTotalCost)).toBe('320');
    });

    it('settles to the paisa in Decimal: refund + adjusted + credit + points back = the return (ck_sr_settle_sum)', async () => {
      row = srRow({ srSettleMode: 'CASH' });
      tenders = [tender(CASH, 400)];

      await service.post(KEYS);

      const st = lastSetStatus()[3] as Record<string, Prisma.Decimal>;
      expect(
        st.srRefundAmt
          .plus(st.srAdjustedAmt)
          .plus(st.srCreditAmt)
          .plus(st.srPointsBackAmt)
          .toString(),
      ).toBe('590');
      expect(st.srPointsBackAmt.toString()).toBe('0');
    });
  });

  describe('post — P2b: the gate, claims, points, financial mode', () => {
    it('refuses with 428 under REFUSE until an approval is brought, and posts nothing (D26 / D67)', async () => {
      approvals.assessGate.mockImplementation(async (_c: unknown, ask: { event: string }) =>
        ask.event === 'SALE_RETURN'
          ? { state: 'REFUSE', need: { minRole: 'STORE_MANAGER' } }
          : { state: 'NONE' },
      );

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(428);
      expect(approvals.throwApprovalRequired).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event: 'SALE_RETURN',
          srcDocType: 'SALE_RETURN',
          srcDocId: SR_ID,
        }),
      );
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('asks SALE_CLAIM for a claim, RETURN_NO_RECEIPT with no bill, REFUND_CASH on the cash out (D26)', async () => {
      row = srRow({
        srReturnKind: 'CLAIM',
        srBillId: null,
        srIsAgainstBill: false,
        srSettleMode: 'CASH',
      });
      items = [srItem({ sriBillItemId: null, sriClaimGoods: 'BACK', sriCondition: 'EXPIRED' })];
      tenders = [tender(CASH, 590)];

      await service.post(KEYS);

      const events = approvals.assessGate.mock.calls.map(([, a]) => [a.event, Number(a.amount)]);
      expect(events).toEqual([
        ['SALE_RETURN', 590],
        ['SALE_CLAIM', 590],
        ['RETURN_NO_RECEIPT', 590],
        ['REFUND_CASH', 590],
      ]);
      // Each verdict is settled after the post (WARN files a review; D72: not in the trail).
      expect(approvals.settleGate).toHaveBeenCalledTimes(4);
    });

    it('takes the latest APPROVED, unused request of this return when the client brings none', async () => {
      db.approvals = [
        {
          tapId: 'tap-used',
          event: 'SALE_RETURN',
          status: 'APPROVED',
          amount: D(590),
          usedOn: '2026-11-13',
        },
        { tapId: 'tap-ok', event: 'SALE_RETURN', status: 'APPROVED', amount: D(590), usedOn: null },
      ];

      await service.post(KEYS);

      expect(approvals.assessGate.mock.calls[0][1]).toMatchObject({
        event: 'SALE_RETURN',
        approvalId: 'tap-ok',
      });
    });

    it('S2: attaches no approval smaller than the amount now judged, so the gate asks again', async () => {
      // Approved at 500.00; the claim has since grown to 590.00.
      db.approvals = [
        {
          tapId: 'tap-small',
          event: 'SALE_RETURN',
          status: 'APPROVED',
          amount: D(500),
          usedOn: null,
        },
      ];
      approvals.assessGate.mockImplementation(
        async (_c: unknown, ask: { approvalId: string | null }) =>
          ask.approvalId
            ? { state: 'APPROVED', tapId: ask.approvalId }
            : { state: 'REFUSE', need: {} },
      );

      const { status, body } = await refusalOf(service.post(KEYS));

      expect(approvals.assessGate.mock.calls[0][1]).toMatchObject({
        event: 'SALE_RETURN',
        approvalId: null,
      });
      // Under REFUSE: 428, ask again — never 422 TILL_APPROVAL_INVALID on the small one.
      expect(status).toBe(428);
      expect(body.errors[0]).toMatchObject({ code: 'TILL_APPROVAL_REQUIRED' });
      expect(store.setStatus).not.toHaveBeenCalled();
    });

    it('S2: attaches an approval of at least the amount, the newest such first', async () => {
      db.approvals = [
        {
          tapId: 'tap-small',
          event: 'SALE_RETURN',
          status: 'APPROVED',
          amount: D(100),
          usedOn: null,
        },
        {
          tapId: 'tap-big',
          event: 'SALE_RETURN',
          status: 'APPROVED',
          amount: D(600),
          usedOn: null,
        },
      ];

      await service.post(KEYS);

      expect(approvals.assessGate.mock.calls[0][1]).toMatchObject({ approvalId: 'tap-big' });
    });

    it('S2: under WARN a grown claim files a fresh review instead of using the smaller approval', async () => {
      db.approvals = [
        {
          tapId: 'tap-small',
          event: 'SALE_RETURN',
          status: 'APPROVED',
          amount: D(500),
          usedOn: null,
        },
      ];
      approvals.assessGate.mockImplementation(
        async (_c: unknown, ask: { approvalId: string | null }) =>
          ask.approvalId
            ? { state: 'APPROVED', tapId: ask.approvalId }
            : { state: 'WARN', need: {} },
      );

      await service.post(KEYS);

      expect(approvals.settleGate).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ event: 'SALE_RETURN', approvalId: null }),
        { state: 'WARN', need: {} },
      );
      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('refuses a claim line that says neither Back nor Destroyed (SALES_RETURN_CLAIM_GOODS)', async () => {
      const { refusals } = await refusalsOf({ srReturnKind: 'CLAIM' });

      expect(refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.RETURN_CLAIM_GOODS, line: 1 }),
      ]);
    });

    it('brings no stock back for a claim line destroyed at the shop, and takes no COGS back for it (D23)', async () => {
      row = srRow({ srReturnKind: 'CLAIM' });
      items = [
        srItem({ sriClaimGoods: 'DESTROYED' }),
        srItem({
          sriId: LINE_B,
          sriLineNo: 2,
          sriClaimGoods: 'BACK',
          sriCondition: 'EXPIRED',
          sriBucket: 'EXPIRED',
        }),
      ];
      row = srRow({ srReturnKind: 'CLAIM', srReturnAmt: D(1180) });

      await service.post(KEYS);

      const [, doc] = stock.post.mock.calls[0] as [
        unknown,
        { lines: { lineId: string; bucket: string }[] },
      ];
      expect(doc.lines.map((l) => [l.lineId, l.bucket])).toEqual([[LINE_B, 'EXPIRED']]);
      expect(String(lastSetStatus()[3].srTotalCost)).toBe('320');
    });

    it('marks a claim line BACK for the supplier and into EXPIRED / DAMAGED when it is saved (D23)', async () => {
      await service.save({
        ...KEYS,
        srId: undefined,
        srReturnKind: 'CLAIM',
        srBillId: BILL_ID,
        srBillAccYear: ACC_YEAR,
        items: [
          srItem({ sriId: undefined, sriClaimGoods: 'BACK', sriCondition: 'RESTOCK' }),
          srItem({
            sriId: undefined,
            sriLineNo: 2,
            sriClaimGoods: 'BACK',
            sriCondition: 'EXPIRED',
          }),
        ],
      } as unknown as SaveSaleReturnDto);

      const body = store.saveDraft.mock.calls[0][1] as { items: Record<string, unknown>[] };
      expect(body.items.map((i) => [i.sriClaimGoods, i.sriSupplierClaim, i.sriBucket])).toEqual([
        ['BACK', true, 'DAMAGED'],
        ['BACK', true, 'EXPIRED'],
      ]);
    });

    it('classes a DESTROYED claim line DAMAGED / EXPIRED when it is saved, never SALEABLE, with no supplier mark (D23, S: bug 5)', async () => {
      await service.save({
        ...KEYS,
        srId: undefined,
        srReturnKind: 'CLAIM',
        srBillId: BILL_ID,
        srBillAccYear: ACC_YEAR,
        items: [
          // a client-sent SALEABLE (or the column default) does not stand
          srItem({
            sriId: undefined,
            sriClaimGoods: 'DESTROYED',
            sriCondition: 'DAMAGED',
            sriBucket: 'SALEABLE',
          }),
          srItem({
            sriId: undefined,
            sriLineNo: 2,
            sriClaimGoods: 'DESTROYED',
            sriCondition: 'EXPIRED',
          }),
          srItem({
            sriId: undefined,
            sriLineNo: 3,
            sriClaimGoods: 'DESTROYED',
            sriCondition: 'RESTOCK',
          }),
        ],
      } as unknown as SaveSaleReturnDto);

      const body = store.saveDraft.mock.calls[0][1] as { items: Record<string, unknown>[] };
      expect(body.items.map((i) => [i.sriClaimGoods, i.sriSupplierClaim, i.sriBucket])).toEqual([
        ['DESTROYED', false, 'DAMAGED'],
        ['DESTROYED', false, 'EXPIRED'],
        ['DESTROYED', false, 'DAMAGED'],
      ]);
    });

    it('saves a RETURN line into the bucket its condition says, ignoring a bucket the client sends (D12, user 11-14)', async () => {
      await service.save({
        ...KEYS,
        srId: undefined,
        srBillId: BILL_ID,
        srBillAccYear: ACC_YEAR,
        items: [
          srItem({ sriId: undefined, sriCondition: 'RESTOCK', sriBucket: undefined }),
          srItem({ sriId: undefined, sriLineNo: 2, sriCondition: 'DAMAGED', sriBucket: undefined }),
          srItem({ sriId: undefined, sriLineNo: 3, sriCondition: 'EXPIRED', sriBucket: undefined }),
          srItem({ sriId: undefined, sriLineNo: 4, sriCondition: 'SCRAP', sriBucket: undefined }),
          // the client's bucket is ignored
          srItem({
            sriId: undefined,
            sriLineNo: 5,
            sriCondition: 'DAMAGED',
            sriBucket: 'QUARANTINE',
          }),
          srItem({
            sriId: undefined,
            sriLineNo: 6,
            sriCondition: 'RESTOCK',
            sriBucket: 'DAMAGED',
          }),
          // a claim mark on a RETURN is dropped
          srItem({
            sriId: undefined,
            sriLineNo: 7,
            sriCondition: 'DAMAGED',
            sriClaimGoods: 'DESTROYED',
          }),
        ],
      } as unknown as SaveSaleReturnDto);

      const body = store.saveDraft.mock.calls[0][1] as { items: Record<string, unknown>[] };
      expect(body.items.map((i) => [i.sriBucket, i.sriClaimGoods])).toEqual([
        ['SALEABLE', null],
        ['DAMAGED', null],
        ['EXPIRED', null],
        ['QUARANTINE', null],
        ['DAMAGED', null],
        ['SALEABLE', null],
        ['DAMAGED', null],
      ]);
    });

    it('leaves a DESTROYED claim line out of the stock the preview shows coming back (D23)', async () => {
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(10), returned: null }];
      const result = (await service.validate({
        ...srRow({ srReturnKind: 'CLAIM' }),
        srReturnAmt: undefined,
        items: [
          srItem({ sriClaimGoods: 'DESTROYED', sriCondition: 'DAMAGED', sriReturnQty: D(2) }),
          srItem({
            sriId: LINE_B,
            sriLineNo: 2,
            sriClaimGoods: 'BACK',
            sriCondition: 'EXPIRED',
            sriReturnQty: D(1),
          }),
        ],
      } as unknown as SaveSaleReturnDto)) as { preview: { stockByBucket: unknown[] } };

      expect(result.preview.stockByBucket).toEqual([
        expect.objectContaining({ bucket: 'EXPIRED', lines: 1 }),
      ]);
    });

    it('gives the points share back as points and keeps it out of the credit (D48)', async () => {
      db.bill = { ...db.bill, sb_loyalty_member_id: MEMBER_ID };
      // The 2,360.00 bill: 472.00 in points (944 units, 0.50 a point), the rest cash.
      db.billTenderRows = [
        {
          tdId: 't1',
          tenderId: 'c',
          tenderTypeId: 1,
          name: 'Cash',
          ledgerId: 'l1',
          amount: D(1888),
          unitsUsed: D(0),
          conversionRate: D(0),
        },
        {
          tdId: 't2',
          tenderId: 'p',
          tenderTypeId: 10,
          name: 'Points',
          ledgerId: null,
          amount: D(472),
          unitsUsed: D(944),
          conversionRate: D('0.5'),
        },
      ];
      loyalty.restoreRedeemForReturn.mockResolvedValue({ rowsWritten: 1, pointsRestored: 236 });

      await service.post(KEYS);

      // 590.00 × 472 / 2,360 = 118.00 of points: 236 points at 0.50.
      expect(loyalty.restoreRedeemForReturn).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docId: SR_ID, memberId: MEMBER_ID }),
        { billId: BILL_ID, billAccYear: ACC_YEAR, refno: 'bil00101' },
        236,
        { approvedBy: USER_ID, createdBy: USER_ID },
      );
      const st = lastSetStatus()[3] as Record<string, Prisma.Decimal>;
      expect([String(st.srPointsBackAmt), String(st.srPointsBack), String(st.srCreditAmt)]).toEqual(
        ['118', '236', '472'],
      );
      const note = (tx.accBillBalance.create.mock.calls[0][0] as { data: Record<string, unknown> })
        .data;
      expect(note).toMatchObject({ ablAllocAmount: D(118) });
      expect(buildReturnLegs).toHaveBeenCalledWith(
        expect.objectContaining({
          tenders: [expect.objectContaining({ isLoyalty: true, amount: 118 })],
        }),
      );
    });

    it('posts a FINANCIAL credit note past the cut-off only when the override holder ticks SALES_RETURN_FINANCIAL (D8)', async () => {
      statutory.creditNoteCutoff.mockResolvedValue({
        passed: true,
        cutoff: '2026-11-30',
        limit: {
          code: 'GST_CN_CUTOFF',
          valueText: '30 Nov',
          effectiveFrom: '2017-07-01',
          isCompanyOverride: false,
          enforce: 'REFUSE',
        },
      });
      expect((await refusalOf(service.post(KEYS))).body.errors.map((e) => e.code)).toEqual([
        SALES_ERROR_CODES.CREDIT_NOTE_CUTOFF,
      ]);

      ctx.rights.override = true;
      jest.mocked(buildReturnLegs).mockImplementation(
        () =>
          [
            { ledgerId: CUST_ID, drCr: 'CR', amount: 590 },
            { role: 'SALES_RETURN', roleTag: 'SALES_RETURN', drCr: 'DR', amount: 500 },
            { role: 'OUTPUT_CGST', roleTag: 'OUTPUT_CGST', drCr: 'DR', amount: 45 },
            { role: 'OUTPUT_SGST', roleTag: 'OUTPUT_SGST', drCr: 'DR', amount: 45 },
          ] as never,
      );
      await service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.RETURN_FINANCIAL] });

      const [, voucher] = legs.postLegs.mock.calls.at(-1) as [
        unknown,
        { legs: { roleTag?: string; drCr: string; amount: number }[] },
      ];
      expect(voucher.legs.filter((l) => (l.roleTag ?? '').startsWith('OUTPUT_'))).toEqual([]);
      expect(voucher.legs).toContainEqual(
        expect.objectContaining({ roleTag: 'CLAIMS_ALLOWED', drCr: 'DR', amount: 90 }),
      );
      expect(register.write).not.toHaveBeenCalled();
      expect(lastSetStatus()[3]).toMatchObject({ srGstMode: 'FINANCIAL' });
      jest.mocked(buildReturnLegs).mockImplementation(() => [{ role: 'RETURN_LEGS' }] as never);
    });
  });

  describe('save — a request PENDING freezes the return (D77)', () => {
    it('refuses a re-save while an approval request of it is PENDING', async () => {
      db.approvals = [
        { tapId: 'tap-1', event: 'SALE_CLAIM', status: 'PENDING', requestedOn: new Date() },
      ];

      const refusal = await refusalOf(
        service.save({ ...KEYS, items: [srItem()] } as unknown as SaveSaleReturnDto),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.RETURN_APPROVAL_PENDING }] },
      });
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it('refuses to delete a draft while a request of it is PENDING (it would strand the request)', async () => {
      db.approvals = [
        { tapId: 'tap-1', event: 'SALE_CLAIM', status: 'PENDING', requestedOn: new Date() },
      ];

      expect(await refusalOf(service.delete(KEYS))).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.RETURN_APPROVAL_PENDING }] },
      });
      expect(store.deleteDraft).not.toHaveBeenCalled();
    });

    it('answers /get with the requests and the document locked while one is PENDING', async () => {
      db.approvals = [
        {
          tapId: 'tap-1',
          accYear: ACC_YEAR,
          event: 'SALE_CLAIM',
          status: 'PENDING',
          amount: D(590),
          requestedOn: new Date(),
        },
      ];

      const got = (await service.get({
        id: SR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      })) as {
        locks: { editable: { document: boolean } };
        approvals: { tapId: string; status: string }[];
      };

      expect(got.locks.editable.document).toBe(false);
      expect(got.approvals).toEqual([
        expect.objectContaining({ tapId: 'tap-1', status: 'PENDING', event: 'SALE_CLAIM' }),
      ]);
    });
  });

  describe('post — the till (D7 / notes 122)', () => {
    it('asks the till for the cash a CASH refund takes out of the drawer', async () => {
      row = srRow({ srSettleMode: 'CASH' });
      tenders = [tender(CASH, 400), tender(CASH, 100)];

      await service.post(KEYS);

      const [, scope] = till.resolveForMoney.mock.calls[0] as [
        unknown,
        { cashOut: Prisma.Decimal; sessionId: string; field: string },
      ];
      expect(scope).toMatchObject({ sessionId: null, field: 'srSessionId' });
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
      // S1 — the refund rows a Credit note carries are dropped BEFORE the till
      // stamps the live rows into its session.
      expect(tenderDetail.syncDocumentTenders).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ tdSrcDocType: 'SALE_RETURN', tdSrcDocId: SR_ID }),
        [],
        USER_ID,
        expect.anything(),
      );
      expect(tenderDetail.syncDocumentTenders.mock.invocationCallOrder[0]).toBeLessThan(
        till.resolveForMoney.mock.invocationCallOrder[0],
      );
    });

    it("S1: leaves a Refund's rows alone, and writes nothing for a credit note that has none", async () => {
      tenders = [tender(CASH, 590)];
      row = srRow({ srSettleMode: 'CASH' });
      await service.post(KEYS);
      expect(tenderDetail.syncDocumentTenders).not.toHaveBeenCalled();

      jest.clearAllMocks();
      tenders = [];
      row = srRow({ srSettleMode: 'ADVANCE' });
      await service.post(KEYS);
      expect(tenderDetail.syncDocumentTenders).not.toHaveBeenCalled();
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
      row = srRow({ srSessionId: SESSION_ID });
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

    // S: bug 6 — the session is the server's (resolveForMoney), never the client's.
    it('never asks the till for the session the draft names: the posting device decides it', async () => {
      row = srRow({ srSessionId: SESSION_ID, srSettleMode: 'CASH' });
      tenders = [tender(CASH, 590)];
      till.resolveForMoney.mockResolvedValue({
        tssId: LIVE_SESSION_ID,
        tssAccYear: ACC_YEAR,
        tssCounterId: LIVE_COUNTER_ID,
        tssDeviceId: 'till-1',
        tssOperatorId: USER_ID,
        businessDate: TODAY,
      });

      await service.post(KEYS);

      expect(till.resolveForMoney).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sessionId: null }),
      );
      // stamped over whatever the draft held, header and tender rows alike
      const header = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('SET sr_session_id  ='),
      )!;
      expect(header.slice(1, 3)).toEqual([LIVE_SESSION_ID, LIVE_COUNTER_ID]);
      expect(till.stampTenderRows).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ tssId: LIVE_SESSION_ID }),
        expect.objectContaining({ srcDocId: SR_ID }),
        'cashier1',
      );
      expect(legs.postLegs).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          header: expect.objectContaining({ sessionId: LIVE_SESSION_ID }) as object,
        }),
      );
    });

    it('posts in no session on a device the till does not govern, clearing an id the draft carried', async () => {
      // e.g. a draft saved before the id became server-owned, naming a made-up session
      row = srRow({ srSessionId: SESSION_ID, srSettleMode: 'CASH' });
      tenders = [tender(CASH, 590)];

      await service.post(KEYS);

      const sqlOf = (c: unknown[]) => (c[0] as string[]).join('?');
      const cleared = tx.$executeRaw.mock.calls.filter((c) =>
        sqlOf(c).includes('SET sr_session_id = NULL'),
      );
      const tendersCleared = tx.$executeRaw.mock.calls.filter((c) =>
        sqlOf(c).includes('UPDATE accounts.acc_tender_detail'),
      );
      expect(cleared).toHaveLength(1);
      expect(cleared[0].slice(1)).toEqual(['cashier1', SR_ID, ACC_YEAR]);
      expect(tendersCleared).toHaveLength(1);
      expect(sqlOf(tendersCleared[0])).toContain('SET td_session_id = NULL');
      expect(till.stampTenderRows).not.toHaveBeenCalled();
      expect(stock.post).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sessionId: null }),
        USER_ID,
        expect.any(Date),
      );
      expect(legs.postLegs).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ header: expect.objectContaining({ sessionId: null }) as object }),
      );
    });

    it('writes nothing about the session for a draft with none on an ungoverned device', async () => {
      await service.post(KEYS);

      expect(
        tx.$executeRaw.mock.calls.filter(([strings]) =>
          (strings as string[]).join('?').includes('sr_session_id'),
        ),
      ).toHaveLength(0);
    });

    it('keeps a client-sent srSessionId out of the save: the store drops every server-owned key', () => {
      // SalesDocStore.saveDraft deletes spec.serverOwned from the body before it
      // writes (sales-doc-store.spec: "Server-owned columns never come from the body").
      expect(SR_SPEC.serverOwned).toContain('srSessionId');
    });

    it('judges the /validate gate preview with no session, whatever the client sends', async () => {
      await service.validate({
        ...srRow({ srSessionId: SESSION_ID }),
        srReturnAmt: undefined,
        items,
      } as unknown as SaveSaleReturnDto);

      const asks = approvals.assessGate.mock.calls.map(([, ask]) => ask as { sessionId: unknown });
      expect(asks.length).toBeGreaterThan(0);
      expect(asks.every((a) => a.sessionId === null)).toBe(true);
    });
  });

  describe('post — what a posted return leaves behind', () => {
    const settlement = () => lastSetStatus()[3];
    const cnRow = () =>
      (tx.accBillBalance.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;

    it('brings the goods back into the bucket their condition says, whatever bucket the line holds (D12)', async () => {
      items = [
        srItem(),
        srItem({ sriId: LINE_B, sriLineNo: 2, sriCondition: 'DAMAGED' }),
        srItem({ sriId: 'l3', sriLineNo: 3, sriCondition: 'SCRAP' }),
        // the column default (or an old client bucket) does not stand: the condition decides
        srItem({ sriId: 'l4', sriLineNo: 4, sriCondition: 'EXPIRED', sriBucket: 'SALEABLE' }),
      ];
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(10), returned: null }];
      row = srRow({ srReturnAmt: D(2360) });

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
        ['l4', 'EXPIRED'],
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

    it('posts the legs on an SRt voucher under its own refno and the company serial', async () => {
      row = srRow({ srBillMode: 'POS' });

      await service.post(KEYS);

      expect(legs.postLegs).toHaveBeenCalledWith(tx, {
        header: expect.objectContaining({
          voucherTypeId: 18,
          srcDocType: 'SALE_RETURN',
          srcDocId: SR_ID,
          docAmount: 590,
          partyId: CUST_ID,
          // The per-device refno is the voucher's; its serial is NOT a presetNo
          // (ux_avh_voucher_no has no device in it).
          deviceCode: null,
          presetRefno: 'srt00009',
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
        ablVoucherNo: 31n,
        ablBillAmount: D('590.00'),
        ablAllocAmount: D('0.00'),
      });
      expect(addBillAdjustment).not.toHaveBeenCalled();
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

    it('calls a CASH return part-refunded PARTIAL; the rest stays a credit note (D34)', async () => {
      row = srRow({ srSettleMode: 'CASH' });
      tenders = [tender(CASH, 400)];

      await service.post(KEYS);

      expect(settlement()).toMatchObject({
        srRefundAmt: D('400.00'),
        srCreditAmt: D('190.00'),
        srSettleStatus: 'PARTIAL',
      });
      expect(cnRow()).toMatchObject({ ablAllocAmount: D(400) });
    });

    it('sets an ADJUST return off against the bill, keeping the set-offs the bill already has', async () => {
      row = srRow({ srSettleMode: 'ADJUST' });
      db.openBills = [{ ...db.openBills[0], pending: D(1000) }];
      // The bill already carries another note's 360.00 set-off and 1,000.00 tendered.
      db.billAbl = {
        abl_id: BILL_ABL_ID,
        abl_acc_year: `${ACC_YEAR} `,
        abl_branch_id: BRANCH_ID,
        abl_pending_amount: D(1000),
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(1360),
      };

      await service.post(KEYS);

      // ONE pair, this note's: never the whole list re-synced (S2 — a re-sync
      // reverses and re-posts the other note's 360.00, re-stamping it as new).
      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(reverseBillAdjustmentsWith).not.toHaveBeenCalled();
      expect(addBillAdjustment).toHaveBeenCalledTimes(1);
      const [txArg, billCtx, pair, actor, now] = jest.mocked(addBillAdjustment).mock.calls[0];
      expect(txArg).toBe(tx);
      expect(billCtx).toMatchObject({
        billId: BILL_ABL_ID,
        // The year comes back trimmed (char(9) is blank-padded).
        billAccYear: ACC_YEAR,
        accYear: ACC_YEAR,
        branchId: BRANCH_ID,
        companyId: COMPANY_ID,
        partyId: CUST_ID,
        userId: USER_ID,
        // an ungoverned device: no till session
        sessionId: null,
      });
      expect(pair).toEqual({
        againstBillId: CN_ABL_ID,
        againstBillAccYear: ACC_YEAR,
        amount: expect.any(Prisma.Decimal),
        remarks: 'Adjusted at post of return srt00009',
      });
      // Decimal from the plan to the row (house money rule), never a float.
      expect(String(pair.amount)).toBe('590');
      expect(actor).toBe(USER_ID);
      expect(now).toBeInstanceOf(Date);
      // The bill's own balance row is moved by the helper alone, by the pair:
      // the service never rewrites its allocation (which holds the 360.00).
      expect(
        tx.accBillBalance.update.mock.calls.filter(
          ([a]) =>
            (a as { where: { ablId_ablAccYear: { ablId: string } } }).where.ablId_ablAccYear
              .ablId === BILL_ABL_ID,
        ),
      ).toHaveLength(0);
      expect(settlement()).toMatchObject({
        srAdjustedAmt: D('590.00'),
        srCreditAmt: D('0.00'),
        srSettleStatus: 'ADJUSTED',
      });
    });

    it('adjusts only what the bills still owe and leaves the rest as credit', async () => {
      row = srRow({ srSettleMode: 'ADJUST' });
      db.openBills = [{ ...db.openBills[0], pending: D(200) }];
      // Owed 200.00 when it is read under its lock, whatever the plan asked for.
      db.billAbl = {
        abl_id: BILL_ABL_ID,
        abl_acc_year: ACC_YEAR,
        abl_branch_id: BRANCH_ID,
        abl_pending_amount: D(200),
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(2160),
      };

      await service.post(KEYS);

      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(addBillAdjustment).toHaveBeenCalledTimes(1);
      const [, , pair] = jest.mocked(addBillAdjustment).mock.calls[0];
      expect(pair.againstBillId).toBe(CN_ABL_ID);
      expect(String(pair.amount)).toBe('200');
      expect(settlement()).toMatchObject({
        srAdjustedAmt: D('200.00'),
        srCreditAmt: D('390.00'),
        srSettleStatus: 'PARTIAL',
      });
    });

    it('sets nothing off against a bill that owes nothing by the time it is locked', async () => {
      row = srRow({ srSettleMode: 'ADJUST' });
      db.openBills = [{ ...db.openBills[0], pending: D(200) }];
      // Another counter settled it between the plan and the lock.
      db.billAbl = {
        ...(db.billAbl as object),
        abl_branch_id: BRANCH_ID,
        abl_pending_amount: D(0),
      };

      await service.post(KEYS);

      expect(addBillAdjustment).not.toHaveBeenCalled();
      expect(settlement()).toMatchObject({ srAdjustedAmt: D(0), srCreditAmt: D('590.00') });
    });

    it('adjusts the customer’s other open bills after this one, in the order popup 25 sent (D1)', async () => {
      row = srRow({ srSettleMode: 'ADJUST' });
      const other = {
        ...db.openBills[0],
        ablId: OTHER_BILL_ABL_ID,
        refno: 'bil00090',
        srcDocId: 'other-bill',
        pending: D(400),
      };
      db.openBills = [{ ...db.openBills[0], pending: D(300) }, other];
      const ablRow = (id: string, pending: number) => ({
        abl_id: id,
        abl_acc_year: ACC_YEAR,
        abl_branch_id: BRANCH_ID,
        abl_pending_amount: D(pending),
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(2360 - pending),
      });
      db.billAblById = {
        [BILL_ABL_ID]: ablRow(BILL_ABL_ID, 300),
        [OTHER_BILL_ABL_ID]: ablRow(OTHER_BILL_ABL_ID, 400),
      };

      await service.post({
        ...KEYS,
        adjustments: [
          { ablId: BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 300 },
          { ablId: OTHER_BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 250 },
        ],
      });

      // One pair per bill, in popup 25's order, each naming this note only.
      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(
        jest
          .mocked(addBillAdjustment)
          .mock.calls.map(([, c, a]) => [c.billId, a.againstBillId, String(a.amount)]),
      ).toEqual([
        [BILL_ABL_ID, CN_ABL_ID, '300'],
        [OTHER_BILL_ABL_ID, CN_ABL_ID, '250'],
      ]);
      expect(settlement()).toMatchObject({
        srAdjustedAmt: D(550),
        srCreditAmt: D(40),
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

      // N3 — the preview's figure (48 × 500 / 2,000 of LINE taxable = 12),
      // handed over whole; the wallet still caps it.
      expect(loyalty.clawbackForReturn).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docId: SR_ID, memberId: MEMBER_ID, docRefno: 'srt00009' }),
        1,
        { earnedOnBill: 12, createdBy: USER_ID },
      );
      expect(settlement()).toMatchObject({ srLoyaltyReversePoints: D(12) });
    });

    it('claws back no loyalty when the bill earned none', async () => {
      await service.post(KEYS);

      expect(loyalty.clawbackForReturn).not.toHaveBeenCalled();
      expect(settlement()).toMatchObject({ srLoyaltyReversePoints: D(0) });
    });

    it("rewrites the bill's return fields from every posted return, under the operator's name (D76)", async () => {
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(4), returned: D(1) }];
      db.returnedSum = D('690.25');
      row = srRow({ srReturnAmt: D(590) });

      await service.post(KEYS);

      const lineUpdate = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill_item SET sbi_return_qty'),
      )!;
      expect(String(lineUpdate[1])).toBe('1');
      const update = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill SET'),
      )!;
      expect(
        update.slice(1).map((v: unknown) => (v instanceof Prisma.Decimal ? Number(v) : v)),
      ).toEqual([690.25, 'PARTIAL', expect.any(Date), 'cashier1', BILL_ID, ACC_YEAR]);
    });

    it('reports the promotion benefit taken back, but only on a return against a bill', async () => {
      // The scheme discount is the BILL line's share now (D45), not the client's.
      db.soldLines = [{ sbi_id: BILL_LINE, sold: D(4), returned: null }];
      const plain = rd.billLines.getMockImplementation()!;
      rd.billLines.mockImplementation(async (...args: unknown[]) => {
        const [l] = (await plain(...args)) as { parts: Record<string, Prisma.Decimal> }[];
        l.parts.schDiscAmt = D('40.40');
        l.parts.billSchAmt = D('20.80');
        return [l];
      });
      await service.post(KEYS);
      expect(String(settlement().srPromoClawbackAmt)).toBe('15.3');

      store.setStatus.mockClear();
      row = srRow({ srBillId: null, srIsAgainstBill: false });
      await service.post(KEYS);
      expect(String(settlement().srPromoClawbackAmt)).toBe('0');
    });

    it('marks the return POSTED last and leaves the trail', async () => {
      await service.post(KEYS);

      expect(lastSetStatus()[2]).toBe('POSTED');
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ srId: SR_ID }),
        TxnStatusEvent.POSTED,
        'DRAFT',
        'POSTED',
        USER_ID,
        expect.any(Date),
        null,
      );
      expect(store.auditChange).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ srId: SR_ID }),
        'approve',
        { srStatus: 'DRAFT' },
        expect.objectContaining({ srStatus: 'POSTED', gdrId: GDR_ID, credited: 590 }),
        USER_ID,
        'Sale return posted (voucher SRt31)',
      );
    });
  });

  // P0 matrix M8 (plan-sale-return-qt-2026-11-13-v5 §4.4), now with the
  // charges mirrored from the BILL (D46): one of the bill line's 4 units comes
  // back, so each after-tax charge gives back a quarter (value basis, D71).
  describe("post — P0 M8: a return carrying the bill's after-tax deduction", () => {
    const CD_LEDGER = 'led-cash-disc';
    const actual = jest.requireActual<typeof import('../posting/sales-leg.sources')>(
      '../posting/sales-leg.sources',
    );
    const billCharge = (over: Partial<BillChargeFacts>): BillChargeFacts => ({
      cdId: OTHER_CN_ABL_ID,
      accYear: ACC_YEAR,
      chgId: 'chg',
      name: 'CD - AFTER TAX',
      type: 'DEDUCT',
      beforeTax: false,
      sepPost: false,
      taxApl: false,
      method: 'FIXED',
      role: 'CASH_DISC',
      applyOn: null,
      ledgerId: CD_LEDGER,
      ledgerName: 'Cash discount',
      taxCode: null,
      hsn: null,
      unit: null,
      taxPerc: D(0),
      cgstPerc: D(0),
      sgstPerc: D(0),
      igstPerc: D(0),
      cessPerc: D(0),
      onBill: { amount: D('47.20'), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
      backBefore: { amount: D(0), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
      ...over,
    });

    it('posts the carried deduction CR on its ledger, and the party credit is lower by it', async () => {
      // 500.00 + 45.00 + 45.00 back, less a quarter of the bill's 47.20 (11.80):
      // 578.20, rounded to the rupee as the bill was (578.00).
      db.billCharges = [billCharge({})];
      row = srRow({ srReturnAmt: D('578.00') });

      await service.post(KEYS);

      const input = jest.mocked(buildReturnLegs).mock.calls[0][0];
      const built = actual.buildReturnLegs(input);
      const side = (s: 'DR' | 'CR') =>
        Math.round(built.filter((l) => l.drCr === s).reduce((t, l) => t + l.amount, 0) * 100) / 100;
      expect(built[0]).toMatchObject({ ledgerId: CUST_ID, drCr: 'CR', amount: 578 });
      expect(built.filter((l) => l.ledgerId === CD_LEDGER)).toEqual([
        expect.objectContaining({ drCr: 'CR', amount: 11.8 }),
      ]);
      expect(side('DR')).toBe(side('CR'));
      expect(register.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ discountValue: 11.8, otherCharge: 0, billValue: 578 }),
        expect.anything(),
      );
      // The return's own charge row: positive, the bill's type, keyed to the bill row.
      const [, , rows] = chargeDetail.syncDocumentCharges.mock.calls[0] as [
        unknown,
        unknown,
        Record<string, unknown>[],
      ];
      expect(rows).toEqual([
        expect.objectContaining({
          cdType: 'DEDUCT',
          cdAmount: '11.8',
          cdSrcCdId: OTHER_CN_ABL_ID,
          cdCarryBasis: 'PRORATA',
        }),
      ]);
    });

    it('gives a charge with its own GST back with that GST, in the legs and net in the register (gap 36, P0 R1)', async () => {
      // FREIGHT 400.00 + 24 + 24 on the bill → 100.00 + 6.00 + 6.00 back; the
      // CD after tax with GST 118.00 + 7.08 + 7.08 → 29.50 + 1.77 + 1.77 back.
      db.billCharges = [
        billCharge({
          cdId: 'cd-freight',
          name: 'FREIGHT CHARGE',
          type: 'ADD',
          taxApl: true,
          sepPost: true,
          role: 'FREIGHT',
          ledgerId: 'led-freight',
          taxCode: TAX_ID,
          onBill: { amount: D(400), cgst: D(24), sgst: D(24), igst: D(0), cess: D(0) },
        }),
        billCharge({
          taxApl: true,
          taxCode: TAX_ID,
          onBill: { amount: D(118), cgst: D('7.08'), sgst: D('7.08'), igst: D(0), cess: D(0) },
        }),
      ];
      // 590.00 + 112.00 − 33.04 = 668.96 → 669.00.
      row = srRow({ srReturnAmt: D('669.00') });

      await service.post(KEYS);

      const input = jest.mocked(buildReturnLegs).mock.calls[0][0];
      const built = actual.buildReturnLegs(input);
      const side = (s: 'DR' | 'CR') =>
        Math.round(built.filter((l) => l.drCr === s).reduce((t, l) => t + l.amount, 0) * 100) / 100;
      expect(built[0]).toMatchObject({ ledgerId: CUST_ID, drCr: 'CR', amount: 669 });
      expect(side('DR')).toBe(side('CR'));
      // SALES_RETURN is the goods: taxable 570.50 (500 + 100 − 29.50) less both own-ledger charges.
      expect(input.salesAmount).toBe(500);
      const cgst = (dc: string) =>
        built
          .filter((l) => l.roleTag === 'OUTPUT_CGST' && l.drCr === dc)
          .reduce((t, l) => t + l.amount, 0);
      expect(Math.round(cgst('DR') * 100) / 100).toBe(51);
      expect(cgst('CR')).toBe(1.77);
      expect(register.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ otherCharge: 100, discountValue: 29.5, taxableValue: 570.5 }),
        expect.anything(),
      );
    });

    it('takes an unticked addition back as nothing, and a deduction back whatever the tick (D70)', async () => {
      db.billCharges = [
        billCharge({
          cdId: 'cd-freight',
          type: 'ADD',
          role: 'FREIGHT',
          ledgerId: 'led-freight',
          onBill: { amount: D(400), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
        }),
        billCharge({}),
      ];
      rd.returnCharges.mockResolvedValue([
        {
          cdId: 'r1',
          cdSrcCdId: 'cd-freight',
          cdSrcAccYear: ACC_YEAR,
          cdCarryBasis: 'NONE',
          cdAmount: D(0),
          cdCarriedAmt: D(0),
        },
        {
          cdId: 'r2',
          cdSrcCdId: OTHER_CN_ABL_ID,
          cdSrcAccYear: ACC_YEAR,
          cdCarryBasis: 'NONE',
          cdAmount: D(0),
          cdCarriedAmt: D(0),
        },
      ]);
      row = srRow({ srReturnAmt: D('578.00') });

      await service.post(KEYS);

      const [, , rows] = chargeDetail.syncDocumentCharges.mock.calls[0] as [
        unknown,
        unknown,
        Record<string, unknown>[],
      ];
      expect(rows.map((r) => [r.cdSrcCdId, r.cdAmount, r.cdCarryBasis])).toEqual([
        ['cd-freight', '0', 'NONE'],
        [OTHER_CN_ABL_ID, '11.8', 'PRORATA'],
      ]);
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

    it('refuses to cancel a refund booked in a till session that no longer takes money (gap 33 / D32)', async () => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID, srRefundAmt: D(100) });
      db.session = { status: 'CLOSED', sessionNo: 'S-12' };

      expect(await refusalOf(service.cancel(cancelDto))).toMatchObject({
        status: 409,
        body: {
          errors: [{ code: SALES_ERROR_CODES.RETURN_REFUND_SESSION_CLOSED, status: 'CLOSED' }],
        },
      });

      // A session still OPEN / SUSPENDED takes the money back; an ungoverned counter is not checked.
      for (const session of [{ status: 'SUSPENDED', sessionNo: 'S-12' }, null]) {
        db.session = session;
        await expect(service.cancel(cancelDto)).resolves.toMatchObject({ srStatus: 'CANCELLED' });
      }
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
      // The bill also carries OTHER_CN's 100.00, set off before or after this note.
      db.billAbl = {
        abl_id: BILL_ABL_ID,
        abl_acc_year: `${ACC_YEAR} `,
        abl_branch_id: BRANCH_ID,
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(1690),
      };
      // The bill this note set itself off against at post (D1).
      db.adjustedAtPost = [{ abl_id: BILL_ABL_ID, abl_acc_year: `${ACC_YEAR} ` }];

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
      // Only THIS note's pair comes off the bill: the other note's 100.00 is
      // never reversed and re-posted (S2), so it keeps its own moment.
      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(addBillAdjustment).not.toHaveBeenCalled();
      expect(reverseBillAdjustmentsWith).toHaveBeenCalledTimes(1);
      expect(reverseBillAdjustmentsWith).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          billId: BILL_ABL_ID,
          billAccYear: ACC_YEAR,
          accYear: ACC_YEAR,
          branchId: BRANCH_ID,
          partyId: CUST_ID,
          userId: USER_ID,
        }),
        { ablId: CN_ABL_ID, ablAccYear: ACC_YEAR },
        'Sale return srt00009 cancelled',
        USER_ID,
        expect.any(Date),
      );
      const credits = jest.mocked(reverseBillAdjustmentsWith).mock.calls.map(([, , c]) => c.ablId);
      expect(credits).not.toContain(OTHER_CN_ABL_ID);
      // The bill's return fields are worked out again without this return (D76).
      const billUpdate = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill SET'),
      )!;
      expect(
        billUpdate.slice(1, 5).map((v: unknown) => (v instanceof Prisma.Decimal ? Number(v) : v)),
      ).toEqual([0, null, expect.any(Date), 'cashier1']);
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
      expect(reverseBillAdjustmentsWith).not.toHaveBeenCalled();
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
        (strings as string[]).join('?').includes('UPDATE sales.sale_bill SET'),
      )!;
      expect(String(billUpdate[1])).toBe('0');
    });

    it('retires no credit row when the post left none', async () => {
      tx.accBillBalance.findFirst.mockResolvedValue(null);
      db.adjustedAtPost = [{ abl_id: BILL_ABL_ID, abl_acc_year: ACC_YEAR }];

      await service.cancel(cancelDto);

      expect(syncBillAdjustments).not.toHaveBeenCalled();
      expect(reverseBillAdjustmentsWith).not.toHaveBeenCalled();
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

    it('refuses to amend a refund paid out of a till session that no longer takes money, before unwinding anything (the cancel rule)', async () => {
      row = srRow({
        srStatus: 'POSTED',
        srPostedVoucherId: VOUCHER_ID,
        srRefundAmt: D(100),
        srSessionId: SESSION_ID,
      });
      db.session = { status: 'CLOSED', sessionNo: 'S-12' };

      expect(await refusalOf(service.amend(amendDto()))).toMatchObject({
        status: 409,
        body: {
          errors: [{ code: SALES_ERROR_CODES.RETURN_REFUND_SESSION_CLOSED, status: 'CLOSED' }],
        },
      });
      expect(rd.sessionOf).toHaveBeenCalledWith(tx, SESSION_ID);
      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(stock.cancel).not.toHaveBeenCalled();
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it.each([
      ['the session is still OPEN', { status: 'OPEN', sessionNo: 'S-12' }],
      ['the session is SUSPENDED', { status: 'SUSPENDED', sessionNo: 'S-12' }],
      ['the id names no real session (an ungoverned counter)', null],
    ])('amends a refunded return when %s, as cancel allows', async (_why, session) => {
      row = srRow({
        srStatus: 'POSTED',
        srPostedVoucherId: VOUCHER_ID,
        srRefundAmt: D(100),
        srSessionId: SESSION_ID,
      });
      db.session = session;

      await service.amend(amendDto());

      expect(legs.reverseLegs).toHaveBeenCalled();
      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('does not ask about a session for a return that refunded nothing', async () => {
      db.session = { status: 'CLOSED', sessionNo: 'S-12' };

      await service.amend(amendDto());

      expect(rd.sessionOf).not.toHaveBeenCalled();
      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('re-posts in the amending device’s live session and judges its cash refund against that drawer, like /post', async () => {
      row = srRow({
        srStatus: 'POSTED',
        srPostedVoucherId: VOUCHER_ID,
        srSettleMode: 'CASH',
        srRefundAmt: D(590),
        srSessionId: SESSION_ID,
      });
      db.session = { status: 'OPEN', sessionNo: 'S-12' };
      tenders = [tender(CASH, 400), tender(CASH, 190)];
      till.resolveForMoney.mockResolvedValue({
        tssId: LIVE_SESSION_ID,
        tssAccYear: ACC_YEAR,
        tssCounterId: LIVE_COUNTER_ID,
        tssDeviceId: 'till-2',
        tssOperatorId: USER_ID,
        businessDate: TODAY,
      });

      await service.amend(amendDto({ srSettleMode: 'CASH' }));

      const [, scope] = till.resolveForMoney.mock.calls[0] as [
        unknown,
        { cashOut: Prisma.Decimal; sessionId: string | null; field: string },
      ];
      expect(scope).toMatchObject({ sessionId: null, field: 'srSessionId' });
      expect(scope.cashOut.equals(D(590))).toBe(true);
      // after the re-save wrote its tenders, before the re-post moves anything
      expect(till.resolveForMoney.mock.invocationCallOrder[0]).toBeGreaterThan(
        store.saveDraft.mock.invocationCallOrder[0],
      );
      expect(till.resolveForMoney.mock.invocationCallOrder[0]).toBeLessThan(
        legs.postLegs.mock.invocationCallOrder[0],
      );
      const header = tx.$executeRaw.mock.calls.find(([strings]) =>
        (strings as string[]).join('?').includes('SET sr_session_id  ='),
      )!;
      expect(header.slice(1, 3)).toEqual([LIVE_SESSION_ID, LIVE_COUNTER_ID]);
      expect(till.stampTenderRows).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ tssId: LIVE_SESSION_ID }),
        expect.objectContaining({ srcDocType: 'SALE_RETURN', srcDocId: SR_ID }),
        'cashier1',
      );
      expect(legs.postLegs).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          header: expect.objectContaining({ sessionId: LIVE_SESSION_ID }) as object,
        }),
      );
    });

    it('re-posts nothing when the drawer refuses the cash the amended refund takes out', async () => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID, srSettleMode: 'CASH' });
      tenders = [tender(CASH, 590)];
      till.resolveForMoney.mockRejectedValue(
        new HttpException({ errors: [{ code: 'TILL_CASH_SHORT_IN_DRAWER' }] }, 409),
      );

      expect(await refusalOf(service.amend(amendDto({ srSettleMode: 'CASH' })))).toMatchObject({
        status: 409,
        body: { errors: [{ code: 'TILL_CASH_SHORT_IN_DRAWER' }] },
      });
      expect(legs.postLegs).not.toHaveBeenCalled();
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
          srPointsBackAmt: 0,
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

    it('settles on the state its own unwind left — the return’s set-offs are not added back a second time', async () => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID, srSettleMode: 'ADJUST' });
      db.adjustedAtPost = [{ abl_id: BILL_ABL_ID, abl_acc_year: ACC_YEAR }];
      // What the reader WOULD add back for this return (its posted set-off of
      // 590.00); after the unwind the bill owes its full 2,360.00 again.
      db.unwound = { bills: new Map([[BILL_ABL_ID, D(590)]]), balance: D(590), partyId: CUST_ID };
      db.openBills = [{ ...db.openBills[0], pending: D(2360), alloc: D(0) }];
      // The bill's balance row as the unwind leaves it (read again by the re-post's set-off).
      db.billAbl = {
        abl_id: BILL_ABL_ID,
        abl_acc_year: ACC_YEAR,
        abl_branch_id: BRANCH_ID,
        abl_bill_amount: D(2360),
        abl_alloc_amount: D(0),
        abl_pending_amount: D(2360),
      };

      // Popup 25's split at the due the amend preview showed (2,360.00).
      await service.amend(
        amendDto({
          srSettleMode: 'ADJUST',
          adjustments: [{ ablId: BILL_ABL_ID, ablAccYear: ACC_YEAR, amount: 590, dueNow: 2360 }],
        }),
      );

      expect(reverseBillAdjustmentsWith).toHaveBeenCalledTimes(1);
      expect(rd.unwindAddBack).not.toHaveBeenCalled();
      expect(rd.openBills).toHaveBeenCalledTimes(1);
      expect(rd.openBills).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ addBack: null, lock: true }),
      );
      // Unwound first, then settled: 2,360.00 seen, not 2,950.00.
      expect(jest.mocked(reverseBillAdjustmentsWith).mock.invocationCallOrder[0]).toBeLessThan(
        rd.openBills.mock.invocationCallOrder[0],
      );
      expect(
        jest.mocked(addBillAdjustment).mock.calls.map(([, c, a]) => [c.billId, String(a.amount)]),
      ).toEqual([[BILL_ABL_ID, '590']]);
      expect(lastSetStatus()[3]).toMatchObject({ srAdjustedAmt: D(590), srRevisionNo: 2 });
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

    it('unwinds under an "Amended:" reason and files the before and after as a revision', async () => {
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
      // The before and after go into ONE revision (notes 89), not a plain row.
      expect(audit.logDocumentRevision).toHaveBeenCalledWith(
        expect.objectContaining({
          docId: SR_ID,
          before: expect.objectContaining({ srStatus: 'POSTED' }) as object,
          after: expect.objectContaining({ srId: SR_ID }) as object,
          userId: USER_ID,
          notes: 'Sale return amended to revision 2: Wrong quantity',
        }),
        tx,
      );
    });
  });

  // Notes 89, as the Sales Order does: every save and every amend is ONE
  // revision (log_rev_no) with the /get-shaped return before and after;
  // status steps (post, cancel) stay plain audit rows.
  describe('History › Revisions (log_rev_no)', () => {
    const revisions = () =>
      audit.logDocumentRevision.mock.calls.map(
        ([input, client]) => [input, client] as [Record<string, unknown>, unknown],
      );

    it('files a create as revision input with nothing before, the store writing no row of its own', async () => {
      await service.save({
        ...KEYS,
        srId: undefined,
        srBillId: BILL_ID,
        srBillAccYear: ACC_YEAR,
        items,
      } as unknown as SaveSaleReturnDto);

      expect(store.saveDraft.mock.calls[0][4]).toMatchObject({ revision: true });
      expect(revisions()).toHaveLength(1);
      const [input, client] = revisions()[0];
      expect(client).toBe(tx);
      expect(input).toMatchObject({
        screenName: 'Sale Return',
        tableName: 'sale_return',
        docId: SR_ID,
        displayName: 'srt00009',
        before: null,
        userId: USER_ID,
        branchId: BRANCH_ID,
        deviceId: 'till-1',
        notes: 'Sale return created',
      });
      // the /get shape, less lock state, rights and display-only names
      const after = input.after as Record<string, unknown>;
      expect(after).toMatchObject({ srId: SR_ID, srReturnRefno: 'srt00009' });
      expect(after).not.toHaveProperty('locks');
      expect(after).not.toHaveProperty('rights');
      expect((after.items as Record<string, unknown>[])[0]).toMatchObject({ sriItemId: ITEM_ID });
      expect((after.items as Record<string, unknown>[])[0]).not.toHaveProperty('sriItemName');
    });

    it('files a draft re-save with the return as it stood before the save', async () => {
      tx.$queryRaw.mockImplementationOnce(async () => [
        {
          sr_id: SR_ID,
          sr_company_id: COMPANY_ID,
          sr_branch_id: BRANCH_ID,
          sr_acc_year: `${ACC_YEAR} `,
        },
      ]);

      await service.save({ ...KEYS, srReturnReason: 'Changed' } as unknown as SaveSaleReturnDto);

      const [input] = revisions()[0];
      expect(input).toMatchObject({ notes: 'Sale return updated', docId: SR_ID });
      expect(input.before).toMatchObject({ srId: SR_ID, srStatus: 'DRAFT' });
      expect(input.before).not.toHaveProperty('locks');
      // before was read before the write, after once it was done
      expect(store.findOrThrow.mock.invocationCallOrder[0]).toBeLessThan(
        store.saveDraft.mock.invocationCallOrder[0],
      );
    });

    it('files an amend as ONE revision after the re-post, the posted return as it was before', async () => {
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });

      await service.amend({
        ...KEYS,
        srCustId: CUST_ID,
        baseRevision: 1,
        editRemark: 'Wrong quantity',
        overrides: [],
      } as never);

      expect(revisions()).toHaveLength(1);
      const [input, client] = revisions()[0];
      expect(client).toBe(tx);
      expect(input).toMatchObject({
        docId: SR_ID,
        notes: 'Sale return amended to revision 2: Wrong quantity',
      });
      expect(input.before).toMatchObject({ srStatus: 'POSTED', srRevisionNo: 1 });
      // after the re-post moved the money
      expect(audit.logDocumentRevision.mock.invocationCallOrder[0]).toBeGreaterThan(
        legs.postLegs.mock.invocationCallOrder[0],
      );
      expect(store.saveDraft.mock.calls[0][4]).toMatchObject({ revision: true });
      expect(store.auditChange).not.toHaveBeenCalledWith(
        tx,
        expect.anything(),
        'update',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('files no revision for a post or a cancel: those are status steps', async () => {
      await service.post(KEYS);
      row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });
      await service.cancel({ ...KEYS, reason: 'Posted twice' });

      expect(audit.logDocumentRevision).not.toHaveBeenCalled();
      expect(store.auditChange.mock.calls.map((c) => c[2])).toEqual(['approve', 'cancel']);
    });
  });

  describe('review 11-14 (fresh-eyes findings)', () => {
    /** The bill's lines as a scheme's FREE line: no money, the goods at cost. */
    const freeBill = async () => {
      const lines = (await rd.billLines()) as Record<string, unknown>[];
      rd.billLines.mockResolvedValue(
        lines.map((l) => ({
          ...l,
          parts: { ...zeroParts(), cogsAmt: D(1280) },
          copy: { ...(l.copy as Record<string, unknown>), isFree: true },
          netAmt: D(0),
        })),
      );
    };
    const COGS_LEGS = [
      { role: 'COGS', roleTag: 'COGS', drCr: 'CR', amount: 320 },
      { role: 'INVENTORY', roleTag: 'INVENTORY', drCr: 'DR', amount: 320 },
    ];
    const deduct = (over: Partial<BillChargeFacts> = {}): BillChargeFacts => ({
      cdId: 'cd-deduct',
      accYear: ACC_YEAR,
      chgId: 'chg',
      name: 'Rebate per piece',
      type: 'DEDUCT',
      beforeTax: false,
      sepPost: false,
      taxApl: false,
      method: 'QTY',
      role: 'OTHER',
      applyOn: null,
      ledgerId: 'led-rebate',
      ledgerName: 'Rebate',
      taxCode: null,
      hsn: null,
      unit: null,
      taxPerc: D(0),
      cgstPerc: D(0),
      sgstPerc: D(0),
      igstPerc: D(0),
      cessPerc: D(0),
      onBill: { amount: D(40), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
      backBefore: { amount: D(0), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
      ...over,
    });

    describe('B1 — a 0.00 credit note', () => {
      it('posts a free line back with stock + COGS only: no register, no balance row, no settlement', async () => {
        await freeBill();
        row = srRow({ srReturnAmt: D(0), srSettleMode: 'ADJUST' });
        jest.mocked(buildReturnLegs).mockReturnValueOnce(COGS_LEGS as never);

        await service.post(KEYS);

        expect(stock.post).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({ lines: [expect.objectContaining({ costRate: 320 })] }),
          USER_ID,
          expect.any(Date),
        );
        expect(legs.postLegs).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            legs: COGS_LEGS,
            header: expect.objectContaining({ docAmount: 0 }),
          }),
        );
        expect(register.write).not.toHaveBeenCalled();
        expect(tx.accBillBalance.create).not.toHaveBeenCalled();
        expect(addBillAdjustment).not.toHaveBeenCalled();
        expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
        const st = lastSetStatus();
        expect(st[2]).toBe('POSTED');
        expect(st[3]).toMatchObject({
          srPostedVoucherId: VOUCHER_ID,
          srReturnAmt: D(0),
          srRefundAmt: D(0),
          srAdjustedAmt: D(0),
          srCreditAmt: D(0),
          srPointsBackAmt: D(0),
        });
      });

      it('posts with no voucher at all when not even a COGS pair is left (PERIODIC)', async () => {
        await freeBill();
        ctx.cogsMode = 'PERIODIC';
        row = srRow({ srReturnAmt: D(0) });
        jest.mocked(buildReturnLegs).mockReturnValueOnce([] as never);

        await service.post(KEYS);

        expect(stock.post).toHaveBeenCalled();
        expect(legs.postLegs).not.toHaveBeenCalled();
        expect(register.write).not.toHaveBeenCalled();
        expect(tx.accBillBalance.create).not.toHaveBeenCalled();
        expect(lastSetStatus()[3]).toMatchObject({ srPostedVoucherId: null, srCreditAmt: D(0) });
        expect(store.auditChange).toHaveBeenCalledWith(
          tx,
          expect.anything(),
          'approve',
          { srStatus: 'DRAFT' },
          expect.objectContaining({ srPostedVoucherId: null, gdrId: null }),
          USER_ID,
          'Sale return posted at 0.00 (stock only, no voucher)',
        );
      });

      it('previews no Adjust and no Refund for a 0.00 note, and still refuses a refund row with money', async () => {
        await freeBill();
        const adjust = (await service.validate({
          ...srRow({ srSettleMode: 'ADJUST' }),
          srReturnAmt: '0',
          items,
        } as unknown as SaveSaleReturnDto)) as {
          ok: boolean;
          preview: { settlement: { adjust: unknown; refund: unknown; credited: number } };
        };
        expect(adjust.ok).toBe(true);
        expect(adjust.preview.settlement).toMatchObject({
          adjust: null,
          refund: null,
          credited: 0,
        });

        const cash = (await service.validate({
          ...srRow({ srSettleMode: 'CASH' }),
          srReturnAmt: '0',
          items,
          tenders: [{ tdTenderTypeId: CASH, tdAmount: 10 }],
        } as unknown as SaveSaleReturnDto)) as { refusals: { code: string }[] };
        expect(cash.refusals.map((r) => r.code)).toEqual([
          SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID,
        ]);
      });

      it('answers /get for a posted 0.00 note with creditLeft 0 (no balance row)', async () => {
        row = srRow({ srStatus: 'POSTED', srReturnAmt: D(0), srPostedVoucherId: null });
        db.billAbl = null;

        const doc = await service.get({
          id: SR_ID,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: ACC_YEAR,
        });

        expect(doc.creditLeft).toBe(0);
      });

      it('cancels a voucher-less 0.00 note: the stock goes back out, nothing else to reverse', async () => {
        row = srRow({ srStatus: 'POSTED', srReturnAmt: D(0), srPostedVoucherId: null });
        tx.accBillBalance.findFirst.mockResolvedValue(null);

        await expect(service.cancel({ ...KEYS, reason: 'Wrong item' })).resolves.toMatchObject({
          srStatus: 'CANCELLED',
          reversalVoucherRefno: null,
        });
        expect(legs.reverseLegs).not.toHaveBeenCalled();
        expect(register.cancel).not.toHaveBeenCalled();
        expect(tx.accBillBalance.update).not.toHaveBeenCalled();
        expect(stock.cancel).toHaveBeenCalled();
        expect(lastSetStatus()[2]).toBe('CANCELLED');
      });

      it('takes no bill round off on a 0.00 return that empties the bill', async () => {
        await freeBill();
        // All four free units back; the bill rounded off +0.45.
        const base = rd.billHeader.getMockImplementation()!;
        rd.billHeader.mockImplementation(async (...a: unknown[]) => ({
          ...(await (base as (...x: unknown[]) => Promise<Record<string, unknown>>)(...a)),
          roundOff: D('0.45'),
        }));
        const result = (await service.validate({
          ...srRow(),
          srReturnAmt: '0',
          items: [srItem({ sriReturnQty: D(4) })],
        } as unknown as SaveSaleReturnDto)) as {
          ok: boolean;
          preview: { emptiesBill: boolean; totals: { roundOff: number; creditNote: number } };
        };
        expect(result.preview.emptiesBill).toBe(true);
        expect(result.preview.totals).toMatchObject({ roundOff: 0, creditNote: 0 });
        expect(result.ok).toBe(true);
      });
    });

    describe('B1 — a NEGATIVE credit note', () => {
      it('refuses it at /validate and at /post (SALES_RETURN_NEGATIVE, field srReturnAmt)', async () => {
        // One free unit of four back, and a quarter of a 40.00 per-piece DEDUCT: −10.00.
        await freeBill();
        db.billCharges = [deduct()];

        const { ok, refusals } = (await service.validate({
          ...srRow(),
          srReturnAmt: undefined,
          items,
        } as unknown as SaveSaleReturnDto)) as {
          ok: boolean;
          refusals: { code: string; field?: string; params?: Record<string, unknown> }[];
        };
        expect(ok).toBe(false);
        expect(refusals).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.RETURN_NEGATIVE,
            field: 'srReturnAmt',
            params: { value: '-10.00' },
          }),
        ]);

        row = srRow({ srReturnAmt: D(-10) });
        const refusal = await refusalOf(service.post(KEYS));
        expect(refusal.status).toBe(422);
        expect(refusal.body.errors.map((e) => e.code)).toEqual([SALES_ERROR_CODES.RETURN_NEGATIVE]);
        expect(stock.post).not.toHaveBeenCalled();
      });
    });

    describe('S4 — D77 freezes a DRAFT only', () => {
      const pending = {
        tapId: 'tap-review',
        accYear: ACC_YEAR,
        event: 'RETURN_NO_RECEIPT',
        status: 'PENDING',
        amount: D(590),
        usedOn: null,
      };

      it('amends a POSTED return while its post-hoc review waits, withdrawing that review first', async () => {
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID, srRevisionNo: 3 });
        db.approvals = [pending];

        await service.amend({
          ...KEYS,
          srCustId: CUST_ID,
          baseRevision: 3,
          editRemark: 'Wrong qty',
          overrides: [],
        } as never);

        expect(approvals.withdrawForDocument).toHaveBeenCalledWith(tx, {
          companyId: COMPANY_ID,
          srcDocType: 'SALE_RETURN',
          srcDocId: SR_ID,
          userId: USER_ID,
          deviceId: null,
          note: 'Withdrawn by cashier1: the return was amended to revision 4',
        });
        // Withdrawn before the re-post's gate files (or finds) one.
        expect(approvals.withdrawForDocument.mock.invocationCallOrder[0]).toBeLessThan(
          approvals.assessGate.mock.invocationCallOrder[0] ?? Infinity,
        );
        expect(lastSetStatus()[2]).toBe('POSTED');
        expect(lastSetStatus()[3]).toMatchObject({ srRevisionNo: 4 });
      });

      it('the amend preview of a POSTED return shows its own gate, not the review the amend withdraws', async () => {
        const need = { threshold: 0, minRole: 'SUPERVISOR', channel: 'EITHER', twoPerson: false };
        approvals.assessGate.mockResolvedValue({ state: 'WARN', need });
        db.approvals = [{ ...pending, event: 'SALE_RETURN' }];
        const preview = async () =>
          (
            (await service.validate({
              ...srRow(),
              srReturnAmt: undefined,
              items,
            } as unknown as SaveSaleReturnDto)) as {
              preview: { approvals: { event: string; state: string }[] };
            }
          ).preview.approvals;

        // A DRAFT: the request still waits (D77).
        expect(await preview()).toEqual([
          expect.objectContaining({ event: 'SALE_RETURN', state: 'PENDING' }),
        ]);
        // A POSTED return (its amend preview): the review goes; the gate answers.
        db.unwound = { bills: new Map(), balance: D(0), partyId: CUST_ID };
        expect(await preview()).toEqual([
          expect.objectContaining({ event: 'SALE_RETURN', state: 'WARN' }),
        ]);
      });

      it('withdraws nothing when no review is pending', async () => {
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });

        await service.amend({
          ...KEYS,
          srCustId: CUST_ID,
          baseRevision: 1,
          editRemark: 'Wrong qty',
          overrides: [],
        } as never);

        expect(approvals.withdrawForDocument).not.toHaveBeenCalled();
      });

      it('still refuses a DRAFT re-save while a request waits (D77), and /get locks only the DRAFT', async () => {
        db.approvals = [pending];
        const refusal = await refusalOf(
          service.save({ ...KEYS, srCustId: CUST_ID, items } as unknown as SaveSaleReturnDto),
        );
        expect(refusal.body.errors[0]).toMatchObject({
          code: SALES_ERROR_CODES.RETURN_APPROVAL_PENDING,
        });

        const keys = { id: SR_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR };
        row = srRow({ srStatus: 'DRAFT' });
        expect(((await service.get(keys)).locks as { editable: unknown }).editable).toEqual({
          document: false,
        });
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });
        expect(((await service.get(keys)).locks as { editable: unknown }).editable).toEqual({});
      });
    });

    describe('S5 — a no-bill return takes its GST facts from the customer', () => {
      const noBill = {
        srIsAgainstBill: false,
        srBillId: null,
        srBillAccYear: null,
        srBillRefno: null,
      };
      beforeEach(() => {
        db.bill = null;
        db.customer = {
          cus_name: 'ZT Gujarat Traders',
          cus_addr1: '1 Ring Road',
          cus_addr2: null,
          cus_addr3: 'Vapi',
          cus_city: 'Vapi',
          cus_pin: '396191',
          cus_phone1: '9800000000',
          cus_gst_no: '24ABCDE1234F1Z5',
          cus_gst_type: 'REGULAR',
          cus_state_code: '24',
          cus_state_name: 'Gujarat',
          pos_ok: true,
        };
      });

      it('fills place of supply, state, GSTIN, GST type and address server-side, and splits the tax IGST', async () => {
        await service.save({
          srCompanyId: COMPANY_ID,
          srBranchId: BRANCH_ID,
          srAccYear: ACC_YEAR,
          srCounterId: COUNTER_ID,
          srCustId: CUST_ID,
          ...noBill,
          srSettleMode: 'ADVANCE',
          items: [srItem({ sriBillItemId: null })],
        } as unknown as SaveSaleReturnDto);

        const [, body] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>];
        expect(body).toMatchObject({
          srPosStcd: '24',
          srCustStcd: '24',
          srStateName: 'Gujarat',
          srCustGstin: '24ABCDE1234F1Z5',
          srCustGstType: 'REGULAR',
          srCustAddr: '1 Ring Road, Vapi',
          srCustPlace: 'Vapi',
          srCustPin: '396191',
        });
        // Today's price, inter-state: IGST 18 % of 500.00, no CGST / SGST.
        const [line] = body.items as Record<string, unknown>[];
        expect([String(line.sriIgstAmt), String(line.sriCgstAmt), String(line.sriSgstAmt)]).toEqual(
          ['90', '0', '0'],
        );
      });

      it('keeps what the operator typed, and leaves the place of supply blank for a code that is not a GST state', async () => {
        db.customer = { ...db.customer!, cus_state_code: 'TN', pos_ok: false };

        await service.save({
          srCompanyId: COMPANY_ID,
          srBranchId: BRANCH_ID,
          srAccYear: ACC_YEAR,
          srCounterId: COUNTER_ID,
          srCustId: CUST_ID,
          ...noBill,
          srCustPhone: '9111111111',
          items: [srItem({ sriBillItemId: null })],
        } as unknown as SaveSaleReturnDto);

        const [, body] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>];
        expect(body).toMatchObject({
          srCustPhone: '9111111111',
          srPosStcd: null,
          srCustStcd: 'TN',
        });
      });

      it('posts its register row with the GSTIN, the state and INTER_STATE', async () => {
        db.soldLines = [];
        row = srRow({
          ...noBill,
          srPosStcd: '24',
          srCustStcd: '24',
          srStateName: 'Gujarat',
          srCustGstin: '24ABCDE1234F1Z5',
          srCustGstType: 'REGULAR',
        });
        items = [srItem({ sriBillItemId: null })];

        await service.post(KEYS);

        expect(register.write).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            partyGstin: '24ABCDE1234F1Z5',
            partyStateCode: '24',
            placeOfSupplyCode: '24',
            supplyNature: 'INTER_STATE',
            igstValue: 90,
            cgstValue: 0,
          }),
          expect.objectContaining({ interState: true }),
        );
      });
    });

    describe('S6 / S7 — cancel and amend lock as /post locks', () => {
      it('cancel locks the bill lines, then its charge rows, then the note row, before reading', async () => {
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });

        await service.cancel({ ...KEYS, reason: 'Posted twice' });

        const order = (m: jest.Mock) => m.mock.invocationCallOrder[0];
        const noteLock = tx.$queryRaw.mock.calls.findIndex(
          ([strings]) =>
            (strings as string[]).join('?').includes("abl_src_doc_type = 'SALE_RETURN'") &&
            (strings as string[]).join('?').includes('FOR UPDATE'),
        );
        const applied = tx.$queryRaw.mock.calls.findIndex(([strings]) =>
          (strings as string[]).join('?').includes('COUNT(*) AS n'),
        );
        expect(order(rd.lockBillLines)).toBeLessThan(order(rd.lockBillCharges));
        expect(rd.lockBillLines).toHaveBeenCalledWith(tx, { sbId: BILL_ID, accYear: ACC_YEAR });
        expect(noteLock).toBeGreaterThanOrEqual(0);
        expect(noteLock).toBeLessThan(applied);
        expect(tx.$queryRaw.mock.invocationCallOrder[noteLock]).toBeGreaterThan(
          order(rd.lockBillCharges),
        );
        // The bill's return fields are rewritten only after the locks.
        const firstLineUpdate = tx.$executeRaw.mock.calls.findIndex(([strings]) =>
          (strings as string[]).join('?').includes('UPDATE sales.sale_bill_item'),
        );
        expect(tx.$executeRaw.mock.invocationCallOrder[firstLineUpdate]).toBeGreaterThan(
          order(rd.lockBillCharges),
        );
      });

      it('amend locks the bill lines and charge rows before it unwinds anything', async () => {
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });

        await service.amend({
          ...KEYS,
          srCustId: CUST_ID,
          baseRevision: 1,
          editRemark: 'Wrong qty',
          overrides: [],
        } as never);

        const first = rd.lockBillLines.mock.invocationCallOrder[0];
        expect(first).toBeLessThan(rd.lockBillCharges.mock.invocationCallOrder[0]);
        expect(first).toBeLessThan(legs.reverseLegs.mock.invocationCallOrder[0]);
        expect(first).toBeLessThan(stock.cancel.mock.invocationCallOrder[0]);
      });

      it('locks nothing of a bill for a return with none', async () => {
        row = srRow({
          srStatus: 'POSTED',
          srPostedVoucherId: VOUCHER_ID,
          srBillId: null,
          srIsAgainstBill: false,
          srBillAccYear: null,
        });

        await service.cancel({ ...KEYS, reason: 'Posted twice' });

        expect(rd.lockBillLines).not.toHaveBeenCalled();
      });
    });

    describe('point 5 — cancel / amend never unwind a set-off on a bill of a closed year', () => {
      beforeEach(() => {
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID, srSettleMode: 'ADJUST' });
        // The note set itself off at post against bil00007 of 2025-2026 (closed).
        db.adjustedAtPost = [
          { abl_id: BILL_ABL_ID, abl_acc_year: '2025-2026', abl_doc_refno: 'bil00007' },
        ];
        rd.closedYears.mockResolvedValue(new Set(['2025-2026']));
        // A live credit-note IRN: refusing must come before it is cancelled too.
        register.registerIdOf.mockResolvedValue(GDR_ID);
        jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: true, ewbLive: false });
      });
      const expectNothingWritten = () => {
        expect(gst.cancelIrn).not.toHaveBeenCalled();
        expect(legs.reverseLegs).not.toHaveBeenCalled();
        expect(stock.cancel).not.toHaveBeenCalled();
        expect(register.cancel).not.toHaveBeenCalled();
        expect(register.retire).not.toHaveBeenCalled();
        expect(reverseBillAdjustmentsWith).not.toHaveBeenCalled();
        expect(tx.accBillBalance.update).not.toHaveBeenCalled();
        expect(loyalty.reverseForCancel).not.toHaveBeenCalled();
        expect(store.setStatus).not.toHaveBeenCalled();
        expect(tx.$executeRaw).not.toHaveBeenCalled();
      };

      it('cancel: 409 SALES_YEAR_LOCKED on adjustedBills, naming the bill and its year, before anything is written', async () => {
        const refusal = await refusalOf(service.cancel({ ...KEYS, reason: 'Posted twice' }));

        expect(refusal.status).toBe(409);
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.YEAR_LOCKED,
            field: 'adjustedBills',
            params: { bill: 'bil00007', year: '2025-2026' },
          }),
        ]);
        expect(rd.closedYears).toHaveBeenCalledWith(tx, COMPANY_ID, ['2025-2026']);
        expectNothingWritten();
      });

      it('amend: the same 409 before the unwind, the review withdrawal or the re-save', async () => {
        db.approvals = [
          {
            tapId: 'tap-review',
            accYear: ACC_YEAR,
            event: 'SALE_RETURN',
            status: 'PENDING',
            amount: D(590),
            usedOn: null,
          },
        ];
        const refusal = await refusalOf(
          service.amend({
            ...KEYS,
            srCustId: CUST_ID,
            baseRevision: 1,
            editRemark: 'Wrong qty',
            overrides: [],
          } as never),
        );

        expect(refusal.status).toBe(409);
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({ code: SALES_ERROR_CODES.YEAR_LOCKED, field: 'adjustedBills' }),
        ]);
        expectNothingWritten();
        expect(approvals.withdrawForDocument).not.toHaveBeenCalled();
        expect(store.saveDraft).not.toHaveBeenCalled();
      });

      it('a set-off on a bill of an open year unwinds as before', async () => {
        db.adjustedAtPost = [
          { abl_id: BILL_ABL_ID, abl_acc_year: ACC_YEAR, abl_doc_refno: 'bil00101' },
        ];
        rd.closedYears.mockResolvedValue(new Set());
        jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: false });
        db.billAbl = { ...db.billAbl, abl_acc_year: ACC_YEAR, abl_branch_id: BRANCH_ID };

        await service.cancel({ ...KEYS, reason: 'Posted twice' });

        expect(reverseBillAdjustmentsWith).toHaveBeenCalled();
        expect(lastSetStatus()[2]).toBe('CANCELLED');
      });

      it('asks nothing of the years when the note set nothing off', async () => {
        db.adjustedAtPost = [];
        jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: false });

        await service.cancel({ ...KEYS, reason: 'Posted twice' });

        expect(rd.closedYears).not.toHaveBeenCalled();
        expect(lastSetStatus()[2]).toBe('CANCELLED');
      });
    });

    describe('N1 — /amend refuses a total it no longer agrees with', () => {
      const amend = (srReturnAmt: unknown) =>
        service.amend({
          ...KEYS,
          srCustId: CUST_ID,
          baseRevision: 1,
          editRemark: 'Wrong qty',
          overrides: [],
          srReturnAmt,
        } as never);
      beforeEach(() => {
        row = srRow({ srStatus: 'POSTED', srPostedVoucherId: VOUCHER_ID });
      });

      it('422 SALES_AMOUNT_MISMATCH on srReturnAmt when the screen showed another figure', async () => {
        const refusal = await refusalOf(amend('640.00'));

        expect(refusal.status).toBe(422);
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.AMOUNT_MISMATCH,
            field: 'srReturnAmt',
          }),
        ]);
        expect(lastSetStatus()[2]).not.toBe('POSTED');
      });

      it('re-posts when the figure agrees (or none is sent)', async () => {
        await amend('590.00');
        expect(lastSetStatus()[2]).toBe('POSTED');
      });
    });

    describe('N2 / N8 — a re-save keeps what the saved return says', () => {
      it('works the money out with the calc modes the draft was saved with, not today’s', async () => {
        db.saved = { cust: CUST_ID, f: 'auto', l: 'auto', m: 'ADVANCE' };
        salesContext.values.mockResolvedValue({
          'sales.freight_calc_type': 'manual',
          'sales.loading_calc_type': 'manual',
        });

        await service.save({ ...KEYS, srCustId: CUST_ID, items } as unknown as SaveSaleReturnDto);

        const [, body] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>];
        expect(body).toMatchObject({ srFreightCalcType: 'auto', srLoadingCalcType: 'auto' });
      });

      it('a first save takes today’s', async () => {
        salesContext.values.mockResolvedValue({ 'sales.freight_calc_type': 'manual' });

        await service.save({
          srCompanyId: COMPANY_ID,
          srBranchId: BRANCH_ID,
          srAccYear: ACC_YEAR,
          srCounterId: COUNTER_ID,
          srCustId: CUST_ID,
          srIsAgainstBill: true,
          srBillId: BILL_ID,
          srBillAccYear: ACC_YEAR,
          items,
        } as unknown as SaveSaleReturnDto);

        const [, body] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>];
        expect(body).toMatchObject({ srFreightCalcType: 'manual' });
      });

      it('refuses a re-save naming another customer’s bill (SALES_RETURN_CUSTOMER_LOCKED), and /validate says so', async () => {
        db.saved = { cust: '019c6f6c-be87-7a11-8905-36092c46e0ff', f: null, l: null, m: 'ADVANCE' };

        const refusal = await refusalOf(
          service.save({ ...KEYS, ...srRow(), items } as unknown as SaveSaleReturnDto),
        );
        expect(refusal.status).toBe(422);
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED,
            field: 'srBillId',
          }),
        ]);
        expect(store.saveDraft).not.toHaveBeenCalled();

        const { refusals } = await refusalsOf();
        expect(refusals.map((r) => [r.code, r.field])).toContainEqual([
          SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED,
          'srBillId',
        ]);
      });

      it('refuses a no-bill re-save that names another customer, on srCustId', async () => {
        db.bill = null;
        db.saved = { cust: CUST_ID, f: null, l: null, m: 'ADVANCE' };

        const refusal = await refusalOf(
          service.save({
            ...KEYS,
            srIsAgainstBill: false,
            srBillId: null,
            srCustId: '019c6f6c-be87-7a11-8905-36092c46e0ff',
            items: [srItem({ sriBillItemId: null })],
          } as unknown as SaveSaleReturnDto),
        );
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({
            code: SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED,
            field: 'srCustId',
          }),
        ]);
      });

      it('a re-save that names no customer keeps the saved one (its no-bill rate is theirs)', async () => {
        db.bill = null;
        db.saved = { cust: CUST_ID, f: null, l: null, m: 'ADVANCE' };

        await service.save({
          ...KEYS,
          srIsAgainstBill: false,
          srBillId: null,
          items: [srItem({ sriBillItemId: null })],
        } as unknown as SaveSaleReturnDto);

        expect(rd.lastSale).toHaveBeenCalledWith(tx, expect.objectContaining({ custId: CUST_ID }));
      });
    });

    describe('N3 — the loyalty taken back follows the LINE taxable; the emptying return takes the rest', () => {
      beforeEach(() => {
        // 48 points earned; sb_taxable_amt 2,100.00 holds a 100.00 taxed after-tax charge.
        db.bill = {
          ...db.bill,
          sb_loyalty_member_id: MEMBER_ID,
          sb_loyalty_earn_points: D(48),
          sb_taxable_amt: D(2100),
        };
      });

      it('takes back all 48 when the whole bill comes back (never 48 × 2,000 / 2,100 = 45.71)', async () => {
        items = [srItem({ sriReturnQty: D(4) })];
        row = srRow({ srReturnAmt: D(2360) });

        await service.post(KEYS);

        expect(loyalty.clawbackForReturn).toHaveBeenCalledWith(tx, expect.anything(), 1, {
          earnedOnBill: 48,
          createdBy: USER_ID,
        });
      });

      it('the return that empties the bill takes exactly what the earlier ones left', async () => {
        db.soldLines = [{ sbi_id: BILL_LINE, sold: D(4), returned: D(1) }];
        rd.priorHeader.mockResolvedValue({
          roundOff: D(0),
          cashDisc: D(0),
          refund: D(0),
          pointsBackAmt: D(0),
          voucherShare: D(0),
          agentComm: D(0),
          loyaltyReversed: D(11),
          pointsBack: D(0),
        });
        items = [srItem({ sriReturnQty: D(3) })];
        row = srRow({ srReturnAmt: D(1770) });

        await service.post(KEYS);

        expect(loyalty.clawbackForReturn).toHaveBeenCalledWith(tx, expect.anything(), 1, {
          earnedOnBill: 37,
          createdBy: USER_ID,
        });
      });

      it('rounds the way the scheme earns (whole points) on a part return', async () => {
        rd.billLoyaltyRules.mockResolvedValue({
          earn: { lscId: 'lsc', decimals: 0, rounding: 'FLOOR', returnMode: 'REVERSE' },
          redeem: null,
        });
        db.bill = { ...db.bill, sb_loyalty_earn_points: D(11) };

        const result = (await service.validate({
          ...srRow(),
          srReturnAmt: undefined,
          items,
        } as unknown as SaveSaleReturnDto)) as { preview: { loyaltyReverse: { points: number } } };

        // 11 × 500 / 2,000 = 2.75 → 2 (FLOOR).
        expect(result.preview.loyaltyReverse).toEqual({ points: 2 });
      });
    });

    describe('N9 — Adjust leaves bills of a closed year alone', () => {
      const OLD_ABL = '019c6f6c-be87-7a11-8905-36092c46e0f1';
      beforeEach(() => {
        db.openBills = [
          {
            ablId: OLD_ABL,
            ablAccYear: '2025-2026',
            billType: 'SALES',
            refno: 'bil00007',
            docDate: '2026-03-01',
            dueDate: '2026-03-01',
            billAmount: D(100),
            pending: D(100),
            alloc: D(0),
            srcDocType: 'SALE_BILL',
            srcDocId: 'old-bill',
            srcAccYear: '2025-2026',
          },
          ...db.openBills,
        ];
        rd.closedYears.mockResolvedValue(new Set(['2025-2026']));
      });

      it('proposes only bills of an open year', async () => {
        const result = (await service.validate({
          ...srRow({ srSettleMode: 'ADJUST' }),
          srReturnAmt: undefined,
          items,
        } as unknown as SaveSaleReturnDto)) as {
          preview: { settlement: { adjust: { bills: { ablId: string }[] } } };
        };

        expect(rd.closedYears).toHaveBeenCalledWith(tx, COMPANY_ID, ['2025-2026', ACC_YEAR]);
        expect(result.preview.settlement.adjust.bills.map((b) => b.ablId)).toEqual([BILL_ABL_ID]);
      });

      it('refuses a split that names one (SALES_YEAR_LOCKED), at /validate and /post', async () => {
        const adjustments = [{ ablId: OLD_ABL, ablAccYear: '2025-2026', amount: 50 }];
        const { refusals } = (await service.validate({
          ...srRow({ srSettleMode: 'ADJUST' }),
          srReturnAmt: undefined,
          items,
          adjustments,
        } as unknown as SaveSaleReturnDto)) as { refusals: { code: string; field: string }[] };
        expect(refusals).toEqual([
          expect.objectContaining({ code: SALES_ERROR_CODES.YEAR_LOCKED, field: 'adjustments' }),
        ]);

        row = srRow({ srSettleMode: 'ADJUST' });
        const refusal = await refusalOf(service.post({ ...KEYS, adjustments }));
        expect(refusal.status).toBe(422);
        expect(refusal.body.errors.map((e) => e.code)).toEqual([SALES_ERROR_CODES.YEAR_LOCKED]);
        expect(addBillAdjustment).not.toHaveBeenCalled();
      });
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

    it('needs the Edit right on menu 13', async () => {
      ctx.rights.edit = false;

      expect(await refusalOf(service.transport(transportDto))).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_EDIT }] },
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
