import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { looseSearchSql } from 'src/common/search/loose-search';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { toNumber } from 'src/common/utils/module-service.utils';
import {
  bucketKeySql,
  effectivePolicyLateral,
} from '../stock-voucher/stock-voucher-posting.helper';
import type { ScopeResolution } from './selling-price-scope.helper';
import {
  StockCostReader,
  mrpLotCostLateral,
  stockCostColumns,
  type BranchStockCost,
  type StockCostProbe,
} from './stock-cost.reader';
import {
  type BelowCostRule,
  type CostBasis,
  type PagedResult,
  type PriceLevel,
  type PriceLineKind,
  type PriceScope,
  type PriceSource,
  type PriceVerdict,
  type SellingPriceNoStockRow,
  type SellingPriceProblem,
} from './types/selling-price-bulk.types';
import { StockErrorCode } from '../types/stock-error-codes';

/** What §3's grid is filtered by. All optional but the company and branch. */
export interface ListSellingPricesArgs {
  companyId: string;
  branchId: string;
  itemGroupId?: string;
  itemBrandId?: string;
  itemSectionId?: string;
  supplierId?: string;
  /** One item only (notes 74: the screen's Add item). */
  itemId?: string;
  // Notes 76 — the filter popup.
  /** "Contains", on code, name, alias or default barcode. */
  search?: string;
  itemCategoryId?: string;
  /** The EFFECTIVE preset: the item's own, else its group's. */
  trackPresetId?: string;
  taxId?: string;
  /** Inactive items are left out unless this is false. */
  activeOnly: boolean;
  limit: number;
  offset: number;
  /** Change Selling Price P1 — only items with a NO_PRICE line (limit / offset count items). */
  unpricedOnly?: boolean;
}

/**
 * Change Selling Price P1 (plan 2026-11-23 §4.1 / §7.1) — one LINE of the grid as the
 * database answers it: the old grid record (prices of the row that answers: the line itself,
 * or the headline on a NO_PRICE line) plus what the line is and the item's facts.
 */
export interface PriceLineRecord extends PriceGridRecord {
  lineKind: PriceLineKind;
  /** The line's own cost; null on NO_PRICE and an unpriced HEADLINE. */
  lineCost: number | null;
  lineCostWot: number | null;
  stockCost: number | null;
  stockCostWot: number | null;
  stockCostBasis: 'MRP' | 'ITEM' | null;
  profitType: string;
  companyId: string | null;
  companyName: string | null;
  branchId: string | null;
  branchName: string | null;
  unitFactor: number;
  unitSlNo: number;
  isDefaultUnit: boolean;
  itemGroupName: string | null;
  trackPresetName: string | null;
  trackMrp: boolean;
  trackSalePrice: boolean;
  itemCompanyId: string | null;
  itemStockQty: number;
  itemStockUnit: string | null;
  /** The line's own ipm_price_a..d_markup_perc (the card's typed %); null when not the line's own. */
  storedMarkups: [number | null, number | null, number | null, number | null];
}

/** P1 §4.9 — a price row as Back to all branches reads it, locked. */
export interface LockedOwnLine {
  ipmId: string;
  companyId: string | null;
  branchId: string | null;
  itemId: string;
  uomId: string;
  keyMrp: number;
  keySp: number;
  isDeleted: boolean;
  itemName: string;
  unitName: string | null;
}

/** The bucket the opening picker SEEDS a line with — 19q Q6's price columns. */
export interface OpeningSeedBucket {
  mrp: number;
  salePrice: number;
}

/** What Q6's price seed is keyed by: the document's scope, the item, the keyed unit, the document date. */
export interface OpeningSeedBucketArgs {
  /** null switches the company half of the scope filter off. */
  companyId: string | null;
  /** null switches the branch half of the scope filter off. */
  branchId: string | null;
  itemId: string;
  uomId: string;
  onDate: string;
}

/**
 * One grid row as the database answers it — before the service adds the tax
 * rate and recomputes the four-number levels from `prices` (§5.1: price wins).
 */
export interface PriceGridRecord {
  itemId: string;
  itemCode: string | null;
  /** item_default_barcode — display only, never sent back on save (notes 76). */
  barcode: string | null;
  itemName: string;
  uomId: string;
  unitName: string | null;
  /** On hand at the branch for this bucket, in THIS row's unit. */
  stockQty: number;
  mrp: number | null;
  salePrice: number | null;
  /** The answering row's ipm_max_price — what the MRP column shows. */
  maxPrice: number;
  priceSource: PriceSource;
  /** Null when no row prices the bucket yet. */
  priceScope: PriceScope | null;
  /** The ipm_id that answered, null when none did. */
  bucketId: string | null;
  costRate: number;
  /** costRate without tax, from the same source — exact for an item with cess (notes 76). */
  costWot: number;
  /** Which figure costRate is (notes 75): one MRP's stock, the item average, or the row's own. */
  costBasis: CostBasis | null;
  minPrice: number;
  roundOff: number;
  /** Sales prices A–D of the answering row, 0 when none answered. */
  prices: [number, number, number, number];
}

/**
 * Notes 140 B — a scheduled row as the database answers it: the grid record of
 * the row itself, its period, and the row it replaces.
 */
export interface PriceScheduleRecord extends PriceGridRecord {
  effectiveFrom: string;
  effectiveTo: string;
  /** The row before it on the same key, else what priced the bucket the day before. */
  previous: {
    bucketId: string;
    priceScope: PriceScope;
    prices: [number, number, number, number];
  } | null;
}

/** S1's answer: the row in force on the day asked, locked, with its period (`YYYY-MM-DD`). */
export interface LockedPriceRow {
  ipmId: string;
  effectiveFrom: string;
  effectiveTo: string;
}

/** What pricing a save row needs before its levels can be recomputed. */
export interface RowCost {
  /** The item's code and name, for the problem list. */
  itemCode: string | null;
  itemName: string;
  /** Whether uomId is one of the item's live conversion rows. */
  uomBelongs: boolean;
  /** Whether the item's policy tracks MRP / sale price at this scope. */
  trackMrp: boolean;
  trackSalePrice: boolean;
  /** Tax-inclusive cost of ONE of this unit: branch average (stock_item_cost), else the resolved row's. */
  costRate: number;
  costWot: number;
  /** Which figure costRate is (notes 75) — read back after a save (notes 147 B). */
  costBasis: CostBasis | null;
  /** The resolved row's min price, 0 when none. */
  minPrice: number;
  /**
   * The resolved row's selling prices A–D; absent when no row prices this unit.
   * A purchase bill that changes only the MSP writes them back unchanged
   * (applyPurchasePrices), so a new branch / bucket row keeps the prices in force.
   */
  prices?: [number, number, number, number];
  /** Change Selling Price P1 — the unit's name and to-base factor (messages, the branch check). */
  unitName?: string | null;
  unitFactor?: number;
  /**
   * P1 A1 — the LINE's own cost: `ipm_cost_price` / `ipm_cost_wot` / `ipm_round_off` of the
   * row of THIS key in force at the branch (its own, else the All branches one). Null when the
   * key has no line of its own (the resolver fell back to the headline, or to nothing).
   */
  lineCost?: number | null;
  lineCostWot?: number | null;
  lineRoundOff?: number | null;
  /**
   * P1 A3 — the STOCK cost (stock-cost.reader.ts): this MRP's landing cost, else the branch
   * average, × the unit factor. Null when the branch has neither — never the price row's.
   */
  stockCost?: number | null;
  stockCostWot?: number | null;
  stockCostBasis?: 'MRP' | 'ITEM' | null;
}

/** One level's write, after §5.1's server recompute. */
export interface BucketLevelWrite {
  level: PriceLevel;
  price: number;
  priceWot: number;
  markupPerc: number;
}

/**
 * One changed row, complete.
 *
 * ONE type for Q26, S1, S2 and S3 rather than a "candidate" and a "write",
 * because they are the same row at four moments and splitting them invites the
 * validated row and the written row to drift apart — which is precisely the
 * failure §5.3 guards against on the confirm round trip.
 *
 * `mrp` / `salePrice` are the bucket AFTER policy blanking (`bucketKeyFor`):
 * both null is the headline row, which S1–S3 address as the (-1, -1) key of
 * the same table — there is no second destination.
 */
export interface BucketPriceCandidate {
  lineNo: number;
  companyId: string;
  itemId: string;
  uomId: string;
  itemCode: string | null;
  itemName: string;
  /** The row the grid loaded, when it had one. S1 still decides by key. */
  bucketId: string | null;
  mrp: number | null;
  salePrice: number | null;
  levels: BucketLevelWrite[];
  minPrice: number | null;
  roundOff: number | null;
  /** The cost the recompute used; S2 / S3 store it as the cost the row was priced against. */
  costRate: number;
  costWot: number;
  actor: string;
  /**
   * Change Selling Price P1, A3 option C — the cost Q26 judges below cost against: the HIGHER
   * of the line's own cost (costRate, what the line stores) and the stock cost. Absent = costRate.
   */
  judgeCost?: number;
  /**
   * Review S2 — the line's OWN cost judged (the cost typed / sent, else the line's stored cost);
   * null = it has none. Absent = costRate (the candidates built before S2).
   */
  ownCost?: number | null;
  /** P1 — the stock cost judged beside the line cost; null / absent when there is none. */
  stockCost?: number | null;
  /** P1 — the unit's name, for the problem's words. */
  unitName?: string | null;
}

/** Notes 119 — the code each Q26 verdict is refused / asked with. */
const PRICE_VERDICT_CODE: Readonly<Record<PriceVerdict, StockErrorCode>> = {
  ABOVE_MRP: StockErrorCode.PRICE_ABOVE_MRP,
  BELOW_MIN: StockErrorCode.PRICE_BELOW_MIN,
  BELOW_COST: StockErrorCode.PRICE_BELOW_COST,
};

/** Two decimals, as the wording shows money (`540.00`). */
function money(value: number): string {
  return round2(value).toFixed(2);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A level's short name (WS, RET), else "Price A".."Price D". */
function levelLabel(level: number, names?: ReadonlyMap<number, string>): string {
  return names?.get(level) ?? `Price ${'ABCD'[level - 1] ?? level}`;
}

/** The wording's placeholders every price problem carries (P1 handover: level … n). */
function paramsOf(
  candidate: BucketPriceCandidate,
  level: number,
  price: number,
  names: ReadonlyMap<number, string> | undefined,
  extra: Record<string, string | number>,
): Record<string, string | number> {
  return {
    level: levelLabel(level, names),
    price: money(price),
    ...extra,
    ...(candidate.unitName ? { unit: candidate.unitName } : {}),
    ...(candidate.mrp !== null ? { mrp: money(candidate.mrp) } : {}),
    ...(candidate.itemName ? { item: candidate.itemName } : {}),
    n: candidate.lineNo,
  };
}

/**
 * P1 §4.7, A3 option C — a price under the judged cost (the higher of the line's own cost
 * and the stock cost). `rule` names the higher one only when BOTH are known (above 0):
 * LINE_COST "below the last purchase cost 500.00 (stock cost 450.00)", STOCK_COST the other
 * way round; with one cost the plain "below the cost" wording, exactly as before.
 */
/** The line's own cost judged (S2), null when it has none; before S2 the stored costRate. */
function ownCostOf(candidate: BucketPriceCandidate): number | null {
  const own = candidate.ownCost !== undefined ? candidate.ownCost : candidate.costRate;
  return own !== null && own > 0 ? own : null;
}

function belowCostOf(
  candidate: BucketPriceCandidate,
  level: number,
  price: number,
  names?: ReadonlyMap<number, string>,
): { text: string; fields: Partial<SellingPriceProblem> } {
  const judgeCost = candidate.judgeCost ?? candidate.costRate;
  const lineCost = ownCostOf(candidate);
  const stockCost =
    candidate.stockCost !== undefined && candidate.stockCost !== null && candidate.stockCost > 0
      ? candidate.stockCost
      : null;
  const rule: BelowCostRule | undefined =
    lineCost !== null && stockCost !== null
      ? lineCost >= stockCost
        ? 'LINE_COST'
        : 'STOCK_COST'
      : undefined;
  const text =
    rule === 'LINE_COST'
      ? `${price} is below the last purchase cost ${money(lineCost!)} (stock cost ${money(stockCost!)}).`
      : rule === 'STOCK_COST'
        ? `${price} is below the stock cost ${money(stockCost!)} (last purchase cost ${money(lineCost!)}).`
        : `${price} is below the cost ${judgeCost}.`;
  return {
    text,
    fields: {
      ...(rule ? { rule } : {}),
      cost: round2(judgeCost),
      lineCost: lineCost === null ? null : round2(lineCost),
      stockCost: stockCost === null ? null : round2(stockCost),
      params: paramsOf(candidate, level, price, names, {
        cost: money(judgeCost),
        ...(lineCost !== null ? { lineCost: money(lineCost) } : {}),
        ...(stockCost !== null ? { stockCost: money(stockCost) } : {}),
      }),
    },
  };
}


/**
 * `resolveEffectivePrice` (price-resolver.ts) AS SQL, for statements that price
 * many rows at once. The same four rules in the same order: in force on the
 * date, scope-or-wider, the exact bucket before the headline, branch before
 * chain and company before shared. Change one and the other in one commit.
 *
 * Expects the caller's aliases for the item, the unit (an iuc_id) and the two
 * blanked bucket values; exposes `p` (NULL columns when nothing prices it) and
 * `p_is_bucket`.
 */
function effectivePriceLateral(args: {
  itemId: Prisma.Sql;
  uomId: Prisma.Sql;
  mrp: Prisma.Sql;
  salePrice: Prisma.Sql;
  companyId: string;
  branchId: string;
  onDate: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT ipm.*,
             (ipm.ipm_key_mrp <> -1 OR ipm.ipm_key_sp <> -1) AS p_is_bucket
        FROM inventory.item_price_master ipm
       WHERE ipm.ipm_item_id    = ${args.itemId}
         AND ipm.ipm_uc_unit_id = ${args.uomId}
         AND ipm.ipm_is_deleted = false
         AND ${args.onDate} BETWEEN ipm.ipm_effective_from AND ipm.ipm_effective_to
         AND (ipm.ipm_company_id IS NULL OR ipm.ipm_company_id = ${args.companyId}::uuid)
         AND (ipm.ipm_branch_id  IS NULL OR ipm.ipm_branch_id  = ${args.branchId}::uuid)
         AND (   (ipm.ipm_key_mrp = COALESCE(${args.mrp}, -1) AND ipm.ipm_key_sp = COALESCE(${args.salePrice}, -1))
              OR (ipm.ipm_key_mrp = -1 AND ipm.ipm_key_sp = -1))
       ORDER BY (ipm.ipm_key_mrp = COALESCE(${args.mrp}, -1)
                 AND ipm.ipm_key_sp = COALESCE(${args.salePrice}, -1)) DESC,
                (ipm.ipm_branch_id IS NULL),
                (ipm.ipm_company_id IS NULL),
                ipm.ipm_id
       LIMIT 1
    ) p ON true
  `;
}

/**
 * Notes 75 — the cost of ONE MRP's stock at the branch, for an item that
 * tracks MRP: the user prices an MRP bucket against what THAT stock cost to
 * land, not the item's blended average (MRP 40 bought at 25 and MRP 550 at
 * 500 both read 341.67 on the average).
 *
 * Notes 92 moved the figure onto the balance rows: every lot of a tracked item
 * carries its OWN cost in the branch (`sbl_avg_cost_rate`, written by the
 * posting engine's `applyLotCost`), so this reads Σ `sbl_stock_value` ÷ Σ
 * `sbl_on_hand_qty` over the MRP's lots with stock on hand, and with nothing
 * on hand the plain average of those lots' rates — a sold-out MRP still shows
 * what it cost. It used to re-derive the figure from the ledger's inward rows;
 * that was the same number, but two definitions of a lot's cost can drift and
 * now there is one. No lot at that MRP → no row, and the caller falls back to
 * the item average.
 *
 * Exposes the CTE `mrp_cost(item_id, mrp, cost_rate, cost_rate_wot)`, per BASE
 * unit. `pairs` yields the DISTINCT (item_id, mrp) to cost, mrp not null — one
 * probe per item × MRP, however many unit rows join back to it.
 */
function mrpCostCte(args: { companyId: string; branchId: string; pairs: Prisma.Sql }): Prisma.Sql {
  // The lateral body is StockCostReader's (stock-cost.reader.ts): one definition of a lot's
  // cost for the branch on screen and for the other branches (P1 C5 / C6).
  return Prisma.sql`
    mrp_cost AS (
      SELECT k.item_id, k.mrp, mc.cost_rate, mc.cost_rate_wot
        FROM (${args.pairs}) k
        LEFT JOIN LATERAL ${mrpLotCostLateral({
          companyId: Prisma.sql`${args.companyId}::uuid`,
          branchId: Prisma.sql`${args.branchId}::uuid`,
          itemId: Prisma.raw('k.item_id'),
          mrp: Prisma.raw('k.mrp'),
        })} mc ON true
    )
  `;
}

/**
 * The cost columns every reader shares (notes 75), from the aliases it joined:
 * `mc` = mrp_cost (only joined for an MRP-tracked bucket with an MRP), `sic` =
 * stock_item_cost, `p` = the answering price row, `factor` = the unit's
 * iuc_to_base_factor. The MRP's own cost first, else the branch average, else
 * the price row's stored cost — the last two exactly as before. costWot comes
 * from the SAME source as costRate, never a mix of the two.
 */
function costColumns(a: { mc: string; sic: string; p: string; factor: string }): {
  rate: Prisma.Sql;
  wot: Prisma.Sql;
  basis: Prisma.Sql;
} {
  const mrpRate = `NULLIF(${a.mc}.cost_rate, 0)`;
  const itemRate = `NULLIF(${a.sic}.sic_avg_cost_rate, 0)`;
  return {
    rate: Prisma.raw(
      `COALESCE(${mrpRate} * ${a.factor}, ${itemRate} * ${a.factor}, ${a.p}.ipm_cost_price, 0)`,
    ),
    wot: Prisma.raw(
      `CASE WHEN ${mrpRate} IS NOT NULL THEN COALESCE(${a.mc}.cost_rate_wot, 0) * ${a.factor}` +
        ` ELSE COALESCE(NULLIF(${a.sic}.sic_avg_cost_rate_wot, 0) * ${a.factor}, ${a.p}.ipm_cost_wot, 0) END`,
    ),
    basis: Prisma.raw(
      `CASE WHEN ${mrpRate} IS NOT NULL THEN 'MRP'` +
        ` WHEN ${itemRate} IS NOT NULL THEN 'ITEM'` +
        ` WHEN ${a.p}.ipm_cost_price IS NOT NULL THEN 'PRICE_ROW' END`,
    ),
  };
}

/**
 * A day for a statement: `CURRENT_DATE` when none is given — today's behaviour,
 * byte for byte — else the given `YYYY-MM-DD` (notes 140 A).
 */
export function daySql(day: string | null | undefined): Prisma.Sql {
  return day ? Prisma.sql`${day}::date` : Prisma.raw('CURRENT_DATE');
}

interface GridSqlRow {
  itemId: string;
  itemCode: string | null;
  barcode: string | null;
  itemName: string;
  uomId: string;
  unitName: string | null;
  stockQty: Prisma.Decimal | null;
  mrp: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  priceIsBucket: boolean | null;
  priceBranchId: string | null;
  bucketId: string | null;
  maxPrice: Prisma.Decimal | null;
  costRate: Prisma.Decimal | null;
  costWot: Prisma.Decimal | null;
  costBasis: CostBasis | null;
  minPrice: Prisma.Decimal | null;
  roundOff: Prisma.Decimal | null;
  priceA: Prisma.Decimal | null;
  priceB: Prisma.Decimal | null;
  priceC: Prisma.Decimal | null;
  priceD: Prisma.Decimal | null;
}

/**
 * EVERY statement Change Selling Price (menu 30) runs against
 * `inventory.item_price_master`, and nothing else
 * (plan-nestjs-one-price-table.md §5).
 *
 * There is ONE price table. A bucket row — "stock of this item at THIS MRP
 * sells for" — and the headline row live side by side in item_price_master,
 * told apart by `ipm_bucket_mrp` / `ipm_bucket_sp` (both NULL = headline).
 * `stock.stock_mrp_price` was never created, so there is no fan-out: a row
 * with neither dimension is saved by the same S1–S3 as any other, at key
 * (-1, -1).
 *
 * The bucket a row belongs to is always POLICY-BLANKED — the item's effective
 * stock track policy decides whether MRP and sale price are dimensions at all,
 * exactly as it does for the lot (`bucketKeySql` / `bucketKeyFor`).
 */
@Injectable()
export class PriceBucketGateway {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 19q Q6, the price columns — the bucket an Opening Stock line is SEEDED
   * with when the item is picked.
   *
   * It is a SEED, not an answer: the table is keyed BY MRP, so it cannot tell a
   * blank line which MRP the stock has — that is what the packet says. Bucket
   * rows first, the most specific scope first (this branch beats chain-wide,
   * this company beats every-company), then the DEAREST, deliberately: an item
   * with several live MRPs has no single right answer, and the highest is the
   * one an operator notices is wrong. With no bucket row the HEADLINE's
   * ipm_max_price seeds the MRP — a better seed than 0. Null only when the
   * unit has no price row at all.
   */
  async findOpeningSeedBucket(args: OpeningSeedBucketArgs): Promise<OpeningSeedBucket | null> {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        bucketMrp: Prisma.Decimal | null;
        bucketSp: Prisma.Decimal | null;
        maxPrice: Prisma.Decimal;
      }>
    >`
      SELECT p.ipm_bucket_mrp AS "bucketMrp",
             p.ipm_bucket_sp  AS "bucketSp",
             p.ipm_max_price  AS "maxPrice"
        FROM inventory.item_price_master p
       WHERE p.ipm_item_id    = ${args.itemId}::uuid
         AND p.ipm_uc_unit_id = ${args.uomId}::uuid
         AND (${args.companyId}::uuid IS NULL OR p.ipm_company_id IS NULL
              OR p.ipm_company_id = ${args.companyId}::uuid)
         AND (${args.branchId}::uuid IS NULL OR p.ipm_branch_id IS NULL
              OR p.ipm_branch_id = ${args.branchId}::uuid)
         AND ${args.onDate}::date BETWEEN p.ipm_effective_from AND p.ipm_effective_to
         AND p.ipm_is_deleted = false
       ORDER BY (p.ipm_key_mrp = -1 AND p.ipm_key_sp = -1),
                (p.ipm_branch_id  IS NULL),
                (p.ipm_company_id IS NULL),
                p.ipm_bucket_mrp DESC NULLS LAST,
                p.ipm_bucket_sp  DESC NULLS LAST,
                p.ipm_id
       LIMIT 1
    `;
    if (!row) {
      return null;
    }
    return {
      mrp: toNumber(row.bucketMrp ?? row.maxPrice),
      salePrice: row.bucketSp === null ? 0 : toNumber(row.bucketSp),
    };
  }

  /**
   * Q25 — one row per (item × unit × live bucket with stock at the branch),
   * plus the headline row, per unit, for an item with no live bucket. Each row
   * carries the price the resolver picks for it, with `priceSource` /
   * `priceScope` / `bucketId` as the resolver answers them. Paged.
   */
  async listPrices(args: ListSellingPricesArgs): Promise<PagedResult<PriceGridRecord>> {
    const rows = await this.prisma.$queryRaw<GridSqlRow[]>`
      ${this.gridStatement({
        companyId: args.companyId,
        branchId: args.branchId,
        itemFilter: Prisma.sql`
          AND (${args.itemGroupId ?? null}::uuid IS NULL OR i.item_group_id = ${args.itemGroupId ?? null}::uuid)
          AND (${args.itemBrandId ?? null}::uuid IS NULL OR i.item_brand_id = ${args.itemBrandId ?? null}::uuid)
          AND (${args.itemSectionId ?? null}::uuid IS NULL OR i.item_section_id = ${args.itemSectionId ?? null}::uuid)
          AND (${args.supplierId ?? null}::uuid IS NULL OR i.item_supplier_id = ${args.supplierId ?? null}::uuid)
          AND (${args.itemId ?? null}::uuid IS NULL OR i.item_id = ${args.itemId ?? null}::uuid)
          ${this.popupFilter(args)}`,
      })}
      LIMIT ${args.limit} OFFSET ${args.offset}
    `;
    const items = rows.map((row) => this.toGridRecord(row));
    return { items, meta: { limit: args.limit, offset: args.offset, count: items.length } };
  }

  /**
   * Notes 76 — the filter popup's keys, ANDed with the F8 four. Each is off
   * when absent. `search` is a loose contains (src/common/search/loose-search.ts:
   * spaces and punctuation ignored on both sides, every typed word required) on
   * code, name, alias and default barcode. `trackPresetId` is the EFFECTIVE preset —
   * the item's own, else its group's — so "Tracked as" matches what the item
   * entry shows (an item follows its group unless it names its own, notes 68).
   * `activeOnly` (default true) leaves inactive items out; until notes 76 only
   * deleted ones were.
   */
  private popupFilter(args: ListSellingPricesArgs): Prisma.Sql {
    return Prisma.sql`
          AND ${looseSearchSql(
            ['i.item_code', 'i.item_name_en', 'i.item_alias', 'i.item_default_barcode'],
            args.search,
          )}
          AND (${args.itemCategoryId ?? null}::uuid IS NULL OR i.item_category_id = ${args.itemCategoryId ?? null}::uuid)
          AND (${args.trackPresetId ?? null}::uuid IS NULL
               OR COALESCE(i.item_track_preset_id,
                           (SELECT g.itg_track_preset_id FROM inventory.item_group_master g
                             WHERE g.itg_id = i.item_group_id)) = ${args.trackPresetId ?? null}::uuid)
          AND (${args.taxId ?? null}::uuid IS NULL OR i.item_default_tax_id = ${args.taxId ?? null}::uuid)
          AND (${args.activeOnly} = false OR i.item_is_active = true)`;
  }

  /**
   * Q24 — F12, the bucket list. Two kinds of row, per unit:
   *
   *   * EVERY LIVE PRICE ROW of one item this branch can see — the chain rows
   *     and this branch's own, never another branch's. The grid shows only the
   *     row that WINS at this branch; this list shows both, so the operator
   *     sees what an edit hides (change_selling_one_table_mockup.png).
   *   * EVERY STOCK BUCKET AT THE BRANCH THAT HAS NO ROW OF ITS OWN (notes 74):
   *     a received MRP nobody has priced yet is the bucket that matters most
   *     here, and a list of price rows alone never showed it. Priced as the
   *     grid prices it — through the resolver, so MASTER with the headline's
   *     prices and cost, or nothing when there is no headline either — which
   *     gives such a row the same figures in both routes.
   *
   * Headline first, then by MRP and sale price, the chain row before the
   * branch override of the same bucket. Every row's stockQty is the stock on
   * hand for its own bucket at this branch, blanked by the policy as the grid
   * blanks it, in the row's unit. A bucket with neither stock nor a row is not
   * listed.
   */
  async listBuckets(
    itemId: string,
    companyId: string,
    branchId: string,
  ): Promise<PriceGridRecord[]> {
    const key = bucketKeySql({
      trackMrp: Prisma.raw('pol.track_mrp'),
      trackSalePrice: Prisma.raw('pol.track_sp'),
      mrp: Prisma.raw('b.sbl_mrp'),
      salePrice: Prisma.raw('b.sbl_sale_price'),
    });
    const cost = costColumns({ mc: 'mc', sic: 'sic', p: 'p', factor: 'iuc.iuc_to_base_factor' });
    const rows = await this.prisma.$queryRaw<GridSqlRow[]>`
      WITH pol AS (
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_default_barcode,
               COALESCE(stp.stp_track_mrp, false)        AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sp
          FROM inventory.item_master i
          ${effectivePolicyLateral({
            companyId: Prisma.sql`${companyId}::uuid`,
            branchId: Prisma.sql`${branchId}::uuid`,
            itemId: Prisma.raw('i.item_id'),
            itemGroupId: Prisma.raw('i.item_group_id'),
            onDate: Prisma.raw('CURRENT_DATE'),
          })}
         WHERE i.item_id = ${itemId}::uuid
      ),
      stock AS (
        SELECT COALESCE(${key.mrp}, -1)       AS key_mrp,
               COALESCE(${key.salePrice}, -1) AS key_sp,
               ${key.mrp}                     AS mrp,
               ${key.salePrice}               AS sp,
               SUM(b.sbl_on_hand_qty)         AS qty
          FROM stock.stock_balance b
          JOIN pol ON pol.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${companyId}::uuid
           AND b.sbl_branch_id  = ${branchId}::uuid
           AND b.sbl_bucket     = 'SALEABLE'
           AND b.sbl_is_deleted = false
         GROUP BY 1, 2, 3, 4
      ),
      -- Notes 75: the MRPs this list can show for an MRP-tracked item — its
      -- stock buckets' and its price rows'.
      ${mrpCostCte({
        companyId,
        branchId,
        pairs: Prisma.sql`
          SELECT pol.item_id, m.mrp
            FROM pol
            CROSS JOIN LATERAL (
              SELECT st.mrp FROM stock st WHERE st.mrp IS NOT NULL
              UNION
              SELECT p.ipm_bucket_mrp
                FROM inventory.item_price_master p
               WHERE p.ipm_item_id = pol.item_id
                 AND p.ipm_bucket_mrp IS NOT NULL
                 AND p.ipm_is_deleted = false) m
           WHERE pol.track_mrp`,
      })},
      listed AS (
        -- The price rows this branch can see.
        SELECT iuc.iuc_id         AS uom_id,
               iuc.iuc_unit_slno  AS unit_slno,
               u.unit_name,
               COALESCE(st.qty, 0) / NULLIF(iuc.iuc_to_base_factor, 0) AS stock_qty,
               p.ipm_bucket_mrp   AS mrp,
               p.ipm_bucket_sp    AS sp,
               p.ipm_key_mrp      AS key_mrp,
               p.ipm_key_sp       AS key_sp,
               (p.ipm_key_mrp <> -1 OR p.ipm_key_sp <> -1) AS price_is_bucket,
               p.ipm_branch_id, p.ipm_company_id, p.ipm_id, p.ipm_max_price,
               ${cost.rate} AS cost_rate,
               ${cost.wot} AS cost_wot,
               ${cost.basis} AS cost_basis,
               p.ipm_min_price, p.ipm_round_off,
               p.ipm_sales_price_a, p.ipm_sales_price_b, p.ipm_sales_price_c, p.ipm_sales_price_d
          FROM pol
          JOIN inventory.item_price_master p
            ON p.ipm_item_id = pol.item_id
           AND p.ipm_is_deleted = false
           AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
           AND (p.ipm_company_id IS NULL OR p.ipm_company_id = ${companyId}::uuid)
           AND (p.ipm_branch_id  IS NULL OR p.ipm_branch_id  = ${branchId}::uuid)
          JOIN inventory.item_unit_conversion iuc
            ON iuc.iuc_id = p.ipm_uc_unit_id AND iuc.iuc_is_deleted = false
          LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
          LEFT JOIN stock st ON st.key_mrp = p.ipm_key_mrp AND st.key_sp = p.ipm_key_sp
          LEFT JOIN mrp_cost mc
                 ON pol.track_mrp AND mc.item_id = pol.item_id AND mc.mrp = p.ipm_bucket_mrp
          LEFT JOIN stock.stock_item_cost sic
                 ON sic.sic_company_id = ${companyId}::uuid
                AND sic.sic_branch_id  = ${branchId}::uuid
                AND sic.sic_item_id    = pol.item_id
                AND sic.sic_is_deleted = false
        UNION ALL
        -- The stock buckets with no row of their own, per live unit, priced by
        -- the resolver. The resolver answers the exact bucket row first, so
        -- "no row of its own" is: it answered nothing, or only the headline
        -- for a bucket that is not the headline's own.
        SELECT iuc.iuc_id, iuc.iuc_unit_slno, u.unit_name,
               st.qty / NULLIF(iuc.iuc_to_base_factor, 0),
               st.mrp, st.sp, st.key_mrp, st.key_sp,
               p.p_is_bucket,
               p.ipm_branch_id, p.ipm_company_id, p.ipm_id, p.ipm_max_price,
               ${cost.rate},
               ${cost.wot},
               ${cost.basis},
               p.ipm_min_price, p.ipm_round_off,
               p.ipm_sales_price_a, p.ipm_sales_price_b, p.ipm_sales_price_c, p.ipm_sales_price_d
          FROM pol
          JOIN stock st ON st.qty <> 0
          JOIN inventory.item_unit_conversion iuc
            ON iuc.iuc_item_id = pol.item_id AND iuc.iuc_is_deleted = false
          LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
          LEFT JOIN mrp_cost mc ON mc.item_id = pol.item_id AND mc.mrp = st.mrp
          LEFT JOIN stock.stock_item_cost sic
                 ON sic.sic_company_id = ${companyId}::uuid
                AND sic.sic_branch_id  = ${branchId}::uuid
                AND sic.sic_item_id    = pol.item_id
                AND sic.sic_is_deleted = false
          ${effectivePriceLateral({
            itemId: Prisma.raw('pol.item_id'),
            uomId: Prisma.raw('iuc.iuc_id'),
            mrp: Prisma.raw('st.mrp'),
            salePrice: Prisma.raw('st.sp'),
            companyId,
            branchId,
            onDate: Prisma.raw('CURRENT_DATE'),
          })}
         WHERE p.ipm_id IS NULL
            OR (p.p_is_bucket = false AND (st.key_mrp <> -1 OR st.key_sp <> -1))
      )
      SELECT pol.item_id          AS "itemId",
             pol.item_code        AS "itemCode",
             pol.item_default_barcode AS "barcode",
             pol.item_name_en     AS "itemName",
             l.uom_id             AS "uomId",
             l.unit_name          AS "unitName",
             l.stock_qty          AS "stockQty",
             l.mrp                AS "mrp",
             l.sp                 AS "salePrice",
             l.price_is_bucket    AS "priceIsBucket",
             l.ipm_branch_id      AS "priceBranchId",
             l.ipm_id             AS "bucketId",
             l.ipm_max_price      AS "maxPrice",
             l.cost_rate          AS "costRate",
             l.cost_wot           AS "costWot",
             l.cost_basis         AS "costBasis",
             l.ipm_min_price      AS "minPrice",
             l.ipm_round_off      AS "roundOff",
             l.ipm_sales_price_a  AS "priceA",
             l.ipm_sales_price_b  AS "priceB",
             l.ipm_sales_price_c  AS "priceC",
             l.ipm_sales_price_d  AS "priceD"
        FROM listed l
        CROSS JOIN pol
       ORDER BY l.unit_slno, l.uom_id,
                (l.key_mrp <> -1 OR l.key_sp <> -1),
                l.key_mrp, l.key_sp,
                (l.ipm_branch_id IS NOT NULL), (l.ipm_company_id IS NOT NULL), l.ipm_id
    `;
    return rows.map((row) => this.toGridRecord(row));
  }

  /**
   * What each save row needs before its levels are recomputed: the item's
   * name, whether the unit is the item's, the policy flags that blank its
   * bucket, and the COST — the branch's running average from
   * `stock.stock_item_cost` scaled to the unit, else the cost on the row the
   * resolver picks for this bucket. One statement, in the caller's transaction.
   *
   * Notes 140 A — `onDate` (`YYYY-MM-DD`) reads the policy and the resolved row
   * as they will stand on the day a scheduled price starts; omitted is today.
   */
  async loadRowCosts(
    tx: Prisma.TransactionClient,
    rows: ReadonlyArray<{
      itemId: string;
      uomId: string;
      mrp: number | null;
      salePrice: number | null;
    }>,
    companyId: string,
    branchId: string,
    onDate?: string,
  ): Promise<RowCost[]> {
    if (!rows.length) {
      return [];
    }
    const saveCost = costColumns({ mc: 'mc', sic: 'sic', p: 'p', factor: 'k.iuc_to_base_factor' });
    // P1 — the stock cost alone (A3), and the line's own cost when the resolver answered the
    // row of THIS key (A1), apart from the stock-first cost the save stored until now.
    const stock = stockCostColumns({
      mc: 'mc',
      sic: 'sic',
      factor: 'k.iuc_to_base_factor',
      mrpKey: 'k.track_mrp AND k.mrp > 0',
      none: 'k.track_mrp AND NOT COALESCE(k.mrp > 0, false)',
    });
    const keyMrp = Prisma.raw('CASE WHEN k.track_mrp AND k.mrp > 0 THEN k.mrp END');
    const keySp = Prisma.raw('CASE WHEN k.track_sp AND k.sp > 0 THEN k.sp END');
    const exact = Prisma.sql`(p.ipm_id IS NOT NULL AND p.ipm_key_mrp = COALESCE(${keyMrp}, -1) AND p.ipm_key_sp = COALESCE(${keySp}, -1))`;
    const found = await tx.$queryRaw<
      Array<{
        ord: bigint;
        itemCode: string | null;
        itemName: string | null;
        uomBelongs: boolean;
        trackMrp: boolean;
        trackSalePrice: boolean;
        costRate: Prisma.Decimal | null;
        costWot: Prisma.Decimal | null;
        costBasis: CostBasis | null;
        minPrice: Prisma.Decimal | null;
        hasPrice: boolean;
        priceA: Prisma.Decimal | null;
        priceB: Prisma.Decimal | null;
        priceC: Prisma.Decimal | null;
        priceD: Prisma.Decimal | null;
        unitName?: string | null;
        unitFactor?: Prisma.Decimal | null;
        lineCost?: Prisma.Decimal | null;
        lineCostWot?: Prisma.Decimal | null;
        lineRoundOff?: Prisma.Decimal | null;
        stockCost?: Prisma.Decimal | null;
        stockCostWot?: Prisma.Decimal | null;
        stockCostBasis?: 'MRP' | 'ITEM' | null;
      }>
    >`
      WITH q AS (
        SELECT q.item_id::uuid AS item_id, q.uom_id::uuid AS uom_id,
               NULLIF(q.mrp, '')::numeric AS mrp, NULLIF(q.sp, '')::numeric AS sp, q.ord
          FROM unnest(${rows.map((r) => r.itemId)}::text[],
                      ${rows.map((r) => r.uomId)}::text[],
                      ${rows.map((r) => (r.mrp === null ? '' : String(r.mrp)))}::text[],
                      ${rows.map((r) => (r.salePrice === null ? '' : String(r.salePrice)))}::text[])
               WITH ORDINALITY AS q(item_id, uom_id, mrp, sp, ord)
      ),
      keyed AS (
        SELECT q.*, i.item_code, i.item_name_en, iuc.iuc_id IS NOT NULL AS uom_belongs,
               iuc.iuc_to_base_factor, iuc.iuc_unit_id,
               COALESCE(stp.stp_track_mrp, false)        AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sp
          FROM q
          LEFT JOIN inventory.item_master i ON i.item_id = q.item_id
          LEFT JOIN inventory.item_unit_conversion iuc
                 ON iuc.iuc_id = q.uom_id AND iuc.iuc_item_id = q.item_id AND iuc.iuc_is_deleted = false
          ${effectivePolicyLateral({
            companyId: Prisma.sql`${companyId}::uuid`,
            branchId: Prisma.sql`${branchId}::uuid`,
            itemId: Prisma.raw('q.item_id'),
            itemGroupId: Prisma.raw('i.item_group_id'),
            onDate: daySql(onDate),
          })}
      ),
      ${mrpCostCte({
        companyId,
        branchId,
        pairs: Prisma.sql`
          SELECT DISTINCT keyed.item_id, keyed.mrp FROM keyed
           WHERE keyed.track_mrp AND keyed.mrp > 0`,
      })}
      SELECT k.ord,
             k.item_code    AS "itemCode",
             k.item_name_en AS "itemName",
             k.uom_belongs  AS "uomBelongs",
             k.track_mrp    AS "trackMrp",
             k.track_sp     AS "trackSalePrice",
             ${saveCost.rate} AS "costRate",
             ${saveCost.wot}  AS "costWot",
             ${saveCost.basis} AS "costBasis",
             COALESCE(p.ipm_min_price, 0) AS "minPrice",
             p.ipm_id IS NOT NULL AS "hasPrice",
             p.ipm_sales_price_a AS "priceA", p.ipm_sales_price_b AS "priceB",
             p.ipm_sales_price_c AS "priceC", p.ipm_sales_price_d AS "priceD",
             u.unit_name          AS "unitName",
             k.iuc_to_base_factor AS "unitFactor",
             CASE WHEN ${exact} THEN p.ipm_cost_price END AS "lineCost",
             CASE WHEN ${exact} THEN p.ipm_cost_wot   END AS "lineCostWot",
             CASE WHEN ${exact} THEN p.ipm_round_off  END AS "lineRoundOff",
             ${stock.rate}  AS "stockCost",
             ${stock.wot}   AS "stockCostWot",
             ${stock.basis} AS "stockCostBasis"
        FROM keyed k
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = k.iuc_unit_id
        -- Notes 75: an MRP bucket is costed by its own MRP's stock, as the grid
        -- showed it — the below-cost check and ipm_cost_price use that figure.
        LEFT JOIN mrp_cost mc
               ON k.track_mrp AND k.mrp > 0 AND mc.item_id = k.item_id AND mc.mrp = k.mrp
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${companyId}::uuid
              AND sic.sic_branch_id  = ${branchId}::uuid
              AND sic.sic_item_id    = k.item_id
              AND sic.sic_is_deleted = false
        ${effectivePriceLateral({
          itemId: Prisma.raw('k.item_id'),
          uomId: Prisma.raw('k.uom_id'),
          mrp: keyMrp,
          salePrice: keySp,
          companyId,
          branchId,
          onDate: daySql(onDate),
        })}
       ORDER BY k.ord
    `;
    const byOrd = new Map(found.map((row) => [Number(row.ord), row]));
    const orNull = (value: Prisma.Decimal | null | undefined) =>
      value === null || value === undefined ? null : toNumber(value);
    return rows.map((_, index) => {
      const row = byOrd.get(index + 1);
      return {
        unitName: row?.unitName ?? null,
        unitFactor: orNull(row?.unitFactor) ?? 1,
        lineCost: orNull(row?.lineCost),
        lineCostWot: orNull(row?.lineCostWot),
        lineRoundOff: orNull(row?.lineRoundOff),
        stockCost: orNull(row?.stockCost),
        stockCostWot: orNull(row?.stockCostWot),
        stockCostBasis: row?.stockCostBasis ?? null,
        itemCode: row?.itemCode ?? null,
        itemName: row?.itemName ?? '',
        uomBelongs: row?.uomBelongs ?? false,
        trackMrp: row?.trackMrp ?? false,
        trackSalePrice: row?.trackSalePrice ?? false,
        costRate: row?.costRate ? toNumber(row.costRate) : 0,
        costWot: row?.costWot ? toNumber(row.costWot) : 0,
        costBasis: row?.costBasis ?? null,
        minPrice: row?.minPrice ? toNumber(row.minPrice) : 0,
        ...(row?.hasPrice
          ? { prices: [row.priceA, row.priceB, row.priceC, row.priceD].map((v) => (v ? toNumber(v) : 0)) as [number, number, number, number] }
          : {}),
      };
    });
  }

  /**
   * Q26 — the per-row, per-level verdict. §5.2.
   *
   *   ABOVE_MRP  a BUCKET row priced above its MRP (ck_ipm_not_above_mrp would
   *              refuse it anyway; headline rows are not checked — skip_mrp
   *              shops and the legacy rows above their MRP stay legal);
   *   BELOW_MIN  below the row's min price — DATA, not a CHECK, so this is its
   *              only enforcement;
   *   BELOW_COST below the cost the candidate was costed at (stock_item_cost).
   *
   * One verdict per level, in that order. Re-run on a confirmed post: cost
   * moves when a purchase posts, and the confirm is the user agreeing to the
   * PRICE, not to a particular cost figure.
   *
   * `opts.activeLevels` — Qty-wise Prices (menu 244, review fix C-a) only: a
   * level is judged only when it is one of these ACTIVE levels and its price
   * is above 0. The form sends all four levels (an absent one would be written
   * as 0), so an inactive or unpriced level must not be refused. Absent — menu
   * 30, Quick Rate, purchase — every level sent is judged, exactly as before.
   */
  validateRows(
    candidates: readonly BucketPriceCandidate[],
    storedMinPrices: readonly number[],
    opts: {
      activeLevels?: readonly number[];
      /** P1 — level ordinal → short name (WS, RET), for the problems' params. */
      levelNames?: ReadonlyMap<number, string>;
    } = {},
  ): SellingPriceProblem[] {
    // No `this` in here: the purchase spec runs it detached (PriceBucketGateway.prototype).
    const problems: SellingPriceProblem[] = [];
    const judged = opts.activeLevels ? new Set(opts.activeLevels) : null;
    candidates.forEach((candidate, index) => {
      const minPrice = candidate.minPrice ?? storedMinPrices[index] ?? 0;
      // P1, A3 option C — the HIGHER of the line's own cost and the stock cost.
      const judgeCost = candidate.judgeCost ?? candidate.costRate;
      for (const level of candidate.levels) {
        if (judged && (!judged.has(level.level) || !(level.price > 0))) {
          continue;
        }
        const below =
          judgeCost > 0 && level.price < judgeCost
            ? belowCostOf(candidate, level.level, level.price, opts.levelNames)
            : null;
        const verdict =
          candidate.mrp !== null && level.price > candidate.mrp
            ? {
                verdict: 'ABOVE_MRP' as const,
                text: `${level.price} is above the MRP ${candidate.mrp}.`,
              }
            : minPrice > 0 && level.price < minPrice
              ? {
                  verdict: 'BELOW_MIN' as const,
                  text: `${level.price} is below the minimum price ${minPrice}.`,
                }
              : below
                ? { verdict: 'BELOW_COST' as const, text: below.text }
                : null;
        if (verdict) {
          problems.push({
            lineNo: candidate.lineNo,
            itemId: candidate.itemId,
            itemCode: candidate.itemCode,
            itemName: candidate.itemName,
            uomId: candidate.uomId,
            bucketId: candidate.bucketId,
            level: level.level,
            verdict: verdict.verdict,
            // Prefixed with the item: a problem list rendered against a grid
            // of four hundred rows is only useful if each line names its row.
            message: candidate.itemName ? `${candidate.itemName}: ${verdict.text}` : verdict.text,
            code: PRICE_VERDICT_CODE[verdict.verdict],
            ...(verdict.verdict === 'BELOW_COST' && below ? below.fields : {}),
          });
        }
      }
    });
    return problems;
  }

  /**
   * Change Selling Price P1 §4.7 (C6, O10) — an All branches line judged at every OTHER
   * branch that reads it (StockCostReader.otherBranches: stock on hand for the key, no own
   * line, a stock cost). A branch is named only where ITS stock cost is the higher cost —
   * above the line's own cost — and the price is under it: a price under the line cost is the
   * same at every branch and was reported once, at the branch on screen. One problem per
   * level priced above 0 (and active, when `activeLevels` is given) per branch, verdict
   * BELOW_COST, rule BRANCHES.
   */
  branchProblems(
    candidates: readonly BucketPriceCandidate[],
    branches: readonly (readonly BranchStockCost[])[],
    opts: { activeLevels?: readonly number[]; levelNames?: ReadonlyMap<number, string> } = {},
  ): SellingPriceProblem[] {
    const problems: SellingPriceProblem[] = [];
    const judged = opts.activeLevels ? new Set(opts.activeLevels) : null;
    candidates.forEach((candidate, index) => {
      const own = ownCostOf(candidate);
      for (const branch of branches[index] ?? []) {
        if (!(branch.stockCost > (own ?? 0))) {
          continue;
        }
        for (const level of candidate.levels) {
          if (!(level.price > 0) || (judged && !judged.has(level.level))) {
            continue;
          }
          if (!(level.price < branch.stockCost)) {
            continue;
          }
          const name = levelLabel(level.level, opts.levelNames);
          const text = `${name} ${money(level.price)} is below the stock cost at ${branch.branchName} (${money(branch.stockCost)}).`;
          problems.push({
            lineNo: candidate.lineNo,
            itemId: candidate.itemId,
            itemCode: candidate.itemCode,
            itemName: candidate.itemName,
            uomId: candidate.uomId,
            bucketId: candidate.bucketId,
            level: level.level,
            verdict: 'BELOW_COST',
            message: candidate.itemName ? `${candidate.itemName}: ${text}` : text,
            code: PRICE_VERDICT_CODE.BELOW_COST,
            rule: 'BRANCHES',
            cost: round2(branch.stockCost),
            lineCost: own !== null ? round2(own) : null,
            stockCost: round2(branch.stockCost),
            branchId: branch.branchId,
            branchName: branch.branchName,
            params: paramsOf(candidate, level.level, level.price, opts.levelNames, {
              cost: money(branch.stockCost),
              stockCost: money(branch.stockCost),
              ...(own !== null ? { lineCost: money(own) } : {}),
              branch: branch.branchName,
            }),
          });
        }
      }
    });
    return problems;
  }

  /** P1 §4.7 — StockCostReader.otherBranches, in the caller's transaction. */
  otherBranchStockCosts(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    args: {
      companyId: string;
      excludeBranchId: string;
      onDate?: string;
      probes: readonly StockCostProbe[];
    },
  ): Promise<BranchStockCost[][]> {
    return StockCostReader.otherBranches(client, args);
  }

  /** P1 — the four selling levels' short names (else names) and whether each is active. */
  async priceLevels(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  ): Promise<Array<{ level: number; name: string; active: boolean }>> {
    const rows = await client.$queryRaw<
      Array<{ id: number; name: string | null; short: string | null; active: boolean | null }>
    >`
      SELECT price_lvl_id::int AS id, price_lvl_name AS name, price_lvl_short AS short,
             (price_lvl_is_active IS TRUE AND "price_lvl_isDeleted" IS NOT TRUE) AS active
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4`;
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return [1, 2, 3, 4].map((level) => {
      const row = byId.get(level);
      return {
        level,
        name: row?.short?.trim() || row?.name?.trim() || `Price ${'ABCD'[level - 1]}`,
        active: row?.active === true,
      };
    });
  }

  /** P1 — br_short, else br_name, per branch id (lower-cased keys). */
  async branchLabels(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    ids: readonly string[],
  ): Promise<Map<string, string>> {
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<Array<{ id: string; label: string }>>`
      SELECT br_id::text AS id, COALESCE(NULLIF(btrim(br_short), ''), br_name) AS label
        FROM public.branch_master
       WHERE br_id = ANY(${[...ids]}::uuid[])`;
    return new Map(rows.map((row) => [row.id.toLowerCase(), row.label]));
  }

  /** P1 — tax_name per tax id (the item row's "GST 5 %"). */
  async taxNames(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    ids: readonly string[],
  ): Promise<Map<string, string>> {
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT tax_id::text AS id, tax_name AS name
        FROM inventory.tax_rate_master
       WHERE tax_id = ANY(${[...ids]}::uuid[])`;
    return new Map(rows.map((row) => [row.id.toLowerCase(), row.name]));
  }

  /** P1 — the user's own branch (user_master.usr_branch_id), for a login with no device branch. */
  async userBranchId(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    userId: string,
  ): Promise<string | null> {
    const [row] = await client.$queryRaw<Array<{ branchId: string | null }>>`
      SELECT usr_branch_id::text AS "branchId" FROM public.user_master WHERE usr_id = ${userId}::uuid`;
    return typeof row?.branchId === 'string' ? row.branchId : null;
  }

  /**
   * S1 — find the row at the TARGET scope, `FOR UPDATE`.
   *
   * The scope is a predicate, not a filter on the result: searching at BRANCH
   * scope must not find the chain row, which is the whole mechanism behind
   * §5.5 row 2 (a *This branch* save over a CHAIN-sourced row creates an
   * override rather than editing the chain). Returns null when there is none,
   * and the caller inserts. A headline edit is key (-1, -1) of the same table.
   *
   * Notes 140 A — the row in force on `onDate` (`YYYY-MM-DD`), today when
   * omitted, with its period: a scheduled save splits it or updates it in place.
   */
  async findBucketRowForUpdate(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
    onDate?: string,
  ): Promise<LockedPriceRow | null> {
    // The company's own row first; failing that, a row with NO company on an item of
    // this company (the item card wrote such lines): it is this company's price, so it is
    // updated in place — inserting a company row beside it made two prices for one line
    // (change-selling-price review 2026-11-23, point 2). A SHARED item's company-less row
    // serves every company and is never taken here: this company gets its own row.
    const [row] = await tx.$queryRaw<LockedPriceRow[]>`
      SELECT ipm_id                   AS "ipmId",
             ipm_effective_from::text AS "effectiveFrom",
             ipm_effective_to::text   AS "effectiveTo"
        FROM inventory.item_price_master p
       WHERE (ipm_company_id IS NOT DISTINCT FROM ${candidate.companyId}::uuid
              OR (ipm_company_id IS NULL
                  AND EXISTS (SELECT 1 FROM inventory.item_master im
                               WHERE im.item_id = p.ipm_item_id AND im.item_company_id = ${candidate.companyId}::uuid)))
         AND ipm_branch_id  IS NOT DISTINCT FROM ${scope.targetBranchId}::uuid
         AND ipm_item_id    = ${candidate.itemId}::uuid
         AND ipm_uc_unit_id = ${candidate.uomId}::uuid
         AND ipm_key_mrp    = COALESCE(${candidate.mrp}::numeric, -1)
         AND ipm_key_sp     = COALESCE(${candidate.salePrice}::numeric, -1)
         AND ${daySql(onDate)} BETWEEN ipm_effective_from AND ipm_effective_to
         AND ipm_is_deleted = false
       ORDER BY (ipm_company_id IS NULL)
       LIMIT 1
       FOR UPDATE OF p
    `;
    return row ?? null;
  }

  /**
   * Notes 140 A — the database's today, and the furthest day a price may be
   * scheduled for. CURRENT_DATE rather than the server clock: every statement
   * here compares the effective dates with CURRENT_DATE, and the two disagree
   * for five and a half hours a day when the server runs on UTC.
   */
  async calendar(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  ): Promise<{ today: string; latest: string }> {
    const [row] = await client.$queryRaw<Array<{ today: string; latest: string }>>`
      SELECT CURRENT_DATE::text AS today,
             (CURRENT_DATE + interval '1 year')::date::text AS latest
    `;
    return row;
  }

  /**
   * Notes 140 B — the row a cancel names, locked, with what the cancel must
   * know about it. Null when there is no such row at all.
   */
  async lockScheduledRow(
    tx: Prisma.TransactionClient,
    ipmId: string,
  ): Promise<{
    ipmId: string;
    branchId: string | null;
    isDeleted: boolean;
    started: boolean;
    effectiveFrom: string;
    effectiveTo: string;
  } | null> {
    const [row] = await tx.$queryRaw<
      Array<{
        ipmId: string;
        branchId: string | null;
        isDeleted: boolean;
        started: boolean;
        effectiveFrom: string;
        effectiveTo: string;
      }>
    >`
      SELECT ipm_id                            AS "ipmId",
             ipm_branch_id                     AS "branchId",
             ipm_is_deleted                    AS "isDeleted",
             ipm_effective_from <= CURRENT_DATE AS "started",
             ipm_effective_from::text          AS "effectiveFrom",
             ipm_effective_to::text            AS "effectiveTo"
        FROM inventory.item_price_master
       WHERE ipm_id = ${ipmId}::uuid
       FOR UPDATE
    `;
    return row ?? null;
  }

  /**
   * Notes 140 B — the live row of the same key that ends the day before
   * `ipmId` starts (the row a split closed, or an earlier schedule), locked.
   */
  async findRowBeforeForUpdate(
    tx: Prisma.TransactionClient,
    ipmId: string,
  ): Promise<{ ipmId: string } | null> {
    const [row] = await tx.$queryRaw<Array<{ ipmId: string }>>`
      SELECT b.ipm_id AS "ipmId"
        FROM inventory.item_price_master c
        JOIN inventory.item_price_master b
          ON b.ipm_company_id IS NOT DISTINCT FROM c.ipm_company_id
         AND b.ipm_branch_id  IS NOT DISTINCT FROM c.ipm_branch_id
         AND b.ipm_item_id    = c.ipm_item_id
         AND b.ipm_uc_unit_id = c.ipm_uc_unit_id
         AND b.ipm_key_mrp    = c.ipm_key_mrp
         AND b.ipm_key_sp     = c.ipm_key_sp
         AND b.ipm_effective_to = c.ipm_effective_from - 1
         AND b.ipm_is_deleted = false
         AND b.ipm_id <> c.ipm_id
       WHERE c.ipm_id = ${ipmId}::uuid
       FOR UPDATE OF b
    `;
    return row ?? null;
  }

  /**
   * Notes 140 B — every live price row this branch can see (its own and the
   * chain's) that starts after today, as grid records, each with the prices
   * it replaces: the row of the same key that ends the day before it, else
   * whatever the resolver priced the bucket with that day at this branch (a
   * new override replaces the chain's price, a new bucket the headline's).
   * Stock and cost are today's, exactly as the grid shows them.
   */
  async listScheduled(
    companyId: string,
    branchId: string,
    itemId?: string,
  ): Promise<PriceScheduleRecord[]> {
    const key = bucketKeySql({
      trackMrp: Prisma.raw('pol.track_mrp'),
      trackSalePrice: Prisma.raw('pol.track_sp'),
      mrp: Prisma.raw('b.sbl_mrp'),
      salePrice: Prisma.raw('b.sbl_sale_price'),
    });
    const cost = costColumns({ mc: 'mc', sic: 'sic', p: 'f', factor: 'iuc.iuc_to_base_factor' });
    const rows = await this.prisma.$queryRaw<
      Array<
        GridSqlRow & {
          effectiveFrom: string;
          effectiveTo: string;
          previousId: string | null;
          previousBranchId: string | null;
          previousA: Prisma.Decimal | null;
          previousB: Prisma.Decimal | null;
          previousC: Prisma.Decimal | null;
          previousD: Prisma.Decimal | null;
        }
      >
    >`
      WITH f AS (
        SELECT p.*, i.item_code, i.item_name_en, i.item_default_barcode
          FROM inventory.item_price_master p
          JOIN inventory.item_master i ON i.item_id = p.ipm_item_id AND i.item_is_deleted = false
         WHERE p.ipm_is_deleted = false
           AND p.ipm_effective_from > CURRENT_DATE
           AND (p.ipm_company_id IS NULL OR p.ipm_company_id = ${companyId}::uuid)
           AND (p.ipm_branch_id  IS NULL OR p.ipm_branch_id  = ${branchId}::uuid)
           ${itemId ? Prisma.sql`AND p.ipm_item_id = ${itemId}::uuid` : Prisma.empty}
      ),
      pol AS (
        SELECT i.item_id,
               COALESCE(stp.stp_track_mrp, false)        AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sp
          FROM inventory.item_master i
          ${effectivePolicyLateral({
            companyId: Prisma.sql`${companyId}::uuid`,
            branchId: Prisma.sql`${branchId}::uuid`,
            itemId: Prisma.raw('i.item_id'),
            itemGroupId: Prisma.raw('i.item_group_id'),
            onDate: Prisma.raw('CURRENT_DATE'),
          })}
         WHERE i.item_id IN (SELECT ipm_item_id FROM f)
      ),
      stock AS (
        SELECT b.sbl_item_id                  AS item_id,
               COALESCE(${key.mrp}, -1)       AS key_mrp,
               COALESCE(${key.salePrice}, -1) AS key_sp,
               SUM(b.sbl_on_hand_qty)         AS qty
          FROM stock.stock_balance b
          JOIN pol ON pol.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${companyId}::uuid
           AND b.sbl_branch_id  = ${branchId}::uuid
           AND b.sbl_bucket     = 'SALEABLE'
           AND b.sbl_is_deleted = false
         GROUP BY 1, 2, 3
      ),
      ${mrpCostCte({
        companyId,
        branchId,
        pairs: Prisma.sql`
          SELECT DISTINCT f.ipm_item_id AS item_id, f.ipm_bucket_mrp AS mrp
            FROM f JOIN pol ON pol.item_id = f.ipm_item_id
           WHERE pol.track_mrp AND f.ipm_bucket_mrp IS NOT NULL`,
      })}
      SELECT f.ipm_item_id          AS "itemId",
             f.item_code            AS "itemCode",
             f.item_default_barcode AS "barcode",
             f.item_name_en         AS "itemName",
             f.ipm_uc_unit_id       AS "uomId",
             u.unit_name            AS "unitName",
             COALESCE(st.qty, 0) / NULLIF(iuc.iuc_to_base_factor, 0) AS "stockQty",
             f.ipm_bucket_mrp       AS "mrp",
             f.ipm_bucket_sp        AS "salePrice",
             (f.ipm_key_mrp <> -1 OR f.ipm_key_sp <> -1) AS "priceIsBucket",
             f.ipm_branch_id        AS "priceBranchId",
             f.ipm_id               AS "bucketId",
             f.ipm_max_price        AS "maxPrice",
             ${cost.rate}           AS "costRate",
             ${cost.wot}            AS "costWot",
             ${cost.basis}          AS "costBasis",
             f.ipm_min_price        AS "minPrice",
             f.ipm_round_off        AS "roundOff",
             f.ipm_sales_price_a    AS "priceA",
             f.ipm_sales_price_b    AS "priceB",
             f.ipm_sales_price_c    AS "priceC",
             f.ipm_sales_price_d    AS "priceD",
             f.ipm_effective_from::text AS "effectiveFrom",
             f.ipm_effective_to::text   AS "effectiveTo",
             COALESCE(pk.ipm_id, p.ipm_id) AS "previousId",
             CASE WHEN pk.ipm_id IS NOT NULL THEN pk.ipm_branch_id ELSE p.ipm_branch_id END
                                    AS "previousBranchId",
             CASE WHEN pk.ipm_id IS NOT NULL THEN pk.ipm_sales_price_a ELSE p.ipm_sales_price_a END
                                    AS "previousA",
             CASE WHEN pk.ipm_id IS NOT NULL THEN pk.ipm_sales_price_b ELSE p.ipm_sales_price_b END
                                    AS "previousB",
             CASE WHEN pk.ipm_id IS NOT NULL THEN pk.ipm_sales_price_c ELSE p.ipm_sales_price_c END
                                    AS "previousC",
             CASE WHEN pk.ipm_id IS NOT NULL THEN pk.ipm_sales_price_d ELSE p.ipm_sales_price_d END
                                    AS "previousD"
        FROM f
        JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = f.ipm_uc_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN pol ON pol.item_id = f.ipm_item_id
        LEFT JOIN stock st
               ON st.item_id = f.ipm_item_id AND st.key_mrp = f.ipm_key_mrp AND st.key_sp = f.ipm_key_sp
        LEFT JOIN mrp_cost mc
               ON pol.track_mrp AND mc.item_id = f.ipm_item_id AND mc.mrp = f.ipm_bucket_mrp
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${companyId}::uuid
              AND sic.sic_branch_id  = ${branchId}::uuid
              AND sic.sic_item_id    = f.ipm_item_id
              AND sic.sic_is_deleted = false
        LEFT JOIN LATERAL (
          SELECT k.*
            FROM inventory.item_price_master k
           WHERE k.ipm_is_deleted = false
             AND k.ipm_company_id IS NOT DISTINCT FROM f.ipm_company_id
             AND k.ipm_branch_id  IS NOT DISTINCT FROM f.ipm_branch_id
             AND k.ipm_item_id    = f.ipm_item_id
             AND k.ipm_uc_unit_id = f.ipm_uc_unit_id
             AND k.ipm_key_mrp    = f.ipm_key_mrp
             AND k.ipm_key_sp     = f.ipm_key_sp
             AND k.ipm_effective_to = f.ipm_effective_from - 1
           LIMIT 1
        ) pk ON true
        ${effectivePriceLateral({
          itemId: Prisma.raw('f.ipm_item_id'),
          uomId: Prisma.raw('f.ipm_uc_unit_id'),
          mrp: Prisma.raw('f.ipm_bucket_mrp'),
          salePrice: Prisma.raw('f.ipm_bucket_sp'),
          companyId,
          branchId,
          onDate: Prisma.raw('(f.ipm_effective_from - 1)'),
        })}
       ORDER BY f.item_name_en, f.ipm_item_id, iuc.iuc_unit_slno, f.ipm_uc_unit_id,
                f.ipm_effective_from, f.ipm_key_mrp, f.ipm_key_sp,
                (f.ipm_branch_id IS NOT NULL), f.ipm_id
    `;
    const amount = (value: Prisma.Decimal | null) => (value === null ? 0 : toNumber(value));
    return rows.map((row) => ({
      ...this.toGridRecord(row),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      previous:
        row.previousId === null
          ? null
          : {
              bucketId: row.previousId,
              priceScope: row.previousBranchId === null ? 'CHAIN' : 'BRANCH',
              prices: [
                amount(row.previousA),
                amount(row.previousB),
                amount(row.previousC),
                amount(row.previousD),
              ],
            },
    }));
  }

  /**
   * The rows as stored, keyed by ipm_id, as column-named JSON (`to_jsonb`) —
   * exactly the shape the "Item Price Master" audit screen projects.
   */
  async snapshotRows(
    tx: Prisma.TransactionClient,
    ipmIds: readonly string[],
  ): Promise<Map<string, Prisma.JsonObject>> {
    if (!ipmIds.length) {
      return new Map();
    }
    const rows = await tx.$queryRaw<Array<{ id: string; row: Prisma.JsonObject }>>`
      SELECT p.ipm_id::text AS id, to_jsonb(p) AS row
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${[...ipmIds]}::uuid[])
    `;
    return new Map(rows.map((r) => [r.id, r.row]));
  }

  /**
   * Q27 — of the rows just written, the ones whose bucket has nothing on hand
   * at this branch. §5.4. The stock is blanked by the policy exactly as the
   * row's bucket was, so a headline row of an untracked item counts all of
   * the item's stock and a bucket row counts only its own MRP.
   */
  async listNoStock(
    tx: Prisma.TransactionClient,
    ipmIds: readonly string[],
    companyId: string,
    branchId: string,
  ): Promise<SellingPriceNoStockRow[]> {
    if (!ipmIds.length) {
      return [];
    }
    const key = bucketKeySql({
      trackMrp: Prisma.raw('COALESCE(stp.stp_track_mrp, false)'),
      trackSalePrice: Prisma.raw('COALESCE(stp.stp_track_sale_price, false)'),
      mrp: Prisma.raw('b.sbl_mrp'),
      salePrice: Prisma.raw('b.sbl_sale_price'),
    });
    const rows = await tx.$queryRaw<
      Array<{
        bucketId: string;
        itemId: string;
        itemCode: string | null;
        itemName: string;
        uomId: string;
        unitName: string | null;
        mrp: Prisma.Decimal | null;
        salePrice: Prisma.Decimal | null;
      }>
    >`
      SELECT pr.ipm_id         AS "bucketId",
             pr.ipm_item_id    AS "itemId",
             i.item_code      AS "itemCode",
             i.item_name_en   AS "itemName",
             pr.ipm_uc_unit_id AS "uomId",
             u.unit_name      AS "unitName",
             pr.ipm_bucket_mrp AS "mrp",
             pr.ipm_bucket_sp  AS "salePrice"
        FROM inventory.item_price_master pr
        JOIN inventory.item_master i ON i.item_id = pr.ipm_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = pr.ipm_uc_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        ${effectivePolicyLateral({
          companyId: Prisma.sql`${companyId}::uuid`,
          branchId: Prisma.sql`${branchId}::uuid`,
          itemId: Prisma.raw('pr.ipm_item_id'),
          itemGroupId: Prisma.raw('i.item_group_id'),
          onDate: Prisma.raw('CURRENT_DATE'),
        })}
       WHERE pr.ipm_id = ANY(${[...ipmIds]}::uuid[])
         AND COALESCE((
               SELECT SUM(b.sbl_on_hand_qty)
                 FROM stock.stock_balance b
                WHERE b.sbl_item_id    = pr.ipm_item_id
                  AND b.sbl_company_id = ${companyId}::uuid
                  AND b.sbl_branch_id  = ${branchId}::uuid
                  AND b.sbl_bucket     = 'SALEABLE'
                  AND b.sbl_is_deleted = false
                  AND COALESCE(${key.mrp}, -1)       = pr.ipm_key_mrp
                  AND COALESCE(${key.salePrice}, -1) = pr.ipm_key_sp
             ), 0) <= 0
       ORDER BY i.item_name_en, pr.ipm_id
    `;
    return rows.map((row) => ({
      ...row,
      mrp: row.mrp === null ? null : toNumber(row.mrp),
      salePrice: row.salePrice === null ? null : toNumber(row.salePrice),
    }));
  }

  /**
   * Change Selling Price P1 (plan 2026-11-23 §4.1) — the grid's LINES for a page of ITEMS
   * (a page never splits an item). Per live unit of each item, in this order:
   *   * the HEADLINE (key -1/-1), always — the "other MRPs" line of an MRP item; priced or
   *     not (no row: bucketId null);
   *   * every MRP / "sold at" line in force at the branch, stock or none — one per key, the
   *     resolver's winner (the branch's own line before the All branches one, company before
   *     shared); keys the item's policy does not track are left out (the save would blank them
   *     into the headline);
   *   * NO_PRICE: stock at the branch whose key has no line of its own — priced by the
   *     headline (what it sells at today), as today's grid prices it.
   * A HEADLINE with no row and stock on hand is a NO_PRICE line too. `unpricedOnly` keeps
   * the items with at least one NO_PRICE line. Ordered by item name, unit order, headline
   * first, then MRP / sale price.
   */
  async listPriceLines(args: ListSellingPricesArgs): Promise<{
    items: PriceLineRecord[];
    meta: { limit: number; offset: number; count: number; lines: number };
  }> {
    const key = bucketKeySql({
      trackMrp: Prisma.raw('pol.track_mrp'),
      trackSalePrice: Prisma.raw('pol.track_sp'),
      mrp: Prisma.raw('b.sbl_mrp'),
      salePrice: Prisma.raw('b.sbl_sale_price'),
    });
    const gridCost = costColumns({ mc: 'mc', sic: 'sic', p: 'p', factor: 'un.factor' });
    const stock = stockCostColumns({
      mc: 'mc',
      sic: 'sic',
      factor: 'un.factor',
      mrpKey: 'k.key_mrp <> -1',
      none: 'pol.track_mrp AND k.key_mrp = -1',
    });
    const co = args.companyId;
    const br = args.branchId;
    const exact = Prisma.raw(
      '(p.ipm_id IS NOT NULL AND p.ipm_key_mrp = k.key_mrp AND p.ipm_key_sp = k.key_sp)',
    );
    const rows = await this.prisma.$queryRaw<
      Array<
        GridSqlRow & {
          pageItems: bigint;
          keyMrp: Prisma.Decimal;
          keySp: Prisma.Decimal;
          exact: boolean;
          lineCost: Prisma.Decimal | null;
          lineCostWot: Prisma.Decimal | null;
          stockCost: Prisma.Decimal | null;
          stockCostWot: Prisma.Decimal | null;
          stockCostBasis: 'MRP' | 'ITEM' | null;
          profitType: string;
          companyId: string | null;
          companyName: string | null;
          branchName: string | null;
          unitFactor: Prisma.Decimal | null;
          unitSlNo: number | null;
          isDefaultUnit: boolean | null;
          itemGroupName: string | null;
          trackPresetName: string | null;
          trackMrp: boolean;
          trackSalePrice: boolean;
          itemCompanyId: string | null;
          itemStockQty: Prisma.Decimal | null;
          itemStockUnit: string | null;
          markupA: Prisma.Decimal | null;
          markupB: Prisma.Decimal | null;
          markupC: Prisma.Decimal | null;
          markupD: Prisma.Decimal | null;
        }
      >
    >`
      WITH items AS (
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_group_id, i.item_default_barcode,
               i.item_company_id, i.item_track_preset_id
          FROM inventory.item_master i
         WHERE i.item_is_deleted = false
           AND (i.item_company_id IS NULL OR i.item_company_id = ${co}::uuid)
           AND (i.item_branch_id  IS NULL OR i.item_branch_id  = ${br}::uuid)
           AND (${args.itemGroupId ?? null}::uuid IS NULL OR i.item_group_id = ${args.itemGroupId ?? null}::uuid)
           AND (${args.itemBrandId ?? null}::uuid IS NULL OR i.item_brand_id = ${args.itemBrandId ?? null}::uuid)
           AND (${args.itemSectionId ?? null}::uuid IS NULL OR i.item_section_id = ${args.itemSectionId ?? null}::uuid)
           AND (${args.supplierId ?? null}::uuid IS NULL OR i.item_supplier_id = ${args.supplierId ?? null}::uuid)
           AND (${args.itemId ?? null}::uuid IS NULL OR i.item_id = ${args.itemId ?? null}::uuid)
           ${this.popupFilter(args)}
      ),
      pol AS (
        SELECT items.item_id,
               COALESCE(stp.stp_track_mrp, false)        AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sp
          FROM items
          ${effectivePolicyLateral({
            companyId: Prisma.sql`${co}::uuid`,
            branchId: Prisma.sql`${br}::uuid`,
            itemId: Prisma.raw('items.item_id'),
            itemGroupId: Prisma.raw('items.item_group_id'),
            onDate: Prisma.raw('CURRENT_DATE'),
          })}
      ),
      stock AS (
        SELECT b.sbl_item_id AS item_id,
               ${key.mrp}       AS mrp,
               ${key.salePrice} AS sp,
               SUM(b.sbl_on_hand_qty) AS qty
          FROM stock.stock_balance b
          JOIN pol ON pol.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${co}::uuid
           AND b.sbl_branch_id  = ${br}::uuid
           AND b.sbl_bucket     = 'SALEABLE'
           AND b.sbl_is_deleted = false
         GROUP BY 1, 2, 3
        HAVING SUM(b.sbl_on_hand_qty) <> 0
      ),
      page AS (
        SELECT items.item_id
          FROM items
         WHERE ${args.unpricedOnly === true} = false
            OR EXISTS (
                 SELECT 1
                   FROM stock st
                   JOIN inventory.item_unit_conversion iuc
                     ON iuc.iuc_item_id = st.item_id AND iuc.iuc_is_deleted = false
                    AND iuc.iuc_is_active = true
                  WHERE st.item_id = items.item_id
                    AND NOT EXISTS (
                          SELECT 1
                            FROM inventory.item_price_master p
                           WHERE p.ipm_item_id    = st.item_id
                             AND p.ipm_uc_unit_id = iuc.iuc_id
                             AND p.ipm_is_deleted = false
                             AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
                             AND (p.ipm_company_id IS NULL OR p.ipm_company_id = ${co}::uuid)
                             AND (p.ipm_branch_id  IS NULL OR p.ipm_branch_id  = ${br}::uuid)
                             AND p.ipm_key_mrp = COALESCE(st.mrp, -1)
                             AND p.ipm_key_sp  = COALESCE(st.sp, -1)))
         ORDER BY items.item_name_en, items.item_id
         LIMIT ${args.limit} OFFSET ${args.offset}
      ),
      units AS (
        SELECT iuc.iuc_id, iuc.iuc_item_id AS item_id, iuc.iuc_unit_slno,
               iuc.iuc_to_base_factor AS factor, iuc.iuc_is_default_unit, u.unit_name
          FROM page
          JOIN inventory.item_unit_conversion iuc
            ON iuc.iuc_item_id = page.item_id AND iuc.iuc_is_deleted = false
           AND iuc.iuc_is_active = true   -- review NIT 3: an inactive unit is not listed (as menu 244)
          LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
      ),
      keys AS (
        SELECT un.iuc_id, un.item_id, (-1)::numeric AS key_mrp, (-1)::numeric AS key_sp
          FROM units un
        UNION
        SELECT un.iuc_id, un.item_id, p.ipm_key_mrp, p.ipm_key_sp
          FROM units un
          JOIN pol ON pol.item_id = un.item_id
          JOIN inventory.item_price_master p
            ON p.ipm_item_id    = un.item_id
           AND p.ipm_uc_unit_id = un.iuc_id
           AND p.ipm_is_deleted = false
           AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
           AND (p.ipm_company_id IS NULL OR p.ipm_company_id = ${co}::uuid)
           AND (p.ipm_branch_id  IS NULL OR p.ipm_branch_id  = ${br}::uuid)
         WHERE (p.ipm_key_mrp <> -1 OR p.ipm_key_sp <> -1)
           AND (p.ipm_key_mrp = -1 OR pol.track_mrp)
           AND (p.ipm_key_sp  = -1 OR pol.track_sp)
        UNION
        SELECT un.iuc_id, un.item_id, COALESCE(st.mrp, -1), COALESCE(st.sp, -1)
          FROM units un
          JOIN stock st ON st.item_id = un.item_id
      ),
      ${mrpCostCte({
        companyId: co,
        branchId: br,
        pairs: Prisma.sql`SELECT DISTINCT item_id, key_mrp AS mrp FROM keys WHERE key_mrp <> -1`,
      })},
      item_stock AS (
        SELECT st.item_id, SUM(st.qty) AS qty FROM stock st GROUP BY st.item_id
      ),
      shown_unit AS (
        SELECT DISTINCT ON (un.item_id) un.item_id, un.unit_name, un.factor
          FROM units un
         ORDER BY un.item_id, un.iuc_is_default_unit DESC NULLS LAST, (un.factor = 1) DESC, un.iuc_unit_slno
      )
      SELECT (SELECT count(*) FROM page)  AS "pageItems",
             items.item_id                AS "itemId",
             items.item_code              AS "itemCode",
             items.item_default_barcode   AS "barcode",
             items.item_name_en           AS "itemName",
             un.iuc_id                    AS "uomId",
             un.unit_name                 AS "unitName",
             COALESCE(st.qty, 0) / NULLIF(un.factor, 0) AS "stockQty",
             NULLIF(k.key_mrp, -1)        AS "mrp",
             NULLIF(k.key_sp, -1)         AS "salePrice",
             k.key_mrp                    AS "keyMrp",
             k.key_sp                     AS "keySp",
             ${exact}                     AS "exact",
             p.p_is_bucket                AS "priceIsBucket",
             p.ipm_branch_id              AS "priceBranchId",
             p.ipm_id                     AS "bucketId",
             p.ipm_max_price              AS "maxPrice",
             ${gridCost.rate}             AS "costRate",
             ${gridCost.wot}              AS "costWot",
             ${gridCost.basis}            AS "costBasis",
             p.ipm_min_price              AS "minPrice",
             p.ipm_round_off              AS "roundOff",
             p.ipm_sales_price_a          AS "priceA",
             p.ipm_sales_price_b          AS "priceB",
             p.ipm_sales_price_c          AS "priceC",
             p.ipm_sales_price_d          AS "priceD",
             CASE WHEN ${exact} THEN p.ipm_cost_price END AS "lineCost",
             CASE WHEN ${exact} THEN p.ipm_cost_wot   END AS "lineCostWot",
             CASE WHEN ${exact} THEN p.ipm_price_a_markup_perc END AS "markupA",
             CASE WHEN ${exact} THEN p.ipm_price_b_markup_perc END AS "markupB",
             CASE WHEN ${exact} THEN p.ipm_price_c_markup_perc END AS "markupC",
             CASE WHEN ${exact} THEN p.ipm_price_d_markup_perc END AS "markupD",
             ${stock.rate}                AS "stockCost",
             ${stock.wot}                 AS "stockCostWot",
             ${stock.basis}               AS "stockCostBasis",
             COALESCE(NULLIF(btrim(p.ipm_profit_type), ''), 'By User') AS "profitType",
             CASE WHEN ${exact}
                  THEN COALESCE(p.ipm_company_id,
                                CASE WHEN items.item_company_id = ${co}::uuid THEN items.item_company_id END)
                  ELSE ${co}::uuid END   AS "companyId",
             cmp.comp_label               AS "companyName",
             CASE WHEN ${exact} THEN brn.br_label END AS "branchName",
             un.factor                    AS "unitFactor",
             un.iuc_unit_slno             AS "unitSlNo",
             un.iuc_is_default_unit       AS "isDefaultUnit",
             grp.itg_name                 AS "itemGroupName",
             spt.spt_name                 AS "trackPresetName",
             pol.track_mrp                AS "trackMrp",
             pol.track_sp                 AS "trackSalePrice",
             items.item_company_id        AS "itemCompanyId",
             COALESCE(ist.qty, 0) / NULLIF(su.factor, 0) AS "itemStockQty",
             su.unit_name                 AS "itemStockUnit"
        FROM keys k
        JOIN units un ON un.iuc_id = k.iuc_id
        JOIN items    ON items.item_id = k.item_id
        JOIN pol      ON pol.item_id = k.item_id
        LEFT JOIN stock st
               ON st.item_id = k.item_id AND COALESCE(st.mrp, -1) = k.key_mrp AND COALESCE(st.sp, -1) = k.key_sp
        LEFT JOIN mrp_cost mc ON mc.item_id = k.item_id AND mc.mrp = k.key_mrp AND k.key_mrp <> -1
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${co}::uuid
              AND sic.sic_branch_id  = ${br}::uuid
              AND sic.sic_item_id    = k.item_id
              AND sic.sic_is_deleted = false
        LEFT JOIN item_stock ist ON ist.item_id = k.item_id
        LEFT JOIN shown_unit su  ON su.item_id = k.item_id
        LEFT JOIN inventory.item_group_master grp ON grp.itg_id = items.item_group_id
        LEFT JOIN stock.stock_track_preset spt
               ON spt.spt_id = COALESCE(items.item_track_preset_id, grp.itg_track_preset_id)
        ${effectivePriceLateral({
          itemId: Prisma.raw('k.item_id'),
          uomId: Prisma.raw('k.iuc_id'),
          mrp: Prisma.raw('NULLIF(k.key_mrp, -1)'),
          salePrice: Prisma.raw('NULLIF(k.key_sp, -1)'),
          companyId: co,
          branchId: br,
          onDate: Prisma.raw('CURRENT_DATE'),
        })}
        LEFT JOIN LATERAL (
          SELECT COALESCE(NULLIF(btrim(c.comp_short), ''), c.comp_name) AS comp_label
            FROM public.companys c
           WHERE c.comp_id = CASE WHEN ${exact}
                                  THEN COALESCE(p.ipm_company_id,
                                                CASE WHEN items.item_company_id = ${co}::uuid THEN items.item_company_id END)
                                  ELSE ${co}::uuid END
        ) cmp ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(NULLIF(btrim(b.br_short), ''), b.br_name) AS br_label
            FROM public.branch_master b
           WHERE b.br_id = p.ipm_branch_id
        ) brn ON true
       ORDER BY items.item_name_en, items.item_id, un.iuc_unit_slno, un.iuc_id,
                (k.key_mrp <> -1 OR k.key_sp <> -1), k.key_mrp, k.key_sp
    `;
    const amount = (value: Prisma.Decimal | null | undefined) =>
      value === null || value === undefined ? null : toNumber(value);
    const items: PriceLineRecord[] = rows.map((row) => {
      const headlineKey = toNumber(row.keyMrp) === -1 && toNumber(row.keySp) === -1;
      const stockQty = amount(row.stockQty) ?? 0;
      const lineKind: PriceLineKind = row.exact
        ? headlineKey
          ? 'HEADLINE'
          : toNumber(row.keySp) !== -1
            ? 'SOLD_AT'
            : 'MRP'
        : headlineKey && stockQty === 0
          ? 'HEADLINE'
          : 'NO_PRICE';
      return {
        ...this.toGridRecord(row),
        lineKind,
        lineCost: amount(row.lineCost),
        lineCostWot: amount(row.lineCostWot),
        stockCost: amount(row.stockCost),
        stockCostWot: amount(row.stockCostWot),
        stockCostBasis: row.stockCostBasis,
        profitType: row.profitType,
        companyId: row.companyId,
        companyName: row.companyName,
        branchId: row.exact ? row.priceBranchId : null,
        branchName: row.exact ? row.branchName : null,
        unitFactor: amount(row.unitFactor) ?? 1,
        unitSlNo: row.unitSlNo ?? 0,
        isDefaultUnit: row.isDefaultUnit === true,
        itemGroupName: row.itemGroupName,
        trackPresetName: row.trackPresetName,
        trackMrp: row.trackMrp,
        trackSalePrice: row.trackSalePrice,
        itemCompanyId: row.itemCompanyId,
        itemStockQty: amount(row.itemStockQty) ?? 0,
        itemStockUnit: row.itemStockUnit,
        storedMarkups: [
          amount(row.markupA),
          amount(row.markupB),
          amount(row.markupC),
          amount(row.markupD),
        ],
      };
    });
    const count = rows.length ? Number(rows[0].pageItems) : 0;
    return { items, meta: { limit: args.limit, offset: args.offset, count, lines: items.length } };
  }

  /**
   * P1 §4.9 — the row Back to all branches names, locked, with its item and unit names.
   * Null when there is no such row at all (deleted rows are answered: the card rewrites
   * lines, and the caller finds the live one by key).
   */
  async lockPriceRow(tx: Prisma.TransactionClient, ipmId: string): Promise<LockedOwnLine | null> {
    const [row] = await tx.$queryRaw<
      Array<{
        ipmId: string;
        companyId: string | null;
        branchId: string | null;
        itemId: string;
        uomId: string;
        keyMrp: Prisma.Decimal;
        keySp: Prisma.Decimal;
        isDeleted: boolean;
        itemName: string | null;
        unitName: string | null;
      }>
    >`
      SELECT p.ipm_id         AS "ipmId",
             p.ipm_company_id AS "companyId",
             p.ipm_branch_id  AS "branchId",
             p.ipm_item_id    AS "itemId",
             p.ipm_uc_unit_id AS "uomId",
             p.ipm_key_mrp    AS "keyMrp",
             p.ipm_key_sp     AS "keySp",
             p.ipm_is_deleted AS "isDeleted",
             i.item_name_en   AS "itemName",
             u.unit_name      AS "unitName"
        FROM inventory.item_price_master p
        LEFT JOIN inventory.item_master i ON i.item_id = p.ipm_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = p.ipm_uc_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE p.ipm_id = ${ipmId}::uuid
       FOR UPDATE OF p
    `;
    return row
      ? {
          ...row,
          keyMrp: toNumber(row.keyMrp),
          keySp: toNumber(row.keySp),
          itemName: row.itemName ?? '',
        }
      : null;
  }

  /**
   * P1 §4.9 / Q5 — the branch's own live rows of one key that are in force today or start
   * later (the line and its scheduled rows), oldest first, locked. History (ended before
   * today) is not touched.
   */
  async liveOwnRowsOfKey(
    tx: Prisma.TransactionClient,
    line: Pick<LockedOwnLine, 'companyId' | 'branchId' | 'itemId' | 'uomId' | 'keyMrp' | 'keySp'>,
  ): Promise<Array<{ ipmId: string; effectiveFrom: string }>> {
    return tx.$queryRaw<Array<{ ipmId: string; effectiveFrom: string }>>`
      SELECT p.ipm_id AS "ipmId", p.ipm_effective_from::text AS "effectiveFrom"
        FROM inventory.item_price_master p
       WHERE p.ipm_company_id IS NOT DISTINCT FROM ${line.companyId}::uuid
         AND p.ipm_branch_id  = ${line.branchId}::uuid
         AND p.ipm_item_id    = ${line.itemId}::uuid
         AND p.ipm_uc_unit_id = ${line.uomId}::uuid
         AND p.ipm_key_mrp    = ${line.keyMrp}::numeric
         AND p.ipm_key_sp     = ${line.keySp}::numeric
         AND p.ipm_is_deleted = false
         AND p.ipm_effective_to >= CURRENT_DATE
       ORDER BY p.ipm_effective_from, p.ipm_id
       FOR UPDATE OF p
    `;
  }

  /**
   * P1 §4.9 — what would price the unit at the branch today once `excludeIds` are gone: the
   * resolver's answer (the exact key before the headline, the branch before the chain, the
   * company before shared) over the remaining live rows. Null = nothing (BACK_NOTHING_LEFT).
   */
  async priceAfterRemoval(
    tx: Prisma.TransactionClient,
    args: {
      companyId: string;
      branchId: string;
      itemId: string;
      uomId: string;
      keyMrp: number;
      keySp: number;
      excludeIds: readonly string[];
    },
  ): Promise<{
    ipmId: string;
    branchId: string | null;
    keyMrp: number;
    keySp: number;
    prices: [number, number, number, number];
  } | null> {
    const [row] = await tx.$queryRaw<
      Array<{
        ipmId: string;
        branchId: string | null;
        keyMrp: Prisma.Decimal;
        keySp: Prisma.Decimal;
        priceA: Prisma.Decimal | null;
        priceB: Prisma.Decimal | null;
        priceC: Prisma.Decimal | null;
        priceD: Prisma.Decimal | null;
      }>
    >`
      SELECT p.ipm_id AS "ipmId", p.ipm_branch_id AS "branchId",
             p.ipm_key_mrp AS "keyMrp", p.ipm_key_sp AS "keySp",
             p.ipm_sales_price_a AS "priceA", p.ipm_sales_price_b AS "priceB",
             p.ipm_sales_price_c AS "priceC", p.ipm_sales_price_d AS "priceD"
        FROM inventory.item_price_master p
       WHERE p.ipm_item_id    = ${args.itemId}::uuid
         AND p.ipm_uc_unit_id = ${args.uomId}::uuid
         AND p.ipm_is_deleted = false
         AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
         AND (p.ipm_company_id IS NULL OR p.ipm_company_id = ${args.companyId}::uuid)
         AND (p.ipm_branch_id  IS NULL OR p.ipm_branch_id  = ${args.branchId}::uuid)
         AND (   (p.ipm_key_mrp = ${args.keyMrp}::numeric AND p.ipm_key_sp = ${args.keySp}::numeric)
              OR (p.ipm_key_mrp = -1 AND p.ipm_key_sp = -1))
         AND NOT (p.ipm_id = ANY(${[...args.excludeIds]}::uuid[]))
       ORDER BY (p.ipm_key_mrp = ${args.keyMrp}::numeric AND p.ipm_key_sp = ${args.keySp}::numeric) DESC,
                (p.ipm_branch_id IS NULL), (p.ipm_company_id IS NULL), p.ipm_id
       LIMIT 1
    `;
    if (!row) {
      return null;
    }
    const amount = (value: Prisma.Decimal | null) => (value === null ? 0 : toNumber(value));
    return {
      ipmId: row.ipmId,
      branchId: row.branchId,
      keyMrp: toNumber(row.keyMrp),
      keySp: toNumber(row.keySp),
      prices: [amount(row.priceA), amount(row.priceB), amount(row.priceC), amount(row.priceD)],
    };
  }

  /**
   * Q25's statement: live buckets per item from stock_balance at the branch,
   * BLANKED by the policy and grouped again, each against every live unit of
   * the item, priced through `effectivePriceLateral`. An item with no live
   * bucket contributes its headline key (NULL, NULL) instead.
   */
  private gridStatement(args: {
    companyId: string;
    branchId: string;
    itemFilter: Prisma.Sql;
  }): Prisma.Sql {
    const key = bucketKeySql({
      trackMrp: Prisma.raw('pol.track_mrp'),
      trackSalePrice: Prisma.raw('pol.track_sp'),
      mrp: Prisma.raw('b.sbl_mrp'),
      salePrice: Prisma.raw('b.sbl_sale_price'),
    });
    const gridCost = costColumns({
      mc: 'mc',
      sic: 'sic',
      p: 'p',
      factor: 'iuc.iuc_to_base_factor',
    });
    return Prisma.sql`
      WITH items AS (
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_group_id, i.item_default_barcode
          FROM inventory.item_master i
         WHERE i.item_is_deleted = false
           AND (i.item_company_id IS NULL OR i.item_company_id = ${args.companyId}::uuid)
           AND (i.item_branch_id  IS NULL OR i.item_branch_id  = ${args.branchId}::uuid)
           ${args.itemFilter}
      ),
      pol AS (
        SELECT items.item_id,
               COALESCE(stp.stp_track_mrp, false)        AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sp
          FROM items
          ${effectivePolicyLateral({
            companyId: Prisma.sql`${args.companyId}::uuid`,
            branchId: Prisma.sql`${args.branchId}::uuid`,
            itemId: Prisma.raw('items.item_id'),
            itemGroupId: Prisma.raw('items.item_group_id'),
            onDate: Prisma.raw('CURRENT_DATE'),
          })}
      ),
      stock AS (
        SELECT b.sbl_item_id AS item_id,
               ${key.mrp}       AS mrp,
               ${key.salePrice} AS sp,
               SUM(b.sbl_on_hand_qty) AS qty
          FROM stock.stock_balance b
          JOIN pol ON pol.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${args.companyId}::uuid
           AND b.sbl_branch_id  = ${args.branchId}::uuid
           AND b.sbl_bucket     = 'SALEABLE'
           AND b.sbl_is_deleted = false
         GROUP BY 1, 2, 3
        HAVING SUM(b.sbl_on_hand_qty) <> 0
      ),
      -- Notes 75: one cost probe per item × MRP in stock (the stock CTE's mrp
      -- is already blanked: non-null only for an MRP-tracked item).
      ${mrpCostCte({
        companyId: args.companyId,
        branchId: args.branchId,
        pairs: Prisma.sql`SELECT DISTINCT item_id, mrp FROM stock WHERE mrp IS NOT NULL`,
      })},
      buckets AS (
        SELECT item_id, mrp, sp, qty FROM stock
        UNION ALL
        SELECT items.item_id, NULL::numeric, NULL::numeric, 0::numeric
          FROM items
         WHERE NOT EXISTS (SELECT 1 FROM stock s WHERE s.item_id = items.item_id)
      )
      SELECT items.item_id      AS "itemId",
             items.item_code    AS "itemCode",
             items.item_default_barcode AS "barcode",
             items.item_name_en AS "itemName",
             iuc.iuc_id         AS "uomId",
             u.unit_name        AS "unitName",
             bk.qty / NULLIF(iuc.iuc_to_base_factor, 0) AS "stockQty",
             bk.mrp             AS "mrp",
             bk.sp              AS "salePrice",
             p.p_is_bucket      AS "priceIsBucket",
             p.ipm_branch_id    AS "priceBranchId",
             p.ipm_id           AS "bucketId",
             p.ipm_max_price    AS "maxPrice",
             ${gridCost.rate}   AS "costRate",
             ${gridCost.wot}    AS "costWot",
             ${gridCost.basis}  AS "costBasis",
             p.ipm_min_price    AS "minPrice",
             p.ipm_round_off    AS "roundOff",
             p.ipm_sales_price_a AS "priceA",
             p.ipm_sales_price_b AS "priceB",
             p.ipm_sales_price_c AS "priceC",
             p.ipm_sales_price_d AS "priceD"
        FROM buckets bk
        JOIN items ON items.item_id = bk.item_id
        JOIN inventory.item_unit_conversion iuc
          ON iuc.iuc_item_id = bk.item_id AND iuc.iuc_is_deleted = false
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN mrp_cost mc ON mc.item_id = bk.item_id AND mc.mrp = bk.mrp
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${args.companyId}::uuid
              AND sic.sic_branch_id  = ${args.branchId}::uuid
              AND sic.sic_item_id    = bk.item_id
              AND sic.sic_is_deleted = false
        ${effectivePriceLateral({
          itemId: Prisma.raw('bk.item_id'),
          uomId: Prisma.raw('iuc.iuc_id'),
          mrp: Prisma.raw('bk.mrp'),
          salePrice: Prisma.raw('bk.sp'),
          companyId: args.companyId,
          branchId: args.branchId,
          onDate: Prisma.raw('CURRENT_DATE'),
        })}
       ORDER BY items.item_name_en, items.item_id, iuc.iuc_unit_slno, iuc.iuc_id,
                bk.mrp DESC NULLS LAST, bk.sp DESC NULLS LAST
    `;
  }

  private toGridRecord(row: GridSqlRow): PriceGridRecord {
    const amount = (value: Prisma.Decimal | null) => (value === null ? 0 : toNumber(value));
    return {
      itemId: row.itemId,
      itemCode: row.itemCode,
      barcode: row.barcode,
      itemName: row.itemName,
      uomId: row.uomId,
      unitName: row.unitName,
      stockQty: amount(row.stockQty),
      mrp: row.mrp === null ? null : toNumber(row.mrp),
      salePrice: row.salePrice === null ? null : toNumber(row.salePrice),
      maxPrice: amount(row.maxPrice),
      priceSource: row.priceIsBucket ? 'BUCKET' : 'MASTER',
      priceScope: row.bucketId === null ? null : row.priceBranchId === null ? 'CHAIN' : 'BRANCH',
      bucketId: row.bucketId,
      costRate: amount(row.costRate),
      costWot: amount(row.costWot),
      costBasis: row.costBasis,
      minPrice: amount(row.minPrice),
      roundOff: amount(row.roundOff),
      prices: [amount(row.priceA), amount(row.priceB), amount(row.priceC), amount(row.priceD)],
    };
  }
}
