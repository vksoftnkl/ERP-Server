/**
 * till-print.service.ts — the data behind the till's five print purposes (notes 117 §7, notes
 * 135): TILL_SESSION_Z / TILL_SESSION_X (a session), TILL_DAY_Z (the day X while open, the
 * store Z once closed), TILL_MOVEMENT (a slip) and TILL_REMIT (the remittance memo). Called
 * by the print module's providers (print-render/data/providers/till.providers.ts), one method
 * per dataset; it writes nothing (PrintLogService bumps the *_print_count columns). Reads
 * through the same services as the screens — TillSessionService.get, TillDayService.get,
 * TillMovementService.get — so a print never shows what the screen would hide.
 *
 * Datasets and how each is built:
 * - till.session.header / tenders / movements ← session(): the till_session row (404 on
 *   docId) → sessions.get, blind (`asOperator`) when the caller is its cashier → the X read
 *   count (X_REPORT events carrying xNo), the closer's name, the force-close reason; the
 *   header adds voidFigures (REV 2 §3.7), the CASH tender's figures and closeCashTreatment.
 * - till.day.header / sessions / tenders ← day(): the till_business_day row (404) → days.get
 *   → every non-VOIDED session of the day through sessions.get; a CLOSED day prints its frozen
 *   totals and tbd_safe_*, an open one sums the sessions as they stand; dayTenders sums the
 *   sessions' tender rows per tender; the header adds voidFigures and inTransit.
 * - till.movement.header / lines ← movement(doc, 'MOVEMENT'): the row (404; a REMIT is
 *   TILL_PRINT_WRONG_PURPOSE) → movements.get under its rights (assertMovementRight) → the
 *   joined names and numbers (MovementExtras) → signatures() for the gives / receives lines
 *   and KIND_TEXT for the title; the lines are countLines (an EXCHANGE told IN from OUT).
 * - till.remit.header / lines ← movement(doc, 'REMIT'): as above with REMIT_MODE_TEXT, the
 *   bank / confirm figures, and the count lines without a side.
 *
 * Every date is text on the shop's clock: dateText 'DD-MM-YYYY', timeText
 * 'DD-MM-YYYY hh:mm AM' (notes 121 §1); money is a number rounded to 2 dp (round2).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { assertMenuRight, loadRights } from '../../../common/posting/rights';
import { isUuid } from '../till-context.service';
import { throwTillBadRequest, throwTillNotFound } from '../till-errors';
import { isoDateOf } from '../till-dates';
import { TillDayService } from './till-day.service';
import { TillMovementService } from './till-movement.service';
import { TillSessionService } from './till-session.service';
import {
  CASH_TENDER_TYPE_ID,
  TILL_MENU,
  TILL_RIGHT_CODE_PREFIX,
  TillErrorCode,
  TillDayStatus,
  TillEventCode,
  TillMovementKind,
  TillRemitMode,
  TillRemitStatus,
  TillSessionStatus,
  TillVarianceStage,
} from '../types/till-enum';
import type {
  TillDayPayload,
  TillMovementDetailPayload,
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

/** One flat snake_case row as the layout designer binds it (dates already text). */
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
    private readonly movements: TillMovementService,
  ) {}

  // ── session (TILL_SESSION_Z / TILL_SESSION_X) ────────────────────────────

  /**
   * till.session.header (one row): the session's identity, times and names, its count and
   * float figures, the totals, the CASH tender's expected / counted / variance (null for a
   * blind cashier's own live session), the voids, the gap's treatment, the receipt state and
   * print_count; printed_on is now.
   */
  async sessionHeader(doc: TillPrintDoc): Promise<TillPrintRow> {
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
      // Void bill (REV 2 §3.7): the session's voids — the Z prints a VOIDS line
      // under SALES; after-print voids are the ones to look at.
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
      // Notes 121 §2: how the drawer's cash gap was booked; null with no gap
      // (and for a blind cashier's own live session, whose variances are hidden).
      variance_treatment: closeCashTreatment(s),
      receipt_state: s.receiptState,
      cash_awaiting: s.cashAwaiting,
      received_by: s.receivedByName,
      received_on: timeText(s.receivedOn),
      // notes 127 §3: approved into the safe by the session's own cashier
      received_by_self: s.receivedBySelf,
      expected_visible: s.expectedVisible,
      print_count: s.tssPrintCount,
      printed_on: timeText(new Date().toISOString()),
    };
  }

  /** till.session.tenders (many): one row per tender of the session, as tenderRow lays it out. */
  async sessionTenders(doc: TillPrintDoc): Promise<TillPrintRow[]> {
    const { session } = await this.session(doc);
    return session.tenders.map(tenderRow);
  }

  /** till.session.movements (many): the session's movements as sessions/get lists them. */
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

  /**
   * till.day.header (one row): a CLOSED day prints its frozen totals (day.totals, tbd_safe_*),
   * an open day — the day X — sums its sessions as they stand; cash_expected_counted (notes
   * 121 §3) is the counted sessions' expected only, the voids are read live, the safe lines
   * follow notes 118 / 121 / 124 §3, and safe_in_transit is the branch's CIT remittances now.
   */
  async dayHeader(doc: TillPrintDoc): Promise<TillPrintRow> {
    const { day, sessions, closedBy, openedBy } = await this.day(doc);
    const closed = day.tbdStatus === TillDayStatus.CLOSED;
    // An open day (the day X) has frozen nothing yet: its figures are the
    // sessions' as they stand.
    const sum = (pick: (s: TillSessionPayload) => number | null) =>
      round2(sessions.reduce((t, s) => t + (pick(s) ?? 0), 0));
    const cashOf = (s: TillSessionPayload) => s.tenders.find((t) => t.tenderTypeId === 1) ?? null;
    const voids = await this.voidFigures(
      sessions.map((s) => s.tssId),
      doc.accYear,
    );
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
      // Void bill (REV 2 §3.7): the day's voids, over its sessions (never frozen:
      // a void row is stamped once, so the read is the same before and after close).
      void_count: voids.voidCount,
      void_amount: voids.voidAmount,
      void_printed_count: voids.voidPrintedCount,
      line_void_count: voids.lineVoidCount,
      line_void_value: voids.lineVoidValue,
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
      // carries them; the opening is the safes' book as of the day before
      // (notes 122 §6), shown once the day close has frozen it.
      safe_opening: closed ? day.safe.opening : null,
      safe_expected: day.safe.expected,
      safe_counted: day.safe.counted,
      safe_difference:
        day.safe.counted === null ? null : round2(day.safe.counted - day.safe.expected),
      safe_remitted: day.safe.remitted,
      safe_in_transit: await this.inTransit(day.tbdCompanyId, day.tbdBranchId),
      // Notes 124 §3: a safe below zero prints as it is, flagged, with the cash
      // handed over and not yet received that explains it (opening: the end of
      // the day before; the other: the end of the day).
      safe_below_zero: day.safe.belowZero,
      safe_awaiting_opening: closed ? day.safe.awaitingOpening : null,
      safe_awaiting: day.safe.awaiting,
      notes: day.tbdNotes,
      print_count: day.tbdPrintCount,
      printed_on: timeText(new Date().toISOString()),
    };
  }

  /** till.day.sessions (many): one row per session of the day with its cash figures. */
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
        received_by: s.receivedByName,
        received_by_self: s.receivedBySelf,
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

  // ── movement (TILL_MOVEMENT, notes 135 §1) ────────────────────────────────

  /**
   * till.movement.header (one row, notes 135 §1): the slip of every kind but REMIT — its
   * number, title (KIND_TEXT), status and void, the session / counter / cashier, the safe (and
   * the target safe of a SAFE_TRANSFER), reason, ledger, party, bag / seal, the two signature
   * lines (signatures), the receipt, its voucher number and print_count.
   */
  async movementHeader(doc: TillPrintDoc): Promise<TillPrintRow> {
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
      business_date: dateText(x.business_date ? isoDateOf(x.business_date) : null),
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

  /** till.movement.lines (many): the cash counted with the movement; `side` on an EXCHANGE. */
  async movementLines(doc: TillPrintDoc): Promise<TillPrintRow[]> {
    const { m } = await this.movement(doc, 'MOVEMENT');
    return this.countLines(m);
  }

  // ── remittance (TILL_REMIT, notes 135 §2) ─────────────────────────────────

  /**
   * till.remit.header (one row, notes 135 §2): the memo of a REMIT — mode and its wording,
   * status (VOIDED once voided, else DEPOSITED · IN_TRANSIT · CONFIRMED), safe, bank (name
   * only: account / IFSC / branch are null until a ledger column holds them), amount, bag /
   * seal / agency / slip, who did and approved it, and the confirm figures (bank date / ref /
   * amount, difference = bank_amount − amount, the confirm CRem) — null before remit-confirm.
   */
  async remitHeader(doc: TillPrintDoc): Promise<TillPrintRow> {
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
      // Notes 135 §2 (b): no ledger column holds them yet — the memo leaves a
      // line to write them by hand.
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
      // Nothing is stored: the agency signs on the line the layout leaves.
      handed_to: null,
      bank_date: dateText(m.tcmBankDate),
      bank_ref: m.tcmBankRef,
      bank_amount: m.tcmBankAmount,
      difference: confirmed ? round2(m.tcmBankAmount! - m.tcmAmount) : null,
      confirmed_by: names.confirmedBy,
      confirmed_on: timeText(m.tcmConfirmedOn),
      confirm_voucher_no: x.confirm_voucher_no,
      notes: m.tcmNotes,
      created_on: timeText(m.tcmCreatedOn),
      print_count: x.print_count,
      printed_on: timeText(new Date().toISOString()),
    };
  }

  /** till.remit.lines (many): the REMIT count's cash lines, high to low, with no `side`. */
  async remitLines(doc: TillPrintDoc): Promise<TillPrintRow[]> {
    const { m } = await this.movement(doc, 'REMIT');
    return (await this.countLines(m)).map(({ side: _side, ...line }) => line);
  }

  // ═════════════════════════════════════════════════════════════════════════

  /**
   * One movement as movements/get answers it, plus the names and numbers a
   * slip prints, under movements/get's own rights: your own session's needs
   * Open Till (272) VIEW, another's Till Sessions (273) VIEW, and one with no
   * session (a remittance, a safe transfer) Cash Office (287) or Till
   * Sessions (273) VIEW. A REMIT prints only as TILL_REMIT, the rest only as
   * TILL_MOVEMENT.
   */
  private async movement(doc: TillPrintDoc, purpose: 'MOVEMENT' | 'REMIT') {
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
      throwTillNotFound(TillErrorCode.MOVEMENT_NOT_FOUND, 'Till movement', 'docId', doc.docId);
    }
    const isRemit = row.tcmKind === TillMovementKind.REMIT;
    if (isRemit !== (purpose === 'REMIT')) {
      throwTillBadRequest(
        TillErrorCode.PRINT_WRONG_PURPOSE,
        isRemit
          ? 'A remittance prints as its memo: purpose TILL_REMIT'
          : `A ${row.tcmKind} prints as its slip: purpose TILL_MOVEMENT`,
        'docId',
      );
    }
    const m = await this.movements.get({
      companyId: doc.companyId,
      branchId: row.tcmBranchId,
      accYear: doc.accYear,
      tcmId: doc.docId,
    });
    await this.assertMovementRight(doc.userId, m);

    const [x] = await this.prisma.$queryRaw<MovementExtras[]>`
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

  /**
   * movements/get's rights, judged on the caller printing: their own session's movement needs
   * Open Till (272) VIEW; one with no session passes on Cash Office (287) VIEW; everything
   * else Till Sessions (273) VIEW — 403 TILL_RIGHT_VIEW otherwise (assertMenuRight).
   */
  private async assertMovementRight(userId: string | null, m: TillMovementDetailPayload) {
    const user = isUuid(userId) ? userId : null;
    if (m.sessionOperatorId && m.sessionOperatorId === user) {
      await assertMenuRight(this.prisma, {
        userId: user,
        menuId: TILL_MENU.OPEN_TILL,
        right: 'view',
        codePrefix: TILL_RIGHT_CODE_PREFIX,
        action: 'print your till movements',
      });
      return;
    }
    if (
      !m.tcmSessionId &&
      user &&
      (await loadRights(this.prisma, user, TILL_MENU.CASH_OFFICE)).view
    ) {
      return;
    }
    await assertMenuRight(this.prisma, {
      userId: user,
      menuId: TILL_MENU.SESSIONS,
      right: 'view',
      codePrefix: TILL_RIGHT_CODE_PREFIX,
      action: m.tcmSessionId ? 'print till movements' : 'print a remittance or a safe transfer',
    });
  }

  /**
   * The cash counted with the movement (tcm_count_id → till_count_line), high
   * to low. A float issue names the session's OPEN count and a hand-over its
   * CLOSE count (only the cash lines); an EXCHANGE has two counts on the
   * movement — tcm_count_id is what came IN, the other what went OUT. A line
   * keyed as an amount (no denomination) prints with no face value.
   */
  private async countLines(m: TillMovementDetailPayload): Promise<TillPrintRow[]> {
    const lines = await this.prisma.$queryRaw<CountLineRow[]>`
      SELECT CASE WHEN m.tcm_kind = ${TillMovementKind.EXCHANGE}
                  THEN CASE WHEN c.tct_id = m.tcm_count_id THEN 'IN' ELSE 'OUT' END END AS side,
             CASE WHEN l.tcl_denomination_id IS NULL THEN NULL ELSE l.tcl_face_value END AS face_value,
             d.tdn_label AS denomination,
             CASE WHEN l.tcl_denomination_id IS NULL THEN NULL ELSE l.tcl_qty END AS qty,
             l.tcl_amount AS amount
        FROM accounts.till_cash_movement m
        JOIN accounts.till_count c
          ON c.tct_acc_year = m.tcm_acc_year AND c.tct_is_deleted = false
         AND (c.tct_id = m.tcm_count_id
              OR (m.tcm_kind = ${TillMovementKind.EXCHANGE} AND c.tct_movement_id = m.tcm_id))
        JOIN accounts.till_count_line l
          ON l.tcl_count_id = c.tct_id AND l.tcl_acc_year = c.tct_acc_year
        LEFT JOIN accounts.till_denomination d ON d.tdn_id = l.tcl_denomination_id
       WHERE m.tcm_id = ${m.tcmId}::uuid AND m.tcm_acc_year = ${m.tcmAccYear}::char(9)
         AND l.tcl_tender_type_id = ${CASH_TENDER_TYPE_ID}
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

  /**
   * Void bill (REV 2 §3.7): the voids of these sessions — bills voided
   * (accounts.till_void, stamped once) and the lines removed or reduced on the
   * sale bill screen (LINE_VOID events, each carrying the value removed in
   * tev_amount or payload.value). Zero for no sessions.
   */
  private async voidFigures(
    sessionIds: string[],
    accYear: string,
  ): Promise<{
    voidCount: number;
    voidAmount: number;
    voidPrintedCount: number;
    lineVoidCount: number;
    lineVoidValue: number;
  }> {
    if (sessionIds.length === 0) {
      return {
        voidCount: 0,
        voidAmount: 0,
        voidPrintedCount: 0,
        lineVoidCount: 0,
        lineVoidValue: 0,
      };
    }
    const [row] = await this.prisma.$queryRaw<
      {
        void_count: number;
        void_amount: string | null;
        void_printed_count: number;
        line_void_count: number;
        line_void_value: string | null;
      }[]
    >`
      SELECT (SELECT count(*)::int FROM accounts.till_void v
               WHERE v.tvd_session_id = ANY(${sessionIds}::uuid[]) AND v.tvd_acc_year = ${accYear}::char(9)) AS void_count,
             (SELECT COALESCE(sum(v.tvd_amount), 0)::text FROM accounts.till_void v
               WHERE v.tvd_session_id = ANY(${sessionIds}::uuid[]) AND v.tvd_acc_year = ${accYear}::char(9)) AS void_amount,
             (SELECT count(*)::int FROM accounts.till_void v
               WHERE v.tvd_session_id = ANY(${sessionIds}::uuid[]) AND v.tvd_acc_year = ${accYear}::char(9)
                 AND v.tvd_was_printed) AS void_printed_count,
             (SELECT count(*)::int FROM accounts.till_event e
               WHERE e.tev_session_id = ANY(${sessionIds}::uuid[]) AND e.tev_acc_year = ${accYear}::char(9)
                 AND e.tev_event_code = ${TillEventCode.LINE_VOID}) AS line_void_count,
             (SELECT COALESCE(sum(COALESCE(e.tev_amount, (e.tev_payload ->> 'value')::numeric, 0)), 0)::text
                FROM accounts.till_event e
               WHERE e.tev_session_id = ANY(${sessionIds}::uuid[]) AND e.tev_acc_year = ${accYear}::char(9)
                 AND e.tev_event_code = ${TillEventCode.LINE_VOID}) AS line_void_value`;
    return {
      voidCount: row?.void_count ?? 0,
      voidAmount: round2(Number(row?.void_amount ?? 0)),
      voidPrintedCount: row?.void_printed_count ?? 0,
      lineVoidCount: row?.line_void_count ?? 0,
      lineVoidValue: round2(Number(row?.line_void_value ?? 0)),
    };
  }

  /**
   * The session printed: the row (404 TILL_SESSION_NOT_FOUND on docId) → sessions.get as the
   * operator when the caller is its cashier (the blind rule hides the expected figures) →
   * xNo (the server X reads: X_REPORT events carrying xNo; null before one), the closer's
   * name and the force-close reason's.
   */
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
      throwTillNotFound(TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'docId', doc.docId);
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

  /**
   * The day printed: the row (404 TILL_DAY_NOT_FOUND on docId) → days.get → every session of
   * the day but a VOIDED one, through sessions.get in opening order (never blind: the day's
   * print is a manager's) → the opener's and closer's names.
   */
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
      throwTillNotFound(TillErrorCode.DAY_NOT_FOUND, 'Business day', 'docId', doc.docId);
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

  /** A user's display name, else login name; null for no id or an unknown user. */
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

/** One tender of a session as till.session.tenders / till.day.tenders lay it out. */
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

/** Money to 2 dp for a summed figure. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The names, codes and numbers movement() joins onto movements/get for a slip. */
type MovementExtras = {
  business_date: Date | null;
  operator_id: string | null;
  counter_code: string | null;
  counter_name: string | null;
  safe_code: string | null;
  to_safe_code: string | null;
  to_safe_name: string | null;
  ledger_name: string | null;
  voucher_no: string | null;
  confirm_voucher_no: string | null;
  void_reason: string | null;
  approved_by: string | null;
  print_count: number;
};

/** One raw row of countLines (numerics come back untyped from $queryRaw). */
type CountLineRow = {
  side: 'IN' | 'OUT' | null;
  face_value: unknown;
  denomination: string | null;
  qty: unknown;
  amount: unknown;
};

/** The slip's title (notes 135 §1). */
const KIND_TEXT: Readonly<Record<TillMovementKind, string>> = {
  [TillMovementKind.FLOAT_ISSUE]: 'Float issue',
  [TillMovementKind.TOP_UP]: 'Top-up',
  [TillMovementKind.PICKUP]: 'Pickup',
  [TillMovementKind.DROP]: 'Cash drop',
  [TillMovementKind.CLOSE_HANDOVER]: 'Hand-over',
  [TillMovementKind.PAID_IN]: 'Paid in',
  [TillMovementKind.EXCHANGE]: 'Change',
  [TillMovementKind.SAFE_TRANSFER]: 'Safe transfer',
  [TillMovementKind.REMIT]: 'Remittance',
};

/** The memo's mode_text (notes 135 §2). */
const REMIT_MODE_TEXT: Readonly<Record<TillRemitMode, string>> = {
  [TillRemitMode.BANK_DEPOSIT]: 'Deposited at the bank',
  [TillRemitMode.CIT]: 'Handed to the cash collection agency',
};

/**
 * The slip's two signature lines, by name (notes 135 §1). Worked out from the
 * session's cashier rather than from which column holds whom: a pickup /
 * top-up keyed at the counter (notes 110) has the cashier in tcm_done_by,
 * one moved by movements/change — and every row from before notes 110 — the
 * supervisor, so "the other person" is whichever of the two is not the cashier.
 */
function signatures(
  m: TillMovementDetailPayload,
  x: MovementExtras,
  names: {
    cashier: string | null;
    doneBy: string | null;
    witnessBy: string | null;
    receivedBy: string | null;
  },
): { gives: string | null; receives: string | null } {
  const cashierId = x.operator_id ?? m.tcmDoneBy;
  const cashier = x.operator_id ? names.cashier : names.doneBy;
  const other =
    m.tcmDoneBy !== cashierId
      ? names.doneBy
      : m.tcmWitnessBy && m.tcmWitnessBy !== cashierId
        ? names.witnessBy
        : null;
  switch (m.tcmKind) {
    case TillMovementKind.PICKUP:
      return { gives: cashier, receives: other };
    case TillMovementKind.TOP_UP:
    case TillMovementKind.FLOAT_ISSUE:
      return { gives: other, receives: cashier };
    case TillMovementKind.DROP:
    case TillMovementKind.CLOSE_HANDOVER:
      return { gives: cashier, receives: names.receivedBy };
    case TillMovementKind.PAID_IN:
      return { gives: m.tcmPartyName, receives: cashier };
    case TillMovementKind.EXCHANGE:
      return { gives: cashier, receives: other };
    default:
      // SAFE_TRANSFER (no session): who moved it, and whoever signed for the other safe.
      return { gives: names.doneBy, receives: m.tcmWitnessBy ? names.witnessBy : null };
  }
}

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
