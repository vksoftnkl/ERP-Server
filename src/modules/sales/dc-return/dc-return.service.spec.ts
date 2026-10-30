import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TxnStatusEvent } from '../../../common/txn-status-log/txn-status-log.helper';
import * as guards from '../posting/sales.guards';
import { SALES_MENU_ID, SALES_VOUCHER_TYPE } from '../posting/sales-doc.utils';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { DCR_SPEC, DcReturnService } from './dc-return.service';
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

/** Raw-query answers, picked by a marker in the SQL text. Order matters: first match wins. */
type SqlAnswers = {
  dcHeader: unknown[];
  dcStatus: unknown[];
  dcLines: unknown[];
  company: unknown[];
  voucherRefno: unknown[];
  openLines: unknown[];
};
const SQL_MARKERS: Array<[string, keyof SqlAnswers]> = [
  ['SELECT sdc_dc_refno', 'dcHeader'],
  ['SELECT sdc_status FROM', 'dcStatus'],
  ['SELECT sdi_id, sdi_open_qty', 'dcLines'],
  ['SELECT comp_state_code', 'company'],
  ['SELECT avh_voucher_refno', 'voucherRefno'],
  ['AS "dcItemId"', 'openLines'],
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
    rights: { post: boolean; cancel: boolean; override: boolean };
  };
  let salesContext: { actor: jest.Mock; rights: jest.Mock; resolve: jest.Mock };
  let statutory: { withinCancelWindow: jest.Mock };
  let legs: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let register: { registerIdOf: jest.Mock; write: jest.Mock; cancel: jest.Mock };
  let stock: { post: jest.Mock; cancel: jest.Mock };
  let blocks: { build: jest.Mock; gstRows: jest.Mock };
  let transportBand: { write: jest.Mock };
  let fulfilment: { recompute: jest.Mock };
  let gst: { enqueueAfterPost: jest.Mock; cancelEwb: jest.Mock };
  let service: DcReturnService;

  beforeEach(() => {
    sql = {
      dcHeader: [
        {
          sdc_dc_refno: 'DC/00007',
          sdc_dc_date: new Date('2026-10-05T00:00:00.000Z'),
          sdc_cust_id: CUST_ID,
          sdc_cust_name: 'Acme Stores',
          sdc_cust_gstin: '33ABCDE1234F1Z5',
          sdc_cust_stcd: '33',
          sdc_pos_stcd: '33',
          sdc_status: 'POSTED',
        },
      ],
      dcStatus: [{ sdc_status: 'POSTED' }],
      dcLines: [{ sdi_id: DC_ITEM_ID, sdi_open_qty: dec('10') }],
      company: [{ comp_state_code: '33' }],
      voucherRefno: [{ avh_voucher_refno: 'DCR/00012/R' }],
      openLines: [],
    };
    prisma = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const text = strings.join('?');
        const hit = SQL_MARKERS.find(([marker]) => text.includes(marker));
        return Promise.resolve(hit ? sql[hit[1]] : []);
      }),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
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
      rights: { post: true, cancel: true, override: false },
    };
    salesContext = {
      actor: jest.fn().mockReturnValue(USER_ID),
      rights: jest.fn().mockResolvedValue({ view: true, post: true, amend: true }),
      resolve: jest.fn(async () => ctx),
    };
    statutory = { withinCancelWindow: jest.fn().mockResolvedValue({ within: true }) };
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
      {} as never,
      {} as never,
      {} as never,
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

    it('refuses a return against a challan that does not exist', async () => {
      sql.dcHeader = [];

      const refusal = await refusalOf(service.save(dto));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdrDcId', code: SALES_ERROR_CODES.DCR_DC_NOT_POSTED }] },
      });
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

      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([DC_ID, ACC_YEAR]);
    });

    it("lets the challan's own refno and date win over what the body sends", async () => {
      await service.save({ ...dto, sdrDcRefno: 'DC/99999', sdrDcDate: '2026-01-01' });

      expect(lastCallArg(store.saveDraft, 1)).toMatchObject({
        sdrDcRefno: 'DC/00007',
        sdrDcDate: '2026-10-05',
      });
    });

    it('keeps the party fields the body does send', async () => {
      await service.save({ ...dto, sdrCustName: 'Acme (walk-in)', sdrPosStcd: '29' });

      expect(lastCallArg(store.saveDraft, 1)).toMatchObject({
        sdrCustName: 'Acme (walk-in)',
        sdrPosStcd: '29',
        sdrCustStcd: '33',
      });
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

      expect(result.rights).toEqual({ view: true, post: true, amend: false });
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
    it('turns decimals into numbers and leaves everything else alone', async () => {
      sql.openLines = [
        {
          dcItemId: DC_ITEM_ID,
          lineNo: 1,
          itemName: 'Paracetamol',
          dcQty: dec('10'),
          openQty: dec('6.5'),
          rate: dec('12.25'),
          batchNo: null,
        },
      ];

      await expect(service.openLines(DC_ID, ACC_YEAR)).resolves.toEqual([
        {
          dcItemId: DC_ITEM_ID,
          lineNo: 1,
          itemName: 'Paracetamol',
          dcQty: 10,
          openQty: 6.5,
          rate: 12.25,
          batchNo: null,
        },
      ]);
      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([DC_ID, ACC_YEAR]);
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

    it('collects every refusal into one 422 instead of stopping at the first', async () => {
      jest.mocked(guards.loadDayClosed).mockResolvedValue(true);
      sql.dcStatus = [{ sdc_status: 'DRAFT' }];

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

    it('refuses a challan that is missing or deleted', async () => {
      sql.dcStatus = [];

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: SALES_ERROR_CODES.DCR_DC_NOT_POSTED }] },
      });
    });

    it('refuses a return with no lines', async () => {
      store.loadItems.mockResolvedValue([]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'items', code: SALES_ERROR_CODES.STOCK_QTY_MISMATCH }] },
      });
    });

    it('refuses a line naming a challan line that does not exist', async () => {
      sql.dcLines = [];

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'items',
              code: SALES_ERROR_CODES.DCR_OVER_OPEN,
              message: `Challan line ${DC_ITEM_ID} does not exist`,
            },
          ],
        },
      });
    });

    it('refuses a line taking more than is still open on its challan line', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_open_qty: dec('4') }];
      store.loadItems.mockResolvedValue([itemRow({ sdriReturnQty: dec('5') })]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'items',
              code: SALES_ERROR_CODES.DCR_OVER_OPEN,
              message: 'Challan line has 4 open; this return takes 5',
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
      expect(argsOf('SELECT sdc_status FROM')).toEqual([DC_ID, ACC_YEAR]);
      expect(argsOf('SELECT sdi_id, sdi_open_qty')).toEqual([[DC_ITEM_ID]]);
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
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_open_qty: dec('6') }];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriReturnQty: dec('4') }),
        itemRow({ sdriId: SDRI_ID_2, sdriLineNo: 2, sdriReturnQty: dec('3') }),
      ]);

      const refusal = await refusalOf(service.post(KEYS));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ message: 'Challan line has 6 open; this return takes 7' }] },
      });
    });

    it('lets a return take exactly what is open', async () => {
      sql.dcLines = [{ sdi_id: DC_ITEM_ID, sdi_open_qty: dec('4') }];

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

    it.each([
      ['RESTOCK', null, 'SALEABLE'],
      ['DAMAGED', null, 'DAMAGED'],
      ['EXPIRED', null, 'EXPIRED'],
      ['SCRAP', null, 'QUARANTINE'],
      [null, null, 'SALEABLE'],
      ['SOMETHING_ELSE', null, 'SALEABLE'],
      ['RESTOCK', 'DAMAGED', 'DAMAGED'],
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
        { sdi_id: DC_ITEM_ID, sdi_open_qty: dec('10') },
        { sdi_id: DC_ITEM_ID_2, sdi_open_qty: dec('10') },
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
        presetNo: 12n,
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
      expect(opts).toEqual({ interState: false });
      expect(doc).toMatchObject({
        voucherId: VOUCHER_ID,
        voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
        voucherNo: 12n,
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

    it('marks the register row inter-state when the place of supply is another state', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrPosStcd: '29' }));

      await service.post(KEYS);

      const [, doc, opts] = register.write.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
        unknown,
      ];
      expect(opts).toEqual({ interState: true });
      expect(doc.supplyNature).toBe('INTER_STATE');
    });

    it('files the register row against the return itself when no voucher was written', async () => {
      ctx.cogsMode = 'PERIODIC';
      store.lock.mockResolvedValue(returnRow({ sdrReturnSlno: null, sdrTaxAmt: dec('0') }));

      await service.post(KEYS);

      expect(lastCallArg(register.write, 1)).toMatchObject({
        voucherId: SDR_ID,
        voucherNo: 12n,
        taxability: 'EXEMPT',
        partyGstin: '33ABCDE1234F1Z5',
      });
    });

    it('numbers the register row from the voucher when the return has no serial number', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrReturnSlno: null }));
      legs.postLegs.mockResolvedValue({ voucherId: VOUCHER_ID, voucherLastNo: 99n });

      await service.post(KEYS);

      expect(lastCallArg(register.write, 1)).toMatchObject({
        voucherId: VOUCHER_ID,
        voucherNo: 99n,
      });
    });

    it('values a register line at taxable plus tax when it has no net amount, EXEMPT when untaxed', async () => {
      sql.dcLines = [
        { sdi_id: DC_ITEM_ID, sdi_open_qty: dec('10') },
        { sdi_id: DC_ITEM_ID_2, sdi_open_qty: dec('10') },
      ];
      store.loadItems.mockResolvedValue([
        itemRow({ sdriNetAmt: dec('0') }),
        itemRow({
          sdriId: SDRI_ID_2,
          sdriLineNo: 2,
          sdriDcItemId: DC_ITEM_ID_2,
          sdriTaxableAmt: dec('80'),
          sdriNetAmt: dec('80'),
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

  describe('cancel', () => {
    const cancelDto = { ...KEYS, reason: 'Entered against the wrong challan' };

    beforeEach(() => {
      store.lock.mockResolvedValue(
        returnRow({ sdrStatus: 'POSTED', sdrPostedVoucherId: VOUCHER_ID }),
      );
    });

    it('answers a return that is already CANCELLED without touching it', async () => {
      store.lock.mockResolvedValue(returnRow({ sdrStatus: 'CANCELLED' }));

      await expect(service.cancel(cancelDto)).resolves.toEqual({
        id: SDR_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
        sdrStatus: 'CANCELLED',
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
        id: SDR_ID,
        sdrStatus: 'CANCELLED',
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

      await expect(service.transport(transportDto)).resolves.toEqual(band);

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
});
