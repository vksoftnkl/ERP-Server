import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { throwTill } from '../till-errors';
import { TillErrorCode, TillEventCode, TillSessionStatus } from '../types/till-enum';
import type { TillSlipCheckPayload, TillSlipCheckResultPayload } from '../types/till-api.types';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';

const num = (d: Prisma.Decimal | number | null | undefined): number =>
  d === null || d === undefined ? 0 : Number(new Prisma.Decimal(d).toFixed(2));

/** The statuses a slip check is made in: the drawer has been (or is being) counted. */
const CHECKABLE: readonly string[] = [
  TillSessionStatus.COUNTING,
  TillSessionStatus.PENDING_APPROVAL,
  TillSessionStatus.CLOSED,
];

/**
 * Non-cash plan §4.2 — the slip check, only on a mismatch: the tender rows
 * behind one terminal's expectation, for the approver to tick against the
 * paper slips. The ticks are a screen aid and are NOT stored; what is stored
 * is a SLIP_CHECK event with the counts and the exceptions (the rows with no
 * slip, the slips with no row, the amounts that differ). Fixes are re-tenders,
 * their own rows; whatever they cannot explain is the NONCASH_VARIANCE the
 * approver decides (phase 3).
 */
@Injectable()
export class TillSlipCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly ledger: TillLedgerService,
    private readonly events: TillEventService,
  ) {}

  async rows(key: SlipCheckKey): Promise<TillSlipCheckPayload> {
    const session = await this.session(key);
    const expectations = await this.ledger.expected(this.prisma, {
      tssId: session.tssId,
      tssAccYear: session.tssAccYear,
      tssCompanyId: session.tssCompanyId,
      tssBranchId: session.tssBranchId,
      tssFloatCounted: session.tssFloatCounted ?? new Prisma.Decimal(0),
      tssClosedOn: session.tssClosedOn,
    });
    const e = expectations.find((x) => x.tenderId === key.tenderId);
    // The latest count of the drawer (a recount included — slips are checked
    // before the final attempt too): this terminal's batch total, slips, batch no.
    const [batch] = await this.prisma.$queryRaw<
      { amount: Prisma.Decimal | null; qty: Prisma.Decimal | null; batch_ref: string | null }[]
    >`
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
    const rows = await this.prisma.$queryRaw<
      {
        td_id: string;
        td_acc_year: string;
        td_created_on: Date;
        td_src_doc_type: string;
        td_src_doc_id: string;
        refno: string | null;
        dr_cr: string;
        td_total_amt: Prisma.Decimal;
        td_auth_code: string | null;
        td_card_last4: string | null;
        td_ref_no: string | null;
      }[]
    >`
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
    const counted =
      batch?.amount === null || batch?.amount === undefined
        ? null
        : new Prisma.Decimal(batch.amount);
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
        drCr: r.dr_cr as 'DR' | 'CR',
        amount: num(r.td_total_amt),
        authCode: r.td_auth_code,
        cardLast4: r.td_card_last4,
        refNo: r.td_ref_no,
      })),
    };
  }

  /** The approver's verdict, as counts and exceptions — a SLIP_CHECK event; the ticks themselves are not kept. */
  async record(input: SlipCheckRecord): Promise<TillSlipCheckResultPayload> {
    const session = await this.session(input);
    const known = new Set((await this.rows(input)).rows.map((r) => r.tdId));
    const strangers = [...input.noSlip, ...input.amountDiffers].filter((id) => !known.has(id));
    if (strangers.length > 0) {
      throwTill(
        TillErrorCode.COUNT_INVALID,
        `${strangers.length} row(s) named are not this terminal's rows in this session`,
        'noSlip',
      );
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
        code: TillEventCode.SLIP_CHECK,
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

  private async session(key: SlipCheckKey) {
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
      throwTill(
        TillErrorCode.SESSION_NOT_FOUND,
        `Till session ${key.tssId} was not found`,
        'tssId',
      );
    }
    if (!CHECKABLE.includes(session.tssStatus)) {
      throwTill(
        TillErrorCode.NOT_COUNTED,
        `Session ${session.tssSessionNo} is ${session.tssStatus}: slips are checked once billing has ended`,
        'tssId',
      );
    }
    return session;
  }
}

export interface SlipCheckKey {
  companyId: string;
  branchId: string;
  accYear: string;
  tssId: string;
  tenderId: string;
}

export interface SlipCheckRecord extends SlipCheckKey {
  ticked: number;
  noSlip: string[];
  amountDiffers: string[];
  slipsWithoutRow: { amount: number; authCode?: string | null; cardLast4?: string | null }[];
  notes?: string | null;
}
