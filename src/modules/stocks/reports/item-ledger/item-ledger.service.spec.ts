import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import { AppSettingValueService } from '../../../settings/appSettings/app-setting-value.service';
import {
  EXPORT_ROW_CAP,
  ItemLedgerService,
  type AggRow,
  type PageRow,
} from './item-ledger.service';
import { ITEM_LEDGER_ERROR } from './types/item-ledger.types';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const OTHER_COMPANY = '019c997a-6346-71d2-bc7e-e3d0ece556db';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65';
const ITEM = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const GODOWN_2 = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const LOT = 'dd08de2b-18f1-575d-b653-df1765055465';
const UNIT = '01a161d8-5006-718f-a119-460512239ea9';
const BASE_UNIT = '01a0d242-5642-7876-aa92-de4698650d9f';
const WALK = '019f659c-3942-7237-89b0-c4899603dd7a';
const CUST = '01a0d242-5562-7686-b162-81ecbfa54efd';
const SHADOW = '01a1c903-2324-7f01-9451-e08e3afd1262';
const BILL = '01a1a0ea-209b-709d-83d3-d65ca8a9bafa';

const dec = (v: number | string) => new Prisma.Decimal(v);
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

// ── a fake database that routes each statement by a fragment of its SQL ────

type Answer = unknown[] | ((sql: Prisma.Sql) => unknown[]);
const ROUTES: [string, string][] = [
  ['FROM public.user_menus', 'rights'],
  ['FROM (SELECT 1) x', 'lookup'],
  ["SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d", 'today'],
  ['WITH ol AS (', 'opening'],
  ["'S'::text AS part", 'summary'],
  ['pg AS (', 'page'],
  ['AS in_scope FROM stock.stock_balance b', 'stockNow'],
  ['SELECT led_name FROM accounts.acc_ledger_master', 'walkInName'],
  ['FROM public.fiscal_years', 'fy'],
  ['SELECT COUNT(*)::int AS n FROM stock.stock_cost_revaluation', 'leftOut'],
  ['AS k, (COUNT(DISTINCT', 'period'],
  ['i.item_is_service AS is_service', 'facts'],
  ['u.iuc_to_base_factor AS factor', 'units'],
  ['srp_reorder_level', 'reorder'],
  ['FROM inventory.godown_locations WHERE gdl_branch_id', 'godowns'],
  ['WITH ll AS (', 'lots'],
  ['WITH t AS (', 'types'],
  ["v.svh_voucher_type = 'PHYSICAL'", 'lastCount'],
];

function makeDb() {
  const calls: { key: string; text: string; values: unknown[] }[] = [];
  const answers = new Map<string, Answer>();
  const $queryRaw = jest.fn(async (first: unknown, ...values: unknown[]) => {
    const sql =
      Array.isArray(first) && 'raw' in first ? Prisma.sql(first, ...values) : (first as Prisma.Sql);
    const text = flat(sql.text);
    const route = ROUTES.find(([marker]) => text.includes(marker));
    if (!route) throw new Error(`unrouted SQL: ${text.slice(0, 160)}`);
    calls.push({ key: route[1], text, values: sql.values });
    const answer = answers.get(route[1]) ?? [];
    return typeof answer === 'function' ? answer(sql) : answer;
  });
  const $executeRaw = jest.fn(async (..._args: unknown[]) => 0);
  const tx = {
    $queryRaw,
    $executeRaw,
    itemMaster: {
      findMany: jest.fn(async () => [
        { itemId: ITEM, itemDefaultTaxId: 'tax18', itemInclTax: false },
      ]),
    },
    itemTaxHistory: { findMany: jest.fn(async () => []) },
    taxRateMaster: {
      findMany: jest.fn(async () => [
        { taxId: 'tax18', taxRatePerc: dec(18), taxCessBasis: 'NONE', taxAcessBasis: 'NONE' },
      ]),
    },
  };
  const $transaction = jest.fn(
    async (work: (t: typeof tx) => Promise<unknown>, _options?: Record<string, unknown>) =>
      work(tx),
  );
  return {
    prisma: { $queryRaw, $transaction } as unknown as PrismaService,
    $transaction,
    $executeRaw,
    calls,
    answer: (key: string, rows: Answer) => answers.set(key, rows),
    of: (key: string) => calls.filter((c) => c.key === key),
  };
}

const rightsRow = (over: Record<string, boolean> = {}) => ({
  um_can_view: true,
  um_can_create: false,
  um_can_edit: false,
  um_can_delete: false,
  um_can_print: true,
  um_can_export: false,
  um_can_post: false,
  um_can_cancel: false,
  um_can_amend: false,
  um_can_override: false,
  um_can_retender: false,
  ...over,
});

const lookupRow = (over: Record<string, unknown> = {}) => ({
  br_comp_id: COMPANY,
  br_name: 'Acme Foods - Coimbatore Branch',
  comp_name: 'Amazon Retail India Private Limited',
  item_id: ITEM,
  item_code: 'ZT-A',
  item_name: 'ZT-ITEM-A',
  item_company_id: COMPANY,
  item_is_deleted: false,
  gdl_branch_id: null,
  gdl_name: null,
  slt_item_id: null,
  slt_batch_no: null,
  iuc_item_id: null,
  iuc_is_deleted: null,
  iuc_to_base_factor: null,
  iuc_is_base_unit: null,
  unit_name: null,
  base_iuc_id: BASE_UNIT,
  base_unit_name: 'PCS',
  ...over,
});

const openingRow = (over: Record<string, unknown> = {}) => ({
  q: dec(300),
  v: dec(8370),
  lots: 2,
  rv: dec(0),
  after_q: dec(0),
  ...over,
});

const agg = (over: Partial<AggRow> = {}): AggRow => ({
  part: 'S',
  rtype: null,
  cls: null,
  kind: null,
  ob: null,
  doc_no: null,
  kinds: null,
  n_all: 4,
  n_shown: 4,
  docs: 3,
  n_internal: 0,
  n_pairs: 1,
  n_reval: 0,
  q_all: dec(-12),
  v_all: dec(-334.8),
  q_in: dec(0),
  q_out: dec(12),
  v_in: dec(0),
  v_out: dec(334.8),
  moved: null,
  pair_q: null,
  ...over,
});

const pageRow = (over: Partial<PageRow> = {}): PageRow => ({
  seq: 1,
  row_id: '01a1c903-2324-7f01-9451-000000000001',
  src_kind: 'L',
  src_module: 'SALES',
  src_type: 'SALE_BILL',
  doc_id: SHADOW,
  src_year: '2026-2027',
  is_rev: false,
  internal: false,
  gtxn: 'SALE',
  rtype: 'SALE',
  kind: 'OUT',
  state: 'LIVE',
  amended: false,
  nets_zero: false,
  d: '2026-11-03',
  t_doc: '11:20 AM',
  t_post: '11:20 AM',
  posted_at: '2026-11-03T11:20:41+05:30',
  o_posted_at: null,
  r_posted_at: null,
  refno: 'bil00881',
  o_refno: null,
  sq: dec(-10),
  sv: dec(-279),
  gq: dec(10),
  gv: dec(279),
  fq: dec(0),
  moved: dec(0),
  doc_amt: dec(290),
  bq: dec(10),
  run_q: dec(-10),
  run_v: dec(-279),
  gdown: GODOWN,
  gdown_name: 'Coimbatore',
  from_godown: null,
  from_godown_name: null,
  to_godown: null,
  to_godown_name: null,
  other_godown: null,
  other_godown_name: null,
  gbucket: 'SALEABLE',
  from_bucket: null,
  to_bucket: null,
  other_bucket: null,
  lot: LOT,
  batch_no: 'BH2609A',
  expiry: '2026-11-16',
  by_login: 'VKPOS1',
  r_by_login: null,
  narration: null,
  r_narr: null,
  voucher_type: 'ISSUE',
  voucher_refno: 'SALE_BILL/bil00881/r1',
  link_type: 'SALE_BILL',
  link_id: BILL,
  link_year: '2026-2027',
  voucher_branch: BRANCH,
  to_branch: null,
  remarks: null,
  reason_name: null,
  to_branch_name: null,
  from_branch_name: null,
  sb_cust_id: WALK,
  sb_cust_name: 'MADHAVAN',
  party_id: WALK,
  party_name: 'MADHAVAN',
  pi_supplier_inv_no: null,
  grn_supplier_inv_no: null,
  transit_status: null,
  transit_received_on: null,
  ...over,
});

const stockRow = (over: Record<string, unknown> = {}) => ({
  godown_id: GODOWN,
  godown_name: 'Coimbatore',
  bucket: 'SALEABLE',
  lot_id: LOT,
  batch_no: 'BH2609A',
  expiry: '2026-11-16',
  on_hand: dec(288),
  reserved: dec(24),
  transit_in: dec(0),
  cost_rate: dec(27.9),
  value: dec(8035.2),
  in_scope: true,
  ...over,
});

const Q = {
  companyId: COMPANY,
  branchId: BRANCH,
  itemId: ITEM,
  from: '2026-11-01',
  to: '2026-11-10',
};

function build(db: ReturnType<typeof makeDb>, walkIn: string | null = WALK) {
  const ctx = { getUserId: () => USER } as unknown as RequestContextService;
  const settings = {
    resolveEffective: jest.fn(async () => [{ asdKey: 'sales.default_customer_id', value: walkIn }]),
  } as unknown as AppSettingValueService;
  return new ItemLedgerService(db.prisma, ctx, settings);
}

function primed() {
  const db = makeDb();
  db.answer('rights', [rightsRow()]);
  db.answer('lookup', [lookupRow()]);
  db.answer('today', [{ d: '2026-11-11' }]);
  db.answer('opening', [openingRow()]);
  db.answer('summary', [agg()]);
  db.answer('page', []);
  db.answer('stockNow', [stockRow()]);
  db.answer('walkInName', [{ led_name: 'MADHAVAN' }]);
  return db;
}

async function refusal(promise: Promise<unknown>): Promise<{ status: number; code: string }> {
  try {
    await promise;
  } catch (error) {
    const e = error as HttpException;
    const body = e.getResponse() as { errors?: { code: string }[] };
    return { status: e.getStatus(), code: body.errors?.[0]?.code ?? '' };
  }
  throw new Error('expected a refusal');
}

describe('ItemLedgerService', () => {
  describe('rights and refusals (§5)', () => {
    it('403 ITEM_LEDGER_RIGHT_VIEW without view on menu 301, before any read', async () => {
      const db = primed();
      db.answer('rights', []);
      const svc = build(db);
      for (const call of [
        () => svc.ledger(Q),
        () => svc.options(Q),
        () => svc.days(Q),
        () => svc.months({ ...Q }),
        () => svc.export(Q),
      ]) {
        expect(await refusal(call())).toEqual({ status: 403, code: ITEM_LEDGER_ERROR.RIGHT_VIEW });
      }
      expect(db.of('rights')[0].values).toEqual([USER, 301]);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('RANGE_REVERSED before the database', async () => {
      const db = primed();
      expect(await refusal(build(db).ledger({ ...Q, from: '2026-11-11' }))).toEqual({
        status: 422,
        code: ITEM_LEDGER_ERROR.RANGE_REVERSED,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('refuses in the plan’s order: branch, item, godown, lot, unit', async () => {
      const q = { ...Q, godownId: GODOWN_2, lotId: LOT, unitId: UNIT };
      const all = {
        br_comp_id: OTHER_COMPANY,
        item_company_id: OTHER_COMPANY,
        gdl_branch_id: OTHER_BRANCH,
        slt_item_id: CUST,
        iuc_item_id: CUST,
        iuc_is_deleted: false,
      };
      const steps: [Record<string, unknown>, string][] = [
        [all, ITEM_LEDGER_ERROR.BRANCH_NOT_IN_COMPANY],
        [{ ...all, br_comp_id: COMPANY }, ITEM_LEDGER_ERROR.ITEM_NOT_FOUND],
        [
          { ...all, br_comp_id: COMPANY, item_company_id: null },
          ITEM_LEDGER_ERROR.GODOWN_NOT_IN_BRANCH,
        ],
        [
          { ...all, br_comp_id: COMPANY, item_company_id: null, gdl_branch_id: BRANCH },
          ITEM_LEDGER_ERROR.LOT_NOT_OF_ITEM,
        ],
        [
          {
            ...all,
            br_comp_id: COMPANY,
            item_company_id: null,
            gdl_branch_id: BRANCH,
            slt_item_id: ITEM,
          },
          ITEM_LEDGER_ERROR.UNIT_NOT_OF_ITEM,
        ],
      ];
      for (const [over, code] of steps) {
        const db = primed();
        db.answer('lookup', [lookupRow(over)]);
        expect(await refusal(build(db).ledger(q))).toEqual({ status: 422, code });
      }
    });

    it('a deleted item, a missing item and a deleted unit are refused too', async () => {
      for (const [over, extra, code] of [
        [{ item_is_deleted: true }, {}, ITEM_LEDGER_ERROR.ITEM_NOT_FOUND],
        [{ item_id: null }, {}, ITEM_LEDGER_ERROR.ITEM_NOT_FOUND],
        [
          { iuc_item_id: ITEM, iuc_is_deleted: true },
          { unitId: UNIT },
          ITEM_LEDGER_ERROR.UNIT_NOT_OF_ITEM,
        ],
      ] as const) {
        const db = primed();
        db.answer('lookup', [lookupRow(over)]);
        expect((await refusal(build(db).ledger({ ...Q, ...extra }))).code).toBe(code);
      }
    });

    it('runs read-only, custom plans, no JIT', async () => {
      const db = primed();
      await build(db).ledger(Q);
      const sets = db.$executeRaw.mock.calls.map((c) => flat((c[0] as string[]).join('?')));
      expect(sets).toEqual([
        'SET TRANSACTION READ ONLY',
        'SET LOCAL plan_cache_mode = force_custom_plan',
        'SET LOCAL jit = off',
      ]);
      expect(db.$transaction.mock.calls[0][1]).toMatchObject({
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    });

    it('today is the IST date, not the database server’s current_date', async () => {
      const db = primed();
      await build(db).ledger(Q);
      expect(db.of('today')).toHaveLength(1);
      expect(db.of('today')[0].text).not.toContain('current_date');
    });
  });

  describe('GET / — the Vouchers tab', () => {
    it('defaults: Saleable, cost without tax, base unit, revaluations in, page 1 of 1,000', async () => {
      const db = primed();
      const data = await build(db).ledger(Q);
      expect(data.head).toMatchObject({
        bucket: 'SALEABLE',
        valueAt: 'WITHOUT_TAX',
        order: 'asc',
        showReversed: true,
        types: [],
        unit: { unitId: BASE_UNIT, name: 'PCS', factor: '1.000000', isBase: true },
        revaluationsLeftOut: 0,
        rights: { print: true, export: false },
      });
      const page = db.of('page')[0];
      expect(page.text).toContain('sml_cost_value_wot');
      expect(page.text).toContain('stock_cost_revaluation r WHERE true');
      expect(page.values).toEqual(expect.arrayContaining(['SALEABLE', 1000, 0]));
      expect(db.of('leftOut')).toHaveLength(0);
    });

    it('a godown leaves the revaluations out and counts them (D17)', async () => {
      const db = primed();
      db.answer('lookup', [lookupRow({ gdl_branch_id: BRANCH, gdl_name: 'Coimbatore' })]);
      db.answer('leftOut', [{ n: 3 }]);
      const data = await build(db).ledger({ ...Q, godownId: GODOWN, bucket: 'ALL' });
      expect(data.head).toMatchObject({
        godownName: 'Coimbatore',
        bucket: 'ALL',
        revaluationsLeftOut: 3,
      });
      expect(db.of('page')[0].text).toContain('stock_cost_revaluation r WHERE false');
      expect(db.of('page')[0].text).not.toContain('sml_bucket = $');
      // The count covers every revaluation up to `to` — the opening drops those before `from` too.
      const leftOut = db.of('leftOut')[0];
      expect(leftOut.text).toContain('r.scr_doc_date <= $');
      expect(leftOut.values).toContain('2026-11-10');
      expect(leftOut.values).not.toContain('2026-11-01');
    });

    it('a bucket other than Saleable / All leaves them out too; Saleable at all godowns keeps them', async () => {
      const damaged = primed();
      damaged.answer('leftOut', [{ n: 5 }]);
      expect(
        (await build(damaged).ledger({ ...Q, bucket: 'DAMAGED' })).head.revaluationsLeftOut,
      ).toBe(5);
      const all = primed();
      expect((await build(all).ledger({ ...Q, bucket: 'ALL' })).head.revaluationsLeftOut).toBe(0);
      expect(all.of('leftOut')).toHaveLength(0);
    });

    it('opening, closing, totals and page from the summary row', async () => {
      const db = primed();
      db.answer('summary', [agg({ n_shown: 2500, n_all: 2600 })]);
      db.answer('page', [pageRow()]);
      const data = await build(db).ledger({ ...Q, page: 2, limit: 1000 });
      expect(data.opening).toEqual({
        date: '2026-11-01',
        closingOf: '2026-10-31',
        qty: '300.000',
        value: '8370.00',
        rate: '27.90',
        lots: 2,
      });
      expect(data.closing).toEqual({
        date: '2026-11-10',
        qty: '288.000',
        value: '8035.20',
        rate: '27.90',
      });
      expect(data.totals).toMatchObject({
        receivedQty: '0.000',
        issuedQty: '12.000',
        rows: 2600,
        rowsShown: 2500,
      });
      expect(data.page).toEqual({ page: 2, limit: 1000, totalRows: 2500, hasMore: true });
      expect(db.of('page')[0].values).toEqual(expect.arrayContaining([1000, 1000]));
    });

    it('order=desc pages from the newest, balances unchanged', async () => {
      const db = primed();
      await build(db).ledger({ ...Q, order: 'desc', limit: 7, page: 3 });
      expect(db.of('page')[0].text).toContain('ORDER BY seq DESC LIMIT');
      expect(db.of('page')[0].values).toEqual(expect.arrayContaining([7, 14]));
    });

    it('a cancelled pair: CANCELLED original + REVERSAL that nets it to 0, walk-in = Counter (cash)', async () => {
      const db = primed();
      db.answer('page', [
        pageRow({
          state: 'CANCELLED',
          r_posted_at: '2026-11-03T11:34:02+05:30',
          r_by_login: 'raman',
          r_narr: 'customer did not take it',
          nets_zero: true,
        }),
        pageRow({
          seq: 2,
          is_rev: true,
          state: 'REVERSAL',
          t_post: '11:34 AM',
          posted_at: '2026-11-03T11:34:02+05:30',
          o_posted_at: '2026-11-03T11:20:41+05:30',
          o_refno: 'bil00881',
          sq: dec(10),
          sv: dec(279),
          run_q: dec(0),
          run_v: dec(0),
          narration: 'customer did not take it',
          by_login: 'raman',
          nets_zero: true,
        }),
      ]);
      const [orig, rev] = (await build(db).ledger(Q)).rows;
      expect(orig).toMatchObject({
        state: 'CANCELLED',
        time: '11:20 AM',
        issuedQty: '10.000',
        receivedQty: null,
        balanceQty: '290.000',
        costRate: '27.90',
        costValue: '-279.00',
        docRate: '29.00',
        party: { id: WALK, label: 'Counter (cash)', walkIn: true },
        doc: { kind: 'SALE_BILL', id: BILL, accYear: '2026-2027', branchId: BRANCH },
        reversal: {
          kind: 'CANCELLED',
          at: '2026-11-03T11:34:02+05:30',
          user: 'raman',
          reason: 'customer did not take it',
        },
        reverses: null,
      });
      expect(rev).toMatchObject({
        state: 'REVERSAL',
        time: '11:34 AM',
        issuedQty: '-10.000',
        balanceQty: '300.000',
        user: 'raman',
        reversal: null,
        reverses: {
          kind: 'CANCELLED',
          docNo: 'bil00881',
          postedAt: '2026-11-03T11:20:41+05:30',
          reason: 'customer did not take it',
        },
      });
    });

    it('an amended bill: AMENDED old lines, the bill as it stands carries its revision', async () => {
      const db = primed();
      db.answer('page', [
        pageRow({
          state: 'AMENDED',
          amended: true,
          sb_cust_id: CUST,
          party_id: CUST,
          sb_cust_name: 'Deepan',
        }),
        pageRow({
          seq: 3,
          voucher_refno: 'SALE_BILL/bil00881/r2',
          doc_id: '01a1c903-2324-7f01-9451-e08e3afd9999',
          sb_cust_id: CUST,
          party_id: CUST,
          sb_cust_name: 'Deepan',
        }),
      ]);
      const [old, now] = (await build(db).ledger(Q)).rows;
      expect(old.state).toBe('AMENDED');
      expect(old.reversal?.kind).toBe('AMENDED');
      expect(old.party).toEqual({ id: CUST, label: 'Deepan', walkIn: false });
      expect(now.revision).toBe(2);
      expect(now.doc.id).toBe(BILL);
    });

    it('a godown transfer with both legs in scope is ONE row with no quantity (D15)', async () => {
      const db = primed();
      db.answer('page', [
        pageRow({
          src_module: 'STOCK',
          src_type: 'TRANSFER_OUT',
          rtype: 'GODOWN_TRANSFER',
          gtxn: 'TRANSFER',
          kind: 'INTERNAL',
          internal: true,
          sq: dec(0),
          sv: dec(0),
          gq: dec(48),
          gv: dec(1339.2),
          moved: dec(24),
          run_q: dec(0),
          gdown: null,
          gdown_name: null,
          from_godown: GODOWN,
          from_godown_name: 'Coimbatore',
          to_godown: GODOWN_2,
          to_godown_name: 'Trichy',
          gbucket: null,
          from_bucket: 'SALEABLE',
          to_bucket: 'SALEABLE',
          voucher_type: 'TRANSFER_OUT',
          link_type: null,
          link_id: null,
          sb_cust_id: null,
          sb_cust_name: null,
          party_id: null,
          party_name: null,
          doc_amt: dec(0),
        }),
      ]);
      const [row] = (await build(db).ledger(Q)).rows;
      expect(row).toMatchObject({
        type: 'GODOWN_TRANSFER',
        typeLabel: 'Godown transfer',
        kind: 'INTERNAL',
        receivedQty: null,
        issuedQty: null,
        movedQty: '24.000',
        balanceQty: '300.000',
        godownName: 'Coimbatore',
        toGodownName: 'Trichy',
        detail: 'Coimbatore → Trichy',
        party: null,
        docRate: null,
        costRate: '27.90',
        doc: { kind: 'GODOWN_TRANSFER', id: SHADOW },
      });
    });

    it('one leg of a bucket move in scope is a real Issued row, named for the other bucket', async () => {
      const db = primed();
      db.answer('page', [
        pageRow({
          src_module: 'STOCK',
          src_type: 'ADJUSTMENT',
          rtype: 'BUCKET_MOVE',
          gtxn: 'BUCKET_OUT',
          other_bucket: 'DAMAGED',
          voucher_type: 'ADJUSTMENT',
          link_type: null,
          link_id: null,
          reason_name: 'Packet torn',
          party_id: null,
          sb_cust_id: null,
          doc_amt: dec(0),
        }),
      ]);
      const [row] = (await build(db).ledger(Q)).rows;
      expect(row).toMatchObject({
        typeLabel: 'To Damaged',
        issuedQty: '10.000',
        toBucket: 'DAMAGED',
        detail: 'Saleable → Damaged · Packet torn',
        doc: { kind: 'ADJUSTMENT' },
      });
    });

    it('Qty in a bigger unit: quantities ÷ factor, rates × factor, values unchanged', async () => {
      const db = primed();
      db.answer('lookup', [
        lookupRow({
          iuc_item_id: ITEM,
          iuc_is_deleted: false,
          iuc_to_base_factor: dec(10),
          unit_name: 'Box',
        }),
      ]);
      db.answer('page', [pageRow()]);
      const data = await build(db).ledger({ ...Q, unitId: UNIT });
      expect(data.head.unit).toEqual({
        unitId: UNIT,
        name: 'Box',
        factor: '10.000000',
        isBase: false,
      });
      expect(data.opening).toMatchObject({ qty: '30.000', value: '8370.00', rate: '279.00' });
      expect(data.rows[0]).toMatchObject({
        issuedQty: '1.000',
        balanceQty: '29.000',
        costRate: '279.00',
        costValue: '-279.00',
        docRate: '290.00',
      });
      expect(data.stockNow.rows[0]).toMatchObject({
        onHand: '28.800',
        costRate: '279.00',
        value: '8035.20',
      });
    });

    it('the tie: checked only when to ≥ today, against Σ stock_balance in scope', async () => {
      const db = primed();
      db.answer('opening', [openingRow({ after_q: dec(-2) })]);
      db.answer('stockNow', [
        stockRow({ on_hand: dec(280) }),
        stockRow({ on_hand: dec(9), in_scope: false }),
      ]);
      const late = await build(db).ledger({ ...Q, to: '2026-11-11' });
      expect(late.tie).toEqual({
        checked: true,
        ledgerQty: '286.000',
        stockNowQty: '280.000',
        equal: false,
        difference: '6.000',
      });
      expect(late.stockNow.totalInScope).toEqual({
        onHand: '280.000',
        reserved: '24.000',
        inTransitIn: '0.000',
        value: '8035.20',
      });
      expect(db.of('opening')[0].text).toContain('a.sml_doc_date > $');
      const early = await build(primed()).ledger(Q);
      expect(early.tie).toEqual({
        checked: false,
        ledgerQty: null,
        stockNowQty: null,
        equal: null,
        difference: null,
      });
    });

    it('periodTie: decided on the exact base numbers, not the rounded strings (unit of 12)', async () => {
      const db = primed();
      db.answer('lookup', [
        lookupRow({
          iuc_item_id: ITEM,
          iuc_is_deleted: false,
          iuc_to_base_factor: dec(12),
          unit_name: 'Box',
        }),
      ]);
      db.answer('opening', [openingRow({ q: dec(1), v: dec(10.005), rv: dec(0) })]);
      db.answer('summary', [
        agg({
          q_all: dec(1),
          v_all: dec(10.005),
          q_in: dec(1),
          q_out: dec(0),
          v_in: dec(10.005),
          v_out: dec(0),
        }),
      ]);
      const data = await build(db).ledger({ ...Q, unitId: UNIT });
      // The strings Qt used to re-add: 0.083 + 0.083 − 0 = 0.166, not 0.167;
      // 10.01 + 10.01 = 20.02, not 20.01.
      expect([data.opening.qty, data.totals.receivedQty, data.closing.qty]).toEqual([
        '0.083',
        '0.083',
        '0.167',
      ]);
      expect([data.opening.value, data.totals.valueIn, data.closing.value]).toEqual([
        '10.01',
        '10.01',
        '20.01',
      ]);
      expect(data.periodTie).toEqual({ qtyEqual: true, valueEqual: true });
    });

    it('periodTie: the opening revaluation value is on both sides; a lopsided internal row is ≠', async () => {
      const db = primed();
      db.answer('opening', [openingRow({ rv: dec(40) })]);
      expect((await build(db).ledger(Q)).periodTie).toEqual({ qtyEqual: true, valueEqual: true });
      const odd = primed();
      // q_all carries 0.5 more than the IN / OUT rows: an internal move whose legs do not meet.
      odd.answer('summary', [agg({ q_all: dec(-11.5) })]);
      expect((await build(odd).ledger(Q)).periodTie).toEqual({ qtyEqual: false, valueEqual: true });
    });

    it('periodTie: null when a row filter hides rows, computed when it hides none', async () => {
      const hidden = primed();
      hidden.answer('summary', [agg({ n_all: 6, n_shown: 4 })]);
      expect((await build(hidden).ledger({ ...Q, types: ['SALE'] })).periodTie).toEqual({
        qtyEqual: null,
        valueEqual: null,
      });
      const none = primed();
      expect((await build(none).ledger({ ...Q, types: ['SALE'] })).periodTie).toEqual({
        qtyEqual: true,
        valueEqual: true,
      });
    });

    it('By voucher type, tiles and the cancelled / amended doc numbers', async () => {
      const db = primed();
      db.answer('summary', [
        agg(),
        agg({
          part: 'B',
          rtype: 'SALE',
          cls: 'LIVE',
          kinds: ['OUT'],
          docs: 2,
          q_all: dec(-12),
          v_all: dec(-334.8),
          q_in: null,
          q_out: dec(12),
          v_in: null,
          v_out: dec(334.8),
          pair_q: dec(12),
        }),
        agg({
          part: 'B',
          rtype: 'SALE',
          cls: 'CANCELLED',
          kinds: ['OUT'],
          docs: 1,
          q_all: dec(0),
          v_all: dec(0),
          q_in: null,
          q_out: dec(0),
          v_in: null,
          v_out: dec(0),
          pair_q: dec(10),
        }),
        agg({
          part: 'B',
          rtype: 'GODOWN_TRANSFER',
          cls: 'LIVE',
          kinds: ['INTERNAL'],
          docs: 1,
          q_all: dec(0),
          v_all: dec(0),
          q_in: null,
          q_out: null,
          v_in: dec(0),
          v_out: null,
          moved: dec(24),
        }),
        agg({
          part: 'B',
          rtype: 'PURCHASE',
          cls: 'LIVE',
          kinds: ['IN'],
          docs: 3,
          q_in: dec(240),
          q_out: null,
          v_in: dec(6864),
          v_out: null,
        }),
        agg({ part: 'T', rtype: 'SALE', kind: 'OUT', docs: 41 }),
        agg({ part: 'T', rtype: 'BUCKET_MOVE', kind: 'OUT', ob: 'DAMAGED', docs: 1 }),
        agg({ part: 'T', rtype: 'BRANCH_OUT', kind: 'OUT', docs: 1 }),
        agg({ part: 'T', rtype: 'PURCHASE', kind: 'IN', docs: 3 }),
        agg({ part: 'C', cls: 'CANCELLED', doc_no: 'bil00881' }),
        agg({ part: 'C', cls: 'AMENDED', doc_no: 'bil00886' }),
      ]);
      const data = await build(db).ledger(Q);
      expect(data.byType.map((b) => [b.type, b.pairClass, b.label])).toEqual([
        ['PURCHASE', 'LIVE', 'Purchase'],
        ['SALE', 'LIVE', 'Sale'],
        ['SALE', 'CANCELLED', 'Sale cancelled (pair)'],
        ['GODOWN_TRANSFER', 'LIVE', 'Godown transfer'],
      ]);
      expect(data.byType[2]).toMatchObject({
        qtyOut: '0.000',
        pairQty: '10.000',
        netsToZero: true,
      });
      expect(data.byType[1]).toMatchObject({ qtyOut: '12.000', pairQty: null, netsToZero: false });
      expect(data.byType[3]).toMatchObject({ kind: 'INTERNAL', movedQty: '24.000' });
      expect(data.tiles).toEqual({
        receivedDocs: [{ type: 'PURCHASE', label: 'purchases', count: 3 }],
        issuedDocs: [
          { type: 'SALE', label: 'sales', count: 41 },
          { type: 'BRANCH_OUT', label: 'branch out', count: 1 },
          { type: 'BUCKET_MOVE', label: 'to damaged', count: 1 },
        ],
        cancelled: { count: 1, docNos: ['bil00881'] },
        amended: { count: 1, docNos: ['bil00886'] },
      });
    });

    it('row filters go to the SQL as `shown`, never as a scope', async () => {
      const db = primed();
      await build(db).ledger({ ...Q, types: ['SALE'], showReversed: false });
      const page = db.of('page')[0];
      expect(page.values).toEqual(expect.arrayContaining([false, ['SALE']]));
      expect(db.of('opening')[0].values).not.toContainEqual(['SALE']);
    });

    it('a purchase row: supplier + invoice no; a branch outward: the branch and transit', async () => {
      const db = primed();
      db.answer('page', [
        pageRow({
          src_module: 'PURCHASE',
          src_type: 'PURCHASE_BILL',
          rtype: 'PURCHASE',
          kind: 'IN',
          sq: dec(96),
          voucher_type: 'RECEIPT',
          link_type: 'PURCHASE_BILL',
          sb_cust_id: null,
          sb_cust_name: null,
          party_id: CUST,
          party_name: 'Balathevan Agency',
          pi_supplier_inv_no: 'BA/2611/0187',
        }),
        pageRow({
          seq: 2,
          src_module: 'STOCK',
          src_type: 'TRANSFER_OUT',
          rtype: 'BRANCH_OUT',
          voucher_type: 'TRANSFER_OUT',
          to_branch: OTHER_BRANCH,
          to_branch_name: 'Main Branch',
          transit_status: 'IN_TRANSIT',
          link_type: null,
          link_id: null,
          sb_cust_id: null,
          party_id: null,
          doc_amt: dec(0),
        }),
      ]);
      const [pur, out] = (await build(db).ledger(Q)).rows;
      expect(pur).toMatchObject({
        receivedQty: '96.000',
        party: { label: 'Balathevan Agency', walkIn: false },
        detail: 'inv BA/2611/0187',
        doc: { kind: 'PURCHASE_BILL' },
      });
      expect(out).toMatchObject({
        typeLabel: 'Branch outward',
        detail: '→ Main Branch · in transit',
        doc: { kind: 'BRANCH_OUTWARD', id: SHADOW },
        party: null,
      });
    });

    it('a REVALUED row is value only', async () => {
      const db = primed();
      db.answer('page', [
        pageRow({
          src_kind: 'R',
          src_module: 'PURCHASE',
          src_type: 'PURCHASE_BILL',
          rtype: 'REVALUED',
          kind: 'VALUE',
          sq: dec(0),
          sv: dec(40),
          gq: dec(0),
          gv: dec(0),
          run_q: dec(0),
          run_v: dec(40),
          gdown: null,
          gdown_name: null,
          gbucket: null,
          voucher_type: null,
          link_type: null,
          link_id: null,
          sb_cust_id: null,
          party_id: CUST,
          party_name: 'ZT-PUR Supplier',
          narration: 'Purchase PUR/1 — bill rate over GRN rate',
        }),
      ]);
      const [row] = (await build(db).ledger(Q)).rows;
      expect(row).toMatchObject({
        kind: 'VALUE',
        receivedQty: null,
        issuedQty: null,
        movedQty: null,
        freeQty: null,
        costRate: null,
        costValue: '40.00',
        balanceQty: '300.000',
        balanceValue: '8410.00',
        doc: { kind: 'PURCHASE_BILL', id: SHADOW, accYear: '2026-2027' },
        detail: 'Purchase PUR/1 — bill rate over GRN rate',
      });
    });

    it('no walk-in configured: a bill to that ledger shows its name', async () => {
      const db = primed();
      db.answer('page', [pageRow()]);
      const [row] = (await build(db, null).ledger(Q)).rows;
      expect(row.party).toEqual({ id: WALK, label: 'MADHAVAN', walkIn: false });
      expect(db.of('walkInName')).toHaveLength(0);
    });
  });

  describe('/export', () => {
    it(`refuses more than ${EXPORT_ROW_CAP} rows with ITEM_LEDGER_TOO_MANY_ROWS, before reading them`, async () => {
      const db = primed();
      db.answer('summary', [agg({ n_shown: EXPORT_ROW_CAP + 1 })]);
      expect(await refusal(build(db).export(Q))).toEqual({
        status: 422,
        code: ITEM_LEDGER_ERROR.TOO_MANY_ROWS,
      });
      expect(db.of('page')).toHaveLength(0);
    });

    it('every row, unpaged, with printedAs', async () => {
      const db = primed();
      db.answer('summary', [agg({ n_shown: EXPORT_ROW_CAP })]);
      db.answer('page', [pageRow()]);
      const data = await build(db).export({ ...Q, order: 'desc' });
      expect(db.of('page')[0].values).toEqual(expect.arrayContaining([EXPORT_ROW_CAP, 0]));
      expect(data.totalRows).toBe(1);
      expect(data.printedAs).toBe(
        'ZT-A ZT-ITEM-A · Acme Foods - Coimbatore Branch · 01/11/2026 to 10/11/2026 · All godowns · ' +
          'Saleable · All batches · All types · Qty in PCS · Cost without tax · Cancelled & amended shown',
      );
      expect(Object.keys(data)).toEqual([
        'head',
        'printedAs',
        'opening',
        'closing',
        'totals',
        'rows',
        'totalRows',
      ]);
    });
  });

  describe('/days and /months', () => {
    const periodRow = (k: string, q: number, v: number, extra: Record<string, unknown> = {}) => ({
      k,
      docs: 2,
      n: 2,
      q_all: dec(q),
      v_all: dec(v),
      q_in: dec(Math.max(q, 0)),
      q_out: dec(Math.max(-q, 0)),
      v_in: dec(Math.max(v, 0)),
      v_out: dec(Math.max(-v, 0)),
      ...extra,
    });

    it('days chain opening → closing', async () => {
      const db = primed();
      db.answer('period', [
        periodRow('2026-11-01', -45, -1255.5),
        periodRow('2026-11-03', 20, 558),
      ]);
      const data = await build(db).days(Q);
      expect(data.days).toEqual([
        {
          date: '2026-11-01',
          docs: 2,
          openingQty: '300.000',
          receivedQty: '0.000',
          issuedQty: '45.000',
          closingQty: '255.000',
          valueIn: '0.00',
          valueOut: '1255.50',
          closingValue: '7114.50',
        },
        {
          date: '2026-11-03',
          docs: 2,
          openingQty: '255.000',
          receivedQty: '20.000',
          issuedQty: '0.000',
          closingQty: '275.000',
          valueIn: '558.00',
          valueOut: '0.00',
          closingValue: '7672.50',
        },
      ]);
      expect(db.of('period')[0].text).toContain('SELECT f.d::text AS k');
      expect(data.periodTie).toEqual({ qtyEqual: true, valueEqual: true });
    });

    it('months run from the financial year of `to`, every month, the last one partial', async () => {
      const db = primed();
      db.answer('fy', [{ name: '2026-2027', begin: '2026-04-01', end: '2027-03-31' }]);
      db.answer('opening', [openingRow({ q: dec(0), v: dec(0), lots: 0 })]);
      db.answer('period', [periodRow('2026-04', 168, 4000), periodRow('2026-11', -40, -1000)]);
      const data = await build(db).months({
        companyId: COMPANY,
        branchId: BRANCH,
        itemId: ITEM,
        to: '2026-11-10',
      });
      expect(data.fy).toEqual({ name: '2026-2027', begin: '2026-04-01', end: '2027-03-31' });
      expect(data.head.from).toBe('2026-04-01');
      expect(data.months.map((m) => [m.label, m.openingQty, m.closingQty, m.partial])).toEqual([
        ['Apr-2026', '0.000', '168.000', false],
        ['May-2026', '168.000', '168.000', false],
        ['Jun-2026', '168.000', '168.000', false],
        ['Jul-2026', '168.000', '168.000', false],
        ['Aug-2026', '168.000', '168.000', false],
        ['Sep-2026', '168.000', '168.000', false],
        ['Oct-2026', '168.000', '168.000', false],
        ['Nov-2026', '168.000', '128.000', true],
      ]);
      expect(data.yearToDate).toEqual({
        docs: 4,
        inwardQty: '168.000',
        outwardQty: '40.000',
        closingQty: '128.000',
        closingValue: '3000.00',
      });
      expect(db.of('opening')[0].values).toContain('2026-04-01');
      expect(db.of('period')[0].text).toContain("to_char(f.d, 'YYYY-MM') AS k");
    });

    it('NO_FISCAL_YEAR when `to` is outside every year', async () => {
      const db = primed();
      db.answer('fy', []);
      expect(
        await refusal(
          build(db).months({
            companyId: COMPANY,
            branchId: BRANCH,
            itemId: ITEM,
            to: '2031-01-10',
          }),
        ),
      ).toEqual({ status: 422, code: ITEM_LEDGER_ERROR.NO_FISCAL_YEAR });
    });

    it('the scope refusals come before NO_FISCAL_YEAR, as on every route', async () => {
      const db = primed();
      db.answer('fy', []);
      db.answer('lookup', [lookupRow({ br_comp_id: OTHER_COMPANY })]);
      expect(
        await refusal(
          build(db).months({
            companyId: COMPANY,
            branchId: OTHER_BRANCH,
            itemId: ITEM,
            to: '2031-01-10',
          }),
        ),
      ).toEqual({ status: 422, code: ITEM_LEDGER_ERROR.BRANCH_NOT_IN_COMPANY });
      expect(db.of('fy')).toHaveLength(0);
    });

    it('months look the scope up once', async () => {
      const db = primed();
      db.answer('fy', [{ name: '2026-2027', begin: '2026-04-01', end: '2027-03-31' }]);
      await build(db).months({
        companyId: COMPANY,
        branchId: BRANCH,
        itemId: ITEM,
        to: '2026-11-10',
      });
      expect(db.of('lookup')).toHaveLength(1);
      expect(db.of('fy')).toHaveLength(1);
    });
  });

  describe('/options', () => {
    it('facts, units, godowns, lots, types, last count, FY and rights', async () => {
      const db = primed();
      db.answer('facts', [
        {
          item_id: ITEM,
          item_code: 'SM-BISC-00668',
          item_name: 'Bake House Choco Chip',
          group_name: 'Biscuits and Cookies',
          brand_name: 'Bake House',
          hsn: '190531',
          is_service: false,
          preset_name: 'Batch + expiry',
          base_unit_name: 'Pkt',
        },
      ]);
      db.answer('units', [
        { iuc_id: BASE_UNIT, unit_name: 'Pkt', factor: dec(1), is_base: true },
        { iuc_id: UNIT, unit_name: 'Box', factor: dec(12), is_base: false },
      ]);
      db.answer('reorder', [{ lvl: dec(150) }]);
      db.answer('godowns', [{ gdl_id: GODOWN, gdl_name: 'Coimbatore', gdl_short: 'CBE' }]);
      db.answer('lots', [
        { lot_id: LOT, batch_no: 'BH2609A', expiry: '2026-11-16', mrp: dec(30), on_hand: dec(46) },
      ]);
      db.answer('types', [
        {
          txn: 'SALE',
          src_type: 'SALE_BILL',
          has_branch_out: false,
          has_godown_out: false,
          is_reval: false,
        },
        {
          txn: 'PURCHASE',
          src_type: 'GRN',
          has_branch_out: false,
          has_godown_out: false,
          is_reval: false,
        },
        {
          txn: 'TRANSFER_OUT',
          src_type: 'TRANSFER_OUT',
          has_branch_out: true,
          has_godown_out: true,
          is_reval: false,
        },
        {
          txn: 'TRANSFER_IN',
          src_type: 'TRANSFER_OUT',
          has_branch_out: false,
          has_godown_out: false,
          is_reval: false,
        },
        {
          txn: 'REVALUED',
          src_type: 'PURCHASE_BILL',
          has_branch_out: false,
          has_godown_out: false,
          is_reval: true,
        },
      ]);
      db.answer('lastCount', [{ d: '2026-10-28' }]);
      db.answer('fy', [{ name: '2026-2027', begin: '2026-04-01', end: '2027-03-31' }]);
      const data = await build(db).options(Q);
      expect(data.item).toEqual({
        itemId: ITEM,
        code: 'SM-BISC-00668',
        name: 'Bake House Choco Chip',
        group: 'Biscuits and Cookies',
        brand: 'Bake House',
        hsn: '190531',
        gstRate: '18.00',
        trackedAs: 'Batch + expiry',
        isService: false,
        baseUnit: { unitId: BASE_UNIT, name: 'Pkt' },
        units: [
          { unitId: BASE_UNIT, name: 'Pkt', factor: '1.000000', isBase: true },
          { unitId: UNIT, name: 'Box', factor: '12.000000', isBase: false },
        ],
        reorderLevel: '150.000',
      });
      expect(data.godowns).toEqual([{ godownId: GODOWN, name: 'Coimbatore', short: 'CBE' }]);
      expect(data.lots).toEqual([
        { lotId: LOT, batchNo: 'BH2609A', expiry: '2026-11-16', mrp: '30.00', onHand: '46.000' },
      ]);
      expect(data.types.map((t) => t.type)).toEqual([
        'GRN',
        'SALE',
        'GODOWN_TRANSFER',
        'BRANCH_OUT',
        'REVALUED',
      ]);
      expect(data.lastCountDate).toBe('2026-10-28');
      expect(data.fy).toEqual({ name: '2026-2027', begin: '2026-04-01', end: '2027-03-31' });
      expect(data.rights).toEqual({ print: true, export: false });
    });
  });
});
