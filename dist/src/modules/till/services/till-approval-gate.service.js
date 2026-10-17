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
exports.TillApprovalGateService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const secret_hash_utils_1 = require("../../../common/utils/secret-hash.utils");
const till_context_service_1 = require("../till-context.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
const till_enum_1 = require("../types/till-enum");
const till_approval_service_1 = require("./till-approval.service");
const till_event_service_1 = require("./till-event.service");
const num = (d) => d === null || d === undefined ? 0 : Number(new client_1.Prisma.Decimal(d).toFixed(2));
let TillApprovalGateService = class TillApprovalGateService {
    prisma;
    context;
    approval;
    events;
    constructor(prisma, context, approval, events) {
        this.prisma = prisma;
        this.context = context;
        this.approval = approval;
        this.events = events;
    }
    async request(input) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const onDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const amount = new client_1.Prisma.Decimal(input.amount).toDecimalPlaces(2);
        if (amount.isNegative()) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.AMOUNT_NEGATIVE, 'amount is 0 or more', 'amount');
        }
        if (!!input.srcDocType !== !!input.srcDocId) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.SOURCE_DOC_PAIR, 'srcDocType and srcDocId go together', 'srcDocId');
        }
        const session = input.sessionId
            ? await this.prisma.tillSession.findFirst({
                where: {
                    tssId: input.sessionId,
                    tssCompanyId: input.companyId,
                    tssBranchId: input.branchId,
                    tssIsDeleted: false,
                    ...(input.accYear ? { tssAccYear: input.accYear } : {}),
                },
            })
            : null;
        if (input.sessionId && !session) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'sessionId', input.sessionId);
        }
        const counterId = session?.tssCounterId ??
            (caller.deviceId
                ? ((await this.prisma.tillCounter.findFirst({
                    where: {
                        tcnCompanyId: input.companyId,
                        tcnBranchId: input.branchId,
                        tcnDeviceId: caller.deviceId,
                        tcnIsActive: true,
                        tcnIsDeleted: false,
                    },
                    select: { tcnId: true },
                }))?.tcnId ?? null)
                : null);
        const accYear = session?.tssAccYear ?? input.accYear ?? (0, till_dates_1.accYearOf)(onDate);
        const srcDocType = input.srcDocType ?? (session ? 'TILL_SESSION' : null);
        const srcDocId = input.srcDocId ?? session?.tssId ?? null;
        const srcRefno = input.srcRefno ?? session?.tssSessionNo ?? null;
        const rule = await this.approval.ruleOrDefault(this.prisma, {
            companyId: input.companyId,
            branchId: input.branchId,
            event: input.event,
            onDate,
        });
        const need = await this.approval.assess(this.prisma, {
            companyId: input.companyId,
            branchId: input.branchId,
            event: input.event,
            onDate,
            amount,
        });
        if (rule.tar_id !== null && !need) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_INVALID, `The ${input.event} rule asks no approval for ${amount.toFixed(2)} (${rule.tar_mode}${rule.tar_mode === 'OVER_AMOUNT' ? ` ${num(rule.tar_threshold_amount).toFixed(2)}` : ''}): go ahead`, 'event', { event: input.event, needed: false });
        }
        if (input.reasonId) {
            const reason = await this.prisma.tillReason.findFirst({
                where: {
                    trsId: input.reasonId,
                    trsIsDeleted: false,
                    trsIsActive: true,
                    OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
                },
                select: { trsId: true },
            });
            if (!reason) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, 'The reason is not an active till reason', 'reasonId');
            }
        }
        const approverId = input.approverId?.trim() || null;
        const inline = approverId
            ? await this.judge({
                scope: input,
                accYear,
                caller,
                event: input.event,
                amount,
                rule: approverId === caller.userId ? rule : { ...rule, tar_channel: 'COUNTER' },
                selfAllowed: rule.tar_allow_self || settings.singleOperator,
                approverId,
                requesterId: caller.userId,
                pin: input.approverPin ?? null,
                secondId: input.secondId ?? null,
                secondPin: input.secondPin ?? null,
                approve: true,
                action: 'approval-request',
            })
            : null;
        const tapId = await this.prisma.$transaction(async (tx) => {
            await (0, till_dates_1.assertTillPartitions)(tx, accYear, 'accYear');
            const open = srcDocId
                ? await tx.tillApproval.findFirst({
                    where: {
                        tapCompanyId: input.companyId,
                        tapBranchId: input.branchId,
                        tapEventCode: input.event,
                        tapSrcDocType: srcDocType,
                        tapSrcDocId: srcDocId,
                        tapRequestedBy: caller.userId,
                        tapStatus: 'PENDING',
                        tapIsDeleted: false,
                    },
                })
                : null;
            const id = open?.tapId ??
                (await this.approval.fileRequest(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    tenantId: input.tenantId ?? session?.tssTenantId ?? null,
                    accYear,
                    event: input.event,
                    rule,
                    amount,
                    requesterId: caller.userId,
                    deviceId: caller.deviceId,
                    sessionId: session?.tssId ?? null,
                    counterId,
                    srcDocType,
                    srcDocId,
                    srcRefno,
                    reasonId: input.reasonId ?? null,
                    note: input.note?.trim() || null,
                    selfAllowed: rule.tar_allow_self || settings.singleOperator,
                    payload: { filedBy: 'request' },
                }));
            if (inline) {
                const row = await this.lockRow(tx, { ...input, accYear: open?.tapAccYear ?? accYear, tapId: id });
                await this.decideIn(tx, row, {
                    decision: 'APPROVE',
                    note: input.note?.trim() || 'Approved at the counter',
                    caller: { ...caller, userId: approverId },
                    verdict: inline.verdict,
                    secondOn: inline.secondOn,
                });
            }
            return id;
        });
        return this.get({ companyId: input.companyId, branchId: input.branchId, accYear, tapId });
    }
    async decide(input) {
        const caller = await this.context.caller();
        if (!input.note?.trim()) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.NOTE_REQUIRED, 'A decision note is required', 'note');
        }
        const tap = await this.pendingRow(input);
        const approve = input.decision === 'APPROVE';
        const rule = (0, till_approval_service_1.ruleOfRequest)(tap);
        const judged = await this.judge({
            scope: input,
            accYear: tap.tapAccYear,
            caller,
            event: tap.tapEventCode,
            amount: new client_1.Prisma.Decimal(tap.tapAmount),
            rule: approve ? rule : { ...rule, tar_two_person: false },
            selfAllowed: tap.tapSelfAllowed,
            approverId: caller.userId,
            requesterId: tap.tapRequestedBy,
            pin: input.approverPin ?? null,
            secondId: input.secondId ?? null,
            secondPin: input.secondPin ?? null,
            approve,
            action: 'approval-decide',
        });
        await this.prisma.$transaction(async (tx) => {
            const row = await this.lockRow(tx, input);
            if (row.tapStatus !== 'PENDING') {
                this.throwNotPending(row);
            }
            await this.decideIn(tx, row, {
                decision: input.decision,
                note: input.note.trim(),
                caller,
                verdict: judged.verdict,
                secondOn: judged.secondOn,
            });
        });
        return this.get(input);
    }
    async cancel(input) {
        const caller = await this.context.caller();
        const tap = await this.pendingRow(input);
        if (tap.tapRequestedBy !== caller.userId) {
            const rights = await this.context.rights(till_enum_1.TILL_MENU.SESSIONS);
            if (!rights.override) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_NOT_YOURS, 'Only whoever asked for an approval cancels it (or a Till Sessions OVERRIDE holder)', 'tapId');
            }
        }
        await this.prisma.$transaction(async (tx) => {
            const row = await this.lockRow(tx, input);
            if (row.tapStatus !== 'PENDING') {
                this.throwNotPending(row);
            }
            const note = `Cancelled by ${caller.actorName}${input.note?.trim() ? `: ${input.note.trim()}` : ''}`;
            await tx.tillApproval.update({
                where: { tapId_tapAccYear: { tapId: row.tapId, tapAccYear: row.tapAccYear } },
                data: {
                    tapStatus: 'CANCELLED',
                    tapDecisionNote: note.slice(0, 500),
                    tapModifiedOn: new Date(),
                },
            });
            await this.logDecision(tx, row, caller, { status: 'CANCELLED', note });
        });
        return this.get(input);
    }
    async get(key) {
        const tap = await this.prisma.tillApproval.findFirst({
            where: {
                tapId: key.tapId,
                tapAccYear: key.accYear,
                tapCompanyId: key.companyId,
                tapBranchId: key.branchId,
                tapIsDeleted: false,
            },
        });
        if (!tap) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.APPROVAL_NOT_FOUND, 'Approval request', 'tapId', key.tapId);
        }
        const [session, counter, reason] = await Promise.all([
            tap.tapSessionId
                ? this.prisma.tillSession.findUnique({
                    where: { tssId_tssAccYear: { tssId: tap.tapSessionId, tssAccYear: tap.tapAccYear } },
                    select: { tssSessionNo: true },
                })
                : null,
            tap.tapCounterId
                ? this.prisma.tillCounter.findUnique({
                    where: { tcnId: tap.tapCounterId },
                    select: { tcnName: true },
                })
                : null,
            tap.tapReasonId
                ? this.prisma.tillReason.findUnique({
                    where: { trsId: tap.tapReasonId },
                    select: { trsName: true },
                })
                : null,
        ]);
        const names = await this.namesOf([tap.tapRequestedBy, tap.tapDecidedBy, tap.tapSecondBy]);
        const snapshot = (tap.tapRuleSnapshot ?? {});
        const status = tap.tapStatus;
        return {
            tapId: tap.tapId,
            tapAccYear: tap.tapAccYear,
            companyId: tap.tapCompanyId,
            branchId: tap.tapBranchId,
            event: tap.tapEventCode,
            status,
            amount: num(tap.tapAmount),
            requiredRole: tap.tapRequiredRole,
            channel: status === 'PENDING' && typeof snapshot.channel === 'string'
                ? snapshot.channel
                : tap.tapChannel,
            twoPerson: tap.tapTwoPerson,
            selfAllowed: tap.tapSelfAllowed,
            sessionId: tap.tapSessionId,
            sessionNo: session?.tssSessionNo ?? null,
            counterId: tap.tapCounterId,
            counterName: counter?.tcnName ?? null,
            srcDocType: tap.tapSrcDocType,
            srcDocId: tap.tapSrcDocId,
            srcRefno: tap.tapSrcRefno,
            reasonId: tap.tapReasonId,
            reasonName: reason?.trsName ?? null,
            requestedBy: tap.tapRequestedBy,
            requestedByName: names.get(tap.tapRequestedBy) ?? null,
            requestedOn: tap.tapRequestedOn.toISOString(),
            requestNote: tap.tapRequestNote,
            decidedBy: tap.tapDecidedBy,
            decidedByName: tap.tapDecidedBy ? (names.get(tap.tapDecidedBy) ?? null) : null,
            decidedOn: tap.tapDecidedOn ? tap.tapDecidedOn.toISOString() : null,
            decisionNote: tap.tapDecisionNote,
            secondBy: tap.tapSecondBy,
            secondByName: tap.tapSecondBy ? (names.get(tap.tapSecondBy) ?? null) : null,
            secondOn: tap.tapSecondOn ? tap.tapSecondOn.toISOString() : null,
            expiresOn: tap.tapExpiresOn ? tap.tapExpiresOn.toISOString() : null,
            usedOn: typeof snapshot.usedOn === 'string' ? snapshot.usedOn : null,
        };
    }
    async pending(scope) {
        const caller = await this.context.caller();
        const expired = await this.sweep(scope, caller);
        const figures = (await this.context.rights(till_enum_1.TILL_MENU.SESSIONS)).override;
        const held = await this.approval.grantsOf(this.prisma, {
            userId: caller.userId,
            companyId: scope.companyId,
            branchId: scope.branchId,
        });
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const today = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const rules = new Map();
        const ruleOf = async (event, onDate) => {
            const k = `${event}|${onDate}`;
            if (!rules.has(k)) {
                rules.set(k, await this.approval.ruleOrDefault(this.prisma, { ...scope, event, onDate }));
            }
            return rules.get(k);
        };
        const judge = (event, amount, minRole, requesterIds, selfAllowed) => {
            let code = null;
            for (const requesterId of requesterIds.length ? requesterIds : [null]) {
                code = this.approval.standing(held, { event, amount, minRole, requesterId, selfAllowed });
                if (code) {
                    break;
                }
            }
            return { canDecide: code === null, cannotBecause: code };
        };
        const items = [];
        const blank = {
            tapId: null,
            tssId: null,
            tcmId: null,
            tvrId: null,
            safeId: null,
            sessionNo: null,
            counterName: null,
            safeName: null,
            expiresOn: null,
            srcDocType: null,
            srcDocId: null,
            srcRefno: null,
            note: null,
            afterClose: false,
        };
        const requests = await this.prisma.$queryRaw `
      SELECT a.tap_id::text, a.tap_acc_year, a.tap_event_code AS event, a.tap_amount AS amount,
             a.tap_required_role AS required_role,
             COALESCE(a.tap_rule_snapshot ->> 'channel', a.tap_channel) AS channel,
             a.tap_two_person AS two_person, a.tap_self_allowed AS self_allowed,
             a.tap_requested_by::text AS requested_by, a.tap_requested_on AS requested_on,
             a.tap_expires_on AS expires_on, a.tap_src_doc_type AS src_doc_type,
             a.tap_src_doc_id::text AS src_doc_id, a.tap_src_refno AS src_refno,
             a.tap_request_note AS note, a.tap_session_id::text AS tss_id,
             s.tss_session_no AS session_no, c.tcn_name AS counter_name
        FROM accounts.till_approval a
        LEFT JOIN accounts.till_session s
               ON s.tss_id = a.tap_session_id AND s.tss_acc_year = a.tap_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = a.tap_counter_id
       WHERE a.tap_company_id = ${scope.companyId}::uuid AND a.tap_branch_id = ${scope.branchId}::uuid
         AND a.tap_status = 'PENDING' AND a.tap_is_deleted = false
       ORDER BY a.tap_requested_on`;
        for (const r of requests) {
            const amount = new client_1.Prisma.Decimal(r.amount);
            items.push({
                ...blank,
                kind: 'REQUEST',
                action: 'approvals/decide',
                event: r.event,
                accYear: r.tap_acc_year,
                tapId: r.tap_id,
                tssId: r.tss_id,
                sessionNo: r.session_no,
                counterName: r.counter_name,
                amount: num(amount),
                requiredRole: r.required_role,
                channel: r.channel ?? 'EITHER',
                twoPerson: r.two_person,
                requestedBy: r.requested_by,
                requestedByName: null,
                requestedOn: r.requested_on.toISOString(),
                expiresOn: r.expires_on ? r.expires_on.toISOString() : null,
                srcDocType: r.src_doc_type,
                srcDocId: r.src_doc_id,
                srcRefno: r.src_refno,
                note: r.note,
                ...judge(r.event, amount, r.required_role, [r.requested_by], r.self_allowed),
            });
        }
        const sessions = await this.prisma.$queryRaw `
      SELECT s.tss_id::text, s.tss_acc_year, s.tss_session_no AS session_no, s.tss_status AS status,
             s.tss_operator_id::text AS operator_id,
             to_char(s.tss_business_date, 'YYYY-MM-DD') AS business_date,
             COALESCE(s.tss_counted_on, s.tss_closed_on) AS asked_on, c.tcn_name AS counter_name,
             bool_or(v.tvr_tender_type_id = 1) AS has_cash,
             sum(abs(v.tvr_counted - v.tvr_expected)) AS amount
        FROM accounts.till_session s
        JOIN accounts.till_variance v
          ON v.tvr_session_id = s.tss_id AND v.tvr_acc_year = s.tss_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = s.tss_counter_id
       WHERE s.tss_company_id = ${scope.companyId}::uuid AND s.tss_branch_id = ${scope.branchId}::uuid
         AND s.tss_is_deleted = false
         AND v.tvr_is_deleted = false AND v.tvr_stage = 'CLOSE'
         AND v.tvr_status = 'OPEN' AND v.tvr_treatment = 'PENDING'
         AND (s.tss_status = 'PENDING_APPROVAL'
              OR (s.tss_status = 'CLOSED' AND v.tvr_slip_count IS NULL))
       GROUP BY s.tss_id, s.tss_acc_year, s.tss_session_no, s.tss_status, s.tss_operator_id,
                s.tss_business_date, s.tss_counted_on, s.tss_closed_on, c.tcn_name
       ORDER BY COALESCE(s.tss_counted_on, s.tss_closed_on) NULLS LAST`;
        for (const r of sessions) {
            const event = r.has_cash ? 'CASH_VARIANCE' : 'NONCASH_VARIANCE';
            const rule = await ruleOf(event, r.business_date);
            const amount = new client_1.Prisma.Decimal(r.amount);
            items.push({
                ...blank,
                kind: 'SESSION_VARIANCE',
                action: 'sessions/decide-variance',
                event,
                accYear: r.tss_acc_year,
                tssId: r.tss_id,
                sessionNo: r.session_no,
                counterName: r.counter_name,
                amount: figures ? num(amount) : null,
                requiredRole: rule.tar_min_role,
                channel: rule.tar_channel,
                twoPerson: rule.tar_two_person,
                requestedBy: r.operator_id,
                requestedByName: null,
                requestedOn: r.asked_on ? r.asked_on.toISOString() : null,
                afterClose: r.status === 'CLOSED',
                ...judge(event, amount, rule.tar_min_role, [r.operator_id], rule.tar_allow_self),
            });
        }
        const received = await this.prisma.$queryRaw `
      SELECT v.tvr_id::text, v.tvr_acc_year, abs(v.tvr_counted - v.tvr_expected) AS amount,
             m.tcm_id::text, s.tss_id::text, s.tss_session_no AS session_no,
             s.tss_operator_id::text AS operator_id, c.tcn_name AS counter_name,
             m.tcm_doc_no AS doc_no, m.tcm_received_by::text AS received_by,
             m.tcm_received_on AS received_on
        FROM accounts.till_variance v
        JOIN accounts.till_session s
          ON s.tss_id = v.tvr_session_id AND s.tss_acc_year = v.tvr_acc_year
        JOIN accounts.till_cash_movement m
          ON m.tcm_id = v.tvr_movement_id AND m.tcm_acc_year = v.tvr_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = s.tss_counter_id
       WHERE v.tvr_company_id = ${scope.companyId}::uuid AND v.tvr_branch_id = ${scope.branchId}::uuid
         AND v.tvr_stage = 'RECEIVE' AND v.tvr_status = 'OPEN' AND v.tvr_treatment = 'PENDING'
         AND v.tvr_is_deleted = false
       ORDER BY m.tcm_received_on NULLS LAST`;
        if (received.length > 0) {
            const rule = await ruleOf('CASH_VARIANCE', today);
            for (const r of received) {
                const amount = new client_1.Prisma.Decimal(r.amount);
                items.push({
                    ...blank,
                    kind: 'RECEIVE_VARIANCE',
                    action: 'sessions/decide-variance',
                    event: 'CASH_VARIANCE',
                    accYear: r.tvr_acc_year,
                    tssId: r.tss_id,
                    tcmId: r.tcm_id,
                    tvrId: r.tvr_id,
                    sessionNo: r.session_no,
                    counterName: r.counter_name,
                    amount: figures ? num(amount) : null,
                    requiredRole: rule.tar_min_role,
                    channel: rule.tar_channel,
                    twoPerson: rule.tar_two_person,
                    requestedBy: r.received_by,
                    requestedByName: null,
                    requestedOn: r.received_on ? r.received_on.toISOString() : null,
                    srcDocType: 'TILL_MOVEMENT',
                    srcDocId: r.tcm_id,
                    srcRefno: r.doc_no,
                    ...judge('CASH_VARIANCE', amount, rule.tar_min_role, [r.received_by, r.operator_id], rule.tar_allow_self),
                });
            }
        }
        const safeGaps = await this.prisma.$queryRaw `
      SELECT v.tvr_id::text, v.tvr_acc_year, v.tvr_stage AS stage,
             abs(v.tvr_counted - v.tvr_expected) AS amount, v.tvr_safe_id::text AS safe_id,
             sf.tsf_name AS safe_name,
             COALESCE(ct.tct_counted_by, m.tcm_confirmed_by)::text AS by,
             COALESCE(ct.tct_counted_on, m.tcm_confirmed_on, v.tvr_created_on) AS on,
             m.tcm_doc_no AS doc_no
        FROM accounts.till_variance v
        LEFT JOIN accounts.till_safe sf ON sf.tsf_id = v.tvr_safe_id
        LEFT JOIN accounts.till_count ct
               ON v.tvr_stage = 'SAFE' AND ct.tct_id = v.tvr_count_id AND ct.tct_acc_year = v.tvr_acc_year
        LEFT JOIN accounts.till_cash_movement m
               ON v.tvr_stage = 'REMIT' AND m.tcm_id = v.tvr_movement_id AND m.tcm_acc_year = v.tvr_acc_year
       WHERE v.tvr_company_id = ${scope.companyId}::uuid AND v.tvr_branch_id = ${scope.branchId}::uuid
         AND v.tvr_stage IN ('SAFE', 'REMIT') AND v.tvr_status = 'OPEN'
         AND v.tvr_treatment = 'PENDING' AND v.tvr_is_deleted = false
       ORDER BY 8 NULLS LAST`;
        if (safeGaps.length > 0) {
            const rule = await ruleOf('SAFE_VARIANCE', today);
            for (const r of safeGaps) {
                const amount = new client_1.Prisma.Decimal(r.amount);
                items.push({
                    ...blank,
                    kind: 'SAFE_VARIANCE',
                    action: 'safes/decide-variance',
                    event: 'SAFE_VARIANCE',
                    accYear: r.tvr_acc_year,
                    tvrId: r.tvr_id,
                    safeId: r.safe_id,
                    safeName: r.safe_name,
                    amount: figures ? num(amount) : null,
                    requiredRole: rule.tar_min_role,
                    channel: rule.tar_channel,
                    twoPerson: rule.tar_two_person,
                    requestedBy: r.by,
                    requestedByName: null,
                    requestedOn: r.on ? r.on.toISOString() : null,
                    srcDocType: r.stage === 'REMIT' ? 'TILL_MOVEMENT' : 'TILL_COUNT',
                    srcRefno: r.doc_no,
                    ...judge('SAFE_VARIANCE', amount, rule.tar_min_role, [], true),
                });
            }
        }
        const names = await this.namesOf(items.map((i) => i.requestedBy));
        for (const item of items) {
            item.requestedByName = item.requestedBy ? (names.get(item.requestedBy) ?? null) : null;
        }
        return { items, expired };
    }
    async judge(ask) {
        const secondId = ask.secondId?.trim() || null;
        const secondOn = ask.approve && ask.rule.tar_two_person && secondId
            ? await this.provePerson({ ...ask, userId: secondId })
            : null;
        try {
            const verdict = await this.approval.assertApprover(this.prisma, {
                companyId: ask.scope.companyId,
                branchId: ask.scope.branchId,
                event: ask.event,
                amount: ask.amount,
                rule: { ...ask.rule, tar_allow_self: ask.selfAllowed },
                approverId: ask.approverId,
                requesterId: ask.requesterId,
                pin: ask.pin,
                second: ask.rule.tar_two_person ? (secondId ? { userId: secondId } : null) : undefined,
            });
            return { verdict, secondOn };
        }
        catch (error) {
            if (ask.pin?.trim() && (0, till_errors_1.tillErrorCodeOf)(error) === till_enum_1.TillErrorCode.APPROVER_PIN) {
                await this.events.log(this.prisma, {
                    companyId: ask.scope.companyId,
                    branchId: ask.scope.branchId,
                    accYear: ask.accYear,
                    code: till_enum_1.TillEventCode.PIN_FAIL,
                    deviceId: ask.caller.deviceId,
                    userId: ask.caller.userId,
                    payload: { action: ask.action, event: ask.event, approverId: ask.approverId },
                });
            }
            throw error;
        }
    }
    async provePerson(ask) {
        if (ask.userId === ask.caller.userId || ask.userId === ask.approverId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_SECOND, 'The second signature is another person than the one deciding', 'secondId');
        }
        const user = await this.prisma.userMaster.findFirst({
            where: { usrId: ask.userId, usrIsActive: true, usrIsDeleted: false },
            select: { usrLoginName: true, usrPinHash: true },
        });
        if (!user) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_SECOND, 'The second signature is not an active user', 'secondId');
        }
        if (!user.usrPinHash) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.WITNESS_NO_PIN, `${user.usrLoginName} has no till PIN: an administrator sets one in User Administration (menu 58)`, 'secondPin');
        }
        const pin = ask.secondPin?.trim() || null;
        if (pin === null) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.WITNESS_PIN_REQUIRED, `${user.usrLoginName} signs with their till PIN`, 'secondPin');
        }
        if (!(await (0, secret_hash_utils_1.verifySecret)(pin, user.usrPinHash))) {
            await this.events.log(this.prisma, {
                companyId: ask.scope.companyId,
                branchId: ask.scope.branchId,
                accYear: ask.accYear,
                code: till_enum_1.TillEventCode.PIN_FAIL,
                deviceId: ask.caller.deviceId,
                userId: ask.caller.userId,
                payload: { action: ask.action, secondId: ask.userId },
            });
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.WITNESS_PIN, `${user.usrLoginName}'s till PIN is wrong`, 'secondPin');
        }
        return new Date();
    }
    async decideIn(tx, row, d) {
        const now = new Date();
        const status = d.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const second = d.decision === 'APPROVE' ? d.verdict.secondBy : null;
        await tx.tillApproval.update({
            where: { tapId_tapAccYear: { tapId: row.tapId, tapAccYear: row.tapAccYear } },
            data: {
                tapStatus: status,
                tapDecidedBy: d.caller.userId,
                tapDecidedOn: now,
                tapDecidedDeviceId: d.caller.deviceId,
                tapDecisionNote: d.note.slice(0, 500),
                tapChannel: d.verdict.channel,
                tapSecondBy: second,
                tapSecondOn: second ? (d.secondOn ?? now) : null,
                tapRuleSnapshot: {
                    ...(row.tapRuleSnapshot ?? {}),
                    approver: {
                        role: d.verdict.role,
                        grantId: d.verdict.grantId,
                        implicit: d.verdict.implicit,
                        secondBy: second,
                    },
                },
                tapModifiedOn: now,
            },
        });
        const snapshot = (row.tapRuleSnapshot ?? {});
        if (status === 'APPROVED' && typeof snapshot.tvrId === 'string') {
            await tx.tillVariance.updateMany({
                where: { tvrId: snapshot.tvrId, tvrAccYear: row.tapAccYear, tvrApprovalId: null },
                data: { tvrApprovalId: row.tapId, tvrModifiedOn: now, tvrModifiedBy: d.caller.actorName },
            });
        }
        await this.logDecision(tx, row, d.caller, {
            status,
            note: d.note,
            approverRole: d.verdict.role,
            channel: d.verdict.channel,
            implicitGrant: d.verdict.implicit,
            grantId: d.verdict.grantId,
            secondBy: second,
        });
    }
    async logDecision(tx, row, caller, payload) {
        await this.events.log(tx, {
            companyId: row.tapCompanyId,
            branchId: row.tapBranchId,
            accYear: row.tapAccYear,
            code: till_enum_1.TillEventCode.APPROVAL_DECIDED,
            sessionId: row.tapSessionId,
            counterId: row.tapCounterId,
            deviceId: caller.deviceId,
            userId: caller.userId,
            srcDocType: row.tapSrcDocType,
            srcDocId: row.tapSrcDocId,
            srcRefno: row.tapSrcRefno,
            amount: row.tapAmount,
            reasonId: row.tapReasonId,
            approvalId: row.tapId,
            payload: { event: row.tapEventCode, ...payload },
        });
    }
    async pendingRow(key) {
        const tap = await this.prisma.tillApproval.findFirst({
            where: {
                tapId: key.tapId,
                tapAccYear: key.accYear,
                tapCompanyId: key.companyId,
                tapBranchId: key.branchId,
                tapIsDeleted: false,
            },
        });
        if (!tap) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.APPROVAL_NOT_FOUND, 'Approval request', 'tapId', key.tapId);
        }
        if (tap.tapStatus === 'PENDING' && tap.tapExpiresOn && tap.tapExpiresOn < new Date()) {
            await this.sweep(key, await this.context.caller());
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_EXPIRED, `The approval request ran out at ${tap.tapExpiresOn.toISOString()} before anyone decided it: ask again`, 'tapId', { status: 'EXPIRED' });
        }
        if (tap.tapStatus !== 'PENDING') {
            this.throwNotPending(tap);
        }
        return tap;
    }
    throwNotPending(tap) {
        (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_NOT_PENDING, `The approval request is ${tap.tapStatus}: only a PENDING one is decided or cancelled`, 'tapId', { status: tap.tapStatus });
    }
    async lockRow(tx, key) {
        await tx.$queryRaw `
      SELECT tap_id FROM accounts.till_approval
       WHERE tap_id = ${key.tapId}::uuid AND tap_acc_year = ${key.accYear}::char(9)
       FOR UPDATE`;
        return tx.tillApproval.findUniqueOrThrow({
            where: { tapId_tapAccYear: { tapId: key.tapId, tapAccYear: key.accYear } },
        });
    }
    async sweep(scope, caller) {
        return this.prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw `
        UPDATE accounts.till_approval
           SET tap_status = 'EXPIRED', tap_modified_on = now()
         WHERE tap_company_id = ${scope.companyId}::uuid AND tap_branch_id = ${scope.branchId}::uuid
           AND tap_status = 'PENDING' AND tap_is_deleted = false
           AND tap_expires_on IS NOT NULL AND tap_expires_on < now()
        RETURNING tap_id::text, tap_acc_year, tap_event_code AS event,
                  tap_session_id::text AS session_id, tap_counter_id::text AS counter_id,
                  tap_amount AS amount`;
            for (const r of rows) {
                await this.events.log(tx, {
                    companyId: scope.companyId,
                    branchId: scope.branchId,
                    accYear: r.tap_acc_year,
                    code: till_enum_1.TillEventCode.APPROVAL_EXPIRED,
                    sessionId: r.session_id,
                    counterId: r.counter_id,
                    deviceId: caller.deviceId,
                    userId: caller.userId,
                    amount: r.amount,
                    approvalId: r.tap_id,
                    payload: { event: r.event },
                });
            }
            return rows.length;
        });
    }
    async namesOf(ids) {
        const wanted = [...new Set(ids.filter((id) => !!id))];
        if (wanted.length === 0) {
            return new Map();
        }
        const users = await this.prisma.userMaster.findMany({
            where: { usrId: { in: wanted } },
            select: { usrId: true, usrLoginName: true, usrDisplayName: true },
        });
        return new Map(users.map((u) => [u.usrId, u.usrDisplayName?.trim() || u.usrLoginName]));
    }
};
exports.TillApprovalGateService = TillApprovalGateService;
exports.TillApprovalGateService = TillApprovalGateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_approval_service_1.TillApprovalService,
        till_event_service_1.TillEventService])
], TillApprovalGateService);
//# sourceMappingURL=till-approval-gate.service.js.map