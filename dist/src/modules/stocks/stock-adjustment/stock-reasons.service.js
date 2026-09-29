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
exports.StockReasonsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_service_utils_2 = require("../../../common/utils/module-service.utils");
const stock_adjustment_rules_1 = require("./stock-adjustment.rules");
let StockReasonsService = class StockReasonsService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async pick(query) {
        const kindTypes = stock_adjustment_rules_1.STOCK_ADJUSTMENT_RULES[query.voucherType].ledgerTxnTypes;
        const strict = query.voucherType === stock_adjustment_rules_1.BUCKET_MOVE_KIND;
        const rows = await this.prisma.$queryRaw `
      SELECT r.srm_id, r.srm_company_id, r.srm_code, r.srm_name, r.srm_direction, r.srm_allowed_txn_types,
             r.srm_require_remarks, r.srm_gl_ledger_id, l.led_name, r.srm_sort_order, r.srm_remarks, r.srm_is_active
        FROM stock.stock_reason_master r
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = r.srm_gl_ledger_id
       WHERE r.srm_is_deleted = false AND r.srm_is_active = true
         AND (r.srm_company_id = ${query.companyId}::uuid
              OR (r.srm_company_id IS NULL AND NOT EXISTS (
                    SELECT 1 FROM stock.stock_reason_master o
                     WHERE o.srm_company_id = ${query.companyId}::uuid AND o.srm_code = r.srm_code
                       AND o.srm_is_deleted = false)))
         AND ((NOT ${strict}::boolean AND cardinality(r.srm_allowed_txn_types) = 0)
              OR r.srm_allowed_txn_types && ${kindTypes}::text[])
         AND (${query.direction ?? null}::text IS NULL OR r.srm_direction IN (${query.direction ?? null}::text, 'BOTH'))
       ORDER BY r.srm_sort_order, r.srm_code
    `;
        return rows.map(toRow);
    }
    async list(companyId, includeInactive = false) {
        const rows = await this.prisma.$queryRaw `
      SELECT r.srm_id, r.srm_company_id, r.srm_code, r.srm_name, r.srm_direction, r.srm_allowed_txn_types,
             r.srm_require_remarks, r.srm_gl_ledger_id, l.led_name, r.srm_sort_order, r.srm_remarks, r.srm_is_active,
             (r.srm_company_id IS NULL AND EXISTS (
                SELECT 1 FROM stock.stock_reason_master o
                 WHERE o.srm_company_id = ${companyId}::uuid AND o.srm_code = r.srm_code AND o.srm_is_deleted = false))
                                                                                                    AS is_overridden,
             (SELECT count(*) FROM stock.stock_ledger sml WHERE sml.sml_reason_id = r.srm_id)
           + (SELECT count(*) FROM stock.stock_voucher svh WHERE svh.svh_reason_id = r.srm_id)
           + (SELECT count(*) FROM stock.stock_voucher_item svi WHERE svi.svi_reason_id = r.srm_id)  AS usage_count
        FROM stock.stock_reason_master r
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = r.srm_gl_ledger_id
       WHERE r.srm_is_deleted = false
         AND (r.srm_company_id IS NULL OR r.srm_company_id = ${companyId}::uuid)
         AND (${includeInactive}::boolean OR r.srm_is_active = true)
       ORDER BY r.srm_sort_order, r.srm_code, (r.srm_company_id IS NULL)
    `;
        return rows.map((r) => ({
            ...toRow(r),
            isOverridden: r.is_overridden,
            usageCount: Number(r.usage_count),
            canDelete: Number(r.usage_count) === 0 && r.srm_company_id !== null,
        }));
    }
    async getOne(companyId, srmId) {
        const rows = await this.list(companyId, true);
        const row = rows.find((r) => r.srmId === srmId);
        if (!row) {
            (0, module_service_utils_1.throwStockNotFound)('Stock reason not found', 'srmId', `No stock reason ${srmId} visible to this company.`);
        }
        return row;
    }
    async usage(companyId, srmId) {
        await this.getOne(companyId, srmId);
        const [row] = await this.prisma.$queryRaw `
      SELECT (SELECT count(*) FROM stock.stock_ledger WHERE sml_reason_id = ${srmId}::uuid)           AS ledger_rows,
             (SELECT count(*) FROM stock.stock_voucher WHERE svh_reason_id = ${srmId}::uuid)          AS headers,
             (SELECT count(*) FROM stock.stock_voucher_item WHERE svi_reason_id = ${srmId}::uuid)     AS lines,
             GREATEST((SELECT max(sml_posted_on) FROM stock.stock_ledger WHERE sml_reason_id = ${srmId}::uuid),
                      (SELECT max(svh_created_on) FROM stock.stock_voucher WHERE svh_reason_id = ${srmId}::uuid),
                      (SELECT max(svi_created_on) FROM stock.stock_voucher_item WHERE svi_reason_id = ${srmId}::uuid)) AS last_used
    `;
        return {
            srmId,
            ledgerRows: Number(row?.ledger_rows ?? 0),
            voucherHeaders: Number(row?.headers ?? 0),
            voucherLines: Number(row?.lines ?? 0),
            lastUsedOn: row?.last_used ? row.last_used.toISOString() : null,
        };
    }
    async save(dto) {
        const actor = (0, module_service_utils_1.resolveActor)(dto.userId, this.requestContextService.getUserId());
        const author = actor === module_service_utils_2.DEFAULT_ACTOR ? null : actor;
        const now = new Date();
        const code = dto.code.trim().toUpperCase();
        const allowed = [...new Set((dto.allowedTxnTypes ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean))];
        if (dto.glLedgerId) {
            const [ledger] = await this.prisma.$queryRaw `
        SELECT led_id FROM accounts.acc_ledger_master
         WHERE led_id = ${dto.glLedgerId}::uuid AND led_is_deleted = false
      `;
            if (!ledger) {
                (0, module_service_utils_1.throwStockUnprocessable)('Stock reason cannot be saved', [
                    { field: 'glLedgerId', message: `No ledger ${dto.glLedgerId}.` },
                ]);
            }
        }
        if (dto.srmId) {
            const [existing] = await this.prisma.$queryRaw `
        SELECT r.srm_company_id, r.srm_code,
               (SELECT count(*) FROM stock.stock_ledger sml WHERE sml.sml_reason_id = r.srm_id) AS cited
          FROM stock.stock_reason_master r
         WHERE r.srm_id = ${dto.srmId}::uuid AND r.srm_is_deleted = false
      `;
            if (!existing) {
                (0, module_service_utils_1.throwStockNotFound)('Stock reason not found', 'srmId', `No stock reason ${dto.srmId}.`);
            }
            if (existing.srm_company_id === null) {
                (0, module_service_utils_1.throwStockConflict)('Shared reasons are read-only', [
                    { field: 'srmId', message: `${existing.srm_code} is shared with every company. To change it for this company, create the company's own row with the same code; it then hides the shared one.` },
                ]);
            }
            if (existing.srm_company_id !== dto.companyId) {
                (0, module_service_utils_1.throwStockNotFound)('Stock reason not found', 'srmId', `No stock reason ${dto.srmId} for this company.`);
            }
            if (existing.srm_code !== code && Number(existing.cited) > 0) {
                (0, module_service_utils_1.throwStockConflict)('Code is immutable once used', [
                    { field: 'code', message: `${existing.srm_code} is cited by ${Number(existing.cited)} ledger rows; its code cannot change. Deactivate it and create another.` },
                ]);
            }
            await this.assertCodeFree(dto.companyId, code, dto.srmId);
            await this.prisma.$executeRaw `
        UPDATE stock.stock_reason_master
           SET srm_code = ${code}, srm_name = ${dto.name.trim()}, srm_direction = ${dto.direction},
               srm_allowed_txn_types = ${allowed}::text[], srm_require_remarks = ${dto.requireRemarks ?? false},
               srm_gl_ledger_id = ${dto.glLedgerId ?? null}::uuid, srm_sort_order = ${dto.sortOrder ?? 0},
               srm_remarks = ${dto.remarks ?? null}, srm_is_active = ${dto.isActive ?? true},
               srm_modified_on = ${now}, srm_modified_by = ${author}
         WHERE srm_id = ${dto.srmId}::uuid
      `;
            return this.getOne(dto.companyId, dto.srmId);
        }
        await this.assertCodeFree(dto.companyId, code, null);
        const [created] = await this.prisma.$queryRaw `
      INSERT INTO stock.stock_reason_master (
        srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types, srm_require_remarks,
        srm_gl_ledger_id, srm_sort_order, srm_remarks, srm_is_active, srm_created_on, srm_created_by)
      VALUES (
        ${dto.companyId}::uuid, ${code}, ${dto.name.trim()}, ${dto.direction}, ${allowed}::text[], ${dto.requireRemarks ?? false},
        ${dto.glLedgerId ?? null}::uuid, ${dto.sortOrder ?? 0}, ${dto.remarks ?? null}, ${dto.isActive ?? true}, ${now}, ${author})
      RETURNING srm_id
    `;
        return this.getOne(dto.companyId, created.srm_id);
    }
    async deactivate(dto) {
        const actor = (0, module_service_utils_1.resolveActor)(dto.userId, this.requestContextService.getUserId());
        const author = actor === module_service_utils_2.DEFAULT_ACTOR ? null : actor;
        const row = await this.getOne(dto.companyId, dto.srmId);
        if (row.isShared) {
            (0, module_service_utils_1.throwStockConflict)('Shared reasons are read-only', [
                { field: 'srmId', message: `${row.code} is shared with every company and cannot be deactivated here. Create the company's own inactive row with the same code to hide it.` },
            ]);
        }
        const now = new Date();
        if (dto.reactivate) {
            await this.prisma.$executeRaw `
        UPDATE stock.stock_reason_master SET srm_is_active = true, srm_modified_on = ${now}, srm_modified_by = ${author}
         WHERE srm_id = ${dto.srmId}::uuid
      `;
            return this.getOne(dto.companyId, dto.srmId);
        }
        if (row.canDelete) {
            await this.prisma.$executeRaw `
        UPDATE stock.stock_reason_master SET srm_is_deleted = true, srm_is_active = false, srm_modified_on = ${now}, srm_modified_by = ${author}
         WHERE srm_id = ${dto.srmId}::uuid
      `;
            return { srmId: dto.srmId, deleted: true };
        }
        await this.prisma.$executeRaw `
      UPDATE stock.stock_reason_master SET srm_is_active = false, srm_modified_on = ${now}, srm_modified_by = ${author}
       WHERE srm_id = ${dto.srmId}::uuid
    `;
        return this.getOne(dto.companyId, dto.srmId);
    }
    async assertCodeFree(companyId, code, exceptId) {
        const [clash] = await this.prisma.$queryRaw `
      SELECT srm_id FROM stock.stock_reason_master
       WHERE srm_company_id = ${companyId}::uuid AND srm_code = ${code} AND srm_is_deleted = false
         AND (${exceptId}::uuid IS NULL OR srm_id <> ${exceptId}::uuid)
    `;
        if (clash) {
            (0, module_service_utils_1.throwStockConflict)('Code already in use', [
                { field: 'code', message: `This company already has a reason coded ${code}.` },
            ]);
        }
    }
};
exports.StockReasonsService = StockReasonsService;
exports.StockReasonsService = StockReasonsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], StockReasonsService);
function toRow(r) {
    return {
        srmId: r.srm_id,
        companyId: r.srm_company_id,
        isShared: r.srm_company_id === null,
        code: r.srm_code,
        name: r.srm_name,
        direction: r.srm_direction,
        allowedTxnTypes: r.srm_allowed_txn_types ?? [],
        requireRemarks: r.srm_require_remarks,
        glLedgerId: r.srm_gl_ledger_id,
        glLedgerName: r.led_name,
        sortOrder: r.srm_sort_order,
        remarks: r.srm_remarks,
        isActive: r.srm_is_active,
    };
}
//# sourceMappingURL=stock-reasons.service.js.map