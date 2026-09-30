import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { DEFAULT_ACTOR, toNumber } from 'src/common/utils/module-service.utils';
import {
  bucketKeySql,
  effectivePolicyLateral,
} from '../stock-voucher/stock-voucher-posting.helper';
import type { ScopeResolution } from './selling-price-scope.helper';
import {
  PRICE_LEVELS,
  type PagedResult,
  type PriceLevel,
  type PriceScope,
  type PriceSource,
  type SellingPriceNoStockRow,
  type SellingPriceProblem,
} from './types/selling-price-bulk.types';

/** What §3's grid is filtered by. All optional but the company and branch. */
export interface ListSellingPricesArgs {
  companyId: string;
  branchId: string;
  itemGroupId?: string;
  itemBrandId?: string;
  itemSectionId?: string;
  supplierId?: string;
  limit: number;
  offset: number;
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
  minPrice: number;
  roundOff: number;
  /** Sales prices A–D of the answering row, 0 when none answered. */
  prices: [number, number, number, number];
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
  /** The resolved row's min price, 0 when none. */
  minPrice: number;
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
}

/**
 * The profit type every write here stores. `ipm_profit_type` is NOT NULL and
 * SaveItemPriceDto pins it to three values; "By User" is the only honest one —
 * the operator typed the price, nothing derived it.
 */
const PROFIT_TYPE = 'By User';

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

interface GridSqlRow {
  itemId: string;
  itemCode: string | null;
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
          AND (${args.supplierId ?? null}::uuid IS NULL OR i.item_supplier_id = ${args.supplierId ?? null}::uuid)`,
      })}
      LIMIT ${args.limit} OFFSET ${args.offset}
    `;
    const items = rows.map((row) => this.toGridRecord(row));
    return { items, meta: { limit: args.limit, offset: args.offset, count: items.length } };
  }

  /**
   * Q24 — F12, the bucket list: EVERY LIVE PRICE ROW of one item this branch
   * can see — the chain rows and this branch's own, never another branch's —
   * headline first, then by MRP and sale price, the chain row before the
   * branch override of the same bucket. The grid shows only the row that WINS
   * at this branch; this list shows both, so the operator sees what an edit
   * hides (change_selling_one_table_mockup.png). Each row carries the stock on
   * hand for its own bucket at this branch, blanked by the policy as the grid
   * blanks it, in the row's unit.
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
    const rows = await this.prisma.$queryRaw<GridSqlRow[]>`
      WITH pol AS (
        SELECT i.item_id, i.item_code, i.item_name_en,
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
               SUM(b.sbl_on_hand_qty)         AS qty
          FROM stock.stock_balance b
          JOIN pol ON pol.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${companyId}::uuid
           AND b.sbl_branch_id  = ${branchId}::uuid
           AND b.sbl_bucket     = 'SALEABLE'
           AND b.sbl_is_deleted = false
         GROUP BY 1, 2
      )
      SELECT pol.item_id        AS "itemId",
             pol.item_code      AS "itemCode",
             pol.item_name_en   AS "itemName",
             iuc.iuc_id         AS "uomId",
             u.unit_name        AS "unitName",
             COALESCE(st.qty, 0) / NULLIF(iuc.iuc_to_base_factor, 0) AS "stockQty",
             p.ipm_bucket_mrp   AS "mrp",
             p.ipm_bucket_sp    AS "salePrice",
             (p.ipm_key_mrp <> -1 OR p.ipm_key_sp <> -1) AS "priceIsBucket",
             p.ipm_branch_id    AS "priceBranchId",
             p.ipm_id           AS "bucketId",
             p.ipm_max_price    AS "maxPrice",
             COALESCE(NULLIF(sic.sic_avg_cost_rate, 0) * iuc.iuc_to_base_factor, p.ipm_cost_price, 0) AS "costRate",
             p.ipm_min_price    AS "minPrice",
             p.ipm_round_off    AS "roundOff",
             p.ipm_sales_price_a AS "priceA",
             p.ipm_sales_price_b AS "priceB",
             p.ipm_sales_price_c AS "priceC",
             p.ipm_sales_price_d AS "priceD"
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
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${companyId}::uuid
              AND sic.sic_branch_id  = ${branchId}::uuid
              AND sic.sic_item_id    = pol.item_id
              AND sic.sic_is_deleted = false
       ORDER BY iuc.iuc_unit_slno, iuc.iuc_id,
                (p.ipm_key_mrp <> -1 OR p.ipm_key_sp <> -1),
                p.ipm_key_mrp, p.ipm_key_sp,
                (p.ipm_branch_id IS NOT NULL), (p.ipm_company_id IS NOT NULL), p.ipm_id
    `;
    return rows.map((row) => this.toGridRecord(row));
  }

  /**
   * What each save row needs before its levels are recomputed: the item's
   * name, whether the unit is the item's, the policy flags that blank its
   * bucket, and the COST — the branch's running average from
   * `stock.stock_item_cost` scaled to the unit, else the cost on the row the
   * resolver picks for this bucket. One statement, in the caller's transaction.
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
  ): Promise<RowCost[]> {
    if (!rows.length) {
      return [];
    }
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
        minPrice: Prisma.Decimal | null;
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
               iuc.iuc_to_base_factor,
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
            onDate: Prisma.raw('CURRENT_DATE'),
          })}
      )
      SELECT k.ord,
             k.item_code    AS "itemCode",
             k.item_name_en AS "itemName",
             k.uom_belongs  AS "uomBelongs",
             k.track_mrp    AS "trackMrp",
             k.track_sp     AS "trackSalePrice",
             COALESCE(NULLIF(sic.sic_avg_cost_rate, 0) * k.iuc_to_base_factor, p.ipm_cost_price, 0)    AS "costRate",
             COALESCE(NULLIF(sic.sic_avg_cost_rate_wot, 0) * k.iuc_to_base_factor, p.ipm_cost_wot, 0)  AS "costWot",
             COALESCE(p.ipm_min_price, 0) AS "minPrice"
        FROM keyed k
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = ${companyId}::uuid
              AND sic.sic_branch_id  = ${branchId}::uuid
              AND sic.sic_item_id    = k.item_id
              AND sic.sic_is_deleted = false
        ${effectivePriceLateral({
          itemId: Prisma.raw('k.item_id'),
          uomId: Prisma.raw('k.uom_id'),
          mrp: Prisma.raw('CASE WHEN k.track_mrp AND k.mrp > 0 THEN k.mrp END'),
          salePrice: Prisma.raw('CASE WHEN k.track_sp AND k.sp > 0 THEN k.sp END'),
          companyId,
          branchId,
          onDate: Prisma.raw('CURRENT_DATE'),
        })}
       ORDER BY k.ord
    `;
    const byOrd = new Map(found.map((row) => [Number(row.ord), row]));
    return rows.map((_, index) => {
      const row = byOrd.get(index + 1);
      return {
        itemCode: row?.itemCode ?? null,
        itemName: row?.itemName ?? '',
        uomBelongs: row?.uomBelongs ?? false,
        trackMrp: row?.trackMrp ?? false,
        trackSalePrice: row?.trackSalePrice ?? false,
        costRate: row?.costRate ? toNumber(row.costRate) : 0,
        costWot: row?.costWot ? toNumber(row.costWot) : 0,
        minPrice: row?.minPrice ? toNumber(row.minPrice) : 0,
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
   */
  validateRows(
    candidates: readonly BucketPriceCandidate[],
    storedMinPrices: readonly number[],
  ): SellingPriceProblem[] {
    const problems: SellingPriceProblem[] = [];
    candidates.forEach((candidate, index) => {
      const minPrice = candidate.minPrice ?? storedMinPrices[index] ?? 0;
      for (const level of candidate.levels) {
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
              : candidate.costRate > 0 && level.price < candidate.costRate
                ? {
                    verdict: 'BELOW_COST' as const,
                    text: `${level.price} is below the cost ${candidate.costRate}.`,
                  }
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
          });
        }
      }
    });
    return problems;
  }

  /**
   * S1 — find the row at the TARGET scope, `FOR UPDATE`.
   *
   * The scope is a predicate, not a filter on the result: searching at BRANCH
   * scope must not find the chain row, which is the whole mechanism behind
   * §5.5 row 2 (a *This branch* save over a CHAIN-sourced row creates an
   * override rather than editing the chain). Returns null when there is none,
   * and the caller inserts. A headline edit is key (-1, -1) of the same table.
   */
  async findBucketRowForUpdate(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
  ): Promise<{ ipmId: string } | null> {
    const [row] = await tx.$queryRaw<Array<{ ipmId: string }>>`
      SELECT ipm_id AS "ipmId"
        FROM inventory.item_price_master
       WHERE ipm_company_id IS NOT DISTINCT FROM ${candidate.companyId}::uuid
         AND ipm_branch_id  IS NOT DISTINCT FROM ${scope.targetBranchId}::uuid
         AND ipm_item_id    = ${candidate.itemId}::uuid
         AND ipm_uc_unit_id = ${candidate.uomId}::uuid
         AND ipm_key_mrp    = COALESCE(${candidate.mrp}::numeric, -1)
         AND ipm_key_sp     = COALESCE(${candidate.salePrice}::numeric, -1)
         AND CURRENT_DATE BETWEEN ipm_effective_from AND ipm_effective_to
         AND ipm_is_deleted = false
       FOR UPDATE
    `;
    return row ?? null;
  }

  /** S2 — update the row S1 found. Min price and round-off keep their stored value when not sent. */
  async updateBucketPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
    candidate: BucketPriceCandidate,
  ): Promise<string> {
    const l = this.levelColumns(candidate);
    await tx.$executeRaw`
      UPDATE inventory.item_price_master
         SET ipm_sales_price_a = COALESCE(${l.a.price}::numeric, ipm_sales_price_a),
             ipm_sales_price_b = COALESCE(${l.b.price}::numeric, ipm_sales_price_b),
             ipm_sales_price_c = COALESCE(${l.c.price}::numeric, ipm_sales_price_c),
             ipm_sales_price_d = COALESCE(${l.d.price}::numeric, ipm_sales_price_d),
             ipm_price_a_wot = COALESCE(${l.a.priceWot}::numeric, ipm_price_a_wot),
             ipm_price_b_wot = COALESCE(${l.b.priceWot}::numeric, ipm_price_b_wot),
             ipm_price_c_wot = COALESCE(${l.c.priceWot}::numeric, ipm_price_c_wot),
             ipm_price_d_wot = COALESCE(${l.d.priceWot}::numeric, ipm_price_d_wot),
             ipm_price_a_markup_perc = COALESCE(${l.a.markupPerc}::numeric, ipm_price_a_markup_perc),
             ipm_price_b_markup_perc = COALESCE(${l.b.markupPerc}::numeric, ipm_price_b_markup_perc),
             ipm_price_c_markup_perc = COALESCE(${l.c.markupPerc}::numeric, ipm_price_c_markup_perc),
             ipm_price_d_markup_perc = COALESCE(${l.d.markupPerc}::numeric, ipm_price_d_markup_perc),
             ipm_min_price   = COALESCE(${candidate.minPrice}::numeric, ipm_min_price),
             ipm_cost_price  = ${candidate.costRate},
             ipm_cost_wot    = ${candidate.costWot},
             ipm_profit_type = ${PROFIT_TYPE},
             ipm_round_off   = COALESCE(${candidate.roundOff}::numeric, ipm_round_off),
             ipm_updated_on  = now(),
             ipm_updated_by  = ${this.actorColumn(candidate.actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
    return ipmId;
  }

  /**
   * S3 — insert a row at the target scope, returning its `ipm_id`.
   *
   * The ATTRIBUTES come from the headline row of the same unit at the target
   * scope or wider — godown, cess, discount, loading, freight, loyalty points,
   * the unit remark. Without the copy a bucket-priced line would lose its cess
   * and loading charge at the till, which is exactly the fault the two-table
   * design had. `ipm_max_price` is the bucket's MRP (ck_ipm_bucket_mrp_is_max),
   * else the headline's.
   *
   * Never sets the effective-from/to pair: this screen writes "now" rows only,
   * and `ex_ipm_overlap` is what enforces that two of them cannot claim one
   * bucket at one scope.
   */
  async insertBucketPrice(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
  ): Promise<string> {
    const l = this.levelColumns(candidate);
    const actor = this.actorColumn(candidate.actor);
    const [row] = await tx.$queryRaw<Array<{ ipmId: string }>>`
      INSERT INTO inventory.item_price_master (
        ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_godown_id, ipm_sl_no,
        ipm_cost_price, ipm_cost_wot,
        ipm_sales_price_a, ipm_sales_price_b, ipm_sales_price_c, ipm_sales_price_d,
        ipm_price_a_wot, ipm_price_b_wot, ipm_price_c_wot, ipm_price_d_wot,
        ipm_price_a_markup_perc, ipm_price_b_markup_perc, ipm_price_c_markup_perc, ipm_price_d_markup_perc,
        ipm_max_price, ipm_min_price, ipm_disc_perc, ipm_disc_qty, ipm_addl_cess,
        ipm_profit_type, ipm_round_off, ipm_loading_charge, ipm_freight_charge, ipm_loyalty_points,
        ipm_uom_remarks, ipm_bucket_mrp, ipm_bucket_sp,
        ipm_created_on, ipm_created_by, ipm_updated_on, ipm_updated_by
      )
      SELECT ${candidate.companyId}::uuid, ${scope.targetBranchId}::uuid,
             ${candidate.itemId}::uuid, ${candidate.uomId}::uuid,
             h.ipm_godown_id, COALESCE(h.ipm_sl_no, 0),
             ${candidate.costRate}, ${candidate.costWot},
             COALESCE(${l.a.price}::numeric, 0), COALESCE(${l.b.price}::numeric, 0),
             COALESCE(${l.c.price}::numeric, 0), COALESCE(${l.d.price}::numeric, 0),
             COALESCE(${l.a.priceWot}::numeric, 0), COALESCE(${l.b.priceWot}::numeric, 0),
             COALESCE(${l.c.priceWot}::numeric, 0), COALESCE(${l.d.priceWot}::numeric, 0),
             COALESCE(${l.a.markupPerc}::numeric, 0), COALESCE(${l.b.markupPerc}::numeric, 0),
             COALESCE(${l.c.markupPerc}::numeric, 0), COALESCE(${l.d.markupPerc}::numeric, 0),
             COALESCE(${candidate.mrp}::numeric, h.ipm_max_price, 0),
             COALESCE(${candidate.minPrice}::numeric, h.ipm_min_price, 0),
             COALESCE(h.ipm_disc_perc, 0), COALESCE(h.ipm_disc_qty, 0), COALESCE(h.ipm_addl_cess, 0),
             ${PROFIT_TYPE}, COALESCE(${candidate.roundOff}::numeric, h.ipm_round_off, 0),
             COALESCE(h.ipm_loading_charge, 0), COALESCE(h.ipm_freight_charge, 0),
             COALESCE(h.ipm_loyalty_points, 0), h.ipm_uom_remarks,
             ${candidate.mrp}::numeric, ${candidate.salePrice}::numeric,
             now(), ${actor}::uuid, now(), ${actor}::uuid
        FROM (SELECT 1) one
        LEFT JOIN LATERAL (
          SELECT hp.*
            FROM inventory.item_price_master hp
           WHERE hp.ipm_item_id    = ${candidate.itemId}::uuid
             AND hp.ipm_uc_unit_id = ${candidate.uomId}::uuid
             AND hp.ipm_key_mrp = -1 AND hp.ipm_key_sp = -1
             AND hp.ipm_is_deleted = false
             AND CURRENT_DATE BETWEEN hp.ipm_effective_from AND hp.ipm_effective_to
             AND (hp.ipm_company_id IS NULL OR hp.ipm_company_id = ${candidate.companyId}::uuid)
             AND (hp.ipm_branch_id  IS NULL OR hp.ipm_branch_id  = ${scope.targetBranchId}::uuid)
           ORDER BY (hp.ipm_branch_id IS NULL), (hp.ipm_company_id IS NULL), hp.ipm_id
           LIMIT 1
        ) h ON true
      RETURNING ipm_id AS "ipmId"
    `;
    return row.ipmId;
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
    return Prisma.sql`
      WITH items AS (
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_group_id
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
      buckets AS (
        SELECT item_id, mrp, sp, qty FROM stock
        UNION ALL
        SELECT items.item_id, NULL::numeric, NULL::numeric, 0::numeric
          FROM items
         WHERE NOT EXISTS (SELECT 1 FROM stock s WHERE s.item_id = items.item_id)
      )
      SELECT items.item_id      AS "itemId",
             items.item_code    AS "itemCode",
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
             COALESCE(NULLIF(sic.sic_avg_cost_rate, 0) * iuc.iuc_to_base_factor, p.ipm_cost_price, 0) AS "costRate",
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
      minPrice: amount(row.minPrice),
      roundOff: amount(row.roundOff),
      prices: [amount(row.priceA), amount(row.priceB), amount(row.priceC), amount(row.priceD)],
    };
  }

  /**
   * The candidate's four levels by column suffix — the ONE place the ordinal
   * 1–4 meets the a–d columns. A level the payload did not send is null: S2
   * keeps the stored figure, S3 stores 0.
   */
  private levelColumns(
    candidate: BucketPriceCandidate,
  ): Record<
    'a' | 'b' | 'c' | 'd',
    { price: number | null; priceWot: number | null; markupPerc: number | null }
  > {
    const at = (level: PriceLevel) =>
      candidate.levels.find((entry) => entry.level === level) ?? {
        price: null,
        priceWot: null,
        markupPerc: null,
      };
    const [a, b, c, d] = PRICE_LEVELS.map(at);
    return { a, b, c, d };
  }

  /** ipm_created_by / ipm_updated_by are uuids: the nil-uuid sentinel is stored as NULL. */
  private actorColumn(actor: string): string | null {
    return actor && actor !== DEFAULT_ACTOR ? actor : null;
  }
}
