"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TillApprovalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const secret_hash_utils_1 = require("../../../common/utils/secret-hash.utils");
const user_administration_enum_1 = require("../../settings/userAdministration/types/user-administration.enum");
const till_errors_1 = require("../till-errors");
const till_enum_1 = require("../types/till-enum");
const FALLBACK_RULE = (event) => ({
    tar_id: null,
    tar_event_code: event,
    tar_mode: 'ALWAYS',
    tar_threshold_amount: new client_1.Prisma.Decimal(0),
    tar_channel: 'EITHER',
    tar_min_role: 'SUPERVISOR',
    tar_two_person: false,
    tar_allow_self: false,
    tar_blocks_till: true,
});
let TillApprovalService = class TillApprovalService {
    async ruleFor(client, scope) {
        const [row] = await client.$queryRaw `
      SELECT tar_id, tar_event_code, tar_mode, tar_threshold_amount, tar_channel, tar_min_role,
             tar_two_person, tar_allow_self, tar_blocks_till
        FROM accounts.till_approval_rule
       WHERE tar_event_code = ${scope.event}
         AND tar_is_active AND NOT tar_is_deleted
         AND (tar_company_id IS NULL OR tar_company_id = ${scope.companyId}::uuid)
         AND (tar_branch_id  IS NULL OR tar_branch_id  = ${scope.branchId}::uuid)
         AND tar_effective_from <= ${scope.onDate}::date
       ORDER BY (tar_branch_id IS NOT NULL) DESC,
                (tar_company_id IS NOT NULL) DESC,
                tar_effective_from DESC
       LIMIT 1`;
        return row ?? null;
    }
    async ruleOrDefault(client, scope) {
        return (await this.ruleFor(client, scope)) ?? FALLBACK_RULE(scope.event);
    }
    async assess(client, scope) {
        const rule = await this.ruleFor(client, scope);
        if (!rule) {
            return null;
        }
        const threshold = new client_1.Prisma.Decimal(rule.tar_threshold_amount);
        const needed = rule.tar_mode === 'ALWAYS' ||
            (rule.tar_mode === 'OVER_AMOUNT' && scope.amount.greaterThan(threshold));
        if (!needed) {
            return null;
        }
        return {
            event: rule.tar_event_code,
            ruleId: rule.tar_id,
            mode: rule.tar_mode,
            threshold: Number(threshold.toFixed(2)),
            amount: Number(scope.amount.toFixed(2)),
            minRole: rule.tar_min_role,
            channel: rule.tar_channel,
            twoPerson: rule.tar_two_person,
            blocksTill: rule.tar_blocks_till,
            enforced: false,
        };
    }
    async assertApprover(client, ask) {
        const { rule, event } = ask;
        if (ask.approverId === ask.requesterId && !rule.tar_allow_self) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_SELF, 'The cashier of a session does not decide its own variance: the rule allows no self-approval', 'userId', { event, requiredRole: rule.tar_min_role });
        }
        if (rule.tar_two_person) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_NO_GRANT, `The ${event} rule asks for two approvers; the two-person gate is Part B of the approvals work`, 'decision', { event, requiredRole: rule.tar_min_role, twoPerson: true });
        }
        const user = await client.userMaster.findUnique({
            where: { usrId: ask.approverId },
            select: { usrLoginName: true, usrType: true, usrPinHash: true, usrIsActive: true },
        });
        const login = user?.usrLoginName ?? ask.approverId;
        const grants = user?.usrIsActive && user.usrType === user_administration_enum_1.UserType.SUPER_ADMIN
            ? [{ id: null, role: 'HO_FINANCE', maxAmount: null, canRemote: true, implicit: true }]
            : [];
        const rows = await client.$queryRaw `
      SELECT taa_id, taa_role, taa_max_amount, taa_can_remote
        FROM accounts.till_approval_authority
       WHERE taa_user_id = ${ask.approverId}::uuid
         AND taa_is_active AND NOT taa_is_deleted
         AND (taa_company_id IS NULL OR taa_company_id = ${ask.companyId}::uuid)
         AND (taa_branch_id  IS NULL OR taa_branch_id  = ${ask.branchId}::uuid)
         AND (taa_event_code IS NULL OR taa_event_code = ${event})
         AND taa_valid_from <= current_date
         AND (taa_valid_to IS NULL OR taa_valid_to >= current_date)`;
        grants.push(...rows.map((r) => ({
            id: r.taa_id,
            role: r.taa_role,
            maxAmount: r.taa_max_amount === null ? null : new client_1.Prisma.Decimal(r.taa_max_amount),
            canRemote: r.taa_can_remote,
            implicit: false,
        })));
        const minRank = (0, till_enum_1.approverRoleRank)(rule.tar_min_role);
        const atLevel = grants.filter((g) => (0, till_enum_1.approverRoleRank)(g.role) >= minRank);
        if (atLevel.length === 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_NO_GRANT, `${login} holds no approval authority for ${event} at ${rule.tar_min_role} or above in this branch (Till Approval Authority, menu 285)`, 'userId', { event, requiredRole: rule.tar_min_role });
        }
        const amount = new client_1.Prisma.Decimal(ask.amount.toFixed(2));
        const covering = atLevel.filter((g) => g.maxAmount === null || g.maxAmount.gte(amount));
        if (covering.length === 0) {
            const ceiling = atLevel.reduce((max, g) => (g.maxAmount && g.maxAmount.gt(max) ? g.maxAmount : max), new client_1.Prisma.Decimal(0));
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_LIMIT, `${login}'s authority for ${event} stops at ${ceiling.toFixed(2)}; this one is ${amount.toFixed(2)}`, 'userId', {
                event,
                requiredRole: rule.tar_min_role,
                amount: Number(amount.toFixed(2)),
                maxAmount: Number(ceiling.toFixed(2)),
            });
        }
        const pin = ask.pin?.trim() || null;
        const remoteOk = covering.some((g) => g.canRemote);
        let channel;
        if (rule.tar_channel === 'REMOTE') {
            if (!remoteOk) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_NO_GRANT, `The ${event} rule is decided remotely, and ${login}'s authority is not a remote one (taa_can_remote)`, 'userId', { event, requiredRole: rule.tar_min_role, channel: 'REMOTE' });
            }
            channel = 'REMOTE';
        }
        else if (rule.tar_channel === 'COUNTER' || pin !== null || !remoteOk) {
            if (pin === null) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_PIN, rule.tar_channel === 'COUNTER'
                    ? `The ${event} rule is decided at the counter: type the approver's till PIN`
                    : `${login} has no remote authority for ${event}: type the till PIN`, 'approverPin', { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' });
            }
            if (!(await (0, secret_hash_utils_1.verifySecret)(pin, user?.usrPinHash ?? null))) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_PIN, user?.usrPinHash
                    ? 'The till PIN is wrong'
                    : `${login} has no till PIN (User Administration, notes 95)`, 'approverPin', { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' });
            }
            channel = 'COUNTER';
        }
        else {
            channel = 'REMOTE';
        }
        const usable = channel === 'REMOTE' ? covering.filter((g) => g.canRemote) : covering;
        const grant = usable.reduce((best, g) => (0, till_enum_1.approverRoleRank)(g.role) > (0, till_enum_1.approverRoleRank)(best.role) ? g : best);
        return {
            role: grant.role,
            channel,
            grantId: grant.id,
            implicit: grant.implicit,
        };
    }
    async record(tx, input) {
        const countInSession = input.sessionId
            ? await tx.tillApproval.count({
                where: {
                    tapSessionId: input.sessionId,
                    tapAccYear: input.accYear,
                    tapEventCode: input.event,
                    tapIsDeleted: false,
                },
            })
            : 0;
        const snapshot = {
            ruleId: input.rule.tar_id,
            mode: input.rule.tar_mode,
            threshold: Number(input.rule.tar_threshold_amount.toFixed(2)),
            channel: input.rule.tar_channel,
            minRole: input.rule.tar_min_role,
            allowSelf: input.rule.tar_allow_self,
            twoPerson: input.rule.tar_two_person,
            blocksTill: input.rule.tar_blocks_till,
            approver: {
                role: input.verdict.role,
                grantId: input.verdict.grantId,
                implicit: input.verdict.implicit,
            },
            ...(input.payload ?? {}),
        };
        const row = await tx.tillApproval.create({
            data: {
                tapCompanyId: input.companyId,
                tapBranchId: input.branchId,
                tapTenantId: input.tenantId,
                tapAccYear: input.accYear,
                tapEventCode: input.event,
                tapSessionId: input.sessionId,
                tapCounterId: input.counterId,
                tapSrcDocType: input.srcDocType,
                tapSrcDocId: input.srcDocId,
                tapSrcRefno: input.srcRefno,
                tapAmount: input.amount,
                tapCountInSession: countInSession,
                tapRuleId: input.rule.tar_id,
                tapRuleSnapshot: snapshot,
                tapRequiredRole: input.rule.tar_min_role,
                tapTwoPerson: false,
                tapSelfAllowed: input.rule.tar_allow_self,
                tapChannel: input.verdict.channel,
                tapRequestedBy: input.requestedBy,
                tapRequestedOn: input.requestedOn,
                tapReasonId: input.reasonId,
                tapStatus: input.status,
                tapDecidedBy: input.decidedBy,
                tapDecidedOn: input.decidedOn,
                tapDecidedDeviceId: input.decidedDeviceId,
                tapDecisionNote: input.decisionNote,
                tapDeviceId: input.decidedDeviceId,
            },
            select: { tapId: true },
        });
        return row.tapId;
    }
};
exports.TillApprovalService = TillApprovalService;
exports.TillApprovalService = TillApprovalService = __decorate([
    (0, common_1.Injectable)()
], TillApprovalService);
//# sourceMappingURL=till-approval.service.js.map