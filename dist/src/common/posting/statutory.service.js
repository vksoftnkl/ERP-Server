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
exports.StatutoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const statutory_types_1 = require("./statutory.types");
let StatutoryService = class StatutoryService {
    prisma;
    cache = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async limit(companyId, code, onDate, appliesTo = 'ALL', aatoClass = null, tx) {
        const key = `${code}|${companyId}|${onDate}|${appliesTo}|${aatoClass ?? ''}`;
        if (this.cache.has(key)) {
            return this.cache.get(key) ?? null;
        }
        const client = tx ?? this.prisma;
        const rows = await client.$queryRaw `
      SELECT s.stl_id, s.stl_code, s.stl_section, s.stl_label, s.stl_value_type,
             s.stl_value, s.stl_value_text, s.stl_enforce,
             s.stl_effective_from, s.stl_effective_to, s.stl_source_ref,
             (s.stl_company_id IS NOT NULL) AS is_company_override
        FROM public.statutory_limits s
       WHERE s.stl_code = ${code}
         AND s.stl_is_deleted = false
         AND s.stl_is_active = true
         AND (s.stl_company_id IS NULL OR s.stl_company_id = ${companyId}::uuid)
         AND (s.stl_applies_to = 'ALL' OR s.stl_applies_to = ${appliesTo})
         AND (s.stl_aato_class IS NULL OR s.stl_aato_class = ${aatoClass})
         AND s.stl_effective_from <= ${onDate}::date
         AND (s.stl_effective_to IS NULL OR s.stl_effective_to >= ${onDate}::date)
       -- This precedence IS the rule. Do not reorder.
       ORDER BY (s.stl_company_id IS NOT NULL) DESC,
                (s.stl_applies_to <> 'ALL')    DESC,
                (s.stl_aato_class IS NOT NULL) DESC,
                s.stl_effective_from           DESC
       LIMIT 1`;
        const resolved = rows.length === 0 ? null : this.toLimit(rows[0]);
        this.cache.set(key, resolved);
        return resolved;
    }
    async aatoClass(companyId, tx) {
        const client = tx ?? this.prisma;
        const rows = await client.$queryRaw `
      SELECT comp_aato_class FROM public.companys WHERE comp_id = ${companyId}::uuid`;
        return rows[0]?.comp_aato_class ?? null;
    }
    async assertCashLimit(companyId, cashAmount, onDate, tx) {
        const limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.CASH_TXN_LIMIT_269ST, onDate, 'ALL', null, tx);
        if (!limit || limit.value === null) {
            return { limit, exceeded: false };
        }
        return { limit, exceeded: cashAmount >= limit.value };
    }
    async assertPanOrForm60(companyId, cashAmount, onDate, tx) {
        const limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.PAN_REQUIRED_CASH_SALE, onDate, 'ALL', null, tx);
        if (!limit || limit.value === null) {
            return { limit, required: false };
        }
        return { limit, required: cashAmount > limit.value };
    }
    async ewayApplicable(companyId, consignmentValue, onDate, opts, tx) {
        const direction = opts.interState ? 'INTER_STATE' : 'INTRA_STATE';
        let limit = null;
        if (!opts.interState && opts.stateCode) {
            limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.EWAY_VALUE_LIMIT, onDate, opts.stateCode, null, tx);
        }
        if (!limit) {
            limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.EWAY_VALUE_LIMIT, onDate, direction, null, tx);
        }
        if (!limit || limit.value === null) {
            return { limit, applicable: false };
        }
        return { limit, applicable: consignmentValue > limit.value };
    }
    async einvoiceApplicable(companyId, onDate, opts, tx) {
        const limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.EINV_AATO_THRESHOLD, onDate, 'ALL', null, tx);
        const byLaw = !!limit && limit.value !== null && opts.aatoAmount !== null && opts.aatoAmount > limit.value;
        return { limit, applicable: opts.companyFlag || byLaw, byLaw };
    }
    async hsnDigits(companyId, onDate, tx) {
        const aato = await this.aatoClass(companyId, tx);
        const limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.HSN_DIGITS, onDate, 'ALL', aato, tx);
        const digits = limit?.valueText ? Number.parseInt(limit.valueText, 10) : null;
        return { limit, digits: Number.isNaN(digits) ? null : digits };
    }
    async withinCancelWindow(companyId, kind, generatedOn, onDate, now = new Date(), tx) {
        const code = kind === 'IRN' ? statutory_types_1.STATUTORY_CODES.EINV_CANCEL_HOURS : statutory_types_1.STATUTORY_CODES.EWAY_CANCEL_HOURS;
        const limit = await this.limit(companyId, code, onDate, 'ALL', null, tx);
        const hoursElapsed = (now.getTime() - generatedOn.getTime()) / 3_600_000;
        if (!limit || limit.value === null) {
            return { limit, within: true, hoursElapsed };
        }
        return { limit, within: hoursElapsed <= limit.value, hoursElapsed };
    }
    async creditNoteCutoff(companyId, billDate, onDate, tx) {
        const limit = await this.limit(companyId, statutory_types_1.STATUTORY_CODES.CREDIT_NOTE_CUTOFF, onDate, 'ALL', null, tx);
        if (!limit?.valueText) {
            return { limit, cutoff: null, passed: false };
        }
        const bill = new Date(`${billDate}T00:00:00Z`);
        const fyStartYear = bill.getUTCMonth() + 1 >= 4 ? bill.getUTCFullYear() : bill.getUTCFullYear() - 1;
        const cutoff = `${fyStartYear + 1}-${limit.valueText}`;
        return { limit, cutoff, passed: onDate > cutoff };
    }
    toLimit(row) {
        return {
            id: row.stl_id,
            code: row.stl_code,
            section: row.stl_section,
            label: row.stl_label,
            valueType: row.stl_value_type,
            value: row.stl_value === null ? null : Number(row.stl_value),
            valueText: row.stl_value_text,
            enforce: row.stl_enforce,
            effectiveFrom: toDateString(row.stl_effective_from),
            effectiveTo: row.stl_effective_to === null ? null : toDateString(row.stl_effective_to),
            sourceRef: row.stl_source_ref,
            isCompanyOverride: row.is_company_override,
        };
    }
};
exports.StatutoryService = StatutoryService;
exports.StatutoryService = StatutoryService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.REQUEST }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatutoryService);
function toDateString(d) {
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=statutory.service.js.map