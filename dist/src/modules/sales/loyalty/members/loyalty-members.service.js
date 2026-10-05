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
exports.LoyaltyMembersService = exports.LOYALTY_MEMBER_ERROR = exports.LOYALTY_STATUS_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const rights_1 = require("../../../../common/posting/rights");
const request_context_service_1 = require("../../../../common/request-context/request-context.service");
const txn_status_log_helper_1 = require("../../../../common/txn-status-log/txn-status-log.helper");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
const loyalty_ledger_service_1 = require("../../posting/loyalty-ledger.service");
exports.LOYALTY_STATUS_MENU_ID = 79;
const CODE_PREFIX = 'LST';
exports.LOYALTY_MEMBER_ERROR = {
    NOT_FOUND: 'LOYALTY_MEMBER_NOT_FOUND',
    MERGED: 'LOYALTY_MEMBER_MERGED',
    NO_CHANGE: 'LOYALTY_MEMBER_NO_CHANGE',
    HAS_BALANCE: 'LOYALTY_MEMBER_HAS_BALANCE',
    REASON_REQUIRED: 'LOYALTY_MEMBER_REASON_REQUIRED',
    APPROVER_REQUIRED: 'LOYALTY_MEMBER_APPROVER_REQUIRED',
    YEAR_UNKNOWN: 'LOYALTY_MEMBER_YEAR_UNKNOWN',
    BRANCH_NOT_IN_COMPANY: 'LOYALTY_MEMBER_BRANCH_NOT_IN_COMPANY',
};
let LoyaltyMembersService = class LoyaltyMembersService {
    prisma;
    requestContext;
    ledger;
    constructor(prisma, requestContext, ledger) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.ledger = ledger;
    }
    async setStatus(dto) {
        await this.assertRight('edit', 'change a loyalty member’s status');
        if (dto.force) {
            await this.assertRight('delete', 'close a wallet that still holds points');
        }
        if (dto.status !== 'ACTIVE' && !dto.reason) {
            refuse(exports.LOYALTY_MEMBER_ERROR.REASON_REQUIRED, 'reason', `${dto.status} needs a reason.`);
        }
        if (dto.branchId) {
            await this.assertBranch(dto.companyId, dto.branchId);
        }
        const userId = this.requestContext.getUserId();
        const actorName = await this.actorName(userId);
        return this.prisma.$transaction(async (tx) => {
            const m = await this.lockMember(tx, dto.companyId, dto.memberId);
            if (m.lmb_status === 'MERGED') {
                (0, module_service_utils_1.throwUnprocessable)('Loyalty member is merged', [
                    detail(exports.LOYALTY_MEMBER_ERROR.MERGED, 'memberId', 'A merged wallet keeps its status.'),
                ]);
            }
            if (m.lmb_status === dto.status) {
                (0, module_service_utils_1.throwUnprocessable)('No change', [
                    detail(exports.LOYALTY_MEMBER_ERROR.NO_CHANGE, 'status', `The member is already ${dto.status}.`),
                ]);
            }
            const branchId = dto.branchId ?? m.lmb_branch_id ?? (await this.fallbackBranch(tx, dto.companyId));
            const today = await this.today(tx);
            const accYear = await this.yearOf(tx, dto.companyId, today);
            let drained = null;
            const balance = Number(m.lmb_balance_points ?? 0);
            if (dto.status === 'CLOSED' && balance !== 0) {
                if (!dto.force) {
                    (0, module_service_utils_1.throwUnprocessable)('Loyalty member still holds points', [
                        detail(exports.LOYALTY_MEMBER_ERROR.HAS_BALANCE, 'status', `The wallet holds ${balance} points. Send force (with approvedBy) to write them off and close.`),
                    ]);
                }
                if (!dto.approvedBy) {
                    refuse(exports.LOYALTY_MEMBER_ERROR.APPROVER_REQUIRED, 'approvedBy', 'A forced close writes the points off and needs an approver.');
                }
                drained = await this.ledger.drain(tx, {
                    companyId: dto.companyId,
                    branchId,
                    memberId: dto.memberId,
                    txnDate: today,
                    accYear,
                    reason: `Closed: ${dto.reason}`,
                    approvedBy: dto.approvedBy,
                    userId,
                    deviceId: this.requestContext.getDeviceId(),
                    createdBy: actorName,
                });
            }
            await tx.$executeRaw `
        UPDATE sales.loyalty_member
           SET lmb_status       = ${dto.status},
               lmb_block_reason = ${dto.status === 'ACTIVE' ? null : (dto.reason ?? null)},
               lmb_is_active    = ${dto.status === 'ACTIVE'},
               lmb_modified_on  = now(),
               lmb_modified_by  = ${actorName}
         WHERE lmb_id = ${dto.memberId}::uuid`;
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: dto.companyId,
                branchId,
                accYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.SALES,
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.OTHER,
                srcDocId: dto.memberId,
                srcDocRefno: m.lmb_card_no ?? m.lmb_mobile ?? null,
                event: dto.status === 'CLOSED'
                    ? txn_status_log_helper_1.TxnStatusEvent.CLOSED
                    : dto.status === 'ACTIVE'
                        ? txn_status_log_helper_1.TxnStatusEvent.REOPENED
                        : txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED,
                fromStatus: m.lmb_status,
                toStatus: dto.status,
                changedBy: userId ?? '',
                remarks: dto.reason ?? null,
                deviceId: this.requestContext.getDeviceId(),
            });
            return {
                memberId: dto.memberId,
                fromStatus: m.lmb_status,
                toStatus: dto.status,
                balance: drained ? drained.balance : balance,
                drained,
            };
        });
    }
    async adjust(dto) {
        await this.assertRight('edit', 'adjust loyalty points');
        if (!(dto.points !== 0 && Number.isFinite(dto.points))) {
            refuse('SALES_LOYALTY_CAP', 'points', 'points must be a non-zero number.');
        }
        await this.assertBranch(dto.companyId, dto.branchId);
        const userId = this.requestContext.getUserId();
        const actorName = await this.actorName(userId);
        return this.prisma.$transaction(async (tx) => {
            const txnDate = dto.txnDate ?? (await this.today(tx));
            const accYear = await this.yearOf(tx, dto.companyId, txnDate);
            return this.ledger.adjust(tx, {
                companyId: dto.companyId,
                branchId: dto.branchId,
                memberId: dto.memberId,
                points: dto.points,
                txnDate,
                accYear,
                reason: dto.reason,
                approvedBy: dto.approvedBy,
                expiresOn: dto.expiresOn ?? null,
                lscId: dto.lscId ?? null,
                userId,
                deviceId: this.requestContext.getDeviceId(),
                createdBy: actorName,
            });
        });
    }
    async history(q) {
        await this.assertRight('view', 'view the Loyalty Status');
        const [m] = await this.prisma.$queryRaw `
      SELECT true AS ok FROM sales.loyalty_member
       WHERE lmb_id = ${q.memberId}::uuid AND lmb_comp_id = ${q.companyId}::uuid
         AND lmb_is_deleted = false`;
        if (!m) {
            (0, module_service_utils_1.throwNotFound)('Loyalty member not found', 'memberId', `No live member ${q.memberId} in this company`);
        }
        const rows = await this.prisma.$queryRaw `
      SELECT t.tsl_seq_no, t.tsl_event, t.tsl_from_status, t.tsl_to_status, t.tsl_changed_on,
             t.tsl_changed_by, u.usr_display_name, t.tsl_remarks
        FROM public.txn_status_log t
        LEFT JOIN public.user_master u ON u.usr_id = t.tsl_changed_by
       WHERE t.tsl_company_id  = ${q.companyId}::uuid
         AND t.tsl_src_doc_type = ${txn_status_log_helper_1.TxnStatusDocType.OTHER}
         AND t.tsl_src_doc_id   = ${q.memberId}::uuid
       ORDER BY t.tsl_changed_on, t.tsl_seq_no`;
        return {
            memberId: q.memberId,
            steps: rows.map((r) => ({
                seqNo: r.tsl_seq_no,
                event: r.tsl_event,
                fromStatus: r.tsl_from_status,
                toStatus: r.tsl_to_status,
                changedOn: r.tsl_changed_on,
                changedBy: r.tsl_changed_by,
                changedByName: r.usr_display_name,
                remarks: r.tsl_remarks,
            })),
        };
    }
    async assertRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: exports.LOYALTY_STATUS_MENU_ID,
            right,
            codePrefix: CODE_PREFIX,
            action,
        });
    }
    async lockMember(tx, companyId, memberId) {
        const rows = await tx.$queryRaw `
      SELECT lmb_comp_id, lmb_branch_id, lmb_cust_id, lmb_card_no, lmb_mobile, lmb_status,
             lmb_balance_points, lmb_is_deleted
        FROM sales.loyalty_member
       WHERE lmb_id = ${memberId}::uuid
         FOR UPDATE`;
        const m = rows[0];
        if (!m || m.lmb_is_deleted || m.lmb_comp_id !== companyId) {
            (0, module_service_utils_1.throwNotFound)('Loyalty member not found', 'memberId', `No live member ${memberId} in this company`);
        }
        return m;
    }
    async assertBranch(companyId, branchId) {
        const [br] = await this.prisma.$queryRaw `
      SELECT br_comp_id FROM public.branch_master WHERE br_id = ${branchId}::uuid`;
        if (!br || br.br_comp_id !== companyId) {
            refuse(exports.LOYALTY_MEMBER_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'This branch does not belong to the company.');
        }
    }
    async fallbackBranch(tx, companyId) {
        const session = this.requestContext.getBranchId();
        if (session) {
            return session;
        }
        const [br] = await tx.$queryRaw `
      SELECT br_id FROM public.branch_master
       WHERE br_comp_id = ${companyId}::uuid AND br_is_deleted = false
       ORDER BY br_is_default DESC, br_created_on
       LIMIT 1`;
        if (!br) {
            refuse(exports.LOYALTY_MEMBER_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'The company has no branch.');
        }
        return br.br_id;
    }
    async today(tx) {
        const [row] = await tx.$queryRaw `SELECT CURRENT_DATE::text AS d`;
        return row.d;
    }
    async yearOf(tx, companyId, date) {
        const [fy] = await tx.$queryRaw `
      SELECT fy_year_name FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND ${date}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_year_name DESC
       LIMIT 1`;
        if (!fy) {
            refuse(exports.LOYALTY_MEMBER_ERROR.YEAR_UNKNOWN, 'txnDate', `No fiscal year holds ${date} for this company.`);
        }
        return fy.fy_year_name;
    }
    async actorName(userId) {
        if (!userId) {
            return 'SYSTEM';
        }
        const [u] = await this.prisma.$queryRaw `
      SELECT usr_login_name FROM public.user_master WHERE usr_id = ${userId}::uuid`;
        return u?.usr_login_name ?? 'SYSTEM';
    }
};
exports.LoyaltyMembersService = LoyaltyMembersService;
exports.LoyaltyMembersService = LoyaltyMembersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        loyalty_ledger_service_1.LoyaltyLedgerService])
], LoyaltyMembersService);
function detail(code, field, message) {
    return { field, message, code };
}
function refuse(code, field, message) {
    (0, module_service_utils_1.throwBadRequest)('Loyalty member request refused', [detail(code, field, message)]);
}
//# sourceMappingURL=loyalty-members.service.js.map