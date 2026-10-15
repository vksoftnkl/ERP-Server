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
exports.TillMovementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const rights_1 = require("../../../common/posting/rights");
const secret_hash_utils_1 = require("../../../common/utils/secret-hash.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_context_service_1 = require("../till-context.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
const till_approval_service_1 = require("./till-approval.service");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const till_posting_service_1 = require("./till-posting.service");
const till_session_service_1 = require("./till-session.service");
const till_enum_1 = require("../types/till-enum");
const ZERO = new client_1.Prisma.Decimal(0);
const num = (v) => (v ? Number(v.toFixed(2)) : 0);
const MOVABLE_STATUSES = [
    till_enum_1.TillSessionStatus.OPEN,
    till_enum_1.TillSessionStatus.SUSPENDED,
];
const VOIDABLE_STATUSES = [
    till_enum_1.TillSessionStatus.OPEN,
    till_enum_1.TillSessionStatus.SUSPENDED,
    till_enum_1.TillSessionStatus.COUNTING,
];
const REASON_CATEGORY = {
    [till_enum_1.TillMovementKind.PICKUP]: 'PICKUP',
    [till_enum_1.TillMovementKind.PAID_IN]: 'PAID_IN',
};
let TillMovementService = class TillMovementService {
    prisma;
    context;
    ledger;
    posting;
    sessions;
    events;
    approval;
    constructor(prisma, context, ledger, posting, sessions, events, approval) {
        this.prisma = prisma;
        this.context = context;
        this.ledger = ledger;
        this.posting = posting;
        this.sessions = sessions;
        this.events = events;
        this.approval = approval;
    }
    async create(input) {
        const caller = await this.context.caller();
        if (!till_enum_1.CASHIER_MOVEMENTS.includes(input.kind) && !till_enum_1.SUPERVISOR_MOVEMENTS.includes(input.kind)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `${input.kind} is not posted by hand (the open issues the float, the close hands over, the cash office remits)`, 'kind');
        }
        const signedKind = till_enum_1.SUPERVISOR_MOVEMENTS.includes(input.kind);
        const supervisor = signedKind ? await this.proveSupervisor(input, caller) : null;
        const tcmId = await this.prisma.$transaction(async (tx) => {
            const session = await this.lockSession(tx, input);
            if (signedKind) {
                this.assertAtCounter(session, caller);
            }
            else {
                this.assertOperator(session, caller);
            }
            let witnessBy = signedKind
                ? (supervisor?.userId ?? null)
                : (input.witnessBy ?? null);
            if (witnessBy === caller.userId) {
                witnessBy = null;
            }
            if (input.kind === till_enum_1.TillMovementKind.DROP && input.lines.length > 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'A drop is a sealed bag: declare its amount; the cash office counts it when it verifies the bag', 'lines');
            }
            if (input.kind !== till_enum_1.TillMovementKind.EXCHANGE && input.outLines.length > 0) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'Only an exchange counts what went out', 'outLines');
            }
            this.assertCashLines(input.lines, 'lines');
            this.assertCashLines(input.outLines, 'outLines');
            const inLines = await this.sessions.priceLines(tx, input.companyId, input.lines);
            const outLines = await this.sessions.priceLines(tx, input.companyId, input.outLines);
            const inTotal = inLines.reduce((s, l) => s.plus(l.amount), ZERO);
            const outTotal = outLines.reduce((s, l) => s.plus(l.amount), ZERO);
            let amount;
            if (input.kind === till_enum_1.TillMovementKind.EXCHANGE) {
                if (inLines.length === 0 || outLines.length === 0 || !inTotal.equals(outTotal)) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'An exchange counts both sides, and what comes in equals what goes out', 'outLines');
                }
                amount = inTotal;
            }
            else if (inLines.length > 0) {
                amount = inTotal;
                if (input.amount !== undefined && input.amount !== null && !amount.equals(input.amount)) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `The amount (${input.amount}) is not what the denominations add up to (${amount.toFixed(2)})`, 'amount');
                }
            }
            else {
                amount = new client_1.Prisma.Decimal(input.amount ?? 0);
            }
            if (!amount.greaterThan(0)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'A movement moves more than nothing', 'amount');
            }
            const reason = await this.loadReason(tx, input, amount);
            const counter = await tx.tillCounter.findUniqueOrThrow({
                where: { tcnId: session.tssCounterId },
            });
            const safeScope = {
                companyId: input.companyId,
                branchId: input.branchId,
                counterSafeId: counter.tcnSafeId,
            };
            let safe = null;
            if (input.kind === till_enum_1.TillMovementKind.DROP) {
                safe = await this.ledger.dropSafeFor(tx, safeScope);
                if (!safe) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.NO_DROP_SAFE, `Counter ${counter.tcnCode} has no drop safe: give the bag to a supervisor as a Pickup, or set a drop safe on the counter (Till Masters, menu 275)`, 'kind');
                }
            }
            else if (input.kind !== till_enum_1.TillMovementKind.PAID_IN) {
                safe = await this.ledger.safeFor(tx, safeScope);
            }
            if (input.kind !== till_enum_1.TillMovementKind.PAID_IN && !safe) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, `A ${input.kind.toLowerCase().replace('_', ' ')} moves cash to or from a safe, and this branch has none (Till Masters, menu 275)`, 'kind');
            }
            let ledgerId = null;
            if (input.kind === till_enum_1.TillMovementKind.PAID_IN) {
                ledgerId = input.ledgerId ?? reason?.trsLedgerId ?? null;
                if (!ledgerId) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'A paid-in names the ledger the money comes from (or a reason that has one)', 'ledgerId');
                }
                await this.assertLedger(tx, ledgerId, input.companyId);
            }
            let awaitingLedgerId = null;
            if (input.kind === till_enum_1.TillMovementKind.DROP) {
                const settings = await this.context.settings({
                    companyId: input.companyId,
                    branchId: input.branchId,
                    deviceId: session.tssDeviceId,
                    userId: session.tssOperatorId,
                });
                if (settings.handoverReceipt === till_enum_1.TillHandoverReceipt.REQUIRED) {
                    awaitingLedgerId = await this.ledger.roleLedger(tx, till_enum_1.TILL_CASH_AWAITING_ROLE, input.companyId, input.branchId);
                }
            }
            const tcmIdDrawn = await this.newId(tx);
            const deviceId = caller.deviceId ?? session.tssDeviceId;
            let countId = null;
            if (inLines.length > 0) {
                countId = await this.sessions.writeMovementCount(tx, session, {
                    kind: input.kind === till_enum_1.TillMovementKind.PICKUP
                        ? till_enum_1.TillCountKind.PICKUP
                        : till_enum_1.TillCountKind.FLOAT_ISSUE,
                    lines: inLines,
                    safeId: safe?.safeId ?? null,
                    movementId: tcmIdDrawn,
                    caller,
                    deviceId,
                    witnessBy,
                });
            }
            if (outLines.length > 0) {
                await this.sessions.writeMovementCount(tx, session, {
                    kind: till_enum_1.TillCountKind.PICKUP,
                    lines: outLines,
                    safeId: safe?.safeId ?? null,
                    movementId: tcmIdDrawn,
                    caller,
                    deviceId,
                    witnessBy,
                });
            }
            const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
            const posted = await this.posting.postMovement(tx, {
                session: this.postingSession(session),
                kind: input.kind,
                amount,
                safe,
                ledgerId,
                tillCash,
                caller,
                tcmId: tcmIdDrawn,
                doneBy: caller.userId,
                witnessBy,
                reasonId: reason?.trsId ?? null,
                refNo: input.refNo ?? null,
                refDate: input.refDate ?? null,
                partyName: input.partyName ?? null,
                bagNo: input.bagNo ?? null,
                sealNo: input.sealNo ?? null,
                countId,
                notes: input.notes ?? null,
                deviceId,
                witnessVerifiedOn: supervisor?.verifiedOn ?? null,
                awaitingLedgerId,
            });
            return posted.tcmId;
        });
        return this.get({
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: input.accYear,
            tcmId,
        });
    }
    async change(input) {
        const caller = await this.context.caller();
        if (input.fromTssId === input.toTssId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'Change goes from one counter to ANOTHER', 'toTssId');
        }
        if (input.lines.length === 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'Count the change that moves, by denomination', 'lines');
        }
        this.assertCashLines(input.lines, 'lines');
        const scope = { companyId: input.companyId, branchId: input.branchId, accYear: input.accYear };
        const fromPeek = await this.peekSession({ ...scope, tssId: input.fromTssId });
        const toPeek = await this.peekSession({ ...scope, tssId: input.toTssId });
        if (fromPeek.tssOperatorId === caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'The cashier giving the change witnesses it; the supervisor carrying it must be someone else', 'fromTssId');
        }
        const fromVerifiedOn = await this.checkWitnessPin(fromPeek, {
            witnessId: fromPeek.tssOperatorId,
            pin: input.fromWitnessPin,
            kind: till_enum_1.TillMovementKind.PICKUP,
            pinField: 'fromWitnessPin',
            whoField: 'fromTssId',
            action: 'change',
            caller,
        });
        const toVerifiedOn = toPeek.tssOperatorId === caller.userId
            ? null
            : await this.checkWitnessPin(toPeek, {
                witnessId: toPeek.tssOperatorId,
                pin: input.toWitnessPin,
                kind: till_enum_1.TillMovementKind.TOP_UP,
                pinField: 'toWitnessPin',
                whoField: 'toTssId',
                action: 'change',
                caller,
            });
        const ids = await this.prisma.$transaction(async (tx) => {
            const keys = [input.fromTssId, input.toTssId].sort();
            const locked = new Map();
            for (const tssId of keys) {
                locked.set(tssId, await this.lockSession(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    accYear: input.accYear,
                    tssId,
                }));
            }
            const from = locked.get(input.fromTssId);
            const to = locked.get(input.toTssId);
            if (from.tssOperatorId === caller.userId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'The cashier giving the change witnesses it; the supervisor carrying it must be someone else', 'fromTssId');
            }
            const priced = await this.sessions.priceLines(tx, input.companyId, input.lines);
            const amount = priced.reduce((s, l) => s.plus(l.amount), ZERO);
            if (!amount.greaterThan(0)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'Change of nothing moves nothing', 'lines');
            }
            const reason = await this.loadReason(tx, { ...input, kind: till_enum_1.TillMovementKind.PICKUP, tssId: input.fromTssId, outLines: [] }, amount);
            const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
            const safeOf = async (session) => {
                const counter = await tx.tillCounter.findUniqueOrThrow({
                    where: { tcnId: session.tssCounterId },
                });
                const safe = await this.ledger.safeFor(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    counterSafeId: counter.tcnSafeId,
                });
                if (!safe) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, 'Change between counters passes the safe, and this branch has none (Till Masters, menu 275)', 'fromTssId');
                }
                return { safe, code: counter.tcnCode };
            };
            const giving = await safeOf(from);
            const taking = await safeOf(to);
            const deviceId = caller.deviceId ?? from.tssDeviceId;
            const pickupId = await this.newId(tx);
            const pickupCount = await this.sessions.writeMovementCount(tx, from, {
                kind: till_enum_1.TillCountKind.PICKUP,
                lines: priced,
                safeId: giving.safe.safeId,
                movementId: pickupId,
                caller,
                deviceId,
                witnessBy: from.tssOperatorId,
            });
            await this.posting.postMovement(tx, {
                session: this.postingSession(from),
                kind: till_enum_1.TillMovementKind.PICKUP,
                amount,
                safe: giving.safe,
                tillCash,
                caller,
                tcmId: pickupId,
                doneBy: caller.userId,
                witnessBy: from.tssOperatorId,
                reasonId: reason.trsId,
                countId: pickupCount,
                notes: input.notes ?? `Change to ${taking.code} (${to.tssSessionNo})`,
                deviceId,
                witnessVerifiedOn: fromVerifiedOn,
            });
            const topUpId = await this.newId(tx);
            const topUpCount = await this.sessions.writeMovementCount(tx, to, {
                kind: till_enum_1.TillCountKind.FLOAT_ISSUE,
                lines: priced,
                safeId: taking.safe.safeId,
                movementId: topUpId,
                caller,
                deviceId,
                witnessBy: to.tssOperatorId === caller.userId ? null : to.tssOperatorId,
            });
            await this.posting.postMovement(tx, {
                session: this.postingSession(to),
                kind: till_enum_1.TillMovementKind.TOP_UP,
                amount,
                safe: taking.safe,
                tillCash,
                caller,
                tcmId: topUpId,
                doneBy: caller.userId,
                witnessBy: to.tssOperatorId === caller.userId ? null : to.tssOperatorId,
                countId: topUpCount,
                notes: input.notes ?? `Change from ${giving.code} (${from.tssSessionNo})`,
                deviceId,
                witnessVerifiedOn: toVerifiedOn,
            });
            return { pickupId, topUpId };
        });
        const key = { companyId: input.companyId, branchId: input.branchId, accYear: input.accYear };
        return {
            from: await this.get({ ...key, tcmId: ids.pickupId }),
            to: await this.get({ ...key, tcmId: ids.topUpId }),
        };
    }
    async get(key) {
        const m = await this.prisma.tillCashMovement.findFirst({
            where: {
                tcmId: key.tcmId,
                tcmAccYear: key.accYear,
                tcmCompanyId: key.companyId,
                tcmBranchId: key.branchId,
                tcmIsDeleted: false,
            },
            include: {
                reason: { select: { trsCode: true, trsName: true } },
                safe: { select: { tsfName: true } },
            },
        });
        if (!m) {
            (0, till_errors_1.throwTillNotFound)('Till movement', 'tcmId', key.tcmId);
        }
        const counts = await this.prisma.tillCount.findMany({
            where: { tctMovementId: m.tcmId, tctAccYear: m.tcmAccYear, tctIsDeleted: false },
            include: { lines: { orderBy: { tclRowNo: 'asc' } } },
            orderBy: { tctCreatedOn: 'asc' },
        });
        const session = m.tcmSessionId
            ? await this.prisma.tillSession.findUnique({
                where: { tssId_tssAccYear: { tssId: m.tcmSessionId, tssAccYear: m.tcmAccYear } },
                select: { tssSessionNo: true, tssOperatorId: true },
            })
            : null;
        return {
            tcmId: m.tcmId,
            tcmAccYear: m.tcmAccYear,
            tcmKind: m.tcmKind,
            tcmDocNo: m.tcmDocNo,
            tcmDocDate: (0, till_dates_1.isoDateOf)(m.tcmDocDate),
            tcmAmount: num(m.tcmAmount),
            tcmSafeId: m.tcmSafeId,
            safeName: m.safe?.tsfName ?? null,
            tcmVoucherId: m.tcmVoucherId,
            tcmStatus: m.tcmStatus,
            tcmCreatedOn: m.tcmCreatedOn.toISOString(),
            tcmSessionId: m.tcmSessionId,
            sessionNo: session?.tssSessionNo ?? null,
            sessionOperatorId: session?.tssOperatorId ?? null,
            tcmLedgerId: m.tcmLedgerId,
            tcmReasonId: m.tcmReasonId,
            reasonCode: m.reason?.trsCode ?? null,
            reasonName: m.reason?.trsName ?? null,
            tcmRefNo: m.tcmRefNo,
            tcmRefDate: m.tcmRefDate ? (0, till_dates_1.isoDateOf)(m.tcmRefDate) : null,
            tcmPartyName: m.tcmPartyName,
            tcmBagNo: m.tcmBagNo,
            tcmSealNo: m.tcmSealNo,
            tcmDoneBy: m.tcmDoneBy,
            tcmWitnessBy: m.tcmWitnessBy,
            tcmWitnessVerifiedOn: m.tcmWitnessVerifiedOn?.toISOString() ?? null,
            tcmVoidedOn: m.tcmVoidedOn?.toISOString() ?? null,
            tcmVoidedBy: m.tcmVoidedBy,
            tcmVoidReasonId: m.tcmVoidReasonId,
            tcmNotes: m.tcmNotes,
            tcmReceiptStatus: m.tcmReceiptStatus ?? null,
            tcmReceivedAmount: m.tcmReceivedAmount === null ? null : num(m.tcmReceivedAmount),
            tcmReceivedOn: m.tcmReceivedOn?.toISOString() ?? null,
            tcmReceivedBy: m.tcmReceivedBy,
            tcmReceiveVoucherId: m.tcmReceiveVoucherId,
            tcmRemitMode: m.tcmRemitMode ?? null,
            tcmRemitStatus: m.tcmRemitStatus ?? null,
            tcmCitAgency: m.tcmCitAgency,
            tcmBankDate: m.tcmBankDate ? (0, till_dates_1.isoDateOf)(m.tcmBankDate) : null,
            tcmBankRef: m.tcmBankRef,
            tcmBankAmount: m.tcmBankAmount === null ? null : num(m.tcmBankAmount),
            tcmConfirmedBy: m.tcmConfirmedBy,
            tcmConfirmedOn: m.tcmConfirmedOn?.toISOString() ?? null,
            tcmConfirmVoucherId: m.tcmConfirmVoucherId,
            counts: counts.map((c) => ({
                tctId: c.tctId,
                tctKind: c.tctKind,
                tctTotalCounted: num(c.tctTotalCounted),
                lines: c.lines.map((l) => ({
                    tenderTypeId: l.tclTenderTypeId,
                    denominationId: l.tclDenominationId,
                    faceValue: num(l.tclFaceValue),
                    qty: Number(l.tclQty),
                    amount: num(l.tclAmount),
                })),
            })),
        };
    }
    async void(input) {
        const caller = await this.context.caller();
        await this.prisma.$transaction(async (tx) => {
            const movement = await tx.tillCashMovement.findFirst({
                where: {
                    tcmId: input.tcmId,
                    tcmAccYear: input.accYear,
                    tcmCompanyId: input.companyId,
                    tcmBranchId: input.branchId,
                    tcmIsDeleted: false,
                },
            });
            if (!movement) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_FOUND, `Till movement ${input.tcmId} was not found`, 'tcmId');
            }
            if (!movement.tcmSessionId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, 'A cash-office movement is not voided here', 'tcmId');
            }
            const session = await this.lockSession(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: movement.tcmAccYear,
                tssId: movement.tcmSessionId,
            }, VOIDABLE_STATUSES);
            if (session.tssCloseCountId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_SESSION_CLOSED, `Session ${session.tssSessionNo} has a final count: correct it with a new movement in the current session, or reopen`, 'tcmId');
            }
            const fresh = await tx.tillCashMovement.findUniqueOrThrow({
                where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
            });
            if (fresh.tcmStatus !== 'POSTED') {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, `Movement ${fresh.tcmDocNo} is already ${fresh.tcmStatus}`, 'tcmId');
            }
            if (!till_enum_1.VOIDABLE_MOVEMENTS.includes(fresh.tcmKind)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, `A ${fresh.tcmKind} is the session's own (its open or its close) and is not voided`, 'tcmId');
            }
            if (fresh.tcmReceiptStatus === till_enum_1.TillReceiptStatus.RECEIVED) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, `${fresh.tcmDocNo} has been received into the safe and is not voided`, 'tcmId');
            }
            const reason = await tx.tillReason.findFirst({
                where: {
                    trsId: input.reasonId,
                    trsIsDeleted: false,
                    trsIsActive: true,
                    trsCategory: 'MOVEMENT_VOID',
                    OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
                },
            });
            if (!reason) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, 'A void names an active MOVEMENT_VOID reason', 'reasonId');
            }
            if (reason.trsNeedsNote && !input.notes?.trim()) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
            }
            await this.posting.voidMovement(tx, {
                movement: fresh,
                session: this.postingSession(session),
                reasonId: reason.trsId,
                reasonText: input.notes?.trim()
                    ? `${reason.trsName} — ${input.notes.trim()}`
                    : reason.trsName,
                caller,
            });
        });
        return this.get({
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: input.accYear,
            tcmId: input.tcmId,
        });
    }
    async operatorOf(key) {
        const m = await this.prisma.tillCashMovement.findFirst({
            where: {
                tcmId: key.tcmId,
                tcmAccYear: key.accYear,
                tcmCompanyId: key.companyId,
                tcmBranchId: key.branchId,
            },
            select: { tcmSessionId: true, tcmAccYear: true },
        });
        if (!m) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_FOUND, `Till movement ${key.tcmId} was not found`, 'tcmId');
        }
        if (!m.tcmSessionId) {
            return null;
        }
        const s = await this.prisma.tillSession.findUnique({
            where: { tssId_tssAccYear: { tssId: m.tcmSessionId, tssAccYear: m.tcmAccYear } },
            select: { tssOperatorId: true },
        });
        return s?.tssOperatorId ?? null;
    }
    async supervisors(key) {
        const session = await this.prisma.tillSession.findFirst({
            where: {
                tssId: key.tssId,
                tssAccYear: key.accYear,
                tssCompanyId: key.companyId,
                tssBranchId: key.branchId,
                tssIsDeleted: false,
            },
            select: { tssOperatorId: true },
        });
        if (!session) {
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
        }
        const users = await this.prisma.userMaster.findMany({
            where: {
                usrId: { not: session.tssOperatorId },
                ...this.signerScope,
                userMenus: {
                    some: { umMenuId: till_enum_1.TILL_MENU.SESSIONS, umCanOverride: true, umIsDeleted: false },
                },
            },
            select: {
                usrId: true,
                usrLoginName: true,
                usrFullName: true,
                usrDisplayName: true,
                usrPinHash: true,
            },
            orderBy: { usrLoginName: 'asc' },
        });
        return users.map((u) => ({
            userId: u.usrId,
            loginName: u.usrLoginName,
            fullName: u.usrFullName?.trim() || u.usrDisplayName?.trim() || null,
            hasPin: u.usrPinHash !== null && u.usrPinHash !== '',
        }));
    }
    async awaitingReceipt(scope) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
        });
        const rows = await this.prisma.tillCashMovement.findMany({
            where: {
                tcmCompanyId: scope.companyId,
                tcmBranchId: scope.branchId,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.AWAITING,
                ...(scope.dayId ? { tcmDayId: scope.dayId, tcmAccYear: scope.accYear ?? undefined } : {}),
            },
            include: { safe: { select: { tsfName: true } } },
            orderBy: { tcmCreatedOn: 'asc' },
        });
        const sessionIds = [
            ...new Set(rows.map((r) => r.tcmSessionId).filter((id) => !!id)),
        ];
        const sessions = await this.prisma.tillSession.findMany({
            where: { tssId: { in: sessionIds } },
            include: { counter: { select: { tcnCode: true, tcnName: true } } },
        });
        const sessionOf = new Map(sessions.map((x) => [`${x.tssId}|${x.tssAccYear}`, x]));
        const users = await this.prisma.userMaster.findMany({
            where: { usrId: { in: [...new Set(sessions.map((x) => x.tssOperatorId))] } },
            select: { usrId: true, usrLoginName: true, usrDisplayName: true },
        });
        const nameOf = new Map(users.map((u) => [u.usrId, u.usrDisplayName?.trim() || u.usrLoginName]));
        const now = Date.now();
        return rows.flatMap((m) => {
            const session = sessionOf.get(`${m.tcmSessionId}|${m.tcmAccYear}`);
            if (!session) {
                return [];
            }
            return [
                {
                    tcmId: m.tcmId,
                    tcmAccYear: m.tcmAccYear,
                    tcmKind: m.tcmKind,
                    tcmDocNo: m.tcmDocNo,
                    tcmDocDate: (0, till_dates_1.isoDateOf)(m.tcmDocDate),
                    handedOverOn: m.tcmCreatedOn.toISOString(),
                    ageMinutes: Math.max(0, Math.floor((now - m.tcmCreatedOn.getTime()) / 60_000)),
                    bagNo: m.tcmBagNo,
                    sealNo: m.tcmSealNo,
                    safeId: m.tcmSafeId,
                    safeName: m.safe?.tsfName ?? null,
                    tssId: session.tssId,
                    sessionNo: session.tssSessionNo,
                    sessionStatus: session.tssStatus,
                    counterCode: session.counter.tcnCode,
                    counterName: session.counter.tcnName,
                    cashierId: session.tssOperatorId,
                    cashierName: nameOf.get(session.tssOperatorId) ?? null,
                    handedOverBy: m.tcmDoneBy,
                    canReceive: settings.singleOperator || caller.userId !== session.tssOperatorId,
                },
            ];
        });
    }
    async receive(input) {
        const caller = await this.context.caller();
        if (input.bags.length === 0) {
            (0, till_errors_1.throwTillBadRequest)('Name at least one bag to receive', 'bags');
        }
        const seen = new Set();
        input.bags.forEach((bag, i) => {
            if (seen.has(bag.tcmId)) {
                (0, till_errors_1.throwTillBadRequest)('A bag is received once per call', `bags.${i}.tcmId`);
            }
            seen.add(bag.tcmId);
            this.assertCashLines(bag.lines, `bags.${i}.lines`);
        });
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
        });
        const peeks = [];
        for (const [index, bag] of input.bags.entries()) {
            const m = await this.prisma.tillCashMovement.findFirst({
                where: {
                    tcmId: bag.tcmId,
                    tcmAccYear: bag.accYear,
                    tcmCompanyId: input.companyId,
                    tcmBranchId: input.branchId,
                    tcmIsDeleted: false,
                },
            });
            if (!m) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_FOUND, `Till movement ${bag.tcmId} was not found`, `bags.${index}.tcmId`);
            }
            this.assertAwaiting(m, `bags.${index}.tcmId`);
            const session = await this.prisma.tillSession.findUniqueOrThrow({
                where: { tssId_tssAccYear: { tssId: m.tcmSessionId, tssAccYear: m.tcmAccYear } },
            });
            if (!settings.singleOperator && caller.userId === session.tssOperatorId) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECEIVER_SELF, `${m.tcmDocNo} is from session ${session.tssSessionNo}, and you were its cashier: another supervisor receives it`, `bags.${index}.tcmId`, { tcmId: m.tcmId });
            }
            peeks.push({ bag, session, index });
        }
        const receiver = await this.prisma.userMaster.findUnique({
            where: { usrId: caller.userId },
            select: { usrLoginName: true, usrPinHash: true },
        });
        await this.verifyPin(peeks[0].session, receiver?.usrLoginName ?? caller.actorName, receiver?.usrPinHash ?? null, {
            pin: input.receiverPin,
            field: 'receiverPin',
            codes: {
                noPin: till_enum_1.TillErrorCode.RECEIVER_NO_PIN,
                required: till_enum_1.TillErrorCode.RECEIVER_PIN_REQUIRED,
                wrong: till_enum_1.TillErrorCode.RECEIVER_PIN,
            },
            noPinMessage: `${caller.actorName} receives cash into the safe and has no till PIN: an administrator sets one in User Administration (menu 58)`,
            requiredMessage: 'Receiving cash into the safe is signed with your till PIN',
            payload: { action: 'receive', tcmIds: input.bags.map((b) => b.tcmId).join(',') },
            detail: {},
            caller,
        });
        const today = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const on = { date: today, accYear: (0, till_dates_1.accYearOf)(today) };
        const ordered = [...peeks].sort((a, b) => a.session.tssId === b.session.tssId
            ? a.bag.tcmId.localeCompare(b.bag.tcmId)
            : a.session.tssId.localeCompare(b.session.tssId));
        const results = await this.prisma.$transaction(async (tx) => {
            const out = new Map();
            const awaitingLedgerId = await this.ledger.roleLedger(tx, till_enum_1.TILL_CASH_AWAITING_ROLE, input.companyId, input.branchId);
            const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
            for (const { bag, index } of ordered) {
                const field = `bags.${index}`;
                const session = await this.lockSession(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    accYear: bag.accYear,
                    tssId: peeks[index].session.tssId,
                }, Object.values(till_enum_1.TillSessionStatus));
                await tx.$queryRaw `
          SELECT tcm_id FROM accounts.till_cash_movement
           WHERE tcm_id = ${bag.tcmId}::uuid AND tcm_acc_year = ${bag.accYear}::char(9)
           FOR UPDATE`;
                const m = await tx.tillCashMovement.findUniqueOrThrow({
                    where: { tcmId_tcmAccYear: { tcmId: bag.tcmId, tcmAccYear: bag.accYear } },
                });
                this.assertAwaiting(m, `${field}.tcmId`);
                const safe = m.tcmSafeId
                    ? await tx.tillSafe.findUnique({
                        where: { tsfId: m.tcmSafeId },
                        select: { tsfId: true, tsfLedgerId: true, tsfName: true },
                    })
                    : null;
                if (!safe) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, `${m.tcmDocNo} names no safe to receive it into`, `${field}.tcmId`);
                }
                const priced = await this.sessions.priceLines(tx, input.companyId, bag.lines);
                const received = priced.reduce((sum, l) => sum.plus(l.amount), ZERO);
                const handedOver = new client_1.Prisma.Decimal(m.tcmAmount);
                const countId = await this.sessions.writeMovementCount(tx, session, {
                    kind: till_enum_1.TillCountKind.DROP_VERIFY,
                    lines: priced,
                    safeId: safe.tsfId,
                    movementId: m.tcmId,
                    caller,
                    deviceId: caller.deviceId,
                    isBlind: true,
                    expected: handedOver,
                    notes: bag.notes ?? null,
                });
                const postingSession = this.postingSession(session);
                const voucherId = await this.posting.postReceive(tx, {
                    movement: m,
                    session: postingSession,
                    safe: { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName },
                    awaitingLedgerId,
                    received,
                    countId,
                    on,
                    caller,
                    notes: bag.notes ?? null,
                });
                const difference = received.minus(handedOver);
                let tvrId = null;
                let outcome = 'RECEIVED';
                if (!difference.isZero()) {
                    const within = difference.abs().lessThanOrEqualTo(settings.cashTolerance);
                    outcome = within ? 'WITHIN_TOLERANCE' : 'SENT_FOR_APPROVAL';
                    const now = new Date();
                    const variance = await tx.tillVariance.create({
                        data: {
                            tvrCompanyId: session.tssCompanyId,
                            tvrBranchId: session.tssBranchId,
                            tvrTenantId: session.tssTenantId,
                            tvrAccYear: session.tssAccYear,
                            tvrSessionId: session.tssId,
                            tvrStage: till_enum_1.TillVarianceStage.RECEIVE,
                            tvrMovementId: m.tcmId,
                            tvrTenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
                            tvrTenderId: tillCash.tenderId,
                            tvrOpenAmount: handedOver,
                            tvrExpected: handedOver,
                            tvrCounted: received,
                            tvrTolerance: settings.cashTolerance,
                            tvrTreatment: within
                                ? till_enum_1.TillVarianceTreatment.WITHIN_TOLERANCE
                                : till_enum_1.TillVarianceTreatment.PENDING,
                            tvrDecidedBy: within ? caller.userId : null,
                            tvrDecidedOn: within ? now : null,
                            tvrStatus: 'OPEN',
                            tvrNotes: bag.notes ?? null,
                            tvrCreatedBy: caller.actorName,
                        },
                        select: { tvrId: true },
                    });
                    tvrId = variance.tvrId;
                    if (within) {
                        await this.posting.postVariance(tx, {
                            session: postingSession,
                            tvrId,
                            tenderLedgerId: awaitingLedgerId,
                            tenderLabel: `Cash received (${m.tcmDocNo})`,
                            variance: difference,
                            treatment: till_enum_1.TillVarianceTreatment.WITHIN_TOLERANCE,
                            caller,
                            on,
                        });
                    }
                    else {
                        await this.events.log(tx, {
                            companyId: session.tssCompanyId,
                            branchId: session.tssBranchId,
                            accYear: session.tssAccYear,
                            code: till_enum_1.TillEventCode.APPROVAL_REQUESTED,
                            sessionId: session.tssId,
                            dayId: session.tssDayId,
                            counterId: session.tssCounterId,
                            deviceId: caller.deviceId ?? session.tssDeviceId,
                            userId: caller.userId,
                            srcDocType: 'TILL_MOVEMENT',
                            srcDocId: m.tcmId,
                            srcRefno: m.tcmDocNo,
                            amount: difference.abs(),
                            payload: {
                                event: 'CASH_VARIANCE',
                                stage: till_enum_1.TillVarianceStage.RECEIVE,
                                tcmId: m.tcmId,
                                variance: [
                                    {
                                        tenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
                                        tenderId: tillCash.tenderId,
                                        variance: difference.toFixed(2),
                                    },
                                ],
                            },
                        });
                    }
                    const status = session.tssVarianceStatus;
                    const next = !within
                        ? till_enum_1.TillSessionVarianceStatus.PENDING
                        : status === till_enum_1.TillSessionVarianceStatus.NONE
                            ? till_enum_1.TillSessionVarianceStatus.WITHIN_TOLERANCE
                            : status;
                    if (next !== status) {
                        await tx.tillSession.update({
                            where: {
                                tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear },
                            },
                            data: {
                                tssVarianceStatus: next,
                                tssModifiedOn: now,
                                tssModifiedBy: caller.actorName,
                            },
                        });
                    }
                }
                out.set(m.tcmId, {
                    tcmId: m.tcmId,
                    tcmAccYear: m.tcmAccYear,
                    tcmKind: m.tcmKind,
                    tcmDocNo: m.tcmDocNo,
                    tssId: session.tssId,
                    sessionNo: session.tssSessionNo,
                    handedOver: num(handedOver),
                    received: num(received),
                    difference: num(difference),
                    outcome,
                    tvrId,
                    receiveVoucherId: voucherId,
                    receivedOn: on.date,
                });
            }
            return out;
        });
        return input.bags.map((b) => results.get(b.tcmId));
    }
    async approveCash(input) {
        const caller = await this.context.caller();
        const key = {
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: input.accYear,
            tssId: input.tssId,
        };
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
        });
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
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
        }
        if (peek.tssStatus !== till_enum_1.TillSessionStatus.CLOSED) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${peek.tssSessionNo} is ${peek.tssStatus}: its cash is approved once it is closed`, 'tssId', { status: peek.tssStatus });
        }
        const waiting = await this.awaitingOf(this.prisma, peek);
        if (waiting.length === 0) {
            return this.refuseNothingAwaiting(this.prisma, peek);
        }
        if (caller.userId === peek.tssOperatorId && !settings.singleOperator) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECEIVER_SELF, `Session ${peek.tssSessionNo} is yours (you were its cashier): another supervisor approves its cash`, 'tssId', { tssId: peek.tssId });
        }
        const ownerAlone = settings.singleOperator && caller.userId === peek.tssOperatorId;
        if (!ownerAlone || input.approverPin?.trim()) {
            const me = await this.prisma.userMaster.findUnique({
                where: { usrId: caller.userId },
                select: { usrLoginName: true, usrPinHash: true },
            });
            await this.verifyPin(peek, me?.usrLoginName ?? caller.actorName, me?.usrPinHash ?? null, {
                pin: input.approverPin,
                field: 'approverPin',
                codes: {
                    noPin: till_enum_1.TillErrorCode.RECEIVER_NO_PIN,
                    required: till_enum_1.TillErrorCode.RECEIVER_PIN_REQUIRED,
                    wrong: till_enum_1.TillErrorCode.RECEIVER_PIN,
                },
                noPinMessage: `${caller.actorName} approves cash into the safe and has no till PIN: an administrator sets one in User Administration (menu 58)`,
                requiredMessage: 'Approving a session’s cash is signed with your till PIN',
                payload: { action: 'approve-cash', tssId: peek.tssId },
                detail: {},
                caller,
            });
        }
        const handedOver = waiting.reduce((sum, m) => sum.plus(m.tcmAmount), ZERO);
        const received = input.receivedAmount === null || input.receivedAmount === undefined
            ? handedOver
            : new client_1.Prisma.Decimal(input.receivedAmount).toDecimalPlaces(2);
        const difference = received.minus(handedOver);
        const within = difference.abs().lessThanOrEqualTo(settings.cashTolerance);
        const today = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const on = { date: today, accYear: (0, till_dates_1.accYearOf)(today) };
        const event = 'CASH_VARIANCE';
        let decision = null;
        if (!within && input.treatment) {
            const treatment = input.treatment;
            const rule = await this.approval.ruleOrDefault(this.prisma, {
                companyId: key.companyId,
                branchId: key.branchId,
                event,
                onDate: today,
            });
            const verdict = await this.approval.assertApprover(this.prisma, {
                companyId: key.companyId,
                branchId: key.branchId,
                event,
                amount: difference.abs(),
                rule,
                approverId: caller.userId,
                requesterId: peek.tssOperatorId,
                pin: input.approverPin ?? null,
            });
            const reason = await this.sessions.varianceReason(this.prisma, {
                companyId: key.companyId,
                reasonId: input.reasonId ?? null,
                event,
            });
            let recoveryLedgerId = null;
            if (treatment === till_enum_1.TillVarianceTreatment.RECOVER) {
                const staff = await this.sessions.staffLedgerOf(this.prisma, peek.tssOperatorId);
                if (!staff.ledgerId) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `RECOVER posts to the cashier’s staff advance ledger, and ${staff.login} has none (an employee with a loan ledger, notes 95)`, 'treatment', { treatment, operatorId: peek.tssOperatorId });
                }
                recoveryLedgerId = staff.ledgerId;
            }
            decision = { treatment, rule, verdict, reasonId: reason.trsId, recoveryLedgerId };
        }
        const done = await this.prisma.$transaction(async (tx) => {
            const session = await this.lockSession(tx, key, [till_enum_1.TillSessionStatus.CLOSED]);
            await tx.$queryRaw `
        SELECT tcm_id FROM accounts.till_cash_movement
         WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_acc_year = ${session.tssAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_receipt_status = 'AWAITING'
         ORDER BY tcm_id
           FOR UPDATE`;
            const bags = await this.awaitingOf(tx, session);
            if (bags.length === 0) {
                return this.refuseNothingAwaiting(tx, session);
            }
            if (bags.length !== waiting.length || bags.some((m, i) => m.tcmId !== waiting[i].tcmId)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECEIPT_NOT_AWAITING, `Session ${session.tssSessionNo}'s cash changed while it was being approved: reload it`, 'tssId');
            }
            const anchor = bags.find((m) => m.tcmKind === till_enum_1.TillMovementKind.CLOSE_HANDOVER) ??
                bags[bags.length - 1];
            const share = new Map(bags.map((m) => [m.tcmId, new client_1.Prisma.Decimal(m.tcmAmount)]));
            if (difference.isPositive()) {
                share.set(anchor.tcmId, share.get(anchor.tcmId).plus(difference));
            }
            else {
                let left = difference.abs();
                for (const m of [anchor, ...bags.filter((b) => b !== anchor).reverse()]) {
                    const has = share.get(m.tcmId);
                    const take = has.lessThan(left) ? has : left;
                    share.set(m.tcmId, has.minus(take));
                    left = left.minus(take);
                }
            }
            const awaitingLedgerId = await this.ledger.roleLedger(tx, till_enum_1.TILL_CASH_AWAITING_ROLE, input.companyId, input.branchId);
            const postingSession = this.postingSession(session);
            const movements = [];
            for (const m of bags) {
                const safe = m.tcmSafeId
                    ? await tx.tillSafe.findUnique({
                        where: { tsfId: m.tcmSafeId },
                        select: { tsfId: true, tsfLedgerId: true, tsfName: true },
                    })
                    : null;
                if (!safe) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, `${m.tcmDocNo} names no safe to receive it into`, 'tssId');
                }
                const part = share.get(m.tcmId);
                const voucherId = await this.posting.postReceive(tx, {
                    movement: m,
                    session: postingSession,
                    safe: { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName },
                    awaitingLedgerId,
                    received: part,
                    countId: null,
                    on,
                    caller,
                    notes: input.notes ?? null,
                });
                movements.push({ m, received: part, voucherId });
            }
            let outcome = 'APPROVED';
            let tvrId = null;
            let tapId = null;
            let varianceVoucherId = null;
            if (!difference.isZero()) {
                const now = new Date();
                const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
                const treatment = within
                    ? till_enum_1.TillVarianceTreatment.WITHIN_TOLERANCE
                    : (decision?.treatment ?? till_enum_1.TillVarianceTreatment.PENDING);
                outcome = within ? 'WITHIN_TOLERANCE' : decision ? 'DECIDED' : 'SENT_FOR_APPROVAL';
                tvrId = await this.newId(tx);
                if (decision) {
                    tapId = await this.approval.record(tx, {
                        companyId: session.tssCompanyId,
                        branchId: session.tssBranchId,
                        tenantId: session.tssTenantId,
                        accYear: session.tssAccYear,
                        event,
                        sessionId: session.tssId,
                        counterId: session.tssCounterId,
                        srcDocType: 'TILL_MOVEMENT',
                        srcDocId: anchor.tcmId,
                        srcRefno: anchor.tcmDocNo,
                        amount: difference.abs(),
                        rule: decision.rule,
                        verdict: decision.verdict,
                        requestedBy: session.tssOperatorId,
                        requestedOn: anchor.tcmCreatedOn,
                        reasonId: decision.reasonId,
                        status: 'APPROVED',
                        decidedBy: caller.userId,
                        decidedOn: now,
                        decidedDeviceId: caller.deviceId,
                        decisionNote: input.notes?.trim() ||
                            `Cash approved: ${received.toFixed(2)} received of ${handedOver.toFixed(2)} handed over`,
                        payload: {
                            decision: 'APPROVE',
                            treatment: decision.treatment,
                            stage: till_enum_1.TillVarianceStage.RECEIVE,
                            via: 'approve-cash',
                            tcmId: anchor.tcmId,
                            variances: [
                                { tvrId, tenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID, variance: difference.toFixed(2) },
                            ],
                        },
                    });
                }
                await tx.tillVariance.create({
                    data: {
                        tvrId,
                        tvrCompanyId: session.tssCompanyId,
                        tvrBranchId: session.tssBranchId,
                        tvrTenantId: session.tssTenantId,
                        tvrAccYear: session.tssAccYear,
                        tvrSessionId: session.tssId,
                        tvrStage: till_enum_1.TillVarianceStage.RECEIVE,
                        tvrMovementId: anchor.tcmId,
                        tvrTenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
                        tvrTenderId: tillCash.tenderId,
                        tvrOpenAmount: handedOver,
                        tvrExpected: handedOver,
                        tvrCounted: received,
                        tvrTolerance: settings.cashTolerance,
                        tvrTreatment: treatment,
                        tvrReasonId: decision?.reasonId ?? null,
                        tvrRecoveryLedgerId: decision?.recoveryLedgerId ?? null,
                        tvrApprovalId: tapId,
                        tvrDecidedBy: within || decision ? caller.userId : null,
                        tvrDecidedOn: within || decision ? now : null,
                        tvrStatus: 'OPEN',
                        tvrNotes: input.notes ?? null,
                        tvrCreatedBy: caller.actorName,
                    },
                    select: { tvrId: true },
                });
                if (within || decision) {
                    varianceVoucherId = await this.posting.postVariance(tx, {
                        session: postingSession,
                        tvrId,
                        tenderLedgerId: awaitingLedgerId,
                        tenderLabel: `Cash received (${session.tssSessionNo})`,
                        variance: difference,
                        treatment: treatment,
                        recoveryLedgerId: decision?.recoveryLedgerId ?? null,
                        caller,
                        on,
                    });
                }
                await this.events.log(tx, {
                    companyId: session.tssCompanyId,
                    branchId: session.tssBranchId,
                    accYear: session.tssAccYear,
                    code: decision ? till_enum_1.TillEventCode.VARIANCE_DECIDED : till_enum_1.TillEventCode.APPROVAL_REQUESTED,
                    sessionId: session.tssId,
                    dayId: session.tssDayId,
                    counterId: session.tssCounterId,
                    deviceId: caller.deviceId ?? session.tssDeviceId,
                    userId: caller.userId,
                    srcDocType: 'TILL_MOVEMENT',
                    srcDocId: anchor.tcmId,
                    srcRefno: anchor.tcmDocNo,
                    amount: difference.abs(),
                    reasonId: decision?.reasonId ?? null,
                    approvalId: tapId,
                    payload: decision
                        ? {
                            stage: till_enum_1.TillVarianceStage.RECEIVE,
                            via: 'approve-cash',
                            decision: 'APPROVE',
                            treatment: decision.treatment,
                            event,
                            amount: difference.abs().toFixed(2),
                            requiredRole: decision.rule.tar_min_role,
                            approverRole: decision.verdict.role,
                            channel: decision.verdict.channel,
                            implicitGrant: decision.verdict.implicit,
                            grantId: decision.verdict.grantId,
                            reasonId: decision.reasonId,
                            recoveryLedgerId: decision.recoveryLedgerId,
                            tcmId: anchor.tcmId,
                            variances: [tvrId],
                        }
                        : {
                            event: 'CASH_VARIANCE',
                            stage: till_enum_1.TillVarianceStage.RECEIVE,
                            via: 'approve-cash',
                            tcmId: anchor.tcmId,
                            variance: [
                                {
                                    tenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
                                    tenderId: tillCash.tenderId,
                                    variance: difference.toFixed(2),
                                },
                            ],
                        },
                });
                const status = session.tssVarianceStatus;
                const next = decision
                    ? (await this.sessions.hasAnyPending(tx, session))
                        ? till_enum_1.TillSessionVarianceStatus.PENDING
                        : till_enum_1.VARIANCE_STATUS_OF_TREATMENT[decision.treatment]
                    : !within
                        ? till_enum_1.TillSessionVarianceStatus.PENDING
                        : status === till_enum_1.TillSessionVarianceStatus.NONE
                            ? till_enum_1.TillSessionVarianceStatus.WITHIN_TOLERANCE
                            : status;
                if (next !== status) {
                    await tx.tillSession.update({
                        where: {
                            tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear },
                        },
                        data: { tssVarianceStatus: next, tssModifiedOn: now, tssModifiedBy: caller.actorName },
                    });
                }
            }
            return { session, anchor, movements, outcome, tvrId, tapId, varianceVoucherId };
        });
        const numbers = await this.voucherNos([
            ...done.movements.map((x) => x.voucherId),
            done.varianceVoucherId,
        ]);
        return {
            tssId: done.session.tssId,
            tssAccYear: done.session.tssAccYear,
            sessionNo: done.session.tssSessionNo,
            handedOver: num(handedOver),
            received: num(received),
            difference: num(difference),
            outcome: done.outcome,
            tvrId: done.tvrId,
            tcmId: done.tvrId ? done.anchor.tcmId : null,
            treatment: done.outcome === 'DECIDED' ? decision.treatment : null,
            tapId: done.tapId,
            varianceVoucherId: done.varianceVoucherId,
            varianceVoucherNo: done.varianceVoucherId
                ? (numbers.get(done.varianceVoucherId) ?? null)
                : null,
            receivedOn: on.date,
            movements: done.movements.map(({ m, received: r, voucherId }) => ({
                tcmId: m.tcmId,
                tcmAccYear: m.tcmAccYear,
                tcmKind: m.tcmKind,
                tcmDocNo: m.tcmDocNo,
                handedOver: num(m.tcmAmount),
                received: num(r),
                receiveVoucherId: voucherId,
                receiveVoucherNo: voucherId ? (numbers.get(voucherId) ?? null) : null,
            })),
            session: await this.sessions.get(key),
        };
    }
    awaitingOf(client, session) {
        return client.tillCashMovement.findMany({
            where: {
                tcmSessionId: session.tssId,
                tcmAccYear: session.tssAccYear,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.AWAITING,
            },
            orderBy: [{ tcmCreatedOn: 'asc' }, { tcmId: 'asc' }],
        });
    }
    async refuseNothingAwaiting(client, session) {
        const last = await client.tillCashMovement.findFirst({
            where: {
                tcmSessionId: session.tssId,
                tcmAccYear: session.tssAccYear,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.RECEIVED,
            },
            orderBy: { tcmReceivedOn: 'desc' },
            select: { tcmReceivedBy: true, tcmReceivedOn: true },
        });
        if (last) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.CASH_ALREADY_APPROVED, `Session ${session.tssSessionNo}'s cash has already been approved`, 'tssId', {
                receivedBy: last.tcmReceivedBy ?? '',
                receivedOn: last.tcmReceivedOn?.toISOString() ?? '',
            });
        }
        (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECEIPT_NOT_AWAITING, `Session ${session.tssSessionNo} handed nothing over that waits for a receipt`, 'tssId');
    }
    async voucherNos(ids) {
        const wanted = ids.filter((id) => !!id);
        if (wanted.length === 0) {
            return new Map();
        }
        const rows = await this.prisma.$queryRaw `
      SELECT avh_voucher_id::text AS id, avh_voucher_no::text AS no
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ANY(${wanted}::uuid[])`;
        return new Map(rows.filter((r) => r.no !== null).map((r) => [r.id, r.no]));
    }
    assertAwaiting(m, field) {
        if (m.tcmStatus !== 'POSTED' ||
            m.tcmReceiptStatus !== till_enum_1.TillReceiptStatus.AWAITING ||
            !m.tcmSessionId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.RECEIPT_NOT_AWAITING, m.tcmStatus !== 'POSTED'
                ? `${m.tcmDocNo} is ${m.tcmStatus}`
                : m.tcmReceiptStatus === till_enum_1.TillReceiptStatus.RECEIVED
                    ? `${m.tcmDocNo} has already been received`
                    : `${m.tcmDocNo} went straight into the safe: there is nothing to receive`, field, { receiptStatus: m.tcmReceiptStatus, status: m.tcmStatus });
        }
    }
    async proveSupervisor(input, caller) {
        const session = await this.peekSession(input);
        this.assertAtCounter(session, caller);
        const what = input.kind === till_enum_1.TillMovementKind.PICKUP ? 'pickup' : 'top-up';
        const supervisorId = input.supervisorId ?? null;
        if (!supervisorId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `A ${what} is signed by the supervisor standing at the counter: pick their name`, 'supervisorId');
        }
        const user = await this.prisma.userMaster.findFirst({
            where: {
                usrId: supervisorId,
                ...this.signerScope,
            },
            select: { usrLoginName: true, usrPinHash: true },
        });
        if (!user) {
            const named = await this.prisma.userMaster.findUnique({
                where: { usrId: supervisorId },
                select: { usrLoginName: true },
            });
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `The supervisor ${named?.usrLoginName ?? supervisorId} is not an active user`, 'supervisorId');
        }
        if (supervisorId === session.tssOperatorId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SUPERVISOR_SELF, `A ${what} is two people: the cashier at the counter and a supervisor signing with their own till PIN`, 'supervisorId');
        }
        if (!(await (0, rights_1.loadRights)(this.prisma, supervisorId, till_enum_1.TILL_MENU.SESSIONS)).override) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SUPERVISOR_RIGHT, `${user.usrLoginName} has no Till Sessions override right`, 'supervisorId', { supervisorId });
        }
        const verifiedOn = await this.verifyPin(session, user.usrLoginName, user.usrPinHash, {
            pin: input.supervisorPin,
            field: 'supervisorPin',
            codes: {
                noPin: till_enum_1.TillErrorCode.SUPERVISOR_NO_PIN,
                required: till_enum_1.TillErrorCode.SUPERVISOR_PIN_REQUIRED,
                wrong: till_enum_1.TillErrorCode.SUPERVISOR_PIN,
            },
            noPinMessage: `${user.usrLoginName} signs this ${what} and has no till PIN: an administrator sets one in User Administration (menu 58)`,
            requiredMessage: `A ${what} is signed by the supervisor: ${user.usrLoginName} types their till PIN`,
            payload: { action: 'movement', kind: input.kind, supervisorId },
            detail: { supervisorId },
            caller,
        });
        return { userId: supervisorId, verifiedOn };
    }
    signerScope = {
        usrIsActive: true,
        usrIsDeleted: false,
    };
    async checkWitnessPin(session, ask) {
        const { witnessId } = ask;
        const user = await this.prisma.userMaster.findUnique({
            where: { usrId: witnessId },
            select: { usrLoginName: true, usrPinHash: true, usrIsActive: true, usrIsDeleted: true },
        });
        if (!user || !user.usrIsActive || user.usrIsDeleted) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `The witness ${user?.usrLoginName ?? witnessId} is not an active user`, ask.whoField);
        }
        const what = ask.kind === till_enum_1.TillMovementKind.PICKUP ? 'pickup' : 'top-up';
        return this.verifyPin(session, user.usrLoginName, user.usrPinHash, {
            pin: ask.pin,
            field: ask.pinField,
            codes: {
                noPin: till_enum_1.TillErrorCode.WITNESS_NO_PIN,
                required: till_enum_1.TillErrorCode.WITNESS_PIN_REQUIRED,
                wrong: till_enum_1.TillErrorCode.WITNESS_PIN,
            },
            noPinMessage: `${user.usrLoginName} witnesses this ${what} and has no till PIN: an administrator sets one in User Administration (menu 58)`,
            requiredMessage: `A ${what} is witnessed: ${user.usrLoginName} types their till PIN`,
            payload: { action: ask.action, kind: ask.kind, witnessBy: witnessId },
            detail: { witnessBy: witnessId },
            caller: ask.caller,
        });
    }
    async verifyPin(session, login, pinHash, ask) {
        if (!pinHash) {
            (0, till_errors_1.throwTill)(ask.codes.noPin, ask.noPinMessage, ask.field, ask.detail);
        }
        const pin = ask.pin?.trim() || null;
        if (pin === null) {
            (0, till_errors_1.throwTill)(ask.codes.required, ask.requiredMessage, ask.field, ask.detail);
        }
        if (!(await (0, secret_hash_utils_1.verifySecret)(pin, pinHash))) {
            await this.events.log(this.prisma, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.PIN_FAIL,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: ask.caller.deviceId ?? session.tssDeviceId,
                userId: ask.caller.userId,
                srcRefno: session.tssSessionNo,
                payload: ask.payload,
            });
            (0, till_errors_1.throwTill)(ask.codes.wrong, `${login}'s till PIN is wrong`, ask.field, ask.detail);
        }
        return new Date();
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
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
        }
        this.assertMovable(session, MOVABLE_STATUSES);
        return session;
    }
    async lockSession(tx, key, statuses = MOVABLE_STATUSES) {
        const locked = await tx.$queryRaw `
      SELECT tss_id FROM accounts.till_session
       WHERE tss_id = ${key.tssId}::uuid AND tss_acc_year = ${key.accYear}::char(9)
         AND tss_company_id = ${key.companyId}::uuid AND tss_branch_id = ${key.branchId}::uuid
         AND tss_is_deleted = false
       FOR UPDATE`;
        if (locked.length === 0) {
            (0, till_errors_1.throwTillNotFound)('Till session', 'tssId', key.tssId);
        }
        const session = await tx.tillSession.findUniqueOrThrow({
            where: { tssId_tssAccYear: { tssId: key.tssId, tssAccYear: key.accYear } },
        });
        this.assertMovable(session, statuses);
        return session;
    }
    assertMovable(session, statuses) {
        if (!statuses.includes(session.tssStatus)) {
            (0, till_errors_1.throwTill)(statuses === VOIDABLE_STATUSES
                ? till_enum_1.TillErrorCode.MOVEMENT_SESSION_CLOSED
                : till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${session.tssSessionNo} is ${session.tssStatus}: its drawer is being counted and moves no cash`, 'tssId', { status: session.tssStatus });
        }
    }
    assertOperator(session, caller) {
        if (session.tssOperatorId !== caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_YOURS, `Session ${session.tssSessionNo} belongs to another cashier`, 'tssId');
        }
        if (caller.deviceId !== session.tssDeviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_WRONG_DEVICE, `Session ${session.tssSessionNo} moves cash only from the device it was opened on`, 'tssId');
        }
    }
    assertAtCounter(session, caller) {
        if (session.tssOperatorId !== caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_AT_COUNTER, 'A pickup / top-up is entered at the counter by the session’s cashier, with the supervisor there', 'kind');
        }
        this.assertOperator(session, caller);
    }
    assertCashLines(lines, field) {
        lines.forEach((line, i) => {
            if (line.tenderTypeId !== till_enum_1.CASH_TENDER_TYPE_ID) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'A drawer movement is cash', `${field}.${i}.tenderTypeId`);
            }
        });
    }
    async loadReason(tx, input, amount) {
        const category = REASON_CATEGORY[input.kind] ?? null;
        if (!input.reasonId) {
            if (category) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `A ${input.kind.toLowerCase().replace('_', ' ')} names a ${category} reason`, 'reasonId');
            }
            return null;
        }
        const reason = await tx.tillReason.findFirst({
            where: {
                trsId: input.reasonId,
                trsIsDeleted: false,
                trsIsActive: true,
                OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
            },
        });
        if (!reason || (category && reason.trsCategory !== category)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, category ? `The reason must be an active ${category} reason` : 'Unknown or inactive reason', 'reasonId');
        }
        if (reason.trsNeedsNote && !input.notes?.trim()) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
        }
        if (reason.trsNeedsRef && !input.refNo?.trim()) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a reference number`, 'refNo');
        }
        const cap = new client_1.Prisma.Decimal(reason.trsMaxAmount);
        if (cap.greaterThan(0) && amount.greaterThan(cap)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” is capped at ${cap.toFixed(2)}`, 'amount');
        }
        return reason;
    }
    async assertLedger(tx, ledgerId, companyId) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: {
                ledId: ledgerId,
                ledIsDeleted: false,
                OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
            },
            select: { ledId: true },
        });
        if (!ledger) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'ledgerId must be a ledger of this company', 'ledgerId');
        }
    }
    postingSession(session) {
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
            businessDate: (0, till_dates_1.isoDateOf)(session.tssBusinessDate),
        };
    }
    async newId(tx) {
        const [row] = await tx.$queryRaw `SELECT uuidv7()::text AS id`;
        return row.id;
    }
};
exports.TillMovementService = TillMovementService;
exports.TillMovementService = TillMovementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_ledger_service_1.TillLedgerService,
        till_posting_service_1.TillPostingService,
        till_session_service_1.TillSessionService,
        till_event_service_1.TillEventService,
        till_approval_service_1.TillApprovalService])
], TillMovementService);
//# sourceMappingURL=till-movement.service.js.map