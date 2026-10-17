import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { throwTill, throwTillBadRequest, throwTillNotFound } from '../till-errors';
import { isoDateOf } from '../till-dates';
import {
  REVIEW_REF_OUTCOMES,
  TillErrorCode,
  TillEventCode,
  TillReviewOutcome,
} from '../types/till-enum';
import type {
  TillReviewCreatePayload,
  TillReviewListPayload,
  TillReviewPayload,
} from '../types/till-api.types';
import { TillEventService } from './till-event.service';

export interface TillReviewInput {
  companyId: string;
  branchId: string;
  accYear: string;
  dayId: string | null;
  sessionId: string | null;
  outcome: TillReviewOutcome;
  note: string | null;
  refVoucherId: string | null;
  refVoucherAccYear: string | null;
}

export interface TillReviewListInput {
  companyId: string;
  branchId: string;
  dayId: string | null;
  sessionId: string | null;
}

type ReviewRow = {
  tsr_id: string;
  tsr_acc_year: string;
  tsr_day_id: string | null;
  tsr_session_id: string | null;
  session_no: string | null;
  business_date: Date | null;
  tsr_outcome: string;
  tsr_note: string | null;
  tsr_reviewed_by: string;
  reviewed_by_name: string | null;
  tsr_reviewed_on: Date;
  tsr_ref_voucher_id: string | null;
  tsr_ref_voucher_acc_year: string | null;
  ref_voucher_no: string | null;
  is_current: boolean;
};

/**
 * Notes 134 — head office's review of a business day or a till session
 * (accounts.till_session_review, share file 47 §9). Append-only: a review is
 * never edited; a later one of the same day / session supersedes it, and the
 * newest is `current`. Each review is journalled HO_REVIEW with its outcome.
 */
@Injectable()
export class TillReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly events: TillEventService,
  ) {}

  async create(input: TillReviewInput): Promise<TillReviewCreatePayload> {
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
        code: TillEventCode.HO_REVIEW,
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

    const [review] = (
      await this.read({
        companyId: input.companyId,
        branchId: input.branchId,
        dayId: null,
        sessionId: null,
        tsrId,
      })
    ).reviews;
    return { review, supersedes };
  }

  /** The branch's reviews, newest first — of one day or one session when named. */
  async list(input: TillReviewListInput): Promise<TillReviewListPayload> {
    return this.read({ ...input, tsrId: null });
  }

  private async read(
    filter: TillReviewListInput & { tsrId: string | null },
  ): Promise<TillReviewListPayload> {
    const rows = await this.prisma.$queryRaw<ReviewRow[]>`
      WITH r AS (
        SELECT v.*,
               row_number() OVER (PARTITION BY v.tsr_acc_year, v.tsr_session_id,
                                               CASE WHEN v.tsr_session_id IS NULL THEN v.tsr_day_id END
                                  ORDER BY v.tsr_reviewed_on DESC, v.tsr_created_on DESC) = 1 AS is_current
          FROM accounts.till_session_review v
         WHERE v.tsr_company_id = ${filter.companyId}::uuid
           AND v.tsr_branch_id  = ${filter.branchId}::uuid
           ${filter.dayId ? Prisma.sql`AND v.tsr_day_id = ${filter.dayId}::uuid` : Prisma.empty}
           ${filter.sessionId ? Prisma.sql`AND v.tsr_session_id = ${filter.sessionId}::uuid` : Prisma.empty}
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
       ${filter.tsrId ? Prisma.sql`WHERE r.tsr_id = ${filter.tsrId}::uuid` : Prisma.empty}
       ORDER BY r.tsr_reviewed_on DESC, r.tsr_created_on DESC`;
    return { reviews: rows.map(toPayload) };
  }

  /** The day or session reviewed — this company's and this branch's, in that year, else 404. */
  private async target(
    tx: Prisma.TransactionClient,
    input: TillReviewInput,
  ): Promise<{ dayId: string; counterId: string | null; refno: string }> {
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
        throwTillNotFound(
          TillErrorCode.SESSION_NOT_FOUND,
          'Till session',
          'sessionId',
          input.sessionId,
        );
      }
      return {
        dayId: session.tssDayId,
        counterId: session.tssCounterId,
        refno: session.tssSessionNo,
      };
    }
    const day = await tx.tillBusinessDay.findFirst({
      where: {
        tbdId: input.dayId!,
        tbdAccYear: input.accYear,
        tbdCompanyId: input.companyId,
        tbdBranchId: input.branchId,
      },
      select: { tbdId: true, tbdBusinessDate: true },
    });
    if (!day) {
      throwTillNotFound(TillErrorCode.DAY_NOT_FOUND, 'Business day', 'dayId', input.dayId!);
    }
    return { dayId: day.tbdId, counterId: null, refno: isoDateOf(day.tbdBusinessDate) };
  }

  /** The journal named must be a posted voucher of this company. */
  private async assertRefVoucher(
    tx: Prisma.TransactionClient,
    input: TillReviewInput,
  ): Promise<void> {
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
      throwTillNotFound(
        TillErrorCode.REVIEW_REF_NOT_FOUND,
        'Voucher',
        'refVoucherId',
        input.refVoucherId,
      );
    }
    if (voucher.avhVoucherStatus !== 'POSTED') {
      throwTill(
        TillErrorCode.REVIEW_REF_NOT_POSTED,
        `Voucher ${voucher.avhVoucherRefno ?? input.refVoucherId} is ${voucher.avhVoucherStatus}: a review names a posted journal`,
        'refVoucherId',
        { status: voucher.avhVoucherStatus },
      );
    }
  }
}

/** The 400s the DTO cannot express: one target, a note unless OK, a journal only where one is raised. */
function assertShape(input: TillReviewInput): void {
  if (!input.dayId === !input.sessionId) {
    throwTillBadRequest(
      TillErrorCode.REVIEW_TARGET,
      'Name the day or the session reviewed — exactly one of dayId / sessionId',
      input.dayId ? 'sessionId' : 'dayId',
    );
  }
  if (input.outcome !== TillReviewOutcome.OK && !input.note) {
    throwTillBadRequest(
      TillErrorCode.NOTE_REQUIRED,
      `A note is required for a review of ${input.outcome}`,
      'note',
    );
  }
  if (!input.refVoucherId !== !input.refVoucherAccYear) {
    throwTillBadRequest(
      TillErrorCode.REVIEW_REF_PAIR,
      'refVoucherId and refVoucherAccYear go together',
      input.refVoucherId ? 'refVoucherAccYear' : 'refVoucherId',
    );
  }
  if (input.refVoucherId && !REVIEW_REF_OUTCOMES.includes(input.outcome)) {
    throwTillBadRequest(
      TillErrorCode.REVIEW_REF_NOT_ALLOWED,
      `A ${input.outcome} review raises no journal: only ${REVIEW_REF_OUTCOMES.join(' / ')} name one`,
      'refVoucherId',
    );
  }
}

function toPayload(row: ReviewRow): TillReviewPayload {
  return {
    tsrId: row.tsr_id,
    tsrAccYear: row.tsr_acc_year,
    dayId: row.tsr_day_id,
    sessionId: row.tsr_session_id,
    sessionNo: row.session_no,
    businessDate: row.business_date ? isoDateOf(row.business_date) : null,
    outcome: row.tsr_outcome as TillReviewOutcome,
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
