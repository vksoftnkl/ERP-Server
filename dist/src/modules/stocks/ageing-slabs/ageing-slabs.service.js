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
exports.AgeingSlabsService = exports.AGEING_SLAB_MAX = void 0;
exports.ladderErrors = ladderErrors;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_error_codes_1 = require("../types/stock-error-codes");
exports.AGEING_SLAB_MAX = 20;
function ladderErrors(slabs) {
    const errors = [];
    if (slabs.length < 1 || slabs.length > exports.AGEING_SLAB_MAX) {
        errors.push({
            field: 'slabs',
            code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_COUNT,
            message: `A ladder has 1 to ${exports.AGEING_SLAB_MAX} slabs; this one has ${slabs.length}.`,
        });
        return errors;
    }
    const labels = new Map();
    slabs.forEach((slab, i) => {
        const at = `slabs.${i}`;
        if (slab.slabNo !== i + 1) {
            errors.push({
                field: `${at}.slabNo`,
                code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_NUMBER,
                message: `Slab ${i + 1} is numbered ${slab.slabNo}; slabs are numbered 1 to ${slabs.length} in order.`,
            });
        }
        const label = slab.label.trim();
        if (!label) {
            errors.push({ field: `${at}.label`, code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_LABEL, message: `Slab ${i + 1} needs a label.` });
        }
        else {
            const folded = label.toUpperCase();
            const first = labels.get(folded);
            if (first !== undefined) {
                errors.push({
                    field: `${at}.label`,
                    code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_LABEL,
                    message: `Slab ${i + 1}'s label "${label}" is slab ${first + 1}'s too; labels are unique.`,
                });
            }
            else {
                labels.set(folded, i);
            }
        }
        if (i === 0) {
            if (slab.fromDays !== 0) {
                errors.push({
                    field: `${at}.fromDays`,
                    code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_FIRST_NOT_ZERO,
                    message: `The first slab starts at day 0, not ${slab.fromDays}: stock received today is 0 days old.`,
                });
            }
        }
        else {
            const prevTo = slabs[i - 1].toDays;
            if (prevTo !== null && prevTo !== undefined && slab.fromDays !== prevTo + 1) {
                const gap = slab.fromDays > prevTo + 1;
                errors.push({
                    field: `${at}.fromDays`,
                    code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_NOT_CONTIGUOUS,
                    message: gap
                        ? `Slab ${i + 1} starts at day ${slab.fromDays}, leaving days ${prevTo + 1}–${slab.fromDays - 1} in no slab; it starts at ${prevTo + 1}, the day after slab ${i} ends.`
                        : `Slab ${i + 1} starts at day ${slab.fromDays}, inside slab ${i} (which ends at ${prevTo}); it starts at ${prevTo + 1}.`,
                });
            }
        }
        const last = i === slabs.length - 1;
        const toDays = slab.toDays ?? null;
        if (toDays === null) {
            if (!last) {
                errors.push({
                    field: `${at}.toDays`,
                    code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_OPEN_END,
                    message: `Slab ${i + 1} is open-ended but is not the last; only the last slab has no end day.`,
                });
            }
        }
        else if (last) {
            errors.push({
                field: `${at}.toDays`,
                code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_OPEN_END,
                message: `The last slab ends at day ${toDays}; it must be open-ended (no end day), or stock older than ${toDays} days falls in no slab.`,
            });
        }
        else if (toDays < slab.fromDays) {
            errors.push({
                field: `${at}.toDays`,
                code: stock_error_codes_1.StockErrorCode.AGEING_SLAB_TO_BEFORE_FROM,
                message: `Slab ${i + 1} ends at day ${toDays}, before it starts (day ${slab.fromDays}).`,
            });
        }
    });
    return errors;
}
let AgeingSlabsService = class AgeingSlabsService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async get(companyId) {
        const rows = await this.prisma.$queryRaw `
      WITH own AS (
        SELECT 1 FROM stock.stock_ageing_slab
         WHERE sag_company_id = ${companyId}::uuid AND sag_is_active AND NOT sag_is_deleted
         LIMIT 1
      )
      SELECT (s.sag_company_id IS NOT NULL) AS own, s.sag_slab_no, s.sag_label, s.sag_from_days, s.sag_to_days
        FROM stock.stock_ageing_slab s
       WHERE s.sag_is_active AND NOT s.sag_is_deleted
         AND CASE WHEN EXISTS (SELECT 1 FROM own)
                  THEN s.sag_company_id = ${companyId}::uuid
                  ELSE s.sag_company_id IS NULL END
       ORDER BY s.sag_slab_no
    `;
        return {
            usingOwn: rows.length > 0 && rows[0].own,
            slabs: rows.map((r) => ({
                slabNo: r.sag_slab_no,
                label: r.sag_label,
                fromDays: r.sag_from_days,
                toDays: r.sag_to_days,
            })),
        };
    }
    async save(dto) {
        const errors = ladderErrors(dto.slabs);
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('Ageing slabs cannot be saved', errors);
        }
        const author = this.author();
        const now = new Date();
        const slabs = dto.slabs.map((s) => ({ ...s, label: s.label.trim(), toDays: s.toDays ?? null }));
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT count(pg_advisory_xact_lock(hashtext('stock.stock_ageing_slab'), hashtext(${dto.companyId})))::int AS locked
      `;
            await tx.$executeRaw `SET CONSTRAINTS stock.ex_sag_overlap DEFERRED`;
            await tx.$executeRaw `
        UPDATE stock.stock_ageing_slab
           SET sag_is_deleted = true, sag_is_active = false, sag_modified_on = ${now}, sag_modified_by = ${author}
         WHERE sag_company_id = ${dto.companyId}::uuid AND NOT sag_is_deleted
      `;
            await tx.stockAgeingSlab.createMany({
                data: slabs.map((s) => ({
                    sagCompanyId: dto.companyId,
                    sagSlabNo: s.slabNo,
                    sagLabel: s.label,
                    sagFromDays: s.fromDays,
                    sagToDays: s.toDays,
                    sagCreatedOn: now,
                    sagCreatedBy: author,
                })),
            });
        });
        return this.get(dto.companyId);
    }
    async revert(companyId) {
        const author = this.author();
        await this.prisma.$executeRaw `
      UPDATE stock.stock_ageing_slab
         SET sag_is_deleted = true, sag_is_active = false, sag_modified_on = ${new Date()}, sag_modified_by = ${author}
       WHERE sag_company_id = ${companyId}::uuid AND NOT sag_is_deleted
    `;
        return this.get(companyId);
    }
    author() {
        const actor = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
        return actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor;
    }
};
exports.AgeingSlabsService = AgeingSlabsService;
exports.AgeingSlabsService = AgeingSlabsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], AgeingSlabsService);
//# sourceMappingURL=ageing-slabs.service.js.map