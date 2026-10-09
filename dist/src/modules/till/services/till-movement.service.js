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
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_context_service_1 = require("../till-context.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
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
    constructor(prisma, context, ledger, posting, sessions) {
        this.prisma = prisma;
        this.context = context;
        this.ledger = ledger;
        this.posting = posting;
        this.sessions = sessions;
    }
    async create(input) {
        const caller = await this.context.caller();
        if (!till_enum_1.CASHIER_MOVEMENTS.includes(input.kind) && !till_enum_1.SUPERVISOR_MOVEMENTS.includes(input.kind)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `${input.kind} is not posted by hand (the open issues the float, the close hands over, the cash office remits)`, 'kind');
        }
        const supervisorKind = till_enum_1.SUPERVISOR_MOVEMENTS.includes(input.kind);
        const tcmId = await this.prisma.$transaction(async (tx) => {
            const session = await this.lockSession(tx, input);
            if (!supervisorKind) {
                this.assertOperator(session, caller);
            }
            let witnessBy = input.witnessBy ?? null;
            if (input.kind === till_enum_1.TillMovementKind.PICKUP) {
                witnessBy = witnessBy ?? session.tssOperatorId;
                if (witnessBy === caller.userId) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'A pickup is two people — the supervisor taking it and the cashier signing for it. One person moves cash to the safe with a DROP.', 'witnessBy');
                }
            }
            else if (witnessBy === caller.userId) {
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
            const safe = input.kind === till_enum_1.TillMovementKind.PAID_IN
                ? null
                : await this.ledger.safeFor(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    counterSafeId: counter.tcnSafeId,
                });
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
            tcmVoidedOn: m.tcmVoidedOn?.toISOString() ?? null,
            tcmVoidedBy: m.tcmVoidedBy,
            tcmVoidReasonId: m.tcmVoidReasonId,
            tcmNotes: m.tcmNotes,
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
        if (!statuses.includes(session.tssStatus)) {
            (0, till_errors_1.throwTill)(statuses === VOIDABLE_STATUSES
                ? till_enum_1.TillErrorCode.MOVEMENT_SESSION_CLOSED
                : till_enum_1.TillErrorCode.SESSION_NOT_OPEN, `Session ${session.tssSessionNo} is ${session.tssStatus}: its drawer is being counted and moves no cash`, 'tssId', { status: session.tssStatus });
        }
        return session;
    }
    assertOperator(session, caller) {
        if (session.tssOperatorId !== caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_YOURS, `Session ${session.tssSessionNo} belongs to another cashier`, 'tssId');
        }
        if (caller.deviceId !== session.tssDeviceId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_WRONG_DEVICE, `Session ${session.tssSessionNo} moves cash only from the device it was opened on`, 'tssId');
        }
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
        till_session_service_1.TillSessionService])
], TillMovementService);
//# sourceMappingURL=till-movement.service.js.map