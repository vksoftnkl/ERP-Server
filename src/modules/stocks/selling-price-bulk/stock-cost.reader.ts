import { Prisma } from '@prisma/client';
import { toNumber } from 'src/common/utils/module-service.utils';

/**
 * Change Selling Price P1 (plan 2026-11-23 §7.4) — StockCostReader: the STOCK cost of a price
 * line, apart from the line's own cost (`ipm_cost_price`, the last purchase cost).
 *
 * The stock cost is what was paid HERE: on an MRP line that MRP's landing cost (its lots'
 * `sbl_avg_cost_rate_wot`, weighted by what is on hand — notes 75 / 92), else the branch's moving
 * average (`stock_item_cost`, its _wot), times the unit's `iuc_to_base_factor`. Null when the branch has
 * neither. It is never the price row's cost: that is the other half of A3's "higher of the two".
 *
 * Used by the grid's Stock cost column and its other-branches tip (C5), the every-branch
 * below-cost check of an All branches save (C6, O10), and — P4 — the item card's check.
 *
 * ONE FOOTING (CSP P2 follow-up, user "Go" 2026-11-27): the SQL here answers the stock cost
 * WITHOUT GST only (`stockCostWot`): a purchase lot is costed on the ITC figure (its
 * slt_cost_rate equals slt_cost_rate_wot, and so do the balance and branch averages built from
 * it), so the stored "cost_rate" is not a with-GST figure and is not read. The with-GST stock
 * cost (`stockCost`) is ALWAYS `stockCostWithGst` below, the line cost's own rule.
 */

/**
 * THE stock cost WITH GST — the one definition every reader of the stock cost uses (the save's
 * row costs, the grid's Stock cost column and purchase-lines, the other branches C5 / C6):
 * `stockCostWot` × (1 + the item's GST %), 6 decimals half up — decision 12 of the P2 plan, the
 * rule the line's own cost is stored by (Cost = Cost Wot × (1 + GST %)). So A3-C compares the
 * line's cost and the stock cost on one footing. `taxPerc` is the item's GST % as the line uses
 * it (resolveItemTaxRates, as of the line's day). Null = no stock cost (none, or not above 0).
 */
export function stockCostWithGst(
  stockCostWot: Prisma.Decimal.Value | null | undefined,
  taxPerc: Prisma.Decimal.Value,
): number | null {
  if (stockCostWot === null || stockCostWot === undefined) {
    return null;
  }
  const wot = new Prisma.Decimal(stockCostWot);
  if (!wot.greaterThan(0)) {
    return null;
  }
  return wot
    .plus(wot.times(taxPerc).dividedBy(100))
    .toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * One MRP's lot cost at one branch, per BASE unit, as a LATERAL subquery body:
 * `(…) alias` yields `cost_rate`, `cost_rate_wot`, and no row when no lot carries the MRP.
 * Σ value ÷ Σ qty over the lots with stock on hand; with nothing on hand the plain average
 * of the lots' rates (a sold-out MRP still shows what it cost). The ONE definition:
 * `mrpCostCte` in price-bucket.gateway.ts runs the same body for the branch on screen.
 */
export function mrpLotCostLateral(a: {
  companyId: Prisma.Sql;
  branchId: Prisma.Sql;
  itemId: Prisma.Sql;
  mrp: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`(
          WITH lots AS (
            SELECT b.sbl_lot_id                                   AS lot_id,
                   GREATEST(SUM(b.sbl_on_hand_qty), 0)            AS qty,
                   SUM(b.sbl_stock_value)                         AS value,
                   SUM(b.sbl_stock_value_wot)                     AS value_wot,
                   MAX(b.sbl_avg_cost_rate)                       AS rate,
                   MAX(b.sbl_avg_cost_rate_wot)                   AS rate_wot
              FROM stock.stock_balance b
              JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
             WHERE b.sbl_company_id = ${a.companyId}
               AND b.sbl_branch_id  = ${a.branchId}
               AND b.sbl_item_id    = ${a.itemId}
               AND slt.slt_key_mrp  = ${a.mrp}
               AND b.sbl_is_deleted = false
             GROUP BY b.sbl_lot_id
          )
          SELECT CASE WHEN SUM(l.qty) > 0
                      THEN SUM(l.value) FILTER (WHERE l.qty > 0) / SUM(l.qty)
                      ELSE AVG(l.rate) FILTER (WHERE l.rate <> 0) END         AS cost_rate,
                 CASE WHEN SUM(l.qty) > 0
                      THEN SUM(l.value_wot) FILTER (WHERE l.qty > 0) / SUM(l.qty)
                      ELSE AVG(l.rate_wot) FILTER (WHERE l.rate_wot <> 0) END AS cost_rate_wot
            FROM lots l
          HAVING count(*) > 0
        )`;
}

/**
 * The stock-cost columns from the aliases a statement joined: `mc` = the MRP lot cost (only
 * for an MRP key), `sic` = stock_item_cost, `factor` = the unit's iuc_to_base_factor, `mrpKey`
 * = the SQL predicate "this line is keyed on an MRP". Unlike the old `costColumns` there is no
 * price-row fallback: no stock cost is NULL. `wot` is the stock cost WITHOUT GST per one of the
 * unit; there is no with-GST column (2026-11-27): the caller makes it with `stockCostWithGst`.
 *
 * U2 (user 2026-11-24): an MRP line takes ONLY that MRP's lot cost. With no lot of the MRP at
 * the branch it has NO stock cost (the item's branch average mixes the other MRPs' lots, e.g.
 * 341.67 from lots at 25 and 500), so below cost is judged on the line's own cost alone and
 * the Stock cost column is blank. The branch average is for a line that is not keyed on an MRP.
 * S7 (user 2026-11-24): an MRP item's main line ("other MRPs") has no stock cost at all — it prices
 * only the MRPs with no line of their own, and the branch average mixes every MRP's lots.
 */
export function stockCostColumns(a: {
  mc: string;
  sic: string;
  factor: string;
  mrpKey: string;
  /** S7 (user 2026-11-24): true = the line has NO stock cost — an MRP item's main line ("other MRPs"). */
  none?: string;
}): {
  wot: Prisma.Sql;
  basis: Prisma.Sql;
} {
  const mrpWot = `NULLIF(${a.mc}.cost_rate_wot, 0)`;
  const itemWot = `NULLIF(${a.sic}.sic_avg_cost_rate_wot, 0)`;
  const onMrp = `COALESCE((${a.mrpKey}), false)`;
  const none = a.none ? `WHEN COALESCE((${a.none}), false) THEN NULL ` : '';
  return {
    wot: Prisma.raw(
      `CASE ${none}WHEN ${onMrp} THEN ${mrpWot} * ${a.factor} ELSE ${itemWot} * ${a.factor} END`,
    ),
    basis: Prisma.raw(
      `CASE ${none}WHEN ${onMrp} THEN CASE WHEN ${mrpWot} IS NOT NULL THEN 'MRP' END` +
        ` WHEN ${itemWot} IS NOT NULL THEN 'ITEM' END`,
    ),
  };
}

/** One line to probe at the other branches: its item, unit and (policy-blanked) key. */
export interface StockCostProbe {
  itemId: string;
  uomId: string;
  mrp: number | null;
  salePrice: number | null;
  /** The item's GST % as the line uses it: the other branches' stock cost is made WITH it (stockCostWithGst). */
  taxPerc: number;
}

/** One other branch that reads a line and has a stock cost for it. */
export interface BranchStockCost {
  branchId: string;
  /** br_short, else br_name. */
  branchName: string;
  /** On hand at that branch for the key, in the line's unit. */
  stockQty: number;
  /** Per one of the line's unit, WITH GST: stockCostWithGst(stockCostWot, the probe's taxPerc). */
  stockCost: number;
  /** Per one of the line's unit, without GST (what the lots / the branch average carry). */
  stockCostWot: number;
  basis: 'MRP' | 'ITEM';
}

export const StockCostReader = {
  /**
   * C5 / C6 / O10 — for each probe, every OTHER active branch of the company that reads an
   * All branches line of that key: saleable stock on hand for the key (an MRP / sale-price
   * key: that bucket; the headline: the whole item), NO live own line for the unit and key in
   * force on `onDate`, and a stock cost above 0. Answers one list per probe, in probe order,
   * each by branch name. The other branches' stock is matched on the key as the branch on
   * screen blanked it (a policy that differs per branch is not re-resolved here).
   */
  async otherBranches(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    args: {
      companyId: string;
      excludeBranchId: string;
      /** `YYYY-MM-DD`; today when absent. */
      onDate?: string;
      probes: readonly StockCostProbe[];
    },
  ): Promise<BranchStockCost[][]> {
    if (!args.probes.length) {
      return [];
    }
    const day = args.onDate ? Prisma.sql`${args.onDate}::date` : Prisma.raw('CURRENT_DATE');
    const cost = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'p.factor', mrpKey: 'p.mrp IS NOT NULL' });
    const rows = await client.$queryRaw<
      Array<{
        ord: bigint;
        branchId: string;
        branchName: string;
        stockQty: Prisma.Decimal | null;
        stockCostWot: Prisma.Decimal | null;
        basis: 'MRP' | 'ITEM' | null;
      }>
    >`
      WITH q AS (
        SELECT q.item_id::uuid AS item_id, q.uom_id::uuid AS uom_id,
               NULLIF(q.mrp, '')::numeric AS mrp, NULLIF(q.sp, '')::numeric AS sp, q.ord
          FROM unnest(${args.probes.map((p) => p.itemId)}::text[],
                      ${args.probes.map((p) => p.uomId)}::text[],
                      ${args.probes.map((p) => (p.mrp === null ? '' : String(p.mrp)))}::text[],
                      ${args.probes.map((p) => (p.salePrice === null ? '' : String(p.salePrice)))}::text[])
               WITH ORDINALITY AS q(item_id, uom_id, mrp, sp, ord)
      ),
      br AS (
        SELECT b.br_id, COALESCE(NULLIF(btrim(b.br_short), ''), b.br_name) AS br_label
          FROM public.branch_master b
         WHERE b.br_comp_id    = ${args.companyId}::uuid
           AND b.br_is_deleted = false
           AND b.br_is_active  = true
           AND b.br_id        <> ${args.excludeBranchId}::uuid
      ),
      p AS (
        SELECT q.*, br.br_id, br.br_label, iuc.iuc_to_base_factor AS factor
          FROM q
          CROSS JOIN br
          JOIN inventory.item_unit_conversion iuc
            ON iuc.iuc_id = q.uom_id AND iuc.iuc_item_id = q.item_id AND iuc.iuc_is_deleted = false
      )
      SELECT p.ord,
             p.br_id    AS "branchId",
             p.br_label AS "branchName",
             st.qty / NULLIF(p.factor, 0) AS "stockQty",
             ${cost.wot}   AS "stockCostWot",
             ${cost.basis} AS "basis"
        FROM p
        CROSS JOIN LATERAL (
          SELECT SUM(b.sbl_on_hand_qty) AS qty
            FROM stock.stock_balance b
           WHERE b.sbl_company_id = ${args.companyId}::uuid
             AND b.sbl_branch_id  = p.br_id
             AND b.sbl_item_id    = p.item_id
             AND b.sbl_bucket     = 'SALEABLE'
             AND b.sbl_is_deleted = false
             AND (p.mrp IS NULL OR b.sbl_mrp = p.mrp)
             AND (p.sp  IS NULL OR b.sbl_sale_price = p.sp)
        ) st
        LEFT JOIN LATERAL ${mrpLotCostLateral({
          companyId: Prisma.sql`${args.companyId}::uuid`,
          branchId: Prisma.raw('p.br_id'),
          itemId: Prisma.raw('p.item_id'),
          mrp: Prisma.raw('p.mrp'),
        })} mc ON p.mrp IS NOT NULL
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${args.companyId}::uuid
              AND sic.sic_branch_id  = p.br_id
              AND sic.sic_item_id    = p.item_id
              AND sic.sic_is_deleted = false
       WHERE st.qty > 0
         AND NOT EXISTS (
               SELECT 1
                 FROM inventory.item_price_master o
                WHERE o.ipm_item_id    = p.item_id
                  AND o.ipm_uc_unit_id = p.uom_id
                  AND o.ipm_branch_id  = p.br_id
                  AND (o.ipm_company_id IS NULL OR o.ipm_company_id = ${args.companyId}::uuid)
                  AND o.ipm_key_mrp    = COALESCE(p.mrp, -1)
                  AND o.ipm_key_sp     = COALESCE(p.sp, -1)
                  AND o.ipm_is_deleted = false
                  AND ${day} BETWEEN o.ipm_effective_from AND o.ipm_effective_to)
       ORDER BY p.ord, p.br_label
    `;
    const out: BranchStockCost[][] = args.probes.map(() => []);
    for (const row of rows) {
      const probe = args.probes[Number(row.ord) - 1];
      const stockCost = probe ? stockCostWithGst(row.stockCostWot, probe.taxPerc) : null;
      if (stockCost === null || row.basis === null) {
        continue;
      }
      out[Number(row.ord) - 1]?.push({
        branchId: row.branchId,
        branchName: row.branchName,
        stockQty: row.stockQty === null ? 0 : toNumber(row.stockQty),
        stockCost,
        stockCostWot: row.stockCostWot === null ? 0 : toNumber(row.stockCostWot),
        basis: row.basis,
      });
    }
    return out;
  },
};
