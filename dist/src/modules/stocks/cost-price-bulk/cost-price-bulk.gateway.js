"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostPriceBulkGateway = void 0;
exports.rowTokenSql = rowTokenSql;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cost_price_bulk_rules_1 = require("./cost-price-bulk.rules");
function rowTokenSql(alias) {
    return client_1.Prisma.sql `md5((to_jsonb(${client_1.Prisma.raw(alias)}) - ${[...cost_price_bulk_rules_1.TOKEN_IGNORED_COLUMNS]}::text[])::text)`;
}
const PRESET_TRACKS_SQL = client_1.Prisma.sql `COALESCE(spt.spt_track_batch OR spt.spt_track_mrp
                           OR spt.spt_track_sale_price OR spt.spt_track_serial, false)`;
const LEFT_OUT_REASON_SQL = client_1.Prisma.sql `CASE WHEN NOT i.item_is_active THEN 'INACTIVE'
                WHEN ${PRESET_TRACKS_SQL} THEN 'NOT_PLAIN_STOCK'
                WHEN i.item_is_batch_based THEN 'OLD_BATCH_TICK' END`;
function headlineInForceLateral(args) {
    const a = client_1.Prisma.raw(args.alias);
    const day = args.onDate ?? client_1.Prisma.raw('CURRENT_DATE');
    return client_1.Prisma.sql `
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
let CostPriceBulkGateway = class CostPriceBulkGateway {
    unitsStatement(filter) {
        const named = filter.itemId !== undefined || filter.itemIds !== undefined;
        return client_1.Prisma.sql `
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
            itemId: client_1.Prisma.raw('units.item_id'),
            uomId: client_1.Prisma.raw('units.iuc_id'),
            companyId: filter.companyId,
            branchId: filter.branchId,
            alias: 'p',
        })}
      )`;
    }
    async listGrid(client, filter, page) {
        const rows = await client.$queryRaw `
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
            itemId: client_1.Prisma.raw('k.ipm_item_id'),
            uomId: client_1.Prisma.raw('k.ipm_uc_unit_id'),
            companyId: filter.companyId,
            branchId: filter.branchId,
            alias: 'kw',
            onDate: client_1.Prisma.raw('k.ipm_effective_from'),
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
            const [count] = await client.$queryRaw `
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
    async listLeftOut(client, filter, limit) {
        const rows = await client.$queryRaw `
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
        const counts = {
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
    async findItem(client, companyId, branchId, itemId) {
        const [row] = await client.$queryRaw `
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
    async readRowsForSave(tx, companyId, branchId, ipmIds, lock) {
        const ids = [...new Set(ipmIds)];
        if (!ids.length) {
            return new Map();
        }
        if (lock) {
            await tx.$queryRaw `
        SELECT ipm_id FROM inventory.item_price_master
         WHERE ipm_id = ANY(${ids}::uuid[])
         ORDER BY ipm_id
         FOR UPDATE`;
        }
        const rows = await tx.$queryRaw `
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
            itemId: client_1.Prisma.raw('p.ipm_item_id'),
            uomId: client_1.Prisma.raw('p.ipm_uc_unit_id'),
            companyId,
            branchId,
            alias: 'w',
        })}
       WHERE p.ipm_id = ANY(${ids}::uuid[])
    `;
        return new Map(rows.map((row) => [row.ipmId, row]));
    }
    async levels(client) {
        const rows = await client.$queryRaw `
      SELECT price_lvl_id::int AS id, price_lvl_name AS name,
             (price_lvl_is_active IS TRUE AND "price_lvl_isDeleted" IS NOT TRUE) AS active
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4`;
        const byId = new Map(rows.map((row) => [row.id, row]));
        return [1, 2, 3, 4].map((id) => ({
            level: id,
            name: byId.get(id)?.name?.trim() || `Price ${'ABCD'[id - 1]}`,
            active: byId.get(id)?.active === true,
        }));
    }
    async today(client) {
        const [row] = await client.$queryRaw `SELECT CURRENT_DATE::text AS today`;
        return row.today;
    }
};
exports.CostPriceBulkGateway = CostPriceBulkGateway;
exports.CostPriceBulkGateway = CostPriceBulkGateway = __decorate([
    (0, common_1.Injectable)()
], CostPriceBulkGateway);
const ONE = new client_1.Prisma.Decimal(1);
function toUnitRecord(row) {
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
//# sourceMappingURL=cost-price-bulk.gateway.js.map