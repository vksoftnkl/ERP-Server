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
const rights_1 = require("../../../common/posting/rights");
const till_context_service_1 = require("../till-context.service");
const till_errors_1 = require("../till-errors");
const till_dates_1 = require("../till-dates");
const till_day_service_1 = require("./till-day.service");
const till_movement_service_1 = require("./till-movement.service");
const till_session_service_1 = require("./till-session.service");
const till_enum_1 = require("../types/till-enum");
let TillPrintService = class TillPrintService {
    prisma;
    sessions;
    days;
    movements;
    constructor(prisma, sessions, days, movements) {
        this.prisma = prisma;
        this.sessions = sessions;
        this.days = days;
        this.movements = movements;
    }
    async sessionHeader(doc) {
        const { session: s, xNo, names } = await this.session(doc);
        const cash = s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
        const voids = await this.voidFigures([s.tssId], s.tssAccYear);
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
            void_count: voids.voidCount,
            void_amount: voids.voidAmount,
            void_printed_count: voids.voidPrintedCount,
            line_void_count: voids.lineVoidCount,
            line_void_value: voids.lineVoidValue,
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
            received_by_self: s.receivedBySelf,
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
        const voids = await this.voidFigures(sessions.map((s) => s.tssId), doc.accYear);
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
            void_count: voids.voidCount,
            void_amount: voids.voidAmount,
            void_printed_count: voids.voidPrintedCount,
            line_void_count: voids.lineVoidCount,
            line_void_value: voids.lineVoidValue,
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
            safe_below_zero: day.safe.belowZero,
            safe_awaiting_opening: closed ? day.safe.awaitingOpening : null,
            safe_awaiting: day.safe.awaiting,
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
                received_by: s.receivedByName,
                received_by_self: s.receivedBySelf,
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
    async movementHeader(doc) {
        const { m, x, names } = await this.movement(doc, 'MOVEMENT');
        const { gives, receives } = signatures(m, x, names);
        return {
            doc_no: m.tcmDocNo,
            doc_date: dateText(m.tcmDocDate),
            kind: m.tcmKind,
            kind_text: KIND_TEXT[m.tcmKind],
            status: m.tcmStatus,
            voided_on: timeText(m.tcmVoidedOn),
            voided_by: names.voidedBy,
            void_reason: x.void_reason,
            amount: m.tcmAmount,
            session_no: m.sessionNo,
            business_date: dateText(x.business_date ? (0, till_dates_1.isoDateOf)(x.business_date) : null),
            counter_code: x.counter_code,
            counter_name: x.counter_name,
            cashier: names.cashier,
            safe_code: x.safe_code,
            safe_name: m.safeName,
            to_safe_code: x.to_safe_code,
            to_safe_name: x.to_safe_name,
            reason: m.reasonName,
            ledger_name: x.ledger_name,
            party_name: m.tcmPartyName,
            ref_no: m.tcmRefNo,
            ref_date: dateText(m.tcmRefDate),
            notes: m.tcmNotes,
            bag_no: m.tcmBagNo,
            seal_no: m.tcmSealNo,
            gives,
            receives,
            witness_verified_on: timeText(m.tcmWitnessVerifiedOn),
            receipt_status: m.tcmReceiptStatus,
            received_by: names.receivedBy,
            received_on: timeText(m.tcmReceivedOn),
            received_amount: m.tcmReceivedAmount,
            voucher_no: x.voucher_no,
            created_on: timeText(m.tcmCreatedOn),
            print_count: x.print_count,
            printed_on: timeText(new Date().toISOString()),
        };
    }
    async movementLines(doc) {
        const { m } = await this.movement(doc, 'MOVEMENT');
        return this.countLines(m);
    }
    async remitHeader(doc) {
        const { m, x, names } = await this.movement(doc, 'REMIT');
        const confirmed = m.tcmBankAmount !== null;
        return {
            doc_no: m.tcmDocNo,
            doc_date: dateText(m.tcmDocDate),
            voucher_no: x.voucher_no,
            mode: m.tcmRemitMode,
            mode_text: m.tcmRemitMode ? REMIT_MODE_TEXT[m.tcmRemitMode] : null,
            status: m.tcmStatus === 'VOIDED' ? 'VOIDED' : m.tcmRemitStatus,
            voided_on: timeText(m.tcmVoidedOn),
            voided_by: names.voidedBy,
            void_reason: x.void_reason,
            safe_code: x.safe_code,
            safe_name: m.safeName,
            bank_name: x.ledger_name,
            bank_account_no: null,
            bank_ifsc: null,
            bank_branch: null,
            amount: m.tcmAmount,
            bag_no: m.tcmBagNo,
            seal_no: m.tcmSealNo,
            cit_agency: m.tcmCitAgency,
            slip_no: m.tcmRefNo,
            slip_date: dateText(m.tcmRefDate),
            done_by: names.doneBy,
            approved_by: names.approvedBy,
            handed_to: null,
            bank_date: dateText(m.tcmBankDate),
            bank_ref: m.tcmBankRef,
            bank_amount: m.tcmBankAmount,
            difference: confirmed ? round2(m.tcmBankAmount - m.tcmAmount) : null,
            confirmed_by: names.confirmedBy,
            confirmed_on: timeText(m.tcmConfirmedOn),
            confirm_voucher_no: x.confirm_voucher_no,
            notes: m.tcmNotes,
            created_on: timeText(m.tcmCreatedOn),
            print_count: x.print_count,
            printed_on: timeText(new Date().toISOString()),
        };
    }
    async remitLines(doc) {
        const { m } = await this.movement(doc, 'REMIT');
        return (await this.countLines(m)).map(({ side: _side, ...line }) => line);
    }
    async movement(doc, purpose) {
        const row = await this.prisma.tillCashMovement.findFirst({
            where: {
                tcmId: doc.docId,
                tcmAccYear: doc.accYear,
                tcmCompanyId: doc.companyId,
                tcmIsDeleted: false,
            },
            select: { tcmBranchId: true, tcmKind: true },
        });
        if (!row) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.MOVEMENT_NOT_FOUND, 'Till movement', 'docId', doc.docId);
        }
        const isRemit = row.tcmKind === till_enum_1.TillMovementKind.REMIT;
        if (isRemit !== (purpose === 'REMIT')) {
            (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.PRINT_WRONG_PURPOSE, isRemit
                ? 'A remittance prints as its memo: purpose TILL_REMIT'
                : `A ${row.tcmKind} prints as its slip: purpose TILL_MOVEMENT`, 'docId');
        }
        const m = await this.movements.get({
            companyId: doc.companyId,
            branchId: row.tcmBranchId,
            accYear: doc.accYear,
            tcmId: doc.docId,
        });
        await this.assertMovementRight(doc.userId, m);
        const [x] = await this.prisma.$queryRaw `
      SELECT s.tss_business_date AS business_date, s.tss_operator_id::text AS operator_id,
             c.tcn_code AS counter_code, c.tcn_name AS counter_name,
             sf.tsf_code AS safe_code, ts.tsf_code AS to_safe_code, ts.tsf_name AS to_safe_name,
             l.led_name AS ledger_name, v.avh_voucher_refno AS voucher_no,
             cv.avh_voucher_refno AS confirm_voucher_no, vr.trs_name AS void_reason,
             a.tap_decided_by::text AS approved_by, m.tcm_print_count AS print_count
        FROM accounts.till_cash_movement m
        LEFT JOIN accounts.till_session s
               ON s.tss_id = m.tcm_session_id AND s.tss_acc_year = m.tcm_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = s.tss_counter_id
        LEFT JOIN accounts.till_safe sf ON sf.tsf_id = m.tcm_safe_id
        LEFT JOIN accounts.till_safe ts ON ts.tsf_id = m.tcm_to_safe_id
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = m.tcm_ledger_id
        LEFT JOIN accounts.acc_voucher_header v
               ON v.avh_voucher_id = m.tcm_voucher_id AND v.avh_acc_year = m.tcm_voucher_acc_year
        LEFT JOIN accounts.acc_voucher_header cv
               ON cv.avh_voucher_id = m.tcm_confirm_voucher_id
              AND cv.avh_acc_year = m.tcm_confirm_voucher_acc_year
        LEFT JOIN accounts.till_reason vr ON vr.trs_id = m.tcm_void_reason_id
        LEFT JOIN accounts.till_approval a
               ON a.tap_id = m.tcm_approval_id AND a.tap_acc_year = m.tcm_acc_year
       WHERE m.tcm_id = ${doc.docId}::uuid AND m.tcm_acc_year = ${doc.accYear}::char(9)`;
        return {
            m,
            x,
            names: {
                cashier: await this.userName(x.operator_id),
                doneBy: await this.userName(m.tcmDoneBy),
                witnessBy: await this.userName(m.tcmWitnessBy),
                receivedBy: await this.userName(m.tcmReceivedBy),
                voidedBy: await this.userName(m.tcmVoidedBy),
                confirmedBy: await this.userName(m.tcmConfirmedBy),
                approvedBy: await this.userName(x.approved_by),
            },
        };
    }
    async assertMovementRight(userId, m) {
        const user = (0, till_context_service_1.isUuid)(userId) ? userId : null;
        if (m.sessionOperatorId && m.sessionOperatorId === user) {
            await (0, rights_1.assertMenuRight)(this.prisma, {
                userId: user,
                menuId: till_enum_1.TILL_MENU.OPEN_TILL,
                right: 'view',
                codePrefix: till_enum_1.TILL_RIGHT_CODE_PREFIX,
                action: 'print your till movements',
            });
            return;
        }
        if (!m.tcmSessionId &&
            user &&
            (await (0, rights_1.loadRights)(this.prisma, user, till_enum_1.TILL_MENU.CASH_OFFICE)).view) {
            return;
        }
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: user,
            menuId: till_enum_1.TILL_MENU.SESSIONS,
            right: 'view',
            codePrefix: till_enum_1.TILL_RIGHT_CODE_PREFIX,
            action: m.tcmSessionId ? 'print till movements' : 'print a remittance or a safe transfer',
        });
    }
    async countLines(m) {
        const lines = await this.prisma.$queryRaw `
      SELECT CASE WHEN m.tcm_kind = ${till_enum_1.TillMovementKind.EXCHANGE}
                  THEN CASE WHEN c.tct_id = m.tcm_count_id THEN 'IN' ELSE 'OUT' END END AS side,
             CASE WHEN l.tcl_denomination_id IS NULL THEN NULL ELSE l.tcl_face_value END AS face_value,
             d.tdn_label AS denomination,
             CASE WHEN l.tcl_denomination_id IS NULL THEN NULL ELSE l.tcl_qty END AS qty,
             l.tcl_amount AS amount
        FROM accounts.till_cash_movement m
        JOIN accounts.till_count c
          ON c.tct_acc_year = m.tcm_acc_year AND c.tct_is_deleted = false
         AND (c.tct_id = m.tcm_count_id
              OR (m.tcm_kind = ${till_enum_1.TillMovementKind.EXCHANGE} AND c.tct_movement_id = m.tcm_id))
        JOIN accounts.till_count_line l
          ON l.tcl_count_id = c.tct_id AND l.tcl_acc_year = c.tct_acc_year
        LEFT JOIN accounts.till_denomination d ON d.tdn_id = l.tcl_denomination_id
       WHERE m.tcm_id = ${m.tcmId}::uuid AND m.tcm_acc_year = ${m.tcmAccYear}::char(9)
         AND l.tcl_tender_type_id = ${till_enum_1.CASH_TENDER_TYPE_ID}
         AND l.tcl_amount <> 0
       ORDER BY (c.tct_id = m.tcm_count_id) DESC, l.tcl_denomination_id IS NULL,
                l.tcl_face_value DESC, l.tcl_row_no`;
        return lines.map((l) => ({
            face_value: l.face_value === null ? null : Number(l.face_value),
            denomination: l.denomination,
            qty: l.qty === null ? null : Number(l.qty),
            amount: Number(l.amount),
            side: l.side,
        }));
    }
    async voidFigures(sessionIds, accYear) {
        if (sessionIds.length === 0) {
            return {
                voidCount: 0,
                voidAmount: 0,
                voidPrintedCount: 0,
                lineVoidCount: 0,
                lineVoidValue: 0,
            };
        }
        const [row] = await this.prisma.$queryRaw `
      SELECT (SELECT count(*)::int FROM accounts.till_void v
               WHERE v.tvd_session_id = ANY(${sessionIds}::uuid[]) AND v.tvd_acc_year = ${accYear}::char(9)) AS void_count,
             (SELECT COALESCE(sum(v.tvd_amount), 0)::text FROM accounts.till_void v
               WHERE v.tvd_session_id = ANY(${sessionIds}::uuid[]) AND v.tvd_acc_year = ${accYear}::char(9)) AS void_amount,
             (SELECT count(*)::int FROM accounts.till_void v
               WHERE v.tvd_session_id = ANY(${sessionIds}::uuid[]) AND v.tvd_acc_year = ${accYear}::char(9)
                 AND v.tvd_was_printed) AS void_printed_count,
             (SELECT count(*)::int FROM accounts.till_event e
               WHERE e.tev_session_id = ANY(${sessionIds}::uuid[]) AND e.tev_acc_year = ${accYear}::char(9)
                 AND e.tev_event_code = ${till_enum_1.TillEventCode.LINE_VOID}) AS line_void_count,
             (SELECT COALESCE(sum(COALESCE(e.tev_amount, (e.tev_payload ->> 'value')::numeric, 0)), 0)::text
                FROM accounts.till_event e
               WHERE e.tev_session_id = ANY(${sessionIds}::uuid[]) AND e.tev_acc_year = ${accYear}::char(9)
                 AND e.tev_event_code = ${till_enum_1.TillEventCode.LINE_VOID}) AS line_void_value`;
        return {
            voidCount: row?.void_count ?? 0,
            voidAmount: round2(Number(row?.void_amount ?? 0)),
            voidPrintedCount: row?.void_printed_count ?? 0,
            lineVoidCount: row?.line_void_count ?? 0,
            lineVoidValue: round2(Number(row?.line_void_value ?? 0)),
        };
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
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'docId', doc.docId);
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
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.DAY_NOT_FOUND, 'Business day', 'docId', doc.docId);
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
        till_day_service_1.TillDayService,
        till_movement_service_1.TillMovementService])
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
const KIND_TEXT = {
    [till_enum_1.TillMovementKind.FLOAT_ISSUE]: 'Float issue',
    [till_enum_1.TillMovementKind.TOP_UP]: 'Top-up',
    [till_enum_1.TillMovementKind.PICKUP]: 'Pickup',
    [till_enum_1.TillMovementKind.DROP]: 'Cash drop',
    [till_enum_1.TillMovementKind.CLOSE_HANDOVER]: 'Hand-over',
    [till_enum_1.TillMovementKind.PAID_IN]: 'Paid in',
    [till_enum_1.TillMovementKind.EXCHANGE]: 'Change',
    [till_enum_1.TillMovementKind.SAFE_TRANSFER]: 'Safe transfer',
    [till_enum_1.TillMovementKind.REMIT]: 'Remittance',
};
const REMIT_MODE_TEXT = {
    [till_enum_1.TillRemitMode.BANK_DEPOSIT]: 'Deposited at the bank',
    [till_enum_1.TillRemitMode.CIT]: 'Handed to the cash collection agency',
};
function signatures(m, x, names) {
    const cashierId = x.operator_id ?? m.tcmDoneBy;
    const cashier = x.operator_id ? names.cashier : names.doneBy;
    const other = m.tcmDoneBy !== cashierId
        ? names.doneBy
        : m.tcmWitnessBy && m.tcmWitnessBy !== cashierId
            ? names.witnessBy
            : null;
    switch (m.tcmKind) {
        case till_enum_1.TillMovementKind.PICKUP:
            return { gives: cashier, receives: other };
        case till_enum_1.TillMovementKind.TOP_UP:
        case till_enum_1.TillMovementKind.FLOAT_ISSUE:
            return { gives: other, receives: cashier };
        case till_enum_1.TillMovementKind.DROP:
        case till_enum_1.TillMovementKind.CLOSE_HANDOVER:
            return { gives: cashier, receives: names.receivedBy };
        case till_enum_1.TillMovementKind.PAID_IN:
            return { gives: m.tcmPartyName, receives: cashier };
        case till_enum_1.TillMovementKind.EXCHANGE:
            return { gives: cashier, receives: other };
        default:
            return { gives: names.doneBy, receives: m.tcmWitnessBy ? names.witnessBy : null };
    }
}
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