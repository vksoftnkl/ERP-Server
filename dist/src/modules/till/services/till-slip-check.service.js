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
exports.TillSlipCheckService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_context_service_1 = require("../till-context.service");
const till_errors_1 = require("../till-errors");
const till_enum_1 = require("../types/till-enum");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const num = (d) => d === null || d === undefined ? 0 : Number(new client_1.Prisma.Decimal(d).toFixed(2));
const CHECKABLE = [
    till_enum_1.TillSessionStatus.COUNTING,
    till_enum_1.TillSessionStatus.PENDING_APPROVAL,
    till_enum_1.TillSessionStatus.CLOSED,
];
let TillSlipCheckService = class TillSlipCheckService {
    prisma;
    context;
    ledger;
    events;
    constructor(prisma, context, ledger, events) {
        this.prisma = prisma;
        this.context = context;
        this.ledger = ledger;
        this.events = events;
    }
    async rows(key) {
        const session = await this.session(key);
        const expectations = await this.ledger.expected(this.prisma, {
            tssId: session.tssId,
            tssAccYear: session.tssAccYear,
            tssCompanyId: session.tssCompanyId,
            tssBranchId: session.tssBranchId,
            tssFloatCounted: session.tssFloatCounted ?? new client_1.Prisma.Decimal(0),
            tssClosedOn: session.tssClosedOn,
        });
        const e = expectations.find((x) => x.tenderId === key.tenderId);
        const [batch] = await this.prisma.$queryRaw `
      SELECT sum(l.tcl_amount) AS amount, sum(l.tcl_qty) AS qty, max(l.tcl_batch_ref) AS batch_ref
        FROM accounts.till_count c
        JOIN accounts.till_count_line l ON l.tcl_count_id = c.tct_id AND l.tcl_acc_year = c.tct_acc_year
       WHERE c.tct_session_id = ${session.tssId}::uuid
         AND c.tct_acc_year   = ${session.tssAccYear}::char(9)
         AND c.tct_movement_id IS NULL AND c.tct_is_deleted = false
         AND c.tct_attempt_no = (
               SELECT max(x.tct_attempt_no) FROM accounts.till_count x
                WHERE x.tct_session_id = c.tct_session_id AND x.tct_acc_year = c.tct_acc_year
                  AND x.tct_movement_id IS NULL AND x.tct_is_deleted = false)
         AND l.tcl_tender_id = ${key.tenderId}::uuid`;
        const rows = await this.prisma.$queryRaw `
      SELECT t.td_id::text, t.td_acc_year, t.td_created_on, t.td_src_doc_type, t.td_src_doc_id::text,
             COALESCE(b.sb_bill_refno, h.avh_voucher_refno) AS refno, trim(t.td_dr_cr) AS dr_cr,
             t.td_total_amt, t.td_auth_code, t.td_card_last4, t.td_ref_no
        FROM accounts.acc_tender_detail t
        LEFT JOIN sales.sale_bill b
               ON t.td_src_doc_type = 'SALE_BILL' AND b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
        LEFT JOIN sales.sale_return r
               ON t.td_src_doc_type = 'SALE_RETURN' AND r.sr_id = t.td_src_doc_id AND r.sr_acc_year = t.td_acc_year
        LEFT JOIN accounts.acc_voucher_header h
               ON t.td_voucher_id IS NOT NULL AND h.avh_voucher_id = t.td_voucher_id
       WHERE t.td_session_id = ${session.tssId}::uuid
         AND t.td_acc_year   = ${session.tssAccYear}::char(9)
         AND t.td_tender_id  = ${key.tenderId}::uuid
         AND t.td_is_deleted = false AND t.td_is_voided = false
         AND CASE t.td_src_doc_type
               WHEN 'SALE_BILL'   THEN b.sb_status = 'POSTED'
               WHEN 'SALE_RETURN' THEN r.sr_status = 'POSTED'
               ELSE h.avh_voucher_status = 'POSTED' AND h.avh_is_deleted = false
             END
       ORDER BY t.td_created_on`;
        const expected = e?.expected ?? null;
        const counted = batch?.amount === null || batch?.amount === undefined
            ? null
            : new client_1.Prisma.Decimal(batch.amount);
        return {
            tssId: session.tssId,
            tssSessionNo: session.tssSessionNo,
            tenderId: key.tenderId,
            tenderName: e?.tenderName ?? null,
            expected: expected === null ? null : num(expected),
            batchTotal: counted === null ? null : num(counted),
            batchRef: batch?.batch_ref ?? null,
            slipCount: batch?.qty === null || batch?.qty === undefined ? null : Number(batch.qty),
            difference: expected !== null && counted !== null ? num(counted.minus(expected)) : null,
            rows: rows.map((r) => ({
                tdId: r.td_id,
                tdAccYear: r.td_acc_year,
                time: r.td_created_on.toISOString(),
                srcDocType: r.td_src_doc_type,
                srcDocId: r.td_src_doc_id,
                docRefno: r.refno,
                drCr: r.dr_cr,
                amount: num(r.td_total_amt),
                authCode: r.td_auth_code,
                cardLast4: r.td_card_last4,
                refNo: r.td_ref_no,
            })),
        };
    }
    async record(input) {
        const session = await this.session(input);
        const known = new Set((await this.rows(input)).rows.map((r) => r.tdId));
        const strangers = [...input.noSlip, ...input.amountDiffers].filter((id) => !known.has(id));
        if (strangers.length > 0) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.COUNT_INVALID, `${strangers.length} row(s) named are not this terminal's rows in this session`, 'noSlip');
        }
        const caller = await this.context.caller();
        const summary = {
            tenderId: input.tenderId,
            ticked: input.ticked,
            noSlip: input.noSlip.length,
            slipsWithoutRow: input.slipsWithoutRow.length,
            amountDiffers: input.amountDiffers.length,
        };
        await this.prisma.$transaction(async (tx) => {
            await this.events.log(tx, {
                companyId: session.tssCompanyId,
                branchId: session.tssBranchId,
                accYear: session.tssAccYear,
                code: till_enum_1.TillEventCode.SLIP_CHECK,
                sessionId: session.tssId,
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                payload: {
                    ...summary,
                    noSlipRows: input.noSlip,
                    amountDiffersRows: input.amountDiffers,
                    slipsWithoutRowList: input.slipsWithoutRow.map((s) => ({
                        amount: s.amount,
                        authCode: s.authCode ?? null,
                        cardLast4: s.cardLast4 ?? null,
                    })),
                    notes: input.notes ?? null,
                },
            });
        });
        return { tssId: session.tssId, ...summary };
    }
    async session(key) {
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
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, `Till session ${key.tssId} was not found`, 'tssId');
        }
        if (!CHECKABLE.includes(session.tssStatus)) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.NOT_COUNTED, `Session ${session.tssSessionNo} is ${session.tssStatus}: slips are checked once billing has ended`, 'tssId');
        }
        return session;
    }
};
exports.TillSlipCheckService = TillSlipCheckService;
exports.TillSlipCheckService = TillSlipCheckService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_ledger_service_1.TillLedgerService,
        till_event_service_1.TillEventService])
], TillSlipCheckService);
//# sourceMappingURL=till-slip-check.service.js.map