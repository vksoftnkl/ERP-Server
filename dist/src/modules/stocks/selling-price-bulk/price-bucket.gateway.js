"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceBucketGateway = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
const selling_price_bulk_types_1 = require("./types/selling-price-bulk.types");
const PROFIT_TYPE = 'By User';
function effectivePriceLateral(args) {
    return client_1.Prisma.sql `
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
function mrpCostCte(args) {
    return client_1.Prisma.sql `
    mrp_cost AS (
      SELECT k.item_id, k.mrp, mc.cost_rate, mc.cost_rate_wot
        FROM (${args.pairs}) k
        LEFT JOIN LATERAL (
          WITH lots AS (
            SELECT sml.sml_lot_id                                AS lot_id,
                   SUM(sml.sml_cost_value)                       AS in_value,
                   SUM(sml.sml_cost_value_wot)                   AS in_value_wot,
                   SUM(sml.sml_base_qty + sml.sml_free_base_qty) AS in_qty
              FROM stock.stock_ledger sml
              JOIN stock.stock_lot slt ON slt.slt_id = sml.sml_lot_id
             WHERE sml.sml_company_id  = ${args.companyId}::uuid
               AND sml.sml_branch_id   = ${args.branchId}::uuid
               AND sml.sml_item_id     = k.item_id
               AND slt.slt_key_mrp     = k.mrp
               AND sml.sml_direction   = 1
               AND sml.sml_is_reversal = false
               AND sml.sml_is_deleted  = false
               AND NOT EXISTS (SELECT 1 FROM stock.stock_ledger rev
                                WHERE rev.sml_reverses_id = sml.sml_id
                                  AND rev.sml_is_deleted = false)
             GROUP BY sml.sml_lot_id
          ),
          onhand AS (
            SELECT b.sbl_lot_id AS lot_id, GREATEST(SUM(b.sbl_on_hand_qty), 0) AS qty
              FROM stock.stock_balance b
             WHERE b.sbl_company_id = ${args.companyId}::uuid
               AND b.sbl_branch_id  = ${args.branchId}::uuid
               AND b.sbl_item_id    = k.item_id
               AND b.sbl_is_deleted = false
               AND b.sbl_lot_id IN (SELECT lot_id FROM lots)
             GROUP BY b.sbl_lot_id
          )
          SELECT CASE WHEN SUM(oh.qty) FILTER (WHERE l.in_qty > 0) > 0
                      THEN SUM(oh.qty * l.in_value / l.in_qty) FILTER (WHERE l.in_qty > 0)
                           / SUM(oh.qty) FILTER (WHERE l.in_qty > 0)
                      ELSE SUM(l.in_value) / NULLIF(SUM(l.in_qty), 0) END     AS cost_rate,
                 CASE WHEN SUM(oh.qty) FILTER (WHERE l.in_qty > 0) > 0
                      THEN SUM(oh.qty * l.in_value_wot / l.in_qty) FILTER (WHERE l.in_qty > 0)
                           / SUM(oh.qty) FILTER (WHERE l.in_qty > 0)
                      ELSE SUM(l.in_value_wot) / NULLIF(SUM(l.in_qty), 0) END AS cost_rate_wot
            FROM lots l
            LEFT JOIN onhand oh ON oh.lot_id = l.lot_id
        ) mc ON true
    )
  `;
}
function costColumns(a) {
    const mrpRate = `NULLIF(${a.mc}.cost_rate, 0)`;
    const itemRate = `NULLIF(${a.sic}.sic_avg_cost_rate, 0)`;
    return {
        rate: client_1.Prisma.raw(`COALESCE(${mrpRate} * ${a.factor}, ${itemRate} * ${a.factor}, ${a.p}.ipm_cost_price, 0)`),
        wot: client_1.Prisma.raw(`CASE WHEN ${mrpRate} IS NOT NULL THEN COALESCE(${a.mc}.cost_rate_wot, 0) * ${a.factor}` +
            ` ELSE COALESCE(NULLIF(${a.sic}.sic_avg_cost_rate_wot, 0) * ${a.factor}, ${a.p}.ipm_cost_wot, 0) END`),
        basis: client_1.Prisma.raw(`CASE WHEN ${mrpRate} IS NOT NULL THEN 'MRP'` +
            ` WHEN ${itemRate} IS NOT NULL THEN 'ITEM'` +
            ` WHEN ${a.p}.ipm_cost_price IS NOT NULL THEN 'PRICE_ROW' END`),
    };
}
let PriceBucketGateway = class PriceBucketGateway {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findOpeningSeedBucket(args) {
        const [row] = await this.prisma.$queryRaw `
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
            mrp: (0, module_service_utils_1.toNumber)(row.bucketMrp ?? row.maxPrice),
            salePrice: row.bucketSp === null ? 0 : (0, module_service_utils_1.toNumber)(row.bucketSp),
        };
    }
    async listPrices(args) {
        const rows = await this.prisma.$queryRaw `
      ${this.gridStatement({
            companyId: args.companyId,
            branchId: args.branchId,
            itemFilter: client_1.Prisma.sql `
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
    popupFilter(args) {
        const search = args.search?.trim();
        const pattern = search ? `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
        return client_1.Prisma.sql `
          AND (${pattern}::text IS NULL
               OR i.item_code            ILIKE ${pattern}
               OR i.item_name_en         ILIKE ${pattern}
               OR i.item_alias           ILIKE ${pattern}
               OR i.item_default_barcode ILIKE ${pattern})
          AND (${args.itemCategoryId ?? null}::uuid IS NULL OR i.item_category_id = ${args.itemCategoryId ?? null}::uuid)
          AND (${args.trackPresetId ?? null}::uuid IS NULL
               OR COALESCE(i.item_track_preset_id,
                           (SELECT g.itg_track_preset_id FROM inventory.item_group_master g
                             WHERE g.itg_id = i.item_group_id)) = ${args.trackPresetId ?? null}::uuid)
          AND (${args.taxId ?? null}::uuid IS NULL OR i.item_default_tax_id = ${args.taxId ?? null}::uuid)
          AND (${args.activeOnly} = false OR i.item_is_active = true)`;
    }
    async listBuckets(itemId, companyId, branchId) {
        const key = (0, stock_voucher_posting_helper_1.bucketKeySql)({
            trackMrp: client_1.Prisma.raw('pol.track_mrp'),
            trackSalePrice: client_1.Prisma.raw('pol.track_sp'),
            mrp: client_1.Prisma.raw('b.sbl_mrp'),
            salePrice: client_1.Prisma.raw('b.sbl_sale_price'),
        });
        const cost = costColumns({ mc: 'mc', sic: 'sic', p: 'p', factor: 'iuc.iuc_to_base_factor' });
        const rows = await this.prisma.$queryRaw `
      WITH pol AS (
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_default_barcode,
               COALESCE(stp.stp_track_mrp, false)        AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sp
          FROM inventory.item_master i
          ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
            companyId: client_1.Prisma.sql `${companyId}::uuid`,
            branchId: client_1.Prisma.sql `${branchId}::uuid`,
            itemId: client_1.Prisma.raw('i.item_id'),
            itemGroupId: client_1.Prisma.raw('i.item_group_id'),
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
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
            pairs: client_1.Prisma.sql `
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
            itemId: client_1.Prisma.raw('pol.item_id'),
            uomId: client_1.Prisma.raw('iuc.iuc_id'),
            mrp: client_1.Prisma.raw('st.mrp'),
            salePrice: client_1.Prisma.raw('st.sp'),
            companyId,
            branchId,
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
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
    async loadRowCosts(tx, rows, companyId, branchId) {
        if (!rows.length) {
            return [];
        }
        const saveCost = costColumns({ mc: 'mc', sic: 'sic', p: 'p', factor: 'k.iuc_to_base_factor' });
        const found = await tx.$queryRaw `
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
          ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
            companyId: client_1.Prisma.sql `${companyId}::uuid`,
            branchId: client_1.Prisma.sql `${branchId}::uuid`,
            itemId: client_1.Prisma.raw('q.item_id'),
            itemGroupId: client_1.Prisma.raw('i.item_group_id'),
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
        })}
      ),
      ${mrpCostCte({
            companyId,
            branchId,
            pairs: client_1.Prisma.sql `
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
             COALESCE(p.ipm_min_price, 0) AS "minPrice"
        FROM keyed k
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
            itemId: client_1.Prisma.raw('k.item_id'),
            uomId: client_1.Prisma.raw('k.uom_id'),
            mrp: client_1.Prisma.raw('CASE WHEN k.track_mrp AND k.mrp > 0 THEN k.mrp END'),
            salePrice: client_1.Prisma.raw('CASE WHEN k.track_sp AND k.sp > 0 THEN k.sp END'),
            companyId,
            branchId,
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
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
                costRate: row?.costRate ? (0, module_service_utils_1.toNumber)(row.costRate) : 0,
                costWot: row?.costWot ? (0, module_service_utils_1.toNumber)(row.costWot) : 0,
                minPrice: row?.minPrice ? (0, module_service_utils_1.toNumber)(row.minPrice) : 0,
            };
        });
    }
    validateRows(candidates, storedMinPrices) {
        const problems = [];
        candidates.forEach((candidate, index) => {
            const minPrice = candidate.minPrice ?? storedMinPrices[index] ?? 0;
            for (const level of candidate.levels) {
                const verdict = candidate.mrp !== null && level.price > candidate.mrp
                    ? {
                        verdict: 'ABOVE_MRP',
                        text: `${level.price} is above the MRP ${candidate.mrp}.`,
                    }
                    : minPrice > 0 && level.price < minPrice
                        ? {
                            verdict: 'BELOW_MIN',
                            text: `${level.price} is below the minimum price ${minPrice}.`,
                        }
                        : candidate.costRate > 0 && level.price < candidate.costRate
                            ? {
                                verdict: 'BELOW_COST',
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
                        message: candidate.itemName ? `${candidate.itemName}: ${verdict.text}` : verdict.text,
                    });
                }
            }
        });
        return problems;
    }
    async findBucketRowForUpdate(tx, candidate, scope) {
        const [row] = await tx.$queryRaw `
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
    async updateBucketPrice(tx, ipmId, candidate) {
        const l = this.levelColumns(candidate);
        await tx.$executeRaw `
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
    async insertBucketPrice(tx, candidate, scope) {
        const l = this.levelColumns(candidate);
        const actor = this.actorColumn(candidate.actor);
        const [row] = await tx.$queryRaw `
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
    async snapshotRows(tx, ipmIds) {
        if (!ipmIds.length) {
            return new Map();
        }
        const rows = await tx.$queryRaw `
      SELECT p.ipm_id::text AS id, to_jsonb(p) AS row
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${[...ipmIds]}::uuid[])
    `;
        return new Map(rows.map((r) => [r.id, r.row]));
    }
    async listNoStock(tx, ipmIds, companyId, branchId) {
        if (!ipmIds.length) {
            return [];
        }
        const key = (0, stock_voucher_posting_helper_1.bucketKeySql)({
            trackMrp: client_1.Prisma.raw('COALESCE(stp.stp_track_mrp, false)'),
            trackSalePrice: client_1.Prisma.raw('COALESCE(stp.stp_track_sale_price, false)'),
            mrp: client_1.Prisma.raw('b.sbl_mrp'),
            salePrice: client_1.Prisma.raw('b.sbl_sale_price'),
        });
        const rows = await tx.$queryRaw `
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
        ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
            companyId: client_1.Prisma.sql `${companyId}::uuid`,
            branchId: client_1.Prisma.sql `${branchId}::uuid`,
            itemId: client_1.Prisma.raw('pr.ipm_item_id'),
            itemGroupId: client_1.Prisma.raw('i.item_group_id'),
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
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
            mrp: row.mrp === null ? null : (0, module_service_utils_1.toNumber)(row.mrp),
            salePrice: row.salePrice === null ? null : (0, module_service_utils_1.toNumber)(row.salePrice),
        }));
    }
    gridStatement(args) {
        const key = (0, stock_voucher_posting_helper_1.bucketKeySql)({
            trackMrp: client_1.Prisma.raw('pol.track_mrp'),
            trackSalePrice: client_1.Prisma.raw('pol.track_sp'),
            mrp: client_1.Prisma.raw('b.sbl_mrp'),
            salePrice: client_1.Prisma.raw('b.sbl_sale_price'),
        });
        const gridCost = costColumns({
            mc: 'mc',
            sic: 'sic',
            p: 'p',
            factor: 'iuc.iuc_to_base_factor',
        });
        return client_1.Prisma.sql `
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
          ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
            companyId: client_1.Prisma.sql `${args.companyId}::uuid`,
            branchId: client_1.Prisma.sql `${args.branchId}::uuid`,
            itemId: client_1.Prisma.raw('items.item_id'),
            itemGroupId: client_1.Prisma.raw('items.item_group_id'),
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
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
            pairs: client_1.Prisma.sql `SELECT DISTINCT item_id, mrp FROM stock WHERE mrp IS NOT NULL`,
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
            itemId: client_1.Prisma.raw('bk.item_id'),
            uomId: client_1.Prisma.raw('iuc.iuc_id'),
            mrp: client_1.Prisma.raw('bk.mrp'),
            salePrice: client_1.Prisma.raw('bk.sp'),
            companyId: args.companyId,
            branchId: args.branchId,
            onDate: client_1.Prisma.raw('CURRENT_DATE'),
        })}
       ORDER BY items.item_name_en, items.item_id, iuc.iuc_unit_slno, iuc.iuc_id,
                bk.mrp DESC NULLS LAST, bk.sp DESC NULLS LAST
    `;
    }
    toGridRecord(row) {
        const amount = (value) => (value === null ? 0 : (0, module_service_utils_1.toNumber)(value));
        return {
            itemId: row.itemId,
            itemCode: row.itemCode,
            barcode: row.barcode,
            itemName: row.itemName,
            uomId: row.uomId,
            unitName: row.unitName,
            stockQty: amount(row.stockQty),
            mrp: row.mrp === null ? null : (0, module_service_utils_1.toNumber)(row.mrp),
            salePrice: row.salePrice === null ? null : (0, module_service_utils_1.toNumber)(row.salePrice),
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
    levelColumns(candidate) {
        const at = (level) => candidate.levels.find((entry) => entry.level === level) ?? {
            price: null,
            priceWot: null,
            markupPerc: null,
        };
        const [a, b, c, d] = selling_price_bulk_types_1.PRICE_LEVELS.map(at);
        return { a, b, c, d };
    }
    actorColumn(actor) {
        return actor && actor !== module_service_utils_1.DEFAULT_ACTOR ? actor : null;
    }
};
exports.PriceBucketGateway = PriceBucketGateway;
exports.PriceBucketGateway = PriceBucketGateway = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PriceBucketGateway);
//# sourceMappingURL=price-bucket.gateway.js.map