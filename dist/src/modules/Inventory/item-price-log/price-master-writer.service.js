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
exports.PriceMasterWriter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const price_bucket_gateway_1 = require("../../stocks/selling-price-bulk/price-bucket.gateway");
const selling_price_bulk_types_1 = require("../../stocks/selling-price-bulk/types/selling-price-bulk.types");
const price_change_log_service_1 = require("./price-change-log.service");
const price_change_log_types_1 = require("./types/price-change-log.types");
const DEFAULT_PROFIT_TYPE = 'By User';
let PriceMasterWriter = class PriceMasterWriter {
    changeLog;
    constructor(changeLog) {
        this.changeLog = changeLog;
    }
    async createPrice(tx, origin, data) {
        const created = await tx.itemPriceMaster.create({ data });
        await this.logAfter(tx, 'IPM', origin, [created.ipmId], new Map());
        return created;
    }
    async updatePrice(tx, origin, ipmId, data) {
        const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
        const updated = await tx.itemPriceMaster.update({ where: { ipmId }, data });
        await this.logAfter(tx, 'IPM', origin, [ipmId], before);
        return updated;
    }
    async rekeyPrice(tx, ipmId, key, updatedOn) {
        const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
        await tx.itemPriceMaster.update({
            where: { ipmId },
            data: { ipmBucketMrp: key.mrp, ipmBucketSp: key.salePrice, ipmUpdatedOn: updatedOn },
        });
        await this.logAfter(tx, 'IPM', price_change_log_types_1.PRICE_ORIGIN.BUCKET_REKEY, [ipmId], before, 'REKEY');
    }
    async updateBucketPrice(tx, ipmId, candidate, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
        const l = levelColumns(candidate);
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
             ipm_profit_type = COALESCE(${candidate.profitType ?? null}::varchar, ipm_profit_type),
             ipm_round_off   = COALESCE(${candidate.roundOff}::numeric, ipm_round_off),
             ipm_updated_on  = now(),
             ipm_updated_by  = ${actorColumn(candidate.actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
        await this.logAfter(tx, 'IPM', origin, [ipmId], before);
        return ipmId;
    }
    async insertBucketPrice(tx, candidate, scope, onDate, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const l = levelColumns(candidate);
        const actor = actorColumn(candidate.actor);
        const day = (0, price_bucket_gateway_1.daySql)(onDate);
        const sameKey = client_1.Prisma.sql `
             k.ipm_company_id IS NOT DISTINCT FROM ${candidate.companyId}::uuid
         AND k.ipm_branch_id  IS NOT DISTINCT FROM ${scope.targetBranchId}::uuid
         AND k.ipm_item_id    = ${candidate.itemId}::uuid
         AND k.ipm_uc_unit_id = ${candidate.uomId}::uuid
         AND k.ipm_key_mrp    = COALESCE(${candidate.mrp}::numeric, -1)
         AND k.ipm_key_sp     = COALESCE(${candidate.salePrice}::numeric, -1)
         AND k.ipm_is_deleted = false`;
        const from = onDate
            ? day
            : client_1.Prisma.sql `COALESCE((SELECT MAX(k.ipm_effective_to) + 1
                                FROM inventory.item_price_master k
                               WHERE ${sameKey} AND k.ipm_effective_to < ${day}),
                              DATE '1900-01-01')`;
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
        ipm_effective_from, ipm_effective_to,
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
             COALESCE(${candidate.profitType ?? null}::varchar, h.ipm_profit_type, ${DEFAULT_PROFIT_TYPE}),
             COALESCE(${candidate.roundOff}::numeric, h.ipm_round_off, 0),
             COALESCE(h.ipm_loading_charge, 0), COALESCE(h.ipm_freight_charge, 0),
             COALESCE(h.ipm_loyalty_points, 0), h.ipm_uom_remarks,
             ${candidate.mrp}::numeric, ${candidate.salePrice}::numeric,
             ${from},
             COALESCE((SELECT MIN(k.ipm_effective_from) - 1
                         FROM inventory.item_price_master k
                        WHERE ${sameKey} AND k.ipm_effective_from > ${day}),
                      DATE '9999-12-31'),
             now(), ${actor}::uuid, now(), ${actor}::uuid
        FROM (SELECT 1) one
        LEFT JOIN LATERAL (
          SELECT hp.*
            FROM inventory.item_price_master hp
           WHERE hp.ipm_item_id    = ${candidate.itemId}::uuid
             AND hp.ipm_uc_unit_id = ${candidate.uomId}::uuid
             AND hp.ipm_key_mrp = -1 AND hp.ipm_key_sp = -1
             AND hp.ipm_is_deleted = false
             AND ${day} BETWEEN hp.ipm_effective_from AND hp.ipm_effective_to
             AND (hp.ipm_company_id IS NULL OR hp.ipm_company_id = ${candidate.companyId}::uuid)
             AND (hp.ipm_branch_id  IS NULL OR hp.ipm_branch_id  = ${scope.targetBranchId}::uuid)
           ORDER BY (hp.ipm_branch_id IS NULL), (hp.ipm_company_id IS NULL), hp.ipm_id
           LIMIT 1
        ) h ON true
      RETURNING ipm_id AS "ipmId"
    `;
        await this.logAfter(tx, 'IPM', origin, [row.ipmId], new Map());
        return row.ipmId;
    }
    async closePriceRowBefore(tx, ipmId, onDate, actor, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
        await tx.$executeRaw `
      UPDATE inventory.item_price_master
         SET ipm_effective_to = ${onDate}::date - 1,
             ipm_updated_on   = now(),
             ipm_updated_by   = ${actorColumn(actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
        await this.logAfter(tx, 'IPM', origin, [ipmId], before);
    }
    async insertSplitPrice(tx, sourceId, candidate, period, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const l = levelColumns(candidate);
        const actor = actorColumn(candidate.actor);
        const [row] = await tx.$queryRaw `
      INSERT INTO inventory.item_price_master (
        ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_godown_id, ipm_sl_no,
        ipm_cost_price, ipm_cost_wot,
        ipm_sales_price_a, ipm_sales_price_b, ipm_sales_price_c, ipm_sales_price_d,
        ipm_price_a_wot, ipm_price_b_wot, ipm_price_c_wot, ipm_price_d_wot,
        ipm_price_a_markup_perc, ipm_price_b_markup_perc, ipm_price_c_markup_perc, ipm_price_d_markup_perc,
        ipm_max_price, ipm_min_price, ipm_disc_perc, ipm_disc_qty, ipm_addl_cess,
        ipm_profit_type, ipm_round_off, ipm_loading_charge, ipm_freight_charge, ipm_loyalty_points,
        ipm_uom_remarks, ipm_cost_remarks, ipm_is_active, ipm_bucket_mrp, ipm_bucket_sp,
        ipm_effective_from, ipm_effective_to,
        ipm_created_on, ipm_created_by, ipm_updated_on, ipm_updated_by
      )
      SELECT o.ipm_company_id, o.ipm_branch_id, o.ipm_item_id, o.ipm_uc_unit_id, o.ipm_godown_id, o.ipm_sl_no,
             ${candidate.costRate}, ${candidate.costWot},
             COALESCE(${l.a.price}::numeric, o.ipm_sales_price_a),
             COALESCE(${l.b.price}::numeric, o.ipm_sales_price_b),
             COALESCE(${l.c.price}::numeric, o.ipm_sales_price_c),
             COALESCE(${l.d.price}::numeric, o.ipm_sales_price_d),
             COALESCE(${l.a.priceWot}::numeric, o.ipm_price_a_wot),
             COALESCE(${l.b.priceWot}::numeric, o.ipm_price_b_wot),
             COALESCE(${l.c.priceWot}::numeric, o.ipm_price_c_wot),
             COALESCE(${l.d.priceWot}::numeric, o.ipm_price_d_wot),
             COALESCE(${l.a.markupPerc}::numeric, o.ipm_price_a_markup_perc),
             COALESCE(${l.b.markupPerc}::numeric, o.ipm_price_b_markup_perc),
             COALESCE(${l.c.markupPerc}::numeric, o.ipm_price_c_markup_perc),
             COALESCE(${l.d.markupPerc}::numeric, o.ipm_price_d_markup_perc),
             o.ipm_max_price, COALESCE(${candidate.minPrice}::numeric, o.ipm_min_price),
             o.ipm_disc_perc, o.ipm_disc_qty, o.ipm_addl_cess,
             COALESCE(${candidate.profitType ?? null}::varchar, o.ipm_profit_type, ${DEFAULT_PROFIT_TYPE}),
             COALESCE(${candidate.roundOff}::numeric, o.ipm_round_off),
             o.ipm_loading_charge, o.ipm_freight_charge, o.ipm_loyalty_points,
             o.ipm_uom_remarks, o.ipm_cost_remarks, o.ipm_is_active, o.ipm_bucket_mrp, o.ipm_bucket_sp,
             ${period.from}::date, ${period.to}::date,
             now(), ${actor}::uuid, now(), ${actor}::uuid
        FROM inventory.item_price_master o
       WHERE o.ipm_id = ${sourceId}::uuid
      RETURNING ipm_id AS "ipmId"
    `;
        await this.logAfter(tx, 'IPM', origin, [row.ipmId], new Map());
        return row.ipmId;
    }
    async softDeletePriceRow(tx, ipmId, actor, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
        await tx.$executeRaw `
      UPDATE inventory.item_price_master
         SET ipm_is_deleted = true,
             ipm_updated_on = now(),
             ipm_updated_by = ${actorColumn(actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
        await this.logAfter(tx, 'IPM', origin, [ipmId], before);
    }
    async extendPriceRowTo(tx, ipmId, effectiveTo, actor, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
        await tx.$executeRaw `
      UPDATE inventory.item_price_master
         SET ipm_effective_to = ${effectiveTo}::date,
             ipm_updated_on   = now(),
             ipm_updated_by   = ${actorColumn(actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
        await this.logAfter(tx, 'IPM', origin, [ipmId], before);
    }
    async rewritePriceRows(tx, origin, rows, actor) {
        const ids = rows.map((row) => row.ipmId);
        if (!ids.length) {
            return { before: new Map(), after: new Map() };
        }
        const before = await this.changeLog.snapshot(tx, 'IPM', ids);
        const text = (pick) => rows.map((row) => pick(row).toFixed());
        const level = (index, key) => text((row) => row.levels[index][key]);
        await tx.$executeRaw `
      UPDATE inventory.item_price_master p
         SET ipm_cost_price          = v.cost_price,
             ipm_cost_wot            = v.cost_wot,
             ipm_max_price           = v.max_price,
             ipm_min_price           = v.min_price,
             ipm_profit_type         = v.profit_type,
             ipm_sales_price_a       = v.price_a,
             ipm_sales_price_b       = v.price_b,
             ipm_sales_price_c       = v.price_c,
             ipm_sales_price_d       = v.price_d,
             ipm_price_a_wot         = v.wot_a,
             ipm_price_b_wot         = v.wot_b,
             ipm_price_c_wot         = v.wot_c,
             ipm_price_d_wot         = v.wot_d,
             ipm_price_a_markup_perc = v.markup_a,
             ipm_price_b_markup_perc = v.markup_b,
             ipm_price_c_markup_perc = v.markup_c,
             ipm_price_d_markup_perc = v.markup_d,
             ipm_updated_on          = now(),
             ipm_updated_by          = ${actorColumn(actor)}::uuid
        FROM unnest(
               ${ids}::uuid[],
               ${text((row) => row.costPrice)}::numeric[],
               ${text((row) => row.costWot)}::numeric[],
               ${text((row) => row.maxPrice)}::numeric[],
               ${text((row) => row.minPrice)}::numeric[],
               ${rows.map((row) => row.profitType)}::varchar[],
               ${level(0, 'price')}::numeric[], ${level(1, 'price')}::numeric[],
               ${level(2, 'price')}::numeric[], ${level(3, 'price')}::numeric[],
               ${level(0, 'priceWot')}::numeric[], ${level(1, 'priceWot')}::numeric[],
               ${level(2, 'priceWot')}::numeric[], ${level(3, 'priceWot')}::numeric[],
               ${level(0, 'markupPerc')}::numeric[], ${level(1, 'markupPerc')}::numeric[],
               ${level(2, 'markupPerc')}::numeric[], ${level(3, 'markupPerc')}::numeric[]
             ) AS v(ipm_id, cost_price, cost_wot, max_price, min_price, profit_type,
                    price_a, price_b, price_c, price_d,
                    wot_a, wot_b, wot_c, wot_d,
                    markup_a, markup_b, markup_c, markup_d)
       WHERE p.ipm_id = v.ipm_id
    `;
        const after = await this.changeLog.snapshot(tx, 'IPM', ids);
        for (const row of rows) {
            await this.changeLog.record(tx, {
                table: 'IPM',
                rowId: row.ipmId,
                origin: row.reason ? { ...origin, reason: row.reason } : origin,
                before: before.get(row.ipmId) ?? null,
                after: after.get(row.ipmId) ?? null,
            });
        }
        return { before, after };
    }
    async insertCompanyPriceRows(tx, origin, companyId, rows, actor) {
        const out = new Map();
        const by = actorColumn(actor);
        for (const row of rows) {
            const [a, b, c, d] = row.levels;
            const sameKey = client_1.Prisma.sql `
               k.ipm_company_id = ${companyId}::uuid
           AND k.ipm_branch_id IS NOT DISTINCT FROM o.ipm_branch_id
           AND k.ipm_item_id    = o.ipm_item_id
           AND k.ipm_uc_unit_id = o.ipm_uc_unit_id
           AND k.ipm_key_mrp    = o.ipm_key_mrp
           AND k.ipm_key_sp     = o.ipm_key_sp
           AND k.ipm_is_deleted = false`;
            const [created] = await tx.$queryRaw `
        INSERT INTO inventory.item_price_master (
          ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_godown_id, ipm_sl_no,
          ipm_cost_price, ipm_cost_wot,
          ipm_sales_price_a, ipm_sales_price_b, ipm_sales_price_c, ipm_sales_price_d,
          ipm_price_a_wot, ipm_price_b_wot, ipm_price_c_wot, ipm_price_d_wot,
          ipm_price_a_markup_perc, ipm_price_b_markup_perc, ipm_price_c_markup_perc, ipm_price_d_markup_perc,
          ipm_max_price, ipm_min_price, ipm_disc_perc, ipm_disc_qty, ipm_addl_cess,
          ipm_profit_type, ipm_round_off, ipm_loading_charge, ipm_freight_charge, ipm_loyalty_points,
          ipm_uom_remarks, ipm_cost_remarks, ipm_is_active, ipm_bucket_mrp, ipm_bucket_sp,
          ipm_effective_from, ipm_effective_to,
          ipm_created_on, ipm_created_by, ipm_updated_on, ipm_updated_by
        )
        SELECT ${companyId}::uuid, o.ipm_branch_id, o.ipm_item_id, o.ipm_uc_unit_id, o.ipm_godown_id, o.ipm_sl_no,
               ${row.costPrice.toFixed()}::numeric, ${row.costWot.toFixed()}::numeric,
               ${a.price.toFixed()}::numeric, ${b.price.toFixed()}::numeric,
               ${c.price.toFixed()}::numeric, ${d.price.toFixed()}::numeric,
               ${a.priceWot.toFixed()}::numeric, ${b.priceWot.toFixed()}::numeric,
               ${c.priceWot.toFixed()}::numeric, ${d.priceWot.toFixed()}::numeric,
               ${a.markupPerc.toFixed()}::numeric, ${b.markupPerc.toFixed()}::numeric,
               ${c.markupPerc.toFixed()}::numeric, ${d.markupPerc.toFixed()}::numeric,
               ${row.maxPrice.toFixed()}::numeric, ${row.minPrice.toFixed()}::numeric,
               o.ipm_disc_perc, o.ipm_disc_qty, o.ipm_addl_cess,
               ${row.profitType}::varchar, o.ipm_round_off,
               o.ipm_loading_charge, o.ipm_freight_charge, o.ipm_loyalty_points,
               o.ipm_uom_remarks, o.ipm_cost_remarks, o.ipm_is_active, o.ipm_bucket_mrp, o.ipm_bucket_sp,
               GREATEST(o.ipm_effective_from,
                        COALESCE((SELECT MAX(k.ipm_effective_to) + 1
                                    FROM inventory.item_price_master k
                                   WHERE ${sameKey} AND k.ipm_effective_to < CURRENT_DATE),
                                 o.ipm_effective_from)),
               LEAST(o.ipm_effective_to,
                     COALESCE((SELECT MIN(k.ipm_effective_from) - 1
                                 FROM inventory.item_price_master k
                                WHERE ${sameKey} AND k.ipm_effective_from > CURRENT_DATE),
                              o.ipm_effective_to)),
               now(), ${by}::uuid, now(), ${by}::uuid
          FROM inventory.item_price_master o
         WHERE o.ipm_id = ${row.ipmId}::uuid
           AND o.ipm_company_id IS NULL
        RETURNING ipm_id AS "ipmId"
      `;
            if (created) {
                out.set(row.ipmId, { ipmId: created.ipmId, after: null });
            }
        }
        const ids = [...out.values()].map((entry) => entry.ipmId);
        const after = await this.changeLog.snapshot(tx, 'IPM', ids);
        for (const row of rows) {
            const entry = out.get(row.ipmId);
            if (!entry) {
                continue;
            }
            entry.after = after.get(entry.ipmId) ?? null;
            await this.changeLog.record(tx, {
                table: 'IPM',
                rowId: entry.ipmId,
                origin: row.reason ? { ...origin, reason: row.reason } : origin,
                before: null,
                after: entry.after,
            });
        }
        return out;
    }
    async createQtyPrice(tx, origin, data, include) {
        const created = await tx.itemQtyPrice.create({ data, include });
        await this.logAfter(tx, 'IQP', origin, [created.iqpId], new Map());
        return created;
    }
    async updateQtyPrice(tx, origin, iqpId, data, include) {
        const before = await this.changeLog.snapshot(tx, 'IQP', [iqpId]);
        const updated = await tx.itemQtyPrice.update({ where: { iqpId }, data, include });
        await this.logAfter(tx, 'IQP', origin, [iqpId], before);
        return updated;
    }
    async setQtyPriceDeleted(tx, origin, iqpId, wasDeleted, data) {
        const before = await this.changeLog.snapshot(tx, 'IQP', [iqpId]);
        const result = await tx.itemQtyPrice.updateMany({
            where: { iqpId, iqpIsDeleted: wasDeleted },
            data,
        });
        if (result.count > 0) {
            await this.logAfter(tx, 'IQP', origin, [iqpId], before);
        }
        return result.count;
    }
    async logAfter(tx, table, origin, ids, before, action) {
        const after = await this.changeLog.snapshot(tx, table, ids);
        for (const rowId of ids) {
            await this.changeLog.record(tx, {
                table,
                rowId,
                origin,
                before: before.get(rowId) ?? null,
                after: after.get(rowId) ?? null,
                ...(action ? { action } : {}),
            });
        }
    }
};
exports.PriceMasterWriter = PriceMasterWriter;
exports.PriceMasterWriter = PriceMasterWriter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [price_change_log_service_1.PriceChangeLogService])
], PriceMasterWriter);
function levelColumns(candidate) {
    const at = (level) => candidate.levels.find((entry) => entry.level === level) ?? {
        price: null,
        priceWot: null,
        markupPerc: null,
    };
    const [a, b, c, d] = selling_price_bulk_types_1.PRICE_LEVELS.map(at);
    return { a, b, c, d };
}
function actorColumn(actor) {
    return actor && actor !== module_service_utils_1.DEFAULT_ACTOR ? actor : null;
}
//# sourceMappingURL=price-master-writer.service.js.map