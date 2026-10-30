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
import { DeliveryChallanService } from './delivery-challan.service';
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
  sdcDcAmt: D('1180.00'),
  sdcTaxAmt: D('180.00'),
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
    orderLines: { soi_id: string; soi_pending_qty: Prisma.Decimal | null }[];
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
  };
  let statutory: { ewayApplicable: jest.Mock; withinCancelWindow: jest.Mock };
  let legs: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let register: { registerIdOf: jest.Mock; write: jest.Mock; cancel: jest.Mock };
  let stock: { post: jest.Mock; cancel: jest.Mock };
  let blocks: { build: jest.Mock; gstRows: jest.Mock };
  let transportBand: { write: jest.Mock };
  let fulfilment: { recompute: jest.Mock };
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
    };
    tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('FROM public.companys')) return db.company ? [db.company] : [];
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
    };
    statutory = {
      ewayApplicable: jest.fn().mockResolvedValue({ limit: null, applicable: false }),
      withinCancelWindow: jest
        .fn()
        .mockResolvedValue({ limit: null, within: true, hoursElapsed: 1 }),
    };
    legs = {
      postLegs: jest.fn().mockResolvedValue({ voucherId: VOUCHER_ID, voucherLastNo: 44n }),
      reverseLegs: jest.fn().mockResolvedValue({ voucherId: REVERSAL_ID }),
    };
    register = {
      registerIdOf: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue({ gdrId: GDR_ID, ewaybillApplicable: true }),
      cancel: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      {} as never,
      {} as never,
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
      row = dcRow({ sdcDcDate: new Date(`${FUTURE}T00:00:00.000Z`) });
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

    it('answers ok with the rights when nothing is wrong', async () => {
      await expect(service.validate(validateBody())).resolves.toEqual({
        ok: true,
        refusals: [],
        warnings: [],
        rights: ctx.rights,
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
        validateBody({ sdcDcDate: FUTURE, sdcCustId: null, items: [] }),
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
    });

    it('does not look for a band on a challan that has not been saved yet', async () => {
      statutory.ewayApplicable.mockResolvedValue({ limit: null, applicable: true });

      const result = await service.validate(validateBody({ sdcId: undefined }));

      expect(store.loadTransport).not.toHaveBeenCalled();
      expect(result.warnings).toEqual([]);
    });
  });

  describe('post — what a posted challan leaves behind', () => {
    beforeEach(() => {
      items = [
        dcItem(),
        dcItem({ sdiId: LINE_B, sdiLineNo: 2, sdiDcQty: D(0), sdiFreeQty: D(0) }),
        dcItem({ sdiId: LINE_SERVICE, sdiLineNo: 3, sdiIsService: true }),
      ];
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

    it('writes each line its cost to the paisa and the lot the stock engine chose', async () => {
      await service.post(KEYS);

      expect(store.updateItem).toHaveBeenCalledTimes(1);
      expect(store.updateItem).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ sdiId: LINE_A }),
        {
          sdiCostPrice: D('412.35'),
          sdiLotId: LOT_ID,
        },
      );
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
        docAmount: 1180,
        partyId: CUST_ID,
        userId: USER_ID,
        presetRefno: 'dch00012',
        presetNo: 12n,
      });
      expect(voucher.legs).toEqual([
        expect.objectContaining({ role: 'COGS', drCr: 'DR', amount: 824.69 }),
        expect.objectContaining({ role: 'INVENTORY', drCr: 'CR', amount: 824.69 }),
      ]);
    });

    it('stamps the actor on the voucher when the challan user is not a uuid', async () => {
      row = dcRow({ sdcUserId: 'cashier1' });
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
        expect.objectContaining({ voucherId: DC_ID, voucherNo: 12n }),
        { interState: false },
      );
      expect(lastSetStatus()[3]).toMatchObject({ sdcPostedVoucherId: null });
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
        billValue: 1180,
        remarks: 'SUPPLY',
      });
      expect((doc.lines as unknown[]).length).toBe(3);
      expect(gst.enqueueAfterPost).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        einvoice: false,
        ewaybill: true,
      });
    });

    it('marks the challan POSTED last, then recomputes fulfilment and leaves the trail', async () => {
      await service.post(KEYS);

      expect(lastSetStatus()[3]).toEqual({
        sdcPostedVoucherId: VOUCHER_ID,
        sdcTotalCost: D('824.69'),
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

      await expect(service.cancel(cancelDto)).resolves.toEqual({
        id: DC_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
        sdcStatus: 'CANCELLED',
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
      expect(result).toMatchObject({ sdcStatus: 'CANCELLED', reversalVoucherRefno: 'dch-r-0003' });
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
      expect(store.auditChange).toHaveBeenLastCalledWith(
        tx,
        expect.objectContaining({ sdcId: DC_ID }),
        'update',
        expect.objectContaining({ sdcStatus: 'POSTED' }),
        expect.objectContaining({ sdcId: DC_ID }),
        USER_ID,
        'Challan amended to revision 3: Qty corrected',
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

    it('refuses once a line has been billed or returned', async () => {
      items = [dcItem({ sdiReturnedQty: D('0.5') })];

      const refusal = await refusalOf(service.convertPurpose(convertDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'purpose', code: SALES_ERROR_CODES.DC_BILLED }] },
      });
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

      await expect(service.transport(transportDto)).resolves.toEqual({ transporterName: 'VRL' });
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
  });
});
