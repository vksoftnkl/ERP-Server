import { Injectable } from '@nestjs/common';
import { Prisma, type SaleBill, type TillVoid } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { loadRights } from '../../../common/posting/rights';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import { throwTill, tillErrorCodeOf } from '../../till/till-errors';
import { type TillCaller } from '../../till/till-context.service';
import {
  TillApprovalService,
  type GateAsk,
  type GateVerdict,
} from '../../till/services/till-approval.service';
import { TillEventService } from '../../till/services/till-event.service';
import { TillSessionService } from '../../till/services/till-session.service';
import {
  CASH_TENDER_TYPE_ID,
  TILL_MENU,
  TillErrorCode,
  TillEventCode,
  TillSessionStatus,
} from '../../till/types/till-enum';
import { SalesContextService, type SalesCallContext } from '../posting/sales-context.service';
import { throwSalesRight } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SALES_MENU_ID, isoDate, isoToday } from '../posting/sales-doc.utils';
import { BillService } from './bill.service';
import { BillLifecycleService } from './bill-lifecycle.service';
import type { VoidBillDto } from './dto/bill-lifecycle.dto';
import {
  BILL_STATUS_CANCELLED,
  BILL_STATUS_POSTED,
  type BillErrorDetail,
  type BillErrorResponse,
} from './types/bill-api.types';

/**
 * Void bill (design REV 2, 2026-10-17) — `/bills/void` and `/bills/void-check`.
 *
 * A void is a cancel that is recorded and shown. The accounting is cancel's,
 * unchanged (`BillLifecycleService.cancelIn`: the GST-first gate, the
 * reversal, stock, tenders, loyalty, promotion, register, status CANCELLED,
 * the status log, the audit row). What void adds: a VOID_BILL reason from the
 * list, one `accounts.till_void` row of evidence stamped once and never
 * recomputed — was the bill PRINTED before the void (the control), how many
 * minutes after the post, the session's n-th void — and a BILL_VOID till event,
 * so the session's timeline, its Z, Till Reports and Cash Position see it.
 *
 * A void exists only while the customer could still be at the counter: the
 * bill's till session must still take money (OPEN / SUSPENDED). A bill of a
 * counted or closed session is a sale return (as `assertCancellable` says); a
 * bill with no till session is cancelled, as today.
 *
 * No supervisor is asked by default (REV 2): the VOID_BILL rule ships NEVER.
 * The gate stays in the route — a company that sets the rule to ALWAYS,
 * OVER_AMOUNT or OVER_COUNT (voids in the session) gets the 428 contract of
 * Expense / Payment / Open Till under `till.approval_gate` REFUSE, or a
 * PENDING request in the inbox under WARN.
 */
const VOID_TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const;
const SRC_DOC_TYPE = 'SALE_BILL';
/** The purposes that put a bill in the customer's hand; a godown or delivery slip does not. */
const CUSTOMER_PRINT_PURPOSES = ['SALE_INVOICE', 'SALE_RECEIPT'] as const;
const PRINT_MODES = ['PRINT', 'REPRINT'] as const;
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE: readonly string[] = [TillSessionStatus.OPEN, TillSessionStatus.SUSPENDED];

type Tx = Prisma.TransactionClient;

interface PrintRow {
  on: Date;
  status: string;
  mode: string;
  purpose: string;
  copy_no: number;
}

interface PrintEvidence {
  printed: boolean;
  printCount: number;
  lastPrintedOn: Date | null;
  printFailed: boolean;
  rows: PrintRow[];
}

interface Evidence extends PrintEvidence {
  postedOn: Date | null;
  minutesAfterPost: number;
  cashAmount: Prisma.Decimal;
  /** This void's ordinal in the session (1-based). */
  voidNo: number;
}

interface SessionRow {
  tssId: string;
  tssAccYear: string;
  tssCompanyId: string;
  tssBranchId: string;
  tssSessionNo: string;
  tssStatus: string;
  tssOperatorId: string;
}

/** What `/bills/void-check` answers: which door this bill goes through, and why. */
export type VoidRoute = 'VOID' | 'CANCEL' | 'RETURN' | 'VOIDED' | 'CANCELLED' | 'NOT_POSTED';

@Injectable()
export class BillVoidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillService,
    private readonly lifecycle: BillLifecycleService,
    private readonly salesContext: SalesContextService,
    private readonly requestContext: RequestContextService,
    private readonly till: TillSessionService,
    private readonly approvals: TillApprovalService,
    private readonly events: TillEventService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  POST /bills/void — §3.2
  // ═══════════════════════════════════════════════════════════════════════

  async void(dto: VoidBillDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      // 1 · the bill, locked. A bill already voided answers idempotently.
      const bill = await this.bills.lockHeader(tx, dto);
      const existing = await this.voidRowOf(tx, bill);
      if (existing && bill.sbStatus === BILL_STATUS_CANCELLED) {
        return this.response(tx, bill, existing);
      }
      if (bill.sbStatus !== BILL_STATUS_POSTED) {
        throwTill(
          TillErrorCode.VOID_NOT_POSTED,
          bill.sbStatus === BILL_STATUS_CANCELLED
            ? `Bill ${bill.sbBillRefno ?? bill.sbId} is already cancelled`
            : `Only a POSTED bill can be voided — bill ${bill.sbBillRefno ?? bill.sbId} is ${bill.sbStatus}`,
          'sbId',
          { status: bill.sbStatus },
        );
      }
      const ctx = await this.salesContext.resolve(
        { companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId },
        SALES_MENU_ID.SALE_BILL,
        tx,
      );
      // A void is a cancel: menu 12 Cancel as well.
      if (!ctx.rights.cancel) {
        throwSalesRight('This user may not cancel on this menu', SALES_ERROR_CODES.RIGHT_CANCEL);
      }

      // 2 · the session: still taking money.
      const sessionRow = await this.sessionOf(tx, bill);
      if (!sessionRow) {
        throwTill(
          TillErrorCode.VOID_NO_SESSION,
          `Bill ${bill.sbBillRefno ?? bill.sbId} was not made in a till session: cancel it (/bills/cancel)`,
          'sbId',
        );
      }
      if (!LIVE.includes(sessionRow.tssStatus)) {
        throwTill(
          TillErrorCode.VOID_SESSION_CLOSED,
          `Till session ${sessionRow.tssSessionNo} is ${sessionRow.tssStatus} — the drawer is counted: make a sale return`,
          'sbId',
          { sessionNo: sessionRow.tssSessionNo, status: sessionRow.tssStatus },
        );
      }

      // 3 · who: the session's cashier on its own device, or 273 OVERRIDE.
      const caller = this.callerOf(ctx);
      const supervisor = (await loadRights(tx, ctx.actor, TILL_MENU.SESSIONS)).override;
      const session = await this.lockSession(tx, sessionRow, caller, supervisor);

      // 4 · the reason.
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
        throwTill(
          TillErrorCode.REASON_INVALID,
          'A void names an active VOID_BILL reason',
          'reasonId',
        );
      }
      const note = dto.note?.trim() ? dto.note.trim() : null;
      if (reason.trsNeedsNote && !note) {
        throwTill(TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'note');
      }

      // 5 · the evidence, as it stands now.
      const evidence = await this.evidence(tx, bill, session.tssId, now);

      // 6 · the gate (shipped NEVER: nothing asked).
      const gateAsk: GateAsk = {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        event: 'VOID_BILL',
        onDate: isoDate(bill.sbBillDate) ?? isoToday(),
        amount: new Prisma.Decimal(bill.sbBillAmt),
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
      const gate: GateVerdict = await this.approvals.assessGate(tx, gateAsk);
      if (gate.state === 'REFUSE') {
        this.approvals.throwApprovalRequired(gate.need, gateAsk);
      }

      // 7 · cancel's unwind, the reason's text as the remark.
      const reasonText = note ? `${reason.trsName} — ${note}` : reason.trsName;
      const reversal = await this.lifecycle.cancelIn(tx, bill, ctx, reasonText, now, {
        action: 'void',
      });
      const approvalId = await this.approvals.settleGate(tx, gateAsk, gate);

      // 8 · the evidence row.
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
          tvdAmount: new Prisma.Decimal(bill.sbBillAmt).toDecimalPlaces(2),
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

      // 9 · BILL_VOID in the session's journal.
      await this.events.log(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        accYear: session.tssAccYear,
        code: TillEventCode.BILL_VOID,
        eventOn: now,
        sessionId: session.tssId,
        dayId: session.tssDayId,
        counterId: session.tssCounterId,
        deviceId: caller.deviceId ?? session.tssDeviceId,
        userId: ctx.actor,
        srcDocType: SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcRefno: bill.sbBillRefno,
        amount: new Prisma.Decimal(bill.sbBillAmt).toDecimalPlaces(2),
        reasonId: reason.trsId,
        approvalId,
        payload: {
          sbId: bill.sbId,
          refno: bill.sbBillRefno,
          amount: Number(new Prisma.Decimal(bill.sbBillAmt).toFixed(2)),
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
        } as Prisma.InputJsonValue,
      });

      // 10 · the answer.
      return this.response(tx, { ...bill, sbStatus: BILL_STATUS_CANCELLED }, row, {
        reversalVoucherRefno: reversal.reversalRefno,
      });
    }, VOID_TX_OPTIONS);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET /bills/void-check — what the Void popup shows before the void (§4.1)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Which door this bill goes through and what the popup says: VOID (a live
   * session), RETURN (counted / closed, as assertCancellable would say), CANCEL
   * (no till), VOIDED / CANCELLED / NOT_POSTED. With the print evidence as it
   * stands, the minutes since the post, the void number this would take, and
   * the VOID_BILL reasons the company may pick. Reads only: nothing is stamped
   * until /bills/void.
   */
  async check(keys: {
    sbId: string;
    sbCompanyId: string;
    sbBranchId: string;
    sbAccYear: string;
  }): Promise<Record<string, unknown>> {
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
      // The same 404 /bills/get gives.
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        'Bill not found',
        'sbId',
        `No active bill found with id ${keys.sbId}`,
        SALES_ERROR_CODES.NOT_FOUND,
      );
    }
    const ctx = await this.salesContext.resolve(
      { companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId },
      SALES_MENU_ID.SALE_BILL,
    );
    if (!ctx.rights.view) {
      throwSalesRight('This user may not view on this menu', SALES_ERROR_CODES.RIGHT_VIEW);
    }
    const existing = await this.voidRowOf(this.prisma, bill);
    const session = await this.sessionOf(this.prisma, bill);
    const live = !!session && LIVE.includes(session.tssStatus);
    const route: VoidRoute = existing
      ? 'VOIDED'
      : bill.sbStatus === BILL_STATUS_CANCELLED
        ? 'CANCELLED'
        : bill.sbStatus !== BILL_STATUS_POSTED
          ? 'NOT_POSTED'
          : !session
            ? 'CANCEL'
            : live
              ? 'VOID'
              : 'RETURN';
    const code: string | null =
      route === 'CANCEL'
        ? TillErrorCode.VOID_NO_SESSION
        : route === 'RETURN'
          ? TillErrorCode.VOID_SESSION_CLOSED
          : route === 'NOT_POSTED' || route === 'CANCELLED'
            ? TillErrorCode.VOID_NOT_POSTED
            : null;
    const prints = await this.prints(this.prisma, bill);
    const postedOn = await this.postedOn(this.prisma, bill);
    const supervisor = (await loadRights(this.prisma, ctx.actor, TILL_MENU.SESSIONS)).override;
    const deviceId = this.callerOf(ctx).deviceId;
    const canVoid =
      route === 'VOID' &&
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
      amount: Number(new Prisma.Decimal(bill.sbBillAmt).toFixed(2)),
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

  // ═══════════════════════════════════════════════════════════════════════
  //  The pieces
  // ═══════════════════════════════════════════════════════════════════════

  private callerOf(ctx: SalesCallContext): TillCaller {
    const deviceId = this.requestContext.getDeviceId();
    return {
      userId: ctx.actor,
      actorName: ctx.actorName,
      deviceId: deviceId && UUID_LIKE.test(deviceId) ? deviceId : null,
    };
  }

  /** The till's own lock rules, with the void's wording on a refusal of WHO. */
  private async lockSession(tx: Tx, session: SessionRow, caller: TillCaller, supervisor: boolean) {
    try {
      return await this.till.lockLive(
        tx,
        {
          companyId: session.tssCompanyId,
          branchId: session.tssBranchId,
          accYear: session.tssAccYear,
          tssId: session.tssId,
        },
        caller,
        { supervisor },
      );
    } catch (error) {
      const code = tillErrorCodeOf(error);
      if (code === TillErrorCode.SESSION_NOT_YOURS || code === TillErrorCode.SESSION_WRONG_DEVICE) {
        throwTill(
          TillErrorCode.VOID_NOT_ALLOWED,
          code === TillErrorCode.SESSION_NOT_YOURS
            ? `Till session ${session.tssSessionNo} belongs to another cashier: only its cashier on its device, or a supervisor (Till Sessions OVERRIDE), voids its bills`
            : `Till session ${session.tssSessionNo} is driven from the device it was opened on: void there, or as a supervisor (Till Sessions OVERRIDE)`,
          'sbId',
          { sessionNo: session.tssSessionNo, because: code },
        );
      }
      throw error;
    }
  }

  private async sessionOf(client: Tx | PrismaService, bill: SaleBill): Promise<SessionRow | null> {
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

  private async deviceOf(session: SessionRow): Promise<string | null> {
    const row = await this.prisma.tillSession.findFirst({
      where: { tssId: session.tssId, tssAccYear: session.tssAccYear },
      select: { tssDeviceId: true },
    });
    return row?.tssDeviceId ?? null;
  }

  private voidRowOf(client: Tx | PrismaService, bill: SaleBill): Promise<TillVoid | null> {
    return client.tillVoid.findFirst({
      where: { tvdSrcDocType: SRC_DOC_TYPE, tvdSrcDocId: bill.sbId, tvdAccYear: bill.sbAccYear },
    });
  }

  private async voidCount(client: Tx | PrismaService, sessionId: string, accYear: string) {
    return client.tillVoid.count({ where: { tvdSessionId: sessionId, tvdAccYear: accYear } });
  }

  private async evidence(tx: Tx, bill: SaleBill, sessionId: string, now: Date): Promise<Evidence> {
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

  /**
   * The bill's prints as print_log has them — PRINT / REPRINT of a customer-
   * facing purpose. The Qt client prints through /print-render/preview and a
   * local QPrinter: these rows exist only once it reports the print through
   * /print-render/log (PRINT SUCCESS once the spooler took the job, FAILED on a
   * printer error), as the web client does. Until then every bill reads as
   * never printed — the flag can only say "the operator pressed Print".
   */
  private async prints(client: Tx | PrismaService, bill: SaleBill): Promise<PrintEvidence> {
    const rows = await client.$queryRaw<PrintRow[]>`
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

  /** The POSTED step of the bill's status trail; the bill datetime when the trail has none. */
  private async postedOn(client: Tx | PrismaService, bill: SaleBill): Promise<Date | null> {
    const [row] = await client.$queryRaw<{ on: Date | null }[]>`
      SELECT max(tsl_changed_on) AS "on" FROM public.txn_status_log
       WHERE tsl_src_doc_type = ${SRC_DOC_TYPE}
         AND tsl_src_doc_id = ${bill.sbId}::uuid
         AND tsl_acc_year = ${bill.sbAccYear}::char(9)
         AND tsl_event = 'POSTED'
         AND tsl_is_deleted = false`;
    return row?.on ?? bill.sbBillDatetime ?? null;
  }

  /** The cash part of the bill's live tenders — what left the drawer's expected. */
  private async cashOf(client: Tx | PrismaService, bill: SaleBill): Promise<Prisma.Decimal> {
    const [row] = await client.$queryRaw<{ cash: string | null }[]>`
      SELECT COALESCE(sum(td_amount), 0)::text AS cash FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = ${SRC_DOC_TYPE}
         AND td_src_doc_id = ${bill.sbId}::uuid
         AND td_acc_year = ${bill.sbAccYear}::char(9)
         AND td_tender_type_id = ${CASH_TENDER_TYPE_ID}::int
         AND td_is_deleted = false
         AND td_is_voided = false`;
    return new Prisma.Decimal(row?.cash ?? 0);
  }

  private async voidPayload(
    client: Tx | PrismaService,
    row: TillVoid,
  ): Promise<Record<string, unknown>> {
    const [names] = await client.$queryRaw<
      {
        reason_code: string | null;
        reason_name: string | null;
        voided_by: string | null;
        cashier: string | null;
      }[]
    >`
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
      amount: Number(new Prisma.Decimal(row.tvdAmount).toFixed(2)),
      cashAmount: Number(new Prisma.Decimal(row.tvdCashAmount).toFixed(2)),
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

  private async response(
    tx: Tx,
    bill: SaleBill,
    row: TillVoid,
    extra: { reversalVoucherRefno?: string | null } = {},
  ): Promise<Record<string, unknown>> {
    let reversalVoucherRefno = extra.reversalVoucherRefno ?? null;
    if (!reversalVoucherRefno && row.tvdReversalVoucherId) {
      const [r] = await tx.$queryRaw<{ refno: string | null }[]>`
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
      sbStatus: BILL_STATUS_CANCELLED,
      voidedOn: row.tvdVoidedOn.toISOString(),
      reversalVoucherRefno,
      void: await this.voidPayload(tx, row),
    };
  }
}

function minutesBetween(from: Date | null, to: Date): number {
  if (!from) {
    return 0;
  }
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}
