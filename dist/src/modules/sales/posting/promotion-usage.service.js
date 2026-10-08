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
exports.PromotionUsageService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const posting_types_1 = require("./types/posting.types");
const sales_errors_1 = require("./sales.errors");
let PromotionUsageService = class PromotionUsageService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(tx, doc, applied) {
        const rows = applied.filter((a) => a.benefitAmt !== 0 || a.freeQty !== 0);
        if (rows.length === 0) {
            return 0;
        }
        const values = rows.map((a) => client_1.Prisma.sql `(
        ${doc.accYear}::char(9), ${doc.companyId}::uuid, ${doc.branchId ?? null}::uuid,
        ${a.schemeId}::uuid, ${doc.custId ?? null}::uuid,
        ${a.schemeCode ?? null}, ${a.schemeName ?? null}, ${a.benefit ?? null},
        ${doc.srcModule ?? 'SALES'}, ${doc.docType}, ${doc.docId}::uuid,
        ${doc.accYear}::char(9), ${doc.docRefno ?? null}, ${doc.docDate}::date,
        ${money(a.baseAmount)}::numeric, ${money(a.baseQty, 4)}::numeric,
        ${money(Math.abs(a.benefitAmt))}::numeric, ${money(Math.abs(a.freeQty), 4)}::numeric,
        ${a.lineCount}::int, ${a.couponId ?? null}::uuid,
        false, ${doc.userId ?? null}::uuid, ${doc.deviceId ?? null}::uuid,
        ${a.remarks ?? null}, ${doc.createdBy ?? 'SYSTEM'}
      )`);
        const written = await tx.$executeRaw `
      INSERT INTO sales.promotion_usage (
        pru_acc_year, pru_comp_id, pru_branch_id,
        pru_prm_id, pru_cust_id,
        pru_scheme_code, pru_scheme_name, pru_benefit,
        pru_src_module, pru_src_doc_type, pru_src_doc_id,
        pru_src_acc_year, pru_src_doc_refno, pru_doc_date,
        pru_base_amount, pru_base_qty,
        pru_benefit_amt, pru_free_qty,
        pru_line_count, pru_coupon_id,
        pru_is_reversal, pru_user_id, pru_device_id,
        pru_remarks, pru_created_by
      )
      VALUES ${client_1.Prisma.join(values)}
      -- A re-push of the same document is the ordinary case offline, and it
      -- must be a no-op rather than a second tally against the campaign.
      ON CONFLICT DO NOTHING`;
        return written;
    }
    async reverse(tx, doc, reason, createdBy = 'SYSTEM') {
        return tx.$executeRaw `
      INSERT INTO sales.promotion_usage (
        pru_acc_year, pru_comp_id, pru_branch_id,
        pru_prm_id, pru_cust_id,
        pru_scheme_code, pru_scheme_name, pru_benefit,
        pru_src_module, pru_src_doc_type, pru_src_doc_id,
        pru_src_acc_year, pru_src_doc_refno, pru_doc_date,
        pru_base_amount, pru_base_qty,
        pru_benefit_amt, pru_free_qty,
        pru_line_count, pru_coupon_id,
        pru_is_reversal, pru_reversal_of_id, pru_reversal_of_acc_year,
        pru_reversal_reason, pru_user_id, pru_device_id, pru_created_by
      )
      SELECT o.pru_acc_year, o.pru_comp_id, o.pru_branch_id,
             o.pru_prm_id, o.pru_cust_id,
             o.pru_scheme_code, o.pru_scheme_name, o.pru_benefit,
             o.pru_src_module, o.pru_src_doc_type, o.pru_src_doc_id,
             o.pru_src_acc_year, o.pru_src_doc_refno, o.pru_doc_date,
             o.pru_base_amount, o.pru_base_qty,
             -o.pru_benefit_amt, -o.pru_free_qty,
             o.pru_line_count, o.pru_coupon_id,
             true, o.pru_id, o.pru_acc_year,
             ${reason}, o.pru_user_id, o.pru_device_id, ${createdBy}
        FROM sales.promotion_usage o
       WHERE o.pru_src_doc_id = ${doc.docId}::uuid
         AND o.pru_acc_year   = ${doc.accYear}::char(9)
         AND o.pru_is_reversal = false
         AND o.pru_is_deleted  = false
      ON CONFLICT DO NOTHING`;
    }
    async validateApplied(tx, doc, schemeIds, opts = {}) {
        const ids = [...new Set(schemeIds)].filter(Boolean);
        if (ids.length === 0) {
            return [];
        }
        const live = await tx.$queryRaw `
      SELECT s.prm_id
        FROM sales.promotion_scheme s
       WHERE s.prm_id = ANY(${ids}::uuid[])
         AND s.prm_comp_id    = ${doc.companyId}::uuid
         AND s.prm_is_deleted = false
         AND s.prm_is_active  = true
         AND s.prm_status     = 'APPROVED'
         AND (s.prm_start_date IS NULL OR s.prm_start_date <= ${doc.docDate}::date)
         AND (s.prm_end_date   IS NULL OR s.prm_end_date   >= ${doc.docDate}::date)
         AND (s.prm_bill_type = 'ALL' OR s.prm_bill_type = ${doc.billType ?? 'ALL'})
         AND (s.prm_branch_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.promotion_scheme_branch b
                WHERE b.prb_prm_id     = s.prm_id
                  AND b.prb_branch_id  = ${doc.branchId ?? null}::uuid
                  AND b.prb_is_exclude = false
                  AND b.prb_is_deleted = false))
         AND NOT EXISTS (
               SELECT 1 FROM sales.promotion_scheme_branch b
                WHERE b.prb_prm_id     = s.prm_id
                  AND b.prb_branch_id  = ${doc.branchId ?? null}::uuid
                  AND b.prb_is_exclude = true
                  AND b.prb_is_deleted = false)
         AND (s.prm_cust_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.promotion_scheme_party p
                WHERE p.prp_prm_id     = s.prm_id
                  AND p.prp_is_exclude = false
                  AND p.prp_is_deleted = false
                  AND (p.prp_cust_id = ${doc.custId ?? null}::uuid
                    OR p.prp_cust_group_id = ${doc.custGroupId ?? null}::uuid)))
         AND NOT EXISTS (
               SELECT 1 FROM sales.promotion_scheme_party p
                WHERE p.prp_prm_id     = s.prm_id
                  AND p.prp_is_exclude = true
                  AND p.prp_is_deleted = false
                  AND (p.prp_cust_id = ${doc.custId ?? null}::uuid
                    OR p.prp_cust_group_id = ${doc.custGroupId ?? null}::uuid))`;
        const liveIds = new Set(live.map((r) => r.prm_id));
        const dead = ids.filter((id) => !liveIds.has(id));
        if (dead.length > 0 && opts.throwOnFirst !== false) {
            (0, sales_errors_1.throwSalesRefused)(`Scheme ${dead[0]} is not live for this document`, posting_types_1.SALES_ERROR_CODES.PROMO_NOT_LIVE, 'schemeId');
        }
        return dead.map((schemeId) => ({
            code: posting_types_1.SALES_ERROR_CODES.PROMO_NOT_LIVE,
            message: `Scheme ${schemeId} is not live for this document`,
            schemeId,
        }));
    }
    async caps(tx, schemeId, custId) {
        const [scheme] = await tx.$queryRaw `
      SELECT prm_max_uses_total, prm_max_uses_per_cust, prm_budget_amount
        FROM sales.promotion_scheme WHERE prm_id = ${schemeId}::uuid`;
        const [used] = await tx.$queryRaw `
      SELECT COUNT(*) FILTER (WHERE pru_is_reversal = false)                      AS uses,
             COUNT(*) FILTER (WHERE pru_is_reversal = false
                                AND pru_cust_id = ${custId}::uuid)                AS cust_uses,
             SUM(pru_benefit_amt)                                                 AS given
        FROM sales.promotion_usage
       WHERE pru_prm_id    = ${schemeId}::uuid
         AND pru_is_deleted = false`;
        const maxUses = scheme?.prm_max_uses_total ?? 0;
        const maxPerCust = scheme?.prm_max_uses_per_cust ?? 0;
        const budget = Number(scheme?.prm_budget_amount ?? 0);
        return {
            schemeId,
            uses: Number(used?.uses ?? 0),
            custUses: Number(used?.cust_uses ?? 0),
            given: Number(used?.given ?? 0),
            maxUses,
            maxPerCust,
            budget,
            usesExceeded: maxUses > 0 && Number(used?.uses ?? 0) >= maxUses,
            custUsesExceeded: maxPerCust > 0 && Number(used?.cust_uses ?? 0) >= maxPerCust,
            budgetExceeded: budget > 0 && Number(used?.given ?? 0) >= budget,
        };
    }
};
exports.PromotionUsageService = PromotionUsageService;
exports.PromotionUsageService = PromotionUsageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PromotionUsageService);
function money(value, decimals = 2) {
    const f = Math.pow(10, decimals);
    return (Math.round(value * f) / f).toFixed(decimals);
}
//# sourceMappingURL=promotion-usage.service.js.map