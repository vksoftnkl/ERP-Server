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
exports.ItemBatchStockService = void 0;
const common_1 = require("@nestjs/common");
const loose_search_1 = require("../../../common/search/loose-search");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let ItemBatchStockService = class ItemBatchStockService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getByScope(queryDto) {
        const unitFactorsByUnitId = await this.getItemPriceUnitFactors(queryDto.ibs_item_id, queryDto.ibs_unit_id);
        const records = await this.prisma.$queryRaw `
      SELECT b.sbl_id, b.sbl_company_id, b.sbl_branch_id, b.sbl_godown_id, b.sbl_item_id, b.sbl_lot_id,
             b.sbl_bucket, b.sbl_in_qty, b.sbl_out_qty, b.sbl_free_in_qty, b.sbl_free_out_qty,
             b.sbl_on_hand_qty, b.sbl_reserved_qty, b.sbl_available_qty,
             b.sbl_avg_cost_rate, b.sbl_stock_value, b.sbl_last_in_date, b.sbl_last_out_date,
             b.sbl_is_active, b.sbl_is_deleted, b.sbl_row_version,
             b.sbl_created_on, b.sbl_created_by, b.sbl_modified_on, b.sbl_modified_by,
             slt.slt_batch_no, slt.slt_mfg_date, slt.slt_expiry_date, slt.slt_mrp, slt.slt_serial_no,
             slt.slt_first_inward_date,
             op.qty AS opening_qty, op.free_qty AS opening_free_qty, op.value AS opening_value
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        LEFT JOIN LATERAL (
          SELECT SUM(sml.sml_base_qty) AS qty, SUM(sml.sml_free_base_qty) AS free_qty,
                 SUM(sml.sml_cost_value) AS value
            FROM stock.stock_ledger sml
           WHERE sml.sml_company_id = b.sbl_company_id AND sml.sml_branch_id = b.sbl_branch_id
             AND sml.sml_godown_id  = b.sbl_godown_id  AND sml.sml_item_id   = b.sbl_item_id
             AND sml.sml_lot_id     = b.sbl_lot_id     AND sml.sml_bucket    = b.sbl_bucket
             AND sml.sml_acc_year   = ${queryDto.ibs_acc_year}::bpchar
             AND sml.sml_txn_type   = 'OPENING'
             AND sml.sml_is_deleted = false AND sml.sml_is_reversal = false
             AND NOT EXISTS (SELECT 1 FROM stock.stock_ledger rev
                              WHERE rev.sml_reverses_id = sml.sml_id AND rev.sml_acc_year = sml.sml_acc_year
                                AND rev.sml_is_reversal = true AND rev.sml_is_deleted = false)
        ) op ON true
       WHERE b.sbl_company_id = ${queryDto.ibs_company_id}::uuid
         AND b.sbl_branch_id  = ${queryDto.ibs_branch_id}::uuid
         AND b.sbl_godown_id  = ${queryDto.ibs_godown_id}::uuid
         AND b.sbl_item_id    = ${queryDto.ibs_item_id}::uuid
         AND b.sbl_is_active  = ${queryDto.ibs_is_active ?? true}::boolean
         AND b.sbl_is_deleted = ${queryDto.ibs_is_deleted ?? false}::boolean
         AND (${queryDto.ibs_batch_id ?? null}::uuid IS NULL OR b.sbl_lot_id = ${queryDto.ibs_batch_id ?? null}::uuid)
         AND (${queryDto.ibs_stock_bucket ?? null}::text IS NULL OR b.sbl_bucket = ${queryDto.ibs_stock_bucket ?? null}::text)
         AND ${(0, loose_search_1.looseSearchSql)(['slt.slt_batch_no', 'slt.slt_serial_no'], queryDto.search)}
       ORDER BY b.sbl_bucket, slt.slt_expiry_date NULLS LAST, slt.slt_batch_no, b.sbl_lot_id
    `;
        if (records.length === 0) {
            this.throwItemBatchStockNotFound(queryDto);
        }
        if (unitFactorsByUnitId.size === 0) {
            this.throwItemPriceMasterNotFound(queryDto.ibs_item_id, queryDto.ibs_unit_id);
        }
        const unitFactor = unitFactorsByUnitId.get(queryDto.ibs_unit_id);
        if (unitFactor === undefined) {
            this.throwItemPriceMasterNotFound(queryDto.ibs_item_id, queryDto.ibs_unit_id);
        }
        return records.map((record) => this.toPayload(queryDto, record, unitFactor));
    }
    toPayload(query, record, unitFactor = 1) {
        const closingQty = this.toNumber(record.sbl_on_hand_qty);
        const freeClosingQty = this.toNumber(record.sbl_free_in_qty) - this.toNumber(record.sbl_free_out_qty);
        const reservedQty = this.toNumber(record.sbl_reserved_qty);
        const availableQty = this.toNumber(record.sbl_available_qty);
        const openingQty = this.toNumber(record.opening_qty);
        const openingValue = this.toNumber(record.opening_value);
        return {
            ibs_id: record.sbl_id,
            ibs_acc_year: query.ibs_acc_year,
            ibs_company_id: record.sbl_company_id,
            ibs_branch_id: record.sbl_branch_id,
            ibs_godown_id: record.sbl_godown_id,
            ibs_item_id: record.sbl_item_id,
            ibs_unit_id: query.ibs_unit_id,
            ibs_batch_id: record.sbl_lot_id,
            ibs_batch_no: record.slt_batch_no,
            ibs_mfg_batch_no: null,
            ibs_batch_date: this.toIsoStringOrNull(record.slt_first_inward_date),
            ibs_serial_no: record.slt_serial_no,
            ibs_mfg_date: this.toIsoStringOrNull(record.slt_mfg_date),
            ibs_expiry_date: this.toIsoStringOrNull(record.slt_expiry_date),
            ibs_mrp: this.toNumber(record.slt_mrp),
            ibs_barcode: null,
            ibs_stock_bucket: record.sbl_bucket,
            ibs_opening_qty: openingQty,
            ibs_in_qty: this.toNumber(record.sbl_in_qty),
            ibs_out_qty: this.toNumber(record.sbl_out_qty),
            ibs_closing_qty: closingQty,
            ibs_opening_free_qty: this.toNumber(record.opening_free_qty),
            ibs_free_in_qty: this.toNumber(record.sbl_free_in_qty),
            ibs_free_out_qty: this.toNumber(record.sbl_free_out_qty),
            ibs_free_closing_qty: freeClosingQty,
            ibs_reserved_qty: reservedQty,
            ibs_available_qty: availableQty,
            book_qty: this.calculateBookQty(closingQty, unitFactor),
            book_base_qty: closingQty,
            book_free_qty: this.calculateBookQty(freeClosingQty, unitFactor),
            book_free_base_qty: freeClosingQty,
            book_reserved_qty: this.calculateBookQty(reservedQty, unitFactor),
            book_reserved_base_qty: reservedQty,
            book_available_qty: this.calculateBookQty(availableQty, unitFactor),
            book_available_base_qty: availableQty,
            ibs_opening_avg_rate: openingQty > 0 ? openingValue / openingQty : 0,
            ibs_avg_stock_rate: this.toNumber(record.sbl_avg_cost_rate),
            ibs_opening_value: openingValue,
            ibs_stock_value: this.toNumber(record.sbl_stock_value),
            ibs_last_in_date: this.toIsoStringOrNull(record.sbl_last_in_date),
            ibs_last_out_date: this.toIsoStringOrNull(record.sbl_last_out_date),
            ibs_is_active: record.sbl_is_active,
            ibs_is_deleted: record.sbl_is_deleted,
            ibs_row_version: record.sbl_row_version.toString(),
            ibs_created_on: record.sbl_created_on.toISOString(),
            ibs_created_by: record.sbl_created_by,
            ibs_updated_on: this.toIsoStringOrNull(record.sbl_modified_on),
            ibs_updated_by: record.sbl_modified_by,
        };
    }
    async getItemPriceUnitFactors(itemId, unitId) {
        const records = await this.prisma.itemPriceMaster.findMany({
            where: {
                ipmItemId: itemId,
                ipmIsDeleted: false,
                OR: [
                    { ipmId: unitId },
                    { ipmUcUnitId: unitId },
                    { itemUnitConversion: { iucUnitId: unitId } },
                ],
            },
            select: {
                ipmId: true,
                ipmUcUnitId: true,
                itemUnitConversion: { select: { iucUnitId: true, iucUnitFactor: true } },
            },
            orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
        });
        const factorsByUnitId = new Map();
        for (const record of records) {
            const unitFactor = this.toNumber(record.itemUnitConversion.iucUnitFactor);
            if (!factorsByUnitId.has(record.ipmId)) {
                factorsByUnitId.set(record.ipmId, unitFactor);
            }
            if (!factorsByUnitId.has(record.ipmUcUnitId)) {
                factorsByUnitId.set(record.ipmUcUnitId, unitFactor);
            }
            if (!factorsByUnitId.has(record.itemUnitConversion.iucUnitId)) {
                factorsByUnitId.set(record.itemUnitConversion.iucUnitId, unitFactor);
            }
        }
        return factorsByUnitId;
    }
    calculateBookQty(baseQty, unitFactor) {
        return unitFactor > 0 ? baseQty / unitFactor : 0;
    }
    toIsoStringOrNull(value) {
        return value ? value.toISOString() : null;
    }
    toNumber(value) {
        const parsed = Number(value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    throwItemBatchStockNotFound(queryDto) {
        const batchMessage = queryDto.ibs_batch_id ? `, batch ${queryDto.ibs_batch_id}` : '';
        throw new common_1.NotFoundException(this.buildErrorResponse('Item batch stock not found', [
            {
                field: 'scope',
                message: `No item batch stock found for acc year ${queryDto.ibs_acc_year}, ` +
                    `company ${queryDto.ibs_company_id}, branch ${queryDto.ibs_branch_id}, ` +
                    `godown ${queryDto.ibs_godown_id}, item ${queryDto.ibs_item_id}, ` +
                    `unit ${queryDto.ibs_unit_id}${batchMessage}`,
            },
        ]));
    }
    throwItemPriceMasterNotFound(itemId, unitId) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Item price master not found', [
            {
                field: 'ipm_item_id',
                message: `No item price master found for item ${itemId} and unit ${unitId}`,
            },
        ]));
    }
    buildErrorResponse(message, errors = []) {
        return {
            success: false,
            message,
            errors,
        };
    }
};
exports.ItemBatchStockService = ItemBatchStockService;
exports.ItemBatchStockService = ItemBatchStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemBatchStockService);
//# sourceMappingURL=itemBatchStockService.js.map