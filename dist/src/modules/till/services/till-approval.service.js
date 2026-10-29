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
exports.TillApprovalService = void 0;
exports.ruleOfRequest = ruleOfRequest;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const secret_hash_utils_1 = require("../../../common/utils/secret-hash.utils");
const user_administration_enum_1 = require("../../settings/userAdministration/types/user-administration.enum");
const till_context_service_1 = require("../till-context.service");
const till_errors_1 = require("../till-errors");
const till_enum_1 = require("../types/till-enum");
const till_event_service_1 = require("./till-event.service");
const SELF_REFUSALS = {
    FORCE_CLOSE: 'A cashier cannot force-close their own session: close it the normal way, or a supervisor force-closes it',
    SESSION_REOPEN: 'A cashier cannot reopen their own session: a supervisor reopens it',
    DAY_REOPEN: 'Whoever closed the business day cannot reopen it: another approver does',
    DAY_CLOSE_EXCEPTION: 'Whoever closes the business day cannot also approve its exception: name another approver',
    SAFE_VARIANCE: 'Whoever counted the safe does not decide its difference: the rule allows no self-approval',
};
function selfRefusalOf(event) {
    return (SELF_REFUSALS[event] ??
        'The cashier of a session does not decide its own variance: the rule allows no self-approval');
}
const FALLBACK_RULE = (event) => ({
    tar_id: null,
    tar_event_code: event,
    tar_mode: 'ALWAYS',
    tar_threshold_amount: new client_1.Prisma.Decimal(0),
    tar_threshold_count: 0,
    tar_channel: 'EITHER',
    tar_min_role: 'SUPERVISOR',
    tar_two_person: false,
    tar_allow_self: false,
    tar_blocks_till: true,
    tar_expire_minutes: 0,
});
let TillApprovalService = class TillApprovalService {
    context;
    events;
    constructor(context, events) {
        this.context = context;
        this.events = events;
    }
    async ruleFor(client, scope) {
        const [row] = await client.$queryRaw `
      SELECT tar_id, tar_event_code, tar_mode, tar_threshold_amount, tar_threshold_count, tar_channel,
             tar_min_role, tar_two_person, tar_allow_self, tar_blocks_till, tar_expire_minutes
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
        return rule ? needOf(rule, scope.amount) : null;
    }
    async assessGate(client, ask) {
        const rule = await this.ruleFor(client, ask);
        const need = rule ? needOf(rule, ask.amount, ask.count) : null;
        if (!rule || !need) {
            return { state: 'NONE' };
        }
        const settings = await this.context.settings({
            companyId: ask.companyId,
            branchId: ask.branchId,
            deviceId: ask.deviceId,
            userId: ask.requesterId,
        });
        const refuse = settings.approvalGate === 'REFUSE' && rule.tar_blocks_till;
        if (ask.approvalId) {
            const tap = await this.approvedFor(client, ask, need);
            return {
                state: 'APPROVED',
                need: { ...need, enforced: refuse, approvalId: tap.tapId },
                rule,
                tapId: tap.tapId,
            };
        }
        return refuse
            ? { state: 'REFUSE', need: { ...need, enforced: true }, rule }
            : { state: 'WARN', need, rule };
    }
    async settleGate(tx, ask, verdict) {
        if (verdict.state === 'APPROVED') {
            const [row] = await tx.$queryRaw `
        SELECT tap_rule_snapshot ->> 'usedOn' AS used FROM accounts.till_approval
         WHERE tap_id = ${verdict.tapId}::uuid AND tap_status = 'APPROVED' AND NOT tap_is_deleted
         FOR UPDATE`;
            if (!row || row.used) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_INVALID, `Approval ${verdict.tapId} has already been used`, ask.field, { event: ask.event });
            }
            await tx.$executeRaw `
        UPDATE accounts.till_approval
           SET tap_rule_snapshot = COALESCE(tap_rule_snapshot, '{}'::jsonb)
                 || jsonb_build_object('usedOn', now(), 'usedBy', ${ask.requesterId}::text,
                                       'usedDocType', ${ask.srcDocType}::text, 'usedDocId', ${ask.srcDocId}::text),
               tap_session_id = COALESCE(tap_session_id, ${ask.sessionId}::uuid),
               tap_modified_on = now()
         WHERE tap_id = ${verdict.tapId}::uuid`;
            return verdict.tapId;
        }
        if (verdict.state !== 'WARN') {
            return null;
        }
        const open = await tx.tillApproval.findFirst({
            where: {
                tapCompanyId: ask.companyId,
                tapBranchId: ask.branchId,
                tapEventCode: ask.event,
                tapSrcDocType: ask.srcDocType,
                tapSrcDocId: ask.srcDocId,
                tapStatus: 'PENDING',
                tapIsDeleted: false,
            },
            select: { tapId: true },
        });
        if (open) {
            return open.tapId;
        }
        return this.fileRequest(tx, {
            ...ask,
            rule: verdict.rule,
            reasonId: null,
            note: null,
            payload: { ...(ask.payload ?? {}), filedBy: 'gate', after: true },
        });
    }
    throwApprovalRequired(need, ask) {
        (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_REQUIRED, `${ask.event} of ${need.amount.toFixed(2)} needs an approval at ${need.minRole} or above: ` +
            'ask for one (/till/approvals/request) and bring its approvalId', ask.field, {
            event: ask.event,
            amount: need.amount,
            requiredRole: need.minRole,
            channel: need.channel,
            twoPerson: need.twoPerson,
            srcDocType: ask.srcDocType,
            srcDocId: ask.srcDocId,
        });
    }
    async fileRequest(tx, input) {
        const now = new Date();
        const expire = input.rule.tar_expire_minutes ?? 0;
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
                tapAmount: input.amount.toDecimalPlaces(2),
                tapCountInSession: countInSession,
                tapRuleId: input.rule.tar_id,
                tapRuleSnapshot: {
                    ...snapshotOf(input.rule),
                    ...(input.payload ?? {}),
                },
                tapRequiredRole: input.rule.tar_min_role,
                tapTwoPerson: input.rule.tar_two_person,
                tapSelfAllowed: input.selfAllowed ?? input.rule.tar_allow_self,
                tapChannel: input.rule.tar_channel === 'COUNTER' ? 'COUNTER' : 'REMOTE',
                tapRequestedBy: input.requesterId,
                tapRequestedOn: now,
                tapReasonId: input.reasonId,
                tapRequestNote: input.note,
                tapStatus: 'PENDING',
                tapExpiresOn: expire > 0 ? new Date(now.getTime() + expire * 60_000) : null,
                tapDeviceId: input.deviceId,
            },
            select: { tapId: true },
        });
        await this.events.log(tx, {
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: input.accYear,
            code: till_enum_1.TillEventCode.APPROVAL_REQUESTED,
            sessionId: input.sessionId,
            counterId: input.counterId,
            deviceId: input.deviceId,
            userId: input.requesterId,
            srcDocType: input.srcDocType,
            srcDocId: input.srcDocId,
            srcRefno: input.srcRefno,
            amount: input.amount,
            reasonId: input.reasonId,
            approvalId: row.tapId,
            payload: {
                event: input.event,
                requiredRole: input.rule.tar_min_role,
                channel: input.rule.tar_channel,
                ...(input.payload ?? {}),
            },
        });
        return row.tapId;
    }
    async approvedFor(client, ask, need) {
        const refuse = (message, extra = {}) => (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_INVALID, message, ask.field, {
            event: ask.event,
            ...extra,
        });
        const tap = await client.tillApproval.findFirst({
            where: {
                tapId: ask.approvalId,
                tapCompanyId: ask.companyId,
                tapBranchId: ask.branchId,
                tapIsDeleted: false,
            },
        });
        if (!tap) {
            return refuse(`Approval ${ask.approvalId} is not one of this branch`);
        }
        if (tap.tapStatus !== 'APPROVED') {
            return refuse(tap.tapStatus === 'PENDING'
                ? `Approval ${tap.tapId} still waits for an approver`
                : `Approval ${tap.tapId} is ${tap.tapStatus}`, { status: tap.tapStatus });
        }
        if (tap.tapEventCode !== ask.event) {
            return refuse(`Approval ${tap.tapId} is for ${tap.tapEventCode}, not ${ask.event}`);
        }
        if (tap.tapSrcDocType !== ask.srcDocType || tap.tapSrcDocId !== ask.srcDocId) {
            return refuse(`Approval ${tap.tapId} approves ${tap.tapSrcDocType ?? 'nothing'} ${tap.tapSrcRefno ?? tap.tapSrcDocId ?? ''}, not this one`.trim());
        }
        const amount = new client_1.Prisma.Decimal(need.amount);
        if (new client_1.Prisma.Decimal(tap.tapAmount).lessThan(amount)) {
            return refuse(`Approval ${tap.tapId} approves up to ${new client_1.Prisma.Decimal(tap.tapAmount).toFixed(2)}; this is ${amount.toFixed(2)}`, { amount: need.amount, maxAmount: Number(new client_1.Prisma.Decimal(tap.tapAmount).toFixed(2)) });
        }
        const snapshot = (tap.tapRuleSnapshot ?? {});
        if (snapshot.usedOn) {
            return refuse(`Approval ${tap.tapId} has already been used`);
        }
        return tap;
    }
    async assertApprover(client, ask) {
        const { rule, event } = ask;
        if (ask.approverId === ask.requesterId && !rule.tar_allow_self && !ask.selfExempt) {
            (0, till_errors_1.throwTill)(event === 'FORCE_CLOSE' ? till_enum_1.TillErrorCode.FORCE_CLOSE_SELF : till_enum_1.TillErrorCode.APPROVER_SELF, selfRefusalOf(event), 'userId', { event, requiredRole: rule.tar_min_role });
        }
        const second = rule.tar_two_person ? this.assertSecond(ask) : null;
        const user = await client.userMaster.findUnique({
            where: { usrId: ask.approverId },
            select: { usrLoginName: true, usrPinHash: true },
        });
        const { login, grants: held } = await this.grantsOf(client, {
            userId: ask.approverId,
            companyId: ask.companyId,
            branchId: ask.branchId,
        });
        const grants = held.filter((g) => g.event === null || g.event === event);
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
            if (!user?.usrPinHash) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_NO_PIN, `${login} has no till PIN: an administrator sets one in User Administration (menu 58)`, 'approverPin', { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' });
            }
            if (pin === null) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_PIN, rule.tar_channel === 'COUNTER'
                    ? `The ${event} rule is decided at the counter: type the approver's till PIN`
                    : `${login} has no remote authority for ${event}: type the till PIN`, 'approverPin', { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' });
            }
            if (!(await (0, secret_hash_utils_1.verifySecret)(pin, user?.usrPinHash ?? null))) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_PIN, 'The till PIN is wrong', 'approverPin', {
                    event,
                    requiredRole: rule.tar_min_role,
                    channel: 'COUNTER',
                });
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
            secondBy: second,
        };
    }
    async grantsOf(client, scope) {
        const user = await client.userMaster.findUnique({
            where: { usrId: scope.userId },
            select: { usrLoginName: true, usrType: true, usrIsActive: true },
        });
        const grants = user?.usrIsActive && user.usrType === user_administration_enum_1.UserType.SUPER_ADMIN
            ? [
                {
                    id: null,
                    role: 'HO_FINANCE',
                    maxAmount: null,
                    canRemote: true,
                    implicit: true,
                    event: null,
                },
            ]
            : [];
        const rows = await client.$queryRaw `
      SELECT taa_id, taa_role, taa_max_amount, taa_can_remote, taa_event_code
        FROM accounts.till_approval_authority
       WHERE taa_user_id = ${scope.userId}::uuid
         AND taa_is_active AND NOT taa_is_deleted
         AND (taa_company_id IS NULL OR taa_company_id = ${scope.companyId}::uuid)
         AND (taa_branch_id  IS NULL OR taa_branch_id  = ${scope.branchId}::uuid)
         AND taa_valid_from <= current_date
         AND (taa_valid_to IS NULL OR taa_valid_to >= current_date)`;
        grants.push(...rows.map((r) => ({
            id: r.taa_id,
            role: r.taa_role,
            maxAmount: r.taa_max_amount === null ? null : new client_1.Prisma.Decimal(r.taa_max_amount),
            canRemote: r.taa_can_remote,
            implicit: false,
            event: r.taa_event_code,
        })));
        return { userId: scope.userId, login: user?.usrLoginName ?? scope.userId, grants };
    }
    standing(held, ask) {
        if (!ask.selfAllowed && ask.requesterId === held.userId) {
            return till_enum_1.TillErrorCode.APPROVER_SELF;
        }
        const minRank = (0, till_enum_1.approverRoleRank)(ask.minRole);
        const atLevel = held.grants.filter((g) => (g.event === null || g.event === ask.event) && (0, till_enum_1.approverRoleRank)(g.role) >= minRank);
        if (atLevel.length === 0) {
            return till_enum_1.TillErrorCode.APPROVER_NO_GRANT;
        }
        const amount = ask.amount.toDecimalPlaces(2);
        return atLevel.some((g) => g.maxAmount === null || g.maxAmount.gte(amount))
            ? null
            : till_enum_1.TillErrorCode.APPROVER_LIMIT;
    }
    assertSecond(ask) {
        const { rule, event } = ask;
        if (ask.second === undefined) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_NO_GRANT, `The ${event} rule asks for two approvers; the two-person gate is Part B of the approvals work`, 'decision', { event, requiredRole: rule.tar_min_role, twoPerson: true });
        }
        if (ask.second === null) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_SECOND, `The ${event} rule asks for two people: a second person signs with their till PIN`, 'secondId', { event, requiredRole: rule.tar_min_role, twoPerson: true });
        }
        const by = ask.second.userId;
        if (by === ask.approverId || by === ask.requesterId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_SECOND, by === ask.approverId
                ? 'The second signature is another person than the one deciding'
                : 'The second signature is another person than the one who raised it', 'secondId', { event, requiredRole: rule.tar_min_role, twoPerson: true });
        }
        return by;
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
            ...snapshotOf(input.rule),
            approver: {
                role: input.verdict.role,
                grantId: input.verdict.grantId,
                implicit: input.verdict.implicit,
                secondBy: input.verdict.secondBy,
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
                tapTwoPerson: input.rule.tar_two_person && input.verdict.secondBy !== null,
                tapSelfAllowed: input.selfAllowed ?? input.rule.tar_allow_self,
                tapChannel: input.verdict.channel,
                tapRequestedBy: input.requestedBy,
                tapRequestedOn: input.requestedOn,
                tapReasonId: input.reasonId,
                tapStatus: input.status,
                tapDecidedBy: input.decidedBy,
                tapDecidedOn: input.decidedOn,
                tapDecidedDeviceId: input.decidedDeviceId,
                tapDecisionNote: input.decisionNote,
                tapSecondBy: input.verdict.secondBy,
                tapSecondOn: input.verdict.secondBy ? (input.secondOn ?? input.decidedOn) : null,
                tapDeviceId: input.decidedDeviceId,
            },
            select: { tapId: true },
        });
        return row.tapId;
    }
};
exports.TillApprovalService = TillApprovalService;
exports.TillApprovalService = TillApprovalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_context_service_1.TillContextService,
        till_event_service_1.TillEventService])
], TillApprovalService);
function needOf(rule, amount, count) {
    const threshold = new client_1.Prisma.Decimal(rule.tar_threshold_amount);
    const thresholdCount = rule.tar_threshold_count ?? 0;
    const needed = rule.tar_mode === 'ALWAYS' ||
        (rule.tar_mode === 'OVER_AMOUNT' && amount.greaterThan(threshold)) ||
        (rule.tar_mode === 'OVER_COUNT' && count !== undefined && count > thresholdCount);
    if (!needed) {
        return null;
    }
    const need = {
        event: rule.tar_event_code,
        ruleId: rule.tar_id,
        mode: rule.tar_mode,
        threshold: Number(threshold.toFixed(2)),
        thresholdCount,
        count: count ?? null,
        amount: Number(amount.toFixed(2)),
        minRole: rule.tar_min_role,
        channel: rule.tar_channel,
        twoPerson: rule.tar_two_person,
        blocksTill: rule.tar_blocks_till,
        enforced: false,
    };
    return need;
}
function snapshotOf(rule) {
    return {
        ruleId: rule.tar_id,
        mode: rule.tar_mode,
        threshold: Number(new client_1.Prisma.Decimal(rule.tar_threshold_amount).toFixed(2)),
        thresholdCount: rule.tar_threshold_count ?? 0,
        channel: rule.tar_channel,
        minRole: rule.tar_min_role,
        allowSelf: rule.tar_allow_self,
        twoPerson: rule.tar_two_person,
        blocksTill: rule.tar_blocks_till,
        expireMinutes: rule.tar_expire_minutes ?? 0,
    };
}
function ruleOfRequest(tap) {
    const s = (tap.tapRuleSnapshot ?? {});
    return {
        tar_id: tap.tapRuleId,
        tar_event_code: tap.tapEventCode,
        tar_mode: typeof s.mode === 'string' ? s.mode : 'ALWAYS',
        tar_threshold_amount: new client_1.Prisma.Decimal(typeof s.threshold === 'number' ? s.threshold : 0),
        tar_threshold_count: typeof s.thresholdCount === 'number' ? s.thresholdCount : 0,
        tar_channel: typeof s.channel === 'string' ? s.channel : tap.tapChannel,
        tar_min_role: tap.tapRequiredRole,
        tar_two_person: tap.tapTwoPerson,
        tar_allow_self: tap.tapSelfAllowed,
        tar_blocks_till: s.blocksTill !== false,
        tar_expire_minutes: typeof s.expireMinutes === 'number' ? s.expireMinutes : 0,
    };
}
//# sourceMappingURL=till-approval.service.js.map