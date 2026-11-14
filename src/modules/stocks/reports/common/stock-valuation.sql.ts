import { Prisma } from '@prisma/client';
import { effectivePolicyLateral } from '../../stock-voucher/stock-voucher-posting.helper';

/**
 * The stock engine's VALUATION RULE, as the stock reports read it (Stock
 * Summary plan 2026-11-13 §1.2 / §5.5, D18; Item Ledger P2-IL).
 *
 * The engine (`rebuildLotCosts` / `rebuildItemCosts` + `stampItemAverage` in
 * stock-voucher-posting.helper.ts) stores every `stock_balance` row as
 * `ROUND(on_hand × pool rate, 2)`, the pool being the BRANCH's:
 *
 *   - a plain item (valuation WAVG, the no-policy default): one pool per
 *     (branch, item) across every godown, bucket and lot;
 *   - a tracked item (LOT_ACTUAL): one pool per (branch, item, lot).
 *
 * pool rate = ROUND(pool value ÷ pool qty, 6) while the pool qty > 0, the
 * value including the `stock_cost_revaluation` rows; at or below 0 the cost
 * rate of the pool's latest LIVE row (forward, not reversed; by
 * `sml_doc_datetime DESC, sml_id DESC`); 0 when every holding of the pool is
 * 0 (the rate cannot matter, and probing for it cost 620 ms on the dev box).
 *
 * Replayed at a date it is the value "as the engine would have stored it on
 * that day" (reversal rows carry their original's doc date, so a cancel is
 * read as the books stand now — the report's own rule). At today it equals
 * `stock_balance` to the paisa: 954 / 954 holdings at Coimbatore on
 * 2026-11-13 (`report/sql/stock_summary_valuation_probe_2026-11-13.sql`).
 *
 * Read-only. The policy comes from the engine's own `effectivePolicyLateral`
 * at the date, so the reports and the post cannot disagree on WAVG vs
 * LOT_ACTUAL. No DB function: this is SQL text built here.
 */

export interface PoolValuationOptions {
  /**
   * An already-defined CTE with one row per holding, as of `asOf`, of EVERY
   * godown and bucket of each item it names (the pool needs them all; a
   * godown / bucket scope is applied by the caller AFTER valuing):
   * `branch uuid, item uuid, lot uuid, godown uuid, bucket text, q numeric, v numeric`
   * (`q` = Σ signed base qty, `v` = Σ direction × cost value on the chosen basis).
   */
  holdings: string;
  /**
   * Prefix of the CTE names this adds, so two valuations (opening, closing)
   * can sit in one statement: `<p>_pol`, `<p>_rv`, `<p>_hp`, `<p>_pool`,
   * `<p>_rate` and the output `<p>_val`.
   */
  prefix: string;
  companyId: string;
  /** The books are read up to and including this date (`YYYY-MM-DD`). */
  asOf: string;
  /** Cost without tax (`_wot` columns) or with tax. */
  wot: boolean;
}

const IDENT = /^[a-z][a-z0-9_]*$/;

function ident(name: string): Prisma.Sql {
  if (!IDENT.test(name)) throw new Error(`stock valuation: bad CTE name ${name}`);
  return Prisma.raw(name);
}

/**
 * The valuation CTEs, to be spliced after the caller's `WITH …, <holdings> AS
 * (…),`. They end in `<p>_val`: one row per holding of `<holdings>` —
 * `branch, item, lot, godown, bucket, q, v, vm, rate, value` — with
 * `value = ROUND(q × rate, 2)` (D18).
 *
 * The fallback probe (latest live row of a pool at or below 0 WITH stock)
 * runs on `ix_sml_item_date` / `ix_sml_lot` + `ux_sml_reversal`, only for
 * those pools (32 of 954 at Coimbatore).
 *
 * Every CTE here is MATERIALIZED: the planner cannot estimate the (branch,
 * item) correlation and, left to inline them, nested-looped the correlated
 * fallback probe per joined row — over 60 s for 982 holdings instead of
 * ~50 ms. Materialized, each pool's rate is computed exactly once.
 */
export function poolValuationCtes(o: PoolValuationOptions): Prisma.Sql {
  const h = ident(o.holdings);
  const pol = ident(`${o.prefix}_pol`);
  const rv = ident(`${o.prefix}_rv`);
  const hp = ident(`${o.prefix}_hp`);
  const pool = ident(`${o.prefix}_pool`);
  const rate = ident(`${o.prefix}_rate`);
  const val = ident(`${o.prefix}_val`);
  const scrValue = Prisma.raw(o.wot ? 'r.scr_value_wot' : 'r.scr_value');
  const lastRate = Prisma.raw(o.wot ? 'x.sml_cost_rate_wot' : 'x.sml_cost_rate');
  return Prisma.sql`
    ${pol} AS MATERIALIZED (
      SELECT k.branch, k.item, COALESCE(stp.stp_valuation_method, 'WAVG')::text AS vm
        FROM (SELECT DISTINCT branch, item FROM ${h}) k
        JOIN inventory.item_master itm ON itm.item_id = k.item
        ${effectivePolicyLateral({
          companyId: Prisma.sql`${o.companyId}::uuid`,
          branchId: Prisma.raw('k.branch'),
          itemId: Prisma.raw('k.item'),
          itemGroupId: Prisma.raw('itm.item_group_id'),
          onDate: Prisma.sql`${o.asOf}::date`,
        })}),
    ${rv} AS MATERIALIZED (
      SELECT r.scr_branch_id AS branch, r.scr_item_id AS item,
             CASE WHEN p.vm = 'LOT_ACTUAL' THEN r.scr_lot_id END AS pool_lot,
             SUM(${scrValue}) AS v
        FROM stock.stock_cost_revaluation r
        JOIN ${pol} p ON p.branch = r.scr_branch_id AND p.item = r.scr_item_id
       WHERE r.scr_company_id = ${o.companyId}::uuid
         AND r.scr_is_deleted = false
         AND r.scr_doc_date <= ${o.asOf}::date
       GROUP BY 1, 2, 3),
    ${hp} AS MATERIALIZED (
      SELECT x.branch, x.item, x.lot, x.godown, x.bucket, x.q, x.v, p.vm,
             CASE WHEN p.vm = 'LOT_ACTUAL' THEN x.lot END AS pool_lot
        FROM ${h} x
        JOIN ${pol} p ON p.branch = x.branch AND p.item = x.item),
    ${pool} AS MATERIALIZED (
      SELECT branch, item, pool_lot,
             SUM(q) AS pq, bool_or(q <> 0) AS has_stock, SUM(v) AS hv
        FROM ${hp}
       GROUP BY 1, 2, 3),
    ${rate} AS MATERIALIZED (
      SELECT pl.branch, pl.item, pl.pool_lot,
             CASE WHEN pl.pq > 0 THEN ROUND((pl.hv + COALESCE(r.v, 0)) / pl.pq, 6)
                  WHEN NOT pl.has_stock THEN 0::numeric
                  ELSE COALESCE((
                    SELECT ${lastRate}
                      FROM stock.stock_ledger x
                     WHERE x.sml_company_id = ${o.companyId}::uuid
                       AND x.sml_branch_id = pl.branch
                       AND x.sml_item_id = pl.item
                       AND (pl.pool_lot IS NULL OR x.sml_lot_id = pl.pool_lot)
                       AND x.sml_is_deleted = false
                       AND x.sml_is_reversal = false
                       AND x.sml_doc_date <= ${o.asOf}::date
                       AND NOT EXISTS (
                         SELECT 1 FROM stock.stock_ledger y
                          WHERE y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year
                            AND y.sml_is_reversal = true AND y.sml_is_deleted = false)
                     ORDER BY x.sml_doc_datetime DESC, x.sml_id DESC
                     LIMIT 1), 0::numeric)
             END AS r
        FROM ${pool} pl
        LEFT JOIN ${rv} r
          ON r.branch = pl.branch AND r.item = pl.item
         AND r.pool_lot IS NOT DISTINCT FROM pl.pool_lot),
    ${val} AS MATERIALIZED (
      SELECT x.branch, x.item, x.lot, x.godown, x.bucket, x.q, x.v, x.vm,
             t.r AS rate, ROUND(x.q * t.r, 2) AS value
        FROM ${hp} x
        JOIN ${rate} t
          ON t.branch = x.branch AND t.item = x.item
         AND t.pool_lot IS NOT DISTINCT FROM x.pool_lot)`;
}

/** One valued holding of one item (the Item Ledger's closing, P2-IL). */
export interface ValuedHoldingRow {
  lot: string;
  godown: string;
  bucket: string;
  q: Prisma.Decimal;
  vm: string;
  rate: Prisma.Decimal;
  value: Prisma.Decimal;
}

/**
 * Every holding of ONE item at ONE branch as of `asOf`, valued by the engine's
 * rule — all godowns, buckets and lots (the caller sums its scope). The
 * holdings are read through `ix_sml_item_ledger` (index-only: every column is
 * in its key or INCLUDE list).
 */
export function itemValuationSql(s: {
  companyId: string;
  branchId: string;
  itemId: string;
  asOf: string;
  wot: boolean;
}): Prisma.Sql {
  const v = Prisma.raw(s.wot ? 'l.sml_cost_value_wot' : 'l.sml_cost_value');
  return Prisma.sql`
    WITH ih AS (
      SELECT l.sml_branch_id AS branch, l.sml_item_id AS item, l.sml_lot_id AS lot,
             l.sml_godown_id AS godown, l.sml_bucket::text AS bucket,
             SUM(l.sml_signed_base_qty) AS q, SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_branch_id = ${s.branchId}::uuid
         AND l.sml_item_id = ${s.itemId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date <= ${s.asOf}::date
       GROUP BY 1, 2, 3, 4, 5),
    ${poolValuationCtes({
      holdings: 'ih',
      prefix: 'iv',
      companyId: s.companyId,
      asOf: s.asOf,
      wot: s.wot,
    })}
    SELECT lot, godown, bucket, q, vm, rate, value FROM iv_val`;
}

/**
 * Σ value of the holdings in a scope (godown / bucket / lot; null = all), and
 * whether any of them is a pool valued at its fallback rate. Pure.
 */
export function valueInScope(
  rows: readonly ValuedHoldingRow[],
  scope: { godownId: string | null; bucket: string | null; lotId: string | null },
): { qty: Prisma.Decimal; value: Prisma.Decimal } {
  let qty = new Prisma.Decimal(0);
  let value = new Prisma.Decimal(0);
  for (const r of rows) {
    if (scope.godownId && r.godown !== scope.godownId) continue;
    if (scope.bucket && r.bucket !== scope.bucket) continue;
    if (scope.lotId && r.lot !== scope.lotId) continue;
    qty = qty.plus(r.q);
    value = value.plus(r.value);
  }
  return { qty, value };
}
