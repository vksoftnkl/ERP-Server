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
exports.TillSafeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const secret_hash_utils_1 = require("../../../common/utils/secret-hash.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const voucher_facts_1 = require("../../accountsModule/vouchers/voucher-facts");
const till_context_service_1 = require("../till-context.service");
const till_dates_1 = require("../till-dates");
const till_errors_1 = require("../till-errors");
const till_approval_service_1 = require("./till-approval.service");
const till_day_service_1 = require("./till-day.service");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const till_movement_service_1 = require("./till-movement.service");
const till_posting_service_1 = require("./till-posting.service");
const till_session_service_1 = require("./till-session.service");
const till_enum_1 = require("../types/till-enum");
const ZERO = new client_1.Prisma.Decimal(0);
const num = (v) => (v ? Number(v.toFixed(2)) : 0);
const SAFE_VARIANCE = 'SAFE_VARIANCE';
const REMITTANCE = 'REMITTANCE';
let TillSafeService = class TillSafeService {
    prisma;
    context;
    ledger;
    posting;
    sessions;
    events;
    approval;
    days;
    movements;
    constructor(prisma, context, ledger, posting, sessions, events, approval, days, movements) {
        this.prisma = prisma;
        this.context = context;
        this.ledger = ledger;
        this.posting = posting;
        this.sessions = sessions;
        this.events = events;
        this.approval = approval;
        this.days = days;
        this.movements = movements;
    }
    async balance(scope) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const visible = await this.figuresVisible(settings);
        const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const today = { date: businessDate, accYear: (0, till_dates_1.accYearOf)(businessDate) };
        const safes = await this.prisma.tillSafe.findMany({
            where: {
                tsfCompanyId: scope.companyId,
                tsfBranchId: scope.branchId,
                tsfIsDeleted: false,
                ...(scope.safeId ? { tsfId: scope.safeId } : { tsfIsActive: true }),
            },
            orderBy: [{ tsfIsDefault: 'desc' }, { tsfCode: 'asc' }],
        });
        if (scope.safeId && safes.length === 0) {
            (0, till_errors_1.throwTillNotFound)('Till safe', 'safeId', scope.safeId);
        }
        const day = await this.prisma.tillBusinessDay.findFirst({
            where: {
                tbdCompanyId: scope.companyId,
                tbdBranchId: scope.branchId,
                tbdAccYear: today.accYear,
                tbdBusinessDate: (0, till_dates_1.dateParam)(businessDate),
                tbdIsDeleted: false,
            },
            select: { tbdId: true },
        });
        const states = await this.prisma.$transaction(async (tx) => {
            await this.customPlans(tx);
            const out = [];
            for (const safe of safes) {
                const state = await this.stateOf(tx, safe, today);
                out.push(await this.statePayload(tx, state, visible, day?.tbdId ?? null));
            }
            return out;
        });
        return {
            companyId: scope.companyId,
            branchId: scope.branchId,
            businessDate,
            figuresVisible: visible,
            safes: states,
            inTransit: await this.inTransit(this.prisma, scope, businessDate),
        };
    }
    async stateOf(client, safe, today) {
        const last = await client.tillCount.findFirst({
            where: { tctSafeId: safe.tsfId, tctKind: till_enum_1.TillCountKind.SAFE, tctIsDeleted: false },
            orderBy: [{ tctCountedOn: 'desc' }, { tctId: 'desc' }],
        });
        const lastCount = last
            ? {
                tctId: last.tctId,
                tctAccYear: last.tctAccYear,
                countedOn: last.tctCountedOn,
                countedBy: last.tctCountedBy,
                witnessBy: last.tctWitnessBy,
                counted: new client_1.Prisma.Decimal(last.tctTotalCounted),
                expected: last.tctExpected === null ? null : new client_1.Prisma.Decimal(last.tctExpected),
                dayId: last.tctDayId,
            }
            : null;
        const flows = await this.flowsOf(client, safe, lastCount?.countedOn ?? null);
        const balances = await this.ledger.ledgerBalances(client, {
            companyId: safe.tsfCompanyId,
            branchId: safe.tsfBranchId,
            accYear: today.accYear,
            upTo: today.date,
        }, [safe.tsfLedgerId]);
        const book = balances.get(safe.tsfLedgerId) ?? ZERO;
        const sharing = await client.tillSafe.count({
            where: {
                tsfCompanyId: safe.tsfCompanyId,
                tsfBranchId: safe.tsfBranchId,
                tsfLedgerId: safe.tsfLedgerId,
                tsfIsActive: true,
                tsfIsDeleted: false,
                tsfId: { not: safe.tsfId },
            },
        });
        const ledgerShared = sharing > 0;
        let opening;
        if (lastCount) {
            opening = lastCount.counted;
        }
        else if (ledgerShared) {
            opening = ZERO;
        }
        else {
            opening = book.minus(netOf(flows));
        }
        const inTotal = inOf(flows);
        const outTotal = outOf(flows);
        return {
            safe,
            lastCount,
            ledgerShared,
            openingFrom: lastCount ? 'COUNT' : ledgerShared ? 'ZERO' : 'BOOK',
            opening,
            flows,
            inTotal,
            outTotal,
            expected: opening.plus(inTotal).minus(outTotal),
            book,
        };
    }
    async expectedAt(client, safe, today, since) {
        const now = await this.stateOf(client, safe, today);
        const from = new Date(since.getTime() - 1);
        const flows = await this.flowsOf(client, safe, from);
        const [gaps] = await client.$queryRaw `
      SELECT sum(tct_total_counted - COALESCE(tct_expected, tct_total_counted)) AS g
        FROM accounts.till_count
       WHERE tct_safe_id = ${safe.tsfId}::uuid AND tct_kind = ${till_enum_1.TillCountKind.SAFE}
         AND tct_is_deleted = false AND tct_counted_on > ${from}::timestamptz`;
        return now.expected.minus(netOf(flows)).minus(new client_1.Prisma.Decimal(gaps?.g ?? 0));
    }
    async flowsOf(client, safe, after) {
        const lower = after ? client_1.Prisma.sql `AND f.at > ${after}::timestamptz` : client_1.Prisma.empty;
        const [r] = await client.$queryRaw `
      SELECT COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'CLOSE_HANDOVER'), 0) AS hand_overs,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'DROP'), 0)           AS drops,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'PICKUP'), 0)         AS pickups,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'TRANSFER_IN'), 0)    AS transfers_in,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'MONEY_IN'), 0)       AS receipts,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'FLOAT_ISSUE'), 0)    AS float_issues,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'TOP_UP'), 0)         AS top_ups,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'REMIT'), 0)          AS remittances,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'SAFE_TRANSFER'), 0)  AS transfers_out,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'MONEY_OUT'), 0)      AS payments,
             count(*) FILTER (WHERE f.cat = 'EXCHANGE' AND f.amt > 0)::int   AS exchanges
        FROM (
          -- movements naming the safe, straight in / out: at creation, and back at a void
          SELECT m.tcm_kind::text AS cat, x.at, x.amt
            FROM accounts.till_cash_movement m
           CROSS JOIN LATERAL (VALUES (m.tcm_created_on, m.tcm_amount),
                                      (m.tcm_voided_on, -m.tcm_amount)) AS x(at, amt)
           WHERE m.tcm_safe_id = ${safe.tsfId}::uuid
             AND m.tcm_is_deleted = false
             AND m.tcm_receipt_status IS NULL
             AND m.tcm_kind IN ('CLOSE_HANDOVER', 'DROP', 'PICKUP', 'FLOAT_ISSUE', 'TOP_UP',
                                'REMIT', 'SAFE_TRANSFER', 'EXCHANGE')
             AND x.at IS NOT NULL
          UNION ALL
          -- a hand-over / drop that waited (notes 113): in once received, for what was received
          SELECT m.tcm_kind::text, m.tcm_received_on, m.tcm_received_amount
            FROM accounts.till_cash_movement m
           WHERE m.tcm_safe_id = ${safe.tsfId}::uuid
             AND m.tcm_is_deleted = false
             AND m.tcm_status = 'POSTED'
             AND m.tcm_receipt_status = 'RECEIVED'
          UNION ALL
          SELECT 'TRANSFER_IN', x.at, x.amt
            FROM accounts.till_cash_movement m
           CROSS JOIN LATERAL (VALUES (m.tcm_created_on, m.tcm_amount),
                                      (m.tcm_voided_on, -m.tcm_amount)) AS x(at, amt)
           WHERE m.tcm_to_safe_id = ${safe.tsfId}::uuid
             AND m.tcm_kind = 'SAFE_TRANSFER'
             AND m.tcm_is_deleted = false
             AND x.at IS NOT NULL
          UNION ALL
          -- back-office cash on the safe's ledger (48 §2.3): at posting, and back at a cancel
          SELECT CASE t.td_dr_cr WHEN 'DR' THEN 'MONEY_IN' ELSE 'MONEY_OUT' END, x.at, x.amt
            FROM accounts.acc_tender_detail t
            JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = t.td_voucher_id
           CROSS JOIN LATERAL (VALUES
                 (COALESCE(h.avh_posted_on, h.avh_created_on), t.td_total_amt),
                 (CASE WHEN h.avh_voucher_status = 'CANCELLED' THEN h.avh_status_on END,
                  -t.td_total_amt)) AS x(at, amt)
           WHERE t.td_tender_ledger_id = ${safe.tsfLedgerId}::uuid
             AND t.td_tender_type_id = ${till_enum_1.CASH_TENDER_TYPE_ID}::int
             AND h.avh_is_deleted = false
             AND ((h.avh_voucher_status = 'POSTED' AND t.td_is_deleted = false AND t.td_is_voided = false)
                  OR h.avh_voucher_status = 'CANCELLED')
             AND x.at IS NOT NULL
        ) f
       WHERE true ${lower}`;
        const d = (v) => new client_1.Prisma.Decimal(v ?? 0);
        return {
            handOvers: d(r.hand_overs),
            drops: d(r.drops),
            pickups: d(r.pickups),
            transfersIn: d(r.transfers_in),
            receipts: d(r.receipts),
            floatIssues: d(r.float_issues),
            topUps: d(r.top_ups),
            remittances: d(r.remittances),
            transfersOut: d(r.transfers_out),
            payments: d(r.payments),
            exchanges: r.exchanges ?? 0,
        };
    }
    async statePayload(client, state, visible, todayDayId) {
        const { safe, flows, lastCount } = state;
        const show = (v) => (visible ? num(v) : null);
        const ledger = await client.accLedgerMaster.findUnique({
            where: { ledId: safe.tsfLedgerId },
            select: { ledName: true },
        });
        const counter = lastCount
            ? await client.userMaster.findUnique({
                where: { usrId: lastCount.countedBy },
                select: { usrLoginName: true, usrDisplayName: true },
            })
            : null;
        const [transit] = await client.$queryRaw `
      SELECT count(*)::int AS n, sum(tcm_amount) AS amt
        FROM accounts.till_cash_movement
       WHERE tcm_safe_id = ${safe.tsfId}::uuid AND tcm_is_deleted = false
         AND tcm_status = 'POSTED' AND tcm_remit_status = ${till_enum_1.TillRemitStatus.IN_TRANSIT}`;
        const pending = await client.tillVariance.findMany({
            where: {
                tvrSafeId: safe.tsfId,
                tvrIsDeleted: false,
                tvrStatus: 'OPEN',
                tvrTreatment: till_enum_1.TillVarianceTreatment.PENDING,
            },
            select: {
                tvrId: true,
                tvrAccYear: true,
                tvrStage: true,
                tvrVariance: true,
            },
            orderBy: { tvrCreatedOn: 'asc' },
        });
        const limit = new client_1.Prisma.Decimal(safe.tsfInsuredLimit ?? 0);
        return {
            safeId: safe.tsfId,
            code: safe.tsfCode,
            name: safe.tsfName,
            ledgerId: safe.tsfLedgerId,
            ledgerName: ledger?.ledName ?? null,
            isDefault: safe.tsfIsDefault,
            isDropSafe: safe.tsfIsDropSafe,
            isActive: safe.tsfIsActive,
            insuredLimit: num(limit),
            overInsured: limit.greaterThan(0) && state.expected.greaterThan(limit),
            ledgerShared: state.ledgerShared,
            openingFrom: state.openingFrom,
            opening: show(state.opening),
            in: visible
                ? {
                    handOvers: num(flows.handOvers),
                    drops: num(flows.drops),
                    pickups: num(flows.pickups),
                    transfersIn: num(flows.transfersIn),
                    receipts: num(flows.receipts),
                    total: num(state.inTotal),
                }
                : null,
            out: visible
                ? {
                    floatIssues: num(flows.floatIssues),
                    topUps: num(flows.topUps),
                    remittances: num(flows.remittances),
                    transfersOut: num(flows.transfersOut),
                    payments: num(flows.payments),
                    total: num(state.outTotal),
                }
                : null,
            exchanges: flows.exchanges,
            expected: show(state.expected),
            bookBalance: show(state.book),
            drift: show(state.book.minus(state.expected)),
            lastCount: lastCount
                ? {
                    tctId: lastCount.tctId,
                    tctAccYear: lastCount.tctAccYear,
                    countedOn: lastCount.countedOn.toISOString(),
                    countedBy: lastCount.countedBy,
                    countedByName: counter ? counter.usrDisplayName?.trim() || counter.usrLoginName : null,
                    witnessBy: lastCount.witnessBy,
                    counted: show(lastCount.counted),
                    expected: lastCount.expected === null ? null : show(lastCount.expected),
                    difference: lastCount.expected === null
                        ? null
                        : show(lastCount.counted.minus(lastCount.expected)),
                }
                : null,
            countedToday: !!todayDayId && lastCount?.dayId === todayDayId,
            inTransit: { count: transit?.n ?? 0, amount: num(new client_1.Prisma.Decimal(transit?.amt ?? 0)) },
            pendingGaps: pending.map((p) => ({
                tvrId: p.tvrId,
                tvrAccYear: p.tvrAccYear,
                stage: p.tvrStage,
                variance: num(p.tvrVariance === null ? null : new client_1.Prisma.Decimal(p.tvrVariance)),
            })),
        };
    }
    async inTransit(client, scope, businessDate) {
        const rows = await client.tillCashMovement.findMany({
            where: {
                tcmCompanyId: scope.companyId,
                tcmBranchId: scope.branchId,
                tcmKind: till_enum_1.TillMovementKind.REMIT,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmRemitStatus: till_enum_1.TillRemitStatus.IN_TRANSIT,
                ...(scope.safeId ? { tcmSafeId: scope.safeId } : {}),
            },
            include: {
                safe: { select: { tsfName: true } },
                ledger: { select: { ledName: true } },
            },
            orderBy: [{ tcmDocDate: 'asc' }, { tcmCreatedOn: 'asc' }],
        });
        const today = Date.parse(`${businessDate}T00:00:00Z`);
        return rows.map((m) => ({
            tcmId: m.tcmId,
            tcmAccYear: m.tcmAccYear,
            docNo: m.tcmDocNo,
            docDate: (0, till_dates_1.isoDateOf)(m.tcmDocDate),
            safeId: m.tcmSafeId,
            safeName: m.safe?.tsfName ?? null,
            mode: m.tcmRemitMode,
            status: m.tcmRemitStatus,
            amount: num(m.tcmAmount),
            bankLedgerId: m.tcmLedgerId,
            bankName: m.ledger?.ledName ?? null,
            bagNo: m.tcmBagNo,
            sealNo: m.tcmSealNo,
            citAgency: m.tcmCitAgency,
            slipNo: m.tcmRefNo,
            slipDate: m.tcmRefDate ? (0, till_dates_1.isoDateOf)(m.tcmRefDate) : null,
            ageDays: Math.max(0, Math.round((today - m.tcmDocDate.getTime()) / 86_400_000)),
            doneBy: m.tcmDoneBy,
            createdOn: m.tcmCreatedOn.toISOString(),
        }));
    }
    async count(input) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const safe = await this.loadSafe(this.prisma, input, { active: true });
        this.assertCashLines(input.lines, 'lines');
        const visible = await this.figuresVisible(settings);
        const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const today = { date: businessDate, accYear: (0, till_dates_1.accYearOf)(businessDate) };
        const witnessId = input.witnessId?.trim() || null;
        const witnessVerifiedOn = witnessId
            ? await this.provePerson({
                userId: witnessId,
                pin: input.witnessPin,
                field: 'witnessId',
                pinField: 'witnessPin',
                role: 'witness',
                caller,
                scope: input,
                accYear: today.accYear,
                action: 'safe-count',
            })
            : null;
        let decision = null;
        if (input.treatment) {
            const priced = await this.sessions.priceLines(this.prisma, input.companyId, input.lines);
            const counted = priced.reduce((s, l) => s.plus(l.amount), ZERO);
            const peek = await this.prisma.$transaction(async (tx) => {
                await this.customPlans(tx);
                return this.stateOf(tx, safe, today);
            });
            const gap = counted.minus(peek.expected);
            if (gap.abs().greaterThan(settings.cashTolerance)) {
                decision = await this.judgeGap({
                    caller,
                    scope: input,
                    accYear: today.accYear,
                    onDate: businessDate,
                    treatment: input.treatment,
                    reasonId: input.reasonId ?? null,
                    pin: input.approverPin ?? null,
                    requesterId: caller.userId,
                    second: witnessId ? { userId: witnessId } : null,
                    gap,
                });
            }
        }
        const done = await this.prisma.$transaction(async (tx) => {
            await this.customPlans(tx);
            const day = await this.dayFor(tx, input, settings, caller);
            await this.lockSafe(tx, safe.tsfId);
            const state = await this.stateOf(tx, safe, {
                date: day.businessDate,
                accYear: day.accYear,
            });
            const lines = await this.sessions.priceLines(tx, input.companyId, input.lines);
            const count = await this.sessions.writeSafeCount(tx, {
                kind: till_enum_1.TillCountKind.SAFE,
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: input.tenantId ?? null,
                accYear: day.accYear,
                safeId: safe.tsfId,
                dayId: day.tbdId,
                movementId: null,
                lines,
                expected: state.expected,
                isBlind: !visible,
                caller,
                witnessBy: witnessId,
                notes: input.notes ?? null,
            });
            const gap = count.total.minus(state.expected);
            if (decision && !gap.equals(decision.judged)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_CHANGED, `${safe.tsfName} moved while it was being counted: count it again`, 'safeId');
            }
            const raised = await this.raiseGap(tx, {
                stage: till_enum_1.TillVarianceStage.SAFE,
                safe,
                scope: {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    tenantId: input.tenantId ?? null,
                    accYear: day.accYear,
                    date: day.businessDate,
                },
                tvrAccYear: day.accYear,
                dayId: day.tbdId,
                countId: count.tctId,
                movement: null,
                expected: state.expected,
                counted: count.total,
                ledgerId: safe.tsfLedgerId,
                label: `Safe ${safe.tsfName}`,
                tolerance: settings.cashTolerance,
                decision,
                requestedBy: caller.userId,
                requestedOn: count.countedOn,
                secondOn: witnessVerifiedOn,
                caller,
                notes: input.notes ?? null,
            });
            await this.events.log(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: day.accYear,
                code: till_enum_1.TillEventCode.SAFE_COUNT,
                dayId: day.tbdId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                srcDocType: 'TILL_COUNT',
                srcDocId: count.tctId,
                srcRefno: safe.tsfCode,
                amount: count.total,
                approvalId: raised.tapId,
                payload: {
                    safeId: safe.tsfId,
                    expected: state.expected.toFixed(2),
                    counted: count.total.toFixed(2),
                    difference: gap.toFixed(2),
                    outcome: raised.outcome,
                    openingFrom: state.openingFrom,
                    blind: !visible,
                    witnessBy: witnessId,
                    witnessVerifiedOn: witnessVerifiedOn?.toISOString() ?? null,
                    tvrId: raised.tvrId,
                },
            });
            await this.refreshDay(tx, day.tbdId, day.accYear);
            return { day, count, state, gap, raised };
        }, { timeout: 60_000 });
        const numbers = await this.voucherNos([done.raised.voucherId]);
        const after = await this.balance({ ...input, safeId: safe.tsfId });
        return {
            tctId: done.count.tctId,
            tctAccYear: done.day.accYear,
            safeId: safe.tsfId,
            safeName: safe.tsfName,
            tbdId: done.day.tbdId,
            businessDate: done.day.businessDate,
            countedOn: done.count.countedOn.toISOString(),
            counted: num(done.count.total),
            expected: num(done.state.expected),
            difference: num(done.gap),
            outcome: done.raised.outcome,
            tvrId: done.raised.tvrId,
            treatment: done.raised.treatment,
            tapId: done.raised.tapId,
            varianceVoucherId: done.raised.voucherId,
            varianceVoucherNo: done.raised.voucherId
                ? (numbers.get(done.raised.voucherId) ?? null)
                : null,
            witnessBy: witnessId,
            safe: after.safes[0],
        };
    }
    async decideVariance(input) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const peek = await this.pendingGap(this.prisma, input);
        const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const today = { date: businessDate, accYear: (0, till_dates_1.accYearOf)(businessDate) };
        const requester = await this.requesterOf(this.prisma, peek);
        const secondId = input.secondId?.trim() || null;
        const secondOn = secondId
            ? await this.provePerson({
                userId: secondId,
                pin: input.secondPin,
                field: 'secondId',
                pinField: 'secondPin',
                role: 'second',
                caller,
                scope: input,
                accYear: today.accYear,
                action: 'safe-decide-variance',
            })
            : null;
        const gap = new client_1.Prisma.Decimal(peek.tvrCounted).minus(peek.tvrExpected);
        const decision = await this.judgeGap({
            caller,
            scope: input,
            accYear: today.accYear,
            onDate: businessDate,
            treatment: input.treatment,
            reasonId: input.reasonId,
            pin: input.approverPin ?? null,
            requesterId: requester.userId,
            second: secondId ? { userId: secondId } : null,
            gap,
        });
        await (0, till_dates_1.assertTillPartitions)(this.prisma, today.accYear, 'accYear');
        const done = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT tvr_id FROM accounts.till_variance
         WHERE tvr_id = ${peek.tvrId}::uuid AND tvr_acc_year = ${peek.tvrAccYear}::char(9)
           FOR UPDATE`;
            const tvr = await this.pendingGap(tx, input);
            const safe = await this.loadSafe(tx, { companyId: input.companyId, branchId: input.branchId, safeId: tvr.tvrSafeId }, { active: false });
            const now = new Date();
            const tapId = await this.approval.record(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: tvr.tvrTenantId,
                accYear: tvr.tvrAccYear,
                event: SAFE_VARIANCE,
                sessionId: null,
                counterId: null,
                srcDocType: requester.srcDocType,
                srcDocId: requester.srcDocId,
                srcRefno: requester.srcRefno,
                amount: gap.abs(),
                rule: decision.rule,
                verdict: decision.verdict,
                requestedBy: requester.userId,
                requestedOn: tvr.tvrCreatedOn,
                reasonId: decision.reasonId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: input.notes?.trim() || `Safe gap ${gap.toFixed(2)} decided: ${input.treatment}`,
                payload: {
                    decision: 'APPROVE',
                    treatment: input.treatment,
                    stage: tvr.tvrStage,
                    via: 'safes/decide-variance',
                    safeId: safe.tsfId,
                    variances: [{ tvrId: tvr.tvrId, variance: gap.toFixed(2) }],
                },
                selfAllowed: true,
                secondOn,
            });
            await tx.tillVariance.update({
                where: { tvrId_tvrAccYear: { tvrId: tvr.tvrId, tvrAccYear: tvr.tvrAccYear } },
                data: {
                    tvrTreatment: input.treatment,
                    tvrReasonId: decision.reasonId,
                    tvrApprovalId: tapId,
                    tvrDecidedBy: caller.userId,
                    tvrDecidedOn: now,
                    tvrNotes: input.notes?.trim() || tvr.tvrNotes,
                    tvrModifiedOn: now,
                    tvrModifiedBy: caller.actorName,
                },
            });
            const ledgerId = tvr.tvrStage === till_enum_1.TillVarianceStage.REMIT
                ? await this.ledger.roleLedger(tx, till_enum_1.CASH_IN_TRANSIT_ROLE, input.companyId, input.branchId)
                : safe.tsfLedgerId;
            const voucherId = await this.posting.postSafeVariance(tx, {
                scope: {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    tenantId: tvr.tvrTenantId,
                    accYear: today.accYear,
                    date: today.date,
                },
                tvrId: tvr.tvrId,
                tvrAccYear: tvr.tvrAccYear,
                ledgerId,
                label: tvr.tvrStage === till_enum_1.TillVarianceStage.REMIT
                    ? `Remittance ${requester.srcRefno ?? ''}`.trim()
                    : `Safe ${safe.tsfName}`,
                variance: gap,
                treatment: input.treatment,
                caller,
            });
            await this.events.log(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: tvr.tvrAccYear,
                code: till_enum_1.TillEventCode.VARIANCE_DECIDED,
                dayId: requester.dayId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                srcDocType: 'TILL_VARIANCE',
                srcDocId: tvr.tvrId,
                srcRefno: requester.srcRefno,
                amount: gap.abs(),
                reasonId: decision.reasonId,
                approvalId: tapId,
                payload: this.decisionPayload(tvr.tvrStage, decision, safe.tsfId, tvr.tvrId, gap),
            });
            return { tvr, safe, tapId, voucherId, now };
        });
        const numbers = await this.voucherNos([done.voucherId]);
        return {
            tvrId: done.tvr.tvrId,
            tvrAccYear: done.tvr.tvrAccYear,
            stage: done.tvr.tvrStage,
            safeId: done.safe.tsfId,
            safeName: done.safe.tsfName,
            expected: num(new client_1.Prisma.Decimal(done.tvr.tvrExpected)),
            counted: num(new client_1.Prisma.Decimal(done.tvr.tvrCounted)),
            variance: num(gap),
            treatment: input.treatment,
            tapId: done.tapId,
            secondBy: decision.verdict.secondBy,
            varianceVoucherId: done.voucherId,
            varianceVoucherNo: done.voucherId ? (numbers.get(done.voucherId) ?? null) : null,
            decidedOn: done.now.toISOString(),
        };
    }
    async remit(input) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const safe = await this.loadSafe(this.prisma, input, { active: true });
        const visible = await this.figuresVisible(settings);
        const amount = new client_1.Prisma.Decimal(input.amount).toDecimalPlaces(2);
        if (!amount.greaterThan(0)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'A remittance is more than 0', 'amount');
        }
        if (!Object.values(till_enum_1.TillRemitMode).includes(input.mode)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'mode is BANK_DEPOSIT or CIT', 'mode');
        }
        await this.assertBank(input.companyId, input.bankLedgerId);
        const lines = input.lines ?? [];
        this.assertCashLines(lines, 'lines');
        const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const today = { date: businessDate, accYear: (0, till_dates_1.accYearOf)(businessDate) };
        let approval = null;
        const need = await this.approval.assess(this.prisma, {
            companyId: input.companyId,
            branchId: input.branchId,
            event: REMITTANCE,
            onDate: businessDate,
            amount,
        });
        if (need) {
            const rule = await this.approval.ruleOrDefault(this.prisma, {
                companyId: input.companyId,
                branchId: input.branchId,
                event: REMITTANCE,
                onDate: businessDate,
            });
            const approverId = input.approverId?.trim() || caller.userId;
            const judged = approverId === caller.userId ? rule : { ...rule, tar_channel: 'COUNTER' };
            const verdict = await this.withPinFail({ scope: input, accYear: today.accYear, caller, pin: input.approverPin, action: 'remit' }, () => this.approval.assertApprover(this.prisma, {
                companyId: input.companyId,
                branchId: input.branchId,
                event: REMITTANCE,
                amount,
                rule: judged,
                approverId,
                requesterId: caller.userId,
                pin: input.approverPin ?? null,
            }));
            approval = { rule, verdict, approverId };
        }
        const peek = await this.prisma.$transaction(async (tx) => {
            await this.customPlans(tx);
            return this.stateOf(tx, safe, today);
        });
        this.assertWithinBalance(safe, amount, peek.expected, visible);
        const done = await this.prisma.$transaction(async (tx) => {
            await this.customPlans(tx);
            const day = await this.dayFor(tx, input, settings, caller);
            await this.lockSafe(tx, safe.tsfId);
            const state = await this.stateOf(tx, safe, {
                date: day.businessDate,
                accYear: day.accYear,
            });
            this.assertWithinBalance(safe, amount, state.expected, visible);
            const transitLedgerId = input.mode === till_enum_1.TillRemitMode.CIT
                ? await this.ledger.roleLedger(tx, till_enum_1.CASH_IN_TRANSIT_ROLE, input.companyId, input.branchId)
                : null;
            const [idRow] = await tx.$queryRaw `SELECT uuidv7()::text AS id`;
            const tcmId = idRow.id;
            const now = new Date();
            const tapId = approval
                ? await this.approval.record(tx, {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    tenantId: input.tenantId ?? null,
                    accYear: day.accYear,
                    event: REMITTANCE,
                    sessionId: null,
                    counterId: null,
                    srcDocType: 'TILL_MOVEMENT',
                    srcDocId: tcmId,
                    srcRefno: input.slipNo ?? null,
                    amount,
                    rule: approval.rule,
                    verdict: approval.verdict,
                    requestedBy: caller.userId,
                    requestedOn: now,
                    reasonId: null,
                    status: 'APPROVED',
                    decidedBy: approval.approverId,
                    decidedOn: now,
                    decidedDeviceId: caller.deviceId,
                    decisionNote: input.notes?.trim() || `Remittance of ${amount.toFixed(2)} from ${safe.tsfName}`,
                    payload: { mode: input.mode, safeId: safe.tsfId, bankLedgerId: input.bankLedgerId },
                })
                : null;
            let countId = null;
            if (lines.length > 0) {
                const priced = await this.sessions.priceLines(tx, input.companyId, lines);
                const total = priced.reduce((s, l) => s.plus(l.amount), ZERO);
                if (!total.equals(amount)) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `The notes counted come to ${total.toFixed(2)}, not the ${amount.toFixed(2)} remitted`, 'lines');
                }
                countId = (await this.sessions.writeSafeCount(tx, {
                    kind: till_enum_1.TillCountKind.REMIT,
                    companyId: input.companyId,
                    branchId: input.branchId,
                    tenantId: input.tenantId ?? null,
                    accYear: day.accYear,
                    safeId: safe.tsfId,
                    dayId: null,
                    movementId: tcmId,
                    lines: priced,
                    expected: amount,
                    isBlind: false,
                    caller,
                    notes: input.notes ?? null,
                })).tctId;
            }
            const posted = await this.posting.postRemit(tx, {
                scope: {
                    companyId: input.companyId,
                    branchId: input.branchId,
                    tenantId: input.tenantId ?? null,
                    accYear: day.accYear,
                    date: day.businessDate,
                    dayId: day.tbdId,
                },
                safe: this.safeRef(safe),
                amount,
                mode: input.mode,
                bankLedgerId: input.bankLedgerId,
                transitLedgerId,
                caller,
                tcmId,
                bagNo: input.bagNo ?? null,
                sealNo: input.sealNo ?? null,
                citAgency: input.citAgency ?? null,
                slipNo: input.slipNo ?? null,
                slipDate: input.slipDate ?? null,
                countId,
                approvalId: tapId,
                notes: input.notes ?? null,
            });
            await this.refreshDay(tx, day.tbdId, day.accYear);
            return { day, posted, tapId, countId };
        }, { timeout: 60_000 });
        const after = await this.balance({ ...input, safeId: safe.tsfId });
        return {
            movement: await this.movements.get({
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: done.day.accYear,
                tcmId: done.posted.tcmId,
            }),
            tapId: done.tapId,
            countId: done.countId,
            safe: after.safes[0],
        };
    }
    async confirmRemit(input) {
        const caller = await this.context.caller();
        const settings = await this.context.settings({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId: caller.deviceId,
            userId: caller.userId,
        });
        const peek = await this.loadRemit(this.prisma, input);
        this.assertInTransit(peek);
        const businessDate = await (0, till_dates_1.businessDateNow)(this.prisma, settings.dayCutoff);
        const docDate = (0, till_dates_1.isoDateOf)(peek.tcmDocDate);
        if (input.bankDate < docDate || input.bankDate > businessDate) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `The bank date is between the day it was sent (${docDate}) and today (${businessDate})`, 'bankDate');
        }
        const bankYear = (0, till_dates_1.accYearOf)(input.bankDate);
        await (0, till_dates_1.assertTillPartitions)(this.prisma, bankYear, 'bankDate');
        const sent = new client_1.Prisma.Decimal(peek.tcmAmount);
        const credited = input.bankAmount === null || input.bankAmount === undefined
            ? sent
            : new client_1.Prisma.Decimal(input.bankAmount).toDecimalPlaces(2);
        const gap = credited.minus(sent);
        const witnessId = input.witnessId?.trim() || null;
        const witnessOn = witnessId
            ? await this.provePerson({
                userId: witnessId,
                pin: input.witnessPin,
                field: 'witnessId',
                pinField: 'witnessPin',
                role: 'witness',
                caller,
                scope: input,
                accYear: peek.tcmAccYear,
                action: 'remit-confirm',
            })
            : null;
        const decision = input.treatment && gap.abs().greaterThan(settings.cashTolerance)
            ? await this.judgeGap({
                caller,
                scope: input,
                accYear: peek.tcmAccYear,
                onDate: businessDate,
                treatment: input.treatment,
                reasonId: input.reasonId ?? null,
                pin: input.approverPin ?? null,
                requesterId: caller.userId,
                second: witnessId ? { userId: witnessId } : null,
                gap,
            })
            : null;
        const done = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
          SELECT tcm_id FROM accounts.till_cash_movement
           WHERE tcm_id = ${peek.tcmId}::uuid AND tcm_acc_year = ${peek.tcmAccYear}::char(9)
             FOR UPDATE`;
            const m = await this.loadRemit(tx, input);
            this.assertInTransit(m);
            const safe = await this.loadSafe(tx, { companyId: input.companyId, branchId: input.branchId, safeId: m.tcmSafeId }, { active: false });
            const transitLedgerId = await this.ledger.roleLedger(tx, till_enum_1.CASH_IN_TRANSIT_ROLE, input.companyId, input.branchId);
            const scope = {
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: m.tcmTenantId,
                accYear: bankYear,
                date: input.bankDate,
            };
            const confirmVoucherId = await this.posting.postRemitConfirm(tx, {
                movement: { ...m, tcmAmount: sent },
                scope,
                transitLedgerId,
                bankAmount: credited,
                bankDate: input.bankDate,
                bankRef: input.bankRef.trim(),
                caller,
                notes: input.notes ?? null,
            });
            const raised = await this.raiseGap(tx, {
                stage: till_enum_1.TillVarianceStage.REMIT,
                safe,
                scope,
                tvrAccYear: m.tcmAccYear,
                dayId: m.tcmDayId,
                countId: null,
                movement: { tcmId: m.tcmId, docNo: m.tcmDocNo },
                expected: sent,
                counted: credited,
                ledgerId: transitLedgerId,
                label: `Remittance ${m.tcmDocNo}`,
                tolerance: settings.cashTolerance,
                decision,
                requestedBy: caller.userId,
                requestedOn: new Date(),
                secondOn: witnessOn,
                caller,
                notes: input.notes ?? null,
            });
            return { m, confirmVoucherId, raised };
        }, { timeout: 60_000 });
        const numbers = await this.voucherNos([done.confirmVoucherId, done.raised.voucherId]);
        return {
            tcmId: done.m.tcmId,
            tcmAccYear: done.m.tcmAccYear,
            docNo: done.m.tcmDocNo,
            sent: num(sent),
            credited: num(credited),
            difference: num(gap),
            outcome: done.raised.outcome,
            confirmVoucherId: done.confirmVoucherId,
            confirmVoucherNo: done.confirmVoucherId ? (numbers.get(done.confirmVoucherId) ?? null) : null,
            tvrId: done.raised.tvrId,
            treatment: done.raised.treatment,
            tapId: done.raised.tapId,
            varianceVoucherId: done.raised.voucherId,
            varianceVoucherNo: done.raised.voucherId
                ? (numbers.get(done.raised.voucherId) ?? null)
                : null,
            movement: await this.movements.get({
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: done.m.tcmAccYear,
                tcmId: done.m.tcmId,
            }),
        };
    }
    async voidRemit(input) {
        const caller = await this.context.caller();
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT tcm_id FROM accounts.till_cash_movement
         WHERE tcm_id = ${input.tcmId}::uuid AND tcm_acc_year = ${input.accYear}::char(9)
           FOR UPDATE`;
            const m = await this.loadRemit(tx, input);
            if (m.tcmStatus !== 'POSTED') {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, `Remittance ${m.tcmDocNo} is already ${m.tcmStatus}`, 'tcmId');
            }
            if (m.tcmRemitStatus === till_enum_1.TillRemitStatus.CONFIRMED) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, `Remittance ${m.tcmDocNo} has been confirmed by the bank and is not voided`, 'tcmId', { status: m.tcmRemitStatus ?? '' });
            }
            const day = await tx.tillBusinessDay.findFirst({
                where: { tbdId: m.tcmDayId, tbdAccYear: m.tcmAccYear },
                select: { tbdStatus: true, tbdBusinessDate: true },
            });
            if (day?.tbdStatus === till_enum_1.TillDayStatus.CLOSED) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSED, `Business day ${day ? (0, till_dates_1.isoDateOf)(day.tbdBusinessDate) : ''} is closed: its remittances stand`, 'tcmId');
            }
            await this.lockSafe(tx, m.tcmSafeId);
            const countedSince = await tx.tillCount.findFirst({
                where: {
                    tctSafeId: m.tcmSafeId,
                    tctKind: till_enum_1.TillCountKind.SAFE,
                    tctIsDeleted: false,
                    tctCountedOn: { gt: m.tcmCreatedOn },
                },
                select: { tctCountedOn: true },
            });
            if (countedSince) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_VOIDABLE, `The safe was counted at ${countedSince.tctCountedOn.toISOString()}, after ${m.tcmDocNo}: that count stands; post a new movement instead`, 'tcmId');
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
                movement: m,
                session: null,
                dayId: m.tcmDayId,
                companyId: input.companyId,
                branchId: input.branchId,
                reasonId: reason.trsId,
                reasonText: input.notes?.trim()
                    ? `${reason.trsName} — ${input.notes.trim()}`
                    : reason.trsName,
                caller,
            });
            await this.refreshDay(tx, m.tcmDayId, m.tcmAccYear);
        });
    }
    async refreshDay(tx, tbdId, accYear) {
        const day = await tx.tillBusinessDay.findUniqueOrThrow({
            where: { tbdId_tbdAccYear: { tbdId, tbdAccYear: accYear } },
        });
        const today = { date: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate), accYear: day.tbdAccYear };
        const safes = await this.branchSafes(tx, day);
        const counts = await tx.$queryRaw `
      SELECT DISTINCT ON (tct_safe_id) tct_total_counted AS counted, tct_expected AS expected
        FROM accounts.till_count
       WHERE tct_day_id = ${day.tbdId}::uuid AND tct_acc_year = ${day.tbdAccYear}::char(9)
         AND tct_kind = ${till_enum_1.TillCountKind.SAFE} AND tct_is_deleted = false
       ORDER BY tct_safe_id, tct_counted_on DESC, tct_id DESC`;
        let opening = ZERO;
        let expectedNow = ZERO;
        for (const safe of safes) {
            opening = opening.plus(await this.expectedAt(tx, safe, today, day.tbdOpenedOn));
            if (counts.length === 0) {
                expectedNow = expectedNow.plus((await this.stateOf(tx, safe, today)).expected);
            }
        }
        const [remitted] = await tx.$queryRaw `
      SELECT sum(tcm_amount) AS amt FROM accounts.till_cash_movement
       WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
         AND tcm_kind = ${till_enum_1.TillMovementKind.REMIT} AND tcm_status = 'POSTED' AND tcm_is_deleted = false`;
        await tx.tillBusinessDay.update({
            where: { tbdId_tbdAccYear: { tbdId: day.tbdId, tbdAccYear: day.tbdAccYear } },
            data: {
                tbdSafeOpening: opening,
                tbdSafeExpected: counts.length > 0 ? counts.reduce((s, c) => s.plus(c.expected ?? 0), ZERO) : expectedNow,
                tbdSafeCounted: counts.length > 0 ? counts.reduce((s, c) => s.plus(c.counted), ZERO) : null,
                tbdRemitted: new client_1.Prisma.Decimal(remitted?.amt ?? 0),
            },
        });
    }
    async uncountedSafes(client, day) {
        const safes = await this.branchSafes(client, day);
        if (safes.length === 0) {
            return [];
        }
        const counted = await client.tillCount.findMany({
            where: {
                tctDayId: day.tbdId,
                tctAccYear: day.tbdAccYear,
                tctKind: till_enum_1.TillCountKind.SAFE,
                tctIsDeleted: false,
            },
            select: { tctSafeId: true },
        });
        const countedIds = new Set(counted.map((c) => c.tctSafeId));
        const moved = await client.$queryRaw `
      SELECT DISTINCT s.safe_id::text FROM (
        SELECT tcm_safe_id AS safe_id FROM accounts.till_cash_movement
         WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_safe_id IS NOT NULL
        UNION ALL
        SELECT tcm_to_safe_id FROM accounts.till_cash_movement
         WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_to_safe_id IS NOT NULL) s`;
        const movedIds = new Set(moved.map((r) => r.safe_id));
        const today = { date: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate), accYear: day.tbdAccYear };
        const out = [];
        for (const safe of safes) {
            if (countedIds.has(safe.tsfId)) {
                continue;
            }
            if (movedIds.has(safe.tsfId) ||
                !(await this.stateOf(client, safe, today)).expected.isZero()) {
                out.push({ safeId: safe.tsfId, name: safe.tsfName });
            }
        }
        return out;
    }
    async pendingGapsOfDay(client, day) {
        const [row] = await client.$queryRaw `
      SELECT count(*)::int AS n
        FROM accounts.till_variance v
        LEFT JOIN accounts.till_count c
               ON v.tvr_stage = 'SAFE' AND c.tct_id = v.tvr_count_id AND c.tct_acc_year = v.tvr_acc_year
        LEFT JOIN accounts.till_cash_movement m
               ON v.tvr_stage = 'REMIT' AND m.tcm_id = v.tvr_movement_id AND m.tcm_acc_year = v.tvr_acc_year
       WHERE v.tvr_company_id = ${day.tbdCompanyId}::uuid AND v.tvr_branch_id = ${day.tbdBranchId}::uuid
         AND v.tvr_stage IN ('SAFE', 'REMIT') AND v.tvr_is_deleted = false
         AND v.tvr_status = 'OPEN' AND v.tvr_treatment = ${till_enum_1.TillVarianceTreatment.PENDING}
         AND COALESCE(c.tct_day_id, m.tcm_day_id) = ${day.tbdId}::uuid`;
        return row?.n ?? 0;
    }
    async raiseGap(tx, input) {
        const { safe, caller } = input;
        const gap = input.counted.minus(input.expected);
        if (gap.isZero()) {
            return {
                outcome: till_enum_1.TillSafeGapOutcome.EXACT,
                tvrId: null,
                treatment: null,
                tapId: null,
                voucherId: null,
            };
        }
        const within = gap.abs().lessThanOrEqualTo(input.tolerance);
        const decision = within ? null : input.decision;
        const treatment = within
            ? till_enum_1.TillVarianceTreatment.WITHIN_TOLERANCE
            : (decision?.treatment ?? till_enum_1.TillVarianceTreatment.PENDING);
        const outcome = within
            ? till_enum_1.TillSafeGapOutcome.WITHIN_TOLERANCE
            : decision
                ? till_enum_1.TillSafeGapOutcome.DECIDED
                : till_enum_1.TillSafeGapOutcome.SENT_FOR_APPROVAL;
        const [idRow] = await tx.$queryRaw `SELECT uuidv7()::text AS id`;
        const tvrId = idRow.id;
        const now = new Date();
        const src = input.stage === till_enum_1.TillVarianceStage.SAFE
            ? { type: 'TILL_COUNT', id: input.countId, refno: safe.tsfCode }
            : { type: 'TILL_MOVEMENT', id: input.movement.tcmId, refno: input.movement.docNo };
        let tapId = null;
        if (decision) {
            tapId = await this.approval.record(tx, {
                companyId: input.scope.companyId,
                branchId: input.scope.branchId,
                tenantId: input.scope.tenantId,
                accYear: input.tvrAccYear,
                event: SAFE_VARIANCE,
                sessionId: null,
                counterId: null,
                srcDocType: src.type,
                srcDocId: src.id,
                srcRefno: src.refno,
                amount: gap.abs(),
                rule: decision.rule,
                verdict: decision.verdict,
                requestedBy: input.requestedBy,
                requestedOn: input.requestedOn,
                reasonId: decision.reasonId,
                status: 'APPROVED',
                decidedBy: caller.userId,
                decidedOn: now,
                decidedDeviceId: caller.deviceId,
                decisionNote: input.notes?.trim() ||
                    `${input.label}: ${input.counted.toFixed(2)} against ${input.expected.toFixed(2)}`,
                payload: {
                    decision: 'APPROVE',
                    treatment: decision.treatment,
                    stage: input.stage,
                    via: input.stage === till_enum_1.TillVarianceStage.SAFE ? 'safes/count' : 'movements/remit-confirm',
                    safeId: safe.tsfId,
                    variances: [{ tvrId, variance: gap.toFixed(2) }],
                },
                selfAllowed: true,
                secondOn: input.secondOn,
            });
        }
        await tx.tillVariance.create({
            data: {
                tvrId,
                tvrCompanyId: input.scope.companyId,
                tvrBranchId: input.scope.branchId,
                tvrTenantId: input.scope.tenantId,
                tvrAccYear: input.tvrAccYear,
                tvrSessionId: null,
                tvrStage: input.stage,
                tvrSafeId: safe.tsfId,
                tvrCountId: input.countId,
                tvrMovementId: input.movement?.tcmId ?? null,
                tvrTenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
                tvrOpenAmount: input.expected,
                tvrExpected: input.expected,
                tvrCounted: input.counted,
                tvrTolerance: input.tolerance,
                tvrTreatment: treatment,
                tvrReasonId: decision?.reasonId ?? null,
                tvrApprovalId: tapId,
                tvrDecidedBy: within || decision ? caller.userId : null,
                tvrDecidedOn: within || decision ? now : null,
                tvrStatus: 'OPEN',
                tvrNotes: input.notes ?? null,
                tvrCreatedBy: caller.actorName,
            },
            select: { tvrId: true },
        });
        let voucherId = null;
        if (within || decision) {
            voucherId = await this.posting.postSafeVariance(tx, {
                scope: input.scope,
                tvrId,
                tvrAccYear: input.tvrAccYear,
                ledgerId: input.ledgerId,
                label: input.label,
                variance: gap,
                treatment: treatment,
                caller,
            });
        }
        if (!within) {
            await this.events.log(tx, {
                companyId: input.scope.companyId,
                branchId: input.scope.branchId,
                accYear: input.tvrAccYear,
                code: decision ? till_enum_1.TillEventCode.VARIANCE_DECIDED : till_enum_1.TillEventCode.APPROVAL_REQUESTED,
                dayId: input.dayId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                srcDocType: 'TILL_VARIANCE',
                srcDocId: tvrId,
                srcRefno: src.refno,
                amount: gap.abs(),
                reasonId: decision?.reasonId ?? null,
                approvalId: tapId,
                payload: decision
                    ? this.decisionPayload(input.stage, decision, safe.tsfId, tvrId, gap)
                    : {
                        event: SAFE_VARIANCE,
                        stage: input.stage,
                        safeId: safe.tsfId,
                        tvrId,
                        expected: input.expected.toFixed(2),
                        counted: input.counted.toFixed(2),
                        variance: gap.toFixed(2),
                    },
            });
        }
        return { outcome, tvrId, treatment, tapId, voucherId };
    }
    decisionPayload(stage, decision, safeId, tvrId, gap) {
        return {
            stage,
            decision: 'APPROVE',
            treatment: decision.treatment,
            event: SAFE_VARIANCE,
            amount: gap.abs().toFixed(2),
            requiredRole: decision.rule.tar_min_role,
            approverRole: decision.verdict.role,
            channel: decision.verdict.channel,
            implicitGrant: decision.verdict.implicit,
            grantId: decision.verdict.grantId,
            secondBy: decision.verdict.secondBy,
            reasonId: decision.reasonId,
            safeId,
            variances: [tvrId],
        };
    }
    async judgeGap(ask) {
        const rule = await this.approval.ruleOrDefault(this.prisma, {
            companyId: ask.scope.companyId,
            branchId: ask.scope.branchId,
            event: SAFE_VARIANCE,
            onDate: ask.onDate,
        });
        const verdict = await this.withPinFail({
            scope: ask.scope,
            accYear: ask.accYear,
            caller: ask.caller,
            pin: ask.pin,
            action: 'safe-variance',
        }, () => this.approval.assertApprover(this.prisma, {
            companyId: ask.scope.companyId,
            branchId: ask.scope.branchId,
            event: SAFE_VARIANCE,
            amount: ask.gap.abs(),
            rule,
            approverId: ask.caller.userId,
            requesterId: ask.requesterId,
            pin: ask.pin,
            selfExempt: true,
            second: ask.second,
        }));
        const reason = await this.sessions.varianceReason(this.prisma, {
            companyId: ask.scope.companyId,
            reasonId: ask.reasonId,
            event: SAFE_VARIANCE,
        });
        return { treatment: ask.treatment, rule, verdict, reasonId: reason.trsId, judged: ask.gap };
    }
    async withPinFail(ctx, judge) {
        try {
            return await judge();
        }
        catch (error) {
            if (ctx.pin?.trim() && (0, till_errors_1.tillErrorCodeOf)(error) === till_enum_1.TillErrorCode.APPROVER_PIN) {
                await this.events.log(this.prisma, {
                    companyId: ctx.scope.companyId,
                    branchId: ctx.scope.branchId,
                    accYear: ctx.accYear,
                    code: till_enum_1.TillEventCode.PIN_FAIL,
                    deviceId: ctx.caller.deviceId,
                    userId: ctx.caller.userId,
                    payload: { action: ctx.action },
                });
            }
            throw error;
        }
    }
    async provePerson(ask) {
        const label = ask.role === 'witness' ? 'The witness' : 'The second signature';
        if (ask.userId === ask.caller.userId) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `${label} is someone other than you`, ask.field);
        }
        const user = await this.prisma.userMaster.findFirst({
            where: { usrId: ask.userId, usrIsActive: true, usrIsDeleted: false },
            select: { usrLoginName: true, usrPinHash: true },
        });
        if (!user) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `${label} is not an active user`, ask.field);
        }
        if (!user.usrPinHash) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.WITNESS_NO_PIN, `${user.usrLoginName} has no till PIN: an administrator sets one in User Administration (menu 58)`, ask.pinField);
        }
        const pin = ask.pin?.trim() || null;
        if (pin === null) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.WITNESS_PIN_REQUIRED, `${user.usrLoginName} signs with their till PIN`, ask.pinField);
        }
        if (!(await (0, secret_hash_utils_1.verifySecret)(pin, user.usrPinHash))) {
            await this.events.log(this.prisma, {
                companyId: ask.scope.companyId,
                branchId: ask.scope.branchId,
                accYear: ask.accYear,
                code: till_enum_1.TillEventCode.PIN_FAIL,
                deviceId: ask.caller.deviceId,
                userId: ask.caller.userId,
                payload: { action: ask.action, [ask.field]: ask.userId },
            });
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.WITNESS_PIN, `${user.usrLoginName}'s till PIN is wrong`, ask.pinField);
        }
        return new Date();
    }
    async dayFor(tx, scope, settings, caller) {
        const businessDate = await (0, till_dates_1.businessDateNow)(tx, settings.dayCutoff);
        const accYear = (0, till_dates_1.accYearOf)(businessDate);
        const closed = await tx.tillBusinessDay.findFirst({
            where: {
                tbdCompanyId: scope.companyId,
                tbdBranchId: scope.branchId,
                tbdAccYear: accYear,
                tbdBusinessDate: (0, till_dates_1.dateParam)(businessDate),
                tbdIsDeleted: false,
                tbdStatus: till_enum_1.TillDayStatus.CLOSED,
            },
            select: { tbdId: true },
        });
        if (closed) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.DAY_CLOSED, `Business day ${businessDate} is closed: the safe is counted and remitted on the next business day (or reopen it)`, 'businessDate', { businessDate });
        }
        const day = await this.days.ensureOpenDay(tx, { companyId: scope.companyId, branchId: scope.branchId, tenantId: scope.tenantId ?? null }, settings, caller, 'SESSION');
        return { tbdId: day.tbdId, accYear: day.tbdAccYear, businessDate: day.businessDate };
    }
    async loadSafe(client, key, opts) {
        const safe = await client.tillSafe.findFirst({
            where: {
                tsfId: key.safeId,
                tsfCompanyId: key.companyId,
                tsfBranchId: key.branchId,
                tsfIsDeleted: false,
            },
        });
        if (!safe) {
            (0, till_errors_1.throwTillNotFound)('Till safe', 'safeId', key.safeId);
        }
        if (opts.active && !safe.tsfIsActive) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SAFE_MISSING, `${safe.tsfName} is inactive (Till Safes, menu 280)`, 'safeId');
        }
        return { ...safe, tsfInsuredLimit: new client_1.Prisma.Decimal(safe.tsfInsuredLimit) };
    }
    async branchSafes(client, day) {
        const rows = await client.tillSafe.findMany({
            where: {
                tsfCompanyId: day.tbdCompanyId,
                tsfBranchId: day.tbdBranchId,
                tsfIsDeleted: false,
                tsfIsActive: true,
            },
            orderBy: { tsfCode: 'asc' },
        });
        return rows.map((s) => ({ ...s, tsfInsuredLimit: new client_1.Prisma.Decimal(s.tsfInsuredLimit) }));
    }
    async lockSafe(tx, safeId) {
        await tx.$queryRaw `SELECT tsf_id FROM accounts.till_safe WHERE tsf_id = ${safeId}::uuid FOR UPDATE`;
    }
    async customPlans(tx) {
        await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
    }
    async figuresVisible(settings) {
        if (!settings.blindClose) {
            return true;
        }
        const office = await this.context.rights(till_enum_1.TILL_MENU.CASH_OFFICE);
        if (office.override) {
            return true;
        }
        return (await this.context.rights(till_enum_1.TILL_MENU.SESSIONS)).override;
    }
    assertCashLines(lines, field) {
        lines.forEach((line, i) => {
            if (line.tenderTypeId !== till_enum_1.CASH_TENDER_TYPE_ID) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, 'A safe holds cash', `${field}.${i}.tenderTypeId`);
            }
        });
    }
    assertWithinBalance(safe, amount, expected, visible) {
        if (amount.greaterThan(expected)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REMIT_OVER_BALANCE, visible
                ? `${safe.tsfName} should hold ${expected.toFixed(2)}: ${amount.toFixed(2)} cannot leave it`
                : `${amount.toFixed(2)} is more than ${safe.tsfName} should hold: count it, or send less`, 'amount');
        }
    }
    async assertBank(companyId, ledgerId) {
        const facts = await (0, voucher_facts_1.loadLedgerFacts)(this.prisma, companyId, [ledgerId]);
        const bank = facts.get(ledgerId);
        if (!bank || bank.isDeleted || !bank.isActive || !(0, voucher_facts_1.isBankLedger)(bank)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, 'bankLedgerId must be an active ledger under Bank Accounts / Bank OD A/c', 'bankLedgerId');
        }
    }
    async loadRemit(client, key) {
        const m = await client.tillCashMovement.findFirst({
            where: {
                tcmId: key.tcmId,
                tcmAccYear: key.accYear,
                tcmCompanyId: key.companyId,
                tcmBranchId: key.branchId,
                tcmIsDeleted: false,
            },
        });
        if (!m) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_NOT_FOUND, `Till movement ${key.tcmId} was not found`, 'tcmId');
        }
        if (m.tcmKind !== till_enum_1.TillMovementKind.REMIT) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.MOVEMENT_INVALID, `${m.tcmDocNo} is a ${m.tcmKind}, not a remittance`, 'tcmId');
        }
        return m;
    }
    assertInTransit(m) {
        if (m.tcmStatus !== 'POSTED' ||
            m.tcmRemitMode !== till_enum_1.TillRemitMode.CIT ||
            m.tcmRemitStatus !== till_enum_1.TillRemitStatus.IN_TRANSIT) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REMIT_NOT_IN_TRANSIT, m.tcmStatus !== 'POSTED'
                ? `${m.tcmDocNo} is ${m.tcmStatus}`
                : m.tcmRemitMode !== till_enum_1.TillRemitMode.CIT
                    ? `${m.tcmDocNo} was paid into the bank by staff: there is nothing to confirm`
                    : `${m.tcmDocNo} has already been confirmed`, 'tcmId', { status: m.tcmRemitStatus ?? m.tcmStatus });
        }
    }
    async pendingGap(client, key) {
        const tvr = await client.tillVariance.findFirst({
            where: {
                tvrId: key.tvrId,
                tvrAccYear: key.accYear,
                tvrCompanyId: key.companyId,
                tvrBranchId: key.branchId,
                tvrIsDeleted: false,
                tvrStage: { in: [till_enum_1.TillVarianceStage.SAFE, till_enum_1.TillVarianceStage.REMIT] },
            },
        });
        if (!tvr) {
            (0, till_errors_1.throwTillNotFound)('Safe variance', 'tvrId', key.tvrId);
        }
        if (tvr.tvrStatus !== 'OPEN' ||
            tvr.tvrTreatment !== till_enum_1.TillVarianceTreatment.PENDING) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VARIANCE_NOT_PENDING, `This safe gap is already decided (${tvr.tvrTreatment}, ${tvr.tvrStatus})`, 'tvrId', { treatment: tvr.tvrTreatment, status: tvr.tvrStatus });
        }
        return tvr;
    }
    async requesterOf(client, tvr) {
        if (tvr.tvrStage === till_enum_1.TillVarianceStage.SAFE) {
            const count = await client.tillCount.findUniqueOrThrow({
                where: { tctId_tctAccYear: { tctId: tvr.tvrCountId, tctAccYear: tvr.tvrAccYear } },
                select: { tctId: true, tctCountedBy: true, tctDayId: true },
            });
            return {
                userId: count.tctCountedBy,
                srcDocType: 'TILL_COUNT',
                srcDocId: count.tctId,
                srcRefno: null,
                dayId: count.tctDayId,
            };
        }
        const m = await client.tillCashMovement.findUniqueOrThrow({
            where: { tcmId_tcmAccYear: { tcmId: tvr.tvrMovementId, tcmAccYear: tvr.tvrAccYear } },
            select: {
                tcmId: true,
                tcmConfirmedBy: true,
                tcmDoneBy: true,
                tcmDocNo: true,
                tcmDayId: true,
            },
        });
        return {
            userId: m.tcmConfirmedBy ?? m.tcmDoneBy,
            srcDocType: 'TILL_MOVEMENT',
            srcDocId: m.tcmId,
            srcRefno: m.tcmDocNo,
            dayId: m.tcmDayId,
        };
    }
    safeRef(safe) {
        return { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName };
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
};
exports.TillSafeService = TillSafeService;
exports.TillSafeService = TillSafeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_ledger_service_1.TillLedgerService,
        till_posting_service_1.TillPostingService,
        till_session_service_1.TillSessionService,
        till_event_service_1.TillEventService,
        till_approval_service_1.TillApprovalService,
        till_day_service_1.TillDayService,
        till_movement_service_1.TillMovementService])
], TillSafeService);
function inOf(f) {
    return f.handOvers.plus(f.drops).plus(f.pickups).plus(f.transfersIn).plus(f.receipts);
}
function outOf(f) {
    return f.floatIssues.plus(f.topUps).plus(f.remittances).plus(f.transfersOut).plus(f.payments);
}
function netOf(f) {
    return inOf(f).minus(outOf(f));
}
//# sourceMappingURL=till-safe.service.js.map