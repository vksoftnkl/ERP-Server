import { REPORT_TYPE_CODES, SHADOW_DOC_TYPES } from './item-ledger.rules';
import {
  ledgerChain,
  openingSql,
  optionTypesSql,
  pageSql,
  periodSql,
  reportTypeCase,
  revaluationsLeftOutSql,
  stockNowSql,
  summarySql,
  type LedgerSqlScope,
} from './item-ledger.sql';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const ITEM = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const LOT = 'dd08de2b-18f1-575d-b653-df1765055465';

const scope = (over: Partial<LedgerSqlScope> = {}): LedgerSqlScope => ({
  companyId: COMPANY,
  branchId: BRANCH,
  itemId: ITEM,
  from: '2026-11-01',
  to: '2026-11-10',
  godownId: null,
  bucket: 'SALEABLE',
  lotId: null,
  wot: true,
  withRevaluations: true,
  types: [],
  showReversed: true,
  ...over,
});

const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Every column of `stock.ix_sml_item_ledger` (migration 20261111130000):
 * key (company, branch, item, doc_date) + INCLUDE (signed qty, direction, cost
 * values, godown, lot, bucket) + its predicate column.
 */
const COVERED = new Set([
  'sml_company_id',
  'sml_branch_id',
  'sml_item_id',
  'sml_doc_date',
  'sml_signed_base_qty',
  'sml_direction',
  'sml_cost_value',
  'sml_cost_value_wot',
  'sml_godown_id',
  'sml_lot_id',
  'sml_bucket',
  'sml_is_deleted',
]);

describe('item-ledger SQL', () => {
  describe('openingSql (D12) — an index-only scan on ix_sml_item_ledger', () => {
    it('reads only the covering index’s columns of stock_ledger', () => {
      for (const s of [
        scope(),
        scope({ godownId: GODOWN, lotId: LOT, bucket: null, wot: false }),
      ]) {
        const text = openingSql(s, true).text;
        const cols = new Set(text.match(/\bsml_[a-z_]+/g));
        for (const c of cols) expect(COVERED.has(c)).toBe(true);
      }
    });

    it('sums every row before `from`, all years, and the rows after `to` for the tie', () => {
      const sql = openingSql(scope(), true);
      const text = flat(sql.text);
      expect(text).toContain('l.sml_doc_date < $');
      expect(text).toContain('a.sml_doc_date > $');
      expect(text).not.toMatch(/sml_acc_year/);
      expect(sql.values).toContain('2026-11-01');
      expect(sql.values).toContain('2026-11-10');
      expect(text).toContain('stock.stock_cost_revaluation');
    });

    it('drops the revaluation and after-`to` parts when not wanted', () => {
      const text = flat(openingSql(scope({ withRevaluations: false }), false).text);
      expect(text).not.toContain('stock_cost_revaluation');
      expect(text).toContain('0::numeric AS rv');
      expect(text).toContain('0::numeric AS after_q');
    });

    it('picks the cost basis by column, never by a parameter', () => {
      expect(openingSql(scope({ wot: true }), false).text).toContain('l.sml_cost_value_wot');
      const withTax = openingSql(scope({ wot: false }), false).text;
      expect(withTax).toContain('l.sml_cost_value)');
      expect(withTax).not.toContain('sml_cost_value_wot');
    });
  });

  describe('the scope filters (D16)', () => {
    it('leaves an absent filter out instead of `$x IS NULL OR …`', () => {
      const text = flat(ledgerChain(scope({ bucket: null })).text);
      expect(text).not.toContain('sml_godown_id = $');
      expect(text).not.toContain('sml_bucket = $');
      expect(text).not.toContain('sml_lot_id = $');
      expect(text).not.toMatch(/IS NULL OR/);
    });

    it('binds godown, bucket and lot when given', () => {
      const sql = ledgerChain(scope({ godownId: GODOWN, lotId: LOT, bucket: 'DAMAGED' }));
      const text = flat(sql.text);
      expect(text).toContain('l.sml_godown_id = $');
      expect(text).toContain('l.sml_bucket = $');
      expect(text).toContain('l.sml_lot_id = $');
      expect(sql.values).toEqual(expect.arrayContaining([GODOWN, LOT, 'DAMAGED']));
    });

    it('revaluations come in only when allowed (D17)', () => {
      expect(flat(ledgerChain(scope({ withRevaluations: false })).text)).toContain(
        'FROM stock.stock_cost_revaluation r WHERE false',
      );
      expect(flat(ledgerChain(scope()).text)).toContain(
        'FROM stock.stock_cost_revaluation r WHERE true',
      );
    });
  });

  describe('ledgerChain', () => {
    const text = flat(ledgerChain(scope()).text);

    it('reads the period rows of the holding only', () => {
      expect(text).toContain('l.sml_doc_date BETWEEN $');
      expect(text).toContain('l.sml_is_deleted = false');
    });

    it('pairs both legs of a move inside the scope into one internal row (D15)', () => {
      expect(text).toContain("txn IN ('TRANSFER_OUT','TRANSFER_IN','BUCKET_OUT','BUCKET_IN')");
      expect(text).toContain('HAVING COUNT(DISTINCT nat_dir) = 2');
      expect(text).toContain(
        "CASE WHEN internal THEN CASE WHEN txn LIKE 'TRANSFER%' THEN 'TRANSFER' ELSE 'BUCKET' END",
      );
    });

    it('pairs an original with its reversal by one key, compared byte-wise', () => {
      expect(text).toContain('COLLATE "C" AS gk');
      expect(text).toContain('LEFT JOIN og o ON t.is_rev AND o.gk = t.gk');
      expect(text).toContain('LEFT JOIN rv r ON NOT t.is_rev AND r.gk = t.gk');
      expect(text).toContain('o.sq + t.sq = 0 AND o.sv + t.sv = 0');
    });

    it('calls a reversed shadow AMENDED when a later non-draft shadow of the same document exists (D14)', () => {
      expect(text).toContain('w.svh_link_src_doc_id = v.svh_link_src_doc_id');
      expect(text).toContain('w.svh_created_on > v.svh_created_on');
      expect(text).toContain("w.svh_status <> 'DRAFT'");
      expect(ledgerChain(scope()).values).toEqual(expect.arrayContaining([...SHADOW_DOC_TYPES]));
    });

    it('sorts a reversal right after its original', () => {
      expect(text).toContain('COALESCE(s.o_dt, s.dt) AS k_dt');
      expect(text).toContain('COALESCE(s.o_pon, s.pon) AS k_pon');
      expect(text).toContain('COALESCE(s.o_row, s.row_id) AS k_row');
    });

    it('row filters only set `shown`: types and the hidden pairs', () => {
      const typed = ledgerChain(scope({ types: ['SALE', 'GRN'], showReversed: false }));
      expect(flat(typed.text)).toContain('s.rtype = ANY($');
      expect(typed.values).toEqual(expect.arrayContaining([['SALE', 'GRN'], false]));
      expect(flat(typed.text)).toContain('OR NOT s.nets_zero');
      // No filter: the list is a placeholder and `typesAll` is true.
      const all = ledgerChain(scope());
      expect(all.values).toEqual(expect.arrayContaining([true, ['-'], true]));
    });

    it('is stable', () => {
      expect(text).toMatchSnapshot();
    });
  });

  it('reportTypeCase yields every report type code', () => {
    const text = reportTypeCase('a', 'tv', BRANCH).text;
    for (const code of REPORT_TYPE_CODES) expect(text).toContain(`'${code}'`);
    expect(flat(text)).toContain("THEN 'BRANCH_OUT' ELSE 'GODOWN_TRANSFER' END");
  });

  describe('pageSql', () => {
    it('numbers and balances in ascending posting order, then pages the rows shown', () => {
      const sql = pageSql(scope(), { order: 'desc', limit: 7, offset: 14 });
      const text = flat(sql.text);
      expect(text).toContain(
        'WINDOW w AS (ORDER BY f.d, f.k_dt, f.k_pon, f.k_row, f.is_rev, f.row_id ROWS UNBOUNDED PRECEDING)',
      );
      expect(text).toContain('SELECT * FROM seqd WHERE shown ORDER BY seq DESC LIMIT $');
      expect(text).toMatch(/ORDER BY pg\.seq DESC$/);
      expect(sql.values).toEqual(expect.arrayContaining([7, 14]));
    });

    it('reaches the bill through the shadow voucher’s link', () => {
      const text = flat(pageSql(scope(), { order: 'asc', limit: 1000, offset: 0 }).text);
      expect(text).toContain(
        "v.svh_link_src_doc_type = 'SALE_BILL' AND sb.sb_id = v.svh_link_src_doc_id",
      );
      expect(text).toContain(
        "v.svh_link_src_doc_type = 'GRN' AND grn.grn_id = v.svh_link_src_doc_id",
      );
      expect(text).toContain('t.stt_out_voucher_id = pg.doc_id');
      expect(text).toContain("to_char(pg.dt AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')");
    });
  });

  it('summarySql answers the four parts in one statement', () => {
    const text = flat(summarySql(scope()).text);
    for (const part of ["'S'::text AS part", "SELECT 'B'", "SELECT 'T'", "SELECT DISTINCT 'C'"]) {
      expect(text).toContain(part);
    }
    // The closing sums every row; the Period total only the rows shown.
    expect(text).toContain('COALESCE(SUM(f.sq), 0) AS q_all');
    expect(text).toContain(
      "COALESCE(SUM(f.sq) FILTER (WHERE f.shown AND f.kind = 'IN'), 0) AS q_in",
    );
  });

  it('periodSql groups by day or month', () => {
    expect(flat(periodSql(scope(), 'day').text)).toContain('SELECT f.d::text AS k');
    expect(flat(periodSql(scope(), 'month').text)).toContain("SELECT to_char(f.d, 'YYYY-MM') AS k");
  });

  it('stockNowSql marks the rows in scope without a constant ORDER BY', () => {
    const all = flat(stockNowSql(scope({ bucket: null })).text);
    expect(all).toContain('(true ) AS in_scope');
    expect(all).toContain('ORDER BY in_scope DESC');
    const one = flat(stockNowSql(scope({ godownId: GODOWN, lotId: LOT })).text);
    expect(one).toContain('AND b.sbl_godown_id = $');
    expect(one).toContain('AND b.sbl_lot_id = $');
    expect(one).toContain('b.sbl_stock_value_wot AS value');
    expect(flat(stockNowSql(scope({ wot: false })).text)).toContain('b.sbl_stock_value AS value');
  });

  it('the revaluations-left-out note counts every one up to `to` (the opening drops the earlier ones too)', () => {
    const sql = revaluationsLeftOutSql(scope({ withRevaluations: false, lotId: LOT }));
    const text = flat(sql.text);
    expect(text).toContain('r.scr_doc_date <= $');
    expect(text).not.toContain('BETWEEN');
    expect(text).toContain('r.scr_lot_id = $');
    expect(sql.values).toContain('2026-11-10');
    expect(sql.values).not.toContain('2026-11-01');
  });

  it('the small statements', () => {
    expect(flat(optionTypesSql(COMPANY, BRANCH, ITEM).text)).toContain(
      'SELECT DISTINCT l.sml_txn_type::text AS txn, l.sml_src_doc_type::text AS src_type',
    );
  });
});
