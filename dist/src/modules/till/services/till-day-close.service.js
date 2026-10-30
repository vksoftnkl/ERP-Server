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
exports.TillDayCloseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_context_service_1 = require("../till-context.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
const till_approval_service_1 = require("./till-approval.service");
const till_day_service_1 = require("./till-day.service");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const till_safe_service_1 = require("./till-safe.service");
const till_session_service_1 = require("./till-session.service");
const till_enum_1 = require("../types/till-enum");
const ZERO = new client_1.Prisma.Decimal(0);
let TillDayCloseService = class TillDayCloseService {
    prisma;
    context;
    approval;
    events;
    days;
    sessions;
    ledger;
    safes;
    constructor(prisma, context, approval, events, days, sessions, ledger, safes) {
        this.prisma = prisma;
        this.context = context;
        this.approval = approval;
        this.events = events;
        this.days = days;
        this.sessions = sessions;
        this.ledger = ledger;
        this.safes = safes;
    }
    async closeCheck(key) {
        const day = await this.loadDay(this.prisma, key);
        const items = await this.check(this.prisma, day);
        return {
            tbdId: day.tbdId,
            tbdAccYear: day.tbdAccYear,
            tbdBusinessDate: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
            tbdStatus: day.tbdStatus,
            items,
            ...verdictOf(day, items),
        };
    }
    async check(client, day) {
        const sessions = await client.$queryRaw `
      SELECT tss_id::text, tss_session_no, tss_status
        FROM accounts.till_session
       WHERE tss_day_id = ${day.tbdId}::uuid AND tss_acc_year = ${day.tbdAccYear}::char(9)
         AND tss_is_deleted = false AND tss_status <> ${till_enum_1.TillSessionStatus.VOIDED}
       ORDER BY tss_opened_on`;
        const byStatus = (statuses) => sessions.filter((x) => statuses.includes(x.tss_status));
        const closedIds = byStatus([till_enum_1.TillSessionStatus.CLOSED]).map((x) => x.tss_id);
        const noOf = new Map(sessions.map((x) => [x.tss_id, x.tss_session_no]));
        const named = (ids) => [...new Set(ids)].map((id) => noOf.get(id) ?? id).join(', ');
        const live = byStatus(till_enum_1.LIVE_SESSION_STATUSES);
        const pending = byStatus([till_enum_1.TillSessionStatus.PENDING_APPROVAL]);
        const awaiting = await client.$queryRaw `
      SELECT tcm_session_id::text AS session, count(*)::int AS n
        FROM accounts.till_cash_movement
       WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
         AND tcm_is_deleted = false AND tcm_status = 'POSTED'
         AND tcm_receipt_status = ${till_enum_1.TillReceiptStatus.AWAITING}
       GROUP BY tcm_session_id`;
        const gaps = await client.$queryRaw `
      SELECT tvr_session_id::text AS session, (tvr_slip_count IS NOT NULL) AS slip, count(*)::int AS n
        FROM accounts.till_variance
       WHERE tvr_session_id = ANY(${closedIds}::uuid[]) AND tvr_acc_year = ${day.tbdAccYear}::char(9)
         AND tvr_is_deleted = false AND tvr_status = 'OPEN'
         AND tvr_treatment = ${till_enum_1.TillVarianceTreatment.PENDING}
       GROUP BY 1, 2`;
        const drawerGaps = gaps.filter((g) => !g.slip);
        const slipGaps = gaps.filter((g) => g.slip);
        const slipChecks = await client.$queryRaw `
      WITH latest AS (
        SELECT DISTINCT ON (e.tev_session_id, e.tev_payload->>'tenderId')
               e.tev_session_id, e.tev_payload
          FROM accounts.till_event e
         WHERE e.tev_session_id = ANY(${closedIds}::uuid[]) AND e.tev_acc_year = ${day.tbdAccYear}::char(9)
           AND e.tev_event_code = ${till_enum_1.TillEventCode.SLIP_CHECK}
         ORDER BY e.tev_session_id, e.tev_payload->>'tenderId', e.tev_event_on DESC
      ), counted AS (
        SELECT l.tev_session_id::text AS session,
               ((SELECT count(DISTINCT t.td_id)
                   FROM jsonb_array_elements_text(COALESCE(l.tev_payload->'noSlipRows', '[]'::jsonb)
                                                  || COALESCE(l.tev_payload->'amountDiffersRows', '[]'::jsonb)) AS r(td_id)
                   JOIN accounts.acc_tender_detail t
                     ON t.td_id = r.td_id::uuid AND t.td_acc_year = ${day.tbdAccYear}::char(9)
                  WHERE t.td_is_deleted = false AND t.td_is_voided = false)
                + COALESCE(jsonb_array_length(l.tev_payload->'slipsWithoutRowList'), 0))::int AS n
          FROM latest l
      )
      SELECT session, sum(n)::int AS n FROM counted WHERE n > 0 GROUP BY session`;
        const unposted = await client.$queryRaw `
      SELECT session, sum(n)::int AS n FROM (
        SELECT tcm_session_id::text AS session, count(*)::int AS n
          FROM accounts.till_cash_movement
         WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_status = 'POSTED'
           AND tcm_kind <> ${till_enum_1.TillMovementKind.EXCHANGE} AND tcm_voucher_id IS NULL
         GROUP BY 1
        UNION ALL
        SELECT tvr_session_id::text, count(*)::int
          FROM accounts.till_variance
         WHERE tvr_session_id = ANY(${closedIds}::uuid[]) AND tvr_acc_year = ${day.tbdAccYear}::char(9)
           AND tvr_is_deleted = false AND tvr_status = 'OPEN'
           AND tvr_treatment NOT IN (${till_enum_1.TillVarianceTreatment.PENDING}, ${till_enum_1.TillVarianceTreatment.RETENDERED})
         GROUP BY 1) x
       GROUP BY session`;
        const [held] = await client.$queryRaw `
      SELECT count(*)::int AS n FROM public.txn_hold
       WHERE txh_company_id = ${day.tbdCompanyId}::uuid AND txh_branch_id = ${day.tbdBranchId}::uuid
         AND txh_is_deleted = false AND txh_kind = 'HOLD' AND txh_status IN ('HELD', 'LOCKED')`;
        const overInsured = await this.safesOverInsured(client, day);
        const settings = await this.context.settings({
            companyId: day.tbdCompanyId,
            branchId: day.tbdBranchId,
        });
        const uncounted = await this.safes.uncountedSafes(client, day);
        const safeGaps = await this.safes.pendingGapsOfDay(client, day);
        const sum = (rows) => rows.reduce((t, r) => t + r.n, 0);
        const item = (code, tone, count, detail, sessionIds = []) => ({
            code,
            tone: count > 0 ? tone : till_enum_1.TillCloseCheckTone.GREEN,
            count,
            detail,
            sessionIds: count > 0 ? [...new Set(sessionIds)] : [],
        });
        const sessionsOf = (rows) => rows.map((r) => r.session);
        const unpostedIds = sessionsOf(unposted);
        return [
            item(till_enum_1.TillCloseCheckCode.SESSIONS_LIVE, till_enum_1.TillCloseCheckTone.RED, live.length, live.length > 0
                ? `${live.length} session(s) still open or being counted: ${named(live.map((x) => x.tss_id))}`
                : 'No session is still open', live.map((x) => x.tss_id)),
            item(till_enum_1.TillCloseCheckCode.SESSIONS_PENDING_APPROVAL, till_enum_1.TillCloseCheckTone.RED, pending.length, pending.length > 0
                ? `${pending.length} session(s) wait for a variance decision: ${named(pending.map((x) => x.tss_id))}`
                : 'No session waits for a variance decision', pending.map((x) => x.tss_id)),
            item(till_enum_1.TillCloseCheckCode.CASH_TO_APPROVE, till_enum_1.TillCloseCheckTone.RED, sum(awaiting), awaiting.length > 0
                ? `${sum(awaiting)} hand-over(s) / drop(s) not yet approved into the safe: ${named(sessionsOf(awaiting))}`
                : 'All cash handed over has been approved into the safe', sessionsOf(awaiting)),
            item(till_enum_1.TillCloseCheckCode.VARIANCE_UNDECIDED, till_enum_1.TillCloseCheckTone.RED, sum(drawerGaps) + safeGaps, [
                drawerGaps.length > 0
                    ? `${sum(drawerGaps)} cash difference(s) of closed sessions still wait for a decision: ${named(sessionsOf(drawerGaps))}`
                    : null,
                safeGaps > 0
                    ? `${safeGaps} safe difference(s) of the day still wait for a decision (Cash Office)`
                    : null,
            ]
                .filter((x) => x !== null)
                .join('; ') || 'Every cash difference is decided', sessionsOf(drawerGaps)),
            item(till_enum_1.TillCloseCheckCode.MOVEMENTS_UNPOSTED, till_enum_1.TillCloseCheckTone.RED, sum(unposted), unposted.length > 0
                ? `${sum(unposted)} movement(s) / variance(s) of the day have no voucher: ${named(unpostedIds)}`
                : 'Every movement and variance is posted', unpostedIds),
            item(till_enum_1.TillCloseCheckCode.SLIP_GAPS, till_enum_1.TillCloseCheckTone.AMBER, sum(slipGaps) + sum(slipChecks), slipGaps.length + slipChecks.length > 0
                ? [
                    slipGaps.length > 0
                        ? `${sum(slipGaps)} card / UPI slip gap(s) still open: ${named(sessionsOf(slipGaps))}`
                        : null,
                    slipChecks.length > 0
                        ? `${sum(slipChecks)} slip(s) the slip check could not match: ${named(sessionsOf(slipChecks))}`
                        : null,
                ]
                    .filter((x) => x !== null)
                    .join('; ') + ' (reported, not enforced)'
                : 'No slip gap is open', [...new Set([...sessionsOf(slipGaps), ...sessionsOf(slipChecks)])]),
            item(till_enum_1.TillCloseCheckCode.HELD_BILLS, till_enum_1.TillCloseCheckTone.AMBER, held?.n ?? 0, (held?.n ?? 0) > 0
                ? `${held.n} held bill(s) still parked at this branch`
                : 'No held bill is parked'),
            item(till_enum_1.TillCloseCheckCode.SAFE_OVER_INSURED, till_enum_1.TillCloseCheckTone.AMBER, overInsured.length, overInsured.length > 0
                ? overInsured
                    .map((x) => `${x.name} holds ${x.balance.toFixed(2)} over its insured ${x.limit.toFixed(2)}`)
                    .join('; ')
                : 'No safe is over its insured limit'),
            item(till_enum_1.TillCloseCheckCode.SAFE_NOT_COUNTED, settings.daySafeCount ? till_enum_1.TillCloseCheckTone.RED : till_enum_1.TillCloseCheckTone.AMBER, uncounted.length, uncounted.length > 0
                ? `Not counted today: ${uncounted.map((x) => x.name).join(', ')}${settings.daySafeCount ? '' : ' (till.day_close_safe_count is off)'}`
                : 'Every safe holding cash has been counted'),
        ];
    }
    async safesOverInsured(client, day) {
        const safes = await client.tillSafe.findMany({
            where: {
                tsfCompanyId: day.tbdCompanyId,
                tsfBranchId: day.tbdBranchId,
                tsfIsDeleted: false,
                tsfIsActive: true,
                tsfInsuredLimit: { gt: 0 },
            },
            select: { tsfName: true, tsfLedgerId: true, tsfInsuredLimit: true },
        });
        if (safes.length === 0) {
            return [];
        }
        const balanceOf = await this.ledger.ledgerBalances(client, {
            companyId: day.tbdCompanyId,
            branchId: day.tbdBranchId,
            accYear: day.tbdAccYear,
            upTo: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
        }, safes.map((x) => x.tsfLedgerId));
        return safes
            .map((x) => ({
            name: x.tsfName,
            balance: balanceOf.get(x.tsfLedgerId) ?? ZERO,
            limit: new client_1.Prisma.Decimal(x.tsfInsuredLimit ?? 0),
        }))
            .filter((x) => x.balance.greaterThan(x.limit));
    }
    async close(input) {
        const caller = await this.context.caller();
        const peek = await this.loadDay(this.prisma, input);
        this.assertClosable(peek);
        const reds = redsOf(await this.check(this.prisma, peek));
        const exception = input.exception ?? null;
        if (reds.length > 0 && !exception) {
            blocked(reds, 'The day has items still open: settle them, or close with an exception');
        }
        let approved = null;
        if (exception && reds.length > 0) {
            const uncovered = reds.filter((r) => !till_enum_1.CLOSE_EXCEPTION_CODES.includes(r.code));
            if (uncovered.length > 0) {
                blocked(uncovered, `An exception closes a day only over ${till_enum_1.CLOSE_EXCEPTION_CODES.join(', ')}: these need their own decision first`);
            }
            const counts = await this.liveCounts(peek, exception.counts ?? []);
            const reason = await this.sessions.exceptionReason(this.prisma, {
                companyId: input.companyId,
                category: 'DAY_CLOSE',
                reasonId: exception.reasonId,
                notes: input.notes ?? null,
            });
            const forceReason = await this.shippedReason('FORCE_CLOSE', 'DAY_CLOSE', input.companyId);
            const approverId = exception.approverId ?? caller.userId;
            const { rule, verdict } = await this.dayApprover(peek, caller, {
                event: 'DAY_CLOSE_EXCEPTION',
                approverId,
                requesterId: caller.userId,
                pin: exception.approverPin ?? null,
            });
            approved = {
                rule,
                verdict,
                approverId,
                reasonId: reason.trsId,
                forceReasonId: forceReason,
                counts,
            };
        }
        const done = await this.prisma.$transaction(async (tx) => {
            const day = await this.lockDay(tx, input);
            this.assertClosable(day);
            const now = new Date();
            let tapId = null;
            const forceClosed = [];
            let closedOver = [];
            if (approved) {
                closedOver = redsOf(await this.check(tx, day));
                tapId = await this.approval.record(tx, {
                    companyId: day.tbdCompanyId,
                    branchId: day.tbdBranchId,
                    tenantId: day.tbdTenantId,
                    accYear: day.tbdAccYear,
                    event: 'DAY_CLOSE_EXCEPTION',
                    sessionId: null,
                    counterId: null,
                    srcDocType: 'TILL_DAY',
                    srcDocId: day.tbdId,
                    srcRefno: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
                    amount: ZERO,
                    rule: approved.rule,
                    verdict: approved.verdict,
                    requestedBy: caller.userId,
                    requestedOn: now,
                    reasonId: approved.reasonId,
                    status: 'APPROVED',
                    decidedBy: approved.approverId,
                    decidedOn: now,
                    decidedDeviceId: caller.deviceId,
                    decisionNote: input.notes?.trim() || 'Day closed over an exception',
                    payload: { items: closedOver.map((r) => ({ code: r.code, count: r.count })) },
                });
                for (const [tssId, count] of approved.counts) {
                    const session = await this.sessions.lockForForce(tx, {
                        companyId: day.tbdCompanyId,
                        branchId: day.tbdBranchId,
                        accYear: day.tbdAccYear,
                        tssId,
                    });
                    const forced = await this.sessions.forceCloseIn(tx, session, caller, {
                        reasonId: approved.forceReasonId,
                        approvalId: tapId,
                        lines: count.lines,
                        floatLeft: count.floatLeft ?? null,
                        notes: input.notes ?? null,
                        receiveHandOver: true,
                    });
                    if (forced.outcome !== 'CLOSED') {
                        blocked([], `Session ${session.tssSessionNo}'s count is out of tolerance and waits for a variance decision: force-close it from the Cockpit and decide it, then close the day`, { tssId });
                    }
                    forceClosed.push({
                        tssId,
                        tssAccYear: session.tssAccYear,
                        sessionNo: session.tssSessionNo,
                    });
                }
            }
            const left = redsOf(await this.check(tx, day)).filter((r) => !(approved && till_enum_1.CLOSE_EXCEPTION_CODES.includes(r.code)));
            if (left.length > 0) {
                blocked(left, 'The day changed while it was being closed: check it again');
            }
            const [t] = await tx.$queryRaw `
          SELECT count(*)::int AS sessions,
                 COALESCE(sum(tss_bill_count), 0)::int AS bills,
                 COALESCE(sum(tss_net_sales), 0) AS net,
                 COALESCE(sum(tss_cash_expected), 0) AS cash_expected,
                 COALESCE(sum(tss_cash_counted), 0) AS cash_counted,
                 COALESCE(sum(tss_noncash_counted - tss_noncash_expected), 0) AS noncash_variance
            FROM accounts.till_session
           WHERE tss_day_id = ${day.tbdId}::uuid AND tss_acc_year = ${day.tbdAccYear}::char(9)
             AND tss_is_deleted = false AND tss_status = ${till_enum_1.TillSessionStatus.CLOSED}`;
            await this.safes.refreshDay(tx, day.tbdId, day.tbdAccYear);
            const zNo = day.tbdZNo ?? (await this.nextZ(tx, day));
            await tx.tillBusinessDay.update({
                where: { tbdId_tbdAccYear: { tbdId: day.tbdId, tbdAccYear: day.tbdAccYear } },
                data: {
                    tbdStatus: till_enum_1.TillDayStatus.CLOSED,
                    tbdClosingOn: now,
                    tbdClosedOn: now,
                    tbdClosedBy: caller.userId,
                    tbdZNo: zNo,
                    tbdSessionCount: t.sessions,
                    tbdBillCount: t.bills,
                    tbdNetSales: t.net,
                    tbdCashExpected: t.cash_expected,
                    tbdCashCounted: t.cash_counted,
                    tbdNoncashVariance: t.noncash_variance,
                    tbdExceptionCount: closedOver.reduce((n, r) => n + r.count, 0),
                    tbdCloseApprovalId: tapId,
                    tbdNotes: input.notes?.trim() || day.tbdNotes,
                    tbdModifiedOn: now,
                    tbdModifiedBy: caller.actorName,
                },
            });
            await this.events.log(tx, {
                companyId: day.tbdCompanyId,
                branchId: day.tbdBranchId,
                accYear: day.tbdAccYear,
                code: till_enum_1.TillEventCode.DAY_CLOSE,
                dayId: day.tbdId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                srcRefno: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
                reasonId: approved?.reasonId ?? null,
                approvalId: tapId,
                payload: {
                    zNo,
                    reopenCount: day.tbdReopenCount,
                    sessions: t.sessions,
                    netSales: new client_1.Prisma.Decimal(t.net).toFixed(2),
                    cashVariance: new client_1.Prisma.Decimal(t.cash_counted).minus(t.cash_expected).toFixed(2),
                    ...(approved
                        ? {
                            exception: {
                                items: closedOver.map((r) => ({ code: r.code, count: r.count })),
                                approverId: approved.approverId,
                                forceClosed: forceClosed.map((x) => x.sessionNo),
                            },
                        }
                        : {}),
                },
            });
            return { zNo, tapId, closedOver, forceClosed };
        }, { timeout: 60_000 });
        return { day: await this.days.get(input), ...done };
    }
    async liveCounts(day, counts) {
        const live = await this.prisma.tillSession.findMany({
            where: {
                tssDayId: day.tbdId,
                tssAccYear: day.tbdAccYear,
                tssIsDeleted: false,
                tssStatus: { in: [...till_enum_1.LIVE_SESSION_STATUSES] },
            },
            select: { tssId: true, tssSessionNo: true },
        });
        const byId = new Map(counts.map((c) => [c.tssId, c]));
        const missing = live.filter((x) => !byId.has(x.tssId));
        if (missing.length > 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.FORCE_COUNT_REQUIRED, `Closing the day over a live session force-closes it on your count of its drawer: count ${missing.map((x) => x.tssSessionNo).join(', ')}`, 'exception.counts', { sessionIds: missing.map((x) => x.tssId) });
        }
        const stray = counts.filter((c) => !live.some((x) => x.tssId === c.tssId));
        if (stray.length > 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'A count names a session that is not live on this day', 'exception.counts', { sessionIds: stray.map((c) => c.tssId) });
        }
        const drops = await this.prisma.tillCashMovement.findMany({
            where: {
                tcmSessionId: { in: live.map((x) => x.tssId) },
                tcmAccYear: day.tbdAccYear,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.AWAITING,
            },
            select: { tcmSessionId: true, tcmDocNo: true },
        });
        if (drops.length > 0) {
            const noOf = new Map(live.map((x) => [x.tssId, x.tssSessionNo]));
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSE_BLOCKED, `${[...new Set(drops.map((d) => noOf.get(d.tcmSessionId)))].join(', ')} made drops still awaiting approval (${drops.map((d) => d.tcmDocNo).join(', ')}): force-close it from the Cockpit and approve its cash, then close the day`, 'exception.counts', { items: [] });
        }
        return new Map(live.map((x) => [x.tssId, byId.get(x.tssId)]));
    }
    async reopen(key) {
        const caller = await this.context.caller();
        const peek = await this.loadDay(this.prisma, key);
        await this.assertReopenable(this.prisma, peek);
        const reason = await this.sessions.exceptionReason(this.prisma, {
            companyId: key.companyId,
            category: 'DAY_REOPEN',
            reasonId: key.reasonId,
            notes: key.notes ?? null,
        });
        const { rule, verdict } = await this.dayApprover(peek, caller, {
            event: 'DAY_REOPEN',
            approverId: caller.userId,
            requesterId: peek.tbdClosedBy ?? caller.userId,
            pin: key.approverPin ?? null,
        });
        const tapId = await this.prisma.$transaction(async (tx) => {
            const day = await this.lockDay(tx, key);
            await this.assertReopenable(tx, day);
            const now = new Date();
            const id = await this.approval.record(tx, {
                companyId: day.tbdCompanyId,
                branchId: day.tbdBranchId,
                tenantId: day.tbdTenantId,
                accYear: day.tbdAccYear,
                event: 'DAY_REOPEN',
                sessionId: null,
                counterId: null,
                srcDocType: 'TILL_DAY',
                srcDocId: day.tbdId,
                srcRefno: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
                amount: ZERO,
                rule,
                verdict,
                requestedBy: day.tbdClosedBy ?? caller.userId,
                requestedOn: now,
                reasonId: reason.trsId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: key.notes?.trim() || reason.trsName,
                payload: { zNo: day.tbdZNo, reopenCount: day.tbdReopenCount + 1 },
            });
            await tx.tillBusinessDay.update({
                where: { tbdId_tbdAccYear: { tbdId: day.tbdId, tbdAccYear: day.tbdAccYear } },
                data: {
                    tbdStatus: till_enum_1.TillDayStatus.OPEN,
                    tbdClosingOn: null,
                    tbdClosedOn: null,
                    tbdClosedBy: null,
                    tbdReopenCount: { increment: 1 },
                    tbdSessionCount: 0,
                    tbdBillCount: 0,
                    tbdNetSales: ZERO,
                    tbdCashExpected: ZERO,
                    tbdCashCounted: ZERO,
                    tbdNoncashVariance: ZERO,
                    tbdExceptionCount: 0,
                    tbdCloseApprovalId: null,
                    tbdModifiedOn: now,
                    tbdModifiedBy: caller.actorName,
                },
            });
            await this.events.log(tx, {
                companyId: day.tbdCompanyId,
                branchId: day.tbdBranchId,
                accYear: day.tbdAccYear,
                code: till_enum_1.TillEventCode.DAY_REOPEN,
                dayId: day.tbdId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                srcRefno: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
                reasonId: reason.trsId,
                approvalId: id,
                payload: {
                    zNo: day.tbdZNo,
                    reopenCount: day.tbdReopenCount + 1,
                    closedBy: day.tbdClosedBy,
                    closedOn: day.tbdClosedOn?.toISOString() ?? null,
                    notes: key.notes?.trim() || null,
                },
            });
            return id;
        });
        return { day: await this.days.get(key), tapId };
    }
    async assertReopenable(client, day) {
        if (day.tbdStatus !== till_enum_1.TillDayStatus.CLOSED) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_NOT_CLOSED, `Business day ${(0, till_dates_1.isoDateOf)(day.tbdBusinessDate)} is ${day.tbdStatus}: only a CLOSED day is reopened`, 'tbdId', { status: day.tbdStatus });
        }
        const later = await client.tillBusinessDay.findFirst({
            where: {
                tbdCompanyId: day.tbdCompanyId,
                tbdBranchId: day.tbdBranchId,
                tbdIsDeleted: false,
                tbdStatus: till_enum_1.TillDayStatus.CLOSED,
                tbdBusinessDate: { gt: day.tbdBusinessDate },
            },
            select: { tbdBusinessDate: true },
            orderBy: { tbdBusinessDate: 'asc' },
        });
        if (later) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_LATER_CLOSED, `Business day ${(0, till_dates_1.isoDateOf)(later.tbdBusinessDate)} is already closed: ${(0, till_dates_1.isoDateOf)(day.tbdBusinessDate)} cannot be reopened under it`, 'tbdId', { laterDate: (0, till_dates_1.isoDateOf)(later.tbdBusinessDate) });
        }
    }
    async loadDay(client, key) {
        const day = await client.tillBusinessDay.findFirst({
            where: {
                tbdId: key.tbdId,
                tbdAccYear: key.accYear,
                tbdCompanyId: key.companyId,
                tbdBranchId: key.branchId,
                tbdIsDeleted: false,
            },
        });
        if (!day) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.DAY_NOT_FOUND, 'Business day', 'tbdId', key.tbdId);
        }
        return day;
    }
    async lockDay(tx, key) {
        await tx.$queryRaw `
      SELECT tbd_id FROM accounts.till_business_day
       WHERE tbd_id = ${key.tbdId}::uuid AND tbd_acc_year = ${key.accYear}::char(9)
         AND tbd_company_id = ${key.companyId}::uuid AND tbd_branch_id = ${key.branchId}::uuid
         AND tbd_is_deleted = false
         FOR UPDATE`;
        return this.loadDay(tx, key);
    }
    assertClosable(day) {
        if (day.tbdStatus === till_enum_1.TillDayStatus.CLOSED) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSED, `Business day ${(0, till_dates_1.isoDateOf)(day.tbdBusinessDate)} is already closed (Z ${day.tbdZNo ?? '-'})`, 'tbdId', { zNo: day.tbdZNo });
        }
    }
    async nextZ(tx, day) {
        await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext(${`till-day-z:${day.tbdBranchId}`})))::int AS n`;
        const [row] = await tx.$queryRaw `
      SELECT COALESCE(max(tbd_z_no), 0)::int + 1 AS z FROM accounts.till_business_day
       WHERE tbd_company_id = ${day.tbdCompanyId}::uuid AND tbd_branch_id = ${day.tbdBranchId}::uuid`;
        return row.z;
    }
    async shippedReason(category, code, companyId) {
        const reason = await this.prisma.tillReason.findFirst({
            where: {
                trsCategory: category,
                trsCode: code,
                trsIsDeleted: false,
                trsIsActive: true,
                OR: [{ trsCompanyId: companyId }, { trsCompanyId: null }],
            },
            orderBy: { trsCompanyId: { sort: 'asc', nulls: 'last' } },
            select: { trsId: true },
        });
        if (!reason) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `The ${category} reason ${code} is missing (Till Reasons, menu 281)`, 'reasonId');
        }
        return reason.trsId;
    }
    async dayApprover(day, caller, ask) {
        const rule = await this.approval.ruleOrDefault(this.prisma, {
            companyId: day.tbdCompanyId,
            branchId: day.tbdBranchId,
            event: ask.event,
            onDate: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
        });
        const judged = ask.approverId === caller.userId ? rule : { ...rule, tar_channel: 'COUNTER' };
        try {
            const verdict = await this.approval.assertApprover(this.prisma, {
                companyId: day.tbdCompanyId,
                branchId: day.tbdBranchId,
                event: ask.event,
                amount: ZERO,
                rule: judged,
                approverId: ask.approverId,
                requesterId: ask.requesterId,
                pin: ask.pin,
            });
            return { rule, verdict };
        }
        catch (error) {
            if (ask.pin?.trim() && (0, till_errors_1.tillErrorCodeOf)(error) === till_enum_1.TillErrorCode.APPROVER_PIN) {
                await this.events.log(this.prisma, {
                    companyId: day.tbdCompanyId,
                    branchId: day.tbdBranchId,
                    accYear: day.tbdAccYear,
                    code: till_enum_1.TillEventCode.PIN_FAIL,
                    dayId: day.tbdId,
                    deviceId: caller.deviceId,
                    userId: caller.userId,
                    srcRefno: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate),
                    payload: { action: ask.event.toLowerCase(), approverId: ask.approverId },
                });
            }
            throw error;
        }
    }
};
exports.TillDayCloseService = TillDayCloseService;
exports.TillDayCloseService = TillDayCloseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_approval_service_1.TillApprovalService,
        till_event_service_1.TillEventService,
        till_day_service_1.TillDayService,
        till_session_service_1.TillSessionService,
        till_ledger_service_1.TillLedgerService,
        till_safe_service_1.TillSafeService])
], TillDayCloseService);
function redsOf(items) {
    return items.filter((i) => i.tone === till_enum_1.TillCloseCheckTone.RED);
}
function verdictOf(day, items) {
    const open = day.tbdStatus !== till_enum_1.TillDayStatus.CLOSED;
    const reds = redsOf(items);
    return {
        canClose: open && reds.length === 0,
        canCloseWithException: open && reds.length > 0 && reds.every((r) => till_enum_1.CLOSE_EXCEPTION_CODES.includes(r.code)),
    };
}
function blocked(items, message, extra = {}) {
    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSE_BLOCKED, message, 'tbdId', { ...extra, items });
}
//# sourceMappingURL=till-day-close.service.js.map