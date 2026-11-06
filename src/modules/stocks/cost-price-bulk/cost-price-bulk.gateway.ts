import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TOKEN_IGNORED_COLUMNS } from './cost-price-bulk.rules';
import type { LeftOutReason } from './types/cost-price-bulk.types';

type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** The grid's filter (plan §3). Company and branch always; the rest optional, ANDed. */
export interface CostBulkFilter {
  companyId: string;
  branchId: string;
  groupId?: string;
  itemCategoryId?: string;
  brandId?: string;
  sectionId?: string;
  /** item_master.item_supplier_id — the same meaning as menu 30's supplierId. */
  supplierId?: string;
  /** The unit row's ipm_profit_type. */
  profitType?: string;
  /** item_master.item_price_list = true. */
  priceListOnly?: boolean;
  /** One item (the blank-row add). Inactive items are then read too, to be refused by name. */
  itemId?: string;
  /** Several items (the save's read-back). Inactive items are then read too. */
  itemIds?: readonly string[];
}

/** One unit of one item as the grid statement answers it. */
export interface CostBulkUnitRecord {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  barcode: string | null;
  itemIsActive: boolean;
  itemIsBatchBased: boolean;
  presetName: string | null;
  presetTracks: boolean;
  uomId: string;
  unitName: string | null;
  unitSlno: number;
  toBase: Prisma.Decimal;
  unitFactor: Prisma.Decimal;
  parentUomId: string | null;
  parentUnitName: string | null;
  parentToBase: Prisma.Decimal | null;
  /** The headline in force today at this branch; every price column null when none. */
  ipmId: string | null;
  priceBranchId: string | null;
  /** The answering row is shared by every company (ipm_company_id NULL). */
  companyShared: boolean;
  profitType: string | null;
  roundOff: Prisma.Decimal | null;
  costPrice: Prisma.Decimal | null;
  costWot: Prisma.Decimal | null;
  maxPrice: Prisma.Decimal | null;
  minPrice: Prisma.Decimal | null;
  priceA: Prisma.Decimal | null;
  priceB: Prisma.Decimal | null;
  priceC: Prisma.Decimal | null;
  priceD: Prisma.Decimal | null;
  wotA: Prisma.Decimal | null;
  wotB: Prisma.Decimal | null;
  wotC: Prisma.Decimal | null;
  wotD: Prisma.Decimal | null;
  markupA: Prisma.Decimal | null;
  markupB: Prisma.Decimal | null;
  markupC: Prisma.Decimal | null;
  markupD: Prisma.Decimal | null;
  /** ipm_updated_on as IST text with its offset. */
  updatedOn: string | null;
  rowToken: string | null;
  scheduledFrom: string | null;
  hasQtySlabs: boolean;
}

export interface CostBulkGridPage {
  rows: CostBulkUnitRecord[];
  total: number;
  totalItems: number;
}

/** One left-out entry, before the service words it. */
export interface CostBulkLeftOutRecord {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  uomId: string | null;
  unitName: string | null;
  presetName: string | null;
  reason: LeftOutReason;
}

/** One price level as the screen and the checks see it. */
export interface CostBulkLevelInfo {
  level: 1 | 2 | 3 | 4;
  name: string;
  active: boolean;
}

export interface CostBulkLeftOutPage {
  rows: CostBulkLeftOutRecord[];
  total: number;
  counts: Record<LeftOutReason, number>;
}

/** A price row the save names, as it stands (read after the FOR UPDATE lock). */
export interface CostBulkLockedRecord {
  ipmId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  usable: boolean;
  current: boolean;
  itemIsActive: boolean;
  itemIsBatchBased: boolean;
  presetTracks: boolean;
  isChain: boolean;
  /** ipm_company_id IS NULL — shared by every company: the save writes a company copy instead. */
  companyShared: boolean;
  rowToken: string;
  costPrice: Prisma.Decimal;
  maxPrice: Prisma.Decimal;
  minPrice: Prisma.Decimal;
  profitType: string;
  priceA: Prisma.Decimal;
  priceB: Prisma.Decimal;
  priceC: Prisma.Decimal;
  priceD: Prisma.Decimal;
}

/**
 * The concurrency token in SQL: md5 of the row's to_jsonb minus the columns a
 * change is not judged by (TOKEN_IGNORED_COLUMNS = the Price Change Log's
 * IGNORED_COLUMNS.IPM). `alias` is a FROM item whose row is the whole
 * item_price_master row.
 */
export function rowTokenSql(alias: string): Prisma.Sql {
  return Prisma.sql`md5((to_jsonb(${Prisma.raw(alias)}) - ${[...TOKEN_IGNORED_COLUMNS]}::text[])::text)`;
}

/**
 * The effective track preset tracks something — batch, MRP, sale price or
 * serial (plan §0 "Plain stock"); false with no preset. `spt` is the joined
 * stock_track_preset of COALESCE(item preset, group preset).
 */
const PRESET_TRACKS_SQL = Prisma.sql`COALESCE(spt.spt_track_batch OR spt.spt_track_mrp
                           OR spt.spt_track_sale_price OR spt.spt_track_serial, false)`;

/**
 * `leftOutReasonOf` (cost-price-bulk.rules.ts) in SQL, for the left-out list:
 * inactive first, then a preset that tracks, then the old batch tick. NULL
 * when the item may be on the grid. Change both together.
 */
const LEFT_OUT_REASON_SQL = Prisma.sql`CASE WHEN NOT i.item_is_active THEN 'INACTIVE'
                WHEN ${PRESET_TRACKS_SQL} THEN 'NOT_PLAIN_STOCK'
                WHEN i.item_is_batch_based THEN 'OLD_BATCH_TICK' END`;

/**
 * The headline price row in force ON A DAY (today by default) at this branch
 * for (item, unit): key (-1, -1), not deleted, the day inside its period, this
 * company or shared, this branch or all branches — the branch row before the
 * chain row, the company's before the shared one (resolveEffectivePrice's
 * order, at the headline). Exposes `alias` (all columns NULL when nothing
 * answers).
 */
function headlineInForceLateral(args: {
  itemId: Prisma.Sql;
  uomId: Prisma.Sql;
  companyId: string;
  branchId: string;
  alias: string;
  onDate?: Prisma.Sql;
}): Prisma.Sql {
  const a = Prisma.raw(args.alias);
  const day = args.onDate ?? Prisma.raw('CURRENT_DATE');
  return Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT h.*
        FROM inventory.item_price_master h
       WHERE h.ipm_item_id    = ${args.itemId}
         AND h.ipm_uc_unit_id = ${args.uomId}
         AND h.ipm_key_mrp = -1 AND h.ipm_key_sp = -1
         AND h.ipm_is_deleted = false
         AND ${day} BETWEEN h.ipm_effective_from AND h.ipm_effective_to
         AND (h.ipm_company_id IS NULL OR h.ipm_company_id = ${args.companyId}::uuid)
         AND (h.ipm_branch_id  IS NULL OR h.ipm_branch_id  = ${args.branchId}::uuid)
       ORDER BY (h.ipm_branch_id IS NULL), (h.ipm_company_id IS NULL), h.ipm_id
       LIMIT 1
    ) ${a} ON true`;
}

/**
 * Every statement Cost Price – Bulk Change (menu 298) READS. It writes
 * nothing: the save's one write is PriceMasterWriter.rewritePriceRows, and the
 * FOR UPDATE here only locks.
 */
@Injectable()
export class CostPriceBulkGateway {
  /**
   * The items the filter names, with their eligibility, and every ACTIVE unit
   * of each with the unit above it (LAG over iuc_unit_slno) and its headline
   * in force today. Item scope as menu 30's grid: this company's or shared,
   * this branch's or all branches'; deleted never.
   */
  private unitsStatement(filter: CostBulkFilter): Prisma.Sql {
    const named = filter.itemId !== undefined || filter.itemIds !== undefined;
    return Prisma.sql`
      items AS (
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_default_barcode,
               i.item_is_active, i.item_is_batch_based,
               spt.spt_name AS preset_name,
               ${PRESET_TRACKS_SQL} AS preset_tracks,
               ${LEFT_OUT_REASON_SQL} AS reason
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN stock.stock_track_preset spt
                 ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
         WHERE i.item_is_deleted = false
           AND (i.item_company_id IS NULL OR i.item_company_id = ${filter.companyId}::uuid)
           AND (i.item_branch_id  IS NULL OR i.item_branch_id  = ${filter.branchId}::uuid)
           AND (${named}::boolean OR i.item_is_active = true)
           AND (${filter.groupId ?? null}::uuid IS NULL OR i.item_group_id = ${filter.groupId ?? null}::uuid)
           AND (${filter.itemCategoryId ?? null}::uuid IS NULL OR i.item_category_id = ${filter.itemCategoryId ?? null}::uuid)
           AND (${filter.brandId ?? null}::uuid IS NULL OR i.item_brand_id = ${filter.brandId ?? null}::uuid)
           AND (${filter.sectionId ?? null}::uuid IS NULL OR i.item_section_id = ${filter.sectionId ?? null}::uuid)
           AND (${filter.supplierId ?? null}::uuid IS NULL OR i.item_supplier_id = ${filter.supplierId ?? null}::uuid)
           AND (${filter.priceListOnly === true}::boolean = false OR i.item_price_list = true)
           AND (${filter.itemId ?? null}::uuid IS NULL OR i.item_id = ${filter.itemId ?? null}::uuid)
           AND (${filter.itemIds === undefined}::boolean OR i.item_id = ANY(${[...(filter.itemIds ?? [])]}::uuid[]))
      ),
      units AS (
        SELECT iuc.iuc_item_id            AS item_id,
               iuc.iuc_id,
               iuc.iuc_unit_slno,
               iuc.iuc_to_base_factor,
               iuc.iuc_unit_factor,
               u.unit_name,
               LAG(iuc.iuc_id)             OVER w AS parent_uom_id,
               LAG(u.unit_name)            OVER w AS parent_unit_name,
               LAG(iuc.iuc_to_base_factor) OVER w AS parent_to_base
          FROM inventory.item_unit_conversion iuc
          JOIN items ON items.item_id = iuc.iuc_item_id
          LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
         WHERE iuc.iuc_is_active = true
           AND iuc.iuc_is_deleted = false
        WINDOW w AS (PARTITION BY iuc.iuc_item_id ORDER BY iuc.iuc_unit_slno, iuc.iuc_id)
      ),
      priced AS (
        SELECT items.*, units.iuc_id, units.iuc_unit_slno, units.iuc_to_base_factor,
               units.iuc_unit_factor, units.unit_name, units.parent_uom_id,
               units.parent_unit_name, units.parent_to_base,
               p.ipm_id, p.ipm_company_id, p.ipm_branch_id, p.ipm_item_id, p.ipm_uc_unit_id,
               p.ipm_profit_type, p.ipm_round_off, p.ipm_cost_price, p.ipm_cost_wot,
               p.ipm_max_price, p.ipm_min_price,
               p.ipm_sales_price_a, p.ipm_sales_price_b, p.ipm_sales_price_c, p.ipm_sales_price_d,
               p.ipm_price_a_wot, p.ipm_price_b_wot, p.ipm_price_c_wot, p.ipm_price_d_wot,
               p.ipm_price_a_markup_perc, p.ipm_price_b_markup_perc,
               p.ipm_price_c_markup_perc, p.ipm_price_d_markup_perc,
               -- IST text with its offset: a bare instant shows as UTC on the Qt client
               to_char(p.ipm_updated_on AT TIME ZONE 'Asia/Kolkata',
                       'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS ipm_updated_on,
               CASE WHEN p.ipm_id IS NOT NULL THEN ${rowTokenSql('p')} END AS row_token
          FROM items
          JOIN units ON units.item_id = items.item_id
          ${headlineInForceLateral({
            itemId: Prisma.raw('units.item_id'),
            uomId: Prisma.raw('units.iuc_id'),
            companyId: filter.companyId,
            branchId: filter.branchId,
            alias: 'p',
          })}
      )`;
  }

  /**
   * §3 — one page of the grid: units of eligible items with a headline in
   * force today (and the rule asked for), item name, item, then
   * iuc_unit_slno. `scheduledFrom` is the start of the next later row of the
   * SAME key (scope, item, unit, headline); `hasQtySlabs` a live slab of the
   * item and unit visible here.
   */
  async listGrid(
    client: Client,
    filter: CostBulkFilter,
    page: { limit: number; offset: number },
  ): Promise<CostBulkGridPage> {
    const rows = await client.$queryRaw<
      Array<CostBulkUnitSqlRow & { total: bigint; total_items: bigint }>
    >`
      WITH ${this.unitsStatement(filter)},
      grid AS (
        SELECT * FROM priced
         WHERE reason IS NULL
           AND ipm_id IS NOT NULL
           AND (${filter.profitType ?? null}::varchar IS NULL OR ipm_profit_type = ${filter.profitType ?? null}::varchar)
      ),
      totals AS (SELECT count(*) AS total, count(DISTINCT item_id) AS total_items FROM grid)
      SELECT g.*,
             totals.total, totals.total_items,
             (SELECT MIN(k.ipm_effective_from)::text
                FROM inventory.item_price_master k
                ${headlineInForceLateral({
                  itemId: Prisma.raw('k.ipm_item_id'),
                  uomId: Prisma.raw('k.ipm_uc_unit_id'),
                  companyId: filter.companyId,
                  branchId: filter.branchId,
                  alias: 'kw',
                  onDate: Prisma.raw('k.ipm_effective_from'),
                })}
               WHERE k.ipm_item_id    = g.ipm_item_id
                 AND k.ipm_uc_unit_id = g.ipm_uc_unit_id
                 AND k.ipm_key_mrp = -1 AND k.ipm_key_sp = -1
                 AND k.ipm_is_deleted = false
                 AND k.ipm_effective_from > CURRENT_DATE
                 AND (k.ipm_company_id IS NULL OR k.ipm_company_id = ${filter.companyId}::uuid)
                 AND (k.ipm_branch_id  IS NULL OR k.ipm_branch_id  = ${filter.branchId}::uuid)
                 -- it takes over: on its first day it is the row that answers here
                 AND kw.ipm_id = k.ipm_id) AS scheduled_from,
             EXISTS (SELECT 1
                       FROM inventory.item_qty_price q
                      WHERE q.iqp_item_id      = g.item_id
                        AND q.iqp_item_unit_id = g.iuc_id
                        AND q.iqp_is_deleted   = false
                        AND q.iqp_is_active IS NOT FALSE
                        AND (q.iqp_company_id IS NULL OR q.iqp_company_id = ${filter.companyId}::uuid)
                        AND (q.iqp_branch_id  IS NULL OR q.iqp_branch_id  = ${filter.branchId}::uuid)
                        AND (q.iqp_effective_to IS NULL OR q.iqp_effective_to >= CURRENT_DATE)) AS has_qty_slabs
        FROM grid g
        CROSS JOIN totals
       ORDER BY g.item_name_en, g.item_id, g.iuc_unit_slno, g.iuc_id
       LIMIT ${page.limit} OFFSET ${page.offset}
    `;
    if (!rows.length) {
      // The page may be past the end; the totals still count the filter.
      const [count] = await client.$queryRaw<Array<{ total: bigint; total_items: bigint }>>`
        WITH ${this.unitsStatement(filter)}
        SELECT count(*) AS total, count(DISTINCT item_id) AS total_items
          FROM priced
         WHERE reason IS NULL AND ipm_id IS NOT NULL
           AND (${filter.profitType ?? null}::varchar IS NULL OR ipm_profit_type = ${filter.profitType ?? null}::varchar)
      `;
      return {
        rows: [],
        total: Number(count?.total ?? 0),
        totalItems: Number(count?.total_items ?? 0),
      };
    }
    return {
      rows: rows.map(toUnitRecord),
      total: Number(rows[0].total),
      totalItems: Number(rows[0].total_items),
    };
  }

  /**
   * §3 — what the filter's load leaves out: each item that is not Plain stock
   * (or has the old batch tick, or — one-item mode — is inactive) ONCE, and
   * each active unit of an eligible item with no headline in force today. The
   * rule filter is not applied: a left-out unit has no rule to match. At most
   * `limit` rows; total and the per-reason counts cover all of them.
   */
  async listLeftOut(
    client: Client,
    filter: CostBulkFilter,
    limit: number,
  ): Promise<CostBulkLeftOutPage> {
    const rows = await client.$queryRaw<
      Array<{
        item_id: string;
        item_code: string | null;
        item_name_en: string;
        uom_id: string | null;
        unit_name: string | null;
        preset_name: string | null;
        reason: LeftOutReason;
        total: bigint;
        n_not_plain: bigint;
        n_batch_tick: bigint;
        n_no_price: bigint;
        n_inactive: bigint;
      }>
    >`
      WITH ${this.unitsStatement(filter)},
      left_out AS (
        SELECT items.item_id, items.item_code, items.item_name_en, NULL::uuid AS uom_id,
               NULL::varchar AS unit_name, NULL::int AS unit_slno, items.preset_name, items.reason
          FROM items
         WHERE items.reason IS NOT NULL
        UNION ALL
        SELECT priced.item_id, priced.item_code, priced.item_name_en, priced.iuc_id,
               priced.unit_name, priced.iuc_unit_slno, priced.preset_name, 'NO_PRICE_ROW'
          FROM priced
         WHERE priced.reason IS NULL AND priced.ipm_id IS NULL
      ),
      totals AS (
        SELECT count(*) AS total,
               count(*) FILTER (WHERE reason = 'NOT_PLAIN_STOCK') AS n_not_plain,
               count(*) FILTER (WHERE reason = 'OLD_BATCH_TICK')  AS n_batch_tick,
               count(*) FILTER (WHERE reason = 'NO_PRICE_ROW')    AS n_no_price,
               count(*) FILTER (WHERE reason = 'INACTIVE')        AS n_inactive
          FROM left_out
      )
      SELECT lo.item_id, lo.item_code, lo.item_name_en, lo.uom_id, lo.unit_name, lo.preset_name,
             lo.reason, totals.*
        FROM totals
        LEFT JOIN LATERAL (
          SELECT * FROM left_out
           ORDER BY left_out.item_name_en, left_out.item_id, left_out.unit_slno NULLS FIRST, left_out.uom_id
           LIMIT ${limit}
        ) lo ON true
    `;
    const first = rows[0];
    const counts: Record<LeftOutReason, number> = {
      NOT_PLAIN_STOCK: Number(first?.n_not_plain ?? 0),
      OLD_BATCH_TICK: Number(first?.n_batch_tick ?? 0),
      NO_PRICE_ROW: Number(first?.n_no_price ?? 0),
      INACTIVE: Number(first?.n_inactive ?? 0),
    };
    return {
      rows: rows
        .filter((row) => row.item_id !== null)
        .map((row) => ({
          itemId: row.item_id,
          itemCode: row.item_code,
          itemName: row.item_name_en,
          uomId: row.uom_id,
          unitName: row.unit_name,
          presetName: row.preset_name,
          reason: row.reason,
        })),
      total: Number(first?.total ?? 0),
      counts,
    };
  }

  /** One item as the blank-row add judges it: null when it is not there (deleted, or not in scope). */
  async findItem(
    client: Client,
    companyId: string,
    branchId: string,
    itemId: string,
  ): Promise<{
    itemId: string;
    itemCode: string | null;
    itemName: string;
    isActive: boolean;
    isBatchBased: boolean;
    presetName: string | null;
    presetTracks: boolean;
  } | null> {
    const [row] = await client.$queryRaw<
      Array<{
        itemId: string;
        itemCode: string | null;
        itemName: string;
        isActive: boolean;
        isBatchBased: boolean;
        presetName: string | null;
        presetTracks: boolean;
      }>
    >`
      SELECT i.item_id AS "itemId", i.item_code AS "itemCode", i.item_name_en AS "itemName",
             i.item_is_active AS "isActive", i.item_is_batch_based AS "isBatchBased",
             spt.spt_name AS "presetName", ${PRESET_TRACKS_SQL} AS "presetTracks"
        FROM inventory.item_master i
        LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
        LEFT JOIN stock.stock_track_preset spt
               ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
       WHERE i.item_id = ${itemId}::uuid
         AND i.item_is_deleted = false
         AND (i.item_company_id IS NULL OR i.item_company_id = ${companyId}::uuid)
         AND (i.item_branch_id  IS NULL OR i.item_branch_id  = ${branchId}::uuid)
    `;
    return row ?? null;
  }

  /**
   * The save's rows: LOCKED first (FOR UPDATE, in ipm_id order so two saves
   * over the same rows cannot deadlock), then read with everything the checks
   * need — whether the row is still usable (live headline of a live item and
   * unit in scope), whether it is the one in force today at this branch, the
   * item's eligibility, and its token. `lock` false (validate) only reads.
   */
  async readRowsForSave(
    tx: Client,
    companyId: string,
    branchId: string,
    ipmIds: readonly string[],
    lock: boolean,
  ): Promise<Map<string, CostBulkLockedRecord>> {
    const ids = [...new Set(ipmIds)];
    if (!ids.length) {
      return new Map();
    }
    if (lock) {
      await tx.$queryRaw`
        SELECT ipm_id FROM inventory.item_price_master
         WHERE ipm_id = ANY(${ids}::uuid[])
         ORDER BY ipm_id
         FOR UPDATE`;
    }
    const rows = await tx.$queryRaw<CostBulkLockedSqlRow[]>`
      SELECT p.ipm_id AS "ipmId", p.ipm_item_id AS "itemId",
             i.item_code AS "itemCode", i.item_name_en AS "itemName", u.unit_name AS "unitName",
             (    p.ipm_is_deleted = false
              AND p.ipm_key_mrp = -1 AND p.ipm_key_sp = -1
              AND i.item_is_deleted = false
              AND iuc.iuc_item_id = p.ipm_item_id
              AND iuc.iuc_is_active = true AND iuc.iuc_is_deleted = false
              AND (i.item_company_id IS NULL OR i.item_company_id = ${companyId}::uuid)
              AND (i.item_branch_id  IS NULL OR i.item_branch_id  = ${branchId}::uuid)
              AND (p.ipm_company_id  IS NULL OR p.ipm_company_id  = ${companyId}::uuid)
              AND (p.ipm_branch_id   IS NULL OR p.ipm_branch_id   = ${branchId}::uuid)) AS "usable",
             (w.ipm_id IS NOT DISTINCT FROM p.ipm_id) AS "current",
             i.item_is_active AS "itemIsActive", i.item_is_batch_based AS "itemIsBatchBased",
             ${PRESET_TRACKS_SQL} AS "presetTracks",
             (p.ipm_branch_id IS NULL) AS "isChain",
             (p.ipm_company_id IS NULL) AS "companyShared",
             ${rowTokenSql('p')} AS "rowToken",
             p.ipm_cost_price AS "costPrice", p.ipm_max_price AS "maxPrice",
             p.ipm_min_price AS "minPrice", p.ipm_profit_type AS "profitType",
             p.ipm_sales_price_a AS "priceA", p.ipm_sales_price_b AS "priceB",
             p.ipm_sales_price_c AS "priceC", p.ipm_sales_price_d AS "priceD"
        FROM inventory.item_price_master p
        JOIN inventory.item_master i ON i.item_id = p.ipm_item_id
        JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = p.ipm_uc_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
        LEFT JOIN stock.stock_track_preset spt
               ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
        ${headlineInForceLateral({
          itemId: Prisma.raw('p.ipm_item_id'),
          uomId: Prisma.raw('p.ipm_uc_unit_id'),
          companyId,
          branchId,
          alias: 'w',
        })}
       WHERE p.ipm_id = ANY(${ids}::uuid[])
    `;
    return new Map(rows.map((row) => [row.ipmId, row]));
  }

  /**
   * Price levels 1–4 — `fixed.price_levels`, the house list since 2026-10-22
   * (what /price-level-masters/get, the item card, menu 30 and quick rate
   * read; NOT inventory.item_price_levels, whose ipl_status disagrees): the
   * name the notes use and whether the level is active (`price_lvl_is_active`,
   * not deleted). The screen shows only active levels, so the checks judge
   * only those; a level with no row is inactive.
   */
  async levels(client: Client): Promise<CostBulkLevelInfo[]> {
    const rows = await client.$queryRaw<
      Array<{ id: number; name: string | null; active: boolean | null }>
    >`
      SELECT price_lvl_id::int AS id, price_lvl_name AS name,
             (price_lvl_is_active IS TRUE AND "price_lvl_isDeleted" IS NOT TRUE) AS active
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4`;
    const byId = new Map(rows.map((row) => [row.id, row]));
    return [1, 2, 3, 4].map((id) => ({
      level: id as 1 | 2 | 3 | 4,
      name: byId.get(id)?.name?.trim() || `Price ${'ABCD'[id - 1]}`,
      active: byId.get(id)?.active === true,
    }));
  }

  /** The database's today, `YYYY-MM-DD` (CURRENT_DATE, the session's Asia/Kolkata day). */
  async today(client: Client): Promise<string> {
    const [row] = await client.$queryRaw<
      Array<{ today: string }>
    >`SELECT CURRENT_DATE::text AS today`;
    return row.today;
  }
}

type CostBulkLockedSqlRow = CostBulkLockedRecord;

interface CostBulkUnitSqlRow {
  item_id: string;
  item_code: string | null;
  item_name_en: string;
  item_default_barcode: string | null;
  item_is_active: boolean;
  item_is_batch_based: boolean;
  preset_name: string | null;
  preset_tracks: boolean;
  reason: LeftOutReason | null;
  iuc_id: string;
  iuc_unit_slno: number | null;
  iuc_to_base_factor: Prisma.Decimal | null;
  iuc_unit_factor: Prisma.Decimal | null;
  unit_name: string | null;
  parent_uom_id: string | null;
  parent_unit_name: string | null;
  parent_to_base: Prisma.Decimal | null;
  ipm_id: string | null;
  ipm_company_id: string | null;
  ipm_branch_id: string | null;
  ipm_profit_type: string | null;
  ipm_round_off: Prisma.Decimal | null;
  ipm_cost_price: Prisma.Decimal | null;
  ipm_cost_wot: Prisma.Decimal | null;
  ipm_max_price: Prisma.Decimal | null;
  ipm_min_price: Prisma.Decimal | null;
  ipm_sales_price_a: Prisma.Decimal | null;
  ipm_sales_price_b: Prisma.Decimal | null;
  ipm_sales_price_c: Prisma.Decimal | null;
  ipm_sales_price_d: Prisma.Decimal | null;
  ipm_price_a_wot: Prisma.Decimal | null;
  ipm_price_b_wot: Prisma.Decimal | null;
  ipm_price_c_wot: Prisma.Decimal | null;
  ipm_price_d_wot: Prisma.Decimal | null;
  ipm_price_a_markup_perc: Prisma.Decimal | null;
  ipm_price_b_markup_perc: Prisma.Decimal | null;
  ipm_price_c_markup_perc: Prisma.Decimal | null;
  ipm_price_d_markup_perc: Prisma.Decimal | null;
  ipm_updated_on: string | null;
  row_token: string | null;
  scheduled_from: string | null;
  has_qty_slabs: boolean;
}

const ONE = new Prisma.Decimal(1);

function toUnitRecord(row: CostBulkUnitSqlRow): CostBulkUnitRecord {
  return {
    itemId: row.item_id,
    itemCode: row.item_code,
    itemName: row.item_name_en,
    barcode: row.item_default_barcode,
    itemIsActive: row.item_is_active,
    itemIsBatchBased: row.item_is_batch_based,
    presetName: row.preset_name,
    presetTracks: row.preset_tracks,
    uomId: row.iuc_id,
    unitName: row.unit_name,
    unitSlno: row.iuc_unit_slno ?? 0,
    toBase: row.iuc_to_base_factor ?? ONE,
    unitFactor: row.iuc_unit_factor ?? ONE,
    parentUomId: row.parent_uom_id,
    parentUnitName: row.parent_unit_name,
    parentToBase: row.parent_uom_id ? (row.parent_to_base ?? ONE) : null,
    ipmId: row.ipm_id,
    priceBranchId: row.ipm_branch_id,
    companyShared: row.ipm_id !== null && row.ipm_company_id === null,
    profitType: row.ipm_profit_type,
    roundOff: row.ipm_round_off,
    costPrice: row.ipm_cost_price,
    costWot: row.ipm_cost_wot,
    maxPrice: row.ipm_max_price,
    minPrice: row.ipm_min_price,
    priceA: row.ipm_sales_price_a,
    priceB: row.ipm_sales_price_b,
    priceC: row.ipm_sales_price_c,
    priceD: row.ipm_sales_price_d,
    wotA: row.ipm_price_a_wot,
    wotB: row.ipm_price_b_wot,
    wotC: row.ipm_price_c_wot,
    wotD: row.ipm_price_d_wot,
    markupA: row.ipm_price_a_markup_perc,
    markupB: row.ipm_price_b_markup_perc,
    markupC: row.ipm_price_c_markup_perc,
    markupD: row.ipm_price_d_markup_perc,
    updatedOn: row.ipm_updated_on,
    rowToken: row.row_token,
    scheduledFrom: row.scheduled_from,
    hasQtySlabs: row.has_qty_slabs,
  };
}
