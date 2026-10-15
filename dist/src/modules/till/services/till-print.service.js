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
exports.TillPrintService = void 0;
exports.timeText = timeText;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_errors_1 = require("../till-errors");
const till_day_service_1 = require("./till-day.service");
const till_session_service_1 = require("./till-session.service");
const till_enum_1 = require("../types/till-enum");
let TillPrintService = class TillPrintService {
    prisma;
    sessions;
    days;
    constructor(prisma, sessions, days) {
        this.prisma = prisma;
        this.sessions = sessions;
        this.days = days;
    }
    async sessionHeader(doc) {
        const { session: s, xNo, names } = await this.session(doc);
        const cash = s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
        return {
            session_no: s.tssSessionNo,
            business_date: dateText(s.tssBusinessDate),
            counter_code: s.counterCode,
            counter_name: s.counterName,
            cashier: s.operatorName,
            status: s.tssStatus,
            is_closed: s.tssStatus === till_enum_1.TillSessionStatus.CLOSED,
            opened_on: timeText(s.tssOpenedOn),
            billing_ended_on: timeText(s.tssBillingEndedOn),
            counted_on: timeText(s.tssCountedOn),
            closed_on: timeText(s.tssClosedOn),
            closed_by: names.closedBy,
            z_no: s.tssZNo,
            x_no: xNo,
            reopen_count: s.tssReopenCount,
            force_closed: s.tssForceClosed,
            force_reason: names.forceReason,
            count_mode: s.tssCountMode,
            count_place: s.tssCountPlace,
            count_attempts: s.tssCountAttempts,
            float_mode: s.tssFloatMode,
            float_issued: s.tssFloatIssued,
            float_counted: s.tssFloatCounted,
            float_variance: s.tssFloatVariance,
            bill_count: s.totals.billCount,
            return_count: s.totals.returnCount,
            receipt_count: s.totals.receiptCount,
            payment_count: s.totals.paymentCount,
            expense_count: s.totals.expenseCount,
            net_sales: s.totals.netSales,
            cash_expected: cash?.expected ?? null,
            cash_counted: cash?.counted ?? null,
            cash_variance: cash?.variance ?? null,
            noncash_expected: s.totals.noncashExpected,
            noncash_counted: s.totals.noncashCounted,
            noncash_variance: s.totals.noncashVariance,
            handed_over: s.totals.handedOver,
            float_left: s.totals.floatLeft,
            variance_status: s.tssVarianceStatus,
            variance_treatment: closeCashTreatment(s),
            receipt_state: s.receiptState,
            cash_awaiting: s.cashAwaiting,
            received_by: s.receivedByName,
            received_on: timeText(s.receivedOn),
            expected_visible: s.expectedVisible,
            print_count: s.tssPrintCount,
            printed_on: timeText(new Date().toISOString()),
        };
    }
    async sessionTenders(doc) {
        const { session } = await this.session(doc);
        return session.tenders.map(tenderRow);
    }
    async sessionMovements(doc) {
        const { session } = await this.session(doc);
        return session.movements.map((m) => ({
            kind: m.tcmKind,
            doc_no: m.tcmDocNo,
            doc_date: dateText(m.tcmDocDate),
            amount: m.tcmAmount,
            status: m.tcmStatus,
            receipt_status: m.tcmReceiptStatus,
            received_amount: m.tcmReceivedAmount,
            created_on: timeText(m.tcmCreatedOn),
        }));
    }
    async dayHeader(doc) {
        const { day, sessions, closedBy, openedBy } = await this.day(doc);
        const closed = day.tbdStatus === till_enum_1.TillDayStatus.CLOSED;
        const sum = (pick) => round2(sessions.reduce((t, s) => t + (pick(s) ?? 0), 0));
        const cashOf = (s) => s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
        return {
            business_date: dateText(day.tbdBusinessDate),
            status: day.tbdStatus,
            is_closed: closed,
            z_no: day.tbdZNo,
            reopen_count: day.tbdReopenCount,
            opened_on: timeText(day.tbdOpenedOn),
            opened_by: openedBy,
            closed_on: timeText(day.tbdClosedOn),
            closed_by: closedBy,
            session_count: closed ? day.totals.sessionCount : sessions.length,
            live_session_count: sessions.filter((s) => s.tssStatus !== till_enum_1.TillSessionStatus.CLOSED).length,
            bill_count: closed ? day.totals.billCount : sum((s) => s.totals.billCount),
            net_sales: closed ? day.totals.netSales : sum((s) => s.totals.netSales),
            cash_expected: closed ? day.totals.cashExpected : sum((s) => cashOf(s)?.expected ?? null),
            cash_expected_counted: closed
                ? day.totals.cashExpected
                : sum((s) => {
                    const cash = cashOf(s);
                    return cash && cash.counted !== null ? cash.expected : null;
                }),
            cash_counted: closed ? day.totals.cashCounted : sum((s) => cashOf(s)?.counted ?? null),
            cash_variance: closed ? day.totals.cashVariance : sum((s) => cashOf(s)?.variance ?? null),
            noncash_variance: closed ? day.totals.noncashVariance : sum((s) => s.totals.noncashVariance),
            exception_count: day.tbdExceptionCount,
            cash_awaiting: sum((s) => s.cashAwaiting),
            safe_opening: closed ? day.safe.opening : null,
            safe_expected: day.safe.expected,
            safe_counted: day.safe.counted,
            safe_difference: day.safe.counted === null ? null : round2(day.safe.counted - day.safe.expected),
            safe_remitted: day.safe.remitted,
            safe_in_transit: await this.inTransit(day.tbdCompanyId, day.tbdBranchId),
            notes: day.tbdNotes,
            print_count: day.tbdPrintCount,
            printed_on: timeText(new Date().toISOString()),
        };
    }
    async daySessions(doc) {
        const { sessions } = await this.day(doc);
        return sessions.map((s) => {
            const cash = s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
            return {
                session_no: s.tssSessionNo,
                counter_code: s.counterCode,
                counter_name: s.counterName,
                cashier: s.operatorName,
                status: s.tssStatus,
                opened_on: timeText(s.tssOpenedOn),
                closed_on: timeText(s.tssClosedOn),
                z_no: s.tssZNo,
                bill_count: s.totals.billCount,
                net_sales: s.totals.netSales,
                cash_expected: cash?.expected ?? null,
                cash_counted: cash?.counted ?? null,
                cash_variance: cash?.variance ?? null,
                handed_over: s.totals.handedOver,
                float_left: s.totals.floatLeft,
                receipt_state: s.receiptState,
                force_closed: s.tssForceClosed,
                reopen_count: s.tssReopenCount,
            };
        });
    }
    async dayTenders(doc) {
        const { sessions } = await this.day(doc);
        const byTender = new Map();
        for (const t of sessions.flatMap((s) => s.tenders)) {
            const key = `${t.tenderTypeId}|${t.tenderId ?? ''}`;
            byTender.set(key, [...(byTender.get(key) ?? []), t]);
        }
        return [...byTender.values()].map((rows) => {
            const total = (pick) => rows.some((t) => pick(t) !== null)
                ? round2(rows.reduce((n, t) => n + (pick(t) ?? 0), 0))
                : null;
            return {
                ...tenderRow(rows[0]),
                open_amount: total((t) => t.openAmount),
                sales: total((t) => t.salesAmount),
                refunds: total((t) => t.refundAmount),
                receipts: total((t) => t.receiptAmount),
                payments: total((t) => t.paymentAmount),
                expenses: total((t) => t.expenseAmount),
                moved_in: total((t) => t.movedIn),
                moved_out: total((t) => t.movedOut),
                paid_from_bank: total((t) => t.paidFromBank),
                txn_count: rows.reduce((n, t) => n + (t.txnCount ?? 0), 0),
                expected: total((t) => t.expected),
                counted: total((t) => t.counted),
                variance: total((t) => t.variance),
            };
        });
    }
    async session(doc) {
        const row = await this.prisma.tillSession.findFirst({
            where: {
                tssId: doc.docId,
                tssAccYear: doc.accYear,
                tssCompanyId: doc.companyId,
                tssIsDeleted: false,
            },
            select: {
                tssBranchId: true,
                tssOperatorId: true,
                tssClosedBy: true,
                tssForceReasonId: true,
            },
        });
        if (!row) {
            (0, till_errors_1.throwTillNotFound)('Till session', 'docId', doc.docId);
        }
        const session = await this.sessions.get({
            companyId: doc.companyId,
            branchId: row.tssBranchId,
            accYear: doc.accYear,
            tssId: doc.docId,
        }, { asOperator: doc.userId === row.tssOperatorId });
        const [x] = await this.prisma.$queryRaw `
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${doc.docId}::uuid AND tev_acc_year = ${doc.accYear}::char(9)
         AND tev_event_code = ${till_enum_1.TillEventCode.X_REPORT} AND tev_payload ? 'xNo'`;
        const reason = row.tssForceReasonId
            ? await this.prisma.tillReason.findUnique({
                where: { trsId: row.tssForceReasonId },
                select: { trsName: true },
            })
            : null;
        return {
            session,
            xNo: x?.n ? x.n : null,
            names: {
                closedBy: await this.userName(row.tssClosedBy),
                forceReason: reason?.trsName ?? null,
            },
        };
    }
    async day(doc) {
        const row = await this.prisma.tillBusinessDay.findFirst({
            where: {
                tbdId: doc.docId,
                tbdAccYear: doc.accYear,
                tbdCompanyId: doc.companyId,
                tbdIsDeleted: false,
            },
            select: { tbdBranchId: true, tbdOpenedBy: true },
        });
        if (!row) {
            (0, till_errors_1.throwTillNotFound)('Business day', 'docId', doc.docId);
        }
        const day = await this.days.get({
            companyId: doc.companyId,
            branchId: row.tbdBranchId,
            accYear: doc.accYear,
            tbdId: doc.docId,
        });
        const ids = await this.prisma.tillSession.findMany({
            where: {
                tssDayId: doc.docId,
                tssAccYear: doc.accYear,
                tssIsDeleted: false,
                tssStatus: { not: till_enum_1.TillSessionStatus.VOIDED },
            },
            select: { tssId: true },
            orderBy: { tssOpenedOn: 'asc' },
        });
        const sessions = [];
        for (const { tssId } of ids) {
            sessions.push(await this.sessions.get({
                companyId: doc.companyId,
                branchId: row.tbdBranchId,
                accYear: doc.accYear,
                tssId,
            }));
        }
        return {
            day,
            sessions,
            closedBy: day.tbdClosedByName,
            openedBy: await this.userName(row.tbdOpenedBy),
        };
    }
    async inTransit(companyId, branchId) {
        const agg = await this.prisma.tillCashMovement.aggregate({
            where: {
                tcmCompanyId: companyId,
                tcmBranchId: branchId,
                tcmKind: till_enum_1.TillMovementKind.REMIT,
                tcmIsDeleted: false,
                tcmStatus: 'POSTED',
                tcmRemitStatus: till_enum_1.TillRemitStatus.IN_TRANSIT,
            },
            _sum: { tcmAmount: true },
        });
        return round2(Number(agg._sum.tcmAmount ?? 0));
    }
    async userName(userId) {
        if (!userId) {
            return null;
        }
        const u = await this.prisma.userMaster.findUnique({
            where: { usrId: userId },
            select: { usrLoginName: true, usrDisplayName: true },
        });
        return u ? u.usrDisplayName?.trim() || u.usrLoginName : null;
    }
};
exports.TillPrintService = TillPrintService;
exports.TillPrintService = TillPrintService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_session_service_1.TillSessionService,
        till_day_service_1.TillDayService])
], TillPrintService);
function tenderRow(t) {
    return {
        tender_type_id: t.tenderTypeId,
        tender_type: t.tenderTypeName,
        tender_name: t.tenderName,
        close_mode: t.closeMode,
        open_amount: t.openAmount,
        sales: t.salesAmount,
        refunds: t.refundAmount,
        receipts: t.receiptAmount,
        payments: t.paymentAmount,
        expenses: t.expenseAmount,
        moved_in: t.movedIn,
        moved_out: t.movedOut,
        paid_from_bank: t.paidFromBank,
        txn_count: t.txnCount,
        expected: t.expected,
        counted: t.counted,
        variance: t.variance,
    };
}
const round2 = (n) => Math.round(n * 100) / 100;
function closeCashTreatment(s) {
    const live = s.variances.filter((v) => v.tvrStage === till_enum_1.TillVarianceStage.CLOSE &&
        v.tvrTenderTypeId === till_enum_1.CASH_TENDER_TYPE_ID &&
        v.tvrStatus !== 'REVERSED' &&
        v.tvrVariance !== 0);
    return live.length > 0 ? live[live.length - 1].tvrTreatment : null;
}
function dateText(iso) {
    if (!iso) {
        return null;
    }
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}-${m}-${y}`;
}
function timeText(iso) {
    if (!iso) {
        return null;
    }
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    const p = (type) => parts.find((x) => x.type === type)?.value ?? '';
    const hour = Number(p('hour')) % 24;
    const h12 = String(hour % 12 || 12).padStart(2, '0');
    return `${p('day')}-${p('month')}-${p('year')} ${h12}:${p('minute')} ${hour < 12 ? 'AM' : 'PM'}`;
}
//# sourceMappingURL=till-print.service.js.map