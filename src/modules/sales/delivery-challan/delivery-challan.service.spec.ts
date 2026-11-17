import { UnprocessableEntityException } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TxnStatusEvent } from '../../../common/txn-status-log/txn-status-log.helper';
import {
  assertAccYearWritable,
  assertBandWritable,
  assertSalesmen,
  assertVoucherPartitionExists,
  loadDayClosed,
  loadDeclaredLocks,
} from '../posting/sales.guards';
import { SALES_SETTING_DEFAULTS, type SalesSettings } from '../posting/sales.settings';
import { SALES_ERROR_CODES, type RightsBlock } from '../posting/types/posting.types';
import { DeliveryChallanService, dcHeaderSplitOf } from './delivery-challan.service';
import type { SaveDeliveryChallanDto } from './dto/save-delivery-challan.dto';

// The guards that read the database are replaced; refuse/warn stay real, so
// what a run collects is exactly what the service raised.
jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<typeof import('../posting/sales.guards')>('../posting/sales.guards'),
  assertAccYearWritable: jest.fn(),
  assertVoucherPartitionExists: jest.fn(),
  assertSalesmen: jest.fn(),
  loadDayClosed: jest.fn(),
  loadDeclaredLocks: jest.fn(),
  assertBandWritable: jest.fn(),
}));

const DC_ID = '019c6f6c-be87-7a11-8905-36092c46d001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46d003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46d004';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46d005';
const LINE_A = '019c6f6c-be87-7a11-8905-36092c46d006';
const LINE_B = '019c6f6c-be87-7a11-8905-36092c46d007';
const LINE_SERVICE = '019c6f6c-be87-7a11-8905-36092c46d008';
const ORDER_LINE = '019c6f6c-be87-7a11-8905-36092c46d009';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46d00a';
const REVERSAL_ID = '019c6f6c-be87-7a11-8905-36092c46d00b';
const GDR_ID = '019c6f6c-be87-7a11-8905-36092c46d00c';
const LOT_ID = '019c6f6c-be87-7a11-8905-36092c46d00d';
const ACC_YEAR = '2026-2027';
const TODAY = new Date().toISOString().slice(0, 10);
const PAST = '2026-04-02';
const FUTURE = '2999-01-01';

const D = (v: number | string) => new Prisma.Decimal(v);

const KEYS = {
  sdcId: DC_ID,
  sdcCompanyId: COMPANY_ID,
  sdcBranchId: BRANCH_ID,
  sdcAccYear: ACC_YEAR,
};

const dcRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...KEYS,
  sdcTenantId: null,
  sdcStatus: 'DRAFT',
  sdcDcRefno: 'dch00012',
  sdcDcSlno: 12n,
  sdcDcDate: new Date(`${TODAY}T00:00:00.000Z`),
  sdcDcDatetime: new Date(`${TODAY}T05:00:00.000Z`),
  sdcCustId: CUST_ID,
  sdcCustName: 'Acme Traders',
  sdcCustGstin: ' 33ABCDE1234F1Z5 ',
  sdcDeviceId: 'till-1',
  sdcSessionId: null,
  sdcUserId: USER_ID,
  sdcPurpose: 'SUPPLY',
  sdcPosStcd: '33',
  sdcSrcDocType: null,
  sdcSalesmanId: null,
  // The money adds up (G13): taxable 1000 + tax 180 + round-off 0 = 1180.
  sdcDcAmt: D('1180.00'),
  sdcTaxableAmt: D('1000.00'),
  sdcTaxAmt: D('180.00'),
  sdcRoundOff: D(0),
  sdcTotalCost: D(0),
  sdcRevisionNo: 1,
  sdcPostedVoucherId: null,
  sdcModifiedOn: null,
  ...overrides,
});

const dcItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sdiId: LINE_A,
  sdiLineNo: 1,
  sdiItemId: '019c6f6c-be87-7a11-8905-36092c46d0a1',
  sdiItemUnitId: '019c6f6c-be87-7a11-8905-36092c46d0a2',
  sdiGodownId: '019c6f6c-be87-7a11-8905-36092c46d0a3',
  sdiLotId: null,
  sdiBucket: null,
  sdiIsService: false,
  sdiDcQty: D(2),
  sdiFreeQty: D(0),
  sdiWeightQty: null,
  sdiToBaseFactor: D(1),
  sdiMaxPrice: null,
  sdiRate: D(500),
  sdiTaxPerc: D(18),
  sdiTaxableAmt: D(1000),
  sdiCgstAmt: D(90),
  sdiSgstAmt: D(90),
  sdiIgstAmt: D(0),
  sdiCessAmt: D(0),
  sdiNetAmt: D(1180),
  sdiBilledQty: D(0),
  sdiReturnedQty: D(0),
  sdiSrcDocType: null,
  sdiSrcItemId: null,
  ...overrides,
});

/** A challan whose header totals are its lines' (the money check, G13). */
const balanced = (
  lines: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const sum = (k: string) =>
    lines.reduce<Prisma.Decimal>((a, l) => a.plus((l[k] as Prisma.Decimal | undefined) ?? 0), D(0));
  const taxable = sum('sdiTaxableAmt');
  const tax = sum('sdiCgstAmt').plus(sum('sdiSgstAmt')).plus(sum('sdiIgstAmt')).plus(sum('sdiCessAmt'));
  return dcRow({ sdcTaxableAmt: taxable, sdcTaxAmt: tax, sdcDcAmt: taxable.plus(tax), ...overrides });
};

/** A line that moves nothing and is worth nothing. */
const emptyLine = (overrides: Record<string, unknown> = {}) =>
  dcItem({
    sdiDcQty: D(0),
    sdiFreeQty: D(0),
    sdiTaxableAmt: D(0),
    sdiCgstAmt: D(0),
    sdiSgstAmt: D(0),
    sdiNetAmt: D(0),
    ...overrides,
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

const codesOf = (list: { code: string }[]) => list.map((entry) => entry.code);

describe('DeliveryChallanService', () => {
  /** What the raw queries answer, per test. */
  let db: {
    company: { comp_dc_purposes: string[] | null; comp_state_code: string | null } | undefined;
    orderLines: {
      soi_id: string;
      soi_pending_qty: Prisma.Decimal | null;
      soi_is_free?: boolean;
      soi_free_type?: string | null;
      soi_acc_year?: string;
      soi_order_id?: string;
      soi_line_no?: number;
      soi_item_unit_id?: string | null;
      soi_to_base_factor?: Prisma.Decimal | null;
    }[];
    // Orders on delivery hold the challan names (Sales Order Management, D18).
    heldOrders: {
      so_id: string;
      so_order_refno: string | null;
      so_delivery_hold_reason: string | null;
      so_status?: string;
      so_delivery_hold?: boolean;
    }[];
  };
  let tx: { $queryRaw: jest.Mock; $transaction: jest.Mock };
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
    setting: jest.Mock;
    values: jest.Mock;
  };
  let statutory: { ewayApplicable: jest.Mock; withinCancelWindow: jest.Mock; limit: jest.Mock };
  let audit: { logDocumentRevision: jest.Mock };
  let legs: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let register: { registerIdOf: jest.Mock; write: jest.Mock; cancel: jest.Mock; retire: jest.Mock };
  let stock: { post: jest.Mock; cancel: jest.Mock };
  let blocks: { build: jest.Mock; gstRows: jest.Mock };
  let transportBand: { write: jest.Mock };
  let fulfilment: { recompute: jest.Mock };
  let saleOrders: { syncOrderFulfilment: jest.Mock };
  let reservations: { rederiveOrderLines: jest.Mock };
  let gst: { enqueueAfterPost: jest.Mock; cancelEwb: jest.Mock };
  let billRead: { openSources: jest.Mock };
  let service: DeliveryChallanService;
  /** The row the store hands back, and the lines under it. */
  let row: Record<string, unknown>;
  let items: Record<string, unknown>[];

  beforeEach(() => {
    // The module-level mocks would otherwise carry their calls from test to test.
    jest.clearAllMocks();
    jest.mocked(loadDayClosed).mockResolvedValue(false);
    jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: false });
    jest.mocked(assertBandWritable).mockResolvedValue(undefined);

    db = {
      company: { comp_dc_purposes: ['SUPPLY', 'JOB_WORK'], comp_state_code: '33' },
      orderLines: [],
      heldOrders: [],
    };
    tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('FROM public.companys')) return db.company ? [db.company] : [];
        // The source orders, read under their row lock (lockSourceOrders).
        if (sql.includes('FOR UPDATE OF h'))
          return db.heldOrders.map((o) => ({
            so_status: 'CONFIRMED',
            so_delivery_hold: true,
            ...o,
          }));
        if (sql.includes('sales.sale_order_item')) return db.orderLines;
        if (sql.includes('accounts.acc_voucher_header'))
          return [{ avh_voucher_refno: 'dch-r-0003' }];
        return [];
      }),
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    };
    row = dcRow();
    items = [dcItem()];
    store = {
      saveDraft: jest.fn(async (_tx: unknown, body: Record<string, unknown>) =>
        dcRow({ ...body, sdcId: body.sdcId ?? DC_ID }),
      ),
      keysOf: jest.fn((r: Record<string, unknown>) => ({
        id: r.sdcId,
        companyId: r.sdcCompanyId,
        branchId: r.sdcBranchId,
        accYear: r.sdcAccYear,
      })),
      lock: jest.fn(async () => row),
      findOrThrow: jest.fn(async () => row),
      deleteDraft: jest.fn().mockResolvedValue(undefined),
      loadItems: jest.fn(async () => items),
      loadCharges: jest.fn().mockResolvedValue([]),
      loadTransport: jest.fn().mockResolvedValue(null),
      plain: jest.fn((r: Record<string, unknown>) => ({ ...r })),
      updateItem: jest.fn().mockResolvedValue(undefined),
      setStatus: jest.fn(
        async (
          _tx: unknown,
          r: Record<string, unknown>,
          status: string,
          extra: Record<string, unknown>,
        ) => ({ ...r, sdcStatus: status, ...extra }),
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
      setting: jest.fn().mockResolvedValue(null),
      // §5.6 ageing settings (sales.delivery_amber_days / _old_days): the defaults.
      values: jest.fn().mockResolvedValue({}),
    };
    statutory = {
      ewayApplicable: jest.fn().mockResolvedValue({ limit: null, applicable: false }),
      withinCancelWindow: jest
        .fn()
        .mockResolvedValue({ limit: null, within: true, hoursElapsed: 1 }),
      limit: jest.fn().mockResolvedValue({ value: 180 }),
    };
    audit = { logDocumentRevision: jest.fn().mockResolvedValue({ revNo: 1 }) };
    legs = {
      postLegs: jest.fn().mockResolvedValue({ voucherId: VOUCHER_ID, voucherLastNo: 44n }),
      reverseLegs: jest.fn().mockResolvedValue({ voucherId: REVERSAL_ID }),
    };
    register = {
      registerIdOf: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue({ gdrId: GDR_ID, ewaybillApplicable: true }),
      cancel: jest.fn().mockResolvedValue(undefined),
      retire: jest.fn().mockResolvedValue(1),
    };
    stock = {
      post: jest.fn().mockResolvedValue({
        costByLine: new Map([[LINE_A, 412.345]]),
        lotByLine: new Map([[LINE_A, LOT_ID]]),
        cogsTotal: 824.69,
      }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    blocks = {
      build: jest.fn().mockResolvedValue({
        posting: { status: 'DRAFT' },
        locks: { editable: { lines: true }, irnLive: false, ewbLive: false },
      }),
      gstRows: jest.fn().mockResolvedValue({ ewbGeneratedOn: new Date() }),
    };
    transportBand = { write: jest.fn().mockResolvedValue({ transporterName: 'VRL' }) };
    fulfilment = { recompute: jest.fn().mockResolvedValue(undefined) };
    saleOrders = { syncOrderFulfilment: jest.fn().mockResolvedValue([]) };
    reservations = { rederiveOrderLines: jest.fn().mockResolvedValue(undefined) };
    gst = { enqueueAfterPost: jest.fn(), cancelEwb: jest.fn().mockResolvedValue(undefined) };
    billRead = { openSources: jest.fn().mockResolvedValue([{ sdcId: DC_ID }]) };

    service = new DeliveryChallanService(
      tx as unknown as PrismaService,
      salesContext as never,
      statutory as never,
      legs as never,
      register as never,
      stock as never,
      blocks as never,
      transportBand as never,
      fulfilment as never,
      gst as never,
      billRead as never,
      audit as never,
      {} as never,
      {} as never,
      saleOrders as never,
      reservations as never,
    );
    // The document store is built inside the constructor; swap in the mock.
    (service as unknown as { store: unknown }).store = store;
  });

  const lastSetStatus = () =>
    store.setStatus.mock.calls.at(-1) as [unknown, unknown, string, Record<string, unknown>];

  describe('save', () => {
    const body = {
      ...KEYS,
      sdcId: undefined,
      sdcCustId: CUST_ID,
      post: false,
      overrides: ['SALES_BACKDATE'],
    } as unknown as SaveDeliveryChallanDto;

    it('saves the draft without the one-call instructions and answers with the read-back', async () => {
      const result = await service.save(body);

      const [, saved, actor] = store.saveDraft.mock.calls[0] as [unknown, object, string];
      expect(saved).not.toHaveProperty('post');
      expect(saved).not.toHaveProperty('overrides');
      expect(actor).toBe(USER_ID);
      expect(result).toMatchObject({
        sdcId: DC_ID,
        items: [expect.objectContaining({ sdiId: LINE_A })],
      });
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('stamps the challan time on a new challan only', async () => {
      await service.save(body);
      const hooks = store.saveDraft.mock.calls[0][4] as {
        beforeWrite: (data: Record<string, unknown>) => void;
      };

      const fresh: Record<string, unknown> = {};
      hooks.beforeWrite(fresh);
      const update: Record<string, unknown> = { sdcId: DC_ID };
      hooks.beforeWrite(update);
      const sent: Record<string, unknown> = { sdcDcDatetime: 'kept' };
      hooks.beforeWrite(sent);

      expect(fresh.sdcDcDatetime).toBeInstanceOf(Date);
      expect(update).not.toHaveProperty('sdcDcDatetime');
      expect(sent.sdcDcDatetime).toBe('kept');
    });
  });

  describe('saveAndPost (notes 106)', () => {
    it('saves, locks the saved row, posts it, then queues the e-way bill after the commit', async () => {
      await service.saveAndPost({ ...KEYS, post: true } as SaveDeliveryChallanDto);

      expect(store.lock).toHaveBeenCalledWith(tx, {
        id: DC_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });
      expect(lastSetStatus()[2]).toBe('POSTED');
      expect(gst.enqueueAfterPost).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        einvoice: false,
        ewaybill: true,
      });
      expect(gst.enqueueAfterPost.mock.invocationCallOrder[0]).toBeGreaterThan(
        tx.$transaction.mock.invocationCallOrder[0],
      );
    });

    it('answers a refusal exactly as /post does, and queues nothing', async () => {
      items = [];
      row = balanced([]);

      const refusal = await refusalOf(
        service.saveAndPost({ ...KEYS, post: true } as SaveDeliveryChallanDto),
      );

      expect(refusal.status).toBe(422);
      expect(refusal.body.message).toBe('Challan cannot be posted');
      expect(refusal.body.errors).toEqual([expect.objectContaining({ field: 'items' })]);
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });

    it('passes the overrides sent on the save body into the post', async () => {
      ctx.settings.backdateMode = 'WARN';
      ctx.rights.override = true;
      row = dcRow({ sdcDcDate: new Date(`${PAST}T00:00:00.000Z`) });
      store.lock.mockImplementation(async () => row);

      await service.saveAndPost({
        ...KEYS,
        post: true,
        overrides: [SALES_ERROR_CODES.BACKDATE],
      } as SaveDeliveryChallanDto);

      expect(lastSetStatus()[2]).toBe('POSTED');
    });
  });

  describe('post — the status gates', () => {
    it('does nothing to a challan that is already POSTED', async () => {
      row = dcRow({ sdcStatus: 'POSTED' });

      await service.post(KEYS);

      expect(salesContext.resolve).not.toHaveBeenCalled();
      expect(stock.post).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });

    it('refuses a CANCELLED challan with a 409', async () => {
      row = dcRow({ sdcStatus: 'CANCELLED' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdcId', code: SALES_ERROR_CODES.DOC_CANCELLED }] },
      });
    });

    it('refuses a user without the Post right with a 403', async () => {
      ctx.rights.post = false;

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_POST }] },
      });
      expect(stock.post).not.toHaveBeenCalled();
    });
  });

  describe('post — the guards', () => {
    const refusedCodes = async () =>
      codesOf((await refusalOf(service.post(KEYS))).body.errors as { code: string }[]);

    it('collects every refusal into one 422 instead of stopping at the first', async () => {
      row = balanced([], { sdcDcDate: new Date(`${FUTURE}T00:00:00.000Z`) });
      jest.mocked(loadDayClosed).mockResolvedValue(true);
      items = [];

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(422);
      expect(refusal.body.errors.map((e) => e.field)).toEqual(['sdcDcDate', 'sdcDcDate', 'items']);
      expect(codesOf(refusal.body.errors as { code: string }[]).slice(0, 2)).toEqual([
        SALES_ERROR_CODES.BACKDATE,
        SALES_ERROR_CODES.DAY_CLOSED,
      ]);
      expect(stock.post).not.toHaveBeenCalled();
    });

    // 2026-11-16: the register's supply-tax CHECK refused this as a raw 500.
    it('refuses an inter-state challan sent with CGST / SGST as a coded 422 (TAX_SPLIT), before any stock moves', async () => {
      row = balanced(items, { sdcPosStcd: '29' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(422);
      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.AMOUNT_MISMATCH,
          rule: 'TAX_SPLIT',
          line: 1,
          params: { n: 1, nature: 'INTER_STATE' },
        }),
      ]);
      expect(stock.post).not.toHaveBeenCalled();
      expect(register.write).not.toHaveBeenCalled();
    });

    it('posts the same inter-state challan sent with IGST', async () => {
      items = [dcItem({ sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiIgstAmt: D(180) })];
      row = balanced(items, { sdcPosStcd: '29' });

      await service.post(KEYS);

      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('refuses a backdated challan under sales.backdate_mode REFUSE', async () => {
      ctx.settings.backdateMode = 'REFUSE';
      row = dcRow({ sdcDcDate: new Date(`${PAST}T00:00:00.000Z`) });

      expect(await refusedCodes()).toEqual([SALES_ERROR_CODES.BACKDATE]);
    });

    it('refuses a backdated challan under WARN unless the warning is overridden by a user who may', async () => {
      ctx.settings.backdateMode = 'WARN';
      row = dcRow({ sdcDcDate: new Date(`${PAST}T00:00:00.000Z`) });

      expect(await refusedCodes()).toEqual([SALES_ERROR_CODES.BACKDATE]);

      // Overriding without the right is still a refusal.
      await expect(
        service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.BACKDATE] }),
      ).rejects.toBeInstanceOf(HttpException);

      ctx.rights.override = true;
      await service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.BACKDATE] });
      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('refuses a challan with no customer', async () => {
      row = dcRow({ sdcCustId: null });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.body.errors).toEqual([expect.objectContaining({ field: 'sdcCustId' })]);
    });

    it('refuses a purpose the company has not enabled', async () => {
      row = dcRow({ sdcPurpose: 'exhibition' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          field: 'sdcPurpose',
          code: SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED,
          message: 'Purpose EXHIBITION is not enabled for this company (allowed: SUPPLY, JOB_WORK)',
        }),
      ]);
    });

    it('allows only SUPPLY when the company lists no purposes', async () => {
      db.company = { comp_dc_purposes: null, comp_state_code: '33' };
      row = dcRow({ sdcPurpose: null });
      await service.post(KEYS);
      expect(lastSetStatus()[2]).toBe('POSTED');

      row = dcRow({ sdcPurpose: 'JOB_WORK' });
      expect(await refusedCodes()).toEqual([SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED]);
    });

    it.each(['true', ' TRUE ', '1'])(
      'refuses a challan not raised against an order when sales.dc_requires_order is %p',
      async (setting) => {
        salesContext.setting.mockResolvedValue(setting);

        expect(await refusedCodes()).toEqual([SALES_ERROR_CODES.DC_REQUIRES_ORDER]);
        expect(salesContext.setting).toHaveBeenCalledWith(
          COMPANY_ID,
          BRANCH_ID,
          'sales.dc_requires_order',
        );
      },
    );

    it('lets an order-backed challan through when sales.dc_requires_order is on', async () => {
      salesContext.setting.mockResolvedValue('true');
      row = dcRow({ sdcSrcDocType: 'SALES_ORDER' });

      await service.post(KEYS);

      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('refuses order lines taken past their pending quantity, summed across challan lines', async () => {
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(3) }];
      items = [
        dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE, sdiDcQty: D(2) }),
        dcItem({
          sdiId: LINE_B,
          sdiLineNo: 2,
          sdiSrcDocType: 'SALES_ORDER',
          sdiSrcItemId: ORDER_LINE,
          sdiDcQty: D(2),
        }),
      ];
      row = balanced(items);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
          message: 'Order line has 3 pending; this challan takes 4',
        }),
      ]);
    });

    it('lets the order be overrun as a warning under sales.allow_bill_over_order_qty', async () => {
      ctx.settings.allowBillOverOrderQty = true;
      ctx.rights.override = true;
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(1) }];
      items = [dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE })];

      expect(await refusedCodes()).toEqual([SALES_ERROR_CODES.DC_LINE_OVER_ORDER]);

      await service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.DC_LINE_OVER_ORDER] });
      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('refuses an order line that does not exist', async () => {
      items = [dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE })];

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
          message: `Order line ${ORDER_LINE} does not exist`,
        }),
      ]);
    });

    it('checks the year is writable and its voucher partition exists, naming sdcAccYear', async () => {
      await service.post(KEYS);

      expect(assertAccYearWritable).toHaveBeenCalledWith(tx, COMPANY_ID, ACC_YEAR, 'sdcAccYear');
      expect(assertVoucherPartitionExists).toHaveBeenCalledWith(tx, ACC_YEAR, 'sdcAccYear');
    });

    it('checks the salesmen only when the challan names some', async () => {
      row = dcRow({ sdcSalesmanId: [] });
      await service.post(KEYS);
      expect(assertSalesmen).toHaveBeenLastCalledWith(tx, COMPANY_ID, null, {
        field: 'sdcSalesmanId',
      });

      row = dcRow({ sdcSalesmanId: [USER_ID] });
      await service.post(KEYS);
      expect(assertSalesmen).toHaveBeenLastCalledWith(tx, COMPANY_ID, [USER_ID], {
        field: 'sdcSalesmanId',
      });
    });

    it('refuses a challan whose order is on delivery hold, with no override (D18)', async () => {
      ctx.rights.override = true;
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(2) }];
      db.heldOrders = [
        { so_id: ORDER_LINE, so_order_refno: 'SO/1043', so_delivery_hold_reason: 'After 15th' },
      ];
      items = [dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE })];

      const refusal = await refusalOf(
        service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.ORDER_DELIVERY_HOLD] }),
      );

      expect(refusal.status).toBe(422);
      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
          field: 'items',
          message:
            'Order SO/1043 is on delivery hold: After 15th. Release it on Sales Order Management first.',
        }),
      ]);
      // Asked by the order line id the challan line carries.
      const heldCall = tx.$queryRaw.mock.calls.find((c) =>
        (c[0] as string[]).join('?').includes('FOR UPDATE OF h'),
      );
      expect(heldCall?.slice(1)).toEqual([[], [ORDER_LINE]]);
    });

    it('lets order lines within what is pending through', async () => {
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(2) }];
      items = [dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE })];

      await service.post(KEYS);

      expect(lastSetStatus()[2]).toBe('POSTED');
    });
  });

  describe('validate', () => {
    const validateBody = (overrides: Record<string, unknown> = {}) =>
      ({ ...dcRow(), items: [dcItem()], ...overrides }) as unknown as SaveDeliveryChallanDto;

    it('answers ok with the rights, the totals and no load (no vehicle) when nothing is wrong', async () => {
      await expect(service.validate(validateBody())).resolves.toEqual({
        ok: true,
        refusals: [],
        warnings: [],
        rights: ctx.rights,
        totals: {
          lines: 1,
          pkgs: '2.000',
          weightKg: '0.000',
          taxable: '1000.00',
          tax: '180.00',
          value: '1180.00',
        },
        load: null,
        // P3b — no limit row in force here (the mock): not needed, limit null.
        eway: {
          needed: false,
          supplyNature: 'INTRA_STATE',
          fromStateCode: '33',
          fromStateName: null,
          toStateCode: '33',
          toStateName: null,
          posFromCompany: false,
          value: '1180.00',
          onDate: TODAY,
          limit: null,
          transportMissing: false,
        },
      });
      expect(salesContext.resolve).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, branchId: BRANCH_ID, deviceId: 'till-1' },
        182,
      );
    });

    it('reports an overridable warning as a warning, without refusing', async () => {
      ctx.settings.backdateMode = 'WARN';

      const result = await service.validate(validateBody({ sdcDcDate: PAST }));

      expect(result).toMatchObject({
        ok: true,
        refusals: [],
        warnings: [expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, level: 'WARN' })],
      });
    });

    it('lists every refusal instead of throwing', async () => {
      const result = await service.validate(
        validateBody({ ...balanced([]), sdcDcDate: FUTURE, sdcCustId: null, items: [] }),
      );

      expect(result.ok).toBe(false);
      expect((result.refusals as { field: string }[]).map((r) => r.field)).toEqual([
        'sdcDcDate',
        'sdcCustId',
        'items',
      ]);
    });

    it('warns when an inter-state consignment needs an e-way bill and the band is empty', async () => {
      statutory.ewayApplicable.mockResolvedValue({ limit: null, applicable: true });

      const result = await service.validate(validateBody({ sdcPosStcd: '29' }));

      expect(statutory.ewayApplicable).toHaveBeenCalledWith(
        COMPANY_ID,
        1180,
        TODAY,
        { interState: true, stateCode: '29' },
        tx,
      );
      expect(result.warnings).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING,
          field: 'transport',
        }),
      ]);
    });

    it('stays quiet about the e-way bill once a transporter is on the band', async () => {
      statutory.ewayApplicable.mockResolvedValue({ limit: null, applicable: true });
      store.loadTransport.mockResolvedValue({
        transporterId: null,
        transporterName: 'VRL',
        lrNo: null,
      });

      const result = await service.validate(validateBody());

      expect(result.warnings).toEqual([]);
      expect(result.eway).toMatchObject({ needed: true, transportMissing: false });
    });

    // P3b — the mockup's "needed · add the vehicle or the transporter" line.
    it('answers the e-way facts: nature, states, value, the limit that applied and its source', async () => {
      const base = tx.$queryRaw.getMockImplementation()!;
      tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) =>
        strings.join('?').includes('fixed.state_codes')
          ? [{ code: '33', name: 'Tamil Nadu' }]
          : base(strings, ...values),
      );
      statutory.ewayApplicable.mockResolvedValue({
        applicable: true,
        limit: { value: 100000, appliesTo: '33', isCompanyOverride: false, effectiveFrom: '2018-06-02' },
      });
      const bigLine = dcItem({
        sdiDcQty: D(240),
        sdiTaxableAmt: D(120000),
        sdiCgstAmt: D(10800),
        sdiSgstAmt: D(10800),
        sdiNetAmt: D(141600),
      });

      const result = await service.validate(
        validateBody({ ...balanced([bigLine]), sdcId: undefined, items: [bigLine] }),
      );

      expect(result.refusals).toEqual([]);
      expect(result.warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING }),
      ]);
      expect(result.eway).toEqual({
        needed: true,
        supplyNature: 'INTRA_STATE',
        fromStateCode: '33',
        fromStateName: 'Tamil Nadu',
        toStateCode: '33',
        toStateName: 'Tamil Nadu',
        posFromCompany: false,
        value: '141600.00',
        onDate: TODAY,
        limit: { value: '100000.00', appliesTo: '33', source: 'SHIPPED', effectiveFrom: '2018-06-02' },
        transportMissing: true,
      });
    });

    // User 11-16: a blank POS is judged by the company's state (TN's own floor).
    it('judges a blank POS by the company state, in the guard and in the facts', async () => {
      statutory.ewayApplicable.mockResolvedValue({ limit: null, applicable: false });

      const result = await service.validate(validateBody({ sdcPosStcd: null }));

      expect(statutory.ewayApplicable).toHaveBeenCalledWith(
        COMPANY_ID,
        1180,
        TODAY,
        { interState: false, stateCode: '33' },
        tx,
      );
      expect(result.eway).toMatchObject({
        supplyNature: 'INTRA_STATE',
        toStateCode: '33',
        posFromCompany: true,
      });
    });

    // Live 2026-11-16: an unsaved challan was never warned, so the one-call
    // post (Qt: /validate, then /create post:true) met a WARN /validate hid.
    it('judges an unsaved challan by the band it sends (none): WARN without a vehicle, no stored band read', async () => {
      statutory.ewayApplicable.mockResolvedValue({ limit: null, applicable: true });

      const result = await service.validate(validateBody({ sdcId: undefined }));

      expect(store.loadTransport).not.toHaveBeenCalled();
      expect(result.warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING }),
      ]);
    });

    it('stays quiet on an unsaved challan that names its own vehicle (G12)', async () => {
      statutory.ewayApplicable.mockResolvedValue({ limit: null, applicable: true });

      const result = await service.validate(
        validateBody({ sdcId: undefined, sdcVehicleNo: 'TN38ZT0001' }),
      );

      expect(result.warnings).toEqual([]);
    });

    it('lists the stock engine\'s refusal at /validate and rolls the dry run back (G11)', async () => {
      stock.post.mockRejectedValueOnce(
        new UnprocessableEntityException({
          message: 'Stock would go negative',
          errors: [{ field: 'items', code: SALES_ERROR_CODES.STOCK_NEGATIVE, message: 'ZT-ITEM-B: 2 short' }],
        }),
      );

      const result = await service.validate(validateBody());

      expect(stock.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ docType: 'DELIVERY_CHALLAN', direction: 'OUT', txnType: 'DC_ISSUE' }),
        expect.anything(),
        expect.any(Date),
      );
      expect(result.ok).toBe(false);
      expect(result.refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.STOCK_NEGATIVE, message: 'ZT-ITEM-B: 2 short' }),
      ]);
    });
  });

  // User 2026-11-17: a challan line's Free flag comes ONLY from its order line
  // (Ctrl+F4), as on the Sales Bill where only the scheme engine sets it.
  // User 2026-11-17 (P2): a line with no price level takes the challan's, as on the bill.
  describe('line price level (P2)', () => {
    it('stores the challan\'s level on a line that sends none, null or 0, and keeps a real one', async () => {
      await service.save({
        ...KEYS,
        sdcId: undefined,
        sdcPriceLevel: 2,
        items: [{ sdiLineNo: 1 }, { sdiLineNo: 2, sdiPriceLevel: null }, { sdiLineNo: 3, sdiPriceLevel: 0 }, { sdiLineNo: 4, sdiPriceLevel: 5 }],
      } as unknown as SaveDeliveryChallanDto);

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, unknown>[] }];
      expect(saved.items.map((i) => i.sdiPriceLevel)).toEqual([2, 2, 2, 5]);
    });

    it('leaves the lines alone when the body names no header level', async () => {
      await service.save({ ...KEYS, items: [{ sdiId: LINE_A, sdiLineNo: 1 }] } as unknown as SaveDeliveryChallanDto);

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, unknown>[] }];
      expect(saved.items[0]).not.toHaveProperty('sdiPriceLevel');
    });
  });

  describe('free lines come only from the order (user 11-17)', () => {
    const fromOrder = (overrides: Record<string, unknown> = {}) =>
      dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE, ...overrides });
    const freeLine = (overrides: Record<string, unknown> = {}) =>
      fromOrder({
        sdiIsFree: true,
        sdiRate: D(0),
        sdiTaxableAmt: D(0),
        sdiCgstPerc: D(9),
        sdiSgstPerc: D(9),
        sdiCgstAmt: D(0),
        sdiSgstAmt: D(0),
        sdiNetAmt: D(0),
        ...overrides,
      });
    const body = (lines: Record<string, unknown>[]) =>
      ({ ...balanced(lines), items: lines }) as unknown as SaveDeliveryChallanDto;
    const freeRefusals = async (lines: Record<string, unknown>[]) =>
      ((await service.validate(body(lines))).refusals as Record<string, unknown>[]).filter(
        (r) => r.rule === 'FREE_LINE',
      );
    const freeOrder = () => {
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(10), soi_is_free: true, soi_free_type: 'SCHEME' }];
    };
    const paidOrder = () => {
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(10), soi_is_free: false, soi_free_type: null }];
    };

    it('passes a free line taken from a free order line', async () => {
      freeOrder();
      await expect(freeRefusals([freeLine()])).resolves.toEqual([]);
    });

    it('refuses a free line that names no order line (no manual Free key)', async () => {
      await expect(freeRefusals([dcItem({ sdiIsFree: true, sdiRate: D(0), sdiTaxableAmt: D(0), sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiNetAmt: D(0) })])).resolves.toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.AMOUNT_MISMATCH,
          rule: 'FREE_LINE',
          field: 'items',
          line: 1,
          params: { n: 1 },
          message: 'Line 1: only an order\'s free line comes free onto a challan, and this line names no order line',
        }),
      ]);
    });

    it('refuses a free order line sent as a paid line', async () => {
      freeOrder();
      const refusals = await freeRefusals([fromOrder()]);
      expect(refusals).toEqual([
        expect.objectContaining({ message: 'Line 1: its order line is free, so the challan line must be free too' }),
      ]);
    });

    it('refuses a paid order line sent as free', async () => {
      paidOrder();
      const refusals = await freeRefusals([freeLine()]);
      expect(refusals).toEqual([
        expect.objectContaining({ message: 'Line 1: its order line is not free, so the challan line cannot be free' }),
      ]);
    });

    it('refuses a free line that carries a price', async () => {
      freeOrder();
      const refusals = await freeRefusals([
        freeLine({ sdiRate: D(500), sdiTaxableAmt: D(1000), sdiCgstAmt: D(90), sdiSgstAmt: D(90), sdiNetAmt: D(1180) }),
      ]);
      expect(refusals).toEqual([
        expect.objectContaining({ message: 'Line 1: a free line carries no price (rate and taxable 0)' }),
      ]);
    });

    it('leaves a paid line from a paid order line, and an unsourced paid line, alone', async () => {
      paidOrder();
      await expect(freeRefusals([fromOrder(), dcItem({ sdiId: LINE_B, sdiLineNo: 2 })])).resolves.toEqual([]);
    });

    it('refuses the same on /post (the guards), so nothing posts', async () => {
      items = [dcItem({ sdiIsFree: true, sdiRate: D(0), sdiTaxableAmt: D(0), sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiNetAmt: D(0) })];
      row = balanced(items);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(422);
      expect(refusal.body.errors).toEqual([expect.objectContaining({ rule: 'FREE_LINE', line: 1 })]);
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('refuses a wrong flag at the draft save itself (422), writing nothing', async () => {
      const refusal = await refusalOf(
        service.save({
          ...KEYS,
          sdcId: undefined,
          items: [{ sdiLineNo: 1, sdiIsFree: true, sdiRate: 0 }],
        } as unknown as SaveDeliveryChallanDto),
      );

      expect(refusal.status).toBe(422);
      expect(refusal.body.errors).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.AMOUNT_MISMATCH, rule: 'FREE_LINE', line: 1 }),
      ]);
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it("stores the order line's free type on a free line, and none on a paid one", async () => {
      freeOrder();
      db.orderLines.push({ soi_id: LINE_B, soi_pending_qty: D(10), soi_is_free: false, soi_free_type: null });
      await service.save({
        ...KEYS,
        sdcId: undefined,
        items: [
          { sdiLineNo: 1, sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE, sdiIsFree: true, sdiRate: 0, sdiFreeType: 'SAMPLE' },
          { sdiLineNo: 2, sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: LINE_B, sdiIsFree: false, sdiFreeType: 'SAMPLE' },
          { sdiLineNo: 3, sdiFreeType: 'REPLACEMENT' },
        ],
      } as unknown as SaveDeliveryChallanDto);

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, unknown>[] }];
      expect(saved.items.map((i) => i.sdiFreeType)).toEqual(['SCHEME', null, null]);
    });

    it('keeps the stored type of an existing line that does not send its flag', async () => {
      await service.save({
        ...KEYS,
        items: [{ sdiId: LINE_A, sdiLineNo: 1, sdiDcQty: 3 }],
      } as unknown as SaveDeliveryChallanDto);

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, unknown>[] }];
      expect(saved.items[0]).not.toHaveProperty('sdiFreeType');
    });
  });

  // User 2026-11-17 — the challan draws its order down, a DC return re-opens
  // it: the challan re-derives its orders through SaleOrderService (the one
  // recompute bills use), and its pending check reads the TRUE pending.
  // P4 (user 11-17): the over-order guard, the free check and the draw-down
  // resolve a line's order link alike, whichever shape the body uses.
  describe('P4 — the order link, both body shapes', () => {
    const SO = '019c6f6c-be87-7a11-8905-36092c46d0f1';
    const qtShape = (qty: number) =>
      dcItem({
        sdiSrcDocType: 'SALES_ORDER',
        sdiSrcDocId: SO,
        sdiSrcDocAccYear: ACC_YEAR,
        sdiSrcItemId: ORDER_LINE,
        sdiSrcLineNo: 1,
        sdiDcQty: D(qty),
        sdiTaxableAmt: D(500 * qty),
        sdiCgstAmt: D(45 * qty),
        sdiSgstAmt: D(45 * qty),
        sdiNetAmt: D(590 * qty),
      });
    const docShape = (qty: number) => {
      const l = qtShape(qty);
      delete l.sdiSrcItemId;
      return l;
    };
    beforeEach(() => {
      db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(1), soi_acc_year: ACC_YEAR, soi_order_id: SO, soi_line_no: 1 }];
      const route = tx.$queryRaw.getMockImplementation()!;
      tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...v: unknown[]) =>
        strings.join('?').includes('soi_order_id AS doc_id')
          ? [{ id: ORDER_LINE, doc_id: SO, line_no: 1, acc_year: ACC_YEAR }]
          : route(strings, ...v),
      );
    });
    const overOrder = (refusals: Record<string, unknown>[]) =>
      refusals.filter((r) => r.code === SALES_ERROR_CODES.DC_LINE_OVER_ORDER).map((r) => r.message);

    it.each([
      ['the Qt shape (line id + order id + line no)', qtShape],
      ['the order + line number shape (no line id)', docShape],
    ])('/validate refuses 2 of 1 pending in %s', async (_label, shape) => {
      const lines = [shape(2)];
      const result = await service.validate({ ...balanced(lines), items: lines } as unknown as SaveDeliveryChallanDto);
      expect(overOrder(result.refusals as Record<string, unknown>[])).toEqual([
        'Order line has 1 pending; this challan takes 2',
      ]);
    });

    it('/post of a draft stored without the line id resolves it, stores it, and refuses 2 of 1', async () => {
      items = [docShape(2)];
      row = balanced(items);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(422);
      expect(refusal.body.errors).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.DC_LINE_OVER_ORDER, message: 'Order line has 1 pending; this challan takes 2' }),
      ]);
      expect(store.updateItem).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sdiId: LINE_A }),
        { sdiSrcItemId: ORDER_LINE, sdiSrcDocId: SO, sdiSrcLineNo: 1, sdiSrcDocAccYear: ACC_YEAR },
      );
    });

    it('a draft save stores the order line id on a line that sent only the order and line number', async () => {
      await service.save({
        ...KEYS,
        sdcId: undefined,
        items: [{ sdiLineNo: 1, sdiSrcDocType: 'SALES_ORDER', sdiSrcDocId: SO, sdiSrcLineNo: 1 }],
      } as unknown as SaveDeliveryChallanDto);

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, unknown>[] }];
      expect(saved.items[0]).toMatchObject({ sdiSrcItemId: ORDER_LINE, sdiSrcDocId: SO, sdiSrcLineNo: 1, sdiSrcDocAccYear: ACC_YEAR });
    });

    // P4 follow-up (qt-tester section O, 11-17): the screen's OWN line, every
    // key buildItems sends and its decimals as strings. The guard refuses 2 of 1
    // pending in this shape too; the screen itself caps a typed qty at the
    // order's open qty (onCellEdited), which is why its body carried "1.000".
    const screenLine = (qty: string) => ({
      sdiLineNo: 1,
      sdiItemId: dcItem().sdiItemId,
      sdiItemUnitId: dcItem().sdiItemUnitId,
      sdiToBaseFactor: '1.000000',
      sdiHsnCode: '09041100',
      sdiTaxId: '019c6f6c-be87-7a11-8905-36092c46d0e9',
      sdiPriceLevel: 1,
      sdiGodownId: dcItem().sdiGodownId,
      sdiBucket: 'SALEABLE',
      sdiIsFree: false,
      sdiIsService: false,
      sdiDcQty: qty,
      sdiFreeQty: '0',
      sdiNetQty: qty,
      sdiRate: '500.0000',
      sdiRatePreTax: '500.000000',
      sdiIsTaxIncl: false,
      sdiDiscPerc: '0.0000',
      sdiDiscAmt: '0.00',
      sdiGrossAmt: (500 * Number(qty)).toFixed(2),
      sdiTaxableAmt: (500 * Number(qty)).toFixed(2),
      sdiTaxPerc: '18.0000',
      sdiCgstPerc: '9.0000',
      sdiSgstPerc: '9.0000',
      sdiIgstPerc: '0.0000',
      sdiCessPerc: '0.0000',
      sdiCessPerUnit: '0.0000',
      sdiCgstAmt: (45 * Number(qty)).toFixed(2),
      sdiSgstAmt: (45 * Number(qty)).toFixed(2),
      sdiIgstAmt: '0.00',
      sdiCessAmt: '0.00',
      sdiTaxAmt: (90 * Number(qty)).toFixed(2),
      sdiNetAmt: (590 * Number(qty)).toFixed(2),
      sdiSrcDocType: 'SALES_ORDER',
      sdiSrcDocId: SO,
      sdiSrcDocAccYear: ACC_YEAR,
      sdiSrcItemId: ORDER_LINE,
      sdiSrcDocRefno: 'sor00920',
      sdiSrcLineNo: 1,
    });
    const screenBody = (qty: string) => {
      const line = screenLine(qty);
      return {
        ...dcRow(),
        sdcTaxableAmt: line.sdiTaxableAmt,
        sdcTaxAmt: line.sdiTaxAmt,
        sdcCgstAmt: line.sdiCgstAmt,
        sdcSgstAmt: line.sdiSgstAmt,
        sdcDcAmt: line.sdiNetAmt,
        sdcRoundOff: '0.00',
        sdcSrcDocType: 'SALES_ORDER',
        sdcSrcDocId: SO,
        sdcSrcDocAccYear: ACC_YEAR,
        items: [line],
      } as unknown as SaveDeliveryChallanDto;
    };

    it('refuses the screen\'s own body at 2 of 1 pending, and lets its 1 through', async () => {
      const two = await service.validate(screenBody('2.000'));
      expect(overOrder(two.refusals as Record<string, unknown>[])).toEqual([
        'Order line has 1 pending; this challan takes 2',
      ]);
      expect(two.ok).toBe(false);
      const one = await service.validate(screenBody('1.000'));
      expect(overOrder(one.refusals as Record<string, unknown>[])).toEqual([]);
    });

    it('/create post:true of the screen\'s body at 2 is refused (422), its draft rolled back with it', async () => {
      // the harness posts what the store reads back: the screen's line as saved
      items = [{ ...(screenLine('2.000') as Record<string, unknown>), sdiId: LINE_A }];
      row = { ...(screenBody('2.000') as unknown as Record<string, unknown>), sdcId: DC_ID };
      const refusal = await refusalOf(service.saveAndPost({ ...screenBody('2.000'), post: true } as SaveDeliveryChallanDto));
      expect(refusal.status).toBe(422);
      expect(refusal.body.errors).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.DC_LINE_OVER_ORDER, message: 'Order line has 1 pending; this challan takes 2' }),
      ]);
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('refuses a line that names an order line that is not there', async () => {
      const lines = [{ ...docShape(1), sdiSrcLineNo: 9 }];
      const result = await service.validate({ ...balanced(lines), items: lines } as unknown as SaveDeliveryChallanDto);
      expect(overOrder(result.refusals as Record<string, unknown>[])).toEqual([
        expect.stringContaining('has no line 9 to take'),
      ]);
    });
  });

  describe('the order draw-down (user 11-17)', () => {
    const REF = {
      srcDocId: ORDER_LINE,
      srcAccYear: ACC_YEAR,
      soLineNo: null,
      fields: { docId: 'sdiSrcItemId', accYear: 'sdiSrcDocAccYear', lineNo: 'sdiSrcLineNo' },
    };
    const SO = '019c6f6c-be87-7a11-8905-36092c46d0f1';
    beforeEach(() => {
      db.orderLines = [
        { soi_id: ORDER_LINE, soi_pending_qty: D(10), soi_acc_year: `${ACC_YEAR} `, soi_order_id: SO, soi_line_no: 3 },
      ];
      items = [dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE })];
      row = balanced(items);
    });

    it('re-derives the order lines\' reservations once POSTED, after the draw-down (Q2)', async () => {
      await service.post(KEYS);

      expect(reservations.rederiveOrderLines).toHaveBeenCalledTimes(1);
      expect(reservations.rederiveOrderLines).toHaveBeenCalledWith(tx, SO, [3], USER_ID, expect.any(Date));
      expect(reservations.rederiveOrderLines.mock.invocationCallOrder[0]).toBeGreaterThan(
        saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0],
      );
    });

    it('cancel: locks its orders BEFORE the challan row (Q6) and re-derives the reservations after', async () => {
      row = dcRow({ ...balanced(items), sdcStatus: 'POSTED', sdcPostedVoucherId: VOUCHER_ID });
      const route = tx.$queryRaw.getMockImplementation()!;
      tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...v: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('SELECT sdi_src_doc_type, sdi_src_doc_id, sdi_src_item_id FROM sales.sale_dc_item')) {
          return [{ sdi_src_doc_type: 'SALES_ORDER', sdi_src_doc_id: SO, sdi_src_item_id: ORDER_LINE }];
        }
        return route(strings, ...v);
      });

      await service.cancel({ ...KEYS, reason: 'Wrong customer' } as never);

      const firstLock = tx.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes('FOR UPDATE OF h'));
      expect(tx.$queryRaw.mock.calls[firstLock][1]).toEqual([SO]);
      expect(tx.$queryRaw.mock.invocationCallOrder[firstLock]).toBeLessThan(store.lock.mock.invocationCallOrder[0]);
      expect(reservations.rederiveOrderLines).toHaveBeenCalledWith(tx, SO, [3], USER_ID, expect.any(Date));
      expect(reservations.rederiveOrderLines.mock.invocationCallOrder[0]).toBeGreaterThan(
        stock.cancel.mock.invocationCallOrder[0],
      );
    });

    it('amend: locks old and new orders before the challan row, and re-derives the reservations only after the re-post', async () => {
      row = dcRow({ ...balanced(items), sdcStatus: 'POSTED', sdcRevisionNo: 2, sdcPostedVoucherId: VOUCHER_ID });

      await service.amend({ ...KEYS, sdcCustId: CUST_ID, baseRevision: 2, editRemark: 'x', overrides: [], items } as never);

      const firstLock = tx.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes('FOR UPDATE OF h'));
      expect(tx.$queryRaw.mock.invocationCallOrder[firstLock]).toBeLessThan(store.lock.mock.invocationCallOrder[0]);
      const postedAt = store.setStatus.mock.invocationCallOrder[store.setStatus.mock.calls.findIndex((c) => c[2] === 'POSTED')];
      expect(reservations.rederiveOrderLines.mock.invocationCallOrder.every((o) => o > postedAt)).toBe(true);
      expect(reservations.rederiveOrderLines).toHaveBeenCalledTimes(2);
    });

    it('re-derives the orders its lines came from once POSTED, after its own fulfilment', async () => {
      await service.post(KEYS);

      expect(saleOrders.syncOrderFulfilment).toHaveBeenCalledTimes(1);
      expect(saleOrders.syncOrderFulfilment).toHaveBeenCalledWith(
        tx,
        { refs: [REF], reopenRemark: undefined },
        USER_ID,
        expect.any(Date),
      );
      const postedAt = store.setStatus.mock.invocationCallOrder.at(-1)!;
      expect(saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0]).toBeGreaterThan(postedAt);
    });

    it('asks the order module nothing for a challan of no order', async () => {
      items = [dcItem()];
      row = balanced(items);

      await service.post(KEYS);

      expect(saleOrders.syncOrderFulfilment).not.toHaveBeenCalled();
    });

    it('judges the pending in the order line\'s terms: 24 PCS against a BOX of 12 is 2 BOX', async () => {
      db.orderLines = [
        { soi_id: ORDER_LINE, soi_pending_qty: D(1), soi_item_unit_id: 'unit-box', soi_to_base_factor: D(12), soi_acc_year: ACC_YEAR },
      ];
      items = [dcItem({ sdiSrcDocType: 'SALES_ORDER', sdiSrcItemId: ORDER_LINE, sdiDcQty: D(24), sdiTaxableAmt: D(12000), sdiCgstAmt: D(1080), sdiSgstAmt: D(1080), sdiNetAmt: D(14160) })];
      row = balanced(items);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.body.errors).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
          message: 'Order line has 1 pending; this challan takes 2',
        }),
      ]);
      expect(saleOrders.syncOrderFulfilment).not.toHaveBeenCalled();
    });

    it('lets the same unit through at its own quantity', async () => {
      db.orderLines = [
        { soi_id: ORDER_LINE, soi_pending_qty: D(2), soi_item_unit_id: dcItem().sdiItemUnitId as string, soi_to_base_factor: D(12), soi_acc_year: ACC_YEAR },
      ];

      await service.post(KEYS);

      expect(lastSetStatus()[2]).toBe('POSTED');
    });

    it('cancel: locks the orders before the unwind and gives them their quantity back after', async () => {
      row = dcRow({ ...balanced(items), sdcStatus: 'POSTED', sdcPostedVoucherId: VOUCHER_ID, sdcDcRefno: 'DC2627D14-00009' });

      await service.cancel({ ...KEYS, reason: 'Wrong customer' } as never);

      const lockIdx = tx.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes('FOR UPDATE OF h'));
      expect(lockIdx).toBeGreaterThanOrEqual(0);
      expect(tx.$queryRaw.mock.invocationCallOrder[lockIdx]).toBeLessThan(stock.cancel.mock.invocationCallOrder[0]);
      expect(saleOrders.syncOrderFulfilment).toHaveBeenCalledWith(
        tx,
        { refs: [REF], reopenRemark: 'Reopened: challan DC2627D14-00009 cancelled' },
        USER_ID,
        expect.any(Date),
      );
      const cancelledAt = store.setStatus.mock.invocationCallOrder.at(-1)!;
      expect(saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0]).toBeGreaterThan(cancelledAt);
    });

    it('amend: re-derives the orders once back to DRAFT, before the pending check, then again on the re-post', async () => {
      row = dcRow({ ...balanced(items), sdcStatus: 'POSTED', sdcRevisionNo: 2, sdcPostedVoucherId: VOUCHER_ID, sdcDcRefno: 'DC2627D14-00009' });

      await service.amend({ ...KEYS, sdcCustId: CUST_ID, baseRevision: 2, editRemark: 'Qty corrected', overrides: [] } as never);

      const calls = saleOrders.syncOrderFulfilment.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][1]).toEqual({ refs: [REF], reopenRemark: 'Reopened: challan DC2627D14-00009 amended' });
      const draftAt = store.setStatus.mock.invocationCallOrder[store.setStatus.mock.calls.findIndex((c) => c[2] === 'DRAFT')];
      const pendingIdx = tx.$queryRaw.mock.calls.findIndex((c) =>
        (c[0] as string[]).join('?').includes('soi_pending_qty, soi_item_unit_id'),
      );
      const firstSync = saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0];
      expect(firstSync).toBeGreaterThan(draftAt);
      expect(firstSync).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[pendingIdx]);
    });
  });

  describe('post — what a posted challan leaves behind', () => {
    beforeEach(() => {
      items = [
        dcItem(),
        emptyLine({ sdiId: LINE_B, sdiLineNo: 2 }),
        dcItem({ sdiId: LINE_SERVICE, sdiLineNo: 3, sdiIsService: true }),
      ];
      row = balanced(items);
    });

    it('issues only the goods lines that move as DC_ISSUE', async () => {
      await service.post(KEYS);

      const [, doc, actor] = stock.post.mock.calls[0] as [
        unknown,
        {
          direction: string;
          txnType: string;
          refno: string;
          lines: { lineId: string; qty: number }[];
        },
        string,
      ];
      expect(doc).toMatchObject({ direction: 'OUT', txnType: 'DC_ISSUE', refno: 'dch00012' });
      expect(doc.lines).toEqual([expect.objectContaining({ lineId: LINE_A, qty: 2 })]);
      expect(actor).toBe(USER_ID);
    });

    // Live 2026-11-16 (DC2627D14-00021): sdi_cost_price held the line TOTAL
    // (6 pcs → 300.76) and the return booked 4 pcs back at 300.76 EACH.
    it('writes each line its UNIT cost (the engine\'s per-base rate × the factor, 4 places) and the lot', async () => {
      items = [dcItem({ sdiDcQty: D(6) })];
      row = balanced(items);
      stock.post.mockResolvedValueOnce({
        costByLine: new Map([[LINE_A, 300.76]]),
        rateByLine: new Map([[LINE_A, D('50.125945')]]),
        lotByLine: new Map([[LINE_A, LOT_ID]]),
        cogsTotal: 300.76,
      });

      await service.post(KEYS);

      expect(store.updateItem).toHaveBeenCalledTimes(1);
      expect(store.updateItem).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sdiId: LINE_A }),
        { sdiCostPrice: D('50.1259'), sdiLotId: LOT_ID },
      );
    });

    it('states the unit cost per the LINE\'s unit: a box of 12 at 4.25 a piece costs 51', async () => {
      items = [dcItem({ sdiToBaseFactor: D(12) })];
      row = balanced(items);
      stock.post.mockResolvedValueOnce({
        costByLine: new Map([[LINE_A, 102]]),
        rateByLine: new Map([[LINE_A, D('4.25')]]),
        lotByLine: new Map([[LINE_A, LOT_ID]]),
        cogsTotal: 102,
      });

      await service.post(KEYS);

      expect(store.updateItem.mock.calls[0][2]).toEqual({ sdiCostPrice: D('51'), sdiLotId: LOT_ID });
    });

    it('falls back to the line total ÷ (qty + free) when the engine gives no rate', async () => {
      // The default engine answer: 412.345 for 2 pieces, no rateByLine.
      await service.post(KEYS);

      expect(store.updateItem.mock.calls[0][2]).toEqual({
        sdiCostPrice: D('206.1725'),
        sdiLotId: LOT_ID,
      });
    });

    it('posts the COGS pair on a DCh voucher under PERPETUAL', async () => {
      await service.post(KEYS);

      const [, voucher] = legs.postLegs.mock.calls[0] as [
        unknown,
        { header: Record<string, unknown>; legs: { role: string; drCr: string; amount: number }[] },
      ];
      expect(voucher.header).toMatchObject({
        voucherTypeId: 19,
        srcDocType: 'DELIVERY_CHALLAN',
        srcDocId: DC_ID,
        docAmount: 2360,
        partyId: CUST_ID,
        userId: USER_ID,
        presetRefno: 'dch00012',
      });
      expect(voucher.legs).toEqual([
        expect.objectContaining({ role: 'COGS', drCr: 'DR', amount: 824.69 }),
        expect.objectContaining({ role: 'INVENTORY', drCr: 'CR', amount: 824.69 }),
      ]);
    });

    it('stamps the actor on the voucher when the challan user is not a uuid', async () => {
      row = balanced(items, { sdcUserId: 'cashier1' });
      salesContext.resolve.mockResolvedValue({ ...ctx, actor: 'actor-uuid' });

      await service.post(KEYS);

      expect(legs.postLegs).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          header: expect.objectContaining({ userId: 'actor-uuid' }) as object,
        }),
      );
    });

    it('posts no voucher under PERIODIC, and the register keys on the challan itself', async () => {
      ctx.cogsMode = 'PERIODIC';

      await service.post(KEYS);

      expect(legs.postLegs).not.toHaveBeenCalled();
      expect(register.write).toHaveBeenCalledWith(
        tx,
        // The register's own serial (per-device slnos repeat across PCs).
        expect.objectContaining({ voucherId: DC_ID, voucherNo: 1n }),
        { interState: false, ewayStateCode: '33' },
      );
      expect(lastSetStatus()[3]).toMatchObject({ sdcPostedVoucherId: null });
    });

    // User 11-16: the register's e-way flag reads a blank POS as the company's
    // state, as the guard does; the filed place of supply stays as given (none).
    it('judges a blank-POS challan by the company state on the register write', async () => {
      row = balanced(items, { sdcPosStcd: null });

      await service.post(KEYS);

      const [, doc, opts] = register.write.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        unknown,
      ];
      expect(opts).toEqual({ interState: false, ewayStateCode: '33' });
      expect(doc.placeOfSupplyCode).toBeNull();
      expect(doc.supplyNature).toBe('INTRA_STATE');
    });

    it('writes a DELIVERY_CHALLAN register row, never an IRN', async () => {
      await service.post(KEYS);

      const [, doc] = register.write.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(doc).toMatchObject({
        voucherId: VOUCHER_ID,
        voucherTypeId: 19,
        docType: 'DELIVERY_CHALLAN',
        docFlow: 'OUTWARD',
        docSign: 1,
        taxability: 'TAXABLE',
        supplyNature: 'INTRA_STATE',
        partyGstin: '33ABCDE1234F1Z5',
        billValue: 2360,
        remarks: 'SUPPLY',
      });
      expect((doc.lines as unknown[]).length).toBe(3);
      expect(gst.enqueueAfterPost).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        einvoice: false,
        ewaybill: true,
      });
    });

    // Qt probe 2026-11-17: a FREE line (rate 0, so tax 0, GST 18 % = 9/9) was
    // filed EXEMPT and chk_acc_voucher_doc_detail_non_taxable_zero answered a
    // raw 500. The Sales Bill's rule: a line with a GST rate is TAXABLE.
    describe('register taxability (the Sales Bill\'s rule)', () => {
      const registered = () =>
        (register.write.mock.calls[0] as [unknown, Record<string, unknown>])[1] as Record<string, unknown> & {
          lines: Array<Record<string, unknown>>;
        };
      const paid18 = () => dcItem({ sdiCgstPerc: D(9), sdiSgstPerc: D(9) });
      const nil0 = (overrides: Record<string, unknown> = {}) =>
        dcItem({
          sdiId: LINE_B,
          sdiLineNo: 2,
          sdiTaxPerc: D(0),
          sdiCgstAmt: D(0),
          sdiSgstAmt: D(0),
          sdiNetAmt: D(1000),
          ...overrides,
        });

      it('files a FREE line (rate 0, no tax) TAXABLE with its 18 % kept', async () => {
        // User 11-17: a free line comes only from a free order line.
        db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(5), soi_is_free: true, soi_free_type: 'SCHEME' }];
        items = [
          paid18(),
          dcItem({
            sdiId: LINE_B,
            sdiLineNo: 2,
            sdiSrcDocType: 'SALES_ORDER',
            sdiSrcItemId: ORDER_LINE,
            sdiIsFree: true,
            sdiRate: D(0),
            sdiTaxableAmt: D(0),
            sdiCgstPerc: D(9),
            sdiSgstPerc: D(9),
            sdiCgstAmt: D(0),
            sdiSgstAmt: D(0),
            sdiNetAmt: D(0),
          }),
        ];
        row = balanced(items);

        await service.post(KEYS);

        const doc = registered();
        expect(doc.lines[1]).toMatchObject({
          rate: 0,
          taxableValue: 0,
          totalTaxRate: 18,
          cgstRate: 9,
          sgstRate: 9,
          cgstAmount: 0,
          sgstAmount: 0,
          totalValue: 0,
          taxability: 'TAXABLE',
        });
        expect(doc.lines[0].taxability).toBe('TAXABLE');
        expect(doc.taxability).toBe('TAXABLE');
      });

      it('files a 0 % (nil-rated) item EXEMPT, and a challan of only such lines EXEMPT', async () => {
        items = [nil0({ sdiId: LINE_A, sdiLineNo: 1 })];
        row = balanced(items);

        await service.post(KEYS);

        const doc = registered();
        expect(doc.lines[0]).toMatchObject({ totalTaxRate: 0, cgstRate: 0, sgstRate: 0, taxability: 'EXEMPT' });
        expect(doc.taxability).toBe('EXEMPT');
      });

      it('files an 18 % line beside a 0 % line as a MIXED challan', async () => {
        items = [paid18(), nil0()];
        row = balanced(items);

        await service.post(KEYS);

        const doc = registered();
        expect(doc.lines.map((l) => l.taxability)).toEqual(['TAXABLE', 'EXEMPT']);
        expect(doc.taxability).toBe('MIXED');
      });
    });

    it('marks the challan POSTED last, then recomputes fulfilment and leaves the trail', async () => {
      await service.post(KEYS);

      expect(lastSetStatus()[3]).toEqual({
        sdcPostedVoucherId: VOUCHER_ID,
        sdcTotalCost: D('824.69'),
        // P6 R2: the posted lines' GST split.
        ...dcHeaderSplitOf(items),
      });
      expect(fulfilment.recompute).toHaveBeenCalledWith(
        tx,
        [{ dcId: DC_ID, accYear: ACC_YEAR }],
        USER_ID,
        expect.any(Date),
      );
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
        { sdcStatus: 'DRAFT' },
        { sdcStatus: 'POSTED', sdcPostedVoucherId: VOUCHER_ID, gdrId: GDR_ID, cogs: 824.69 },
        USER_ID,
        'Challan posted',
      );
    });
  });

  describe('cancel', () => {
    const cancelDto = { ...KEYS, reason: 'Wrong customer' };

    beforeEach(() => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPostedVoucherId: VOUCHER_ID });
    });

    it('answers a challan already CANCELLED with its state and does nothing', async () => {
      row = dcRow({ sdcStatus: 'CANCELLED', sdcModifiedOn: new Date('2026-10-01T10:00:00.000Z') });

      // The /get payload, plus when it was cancelled (no reversal now).
      await expect(service.cancel(cancelDto)).resolves.toMatchObject({
        sdcId: DC_ID,
        sdcStatus: 'CANCELLED',
        charges: [],
        reversalVoucherRefno: null,
        cancelledOn: '2026-10-01T10:00:00.000Z',
      });
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('refuses a DRAFT: a draft is deleted, not cancelled', async () => {
      row = dcRow();

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

    it.each([
      ['billed', { sdiBilledQty: D(1) }, SALES_ERROR_CODES.DC_BILLED],
      ['returned', { sdiReturnedQty: D(1) }, SALES_ERROR_CODES.DC_RETURNED],
    ])('refuses a challan that has been %s against', async (_label, line, code) => {
      items = [dcItem(line)];

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ code }] } });
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('refuses once the books for the challan date are closed', async () => {
      jest.mocked(loadDayClosed).mockResolvedValue(true);

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdcDcDate', code: SALES_ERROR_CODES.DAY_CLOSED }] },
      });
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
    });

    it('cancels a live e-way bill inside its window before unwinding', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: true });

      await service.cancel(cancelDto);

      expect(gst.cancelEwb).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        reason: 'Wrong customer',
      });
      expect(gst.cancelEwb.mock.invocationCallOrder[0]).toBeLessThan(
        stock.cancel.mock.invocationCallOrder[0],
      );
    });

    it('reverses the voucher, takes the goods back, retires the register row and recomputes fulfilment', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);

      const result = await service.cancel(cancelDto);

      expect(legs.reverseLegs).toHaveBeenCalledWith(
        tx,
        VOUCHER_ID,
        ACC_YEAR,
        'Wrong customer',
        USER_ID,
      );
      expect(stock.cancel).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docId: DC_ID, direction: 'OUT', txnType: 'DC_ISSUE' }),
        USER_ID,
        'Wrong customer',
        expect.any(Date),
      );
      expect(register.cancel).toHaveBeenCalledWith(tx, GDR_ID, ACC_YEAR, 'Wrong customer', USER_ID);
      expect(lastSetStatus()[2]).toBe('CANCELLED');
      expect(fulfilment.recompute).toHaveBeenCalled();
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        TxnStatusEvent.CANCELLED,
        'POSTED',
        'CANCELLED',
        USER_ID,
        expect.any(Date),
        'Wrong customer',
      );
      expect(result).toMatchObject({ sdcId: DC_ID, reversalVoucherRefno: 'dch-r-0003' });
    });

    it('has no voucher to reverse on a PERIODIC challan', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPostedVoucherId: null });

      const result = await service.cancel(cancelDto);

      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(register.cancel).not.toHaveBeenCalled();
      expect(result).toMatchObject({ reversalVoucherRefno: null });
    });
  });

  describe('amend', () => {
    const amendDto = (overrides: Record<string, unknown> = {}) =>
      ({
        ...KEYS,
        sdcCustId: CUST_ID,
        baseRevision: 2,
        editRemark: 'Qty corrected',
        overrides: [],
        ...overrides,
      }) as never;

    beforeEach(() => {
      row = dcRow({ sdcStatus: 'POSTED', sdcRevisionNo: 2, sdcPostedVoucherId: VOUCHER_ID });
    });

    it.each([
      ['DRAFT', SALES_ERROR_CODES.DOC_NOT_DRAFT],
      ['CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED],
    ])('refuses a %s challan', async (status, code) => {
      row = dcRow({ sdcStatus: status });

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
      const refusal = await refusalOf(service.amend(amendDto({ baseRevision: 1 })));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'baseRevision',
              code: SALES_ERROR_CODES.REVISION_STALE,
              message:
                'This challan has been amended since you opened it (now revision 2, you sent 1)',
            },
          ],
        },
      });
    });

    it('refuses a challan with a live e-way bill', async () => {
      jest.mocked(loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: true });

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.EWB_LIVE }] },
      });
      expect(legs.reverseLegs).not.toHaveBeenCalled();
    });

    describe('on an order put on delivery hold after the challan was posted (user, 2026-11-11)', () => {
      const HELD_ORDER = '019c6f6c-be87-7a11-8905-36092c46d0f1';
      // Rate 1000: the line's 1000 taxable stays within qty × rate at qty 1 (G13).
      const line = (qty: number) =>
        dcItem({
          sdiSrcDocType: 'SALES_ORDER',
          sdiSrcDocId: HELD_ORDER,
          sdiSrcItemId: ORDER_LINE,
          sdiDcQty: D(qty),
          sdiRate: D(1000),
        });
      const posted = (now: number, before = 2) => {
        db.orderLines = [{ soi_id: ORDER_LINE, soi_pending_qty: D(10) }];
        db.heldOrders = [
          { so_id: HELD_ORDER, so_order_refno: 'SO/1043', so_delivery_hold_reason: 'After 15th' },
        ];
        // The posted challan's lines (the unwind's, then the revision's `before`), then the amended ones.
        store.loadItems
          .mockImplementationOnce(async () => [line(before)])
          .mockImplementationOnce(async () => [line(before)])
          .mockImplementationOnce(async () => [line(now)]);
        const route = tx.$queryRaw.getMockImplementation()!;
        tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...v: unknown[]) =>
          strings.join('?').includes('SELECT soi_id, soi_order_id')
            ? [{ soi_id: ORDER_LINE, soi_order_id: HELD_ORDER }]
            : route(strings, ...v),
        );
      };

      it('locks the source orders before the unwind touches stock', async () => {
        posted(2);

        await service.amend(amendDto());

        const lockIdx = tx.$queryRaw.mock.calls.findIndex((c) =>
          (c[0] as string[]).join('?').includes('FOR UPDATE OF h'),
        );
        expect(lockIdx).toBeGreaterThanOrEqual(0);
        expect(tx.$queryRaw.mock.invocationCallOrder[lockIdx]).toBeLessThan(
          legs.reverseLegs.mock.invocationCallOrder[0],
        );
      });

      it.each([
        ['the same qty', 2],
        ['a lower qty', 1],
      ])('lets an amend with %s through', async (_label, qty) => {
        posted(qty);

        await service.amend(amendDto());

        expect(lastSetStatus()[2]).toBe('POSTED');
      });

      // Live 2026-11-16: a CANCELED register row still holds
      // uq_acc_voucher_doc_register_source, so the re-post's write answered 23505.
      it('RETIRES the register row on an amend (never cancels it), so the re-post can file it again', async () => {
        posted(2);
        register.registerIdOf.mockResolvedValue(GDR_ID);

        await service.amend(amendDto());

        expect(register.retire).toHaveBeenCalledWith(tx, GDR_ID, ACC_YEAR, expect.any(String));
        expect(register.cancel).not.toHaveBeenCalled();
        expect(register.retire.mock.invocationCallOrder[0]).toBeLessThan(
          register.write.mock.invocationCallOrder[0],
        );
      });

      it('refuses an amend that delivers more from the held order (422 SALES_ORDER_DELIVERY_HOLD)', async () => {
        posted(3);

        const refusal = await refusalOf(service.amend(amendDto()));

        expect(refusal.status).toBe(422);
        expect(refusal.body.errors).toEqual([
          expect.objectContaining({ code: SALES_ERROR_CODES.ORDER_DELIVERY_HOLD }),
        ]);
      });
    });

    it('unwinds, saves the new body over the same id and re-posts it as the next revision', async () => {
      await service.amend(amendDto({ sdcId: DC_ID, sdcRemarks: 'fixed' }));

      expect(legs.reverseLegs).toHaveBeenCalledWith(
        tx,
        VOUCHER_ID,
        ACC_YEAR,
        'Amended: Qty corrected',
        USER_ID,
      );
      expect(store.setStatus.mock.calls[0][2]).toBe('DRAFT');
      expect(store.setStatus.mock.calls[0][3]).toEqual({ sdcPostedVoucherId: null });
      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(saved).toMatchObject({ sdcId: DC_ID, sdcRemarks: 'fixed' });
      expect(saved).not.toHaveProperty('baseRevision');
      expect(saved).not.toHaveProperty('editRemark');
      expect(saved).not.toHaveProperty('overrides');
      expect(stock.post).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ revision: 3 }),
        USER_ID,
        expect.any(Date),
      );
      expect(lastSetStatus()[3]).toMatchObject({ sdcRevisionNo: 3 });
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        TxnStatusEvent.AMENDED,
        'POSTED',
        'DRAFT',
        USER_ID,
        expect.any(Date),
        'Qty corrected',
      );
      expect(gst.enqueueAfterPost).toHaveBeenCalledTimes(1);
    });

    it('re-posts with the revision on the trail and audits the before and after', async () => {
      await service.amend(amendDto({ sdcId: DC_ID }));

      expect(store.trail).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        TxnStatusEvent.POSTED,
        'DRAFT',
        'POSTED',
        USER_ID,
        expect.any(Date),
        'Re-posted as revision 3',
      );
      // Notes 89 — ONE revision on screen 99: before = the posted challan, after = the re-post.
      expect(audit.logDocumentRevision).toHaveBeenLastCalledWith(
        expect.objectContaining({
          screenName: 'Delivery Challan',
          tableName: 'sale_dc',
          docId: DC_ID,
          before: expect.objectContaining({ sdcStatus: 'POSTED' }),
          after: expect.objectContaining({ sdcId: DC_ID }),
          userId: USER_ID,
          notes: 'Challan amended to revision 3: Qty corrected',
        }),
        tx,
      );
    });

    it('refuses the amend when the new body fails the guards, and queues nothing', async () => {
      store.loadItems.mockImplementation(async (_tx: unknown, r: Record<string, unknown>) =>
        r.sdcStatus === 'POSTED' ? items : [],
      );

      const refusal = await refusalOf(service.amend(amendDto()));

      expect(refusal.status).toBe(422);
      expect(refusal.body.message).toBe('Challan cannot be amended');
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });
  });

  describe('convertPurpose', () => {
    const convertDto = { ...KEYS, purpose: 'JOB_WORK' as const, remark: 'Sent for polishing' };

    beforeEach(() => {
      row = dcRow({ sdcStatus: 'POSTED' });
      register.registerIdOf.mockResolvedValue(GDR_ID);
    });

    it('refuses a challan that is not POSTED', async () => {
      row = dcRow();

      const refusal = await refusalOf(service.convertPurpose(convertDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DOC_NOT_DRAFT }] },
      });
    });

    it('lets the e-way bill lock refuse it', async () => {
      jest.mocked(assertBandWritable).mockRejectedValue(new HttpException('declared', 409));

      await expect(service.convertPurpose(convertDto)).rejects.toThrow('declared');
      expect(assertBandWritable).toHaveBeenCalledWith(tx, GDR_ID);
    });

    it('refuses once a line has been billed (SALES_DC_BILLED)', async () => {
      items = [dcItem({ sdiBilledQty: D('0.5') })];

      const refusal = await refusalOf(service.convertPurpose({ ...convertDto, purpose: 'SUPPLY' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'purpose', code: SALES_ERROR_CODES.DC_BILLED }] },
      });
    });

    // P6 Q1 (user 11-17): a partly returned challan converts to SUPPLY only.
    it('refuses a partly returned challan to anything but SUPPLY (SALES_DC_RETURNED)', async () => {
      items = [dcItem({ sdiReturnedQty: D('0.5') })];

      const refusal = await refusalOf(service.convertPurpose(convertDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'purpose', code: SALES_ERROR_CODES.DC_RETURNED }] },
      });
      expect((refusal.body.errors[0] as { rule?: string }).rule).toBeUndefined();
    });

    it('converts a partly returned APPROVAL challan to SUPPLY, so its remainder can be billed (Q1)', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPurpose: 'APPROVAL' });
      items = [dcItem({ sdiDcQty: D(3), sdiReturnedQty: D(1) })];

      await service.convertPurpose({ ...convertDto, purpose: 'SUPPLY', remark: 'Customer keeps 2' });

      expect(lastSetStatus().slice(2, 4)).toEqual(['POSTED', { sdcPurpose: 'SUPPLY' }]);
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        'PURPOSE_CONVERTED',
        'POSTED',
        'POSTED',
        USER_ID,
        expect.any(Date),
        'APPROVAL → SUPPLY: Customer keeps 2',
      );
    });

    // P6 N3: everything came back — SALES_DC_RETURNED rule NOTHING_OPEN (it said SALES_DC_BILLED).
    it('refuses a fully returned challan as SALES_DC_RETURNED rule NOTHING_OPEN', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPurpose: 'APPROVAL' });
      items = [dcItem({ sdiDcQty: D(3), sdiReturnedQty: D(3) })];

      const refusal = await refusalOf(service.convertPurpose({ ...convertDto, purpose: 'SUPPLY' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'purpose', code: SALES_ERROR_CODES.DC_RETURNED, rule: 'NOTHING_OPEN' }] },
      });
      expect(store.setStatus).not.toHaveBeenCalled();
    });

    // P6 S1: header, then its lines, BEFORE the billed / returned caches are read.
    it('locks the challan lines after the header and before it reads them', async () => {
      await service.convertPurpose(convertDto);

      const lineLock = tx.$queryRaw.mock.calls.findIndex((c) =>
        (c[0] as string[]).join('?').includes('WHERE sdi_dc_id = ?::uuid AND sdi_acc_year = ?::char(9)\n       AND sdi_is_deleted = false\n     ORDER BY sdi_id'),
      );
      expect(lineLock).toBeGreaterThanOrEqual(0);
      expect(tx.$queryRaw.mock.calls[lineLock].slice(1)).toEqual([DC_ID, ACC_YEAR]);
      expect(store.lock.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[lineLock]);
      expect(tx.$queryRaw.mock.invocationCallOrder[lineLock]).toBeLessThan(store.loadItems.mock.invocationCallOrder[0]);
    });

    it('refuses a purpose the company has not enabled', async () => {
      const refusal = await refusalOf(
        service.convertPurpose({ ...convertDto, purpose: 'APPROVAL' }),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED }] },
      });
    });

    it('rewrites the purpose on the POSTED challan and says what it was', async () => {
      await service.convertPurpose(convertDto);

      expect(lastSetStatus().slice(2, 4)).toEqual(['POSTED', { sdcPurpose: 'JOB_WORK' }]);
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        'PURPOSE_CONVERTED',
        'POSTED',
        'POSTED',
        USER_ID,
        expect.any(Date),
        'SUPPLY → JOB_WORK: Sent for polishing',
      );
    });
  });

  describe('transport', () => {
    const transportDto = { ...KEYS, transport: { transporterName: 'VRL' } } as never;

    it('refuses a CANCELLED challan', async () => {
      row = dcRow({ sdcStatus: 'CANCELLED' });

      const refusal = await refusalOf(service.transport(transportDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DOC_CANCELLED }] },
      });
    });

    it('writes the band against the register row and leaves the status where it was', async () => {
      row = dcRow({ sdcStatus: 'POSTED' });
      register.registerIdOf.mockResolvedValue(GDR_ID);

      await expect(service.transport(transportDto)).resolves.toMatchObject({
        sdcId: DC_ID,
        charges: [],
      });
      expect(transportBand.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          docType: 'DELIVERY_CHALLAN',
          docId: DC_ID,
          docRefno: 'dch00012',
        }),
        { transporterName: 'VRL' },
        USER_ID,
        { gdrId: GDR_ID, now: expect.any(Date) },
      );
      expect(store.trail).toHaveBeenCalledWith(
        tx,
        row,
        'TRANSPORT_EDITED',
        'POSTED',
        'POSTED',
        USER_ID,
        expect.any(Date),
        null,
      );
    });
  });

  describe('get', () => {
    it('opens the purpose to edit on a POSTED challan nobody has billed or returned against', async () => {
      row = dcRow({ sdcStatus: 'POSTED' });

      const result = await service.get({
        id: DC_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });

      expect(result).toMatchObject({
        sdcId: DC_ID,
        items: [expect.objectContaining({ sdiId: LINE_A })],
        rights: ALL_RIGHTS,
        locks: { editable: { lines: true, purpose: true } },
      });
      expect(blocks.build).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'POSTED', docDate: TODAY, voucherId: null }),
        tx,
      );
    });

    // P3b — the stored challan's e-way verdict, judged on its stored band.
    it('answers the e-way facts of the stored challan and its band', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPosStcd: '29' });
      statutory.ewayApplicable.mockResolvedValue({
        applicable: true,
        limit: { value: 50000, appliesTo: 'INTER_STATE', isCompanyOverride: true, effectiveFrom: '2026-04-01' },
      });
      const keys = { id: DC_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR };

      const bare = await service.get(keys);
      store.loadTransport.mockResolvedValue({ mode: 'ROAD', transporterName: 'VRL' });
      const banded = await service.get(keys);

      expect(statutory.ewayApplicable).toHaveBeenCalledWith(
        COMPANY_ID,
        1180,
        TODAY,
        { interState: true, stateCode: '29' },
        tx,
      );
      expect(bare.eway).toMatchObject({
        needed: true,
        supplyNature: 'INTER_STATE',
        fromStateCode: '33',
        toStateCode: '29',
        value: '1180.00',
        limit: { value: '50000.00', appliesTo: 'INTER_STATE', source: 'COMPANY' },
        transportMissing: true,
      });
      expect(banded.eway).toMatchObject({ needed: true, transportMissing: false });
    });

    it.each([
      ['a DRAFT', {}, [dcItem()]],
      ['a billed line', { sdcStatus: 'POSTED' }, [dcItem({ sdiBilledQty: D(1) })]],
    ])('closes the purpose on %s', async (_label, header, lines) => {
      row = dcRow(header);
      items = lines;

      const result = await service.get({
        id: DC_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });

      expect((result.locks as { editable: { purpose: boolean } }).editable.purpose).toBe(false);
    });
  });

  it('deletes a draft through the store and says so', async () => {
    await expect(service.delete(KEYS)).resolves.toEqual({ sdcId: DC_ID, deleted: true });
    expect(store.deleteDraft).toHaveBeenCalledWith(
      tx,
      { id: DC_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR },
      USER_ID,
      expect.any(Date),
    );
  });

  it('lists the challans open for billing through the bill reader', async () => {
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID, partyId: CUST_ID, accYear: null };

    await expect(service.openForBill(query)).resolves.toEqual([{ sdcId: DC_ID }]);
    expect(billRead.openSources).toHaveBeenCalledWith({ ...query, kind: 'DC' });
    // §8.2 — the bill's picker reads VIEW on the Sales Bill (12), not on 182.
    expect(salesContext.rights).toHaveBeenCalledWith(12);
  });

  it('refuses the bill picker without VIEW on the Sales Bill (403 SALES_RIGHT_VIEW)', async () => {
    ctx.rights = { ...ALL_RIGHTS, view: false };
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID, partyId: CUST_ID, accYear: null };

    await expect(service.openForBill(query)).rejects.toMatchObject({
      status: 403,
      response: { errors: [expect.objectContaining({ code: 'SALES_RIGHT_VIEW' })] },
    });
    expect(billRead.openSources).not.toHaveBeenCalled();
  });

  // ── P6 fresh-eyes fixes (user 11-17, "do all recommended") ─────────────────

  /** The index of the first raw query whose text holds `marker`. */
  const queryIdx = (marker: string) =>
    tx.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes(marker));
  const LINE_LOCK = 'AND sdi_is_deleted = false\n     ORDER BY sdi_id\n       FOR UPDATE';

  describe('/validate on a POSTED challan is the amend preview (P6 B1)', () => {
    const SO = '019c6f6c-be87-7a11-8905-36092c46d0f1';
    /** A line of `qty` × 500 @ 18 % from the order line. */
    const orderLine = (qty: number) =>
      dcItem({
        sdiDcQty: D(qty),
        sdiTaxableAmt: D(500 * qty),
        sdiCgstAmt: D(45 * qty),
        sdiSgstAmt: D(45 * qty),
        sdiNetAmt: D(590 * qty),
        sdiSrcDocType: 'SALES_ORDER',
        sdiSrcItemId: ORDER_LINE,
      });
    const bodyOf = (lines: Record<string, unknown>[]) =>
      ({ ...balanced(lines), sdcStatus: 'POSTED', items: lines }) as unknown as SaveDeliveryChallanDto;

    beforeEach(() => {
      // Posted: 3 from an order line of 3, which it drew down to 0 pending.
      items = [orderLine(3)];
      row = balanced(items, { sdcStatus: 'POSTED', sdcRevisionNo: 1, sdcPostedVoucherId: VOUCHER_ID });
      db.orderLines = [
        { soi_id: ORDER_LINE, soi_pending_qty: D(0), soi_acc_year: ACC_YEAR, soi_order_id: SO, soi_line_no: 1 },
      ];
      // The unwind's re-derive gives the order this challan's 3 back.
      saleOrders.syncOrderFulfilment.mockImplementation(async () => {
        db.orderLines[0].soi_pending_qty = D(3);
        return [];
      });
      const route = tx.$queryRaw.getMockImplementation()!;
      tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...v: unknown[]) => {
        if (strings.join('?').includes('sdc_status FROM sales.sale_dc')) {
          return [
            { sdc_id: DC_ID, sdc_company_id: COMPANY_ID, sdc_branch_id: BRANCH_ID, sdc_acc_year: ACC_YEAR, sdc_status: 'POSTED' },
          ];
        }
        return route(strings, ...v);
      });
    });

    it('lets the unchanged body through: the unwind gives the order its 3 back before the check', async () => {
      const result = await service.validate(bodyOf([orderLine(3)]));

      expect(result).toMatchObject({ ok: true, refusals: [] });
      // The amend's unwind, in order: issue cancelled, DRAFT, orders re-derived; then the guards.
      expect(stock.cancel).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docType: 'DELIVERY_CHALLAN', docId: DC_ID, txnType: 'DC_ISSUE', direction: 'OUT' }),
        USER_ID,
        'Amend preview (/validate)',
        expect.any(Date),
      );
      expect(lastSetStatus().slice(2, 4)).toEqual(['DRAFT', { sdcPostedVoucherId: null }]);
      expect(stock.cancel.mock.invocationCallOrder[0]).toBeLessThan(store.setStatus.mock.invocationCallOrder[0]);
      expect(store.setStatus.mock.invocationCallOrder[0]).toBeLessThan(
        saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0],
      );
      expect(saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0]).toBeLessThan(
        stock.post.mock.invocationCallOrder[0],
      );
      // Nothing an amend files: no voucher reversal, no register, no trail, no revision.
      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(register.retire).not.toHaveBeenCalled();
      expect(store.trail).not.toHaveBeenCalled();
      expect(audit.logDocumentRevision).not.toHaveBeenCalled();
    });

    it('refuses a qty raised past the order (3 pending again, this challan takes 4)', async () => {
      const result = await service.validate(bodyOf([orderLine(4)]));

      expect(result.ok).toBe(false);
      expect(result.refusals).toEqual([
        expect.objectContaining({
          code: SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
          message: 'Order line has 3 pending; this challan takes 4',
        }),
      ]);
    });

    it("judges tight stock with the challan's own issue undone (no SALES_STOCK_NEGATIVE)", async () => {
      stock.post.mockImplementation(async () => {
        if (stock.cancel.mock.calls.length === 0) {
          throw new UnprocessableEntityException({
            message: 'Stock would go negative',
            errors: [{ field: 'items', code: SALES_ERROR_CODES.STOCK_NEGATIVE, message: '3 short' }],
          });
        }
        return { costByLine: new Map(), lotByLine: new Map(), cogsTotal: 0 };
      });

      const result = await service.validate(bodyOf([orderLine(3)]));

      expect(result).toMatchObject({ ok: true, refusals: [] });
      // The dry issue runs under throw-away ids: the posted line's own has ledger rows.
      const [, doc] = stock.post.mock.calls[0] as [unknown, { docId: string; lines: { lineId: string }[] }];
      expect(doc.docId).not.toBe(DC_ID);
      expect(doc.lines[0].lineId).not.toBe(LINE_A);
    });

    it('still lists the engine\'s refusal when the stock is short even with its own issue back', async () => {
      stock.post.mockRejectedValue(
        new UnprocessableEntityException({
          message: 'Stock would go negative',
          errors: [{ field: 'items', code: SALES_ERROR_CODES.STOCK_NEGATIVE, message: '1 short' }],
        }),
      );

      const result = await service.validate(bodyOf([orderLine(4)]));

      expect(codesOf(result.refusals as { code: string }[])).toEqual([
        SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
        SALES_ERROR_CODES.STOCK_NEGATIVE,
      ]);
    });

    it('asks for the AMEND right, as /amend does, not EDIT', async () => {
      ctx.rights = { ...ALL_RIGHTS, edit: false };
      await expect(service.validate(bodyOf([orderLine(3)]))).resolves.toMatchObject({ ok: true });

      ctx.rights = { ...ALL_RIGHTS, amend: false };
      const refusal = await refusalOf(service.validate(bodyOf([orderLine(3)])));
      expect(refusal).toMatchObject({ status: 403, body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_AMEND }] } });
    });

    it('lets an unchanged amend of a challan whose order went on hold through (its posted lines are the prior ones)', async () => {
      db.heldOrders = [{ so_id: SO, so_order_refno: 'SO/1043', so_delivery_hold_reason: 'After 15th' }];

      await expect(service.validate(bodyOf([orderLine(3)]))).resolves.toMatchObject({ ok: true, refusals: [] });
      const more = await service.validate(bodyOf([orderLine(4)]));
      expect(codesOf(more.refusals as { code: string }[])).toContain(SALES_ERROR_CODES.ORDER_DELIVERY_HOLD);
    });

    it('lists what /amend refuses before it unwinds: billed, returned, amend switched off', async () => {
      items = [{ ...orderLine(3), sdiBilledQty: D(1), sdiReturnedQty: D(1) }];
      ctx.settings.allowPostedAmend = false;

      const result = await service.validate(bodyOf([orderLine(3)]));

      expect(codesOf(result.refusals as { code: string }[])).toEqual([
        SALES_ERROR_CODES.AMEND_OFF,
        SALES_ERROR_CODES.DC_BILLED,
        SALES_ERROR_CODES.DC_RETURNED,
      ]);
    });

    it('locks as /amend does: orders, the challan, its lines — then reads the posted lines', async () => {
      await service.validate(bodyOf([orderLine(3)]));

      const orders = queryIdx('FOR UPDATE OF h');
      const lines = queryIdx(LINE_LOCK);
      expect(tx.$queryRaw.mock.invocationCallOrder[orders]).toBeLessThan(store.lock.mock.invocationCallOrder[0]);
      expect(store.lock.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[lines]);
      expect(tx.$queryRaw.mock.invocationCallOrder[lines]).toBeLessThan(store.loadItems.mock.invocationCallOrder[0]);
    });

    it('leaves a DRAFT challan\'s /validate as it was (EDIT right, no unwind)', async () => {
      const route = tx.$queryRaw.getMockImplementation()!;
      tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...v: unknown[]) => {
        if (strings.join('?').includes('sdc_status FROM sales.sale_dc')) {
          return [
            { sdc_id: DC_ID, sdc_company_id: COMPANY_ID, sdc_branch_id: BRANCH_ID, sdc_acc_year: ACC_YEAR, sdc_status: 'DRAFT' },
          ];
        }
        return route(strings, ...v);
      });
      db.orderLines[0].soi_pending_qty = D(3);
      ctx.rights = { ...ALL_RIGHTS, amend: false };

      await expect(service.validate(bodyOf([orderLine(3)]))).resolves.toMatchObject({ ok: true });
      expect(stock.cancel).not.toHaveBeenCalled();
      expect(store.setStatus).not.toHaveBeenCalled();
    });
  });

  // P6 S1 (decision 36): orders → challan header → challan lines → stock.
  describe('the lock order (P6 S1)', () => {
    it('cancel: the header, then its lines, before the billed / returned caches are read', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPostedVoucherId: VOUCHER_ID });

      await service.cancel({ ...KEYS, reason: 'Wrong customer' } as never);

      const lines = queryIdx(LINE_LOCK);
      expect(lines).toBeGreaterThanOrEqual(0);
      expect(store.lock.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[lines]);
      expect(tx.$queryRaw.mock.invocationCallOrder[lines]).toBeLessThan(store.loadItems.mock.invocationCallOrder[0]);
    });

    it('cancel: a bill raised meanwhile (seen under the line lock) refuses it', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPostedVoucherId: VOUCHER_ID });
      items = [dcItem({ sdiBilledQty: D(1) })];

      const refusal = await refusalOf(service.cancel({ ...KEYS, reason: 'x' } as never));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ code: SALES_ERROR_CODES.DC_BILLED }] } });
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('amend: the header, then its lines, before the billed / returned check', async () => {
      row = dcRow({ ...balanced(items), sdcStatus: 'POSTED', sdcRevisionNo: 2, sdcPostedVoucherId: VOUCHER_ID });

      await service.amend({ ...KEYS, sdcCustId: CUST_ID, baseRevision: 2, editRemark: 'x', overrides: [], items } as never);

      const lines = queryIdx(LINE_LOCK);
      expect(store.lock.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[lines]);
      expect(tx.$queryRaw.mock.invocationCallOrder[lines]).toBeLessThan(store.loadItems.mock.invocationCallOrder[0]);
    });

    it('post: its orders before the challan row', async () => {
      const route = tx.$queryRaw.getMockImplementation()!;
      tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...v: unknown[]) => {
        if (strings.join('?').includes('SELECT sdi_src_doc_type, sdi_src_doc_id, sdi_src_item_id FROM sales.sale_dc_item')) {
          return [{ sdi_src_doc_type: 'SALES_ORDER', sdi_src_doc_id: null, sdi_src_item_id: ORDER_LINE }];
        }
        return route(strings, ...v);
      });

      await service.post(KEYS);

      const orders = queryIdx('FOR UPDATE OF h');
      expect(tx.$queryRaw.mock.calls[orders].slice(1)).toEqual([[], [ORDER_LINE]]);
      expect(tx.$queryRaw.mock.invocationCallOrder[orders]).toBeLessThan(store.lock.mock.invocationCallOrder[0]);
    });
  });

  // P6 N1: the header GST split is the lines' sums, on the register and on save.
  describe('the header GST split is the lines\' (P6 N1)', () => {
    it('files the register header CGST / SGST / IGST / cess from the lines, not the body', async () => {
      row = balanced(items, { sdcCgstAmt: D(1), sdcSgstAmt: D(2), sdcIgstAmt: D(3), sdcCessAmt: D(4) });

      await service.post(KEYS);

      const [, doc] = register.write.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(doc).toMatchObject({ cgstValue: 90, sgstValue: 90, igstValue: 0, cessValue: 0, taxableValue: 1000 });
    });

    // P6 R2 (re-review 11-17): never the body's split, even on a header-only save;
    // the STORED lines' sums are written after the line write, and again at post.
    type Hooks = { afterWrite: (row: Record<string, unknown>, lines: Record<string, unknown>[]) => Promise<void> };

    it('drops the body\'s header split and writes the stored lines\' sums after the line write', async () => {
      await service.save({
        ...KEYS,
        sdcId: undefined,
        sdcCgstAmt: '1.00',
        sdcSgstAmt: '999.00',
        items: [dcItem()],
      } as unknown as SaveDeliveryChallanDto);

      const [, saved, , , hooks] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>, unknown, unknown, Hooks];
      for (const k of ['sdcCgstAmt', 'sdcSgstAmt', 'sdcIgstAmt', 'sdcCessAmt']) expect(saved).not.toHaveProperty(k);
      // The lines as stored: one sent, one kept from before (sent by id without its amounts).
      const stored = dcRow({ sdcCgstAmt: D(1), sdcSgstAmt: D(999), sdcIgstAmt: D(0), sdcCessAmt: D(0) });
      await hooks.afterWrite(stored, [
        dcItem({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.87') }),
        dcItem({ sdiId: LINE_B, sdiLineNo: 2, sdiCgstAmt: D('1.10'), sdiSgstAmt: D('1.10'), sdiCessAmt: D('0.50') }),
      ]);
      expect(lastSetStatus().slice(2, 4)).toEqual([
        'DRAFT',
        { sdcCgstAmt: '8.98', sdcSgstAmt: '8.97', sdcIgstAmt: '0.00', sdcCessAmt: '0.50' },
      ]);
      expect(stored.sdcSgstAmt).toBe('8.97');
    });

    it('a header-only save cannot put its own split on the print: the stored lines\' sums stand', async () => {
      await service.save({ ...KEYS, sdcId: DC_ID, sdcCgstAmt: '99.00' } as unknown as SaveDeliveryChallanDto);

      const [, saved, , , hooks] = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>, unknown, unknown, Hooks];
      expect(saved).not.toHaveProperty('sdcCgstAmt');
      // The stored header already matches its lines: nothing more is written.
      await hooks.afterWrite(dcRow({ sdcCgstAmt: D(90), sdcSgstAmt: D(90), sdcIgstAmt: D(0), sdcCessAmt: D(0) }), [dcItem()]);
      expect(store.setStatus).not.toHaveBeenCalled();
    });

    it('the amend writes the stored lines\' split too, and the post files the posted lines\' split', async () => {
      row = dcRow({ ...balanced(items), sdcStatus: 'POSTED', sdcRevisionNo: 2, sdcPostedVoucherId: VOUCHER_ID });

      await service.amend({ ...KEYS, sdcCustId: CUST_ID, baseRevision: 2, editRemark: 'x', overrides: [], items, sdcCgstAmt: '5.00' } as never);

      const amendSave = store.saveDraft.mock.calls[0] as [unknown, Record<string, unknown>, unknown, unknown, Partial<Hooks>];
      expect(amendSave[1]).not.toHaveProperty('sdcCgstAmt');
      expect(typeof amendSave[4].afterWrite).toBe('function');
      const posted = store.setStatus.mock.calls.find((c) => c[2] === 'POSTED') as [unknown, unknown, string, Record<string, unknown>];
      expect(posted[3]).toMatchObject({ sdcCgstAmt: '90.00', sdcSgstAmt: '90.00', sdcIgstAmt: '0.00', sdcCessAmt: '0.00' });
    });
  });

  // P6 N2 / Q1: /get once things came back.
  describe('/get once billed or returned (P6 N2, Q1)', () => {
    const keys = { id: DC_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR };
    const OLD = '2026-04-02';

    it('answers no age level once nothing is open (grid 116 shows none), the level while something is', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcDcDate: new Date(`${OLD}T00:00:00.000Z`) });
      items = [dcItem({ sdiBilledQty: D(2) })];
      await expect(service.get(keys)).resolves.toMatchObject({ ageLevel: '' });

      items = [dcItem({ sdiBilledQty: D(1) })];
      await expect(service.get(keys)).resolves.toMatchObject({ ageLevel: 'RED' });
    });

    it('opens the purpose on a partly returned APPROVAL challan, not on a SUPPLY one or a fully returned one', async () => {
      row = dcRow({ sdcStatus: 'POSTED', sdcPurpose: 'APPROVAL' });
      items = [dcItem({ sdiReturnedQty: D(1) })];
      await expect(service.get(keys)).resolves.toMatchObject({ locks: { editable: { purpose: true } } });

      items = [dcItem({ sdiReturnedQty: D(2) })];
      await expect(service.get(keys)).resolves.toMatchObject({ locks: { editable: { purpose: false } } });

      row = dcRow({ sdcStatus: 'POSTED', sdcPurpose: 'SUPPLY' });
      items = [dcItem({ sdiReturnedQty: D(1) })];
      await expect(service.get(keys)).resolves.toMatchObject({ locks: { editable: { purpose: false } } });

      row = dcRow({ sdcStatus: 'POSTED', sdcPurpose: 'APPROVAL' });
      items = [dcItem({ sdiBilledQty: D(1) })];
      await expect(service.get(keys)).resolves.toMatchObject({ locks: { editable: { purpose: false } } });
    });
  });
});
