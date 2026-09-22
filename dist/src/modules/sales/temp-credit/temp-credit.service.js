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
exports.TempCreditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
let TempCreditService = class TempCreditService {
    prisma;
    requestContext;
    audit;
    constructor(prisma, requestContext, audit) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.audit = audit;
    }
    async open(q) {
        const statuses = (q.status ?? 'OPEN,PARTIAL')
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        const search = q.search?.trim() ? `%${q.search.trim()}%` : null;
        const today = (0, sales_doc_utils_1.isoToday)();
        const rows = await this.prisma.$queryRaw `
      SELECT t.atc_id, t.atc_acc_year, t.atc_party_id, l.led_name, t.atc_src_doc_id, t.atc_bill_refno, t.atc_bill_date, t.atc_bill_amount,
             t.atc_name, t.atc_mobile, t.atc_place, t.atc_days, t.atc_due_date, t.atc_credit_amount, t.atc_balance_amount, t.atc_status,
             t.atc_promise_date, t.atc_followup_on, t.atc_remarks, t.atc_branch_id
        FROM accounts.acc_temp_credit t
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = t.atc_party_id
       WHERE t.atc_company_id = ${q.companyId}::uuid AND t.atc_is_deleted = false
         AND (${q.branchId ?? null}::uuid IS NULL OR t.atc_branch_id = ${q.branchId ?? null}::uuid)
         AND t.atc_status = ANY(${statuses}::text[])
         AND (${search}::text IS NULL OR t.atc_name ILIKE ${search} OR t.atc_mobile ILIKE ${search} OR t.atc_bill_refno ILIKE ${search})
         AND (${q.overdueOnly ?? false}::boolean = false OR (t.atc_due_date < ${today}::date AND t.atc_balance_amount > 0))
       ORDER BY t.atc_due_date, t.atc_created_on`;
        return rows.map((r) => ({
            atcId: r.atc_id,
            atcAccYear: r.atc_acc_year.trim(),
            partyId: r.atc_party_id,
            partyName: r.led_name,
            billId: r.atc_src_doc_id,
            billRefno: r.atc_bill_refno,
            billDate: (0, sales_doc_utils_1.isoDate)(r.atc_bill_date),
            billAmount: (0, sales_doc_utils_1.num)(r.atc_bill_amount),
            name: r.atc_name,
            mobile: r.atc_mobile,
            place: r.atc_place,
            days: r.atc_days,
            dueDate: (0, sales_doc_utils_1.isoDate)(r.atc_due_date),
            creditAmount: (0, sales_doc_utils_1.num)(r.atc_credit_amount),
            balance: (0, sales_doc_utils_1.num)(r.atc_balance_amount),
            status: r.atc_status,
            daysOverdue: (0, sales_doc_utils_1.num)(r.atc_balance_amount) > 0
                ? Math.max(0, (0, sales_doc_utils_1.daysBetween)((0, sales_doc_utils_1.isoDate)(r.atc_due_date), today))
                : 0,
            promiseDate: (0, sales_doc_utils_1.isoDate)(r.atc_promise_date),
            followupOn: r.atc_followup_on?.toISOString() ?? null,
            remarks: r.atc_remarks,
            branchId: r.atc_branch_id,
        }));
    }
    async followUp(dto) {
        const userId = this.requestContext.getUserId();
        const now = new Date();
        const row = await this.prisma.accTempCredit.findFirst({
            where: { atcId: dto.atcId, atcAccYear: dto.atcAccYear, atcIsDeleted: false },
        });
        if (!row) {
            (0, module_service_utils_1.throwSalesNotFound)('Temporary credit not found', 'atcId', `No temporary credit found with id ${dto.atcId}`);
        }
        const updated = await this.prisma.accTempCredit.update({
            where: { atcId_atcAccYear: { atcId: dto.atcId, atcAccYear: dto.atcAccYear } },
            data: {
                atcPromiseDate: dto.promiseDate
                    ? new Date(`${dto.promiseDate}T00:00:00Z`)
                    : row.atcPromiseDate,
                atcFollowupOn: now,
                atcFollowupBy: isUuid(userId) ? userId : null,
                atcRemarks: dto.remarks,
                atcModifiedOn: now,
                atcModifiedBy: userId ?? 'SYSTEM',
            },
        });
        await this.audit.logEntityChange({
            action: 'update',
            tableName: 'acc_temp_credit',
            screenName: 'Temporary Credit',
            screenType: 'transaction',
            pk: dto.atcId,
            displayName: row.atcBillRefno ?? dto.atcId,
            originalRecord: { atcPromiseDate: (0, sales_doc_utils_1.isoDate)(row.atcPromiseDate), atcRemarks: row.atcRemarks },
            modifiedRecord: {
                atcPromiseDate: (0, sales_doc_utils_1.isoDate)(updated.atcPromiseDate),
                atcRemarks: updated.atcRemarks,
            },
            userId: userId ?? 'SYSTEM',
            notes: `Follow-up recorded: ${dto.remarks}`,
        });
        return {
            atcId: updated.atcId,
            promiseDate: (0, sales_doc_utils_1.isoDate)(updated.atcPromiseDate),
            followupOn: updated.atcFollowupOn?.toISOString() ?? null,
            remarks: updated.atcRemarks,
        };
    }
};
exports.TempCreditService = TempCreditService;
exports.TempCreditService = TempCreditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        audit_log_service_1.AuditLogService])
], TempCreditService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=temp-credit.service.js.map