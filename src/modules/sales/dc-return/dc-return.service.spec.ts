import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TxnStatusEvent } from '../../../common/txn-status-log/txn-status-log.helper';
import * as guards from '../posting/sales.guards';
import { SALES_MENU_ID, SALES_VOUCHER_TYPE } from '../posting/sales-doc.utils';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SALES_SETTING_DEFAULTS, type SalesSettings } from '../posting/sales.settings';
import { DCR_SPEC, DcReturnService, settleLastReturn } from './dc-return.service';
import type { SaveDcReturnDto } from './dto/save-dc-return.dto';

jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<object>('../posting/sales.guards'),
  assertAccYearWritable: jest.fn(),
  assertVoucherPartitionExists: jest.fn(),
  loadDayClosed: jest.fn(),
  loadDeclaredLocks: jest.fn(),
}));

const SDR_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const DC_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const DC_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b005';
const DC_ITEM_ID_2 = '019c6f6c-be87-7a11-8905-36092c46b006';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46b007';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b008';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46b009';
const REVERSAL_ID = '019c6f6c-be87-7a11-8905-36092c46b00a';
const GDR_ID = '019c6f6c-be87-7a11-8905-36092c46b00b';
const SDRI_ID = '019c6f6c-be87-7a11-8905-36092c46b00c';
const SDRI_ID_2 = '019c6f6c-be87-7a11-8905-36092c46b00d';
const LOT_ID = '019c6f6c-be87-7a11-8905-36092c46b00e';
const ACC_YEAR = '2026-2027';
const RETURN_DATE = new Date('2026-10-10T00:00:00.000Z');
const REASON_ID = '019c6f6c-be87-7a11-8905-36092c46b00f';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46b010';

const KEYS = {
  sdrId: SDR_ID,
  sdrCompanyId: COMPANY_ID,
  sdrBranchId: BRANCH_ID,
  sdrAccYear: ACC_YEAR,
};

const dec = (v: number | string) => new Prisma.Decimal(v);

const returnRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sdrId: SDR_ID,
  sdrCompanyId: COMPANY_ID,
  sdrBranchId: BRANCH_ID,
  sdrAccYear: ACC_YEAR,
  sdrTenantId: null,
  sdrDeviceId: 'COUNTER-1',
  sdrDeviceType: 'DESKTOP',
  sdrSessionId: null,
  sdrStatus: 'DRAFT',
  sdrReturnDate: RETURN_DATE,
  sdrReturnDatetime: new Date('2026-10-10T06:00:00.000Z'),
  sdrReturnRefno: 'DCR/00012',
  sdrReturnSlno: 12n,
  sdrUsrRefno: null,
  sdrDcId: DC_ID,
  sdrDcAccYear: `${ACC_YEAR}`,
  sdrDcRefno: 'DC/00007',
  sdrCustId: CUST_ID,
  sdrCustName: 'Acme Stores',
  sdrCustGstin: ' 33ABCDE1234F1Z5 ',
  sdrCustStcd: '33',
  sdrPosStcd: '33',
  sdrUserId: USER_ID,
  sdrRemarks: null,
  sdrReasonId: REASON_ID,
  sdrReturnReason: 'Excess supply',
  sdrGrossAmt: dec('210'),
  sdrTaxableAmt: dec('200'),
  sdrTaxAmt: dec('10'),
  sdrReturnAmt: dec('210'),
  sdrTotalCost: dec('0'),
  sdrPostedVoucherId: null,
  ...overrides,
});

const itemRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sdriId: SDRI_ID,
  sdriLineNo: 1,
  sdriDcItemId: DC_ITEM_ID,
  sdriItemId: 'item-1',
  sdriItemUnitId: 'unit-1',
  sdriGodownId: 'godown-1',
  sdriLotId: null,
  sdriBucket: null,
  sdriCondition: 'RESTOCK',
  sdriReturnQty: dec('4'),
  sdriFreeQty: dec('0'),
  sdriWeightQty: null,
  sdriToBaseFactor: dec('1'),
  sdriBatchNo: null,
  sdriExpiryDate: null,
  sdriSerialNo: null,
  sdriMaxPrice: null,
  sdriRate: dec('50'),
  sdriCostPrice: dec('30'),
  sdriTaxPerc: dec('5'),
  sdriIsService: false,
  sdriHsnCode: '3004',
  sdriTaxId: null,
  sdriTaxableAmt: dec('200'),
  sdriItemDiscAmt: dec('0'),
  sdriCgstPerc: dec('2.5'),
  sdriSgstPerc: dec('2.5'),
  sdriIgstPerc: dec('0'),
  sdriCessPerc: dec('0'),
  sdriCgstAmt: dec('5'),
  sdriSgstAmt: dec('5'),
  sdriIgstAmt: dec('0'),
  sdriCessAmt: dec('0'),
  sdriNetAmt: dec('210'),
  ...overrides,
});

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

/** The challan header the return answers (saleDc.findFirst, camelCase as Prisma reads it). */
const challanRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sdcId: DC_ID,
  sdcAccYear: ACC_YEAR,
  sdcCompanyId: COMPANY_ID,
  sdcBranchId: BRANCH_ID,
  sdcDcRefno: 'DC/00007',
  sdcDcDate: new Date('2026-10-05T00:00:00.000Z'),
  sdcStatus: 'POSTED',
  sdcPurpose: 'SUPPLY',
  sdcCustId: CUST_ID,
  sdcCustName: 'Acme Stores',
  sdcCustGstin: '33ABCDE1234F1Z5',
  sdcCustStcd: '33',
  sdcPosStcd: '33',
  sdcDcAmt: dec('525'),
  ...overrides,
});

/** A challan line the return copies its facts from (saleDcItem.findMany). */
const challanLine = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sdiId: DC_ITEM_ID,
  sdiDcId: DC_ID,
  sdiAccYear: ACC_YEAR,
  sdiLineNo: 1,
  sdiItemId: 'item-1',
  sdiItemUnitId: 'unit-1',
  sdiToBaseFactor: dec('1'),
  sdiHsnCode: '3004',
  sdiGodownId: 'godown-1',
  sdiLotId: LOT_ID,
  sdiBatchNo: 'B1',
  sdiExpiryDate: null,
  sdiSerialNo: null,
  sdiDcQty: dec('10'),
  sdiWeightQty: dec('0'),
  sdiRate: dec('50'),
  sdiCostPrice: dec('30'),
  sdiTaxId: null,
  sdiTaxPerc: dec('5'),
  sdiCgstPerc: dec('2.5'),
  sdiSgstPerc: dec('2.5'),
  sdiIgstPerc: dec('0'),
  sdiCessPerc: dec('0'),
  sdiCessPerUnit: null,
  sdiPriceLevel: 1,
  sdiEanCode: null,
  sdiIsTaxIncl: false,
  sdiIsService: false,
  sdiRatePreTax: null,
  sdiMaxPrice: null,
  sdiItemDiscPerc: dec('0'),
  sdiItemDiscAmt: dec('0'),
  sdiSchDiscAmt: dec('0'),
  sdiGrossAmt: dec('500'),
  sdiTaxableAmt: dec('500'),
  sdiCgstAmt: dec('12.5'),
  sdiSgstAmt: dec('12.5'),
  sdiIgstAmt: dec('0'),
  sdiCessAmt: dec('0'),
  sdiSize: null,
  sdiSizeUom: null,
  ...overrides,
});

/** Raw-query answers, picked by a marker in the SQL text. Order matters: first match wins. */
type SqlAnswers = {
  existing: unknown[];
  dcLines: unknown[];
  reason: unknown[];
  openLock: unknown[];
  openSum: unknown[];
  company: unknown[];
  voucherRefno: unknown[];
  openLines: unknown[];
  bills: unknown[];
  registerNo: unknown[];
  srcOrderLines: unknown[];
  orderRefs: unknown[];
  orderKeys: unknown[];
  postedSums: unknown[];
};
const SQL_MARKERS: Array<[string, keyof SqlAnswers]> = [
  ['FROM sales.sale_dc_return\n       WHERE sdr_id', 'existing'],
  // postedReturnSums (P6 R4) — before 'AS dc_item_id' (open-lines), which it also holds.
  ['SUM(r.sdri_return_qty) AS qty', 'postedSums'],
  ['SELECT sdi_id, sdi_dc_id, sdi_acc_year, sdi_line_no, sdi_open_qty', 'dcLines'],
  ['FROM stock.stock_reason_master', 'reason'],
  ['SELECT sdi_open_qty AS open_qty', 'openLock'],
  ['SUM(sdi_open_qty) AS open_qty', 'openSum'],
  ['SELECT comp_state_code', 'company'],
  ['SELECT avh_voucher_refno', 'voucherRefno'],
  ['AS dc_item_id', 'openLines'],
  ['h.sb_bill_date AS bill_date', 'bills'],
  ['MAX(gdr_voucher_no)', 'registerNo'],
  // dcSourceOrdersOfLines (P6 S1): the challan lines' order lines and orders.
  ['END AS line_so_id', 'srcOrderLines'],
  ['SELECT soi_id, soi_acc_year FROM sales.sale_order_item', 'orderRefs'],
  ['SELECT soi_order_id, soi_line_no FROM sales.sale_order_item', 'orderKeys'],
];

describe('DcReturnService', () => {
  let sql: SqlAnswers;
  let prisma: { $queryRaw: jest.Mock; $transaction: jest.Mock };
  let store: Record<string, jest.Mock>;
  let ctx: {
    userId: string;
    actor: string;
    actorName: string;
    cogsMode: 'PERPETUAL' | 'PERIODIC';
    rights: { post: boolean; cancel: boolean; override: boolean; create?: boolean; edit?: boolean };
    settings: SalesSettings;
  };
  let salesContext: { actor: jest.Mock; rights: jest.Mock; resolve: jest.Mock; values: jest.Mock };
  let statutory: { withinCancelWindow: jest.Mock; limit: jest.Mock };
  let audit: { logDocumentRevision: jest.Mock };
  let challan: Record<string, unknown> | null;
  let challanLines: Record<string, unknown>[];
  let legs: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let register: { registerIdOf: jest.Mock; write: jest.Mock; cancel: jest.Mock };
  let stock: { post: jest.Mock; cancel: jest.Mock };
  let blocks: { build: jest.Mock; gstRows: jest.Mock };
  let transportBand: { write: jest.Mock };
  let fulfilment: { recompute: jest.Mock };
  let saleOrders: { syncOrderFulfilment: jest.Mock };
  let reservations: { rederiveOrderLines: jest.Mock };
  let gst: { enqueueAfterPost: jest.Mock; cancelEwb: jest.Mock };
  let service: DcReturnService;

  beforeEach(() => {
    sql = {
      existing: [],
      dcLines: [
        {
          sdi_id: DC_ITEM_ID,
          sdi_dc_id: DC_ID,
          sdi_acc_year: ACC_YEAR,
          sdi_line_no: 1,
          sdi_open_qty: dec('10'),
          sdi_to_base_factor: dec('1'),
        },
      ],
      reason: [{ remarks: false }],
      openLock: [{ open_qty: dec('10') }],
      openSum: [{ open_qty: dec('6') }],
      company: [{ comp_state_code: '33' }],
      voucherRefno: [{ avh_voucher_refno: 'DCR/00012/R' }],
      openLines: [],
      bills: [],
      registerNo: [{ n: 7n }],
      srcOrderLines: [],
      orderRefs: [],
      orderKeys: [],
      postedSums: [],
    };
    challan = challanRow();
    challanLines = [challanLine()];
    prisma = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const text = strings.join('?');
        const hit = SQL_MARKERS.find(([marker]) => text.includes(marker));
        return Promise.resolve(hit ? sql[hit[1]] : []);
      }),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
      saleDc: { findFirst: jest.fn(async () => challan) },
      saleDcItem: { findMany: jest.fn(async () => challanLines) },
    } as unknown as { $queryRaw: jest.Mock; $transaction: jest.Mock };
    store = {
      saveDraft: jest.fn().mockResolvedValue(returnRow()),
      keysOf: jest.fn((row: Record<string, unknown>) => ({
        id: row.sdrId,
        companyId: row.sdrCompanyId,
        branchId: row.sdrBranchId,
        accYear: row.sdrAccYear,
      })),
      findOrThrow: jest.fn().mockResolvedValue(returnRow()),
      loadItems: jest.fn().mockResolvedValue([itemRow()]),
      loadTransport: jest.fn().mockResolvedValue({ vehicleNo: 'TN01AB1234' }),
      plain: jest.fn((row: Record<string, unknown>) => ({ ...row, plain: true })),
      deleteDraft: jest.fn().mockResolvedValue(undefined),
      lock: jest.fn().mockResolvedValue(returnRow()),
      updateItem: jest.fn().mockResolvedValue({}),
      setStatus: jest.fn().mockResolvedValue(undefined),
      trail: jest.fn().mockResolvedValue(undefined),
      auditChange: jest.fn().mockResolvedValue(undefined),
    };
    ctx = {
      userId: USER_ID,
      actor: USER_ID,
      actorName: 'tester1',
      cogsMode: 'PERPETUAL',
      rights: { post: true, cancel: true, override: false, create: true, edit: true },
      settings: { ...SALES_SETTING_DEFAULTS, backdateMode: 'ALLOW' },
    };
    salesContext = {
      actor: jest.fn().mockReturnValue(USER_ID),
      rights: jest.fn().mockResolvedValue({
        view: true,
        create: true,
        edit: true,
        delete: true,
        post: true,
        amend: true,
      }),
      resolve: jest.fn(async () => ctx),
      values: jest.fn().mockResolvedValue({}),
    };
    statutory = {
      withinCancelWindow: jest.fn().mockResolvedValue({ within: true }),
      limit: jest.fn().mockResolvedValue({ value: 180 }),
    };
    audit = { logDocumentRevision: jest.fn().mockResolvedValue({ revNo: 1 }) };
    legs = {
      postLegs: jest.fn().mockResolvedValue({ voucherId: VOUCHER_ID, voucherLastNo: 12n }),
      reverseLegs: jest.fn().mockResolvedValue({ voucherId: REVERSAL_ID }),
    };
    register = {
      registerIdOf: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue({ gdrId: GDR_ID, ewaybillApplicable: true }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    stock = {
      post: jest.fn().mockResolvedValue({ cogsTotal: 120, lotByLine: new Map<string, string>() }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    blocks = {
      build: jest.fn().mockResolvedValue({ posting: { status: 'x' }, locks: { editable: {} } }),
      gstRows: jest.fn().mockResolvedValue({ ewbGeneratedOn: new Date('2026-10-10T07:00:00Z') }),
    };
    transportBand = { write: jest.fn().mockResolvedValue({ vehicleNo: 'TN01AB1234' }) };
    fulfilment = { recompute: jest.fn().mockResolvedValue(undefined) };
    saleOrders = { syncOrderFulfilment: jest.fn().mockResolvedValue([]) };
    reservations = { rederiveOrderLines: jest.fn().mockResolvedValue(undefined) };
    gst = {
      enqueueAfterPost: jest.fn(),
      cancelEwb: jest.fn().mockResolvedValue({ cancelledOn: '2026-10-11' }),
    };

    jest.mocked(guards.assertAccYearWritable).mockResolvedValue(undefined);
    jest.mocked(guards.assertVoucherPartitionExists).mockResolvedValue(undefined);
    jest.mocked(guards.loadDayClosed).mockResolvedValue(false);
    jest.mocked(guards.loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: false });

    service = new DcReturnService(
      prisma as unknown as PrismaService,
      salesContext as never,
      statutory as never,
      legs as never,
      register as never,
      stock as never,
      blocks as never,
      transportBand as never,
      fulfilment as never,
      gst as never,
      audit as never,
      {} as never,
      {} as never,
      saleOrders as never,
      reservations as never,
    );
    // The service builds its SalesDocStore itself; swap in the mock.
    (service as unknown as { store: typeof store }).store = store;
  });

  const lastCallArg = (mock: jest.Mock, index: number) =>
    mock.mock.calls[mock.mock.calls.length - 1][index] as Record<string, unknown>;

  describe('DCR_SPEC', () => {
    it('files the document as a DC return, with no amend surface and an inward band', () => {
      expect(DCR_SPEC).toMatchObject({
        kind: 'DC_RETURN',
        p: 'sdr',
        ip: 'sdri',
        revisionField: null,
        voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
        menuId: SALES_MENU_ID.DC_RETURN,
        transportDirection: 'INWARD',
        headerRequired: ['sdrCounterId', 'sdrDcId', 'sdrDcAccYear'],
      });
      expect(DCR_SPEC.itemDefaults!({ sdrDcAccYear: ACC_YEAR })).toEqual({
        sdriPriceLevel: 1,
        sdriDcAccYear: ACC_YEAR,
      });
    });
  });

  describe('save', () => {
    const dto = {
      ...KEYS,
      sdrId: undefined,
      sdrDcId: DC_ID,
      sdrDcAccYear: ACC_YEAR,
      sdrDeviceType: 'DESKTOP',
      sdrDeviceId: 'COUNTER-1',
      sdrUserId: USER_ID,
    } as unknown as SaveDcReturnDto;

    it('refuses a return against a challan that does not exist (as /open-lines: not found)', async () => {
      challan = null;

      const refusal = await refusalOf(service.save(dto));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sdrDcId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    // P3 E6 (2026-11-16): a DRAFT challan may change or be deleted.
    it('refuses a return against a DRAFT challan (422 SALES_DCR_DC_NOT_POSTED) and saves nothing', async () => {
      challan = challanRow({ sdcStatus: 'DRAFT' });

      const refusal = await refusalOf(service.save(dto));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sdrDcId', code: SALES_ERROR_CODES.DCR_DC_NOT_POSTED }] },
      });
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it("refuses another company's challan as not found", async () => {
      challan = challanRow({ sdcCompanyId: '019c6f6c-be87-7a11-8905-36092c46b0ff' });

      const refusal = await refusalOf(service.save(dto));

      expect(refusal.body).toMatchObject({
        errors: [{ field: 'sdrDcId', code: SALES_ERROR_CODES.NOT_FOUND }],
      });
    });

    // P6 S4 (user 11-17): the branch too, as /open-lines (the goods come back here).
    it("refuses another BRANCH's challan of the same company as not found, once, and saves nothing", async () => {
      challan = challanRow({ sdcBranchId: '019c6f6c-be87-7a11-8905-36092c46b0fe', sdcStatus: 'DRAFT' });

      const refusal = await refusalOf(service.save(dto));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sdrDcId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
      expect((refusal.body as { errors: unknown[] }).errors).toHaveLength(1);
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it("copies the challan's refno, date and party onto the draft", async () => {
      await service.save(dto);

      const [, body, actor, now] = store.saveDraft.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        string,
        Date,
      ];
      expect(body).toMatchObject({
        sdrDcId: DC_ID,
        sdrDcRefno: 'DC/00007',
        sdrDcDate: '2026-10-05',
        sdrCustId: CUST_ID,
        sdrCustName: 'Acme Stores',
        sdrCustGstin: '33ABCDE1234F1Z5',
        sdrCustStcd: '33',
        sdrPosStcd: '33',
      });
      expect(actor).toBe(USER_ID);
      expect(now).toBeInstanceOf(Date);
    });

    it('reads the challan by the id and year the body names', async () => {
      await service.save(dto);

      const saleDc = (prisma as unknown as { saleDc: { findFirst: jest.Mock } }).saleDc;
      expect(saleDc.findFirst.mock.calls[0][0]).toMatchObject({
        where: { sdcId: DC_ID, sdcAccYear: ACC_YEAR, sdcIsDeleted: false },
      });
    });

    it("lets the challan's own refno and date win over what the body sends", async () => {
      await service.save({ ...dto, sdrDcRefno: 'DC/99999', sdrDcDate: '2026-01-01' });

      expect(lastCallArg(store.saveDraft, 1)).toMatchObject({
        sdrDcRefno: 'DC/00007',
        sdrDcDate: '2026-10-05',
      });
    });

    it("ignores the party the body sends: the challan's wins (decision 35)", async () => {
      await service.save({ ...dto, sdrCustName: 'Acme (walk-in)', sdrPosStcd: '29' });

      expect(lastCallArg(store.saveDraft, 1)).toMatchObject({
        sdrCustName: 'Acme Stores',
        sdrPosStcd: '33',
        sdrCustStcd: '33',
      });
    });

    it('copies every line fact from the challan line and keeps only qty, condition, godown, remark', async () => {
      await service.save({
        ...dto,
        items: [
          {
            sdriDcItemId: DC_ITEM_ID,
            sdriReturnQty: '4',
            sdriCondition: 'damaged',
            sdriRemarks: 'torn',
            // Client facts the server ignores:
            sdriItemId: 'hacked-item',
            sdriRate: '999',
            sdriLotId: null,
          },
        ],
      } as unknown as SaveDcReturnDto);

      const body = lastCallArg(store.saveDraft, 1);
      const [line] = body.items as Record<string, unknown>[];
      expect(line).toMatchObject({
        sdriDcItemId: DC_ITEM_ID,
        sdriItemId: 'item-1',
        sdriItemUnitId: 'unit-1',
        sdriLotId: LOT_ID,
        sdriBatchNo: 'B1',
        sdriRate: dec('50'),
        sdriCostPrice: dec('30'),
        sdriGodownId: 'godown-1',
        sdriCondition: 'DAMAGED',
        sdriBucket: 'DAMAGED',
        sdriReturnQty: '4.000',
        sdriFreeQty: '0',
        sdriRemarks: 'torn',
        // 4 of the challan line's 10: its share of the money.
        sdriTaxableAmt: '200.00',
        sdriCgstAmt: '5.00',
        sdriSgstAmt: '5.00',
        sdriTaxAmt: '10.00',
        sdriNetAmt: '210.00',
      });
      expect(body).toMatchObject({
        sdrTaxableAmt: '200.00',
        sdrTaxAmt: '10.00',
        sdrReturnAmt: '210.00',
        sdrTotalCost: '120.00',
        sdrTotItems: 1,
      });
    });

    it('refuses a line of another challan (422 SALES_DCR_LINE_NOT_ON_DC)', async () => {
      challanLines = [challanLine({ sdiDcId: '019c6f6c-be87-7a11-8905-36092c46b0aa' })];

      const refusal = await refusalOf(
        service.save({
          ...dto,
          items: [{ sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }],
        } as unknown as SaveDcReturnDto),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC, line: 1 }] },
      });
      expect(store.saveDraft).not.toHaveBeenCalled();
    });

    it('refuses a charge row (422 SALES_DC_CHARGES_NOT_ALLOWED) before anything is read', async () => {
      const refusal = await refusalOf(
        service.save({ ...dto, charges: [{ cdChargeId: 'x' }] } as unknown as SaveDcReturnDto),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('needs CREATE on 251 for a new return and EDIT for a draft', async () => {
      salesContext.rights.mockResolvedValue({ view: true, create: false, edit: true });
      await expect(refusalOf(service.save(dto))).resolves.toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CREATE }] },
      });
      expect(salesContext.rights).toHaveBeenCalledWith(251, prisma);

      sql.existing = [
        { sdr_id: SDR_ID, sdr_company_id: COMPANY_ID, sdr_branch_id: BRANCH_ID, sdr_acc_year: ACC_YEAR },
      ];
      salesContext.rights.mockResolvedValue({ view: true, create: true, edit: false });
      await expect(refusalOf(service.save({ ...dto, sdrId: SDR_ID }))).resolves.toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_EDIT }] },
      });
    });

    it('numbers a new return per PC and files ONE revision (screen 100)', async () => {
      await service.save(dto);

      const hooks = lastCallArg(store.saveDraft, 4) as { revision?: boolean; numberFor?: unknown };
      expect(hooks.revision).toBe(true);
      expect(typeof hooks.numberFor).toBe('function');
      expect(audit.logDocumentRevision).toHaveBeenCalledWith(
        expect.objectContaining({
          screenName: 'DC Return',
          tableName: 'sale_dc_return',
          docId: SDR_ID,
          before: null,
          notes: 'Challan return created',
        }),
        prisma,
      );
    });

    it('stamps the return datetime with the save time only when the body has none', async () => {
      await service.save(dto);
      const { beforeWrite } = lastCallArg(store.saveDraft, 4) as {
        beforeWrite: (data: Record<string, unknown>) => void;
      };
      const now = store.saveDraft.mock.calls[0][3] as Date;

      const blank: Record<string, unknown> = {};
      beforeWrite(blank);
      const given: Record<string, unknown> = { sdrReturnDatetime: '2026-10-09T10:00:00Z' };
      beforeWrite(given);

      expect(blank.sdrReturnDatetime).toBe(now);
      expect(given.sdrReturnDatetime).toBe('2026-10-09T10:00:00Z');
    });

    it('runs in one long transaction and answers with the re-read document', async () => {
      const result = await service.save(dto);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 60_000,
        maxWait: 10_000,
      });
      expect(store.findOrThrow).toHaveBeenCalledWith(prisma, {
        id: SDR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });
      expect(result).toMatchObject({ sdrId: SDR_ID, plain: true });
    });
  });

  describe('get', () => {
    const keys = { id: SDR_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR };

    it('assembles the header, lines, band, posting block and locks', async () => {
      store.findOrThrow.mockResolvedValue(returnRow({ sdrTotalCost: dec('120.5') }));
      register.registerIdOf.mockResolvedValue(GDR_ID);

      const result = await service.get(keys);

      expect(result).toMatchObject({
        sdrId: SDR_ID,
        plain: true,
        items: [expect.objectContaining({ sdriId: SDRI_ID, plain: true })],
        transport: { vehicleNo: 'TN01AB1234' },
        posting: { status: 'x' },
        locks: { editable: {} },
      });
      expect(salesContext.rights).toHaveBeenCalledWith(SALES_MENU_ID.DC_RETURN, prisma);
      expect(blocks.build).toHaveBeenCalledWith(
        {
          status: 'DRAFT',
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: ACC_YEAR,
          docDate: '2026-10-10',
          voucherId: null,
          registerId: GDR_ID,
          cogsAmt: 120.5,
          amendable: true,
        },
        prisma,
      );
    });

    it('dates the posting block today when the return has no date yet', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-15T10:00:00.000Z') });
      try {
        store.findOrThrow.mockResolvedValue(returnRow({ sdrReturnDate: null }));

        await service.get(keys);

        expect(lastCallArg(blocks.build, 0)).toMatchObject({ docDate: '2026-10-15', cogsAmt: 0 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('never offers amend, whatever the menu grants', async () => {
      const result = await service.get(keys);

      expect(result.rights).toMatchObject({ view: true, post: true, amend: false });
      expect(salesContext.rights).toHaveBeenCalledWith(251, prisma);
    });

    it('locks a POSTED return for good', async () => {
      store.findOrThrow.mockResolvedValue(
        returnRow({ sdrStatus: 'POSTED', sdrPostedVoucherId: VOUCHER_ID }),
      );

      await service.get(keys);

      expect(lastCallArg(blocks.build, 0)).toMatchObject({
        status: 'POSTED',
        voucherId: VOUCHER_ID,
        amendable: false,
      });
    });
  });

  describe('delete', () => {
    it('deletes the draft under the caller and confirms it', async () => {
      await expect(service.delete(KEYS)).resolves.toEqual({ sdrId: SDR_ID, deleted: true });

      expect(store.deleteDraft).toHaveBeenCalledWith(
        prisma,
        { id: SDR_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: ACC_YEAR },
        USER_ID,
        expect.any(Date),
      );
    });
  });

  describe('openLines', () => {
    const q = { companyId: COMPANY_ID, branchId: BRANCH_ID, sdcId: DC_ID, sdcAccYear: ACC_YEAR };

    it('answers the challan and its lines with Decimal strings and what drafts hold (G7)', async () => {
      sql.openLines = [
        {
          dc_item_id: DC_ITEM_ID,
          line_no: 1,
          item_id: 'item-1',
          item_unit_id: 'unit-1',
          to_base_factor: dec('1'),
          godown_id: 'godown-1',
          lot_id: null,
          batch_no: null,
          bucket: 'SALEABLE',
          dc_qty: dec('10'),
          billed_qty: dec('3'),
          returned_qty: dec('0.5'),
          open_qty: dec('6.5'),
          on_drafts: dec('2'),
          rate: dec('12.25'),
          cost_price: dec('8'),
          tax_perc: dec('5'),
        },
      ];
      sql.bills = [
        { sb_id: 'bill-1', acc_year: ACC_YEAR, refno: 'bil00042', bill_date: new Date('2026-10-07T00:00:00Z'), qty: dec('3') },
      ];

      const result = await service.openLines(q);

      expect(result.challan).toMatchObject({
        sdcId: DC_ID,
        refno: 'DC/00007',
        status: 'POSTED',
        custId: CUST_ID,
        value: '525.00',
        bills: [{ sbId: 'bill-1', refno: 'bil00042', date: '2026-10-07', qty: '3.000' }],
      });
      expect(result.lines).toEqual([
        expect.objectContaining({
          dcItemId: DC_ITEM_ID,
          dcQty: '10.000',
          billedQty: '3.000',
          returnedQty: '0.500',
          openQty: '6.500',
          onDrafts: '2.000',
          rate: '12.2500',
          toBaseFactor: '1.000000',
          unitKg: '0.000',
        }),
      ]);
    });

    // P3b — the facts strip's "180 days · per company" and its past-window flag.
    it('names the return window, read on the challan date, and whether the challan is past it', async () => {
      statutory.limit.mockResolvedValue({ value: 180, isCompanyOverride: false, effectiveFrom: '2017-07-01' });

      const supply = await service.openLines(q);
      challan = challanRow({ sdcPurpose: 'APPROVAL', sdcDcDate: new Date('2026-01-02T00:00:00.000Z') });
      statutory.limit.mockResolvedValue({ value: 90, isCompanyOverride: true, effectiveFrom: '2026-04-01' });
      const approval = await service.openLines(q);

      expect(statutory.limit).toHaveBeenNthCalledWith(1, COMPANY_ID, 'DC_RETURN_WINDOW_DAYS', '2026-10-05');
      expect(statutory.limit).toHaveBeenLastCalledWith(COMPANY_ID, 'DC_RETURN_WINDOW_DAYS', '2026-01-02');
      expect(supply.challan).toMatchObject({
        returnWindow: { days: 180, source: 'SHIPPED', effectiveFrom: '2017-07-01' },
        pastWindow: false,
      });
      expect(approval.challan).toMatchObject({
        ageLevel: 'RED',
        returnWindow: { days: 90, source: 'COMPANY', effectiveFrom: '2026-04-01' },
        pastWindow: true,
      });
    });

    // P6 N2 (user 11-17): nothing out on the challan = no age, as grids 116 / 220.
    it('answers no age level once nothing is open on the challan', async () => {
      statutory.limit.mockResolvedValue({ value: 90, isCompanyOverride: true, effectiveFrom: '2026-04-01' });
      challan = challanRow({ sdcPurpose: 'APPROVAL', sdcDcDate: new Date('2026-01-02T00:00:00.000Z') });
      sql.openSum = [{ open_qty: dec('0') }];

      const result = await service.openLines(q);

      expect(result.challan).toMatchObject({ ageLevel: '', pastWindow: true });
    });

    it('answers returnWindow null (no fallback figure) when no row is in force', async () => {
      statutory.limit.mockResolvedValue(null);
      challan = challanRow({ sdcPurpose: 'APPROVAL', sdcDcDate: new Date('2020-01-02T00:00:00.000Z') });

      const result = await service.openLines(q);

      expect(result.challan).toMatchObject({ ageLevel: '', returnWindow: null, pastWindow: false });
    });

    it('is scoped to the company and branch: another branch\'s challan is 404', async () => {
      challan = challanRow({ sdcBranchId: '019c6f6c-be87-7a11-8905-36092c46b0bb' });

      await expect(refusalOf(service.openLines(q))).resolves.toMatchObject({
        status: 404,
        body: { errors: [{ code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
    });

    it('needs VIEW on 251', async () => {
      salesContext.rights.mockResolvedValue({ view: false });

      await expect(refusalOf(service.openLines(q))).resolves.toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_VIEW }] },
      });
    });
  });

  describe('post', () => {
    it('answers a return that is already POSTED without posting it again', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'POSTED' }));

      await service.post(KEYS);

      expect(salesContext.resolve).not.toHaveBeenCalled();
      expect(stock.post).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
      expect(store.findOrThrow).toHaveBeenCalled();
    });

    it('refuses a CANCELLED return', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'CANCELLED' }));

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdrId', code: SALES_ERROR_CODES.DOC_CANCELLED }] },
      });
    });

    it('refuses a user without the post right on the DC return menu', async () => {
      ctx.rights.post = false;

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_POST }] },
      });
      expect(salesContext.resolve).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, branchId: BRANCH_ID, deviceId: 'COUNTER-1' },
        SALES_MENU_ID.DC_RETURN,
        prisma,
      );
      expect(stock.post).not.toHaveBeenCalled();
    });

    // P6 R4: settled again at /post under the challan lines' lock (a return may have posted since the draft).
    it('settles the last return under the challan lock: the stored line and the header take the rest', async () => {
      challanLines = [
        challanLine({ sdiDcQty: dec('3'), sdiGrossAmt: dec('100'), sdiTaxableAmt: dec('100'), sdiCgstAmt: dec('7.88'), sdiSgstAmt: dec('7.87') }),
      ];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriReturnQty: dec('1'), sdriGrossAmt: dec('33.33'), sdriTaxableAmt: dec('33.33'), sdriCgstAmt: dec('2.63'),
          sdriSgstAmt: dec('2.62'), sdriTaxAmt: dec('5.25'), sdriNetAmt: dec('38.58') }),
      ]);
      sql.postedSums = [
        { dc_item_id: DC_ITEM_ID, qty: dec('2'), gross: dec('66.66'), item_disc: dec(0), sch_disc: dec(0),
          taxable: dec('66.66'), cgst: dec('5.26'), sgst: dec('5.24'), igst: dec(0), cess: dec(0), weight: null },
      ];

      await service.post(KEYS);

      expect(store.updateItem).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdriId: SDRI_ID }),
        expect.objectContaining({ sdriTaxableAmt: '33.34', sdriCgstAmt: '2.62', sdriSgstAmt: '2.63', sdriTaxAmt: '5.25', sdriNetAmt: '38.59' }),
      );
      const totals = store.setStatus.mock.calls.find((c) => c[2] === 'DRAFT') as [unknown, unknown, string, Record<string, unknown>];
      expect(totals[3]).toMatchObject({ sdrTaxableAmt: '33.34', sdrTaxAmt: '5.25', sdrReturnAmt: '38.59' });
      const lockAt = prisma.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes('SELECT sdi_open_qty AS open_qty'));
      const sumsAt = prisma.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes('SUM(r.sdri_return_qty) AS qty'));
      expect(prisma.$queryRaw.mock.invocationCallOrder[lockAt]).toBeLessThan(prisma.$queryRaw.mock.invocationCallOrder[sumsAt]);
      expect(store.setStatus.mock.invocationCallOrder[store.setStatus.mock.calls.indexOf(totals)]).toBeLessThan(stock.post.mock.invocationCallOrder[0]);
    });

    it('rewrites nothing when no line is the last one back', async () => {
      await service.post(KEYS);

      expect(store.updateItem.mock.calls.some((c) => 'sdriTaxableAmt' in (c[2] as object))).toBe(false);
      expect(store.setStatus.mock.calls.some((c) => c[2] === 'DRAFT')).toBe(false);
    });

    it('collects every refusal into one 422 instead of stopping at the first', async () => {
      jest.mocked(guards.loadDayClosed).mockResolvedValue(true);
      challan = challanRow({ sdcStatus: 'DRAFT' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'DC return cannot be posted',
          errors: [
            { field: 'sdrReturnDate', code: SALES_ERROR_CODES.DAY_CLOSED },
            { field: 'sdrDcId', code: SALES_ERROR_CODES.DCR_DC_NOT_POSTED },
          ],
        },
      });
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('checks the year is writable and its voucher partition exists', async () => {
      await service.post(KEYS);

      expect(guards.assertAccYearWritable).toHaveBeenCalledWith(
        prisma,
        COMPANY_ID,
        ACC_YEAR,
        'sdrAccYear',
      );
      expect(guards.assertVoucherPartitionExists).toHaveBeenCalledWith(
        prisma,
        ACC_YEAR,
        'sdrAccYear',
      );
    });

    it('refuses a return dated in the future', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrReturnDate: new Date('2099-01-01T00:00:00Z') }));

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sdrReturnDate', code: SALES_ERROR_CODES.BACKDATE }] },
      });
    });

    // P6 N5 (user 11-17): a WARN goes on only overridden by a user who may, as the challan's.
    it('refuses a backdated return under WARN unless SALES_BACKDATE is overridden by a user who may', async () => {
      ctx.settings.backdateMode = 'WARN';

      const refused = await refusalOf(service.post(KEYS));
      expect(refused).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sdrReturnDate', code: SALES_ERROR_CODES.BACKDATE }] },
      });
      const noRight = await refusalOf(service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.BACKDATE] }));
      expect(noRight).toMatchObject({ status: 422 });
      expect(stock.post).not.toHaveBeenCalled();

      ctx.rights.override = true;
      await service.post({ ...KEYS, overrides: [SALES_ERROR_CODES.BACKDATE] });
      expect(stock.post).toHaveBeenCalledTimes(1);
    });

    // P6 S4: a stored return whose challan is another branch's (made through the API before the fix).
    it("refuses at post a return against another branch's challan (not found)", async () => {
      challan = challanRow({ sdcBranchId: '019c6f6c-be87-7a11-8905-36092c46b0fe' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sdrDcId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('refuses a challan that is not POSTED any more', async () => {
      challan = challanRow({ sdcStatus: 'CANCELLED' });

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.DCR_DC_NOT_POSTED }] },
      });
    });

    it('refuses a return with no line to take back (422 SALES_DCR_NO_LINES)', async () => {
      store.loadItems.mockResolvedValue([itemRow({ sdriReturnQty: dec('0') })]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'items', code: SALES_ERROR_CODES.DCR_NO_LINES }] },
      });
    });

    it('refuses a line naming a line of another challan (SALES_DCR_LINE_NOT_ON_DC)', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1'), sdi_dc_id: '019c6f6c-be87-7a11-8905-36092c46b0cc' }];

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'items',
              code: SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC,
              line: 1,
              params: { n: 1, dc: 'DC/00007' },
            },
          ],
        },
      });
    });

    it('refuses a return with no reason, or a reason that is not a challan-return one', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrReasonId: null }));
      await expect(refusalOf(service.post(KEYS))).resolves.toMatchObject({
        body: { errors: [{ field: 'sdrReasonId', code: SALES_ERROR_CODES.DCR_REASON_REQUIRED }] },
      });

      store.lock.mockResolvedValue(returnRow());
      sql.reason = [];
      await expect(refusalOf(service.post(KEYS))).resolves.toMatchObject({
        body: { errors: [{ field: 'sdrReasonId', code: SALES_ERROR_CODES.DCR_REASON_REQUIRED }] },
      });
    });

    it('wants the remark when the reason does (DCR_OTHER)', async () => {
      sql.reason = [{ remarks: true }];
      store.lock.mockResolvedValue(returnRow({ sdrReturnReason: '  ' }));

      await expect(refusalOf(service.post(KEYS))).resolves.toMatchObject({
        body: { errors: [{ field: 'sdrReturnReason', code: SALES_ERROR_CODES.DCR_REASON_REQUIRED }] },
      });
    });

    it('locks the challan lines FOR UPDATE in sdi_id order before the stock moves (decision 36)', async () => {
      await service.post(KEYS);

      const lockIdx = prisma.$queryRaw.mock.calls.findIndex(([strings]) =>
        (strings as TemplateStringsArray).join('?').includes('SELECT sdi_open_qty AS open_qty'),
      );
      const text = (prisma.$queryRaw.mock.calls[lockIdx][0] as TemplateStringsArray).join('?');
      expect(text).toContain('ORDER BY sdi_id');
      expect(text).toContain('FOR UPDATE');
      expect(prisma.$queryRaw.mock.invocationCallOrder[lockIdx]).toBeLessThan(
        stock.post.mock.invocationCallOrder[0],
      );
    });

    it('answers the challan\'s open qty before and after the post', async () => {
      const result = await service.post(KEYS);

      expect(result.challan).toMatchObject({
        sdcId: DC_ID,
        sdcAccYear: ACC_YEAR,
        refno: 'DC/00007',
        openBefore: '10.000',
        openAfter: '6.000',
      });
    });

    it('refuses a line taking more than is still open on its challan line', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('4'), sdi_to_base_factor: dec('1') }];
      store.loadItems.mockResolvedValue([itemRow({ sdriReturnQty: dec('5') })]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'items',
              code: SALES_ERROR_CODES.DCR_OVER_OPEN,
              message: 'Challan line 1 has 4 open; this return takes 5',
              line: 1,
            },
          ],
        },
      });
      expect(stock.post).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });

    it('reads the challan status and the open quantity of every line it posts', async () => {
      await service.post(KEYS);

      const argsOf = (marker: string) =>
        prisma.$queryRaw.mock.calls
          .find(([strings]) => (strings as TemplateStringsArray).join('?').includes(marker))!
          .slice(1);
      expect(argsOf('SELECT sdi_id, sdi_dc_id, sdi_acc_year, sdi_line_no, sdi_open_qty')).toEqual([
        [DC_ITEM_ID],
      ]);
    });

    it('stops at a year it may not write before posting anything', async () => {
      jest
        .mocked(guards.assertAccYearWritable)
        .mockRejectedValue(new HttpException({ errors: [{ code: 'ACC_YEAR_CLOSED' }] }, 400));

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal.status).toBe(400);
      expect(stock.post).not.toHaveBeenCalled();
      expect(store.setStatus).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).not.toHaveBeenCalled();
    });

    it('adds up two return lines drawn on the same challan line', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('6'), sdi_to_base_factor: dec('1') }];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriReturnQty: dec('4') }),
        itemRow({ sdriId: SDRI_ID_2, sdriLineNo: 2, sdriReturnQty: dec('3') }),
      ]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ message: 'Challan line 1 has 6 open; this return takes 7' }] },
      });
    });

    it('lets a return take exactly what is open', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('4'), sdi_to_base_factor: dec('1') }];

      await service.post(KEYS);

      expect(stock.post).toHaveBeenCalled();
    });

    it('compares in base units: 2 boxes of 12 against 24 pieces open', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('2'), sdi_to_base_factor: dec('12') }];
      store.loadItems.mockResolvedValue([itemRow({ sdriReturnQty: dec('2'), sdriToBaseFactor: dec('12') })]);

      await service.post(KEYS);

      expect(stock.post).toHaveBeenCalled();
    });

    it('brings the goods back IN under DC_RETURN at the cost they left at', async () => {
      await service.post(KEYS);

      const [tx, doc, actor] = stock.post.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        string,
      ];
      expect(tx).toBe(prisma);
      expect(actor).toBe(USER_ID);
      expect(doc).toMatchObject({
        docType: 'DC_RETURN',
        docId: SDR_ID,
        accYear: ACC_YEAR,
        direction: 'IN',
        txnType: 'DC_RETURN',
        refno: 'DCR/00012',
        revision: 1,
        partyId: CUST_ID,
        docDate: '2026-10-10',
      });
      expect((doc.lines as unknown[])[0]).toMatchObject({
        lineId: SDRI_ID,
        itemId: 'item-1',
        godownId: 'godown-1',
        bucket: 'SALEABLE',
        qty: 4,
        freeQty: 0,
        rate: 50,
        costRate: 30,
        taxPerc: 5,
      });
    });

    // Live 2026-11-16 (DR2627D14-00005): 4 pcs went back at 300.76 EACH, the
    // challan line's TOTAL. The engine takes a stated cost per BASE unit.
    it('hands the engine the unit cost per BASE unit: 51 a box of 12 is 4.25', async () => {
      store.loadItems.mockResolvedValue([
        itemRow({ sdriCostPrice: dec('51'), sdriToBaseFactor: dec('12') }),
      ]);
      // The challan line is in boxes of 12 too (the return copies its unit).
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('12') }];

      await service.post(KEYS);

      const doc = stock.post.mock.calls[0][1] as { lines: { costRate: number | null }[] };
      expect(doc.lines[0].costRate).toBe(4.25);
    });

    it('a 6-pc challan line at 50.1259 a piece: 4 go back at 50.1259 a piece, not at the line total', async () => {
      store.loadItems.mockResolvedValue([itemRow({ sdriCostPrice: dec('50.1259') })]);

      await service.post(KEYS);

      const doc = stock.post.mock.calls[0][1] as { lines: { qty: number; costRate: number | null }[] };
      expect(doc.lines[0]).toMatchObject({ qty: 4, costRate: 50.1259 });
    });

    it.each([
      ['RESTOCK', null, 'SALEABLE'],
      ['DAMAGED', null, 'DAMAGED'],
      ['EXPIRED', null, 'EXPIRED'],
      ['SCRAP', null, 'QUARANTINE'],
      [null, null, 'SALEABLE'],
      ['SOMETHING_ELSE', null, 'SALEABLE'],
      // Decision 15: the bucket follows the condition, never a typed bucket.
      ['RESTOCK', 'DAMAGED', 'SALEABLE'],
    ])('files a %s line with bucket %s into %s', async (condition, bucket, expected) => {
      store.loadItems.mockResolvedValue([
        itemRow({ sdriCondition: condition, sdriBucket: bucket }),
      ]);

      await service.post(KEYS);

      const doc = lastCallArg(stock.post, 1) as { lines: Array<{ bucket: string }> };
      expect(doc.lines[0].bucket).toBe(expected);
    });

    it('moves no stock for service lines or lines with nothing to return', async () => {
      sql.dcLines = [
        { sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
        { sdi_id: DC_ITEM_ID_2, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
      ];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriIsService: true }),
        itemRow({
          sdriId: SDRI_ID_2,
          sdriDcItemId: DC_ITEM_ID_2,
          sdriReturnQty: dec('0'),
          sdriFreeQty: dec('0'),
        }),
      ]);

      await service.post(KEYS);

      expect((lastCallArg(stock.post, 1).lines as unknown[]).length).toBe(0);
      expect(store.updateItem).not.toHaveBeenCalled();
    });

    it('hands the stock engine the line detail, blanking a zero factor and a zero cost', async () => {
      const datetime = new Date('2026-10-10T06:00:00.000Z');
      store.lock.mockResolvedValue(
        returnRow({
          sdrTenantId: 'tenant-1',
          sdrSessionId: 'session-1',
          sdrReturnDatetime: datetime,
        }),
      );
      store.loadItems.mockResolvedValue([
        itemRow({
          sdriLotId: LOT_ID,
          sdriBatchNo: 'B-17',
          sdriSerialNo: 'SN-1',
          sdriExpiryDate: new Date('2027-03-31T00:00:00.000Z'),
          sdriWeightQty: dec('2.5'),
          sdriMaxPrice: dec('60'),
          sdriToBaseFactor: dec('0'),
          sdriCostPrice: dec('0'),
          sdriFreeQty: dec('1'),
        }),
      ]);

      await service.post(KEYS);

      const doc = lastCallArg(stock.post, 1) as Record<string, unknown> & {
        lines: Array<Record<string, unknown>>;
      };
      expect(doc).toMatchObject({
        tenantId: 'tenant-1',
        deviceId: 'COUNTER-1',
        sessionId: 'session-1',
        docDatetime: datetime,
      });
      expect(doc.lines[0]).toMatchObject({
        lotId: LOT_ID,
        batchNo: 'B-17',
        serialNo: 'SN-1',
        expiryDate: '2027-03-31',
        weightQty: 2.5,
        mrp: 60,
        qty: 4,
        freeQty: 1,
        toBaseFactor: null,
        costRate: null,
      });
    });

    it('stamps the post time when the return carries no datetime, and its id when no refno', async () => {
      store.lock.mockResolvedValue(
        returnRow({ sdrReturnDatetime: null, sdrReturnRefno: null, sdrReturnSlno: null }),
      );

      await service.post(KEYS);

      const doc = lastCallArg(stock.post, 1);
      expect(doc.docDatetime).toBeInstanceOf(Date);
      expect(doc.docDatetime).toBe(lastCallArg(stock.post, 3));
      expect(doc.refno).toBe(SDR_ID);
      expect(
        (legs.postLegs.mock.calls[0][1] as { header: Record<string, unknown> }).header.docRefno,
      ).toBe(SDR_ID);
    });

    it('writes the lot the stock engine picked back onto the line', async () => {
      stock.post.mockResolvedValue({ cogsTotal: 120, lotByLine: new Map([[SDRI_ID, LOT_ID]]) });

      await service.post(KEYS);

      expect(store.updateItem).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdriId: SDRI_ID }),
        { sdriLotId: LOT_ID },
      );
    });

    it('reverses the COGS pair on a DCR voucher under PERPETUAL', async () => {
      await service.post(KEYS);

      const call = legs.postLegs.mock.calls[0][1] as {
        header: Record<string, unknown>;
        legs: Array<Record<string, unknown>>;
      };
      expect(call.header).toMatchObject({
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
        voucherDate: '2026-10-10',
        srcModule: 'SALES',
        srcDocType: 'DC_RETURN',
        srcDocId: SDR_ID,
        docRefno: 'DCR/00012',
        docAmount: 210,
        partyId: CUST_ID,
        userId: USER_ID,
        createdBy: USER_ID,
        presetRefno: 'DCR/00012',
      });
      expect(call.legs).toEqual([
        expect.objectContaining({ role: 'COGS', drCr: 'CR', amount: 120 }),
        expect.objectContaining({ role: 'INVENTORY', drCr: 'DR', amount: 120 }),
      ]);
      expect(store.setStatus).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        'POSTED',
        { sdrPostedVoucherId: VOUCHER_ID, sdrTotalCost: dec('120.00') },
        USER_ID,
        expect.any(Date),
      );
    });

    it('posts the voucher under the caller when the stored user is not a uuid', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrUserId: 'tester1' }));

      await service.post(KEYS);

      expect((legs.postLegs.mock.calls[0][1] as { header: { userId: string } }).header.userId).toBe(
        USER_ID,
      );
    });

    it('writes no voucher under PERIODIC but still records the cost', async () => {
      ctx.cogsMode = 'PERIODIC';

      await service.post(KEYS);

      expect(legs.postLegs).not.toHaveBeenCalled();
      expect(lastCallArg(store.setStatus, 3)).toEqual({
        sdrPostedVoucherId: null,
        sdrTotalCost: dec('120.00'),
      });
    });

    it('writes no voucher when the goods came back at no cost', async () => {
      stock.post.mockResolvedValue({ cogsTotal: 0, lotByLine: new Map<string, string>() });

      await service.post(KEYS);

      expect(legs.postLegs).not.toHaveBeenCalled();
      expect(lastCallArg(store.setStatus, 3)).toEqual({
        sdrPostedVoucherId: null,
        sdrTotalCost: dec('0.00'),
      });
      expect(lastCallArg(register.write, 1)).toMatchObject({ voucherId: SDR_ID });
    });

    it('writes neither voucher nor register row for a return with no customer', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrCustId: null }));

      await service.post(KEYS);

      expect(legs.postLegs).not.toHaveBeenCalled();
      expect(register.write).not.toHaveBeenCalled();
      expect(gst.enqueueAfterPost).toHaveBeenCalledWith({
        gdrId: null,
        einvoice: false,
        ewaybill: false,
      });
    });

    it('writes an inward CHALLAN register row for the e-way bill', async () => {
      await service.post(KEYS);

      const [, doc, opts] = register.write.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(opts).toEqual({ interState: false, ewayStateCode: '33' });
      expect(doc).toMatchObject({
        voucherId: VOUCHER_ID,
        voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
        // The register's own serial (per-device slnos repeat across PCs).
        voucherNo: 7n,
        voucherDate: '2026-10-10',
        voucherRefno: 'DCR/00012',
        sourceDocId: SDR_ID,
        docType: 'CHALLAN',
        tranNature: 'DELIVERY_CHALLAN',
        docFlow: 'INWARD',
        docSign: -1,
        docRefNo: 'DC/00007',
        taxability: 'TAXABLE',
        supplyNature: 'INTRA_STATE',
        partyGstin: '33ABCDE1234F1Z5',
        grossValue: 210,
        taxableValue: 200,
        billValue: 210,
        remarks: 'Excess supply',
      });
      expect((doc.lines as unknown[])[0]).toMatchObject({
        rowNo: 1,
        qty: 4,
        rate: 50,
        taxableValue: 200,
        cgstAmount: 5,
        sgstAmount: 5,
        totalValue: 210,
        billValue: 210,
        taxability: 'TAXABLE',
      });
    });

    // 11-17: the return's header holds no GST split; its register header now
    // takes the lines' sums, as the challan's carries its own (was all 0).
    it("files the lines' CGST / SGST / IGST / cess sums on the register header", async () => {
      sql.dcLines = [
        { sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
        { sdi_id: DC_ITEM_ID_2, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 2, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
      ];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriCessAmt: dec('1.25') }),
        itemRow({
          sdriId: SDRI_ID_2,
          sdriLineNo: 2,
          sdriDcItemId: DC_ITEM_ID_2,
          sdriCgstAmt: dec('2.55'),
          sdriSgstAmt: dec('2.55'),
        }),
      ]);

      await service.post(KEYS);

      expect(lastCallArg(register.write, 1)).toMatchObject({
        cgstValue: 7.55,
        sgstValue: 7.55,
        igstValue: 0,
        cessValue: 1.25,
      });
    });

    it('marks the register row inter-state when the place of supply is another state', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrPosStcd: '29' }));

      await service.post(KEYS);

      const [, doc, opts] = register.write.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        unknown,
      ];
      expect(opts).toEqual({ interState: true, ewayStateCode: '29' });
      expect(doc.supplyNature).toBe('INTER_STATE');
    });

    // User 11-16: the inward e-way floor of a blank-POS return is the company
    // state's, as the challan's; the register still files the POS as given.
    it('judges a blank-POS return by the company state on the register write', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrPosStcd: null }));

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

    it('files the register row against the return itself when no voucher was written', async () => {
      ctx.cogsMode = 'PERIODIC';
      store.lock.mockResolvedValue(returnRow({ sdrReturnSlno: null, sdrTaxAmt: dec('0') }));
      // A 0 % line: the register's taxability follows the lines (P3 fix 11-17).
      store.loadItems.mockResolvedValue([
        itemRow({
          sdriTaxPerc: dec('0'),
          sdriCgstPerc: dec('0'),
          sdriSgstPerc: dec('0'),
          sdriCgstAmt: dec('0'),
          sdriSgstAmt: dec('0'),
          sdriNetAmt: dec('200'),
        }),
      ]);

      await service.post(KEYS);

      expect(lastCallArg(register.write, 1)).toMatchObject({
        voucherId: SDR_ID,
        // The register's own serial (per-device slnos repeat across PCs).
        voucherNo: 7n,
        taxability: 'EXEMPT',
        partyGstin: '33ABCDE1234F1Z5',
      });
    });

    it('numbers the register row from its own serial, never the per-device slno or the voucher', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrReturnSlno: 3n }));
      legs.postLegs.mockResolvedValue({ voucherId: VOUCHER_ID, voucherLastNo: 99n });
      sql.registerNo = [{ n: 41n }];

      await service.post(KEYS);

      expect(lastCallArg(register.write, 1)).toMatchObject({
        voucherId: VOUCHER_ID,
        voucherNo: 41n,
      });
      const serial = prisma.$queryRaw.mock.calls.find(([strings]) =>
        (strings as TemplateStringsArray).join('?').includes('MAX(gdr_voucher_no)'),
      )!;
      expect(serial.slice(1)).toEqual([COMPANY_ID, BRANCH_ID, ACC_YEAR, SALES_VOUCHER_TYPE.DC_RETURN]);
    });

    it('values a register line at taxable plus tax when it has no net amount, EXEMPT when untaxed', async () => {
      sql.dcLines = [
        { sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
        { sdi_id: DC_ITEM_ID_2, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
      ];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriNetAmt: dec('0') }),
        itemRow({
          sdriId: SDRI_ID_2,
          sdriLineNo: 2,
          sdriDcItemId: DC_ITEM_ID_2,
          sdriTaxableAmt: dec('80'),
          sdriNetAmt: dec('80'),
          // A 0 % item: no rate either (a rate with no tax is a FREE line, TAXABLE).
          sdriTaxPerc: dec('0'),
          sdriCgstPerc: dec('0'),
          sdriSgstPerc: dec('0'),
          sdriCgstAmt: dec('0'),
          sdriSgstAmt: dec('0'),
        }),
      ]);
      store.lock.mockResolvedValue(returnRow({ sdrCustGstin: '   ' }));

      await service.post(KEYS);

      const doc = lastCallArg(register.write, 1) as Record<string, unknown> & {
        lines: Array<Record<string, unknown>>;
      };
      expect(doc.partyGstin).toBeNull();
      expect(doc.lines[0]).toMatchObject({
        totalValue: 210,
        billValue: 210,
        taxability: 'TAXABLE',
      });
      expect(doc.lines[1]).toMatchObject({
        rowNo: 2,
        totalValue: 80,
        billValue: 80,
        taxability: 'EXEMPT',
      });
      expect(doc.taxability).toBe('MIXED');
    });

    // Qt probe 2026-11-17: a returned FREE line (rate 0, so tax 0, GST 18 % =
    // 9/9 copied from the challan line) was filed EXEMPT and
    // chk_acc_voucher_doc_detail_non_taxable_zero answered a raw 500.
    describe('register taxability (the Sales Bill\'s rule)', () => {
      const registered = () =>
        lastCallArg(register.write, 1) as Record<string, unknown> & {
          lines: Array<Record<string, unknown>>;
        };
      const free18 = () =>
        itemRow({
          sdriRate: dec('0'),
          sdriTaxableAmt: dec('0'),
          sdriNetAmt: dec('0'),
          sdriTaxPerc: dec('18'),
          sdriCgstPerc: dec('9'),
          sdriSgstPerc: dec('9'),
          sdriCgstAmt: dec('0'),
          sdriSgstAmt: dec('0'),
        });
      const nil0 = () =>
        itemRow({
          sdriTaxPerc: dec('0'),
          sdriCgstPerc: dec('0'),
          sdriSgstPerc: dec('0'),
          sdriCgstAmt: dec('0'),
          sdriSgstAmt: dec('0'),
          sdriNetAmt: dec('200'),
        });

      it('files a returned FREE line (rate 0, no tax) TAXABLE with its 18 % kept', async () => {
        store.loadItems.mockResolvedValue([free18()]);
        store.lock.mockResolvedValue(
          returnRow({ sdrGrossAmt: dec('0'), sdrTaxableAmt: dec('0'), sdrTaxAmt: dec('0'), sdrReturnAmt: dec('0') }),
        );

        await service.post(KEYS);

        const doc = registered();
        expect(doc.lines[0]).toMatchObject({
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
        expect(doc.taxability).toBe('TAXABLE');
      });

      it('files a returned 0 % (nil-rated) line EXEMPT, and the return EXEMPT', async () => {
        store.loadItems.mockResolvedValue([nil0()]);

        await service.post(KEYS);

        const doc = registered();
        expect(doc.lines[0]).toMatchObject({ totalTaxRate: 0, cgstRate: 0, sgstRate: 0, taxability: 'EXEMPT' });
        expect(doc.taxability).toBe('EXEMPT');
      });

      it('files a FREE 18 % line beside a 0 % line as a MIXED return', async () => {
        sql.dcLines = [
          { sdi_id: DC_ITEM_ID, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 1, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
          { sdi_id: DC_ITEM_ID_2, sdi_dc_id: DC_ID, sdi_acc_year: ACC_YEAR, sdi_line_no: 2, sdi_open_qty: dec('10'), sdi_to_base_factor: dec('1') },
        ];
        store.loadItems.mockResolvedValue([
          free18(),
          { ...nil0(), sdriId: SDRI_ID_2, sdriLineNo: 2, sdriDcItemId: DC_ITEM_ID_2 },
        ]);

        await service.post(KEYS);

        const doc = registered();
        expect(doc.lines.map((l) => l.taxability)).toEqual(['TAXABLE', 'EXEMPT']);
        expect(doc.taxability).toBe('MIXED');
      });
    });

    it('recomputes the challan, trails and audits the post, then queues the GST work', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrDcAccYear: `${ACC_YEAR} ` }));

      await service.post(KEYS);

      expect(fulfilment.recompute).toHaveBeenCalledWith(
        prisma,
        [{ dcId: DC_ID, accYear: ACC_YEAR }],
        USER_ID,
        expect.any(Date),
      );
      expect(store.trail).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        TxnStatusEvent.POSTED,
        'DRAFT',
        'POSTED',
        USER_ID,
        expect.any(Date),
        null,
      );
      expect(store.auditChange).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        'approve',
        { sdrStatus: 'DRAFT' },
        { sdrStatus: 'POSTED', sdrPostedVoucherId: VOUCHER_ID, gdrId: GDR_ID, cogs: 120 },
        USER_ID,
        'DC return posted',
      );
      expect(gst.enqueueAfterPost).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        einvoice: false,
        ewaybill: true,
      });
    });
  });

  // User 2026-11-17 — a DC return re-opens the order lines its challan lines
  // came from, and its cancel draws them down again.
  describe('the order draw-down (user 11-17)', () => {
    const SOI = '019c6f6c-be87-7a11-8905-36092c46b0e1';
    const REF = {
      srcDocId: SOI,
      srcAccYear: ACC_YEAR,
      soLineNo: null,
      fields: { docId: 'sdiSrcItemId', accYear: 'sdiSrcDocAccYear', lineNo: 'sdiSrcLineNo' },
    };
    const callIdx = (marker: string) =>
      prisma.$queryRaw.mock.calls.findIndex((c) => (c[0] as string[]).join('?').includes(marker));
    beforeEach(() => {
      sql.srcOrderLines = [{ soi_id: SOI }];
      sql.orderRefs = [{ soi_id: SOI, soi_acc_year: `${ACC_YEAR} ` }];
      sql.orderKeys = [{ soi_order_id: SO, soi_line_no: 2 }];
    });
    const SO = '019c6f6c-be87-7a11-8905-36092c46b0e2';

    it('post and cancel re-derive the order lines\' reservations after the order (Q2)', async () => {
      await service.post(KEYS);
      expect(reservations.rederiveOrderLines).toHaveBeenCalledWith(prisma, SO, [2], USER_ID, expect.any(Date));
      expect(reservations.rederiveOrderLines.mock.invocationCallOrder[0]).toBeGreaterThan(
        saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0],
      );

      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'POSTED', sdrPostedVoucherId: VOUCHER_ID }));
      await service.cancel({ ...KEYS, reason: 'Wrong challan' } as never);
      expect(reservations.rederiveOrderLines).toHaveBeenCalledTimes(2);
    });

    it('post: locks the source orders before the challan lines, and re-opens them once POSTED', async () => {
      await service.post(KEYS);

      const orderLock = callIdx('FOR UPDATE OF h');
      const lineLock = callIdx('SELECT sdi_open_qty AS open_qty');
      expect(orderLock).toBeGreaterThanOrEqual(0);
      expect(prisma.$queryRaw.mock.invocationCallOrder[orderLock]).toBeLessThan(
        prisma.$queryRaw.mock.invocationCallOrder[lineLock],
      );
      expect(prisma.$queryRaw.mock.calls[callIdx('END AS line_so_id')][1]).toEqual([DC_ITEM_ID]);
      // P6 S1 — the challan HEADER is locked after the orders and before its lines.
      const headLock = callIdx('SELECT sdc_id FROM sales.sale_dc\n');
      expect(headLock).toBeGreaterThanOrEqual(0);
      expect(prisma.$queryRaw.mock.invocationCallOrder[orderLock]).toBeLessThan(
        prisma.$queryRaw.mock.invocationCallOrder[headLock],
      );
      expect(prisma.$queryRaw.mock.invocationCallOrder[headLock]).toBeLessThan(
        prisma.$queryRaw.mock.invocationCallOrder[lineLock],
      );
      expect(saleOrders.syncOrderFulfilment).toHaveBeenCalledWith(
        prisma,
        { refs: [REF], reopenRemark: 'Reopened: DC return DCR/00012 posted' },
        USER_ID,
        expect.any(Date),
      );
      expect(saleOrders.syncOrderFulfilment.mock.invocationCallOrder[0]).toBeGreaterThan(
        store.setStatus.mock.invocationCallOrder.at(-1)!,
      );
    });

    it('asks the order module nothing when the challan lines came from no order', async () => {
      sql.srcOrderLines = [];

      await service.post(KEYS);

      expect(saleOrders.syncOrderFulfilment).not.toHaveBeenCalled();
    });

    it('cancel: locks the orders before the challan lines and draws them down again after', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'POSTED', sdrPostedVoucherId: VOUCHER_ID }));

      await service.cancel({ ...KEYS, reason: 'Wrong challan' } as never);

      expect(prisma.$queryRaw.mock.invocationCallOrder[callIdx('FOR UPDATE OF h')]).toBeLessThan(
        prisma.$queryRaw.mock.invocationCallOrder[callIdx('SELECT sdi_open_qty AS open_qty')],
      );
      expect(saleOrders.syncOrderFulfilment).toHaveBeenCalledWith(
        prisma,
        { refs: [REF], reopenRemark: 'Reopened: DC return DCR/00012 cancelled' },
        USER_ID,
        expect.any(Date),
      );
    });
  });

  describe('cancel', () => {
    const cancelDto = { ...KEYS, reason: 'Entered against the wrong challan' };

    beforeEach(() => {
      store.lock.mockResolvedValue(
        returnRow({ sdrStatus: 'POSTED', sdrPostedVoucherId: VOUCHER_ID }),
      );
    });

    it('answers a return that is already CANCELLED without touching it', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'CANCELLED' }));

      // The /get payload, with no reversal and no challan figures.
      await expect(service.cancel(cancelDto)).resolves.toMatchObject({
        sdrId: SDR_ID,
        charges: [],
        reversalVoucherRefno: null,
        cancelledOn: null,
      });
      expect(salesContext.resolve).not.toHaveBeenCalled();
    });

    it('refuses a DRAFT, which is deleted rather than cancelled', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'DRAFT' }));

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdrId', code: SALES_ERROR_CODES.DOC_NOT_DRAFT }] },
      });
    });

    it('refuses a user without the cancel right', async () => {
      ctx.rights.cancel = false;

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CANCEL }] },
      });
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('resolves the caller on the DC return menu, without a device', async () => {
      await service.cancel(cancelDto);

      expect(salesContext.resolve).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        SALES_MENU_ID.DC_RETURN,
        prisma,
      );
    });

    it('stops at a year it may not write before reversing anything', async () => {
      jest
        .mocked(guards.assertAccYearWritable)
        .mockRejectedValue(new HttpException({ errors: [{ code: 'ACC_YEAR_CLOSED' }] }, 400));

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal.status).toBe(400);
      expect(guards.assertAccYearWritable).toHaveBeenCalledWith(
        prisma,
        COMPANY_ID,
        ACC_YEAR,
        'sdrAccYear',
      );
      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(stock.cancel).not.toHaveBeenCalled();
    });

    it('asks after declared locks with no register row, and touches no e-way bill', async () => {
      await service.cancel(cancelDto);

      expect(guards.loadDeclaredLocks).toHaveBeenCalledWith(prisma, null);
      expect(blocks.gstRows).not.toHaveBeenCalled();
      expect(gst.cancelEwb).not.toHaveBeenCalled();
    });

    it('answers no reversal number when the reversal wrote no voucher', async () => {
      legs.reverseLegs.mockResolvedValue(null);

      const result = await service.cancel(cancelDto);

      expect(result.reversalVoucherRefno).toBeNull();
      expect(
        prisma.$queryRaw.mock.calls.some(([strings]) =>
          (strings as TemplateStringsArray).join('?').includes('avh_voucher_refno'),
        ),
      ).toBe(false);
    });

    it('refuses when the books for the return date are closed', async () => {
      jest.mocked(guards.loadDayClosed).mockResolvedValue(true);

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdrReturnDate', code: SALES_ERROR_CODES.DAY_CLOSED }] },
      });
      expect(legs.reverseLegs).not.toHaveBeenCalled();
    });

    it('refuses once a live e-way bill is past its cancellation window', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(guards.loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: true });
      statutory.withinCancelWindow.mockResolvedValue({ within: false });

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'posting.ewb', code: SALES_ERROR_CODES.EWB_WINDOW_PASSED }] },
      });
      expect(statutory.withinCancelWindow).toHaveBeenCalledWith(
        COMPANY_ID,
        'EWAYBILL',
        new Date('2026-10-10T07:00:00Z'),
        '2026-10-10',
        expect.any(Date),
        prisma,
      );
      expect(gst.cancelEwb).not.toHaveBeenCalled();
      expect(legs.reverseLegs).not.toHaveBeenCalled();
    });

    it('refuses a live e-way bill with no generated-on date', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(guards.loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: true });
      blocks.gstRows.mockResolvedValue({ ewbGeneratedOn: null });

      const refusal = await refusalOf(service.cancel(cancelDto));

      expect(refusal.status).toBe(409);
      expect(statutory.withinCancelWindow).not.toHaveBeenCalled();
    });

    it('cancels a live e-way bill inside its window before reversing', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);
      jest.mocked(guards.loadDeclaredLocks).mockResolvedValue({ irnLive: false, ewbLive: true });

      await service.cancel(cancelDto);

      expect(gst.cancelEwb).toHaveBeenCalledWith({
        gdrId: GDR_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        reason: 'Entered against the wrong challan',
      });
    });

    it('reverses the voucher, the stock and the register, then answers with the reversal number', async () => {
      register.registerIdOf.mockResolvedValue(GDR_ID);

      const result = await service.cancel(cancelDto);

      expect(legs.reverseLegs).toHaveBeenCalledWith(
        prisma,
        VOUCHER_ID,
        ACC_YEAR,
        'Entered against the wrong challan',
        USER_ID,
      );
      expect(stock.cancel).toHaveBeenCalledWith(
        prisma,
        {
          docType: 'DC_RETURN',
          docId: SDR_ID,
          accYear: ACC_YEAR,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          direction: 'IN',
          txnType: 'DC_RETURN',
        },
        USER_ID,
        'Entered against the wrong challan',
        expect.any(Date),
      );
      expect(register.cancel).toHaveBeenCalledWith(
        prisma,
        GDR_ID,
        ACC_YEAR,
        'Entered against the wrong challan',
        USER_ID,
      );
      expect(store.setStatus).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        'CANCELLED',
        {},
        USER_ID,
        expect.any(Date),
      );
      expect(fulfilment.recompute).toHaveBeenCalledWith(
        prisma,
        [{ dcId: DC_ID, accYear: ACC_YEAR }],
        USER_ID,
        expect.any(Date),
      );
      expect(store.trail).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        TxnStatusEvent.CANCELLED,
        'POSTED',
        'CANCELLED',
        USER_ID,
        expect.any(Date),
        'Entered against the wrong challan',
      );
      expect(store.auditChange).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        'cancel',
        { sdrStatus: 'POSTED' },
        { sdrStatus: 'CANCELLED' },
        USER_ID,
        'DC return cancelled: Entered against the wrong challan',
      );
      expect(result).toMatchObject({
        sdrId: SDR_ID,
        challan: { sdcId: DC_ID, openBefore: '10.000', openAfter: '6.000' },
        reversalVoucherRefno: 'DCR/00012/R',
        cancelledOn: expect.any(String),
      });
    });

    it('skips the voucher and register steps a PERIODIC, party-less return never had', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'POSTED', sdrPostedVoucherId: null }));

      const result = await service.cancel(cancelDto);

      expect(legs.reverseLegs).not.toHaveBeenCalled();
      expect(register.cancel).not.toHaveBeenCalled();
      expect(stock.cancel).toHaveBeenCalled();
      expect(result.reversalVoucherRefno).toBeNull();
    });
  });

  describe('transport', () => {
    const band = { vehicleNo: 'TN01AB1234' };
    // A client that sends OUTWARD still gets an inward band: goods are coming back.
    const transportDto = { ...KEYS, transport: { ...band, direction: 'OUTWARD' } } as never;

    it('refuses a CANCELLED return', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'CANCELLED' }));

      const refusal = await refusalOf(service.transport(transportDto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DOC_CANCELLED }] },
      });
      expect(transportBand.write).not.toHaveBeenCalled();
    });

    it('edits the band of a DRAFT too, trailing it as DRAFT to DRAFT', async () => {
      await service.transport(transportDto);

      expect(lastCallArg(transportBand.write, 4)).toEqual({ gdrId: null, now: expect.any(Date) });
      expect(store.trail).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        'TRANSPORT_EDITED',
        'DRAFT',
        'DRAFT',
        USER_ID,
        expect.any(Date),
        null,
      );
    });

    it('writes the band inward against the register row and trails the edit', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'POSTED' }));
      register.registerIdOf.mockResolvedValue(GDR_ID);

      await expect(service.transport(transportDto)).resolves.toMatchObject({ sdrId: SDR_ID, charges: [] });
      void band;

      expect(transportBand.write).toHaveBeenCalledWith(
        prisma,
        {
          docType: 'DC_RETURN',
          docId: SDR_ID,
          accYear: ACC_YEAR,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          tenantId: null,
          docRefno: 'DCR/00012',
        },
        { vehicleNo: 'TN01AB1234', direction: 'INWARD' },
        USER_ID,
        { gdrId: GDR_ID, now: expect.any(Date) },
      );
      expect(store.trail).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ sdrId: SDR_ID }),
        'TRANSPORT_EDITED',
        'POSTED',
        'POSTED',
        USER_ID,
        expect.any(Date),
        null,
      );
    });
  });

  // §8.3 /dc-returns/validate (G3): the post's guards on the body as it would be
  // stored; nothing written.
  describe('validate', () => {
    const body = (items: Record<string, unknown>[], over: Record<string, unknown> = {}) =>
      ({
        ...KEYS,
        sdrId: undefined,
        sdrDcId: DC_ID,
        sdrDcAccYear: ACC_YEAR,
        sdrDeviceType: 'DESKTOP',
        sdrDeviceId: DEVICE_ID,
        sdrUserId: USER_ID,
        sdrReturnDate: '2026-10-10',
        sdrReasonId: REASON_ID,
        items,
        ...over,
      }) as unknown as SaveDcReturnDto;

    it('answers ok with an INFO for goods back DAMAGED, the rights and the totals; writes nothing', async () => {
      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '4', sdriCondition: 'DAMAGED' }]),
      );

      expect(result).toMatchObject({
        ok: true,
        refusals: [],
        warnings: [
          expect.objectContaining({
            code: SALES_ERROR_CODES.DCR_DAMAGED_BUCKET,
            level: 'INFO',
            params: { qty: '4', unit: '', condition: 'DAMAGED' },
          }),
        ],
        rights: ctx.rights,
        // costBack = 4 × the challan line's cost 30, whatever the body says.
        totals: { lines: 1, qty: '4.000', weightKg: '0.000', costBack: '120.00' },
      });
      expect(store.saveDraft).not.toHaveBeenCalled();
      expect(stock.post).not.toHaveBeenCalled();
    });

    it('copies the challan line\'s UNIT cost: 4 back of a 6-pc line at 50.1259 a piece cost 200.50', async () => {
      challanLines = [challanLine({ sdiDcQty: dec('6'), sdiCostPrice: dec('50.1259') })];

      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '4', sdriCostPrice: 300.76 }]),
      );

      expect(result.totals).toMatchObject({ qty: '4.000', costBack: '200.50' });
    });

    it('lists a line of another challan once (LINE_NOT_ON_DC, not NO_LINES as well)', async () => {
      challanLines = [challanLine({ sdiDcId: '019c6f6c-be87-7a11-8905-36092c46b0cc' })];

      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]),
      );

      expect(result.ok).toBe(false);
      expect((result.refusals as { code: string }[]).map((r) => r.code)).toEqual([
        SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC,
      ]);
    });

    it('lists over-open, no reason and a charge row together', async () => {
      sql.dcLines = [
        {
          sdi_id: DC_ITEM_ID,
          sdi_dc_id: DC_ID,
          sdi_acc_year: ACC_YEAR,
          sdi_line_no: 1,
          sdi_open_qty: dec('3'),
          sdi_to_base_factor: dec('1'),
        },
      ];

      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '4' }], {
          sdrReasonId: null,
          charges: [{ cdChgName: 'freight', cdAmount: 10 }],
        }),
      );

      expect((result.refusals as { code: string }[]).map((r) => r.code).sort()).toEqual(
        [
          SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED,
          SALES_ERROR_CODES.DCR_OVER_OPEN,
          SALES_ERROR_CODES.DCR_REASON_REQUIRED,
        ].sort(),
      );
    });

    it("lists another branch's challan as not found (P6 S4)", async () => {
      challan = challanRow({ sdcBranchId: '019c6f6c-be87-7a11-8905-36092c46b0fe' });

      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]),
      );

      expect(result.ok).toBe(false);
      expect(result.refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.NOT_FOUND, field: 'sdrDcId' }),
      ]);
    });

    // P6 N5 (user 11-17): WARN warns, as the challan's; REFUSE refuses; ALLOW is quiet.
    it('warns on a backdated return under sales.backdate_mode WARN (it posted silently)', async () => {
      ctx.settings.backdateMode = 'WARN';

      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]),
      );

      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, level: 'WARN', field: 'sdrReturnDate' }),
      ]);
    });

    it('refuses a backdated return under REFUSE', async () => {
      ctx.settings.backdateMode = 'REFUSE';

      const result = await service.validate(
        body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]),
      );

      expect(result.refusals).toEqual([
        expect.objectContaining({ code: SALES_ERROR_CODES.BACKDATE, field: 'sdrReturnDate' }),
      ]);
    });

    // P6 S2: the challan's halves are shared pro rata, part by part, and the
    // line's tax is the sum of the shared parts, so they add up to the paisa.
    it.each([
      ['the bill split 7.88 + 7.87 = 15.75', '7.88', '7.87', '2.63', '2.62', '5.25', '110.25'],
      ['the old split 7.88 + 7.88 = 15.76', '7.88', '7.88', '2.63', '2.63', '5.26', '110.26'],
    ])('1 back of 3 under %s: parts sum exactly to the line tax, net = taxable + tax', async (_n, cg, sg, rc, rs, rt, rn) => {
      challanLines = [
        challanLine({
          sdiDcQty: dec('3'),
          sdiRate: dec('105'),
          sdiGrossAmt: dec('315'),
          sdiTaxableAmt: dec('315'),
          sdiCgstAmt: dec(cg),
          sdiSgstAmt: dec(sg),
        }),
      ];
      await service.save({
        ...body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]),
      } as unknown as SaveDcReturnDto);

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, string>[] }];
      const line = saved.items[0];
      expect(line).toMatchObject({
        sdriTaxableAmt: '105.00',
        sdriCgstAmt: rc,
        sdriSgstAmt: rs,
        sdriTaxAmt: rt,
        sdriNetAmt: rn,
      });
      expect(dec(line.sdriCgstAmt).plus(dec(line.sdriSgstAmt)).equals(dec(line.sdriTaxAmt))).toBe(true);
      expect(dec(line.sdriTaxableAmt).plus(dec(line.sdriTaxAmt)).equals(dec(line.sdriNetAmt))).toBe(true);
    });

    // P6 R4 (re-review 11-17): 3 × 1 of a line of 3 drifted (taxable 100.00 → 99.99,
    // CGST 7.88 → 7.89); the return bringing the LAST quantity back takes the rest.
    it('the return that brings the last 1 of 3 back takes the rest: the three add up to the challan', async () => {
      challanLines = [
        challanLine({
          sdiDcQty: dec('3'),
          sdiGrossAmt: dec('100.00'),
          sdiTaxableAmt: dec('100.00'),
          sdiCgstAmt: dec('7.88'),
          sdiSgstAmt: dec('7.87'),
        }),
      ];
      // two returns of 1 already POSTED at their share: 33.33 / 2.63 / 2.62 each
      sql.postedSums = [
        { dc_item_id: DC_ITEM_ID, qty: dec('2'), gross: dec('66.66'), item_disc: dec(0), sch_disc: dec(0),
          taxable: dec('66.66'), cgst: dec('5.26'), sgst: dec('5.24'), igst: dec(0), cess: dec(0), weight: null },
      ];
      await service.save(body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]));

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, string>[] } & Record<string, string>];
      expect(saved.items[0]).toMatchObject({
        sdriTaxableAmt: '33.34', sdriCgstAmt: '2.62', sdriSgstAmt: '2.63', sdriTaxAmt: '5.25', sdriNetAmt: '38.59', sdriGrossAmt: '33.34',
      });
      expect(saved).toMatchObject({ sdrTaxableAmt: '33.34', sdrTaxAmt: '5.25', sdrReturnAmt: '38.59' });
    });

    it('keeps the share while the line is not fully back (a return of 1 of 3, or a line partly billed)', async () => {
      challanLines = [challanLine({ sdiDcQty: dec('3'), sdiGrossAmt: dec('100'), sdiTaxableAmt: dec('100'), sdiCgstAmt: dec('7.88'), sdiSgstAmt: dec('7.87') })];
      sql.postedSums = [{ dc_item_id: DC_ITEM_ID, qty: dec('1'), taxable: dec('33.33'), cgst: dec('2.63'), sgst: dec('2.62') }];

      await service.save(body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }]));

      const [, saved] = store.saveDraft.mock.calls[0] as [unknown, { items: Record<string, string>[] }];
      expect(saved.items[0]).toMatchObject({ sdriTaxableAmt: '33.33', sdriCgstAmt: '2.63', sdriSgstAmt: '2.62' });
    });

    it('needs CREATE on 251 for a new return (403 SALES_RIGHT_CREATE)', async () => {
      ctx.rights = { ...ctx.rights, create: false };

      const refusal = await refusalOf(
        service.validate(body([{ sdriLineNo: 1, sdriDcItemId: DC_ITEM_ID, sdriReturnQty: '1' }])),
      );

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: SALES_ERROR_CODES.RIGHT_CREATE }] },
      });
      expect(salesContext.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_ID, branchId: BRANCH_ID }),
        SALES_MENU_ID.DC_RETURN,
      );
    });
  });
});

// P6 R4 — settleLastReturn, the pure half: the last return takes the rest.
describe('settleLastReturn (P6 R4)', () => {
  const D = (v: string | number) => new Prisma.Decimal(v);
  const DCL = '019c6f6c-be87-7a11-8905-36092c46b0d1';
  const dcl = { sdiId: DCL, sdiDcQty: D(3), sdiGrossAmt: D('100.00'), sdiItemDiscAmt: D(0), sdiSchDiscAmt: D(0), sdiTaxableAmt: D('100.00'),
    sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.87'), sdiIgstAmt: D(0), sdiCessAmt: D(0), sdiWeightQty: D('0.900') };
  const share = (qty: number, over: Record<string, unknown> = {}) => ({
    sdriDcItemId: DCL, sdriReturnQty: D(qty), sdriGrossAmt: D('33.33'), sdriItemDiscAmt: D(0), sdriSchDiscAmt: D(0), sdriTaxableAmt: D('33.33'),
    sdriCgstAmt: D('2.63'), sdriSgstAmt: D('2.62'), sdriIgstAmt: D(0), sdriCessAmt: D(0), sdriWeightQty: D('0.300'),
    sdriTaxAmt: D('5.25'), sdriNetAmt: D('38.58'), ...over,
  });
  const posted = (rows: Record<string, unknown>[]) => {
    const sum = (k: string) => rows.reduce<Prisma.Decimal>((a, r) => a.plus((r[k] as Prisma.Decimal) ?? 0), D(0));
    return new Map([[DCL, { qty: sum('sdriReturnQty'), sdriGrossAmt: sum('sdriGrossAmt'), sdriItemDiscAmt: D(0), sdriSchDiscAmt: D(0),
      sdriTaxableAmt: sum('sdriTaxableAmt'), sdriCgstAmt: sum('sdriCgstAmt'), sdriSgstAmt: sum('sdriSgstAmt'), sdriIgstAmt: D(0),
      sdriCessAmt: D(0), sdriWeightQty: sum('sdriWeightQty') }]]);
  };
  const lines = new Map([[DCL, dcl as Record<string, unknown>]]);
  const total = (rows: Record<string, unknown>[], k: string) => rows.reduce<Prisma.Decimal>((a, r) => a.plus(D(r[k] as string)), D(0)).toFixed(2);

  it('3 × 1: the third takes 33.34 / 2.62 / 2.63, and the three make 100.00 / 7.88 / 7.87', () => {
    const r1 = share(1); const r2 = share(1); const r3 = share(1);
    expect(settleLastReturn([r3], lines, posted([r1, r2]))).toEqual([0]);
    expect(r3).toMatchObject({ sdriTaxableAmt: '33.34', sdriCgstAmt: '2.62', sdriSgstAmt: '2.63', sdriTaxAmt: '5.25', sdriNetAmt: '38.59', sdriWeightQty: '0.300' });
    const all = [r1, r2, r3];
    expect([total(all, 'sdriTaxableAmt'), total(all, 'sdriCgstAmt'), total(all, 'sdriSgstAmt'), total(all, 'sdriNetAmt')]).toEqual(['100.00', '7.88', '7.87', '115.75']);
  });

  it('cancel the 2nd and return 1 again: still exact (the posted are R1 at its share and R3 at the rest)', () => {
    const r1 = share(1);
    const r3 = share(1, { sdriTaxableAmt: D('33.34'), sdriGrossAmt: D('33.34'), sdriCgstAmt: D('2.62'), sdriSgstAmt: D('2.63') });
    const again = share(1);
    // the rest is its share here (100 − 66.67 = 33.33, 7.88 − 5.25 = 2.63, 7.87 − 5.25 = 2.62): nothing to change
    expect(settleLastReturn([again], lines, posted([r1, r3]))).toEqual([]);
    const all = [r1, r3, again];
    expect([total(all, 'sdriTaxableAmt'), total(all, 'sdriCgstAmt'), total(all, 'sdriSgstAmt')]).toEqual(['100.00', '7.88', '7.87']);
  });

  it('two lines of one return on the same challan line: the last of them takes the rest less the other', () => {
    // 1 already back; this return takes 1 RESTOCK + 1 DAMAGED of the same line
    const a = share(1);
    const b = share(1, { sdriCondition: 'DAMAGED' });
    expect(settleLastReturn([a, b], lines, posted([share(1)]))).toEqual([1]);
    expect(b).toMatchObject({ sdriTaxableAmt: '33.34', sdriCgstAmt: '2.62', sdriSgstAmt: '2.63' });
    expect(a.sdriTaxableAmt).toEqual(D('33.33'));
  });

  it('leaves a line that is not all back (partly billed, or more still out), and a rest that would go below 0', () => {
    const r = share(1);
    expect(settleLastReturn([r], lines, posted([share(1)]))).toEqual([]);
    expect(r.sdriTaxableAmt).toEqual(D('33.33'));
    const over = share(1);
    expect(settleLastReturn([over], lines, posted([share(2, { sdriTaxableAmt: D('100.01') })]))).toEqual([]);
  });
});
