import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import { StockErrorCode } from '../types/stock-error-codes';
import { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';
import { StockAdjustmentService } from './stock-adjustment.service';
import {
  EXPIRY_GRACE_SETTING_KEY,
  RELOT_IN_CODE,
  RELOT_OUT_CODE,
  STOCK_ADJUSTMENT_RULES,
} from './stock-adjustment.rules';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const OTHER_GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b005';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b006';
const OTHER_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b007';
const UOM_ID = '019c6f6c-be87-7a11-8905-36092c46b008';
const OTHER_UOM_ID = '019c6f6c-be87-7a11-8905-36092c46b009';
const LOT_A = '019c6f6c-be87-7a11-8905-36092c46b00a';
const LOT_B = '019c6f6c-be87-7a11-8905-36092c46b00b';
const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46b00c';
const SVI_ID = '019c6f6c-be87-7a11-8905-36092c46b00d';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b00e';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-10-01';

const R_IN = '019c6f6c-be87-7a11-8905-36092c46b101';
const R_OUT = '019c6f6c-be87-7a11-8905-36092c46b102';
const R_BOTH = '019c6f6c-be87-7a11-8905-36092c46b103';
const R_INACTIVE = '019c6f6c-be87-7a11-8905-36092c46b104';
const R_REMARK = '019c6f6c-be87-7a11-8905-36092c46b105';
const R_MOVE = '019c6f6c-be87-7a11-8905-36092c46b106';
const R_MOVE_REMARK = '019c6f6c-be87-7a11-8905-36092c46b107';
const R_RELOT_OUT = '019c6f6c-be87-7a11-8905-36092c46b108';
const R_RELOT_IN = '019c6f6c-be87-7a11-8905-36092c46b109';
const R_UNKNOWN = '019c6f6c-be87-7a11-8905-36092c46b10a';

interface ReasonRow {
  srm_id: string;
  srm_code: string;
  srm_name: string;
  srm_direction: string;
  srm_allowed_txn_types: string[] | null;
  srm_is_active: boolean;
  srm_require_remarks: boolean;
}

const reasonRow = (
  id: string,
  code: string,
  direction: string,
  extra: Partial<ReasonRow> = {},
): ReasonRow => ({
  srm_id: id,
  srm_code: code,
  srm_name: code.toLowerCase(),
  srm_direction: direction,
  srm_allowed_txn_types: [],
  srm_is_active: true,
  srm_require_remarks: false,
  ...extra,
});

const REASONS: ReasonRow[] = [
  reasonRow(R_IN, 'FOUND', 'IN'),
  reasonRow(R_OUT, 'PILFERAGE', 'OUT'),
  reasonRow(R_BOTH, 'RECOUNT', 'BOTH'),
  reasonRow(R_INACTIVE, 'OLD', 'OUT', { srm_is_active: false }),
  reasonRow(R_REMARK, 'THEFT', 'OUT', { srm_require_remarks: true }),
  reasonRow(R_MOVE, 'MOVE_DAMAGED', 'BOTH', { srm_allowed_txn_types: ['BUCKET_OUT', 'BUCKET_IN'] }),
  reasonRow(R_MOVE_REMARK, 'MOVE_RETURN', 'BOTH', {
    srm_allowed_txn_types: ['BUCKET_OUT', 'BUCKET_IN'],
    srm_require_remarks: true,
  }),
  reasonRow(R_RELOT_OUT, RELOT_OUT_CODE, 'OUT'),
  reasonRow(R_RELOT_IN, RELOT_IN_CODE, 'IN'),
];

interface LotRow {
  slt_id: string;
  slt_company_id: string;
  slt_item_id: string;
  slt_expiry_date: Date | null;
  slt_base_uom_id: string;
  slt_batch_no: string | null;
}

const lotRow = (overrides: Partial<LotRow> = {}): LotRow => ({
  slt_id: LOT_A,
  slt_company_id: COMPANY_ID,
  slt_item_id: ITEM_ID,
  slt_expiry_date: null,
  slt_base_uom_id: UOM_ID,
  slt_batch_no: 'B-OLD',
  ...overrides,
});

const balanceRow = (available: number, lotId = LOT_A, bucket = 'SALEABLE') => ({
  sbl_lot_id: lotId,
  sbl_godown_id: GODOWN_ID,
  sbl_bucket: bucket,
  sbl_available_qty: new Prisma.Decimal(available),
});

interface InwardRow {
  idx: number;
  lot_id: string | null;
  track_batch: boolean;
  track_mrp: boolean;
  track_sale_price: boolean;
  track_expiry: boolean;
  track_serial: boolean;
  track_supplier: boolean;
}

const inwardRow = (
  idx: number,
  lotId: string | null,
  tracked: Partial<InwardRow> = {},
): InwardRow => ({
  idx,
  lot_id: lotId,
  track_batch: false,
  track_mrp: false,
  track_sale_price: false,
  track_expiry: false,
  track_serial: false,
  track_supplier: false,
  ...tracked,
});

const headerRow = (overrides: Record<string, unknown> = {}) => ({
  svh_voucher_type: 'ADJUSTMENT',
  svh_doc_date: new Date(`${DOC_DATE}T00:00:00.000Z`),
  svh_from_godown_id: GODOWN_ID,
  svh_to_godown_id: null,
  svh_reason_id: null,
  svh_remarks: null,
  svh_refno: 'ADJ0001',
  svh_link_src_module: null,
  svh_link_src_doc_type: null,
  is_move: false,
  is_relot: false,
  ...overrides,
});

/** A stored line as loadLines reads it. */
const storedLine = (overrides: Record<string, unknown> = {}) => ({
  svi_id: SVI_ID,
  svi_line_no: 1,
  svi_item_id: ITEM_ID,
  item_name: 'Soap 100g',
  svi_godown_id: GODOWN_ID,
  svi_lot_id: null,
  svi_bucket: 'SALEABLE',
  svi_to_bucket: null,
  svi_base_qty: new Prisma.Decimal(2),
  svi_free_base_qty: new Prisma.Decimal(0),
  svi_direction: 1,
  svi_reason_id: R_IN,
  svi_remarks: null,
  svi_base_uom_id: UOM_ID,
  svi_batch_no: null,
  svi_mrp: null,
  svi_sale_price: null,
  svi_expiry_date: null,
  svi_serial_no: null,
  svi_supplier_id: null,
  ...overrides,
});

interface FakeDb {
  reasons: ReasonRow[];
  lots: LotRow[];
  balances: ReturnType<typeof balanceRow>[];
  inward: InwardRow[];
  header: ReturnType<typeof headerRow> | null;
  lines: ReturnType<typeof storedLine>[];
  pick: Record<string, unknown>[];
}

/** $queryRaw over a fake database, each query told apart by its SQL text. */
const queryRawOver = (db: FakeDb) =>
  jest.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.includes('AS is_move')) return db.header ? [db.header] : [];
    if (sql.includes('svi.svi_line_no, svi.svi_item_id')) return db.lines;
    if (sql.includes('FROM stock.stock_reason_master') && sql.includes('srm_id = ANY')) {
      return db.reasons;
    }
    if (sql.includes('FROM stock.stock_lot WHERE slt_id = ANY')) return db.lots;
    if (sql.includes('jsonb_to_recordset')) return db.inward;
    if (sql.includes('sbl_first_in_date')) return db.pick;
    if (sql.includes('FROM stock.stock_balance')) return db.balances;
    throw new Error(`unrouted query: ${sql.slice(0, 80)}`);
  });

const line = (overrides: Record<string, unknown> = {}) => ({
  lineNo: 1,
  itemId: ITEM_ID,
  uomId: UOM_ID,
  baseUomId: UOM_ID,
  toBaseFactor: 1,
  qty: 2,
  baseQty: 2,
  godownId: GODOWN_ID,
  reasonId: R_IN,
  ...overrides,
});

/** The body as the ValidationPipe hands it over: DTO instances all the way down. */
const dtoOf = (header: Record<string, unknown> = {}, lines = [line()]) =>
  plainToInstance(SaveStockAdjustmentDto, {
    header: {
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      deviceId: DEVICE_ID,
      docDate: DOC_DATE,
      voucherType: 'ADJUSTMENT',
      fromGodownId: GODOWN_ID,
      ...header,
    },
    lines,
  });

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: any }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const codesOf = (refusal: { body: any }) =>
  (refusal.body.errors as Array<{ field: string; code: string }>).map(
    (e) => `${e.field}:${e.code}`,
  );

describe('StockAdjustmentService', () => {
  let db: FakeDb;
  let prisma: { $queryRaw: jest.Mock };
  let vouchers: {
    save: jest.Mock;
    getById: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    softDelete: jest.Mock;
  };
  let appSettings: { resolveEffective: jest.Mock };
  let service: StockAdjustmentService;

  beforeEach(() => {
    db = {
      reasons: REASONS,
      lots: [lotRow()],
      balances: [balanceRow(5)],
      inward: [],
      header: headerRow(),
      lines: [],
      pick: [],
    };
    prisma = { $queryRaw: queryRawOver(db) };
    vouchers = {
      save: jest.fn().mockResolvedValue({ svhId: SVH_ID }),
      getById: jest.fn().mockResolvedValue({ header: { svhId: SVH_ID }, lines: [] }),
      validate: jest.fn().mockResolvedValue([]),
      // The shared post as the service sees it (notes 151 #5): the row is
      // locked, then beforePost runs over the stored rows on the transaction
      // client — the fake database here — before the preflight and the engine.
      // afterPost is left to the tests that want it.
      post: jest.fn(async (...args: unknown[]) => {
        const hooks = args[6] as { beforePost?: (tx: unknown, id: string) => Promise<void> } | undefined;
        await hooks?.beforePost?.(prisma, SVH_ID);
        return { svhId: SVH_ID, rowsPosted: 2 };
      }),
      cancel: jest.fn().mockResolvedValue({ svhId: SVH_ID, rowsReversed: 2 }),
      softDelete: jest.fn().mockResolvedValue({ svhId: SVH_ID, deleted: true }),
    };
    appSettings = { resolveEffective: jest.fn().mockResolvedValue([]) };
    service = new StockAdjustmentService(
      prisma as unknown as PrismaService,
      vouchers as unknown as StockVoucherService,
      {} as never,
      appSettings as never,
    );
  });

  const savedArgs = () =>
    vouchers.save.mock.calls[0] as [
      unknown,
      { header: Record<string, unknown>; lines: Record<string, unknown>[] },
    ];
  const queriesMatching = (marker: string) =>
    prisma.$queryRaw.mock.calls.filter(([strings]) =>
      (strings as TemplateStringsArray).join('?').includes(marker),
    );

  // ── save: what reaches the shared voucher service ─────────────────────────
  describe('save — mapping onto the shared voucher', () => {
    it('saves a clean inward adjustment line as a magnitude with its direction', async () => {
      await service.save(
        dtoOf({}, [line({ costRate: 12.5, costRateWot: 10, taxPerc: 18, batchNo: 'B1' })]),
      );

      const [rules, mapped] = savedArgs();
      expect(rules).toBe(STOCK_ADJUSTMENT_RULES.ADJUSTMENT);
      expect(mapped.header).toMatchObject({ voucherType: 'ADJUSTMENT', rateSource: undefined });
      expect(mapped.lines).toEqual([
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          baseUomId: UOM_ID,
          toBaseFactor: 1,
          qty: 2,
          baseQty: 2,
          freeQty: 0,
          freeBaseQty: 0,
          godownId: GODOWN_ID,
          lotId: null,
          bucket: 'SALEABLE',
          toBucket: null,
          barcode: null,
          batchNo: 'B1',
          mfgDate: null,
          expiryDate: null,
          mrp: null,
          salePrice: null,
          serialNo: null,
          supplierId: null,
          costRate: 12.5,
          costRateWot: 10,
          taxPerc: 18,
          reasonId: R_IN,
          remarks: null,
          direction: 1,
        },
      ]);
    });

    it('drops a keyed cost on an outward line: the engine values it at what the stock cost', async () => {
      await service.save(
        dtoOf({}, [line({ reasonId: R_OUT, lotId: LOT_A, qty: 3, baseQty: 3, costRate: 99 })]),
      );

      expect(savedArgs()[1].lines[0]).toMatchObject({
        lotId: LOT_A,
        costRate: 0,
        costRateWot: 0,
        direction: -1,
      });
    });

    it('turns a signed quantity under a BOTH reason into a magnitude and a direction', async () => {
      await service.save(
        dtoOf({}, [
          line({ reasonId: R_BOTH, lotId: LOT_A, qty: -2, baseQty: -2 }),
          line({ lineNo: 2, reasonId: R_BOTH, qty: 4, baseQty: 4 }),
        ]),
      );

      expect(savedArgs()[1].lines.map((l) => [l.qty, l.baseQty, l.direction])).toEqual([
        [2, 2, -1],
        [4, 4, 1],
      ]);
    });

    it('stamps no direction on an issue: the reason and the type say it moves out', async () => {
      await service.save(
        dtoOf({ voucherType: 'ISSUE' }, [line({ reasonId: R_OUT, lotId: LOT_A })]),
      );

      const [rules, mapped] = savedArgs();
      expect(rules).toBe(STOCK_ADJUSTMENT_RULES.ISSUE);
      expect(mapped.header.voucherType).toBe('ISSUE');
      expect(mapped.lines[0].direction).toBeNull();
    });

    it('keeps the line identity across saves and the rate source the header asked for', async () => {
      await service.save(
        dtoOf({ svhId: SVH_ID, rateSource: 'LAST_PURCHASE' }, [line({ sviId: SVI_ID })]),
      );

      const [, mapped] = savedArgs();
      expect(mapped.header.rateSource).toBe('LAST_PURCHASE');
      expect(mapped.lines[0].sviId).toBe(SVI_ID);
    });

    it('takes a line with no reason of its own under the header reason', async () => {
      await service.save(dtoOf({ reasonId: R_OUT }, [line({ reasonId: undefined, lotId: LOT_A })]));

      expect(savedArgs()[1].lines[0]).toMatchObject({ reasonId: null, direction: -1 });
    });

    it.each([
      ['empty', undefined],
      ['the stock module', 'STOCK'],
    ])('accepts a link module that is %s', async (_label, linkSrcModule) => {
      await expect(service.save(dtoOf({ linkSrcModule }))).resolves.toEqual({ svhId: SVH_ID });
    });

    it("refuses another module's link before reading anything", async () => {
      const refusal = await refusalOf(service.save(dtoOf({ linkSrcModule: 'SALES' })));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'This stock adjustment cannot be saved',
          errors: [{ field: 'header.linkSrcModule', code: StockErrorCode.ADJ_FOREIGN_LINK }],
        },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(vouchers.save).not.toHaveBeenCalled();
    });
  });

  // ── save: the header's one godown ─────────────────────────────────────────
  describe('save — the godown', () => {
    it('refuses an adjustment that names no godown', async () => {
      const refusal = await refusalOf(
        service.save(dtoOf({ fromGodownId: null, toGodownId: null })),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'fromGodownId', code: StockErrorCode.ADJ_GODOWN_REQUIRED }] },
      });
    });

    it('refuses an adjustment that names two godowns', async () => {
      const refusal = await refusalOf(service.save(dtoOf({ toGodownId: OTHER_GODOWN_ID })));

      expect(refusal).toMatchObject({
        body: {
          message: 'This stock adjustment cannot be saved',
          errors: [{ field: 'toGodownId', code: StockErrorCode.ADJ_ONE_GODOWN }],
        },
      });
    });

    it('takes an inward sheet that names only the godown it fills', async () => {
      await expect(
        service.save(dtoOf({ fromGodownId: null, toGodownId: GODOWN_ID })),
      ).resolves.toBeDefined();
    });

    it('refuses a line in a different godown from the document', async () => {
      const refusal = await refusalOf(
        service.save(dtoOf({}, [line({ godownId: OTHER_GODOWN_ID })])),
      );

      expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.ADJ_LINE_OTHER_GODOWN}`]);
    });
  });

  // ── save: the per-line rules ──────────────────────────────────────────────
  describe('save — the line rules', () => {
    it.each([
      ['a free quantity', line({ freeQty: 1 }), StockErrorCode.ADJ_FREE_QTY_NOT_ALLOWED],
      ['no quantity', line({ qty: 0, baseQty: 0 }), StockErrorCode.ADJ_QTY_REQUIRED],
      [
        'a bucket to move to on a plain adjustment',
        line({ toBucket: 'DAMAGED' }),
        StockErrorCode.TO_BUCKET_NOT_ALLOWED,
      ],
      ['no reason anywhere', line({ reasonId: undefined }), StockErrorCode.ADJ_REASON_REQUIRED],
      [
        'a reason the company cannot see',
        line({ reasonId: R_UNKNOWN }),
        StockErrorCode.REASON_NOT_FOUND,
      ],
      ['an inactive reason', line({ reasonId: R_INACTIVE }), StockErrorCode.REASON_INACTIVE],
      [
        'a move-only reason',
        line({ reasonId: R_MOVE }),
        StockErrorCode.ADJ_MOVE_REASON_NOT_ALLOWED,
      ],
      [
        'an IN reason with a negative quantity',
        line({ qty: -2, baseQty: -2 }),
        StockErrorCode.ADJ_REASON_SIGN_MISMATCH,
      ],
      [
        'a reason that wants a remark, without one',
        line({ reasonId: R_REMARK, lotId: LOT_A }),
        StockErrorCode.REASON_REMARK_REQUIRED,
      ],
      [
        'a lot that does not exist',
        line({ reasonId: R_OUT, lotId: LOT_B }),
        StockErrorCode.LOT_NOT_FOUND,
      ],
    ])('refuses %s', async (_label, bad, code) => {
      const refusal = await refusalOf(service.save(dtoOf({}, [bad])));

      expect(refusal.status).toBe(422);
      expect(codesOf(refusal)).toEqual([`lines.0:${code}`]);
      expect(vouchers.save).not.toHaveBeenCalled();
    });

    it('refuses a lot of another item', async () => {
      db.lots = [lotRow({ slt_item_id: OTHER_ITEM_ID })];

      const refusal = await refusalOf(
        service.save(dtoOf({}, [line({ reasonId: R_OUT, lotId: LOT_A })])),
      );

      expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.LOT_OTHER_ITEM}`]);
    });

    it('lets a header remark satisfy a reason that wants one', async () => {
      await expect(
        service.save(
          dtoOf({ remarks: 'Found torn' }, [line({ reasonId: R_REMARK, lotId: LOT_A })]),
        ),
      ).resolves.toBeDefined();
    });

    it('refuses an issue that cites an IN reason', async () => {
      const refusal = await refusalOf(service.save(dtoOf({ voucherType: 'ISSUE' })));

      expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.ADJ_REASON_INWARD}`]);
      expect(refusal.body.errors[0].message).toContain('A stock issue only takes stock out.');
    });

    it('reads no reasons when no line names one', async () => {
      await refusalOf(service.save(dtoOf({}, [line({ reasonId: undefined })])));

      expect(queriesMatching('stock.stock_reason_master')).toHaveLength(0);
    });

    it('reads reasons in the company scope', async () => {
      await service.save(dtoOf());

      const [[, ids, companyId]] = queriesMatching('srm_id = ANY');
      expect(ids).toEqual([R_IN]);
      expect(companyId).toBe(COMPANY_ID);
    });

    it('says one thing per line, and lists the lines in order', async () => {
      // Line 2 fails the first pass (free qty); line 1 only the reason pass.
      const refusal = await refusalOf(
        service.save(
          dtoOf({}, [
            line({ reasonId: R_UNKNOWN }),
            line({ lineNo: 2, freeQty: 1, reasonId: R_UNKNOWN }),
          ]),
        ),
      );

      expect(refusal.body.errors).toEqual([
        {
          field: 'lines.0',
          code: StockErrorCode.REASON_NOT_FOUND,
          message: `Line 1: names a reason (${R_UNKNOWN}) this company cannot see.`,
        },
        {
          field: 'lines.1',
          code: StockErrorCode.ADJ_FREE_QTY_NOT_ALLOWED,
          message:
            'Line 2: carries a free quantity. An adjustment has no free goods: state the quantity.',
        },
      ]);
    });
  });

  // ── save: what the holding has ────────────────────────────────────────────
  describe('save — available stock', () => {
    it('lets an outward line take exactly what the holding has', async () => {
      await expect(
        service.save(dtoOf({}, [line({ reasonId: R_OUT, lotId: LOT_A, qty: 5, baseQty: 5 })])),
      ).resolves.toBeDefined();

      const [[, companyId, branchId, lotIds]] = queriesMatching('FROM stock.stock_balance');
      expect([companyId, branchId, lotIds]).toEqual([COMPANY_ID, BRANCH_ID, [LOT_A]]);
    });

    it('sums every outward line on one holding and reports the shortfall once', async () => {
      const refusal = await refusalOf(
        service.save(
          dtoOf({}, [
            line({ reasonId: R_OUT, lotId: LOT_A, qty: 3, baseQty: 3 }),
            line({ lineNo: 2, reasonId: R_OUT, lotId: LOT_A, qty: 3, baseQty: 3 }),
          ]),
        ),
      );

      expect(refusal.body.errors).toEqual([
        {
          field: 'lines.0',
          code: StockErrorCode.INSUFFICIENT_STOCK,
          message:
            'Line 1: takes 6 but this godown holds 5 of batch B-OLD in the SALEABLE bucket. ' +
            'Writing off stock you do not have is a data error, not a sale.',
        },
      ]);
    });

    it('counts a holding with no balance row as empty', async () => {
      db.balances = [];

      const refusal = await refusalOf(
        service.save(dtoOf({}, [line({ reasonId: R_OUT, lotId: LOT_A })])),
      );

      expect(refusal.body.errors[0].message).toContain('holds 0 of batch B-OLD');
    });

    it('checks no balance for an inward line that names a lot', async () => {
      await service.save(dtoOf({}, [line({ lotId: LOT_A, qty: 50, baseQty: 50 })]));

      expect(queriesMatching('FROM stock.stock_balance')).toHaveLength(0);
    });
  });

  // ── save: the expiry write-off ────────────────────────────────────────────
  describe('save — expiry write-off', () => {
    const writeOff = (overrides: Record<string, unknown> = {}) =>
      dtoOf({ voucherType: 'EXPIRY_WRITEOFF' }, [
        line({ reasonId: R_OUT, lotId: LOT_A, ...overrides }),
      ]);

    it('refuses a line that names no lot', async () => {
      const refusal = await refusalOf(service.save(writeOff({ lotId: undefined })));

      expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.LINE_LOT_REQUIRED}`]);
    });

    it('refuses a lot with no expiry date', async () => {
      const refusal = await refusalOf(service.save(writeOff()));

      expect(refusal.body.errors[0]).toMatchObject({
        code: StockErrorCode.ADJ_LOT_NO_EXPIRY,
        message: 'Line 1: lot B-OLD has no expiry date. Use a damage write-off.',
      });
    });

    it('refuses a lot that has not expired by the document date', async () => {
      db.lots = [lotRow({ slt_expiry_date: new Date('2026-10-05T00:00:00.000Z') })];

      const refusal = await refusalOf(service.save(writeOff()));

      expect(refusal.body.errors[0]).toMatchObject({
        code: StockErrorCode.ADJ_LOT_NOT_EXPIRED,
        message:
          'Line 1: lot B-OLD expires on 2026-10-05, after 2026-10-01. Not expired yet: use a damage write-off.',
      });
    });

    it('writes off a lot that expired on the document date', async () => {
      db.lots = [lotRow({ slt_expiry_date: new Date(`${DOC_DATE}T00:00:00.000Z`) })];

      await expect(service.save(writeOff())).resolves.toBeDefined();
      expect(savedArgs()[0]).toBe(STOCK_ADJUSTMENT_RULES.EXPIRY_WRITEOFF);
    });

    it('allows the grace days the company set, read for the document scope', async () => {
      db.lots = [lotRow({ slt_expiry_date: new Date('2026-10-05T00:00:00.000Z') })];
      appSettings.resolveEffective.mockResolvedValue([
        { asdKey: EXPIRY_GRACE_SETTING_KEY, value: '7' },
      ]);

      await expect(service.save(writeOff())).resolves.toBeDefined();
      expect(appSettings.resolveEffective).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: null,
        userId: null,
      });
    });

    it('names the grace in the refusal when the lot is still too fresh', async () => {
      db.lots = [lotRow({ slt_expiry_date: new Date('2026-10-20T00:00:00.000Z') })];
      appSettings.resolveEffective.mockResolvedValue([
        { asdKey: EXPIRY_GRACE_SETTING_KEY, value: '7' },
      ]);

      const refusal = await refusalOf(service.save(writeOff()));

      expect(refusal.body.errors[0].message).toBe(
        "Line 1: lot B-OLD expires on 2026-10-20, after 2026-10-08 (document date + 7 days' grace). Not expired yet: use a damage write-off.",
      );
    });

    it.each(['-3', 'soon'])('treats a grace of %p as none', async (value) => {
      db.lots = [lotRow({ slt_expiry_date: new Date('2026-10-02T00:00:00.000Z') })];
      appSettings.resolveEffective.mockResolvedValue([{ asdKey: EXPIRY_GRACE_SETTING_KEY, value }]);

      const refusal = await refusalOf(service.save(writeOff()));

      expect(refusal.body.errors[0].code).toBe(StockErrorCode.ADJ_LOT_NOT_EXPIRED);
    });

    it('reads no grace setting for any other kind', async () => {
      await service.save(
        dtoOf({ voucherType: 'DAMAGE' }, [line({ reasonId: R_OUT, lotId: LOT_A })]),
      );

      expect(appSettings.resolveEffective).not.toHaveBeenCalled();
    });
  });

  // ── save: the re-lot pair ─────────────────────────────────────────────────
  describe('save — re-lot', () => {
    const outHalf = (overrides: Record<string, unknown> = {}) =>
      line({ reasonId: R_RELOT_OUT, lotId: LOT_A, qty: 5, baseQty: 5, costRate: 40, ...overrides });
    const inHalf = (overrides: Record<string, unknown> = {}) =>
      line({
        lineNo: 2,
        reasonId: R_RELOT_IN,
        qty: 5,
        baseQty: 5,
        batchNo: 'B-NEW',
        costRate: 55,
        ...overrides,
      });

    it('saves a balanced pair at the average, neither half keying a cost', async () => {
      await service.save(dtoOf({ rateSource: 'LAST_PURCHASE' }, [outHalf(), inHalf()]));

      const [, mapped] = savedArgs();
      expect(mapped.header.rateSource).toBe('AVG_COST');
      expect(mapped.lines.map((l) => [l.costRate, l.costRateWot, l.direction])).toEqual([
        [0, 0, -1],
        [0, 0, 1],
      ]);
    });

    it('resolves the lotless IN half the way the engine will, from the identity it states', async () => {
      await service.save(
        dtoOf({}, [
          outHalf(),
          inHalf({ mrp: 120.5, expiryDate: '2027-03-31', supplierId: OTHER_ITEM_ID }),
        ]),
      );

      const [[, companyId, branchId, docDate, stated]] = queriesMatching('jsonb_to_recordset');
      expect([companyId, branchId, docDate]).toEqual([COMPANY_ID, BRANCH_ID, DOC_DATE]);
      expect(JSON.parse(stated as string)).toEqual([
        {
          idx: 1,
          item_id: ITEM_ID,
          batch_no: 'B-NEW',
          mrp: '120.5',
          sale_price: null,
          expiry_date: '2027-03-31',
          serial_no: null,
          supplier_id: OTHER_ITEM_ID,
        },
      ]);
    });

    it('refuses an IN half that resolves onto the lot the OUT half leaves', async () => {
      db.inward = [inwardRow(1, LOT_A, { track_batch: true, track_expiry: true })];

      const refusal = await refusalOf(
        service.save(dtoOf({}, [outHalf(), inHalf({ batchNo: 'B-OLD' })])),
      );

      expect(refusal.body.errors).toEqual([
        {
          field: 'lines.1',
          code: StockErrorCode.ADJ_RELOT_SAME_LOT,
          message:
            'Line 2: re-lot lands back on the lot the OUT half leaves: this item tracks batch, expiry, ' +
            'and the IN half states the same values as that lot. State the CORRECT identity.',
        },
      ]);
    });

    it('explains a re-lot of an item that tracks no identity at all', async () => {
      db.inward = [inwardRow(1, LOT_A)];

      const refusal = await refusalOf(service.save(dtoOf({}, [outHalf(), inHalf()])));

      expect(refusal.body.errors[0].message).toContain(
        're-lots an item that tracks no lot identity',
      );
    });

    it('lets an IN half land on a different existing lot', async () => {
      db.inward = [inwardRow(1, LOT_B, { track_batch: true })];

      await expect(service.save(dtoOf({}, [outHalf(), inHalf()]))).resolves.toBeDefined();
    });

    it.each([
      [
        'an unbalanced pair',
        [outHalf(), inHalf({ qty: 4, baseQty: 4 })],
        'lines.0',
        StockErrorCode.ADJ_RELOT_UNBALANCED,
      ],
      [
        'an OUT half that names no lot',
        [outHalf({ lotId: undefined }), inHalf()],
        'lines.0',
        StockErrorCode.ADJ_RELOT_OUT_LOT_REQUIRED,
      ],
      [
        'an IN half that names the OUT lot',
        [outHalf(), inHalf({ lotId: LOT_A })],
        'lines.0',
        StockErrorCode.ADJ_RELOT_SAME_LOT,
      ],
      [
        'halves keyed in different base units',
        [outHalf(), inHalf({ baseUomId: OTHER_UOM_ID })],
        'lines.0',
        StockErrorCode.ADJ_RELOT_UNIT_MISMATCH,
      ],
    ])('refuses %s', async (_label, lines, field, code) => {
      const refusal = await refusalOf(service.save(dtoOf({}, lines)));

      expect(codesOf(refusal)).toEqual([`${field}:${code}`]);
    });

    it('states both sides of an unbalanced pair', async () => {
      const refusal = await refusalOf(
        service.save(dtoOf({}, [outHalf(), inHalf({ qty: 4, baseQty: 4 })])),
      );

      expect(refusal.body.errors[0].message).toContain(
        '5 out of the old lot against 4 into the new one',
      );
    });
  });

  // ── save: the bucket move ─────────────────────────────────────────────────
  describe('save — move stock', () => {
    const move = (overrides: Record<string, unknown> = {}, header: Record<string, unknown> = {}) =>
      dtoOf({ voucherType: 'BUCKET_MOVE', ...header }, [
        line({
          reasonId: R_MOVE,
          lotId: LOT_A,
          bucket: 'SALEABLE',
          toBucket: 'DAMAGED',
          ...overrides,
        }),
      ]);

    it('stores a move as an ADJUSTMENT at the average, the line moving out of its bucket', async () => {
      await service.save(move({ costRate: 30 }, { rateSource: 'LAST_PURCHASE' }));

      const [rules, mapped] = savedArgs();
      expect(rules).toBe(STOCK_ADJUSTMENT_RULES.BUCKET_MOVE);
      expect(mapped.header).toMatchObject({ voucherType: 'ADJUSTMENT', rateSource: 'AVG_COST' });
      expect(mapped.lines[0]).toMatchObject({
        bucket: 'SALEABLE',
        toBucket: 'DAMAGED',
        direction: -1,
        costRate: 0,
      });
    });

    it.each([
      ['a negative quantity', { qty: -2, baseQty: -2 }, StockErrorCode.ADJ_MOVE_QTY_NEGATIVE],
      ['no bucket to move to', { toBucket: undefined }, StockErrorCode.MOVE_TO_BUCKET_REQUIRED],
      ['a move into the same bucket', { toBucket: 'SALEABLE' }, StockErrorCode.MOVE_SAME_BUCKET],
      ['no lot', { lotId: undefined }, StockErrorCode.LINE_LOT_REQUIRED],
      [
        'a reason that is not a move reason',
        { reasonId: R_BOTH },
        StockErrorCode.ADJ_MOVE_REASON_REQUIRED,
      ],
      [
        'a move reason that wants a remark, without one',
        { reasonId: R_MOVE_REMARK },
        StockErrorCode.REASON_REMARK_REQUIRED,
      ],
    ])('refuses %s', async (_label, overrides, code) => {
      const refusal = await refusalOf(service.save(move(overrides)));

      expect(codesOf(refusal)).toEqual([`lines.0:${code}`]);
    });

    it('refuses to move more than the from-holding has', async () => {
      db.balances = [balanceRow(1)];

      const refusal = await refusalOf(service.save(move()));

      expect(refusal.body.errors[0]).toMatchObject({
        code: StockErrorCode.INSUFFICIENT_STOCK,
        message:
          'Line 1: moves 2 but this godown holds 1 of batch B-OLD in the SALEABLE bucket. ' +
          'Moving stock you do not have is a data error.',
      });
    });

    it('refuses a move that names a second godown', async () => {
      const refusal = await refusalOf(service.save(move({}, { toGodownId: OTHER_GODOWN_ID })));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'This stock move cannot be saved',
          errors: [{ field: 'toGodownId', code: StockErrorCode.ADJ_ONE_GODOWN }],
        },
      });
    });

    it('accepts a move that names its godown twice', async () => {
      await expect(service.save(move({}, { toGodownId: GODOWN_ID }))).resolves.toBeDefined();
    });
  });

  // ── load / validate / post / cancel / delete ──────────────────────────────
  describe('the stored document', () => {
    it('loads a plain adjustment and says what kind it is', async () => {
      await expect(service.getOne(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID)).resolves.toEqual({
        header: { svhId: SVH_ID },
        lines: [],
        kind: 'ADJUSTMENT',
      });
      expect(vouchers.getById).toHaveBeenCalledWith(
        STOCK_ADJUSTMENT_RULES.ADJUSTMENT,
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
      );
      const [kindQuery] = queriesMatching('AS is_move');
      expect(kindQuery.slice(1)).toEqual([
        RELOT_OUT_CODE,
        RELOT_IN_CODE,
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
      ]);
    });

    it.each([
      ['a re-lot', { is_relot: true }, 'RELOT', STOCK_ADJUSTMENT_RULES.ADJUSTMENT],
      ['a move', { is_move: true }, 'BUCKET_MOVE', STOCK_ADJUSTMENT_RULES.BUCKET_MOVE],
      ['an issue', { svh_voucher_type: 'ISSUE' }, 'ISSUE', STOCK_ADJUSTMENT_RULES.ISSUE],
    ])('tells %s by its lines and pins its rules', async (_label, overrides, kind, rules) => {
      db.header = headerRow(overrides);

      const payload = await service.getOne(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);

      expect(payload.kind).toBe(kind);
      expect(vouchers.getById.mock.calls[0][0]).toBe(rules);
    });

    it.each([
      ['no such document', null],
      ['a document of another type', headerRow({ svh_voucher_type: 'OPENING' })],
    ])('answers 404 for %s', async (_label, header) => {
      db.header = header;

      const refusal = await refusalOf(service.getOne(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Stock adjustment not found',
          errors: [{ field: 'svhId', code: StockErrorCode.ADJ_NOT_FOUND }],
        },
      });
    });

    it("refuses another module's shadow voucher, naming the document it belongs to", async () => {
      db.header = headerRow({
        svh_voucher_type: 'ISSUE',
        svh_refno: 'ISS0042',
        svh_link_src_module: 'SALES',
        svh_link_src_doc_type: 'SALE_BILL',
      });

      const refusal = await refusalOf(
        service.cancel({
          svhId: SVH_ID,
          accYear: ACC_YEAR,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          reason: 'x',
        }),
      );

      expect(refusal.body.errors[0]).toEqual({
        field: 'svhId',
        code: StockErrorCode.ADJ_OTHER_MODULE_DOC,
        message:
          'ISS0042 is the stock movement of a SALES SALE_BILL, not an adjustment. It is posted and cancelled with that document.',
      });
      expect(vouchers.cancel).not.toHaveBeenCalled();
    });

    it('loads a document the stock module itself linked', async () => {
      db.header = headerRow({ svh_link_src_module: 'STOCK' });

      await expect(service.getOne(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID)).resolves.toBeDefined();
    });

    it('cancels and deletes under the rules of the stored kind', async () => {
      db.header = headerRow({ svh_voucher_type: 'DAMAGE' });

      await service.cancel({
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        reason: 'Keyed twice',
        userId: USER_ID,
      });
      await service.remove(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID, USER_ID);

      expect(vouchers.cancel).toHaveBeenCalledWith(
        STOCK_ADJUSTMENT_RULES.DAMAGE,
        SVH_ID,
        ACC_YEAR,
        'Keyed twice',
        COMPANY_ID,
        BRANCH_ID,
        USER_ID,
      );
      expect(vouchers.softDelete).toHaveBeenCalledWith(
        STOCK_ADJUSTMENT_RULES.DAMAGE,
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
        USER_ID,
      );
    });

    it("puts the adjustment's own sentence over the shared preflight's, line by line", async () => {
      db.lines = [
        storedLine(),
        storedLine({
          svi_line_no: 2,
          svi_reason_id: R_OUT,
          svi_lot_id: LOT_A,
          svi_direction: -1,
          svi_base_qty: new Prisma.Decimal(9),
        }),
      ];
      vouchers.validate.mockResolvedValue([
        { lineNo: 1, problem: null },
        { lineNo: 2, problem: 'shared sentence' },
        { lineNo: 3, problem: 'only the shared preflight saw this' },
      ]);

      const rows = await service.validate(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);

      expect(rows.map((r) => r.problem)).toEqual([
        null,
        'Line 2: takes 9 but this godown holds 5 of batch B-OLD in the SALEABLE bucket. Writing off stock you do not have is a data error, not a sale.',
        'only the shared preflight saw this',
      ]);
    });

    describe('post', () => {
      const postArgs = {
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        userId: USER_ID,
      };

      /** The hooks the service handed the shared post on its first call. */
      const hooksOf = () =>
        vouchers.post.mock.calls[0][6] as {
          beforePost: (tx: unknown, id: string) => Promise<void>;
          afterPost: (tx: unknown, rowsPosted: number, id: string) => Promise<void>;
        };

      it('posts a clean document through the shared post, with the two in-transaction hooks (notes 151 #5)', async () => {
        db.lines = [storedLine()];

        await expect(service.post(postArgs)).resolves.toEqual({ svhId: SVH_ID, rowsPosted: 2 });
        expect(vouchers.post).toHaveBeenCalledWith(
          STOCK_ADJUSTMENT_RULES.ADJUSTMENT,
          SVH_ID,
          ACC_YEAR,
          COMPANY_ID,
          BRANCH_ID,
          USER_ID,
          { beforePost: expect.any(Function), afterPost: expect.any(Function) },
        );
        // The kind is read before the transaction (to pin the rules) and AGAIN
        // inside it; the lines and reasons only inside it, under the lock.
        expect(queriesMatching('AS is_move')).toHaveLength(2);
        expect(queriesMatching('svi.svi_line_no, svi.svi_item_id')).toHaveLength(1);
        // Not a re-lot: afterPost has nothing to check and reads nothing.
        const tx = { $queryRaw: jest.fn() };
        await expect(hooksOf().afterPost(tx, 2, SVH_ID)).resolves.toBeUndefined();
        expect(tx.$queryRaw).not.toHaveBeenCalled();
      });

      it('refuses a stored line that breaks a rule, naming its item — from inside the shared post', async () => {
        db.lines = [storedLine({ svi_reason_id: null })];

        const refusal = await refusalOf(service.post(postArgs));

        expect(refusal.body).toEqual({
          success: false,
          message: 'This stock adjustment cannot be posted',
          errors: [
            {
              field: 'lines.0',
              code: StockErrorCode.ADJ_REASON_REQUIRED,
              message:
                'Line 1: names no reason, and the header names none either. Every adjustment line says why. (Soap 100g)',
            },
          ],
        });
        // The refusal came out of beforePost, i.e. under the shared post's lock.
        expect(vouchers.post).toHaveBeenCalledTimes(1);
      });

      it('409 ADJ_KIND_CHANGED when the document became a move while the post waited for its lock', async () => {
        db.lines = [storedLine()];
        vouchers.post.mockImplementationOnce(async (...args: unknown[]) => {
          // A concurrent save replaced the lines with move lines between the
          // pre-transaction read and the lock: the re-read inside sees a move.
          db.header = headerRow({ is_move: true });
          const hooks = args[6] as { beforePost: (tx: unknown, id: string) => Promise<void> };
          await hooks.beforePost(prisma, SVH_ID);
          return { svhId: SVH_ID, rowsPosted: 2 };
        });

        const refusal = await refusalOf(service.post(postArgs));

        expect(refusal.status).toBe(409);
        expect(codesOf(refusal)).toEqual([`svhId:${StockErrorCode.ADJ_KIND_CHANGED}`]);
        expect(refusal.body.errors[0].message).toContain('saved as a stock move while the post waited');
      });

      it('refuses a stored BOTH line that carries no direction', async () => {
        db.lines = [storedLine({ svi_reason_id: R_BOTH, svi_direction: null })];

        const refusal = await refusalOf(service.post(postArgs));

        expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.ADJ_QTY_SIGN_REQUIRED}`]);
      });

      it("takes a stored line's reason and remark from the header when it has none", async () => {
        db.header = headerRow({ svh_reason_id: R_REMARK, svh_remarks: 'Shelf collapsed' });
        db.lines = [storedLine({ svi_reason_id: null, svi_lot_id: LOT_A, svi_direction: -1 })];

        await expect(service.post(postArgs)).resolves.toBeDefined();
      });

      it('checks the stored free quantity too', async () => {
        db.lines = [storedLine({ svi_free_base_qty: new Prisma.Decimal(1) })];

        const refusal = await refusalOf(service.post(postArgs));

        expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.ADJ_FREE_QTY_NOT_ALLOWED}`]);
      });

      describe('a re-lot', () => {
        beforeEach(() => {
          db.header = headerRow({ is_relot: true });
          db.lines = [
            storedLine({
              svi_reason_id: R_RELOT_OUT,
              svi_lot_id: LOT_A,
              svi_direction: -1,
              svi_base_qty: new Prisma.Decimal(5),
            }),
            storedLine({
              svi_id: 'svi-2',
              svi_line_no: 2,
              svi_reason_id: R_RELOT_IN,
              svi_base_qty: new Prisma.Decimal(5),
              svi_batch_no: 'B-NEW',
              svi_mrp: new Prisma.Decimal('120.50'),
              svi_expiry_date: new Date('2027-03-31T00:00:00.000Z'),
            }),
          ];
        });

        it('resolves the IN half from the stored identity', async () => {
          await service.post(postArgs);

          const [[, , , , stated]] = queriesMatching('jsonb_to_recordset');
          expect(JSON.parse(stated as string)).toEqual([
            expect.objectContaining({
              idx: 1,
              batch_no: 'B-NEW',
              mrp: '120.5',
              expiry_date: '2027-03-31',
            }),
          ]);
        });

        it('hands the post an afterPost hook that refuses a pair the engine landed on one lot', async () => {
          await service.post(postArgs);
          const hook = hooksOf().afterPost;
          const tx = {
            $queryRaw: jest
              .fn()
              .mockResolvedValue([{ in_line_no: 2, out_line_no: 1, item_name: 'Soap 100g' }]),
          };

          const refusal = await refusalOf(hook(tx, 2, SVH_ID));

          expect(refusal.body).toEqual({
            success: false,
            message: 'This stock adjustment cannot be posted',
            errors: [
              {
                field: 'lines.2',
                code: StockErrorCode.ADJ_RELOT_SAME_LOT,
                message:
                  'Line 2 (Soap 100g): the IN half of the re-lot resolved to the lot line 1 takes the stock out of — the pair would move it from a lot into the same lot. State the CORRECT identity.',
              },
            ],
          });
          const [strings, svhId, accYear] = tx.$queryRaw.mock.calls[0] as [
            TemplateStringsArray,
            string,
            string,
          ];
          expect(strings.join('?')).toContain('DISTINCT ON (i_in.svi_line_no)');
          expect([svhId, accYear]).toEqual([SVH_ID, ACC_YEAR]);
        });

        it('lets the hook pass when the engine landed the halves on different lots', async () => {
          await service.post(postArgs);
          const hook = hooksOf().afterPost;

          await expect(
            hook({ $queryRaw: jest.fn().mockResolvedValue([]) }, 2, SVH_ID),
          ).resolves.toBeUndefined();
        });

        it('decides "is this a re-lot" from the re-read under the lock, not from the first look', async () => {
          // Pinned as a plain adjustment before the transaction; saved as a
          // re-lot while waiting. afterPost then guards it all the same.
          db.header = headerRow({ is_relot: false });
          vouchers.post.mockImplementationOnce(async (...args: unknown[]) => {
            db.header = headerRow({ is_relot: true });
            const hooks = args[6] as { beforePost: (tx: unknown, id: string) => Promise<void> };
            await hooks.beforePost(prisma, SVH_ID);
            return { svhId: SVH_ID, rowsPosted: 2 };
          });
          await service.post(postArgs);

          const tx = { $queryRaw: jest.fn().mockResolvedValue([{ in_line_no: 2, out_line_no: 1, item_name: 'Soap 100g' }]) };
          await expect(hooksOf().afterPost(tx, 2, SVH_ID)).rejects.toMatchObject({ status: 422 });
        });
      });

      it('notes 151 #7 — refuses a stored line naming a lot of another company', async () => {
        db.lots = [lotRow({ slt_company_id: '019c6f6c-be87-7a11-8905-36092c46b999' })];
        db.lines = [storedLine({ svi_reason_id: R_OUT, svi_lot_id: LOT_A, svi_direction: -1 })];

        const refusal = await refusalOf(service.post(postArgs));

        expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.LOT_OTHER_COMPANY}`]);
        expect(refusal.body.errors[0].message).toContain('names a lot that belongs to another company');
      });
    });
  });

  // ── notes 151 — the rules added by the stock adjustment review ────────────
  describe('notes 151 rules at save', () => {
    it('#6 — a re-lot whose IN half sits in another bucket is a bucket move in disguise: refused', async () => {
      db.inward = [inwardRow(1, null, { track_batch: true })];
      const refusal = await refusalOf(
        service.save(
          dtoOf({}, [
            line({ reasonId: R_RELOT_OUT, lotId: LOT_A, remarks: 'relabel' }),
            line({ lineNo: 2, reasonId: R_RELOT_IN, batchNo: 'B-NEW', bucket: 'QUARANTINE', remarks: 'relabel' }),
          ]),
        ),
      );

      expect(codesOf(refusal)).toEqual([`lines.1:${StockErrorCode.ADJ_RELOT_BUCKET_MISMATCH}`]);
      expect(refusal.body.errors[0].message).toContain(
        'brings the stock into the QUARANTINE bucket, but the OUT half takes it from SALEABLE',
      );
      expect(vouchers.save).not.toHaveBeenCalled();
    });

    it('#6 — the same bucket on both halves saves', async () => {
      db.inward = [inwardRow(1, null, { track_batch: true })];
      await service.save(
        dtoOf({}, [
          line({ reasonId: R_RELOT_OUT, lotId: LOT_A, remarks: 'relabel' }),
          line({ lineNo: 2, reasonId: R_RELOT_IN, batchNo: 'B-NEW', remarks: 'relabel' }),
        ]),
      );
      expect(vouchers.save).toHaveBeenCalledTimes(1);
    });

    it("#7 — a line naming another company's lot is refused before the shared save", async () => {
      db.lots = [lotRow({ slt_company_id: '019c6f6c-be87-7a11-8905-36092c46b999' })];

      const refusal = await refusalOf(
        service.save(dtoOf({}, [line({ reasonId: R_OUT, lotId: LOT_A })])),
      );

      expect(codesOf(refusal)).toEqual([`lines.0:${StockErrorCode.LOT_OTHER_COMPANY}`]);
      expect(vouchers.save).not.toHaveBeenCalled();
    });

    it('#5 — every save hands the shared save the in-transaction hooks, for the save-and-post path', async () => {
      await service.save(dtoOf({ status: 'POSTED' }));

      const hooks = vouchers.save.mock.calls[0][2] as {
        beforePost: (tx: unknown, id: string) => Promise<void>;
        afterPost: (tx: unknown, n: number, id: string) => Promise<void>;
      };
      expect(hooks).toEqual({ beforePost: expect.any(Function), afterPost: expect.any(Function) });
      // beforePost re-reads the stored document under the lock and checks it.
      db.lines = [storedLine({ svi_reason_id: null })];
      await expect(hooks.beforePost(prisma, SVH_ID)).rejects.toMatchObject({ status: 422 });
    });
  });

  // ── the pick-stock picker ─────────────────────────────────────────────────
  describe('pickStock', () => {
    it('answers one row per holding, numbers and dates made plain', async () => {
      db.pick = [
        {
          sbl_id: 'sbl-1',
          sbl_item_id: ITEM_ID,
          item_code: 'SOAP100',
          item_name: 'Soap 100g',
          sbl_godown_id: GODOWN_ID,
          sbl_lot_id: LOT_A,
          sbl_bucket: 'DAMAGED',
          slt_batch_no: 'B-OLD',
          slt_mfg_date: new Date('2026-01-01T00:00:00.000Z'),
          slt_expiry_date: new Date('2027-01-01T00:00:00.000Z'),
          slt_mrp: new Prisma.Decimal('45.50'),
          slt_sale_price: new Prisma.Decimal('40'),
          slt_serial_no: null,
          slt_supplier_id: OTHER_ITEM_ID,
          sup_name: 'Acme',
          sbl_base_uom_id: UOM_ID,
          unit_name: 'Nos',
          sbl_on_hand_qty: new Prisma.Decimal(12),
          sbl_reserved_qty: new Prisma.Decimal(2),
          sbl_available_qty: new Prisma.Decimal(10),
          free_available_qty: new Prisma.Decimal('1.5'),
          sbl_avg_cost_rate: new Prisma.Decimal('31.25'),
          sbl_stock_value: new Prisma.Decimal('375'),
          sbl_first_in_date: new Date('2026-02-01T00:00:00.000Z'),
          sbd_size_id: 'size-xl',
          size_name: 'XL',
          sbd_colour_id: 'colour-maroon',
          colour_name: 'Maroon',
          sbd_model: 'Slim fit',
          load_rate: new Prisma.Decimal('3.5000'),
          unload_rate: new Prisma.Decimal('2'),
        },
        {
          sbl_id: 'sbl-2',
          sbl_item_id: ITEM_ID,
          item_code: null,
          item_name: 'Soap 100g',
          sbl_godown_id: GODOWN_ID,
          sbl_lot_id: LOT_B,
          sbl_bucket: 'SALEABLE',
          slt_batch_no: null,
          slt_mfg_date: null,
          slt_expiry_date: null,
          slt_mrp: null,
          slt_sale_price: null,
          slt_serial_no: null,
          slt_supplier_id: null,
          sup_name: null,
          sbl_base_uom_id: UOM_ID,
          unit_name: null,
          sbl_on_hand_qty: null,
          sbl_reserved_qty: new Prisma.Decimal(0),
          sbl_available_qty: null,
          free_available_qty: new Prisma.Decimal(0),
          sbl_avg_cost_rate: new Prisma.Decimal(0),
          sbl_stock_value: new Prisma.Decimal(0),
          sbl_first_in_date: null,
          sbd_size_id: null,
          size_name: null,
          sbd_colour_id: null,
          colour_name: null,
          sbd_model: null,
          load_rate: new Prisma.Decimal(0),
          unload_rate: new Prisma.Decimal(0),
        },
      ];

      const rows = await service.pickStock({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        godownId: GODOWN_ID,
      });

      expect(rows[0]).toEqual({
        sblId: 'sbl-1',
        itemId: ITEM_ID,
        itemCode: 'SOAP100',
        itemName: 'Soap 100g',
        godownId: GODOWN_ID,
        lotId: LOT_A,
        bucket: 'DAMAGED',
        batchNo: 'B-OLD',
        mfgDate: '2026-01-01',
        expiryDate: '2027-01-01',
        mrp: 45.5,
        salePrice: 40,
        serialNo: null,
        supplierId: OTHER_ITEM_ID,
        supplierName: 'Acme',
        baseUomId: UOM_ID,
        unitName: 'Nos',
        onHandQty: 12,
        reservedQty: 2,
        availableQty: 10,
        // Notes 160 A — free in − free out, as the query computes it.
        freeAvailableQty: 1.5,
        avgCostRate: 31.25,
        stockValue: 375,
        firstInDate: '2026-02-01',
        // Notes 151 #8 — the batch's detail rides on the row.
        sizeId: 'size-xl',
        sizeName: 'XL',
        colourId: 'colour-maroon',
        colourName: 'Maroon',
        model: 'Slim fit',
        // Notes 153 — the Godown Transfer line's default rates.
        loadRate: 3.5,
        unloadRate: 2,
      });
      expect(rows[1]).toMatchObject({
        mfgDate: null,
        expiryDate: null,
        mrp: null,
        salePrice: null,
        onHandQty: 0,
        availableQty: 0,
        freeAvailableQty: 0,
        firstInDate: null,
        sizeName: null,
        colourName: null,
        model: null,
        loadRate: 0,
        unloadRate: 0,
      });
    });

    it("notes 153 — the default rates are the holding unit's, only for an item that pays loading", async () => {
      await service.pickStock({ companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID });

      const [[strings]] = queriesMatching('sbl_first_in_date');
      const sql = (strings as unknown as string[]).join('?');
      expect(sql).toContain('CASE WHEN itm.item_allow_loading THEN COALESCE(unt.unit_loading, 0)   ELSE 0 END AS load_rate');
      expect(sql).toContain('CASE WHEN itm.item_allow_loading THEN COALESCE(unt.unit_unloading, 0) ELSE 0 END AS unload_rate');
    });

    it('asks for every item and bucket, 200 rows, when the query narrows nothing', async () => {
      await service.pickStock({ companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID });

      const [[, ...values]] = queriesMatching('sbl_first_in_date');
      expect(values.slice(0, 9)).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        GODOWN_ID,
        null,
        null,
        null,
        null,
        // Notes 151 #9 — no exact batch either.
        null,
        null,
      ]);
      expect(values.at(-1)).toBe(200);
    });

    it('notes 151 #9 — batchNo is an exact match on the folded lot key, beside the loose search', async () => {
      await service.pickStock({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        godownId: GODOWN_ID,
        batchNo: ' cbe26-00001 ',
      });

      const [[strings, ...values]] = queriesMatching('sbl_first_in_date');
      expect(values.slice(7, 9)).toEqual([' cbe26-00001 ', ' cbe26-00001 ']);
      expect((strings as TemplateStringsArray).join('?')).toContain('slt.slt_key_batch = upper(btrim(?::text))');
      expect((strings as TemplateStringsArray).join('?')).toContain('sbd.sbd_batch_no   = slt.slt_key_batch');
    });

    it('narrows to the item, bucket and limit asked for', async () => {
      await service.pickStock({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        godownId: GODOWN_ID,
        itemId: ITEM_ID,
        bucket: 'DAMAGED',
        limit: 25,
      });

      const [[, ...values]] = queriesMatching('sbl_first_in_date');
      expect(values.slice(3, 7)).toEqual([ITEM_ID, ITEM_ID, 'DAMAGED', 'DAMAGED']);
      expect(values.at(-1)).toBe(25);
    });
  });
});
