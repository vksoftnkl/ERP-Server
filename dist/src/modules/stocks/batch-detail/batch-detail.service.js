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
exports.BatchDetailService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_error_codes_1 = require("../types/stock-error-codes");
const batch_detail_helper_1 = require("./batch-detail.helper");
const MAX_MODELS = 20;
let BatchDetailService = class BatchDetailService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async models(q) {
        const rows = await this.prisma.$queryRaw `
      SELECT model
        FROM (SELECT DISTINCT ON (upper(sbd_model))
                     sbd_model AS model,
                     COALESCE(sbd_modified_on, sbd_created_on) AS used_on
                FROM stock.stock_batch_detail
               WHERE sbd_company_id = ${q.companyId}::uuid
                 AND sbd_item_id    = ${q.itemId}::uuid
                 AND sbd_model IS NOT NULL
                 AND sbd_is_deleted = false
                 ${q.q ? client_1.Prisma.sql `AND strpos(upper(sbd_model), upper(${q.q})) > 0` : client_1.Prisma.empty}
               ORDER BY upper(sbd_model), COALESCE(sbd_modified_on, sbd_created_on) DESC) used
       ORDER BY used_on DESC, model
       LIMIT ${MAX_MODELS}`;
        return rows.map((row) => row.model);
    }
    async update(dto) {
        const actor = this.requestContextService.getUserId() ?? null;
        const batchNo = (0, batch_detail_helper_1.foldBatchNo)(dto.batchNo);
        return this.prisma.$transaction(async (tx) => {
            const [row] = await tx.$queryRaw `
        SELECT sbd_id, sbd_size_id, sbd_colour_id, sbd_model, sbd_src_doc_id
          FROM stock.stock_batch_detail
         WHERE sbd_company_id = ${dto.companyId}::uuid
           AND sbd_batch_no   = ${batchNo}
           AND sbd_is_deleted = false
         FOR UPDATE`;
            if (!row) {
                (0, module_service_utils_1.throwStockNotFound)('Batch detail not found', 'batchNo', `Batch ${batchNo} has no size / colour / model on record.`, stock_error_codes_1.StockErrorCode.BATCH_DETAIL_NOT_FOUND);
            }
            await this.assertSourceNotDraft(tx, row.sbd_src_doc_id, batchNo);
            const errors = await (0, batch_detail_helper_1.unknownSizesAndColours)(tx, dto.companyId, [{ sizeId: dto.sizeId, colourId: dto.colourId }], (_index, column) => column);
            if (errors.length > 0) {
                (0, module_service_utils_1.throwStockUnprocessable)('Size or colour not found', errors);
            }
            const next = {
                sizeId: dto.sizeId !== undefined ? dto.sizeId : row.sbd_size_id,
                colourId: dto.colourId !== undefined ? dto.colourId : row.sbd_colour_id,
                model: dto.model !== undefined ? dto.model?.trim() || null : row.sbd_model,
            };
            const before = await this.record(tx, row.sbd_id);
            if (next.sizeId === row.sbd_size_id &&
                next.colourId === row.sbd_colour_id &&
                next.model === row.sbd_model) {
                return before;
            }
            await tx.$executeRaw `
        UPDATE stock.stock_batch_detail
           SET sbd_size_id     = ${next.sizeId}::uuid,
               sbd_colour_id   = ${next.colourId}::uuid,
               sbd_model       = ${next.model},
               sbd_modified_on = now(),
               sbd_modified_by = ${actor}
         WHERE sbd_id = ${row.sbd_id}::uuid`;
            const after = await this.record(tx, row.sbd_id);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: 'stock_batch_detail',
                screenName: 'Batch Detail',
                screenType: 'transaction',
                pk: row.sbd_id,
                displayName: batchNo,
                originalRecord: before,
                modifiedRecord: after,
                userId: actor ?? undefined,
                notes: dto.reason,
            }, tx);
            return after;
        });
    }
    async assertSourceNotDraft(tx, srcDocId, batchNo) {
        if (!srcDocId)
            return;
        const [doc] = await tx.$queryRaw `
      SELECT svh_status, svh_refno FROM stock.stock_voucher
       WHERE svh_id = ${srcDocId}::uuid AND svh_is_deleted = false
       LIMIT 1`;
        if (doc?.svh_status === 'DRAFT') {
            (0, module_service_utils_1.throwStockConflict)(`${doc.svh_refno} is a draft`, [
                {
                    field: 'batchNo',
                    code: stock_error_codes_1.StockErrorCode.BATCH_DETAIL_ON_DRAFT,
                    message: `Batch ${batchNo} is on draft ${doc.svh_refno}: change it there and save the draft.`,
                },
            ]);
        }
    }
    async record(tx, sbdId) {
        const [record] = await tx.$queryRaw `
      SELECT sbd.sbd_id::text          AS "sbdId",
             sbd.sbd_company_id::text  AS "companyId",
             sbd.sbd_batch_no          AS "batchNo",
             sbd.sbd_item_id::text     AS "itemId",
             itm.item_name_en          AS "itemName",
             sbd.sbd_size_id::text     AS "sizeId",
             isz.isz_name              AS "sizeName",
             sbd.sbd_colour_id::text   AS "colourId",
             icl.icl_name              AS "colourName",
             sbd.sbd_model             AS model,
             sbd.sbd_src_doc_type      AS "srcDocType",
             sbd.sbd_src_doc_id::text  AS "srcDocId",
             sbd.sbd_src_line_id::text AS "srcLineId"
        FROM stock.stock_batch_detail sbd
        JOIN inventory.item_master itm ON itm.item_id = sbd.sbd_item_id
        LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
       WHERE sbd.sbd_id = ${sbdId}::uuid`;
        return record;
    }
};
exports.BatchDetailService = BatchDetailService;
exports.BatchDetailService = BatchDetailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], BatchDetailService);
//# sourceMappingURL=batch-detail.service.js.map