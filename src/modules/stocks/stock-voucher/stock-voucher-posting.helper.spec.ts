import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  BUCKET_MOVE_TXN_TYPES,
  STOCK_LOT_ID_NAMESPACE,
  bucketKeyFor,
  bucketKeySql,
  cancelDraftVoucher,
  cancelStockVoucher,
  effectivePolicyCte,
  ensureBalanceRows,
  lineReasonJoin,
  lotIdentityUuid,
  openReservationHoldings,
  postStockVoucher,
  readBucketTrackFlags,
  recallTransferOut,
  rebuildStockDerivedFigures,
  refreshReserved,
  refreshTransitIn,
  reservationHoldingsOf,
  settleTransitShort,
  transitHoldingsOf,
  unreversedLedgerRow,
} from './stock-voucher-posting.helper';
import type { StockVoucherTypeRules } from './types/stock-voucher.types';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const OUT_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e003';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e004';
const OTHER_BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e005';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46e006';
const TO_GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46e007';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46e008';
const LOT_A = '019c6f6c-be87-7a11-8905-36092c46e009';
const LOT_B = '019c6f6c-be87-7a11-8905-36092c46e010';
const LOT_C = '019c6f6c-be87-7a11-8905-36092c46e011';
const LINE_ID = '019c6f6c-be87-7a11-8905-36092c46e012';
const STT_ID = '019c6f6c-be87-7a11-8905-36092c46e013';
const REASON_ID = '019c6f6c-be87-7a11-8905-36092c46e014';
const SUPPLIER_ID = '019c6f6c-be87-7a11-8905-36092c46e015';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e016';
const ACC_YEAR = '2026-2027';
const POSTED_ON = new Date('2026-10-21T06:30:00.000Z');
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// ── rule records ──────────────────────────────────────────────────────────
const rules = (overrides: Partial<StockVoucherTypeRules> = {}): StockVoucherTypeRules => ({
  voucherType: 'OPENING',
  typeCode: 'OPN',
  displayName: 'Opening stock',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnTypes: ['OPENING'],
  quantityMode: 'QTY',
  allowsCount: false,
  allowsToBranch: false,
  postShape: 'SIMPLE',
  auditScreenName: 'Opening Stock',
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  ...overrides,
});
const OPENING = rules();
/** An outward document whose lines all move its way. */
const DAMAGE = rules({
  voucherType: 'DAMAGE',
  typeCode: 'DMG',
  displayName: 'Damage',
  isInward: false,
  ledgerTxnTypes: ['DAMAGE'],
});
const ADJUSTMENT = rules({
  voucherType: 'ADJUSTMENT',
  typeCode: 'ADJ',
  displayName: 'Stock adjustment',
  lineDirection: 'REASON',
  ledgerTxnTypes: ['ADJUST_PLUS', 'ADJUST_MINUS'],
});
const ISSUE = rules({
  voucherType: 'ISSUE',
  typeCode: 'ISS',
  displayName: 'Stock issue',
  isInward: false,
  lineDirection: 'REASON',
  ledgerTxnTypes: ['ADJUST_MINUS'],
});
const PHYSICAL = rules({
  voucherType: 'PHYSICAL',
  typeCode: 'PHY',
  displayName: 'Physical stock count',
  isInward: false,
  quantityMode: 'COUNT',
  ledgerTxnTypes: ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'],
  postShape: 'COUNT',
  statusDocType: TxnStatusDocType.PHYSICAL_STOCK,
});
const MOVE = rules({
  voucherType: 'ADJUSTMENT',
  typeCode: 'MOV',
  displayName: 'Stock move',
  isInward: false,
  lineDirection: 'REASON',
  ledgerTxnTypes: ['BUCKET_OUT', 'BUCKET_IN'],
  postShape: 'BUCKET_MOVE',
});
const TRANSFER_OUT = rules({
  voucherType: 'TRANSFER_OUT',
  typeCode: 'TRF',
  displayName: 'Stock transfer',
  isInward: false,
  ledgerTxnTypes: ['TRANSFER_OUT'],
  allowsToBranch: true,
  postShape: 'TRANSFER_OUT',
  statusDocType: TxnStatusDocType.STOCK_TRANSFER,
});
const TRANSFER_IN = rules({
  voucherType: 'TRANSFER_IN',
  typeCode: 'TRI',
  displayName: 'Transfer receipt',
  ledgerTxnTypes: ['TRANSFER_IN'],
  postShape: 'TRANSFER_IN',
  statusDocType: TxnStatusDocType.STOCK_TRANSFER,
});

// ── the fake transaction client ───────────────────────────────────────────
/**
 * Every raw statement the engine sends, labelled by what it is FOR. The engine
 * is one set-based statement per phase, so the label sequence IS the phase
 * order, and an answer keyed on the label is the database's reply.
 */
const QUERY_KINDS: Array<[string, (sql: string) => boolean]> = [
  ['lockHeader', (s) => s.includes('AS voucher_type') && s.includes('FOR UPDATE')],
  ['transferGuard', (s) => s.includes('SELECT svh_status AS status, svh_refno AS refno')],
  ['despatchLock', (s) => s.includes('svh_is_deleted, svh_to_branch_id')],
  ['shortHeader', (s) => s.includes('svh_is_deleted, svh_voucher_type')],
  ['lotless', (s) => s.includes('SELECT svi_line_no FROM stock.stock_voucher_item')],
  ['claims', (s) => s.includes('matched AS (')],
  ['pickLines', (s) => s.includes('WHERE keyed.line_direction < 0')],
  ['pickLots', (s) => s.includes('b.sbl_available_qty > 0')],
  ['zeroCost', (s) => s.includes('c.line_cost_rate = 0')],
  ['lockItems', (s) => s.includes('pg_advisory_xact_lock(hashtextextended')],
  ['negative', (s) => s.includes('sbl.sbl_on_hand_qty < 0')],
  ['freeStock', (s) => s.includes('sbl.sbl_free_out_qty > sbl.sbl_free_in_qty')],
  ['recallReceiver', (s) => s.includes('SELECT br_name FROM public.branch_master')],
  ['recallTransit', (s) => s.includes('SELECT stt_status, stt_received_qty, stt_damage_qty')],
  ['recallReceipt', (s) => s.includes("svh_voucher_type = 'TRANSFER_IN'")],
  ['closeOut', (s) => s.includes("o.svh_status = 'IN_TRANSIT'")],
  ['untouched', (s) => s.includes('count(*)::bigint AS n')],
  ['shortRows', (s) => s.includes("t.stt_status = 'PARTIAL'")],
  ['bucketFlags', (s) => s.includes('WITH ORDINALITY')],
];
const EXEC_KINDS: Array<[string, (sql: string) => boolean]> = [
  [
    'reversal',
    (s) => s.includes('INSERT INTO stock.stock_ledger') && s.includes('sml_reverses_id'),
  ],
  ['ledger', (s) => s.includes('INSERT INTO stock.stock_ledger')],
  ['resolveLots', (s) => s.includes('INSERT INTO stock.stock_lot')],
  ['pickInsert', (s) => s.includes('INSERT INTO stock.stock_voucher_item')],
  ['pickUpdate', (s) => s.includes('SET svi_lot_id = slt.slt_id,')],
  ['attachLots', (s) => s.includes('COALESCE(svi.svi_lot_id, slt.slt_id)')],
  ['transitInsert', (s) => s.includes('INSERT INTO stock.stock_transit')],
  ['transitSettle', (s) => s.includes('WITH got AS')],
  ['balances', (s) => s.includes('WITH holding AS')],
  ['ensureBalances', (s) => s.includes('INSERT INTO stock.stock_balance')],
  ['reserved', (s) => s.includes('SET sbl_reserved_qty')],
  ['transitIn', (s) => s.includes('SET sbl_transit_in_qty')],
  ['transitCancel', (s) => s.includes("SET stt_status = 'CANCELLED'")],
  ['itemCosts', (s) => s.includes('MERGE INTO stock.stock_item_cost')],
  ['stamp', (s) => s.includes('WITH item AS') && s.includes('UPDATE stock.stock_balance b')],
  ['lotTotals', (s) => s.includes('WITH lot AS') && s.includes('totals AS (')],
  ['lotCosts', (s) => s.includes('WITH lot AS')],
  ['headerTotals', (s) => s.includes('svh_line_count = t.line_count')],
  ['shortClose', (s) => s.includes("SET svh_status = 'RECEIVED', svh_version_no")],
];

interface Call {
  kind: string;
  sql: string;
  values: unknown[];
}
type Answer = unknown | ((call: Call) => unknown);

const classify = (kinds: Array<[string, (sql: string) => boolean]>, sql: string): string =>
  kinds.find(([, test]) => test(sql))?.[0] ?? 'unknown';

const makeTx = (answers: Record<string, Answer> = {}) => {
  const calls: Call[] = [];
  const statement = (raw: boolean) =>
    jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = Prisma.sql(strings, ...(values as never[]));
      const sql = query.sql.replace(/\s+/g, ' ');
      const call = {
        kind: classify(raw ? QUERY_KINDS : EXEC_KINDS, sql),
        sql,
        values: query.values,
      };
      calls.push(call);
      const answer = answers[call.kind];
      const result = typeof answer === 'function' ? (answer as (c: Call) => unknown)(call) : answer;
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve(result ?? (raw ? [] : 1));
    });
  const raw = {
    $queryRaw: statement(true),
    $executeRaw: statement(false),
    stockVoucher: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx: raw as unknown as Prisma.TransactionClient,
    raw,
    calls,
    kinds: () => calls.map((call) => call.kind),
    callOf: (kind: string) => calls.find((call) => call.kind === kind),
    callsOf: (kind: string) => calls.filter((call) => call.kind === kind),
  };
};

/** Answers one row per call, in order, then nothing. */
const inTurn =
  (...rows: unknown[][]) =>
  () =>
    rows.shift() ?? [];

const header = (overrides: Record<string, unknown> = {}) => [
  {
    status: 'DRAFT',
    refno: 'OPN/0001',
    voucher_type: 'OPENING',
    branch_id: BRANCH_ID,
    to_branch_id: null,
    to_godown_id: null,
    link_src_doc_id: null,
    link_src_acc_year: null,
    ...overrides,
  },
];

const postParams = (r: StockVoucherTypeRules, overrides: Record<string, unknown> = {}) => ({
  rules: r,
  svhId: SVH_ID,
  accYear: ACC_YEAR,
  actor: USER_ID,
  postedOn: POSTED_ON,
  ...overrides,
});

const cancelParams = (r: StockVoucherTypeRules, overrides: Record<string, unknown> = {}) => ({
  rules: r,
  svhId: SVH_ID,
  accYear: ACC_YEAR,
  actor: USER_ID,
  reason: 'Keyed against the wrong godown',
  cancelledOn: POSTED_ON,
  ...overrides,
});

const decimalsOf = (call: Call | undefined): string[] =>
  (call?.values ?? []).filter((v) => Prisma.Decimal.isDecimal(v)).map(String);

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

const codesOf = (refusal: { body: unknown }): string[] =>
  (refusal.body as { errors: Array<{ code: string }> }).errors.map((e) => e.code);

/** The phases every run applies once its rows are in the ledger (4–7). */
const APPLY_PHASES = [
  'lockItems',
  'balances',
  'lotCosts',
  'itemCosts',
  'stamp',
  'negative',
  'lotTotals',
];

/** A lotless outward line as the pick reads it. */
const pickableLine = (overrides: Record<string, unknown> = {}) => ({
  svi_id: LINE_ID,
  svi_line_no: 1,
  svi_split_no: 1,
  svi_item_id: ITEM_ID,
  item_name: 'Soap 100g',
  svi_godown_id: GODOWN_ID,
  svi_bucket: 'GOOD',
  svi_base_qty: new Prisma.Decimal(10),
  svi_free_base_qty: new Prisma.Decimal(0),
  svi_to_base_factor: new Prisma.Decimal(1),
  svh_company_id: COMPANY_ID,
  svh_branch_id: BRANCH_ID,
  issue_strategy: 'FEFO',
  track_batch: false,
  track_mrp: false,
  track_sale_price: false,
  track_expiry: false,
  track_serial: false,
  track_supplier: false,
  key_batch: '~',
  key_mrp: new Prisma.Decimal(-1),
  key_sp: new Prisma.Decimal(-1),
  key_expiry: new Date('0001-01-01T00:00:00.000Z'),
  key_serial: '~',
  key_supplier: NIL_UUID,
  ...overrides,
});

describe('stock-voucher-posting.helper', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  // ── the header lock ───────────────────────────────────────────────────────
  describe('the header lock', () => {
    it('refuses a voucher that no longer exists, before anything is written', async () => {
      const db = makeTx({ lockHeader: [] });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(OPENING)));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Opening stock not found',
          errors: [
            {
              field: 'svhId',
              code: StockErrorCode.VOUCHER_NOT_FOUND,
              message: `${SVH_ID} no longer exists in ${ACC_YEAR}, so there is nothing to post.`,
            },
          ],
        },
      });
      expect(db.kinds()).toEqual(['lockHeader']);
    });

    it('refuses a voucher a racing request already cancelled', async () => {
      const db = makeTx({ lockHeader: header({ status: 'CANCELLED' }) });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(OPENING)));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Opening stock is CANCELLED',
          errors: [
            {
              code: StockErrorCode.VOUCHER_ALREADY_CANCELLED,
              message: 'OPN/0001 was already cancelled.',
            },
          ],
        },
      });
    });

    it('names both states when a racing request posted it first', async () => {
      const db = makeTx({ lockHeader: header({ status: 'POSTED' }) });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(OPENING)));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              code: StockErrorCode.VOUCHER_STATUS_CHANGED,
              message:
                'OPN/0001 is POSTED, not DRAFT: it changed while this request was waiting. Reload it and decide again.',
            },
          ],
        },
      });
      expect(db.raw.stockVoucher.update).not.toHaveBeenCalled();
    });
  });

  // ── postStockVoucher by shape ─────────────────────────────────────────────
  describe('postStockVoucher — SIMPLE', () => {
    it('runs the phases in order and moves the header to POSTED', async () => {
      const db = makeTx({ lockHeader: header(), ledger: 4 });

      await expect(postStockVoucher(db.tx, postParams(OPENING))).resolves.toEqual({
        rowsPosted: 4,
        status: 'POSTED',
        transitRows: 0,
        closedOut: null,
      });

      // An inward document picks nothing: its lines bring the lot in.
      expect(db.kinds()).toEqual([
        'lockHeader',
        'resolveLots',
        'attachLots',
        'zeroCost',
        'ledger',
        ...APPLY_PHASES,
        'freeStock',
        'headerTotals',
      ]);
      expect(db.raw.stockVoucher.update).toHaveBeenCalledWith({
        where: { svhId_svhAccYear: { svhId: SVH_ID, svhAccYear: ACC_YEAR } },
        data: {
          svhStatus: 'POSTED',
          svhVersionNo: { increment: 1 },
          svhModifiedOn: POSTED_ON,
          svhModifiedBy: USER_ID,
        },
      });
    });

    it('derives every phase from the forward rows, not the reversals', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(OPENING));

      // ledgerRowsOf binds (svhId, accYear, reversal) — false on a post.
      expect(db.callOf('balances')?.values.slice(0, 3)).toEqual([SVH_ID, ACC_YEAR, false]);
    });

    it('never stamps the nil actor into an audit column', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(OPENING, { actor: DEFAULT_ACTOR }));

      expect(db.raw.stockVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ svhModifiedBy: null }) as object,
        }),
      );
      expect(db.callOf('resolveLots')?.values).not.toContain(DEFAULT_ACTOR);
      expect(db.callOf('ledger')?.values).not.toContain(DEFAULT_ACTOR);
    });

    it('labels a ledger row STOCK / the voucher type by default', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(OPENING));

      expect(db.callOf('ledger')?.values).toEqual(expect.arrayContaining(['STOCK', 'OPENING']));
    });

    it("writes a sales shadow's own labels and skips the zero-cost refusal for it", async () => {
      const db = makeTx({ lockHeader: header() });
      const ledgerSource = {
        srcModule: 'SALES' as const,
        srcDocType: 'BILL',
        srcRefno: 'bil00042',
        partyId: SUPPLIER_ID,
      };

      await postStockVoucher(db.tx, postParams(OPENING, { ledgerSource }));

      expect(db.kinds()).not.toContain('zeroCost');
      expect(db.callOf('ledger')?.values).toEqual(
        expect.arrayContaining(['SALES', 'BILL', 'bil00042', SUPPLIER_ID]),
      );
      expect(db.callOf('resolveLots')?.values).toEqual(
        expect.arrayContaining(['SALES', 'BILL', 'bil00042']),
      );
      // Notes 160 A — a scheme's free goods are given from the shelf.
      expect(db.kinds()).not.toContain('freeStock');
    });

    // Notes 160 A — free goods leave only from free goods that came in.
    it('refuses free stock the holding does not have: one 422, at lines.<i>.freeQty', async () => {
      const db = makeTx({
        lockHeader: header(),
        freeStock: [
          {
            line_no: 3,
            line_index: 2,
            item_name: 'Texttile Item',
            batch_no: 'B-7',
            godown_name: 'Main',
            bucket: 'SALEABLE',
            asked: new Prisma.Decimal(1),
            had: new Prisma.Decimal(0),
          },
        ],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(DAMAGE)));

      expect(refusal.status).toBe(422);
      expect(refusal.body).toMatchObject({
        errors: [
          {
            field: 'lines.2.freeQty',
            code: StockErrorCode.FREE_QTY_EXCEEDS_FREE_STOCK,
            message: expect.stringContaining('has no free stock'),
          },
        ],
      });
      // Checked over the rebuilt balances, before the header moves.
      expect(db.kinds().indexOf('freeStock')).toBeGreaterThan(db.kinds().indexOf('balances'));
      expect(db.raw.stockVoucher.update).not.toHaveBeenCalled();
      expect(db.callOf('freeStock')?.values.slice(0, 2)).toEqual([SVH_ID, ACC_YEAR]);
    });

    it('picks lots for an outward document and skips the zero-cost refusal', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(DAMAGE));

      expect(db.kinds().slice(0, 4)).toEqual([
        'lockHeader',
        'pickLines',
        'resolveLots',
        'attachLots',
      ]);
      expect(db.kinds()).not.toContain('zeroCost');
    });

    it('picks and checks cost on a document whose lines move by their reason', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(ADJUSTMENT));

      expect(db.kinds()).toEqual(expect.arrayContaining(['pickLines', 'zeroCost']));
      // An adjustment posts ADJUST_PLUS or ADJUST_MINUS by each line's direction.
      expect(db.callOf('ledger')?.sql).toContain(
        "CASE WHEN keyed.line_direction > 0 THEN 'ADJUST_PLUS' ELSE 'ADJUST_MINUS' END AS line_txn_type",
      );
    });

    it("lets an issue take its reason's single issue type, else ADJUST_MINUS", async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(ISSUE));

      const sql = db.callOf('ledger')?.sql ?? '';
      expect(sql).toContain('cardinality(keyed.reason_txn_types) = 1');
      expect(sql).toContain("ELSE 'ADJUST_MINUS' END AS line_txn_type");
      expect(db.callOf('ledger')?.values).toContainEqual([
        'SAMPLE_ISSUE',
        'GIFT_ISSUE',
        'ADJUST_MINUS',
      ]);
    });

    it('signs any other by-reason document with its own plus and minus types', async () => {
      const db = makeTx({ lockHeader: header() });
      const byReason = rules({
        voucherType: 'EXPIRY_WRITEOFF',
        isInward: false,
        lineDirection: 'REASON',
        ledgerTxnTypes: ['EXPIRY_IN', 'EXPIRY_OUT'],
      });

      await postStockVoucher(db.tx, postParams(byReason));

      expect(db.callOf('ledger')?.sql).toContain('CASE WHEN keyed.line_direction > 0 THEN');
      expect(db.callOf('ledger')?.values).toEqual(
        expect.arrayContaining(['EXPIRY_IN', 'EXPIRY_OUT']),
      );
    });
  });

  describe('postStockVoucher — COUNT', () => {
    it('resolves lots and refuses unpriced overage, but never picks', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(PHYSICAL));

      expect(db.kinds().slice(0, 5)).toEqual([
        'lockHeader',
        'resolveLots',
        'attachLots',
        'zeroCost',
        'ledger',
      ]);
      expect(db.callOf('ledger')?.values).toEqual(
        expect.arrayContaining(['PHYSICAL_PLUS', 'PHYSICAL_MINUS']),
      );
    });

    it('nets the header totals over both directions', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(PHYSICAL));

      // netted = true, outTxnType = null.
      expect(db.callOf('headerTotals')?.values).toEqual(expect.arrayContaining([true, null]));
    });
  });

  // ── Phase 0: the pick ─────────────────────────────────────────────────────
  describe('phase 0 — picking lots for a lotless outward line', () => {
    it('reads no lots when every outward line names its own', async () => {
      const db = makeTx({ lockHeader: header(), pickLines: [] });

      await postStockVoucher(db.tx, postParams(DAMAGE));

      expect(db.kinds()).not.toContain('pickLots');
    });

    it('refuses a MANUAL item, naming the line', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [pickableLine({ svi_line_no: 3, issue_strategy: 'manual' })],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(DAMAGE)));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'This damage cannot be posted',
          errors: [
            {
              field: 'lines.3',
              code: StockErrorCode.PICK_MANUAL_LOT_REQUIRED,
              message:
                'Line 3 (Soap 100g): the issue strategy for this item is MANUAL, so the line must name the lot it issues from.',
            },
          ],
        },
      });
      expect(db.kinds()).not.toContain('pickLots');
    });

    it('refuses a line the godown holds nothing for, saying what the line stated', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [
          pickableLine({
            track_batch: true,
            track_mrp: true,
            track_sale_price: true,
            track_expiry: true,
            track_serial: true,
            track_supplier: true,
            key_batch: 'B-2604',
            key_mrp: new Prisma.Decimal(550),
            key_sp: new Prisma.Decimal('499.5'),
            key_expiry: new Date('2027-07-25T00:00:00.000Z'),
            key_serial: 'SN9',
            key_supplier: SUPPLIER_ID,
          }),
        ],
        pickLots: [],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(DAMAGE)));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'lines.1',
              code: StockErrorCode.PICK_NO_STOCK,
              message:
                'Line 1 (Soap 100g): names no lot and this godown holds no stock of the item matching what the line states ' +
                '(batch B-2604, MRP 550.00, price 499.50, expiry 2027-07-25, serial SN9, that supplier) to issue from. ' +
                'Name the lot, or receive the stock first.',
            },
          ],
        },
      });
    });

    it('says nothing about identity a tracked line left unstated (MRP and price 0 included)', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [
          pickableLine({
            track_batch: true,
            track_mrp: true,
            track_sale_price: true,
            track_expiry: true,
            track_serial: true,
            track_supplier: true,
            key_mrp: new Prisma.Decimal(0),
            key_sp: new Prisma.Decimal(-1),
          }),
        ],
        pickLots: [],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(DAMAGE)));

      expect(refusal).toMatchObject({
        body: {
          errors: [
            {
              message:
                'Line 1 (Soap 100g): names no lot and this godown holds no stock of the item to issue from. ' +
                'Name the lot, or receive the stock first.',
            },
          ],
        },
      });
    });

    it('collects every bad line into one refusal', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [
          pickableLine({ svi_line_no: 1, issue_strategy: 'MANUAL' }),
          pickableLine({ svi_line_no: 2 }),
        ],
        pickLots: [],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(DAMAGE)));

      expect(codesOf(refusal)).toEqual([
        StockErrorCode.PICK_MANUAL_LOT_REQUIRED,
        StockErrorCode.PICK_NO_STOCK,
      ]);
    });

    it.each([
      ['FEFO', 'FEFO', 'slt.slt_expiry_date ASC NULLS LAST, b.sbl_first_in_date ASC NULLS LAST'],
      [
        'no strategy at all',
        null,
        'slt.slt_expiry_date ASC NULLS LAST, b.sbl_first_in_date ASC NULLS LAST',
      ],
      ['FIFO', 'fifo', 'ORDER BY b.sbl_first_in_date ASC NULLS LAST, slt.slt_created_on ASC'],
      ['LIFO', 'LIFO', 'ORDER BY b.sbl_first_in_date DESC NULLS LAST, slt.slt_created_on DESC'],
    ])('orders the candidate lots by %s', async (_label, strategy, order) => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [pickableLine({ issue_strategy: strategy })],
        pickLots: [{ sbl_lot_id: LOT_A, available: new Prisma.Decimal(50) }],
      });

      await postStockVoucher(db.tx, postParams(DAMAGE));

      expect(db.callOf('pickLots')?.sql).toContain(order);
      expect(db.callOf('pickLots')?.values).toEqual(
        expect.arrayContaining([COMPANY_ID, BRANCH_ID, GODOWN_ID, ITEM_ID, 'GOOD']),
      );
    });

    it('splits a line across lots in strategy order, free quantity first, the last lot taking the rest', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [
          pickableLine({
            svi_base_qty: new Prisma.Decimal(10),
            svi_free_base_qty: new Prisma.Decimal(2),
            svi_to_base_factor: new Prisma.Decimal(2),
          }),
        ],
        pickLots: [
          { sbl_lot_id: LOT_A, available: new Prisma.Decimal(5) },
          { sbl_lot_id: LOT_B, available: new Prisma.Decimal(4) },
          { sbl_lot_id: LOT_C, available: new Prisma.Decimal(2) },
        ],
      });

      await postStockVoucher(db.tx, postParams(DAMAGE));

      // 12 needed: 5 from A (2 of them free), 4 from B, the last lot takes 3 though it
      // holds 2 — the negative-stock policy rules on that. Quantities are base ÷ factor.
      const update = db.callOf('pickUpdate');
      expect(decimalsOf(update)).toEqual(['1.5', '3', '1', '2']);
      expect(update?.values).toEqual(expect.arrayContaining([LOT_A, LINE_ID, ACC_YEAR]));
      const inserts = db.callsOf('pickInsert');
      expect(inserts).toHaveLength(2);
      expect(decimalsOf(inserts[0])).toEqual(['2', '4', '0', '0']);
      expect(inserts[0].values).toEqual(expect.arrayContaining([2, 'FEFO', LOT_B]));
      expect(decimalsOf(inserts[1])).toEqual(['1.5', '3', '0', '0']);
      expect(inserts[1].values).toEqual(expect.arrayContaining([3, LOT_C]));
    });

    it('stops at the first lot that covers the line, and treats a zero factor as 1', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [
          pickableLine({
            svi_base_qty: new Prisma.Decimal(3),
            svi_to_base_factor: new Prisma.Decimal(0),
          }),
        ],
        pickLots: [
          { sbl_lot_id: LOT_A, available: new Prisma.Decimal(5) },
          { sbl_lot_id: LOT_B, available: new Prisma.Decimal(9) },
        ],
      });

      await postStockVoucher(db.tx, postParams(DAMAGE));

      expect(decimalsOf(db.callOf('pickUpdate'))).toEqual(['3', '3', '0', '0']);
      expect(db.callsOf('pickInsert')).toHaveLength(0);
    });

    it('passes over a lot that shows nothing available', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [pickableLine({ svi_base_qty: new Prisma.Decimal(4) })],
        pickLots: [
          { sbl_lot_id: LOT_A, available: new Prisma.Decimal(0) },
          { sbl_lot_id: LOT_B, available: new Prisma.Decimal(9) },
        ],
      });

      await postStockVoucher(db.tx, postParams(DAMAGE));

      expect(db.callOf('pickUpdate')?.values).toContain(LOT_B);
      expect(db.callsOf('pickInsert')).toHaveLength(0);
    });

    it('stamps the picked rows as the actor, or nobody', async () => {
      const db = makeTx({
        lockHeader: header(),
        pickLines: [pickableLine()],
        pickLots: [{ sbl_lot_id: LOT_A, available: new Prisma.Decimal(50) }],
      });

      await postStockVoucher(db.tx, postParams(DAMAGE, { actor: DEFAULT_ACTOR }));

      expect(db.callOf('pickUpdate')?.values).toContain(null);
      expect(db.callOf('pickUpdate')?.values).not.toContain(DEFAULT_ACTOR);
    });
  });

  // ── Phase 2b: the zero-cost inward refusal ────────────────────────────────
  describe('phase 2b — an inward valued at nothing', () => {
    it('refuses every unpriced inward line, naming the split', async () => {
      const db = makeTx({
        lockHeader: header(),
        zeroCost: [
          { svi_line_no: 2, svi_split_no: 1, item_name: 'Soap 100g' },
          { svi_line_no: 4, svi_split_no: 2, item_name: 'Rice 5kg' },
        ],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(OPENING)));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'This opening stock cannot be posted',
          errors: [
            {
              field: 'lines.2',
              code: StockErrorCode.LINE_COST_UNRESOLVED,
              message:
                'Line 2 (Soap 100g): brings stock in at a cost of 0 — the rate source resolved nothing. Set a cost on the line or a rate source the engine can derive one from.',
            },
            {
              field: 'lines.4',
              code: StockErrorCode.LINE_COST_UNRESOLVED,
              message:
                'Line 4 split 2 (Rice 5kg): brings stock in at a cost of 0 — the rate source resolved nothing. Set a cost on the line or a rate source the engine can derive one from.',
            },
          ],
        },
      });
      expect(db.kinds()).not.toContain('ledger');
    });
  });

  // ── BUCKET_MOVE ───────────────────────────────────────────────────────────
  describe('postStockVoucher — BUCKET_MOVE', () => {
    it('refuses a move line that names no lot', async () => {
      const db = makeTx({ lockHeader: header(), lotless: [{ svi_line_no: 2 }] });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(MOVE)));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'This stock move cannot be moved',
          errors: [
            {
              field: 'lines.2',
              code: StockErrorCode.LINE_LOT_REQUIRED,
              message:
                'Line 2 names no lot — a stock move moves one lot from one bucket to another; pick it from the balance.',
            },
          ],
        },
      });
    });

    it('writes the out and in halves without picking or opening lots, and totals what left', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(MOVE));

      expect(db.kinds().slice(0, 4)).toEqual(['lockHeader', 'lotless', 'attachLots', 'zeroCost']);
      expect(db.kinds()).not.toContain('pickLines');
      expect(db.kinds()).not.toContain('resolveLots');
      expect(db.callOf('ledger')?.sql).toContain("'BUCKET_OUT'::text");
      expect(db.callOf('ledger')?.sql).toContain("'BUCKET_IN'::text");
      // A move carries what LEFT the source, as a magnitude.
      expect(db.callOf('headerTotals')?.values).toEqual(
        expect.arrayContaining([false, 'BUCKET_OUT']),
      );
      expect(BUCKET_MOVE_TXN_TYPES).toEqual(['BUCKET_OUT', 'BUCKET_IN']);
    });
  });

  // ── TRANSFER_OUT ──────────────────────────────────────────────────────────
  describe('postStockVoucher — TRANSFER_OUT', () => {
    it('refuses a despatch line that names no lot', async () => {
      const db = makeTx({ lockHeader: header(), lotless: [{ svi_line_no: 1 }] });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(TRANSFER_OUT)));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'This stock transfer cannot be despatched',
          errors: [
            {
              code: StockErrorCode.LINE_LOT_REQUIRED,
              message:
                'Line 1 names no lot — a transfer moves existing stock; pick it from the balance.',
            },
          ],
        },
      });
    });

    it('refuses an inter-branch despatch that names no destination godown', async () => {
      const db = makeTx({
        lockHeader: header({ to_branch_id: OTHER_BRANCH_ID, to_godown_id: null }),
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(TRANSFER_OUT)));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'This stock transfer cannot be despatched',
          errors: [
            {
              field: 'toGodownId',
              code: StockErrorCode.TO_GODOWN_REQUIRED,
              message: 'An inter-branch transfer must name the destination godown.',
            },
          ],
        },
      });
    });

    it('puts an inter-branch despatch on the lorry: transit rows, inbound quantity, IN_TRANSIT', async () => {
      const db = makeTx({
        lockHeader: header({ to_branch_id: OTHER_BRANCH_ID, to_godown_id: TO_GODOWN_ID }),
        ledger: 2,
        transitInsert: 2,
      });

      await expect(postStockVoucher(db.tx, postParams(TRANSFER_OUT))).resolves.toEqual({
        rowsPosted: 2,
        status: 'IN_TRANSIT',
        transitRows: 2,
        closedOut: null,
      });
      expect(db.kinds()).toEqual([
        'lockHeader',
        'lotless',
        'attachLots',
        'ledger',
        'transitInsert',
        'lockItems',
        'ensureBalances',
        'lockItems',
        'transitIn',
        ...APPLY_PHASES,
        'freeStock',
        'headerTotals',
      ]);
      // Transit is keyed on the despatch itself.
      expect(db.callOf('ensureBalances')?.values).toEqual(
        expect.arrayContaining([SVH_ID, ACC_YEAR]),
      );
      expect(db.raw.stockVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ svhStatus: 'IN_TRANSIT' }) as object,
        }),
      );
    });

    it('posts a same-branch despatch whole, out and in at one cost, with no transit', async () => {
      const db = makeTx({ lockHeader: header({ to_branch_id: BRANCH_ID }) });

      await expect(postStockVoucher(db.tx, postParams(TRANSFER_OUT))).resolves.toMatchObject({
        status: 'POSTED',
        transitRows: 0,
      });
      expect(db.kinds()).not.toContain('transitInsert');
      expect(db.callOf('ledger')?.sql).toContain("'TRANSFER_OUT'::text");
      expect(db.callOf('ledger')?.sql).toContain("'TRANSFER_IN'::text");
      expect(db.callOf('headerTotals')?.values).toEqual(
        expect.arrayContaining([false, 'TRANSFER_OUT']),
      );
    });

    it('holds a transfer to BLOCK whatever the item policy says', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(TRANSFER_OUT));

      // ledgerRowsOf binds reversal=false; forceBlock is bound twice, true.
      expect(db.callOf('negative')?.values.filter((v) => v === true)).toHaveLength(2);
    });
  });

  // ── TRANSFER_IN ───────────────────────────────────────────────────────────
  describe('postStockVoucher — TRANSFER_IN', () => {
    const receipt = (overrides: Record<string, unknown> = {}) =>
      header({
        refno: 'TRI/0004',
        voucher_type: 'TRANSFER_IN',
        link_src_doc_id: OUT_ID,
        link_src_acc_year: `${ACC_YEAR} `,
        ...overrides,
      });
    const despatch = (overrides: Record<string, unknown> = {}) => [
      {
        svh_status: 'IN_TRANSIT',
        svh_refno: 'TRF/0009',
        svh_is_deleted: false,
        svh_to_branch_id: BRANCH_ID,
        ...overrides,
      },
    ];

    it('refuses a receipt that names no despatch', async () => {
      const db = makeTx({ lockHeader: receipt({ link_src_doc_id: null }) });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(TRANSFER_IN)));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Receipt links no transfer',
          errors: [
            {
              field: 'linkSrcDocId',
              code: StockErrorCode.RECEIPT_NO_TRANSFER,
              message:
                'TRI/0004 names no despatch. A receipt cannot be posted without the transfer it is against.',
            },
          ],
        },
      });
    });

    it.each([
      [
        'a despatch that does not exist',
        [],
        StockErrorCode.TRANSFER_NOT_FOUND,
        'TRI/0004 answers a despatch that does not exist.',
      ],
      [
        'a deleted despatch',
        despatch({ svh_is_deleted: true }),
        StockErrorCode.TRANSFER_DELETED,
        'TRF/0009 has been deleted by the sending branch. Nothing can be received against it.',
      ],
      [
        'a despatch to another branch',
        despatch({ svh_to_branch_id: OTHER_BRANCH_ID }),
        StockErrorCode.TRANSFER_OTHER_BRANCH,
        'TRF/0009 was sent to another branch. A transfer can only be received where it was addressed.',
      ],
      [
        'a despatch already received in full',
        despatch({ svh_status: 'RECEIVED' }),
        StockErrorCode.TRANSFER_NOT_IN_TRANSIT,
        'TRF/0009 has already been received in full.',
      ],
      [
        'a despatch that never left',
        despatch({ svh_status: 'POSTED' }),
        StockErrorCode.TRANSFER_NOT_IN_TRANSIT,
        'TRF/0009 is POSTED; only a despatched transfer can be received.',
      ],
    ])('refuses %s with a 409', async (_label, out, code, message) => {
      const db = makeTx({ lockHeader: receipt(), despatchLock: out });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(TRANSFER_IN)));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ code, message }] } });
      expect(db.kinds()).not.toContain('claims');
    });

    it('locks the despatch in its own year, trimmed', async () => {
      const db = makeTx({ lockHeader: receipt(), despatchLock: despatch() });

      await postStockVoucher(db.tx, postParams(TRANSFER_IN));

      expect(db.callOf('despatchLock')?.values).toEqual([OUT_ID, ACC_YEAR]);
    });

    it("falls back to the receipt's own year when the link names none", async () => {
      const db = makeTx({
        lockHeader: receipt({ link_src_acc_year: null }),
        despatchLock: despatch(),
      });

      await postStockVoucher(db.tx, postParams(TRANSFER_IN, { accYear: '2025-2026' }));

      expect(db.callOf('despatchLock')?.values).toEqual([OUT_ID, '2025-2026']);
    });

    it('refuses every bad line in one 422, an over-claim once per transit row', async () => {
      const db = makeTx({
        lockHeader: receipt(),
        despatchLock: despatch(),
        claims: [
          {
            svi_line_no: 1,
            stt_id: null,
            matches: 0n,
            claimed: new Prisma.Decimal(1),
            remaining: null,
          },
          {
            svi_line_no: 2,
            stt_id: 'stt-2',
            matches: 2n,
            claimed: new Prisma.Decimal(1),
            remaining: new Prisma.Decimal(9),
          },
          {
            svi_line_no: 3,
            stt_id: STT_ID,
            matches: 1n,
            claimed: new Prisma.Decimal(28),
            remaining: new Prisma.Decimal(25),
          },
          {
            svi_line_no: 4,
            stt_id: STT_ID,
            matches: 1n,
            claimed: new Prisma.Decimal(28),
            remaining: new Prisma.Decimal(25),
          },
          {
            svi_line_no: 5,
            stt_id: 'stt-5',
            matches: 1n,
            claimed: new Prisma.Decimal(2),
            remaining: null,
          },
        ],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(TRANSFER_IN)));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'This transfer receipt cannot be posted',
          errors: [
            {
              field: 'lines.1',
              code: StockErrorCode.RECEIPT_NOT_IN_TRANSIT,
              message: 'Line 1: nothing of this lot is in transit to this godown.',
            },
            {
              field: 'lines.2',
              code: StockErrorCode.RECEIPT_BUCKET_AMBIGUOUS,
              message:
                'Line 2: this item and lot were shipped in more than one bucket, and the receipt cannot tell them apart. The sender must ship them as separate transfers.',
            },
            {
              field: 'lines.3',
              code: StockErrorCode.RECEIPT_OVER_REMAINING,
              message:
                'Line 3 receives 28 but only 25 of that lot is still in transit. A second receipt opens with the remainder, not the original quantity.',
            },
            {
              field: 'lines.5',
              code: StockErrorCode.RECEIPT_OVER_REMAINING,
              message:
                'Line 5 receives 2 but only 0 of that lot is still in transit. A second receipt opens with the remainder, not the original quantity.',
            },
          ],
        },
      });
      expect(db.kinds()).not.toContain('ledger');
    });

    it('settles the transit rows, closes a despatch with nothing left, and refreshes its inbound quantity', async () => {
      const db = makeTx({
        lockHeader: receipt(),
        despatchLock: despatch(),
        claims: [
          {
            svi_line_no: 1,
            stt_id: STT_ID,
            matches: 1n,
            claimed: new Prisma.Decimal(25),
            remaining: new Prisma.Decimal(25),
          },
        ],
        ledger: 1,
        transitSettle: 1,
        closeOut: [{ svh_id: OUT_ID, svh_acc_year: `${ACC_YEAR} `, svh_refno: 'TRF/0009' }],
      });

      await expect(postStockVoucher(db.tx, postParams(TRANSFER_IN))).resolves.toEqual({
        rowsPosted: 1,
        status: 'POSTED',
        transitRows: 1,
        closedOut: { svhId: OUT_ID, accYear: ACC_YEAR, refno: 'TRF/0009' },
      });
      expect(db.kinds()).toEqual([
        'lockHeader',
        'despatchLock',
        'claims',
        'attachLots',
        'ledger',
        'transitSettle',
        'closeOut',
        'lockItems',
        'transitIn',
        ...APPLY_PHASES,
        'freeStock',
        'headerTotals',
      ]);
      // The inbound quantity refreshed is the despatch's, not the receipt's.
      expect(db.callOf('transitIn')?.values).toEqual(expect.arrayContaining([OUT_ID, ACC_YEAR]));
      expect(db.callOf('transitSettle')?.values).toEqual(
        expect.arrayContaining([OUT_ID, SVH_ID, POSTED_ON, USER_ID]),
      );
    });

    it('keeps a short despatch open', async () => {
      const db = makeTx({
        lockHeader: receipt(),
        despatchLock: despatch(),
        claims: [],
        closeOut: [],
      });

      await expect(postStockVoucher(db.tx, postParams(TRANSFER_IN))).resolves.toMatchObject({
        closedOut: null,
      });
    });
  });

  // ── Phase 6: the negative-stock policy ────────────────────────────────────
  describe('phase 6 — the negative-stock policy', () => {
    it('lets a WARN holding through and logs it', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const db = makeTx({
        lockHeader: header(),
        negative: [
          {
            itemName: 'Soap 100g',
            batchNo: null,
            godownName: null,
            onHand: '-3',
            allowNegative: 'WARN',
          },
        ],
      });

      await expect(postStockVoucher(db.tx, postParams(DAMAGE))).resolves.toMatchObject({
        status: 'POSTED',
      });
      expect(warn).toHaveBeenCalledWith(
        `Damage ${SVH_ID}: negative stock allowed under WARN — Soap 100g: stock would go negative (-3 on hand) in this godown`,
      );
    });

    it('refuses every BLOCK holding in one 409', async () => {
      const db = makeTx({
        lockHeader: header(),
        negative: [
          {
            itemName: 'Rice 5kg',
            batchNo: 'R-1',
            godownName: 'Main',
            onHand: '-2',
            allowNegative: 'BLOCK',
          },
          {
            itemName: 'Soap 100g',
            batchNo: null,
            godownName: null,
            onHand: '-1',
            allowNegative: 'WARN',
          },
        ],
      });

      const refusal = await refusalOf(postStockVoucher(db.tx, postParams(DAMAGE)));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'This damage would drive stock negative — policy is BLOCK',
          errors: [
            {
              field: 'lines',
              code: StockErrorCode.NEGATIVE_BLOCKED,
              message:
                'Rice 5kg batch R-1: stock would go negative (-2 on hand) in Main — policy is BLOCK',
            },
          ],
        },
      });
      expect(db.raw.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('forces BLOCK for a rule that blocks negative stock', async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(rules({ blockNegative: true })));

      expect(db.callOf('negative')?.values.filter((v) => v === true)).toHaveLength(2);
    });

    it("leaves an ordinary document to the item's own policy", async () => {
      const db = makeTx({ lockHeader: header() });

      await postStockVoucher(db.tx, postParams(OPENING));

      expect(db.callOf('negative')?.values.filter((v) => v === true)).toHaveLength(0);
    });
  });

  // ── recall (notes 160 B) ──────────────────────────────────────────────────
  describe('recallTransferOut', () => {
    const inTransit = () =>
      header({
        status: 'IN_TRANSIT',
        refno: 'TRF/2026-2027/D1/00017',
        voucher_type: 'TRANSFER_OUT',
        to_branch_id: OTHER_BRANCH_ID,
        to_godown_id: TO_GODOWN_ID,
      });
    const untouchedRow = () => ({
      stt_status: 'IN_TRANSIT',
      stt_received_qty: new Prisma.Decimal(0),
      stt_damage_qty: new Prisma.Decimal(0),
    });

    it('reverses the OUT rows, closes the transit rows, refreshes the inbound figure, CANCELLED', async () => {
      const db = makeTx({
        lockHeader: inTransit(),
        recallReceiver: [{ br_name: 'Counter2' }],
        recallTransit: [untouchedRow(), untouchedRow()],
        reversal: 2,
        transitCancel: 2,
      });

      await expect(recallTransferOut(db.tx, cancelParams(TRANSFER_OUT))).resolves.toEqual({
        rowsReversed: 2,
        transitRowsClosed: 2,
      });

      expect(db.kinds()).toEqual([
        'lockHeader',
        'recallReceiver',
        'recallTransit',
        'recallReceipt',
        'reversal',
        ...APPLY_PHASES,
        'transitCancel',
        'lockItems',
        'transitIn',
        'headerTotals',
      ]);
      // The apply phases run over the mirrors only, as a cancel's.
      expect(db.callOf('balances')?.values.slice(0, 3)).toEqual([SVH_ID, ACC_YEAR, true]);
      expect(db.callOf('transitCancel')?.values).toEqual(
        expect.arrayContaining(['Recalled: Keyed against the wrong godown', SVH_ID, ACC_YEAR]),
      );
      expect(db.raw.stockVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ svhStatus: 'CANCELLED' }) }),
      );
    });

    it('refuses 409 STOCK_TRANSFER_RECALL_RECEIVED when a receipt — a draft one too — names it', async () => {
      const db = makeTx({
        lockHeader: inTransit(),
        recallReceiver: [{ br_name: 'Counter2' }],
        recallTransit: [untouchedRow()],
        recallReceipt: [{ svh_refno: 'TRI/2026-2027/D3/00004', svh_status: 'DRAFT' }],
      });

      const refusal = await refusalOf(recallTransferOut(db.tx, cancelParams(TRANSFER_OUT)));

      expect(refusal.status).toBe(409);
      expect(refusal.body).toMatchObject({
        errors: [
          {
            code: StockErrorCode.TRANSFER_RECALL_RECEIVED,
            message: expect.stringContaining('Counter2 has already keyed a receipt against it'),
          },
        ],
      });
      expect(db.kinds()).not.toContain('reversal');
      expect(db.raw.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('refuses the same when a transit row has anything received or damaged', async () => {
      const db = makeTx({
        lockHeader: inTransit(),
        recallReceiver: [{ br_name: 'Counter2' }],
        recallTransit: [
          untouchedRow(),
          { ...untouchedRow(), stt_status: 'PARTIAL', stt_damage_qty: new Prisma.Decimal(1) },
        ],
      });

      const refusal = await refusalOf(recallTransferOut(db.tx, cancelParams(TRANSFER_OUT)));

      expect(codesOf(refusal)).toEqual([StockErrorCode.TRANSFER_RECALL_RECEIVED]);
      expect(db.kinds()).not.toContain('reversal');
    });

    it('re-reads the status under the lock: a despatch received meanwhile is refused', async () => {
      const db = makeTx({ lockHeader: header({ status: 'RECEIVED', voucher_type: 'TRANSFER_OUT' }) });

      const refusal = await refusalOf(recallTransferOut(db.tx, cancelParams(TRANSFER_OUT)));

      expect(refusal.status).toBe(409);
      expect(codesOf(refusal)).toEqual([StockErrorCode.VOUCHER_STATUS_CHANGED]);
      expect(db.kinds()).toEqual(['lockHeader']);
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────
  describe('cancelStockVoucher', () => {
    it('mirrors the ledger, re-derives over the mirrors and moves the header to CANCELLED', async () => {
      const db = makeTx({ lockHeader: header({ status: 'POSTED' }), reversal: 3 });

      await expect(cancelStockVoucher(db.tx, cancelParams(OPENING))).resolves.toBe(3);

      expect(db.kinds()).toEqual(['lockHeader', 'reversal', ...APPLY_PHASES, 'headerTotals']);
      expect(db.callOf('reversal')?.values).toEqual(
        expect.arrayContaining([
          POSTED_ON,
          'Keyed against the wrong godown',
          USER_ID,
          SVH_ID,
          ACC_YEAR,
        ]),
      );
      // Phases 4–7 run over the reversal rows only.
      expect(db.callOf('balances')?.values.slice(0, 3)).toEqual([SVH_ID, ACC_YEAR, true]);
      expect(db.raw.stockVoucher.update).toHaveBeenCalledWith({
        where: { svhId_svhAccYear: { svhId: SVH_ID, svhAccYear: ACC_YEAR } },
        data: {
          svhStatus: 'CANCELLED',
          svhVersionNo: { increment: 1 },
          svhModifiedOn: POSTED_ON,
          svhModifiedBy: USER_ID,
        },
      });
    });

    it('never forces BLOCK on a cancel that does not ask for it (a sales shadow), a transfer included', async () => {
      const db = makeTx({
        transferGuard: [{ status: 'POSTED', refno: 'TRF/0001' }],
        lockHeader: header({ status: 'POSTED' }),
      });

      await cancelStockVoucher(db.tx, cancelParams(TRANSFER_OUT));

      // Only the reversal flag of ledgerRowsOf is true.
      expect(db.callOf('negative')?.values.filter((v) => v === true)).toHaveLength(1);
    });

    it('forces BLOCK on a stock voucher cancel, whatever the policy (notes 143 #4)', async () => {
      const db = makeTx({
        lockHeader: header({ status: 'POSTED' }),
        negative: [
          {
            itemName: 'Milk 500ml',
            batchNo: null,
            godownName: 'Main',
            onHand: '-8',
            allowNegative: 'BLOCK',
          },
        ],
      });

      const refusal = await refusalOf(
        cancelStockVoucher(db.tx, cancelParams(OPENING, { refuseNegative: true })),
      );

      // The reversal flag of ledgerRowsOf, then forceBlock in the CASE and the WHERE.
      expect(db.callOf('negative')?.values.filter((v) => v === true)).toHaveLength(3);
      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Cancelling this opening stock would drive stock negative',
          errors: [
            {
              field: 'lines',
              code: StockErrorCode.CANCEL_WOULD_GO_NEGATIVE,
              message:
                'Milk 500ml: stock would go negative (-8 on hand) in Main — stock it brought in has moved out since. Adjust it first, then cancel.',
            },
          ],
        },
      });
      expect(db.raw.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('refuses a voucher that is not POSTED, and one that is gone', async () => {
      const draft = makeTx({ lockHeader: header() });
      const gone = makeTx({ lockHeader: [] });

      const notPosted = await refusalOf(cancelStockVoucher(draft.tx, cancelParams(OPENING)));
      const missing = await refusalOf(cancelStockVoucher(gone.tx, cancelParams(OPENING)));

      expect(notPosted).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              code: StockErrorCode.VOUCHER_STATUS_CHANGED,
              message:
                'OPN/0001 is DRAFT, not POSTED: it changed while this request was waiting. Reload it and decide again.',
            },
          ],
        },
      });
      expect(missing).toMatchObject({
        body: {
          errors: [
            {
              code: StockErrorCode.VOUCHER_NOT_FOUND,
              message: `${SVH_ID} no longer exists in ${ACC_YEAR}, so there is nothing to cancel.`,
            },
          ],
        },
      });
      expect(draft.kinds()).not.toContain('reversal');
    });

    it('asks a plain document nothing about transfers', async () => {
      const db = makeTx({ lockHeader: header({ status: 'POSTED' }) });

      await cancelStockVoucher(db.tx, cancelParams(OPENING));

      expect(db.kinds()).not.toContain('transferGuard');
    });

    it.each(['IN_TRANSIT', 'RECEIVED'])(
      'refuses a %s despatch before taking the header lock',
      async (status) => {
        const db = makeTx({ transferGuard: [{ status, refno: 'TRF/0001' }] });

        const refusal = await refusalOf(cancelStockVoucher(db.tx, cancelParams(TRANSFER_OUT)));

        expect(refusal).toEqual({
          status: 409,
          body: {
            success: false,
            message: `Stock transfer is ${status}`,
            errors: [
              {
                field: 'svhId',
                code: StockErrorCode.TRANSFER_NOT_CANCELLABLE,
                message: `TRF/0001 is ${status}: goods that left cannot be cancelled on paper. Receive what arrived and transfer it back, or short-settle what never arrived.`,
              },
            ],
          },
        });
        expect(db.kinds()).toEqual(['transferGuard']);
      },
    );

    it('refuses to cancel a POSTED receipt', async () => {
      const db = makeTx({ transferGuard: [{ status: 'POSTED', refno: 'TRI/0004' }] });

      const refusal = await refusalOf(cancelStockVoucher(db.tx, cancelParams(TRANSFER_IN)));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Transfer receipt is POSTED',
          errors: [
            {
              code: StockErrorCode.RECEIPT_NOT_CANCELLABLE,
              message:
                'TRI/0004 has been received: un-receiving is a reverse transfer back to the sender, not a cancellation.',
            },
          ],
        },
      });
    });

    it('cancels a same-branch POSTED transfer like any other document', async () => {
      const db = makeTx({
        transferGuard: [{ status: 'POSTED', refno: 'TRF/0001' }],
        lockHeader: header({ status: 'POSTED' }),
        reversal: 2,
      });

      await expect(cancelStockVoucher(db.tx, cancelParams(TRANSFER_OUT))).resolves.toBe(2);
    });

    it('leaves a vanished transfer to the header lock to refuse', async () => {
      const db = makeTx({ transferGuard: [], lockHeader: [] });

      const refusal = await refusalOf(cancelStockVoucher(db.tx, cancelParams(TRANSFER_IN)));

      expect(codesOf(refusal)).toEqual([StockErrorCode.VOUCHER_NOT_FOUND]);
    });
  });

  describe('cancelDraftVoucher', () => {
    it('moves a DRAFT to CANCELLED and writes nothing else', async () => {
      const db = makeTx({ lockHeader: header() });

      await expect(
        cancelDraftVoucher(db.tx, cancelParams(PHYSICAL, { actor: DEFAULT_ACTOR })),
      ).resolves.toBe(0);

      expect(db.kinds()).toEqual(['lockHeader']);
      expect(db.raw.stockVoucher.update).toHaveBeenCalledWith({
        where: { svhId_svhAccYear: { svhId: SVH_ID, svhAccYear: ACC_YEAR } },
        data: {
          svhStatus: 'CANCELLED',
          svhVersionNo: { increment: 1 },
          svhModifiedOn: POSTED_ON,
          svhModifiedBy: null,
        },
      });
    });

    it('refuses a voucher that is no longer a draft', async () => {
      const db = makeTx({ lockHeader: header({ status: 'POSTED' }) });

      const refusal = await refusalOf(cancelDraftVoucher(db.tx, cancelParams(PHYSICAL)));

      expect(codesOf(refusal)).toEqual([StockErrorCode.VOUCHER_STATUS_CHANGED]);
      expect(db.raw.stockVoucher.update).not.toHaveBeenCalled();
    });
  });

  // ── short-settle ──────────────────────────────────────────────────────────
  describe('settleTransitShort', () => {
    const settle = {
      outId: OUT_ID,
      outAccYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      reasonId: REASON_ID,
      remarks: 'Two cartons lost in transit',
      actor: USER_ID,
      settledOn: POSTED_ON,
    };
    const out = (overrides: Record<string, unknown> = {}) => [
      {
        svh_status: 'IN_TRANSIT',
        svh_refno: 'TRF/0009',
        svh_is_deleted: false,
        svh_voucher_type: 'TRANSFER_OUT',
        ...overrides,
      },
    ];

    it.each([
      ['a despatch that does not exist', []],
      ['a deleted despatch', out({ svh_is_deleted: true })],
      ['a voucher that is not a despatch', out({ svh_voucher_type: 'TRANSFER_IN' })],
    ])('refuses %s', async (_label, row) => {
      const db = makeTx({ shortHeader: row });

      const refusal = await refusalOf(settleTransitShort(db.tx, settle));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Transfer not found',
          errors: [
            {
              field: 'outVoucherId',
              code: StockErrorCode.TRANSFER_NOT_FOUND,
              message: `No live TRANSFER_OUT ${OUT_ID} in ${ACC_YEAR} for this branch.`,
            },
          ],
        },
      });
    });

    it.each([
      ['RECEIVED', 'TRF/0009 is already closed: nothing is short.'],
      ['POSTED', 'TRF/0009 is POSTED; only a despatched transfer can be short-settled.'],
    ])('refuses a despatch that is %s', async (status, message) => {
      const db = makeTx({ shortHeader: out({ svh_status: status }) });

      const refusal = await refusalOf(settleTransitShort(db.tx, settle));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: `Transfer is ${status}`,
          errors: [{ code: StockErrorCode.TRANSFER_NOT_IN_TRANSIT, message }],
        },
      });
    });

    it('refuses while a transit row has had nothing received against it', async () => {
      const db = makeTx({ shortHeader: out(), untouched: [{ n: 1n }] });

      const refusal = await refusalOf(settleTransitShort(db.tx, settle));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: StockErrorCode.TRANSFER_NOTHING_RECEIVED }] },
      });
      expect(db.kinds()).not.toContain('shortRows');
    });

    it('closes the despatch, keeps the short, and values it at the transit cost', async () => {
      const db = makeTx({
        shortHeader: out(),
        untouched: [{ n: 0n }],
        shortRows: [
          {
            stt_id: STT_ID,
            stt_item_id: ITEM_ID,
            stt_lot_id: LOT_A,
            stt_to_godown_id: TO_GODOWN_ID,
            stt_bucket: 'GOOD',
            short_qty: new Prisma.Decimal(3),
            stt_cost_rate: new Prisma.Decimal('12.345'),
          },
        ],
      });

      const result = await settleTransitShort(db.tx, settle);

      expect(result.refno).toBe('TRF/0009');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        sttId: STT_ID,
        itemId: ITEM_ID,
        lotId: LOT_A,
        toGodownId: TO_GODOWN_ID,
        bucket: 'GOOD',
      });
      expect(result.rows[0].shortQty.toString()).toBe('3');
      expect(result.rows[0].costRate.toString()).toBe('12.345');
      expect(result.rows[0].shortValue.toString()).toBe('37.04');
      expect(db.kinds()).toEqual([
        'shortHeader',
        'untouched',
        'shortRows',
        'shortClose',
        'lockItems',
        'transitIn',
      ]);
      expect(db.callOf('shortClose')?.values).toEqual(
        expect.arrayContaining([REASON_ID, POSTED_ON, USER_ID, OUT_ID, ACC_YEAR]),
      );
      expect(db.callOf('shortRows')?.values).toContain('Two cartons lost in transit');
    });

    it('treats a missing count as nothing untouched', async () => {
      const db = makeTx({ shortHeader: out(), untouched: [], shortRows: [] });

      await expect(settleTransitShort(db.tx, settle)).resolves.toEqual({
        refno: 'TRF/0009',
        rows: [],
      });
    });
  });

  // ── the holding writers ───────────────────────────────────────────────────
  describe('the holding writers', () => {
    it('ensureBalanceRows locks the items, then opens a zero row per holding', async () => {
      const db = makeTx();

      await ensureBalanceRows(db.tx, transitHoldingsOf(OUT_ID, ACC_YEAR), DEFAULT_ACTOR);

      expect(db.kinds()).toEqual(['lockItems', 'ensureBalances']);
      expect(db.callOf('ensureBalances')?.sql).toContain('DO NOTHING');
      // The nil actor lands as NULL; the holdings are the despatch's transit rows.
      expect(db.callOf('ensureBalances')?.values).toEqual([null, OUT_ID, ACC_YEAR]);
    });

    it('refreshReserved recomputes the reserved quantity and reports the rows written', async () => {
      const db = makeTx({ reserved: 4 });

      await expect(
        refreshReserved(db.tx, reservationHoldingsOf('SALE_ORDER', SVH_ID), USER_ID, POSTED_ON),
      ).resolves.toBe(4);

      expect(db.kinds()).toEqual(['lockItems', 'reserved']);
      expect(db.callOf('reserved')?.values).toEqual(
        expect.arrayContaining([POSTED_ON, USER_ID, 'SALE_ORDER', SVH_ID]),
      );
    });

    it('refreshTransitIn recomputes the inbound quantity and reports the rows written', async () => {
      const db = makeTx({ transitIn: 2 });

      await expect(
        refreshTransitIn(db.tx, transitHoldingsOf(OUT_ID, ACC_YEAR), USER_ID, POSTED_ON),
      ).resolves.toBe(2);
      expect(db.kinds()).toEqual(['lockItems', 'transitIn']);
    });

    it('openReservationHoldings scopes to a company, or every company', () => {
      expect(openReservationHoldings(COMPANY_ID).values).toEqual([COMPANY_ID, COMPANY_ID]);
      expect(openReservationHoldings().values).toEqual([null, null]);
      expect(openReservationHoldings(null).values).toEqual([null, null]);
    });
  });

  // ── the scope rebuild ─────────────────────────────────────────────────────
  describe('rebuildStockDerivedFigures', () => {
    it('re-derives every figure in engine order and reports the rows written per phase', async () => {
      const db = makeTx({ balances: 3, lotCosts: 1, itemCosts: 2, stamp: 4, lotTotals: 5 });

      await expect(
        rebuildStockDerivedFigures(
          db.tx,
          { companyId: COMPANY_ID, itemId: ITEM_ID },
          USER_ID,
          POSTED_ON,
        ),
      ).resolves.toEqual({ balances: 3, lotRates: 1, itemCosts: 2, stamps: 4, lotTotals: 5 });

      expect(db.kinds()).toEqual([
        'lockItems',
        'balances',
        'lotCosts',
        'itemCosts',
        'stamp',
        'lotTotals',
      ]);
      // (company, branch, item), each bound twice: the scope narrows only what it names.
      expect(db.callOf('lockItems')?.values).toEqual([
        COMPANY_ID,
        COMPANY_ID,
        null,
        null,
        ITEM_ID,
        ITEM_ID,
      ]);
    });

    it('covers everything for an empty scope', async () => {
      const db = makeTx();

      await rebuildStockDerivedFigures(db.tx, {}, USER_ID, POSTED_ON);

      expect(db.callOf('lockItems')?.values).toEqual([null, null, null, null, null, null]);
    });
  });

  // ── the price bucket ──────────────────────────────────────────────────────
  describe('the price bucket', () => {
    it('keeps only the dimensions the policy tracks, and only positive values', () => {
      expect(bucketKeyFor(null, { mrp: 550, salePrice: 499 })).toEqual({
        mrp: null,
        salePrice: null,
      });
      expect(
        bucketKeyFor({ trackMrp: true, trackSalePrice: false }, { mrp: 550, salePrice: 499 }),
      ).toEqual({ mrp: 550, salePrice: null });
      expect(
        bucketKeyFor({ trackMrp: true, trackSalePrice: true }, { mrp: 0, salePrice: 499 }),
      ).toEqual({ mrp: null, salePrice: 499 });
    });

    it('states the same rule in SQL for a grid', () => {
      const sql = bucketKeySql({
        trackMrp: Prisma.raw('p.track_mrp'),
        trackSalePrice: Prisma.raw('p.track_sp'),
        mrp: Prisma.raw('ipm.mrp'),
        salePrice: Prisma.raw('ipm.sp'),
      });

      expect(sql.mrp.sql).toBe('CASE WHEN p.track_mrp AND ipm.mrp > 0 THEN ipm.mrp END');
      expect(sql.salePrice.sql).toBe('CASE WHEN p.track_sp AND ipm.sp > 0 THEN ipm.sp END');
    });

    it('asks the database nothing for no scopes', async () => {
      const db = makeTx();

      await expect(readBucketTrackFlags(db.tx, [], '2026-10-21')).resolves.toEqual([]);
      expect(db.calls).toHaveLength(0);
    });

    it('answers the flags in the order asked, an item with no policy tracking nothing', async () => {
      const db = makeTx({
        bucketFlags: [{ ord: 2n, trackMrp: true, trackSalePrice: false }],
      });

      await expect(
        readBucketTrackFlags(
          db.tx,
          [
            { itemId: ITEM_ID, companyId: null, branchId: null },
            { itemId: LOT_A, companyId: COMPANY_ID, branchId: BRANCH_ID },
          ],
          '2026-10-21',
        ),
      ).resolves.toEqual([
        { trackMrp: false, trackSalePrice: false },
        { trackMrp: true, trackSalePrice: false },
      ]);
      // NULL company / branch travel as '' inside the text[] parameters.
      expect(db.callOf('bucketFlags')?.values).toEqual([
        [ITEM_ID, LOT_A],
        ['', COMPANY_ID],
        ['', BRANCH_ID],
        '2026-10-21',
      ]);
    });
  });

  // ── the shared SQL fragments ──────────────────────────────────────────────
  describe('the shared SQL fragments', () => {
    it('reads an unreversed row as forward, live and without a live mirror', () => {
      const sql = unreversedLedgerRow().sql.replace(/\s+/g, ' ');

      expect(sql).toContain('sml.sml_is_reversal = false');
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('rev.sml_reverses_id = sml.sml_id');
    });

    it('derives the lot id from its identity under the fixed namespace', () => {
      const fragment = lotIdentityUuid('c');

      expect(fragment.values).toEqual([STOCK_LOT_ID_NAMESPACE]);
      expect(fragment.sql).toContain("placing '5' from 13 for 1");
      expect(fragment.sql).toContain('c.key_supplier::text');
    });

    it('resolves the policy per line, WAVG when nothing is set', () => {
      const sql = effectivePolicyCte().sql;

      expect(sql).toContain("COALESCE(stp.stp_valuation_method, 'WAVG') AS valuation_method");
      expect(sql).toContain("COALESCE(stp.stp_issue_strategy,   'FEFO') AS issue_strategy");
      expect(lineReasonJoin().sql).toContain('COALESCE(line.svi_reason_id, line.svh_reason_id)');
    });
  });
});
