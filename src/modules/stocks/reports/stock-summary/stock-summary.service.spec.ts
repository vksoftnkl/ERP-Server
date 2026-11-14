import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import {
  StockSummaryHeadProvider,
  StockSummaryPrintSource,
  StockSummaryRowsProvider,
} from '../../../settings/print-render/data/providers/stock-summary.providers';
import type { ProviderRequest } from '../../../settings/print-render/data/print-data-provider.types';
import { StockSummaryRunStore } from './stock-summary-run.store';
import { StockSummaryService } from './stock-summary.service';
import { EXPORT_ROW_CAP, ITEM_CAP } from './stock-summary.rules';
import { STOCK_SUMMARY_ERROR } from './types/stock-summary.types';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const GROUP = '019c8045-bbc9-77dd-9668-774331e02b4e';
const BRAND = '019e9be7-1a04-7325-ad21-9853ced9c54e';
const ITEM = '01a161d8-4fd1-78ed-841a-a6e28b641ec2';
const ITEM_B = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const LOT = 'dd08de2b-18f1-575d-b653-df1765055465';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const USER_2 = '019e441b-6e48-7918-b246-b857ffb35db2';

const dec = (v: number | string) => new Prisma.Decimal(v);
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

type Answer = unknown[] | ((sql: Prisma.Sql, text: string) => unknown[]);
const ROUTES: [string, string][] = [
  ['FROM public.user_menus', 'rights'],
  ['FROM (SELECT 1) x', 'lookup'],
  ['AS d, to_char(now()', 'moment'],
  ["'H'::text AS part", 'pass'],
  ['AS default_is_base', 'facts'],
  ['AS last_sale', 'lastSale'],
  ['b.sbl_transit_in_qty AS transit_in', 'balance'],
  ['AS q, COUNT(*)::int AS n FROM stock.stock_ledger l', 'after'],
  ['snt AS (', 'transitReplay'],
  ['FROM stock.stock_transit t LEFT JOIN public.branch_master fb', 'transit'],
  ['FROM inventory.godown_locations WHERE gdl_branch_id', 'godowns'],
  ['FROM public.fiscal_years', 'fy'],
  ['ch AS (', 'branchCells'],
  ['SUM(b.sbl_on_hand_qty) AS q', 'branchCells'],
  ['FROM public.branch_master WHERE br_comp_id', 'companyBranches'],
  ['WITH ih AS (', 'valuation'],
  ['spt.spt_name AS preset_name', 'itemExtra'],
  ["x.sml_txn_type = 'PURCHASE'", 'lastPurchase'],
  ['WITH ol AS (', 'ilOpening'],
  ["'S'::text AS part", 'ilSummary'],
  ['sp.led_name AS supplier, b.sbl_on_hand_qty', 'lotsNow'],
  ["'L'::text AS k", 'lotNames'],
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
    return typeof answer === 'function' ? answer(sql, text) : answer;
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
    $queryRaw,
    $executeRaw,
    calls,
    answer: (key: string, rows: Answer) => answers.set(key, rows),
    of: (key: string) => calls.filter((c) => c.key === key),
    reset: () => {
      calls.length = 0;
      $transaction.mockClear();
      $queryRaw.mockClear();
    },
  };
}

const rightsRow = (over: Record<string, boolean> = {}) => ({
  um_can_view: true,
  um_can_create: false,
  um_can_edit: false,
  um_can_delete: false,
  um_can_print: true,
  um_can_export: true,
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
  br_is_deleted: false,
  comp_name: 'Amazon Retail India Private Limited',
  gdl_branch_id: null,
  gdl_name: null,
  gdl_is_deleted: null,
  itg_id: null,
  itg_name: null,
  itg_is_deleted: null,
  brand_id: null,
  brand_name: null,
  brand_is_deleted: null,
  item_id: null,
  item_company_id: null,
  item_is_deleted: null,
  ...over,
});

/** One holding's three pass parts. */
function passParts(
  item: string,
  o: {
    oq?: number;
    pq?: number;
    iq?: number;
    xq?: number;
    iv?: number;
    xv?: number;
    ov?: number;
    cv?: number;
    bucket?: string;
  } = {},
) {
  const k = { item, lot: LOT, godown: GODOWN, bucket: o.bucket ?? 'SALEABLE' };
  const none = { oq: null, pq: null, iq: null, xq: null, iv: null, xv: null, n: null };
  return [
    {
      part: 'H',
      ...k,
      oq: dec(o.oq ?? 0),
      pq: dec(o.pq ?? 0),
      iq: dec(o.iq ?? 0),
      xq: dec(o.xq ?? 0),
      iv: dec(o.iv ?? 0),
      xv: dec(o.xv ?? 0),
      n: 1,
      value: null,
      vm: null,
    },
    { part: 'O', ...k, ...none, value: dec(o.ov ?? 0), vm: 'WAVG' },
    { part: 'C', ...k, ...none, value: dec(o.cv ?? 0), vm: 'WAVG' },
  ];
}

const Q = { companyId: COMPANY, branchId: BRANCH, from: '2026-11-01', to: '2026-11-14' };

function primed(today = '2026-11-14') {
  const db = makeDb();
  db.answer('rights', [rightsRow()]);
  db.answer('lookup', [lookupRow()]);
  db.answer('moment', [{ d: today, at: `${today}T14:47:30+05:30` }]);
  db.answer('pass', [
    ...passParts(ITEM, { pq: 3320, iq: 3320, iv: 78844.47, cv: 79130.77 }),
    ...passParts(ITEM_B, { oq: -1300, pq: -14, xq: 14, xv: 948.5, ov: -88070, cv: -89038.09 }),
  ]);
  db.answer('facts', [
    {
      item_id: ITEM,
      name: 'Samsung H1',
      code: null,
      base_unit: 'pcs',
      company_id: COMPANY,
      warn_days: 0,
    },
    {
      item_id: ITEM_B,
      name: 'ZT-ITEM-A',
      code: 'ZT-A',
      base_unit: 'pcs',
      company_id: COMPANY,
      warn_days: 0,
    },
  ]);
  db.answer('lastSale', [
    { item: ITEM, last_sale: '2026-11-10' },
    { item: ITEM_B, last_sale: '2026-11-12' },
  ]);
  db.answer('balance', [
    {
      item: ITEM,
      lot: LOT,
      godown: GODOWN,
      bucket: 'SALEABLE',
      on_hand: dec(3320),
      reserved: dec(10),
      available: dec(3310),
      transit_in: dec(0),
      value: dec(79130.77),
      rate: dec(23.834568),
      expiry: null,
    },
    {
      item: ITEM_B,
      lot: LOT,
      godown: GODOWN,
      bucket: 'SALEABLE',
      on_hand: dec(-1314),
      reserved: dec(0),
      available: dec(-1314),
      transit_in: dec(0),
      value: dec(-89038.09),
      rate: dec(67.76),
      expiry: null,
    },
  ]);
  db.answer('godowns', [{ gdl_id: GODOWN, gdl_name: 'Coimbatore', gdl_short: null }]);
  return db;
}

function build(db: ReturnType<typeof makeDb>, user: { id: string } = { id: USER }) {
  const ctx = { getUserId: () => user.id } as unknown as RequestContextService;
  const store = new StockSummaryRunStore();
  return { service: new StockSummaryService(db.prisma, ctx, store), store, user };
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

describe('StockSummaryService', () => {
  describe('rights and refusals (§5)', () => {
    it('403 STOCK_SUMMARY_RIGHT_VIEW without view on 302, before any read', async () => {
      const db = primed();
      db.answer('rights', [rightsRow({ um_can_view: false })]);
      const { service } = build(db);
      for (const call of [
        () => service.options(Q),
        () => service.show(Q),
        () => service.rows({ runId: LOT }),
        () => service.item({ ...Q, itemId: ITEM }),
        () => service.branches(Q),
        () => service.export({ runId: LOT, tab: 'ITEMS' }),
      ]) {
        expect(await refusal(call())).toEqual({
          status: 403,
          code: STOCK_SUMMARY_ERROR.RIGHT_VIEW,
        });
      }
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.of('rights')[0].values).toEqual(expect.arrayContaining([USER, 302]));
    });

    it('RANGE_REVERSED before the database', async () => {
      const db = primed();
      expect(await refusal(build(db).service.show({ ...Q, from: '2026-11-20' }))).toEqual({
        status: 422,
        code: STOCK_SUMMARY_ERROR.RANGE_REVERSED,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('refuses in the plan’s order: branch, godown, group, brand, then item on /item', async () => {
      const all = { ...Q, godownId: GODOWN, groupId: GROUP, brandId: BRAND };
      const cases: [Record<string, unknown>, string][] = [
        [
          { br_comp_id: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' },
          STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY,
        ],
        [{ gdl_branch_id: OTHER_BRANCH }, STOCK_SUMMARY_ERROR.GODOWN_NOT_IN_BRANCH],
        [
          { gdl_branch_id: BRANCH, itg_id: GROUP, itg_is_deleted: true },
          STOCK_SUMMARY_ERROR.GROUP_NOT_FOUND,
        ],
        [
          { gdl_branch_id: BRANCH, itg_id: GROUP, itg_is_deleted: false },
          STOCK_SUMMARY_ERROR.BRAND_NOT_FOUND,
        ],
      ];
      for (const [row, code] of cases) {
        const db = primed();
        db.answer('lookup', [lookupRow(row)]);
        expect(await refusal(build(db).service.show(all))).toEqual({ status: 422, code });
        expect(db.of('pass')).toHaveLength(0);
      }
      const db = primed();
      db.answer('lookup', [
        lookupRow({
          item_id: ITEM,
          item_company_id: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1',
          item_is_deleted: false,
        }),
      ]);
      expect(await refusal(build(db).service.item({ ...Q, itemId: ITEM }))).toEqual({
        status: 422,
        code: STOCK_SUMMARY_ERROR.ITEM_NOT_FOUND,
      });
    });

    it('a deleted branch or godown is refused as not in the company / branch (review N7)', async () => {
      const cases: [Record<string, unknown>, string][] = [
        [{ br_is_deleted: true }, STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY],
        [
          { gdl_branch_id: BRANCH, gdl_name: 'ZT-OLD WH', gdl_is_deleted: true },
          STOCK_SUMMARY_ERROR.GODOWN_NOT_IN_BRANCH,
        ],
      ];
      for (const [row, code] of cases) {
        const db = primed();
        db.answer('lookup', [lookupRow(row)]);
        const { service } = build(db);
        expect(await refusal(service.show({ ...Q, godownId: GODOWN }))).toEqual({
          status: 422,
          code,
        });
        expect(db.of('pass')).toHaveLength(0);
        expect(db.of('lookup')[0].text).toContain('b.br_is_deleted');
        expect(db.of('lookup')[0].text).toContain('g.gdl_is_deleted');
      }
      // a deleted branch refuses /options too (the screen's first call)
      const opt = primed();
      opt.answer('lookup', [lookupRow({ br_is_deleted: true })]);
      expect(await refusal(build(opt).service.options(Q))).toEqual({
        status: 422,
        code: STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY,
      });
      // the live branch and godown pass
      const ok = primed();
      ok.answer('lookup', [
        lookupRow({ gdl_branch_id: BRANCH, gdl_name: 'Coimbatore', gdl_is_deleted: false }),
      ]);
      const shown = await build(ok).service.show({ ...Q, godownId: GODOWN });
      expect(shown.head.godownName).toBe('Coimbatore');
    });

    it('runs read-only, custom plans, no JIT', async () => {
      const db = primed();
      await build(db).service.show(Q);
      const set = db.$executeRaw.mock.calls.map((c) => flat((c[0] as string[]).join('?')));
      expect(set).toEqual([
        'SET TRANSACTION READ ONLY',
        'SET LOCAL plan_cache_mode = force_custom_plan',
        'SET LOCAL jit = off',
      ]);
      expect(db.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'RepeatableRead' });
    });

    it(`TOO_MANY_ITEMS past ${ITEM_CAP} items, before the facts are read`, async () => {
      const db = primed();
      db.answer('pass', () =>
        Array.from({ length: ITEM_CAP + 1 }, (_, i) => ({
          part: 'H',
          item: `item-${i}`,
          lot: LOT,
          godown: GODOWN,
          bucket: 'SALEABLE',
          oq: dec(1),
          pq: dec(0),
          iq: dec(0),
          xq: dec(0),
          iv: dec(0),
          xv: dec(0),
          n: 0,
          value: null,
          vm: null,
        })),
      );
      expect(await refusal(build(db).service.show(Q))).toEqual({
        status: 422,
        code: STOCK_SUMMARY_ERROR.TOO_MANY_ITEMS,
      });
      expect(db.of('facts')).toHaveLength(0);
    });
  });

  describe('Show', () => {
    it('defaults: Saleable, cost without tax, base unit, hide zero, 60 days; today reads stock now and transit', async () => {
      const db = primed();
      const data = await build(db).service.show(Q);
      const pass = db.of('pass')[0];
      expect(pass.text).toContain('sml_cost_value_wot');
      expect(pass.values).toEqual(expect.arrayContaining(['SALEABLE', '2026-10-31', '2026-11-14']));
      // No optional filter written as `$x IS NULL OR …` (the policy lateral's own column tests aside).
      expect(pass.text).not.toMatch(/\$\d+(::\w+)? IS NULL OR/);
      expect(data.head).toMatchObject({
        kind: 'ITEMS',
        todayOnly: true,
        bucket: 'SALEABLE',
        valueAt: 'WITHOUT_TAX',
        qtyIn: 'BASE',
        noSaleDays: 60,
        rights: { print: true, export: true },
        asOf: '2026-11-14T14:47:30+05:30',
      });
      expect(data.head.runId).toMatch(/^[0-9a-f-]{36}$/);
      expect(db.of('balance')).toHaveLength(1);
      expect(db.of('after')).toHaveLength(1);
      expect(db.of('transit').map((c) => c.text.includes('t.stt_to_branch_id = $'))).toEqual([
        true,
        false,
      ]);
      expect(db.of('transitReplay')).toHaveLength(0);
      expect(data.totals).toEqual({
        rows: 2,
        rowsShown: 2,
        openingValue: '-88070.00',
        inwardValue: '78844.47',
        outwardValue: '948.50',
        costAdj: '266.71',
        closingValue: '-9907.32',
      });
      // totalsShown = the view's totals (here the whole run)
      expect(data.totalsShown).toEqual({
        rows: 2,
        openingValue: '-88070.00',
        inwardValue: '78844.47',
        outwardValue: '948.50',
        costAdj: '266.71',
        closingValue: '-9907.32',
      });
      const neg = await build(primed()).service.show({ ...Q, show: 'NEGATIVE' });
      expect(neg.totals.closingValue).toBe('-9907.32');
      expect(neg.totalsShown).toEqual({
        rows: 1,
        openingValue: '-88070.00',
        inwardValue: '0.00',
        outwardValue: '948.50',
        costAdj: '-19.59',
        closingValue: '-89038.09',
      });
      expect(data.tie).toEqual({
        checked: true,
        items: 2,
        equal: 2,
        differ: 0,
        valueChecked: true,
      });
      expect(data.rows.map((r) => [r.name, r.closing, r.value, r.rate])).toEqual([
        ['Samsung H1', '3320.000', '79130.77', '23.83'],
        ['ZT-ITEM-A', '-1314.000', '-89038.09', '67.76'],
      ]);
    });

    it('"List the item": an item only on the road to this branch is read for facts and listed', async () => {
      const ON_ROAD = '01a0d242-56a9-7e80-95ea-4b6141872fa7';
      const db = primed();
      db.answer('transit', (_sql, text) =>
        text.includes('t.stt_to_branch_id = $')
          ? [
              {
                out_id: 'o9',
                doc_no: 'TRF/9',
                from_branch: OTHER_BRANCH,
                from_branch_name: 'Acme Foods - Coimbatore Branch',
                to_branch: BRANCH,
                to_branch_name: 'Counter2',
                to_godown: GODOWN,
                item: ON_ROAD,
                bucket: 'SALEABLE',
                q: dec(2),
                v: dec(76.19),
              },
            ]
          : [],
      );
      db.answer('facts', (sql) => [
        {
          item_id: ITEM,
          name: 'Samsung H1',
          code: null,
          base_unit: 'pcs',
          company_id: COMPANY,
          warn_days: 0,
        },
        {
          item_id: ITEM_B,
          name: 'ZT-ITEM-A',
          code: 'ZT-A',
          base_unit: 'pcs',
          company_id: COMPANY,
          warn_days: 0,
        },
        ...((sql.values[0] as string[]).includes(ON_ROAD)
          ? [
              {
                item_id: ON_ROAD,
                name: 'ZT-ITEM-B',
                code: 'ZT-B',
                base_unit: 'pcs',
                company_id: COMPANY,
                warn_days: 0,
              },
            ]
          : []),
      ]);
      const data = await build(db).service.show(Q);
      expect(db.of('facts')[0].values[0]).toEqual(expect.arrayContaining([ITEM, ITEM_B, ON_ROAD]));
      expect(db.of('lastSale')[0].values).toEqual(
        expect.arrayContaining([[ITEM, ITEM_B, ON_ROAD]]),
      );
      const row = data.rows.find((r) => r.itemId === ON_ROAD);
      expect(row).toMatchObject({
        name: 'ZT-ITEM-B',
        closing: '0.000',
        value: '0.00',
        inTransit: '2.000',
        chips: [],
      });
      expect(data.tiles.inTransitIn).toEqual({
        value: '76.19',
        items: 1,
        fromBranches: ['Acme Foods - Coimbatore Branch'],
      });
      expect(data.tie).toEqual({
        checked: true,
        items: 3,
        equal: 3,
        differ: 0,
        valueChecked: true,
      });
    });

    it('a past `to`: no stock-now reads; goods in transit replayed from the ledger', async () => {
      const db = primed();
      db.answer('transitReplay', [
        {
          out_id: 'o1',
          doc_no: 'TRF/4',
          from_branch: BRANCH,
          from_branch_name: 'CBE',
          to_branch: OTHER_BRANCH,
          to_branch_name: 'Counter2',
          to_godown: null,
          item: ITEM,
          bucket: 'SALEABLE',
          q: dec(4),
          v: dec(1694.92),
        },
      ]);
      const data = await build(db).service.show({ ...Q, from: '2026-10-01', to: '2026-10-31' });
      expect(data.head.todayOnly).toBe(false);
      expect([db.of('balance'), db.of('after'), db.of('transit')].map((x) => x.length)).toEqual([
        0, 0, 0,
      ]);
      expect(db.of('transitReplay')[0].values).toEqual(
        expect.arrayContaining([BRANCH, '2026-10-31']),
      );
      expect(data.transitOut).toEqual({
        checked: true,
        source: 'LEDGER',
        transfers: 1,
        items: 1,
        value: '1694.92',
        docs: [{ docNo: 'TRF/4', toBranch: 'Counter2' }],
      });
      expect(data.tie.checked).toBe(false);
      expect(data.rows[0]).toMatchObject({
        reserved: null,
        available: null,
        inTransit: null,
        tie: null,
      });
    });

    it('WITH_TAX reads the plain cost columns; a group / brand filter walks the subtree by parent', async () => {
      const db = primed();
      db.answer('lookup', [
        lookupRow({
          itg_id: GROUP,
          itg_name: 'Bluetooth Speakers',
          itg_is_deleted: false,
          brand_id: BRAND,
          brand_name: 'Baby Soft',
          brand_is_deleted: false,
        }),
      ]);
      const data = await build(db).service.show({
        ...Q,
        valueAt: 'WITH_TAX',
        groupId: GROUP,
        brandId: BRAND,
      });
      const pass = db.of('pass')[0].text;
      expect(pass).toContain('l.sml_direction * l.sml_cost_value)');
      expect(pass).toContain('WITH RECURSIVE gt AS (');
      expect(pass).toContain('c.itg_parent_id = gt.id');
      expect(pass).toContain('c.brand_parent_id = bt.id');
      expect(pass).not.toContain('itg_path_ids_cache');
      expect(data.head).toMatchObject({
        groupName: 'Bluetooth Speakers',
        brandName: 'Baby Soft',
        valueAt: 'WITH_TAX',
      });
    });
  });

  describe('the run (D20): no SQL beyond the rights row', () => {
    async function shown() {
      const db = primed();
      const b = build(db);
      const first = await b.service.show({ ...Q, limit: 1 });
      db.reset();
      return { db, ...b, runId: first.head.runId };
    }

    it('page 2, a sort, Find, a tile filter: from the run', async () => {
      const { db, service, runId } = await shown();
      const p2 = await service.rows({ runId, page: 2, limit: 1 });
      expect(p2.rows.map((r) => (r as { name: string }).name)).toEqual(['ZT-ITEM-A']);
      expect(p2.page).toEqual({ page: 2, limit: 1, totalRows: 2, hasMore: false });
      const sorted = await service.rows({ runId, sort: 'value', dir: 'desc' });
      expect(sorted.rows.map((r) => (r as { name: string }).name)).toEqual([
        'Samsung H1',
        'ZT-ITEM-A',
      ]);
      const neg = await service.rows({ runId, show: 'NEGATIVE' });
      expect(neg.totalsShown).toMatchObject({ rows: 1, closingValue: '-89038.09' });
      const found = await service.rows({ runId, find: 'samsung' });
      expect(found.page.totalRows).toBe(1);
      await service.groups({ runId, groupBy: 'BRAND' });
      await service.godowns({ runId });
      const exp = await service.export({ runId, tab: 'ITEMS', sort: 'closing' });
      expect(exp.totalRows).toBe(2);
      expect(exp.printedAs).toBe(
        'Acme Foods - Coimbatore Branch · 01/11/2026 → 14/11/2026 · All godowns · Saleable · cost without tax · hide zero',
      );
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(new Set(db.calls.map((c) => c.key))).toEqual(new Set(['rights']));
    });

    it('410 RUN_EXPIRED: unknown, past its idle time, another user’s, or another kind', async () => {
      const { service, store, user, runId } = await shown();
      expect(await refusal(service.rows({ runId: LOT }))).toEqual({
        status: 410,
        code: STOCK_SUMMARY_ERROR.RUN_EXPIRED,
      });
      expect(await refusal(service.export({ runId, tab: 'BRANCHES' }))).toEqual({
        status: 410,
        code: STOCK_SUMMARY_ERROR.RUN_EXPIRED,
      });
      user.id = USER_2;
      expect(await refusal(service.rows({ runId }))).toEqual({
        status: 410,
        code: STOCK_SUMMARY_ERROR.RUN_EXPIRED,
      });
      user.id = USER;
      expect((await service.rows({ runId })).runId).toBe(runId);
      store.idleMs = 0;
      const t = Date.now();
      store.now = () => t + 5;
      expect(await refusal(service.groups({ runId }))).toEqual({
        status: 410,
        code: STOCK_SUMMARY_ERROR.RUN_EXPIRED,
      });
    });

    it('/export needs EXPORT; more than 20,000 rows is TOO_MANY_ROWS', async () => {
      const { db, service, runId } = await shown();
      db.answer('rights', [rightsRow({ um_can_export: false })]);
      expect(await refusal(service.export({ runId, tab: 'ITEMS' }))).toEqual({
        status: 403,
        code: STOCK_SUMMARY_ERROR.RIGHT_EXPORT,
      });
      const big = primed();
      big.answer('pass', () =>
        Array.from({ length: EXPORT_ROW_CAP + 1 }, (_, i) => ({
          part: 'H',
          item: `item-${i}`,
          lot: LOT,
          godown: GODOWN,
          bucket: 'SALEABLE',
          oq: dec(1),
          pq: dec(0),
          iq: dec(0),
          xq: dec(0),
          iv: dec(0),
          xv: dec(0),
          n: 0,
          value: null,
          vm: null,
        })),
      );
      big.answer('facts', []);
      big.answer('lastSale', []);
      big.answer('balance', []);
      const b = build(big);
      const run = await b.service.show({ ...Q, limit: 1 });
      expect(await refusal(b.service.export({ runId: run.head.runId, tab: 'ITEMS' }))).toEqual({
        status: 422,
        code: STOCK_SUMMARY_ERROR.TOO_MANY_ROWS,
      });
    });

    it('print: PRINT is checked; a live run prints with no SQL; without one the run is built once for head + rows', async () => {
      const { db, service, runId } = await shown();
      db.answer('rights', [rightsRow({ um_can_print: false })]);
      expect(await refusal(service.printData({ runId, query: null }))).toEqual({
        status: 403,
        code: STOCK_SUMMARY_ERROR.RIGHT_PRINT,
      });
      db.answer('rights', [rightsRow()]);
      const viaRun = await service.printData({ runId, query: null });
      expect(viaRun.totalRows).toBe(2);
      expect(db.$transaction).not.toHaveBeenCalled();
      await service.printData({ runId: null, query: { ...Q } });
      await service.printData({ runId: null, query: { ...Q } });
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(await refusal(service.printData({ runId: LOT, query: null }))).toEqual({
        status: 410,
        code: STOCK_SUMMARY_ERROR.RUN_EXPIRED,
      });
    });

    it('print without a run: head + rows resolved at once (as the print engine does) share ONE build (review S1)', async () => {
      const db = primed();
      const { service, store } = build(db);
      const source = new StockSummaryPrintSource(service, {
        $queryRaw: jest.fn(async () => []),
      } as unknown as PrismaService);
      const request: ProviderRequest = {
        context: {
          companyId: COMPANY,
          branchId: BRANCH,
          accYear: null,
          docId: null,
          userId: null,
          deviceId: null,
        },
        params: { from_date: Q.from, to_date: Q.to },
        lang: 'en',
        rowLimit: 1000,
      };
      const [head, rows] = await Promise.all([
        new StockSummaryHeadProvider(source).resolve(request),
        new StockSummaryRowsProvider(source).resolve(request),
      ]);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.of('pass')).toHaveLength(1);
      expect(store.size().runs).toBe(1);
      expect((head as { items_text: string }).items_text).toBe('2 items');
      expect(rows).toHaveLength(2);
      // the service called twice at once with the same prompts: still one build
      const db2 = primed();
      const b2 = build(db2);
      const [a, b] = await Promise.all([
        b2.service.printData({ runId: null, query: { ...Q } }),
        b2.service.printData({ runId: null, query: { ...Q } }),
      ]);
      expect(a.head.runId).toBe(b.head.runId);
      expect(db2.$transaction).toHaveBeenCalledTimes(1);
      expect(b2.store.size().runs).toBe(1);
    });

    it('print without a run: a refused build refuses both, keeps no entry; an evicted run is built again', async () => {
      const db = primed();
      db.answer('lookup', [lookupRow({ br_comp_id: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' })]);
      const { service, store } = build(db);
      const both = await Promise.all([
        refusal(service.printData({ runId: null, query: { ...Q } })),
        refusal(service.printData({ runId: null, query: { ...Q } })),
      ]);
      expect(both).toEqual([
        { status: 422, code: STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY },
        { status: 422, code: STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY },
      ]);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      // fixed: the next print builds (the refusal was not kept)
      db.answer('lookup', [lookupRow()]);
      const first = await service.printData({ runId: null, query: { ...Q } });
      expect(db.$transaction).toHaveBeenCalledTimes(2);
      // reused within the minute while the run lives…
      await service.printData({ runId: null, query: { ...Q } });
      expect(db.$transaction).toHaveBeenCalledTimes(2);
      // …built again once the store let it go
      store.idleMs = 0;
      const t = Date.now();
      store.now = () => t + 5;
      const again = await service.printData({ runId: null, query: { ...Q } });
      expect(db.$transaction).toHaveBeenCalledTimes(3);
      expect(again.head.runId).not.toBe(first.head.runId);
    });

    it('print honours the group drill: through the live run and through a fresh one', async () => {
      const { db, service, runId } = await shown();
      // Both rows carry no brand: BRAND + NONE keeps both, a brand id keeps none.
      const all = await service.printData({
        runId,
        query: null,
        view: { groupBy: 'BRAND', groupKey: 'NONE' },
      });
      expect(all.totalRows).toBe(2);
      expect(all.printedAs).toContain('Brand: (No brand)');
      const none = await service.printData({
        runId,
        query: null,
        view: { groupBy: 'BRAND', groupKey: LOT },
      });
      expect(none.totalRows).toBe(0);
      expect(db.$transaction).not.toHaveBeenCalled();
      const fresh = await service.printData({
        runId: null,
        query: { ...Q, groupBy: 'BRAND', groupKey: LOT },
        view: { groupBy: 'BRAND', groupKey: LOT },
      });
      expect(fresh.totalRows).toBe(0);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('/branches', () => {
    it('today: stock_balance + stock_transit; columns = branches with anything, the rest left out', async () => {
      const db = primed();
      db.answer('branchCells', [
        { branch: BRANCH, item: ITEM, q: dec(3320), v: dec(79130.77) },
        { branch: OTHER_BRANCH, item: ITEM, q: dec(0), v: dec(0) },
      ]);
      db.answer('transit', [
        {
          out_id: 'o1',
          doc_no: 'trf',
          from_branch: BRANCH,
          from_branch_name: 'CBE',
          to_branch: OTHER_BRANCH,
          to_branch_name: 'Counter2',
          to_godown: null,
          item: ITEM,
          bucket: 'SALEABLE',
          q: dec(18),
          v: dec(429.02),
        },
      ]);
      db.answer('companyBranches', [
        { branch_id: BRANCH, name: 'Acme Foods - Coimbatore Branch' },
        { branch_id: OTHER_BRANCH, name: 'Counter2' },
      ]);
      const { service } = build(db);
      const data = await service.branches(Q);
      expect(data.head).toMatchObject({ kind: 'BRANCHES', source: 'STOCK_BALANCE' });
      expect(data.branches).toEqual([{ branchId: BRANCH, name: 'Acme Foods - Coimbatore Branch' }]);
      expect(data.leftOut).toEqual(['Counter2']);
      expect(data.rows[0]).toMatchObject({
        inTransit: { qty: '18.000', value: '429.02' },
        chain: { qty: '3338.000', value: '79559.79' },
      });
      expect(data.totals).toEqual({
        byBranch: [{ branchId: BRANCH, value: '79130.77' }],
        inTransit: { value: '429.02', transfers: 1 },
        chain: { value: '79559.79' },
      });
      expect(db.of('branchCells')[0].text).toContain('FROM stock.stock_balance b');
      // Later pages through /rows, no SQL.
      db.reset();
      const more = await service.rows({ runId: data.head.runId, page: 1 });
      expect(more.kind).toBe('BRANCHES');
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('a past `to` replays every branch from the ledger at its own pool', async () => {
      const db = primed();
      db.answer('companyBranches', []);
      await build(db).service.branches({ ...Q, from: '2026-10-01', to: '2026-10-31' });
      expect(db.of('branchCells')[0].text).toContain('bv_val');
      expect(db.of('transitReplay')).toHaveLength(1);
    });
  });

  describe('/item', () => {
    function primedItem(today = '2026-11-14') {
      const db = primed(today);
      db.answer('lookup', [
        lookupRow({ item_id: ITEM, item_company_id: COMPANY, item_is_deleted: false }),
      ]);
      db.answer('facts', [
        {
          item_id: ITEM,
          name: 'Samsung H1',
          code: null,
          group_name: 'coffee powder',
          brand_name: 'Cafe Gold',
          base_unit: 'pcs',
          default_iuc_id: 'iuc',
          default_factor: dec(10),
          default_unit: 'Btl',
        },
      ]);
      db.answer('itemExtra', [{ hsn: '6109', preset_name: null, reorder: dec(5000) }]);
      db.answer('lastSale', [{ item: ITEM, last_sale: null }]);
      db.answer('lastPurchase', [{ d: '2026-11-04', doc_no: 'GRN/1', rate: dec(23.75) }]);
      db.answer('valuation', (_sql, text) => {
        void text;
        return [
          {
            lot: LOT,
            godown: GODOWN,
            bucket: 'SALEABLE',
            q: dec(3320),
            vm: 'WAVG',
            rate: dec(23.834568),
            value: dec(79130.77),
          },
          {
            lot: LOT,
            godown: GODOWN,
            bucket: 'DAMAGED',
            q: dec(100),
            vm: 'WAVG',
            rate: dec(23.834568),
            value: dec(2383.46),
          },
        ];
      });
      db.answer('ilOpening', [
        { q: dec(3320), v: dec(78844.47), lots: 1, rv: dec(0), after_q: dec(0) },
      ]);
      db.answer('ilSummary', [
        {
          part: 'S',
          rtype: null,
          cls: null,
          kind: null,
          ob: null,
          doc_no: null,
          kinds: null,
          n_all: 0,
          n_shown: 0,
          docs: 0,
          n_internal: 0,
          n_pairs: 0,
          n_reval: 0,
          q_all: dec(0),
          v_all: dec(0),
          q_in: dec(0),
          q_out: dec(0),
          v_in: dec(0),
          v_out: dec(0),
          moved: null,
          pair_q: null,
        },
      ]);
      db.answer('lotsNow', [
        {
          godown_id: GODOWN,
          godown_name: 'Coimbatore',
          bucket: 'SALEABLE',
          lot_id: LOT,
          batch_no: null,
          mrp: null,
          expiry: null,
          supplier: null,
          on_hand: dec(3320),
          reserved: dec(10),
          available: dec(3310),
          cost_rate: dec(23.834568),
          value: dec(79130.77),
        },
        {
          godown_id: GODOWN,
          godown_name: 'Coimbatore',
          bucket: 'DAMAGED',
          lot_id: LOT,
          batch_no: null,
          mrp: null,
          expiry: null,
          supplier: null,
          on_hand: dec(100),
          reserved: dec(0),
          available: dec(100),
          cost_rate: dec(23.834568),
          value: dec(2383.46),
        },
      ]);
      db.answer('lotNames', [
        {
          k: 'L',
          id: LOT,
          batch_no: 'B1',
          mrp: dec(30),
          expiry: '2027-01-01',
          supplier: 'Bala',
          name: null,
          sort: null,
        },
        {
          k: 'G',
          id: GODOWN,
          batch_no: null,
          mrp: null,
          expiry: null,
          supplier: null,
          name: 'Coimbatore',
          sort: 1,
        },
      ]);
      return db;
    }

    it('today: lots from stock_balance (in scope flagged), the IL’s movement, the Summary’s values, the row tie', async () => {
      const db = primedItem();
      const b = build(db);
      const run = await b.service.show(Q);
      const data = await b.service.item({
        ...Q,
        itemId: ITEM,
        qtyIn: 'DEFAULT',
        runId: run.head.runId,
      });
      expect(data.item).toMatchObject({
        hsn: '6109',
        gstRate: '18.00',
        trackedAs: 'Plain stock',
        valuation: 'WAVG',
        unit: { name: 'Btl', factor: '10.000000', isBase: false },
        reorderLevel: '500.000',
        belowReorder: true,
        lastPurchase: { date: '2026-11-04', docNo: 'GRN/1', rate: '237.50' },
      });
      expect(data.lots.source).toBe('STOCK_BALANCE');
      expect(data.lots.rows.map((r) => [r.bucket, r.inScope, r.onHand])).toEqual([
        ['SALEABLE', true, '332.000'],
        ['DAMAGED', false, '10.000'],
      ]);
      expect(data.lots.totalInScope).toEqual({
        onHand: '332.000',
        reserved: '1.000',
        available: '331.000',
        value: '79130.77',
      });
      expect(data.movement).toMatchObject({
        opening: { date: '2026-11-01', qty: '332.000', value: '79130.77' },
        closing: { date: '2026-11-14', qty: '332.000', value: '79130.77' },
        costAdj: '0.00',
        ties: { qtyEqual: true, valueEqual: true },
      });
      // ILs fragments, for the same scope (bucket SALEABLE, revaluations in at all godowns).
      expect(db.of('ilOpening')[0].text).toContain('l.sml_bucket = $');
      expect(db.of('valuation').map((c) => c.values.includes('2026-10-31'))).toEqual([false, true]);
    });

    it('a past `to`: the lots are the valued holdings (no reserved / available)', async () => {
      const db = primedItem();
      const data = await build(db).service.item({
        ...Q,
        from: '2026-10-01',
        to: '2026-10-31',
        itemId: ITEM,
      });
      expect(data.lots.source).toBe('LEDGER');
      expect(data.lots.rows[0]).toMatchObject({
        batchNo: 'B1',
        mrp: '30.00',
        supplier: 'Bala',
        godownName: 'Coimbatore',
        reserved: null,
        available: null,
        inScope: true,
      });
      expect(data.lots.totalInScope).toEqual({
        onHand: '3320.000',
        reserved: null,
        available: null,
        value: '79130.77',
      });
      expect(db.of('lotsNow')).toHaveLength(0);
      expect(data.movement.ties.row).toBeNull();
    });
  });

  describe('/options', () => {
    it('godowns, buckets, today, FY, defaults (1st of the month → today), rights', async () => {
      const db = primed();
      db.answer('fy', [{ name: '2026-2027', begin: '2026-04-01', end: '2027-03-31' }]);
      const data = await build(db).service.options({ companyId: COMPANY, branchId: BRANCH });
      expect(data).toMatchObject({
        company: { companyId: COMPANY, name: 'Amazon Retail India Private Limited' },
        branch: { branchId: BRANCH, name: 'Acme Foods - Coimbatore Branch' },
        godowns: [{ godownId: GODOWN, name: 'Coimbatore', short: null }],
        buckets: ['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE', 'ALL'],
        today: '2026-11-14',
        fy: { name: '2026-2027' },
        defaults: {
          from: '2026-11-01',
          to: '2026-11-14',
          bucket: 'SALEABLE',
          valueAt: 'WITHOUT_TAX',
          qtyIn: 'BASE',
          hideZero: true,
          onlyNegative: false,
          noSaleDays: 60,
        },
        rights: { print: true, export: true },
      });
    });
  });
});
