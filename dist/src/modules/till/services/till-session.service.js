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
const till_day_service_1 = require("./till-day.service");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const till_posting_service_1 = require("./till-posting.service");
const till_enum_1 = require("../types/till-enum");
const ZERO = new client_1.Prisma.Decimal(0);
const MOVABLE = [till_enum_1.TillSessionStatus.OPEN, till_enum_1.TillSessionStatus.SUSPENDED];
const dec = (v) => v === null || v === undefined ? ZERO : new client_1.Prisma.Decimal(v);
const num = (v) => (v ? Number(v.toFixed(2)) : 0);
let TillSessionService = class TillSessionService {
    prisma;
    context;
    days;
    ledger;
    posting;
    events;
    constructor(prisma, context, days, ledger, posting, events) {
        this.prisma = prisma;
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
                if (!floatCounted.equals(floatIssued)) {
                    const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
                    await tx.tillVariance.create({
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
                            tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
                            tvrStatus: 'OPEN',
                            tvrCreatedBy: caller.actorName,
                        },
                    });
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
            (0, till_errors_1.throwTillBadRequest)('deviceId is not the device this login came from', 'deviceId');
        }
        if (scope.userId && scope.userId !== caller.userId) {
            (0, till_errors_1.throwTillBadRequest)('userId is not the user of this login', 'userId');
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
            include: { counter: { select: { tcnCode: true, tcnName: true } } },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
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
            include: { counter: { select: { tcnCode: true, tcnName: true } } },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
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
            const settings = await this.context.settings({
                companyId: key.companyId,
                branchId: key.branchId,
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
                    tssCountPlace: settings.countPlace,
                    tssModifiedOn: new Date(),
                    tssModifiedBy: caller.actorName,
                },
            });
            await this.logSessionEvent(tx, session, caller, till_enum_1.TillEventCode.SESSION_END_BILLING, {
                holdsReleased: released,
                countMode: settings.blindClose ? 'BLIND' : 'OPEN',
            });
        });
        return this.get(key, { asOperator: true });
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
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
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
            const settings = await this.context.settings({
                companyId: key.companyId,
                branchId: key.branchId,
                deviceId: session.tssDeviceId,
                userId: session.tssOperatorId,
            });
            const maxAttempts = 1 + settings.maxRecounts;
            if (session.tssCountAttempts >= maxAttempts) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECOUNT_LIMIT, `${session.tssCountAttempts} count(s) already made; a further recount needs RECOUNT approval`, 'tssId', { event: 'RECOUNT', attempts: session.tssCountAttempts });
            }
            if (input.witnessBy && input.witnessBy === caller.userId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'The witness must be someone other than the counter', 'witnessBy');
            }
            const expectations = await this.ledger.expected(tx, this.expectationSession(session));
            const priced = await this.priceLines(tx, key.companyId, input.lines);
            await this.assertCountable(tx, input.lines);
            if (settings.closeByTerminal) {
                this.assertTerminalNamed(input.lines, expectations);
            }
            const counted = this.countedByTender(priced, expectations);
            const rows = this.compare(expectations, counted, settings);
            const outOfTolerance = rows.filter((r) => !r.within);
            const attemptNo = session.tssCountAttempts + 1;
            const isLast = attemptNo >= maxAttempts;
            const outcome = outOfTolerance.length === 0
                ? till_enum_1.TillCountOutcome.ACCEPTED
                : isLast
                    ? till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL
                    : till_enum_1.TillCountOutcome.RECOUNT_REQUIRED;
            const isFinal = outcome !== till_enum_1.TillCountOutcome.RECOUNT_REQUIRED;
            const countedRows = rows.filter((r) => r.counted !== null);
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
            if (isFinal) {
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
                    tssVarianceStatus: outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL
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
            return {
                tctId: count.tctId,
                attemptNo,
                attemptsLeft: Math.max(0, maxAttempts - attemptNo),
                outcome,
                status: isFinal && outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL
                    ? till_enum_1.TillSessionStatus.PENDING_APPROVAL
                    : session.tssStatus,
                blind: session.tssCountMode === 'BLIND',
                operatorId: session.tssOperatorId,
            };
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
            tssStatus: result.status,
            variances,
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
            if (session.tssStatus === till_enum_1.TillSessionStatus.PENDING_APPROVAL) {
                const pending = await tx.tillVariance.findMany({
                    where: {
                        tvrSessionId: session.tssId,
                        tvrAccYear: session.tssAccYear,
                        tvrIsDeleted: false,
                        tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
                    },
                    select: { tvrTenderTypeId: true, tvrExpected: true, tvrCounted: true },
                });
                const cashGap = pending.find((p) => p.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID);
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.APPROVAL_REQUIRED, 'The count is outside tolerance: the variance needs an approver before this session can close', 'tssId', {
                    event: cashGap ? 'CASH_VARIANCE' : 'NONCASH_VARIANCE',
                    amount: num(pending.reduce((s, p) => s.plus(dec(p.tvrCounted).minus(dec(p.tvrExpected)).abs()), ZERO)),
                    requiredRole: cashGap ? 'SUPERVISOR' : 'STORE_MANAGER',
                    channel: 'EITHER',
                });
            }
            if (!session.tssCloseCountId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.NOT_COUNTED, 'Count the drawer first (/till/sessions/count)', 'tssId');
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
                if (treatment !== till_enum_1.TillVarianceTreatment.WITHIN_TOLERANCE &&
                    treatment !== till_enum_1.TillVarianceTreatment.EXPENSE) {
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
                });
            }
            const totals = await this.frozenTotals(tx, session);
            const zNo = counter.tcnZLastNo + 1;
            await tx.tillCounter.update({
                where: { tcnId: counter.tcnId },
                data: { tcnZLastNo: zNo, tcnModifiedOn: new Date(), tcnModifiedBy: caller.actorName },
            });
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
            });
        });
        return this.get(key, { asOperator: true });
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
                tssStatus: { in: till_enum_1.LIVE_SESSION_STATUSES },
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
        if (!counter || (!held && !counter.tcnRequiresSession)) {
            return null;
        }
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        if (!held && !settings.requireSession) {
            return null;
        }
        const named = scope.sessionId && isUuidLike(scope.sessionId)
            ? await client.tillSession.findFirst({
                where: { tssId: scope.sessionId, tssIsDeleted: false },
            })
            : null;
        const session = named ??
            held ??
            (await client.tillSession.findFirst({
                where: {
                    tssCounterId: counter.tcnId,
                    tssIsDeleted: false,
                    tssStatus: { in: till_enum_1.LIVE_SESSION_STATUSES },
                },
                orderBy: { tssOpenedOn: 'desc' },
            }));
        if (!session) {
            if (scope.optional) {
                return null;
            }
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_REQUIRED, 'This counter has no open till session: open one (Open Till) before taking money', scope.field);
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
        const today = scope.docTime
            ? await (0, till_dates_1.businessDateAt)(client, scope.docTime, settings.dayCutoff)
            : await (0, till_dates_1.businessDateNow)(client, settings.dayCutoff);
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
                    cutoff: settings.dayCutoff,
                },
            });
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_DAY_ENDED, `Session ${session.tssSessionNo} belongs to business date ${ref.businessDate}; it is now ${today} ` +
                `(cut-off ${settings.dayCutoff}). End and count it, then open a session for today.`, scope.field, { sessionDate: ref.businessDate, businessDate: today });
        }
        const drawer = session.tssCounterId === counter.tcnId
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
        if (!caller.deviceId) {
            return none;
        }
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        if (!settings.moneyDocsInSession) {
            return none;
        }
        const ref = await this.resolveForMoney(client, {
            companyId: scope.companyId,
            branchId: scope.branchId,
            sessionId: scope.sessionId,
            field: scope.field,
            optional: !scope.hasCash,
            cashIn: scope.cashIn,
        });
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
        const caller = await this.context.caller(client);
        if (!caller.deviceId || scope.ledgerIds.length === 0) {
            return;
        }
        const held = await client.tillSession.findFirst({
            where: {
                tssDeviceId: caller.deviceId,
                tssCompanyId: scope.companyId,
                tssBranchId: scope.branchId,
                tssIsDeleted: false,
                tssStatus: { in: [...till_enum_1.LIVE_SESSION_STATUSES] },
            },
            select: { tssSessionNo: true },
        });
        if (!held) {
            return;
        }
        const cash = await this.ledger.tillCashTender(client, scope.companyId, scope.branchId);
        if (scope.ledgerIds.includes(cash.ledgerId)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.CASH_LEDGER_DIRECT, `This device is in till session ${held.tssSessionNo}: cash leaves or enters the drawer through a ` +
                'receipt, payment, expense voucher or till movement, never a journal or contra on the till cash ledger', scope.field, { sessionNo: held.tssSessionNo });
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
            (0, till_errors_1.throwTillBadRequest)('This device is linked to no counter: name one of the free counters (counterId)', 'counterId');
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
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
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
            isBlind: false,
            lines: input.lines,
            expected: total,
            caller: input.caller,
            deviceId: input.deviceId,
            witnessBy: input.witnessBy ?? null,
        });
        await tx.tillCount.update({
            where: { tctId_tctAccYear: { tctId: count.tctId, tctAccYear: session.tssAccYear } },
            data: { tctSafeId: input.safeId, tctMovementId: input.movementId },
        });
        return count.tctId;
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
        const pending = !row.within && outcome === till_enum_1.TillCountOutcome.SENT_FOR_APPROVAL;
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
        if (!tender) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `A tender type ${typeId} variance names no tender, so it has no ledger to post to`, 'tvrTenderId');
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
            })),
            variances: visible
                ? variances.map((v) => ({
                    tvrId: v.tvrId,
                    tvrAccYear: v.tvrAccYear,
                    tvrStage: v.tvrStage,
                    tvrTenderTypeId: v.tvrTenderTypeId,
                    tvrTenderId: v.tvrTenderId,
                    tvrExpected: num(v.tvrExpected),
                    tvrCounted: num(v.tvrCounted),
                    tvrVariance: num(dec(v.tvrCounted).minus(dec(v.tvrExpected))),
                    tvrTolerance: num(v.tvrTolerance),
                    tvrTreatment: v.tvrTreatment,
                    tvrStatus: v.tvrStatus,
                    tvrVoucherId: v.tvrVoucherId,
                }))
                : [],
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
//# sourceMappingURL=till-session.service.js.map