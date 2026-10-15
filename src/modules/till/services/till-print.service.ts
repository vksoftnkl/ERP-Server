import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { throwTillNotFound } from '../till-errors';
import { TillDayService } from './till-day.service';
import { TillSessionService } from './till-session.service';
import {
  CASH_TENDER_TYPE_ID,
  TillDayStatus,
  TillEventCode,
  TillMovementKind,
  TillRemitStatus,
  TillSessionStatus,
  TillVarianceStage,
} from '../types/till-enum';
import type {
  TillDayPayload,
  TillSessionPayload,
  TillSessionTenderPayload,
} from '../types/till-api.types';

/** The print's document: the render context's company, docId and accYear. */
export interface TillPrintDoc {
  companyId: string;
  docId: string;
  accYear: string;
  /** The caller printing: a live session's cashier sees what /sessions/get shows them (the blind rule). */
  userId: string | null;
}

export type TillPrintRow = Record<string, string | number | boolean | null>;

/**
 * Notes 117 §7 — the data of the till's print documents (TILL_SESSION_Z,
 * TILL_SESSION_X, TILL_DAY_Z), flat snake_case rows as the print providers
 * hand them to the layout (src/modules/settings/print-render/data/providers/
 * till-*.provider.ts). Built from the same payloads as /sessions/get and
 * /days/get, so a print never says what the screen does not: a live blind
 * session printed by its own cashier shows no expected figure (null).
 *
 * Dates go out as text already in the shop's clock (IST): `DD-MM-YYYY` and
 * `DD-MM-YYYY hh:mm AM` (notes 121: AM/PM wherever a person reads a time, as
 * the grids' `HH12:MI AM`) — the designer prints them as they are.
 */
@Injectable()
export class TillPrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: TillSessionService,
    private readonly days: TillDayService,
  ) {}

  // ── session (TILL_SESSION_Z / TILL_SESSION_X) ────────────────────────────

  async sessionHeader(doc: TillPrintDoc): Promise<TillPrintRow> {
    const { session: s, xNo, names } = await this.session(doc);
    const cash = s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
    return {
      session_no: s.tssSessionNo,
      business_date: dateText(s.tssBusinessDate),
      counter_code: s.counterCode,
      counter_name: s.counterName,
      cashier: s.operatorName,
      status: s.tssStatus,
      is_closed: s.tssStatus === TillSessionStatus.CLOSED,
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
      // Notes 121 §2: how the drawer's cash gap was booked; null with no gap
      // (and for a blind cashier's own live session, whose variances are hidden).
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

  async sessionTenders(doc: TillPrintDoc): Promise<TillPrintRow[]> {
    const { session } = await this.session(doc);
    return session.tenders.map(tenderRow);
  }

  async sessionMovements(doc: TillPrintDoc): Promise<TillPrintRow[]> {
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

  // ── day (TILL_DAY_Z) ──────────────────────────────────────────────────────

  async dayHeader(doc: TillPrintDoc): Promise<TillPrintRow> {
    const { day, sessions, closedBy, openedBy } = await this.day(doc);
    const closed = day.tbdStatus === TillDayStatus.CLOSED;
    // An open day (the day X) has frozen nothing yet: its figures are the
    // sessions' as they stand.
    const sum = (pick: (s: TillSessionPayload) => number | null) =>
      round2(sessions.reduce((t, s) => t + (pick(s) ?? 0), 0));
    const cashOf = (s: TillSessionPayload) => s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
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
      live_session_count: sessions.filter((s) => s.tssStatus !== TillSessionStatus.CLOSED).length,
      bill_count: closed ? day.totals.billCount : sum((s) => s.totals.billCount),
      net_sales: closed ? day.totals.netSales : sum((s) => s.totals.netSales),
      cash_expected: closed ? day.totals.cashExpected : sum((s) => cashOf(s)?.expected ?? null),
      // Notes 121 §3: the expected of the counted sessions only — what
      // cash_counted and cash_variance compare against (an open day's live,
      // uncounted till made the day X look short). A closed day froze only
      // counted (CLOSED) sessions, so the two agree there.
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
      // Notes 121 §4 — the safe (notes 118): the day's tbd_safe_* as days/get
      // carries them; the opening is written by the day close.
      safe_opening: closed ? day.safe.opening : null,
      safe_expected: day.safe.expected,
      safe_counted: day.safe.counted,
      safe_difference:
        day.safe.counted === null ? null : round2(day.safe.counted - day.safe.expected),
      safe_remitted: day.safe.remitted,
      safe_in_transit: await this.inTransit(day.tbdCompanyId, day.tbdBranchId),
      notes: day.tbdNotes,
      print_count: day.tbdPrintCount,
      printed_on: timeText(new Date().toISOString()),
    };
  }

  async daySessions(doc: TillPrintDoc): Promise<TillPrintRow[]> {
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

  /** The day's tenders, summed over its sessions (one row per tender). */
  async dayTenders(doc: TillPrintDoc): Promise<TillPrintRow[]> {
    const { sessions } = await this.day(doc);
    const byTender = new Map<string, TillSessionTenderPayload[]>();
    for (const t of sessions.flatMap((s) => s.tenders)) {
      const key = `${t.tenderTypeId}|${t.tenderId ?? ''}`;
      byTender.set(key, [...(byTender.get(key) ?? []), t]);
    }
    return [...byTender.values()].map((rows) => {
      const total = (pick: (t: TillSessionTenderPayload) => number | null) =>
        rows.some((t) => pick(t) !== null)
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

  // ═════════════════════════════════════════════════════════════════════════

  private async session(doc: TillPrintDoc) {
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
      throwTillNotFound('Till session', 'docId', doc.docId);
    }
    const session = await this.sessions.get(
      {
        companyId: doc.companyId,
        branchId: row.tssBranchId,
        accYear: doc.accYear,
        tssId: doc.docId,
      },
      { asOperator: doc.userId === row.tssOperatorId },
    );
    const [x] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${doc.docId}::uuid AND tev_acc_year = ${doc.accYear}::char(9)
         AND tev_event_code = ${TillEventCode.X_REPORT} AND tev_payload ? 'xNo'`;
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

  private async day(doc: TillPrintDoc) {
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
      throwTillNotFound('Business day', 'docId', doc.docId);
    }
    const day: TillDayPayload = await this.days.get({
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
        tssStatus: { not: TillSessionStatus.VOIDED },
      },
      select: { tssId: true },
      orderBy: { tssOpenedOn: 'asc' },
    });
    const sessions: TillSessionPayload[] = [];
    for (const { tssId } of ids) {
      sessions.push(
        await this.sessions.get({
          companyId: doc.companyId,
          branchId: row.tbdBranchId,
          accYear: doc.accYear,
          tssId,
        }),
      );
    }
    return {
      day,
      sessions,
      closedBy: day.tbdClosedByName,
      openedBy: await this.userName(row.tbdOpenedBy),
    };
  }

  /** The branch's CIT remittances still IN_TRANSIT now (notes 118): their amount. */
  private async inTransit(companyId: string, branchId: string): Promise<number> {
    const agg = await this.prisma.tillCashMovement.aggregate({
      where: {
        tcmCompanyId: companyId,
        tcmBranchId: branchId,
        tcmKind: TillMovementKind.REMIT,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmRemitStatus: TillRemitStatus.IN_TRANSIT,
      },
      _sum: { tcmAmount: true },
    });
    return round2(Number(agg._sum.tcmAmount ?? 0));
  }

  private async userName(userId: string | null): Promise<string | null> {
    if (!userId) {
      return null;
    }
    const u = await this.prisma.userMaster.findUnique({
      where: { usrId: userId },
      select: { usrLoginName: true, usrDisplayName: true },
    });
    return u ? u.usrDisplayName?.trim() || u.usrLoginName : null;
  }
}

function tenderRow(t: TillSessionTenderPayload): TillPrintRow {
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

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The treatment of the session's live CLOSE-stage cash variance — EXPENSE ·
 * RECOVER · SUSPENSE · WITHIN_TOLERANCE (or PENDING while undecided); null when
 * the drawer had no gap.
 */
function closeCashTreatment(s: TillSessionPayload): string | null {
  const live = s.variances.filter(
    (v) =>
      v.tvrStage === TillVarianceStage.CLOSE &&
      v.tvrTenderTypeId === CASH_TENDER_TYPE_ID &&
      v.tvrStatus !== 'REVERSED' &&
      v.tvrVariance !== 0,
  );
  return live.length > 0 ? live[live.length - 1].tvrTreatment : null;
}

/** 'YYYY-MM-DD' → 'DD-MM-YYYY'. */
function dateText(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

/**
 * An instant → 'DD-MM-YYYY hh:mm AM' on the shop's clock (IST) — notes 121 §1,
 * the user's AM/PM rule, as the grids' `HH12:MI AM`: 12-hour, zero-padded,
 * 12:05 AM just after midnight and 12:05 PM just after noon.
 */
export function timeText(iso: string | null): string | null {
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
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  const hour = Number(p('hour')) % 24;
  const h12 = String(hour % 12 || 12).padStart(2, '0');
  return `${p('day')}-${p('month')}-${p('year')} ${h12}:${p('minute')} ${hour < 12 ? 'AM' : 'PM'}`;
}
