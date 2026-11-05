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
exports.BillVoidService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const till_errors_1 = require("../../till/till-errors");
const till_approval_service_1 = require("../../till/services/till-approval.service");
const till_event_service_1 = require("../../till/services/till-event.service");
const till_session_service_1 = require("../../till/services/till-session.service");
const till_enum_1 = require("../../till/types/till-enum");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_service_1 = require("./bill.service");
const bill_lifecycle_service_1 = require("./bill-lifecycle.service");
const bill_api_types_1 = require("./types/bill-api.types");
const VOID_TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };
const SRC_DOC_TYPE = 'SALE_BILL';
const CUSTOMER_PRINT_PURPOSES = ['SALE_INVOICE', 'SALE_RECEIPT'];
const PRINT_MODES = ['PRINT', 'REPRINT'];
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE = [till_enum_1.TillSessionStatus.OPEN, till_enum_1.TillSessionStatus.SUSPENDED];
let BillVoidService = class BillVoidService {
    prisma;
    bills;
    lifecycle;
    salesContext;
    requestContext;
    till;
    approvals;
    events;
    constructor(prisma, bills, lifecycle, salesContext, requestContext, till, approvals, events) {
        this.prisma = prisma;
        this.bills = bills;
        this.lifecycle = lifecycle;
        this.salesContext = salesContext;
        this.requestContext = requestContext;
        this.till = till;
        this.approvals = approvals;
        this.events = events;
    }
    async void(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            const existing = await this.voidRowOf(tx, bill);
            if (existing && bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED) {
                return this.response(tx, bill, existing);
            }
            if (bill.sbStatus !== bill_api_types_1.BILL_STATUS_POSTED) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VOID_NOT_POSTED, bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED
                    ? `Bill ${bill.sbBillRefno ?? bill.sbId} is already cancelled`
                    : `Only a POSTED bill can be voided — bill ${bill.sbBillRefno ?? bill.sbId} is ${bill.sbStatus}`, 'sbId', { status: bill.sbStatus });
            }
            const ctx = await this.salesContext.resolve({ companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL, tx);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            const sessionRow = await this.sessionOf(tx, bill);
            if (!sessionRow) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VOID_NO_SESSION, `Bill ${bill.sbBillRefno ?? bill.sbId} was not made in a till session: cancel it (/bills/cancel)`, 'sbId');
            }
            if (!LIVE.includes(sessionRow.tssStatus)) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VOID_SESSION_CLOSED, `Till session ${sessionRow.tssSessionNo} is ${sessionRow.tssStatus} — the drawer is counted: make a sale return`, 'sbId', { sessionNo: sessionRow.tssSessionNo, status: sessionRow.tssStatus });
            }
            const caller = this.callerOf(ctx);
            const supervisor = (await (0, rights_1.loadRights)(tx, ctx.actor, till_enum_1.TILL_MENU.SESSIONS)).override;
            const session = await this.lockSession(tx, sessionRow, caller, supervisor);
            const reason = await tx.tillReason.findFirst({
                where: {
                    trsId: dto.reasonId,
                    trsIsDeleted: false,
                    trsIsActive: true,
                    trsCategory: 'VOID_BILL',
                    OR: [{ trsCompanyId: null }, { trsCompanyId: bill.sbCompanyId }],
                },
            });
            if (!reason) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, 'A void names an active VOID_BILL reason', 'reasonId');
            }
            const note = dto.note?.trim() ? dto.note.trim() : null;
            if (reason.trsNeedsNote && !note) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'note');
            }
            const evidence = await this.evidence(tx, bill, session.tssId, now);
            const gateAsk = {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                event: 'VOID_BILL',
                onDate: (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)(),
                amount: new client_1.Prisma.Decimal(bill.sbBillAmt),
                requesterId: ctx.actor,
                deviceId: caller.deviceId,
                sessionId: session.tssId,
                counterId: session.tssCounterId,
                srcDocType: SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcRefno: bill.sbBillRefno,
                approvalId: dto.approvalId ?? null,
                field: 'approvalId',
                count: evidence.voidNo,
                payload: {
                    printed: evidence.printed,
                    printCount: evidence.printCount,
                    minutesAfterPost: evidence.minutesAfterPost,
                    voidNo: evidence.voidNo,
                    reason: reason.trsCode,
                },
            };
            const gate = await this.approvals.assessGate(tx, gateAsk);
            if (gate.state === 'REFUSE') {
                this.approvals.throwApprovalRequired(gate.need, gateAsk);
            }
            const reasonText = note ? `${reason.trsName} — ${note}` : reason.trsName;
            const reversal = await this.lifecycle.cancelIn(tx, bill, ctx, reasonText, now, {
                action: 'void',
            });
            const approvalId = await this.approvals.settleGate(tx, gateAsk, gate);
            const row = await tx.tillVoid.create({
                data: {
                    tvdCompanyId: bill.sbCompanyId,
                    tvdBranchId: bill.sbBranchId,
                    tvdTenantId: bill.sbTenantId,
                    tvdAccYear: bill.sbAccYear,
                    tvdSrcDocType: SRC_DOC_TYPE,
                    tvdSrcDocId: bill.sbId,
                    tvdSrcDocRefno: bill.sbBillRefno,
                    tvdSessionId: session.tssId,
                    tvdDeviceId: caller.deviceId,
                    tvdCashierId: session.tssOperatorId,
                    tvdVoidedBy: ctx.actor,
                    tvdVoidedOn: now,
                    tvdAmount: new client_1.Prisma.Decimal(bill.sbBillAmt).toDecimalPlaces(2),
                    tvdCashAmount: evidence.cashAmount.toDecimalPlaces(2),
                    tvdReasonId: reason.trsId,
                    tvdNote: note,
                    tvdPostedOn: evidence.postedOn,
                    tvdMinutesAfterPost: evidence.minutesAfterPost,
                    tvdWasPrinted: evidence.printed,
                    tvdPrintCount: evidence.printCount,
                    tvdLastPrintedOn: evidence.lastPrintedOn,
                    tvdPrintFailed: evidence.printFailed,
                    tvdSessionVoidNo: evidence.voidNo,
                    tvdApprovalId: approvalId,
                    tvdReversalVoucherId: reversal.reversalVoucherId,
                    tvdReversalAccYear: reversal.reversalVoucherId ? bill.sbAccYear : null,
                    tvdCreatedBy: ctx.actorName,
                },
            });
            await this.events.log(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.BILL_VOID,
                eventOn: now,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: caller.deviceId ?? session.tssDeviceId,
                userId: ctx.actor,
                srcDocType: SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcRefno: bill.sbBillRefno,
                amount: new client_1.Prisma.Decimal(bill.sbBillAmt).toDecimalPlaces(2),
                reasonId: reason.trsId,
                approvalId,
                payload: {
                    sbId: bill.sbId,
                    refno: bill.sbBillRefno,
                    amount: Number(new client_1.Prisma.Decimal(bill.sbBillAmt).toFixed(2)),
                    cash: Number(evidence.cashAmount.toFixed(2)),
                    reason: reason.trsCode,
                    reasonName: reason.trsName,
                    note,
                    printed: evidence.printed,
                    printCount: evidence.printCount,
                    printFailed: evidence.printFailed,
                    minutes: evidence.minutesAfterPost,
                    voidNo: evidence.voidNo,
                    approvalId,
                    reversalVoucherRefno: reversal.reversalRefno,
                    cashierId: session.tssOperatorId,
                    bySupervisor: supervisor && ctx.actor !== session.tssOperatorId,
                },
            });
            return this.response(tx, { ...bill, sbStatus: bill_api_types_1.BILL_STATUS_CANCELLED }, row, {
                reversalVoucherRefno: reversal.reversalRefno,
            });
        }, VOID_TX_OPTIONS);
    }
    async check(keys) {
        const now = new Date();
        const bill = await this.prisma.saleBill.findFirst({
            where: {
                sbId: keys.sbId,
                sbAccYear: keys.sbAccYear,
                sbCompanyId: keys.sbCompanyId,
                sbBranchId: keys.sbBranchId,
                sbIsDeleted: false,
            },
        });
        if (!bill) {
            (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${keys.sbId}`, posting_types_1.SALES_ERROR_CODES.NOT_FOUND);
        }
        const ctx = await this.salesContext.resolve({ companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL);
        if (!ctx.rights.view) {
            (0, sales_errors_1.throwSalesRight)('This user may not view on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW);
        }
        const existing = await this.voidRowOf(this.prisma, bill);
        const session = await this.sessionOf(this.prisma, bill);
        const live = !!session && LIVE.includes(session.tssStatus);
        const route = existing
            ? 'VOIDED'
            : bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED
                ? 'CANCELLED'
                : bill.sbStatus !== bill_api_types_1.BILL_STATUS_POSTED
                    ? 'NOT_POSTED'
                    : !session
                        ? 'CANCEL'
                        : live
                            ? 'VOID'
                            : 'RETURN';
        const code = route === 'CANCEL'
            ? till_enum_1.TillErrorCode.VOID_NO_SESSION
            : route === 'RETURN'
                ? till_enum_1.TillErrorCode.VOID_SESSION_CLOSED
                : route === 'NOT_POSTED' || route === 'CANCELLED'
                    ? till_enum_1.TillErrorCode.VOID_NOT_POSTED
                    : null;
        const prints = await this.prints(this.prisma, bill);
        const postedOn = await this.postedOn(this.prisma, bill);
        const supervisor = (await (0, rights_1.loadRights)(this.prisma, ctx.actor, till_enum_1.TILL_MENU.SESSIONS)).override;
        const deviceId = this.callerOf(ctx).deviceId;
        const canVoid = route === 'VOID' &&
            ctx.rights.cancel &&
            !!session &&
            (supervisor ||
                (session.tssOperatorId === ctx.actor && deviceId === (await this.deviceOf(session))));
        const reasons = await this.prisma.tillReason.findMany({
            where: {
                trsCategory: 'VOID_BILL',
                trsIsDeleted: false,
                trsIsActive: true,
                OR: [{ trsCompanyId: null }, { trsCompanyId: bill.sbCompanyId }],
            },
            orderBy: [{ trsSortOrder: 'asc' }, { trsName: 'asc' }],
            select: { trsId: true, trsCode: true, trsName: true, trsNeedsNote: true },
        });
        return {
            sbId: bill.sbId,
            sbCompanyId: bill.sbCompanyId,
            sbBranchId: bill.sbBranchId,
            sbAccYear: bill.sbAccYear,
            sbBillRefno: bill.sbBillRefno,
            sbStatus: bill.sbStatus,
            amount: Number(new client_1.Prisma.Decimal(bill.sbBillAmt).toFixed(2)),
            cashAmount: Number((await this.cashOf(this.prisma, bill)).toFixed(2)),
            route,
            code,
            canVoid,
            session: session
                ? { tssId: session.tssId, sessionNo: session.tssSessionNo, status: session.tssStatus }
                : null,
            postedOn: postedOn?.toISOString() ?? null,
            minutesAfterPost: minutesBetween(postedOn, now),
            printed: prints.printed,
            printCount: prints.printCount,
            lastPrintedOn: prints.lastPrintedOn?.toISOString() ?? null,
            printFailed: prints.printFailed,
            prints: prints.rows.map((r) => ({
                on: r.on.toISOString(),
                status: r.status,
                mode: r.mode,
                purpose: r.purpose,
                copyNo: r.copy_no,
            })),
            nextVoidNo: session
                ? (await this.voidCount(this.prisma, session.tssId, bill.sbAccYear)) + 1
                : null,
            reasons: reasons.map((r) => ({
                reasonId: r.trsId,
                code: r.trsCode,
                name: r.trsName,
                needsNote: r.trsNeedsNote,
            })),
            void: existing ? await this.voidPayload(this.prisma, existing) : null,
        };
    }
    callerOf(ctx) {
        const deviceId = this.requestContext.getDeviceId();
        return {
            userId: ctx.actor,
            actorName: ctx.actorName,
            deviceId: deviceId && UUID_LIKE.test(deviceId) ? deviceId : null,
        };
    }
    async lockSession(tx, session, caller, supervisor) {
        try {
            return await this.till.lockLive(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                tssId: session.tssId,
            }, caller, { supervisor });
        }
        catch (error) {
            const code = (0, till_errors_1.tillErrorCodeOf)(error);
            if (code === till_enum_1.TillErrorCode.SESSION_NOT_YOURS || code === till_enum_1.TillErrorCode.SESSION_WRONG_DEVICE) {
                (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.VOID_NOT_ALLOWED, code === till_enum_1.TillErrorCode.SESSION_NOT_YOURS
                    ? `Till session ${session.tssSessionNo} belongs to another cashier: only its cashier on its device, or a supervisor (Till Sessions OVERRIDE), voids its bills`
                    : `Till session ${session.tssSessionNo} is driven from the device it was opened on: void there, or as a supervisor (Till Sessions OVERRIDE)`, 'sbId', { sessionNo: session.tssSessionNo, because: code });
            }
            throw error;
        }
    }
    async sessionOf(client, bill) {
        if (!bill.sbSessionId || !UUID_LIKE.test(bill.sbSessionId)) {
            return null;
        }
        return client.tillSession.findFirst({
            where: { tssId: bill.sbSessionId, tssIsDeleted: false },
            select: {
                tssId: true,
                tssAccYear: true,
                tssCompanyId: true,
                tssBranchId: true,
                tssSessionNo: true,
                tssStatus: true,
                tssOperatorId: true,
            },
        });
    }
    async deviceOf(session) {
        const row = await this.prisma.tillSession.findFirst({
            where: { tssId: session.tssId, tssAccYear: session.tssAccYear },
            select: { tssDeviceId: true },
        });
        return row?.tssDeviceId ?? null;
    }
    voidRowOf(client, bill) {
        return client.tillVoid.findFirst({
            where: { tvdSrcDocType: SRC_DOC_TYPE, tvdSrcDocId: bill.sbId, tvdAccYear: bill.sbAccYear },
        });
    }
    async voidCount(client, sessionId, accYear) {
        return client.tillVoid.count({ where: { tvdSessionId: sessionId, tvdAccYear: accYear } });
    }
    async evidence(tx, bill, sessionId, now) {
        const prints = await this.prints(tx, bill);
        const postedOn = await this.postedOn(tx, bill);
        return {
            ...prints,
            postedOn,
            minutesAfterPost: minutesBetween(postedOn, now),
            cashAmount: await this.cashOf(tx, bill),
            voidNo: (await this.voidCount(tx, sessionId, bill.sbAccYear)) + 1,
        };
    }
    async prints(client, bill) {
        const rows = await client.$queryRaw `
      SELECT l.plg_printed_on AS "on", l.plg_status AS status, l.plg_output_mode AS mode,
             p.ppo_code AS purpose, l.plg_copy_no AS copy_no
        FROM public.print_log l
        JOIN public.print_purpose p ON p.ppo_id = l.plg_purpose_id
       WHERE l.plg_src_doc_type = ${SRC_DOC_TYPE}
         AND l.plg_src_doc_id = ${bill.sbId}::uuid
         AND (l.plg_src_acc_year IS NULL OR l.plg_src_acc_year = ${bill.sbAccYear}::char(9))
         AND l.plg_output_mode = ANY(${[...PRINT_MODES]}::text[])
         AND p.ppo_code = ANY(${[...CUSTOMER_PRINT_PURPOSES]}::text[])
       ORDER BY l.plg_printed_on`;
        const ok = rows.filter((r) => r.status === 'SUCCESS');
        return {
            printed: ok.length > 0,
            printCount: ok.length,
            lastPrintedOn: ok.length ? ok[ok.length - 1].on : null,
            printFailed: rows.some((r) => r.status === 'FAILED'),
            rows,
        };
    }
    async postedOn(client, bill) {
        const [row] = await client.$queryRaw `
      SELECT max(tsl_changed_on) AS "on" FROM public.txn_status_log
       WHERE tsl_src_doc_type = ${SRC_DOC_TYPE}
         AND tsl_src_doc_id = ${bill.sbId}::uuid
         AND tsl_acc_year = ${bill.sbAccYear}::char(9)
         AND tsl_event = 'POSTED'
         AND tsl_is_deleted = false`;
        return row?.on ?? bill.sbBillDatetime ?? null;
    }
    async cashOf(client, bill) {
        const [row] = await client.$queryRaw `
      SELECT COALESCE(sum(td_amount), 0)::text AS cash FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = ${SRC_DOC_TYPE}
         AND td_src_doc_id = ${bill.sbId}::uuid
         AND td_acc_year = ${bill.sbAccYear}::char(9)
         AND td_tender_type_id = ${till_enum_1.CASH_TENDER_TYPE_ID}::int
         AND td_is_deleted = false
         AND td_is_voided = false`;
        return new client_1.Prisma.Decimal(row?.cash ?? 0);
    }
    async voidPayload(client, row) {
        const [names] = await client.$queryRaw `
      SELECT r.trs_code AS reason_code, r.trs_name AS reason_name,
             v.usr_login_name AS voided_by, c.usr_login_name AS cashier
        FROM (SELECT 1) x
        LEFT JOIN accounts.till_reason r ON r.trs_id = ${row.tvdReasonId}::uuid
        LEFT JOIN public.user_master v ON v.usr_id = ${row.tvdVoidedBy}::uuid
        LEFT JOIN public.user_master c ON c.usr_id = ${row.tvdCashierId}::uuid`;
        return {
            tvdId: row.tvdId,
            sessionId: row.tvdSessionId,
            cashierId: row.tvdCashierId,
            cashier: names?.cashier ?? null,
            voidedBy: row.tvdVoidedBy,
            voidedByName: names?.voided_by ?? null,
            voidedOn: row.tvdVoidedOn.toISOString(),
            amount: Number(new client_1.Prisma.Decimal(row.tvdAmount).toFixed(2)),
            cashAmount: Number(new client_1.Prisma.Decimal(row.tvdCashAmount).toFixed(2)),
            reasonId: row.tvdReasonId,
            reasonCode: names?.reason_code ?? null,
            reasonName: names?.reason_name ?? null,
            note: row.tvdNote,
            postedOn: row.tvdPostedOn?.toISOString() ?? null,
            minutesAfterPost: row.tvdMinutesAfterPost,
            wasPrinted: row.tvdWasPrinted,
            printCount: row.tvdPrintCount,
            lastPrintedOn: row.tvdLastPrintedOn?.toISOString() ?? null,
            printFailed: row.tvdPrintFailed,
            sessionVoidNo: row.tvdSessionVoidNo,
            approvalId: row.tvdApprovalId,
            reversalVoucherId: row.tvdReversalVoucherId,
        };
    }
    async response(tx, bill, row, extra = {}) {
        let reversalVoucherRefno = extra.reversalVoucherRefno ?? null;
        if (!reversalVoucherRefno && row.tvdReversalVoucherId) {
            const [r] = await tx.$queryRaw `
        SELECT avh_voucher_refno AS refno FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${row.tvdReversalVoucherId}::uuid
           AND avh_acc_year = ${row.tvdReversalAccYear}::char(9)`;
            reversalVoucherRefno = r?.refno ?? null;
        }
        return {
            sbId: bill.sbId,
            sbCompanyId: bill.sbCompanyId,
            sbBranchId: bill.sbBranchId,
            sbAccYear: bill.sbAccYear,
            sbBillRefno: bill.sbBillRefno,
            sbStatus: bill_api_types_1.BILL_STATUS_CANCELLED,
            voidedOn: row.tvdVoidedOn.toISOString(),
            reversalVoucherRefno,
            void: await this.voidPayload(tx, row),
        };
    }
};
exports.BillVoidService = BillVoidService;
exports.BillVoidService = BillVoidService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bill_service_1.BillService,
        bill_lifecycle_service_1.BillLifecycleService,
        sales_context_service_1.SalesContextService,
        request_context_service_1.RequestContextService,
        till_session_service_1.TillSessionService,
        till_approval_service_1.TillApprovalService,
        till_event_service_1.TillEventService])
], BillVoidService);
function minutesBetween(from, to) {
    if (!from) {
        return 0;
    }
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}
//# sourceMappingURL=bill-void.service.js.map