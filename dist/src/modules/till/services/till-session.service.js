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
exports.throwTillBadRequest = exports.TillSessionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_context_service_1 = require("../till-context.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
Object.defineProperty(exports, "throwTillBadRequest", { enumerable: true, get: function () { return till_errors_1.throwTillBadRequest; } });
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const till_approval_service_1 = require("./till-approval.service");
const till_day_service_1 = require("./till-day.service");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const till_posting_service_1 = require("./till-posting.service");
const till_enum_1 = require("../types/till-enum");
const ZERO = new client_1.Prisma.Decimal(0);
const MOVABLE = [till_enum_1.TillSessionStatus.OPEN, till_enum_1.TillSessionStatus.SUSPENDED];
const dec = (v) => v === null || v === undefined ? ZERO : new client_1.Prisma.Decimal(v);
const num = (v) => (v ? Number(v.toFixed(2)) : 0);
const FORCE_CLOSABLE = [
    till_enum_1.TillSessionStatus.OPEN,
    till_enum_1.TillSessionStatus.SUSPENDED,
    till_enum_1.TillSessionStatus.COUNTING,
];
let TillSessionService = class TillSessionService {
    prisma;
    approval;
    context;
    days;
    ledger;
    posting;
    events;
    constructor(prisma, approval, context, days, ledger, posting, events) {
        this.prisma = prisma;
        this.approval = approval;
        this.context = context;
        this.days = days;
        this.ledger = ledger;
        this.posting = posting;
        this.events = events;
    }
    async open(input) {
        const caller = await this.context.caller();
        const deviceId = this.requireDevice(caller);
        await this.knownDevice(this.prisma, deviceId);
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId,
            userId: caller.userId,
        });
        const opened = await this.prisma.$transaction(async (tx) => {
            const { counter, claim } = await this.claimCounter(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                counterId: input.counterId ?? null,
                deviceId,
            });
            await this.assertCounterFree(tx, counter.tcnId);
            await this.assertDeviceFree(tx, deviceId);
            await this.assertOperatorFree(tx, input.companyId, caller.userId);
            const day = await this.days.ensureOpenDay(tx, { companyId: input.companyId, branchId: input.branchId, tenantId: input.tenantId ?? null }, settings, caller, 'SESSION');
            const floatMode = counter.tcnDrawerMode === till_enum_1.TillDrawerMode.NONE
                ? till_enum_1.TillFloatMode.NONE
                : (input.floatMode ?? settings.floatMode);
            let floatIssued = ZERO;
            let prevSessionId = null;
            if (floatMode === till_enum_1.TillFloatMode.ISSUED) {
                floatIssued = dec(input.floatIssued ?? counter.tcnDefaultFloat);
                if (floatIssued.isNegative()) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.FLOAT_INVALID, 'The float issued cannot be negative', 'floatIssued');
                }
            }
            else if (floatMode === till_enum_1.TillFloatMode.CARRIED) {
                const prev = await this.carriedFrom(tx, counter.tcnId, input.prevSessionId ?? null);
                prevSessionId = prev.tssId;
                floatIssued = prev.tssFloatLeft;
            }
            else if (input.floatIssued && input.floatIssued !== 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.FLOAT_INVALID, 'A NONE float issues nothing', 'floatIssued');
            }
            const safe = floatIssued.isZero()
                ? null
                : await this.ledger.safeFor(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    counterSafeId: counter.tcnSafeId,
                });
            if (floatMode === till_enum_1.TillFloatMode.ISSUED && !floatIssued.isZero() && !safe) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, 'An ISSUED float comes out of a safe, and this branch has none (Till Masters, menu 275)', 'floatIssued');
            }
            if (floatMode === till_enum_1.TillFloatMode.NONE && input.lines.length > 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'A session with no float has nothing to count at open', 'lines');
            }
            input.lines.forEach((line, i) => {
                if (line.tenderTypeId !== till_enum_1.CASH_TENDER_TYPE_ID) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'The opening count is cash only', `lines.${i}.tenderTypeId`);
                }
            });
            const priced = await this.priceLines(tx, input.companyId, input.lines);
            const floatCounted = priced.reduce((s, l) => s.plus(l.amount), ZERO);
            const floatVariance = floatCounted.minus(floatIssued);
            const floatReason = floatVariance.isZero()
                ? null
                : await this.floatMismatchReason(tx, {
                    companyId: input.companyId,
                    reasonId: input.reasonId ?? null,
                    notes: input.notes ?? null,
                });
            const floatAsk = {
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: input.tenantId ?? null,
                accYear: day.tbdAccYear,
                event: 'FLOAT_MISMATCH',
                onDate: day.businessDate,
                amount: floatVariance.abs(),
                requesterId: caller.userId,
                deviceId,
                sessionId: null,
                counterId: counter.tcnId,
                srcDocType: 'TILL_COUNTER',
                srcDocId: counter.tcnId,
                srcRefno: counter.tcnCode,
                approvalId: input.approvalId ?? null,
                field: 'approvalId',
            };
            const floatGate = floatReason
                ? await this.approval.assessGate(tx, floatAsk)
                : { state: 'NONE' };
            if (floatGate.state === 'REFUSE') {
                this.approval.throwApprovalRequired(floatGate.need, floatAsk);
            }
            const daySeq = await this.nextDaySeq(tx, counter.tcnId, day.businessDate);
            const session = await tx.tillSession
                .create({
                data: {
                    tssCompanyId: input.companyId,
                    tssBranchId: input.branchId,
                    tssTenantId: input.tenantId ?? null,
                    tssAccYear: day.tbdAccYear,
                    tssDayId: day.tbdId,
                    tssBusinessDate: (0, till_dates_1.dateParam)(day.businessDate),
                    tssCounterId: counter.tcnId,
                    tssDeviceId: deviceId,
                    tssOperatorId: caller.userId,
                    tssSessionNo: (0, till_dates_1.sessionNumber)(counter.tcnCode, day.businessDate, daySeq),
                    tssDaySeq: daySeq,
                    tssStatus: till_enum_1.TillSessionStatus.OPEN,
                    tssFloatMode: floatMode,
                    tssPrevSessionId: prevSessionId,
                    tssFloatIssued: floatIssued,
                    tssFloatCounted: floatCounted,
                    tssNotes: input.notes ?? null,
                    tssCreatedBy: caller.actorName,
                },
            })
                .catch((error) => this.rethrowCounterTaken(error, counter.tcnCode));
            const postingSession = this.postingSession(session, day.businessDate);
            await this.events.log(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.SESSION_OPEN,
                sessionId: session.tssId,
                dayId: day.tbdId,
                counterId: counter.tcnId,
                deviceId,
                userId: caller.userId,
                srcRefno: session.tssSessionNo,
                amount: floatCounted,
                payload: {
                    claim,
                    floatMode,
                    floatIssued: floatIssued.toFixed(2),
                    floatCounted: floatCounted.toFixed(2),
                    prevSessionId,
                },
            });
            if (floatMode !== till_enum_1.TillFloatMode.NONE) {
                const count = await this.writeCount(tx, session, {
                    kind: till_enum_1.TillCountKind.OPEN,
                    attemptNo: 1,
                    isFinal: true,
                    isBlind: false,
                    lines: priced,
                    expected: floatIssued,
                    caller,
                    deviceId,
                });
                await tx.tillSession.update({
                    where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                    data: { tssOpenCountId: count.tctId },
                });
                if (floatMode === till_enum_1.TillFloatMode.ISSUED && !floatIssued.isZero() && safe) {
                    const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
                    await this.posting.postMovement(tx, {
                        session: postingSession,
                        kind: till_enum_1.TillMovementKind.FLOAT_ISSUE,
                        amount: floatIssued,
                        safe,
                        tillCash,
                        caller,
                        countId: count.tctId,
                    });
                }
                if (floatReason) {
                    const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
                    const variance = await tx.tillVariance.create({
                        data: {
                            tvrCompanyId: input.companyId,
                            tvrBranchId: input.branchId,
                            tvrTenantId: input.tenantId ?? null,
                            tvrAccYear: session.tssAccYear,
                            tvrSessionId: session.tssId,
                            tvrStage: 'OPEN',
                            tvrTenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
                            tvrTenderId: tillCash.tenderId,
                            tvrOpenAmount: floatIssued,
                            tvrExpected: floatIssued,
                            tvrCounted: floatCounted,
                            tvrTolerance: ZERO,
                            tvrTreatment: till_enum_1.TillVarianceTreatment.EXPENSE,
                            tvrReasonId: floatReason.trsId,
                            tvrDecidedBy: caller.userId,
                            tvrDecidedOn: new Date(),
                            tvrNotes: input.notes ?? null,
                            tvrStatus: 'OPEN',
                            tvrCreatedBy: caller.actorName,
                        },
                    });
                    const voucherId = await this.posting.postVariance(tx, {
                        session: postingSession,
                        tvrId: variance.tvrId,
                        tenderLedgerId: tillCash.ledgerId,
                        tenderLabel: 'Cash at open',
                        variance: floatVariance,
                        treatment: till_enum_1.TillVarianceTreatment.EXPENSE,
                        caller,
                    });
                    await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.VARIANCE_DECIDED, {
                        tvrId: variance.tvrId,
                        stage: 'OPEN',
                        treatment: till_enum_1.TillVarianceTreatment.EXPENSE,
                        byDefault: true,
                        variance: floatVariance.toFixed(2),
                        reasonId: floatReason.trsId,
                        voucherId,
                    });
                    const tapId = await this.approval.settleGate(tx, floatGate.state === 'APPROVED'
                        ? { ...floatAsk, sessionId: session.tssId }
                        : {
                            ...floatAsk,
                            sessionId: session.tssId,
                            srcDocType: 'TILL_SESSION',
                            srcDocId: session.tssId,
                            srcRefno: session.tssSessionNo,
                            payload: { tvrId: variance.tvrId },
                        }, floatGate);
                    if (tapId && floatGate.state === 'APPROVED') {
                        await tx.tillVariance.update({
                            where: {
                                tvrId_tvrAccYear: { tvrId: variance.tvrId, tvrAccYear: variance.tvrAccYear },
                            },
                            data: { tvrApprovalId: tapId },
                        });
                    }
                }
            }
            return session;
        });
        return this.get({
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: opened.tssAccYear,
            tssId: opened.tssId,
        }, { asOperator: true });
    }
    async current(scope) {
        const caller = await this.context.caller();
        const live = await this.prisma.tillSession.findFirst({
            where: {
                tssCompanyId: scope.companyId,
                tssBranchId: scope.branchId,
                tssIsDeleted: false,
                tssStatus: { in: [...till_enum_1.LIVE_SESSION_STATUSES, till_enum_1.TillSessionStatus.PENDING_APPROVAL] },
                OR: [
                    ...(caller.deviceId ? [{ tssDeviceId: caller.deviceId }] : []),
                    { tssOperatorId: caller.userId },
                ],
            },
            orderBy: { tssOpenedOn: 'desc' },
            select: { tssId: true, tssAccYear: true, tssOperatorId: true },
        });
        if (!live) {
            return null;
        }
        return this.get({ ...scope, accYear: live.tssAccYear, tssId: live.tssId }, { asOperator: live.tssOperatorId === caller.userId });
    }
    async openCheck(scope) {
        const caller = await this.context.caller();
        const deviceId = this.requireDevice(caller);
        if (scope.deviceId && scope.deviceId !== deviceId) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.NOT_THIS_LOGIN, 'deviceId is not the device this login came from', 'deviceId');
        }
        if (scope.userId && scope.userId !== caller.userId) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.NOT_THIS_LOGIN, 'userId is not the user of this login', 'userId');
        }
        await this.knownDevice(this.prisma, deviceId);
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId,
            userId: caller.userId,
        });
        const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const accYear = (0, till_dates_1.accYearOf)(businessDate);
        const day = await this.prisma.tillBusinessDay.findFirst({
            where: {
                tbdCompanyId: scope.companyId,
                tbdBranchId: scope.branchId,
                tbdAccYear: accYear,
                tbdBusinessDate: (0, till_dates_1.dateParam)(businessDate),
                tbdIsDeleted: false,
            },
            select: { tbdId: true, tbdStatus: true },
        });
        const [deviceSession] = await this.holdingSessions(this.prisma, { tssDeviceId: deviceId });
        const [userSessionElsewhere] = await this.holdingSessions(this.prisma, {
            tssCompanyId: scope.companyId,
            tssOperatorId: caller.userId,
            tssDeviceId: { not: deviceId },
        });
        const linked = await this.linkedCounter(this.prisma, { ...scope, deviceId });
        const payload = {
            requireSession: settings.requireSession && (!linked || linked.tcnRequiresSession),
            businessDay: {
                dayId: day?.tbdId ?? null,
                accYear,
                date: businessDate,
                status: day?.tbdStatus ?? null,
                autoOpen: settings.dayAutoOpen,
            },
            linkedCounter: null,
            freeCounters: [],
            busyCounters: [],
            deviceSession: deviceSession ?? null,
            userSessionElsewhere: userSessionElsewhere ?? null,
            carriedFrom: null,
        };
        if (!payload.requireSession) {
            return payload;
        }
        if (linked) {
            const [live] = await this.holdingSessions(this.prisma, { tssCounterId: linked.tcnId });
            const row = await this.counterRow(this.prisma, linked);
            payload.linkedCounter = {
                ...row,
                liveSessionId: live?.sessionId ?? null,
                inactive: !linked.tcnIsActive,
            };
            payload.carriedFrom = row.carriedFrom;
            return payload;
        }
        const board = await this.counterBoard(this.prisma, scope);
        payload.freeCounters = await Promise.all(board.free.map((c) => this.counterRow(this.prisma, c)));
        payload.busyCounters = board.busy.map(({ counter, session }) => ({
            counterId: counter.tcnId,
            code: counter.tcnCode,
            name: counter.tcnName,
            session,
        }));
        payload.carriedFrom =
            payload.freeCounters.find((c) => c.counterId === scope.counterId)?.carriedFrom ?? null;
        return payload;
    }
    async get(key, opts = {}) {
        const session = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
            include: { counter: { select: { tcnCode: true, tcnName: true, tcnSafeId: true } } },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        const settings = await this.context.settings({
            companyId: key.companyId,
            branchId: key.branchId,
            deviceId: session.tssDeviceId,
            userId: session.tssOperatorId,
        });
        const visible = await this.expectedVisible(session, settings, opts.asOperator === true);
        return this.toPayload(session, visible);
    }
    async getWithExpected(key) {
        const session = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
            include: { counter: { select: { tcnCode: true, tcnName: true, tcnSafeId: true } } },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        return this.toPayload(session, true);
    }
    async suspend(key, reasonId) {
        const caller = await this.context.caller();
        await this.prisma.$transaction(async (tx) => {
            const session = await this.lockOwn(tx, key, caller, [till_enum_1.TillSessionStatus.OPEN]);
            await tx.tillSession.update({
                where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                data: {
                    tssStatus: till_enum_1.TillSessionStatus.SUSPENDED,
                    tssSuspendedOn: new Date(),
                    tssSuspendCount: { increment: 1 },
                    tssModifiedOn: new Date(),
                    tssModifiedBy: caller.actorName,
                },
            });
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_SUSPEND, { reasonId });
        });
        return this.get(key, { asOperator: true });
    }
    async resume(key) {
        const caller = await this.context.caller();
        await this.prisma.$transaction(async (tx) => {
            const session = await this.lockOwn(tx, key, caller, [till_enum_1.TillSessionStatus.SUSPENDED]);
            const suspendedFor = session.tssSuspendedOn
                ? Math.round((Date.now() - session.tssSuspendedOn.getTime()) / 60000)
                : null;
            await tx.tillSession.update({
                where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                data: {
                    tssStatus: till_enum_1.TillSessionStatus.OPEN,
                    tssSuspendedOn: null,
                    tssModifiedOn: new Date(),
                    tssModifiedBy: caller.actorName,
                },
            });
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_RESUME, {
                suspendedMinutes: suspendedFor,
            });
        });
        return this.get(key, { asOperator: true });
    }
    async endBilling(key, sync = {}) {
        const caller = await this.context.caller();
        await this.assertDeviceSynced(key, sync, caller);
        await this.prisma.$transaction(async (tx) => {
            const session = await this.lockOwn(tx, key, caller, [
                till_enum_1.TillSessionStatus.OPEN,
                till_enum_1.TillSessionStatus.SUSPENDED,
            ]);
            await this.endBillingIn(tx, session, caller);
        });
        return this.get(key, { asOperator: true });
    }
    async endBillingIn(tx, session, caller, opts = {}) {
        const settings = await this.context.settings({
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            deviceId: session.tssDeviceId,
            userId: session.tssOperatorId,
        });
        const holds = await tx.$queryRaw `
      SELECT count(*)::int AS n
        FROM public.txn_hold
       WHERE txh_session_id = ${session.tssId}::uuid
         AND txh_is_deleted = false
         AND txh_kind = 'HOLD'
         AND txh_status IN ('HELD','LOCKED')`;
        const held = holds[0]?.n ?? 0;
        if (held > 0 && settings.closeWithHolds === 'BLOCK') {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.HOLDS_OPEN, `${held} held bill(s) are on this session; resume or cancel them first (till.close_with_holds = BLOCK)`, 'tssId', { holds: held });
        }
        let released = 0;
        if (held > 0) {
            released = await tx.$executeRaw `
        UPDATE public.txn_hold
           SET txh_session_id  = NULL,
               txh_counter_id  = NULL,
               txh_modified_on = now(),
               txh_modified_by = ${caller.actorName}
         WHERE txh_session_id = ${session.tssId}::uuid
           AND txh_is_deleted = false
           AND txh_kind = 'HOLD'
           AND txh_status IN ('HELD','LOCKED')`;
        }
        await tx.tillSession.update({
            where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
            data: {
                tssStatus: till_enum_1.TillSessionStatus.COUNTING,
                tssSuspendedOn: null,
                tssBillingEndedOn: new Date(),
                tssCountMode: settings.blindClose ? 'BLIND' : 'OPEN',
                tssCountPlace: opts.countPlace ?? settings.countPlace,
                tssModifiedOn: new Date(),
                tssModifiedBy: caller.actorName,
            },
        });
        await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_END_BILLING, {
            holdsReleased: released,
            countMode: settings.blindClose ? 'BLIND' : 'OPEN',
        });
    }
    async assertDeviceSynced(key, sync, caller) {
        const outbox = sync.outboxCount ?? 0;
        if (outbox <= 0 && (sync.lastClientSeq === undefined || sync.lastClientSeq === null)) {
            return;
        }
        const session = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
            },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        let serverSeq = null;
        if (sync.lastClientSeq !== undefined && sync.lastClientSeq !== null) {
            const [row] = await this.prisma.$queryRaw `
        SELECT max(tev_client_seq) AS s FROM accounts.till_event
         WHERE tev_device_id = ${session.tssDeviceId}::uuid AND tev_client_seq IS NOT NULL`;
            serverSeq = row?.s === null || row?.s === undefined ? 0 : Number(row.s);
        }
        const eventsBehind = serverSeq !== null && serverSeq < (sync.lastClientSeq ?? 0);
        if (outbox <= 0 && !eventsBehind) {
            return;
        }
        await this.events.log(this.prisma, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            code: till_enum_1.TillEventCode.SYNC_PENDING_AT_CLOSE,
            sessionId: session.tssId,
            dayId: session.tssDayId,
            counterId: session.tssCounterId,
            deviceId: caller.deviceId ?? session.tssDeviceId,
            userId: caller.userId,
            srcRefno: session.tssSessionNo,
            payload: { outboxCount: outbox, lastClientSeq: sync.lastClientSeq ?? null, serverSeq },
        });
        (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DEVICE_UNSYNCED, outbox > 0
            ? `This device still holds ${outbox} unsent document(s): let it sync, then end billing`
            : `The server has the device's journal up to ${serverSeq}, the device is at ${sync.lastClientSeq}: let it sync, then end billing`, 'outboxCount', { outboxCount: outbox, lastClientSeq: sync.lastClientSeq ?? null, serverSeq });
    }
    async count(key, input) {
        const caller = await this.context.caller();
        const supervisor = (await this.context.rights(till_enum_1.TILL_MENU.SESSIONS)).override;
        const result = await this.prisma.$transaction(async (tx) => {
            const session = await this.lockForCount(tx, key, caller, supervisor, [
                till_enum_1.TillSessionStatus.COUNTING,
            ]);
            return this.countIn(tx, session, caller, input);
        });
        const ownCount = result.operatorId === caller.userId;
        const showFigures = !result.blind || (supervisor && !ownCount);
        const variances = showFigures
            ? (await this.get(key, { asOperator: ownCount })).variances
            : null;
        return {
            tssId: key.tssId,
            tssAccYear: key.accYear,
            tctId: result.tctId,
            attemptNo: result.attemptNo,
            attemptsLeft: result.attemptsLeft,
            outcome: result.outcome,
            slipCheckRequired: result.slipCheckRequired,
            tssStatus: result.status,
            variances,
        };
    }
    async countIn(tx, session, caller, input, opts = {}) {
        const settings = await this.context.settings({
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            deviceId: session.tssDeviceId,
            userId: session.tssOperatorId,
        });
        const maxAttempts = 1 + settings.maxRecounts + session.tssRecountsGranted;
        if (!opts.forced && session.tssCountAttempts >= maxAttempts) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECOUNT_LIMIT, `${session.tssCountAttempts} count(s) already made; a further recount needs RECOUNT approval`, 'tssId', { event: 'RECOUNT', attempts: session.tssCountAttempts });
        }
        if (input.witnessBy && input.witnessBy === caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'The witness must be someone other than the counter', 'witnessBy');
        }
        const expectations = await this.ledger.expected(tx, this.expectationSession(session));
        const priced = await this.priceLines(tx, session.tssCompanyId, input.lines);
        await this.assertCountable(tx, input.lines);
        if (settings.closeByTerminal) {
            this.assertTerminalNamed(input.lines, expectations);
        }
        const counted = this.countedByTender(priced, expectations);
        const rows = this.compare(expectations, counted, settings);
        const outOfTolerance = rows.filter((r) => !r.within);
        const drawerOut = outOfTolerance.filter((r) => !isSlipRow(r));
        const slipsOut = outOfTolerance.filter(isSlipRow);
        const attemptNo = session.tssCountAttempts + 1;
        const isLast = opts.forced || attemptNo >= maxAttempts;
        const outcome = drawerOut.length === 0
            ? till_enum_1.TillCountOutcome.ACCEPTED
            : isLast
                ? till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL
                : till_enum_1.TillCountOutcome.RECOUNT_REQUIRED;
        const isFinal = outcome !== till_enum_1.TillCountOutcome.RECOUNT_REQUIRED;
        const slipCheckRequired = isFinal && slipsOut.length > 0;
        const countedRows = rows.filter((r) => r.counted !== null);
        if (isFinal) {
            await tx.tillCount.updateMany({
                where: {
                    tctSessionId: session.tssId,
                    tctAccYear: session.tssAccYear,
                    tctKind: { in: [till_enum_1.TillCountKind.CLOSE, till_enum_1.TillCountKind.RECOUNT] },
                    tctIsFinal: true,
                    tctIsDeleted: false,
                },
                data: { tctIsFinal: false },
            });
        }
        const count = await this.writeCount(tx, session, {
            kind: attemptNo === 1 ? till_enum_1.TillCountKind.CLOSE : till_enum_1.TillCountKind.RECOUNT,
            attemptNo,
            isFinal,
            isBlind: session.tssCountMode === 'BLIND',
            lines: priced,
            expected: countedRows.reduce((s, r) => s.plus(r.expectation.expected), ZERO),
            caller,
            deviceId: caller.deviceId ?? session.tssDeviceId,
            witnessBy: input.witnessBy ?? null,
            notes: input.notes ?? null,
        });
        const cash = rows.find((r) => r.expectation.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID);
        const slips = rows.filter((r) => r.expectation.closeMode === till_enum_1.TenderCloseMode.SLIPS);
        const sessionData = {
            tssCountAttempts: attemptNo,
            tssModifiedOn: new Date(),
            tssModifiedBy: caller.actorName,
        };
        const receivePending = isFinal ? await this.hasPendingReceive(tx, session) : false;
        if (isFinal) {
            await tx.tillVariance.updateMany({
                where: {
                    tvrSessionId: session.tssId,
                    tvrAccYear: session.tssAccYear,
                    tvrStage: 'CLOSE',
                    tvrStatus: 'OPEN',
                    tvrIsDeleted: false,
                },
                data: { tvrIsDeleted: true, tvrModifiedOn: new Date(), tvrModifiedBy: caller.actorName },
            });
            for (const row of countedRows) {
                await tx.tillVariance.create({
                    data: this.varianceRow(session, row, settings, caller, outcome),
                });
            }
            Object.assign(sessionData, {
                tssCloseCountId: count.tctId,
                tssCountedOn: new Date(),
                tssCountedBy: caller.userId,
                tssWitnessBy: input.witnessBy ?? null,
                tssCashExpected: cash.expectation.expected,
                tssCashCounted: cash.counted ?? ZERO,
                tssNoncashExpected: slips.reduce((s, r) => s.plus(r.expectation.expected), ZERO),
                tssNoncashCounted: slips.reduce((s, r) => s.plus(r.counted ?? ZERO), ZERO),
                tssVarianceStatus: outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL || slipCheckRequired || receivePending
                    ? till_enum_1.TillSessionVarianceStatus.PENDING
                    : rows.every((r) => r.variance.isZero())
                        ? till_enum_1.TillSessionVarianceStatus.NONE
                        : till_enum_1.TillSessionVarianceStatus.WITHIN_TOLERANCE,
                ...(outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL
                    ? { tssStatus: till_enum_1.TillSessionStatus.PENDING_APPROVAL }
                    : {}),
            });
        }
        await tx.tillSession.update({
            where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
            data: sessionData,
        });
        await this.logSessionEvent(tx, session, caller, attemptNo === 1 ? till_enum_1.TillEventCode.SESSION_COUNT : till_enum_1.TillEventCode.SESSION_RECOUNT, { attemptNo, outcome, countId: count.tctId });
        if (outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL) {
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.APPROVAL_REQUESTED, {
                event: outOfTolerance.some((r) => r.expectation.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID)
                    ? 'CASH_VARIANCE'
                    : 'NONCASH_VARIANCE',
                variance: outOfTolerance.map((r) => ({
                    tenderTypeId: r.expectation.tenderTypeId,
                    tenderId: r.expectation.tenderId,
                    variance: r.variance.toFixed(2),
                })),
            });
        }
        else if (slipCheckRequired) {
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.APPROVAL_REQUESTED, {
                event: 'NONCASH_VARIANCE',
                enforced: false,
                variance: slipsOut.map((r) => ({
                    tenderTypeId: r.expectation.tenderTypeId,
                    tenderId: r.expectation.tenderId,
                    variance: r.variance.toFixed(2),
                })),
            });
        }
        return {
            tctId: count.tctId,
            attemptNo,
            attemptsLeft: Math.max(0, maxAttempts - attemptNo),
            outcome,
            slipCheckRequired,
            status: isFinal && outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL
                ? till_enum_1.TillSessionStatus.PENDING_APPROVAL
                : session.tssStatus,
            blind: session.tssCountMode === 'BLIND',
            operatorId: session.tssOperatorId,
        };
    }
    async close(key, input) {
        const caller = await this.context.caller();
        const supervisor = (await this.context.rights(till_enum_1.TILL_MENU.SESSIONS)).override;
        await this.prisma.$transaction(async (tx) => {
            const session = await this.lockForCount(tx, key, caller, supervisor, [
                till_enum_1.TillSessionStatus.COUNTING,
                till_enum_1.TillSessionStatus.PENDING_APPROVAL,
            ]);
            await this.closeIn(tx, session, caller, input);
        });
        return this.get(key, { asOperator: true });
    }
    async closeIn(tx, session, caller, input) {
        const key = {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            tssId: session.tssId,
        };
        if (session.tssStatus === till_enum_1.TillSessionStatus.PENDING_APPROVAL) {
            const ask = this.varianceAsk(await this.pendingVariances(tx, session));
            const rule = await this.approval.ruleOrDefault(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                event: ask.event,
                onDate: (0, till_dates_1.isoDateOf)(session.tssBusinessDate),
            });
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_REQUIRED, 'The count is outside tolerance: an approver decides the variance first (sessions/decide-variance)', 'tssId', {
                event: ask.event,
                amount: num(ask.amount),
                requiredRole: rule.tar_min_role,
                channel: rule.tar_channel,
                allowSelf: rule.tar_allow_self,
            });
        }
        if (!session.tssCloseCountId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.NOT_COUNTED, 'Count the drawer first (/till/sessions/count)', 'tssId');
        }
        const undecided = (await this.pendingVariances(tx, session)).filter((v) => !isSlipVariance(v));
        if (undecided.length > 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.NOT_COUNTED, 'A drawer variance from the last count is still undecided: count the drawer again (/till/sessions/count)', 'tssId', { tenderTypeIds: undecided.map((v) => v.tvrTenderTypeId) });
        }
        const settings = await this.context.settings({
            companyId: key.companyId,
            branchId: key.branchId,
            deviceId: session.tssDeviceId,
            userId: session.tssOperatorId,
        });
        const counter = await tx.tillCounter.findUniqueOrThrow({
            where: { tcnId: session.tssCounterId },
        });
        const businessDate = (0, till_dates_1.isoDateOf)(session.tssBusinessDate);
        const postingSession = this.postingSession(session, businessDate);
        const cashCounted = dec(session.tssCashCounted);
        const floatLeft = input.floatLeft !== undefined && input.floatLeft !== null
            ? dec(input.floatLeft)
            : settings.floatMode === till_enum_1.TillFloatMode.CARRIED
                ? client_1.Prisma.Decimal.min(cashCounted, dec(counter.tcnDefaultFloat))
                : ZERO;
        if (floatLeft.isNegative() || floatLeft.greaterThan(cashCounted)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.FLOAT_INVALID, `The float left must be between 0 and the cash counted`, 'floatLeft');
        }
        const handedOver = cashCounted.minus(floatLeft);
        const variances = await tx.tillVariance.findMany({
            where: {
                tvrSessionId: session.tssId,
                tvrAccYear: session.tssAccYear,
                tvrIsDeleted: false,
                tvrStage: 'CLOSE',
                tvrStatus: 'OPEN',
            },
        });
        const tillCash = await this.ledger.tillCashTender(tx, key.companyId, key.branchId);
        for (const v of variances) {
            const treatment = v.tvrTreatment;
            if (treatment === till_enum_1.TillVarianceTreatment.PENDING ||
                treatment === till_enum_1.TillVarianceTreatment.RETENDERED) {
                continue;
            }
            const tenderLedgerId = v.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID
                ? tillCash.ledgerId
                : await this.tenderLedger(tx, v.tvrTenderId, v.tvrTenderTypeId);
            await this.posting.postVariance(tx, {
                session: postingSession,
                tvrId: v.tvrId,
                tenderLedgerId,
                tenderLabel: v.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID ? 'Cash' : `tender type ${v.tvrTenderTypeId}`,
                variance: dec(v.tvrCounted).minus(dec(v.tvrExpected)),
                treatment,
                recoveryLedgerId: v.tvrRecoveryLedgerId,
                caller,
            });
        }
        if (handedOver.greaterThan(0)) {
            const safe = await this.ledger.safeFor(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                counterSafeId: counter.tcnSafeId,
            });
            if (!safe) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, `${handedOver.toFixed(2)} goes to the safe at close, and this branch has none (Till Masters, menu 275)`, 'floatLeft');
            }
            await this.posting.postMovement(tx, {
                session: postingSession,
                kind: till_enum_1.TillMovementKind.CLOSE_HANDOVER,
                amount: handedOver,
                safe,
                tillCash,
                caller,
                countId: session.tssCloseCountId,
                awaitingLedgerId: settings.handoverReceipt === till_enum_1.TillHandoverReceipt.REQUIRED
                    ? await this.ledger.roleLedger(tx, till_enum_1.TILL_CASH_AWAITING_ROLE, key.companyId, key.branchId)
                    : null,
            });
        }
        const totals = await this.frozenTotals(tx, session);
        const zNo = session.tssZNo ?? counter.tcnZLastNo + 1;
        if (session.tssZNo === null) {
            await tx.tillCounter.update({
                where: { tcnId: counter.tcnId },
                data: { tcnZLastNo: zNo, tcnModifiedOn: new Date(), tcnModifiedBy: caller.actorName },
            });
        }
        await tx.tillSession.update({
            where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
            data: {
                ...totals,
                tssHandedOver: handedOver,
                tssFloatLeft: floatLeft,
                tssZNo: zNo,
                tssStatus: till_enum_1.TillSessionStatus.CLOSED,
                tssClosedOn: new Date(),
                tssClosedBy: caller.userId,
                tssNotes: input.notes ?? session.tssNotes,
                tssModifiedOn: new Date(),
                tssModifiedBy: caller.actorName,
            },
        });
        await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_CLOSE, {
            zNo,
            handedOver: handedOver.toFixed(2),
            floatLeft: floatLeft.toFixed(2),
            ...(session.tssReopenCount > 0 ? { reopenCount: session.tssReopenCount } : {}),
        });
    }
    async decideVariance(key, input) {
        const caller = await this.context.caller();
        const approve = input.decision === till_enum_1.TillVarianceDecision.APPROVE;
        if (!input.note.trim()) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.NOTE_REQUIRED, 'A decision note is required', 'note');
        }
        if (approve && !till_enum_1.APPROVABLE_TREATMENTS.includes(input.treatment ?? '')) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.TREATMENT_REQUIRED, 'APPROVE names a treatment: EXPENSE, RECOVER or SUSPENSE', 'treatment');
        }
        if (input.tcmId) {
            return this.decideReceive(key, input, input.tcmId, caller);
        }
        const peek = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
        });
        if (!peek) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        if (peek.tssStatus === till_enum_1.TillSessionStatus.CLOSED) {
            return this.decideAfterClose(key, input, peek, caller);
        }
        this.assertPendingApproval(peek);
        const ask = this.varianceAsk(await this.pendingVariances(this.prisma, peek));
        const { rule, verdict, treatment, reason, recoveryLedgerId } = await this.judgeCloseDecision(peek, ask, input, caller);
        const tapId = await this.prisma.$transaction(async (tx) => {
            const session = await this.lock(tx, key, [till_enum_1.TillSessionStatus.PENDING_APPROVAL]);
            const pending = await this.pendingVariances(tx, session);
            const now = new Date();
            const id = await this.approval.record(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                tenantId: session.tssTenantId,
                accYear: session.tssAccYear,
                event: ask.event,
                sessionId: session.tssId,
                counterId: session.tssCounterId,
                srcDocType: 'TILL_SESSION',
                srcDocId: session.tssId,
                srcRefno: session.tssSessionNo,
                amount: ask.amount,
                rule,
                verdict,
                requestedBy: session.tssOperatorId,
                requestedOn: session.tssCountedOn ?? now,
                reasonId: reason?.trsId ?? null,
                status: approve ? 'APPROVED' : 'REJECTED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: input.note.trim(),
                payload: {
                    decision: input.decision,
                    treatment,
                    variances: pending.map((v) => ({
                        tvrId: v.tvrId,
                        tenderTypeId: v.tvrTenderTypeId,
                        variance: dec(v.tvrCounted).minus(dec(v.tvrExpected)).toFixed(2),
                    })),
                },
            });
            if (approve && treatment) {
                for (const v of pending) {
                    await tx.tillVariance.update({
                        where: { tvrId_tvrAccYear: { tvrId: v.tvrId, tvrAccYear: v.tvrAccYear } },
                        data: {
                            tvrTreatment: treatment,
                            tvrReasonId: reason.trsId,
                            tvrRecoveryLedgerId: recoveryLedgerId,
                            tvrApprovalId: id,
                            tvrDecidedBy: caller.userId,
                            tvrDecidedOn: now,
                            tvrNotes: input.note.trim(),
                            tvrModifiedOn: now,
                            tvrModifiedBy: caller.actorName,
                        },
                    });
                }
                await tx.tillSession.update({
                    where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                    data: {
                        tssStatus: till_enum_1.TillSessionStatus.COUNTING,
                        tssVarianceStatus: (await this.hasPendingReceive(tx, session))
                            ? till_enum_1.TillSessionVarianceStatus.PENDING
                            : till_enum_1.VARIANCE_STATUS_OF_TREATMENT[treatment],
                        tssCloseApprovalId: id,
                        tssModifiedOn: now,
                        tssModifiedBy: caller.actorName,
                    },
                });
            }
            else {
                await tx.tillSession.update({
                    where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                    data: {
                        tssStatus: till_enum_1.TillSessionStatus.COUNTING,
                        tssRecountsGranted: { increment: 1 },
                        tssCloseCountId: null,
                        tssCountedOn: null,
                        tssCountedBy: null,
                        tssWitnessBy: null,
                        tssCashCounted: ZERO,
                        tssNoncashCounted: ZERO,
                        tssModifiedOn: now,
                        tssModifiedBy: caller.actorName,
                    },
                });
            }
            await this.events.log(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.VARIANCE_DECIDED,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: caller.deviceId ?? session.tssDeviceId,
                userId: caller.userId,
                srcDocType: 'TILL_SESSION',
                srcDocId: session.tssId,
                srcRefno: session.tssSessionNo,
                amount: ask.amount,
                reasonId: reason?.trsId ?? null,
                approvalId: id,
                payload: {
                    stage: 'CLOSE',
                    decision: input.decision,
                    treatment,
                    event: ask.event,
                    amount: ask.amount.toFixed(2),
                    requiredRole: rule.tar_min_role,
                    approverRole: verdict.role,
                    channel: verdict.channel,
                    implicitGrant: verdict.implicit,
                    grantId: verdict.grantId,
                    reasonId: reason?.trsId ?? null,
                    recoveryLedgerId,
                    variances: pending.map((v) => v.tvrId),
                },
            });
            return id;
        });
        return {
            tapId,
            decision: input.decision,
            event: ask.event,
            amount: num(ask.amount),
            requiredRole: rule.tar_min_role,
            approverRole: verdict.role,
            channel: verdict.channel,
            treatment,
            tcmId: null,
            session: await this.get(key),
        };
    }
    async judgeCloseDecision(peek, ask, input, caller) {
        const rule = await this.approval.ruleOrDefault(this.prisma, {
            companyId: peek.tssCompanyId,
            branchId: peek.tssBranchId,
            event: ask.event,
            onDate: (0, till_dates_1.isoDateOf)(peek.tssBusinessDate),
        });
        let verdict;
        try {
            verdict = await this.approval.assertApprover(this.prisma, {
                companyId: peek.tssCompanyId,
                branchId: peek.tssBranchId,
                event: ask.event,
                amount: ask.amount,
                rule,
                approverId: caller.userId,
                requesterId: peek.tssOperatorId,
                pin: input.approverPin,
            });
        }
        catch (error) {
            if (input.approverPin?.trim() && (0, till_errors_1.tillErrorCodeOf)(error) === till_enum_1.TillErrorCode.APPROVER_PIN) {
                await this.events.log(this.prisma, {
                    companyId: peek.tssCompanyId,
                    branchId: peek.tssBranchId,
                    accYear: peek.tssAccYear,
                    code: till_enum_1.TillEventCode.PIN_FAIL,
                    sessionId: peek.tssId,
                    dayId: peek.tssDayId,
                    counterId: peek.tssCounterId,
                    deviceId: caller.deviceId ?? peek.tssDeviceId,
                    userId: caller.userId,
                    srcRefno: peek.tssSessionNo,
                    payload: { action: 'decide-variance', event: ask.event },
                });
            }
            throw error;
        }
        const treatment = input.decision === till_enum_1.TillVarianceDecision.APPROVE
            ? input.treatment
            : null;
        const reason = treatment
            ? await this.varianceReason(this.prisma, {
                companyId: peek.tssCompanyId,
                reasonId: input.reasonId,
                event: ask.event,
            })
            : null;
        let recoveryLedgerId = null;
        if (treatment === till_enum_1.TillVarianceTreatment.RECOVER) {
            const staff = await this.staffLedgerOf(this.prisma, peek.tssOperatorId);
            if (!staff.ledgerId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `RECOVER posts to the cashier’s staff advance ledger, and ${staff.login} has none (an employee with a loan ledger, notes 95)`, 'treatment', { treatment, operatorId: peek.tssOperatorId });
            }
            recoveryLedgerId = staff.ledgerId;
        }
        return { rule, verdict, treatment, reason, recoveryLedgerId };
    }
    async decideAfterClose(key, input, peek, caller) {
        const drawerPending = async (client, session) => (await this.pendingVariances(client, session)).filter((v) => !isSlipVariance(v));
        const pending = await drawerPending(this.prisma, peek);
        if (pending.length === 0) {
            this.assertPendingApproval(peek);
        }
        if (input.decision !== till_enum_1.TillVarianceDecision.APPROVE) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.RECOUNT_NOT_ALLOWED, `Session ${peek.tssSessionNo} is CLOSED and its cash was handed over: there is nothing to recount. APPROVE the gap with a treatment (SUSPENSE to look into it)`, 'decision');
        }
        const ask = this.varianceAsk(pending);
        const { rule, verdict, treatment, reason, recoveryLedgerId } = await this.judgeCloseDecision(peek, ask, input, caller);
        const posted = treatment;
        const tapId = await this.prisma.$transaction(async (tx) => {
            const session = await this.lock(tx, key, [till_enum_1.TillSessionStatus.CLOSED]);
            const rows = await drawerPending(tx, session);
            if (rows.length === 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VARIANCE_NOT_PENDING, `Session ${session.tssSessionNo} has no drawer variance waiting for a decision`, 'tssId');
            }
            const now = new Date();
            const id = await this.approval.record(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                tenantId: session.tssTenantId,
                accYear: session.tssAccYear,
                event: ask.event,
                sessionId: session.tssId,
                counterId: session.tssCounterId,
                srcDocType: 'TILL_SESSION',
                srcDocId: session.tssId,
                srcRefno: session.tssSessionNo,
                amount: ask.amount,
                rule,
                verdict,
                requestedBy: session.tssOperatorId,
                requestedOn: session.tssCountedOn ?? session.tssClosedOn ?? now,
                reasonId: reason.trsId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: input.note.trim(),
                payload: {
                    decision: input.decision,
                    treatment,
                    afterClose: true,
                    variances: rows.map((v) => ({
                        tvrId: v.tvrId,
                        tenderTypeId: v.tvrTenderTypeId,
                        variance: dec(v.tvrCounted).minus(dec(v.tvrExpected)).toFixed(2),
                    })),
                },
            });
            const postingSession = this.postingSession(session, (0, till_dates_1.isoDateOf)(session.tssBusinessDate));
            const tillCash = await this.ledger.tillCashTender(tx, session.tssCompanyId, session.tssBranchId);
            for (const v of rows) {
                await tx.tillVariance.update({
                    where: { tvrId_tvrAccYear: { tvrId: v.tvrId, tvrAccYear: v.tvrAccYear } },
                    data: {
                        tvrTreatment: posted,
                        tvrReasonId: reason.trsId,
                        tvrRecoveryLedgerId: recoveryLedgerId,
                        tvrApprovalId: id,
                        tvrDecidedBy: caller.userId,
                        tvrDecidedOn: now,
                        tvrNotes: input.note.trim(),
                        tvrModifiedOn: now,
                        tvrModifiedBy: caller.actorName,
                    },
                });
                await this.posting.postVariance(tx, {
                    session: postingSession,
                    tvrId: v.tvrId,
                    tenderLedgerId: v.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID
                        ? tillCash.ledgerId
                        : await this.tenderLedger(tx, v.tvrTenderId, v.tvrTenderTypeId),
                    tenderLabel: v.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID ? 'Cash' : `tender type ${v.tvrTenderTypeId}`,
                    variance: dec(v.tvrCounted).minus(dec(v.tvrExpected)),
                    treatment: posted,
                    recoveryLedgerId,
                    caller,
                });
            }
            await tx.tillSession.update({
                where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                data: {
                    tssVarianceStatus: (await this.hasAnyPending(tx, session))
                        ? till_enum_1.TillSessionVarianceStatus.PENDING
                        : till_enum_1.VARIANCE_STATUS_OF_TREATMENT[posted],
                    tssCloseApprovalId: session.tssCloseApprovalId ?? id,
                    tssModifiedOn: now,
                    tssModifiedBy: caller.actorName,
                },
            });
            await this.events.log(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.VARIANCE_DECIDED,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: caller.deviceId ?? session.tssDeviceId,
                userId: caller.userId,
                srcDocType: 'TILL_SESSION',
                srcDocId: session.tssId,
                srcRefno: session.tssSessionNo,
                amount: ask.amount,
                reasonId: reason.trsId,
                approvalId: id,
                payload: {
                    stage: 'CLOSE',
                    afterClose: true,
                    decision: input.decision,
                    treatment,
                    event: ask.event,
                    amount: ask.amount.toFixed(2),
                    requiredRole: rule.tar_min_role,
                    approverRole: verdict.role,
                    channel: verdict.channel,
                    implicitGrant: verdict.implicit,
                    grantId: verdict.grantId,
                    reasonId: reason.trsId,
                    recoveryLedgerId,
                    variances: rows.map((v) => v.tvrId),
                },
            });
            return id;
        });
        return {
            tapId,
            decision: input.decision,
            event: ask.event,
            amount: num(ask.amount),
            requiredRole: rule.tar_min_role,
            approverRole: verdict.role,
            channel: verdict.channel,
            treatment,
            tcmId: null,
            session: await this.get(key),
        };
    }
    async decideReceive(key, input, tcmId, caller) {
        if (input.decision !== till_enum_1.TillVarianceDecision.APPROVE) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.RECOUNT_NOT_ALLOWED, 'A received bag is not recounted: APPROVE its difference with a treatment (SUSPENSE to look into it)', 'decision');
        }
        const treatment = input.treatment;
        const peek = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
        });
        if (!peek) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        const pendingOf = (client) => client.tillVariance.findFirst({
            where: {
                tvrSessionId: peek.tssId,
                tvrAccYear: peek.tssAccYear,
                tvrStage: till_enum_1.TillVarianceStage.RECEIVE,
                tvrMovementId: tcmId,
                tvrIsDeleted: false,
                tvrStatus: 'OPEN',
                tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
            },
        });
        const pending = await pendingOf(this.prisma);
        const movement = pending
            ? await this.prisma.tillCashMovement.findUnique({
                where: { tcmId_tcmAccYear: { tcmId, tcmAccYear: peek.tssAccYear } },
            })
            : null;
        if (!pending || !movement?.tcmReceivedBy) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VARIANCE_NOT_PENDING, `Movement ${movement?.tcmDocNo ?? tcmId} of session ${peek.tssSessionNo} has no receive difference waiting for a decision`, 'tcmId');
        }
        const variance = dec(pending.tvrCounted).minus(dec(pending.tvrExpected));
        const amount = variance.abs();
        const event = 'CASH_VARIANCE';
        const settings = await this.context.settings({
            companyId: key.companyId,
            branchId: key.branchId,
        });
        const today = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const rule = await this.approval.ruleOrDefault(this.prisma, {
            companyId: key.companyId,
            branchId: key.branchId,
            event,
            onDate: today,
        });
        if (caller.userId === peek.tssOperatorId && !rule.tar_allow_self) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVER_SELF, 'The cashier whose bag it is does not decide its receive difference', 'userId', { event, requiredRole: rule.tar_min_role });
        }
        let verdict;
        try {
            verdict = await this.approval.assertApprover(this.prisma, {
                companyId: key.companyId,
                branchId: key.branchId,
                event,
                amount,
                rule,
                approverId: caller.userId,
                requesterId: movement.tcmReceivedBy,
                pin: input.approverPin,
            });
        }
        catch (error) {
            if (input.approverPin?.trim() && (0, till_errors_1.tillErrorCodeOf)(error) === till_enum_1.TillErrorCode.APPROVER_PIN) {
                await this.events.log(this.prisma, {
                    companyId: peek.tssCompanyId,
                    branchId: peek.tssBranchId,
                    accYear: peek.tssAccYear,
                    code: till_enum_1.TillEventCode.PIN_FAIL,
                    sessionId: peek.tssId,
                    dayId: peek.tssDayId,
                    counterId: peek.tssCounterId,
                    deviceId: caller.deviceId ?? peek.tssDeviceId,
                    userId: caller.userId,
                    srcRefno: movement.tcmDocNo,
                    payload: { action: 'decide-variance', event, stage: till_enum_1.TillVarianceStage.RECEIVE, tcmId },
                });
            }
            throw error;
        }
        const reason = await this.varianceReason(this.prisma, {
            companyId: key.companyId,
            reasonId: input.reasonId,
            event,
        });
        let recoveryLedgerId = null;
        if (treatment === till_enum_1.TillVarianceTreatment.RECOVER) {
            const staff = await this.staffLedgerOf(this.prisma, peek.tssOperatorId);
            if (!staff.ledgerId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `RECOVER posts to the cashier’s staff advance ledger, and ${staff.login} has none (an employee with a loan ledger, notes 95)`, 'treatment', { treatment, operatorId: peek.tssOperatorId });
            }
            recoveryLedgerId = staff.ledgerId;
        }
        const tapId = await this.prisma.$transaction(async (tx) => {
            const session = await this.lock(tx, key, Object.values(till_enum_1.TillSessionStatus));
            const row = await pendingOf(tx);
            if (!row) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VARIANCE_NOT_PENDING, `Movement ${movement.tcmDocNo} has no receive difference waiting for a decision`, 'tcmId');
            }
            const now = new Date();
            const id = await this.approval.record(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                tenantId: session.tssTenantId,
                accYear: session.tssAccYear,
                event,
                sessionId: session.tssId,
                counterId: session.tssCounterId,
                srcDocType: 'TILL_MOVEMENT',
                srcDocId: tcmId,
                srcRefno: movement.tcmDocNo,
                amount,
                rule,
                verdict,
                requestedBy: movement.tcmReceivedBy,
                requestedOn: movement.tcmReceivedOn ?? now,
                reasonId: reason.trsId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: input.note.trim(),
                payload: {
                    decision: input.decision,
                    treatment,
                    stage: till_enum_1.TillVarianceStage.RECEIVE,
                    tcmId,
                    variances: [
                        { tvrId: row.tvrId, tenderTypeId: row.tvrTenderTypeId, variance: variance.toFixed(2) },
                    ],
                },
            });
            await tx.tillVariance.update({
                where: { tvrId_tvrAccYear: { tvrId: row.tvrId, tvrAccYear: row.tvrAccYear } },
                data: {
                    tvrTreatment: treatment,
                    tvrReasonId: reason.trsId,
                    tvrRecoveryLedgerId: recoveryLedgerId,
                    tvrApprovalId: id,
                    tvrDecidedBy: caller.userId,
                    tvrDecidedOn: now,
                    tvrNotes: input.note.trim(),
                    tvrModifiedOn: now,
                    tvrModifiedBy: caller.actorName,
                },
            });
            await this.posting.postVariance(tx, {
                session: this.postingSession(session, (0, till_dates_1.isoDateOf)(session.tssBusinessDate)),
                tvrId: row.tvrId,
                tenderLedgerId: await this.ledger.roleLedger(tx, till_enum_1.TILL_CASH_AWAITING_ROLE, session.tssCompanyId, session.tssBranchId),
                tenderLabel: `Cash received (${movement.tcmDocNo})`,
                variance,
                treatment: treatment,
                recoveryLedgerId,
                caller,
                on: { date: today, accYear: (0, till_dates_1.accYearOf)(today) },
            });
            await tx.tillSession.update({
                where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                data: {
                    tssVarianceStatus: (await this.hasAnyPending(tx, session))
                        ? till_enum_1.TillSessionVarianceStatus.PENDING
                        : till_enum_1.VARIANCE_STATUS_OF_TREATMENT[treatment],
                    tssModifiedOn: now,
                    tssModifiedBy: caller.actorName,
                },
            });
            await this.events.log(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.VARIANCE_DECIDED,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: caller.deviceId ?? session.tssDeviceId,
                userId: caller.userId,
                srcDocType: 'TILL_MOVEMENT',
                srcDocId: tcmId,
                srcRefno: movement.tcmDocNo,
                amount,
                reasonId: reason.trsId,
                approvalId: id,
                payload: {
                    stage: till_enum_1.TillVarianceStage.RECEIVE,
                    decision: input.decision,
                    treatment,
                    event,
                    amount: amount.toFixed(2),
                    requiredRole: rule.tar_min_role,
                    approverRole: verdict.role,
                    channel: verdict.channel,
                    implicitGrant: verdict.implicit,
                    grantId: verdict.grantId,
                    reasonId: reason.trsId,
                    recoveryLedgerId,
                    tcmId,
                    variances: [row.tvrId],
                },
            });
            return id;
        });
        return {
            tapId,
            decision: input.decision,
            event,
            amount: num(amount),
            requiredRole: rule.tar_min_role,
            approverRole: verdict.role,
            channel: verdict.channel,
            treatment,
            tcmId,
            session: await this.get(key),
        };
    }
    async hasPendingReceive(client, session) {
        const n = await client.tillVariance.count({
            where: {
                tvrSessionId: session.tssId,
                tvrAccYear: session.tssAccYear,
                tvrStage: till_enum_1.TillVarianceStage.RECEIVE,
                tvrIsDeleted: false,
                tvrStatus: 'OPEN',
                tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
            },
        });
        return n > 0;
    }
    async hasAnyPending(client, session) {
        const n = await client.tillVariance.count({
            where: {
                tvrSessionId: session.tssId,
                tvrAccYear: session.tssAccYear,
                tvrIsDeleted: false,
                tvrStatus: 'OPEN',
                tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
            },
        });
        return n > 0;
    }
    assertPendingApproval(session) {
        if (session.tssStatus !== till_enum_1.TillSessionStatus.PENDING_APPROVAL) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${session.tssSessionNo} is ${session.tssStatus}; a variance is decided on a PENDING_APPROVAL session`, 'tssId', { status: session.tssStatus });
        }
    }
    async pendingVariances(client, session) {
        return client.tillVariance.findMany({
            where: {
                tvrSessionId: session.tssId,
                tvrAccYear: session.tssAccYear,
                tvrIsDeleted: false,
                tvrStage: 'CLOSE',
                tvrStatus: 'OPEN',
                tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
            },
            orderBy: { tvrTenderTypeId: 'asc' },
        });
    }
    varianceAsk(pending) {
        return {
            event: pending.some((p) => p.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID)
                ? 'CASH_VARIANCE'
                : 'NONCASH_VARIANCE',
            amount: pending.reduce((s, p) => s.plus(dec(p.tvrCounted).minus(dec(p.tvrExpected)).abs()), ZERO),
        };
    }
    async varianceReason(client, input) {
        const category = input.event === 'NONCASH_VARIANCE' ? 'NONCASH' : 'VARIANCE';
        if (!input.reasonId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `APPROVE names a ${category} reason`, 'reasonId');
        }
        const reason = await client.tillReason.findFirst({
            where: {
                trsId: input.reasonId,
                trsCategory: category,
                trsIsDeleted: false,
                trsIsActive: true,
                OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
            },
        });
        if (!reason) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `The reason must be an active ${category} reason`, 'reasonId');
        }
        return reason;
    }
    async staffLedgerOf(client, userId) {
        const [row] = await client.$queryRaw `
      SELECT u.usr_login_name AS login, e.emp_loan_ledger_id::text AS ledger
        FROM public.user_master u
        LEFT JOIN public.employee_master e
          ON e.emp_id = u.usr_employee_id AND e.emp_is_deleted = false
       WHERE u.usr_id = ${userId}::uuid`;
        return { login: row?.login ?? userId, ledgerId: row?.ledger ?? null };
    }
    async forceClose(key, input) {
        const caller = await this.context.caller();
        const peek = await this.peekSession(key);
        if (!FORCE_CLOSABLE.includes(peek.tssStatus)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_OPEN, peek.tssStatus === till_enum_1.TillSessionStatus.PENDING_APPROVAL
                ? `Session ${peek.tssSessionNo} is counted and waits for its variance decision (sessions/decide-variance), then /close`
                : `Session ${peek.tssSessionNo} is ${peek.tssStatus}: only a live session is force-closed`, 'tssId', { status: peek.tssStatus });
        }
        const reason = await this.exceptionReason(this.prisma, {
            companyId: key.companyId,
            category: 'FORCE_CLOSE',
            reasonId: input.reasonId,
            notes: input.notes ?? null,
        });
        const { rule, verdict } = await this.exceptionApprover(peek, caller, {
            event: 'FORCE_CLOSE',
            requesterId: peek.tssOperatorId,
            pin: input.approverPin ?? null,
            onDate: (0, till_dates_1.isoDateOf)(peek.tssBusinessDate),
        });
        const done = await this.prisma.$transaction(async (tx) => {
            const session = await this.lock(tx, key, [...FORCE_CLOSABLE]);
            const now = new Date();
            const tapId = await this.approval.record(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                tenantId: session.tssTenantId,
                accYear: session.tssAccYear,
                event: 'FORCE_CLOSE',
                sessionId: session.tssId,
                counterId: session.tssCounterId,
                srcDocType: 'TILL_SESSION',
                srcDocId: session.tssId,
                srcRefno: session.tssSessionNo,
                amount: ZERO,
                rule,
                verdict,
                requestedBy: session.tssOperatorId,
                requestedOn: now,
                reasonId: reason.trsId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: input.notes?.trim() || reason.trsName,
                payload: { action: 'force-close', status: session.tssStatus },
            });
            const result = await this.forceCloseIn(tx, session, caller, {
                reasonId: reason.trsId,
                approvalId: tapId,
                lines: input.lines,
                floatLeft: input.floatLeft ?? null,
                notes: input.notes ?? null,
            });
            return { ...result, tapId };
        });
        return {
            outcome: done.outcome,
            tapId: done.tapId,
            tctId: done.tctId,
            session: await this.get(key),
        };
    }
    async forceCloseIn(tx, session, caller, input) {
        const reread = () => tx.tillSession.findUniqueOrThrow({
            where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
        });
        if (session.tssStatus !== till_enum_1.TillSessionStatus.COUNTING) {
            await this.endBillingIn(tx, session, caller, { countPlace: 'CASH_OFFICE' });
        }
        await tx.tillSession.update({
            where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
            data: {
                tssForceClosed: true,
                tssForceReasonId: input.reasonId,
                tssCountPlace: 'CASH_OFFICE',
                tssModifiedOn: new Date(),
                tssModifiedBy: caller.actorName,
            },
        });
        const counted = await this.countIn(tx, await reread(), caller, { lines: input.lines, notes: input.notes }, { forced: true });
        const outcome = counted.outcome === till_enum_1.TillCountOutcome.ACCEPTED ? 'CLOSED' : 'SENT_FOR_APPROVAL';
        await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_FORCE_CLOSE, {
            reasonId: input.reasonId,
            approvalId: input.approvalId,
            countId: counted.tctId,
            outcome,
            cashierId: session.tssOperatorId,
        });
        if (outcome === 'CLOSED') {
            await this.closeIn(tx, await reread(), caller, {
                floatLeft: input.floatLeft,
                notes: input.notes,
            });
            if (input.receiveHandOver) {
                await this.receiveOwnHandOver(tx, await reread(), caller, counted.tctId);
            }
        }
        return { outcome, tctId: counted.tctId };
    }
    async receiveOwnHandOver(tx, session, caller, countId) {
        const waiting = await tx.tillCashMovement.findMany({
            where: {
                tcmSessionId: session.tssId,
                tcmAccYear: session.tssAccYear,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmKind: till_enum_1.TillMovementKind.CLOSE_HANDOVER,
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.AWAITING,
            },
        });
        if (waiting.length === 0) {
            return;
        }
        const settings = await this.context.settings({
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
        });
        const today = await (0, till_dates_1.businessDateNow)(tx, settings.dayCutoff);
        const awaitingLedgerId = await this.ledger.roleLedger(tx, till_enum_1.TILL_CASH_AWAITING_ROLE, session.tssCompanyId, session.tssBranchId);
        for (const m of waiting) {
            const safe = await tx.tillSafe.findUniqueOrThrow({
                where: { tsfId: m.tcmSafeId },
                select: { tsfId: true, tsfLedgerId: true, tsfName: true },
            });
            await this.posting.postReceive(tx, {
                movement: m,
                session: this.postingSession(session, (0, till_dates_1.isoDateOf)(session.tssBusinessDate)),
                safe: { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName },
                awaitingLedgerId,
                received: new client_1.Prisma.Decimal(m.tcmAmount),
                countId,
                on: { date: today, accYear: (0, till_dates_1.accYearOf)(today) },
                caller,
                notes: 'Received on the supervisor’s own count at the day close (notes 117)',
            });
        }
    }
    async lockForForce(tx, key) {
        return this.lock(tx, key, [...FORCE_CLOSABLE]);
    }
    async reopen(key, input) {
        const caller = await this.context.caller();
        const peek = await this.peekSession(key);
        await this.assertReopenable(this.prisma, peek);
        const reason = await this.exceptionReason(this.prisma, {
            companyId: key.companyId,
            category: 'REOPEN',
            reasonId: input.reasonId,
            notes: input.notes ?? null,
        });
        const { rule, verdict } = await this.exceptionApprover(peek, caller, {
            event: 'SESSION_REOPEN',
            requesterId: peek.tssOperatorId,
            pin: input.approverPin ?? null,
            onDate: (0, till_dates_1.isoDateOf)(peek.tssBusinessDate),
        });
        const reasonText = input.notes?.trim()
            ? `${reason.trsName} — ${input.notes.trim()}`
            : reason.trsName;
        const done = await this.prisma.$transaction(async (tx) => {
            const session = await this.lock(tx, key, [till_enum_1.TillSessionStatus.CLOSED]);
            await tx.$queryRaw `
        SELECT tcm_id FROM accounts.till_cash_movement
         WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_acc_year = ${session.tssAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_kind = 'CLOSE_HANDOVER'
           FOR UPDATE`;
            await this.assertReopenable(tx, session);
            const now = new Date();
            const tapId = await this.approval.record(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                tenantId: session.tssTenantId,
                accYear: session.tssAccYear,
                event: 'SESSION_REOPEN',
                sessionId: session.tssId,
                counterId: session.tssCounterId,
                srcDocType: 'TILL_SESSION',
                srcDocId: session.tssId,
                srcRefno: session.tssSessionNo,
                amount: ZERO,
                rule,
                verdict,
                requestedBy: session.tssOperatorId,
                requestedOn: now,
                reasonId: reason.trsId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: reasonText,
                payload: { action: 'reopen', zNo: session.tssZNo },
            });
            const posting = this.postingSession(session, (0, till_dates_1.isoDateOf)(session.tssBusinessDate));
            const reversals = [];
            const handOvers = await tx.tillCashMovement.findMany({
                where: {
                    tcmSessionId: session.tssId,
                    tcmAccYear: session.tssAccYear,
                    tcmIsDeleted: false,
                    tcmStatus: 'POSTED',
                    tcmKind: till_enum_1.TillMovementKind.CLOSE_HANDOVER,
                },
            });
            for (const m of handOvers) {
                const rev = await this.posting.voidMovement(tx, {
                    movement: m,
                    session: posting,
                    reasonId: reason.trsId,
                    reasonText: `session reopened: ${reasonText}`,
                    caller,
                    approvalId: tapId,
                });
                if (rev) {
                    reversals.push(rev);
                }
            }
            const posted = await tx.tillVariance.findMany({
                where: {
                    tvrSessionId: session.tssId,
                    tvrAccYear: session.tssAccYear,
                    tvrIsDeleted: false,
                    tvrStage: till_enum_1.TillVarianceStage.CLOSE,
                    tvrStatus: 'POSTED',
                },
            });
            for (const v of posted) {
                const rev = await this.posting.reverseVariance(tx, {
                    variance: v,
                    reasonText: `session ${session.tssSessionNo} reopened: ${reasonText}`,
                    caller,
                });
                if (rev) {
                    reversals.push(rev);
                }
            }
            await tx.tillSession.update({
                where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
                data: {
                    tssStatus: till_enum_1.TillSessionStatus.COUNTING,
                    tssClosedOn: null,
                    tssClosedBy: null,
                    tssCloseCountId: null,
                    tssCountedOn: null,
                    tssCountedBy: null,
                    tssWitnessBy: null,
                    tssCashCounted: ZERO,
                    tssNoncashCounted: ZERO,
                    tssHandedOver: ZERO,
                    tssFloatLeft: ZERO,
                    tssCloseApprovalId: null,
                    tssReopenCount: { increment: 1 },
                    tssRecountsGranted: { increment: 1 },
                    tssVarianceStatus: (await this.hasAnyPending(tx, session))
                        ? till_enum_1.TillSessionVarianceStatus.PENDING
                        : till_enum_1.TillSessionVarianceStatus.NONE,
                    tssModifiedOn: now,
                    tssModifiedBy: caller.actorName,
                },
            });
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_REOPEN, {
                reasonId: reason.trsId,
                approvalId: tapId,
                zNo: session.tssZNo,
                reopenCount: session.tssReopenCount + 1,
                reversalVoucherIds: reversals,
            });
            return { tapId, reversals };
        });
        return {
            tapId: done.tapId,
            reversalVoucherIds: done.reversals,
            session: await this.get(key),
        };
    }
    async assertReopenable(client, session) {
        if (session.tssStatus !== till_enum_1.TillSessionStatus.CLOSED) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${session.tssSessionNo} is ${session.tssStatus}: only a CLOSED session is reopened`, 'tssId', { status: session.tssStatus });
        }
        const day = await client.tillBusinessDay.findUnique({
            where: { tbdId_tbdAccYear: { tbdId: session.tssDayId, tbdAccYear: session.tssAccYear } },
            select: { tbdStatus: true, tbdBusinessDate: true },
        });
        if (day?.tbdStatus === till_enum_1.TillDayStatus.CLOSED) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSED, `Business day ${(0, till_dates_1.isoDateOf)(day.tbdBusinessDate)} is closed: reopen the day first (days/reopen)`, 'tssId', { businessDate: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate) });
        }
        const received = await client.tillCashMovement.findFirst({
            where: {
                tcmSessionId: session.tssId,
                tcmAccYear: session.tssAccYear,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmKind: till_enum_1.TillMovementKind.CLOSE_HANDOVER,
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.RECEIVED,
            },
            select: { tcmDocNo: true, tcmReceivedBy: true, tcmReceivedOn: true },
        });
        if (received) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.CASH_ALREADY_APPROVED, `Session ${session.tssSessionNo}'s cash (${received.tcmDocNo}) is already approved into the safe: undoing that receipt is a safe matter, so the session stays closed`, 'tssId', {
                receivedBy: received.tcmReceivedBy ?? '',
                receivedOn: received.tcmReceivedOn?.toISOString() ?? '',
            });
        }
        const next = await client.tillSession.findFirst({
            where: {
                tssIsDeleted: false,
                tssStatus: { not: till_enum_1.TillSessionStatus.VOIDED },
                OR: [
                    { tssPrevSessionId: session.tssId },
                    {
                        tssCounterId: session.tssCounterId,
                        tssAccYear: session.tssAccYear,
                        tssStatus: { in: [...till_enum_1.LIVE_SESSION_STATUSES] },
                    },
                ],
            },
            select: { tssSessionNo: true, tssStatus: true, tssPrevSessionId: true },
        });
        if (next) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REOPEN_BLOCKED, next.tssPrevSessionId === session.tssId
                ? `Session ${next.tssSessionNo} opened on the float ${session.tssSessionNo} left: it cannot be reopened under it`
                : `Session ${next.tssSessionNo} is ${next.tssStatus} on the same counter: close it first`, 'tssId', { sessionNo: next.tssSessionNo, status: next.tssStatus });
        }
    }
    async xReport(key) {
        const caller = await this.context.caller();
        const read = await this.prisma.$transaction(async (tx) => {
            const session = await this.lock(tx, key, [
                till_enum_1.TillSessionStatus.OPEN,
                till_enum_1.TillSessionStatus.SUSPENDED,
                till_enum_1.TillSessionStatus.COUNTING,
                till_enum_1.TillSessionStatus.PENDING_APPROVAL,
            ]);
            const [prior] = await tx.$queryRaw `
        SELECT count(*)::int AS n FROM accounts.till_event
         WHERE tev_session_id = ${session.tssId}::uuid
           AND tev_acc_year = ${session.tssAccYear}::char(9)
           AND tev_event_code = ${till_enum_1.TillEventCode.X_REPORT}
           AND tev_payload ? 'xNo'`;
            const xNo = (prior?.n ?? 0) + 1;
            const readOn = new Date();
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.X_REPORT, {
                xNo,
                readOn: readOn.toISOString(),
            });
            return { xNo, readOn };
        });
        return {
            ...(await this.getWithExpected(key)),
            xNo: read.xNo,
            xReadOn: read.readOn.toISOString(),
        };
    }
    async exceptionReason(client, input) {
        const reason = input.reasonId
            ? await client.tillReason.findFirst({
                where: {
                    trsId: input.reasonId,
                    trsCategory: input.category,
                    trsIsDeleted: false,
                    trsIsActive: true,
                    OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
                },
            })
            : null;
        if (!reason) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `Name an active ${input.category} reason`, 'reasonId', { category: input.category });
        }
        if (reason.trsNeedsNote && !input.notes?.trim()) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
        }
        return reason;
    }
    async exceptionApprover(session, caller, ask) {
        const rule = await this.approval.ruleOrDefault(this.prisma, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            event: ask.event,
            onDate: ask.onDate,
        });
        try {
            const verdict = await this.approval.assertApprover(this.prisma, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                event: ask.event,
                amount: ZERO,
                rule,
                approverId: caller.userId,
                requesterId: ask.requesterId,
                pin: ask.pin,
            });
            return { rule, verdict };
        }
        catch (error) {
            if (ask.pin?.trim() && (0, till_errors_1.tillErrorCodeOf)(error) === till_enum_1.TillErrorCode.APPROVER_PIN) {
                await this.events.log(this.prisma, {
                    companyId: session.tssCompanyId,
                    branchId: session.tssBranchId,
                    accYear: session.tssAccYear,
                    code: till_enum_1.TillEventCode.PIN_FAIL,
                    sessionId: session.tssId,
                    dayId: session.tssDayId,
                    counterId: session.tssCounterId,
                    deviceId: caller.deviceId ?? session.tssDeviceId,
                    userId: caller.userId,
                    srcRefno: session.tssSessionNo,
                    payload: { action: ask.event.toLowerCase(), event: ask.event },
                });
            }
            throw error;
        }
    }
    async peekSession(key) {
        const session = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        return session;
    }
    async resolveForMoney(client, scope) {
        const caller = await this.context.caller(client);
        if (!caller.deviceId) {
            return null;
        }
        const limits = {
            tcnId: true,
            tcnRequiresSession: true,
            tcnCashAlertLimit: true,
            tcnCashBlockLimit: true,
        };
        const held = await client.tillSession.findFirst({
            where: {
                tssDeviceId: caller.deviceId,
                tssCompanyId: scope.companyId,
                tssBranchId: scope.branchId,
                tssIsDeleted: false,
                tssStatus: { in: till_enum_1.HOLDING_SESSION_STATUSES },
            },
            orderBy: { tssOpenedOn: 'desc' },
        });
        const counter = held
            ? await client.tillCounter.findUniqueOrThrow({
                where: { tcnId: held.tssCounterId },
                select: limits,
            })
            : await client.tillCounter.findFirst({
                where: {
                    tcnDeviceId: caller.deviceId,
                    tcnCompanyId: scope.companyId,
                    tcnBranchId: scope.branchId,
                    tcnIsDeleted: false,
                    tcnIsActive: true,
                },
                select: limits,
            });
        const named = scope.sessionId && isUuidLike(scope.sessionId)
            ? await client.tillSession.findFirst({
                where: { tssId: scope.sessionId, tssIsDeleted: false },
            })
            : null;
        let settings = null;
        const settingsHere = async () => (settings ??= await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        }));
        const governed = !!held || (!!counter && counter.tcnRequiresSession && (await settingsHere()).requireSession);
        if (!governed && (!named || scope.optional)) {
            return null;
        }
        const session = named ??
            held ??
            (counter
                ? await client.tillSession.findFirst({
                    where: {
                        tssCounterId: counter.tcnId,
                        tssIsDeleted: false,
                        tssStatus: { in: till_enum_1.LIVE_SESSION_STATUSES },
                    },
                    orderBy: { tssOpenedOn: 'desc' },
                })
                : null);
        if (!session) {
            if (scope.optional) {
                return null;
            }
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_REQUIRED, 'This counter has no open till session: open one (Open Till) before taking money', scope.field);
        }
        if (scope.optional &&
            !named &&
            session.tssStatus !== till_enum_1.TillSessionStatus.OPEN) {
            return null;
        }
        const status = session.tssStatus;
        if (named && status !== till_enum_1.TillSessionStatus.OPEN && status !== till_enum_1.TillSessionStatus.SUSPENDED) {
            const stoppedAt = session.tssBillingEndedOn ?? session.tssClosedOn;
            const late = scope.lateArrivalOk === true &&
                status !== till_enum_1.TillSessionStatus.VOIDED &&
                !!scope.docTime &&
                !!scope.arrivedAt &&
                !!stoppedAt &&
                scope.docTime.getTime() <= stoppedAt.getTime() &&
                scope.arrivedAt.getTime() > stoppedAt.getTime();
            if (late) {
                const ref = this.assertOwnedHere(session, {
                    ...scope,
                    userId: caller.userId,
                    deviceId: caller.deviceId,
                });
                await this.events.log(client, {
                    companyId: session.tssCompanyId,
                    branchId: session.tssBranchId,
                    accYear: session.tssAccYear,
                    code: till_enum_1.TillEventCode.LATE_ARRIVAL,
                    sessionId: session.tssId,
                    dayId: session.tssDayId,
                    counterId: session.tssCounterId,
                    deviceId: caller.deviceId,
                    userId: caller.userId,
                    payload: {
                        status,
                        docTime: scope.docTime.toISOString(),
                        billingStoppedAt: stoppedAt.toISOString(),
                    },
                });
                return ref;
            }
            if (status === till_enum_1.TillSessionStatus.CLOSED) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_CLOSED, `Session ${session.tssSessionNo} is closed: money moves in the session that is open now`, scope.field, { sessionNo: session.tssSessionNo });
            }
        }
        const ref = this.assertLive(session, {
            ...scope,
            userId: caller.userId,
            deviceId: caller.deviceId,
        });
        const { dayCutoff, cashOutOverExpected } = await settingsHere();
        const today = scope.docTime
            ? await (0, till_dates_1.businessDateAt)(client, scope.docTime, dayCutoff)
            : await (0, till_dates_1.businessDateNow)(client, dayCutoff);
        if (today !== ref.businessDate) {
            await this.events.log(this.prisma, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.SESSION_DAY_ENDED,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                payload: {
                    sessionDate: ref.businessDate,
                    businessDateNow: today,
                    cutoff: dayCutoff,
                },
            });
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_DAY_ENDED, `Session ${session.tssSessionNo} belongs to business date ${ref.businessDate}; it is now ${today} ` +
                `(cut-off ${dayCutoff}). End and count it, then open a session for today.`, scope.field, { sessionDate: ref.businessDate, businessDate: today });
        }
        const drawer = session.tssCounterId === counter?.tcnId
            ? counter
            : await client.tillCounter.findUniqueOrThrow({
                where: { tcnId: session.tssCounterId },
                select: limits,
            });
        if (scope.cashIn && dec(drawer.tcnCashBlockLimit).greaterThan(0)) {
            const cash = await this.cashState(client, session, drawer);
            if (cash.state === 'BLOCKED') {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.CASH_BLOCKED, `The drawer is over its block limit (${num(dec(drawer.tcnCashBlockLimit))}): a pickup or a drop first`, scope.field, { blockLimit: num(dec(drawer.tcnCashBlockLimit)), event: 'CASH_LIMIT_OVERRIDE' });
            }
        }
        const cashOut = dec(scope.cashOut);
        if (cashOut.greaterThan(0) && cashOutOverExpected === 'REFUSE') {
            const cash = await this.cashState(client, session, drawer);
            if (cashOut.greaterThan(cash.cash)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.CASH_SHORT_IN_DRAWER, `The drawer does not hold ${num(cashOut)} in cash: pay less in cash, top the drawer up first, ` +
                    'or pay by bank (till.cash_out_over_expected = REFUSE)', scope.field, { sessionNo: session.tssSessionNo, cashOut: num(cashOut) });
            }
        }
        return ref;
    }
    async cashState(client, session, counter) {
        const limits = counter ??
            (await client.tillCounter.findUniqueOrThrow({
                where: { tcnId: session.tssCounterId },
                select: { tcnCashAlertLimit: true, tcnCashBlockLimit: true },
            }));
        const alert = dec(limits.tcnCashAlertLimit);
        const block = dec(limits.tcnCashBlockLimit);
        const expectations = await this.ledger.expected(client, this.expectationSession(session));
        const cash = expectations.find((e) => e.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID)?.expected ?? ZERO;
        const state = block.greaterThan(0) && cash.greaterThanOrEqualTo(block)
            ? 'BLOCKED'
            : alert.greaterThan(0) && cash.greaterThanOrEqualTo(alert)
                ? 'ALERT'
                : 'NORMAL';
        const gauge = alert.greaterThan(0)
            ? Math.max(0, Math.min(4, Math.floor(cash.dividedBy(alert).times(4).toNumber())))
            : null;
        return { state, gauge, alertLimit: num(alert), blockLimit: num(block), cash };
    }
    async stampTenderRows(tx, ref, doc, actorName) {
        return tx.$executeRaw `
      UPDATE accounts.acc_tender_detail
         SET td_session_id  = ${ref.tssId}::uuid,
             td_modified_on = now(),
             td_modified_by = ${actorName}
       WHERE td_src_doc_type = ${doc.srcDocType}
         AND td_src_doc_id   = ${doc.srcDocId}::uuid
         AND td_acc_year     = ${doc.accYear}::char(9)
         AND td_is_deleted   = false
         AND td_is_voided    = false
         AND td_session_id IS DISTINCT FROM ${ref.tssId}::uuid`;
    }
    async stampVoucher(tx, ref, doc, actorName) {
        await tx.$executeRaw `
      UPDATE accounts.acc_voucher_header
         SET avh_session_id  = ${ref.tssId}::uuid,
             avh_modified_on = now(),
             avh_modified_by = ${actorName}
       WHERE avh_voucher_id = ${doc.voucherId}::uuid
         AND avh_acc_year   = ${doc.accYear}::char(9)
         AND avh_session_id IS DISTINCT FROM ${ref.tssId}::uuid`;
        await this.stampTenderRows(tx, ref, { srcDocType: doc.srcDocType, srcDocId: doc.voucherId, accYear: doc.accYear }, actorName);
    }
    async routeMoneyDoc(client, scope) {
        const none = { ref: null, cashLedgerId: null, safeName: null };
        const caller = await this.context.caller(client);
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        if (!settings.moneyDocsInSession) {
            return none;
        }
        const ref = caller.deviceId
            ? await this.resolveForMoney(client, {
                companyId: scope.companyId,
                branchId: scope.branchId,
                sessionId: scope.sessionId,
                field: scope.field,
                optional: !scope.hasCash,
                cashIn: scope.cashIn,
                cashOut: scope.cashOut,
            })
            : null;
        if (ref || !scope.hasCash) {
            return { ...none, ref };
        }
        const tillHere = await client.tillCounter.findFirst({
            where: {
                tcnCompanyId: scope.companyId,
                tcnBranchId: scope.branchId,
                tcnIsDeleted: false,
                tcnIsActive: true,
                tcnRequiresSession: true,
            },
            select: { tcnId: true },
        });
        if (!tillHere) {
            return none;
        }
        if (settings.backofficeCashFrom === 'REFUSE') {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_REQUIRED, 'This device is not a till, and this branch takes cash only through a till session ' +
                '(till.backoffice_cash_from = REFUSE): post it on a till, or pay by bank', scope.field);
        }
        const safe = await this.ledger.safeFor(client, {
            companyId: scope.companyId,
            branchId: scope.branchId,
            counterSafeId: null,
        });
        if (!safe) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, 'Cash on a back-office device comes from the branch safe, and this branch has none (Till Masters, menu 275)', scope.field);
        }
        return { ref: null, cashLedgerId: safe.ledgerId, safeName: safe.name };
    }
    async routeCashToLedger(tx, doc) {
        await tx.$executeRaw `
      UPDATE accounts.acc_tender_detail
         SET td_tender_ledger_id = ${doc.ledgerId}::uuid,
             td_settle_ledger_id = NULL,
             td_modified_on      = now(),
             td_modified_by      = ${doc.actor}
       WHERE td_src_doc_type   = ${doc.srcDocType}
         AND td_src_doc_id     = ${doc.srcDocId}::uuid
         AND td_acc_year       = ${doc.accYear}::char(9)
         AND td_tender_type_id = ${till_enum_1.CASH_TENDER_TYPE_ID}::int
         AND td_is_deleted     = false
         AND td_is_voided      = false`;
    }
    async assertMoneyDocCancellable(client, doc) {
        if (!doc.sessionId || !isUuidLike(doc.sessionId)) {
            return;
        }
        const session = await client.tillSession.findFirst({
            where: { tssId: doc.sessionId, tssIsDeleted: false },
            select: { tssSessionNo: true, tssStatus: true },
        });
        if (!session || MOVABLE.includes(session.tssStatus)) {
            return;
        }
        (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_CLOSED, `This document moved money in till session ${session.tssSessionNo}, which is ${session.tssStatus}: ` +
            'correct it with a new document or an accounts journal', doc.field, { sessionNo: session.tssSessionNo, status: session.tssStatus });
    }
    async logMoneyDoc(tx, doc) {
        const session = await tx.tillSession.findFirst({
            where: { tssId: doc.sessionId, tssIsDeleted: false },
        });
        if (!session) {
            return;
        }
        const caller = await this.context.caller(tx);
        await this.events.log(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            code: doc.code,
            sessionId: session.tssId,
            dayId: session.tssDayId,
            counterId: session.tssCounterId,
            deviceId: caller.deviceId,
            userId: caller.userId,
            srcDocType: doc.srcDocType,
            srcDocId: doc.srcDocId,
            srcRefno: doc.srcRefno,
            amount: new client_1.Prisma.Decimal(doc.amount),
            payload: doc.payload,
        });
    }
    async assertNoTillCashLeg(client, scope) {
        if (scope.ledgerIds.length === 0) {
            return;
        }
        const tillHere = await client.tillCounter.findFirst({
            where: {
                tcnCompanyId: scope.companyId,
                tcnBranchId: scope.branchId,
                tcnIsDeleted: false,
                tcnIsActive: true,
                tcnRequiresSession: true,
            },
            select: { tcnId: true },
        });
        if (!tillHere) {
            return;
        }
        const guarded = new Map();
        const cash = await this.ledger.tillCashTender(client, scope.companyId, scope.branchId);
        guarded.set(cash.ledgerId, 'the till cash ledger');
        const safes = await client.tillSafe.findMany({
            where: {
                tsfCompanyId: scope.companyId,
                tsfBranchId: scope.branchId,
                tsfIsDeleted: false,
                tsfIsActive: true,
            },
            select: { tsfLedgerId: true, tsfName: true },
        });
        for (const safe of safes) {
            guarded.set(safe.tsfLedgerId, `safe ${safe.tsfName}'s ledger`);
        }
        const roles = await (0, ledger_map_helper_1.resolveRoleLedgers)(client, [{ role: till_enum_1.TILL_CASH_AWAITING_ROLE }, { role: till_enum_1.CASH_IN_TRANSIT_ROLE }], { companyId: scope.companyId, branchId: scope.branchId, where: 'till' });
        for (const hit of roles.values()) {
            if (hit) {
                guarded.set(hit.ledgerId, `${hit.ledgerName ?? 'the till'} ledger`);
            }
        }
        const touched = scope.ledgerIds.find((id) => guarded.has(id));
        if (touched) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.CASH_LEDGER_DIRECT, `This branch runs a till: ${guarded.get(touched)} moves only through a till movement or the Cash ` +
                'Office (pickup, drop, remittance), never a journal or contra', scope.field);
        }
    }
    async assertCancellable(client, doc) {
        if (!doc.sessionId || !isUuidLike(doc.sessionId)) {
            return;
        }
        const session = await client.tillSession.findFirst({
            where: { tssId: doc.sessionId, tssIsDeleted: false },
            select: { tssSessionNo: true, tssStatus: true },
        });
        if (!session) {
            return;
        }
        const counted = [
            till_enum_1.TillSessionStatus.COUNTING,
            till_enum_1.TillSessionStatus.PENDING_APPROVAL,
            till_enum_1.TillSessionStatus.CLOSED,
        ].includes(session.tssStatus);
        if (!counted) {
            return;
        }
        const [cash] = await client.$queryRaw `
      SELECT count(*)::int AS n FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = ${doc.srcDocType}
         AND td_src_doc_id   = ${doc.srcDocId}::uuid
         AND td_acc_year     = ${doc.accYear}::char(9)
         AND td_tender_type_id = ${till_enum_1.CASH_TENDER_TYPE_ID}::int
         AND td_is_deleted = false
         AND td_is_voided  = false`;
        if ((cash?.n ?? 0) > 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_CLOSED_USE_RETURN, `This document took cash in till session ${session.tssSessionNo}, which is ${session.tssStatus}: ` +
                'do a sale return, so the cash leaves today’s drawer', doc.field, { sessionNo: session.tssSessionNo, status: session.tssStatus });
        }
    }
    assertOwnedHere(session, scope) {
        return this.assertLive({ ...session, tssStatus: till_enum_1.TillSessionStatus.OPEN }, scope);
    }
    assertLive(session, scope) {
        if (session.tssCompanyId !== scope.companyId || session.tssBranchId !== scope.branchId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, `Session ${session.tssSessionNo} belongs to another branch`, scope.field);
        }
        if (session.tssStatus !== till_enum_1.TillSessionStatus.OPEN) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${session.tssSessionNo} is ${session.tssStatus}: it takes no money`, scope.field, { status: session.tssStatus });
        }
        if (session.tssDeviceId !== scope.deviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_WRONG_DEVICE, `Session ${session.tssSessionNo} was opened on another device; money posts only from it`, scope.field);
        }
        if (session.tssOperatorId !== scope.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_YOURS, `Session ${session.tssSessionNo} belongs to another cashier`, scope.field);
        }
        return {
            tssId: session.tssId,
            tssAccYear: session.tssAccYear,
            tssCounterId: session.tssCounterId,
            tssDeviceId: session.tssDeviceId,
            tssOperatorId: session.tssOperatorId,
            businessDate: (0, till_dates_1.isoDateOf)(session.tssBusinessDate),
        };
    }
    requireDevice(caller) {
        if (!caller.deviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DEVICE_REQUIRED, 'A till session opens on a registered device, and this login carries none', 'deviceId');
        }
        return caller.deviceId;
    }
    async knownDevice(client, deviceId) {
        const device = await client.deviceMaster.findFirst({
            where: { devId: deviceId, devIsDeleted: false },
            select: { devIsBlocked: true, devIsActive: true, devBlockReason: true },
        });
        if (!device) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DEVICE_UNKNOWN, 'This device is not registered (Device Master): no till session opens on it', 'deviceId');
        }
        if (device.devIsBlocked || !device.devIsActive) {
            const why = device.devIsBlocked
                ? `blocked${device.devBlockReason ? ` (${device.devBlockReason})` : ''}`
                : 'switched off';
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DEVICE_BLOCKED, `This device is ${why} in Device Master: no till session opens on it`, 'deviceId');
        }
    }
    linkedCounter(client, scope) {
        return client.tillCounter.findFirst({
            where: {
                tcnDeviceId: scope.deviceId,
                tcnCompanyId: scope.companyId,
                tcnBranchId: scope.branchId,
                tcnIsDeleted: false,
            },
        });
    }
    async counterBoard(client, scope) {
        const counters = await client.tillCounter.findMany({
            where: {
                tcnCompanyId: scope.companyId,
                tcnBranchId: scope.branchId,
                tcnIsDeleted: false,
                tcnIsActive: true,
                tcnRequiresSession: true,
                tcnDeviceId: null,
            },
            orderBy: [{ tcnSortOrder: 'asc' }, { tcnCode: 'asc' }],
        });
        const holding = counters.length === 0
            ? []
            : await this.holdingSessions(client, {
                tssCounterId: { in: counters.map((c) => c.tcnId) },
            });
        const byCounter = new Map(holding.map((h) => [h.counterId, h]));
        return {
            free: counters.filter((c) => !byCounter.has(c.tcnId)),
            busy: counters
                .filter((c) => byCounter.has(c.tcnId))
                .map((counter) => ({ counter, session: byCounter.get(counter.tcnId) })),
        };
    }
    async counterRow(client, counter) {
        const { prev, takenBy } = await this.lastClosed(client, counter.tcnId, null);
        return {
            counterId: counter.tcnId,
            code: counter.tcnCode,
            name: counter.tcnName,
            defaultFloat: num(counter.tcnDefaultFloat),
            carriedFrom: prev && !takenBy
                ? {
                    sessionId: prev.tssId,
                    accYear: prev.tssAccYear,
                    sessionNo: prev.tssSessionNo,
                    floatLeft: num(prev.tssFloatLeft),
                }
                : null,
        };
    }
    async holdingSessions(client, where) {
        const rows = await client.tillSession.findMany({
            where: {
                ...where,
                tssIsDeleted: false,
                tssStatus: { in: [...till_enum_1.HOLDING_SESSION_STATUSES] },
            },
            orderBy: { tssOpenedOn: 'desc' },
            include: { counter: { select: { tcnCode: true } } },
        });
        if (rows.length === 0) {
            return [];
        }
        const [users, devices] = await Promise.all([
            client.userMaster.findMany({
                where: { usrId: { in: [...new Set(rows.map((r) => r.tssOperatorId))] } },
                select: { usrId: true, usrDisplayName: true, usrLoginName: true },
            }),
            client.deviceMaster.findMany({
                where: { devId: { in: [...new Set(rows.map((r) => r.tssDeviceId))] } },
                select: { devId: true, devDeviceName: true },
            }),
        ]);
        const userName = new Map(users.map((u) => [u.usrId, u.usrDisplayName?.trim() || u.usrLoginName]));
        const deviceName = new Map(devices.map((d) => [d.devId, d.devDeviceName]));
        return rows.map((r) => ({
            sessionId: r.tssId,
            accYear: r.tssAccYear,
            sessionNo: r.tssSessionNo,
            counterId: r.tssCounterId,
            counterCode: r.counter.tcnCode,
            operatorId: r.tssOperatorId,
            operatorName: userName.get(r.tssOperatorId) ?? r.tssOperatorId,
            deviceId: r.tssDeviceId,
            deviceName: deviceName.get(r.tssDeviceId) ?? null,
            openedOn: r.tssOpenedOn.toISOString(),
            status: r.tssStatus,
        }));
    }
    async claimCounter(tx, scope) {
        const linked = await this.linkedCounter(tx, scope);
        if (linked) {
            if (scope.counterId && scope.counterId !== linked.tcnId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_NOT_YOURS, `This device is linked to counter ${linked.tcnCode}: it opens only there`, 'counterId');
            }
            const counter = await this.lockCounter(tx, linked.tcnId);
            if (!counter.tcnIsActive) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_INACTIVE, `Counter ${counter.tcnCode}, which this device is linked to, is inactive (Till Masters)`, 'counterId');
            }
            return { counter, claim: till_enum_1.TillCounterClaim.LINKED };
        }
        if (!scope.counterId) {
            const board = await this.counterBoard(tx, scope);
            if (board.free.length === 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.NO_FREE_COUNTER, 'This device is linked to no counter, and no counter of this branch is free', 'counterId', {
                    busy: board.busy.map((b) => ({
                        code: b.counter.tcnCode,
                        operator: b.session.operatorName,
                    })),
                });
            }
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.COUNTER_REQUIRED, 'This device is linked to no counter: name one of the free counters (counterId)', 'counterId');
        }
        const found = await tx.tillCounter.findFirst({
            where: {
                tcnId: scope.counterId,
                tcnCompanyId: scope.companyId,
                tcnBranchId: scope.branchId,
                tcnIsDeleted: false,
            },
            select: { tcnId: true },
        });
        if (!found) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_NOT_FOUND, `Counter ${scope.counterId} is not a counter of this branch`, 'counterId');
        }
        const counter = await this.lockCounter(tx, found.tcnId);
        const notFree = counter.tcnDeviceId
            ? 'is linked to another device; only that device opens on it'
            : !counter.tcnIsActive
                ? 'is inactive'
                : !counter.tcnRequiresSession
                    ? 'takes no till session'
                    : null;
        if (notFree) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_NOT_YOURS, `Counter ${counter.tcnCode} ${notFree}: pick a free counter`, 'counterId');
        }
        return { counter, claim: till_enum_1.TillCounterClaim.PICKED };
    }
    async lockCounter(tx, tcnId) {
        await tx.$queryRaw `SELECT tcn_id FROM accounts.till_counter WHERE tcn_id = ${tcnId}::uuid FOR UPDATE`;
        return tx.tillCounter.findUniqueOrThrow({ where: { tcnId } });
    }
    rethrowCounterTaken(error, counterCode) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            `${error.message} ${JSON.stringify(error.meta ?? {})}`.includes('counter')) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_BUSY, `Counter ${counterCode} was just taken: pick another`, 'counterId');
        }
        throw error;
    }
    async assertDeviceFree(tx, deviceId) {
        const [live] = await this.holdingSessions(tx, { tssDeviceId: deviceId });
        if (live) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_BUSY, `This device holds session ${live.sessionNo} (${live.status}) of ${live.operatorName} on counter ` +
                `${live.counterCode}: resume it, or a supervisor force-closes it`, 'counterId', { sessionNo: live.sessionNo, operatorName: live.operatorName });
        }
    }
    async assertCounterFree(tx, counterId) {
        const live = await tx.tillSession.findFirst({
            where: {
                tssCounterId: counterId,
                tssIsDeleted: false,
                tssStatus: { in: [...till_enum_1.LIVE_SESSION_STATUSES, till_enum_1.TillSessionStatus.PENDING_APPROVAL] },
            },
            select: { tssSessionNo: true, tssStatus: true },
        });
        if (live) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNTER_BUSY, `Counter already has session ${live.tssSessionNo} (${live.tssStatus})`, 'counterId', { sessionNo: live.tssSessionNo });
        }
    }
    async assertOperatorFree(tx, companyId, userId) {
        const live = await tx.tillSession.findFirst({
            where: {
                tssCompanyId: companyId,
                tssOperatorId: userId,
                tssIsDeleted: false,
                tssStatus: { in: [...till_enum_1.LIVE_SESSION_STATUSES, till_enum_1.TillSessionStatus.PENDING_APPROVAL] },
            },
            select: { tssSessionNo: true },
        });
        if (live) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.OPERATOR_BUSY, `You already have session ${live.tssSessionNo} open; close or resume it first`, 'tssOperatorId', { sessionNo: live.tssSessionNo });
        }
    }
    async floatMismatchReason(tx, input) {
        const reason = await tx.tillReason.findFirst({
            where: {
                ...(input.reasonId ? { trsId: input.reasonId } : { trsCode: 'UNKNOWN' }),
                trsCategory: 'FLOAT_MISMATCH',
                trsIsDeleted: false,
                trsIsActive: true,
                OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
            },
            orderBy: { trsCompanyId: { sort: 'asc', nulls: 'last' } },
        });
        if (!reason) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, input.reasonId
                ? 'The reason must be an active FLOAT_MISMATCH reason'
                : 'The count differs from the float issued: name a FLOAT_MISMATCH reason', 'reasonId');
        }
        if (reason.trsNeedsNote && !input.notes?.trim()) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
        }
        return reason;
    }
    async carriedFrom(tx, counterId, prevSessionId) {
        const { prev, takenBy } = await this.lastClosed(tx, counterId, prevSessionId);
        if (!prev) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.FLOAT_INVALID, prevSessionId
                ? `Session ${prevSessionId} is not a CLOSED session of this counter`
                : 'No CLOSED session on this counter left a float to carry', 'prevSessionId');
        }
        if (takenBy) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.FLOAT_INVALID, `The float ${prev.tssSessionNo} left was already carried into ${takenBy}`, 'prevSessionId');
        }
        return prev;
    }
    async lastClosed(client, counterId, prevSessionId) {
        const prev = await client.tillSession.findFirst({
            where: {
                tssCounterId: counterId,
                tssIsDeleted: false,
                tssStatus: till_enum_1.TillSessionStatus.CLOSED,
                ...(prevSessionId ? { tssId: prevSessionId } : {}),
            },
            orderBy: { tssClosedOn: 'desc' },
            select: { tssId: true, tssAccYear: true, tssFloatLeft: true, tssSessionNo: true },
        });
        if (!prev) {
            return { prev: null, takenBy: null };
        }
        const taken = await client.tillSession.findFirst({
            where: {
                tssPrevSessionId: prev.tssId,
                tssIsDeleted: false,
                tssStatus: { not: till_enum_1.TillSessionStatus.VOIDED },
            },
            select: { tssSessionNo: true },
        });
        return { prev, takenBy: taken?.tssSessionNo ?? null };
    }
    async nextDaySeq(tx, counterId, businessDate) {
        const [row] = await tx.$queryRaw `
      SELECT COALESCE(max(tss_day_seq), 0)::int AS n
        FROM accounts.till_session
       WHERE tss_counter_id = ${counterId}::uuid
         AND tss_business_date = ${businessDate}::date
         AND tss_acc_year = ${(0, till_dates_1.accYearOf)(businessDate)}::char(9)`;
        return (row?.n ?? 0) + 1;
    }
    async lockOwn(tx, key, caller, statuses) {
        const session = await this.lock(tx, key, statuses);
        if (session.tssOperatorId !== caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_YOURS, `Session ${session.tssSessionNo} belongs to another cashier`, 'tssId');
        }
        if (caller.deviceId !== session.tssDeviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_WRONG_DEVICE, `Session ${session.tssSessionNo} is driven from the device it was opened on`, 'tssId');
        }
        return session;
    }
    async lockForCount(tx, key, caller, supervisor, statuses) {
        const session = await this.lock(tx, key, statuses);
        if (supervisor) {
            return session;
        }
        if (session.tssOperatorId !== caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_YOURS, `Session ${session.tssSessionNo} belongs to another cashier`, 'tssId');
        }
        if (session.tssCountPlace !== 'CASH_OFFICE' && caller.deviceId !== session.tssDeviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_WRONG_DEVICE, `Session ${session.tssSessionNo} is counted at its own counter`, 'tssId');
        }
        return session;
    }
    async lock(tx, key, statuses) {
        const locked = await tx.$queryRaw `
      SELECT tss_id FROM accounts.till_session
       WHERE tss_id = ${key.tssId}::uuid
         AND tss_acc_year = ${key.accYear}::char(9)
         AND tss_company_id = ${key.companyId}::uuid
         AND tss_branch_id = ${key.branchId}::uuid
         AND tss_is_deleted = false
       FOR UPDATE`;
        if (locked.length === 0) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
        }
        const session = await tx.tillSession.findUniqueOrThrow({
            where: { tssId_tssAccYear: { tssId: key.tssId, tssAccYear: key.accYear } },
        });
        if (!statuses.includes(session.tssStatus)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${session.tssSessionNo} is ${session.tssStatus}; this needs ${statuses.join(' or ')}`, 'tssId', { status: session.tssStatus });
        }
        return session;
    }
    async priceLines(tx, companyId, lines) {
        const ids = [...new Set(lines.map((l) => l.denominationId).filter((id) => !!id))];
        const denoms = ids.length
            ? await tx.tillDenomination.findMany({
                where: {
                    tdnId: { in: ids },
                    tdnIsDeleted: false,
                    tdnIsActive: true,
                    OR: [{ tdnCompanyId: null }, { tdnCompanyId: companyId }],
                },
                select: { tdnId: true, tdnValue: true },
            })
            : [];
        const valueOf = new Map(denoms.map((d) => [d.tdnId, dec(d.tdnValue)]));
        return lines.map((line, i) => {
            const qty = line.qty ?? 0;
            if (!Number.isInteger(qty) || qty < 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'A quantity is a whole number of pieces or slips', `lines.${i}.qty`);
            }
            if (line.denominationId) {
                const face = valueOf.get(line.denominationId);
                if (!face) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'Unknown or withdrawn denomination', `lines.${i}.denominationId`);
                }
                if (line.tenderTypeId !== till_enum_1.CASH_TENDER_TYPE_ID) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'Only cash is counted by denomination', `lines.${i}.denominationId`);
                }
                return { ...line, faceValue: face, amount: face.times(qty) };
            }
            const entered = dec(line.enteredAmount ?? 0);
            if (entered.isNegative()) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'An amount counted cannot be negative', `lines.${i}.enteredAmount`);
            }
            return { ...line, faceValue: ZERO, amount: entered };
        });
    }
    async writeMovementCount(tx, session, input) {
        const total = input.lines.reduce((s, l) => s.plus(l.amount), ZERO);
        const count = await this.writeCount(tx, session, {
            kind: input.kind,
            attemptNo: 1,
            isFinal: true,
            isBlind: input.isBlind ?? false,
            lines: input.lines,
            expected: input.expected ?? total,
            caller: input.caller,
            deviceId: input.deviceId,
            witnessBy: input.witnessBy ?? null,
            notes: input.notes ?? null,
        });
        await tx.tillCount.update({
            where: { tctId_tctAccYear: { tctId: count.tctId, tctAccYear: session.tssAccYear } },
            data: { tctSafeId: input.safeId, tctMovementId: input.movementId },
        });
        return count.tctId;
    }
    async writeSafeCount(tx, input) {
        const total = input.lines.reduce((sum, l) => sum.plus(l.amount), ZERO);
        const count = await tx.tillCount.create({
            data: {
                tctCompanyId: input.companyId,
                tctBranchId: input.branchId,
                tctTenantId: input.tenantId,
                tctAccYear: input.accYear,
                tctKind: input.kind,
                tctSessionId: null,
                tctSafeId: input.safeId,
                tctDayId: input.dayId,
                tctMovementId: input.movementId,
                tctAttemptNo: 1,
                tctIsFinal: true,
                tctIsBlind: input.isBlind,
                tctCountedBy: input.caller.userId,
                tctWitnessBy: input.witnessBy ?? null,
                tctDeviceId: input.caller.deviceId,
                tctTotalCounted: total,
                tctExpected: input.expected,
                tctNotes: input.notes ?? null,
                tctCreatedBy: input.caller.actorName,
            },
            select: { tctId: true, tctCountedOn: true },
        });
        if (input.lines.length > 0) {
            await tx.tillCountLine.createMany({
                data: input.lines.map((line, i) => ({
                    tclAccYear: input.accYear,
                    tclCountId: count.tctId,
                    tclRowNo: i + 1,
                    tclTenderTypeId: line.tenderTypeId,
                    tclTenderId: line.tenderId ?? null,
                    tclDenominationId: line.denominationId ?? null,
                    tclFaceValue: line.faceValue,
                    tclQty: new client_1.Prisma.Decimal(line.qty ?? 0),
                    tclEnteredAmount: line.denominationId ? ZERO : line.amount,
                    tclBatchRef: line.batchRef ?? null,
                })),
            });
        }
        return { tctId: count.tctId, total, countedOn: count.tctCountedOn };
    }
    async assertCountable(tx, lines) {
        const typeIds = [...new Set(lines.map((l) => l.tenderTypeId))];
        if (typeIds.length === 0) {
            return;
        }
        const types = await tx.accTenderType.findMany({
            where: { ttmTypeId: { in: typeIds } },
            select: { ttmTypeId: true, ttmTypeName: true, ttmCloseMode: true },
        });
        const byId = new Map(types.map((t) => [t.ttmTypeId, t]));
        lines.forEach((line, i) => {
            const type = byId.get(line.tenderTypeId);
            if (!type) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `Unknown tender type ${line.tenderTypeId}`, `lines.${i}.tenderTypeId`);
            }
            if (type.ttmCloseMode !== till_enum_1.TenderCloseMode.DENOM &&
                type.ttmCloseMode !== till_enum_1.TenderCloseMode.SLIPS) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `${type.ttmTypeName} is not counted at the till (${type.ttmCloseMode}): it is reconciled against its statement`, `lines.${i}.tenderTypeId`);
            }
        });
    }
    assertTerminalNamed(lines, expectations) {
        lines.forEach((line, i) => {
            if (line.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID || line.tenderId) {
                return;
            }
            const terminals = expectations.filter((e) => e.tenderTypeId === line.tenderTypeId);
            if (terminals.length > 1) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `This session took ${terminals[0].tenderTypeName} money on ${terminals.length} terminals ` +
                    `(${terminals.map((t) => t.tenderName ?? t.tenderId).join(', ')}): count each batch on its own line, naming its tender`, `lines.${i}.tenderId`);
            }
        });
    }
    countedByTender(priced, expectations) {
        const counted = new Map();
        const add = (key, typeId, tenderId, amount, slips) => {
            const row = counted.get(key) ?? {
                key,
                tenderTypeId: typeId,
                tenderId,
                amount: ZERO,
                slips: 0,
            };
            row.amount = row.amount.plus(amount);
            row.slips += slips;
            counted.set(key, row);
        };
        for (const line of priced) {
            if (line.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID) {
                const cash = expectations.find((e) => e.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID);
                add(tenderKey(cash.tenderTypeId, cash.tenderId), cash.tenderTypeId, cash.tenderId, line.amount, 0);
                continue;
            }
            let tenderId = line.tenderId ?? null;
            if (!tenderId) {
                const ofType = expectations.filter((e) => e.tenderTypeId === line.tenderTypeId);
                if (ofType.length === 1) {
                    tenderId = ofType[0].tenderId;
                }
            }
            add(tenderKey(line.tenderTypeId, tenderId), line.tenderTypeId, tenderId, line.amount, line.qty ?? 0);
        }
        return counted;
    }
    compare(expectations, counted, settings) {
        const rows = [];
        const seen = new Set();
        for (const e of expectations) {
            const key = tenderKey(e.tenderTypeId, e.tenderId);
            seen.add(key);
            const countable = e.closeMode === till_enum_1.TenderCloseMode.DENOM || e.closeMode === till_enum_1.TenderCloseMode.SLIPS;
            if (!countable) {
                rows.push({
                    expectation: e,
                    counted: null,
                    slips: null,
                    variance: ZERO,
                    tolerance: ZERO,
                    within: true,
                });
                continue;
            }
            const c = counted.get(key);
            const amount = c?.amount ?? ZERO;
            const tolerance = e.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID ? settings.cashTolerance : settings.noncashTolerance;
            const variance = amount.minus(e.expected);
            rows.push({
                expectation: e,
                counted: amount,
                slips: c ? c.slips : 0,
                variance,
                tolerance,
                within: variance.abs().lessThanOrEqualTo(tolerance),
            });
        }
        for (const [key, c] of counted) {
            if (seen.has(key)) {
                continue;
            }
            const orphan = {
                tenderTypeId: c.tenderTypeId,
                tenderTypeName: String(c.tenderTypeId),
                closeMode: till_enum_1.TenderCloseMode.SLIPS,
                tenderId: c.tenderId,
                tenderName: null,
                ledgerId: null,
                open: ZERO,
                sales: ZERO,
                refund: ZERO,
                receipt: ZERO,
                payment: ZERO,
                expense: ZERO,
                movedIn: ZERO,
                movedOut: ZERO,
                paidFromBank: ZERO,
                txnCount: 0,
                noRefCount: 0,
                expected: ZERO,
            };
            const tolerance = settings.noncashTolerance;
            rows.push({
                expectation: orphan,
                counted: c.amount,
                slips: c.slips,
                variance: c.amount,
                tolerance,
                within: c.amount.abs().lessThanOrEqualTo(tolerance),
            });
        }
        return rows;
    }
    varianceRow(session, row, settings, caller, outcome) {
        const e = row.expectation;
        const pending = !row.within && (outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL || isSlipRow(row));
        return {
            tvrCompanyId: session.tssCompanyId,
            tvrBranchId: session.tssBranchId,
            tvrTenantId: session.tssTenantId,
            tvrAccYear: session.tssAccYear,
            tvrSessionId: session.tssId,
            tvrStage: 'CLOSE',
            tvrTenderTypeId: e.tenderTypeId,
            tvrTenderId: e.tenderId,
            tvrOpenAmount: e.open,
            tvrSalesAmount: e.sales,
            tvrRefundAmount: e.refund,
            tvrReceiptAmount: e.receipt,
            tvrPaymentAmount: e.payment,
            tvrExpenseAmount: e.expense,
            tvrMovedIn: e.movedIn,
            tvrMovedOut: e.movedOut,
            tvrTxnCount: e.txnCount,
            tvrExpected: e.expected,
            tvrCounted: row.counted ?? ZERO,
            tvrSlipCount: e.closeMode === till_enum_1.TenderCloseMode.SLIPS ? row.slips : null,
            tvrTolerance: row.tolerance,
            tvrTreatment: pending
                ? till_enum_1.TillVarianceTreatment.PENDING
                : till_enum_1.TillVarianceTreatment.WITHIN_TOLERANCE,
            tvrDecidedBy: pending ? null : caller.userId,
            tvrDecidedOn: pending ? null : new Date(),
            tvrStatus: 'OPEN',
            tvrCreatedBy: caller.actorName,
        };
    }
    async writeCount(tx, session, input) {
        const total = input.lines.reduce((s, l) => s.plus(l.amount), ZERO);
        const count = await tx.tillCount.create({
            data: {
                tctCompanyId: session.tssCompanyId,
                tctBranchId: session.tssBranchId,
                tctTenantId: session.tssTenantId,
                tctAccYear: session.tssAccYear,
                tctKind: input.kind,
                tctSessionId: session.tssId,
                tctAttemptNo: input.attemptNo,
                tctIsFinal: input.isFinal,
                tctIsBlind: input.isBlind,
                tctCountedBy: input.caller.userId,
                tctWitnessBy: input.witnessBy ?? null,
                tctDeviceId: input.deviceId,
                tctTotalCounted: total,
                tctExpected: input.expected,
                tctNotes: input.notes ?? null,
                tctCreatedBy: input.caller.actorName,
            },
            select: { tctId: true },
        });
        if (input.lines.length > 0) {
            await tx.tillCountLine.createMany({
                data: input.lines.map((line, i) => ({
                    tclAccYear: session.tssAccYear,
                    tclCountId: count.tctId,
                    tclRowNo: i + 1,
                    tclTenderTypeId: line.tenderTypeId,
                    tclTenderId: line.tenderId ?? null,
                    tclDenominationId: line.denominationId ?? null,
                    tclFaceValue: line.faceValue,
                    tclQty: new client_1.Prisma.Decimal(line.qty ?? 0),
                    tclEnteredAmount: line.denominationId ? ZERO : line.amount,
                    tclBatchRef: line.batchRef ?? null,
                })),
            });
        }
        return count;
    }
    async frozenTotals(tx, session) {
        const [docs] = await tx.$queryRaw `
      SELECT (SELECT count(*)::int FROM sales.sale_bill
               WHERE sb_session_id = ${session.tssId}::uuid AND sb_acc_year = ${session.tssAccYear}::char(9)
                 AND sb_status = 'POSTED') AS bills,
             (SELECT COALESCE(sum(sb_bill_amt), 0) FROM sales.sale_bill
               WHERE sb_session_id = ${session.tssId}::uuid AND sb_acc_year = ${session.tssAccYear}::char(9)
                 AND sb_status = 'POSTED') AS bill_amt,
             (SELECT count(*)::int FROM sales.sale_return
               WHERE sr_session_id = ${session.tssId}::uuid AND sr_acc_year = ${session.tssAccYear}::char(9)
                 AND sr_status = 'POSTED') AS returns,
             (SELECT COALESCE(sum(sr_return_amt), 0) FROM sales.sale_return
               WHERE sr_session_id = ${session.tssId}::uuid AND sr_acc_year = ${session.tssAccYear}::char(9)
                 AND sr_status = 'POSTED') AS return_amt`;
        const [money] = await tx.$queryRaw `
      SELECT count(DISTINCT t.td_voucher_id) FILTER (WHERE t.td_src_doc_type = 'RECEIPT')::int AS receipts,
             count(DISTINCT t.td_voucher_id) FILTER (WHERE t.td_src_doc_type = 'PAYMENT')::int AS payments,
             count(DISTINCT t.td_voucher_id) FILTER (WHERE t.td_src_doc_type = 'EXPENSE')::int AS expenses
        FROM accounts.acc_tender_detail t
        JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = t.td_voucher_id
       WHERE t.td_session_id = ${session.tssId}::uuid
         AND t.td_acc_year = ${session.tssAccYear}::char(9)
         AND t.td_is_deleted = false
         AND h.avh_voucher_status = 'POSTED'`;
        const [noSale] = await tx.$queryRaw `
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${session.tssId}::uuid
         AND tev_acc_year = ${session.tssAccYear}::char(9)
         AND tev_event_code = ${till_enum_1.TillEventCode.NO_SALE}`;
        return {
            tssBillCount: docs.bills,
            tssReturnCount: docs.returns,
            tssReceiptCount: money.receipts,
            tssPaymentCount: money.payments,
            tssExpenseCount: money.expenses,
            tssNoSaleCount: noSale.n,
            tssNetSales: dec(docs.bill_amt).minus(dec(docs.return_amt)),
        };
    }
    async tenderLedger(tx, tenderId, typeId) {
        const tender = tenderId
            ? await tx.accTenderMaster.findUnique({
                where: { tndId: tenderId },
                select: { tndLedgerId: true },
            })
            : null;
        if (!tender?.tndLedgerId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `A tender type ${typeId} variance names no tender with a ledger, so it has nothing to post to`, 'tvrTenderId');
        }
        return tender.tndLedgerId;
    }
    async expectedVisible(session, settings, asOperator) {
        if (session.tssStatus === till_enum_1.TillSessionStatus.CLOSED ||
            session.tssStatus === till_enum_1.TillSessionStatus.VOIDED) {
            return true;
        }
        const blind = session.tssCountMode ? session.tssCountMode === 'BLIND' : settings.blindClose;
        if (!blind) {
            return true;
        }
        if (asOperator) {
            return false;
        }
        return (await this.context.rights(till_enum_1.TILL_MENU.SESSIONS)).override;
    }
    async toPayload(session, visible) {
        const operator = await this.prisma.userMaster.findUnique({
            where: { usrId: session.tssOperatorId },
            select: { usrLoginName: true, usrDisplayName: true },
        });
        const dropSafe = await this.ledger.dropSafeFor(this.prisma, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            counterSafeId: session.counter.tcnSafeId,
        });
        const [movements, variances, finalLines] = await Promise.all([
            this.prisma.tillCashMovement.findMany({
                where: { tcmSessionId: session.tssId, tcmAccYear: session.tssAccYear, tcmIsDeleted: false },
                orderBy: { tcmCreatedOn: 'asc' },
            }),
            this.prisma.tillVariance.findMany({
                where: { tvrSessionId: session.tssId, tvrAccYear: session.tssAccYear, tvrIsDeleted: false },
                orderBy: [{ tvrStage: 'desc' }, { tvrTenderTypeId: 'asc' }],
            }),
            session.tssCloseCountId
                ? this.prisma.tillCountLine.findMany({
                    where: { tclCountId: session.tssCloseCountId, tclAccYear: session.tssAccYear },
                })
                : Promise.resolve([]),
        ]);
        const live = [
            till_enum_1.TillSessionStatus.OPEN,
            till_enum_1.TillSessionStatus.SUSPENDED,
            till_enum_1.TillSessionStatus.COUNTING,
        ].includes(session.tssStatus);
        const expectations = await this.ledger.expected(this.prisma, this.expectationSession(session));
        const closeVariance = variances.filter((v) => v.tvrStage === 'CLOSE' && v.tvrStatus !== 'REVERSED');
        const tenders = expectations.map((e) => {
            const frozen = live
                ? undefined
                : closeVariance.find((v) => v.tvrTenderTypeId === e.tenderTypeId && v.tvrTenderId === e.tenderId);
            const counted = frozen?.tvrCounted ??
                (e.closeMode === till_enum_1.TenderCloseMode.DENOM || e.closeMode === till_enum_1.TenderCloseMode.SLIPS
                    ? finalLines.length > 0
                        ? finalLines
                            .filter((l) => e.tenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID
                            ? l.tclTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID
                            : l.tclTenderTypeId === e.tenderTypeId &&
                                (l.tclTenderId ?? e.tenderId) === e.tenderId)
                            .reduce((s, l) => s.plus(dec(l.tclAmount)), ZERO)
                        : null
                    : null);
            const show = (v) => visible ? num(v ?? ZERO) : null;
            const expected = frozen ? dec(frozen.tvrExpected) : e.expected;
            return {
                tenderTypeId: e.tenderTypeId,
                tenderTypeName: e.tenderTypeName,
                tenderId: e.tenderId,
                tenderName: e.tenderName,
                closeMode: e.closeMode,
                openAmount: show(frozen ? dec(frozen.tvrOpenAmount) : e.open),
                salesAmount: show(frozen ? dec(frozen.tvrSalesAmount) : e.sales),
                refundAmount: show(frozen ? dec(frozen.tvrRefundAmount) : e.refund),
                receiptAmount: show(frozen ? dec(frozen.tvrReceiptAmount) : e.receipt),
                paymentAmount: show(frozen ? dec(frozen.tvrPaymentAmount) : e.payment),
                expenseAmount: show(frozen ? dec(frozen.tvrExpenseAmount) : e.expense),
                movedIn: show(frozen ? dec(frozen.tvrMovedIn) : e.movedIn),
                movedOut: show(frozen ? dec(frozen.tvrMovedOut) : e.movedOut),
                paidFromBank: show(e.paidFromBank),
                txnCount: visible ? (frozen ? frozen.tvrTxnCount : e.txnCount) : null,
                noRefCount: e.noRefCount,
                expected: show(expected),
                counted: counted === null || counted === undefined ? null : num(dec(counted)),
                variance: visible && counted !== null && counted !== undefined
                    ? num(dec(counted).minus(expected))
                    : null,
            };
        });
        const hide = (v) => (visible ? num(v ?? ZERO) : null);
        return {
            tssId: session.tssId,
            tssAccYear: session.tssAccYear,
            tssCompanyId: session.tssCompanyId,
            tssBranchId: session.tssBranchId,
            tssDayId: session.tssDayId,
            tssBusinessDate: (0, till_dates_1.isoDateOf)(session.tssBusinessDate),
            tssCounterId: session.tssCounterId,
            counterCode: session.counter.tcnCode,
            counterName: session.counter.tcnName,
            dropSafeName: dropSafe?.name ?? null,
            tssDeviceId: session.tssDeviceId,
            tssOperatorId: session.tssOperatorId,
            operatorName: operator?.usrDisplayName ?? operator?.usrLoginName ?? null,
            tssSessionNo: session.tssSessionNo,
            tssDaySeq: session.tssDaySeq,
            tssStatus: session.tssStatus,
            tssOpenedOn: session.tssOpenedOn.toISOString(),
            tssFloatMode: session.tssFloatMode,
            tssPrevSessionId: session.tssPrevSessionId,
            tssFloatIssued: num(session.tssFloatIssued),
            tssFloatCounted: num(session.tssFloatCounted),
            tssFloatVariance: num(dec(session.tssFloatCounted).minus(dec(session.tssFloatIssued))),
            tssSuspendCount: session.tssSuspendCount,
            tssSuspendedOn: session.tssSuspendedOn?.toISOString() ?? null,
            tssBillingEndedOn: session.tssBillingEndedOn?.toISOString() ?? null,
            tssCountMode: session.tssCountMode,
            tssCountPlace: session.tssCountPlace,
            tssCountAttempts: session.tssCountAttempts,
            tssCountedOn: session.tssCountedOn?.toISOString() ?? null,
            tssClosedOn: session.tssClosedOn?.toISOString() ?? null,
            tssClosedBy: session.tssClosedBy,
            tssZNo: session.tssZNo,
            tssForceClosed: session.tssForceClosed,
            tssForceReasonId: session.tssForceReasonId,
            tssReopenCount: session.tssReopenCount,
            tssPrintCount: session.tssPrintCount,
            tssVarianceStatus: session.tssVarianceStatus,
            totals: {
                billCount: session.tssBillCount,
                returnCount: session.tssReturnCount,
                receiptCount: session.tssReceiptCount,
                paymentCount: session.tssPaymentCount,
                expenseCount: session.tssExpenseCount,
                netSales: hide(session.tssNetSales),
                cashExpected: hide(session.tssCashExpected),
                cashCounted: hide(session.tssCashCounted),
                cashVariance: hide(dec(session.tssCashCounted).minus(dec(session.tssCashExpected))),
                noncashExpected: hide(session.tssNoncashExpected),
                noncashCounted: hide(session.tssNoncashCounted),
                noncashVariance: hide(dec(session.tssNoncashCounted).minus(dec(session.tssNoncashExpected))),
                handedOver: num(session.tssHandedOver),
                floatLeft: num(session.tssFloatLeft),
            },
            expectedVisible: visible,
            cashLimit: MOVABLE.includes(session.tssStatus)
                ? await this.cashState(this.prisma, session).then(({ state, gauge, alertLimit, blockLimit }) => ({
                    state,
                    gauge,
                    alertLimit,
                    blockLimit,
                }))
                : null,
            tenders,
            movements: movements.map((m) => ({
                tcmId: m.tcmId,
                tcmAccYear: m.tcmAccYear,
                tcmKind: m.tcmKind,
                tcmDocNo: m.tcmDocNo,
                tcmDocDate: (0, till_dates_1.isoDateOf)(m.tcmDocDate),
                tcmAmount: num(m.tcmAmount),
                tcmSafeId: m.tcmSafeId,
                tcmVoucherId: m.tcmVoucherId,
                tcmStatus: m.tcmStatus,
                tcmCreatedOn: m.tcmCreatedOn.toISOString(),
                tcmReceiptStatus: m.tcmReceiptStatus ?? null,
                tcmReceivedAmount: m.tcmReceivedAmount === null ? null : num(m.tcmReceivedAmount),
                tcmReceivedOn: m.tcmReceivedOn?.toISOString() ?? null,
            })),
            variances: visible
                ? variances.map((v) => ({
                    tvrId: v.tvrId,
                    tvrAccYear: v.tvrAccYear,
                    tvrStage: v.tvrStage,
                    tvrMovementId: v.tvrMovementId,
                    tvrTenderTypeId: v.tvrTenderTypeId,
                    tvrTenderId: v.tvrTenderId,
                    tvrExpected: num(v.tvrExpected),
                    tvrCounted: num(v.tvrCounted),
                    tvrVariance: num(dec(v.tvrCounted).minus(dec(v.tvrExpected))),
                    tvrTolerance: num(v.tvrTolerance),
                    tvrTreatment: v.tvrTreatment,
                    tvrReasonId: v.tvrReasonId,
                    tvrStatus: v.tvrStatus,
                    tvrVoucherId: v.tvrVoucherId,
                    tvrApprovalId: v.tvrApprovalId,
                    tvrDecidedBy: v.tvrDecidedBy,
                    tvrRecoveryLedgerId: v.tvrRecoveryLedgerId,
                }))
                : [],
            ...(await this.receiptOf(movements, session.tssOperatorId)),
        };
    }
    async receiptOf(movements, operatorId) {
        const bags = movements.filter((m) => m.tcmStatus === 'POSTED' && !m.tcmIsDeleted && m.tcmReceiptStatus !== null);
        const latest = bags
            .filter((m) => m.tcmReceivedOn !== null)
            .sort((a, b) => b.tcmReceivedOn.getTime() - a.tcmReceivedOn.getTime())[0];
        const receiver = latest?.tcmReceivedBy
            ? await this.prisma.userMaster.findUnique({
                where: { usrId: latest.tcmReceivedBy },
                select: { usrLoginName: true, usrDisplayName: true },
            })
            : null;
        return {
            receiptState: receiptStateOf(movements),
            cashAwaiting: num(bags
                .filter((m) => m.tcmReceiptStatus === till_enum_1.TillReceiptStatus.AWAITING)
                .reduce((sum, m) => sum.plus(dec(m.tcmAmount)), ZERO)),
            receivedBy: latest?.tcmReceivedBy ?? null,
            receivedByName: receiver ? receiver.usrDisplayName?.trim() || receiver.usrLoginName : null,
            receivedOn: latest?.tcmReceivedOn?.toISOString() ?? null,
            receivedBySelf: !!latest?.tcmReceivedBy && latest.tcmReceivedBy === operatorId,
        };
    }
    expectationSession(session) {
        return {
            tssId: session.tssId,
            tssAccYear: session.tssAccYear,
            tssCompanyId: session.tssCompanyId,
            tssBranchId: session.tssBranchId,
            tssFloatCounted: dec(session.tssFloatCounted),
            tssClosedOn: session.tssClosedOn,
        };
    }
    postingSession(session, businessDate) {
        return {
            tssId: session.tssId,
            tssAccYear: session.tssAccYear,
            tssCompanyId: session.tssCompanyId,
            tssBranchId: session.tssBranchId,
            tssTenantId: session.tssTenantId,
            tssDayId: session.tssDayId,
            tssCounterId: session.tssCounterId,
            tssDeviceId: session.tssDeviceId,
            sessionNo: session.tssSessionNo,
            businessDate,
        };
    }
    async logSessionEvent(tx, session, caller, code, payload) {
        await this.events.log(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            code,
            sessionId: session.tssId,
            dayId: session.tssDayId,
            counterId: session.tssCounterId,
            deviceId: caller.deviceId ?? session.tssDeviceId,
            userId: caller.userId,
            srcRefno: session.tssSessionNo,
            payload: payload,
        });
    }
};
exports.TillSessionService = TillSessionService;
exports.TillSessionService = TillSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_approval_service_1.TillApprovalService,
        till_context_service_1.TillContextService,
        till_day_service_1.TillDayService,
        till_ledger_service_1.TillLedgerService,
        till_posting_service_1.TillPostingService,
        till_event_service_1.TillEventService])
], TillSessionService);
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(value) {
    return UUID_LIKE.test(value);
}
function tenderKey(typeId, tenderId) {
    return `${typeId}|${tenderId ?? '*'}`;
}
function isSlipRow(row) {
    return row.expectation.closeMode === till_enum_1.TenderCloseMode.SLIPS;
}
function receiptStateOf(movements) {
    const bags = movements.filter((m) => m.tcmStatus === 'POSTED' && !m.tcmIsDeleted && m.tcmReceiptStatus !== null);
    if (bags.length === 0) {
        return till_enum_1.TillCashReceiptState.NONE;
    }
    if (bags.some((m) => m.tcmReceiptStatus === till_enum_1.TillReceiptStatus.AWAITING)) {
        return till_enum_1.TillCashReceiptState.AWAITING;
    }
    return bags.some((m) => !dec(m.tcmReceivedAmount).equals(dec(m.tcmAmount)))
        ? till_enum_1.TillCashReceiptState.DIFFERENCE
        : till_enum_1.TillCashReceiptState.APPROVED;
}
function isSlipVariance(v) {
    return v.tvrSlipCount !== null;
}
//# sourceMappingURL=till-session.service.js.map