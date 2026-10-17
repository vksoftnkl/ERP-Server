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
exports.TillReviewService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const till_context_service_1 = require("../till-context.service");
const till_errors_1 = require("../till-errors");
const till_dates_1 = require("../till-dates");
const till_enum_1 = require("../types/till-enum");
const till_event_service_1 = require("./till-event.service");
let TillReviewService = class TillReviewService {
    prisma;
    context;
    events;
    constructor(prisma, context, events) {
        this.prisma = prisma;
        this.context = context;
        this.events = events;
    }
    async create(input) {
        assertShape(input);
        const caller = await this.context.caller();
        const { tsrId, supersedes } = await this.prisma.$transaction(async (tx) => {
            const target = await this.target(tx, input);
            await this.assertRefVoucher(tx, input);
            const previous = await tx.tillSessionReview.findFirst({
                where: input.sessionId
                    ? { tsrSessionId: input.sessionId, tsrAccYear: input.accYear }
                    : { tsrDayId: input.dayId, tsrSessionId: null, tsrAccYear: input.accYear },
                orderBy: [{ tsrReviewedOn: 'desc' }, { tsrCreatedOn: 'desc' }],
                select: { tsrId: true },
            });
            const row = await tx.tillSessionReview.create({
                data: {
                    tsrCompanyId: input.companyId,
                    tsrBranchId: input.branchId,
                    tsrAccYear: input.accYear,
                    tsrDayId: input.dayId,
                    tsrSessionId: input.sessionId,
                    tsrOutcome: input.outcome,
                    tsrReviewedBy: caller.userId,
                    tsrNote: input.note,
                    tsrRefVoucherId: input.refVoucherId,
                    tsrRefVoucherAccYear: input.refVoucherAccYear,
                },
                select: { tsrId: true },
            });
            await this.events.log(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                accYear: input.accYear,
                code: till_enum_1.TillEventCode.HO_REVIEW,
                sessionId: input.sessionId,
                dayId: target.dayId,
                counterId: target.counterId,
                deviceId: caller.deviceId,
                userId: caller.userId,
                srcDocType: 'TILL_REVIEW',
                srcDocId: row.tsrId,
                srcRefno: target.refno,
                payload: {
                    outcome: input.outcome,
                    note: input.note,
                    refVoucherId: input.refVoucherId,
                    refVoucherAccYear: input.refVoucherAccYear,
                    supersedes: previous?.tsrId ?? null,
                },
            });
            return { tsrId: row.tsrId, supersedes: previous?.tsrId ?? null };
        });
        const [review] = (await this.read({
            companyId: input.companyId,
            branchId: input.branchId,
            dayId: null,
            sessionId: null,
            tsrId,
        })).reviews;
        return { review, supersedes };
    }
    async list(input) {
        return this.read({ ...input, tsrId: null });
    }
    async read(filter) {
        const rows = await this.prisma.$queryRaw `
      WITH r AS (
        SELECT v.*,
               row_number() OVER (PARTITION BY v.tsr_acc_year, v.tsr_session_id,
                                               CASE WHEN v.tsr_session_id IS NULL THEN v.tsr_day_id END
                                  ORDER BY v.tsr_reviewed_on DESC, v.tsr_created_on DESC) = 1 AS is_current
          FROM accounts.till_session_review v
         WHERE v.tsr_company_id = ${filter.companyId}::uuid
           AND v.tsr_branch_id  = ${filter.branchId}::uuid
           ${filter.dayId ? client_1.Prisma.sql `AND v.tsr_day_id = ${filter.dayId}::uuid` : client_1.Prisma.empty}
           ${filter.sessionId ? client_1.Prisma.sql `AND v.tsr_session_id = ${filter.sessionId}::uuid` : client_1.Prisma.empty}
      )
      SELECT r.tsr_id::text, r.tsr_acc_year, r.tsr_day_id::text, r.tsr_session_id::text,
             s.tss_session_no AS session_no,
             COALESCE(d.tbd_business_date, s.tss_business_date) AS business_date,
             r.tsr_outcome, r.tsr_note, r.tsr_reviewed_by::text,
             u.usr_login_name AS reviewed_by_name,
             r.tsr_reviewed_on, r.tsr_ref_voucher_id::text, r.tsr_ref_voucher_acc_year,
             h.avh_voucher_refno AS ref_voucher_no, r.is_current
        FROM r
        LEFT JOIN accounts.till_session s
               ON s.tss_id = r.tsr_session_id AND s.tss_acc_year = r.tsr_acc_year
        LEFT JOIN accounts.till_business_day d
               ON d.tbd_id = r.tsr_day_id AND d.tbd_acc_year = r.tsr_acc_year
        LEFT JOIN public.user_master u ON u.usr_id = r.tsr_reviewed_by
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = r.tsr_ref_voucher_id AND h.avh_acc_year = r.tsr_ref_voucher_acc_year
       ${filter.tsrId ? client_1.Prisma.sql `WHERE r.tsr_id = ${filter.tsrId}::uuid` : client_1.Prisma.empty}
       ORDER BY r.tsr_reviewed_on DESC, r.tsr_created_on DESC`;
        return { reviews: rows.map(toPayload) };
    }
    async target(tx, input) {
        if (input.sessionId) {
            const session = await tx.tillSession.findFirst({
                where: {
                    tssId: input.sessionId,
                    tssAccYear: input.accYear,
                    tssCompanyId: input.companyId,
                    tssBranchId: input.branchId,
                },
                select: { tssDayId: true, tssCounterId: true, tssSessionNo: true },
            });
            if (!session) {
                (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'sessionId', input.sessionId);
            }
            return {
                dayId: session.tssDayId,
                counterId: session.tssCounterId,
                refno: session.tssSessionNo,
            };
        }
        const day = await tx.tillBusinessDay.findFirst({
            where: {
                tbdId: input.dayId,
                tbdAccYear: input.accYear,
                tbdCompanyId: input.companyId,
                tbdBranchId: input.branchId,
            },
            select: { tbdId: true, tbdBusinessDate: true },
        });
        if (!day) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.DAY_NOT_FOUND, 'Business day', 'dayId', input.dayId);
        }
        return { dayId: day.tbdId, counterId: null, refno: (0, till_dates_1.isoDateOf)(day.tbdBusinessDate) };
    }
    async assertRefVoucher(tx, input) {
        if (!input.refVoucherId || !input.refVoucherAccYear) {
            return;
        }
        const voucher = await tx.accVoucherHeader.findFirst({
            where: {
                avhVoucherId: input.refVoucherId,
                avhAccYear: input.refVoucherAccYear,
                avhCompanyId: input.companyId,
                avhIsDeleted: false,
            },
            select: { avhVoucherStatus: true, avhVoucherRefno: true },
        });
        if (!voucher) {
            (0, till_errors_1.throwTillNotFound)(till_enum_1.TillErrorCode.REVIEW_REF_NOT_FOUND, 'Voucher', 'refVoucherId', input.refVoucherId);
        }
        if (voucher.avhVoucherStatus !== 'POSTED') {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.REVIEW_REF_NOT_POSTED, `Voucher ${voucher.avhVoucherRefno ?? input.refVoucherId} is ${voucher.avhVoucherStatus}: a review names a posted journal`, 'refVoucherId', { status: voucher.avhVoucherStatus });
        }
    }
};
exports.TillReviewService = TillReviewService;
exports.TillReviewService = TillReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        till_context_service_1.TillContextService,
        till_event_service_1.TillEventService])
], TillReviewService);
function assertShape(input) {
    if (!input.dayId === !input.sessionId) {
        (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.REVIEW_TARGET, 'Name the day or the session reviewed — exactly one of dayId / sessionId', input.dayId ? 'sessionId' : 'dayId');
    }
    if (input.outcome !== till_enum_1.TillReviewOutcome.OK && !input.note) {
        (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.NOTE_REQUIRED, `A note is required for a review of ${input.outcome}`, 'note');
    }
    if (!input.refVoucherId !== !input.refVoucherAccYear) {
        (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.REVIEW_REF_PAIR, 'refVoucherId and refVoucherAccYear go together', input.refVoucherId ? 'refVoucherAccYear' : 'refVoucherId');
    }
    if (input.refVoucherId && !till_enum_1.REVIEW_REF_OUTCOMES.includes(input.outcome)) {
        (0, till_errors_1.throwTillBadRequest)(till_enum_1.TillErrorCode.REVIEW_REF_NOT_ALLOWED, `A ${input.outcome} review raises no journal: only ${till_enum_1.REVIEW_REF_OUTCOMES.join(' / ')} name one`, 'refVoucherId');
    }
}
function toPayload(row) {
    return {
        tsrId: row.tsr_id,
        tsrAccYear: row.tsr_acc_year,
        dayId: row.tsr_day_id,
        sessionId: row.tsr_session_id,
        sessionNo: row.session_no,
        businessDate: row.business_date ? (0, till_dates_1.isoDateOf)(row.business_date) : null,
        outcome: row.tsr_outcome,
        note: row.tsr_note,
        reviewedBy: row.tsr_reviewed_by,
        reviewedByName: row.reviewed_by_name,
        reviewedOn: row.tsr_reviewed_on.toISOString(),
        refVoucherId: row.tsr_ref_voucher_id,
        refVoucherAccYear: row.tsr_ref_voucher_acc_year,
        refVoucherNo: row.ref_voucher_no,
        current: row.is_current,
    };
}
//# sourceMappingURL=till-review.service.js.map