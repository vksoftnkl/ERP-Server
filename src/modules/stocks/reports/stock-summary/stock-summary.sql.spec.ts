import { Prisma } from '@prisma/client';
import { itemValuationSql, poolValuationCtes, valueInScope } from '../common/stock-valuation.sql';
import {
  balanceNowSql,
  branchesNowSql,
  branchesReplaySql,
  factsSql,
  lastSaleSql,
  passSql,
  rowsAfterSql,
  transitNowSql,
  transitReplaySql,
  type SummarySqlScope,
} from './stock-summary.sql';

const flat = (q: Prisma.Sql) => q.text.replace(/\s+/g, ' ').trim();

const S: SummarySqlScope = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  from: '2026-11-01',
  to: '2026-11-14',
  openingAsOf: '2026-10-31',
  godownId: null,
  bucket: 'SALEABLE',
  groupId: null,
  brandId: null,
  wot: true,
};

describe('the engine valuation rule as SQL (reports/common)', () => {
  const q = flat(
    Prisma.sql`WITH h AS (SELECT 1), ${poolValuationCtes({ holdings: 'h', prefix: 'vx', companyId: S.companyId, asOf: '2026-11-14', wot: true })} SELECT 1`,
  );

  it('one pool per (branch, item) for WAVG, per lot for LOT_ACTUAL; revaluations in the pool', () => {
    expect(q).toContain("CASE WHEN p.vm = 'LOT_ACTUAL' THEN x.lot END AS pool_lot");
    expect(q).toContain("CASE WHEN p.vm = 'LOT_ACTUAL' THEN r.scr_lot_id END AS pool_lot");
    expect(q).toContain('ROUND((pl.hv + COALESCE(r.v, 0)) / pl.pq, 6)');
    expect(q).toContain('ROUND(x.q * t.r, 2) AS value');
    expect(q).toContain("COALESCE(stp.stp_valuation_method, 'WAVG')");
  });

  it('a pool at or below 0: 0 when every holding is 0 (the guard), else the latest LIVE row’s rate', () => {
    expect(q).toMatch(
      /WHEN pl\.pq > 0 THEN .* WHEN NOT pl\.has_stock THEN 0::numeric ELSE COALESCE\(\( SELECT x\.sml_cost_rate_wot/,
    );
    expect(q).toContain('x.sml_is_reversal = false');
    expect(q).toContain('y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year');
    expect(q).toContain('ORDER BY x.sml_doc_datetime DESC, x.sml_id DESC LIMIT 1');
  });

  it('every CTE is materialized (a pool’s rate computed once), names are prefixed, basis follows valueAt', () => {
    expect(q.match(/vx_\w+ AS MATERIALIZED/g)).toEqual([
      'vx_pol AS MATERIALIZED',
      'vx_rv AS MATERIALIZED',
      'vx_hp AS MATERIALIZED',
      'vx_pool AS MATERIALIZED',
      'vx_rate AS MATERIALIZED',
      'vx_val AS MATERIALIZED',
    ]);
    const tax = flat(
      Prisma.sql`WITH h AS (SELECT 1), ${poolValuationCtes({ holdings: 'h', prefix: 'vy', companyId: S.companyId, asOf: '2026-11-14', wot: false })} SELECT 1`,
    );
    expect(tax).toContain('SUM(r.scr_value) AS v');
    expect(tax).toContain('SELECT x.sml_cost_rate FROM');
    expect(() =>
      poolValuationCtes({ holdings: 'h; drop', prefix: 'x', companyId: '', asOf: '', wot: true }),
    ).toThrow();
  });

  it('one item: every holding up to the date, index-only on ix_sml_item_ledger’s columns', () => {
    const one = itemValuationSql({
      companyId: S.companyId,
      branchId: S.branchId,
      itemId: 'i',
      asOf: '2026-11-14',
      wot: true,
    });
    expect(flat(one)).toContain('l.sml_doc_date <= $4::date');
    expect(flat(one)).toContain('SELECT lot, godown, bucket, q, vm, rate, value FROM iv_val');
    expect(one.values.slice(0, 4)).toEqual([S.companyId, S.branchId, 'i', '2026-11-14']);
  });

  it('valueInScope sums the scope', () => {
    const d = (v: number) => new Prisma.Decimal(v);
    const rows = [
      {
        lot: 'l1',
        godown: 'g1',
        bucket: 'SALEABLE',
        q: d(3320),
        vm: 'WAVG',
        rate: d(1),
        value: d(79130.77),
      },
      {
        lot: 'l1',
        godown: 'g1',
        bucket: 'DAMAGED',
        q: d(100),
        vm: 'WAVG',
        rate: d(1),
        value: d(2383.46),
      },
      {
        lot: 'l2',
        godown: 'g2',
        bucket: 'SALEABLE',
        q: d(-8),
        vm: 'WAVG',
        rate: d(1),
        value: d(-480),
      },
    ];
    const all = valueInScope(rows, { godownId: null, bucket: null, lotId: null });
    expect([all.qty.toString(), all.value.toString()]).toEqual(['3412', '81034.23']);
    const sal = valueInScope(rows, { godownId: 'g1', bucket: 'SALEABLE', lotId: null });
    expect(sal.value.toString()).toBe('79130.77');
    expect(valueInScope(rows, { godownId: null, bucket: null, lotId: 'l2' }).qty.toString()).toBe(
      '-8',
    );
  });
});

describe('Stock Summary SQL', () => {
  it('the pass: opening before from, period rows, internal pairs in scope, two valuations, three parts', () => {
    const q = flat(passSql(S));
    expect(q).toContain('l.sml_doc_date < $3::date');
    expect(q).toContain('l.sml_doc_date BETWEEN');
    expect(q).toContain('(true AND l.sml_bucket = $4) AS ins');
    expect(q).toContain('HAVING COUNT(DISTINCT nat) = 2');
    expect(q).toContain(
      '(CASE WHEN l.sml_is_reversal THEN -l.sml_direction ELSE l.sml_direction END)::int AS nat',
    );
    expect(q).toContain('vo_val');
    expect(q).toContain('vc_val');
    expect(q).toContain("SELECT 'H'::text AS part");
    expect(q).not.toContain('WITH RECURSIVE');
    expect(passSql(S).values).toEqual(expect.arrayContaining(['2026-10-31', '2026-11-14']));
    expect(q).toMatchSnapshot();
  });

  it('every godown and bucket is read; the scope is only the `ins` flag', () => {
    const q = flat(passSql({ ...S, godownId: 'g', bucket: null }));
    expect(q).toContain('(true AND l.sml_godown_id = $4::uuid ) AS ins');
    expect(q).not.toMatch(/WHERE[^)]*sml_bucket =/);
    expect(flat(passSql({ ...S, bucket: null }))).toContain('true AS ins');
  });

  it('group / brand: the subtree by parent id, applied to every ledger read', () => {
    const q = flat(passSql({ ...S, groupId: 'grp', brandId: 'brd' }));
    expect(q.startsWith('WITH RECURSIVE gt AS (')).toBe(true);
    expect(q).toContain('JOIN gt ON c.itg_parent_id = gt.id');
    expect(q).toContain('JOIN bt ON c.brand_parent_id = bt.id');
    expect(q.match(/sml_item_id IN \(SELECT item_id FROM it\)/g)).toHaveLength(2);
    for (const other of [balanceNowSql, rowsAfterSql, branchesNowSql, branchesReplaySql]) {
      expect(flat(other({ ...S, groupId: 'grp', brandId: null }))).toContain(
        'IN (SELECT item_id FROM it)',
      );
    }
  });

  it('today-only reads: stock_balance, rows after to, transit IN_TRANSIT / PARTIAL by status', () => {
    expect(flat(balanceNowSql(S))).toContain('b.sbl_stock_value_wot AS value');
    expect(flat(rowsAfterSql(S))).toContain('l.sml_doc_date > $3::date');
    const tin = flat(transitNowSql(S, 'in'));
    expect(tin).toContain("t.stt_status IN ('IN_TRANSIT', 'PARTIAL')");
    expect(tin).toContain('t.stt_to_branch_id = $');
    expect(tin).not.toContain('stt_short_qty');
    expect(flat(transitNowSql(S, 'out'))).toContain('t.stt_from_branch_id = $');
    expect(flat(transitNowSql({ ...S, wot: false }, 'all'))).toContain(
      '* t.stt_cost_rate, 2) AS v',
    );
  });

  it('transit replay: sent − received − settled short (CLOSED step ≤ to)', () => {
    const q = flat(transitReplaySql(S, S.branchId));
    expect(q).toContain("l.sml_txn_type = 'TRANSFER_OUT' AND l.sml_src_doc_type = 'TRANSFER_OUT'");
    expect(q).toContain('v.svh_to_branch_id <> v.svh_branch_id');
    expect(q).toContain("iv.svh_link_src_doc_type = 'STOCK_VOUCHER'");
    expect(q).toContain("c.tsl_event = 'CLOSED'");
    expect(q).toContain("t.stt_status <> 'CANCELLED'");
    expect(q).toContain('snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0) AS q');
    expect(flat(transitReplaySql(S, null))).not.toContain('l.sml_branch_id =');
  });

  it('facts and last sale take the item list as one uuid[]', () => {
    expect(factsSql(['a', 'b']).values).toEqual([['a', 'b']]);
    const ls = flat(lastSaleSql(S, ['a']));
    expect(ls).toContain("x.sml_src_module = 'SALES'");
    expect(ls).toContain("x.sml_txn_type = 'SALE'");
    expect(ls).toContain('ORDER BY x.sml_doc_date DESC LIMIT 1');
  });
});
