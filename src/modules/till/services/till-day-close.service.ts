import { Injectable } from '@nestjs/common';
import { Prisma, type TillBusinessDay } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService, type TillCaller } from '../till-context.service';
import { isoDateOf } from '../till-dates';
import { throwTill, throwTillNotFound, tillErrorCodeOf } from '../till-errors';
import { TillApprovalService, type TillApprovalRuleRow } from './till-approval.service';
import { TillDayService } from './till-day.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TillSafeService } from './till-safe.service';
import { TillSessionService } from './till-session.service';
import {
  CLOSE_EXCEPTION_CODES,
  LIVE_SESSION_STATUSES,
  TillCloseCheckCode,
  TillCloseCheckTone,
  TillDayStatus,
  TillErrorCode,
  TillEventCode,
  TillMovementKind,
  TillReceiptStatus,
  TillSessionStatus,
  TillVarianceTreatment,
} from '../types/till-enum';
import type {
  TillCloseCheckItem,
  TillCountLineInput,
  TillDayCloseCheckPayload,
  TillDayClosePayload,
  TillDayReopenPayload,
} from '../types/till-api.types';

type Tx = Prisma.TransactionClient;
type Client = Tx | PrismaService;
const ZERO = new Prisma.Decimal(0);

export interface DayKey {
  companyId: string;
  branchId: string;
  accYear: string;
  tbdId: string;
}

/** One live session's drawer, counted by the supervisor closing the day over it. */
export interface DayCloseCount {
  tssId: string;
  lines: TillCountLineInput[];
  floatLeft?: number | null;
}

export interface DayCloseInput extends DayKey {
  notes?: string | null;
  exception?: {
    reasonId: string;
    /** Who approves the exception: never the caller unless the rule allows self; left out = the caller. */
    approverId?: string | null;
    approverPin?: string | null;
    counts?: DayCloseCount[];
  } | null;
}

/** The sessions of a day, as the checklist reads them. */
interface DaySession {
  tss_id: string;
  tss_session_no: string;
  tss_status: string;
}

/**
 * Notes 117 — the store's day close (TILL_DESIGN §13 phase 4): the checklist
 * the server enforces, the close itself (frozen totals, the store Z), and the
 * reopen. Business Day (274): VIEW the check, EDIT close / reopen.
 *
 * The close is one transaction; CLOSING stays in ck_tbd_status for a later
 * two-step close and is never written here. A day may be closed over RED items
 * only of CLOSE_EXCEPTION_CODES (a cashier who left), with a
 * DAY_CLOSE_EXCEPTION approval by someone other than the caller (unless the
 * rule allows self), and every live session is force-closed by it on the
 * supervisor's count of its drawer.
 */
@Injectable()
export class TillDayCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly approval: TillApprovalService,
    private readonly events: TillEventService,
    private readonly days: TillDayService,
    private readonly sessions: TillSessionService,
    private readonly ledger: TillLedgerService,
    private readonly safes: TillSafeService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  The checklist
  // ═════════════════════════════════════════════════════════════════════════

  async closeCheck(key: DayKey): Promise<TillDayCloseCheckPayload> {
    const day = await this.loadDay(this.prisma, key);
    const items = await this.check(this.prisma, day);
    return {
      tbdId: day.tbdId,
      tbdAccYear: day.tbdAccYear,
      tbdBusinessDate: isoDateOf(day.tbdBusinessDate),
      tbdStatus: day.tbdStatus as TillDayStatus,
      items,
      ...verdictOf(day, items),
    };
  }

  /**
   * Every code, GREEN when clear. RED: a session still live or waiting for
   * its variance decision, a hand-over / drop of the day awaiting receipt
   * (notes 113/114), a drawer gap of a CLOSED session still PENDING (one sent
   * on by approve-cash), a movement or variance without its voucher. AMBER: a
   * slip gap (notes 99 §1 — reported, not enforced), the branch's parked bills,
   * a safe over its insured limit. Notes 118: a safe gap of the day still
   * PENDING is VARIANCE_UNDECIDED too; a safe that held or moved cash with no
   * count of the day is SAFE_NOT_COUNTED — RED under till.day_close_safe_count
   * (an exception may cover it: "Safe counted next morning"), else AMBER.
   */
  private async check(client: Client, day: TillBusinessDay): Promise<TillCloseCheckItem[]> {
    const sessions = await client.$queryRaw<DaySession[]>`
      SELECT tss_id::text, tss_session_no, tss_status
        FROM accounts.till_session
       WHERE tss_day_id = ${day.tbdId}::uuid AND tss_acc_year = ${day.tbdAccYear}::char(9)
         AND tss_is_deleted = false AND tss_status <> ${TillSessionStatus.VOIDED}
       ORDER BY tss_opened_on`;
    const byStatus = (statuses: readonly string[]) =>
      sessions.filter((x) => statuses.includes(x.tss_status));
    const closedIds = byStatus([TillSessionStatus.CLOSED]).map((x) => x.tss_id);
    const noOf = new Map(sessions.map((x) => [x.tss_id, x.tss_session_no]));
    const named = (ids: string[]) => [...new Set(ids)].map((id) => noOf.get(id) ?? id).join(', ');

    const live = byStatus(LIVE_SESSION_STATUSES);
    const pending = byStatus([TillSessionStatus.PENDING_APPROVAL]);

    const awaiting = await client.$queryRaw<{ session: string; n: number }[]>`
      SELECT tcm_session_id::text AS session, count(*)::int AS n
        FROM accounts.till_cash_movement
       WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
         AND tcm_is_deleted = false AND tcm_status = 'POSTED'
         AND tcm_receipt_status = ${TillReceiptStatus.AWAITING}
       GROUP BY tcm_session_id`;

    // A PENDING drawer gap of a CLOSED session (a live / PENDING_APPROVAL one
    // is reported above); a slip gap (tvr_slip_count set) is the AMBER kind.
    const gaps = await client.$queryRaw<{ session: string; slip: boolean; n: number }[]>`
      SELECT tvr_session_id::text AS session, (tvr_slip_count IS NOT NULL) AS slip, count(*)::int AS n
        FROM accounts.till_variance
       WHERE tvr_session_id = ANY(${closedIds}::uuid[]) AND tvr_acc_year = ${day.tbdAccYear}::char(9)
         AND tvr_is_deleted = false AND tvr_status = 'OPEN'
         AND tvr_treatment = ${TillVarianceTreatment.PENDING}
       GROUP BY 1, 2`;
    const drawerGaps = gaps.filter((g) => !g.slip);
    const slipGaps = gaps.filter((g) => g.slip);

    // Should be impossible: every movement but an EXCHANGE posts a voucher,
    // and a CLOSED session's decided variances posted at its close.
    const unposted = await client.$queryRaw<{ session: string; n: number }[]>`
      SELECT session, sum(n)::int AS n FROM (
        SELECT tcm_session_id::text AS session, count(*)::int AS n
          FROM accounts.till_cash_movement
         WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_status = 'POSTED'
           AND tcm_kind <> ${TillMovementKind.EXCHANGE} AND tcm_voucher_id IS NULL
         GROUP BY 1
        UNION ALL
        SELECT tvr_session_id::text, count(*)::int
          FROM accounts.till_variance
         WHERE tvr_session_id = ANY(${closedIds}::uuid[]) AND tvr_acc_year = ${day.tbdAccYear}::char(9)
           AND tvr_is_deleted = false AND tvr_status = 'OPEN'
           AND tvr_treatment NOT IN (${TillVarianceTreatment.PENDING}, ${TillVarianceTreatment.RETENDERED})
         GROUP BY 1) x
       GROUP BY session`;

    const [held] = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.txn_hold
       WHERE txh_company_id = ${day.tbdCompanyId}::uuid AND txh_branch_id = ${day.tbdBranchId}::uuid
         AND txh_is_deleted = false AND txh_kind = 'HOLD' AND txh_status IN ('HELD', 'LOCKED')`;

    const overInsured = await this.safesOverInsured(client, day);
    const settings = await this.context.settings({
      companyId: day.tbdCompanyId,
      branchId: day.tbdBranchId,
    });
    const uncounted = await this.safes.uncountedSafes(client, day);
    const safeGaps = await this.safes.pendingGapsOfDay(client, day);

    const sum = (rows: { n: number }[]) => rows.reduce((t, r) => t + r.n, 0);
    const item = (
      code: TillCloseCheckCode,
      tone: TillCloseCheckTone,
      count: number,
      detail: string,
      sessionIds: string[] = [],
    ): TillCloseCheckItem => ({
      code,
      tone: count > 0 ? tone : TillCloseCheckTone.GREEN,
      count,
      detail,
      sessionIds: count > 0 ? [...new Set(sessionIds)] : [],
    });
    const sessionsOf = (rows: { session: string }[]) => rows.map((r) => r.session);
    const unpostedIds = sessionsOf(unposted);
    return [
      item(
        TillCloseCheckCode.SESSIONS_LIVE,
        TillCloseCheckTone.RED,
        live.length,
        live.length > 0
          ? `${live.length} session(s) still open or being counted: ${named(live.map((x) => x.tss_id))}`
          : 'No session is still open',
        live.map((x) => x.tss_id),
      ),
      item(
        TillCloseCheckCode.SESSIONS_PENDING_APPROVAL,
        TillCloseCheckTone.RED,
        pending.length,
        pending.length > 0
          ? `${pending.length} session(s) wait for a variance decision: ${named(pending.map((x) => x.tss_id))}`
          : 'No session waits for a variance decision',
        pending.map((x) => x.tss_id),
      ),
      item(
        TillCloseCheckCode.CASH_TO_APPROVE,
        TillCloseCheckTone.RED,
        sum(awaiting),
        awaiting.length > 0
          ? `${sum(awaiting)} hand-over(s) / drop(s) not yet approved into the safe: ${named(sessionsOf(awaiting))}`
          : 'All cash handed over has been approved into the safe',
        sessionsOf(awaiting),
      ),
      item(
        TillCloseCheckCode.VARIANCE_UNDECIDED,
        TillCloseCheckTone.RED,
        sum(drawerGaps) + safeGaps,
        [
          drawerGaps.length > 0
            ? `${sum(drawerGaps)} cash difference(s) of closed sessions still wait for a decision: ${named(sessionsOf(drawerGaps))}`
            : null,
          safeGaps > 0
            ? `${safeGaps} safe difference(s) of the day still wait for a decision (Cash Office)`
            : null,
        ]
          .filter((x): x is string => x !== null)
          .join('; ') || 'Every cash difference is decided',
        sessionsOf(drawerGaps),
      ),
      item(
        TillCloseCheckCode.MOVEMENTS_UNPOSTED,
        TillCloseCheckTone.RED,
        sum(unposted),
        unposted.length > 0
          ? `${sum(unposted)} movement(s) / variance(s) of the day have no voucher: ${named(unpostedIds)}`
          : 'Every movement and variance is posted',
        unpostedIds,
      ),
      item(
        TillCloseCheckCode.SLIP_GAPS,
        TillCloseCheckTone.AMBER,
        sum(slipGaps),
        slipGaps.length > 0
          ? `${sum(slipGaps)} card / UPI slip gap(s) still open (reported, not enforced): ${named(sessionsOf(slipGaps))}`
          : 'No slip gap is open',
        sessionsOf(slipGaps),
      ),
      item(
        TillCloseCheckCode.HELD_BILLS,
        TillCloseCheckTone.AMBER,
        held?.n ?? 0,
        (held?.n ?? 0) > 0
          ? `${held.n} held bill(s) still parked at this branch`
          : 'No held bill is parked',
      ),
      item(
        TillCloseCheckCode.SAFE_OVER_INSURED,
        TillCloseCheckTone.AMBER,
        overInsured.length,
        overInsured.length > 0
          ? overInsured
              .map(
                (x) =>
                  `${x.name} holds ${x.balance.toFixed(2)} over its insured ${x.limit.toFixed(2)}`,
              )
              .join('; ')
          : 'No safe is over its insured limit',
      ),
      item(
        TillCloseCheckCode.SAFE_NOT_COUNTED,
        settings.daySafeCount ? TillCloseCheckTone.RED : TillCloseCheckTone.AMBER,
        uncounted.length,
        uncounted.length > 0
          ? `Not counted today: ${uncounted.map((x) => x.name).join(', ')}${settings.daySafeCount ? '' : ' (till.day_close_safe_count is off)'}`
          : 'Every safe holding cash has been counted',
      ),
    ];
  }

  /**
   * The branch's safes holding more than tsf_insured_limit (0 = no limit),
   * their ledger's balance up to the business date as the Ledger Statement
   * reads it (reports/common: opening set + POSTED / CANCELLED legs).
   */
  private async safesOverInsured(
    client: Client,
    day: TillBusinessDay,
  ): Promise<{ name: string; balance: Prisma.Decimal; limit: Prisma.Decimal }[]> {
    const safes = await client.tillSafe.findMany({
      where: {
        tsfCompanyId: day.tbdCompanyId,
        tsfBranchId: day.tbdBranchId,
        tsfIsDeleted: false,
        tsfIsActive: true,
        tsfInsuredLimit: { gt: 0 },
      },
      select: { tsfName: true, tsfLedgerId: true, tsfInsuredLimit: true },
    });
    if (safes.length === 0) {
      return [];
    }
    const balanceOf = await this.ledger.ledgerBalances(
      client,
      {
        companyId: day.tbdCompanyId,
        branchId: day.tbdBranchId,
        accYear: day.tbdAccYear,
        upTo: isoDateOf(day.tbdBusinessDate),
      },
      safes.map((x) => x.tsfLedgerId),
    );
    return safes
      .map((x) => ({
        name: x.tsfName,
        balance: balanceOf.get(x.tsfLedgerId) ?? ZERO,
        limit: new Prisma.Decimal(x.tsfInsuredLimit ?? 0),
      }))
      .filter((x) => x.balance.greaterThan(x.limit));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Close
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Notes 117 §2. The checklist recomputed: any RED → 409
   * TILL_DAY_CLOSE_BLOCKED with the items, unless `exception` is given and
   * every RED is of CLOSE_EXCEPTION_CODES. The exception: a DAY_CLOSE reason,
   * the DAY_CLOSE_EXCEPTION rule with the caller as the requester and
   * `approverId` (left out = the caller) as the approver — someone else types
   * their PIN at this desk — and one supervisor's count per live session,
   * which is force-closed (reason "Day close") with its hand-over received on
   * that count. Then, in the one transaction, the checklist again (a forced
   * count out of tolerance leaves its session PENDING_APPROVAL: everything
   * rolls back), the frozen totals, CLOSED and the store Z — the branch's next,
   * or the one a reopened day had. DAY_CLOSE is journalled.
   */
  async close(input: DayCloseInput): Promise<TillDayClosePayload> {
    const caller = await this.context.caller();
    const peek = await this.loadDay(this.prisma, input);
    this.assertClosable(peek);
    const reds = redsOf(await this.check(this.prisma, peek));
    const exception = input.exception ?? null;
    if (reds.length > 0 && !exception) {
      blocked(reds, 'The day has items still open: settle them, or close with an exception');
    }

    // ── the exception, judged before anything is written ─────────────────
    let approved: {
      rule: TillApprovalRuleRow;
      verdict: Awaited<ReturnType<TillApprovalService['assertApprover']>>;
      approverId: string;
      reasonId: string;
      forceReasonId: string;
      counts: Map<string, DayCloseCount>;
    } | null = null;
    if (exception && reds.length > 0) {
      const uncovered = reds.filter((r) => !CLOSE_EXCEPTION_CODES.includes(r.code));
      if (uncovered.length > 0) {
        blocked(
          uncovered,
          `An exception closes a day only over ${CLOSE_EXCEPTION_CODES.join(', ')}: these need their own decision first`,
        );
      }
      const counts = await this.liveCounts(peek, exception.counts ?? []);
      const reason = await this.sessions.exceptionReason(this.prisma, {
        companyId: input.companyId,
        category: 'DAY_CLOSE',
        reasonId: exception.reasonId,
        notes: input.notes ?? null,
      });
      const forceReason = await this.shippedReason('FORCE_CLOSE', 'DAY_CLOSE', input.companyId);
      const approverId = exception.approverId ?? caller.userId;
      const { rule, verdict } = await this.dayApprover(peek, caller, {
        event: 'DAY_CLOSE_EXCEPTION',
        approverId,
        requesterId: caller.userId,
        pin: exception.approverPin ?? null,
      });
      approved = {
        rule,
        verdict,
        approverId,
        reasonId: reason.trsId,
        forceReasonId: forceReason,
        counts,
      };
    }

    const done = await this.prisma.$transaction(
      async (tx) => {
        const day = await this.lockDay(tx, input);
        this.assertClosable(day);
        const now = new Date();
        let tapId: string | null = null;
        const forceClosed: TillDayClosePayload['forceClosed'] = [];
        let closedOver: TillCloseCheckItem[] = [];

        if (approved) {
          closedOver = redsOf(await this.check(tx, day));
          tapId = await this.approval.record(tx, {
            companyId: day.tbdCompanyId,
            branchId: day.tbdBranchId,
            tenantId: day.tbdTenantId,
            accYear: day.tbdAccYear,
            event: 'DAY_CLOSE_EXCEPTION',
            sessionId: null,
            counterId: null,
            srcDocType: 'TILL_DAY',
            srcDocId: day.tbdId,
            srcRefno: isoDateOf(day.tbdBusinessDate),
            amount: ZERO,
            rule: approved.rule,
            verdict: approved.verdict,
            requestedBy: caller.userId,
            requestedOn: now,
            reasonId: approved.reasonId,
            status: 'APPROVED',
            decidedBy: approved.approverId,
            decidedOn: now,
            decidedDeviceId: caller.deviceId,
            decisionNote: input.notes?.trim() || 'Day closed over an exception',
            payload: { items: closedOver.map((r) => ({ code: r.code, count: r.count })) },
          });
          for (const [tssId, count] of approved.counts) {
            const session = await this.sessions.lockForForce(tx, {
              companyId: day.tbdCompanyId,
              branchId: day.tbdBranchId,
              accYear: day.tbdAccYear,
              tssId,
            });
            const forced = await this.sessions.forceCloseIn(tx, session, caller, {
              reasonId: approved.forceReasonId,
              approvalId: tapId,
              lines: count.lines,
              floatLeft: count.floatLeft ?? null,
              notes: input.notes ?? null,
              receiveHandOver: true,
            });
            if (forced.outcome !== 'CLOSED') {
              blocked(
                [],
                `Session ${session.tssSessionNo}'s count is out of tolerance and waits for a variance decision: force-close it from the Cockpit and decide it, then close the day`,
                { tssId },
              );
            }
            forceClosed.push({
              tssId,
              tssAccYear: session.tssAccYear,
              sessionNo: session.tssSessionNo,
            });
          }
        }

        // ── the checklist again, inside the transaction ──────────────────
        const left = redsOf(await this.check(tx, day)).filter(
          (r) => !(approved && CLOSE_EXCEPTION_CODES.includes(r.code)),
        );
        if (left.length > 0) {
          blocked(left, 'The day changed while it was being closed: check it again');
        }

        // ── frozen totals, the store Z, CLOSED ───────────────────────────
        const [t] = await tx.$queryRaw<
          {
            sessions: number;
            bills: number;
            net: Prisma.Decimal;
            cash_expected: Prisma.Decimal;
            cash_counted: Prisma.Decimal;
            noncash_variance: Prisma.Decimal;
          }[]
        >`
          SELECT count(*)::int AS sessions,
                 COALESCE(sum(tss_bill_count), 0)::int AS bills,
                 COALESCE(sum(tss_net_sales), 0) AS net,
                 COALESCE(sum(tss_cash_expected), 0) AS cash_expected,
                 COALESCE(sum(tss_cash_counted), 0) AS cash_counted,
                 COALESCE(sum(tss_noncash_counted - tss_noncash_expected), 0) AS noncash_variance
            FROM accounts.till_session
           WHERE tss_day_id = ${day.tbdId}::uuid AND tss_acc_year = ${day.tbdAccYear}::char(9)
             AND tss_is_deleted = false AND tss_status = ${TillSessionStatus.CLOSED}`;
        // Notes 118: the day's safe figures, frozen with the rest.
        await this.safes.refreshDay(tx, day.tbdId, day.tbdAccYear);
        const zNo = day.tbdZNo ?? (await this.nextZ(tx, day));
        await tx.tillBusinessDay.update({
          where: { tbdId_tbdAccYear: { tbdId: day.tbdId, tbdAccYear: day.tbdAccYear } },
          data: {
            tbdStatus: TillDayStatus.CLOSED,
            tbdClosingOn: now,
            tbdClosedOn: now,
            tbdClosedBy: caller.userId,
            tbdZNo: zNo,
            tbdSessionCount: t.sessions,
            tbdBillCount: t.bills,
            tbdNetSales: t.net,
            tbdCashExpected: t.cash_expected,
            tbdCashCounted: t.cash_counted,
            tbdNoncashVariance: t.noncash_variance,
            tbdExceptionCount: closedOver.reduce((n, r) => n + r.count, 0),
            tbdCloseApprovalId: tapId,
            tbdNotes: input.notes?.trim() || day.tbdNotes,
            tbdModifiedOn: now,
            tbdModifiedBy: caller.actorName,
          },
        });
        await this.events.log(tx, {
          companyId: day.tbdCompanyId,
          branchId: day.tbdBranchId,
          accYear: day.tbdAccYear,
          code: TillEventCode.DAY_CLOSE,
          dayId: day.tbdId,
          deviceId: caller.deviceId,
          userId: caller.userId,
          srcRefno: isoDateOf(day.tbdBusinessDate),
          reasonId: approved?.reasonId ?? null,
          approvalId: tapId,
          payload: {
            zNo,
            reopenCount: day.tbdReopenCount,
            sessions: t.sessions,
            netSales: new Prisma.Decimal(t.net).toFixed(2),
            cashVariance: new Prisma.Decimal(t.cash_counted).minus(t.cash_expected).toFixed(2),
            ...(approved
              ? {
                  exception: {
                    items: closedOver.map((r) => ({ code: r.code, count: r.count })),
                    approverId: approved.approverId,
                    forceClosed: forceClosed.map((x) => x.sessionNo),
                  },
                }
              : {}),
          },
        });
        return { zNo, tapId, closedOver, forceClosed };
      },
      { timeout: 60_000 },
    );
    return { day: await this.days.get(input), ...done };
  }

  /**
   * The day close's counts for its live sessions: one per live session, none
   * for anything else; a live session whose drops still wait for a receipt is
   * refused — they are approved on the closed session (approve-cash), which
   * is the Cockpit's force close first, then the day.
   */
  private async liveCounts(
    day: TillBusinessDay,
    counts: DayCloseCount[],
  ): Promise<Map<string, DayCloseCount>> {
    const live = await this.prisma.tillSession.findMany({
      where: {
        tssDayId: day.tbdId,
        tssAccYear: day.tbdAccYear,
        tssIsDeleted: false,
        tssStatus: { in: [...LIVE_SESSION_STATUSES] },
      },
      select: { tssId: true, tssSessionNo: true },
    });
    const byId = new Map(counts.map((c) => [c.tssId, c]));
    const missing = live.filter((x) => !byId.has(x.tssId));
    if (missing.length > 0) {
      throwTill(
        TillErrorCode.FORCE_COUNT_REQUIRED,
        `Closing the day over a live session force-closes it on your count of its drawer: count ${missing.map((x) => x.tssSessionNo).join(', ')}`,
        'exception.counts',
        { sessionIds: missing.map((x) => x.tssId) },
      );
    }
    const stray = counts.filter((c) => !live.some((x) => x.tssId === c.tssId));
    if (stray.length > 0) {
      throwTill(
        TillErrorCode.COUNT_INVALID,
        'A count names a session that is not live on this day',
        'exception.counts',
        { sessionIds: stray.map((c) => c.tssId) },
      );
    }
    const drops = await this.prisma.tillCashMovement.findMany({
      where: {
        tcmSessionId: { in: live.map((x) => x.tssId) },
        tcmAccYear: day.tbdAccYear,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmReceiptStatus: TillReceiptStatus.AWAITING,
      },
      select: { tcmSessionId: true, tcmDocNo: true },
    });
    if (drops.length > 0) {
      const noOf = new Map(live.map((x) => [x.tssId, x.tssSessionNo]));
      throwTill(
        TillErrorCode.DAY_CLOSE_BLOCKED,
        `${[...new Set(drops.map((d) => noOf.get(d.tcmSessionId!)))].join(', ')} made drops still awaiting approval (${drops.map((d) => d.tcmDocNo).join(', ')}): force-close it from the Cockpit and approve its cash, then close the day`,
        'exception.counts',
        { items: [] },
      );
    }
    return new Map(live.map((x) => [x.tssId, byId.get(x.tssId)!]));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Reopen
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Notes 117 §3 — a CLOSED day back to OPEN: the DAY_REOPEN rule (AREA_MANAGER)
   * with the caller as the approver and the day's closer as the requester, a
   * DAY_REOPEN reason. Refused while a later business day of the branch is
   * CLOSED (the safe's day chain). The frozen totals are cleared, the store Z
   * kept (a re-close reuses it; the print says REOPENED ×n).
   */
  async reopen(
    key: DayKey & { reasonId: string; approverPin?: string | null; notes?: string | null },
  ): Promise<TillDayReopenPayload> {
    const caller = await this.context.caller();
    const peek = await this.loadDay(this.prisma, key);
    await this.assertReopenable(this.prisma, peek);
    const reason = await this.sessions.exceptionReason(this.prisma, {
      companyId: key.companyId,
      category: 'DAY_REOPEN',
      reasonId: key.reasonId,
      notes: key.notes ?? null,
    });
    const { rule, verdict } = await this.dayApprover(peek, caller, {
      event: 'DAY_REOPEN',
      approverId: caller.userId,
      requesterId: peek.tbdClosedBy ?? caller.userId,
      pin: key.approverPin ?? null,
    });

    const tapId = await this.prisma.$transaction(async (tx) => {
      const day = await this.lockDay(tx, key);
      await this.assertReopenable(tx, day);
      const now = new Date();
      const id = await this.approval.record(tx, {
        companyId: day.tbdCompanyId,
        branchId: day.tbdBranchId,
        tenantId: day.tbdTenantId,
        accYear: day.tbdAccYear,
        event: 'DAY_REOPEN',
        sessionId: null,
        counterId: null,
        srcDocType: 'TILL_DAY',
        srcDocId: day.tbdId,
        srcRefno: isoDateOf(day.tbdBusinessDate),
        amount: ZERO,
        rule,
        verdict,
        requestedBy: day.tbdClosedBy ?? caller.userId,
        requestedOn: now,
        reasonId: reason.trsId,
        status: 'APPROVED',
        decidedBy: caller.userId,
        decidedOn: now,
        decidedDeviceId: caller.deviceId,
        decisionNote: key.notes?.trim() || reason.trsName,
        payload: { zNo: day.tbdZNo, reopenCount: day.tbdReopenCount + 1 },
      });
      await tx.tillBusinessDay.update({
        where: { tbdId_tbdAccYear: { tbdId: day.tbdId, tbdAccYear: day.tbdAccYear } },
        data: {
          tbdStatus: TillDayStatus.OPEN,
          tbdClosingOn: null,
          tbdClosedOn: null,
          tbdClosedBy: null,
          tbdReopenCount: { increment: 1 },
          tbdSessionCount: 0,
          tbdBillCount: 0,
          tbdNetSales: ZERO,
          tbdCashExpected: ZERO,
          tbdCashCounted: ZERO,
          tbdNoncashVariance: ZERO,
          tbdExceptionCount: 0,
          tbdCloseApprovalId: null,
          tbdModifiedOn: now,
          tbdModifiedBy: caller.actorName,
        },
      });
      await this.events.log(tx, {
        companyId: day.tbdCompanyId,
        branchId: day.tbdBranchId,
        accYear: day.tbdAccYear,
        code: TillEventCode.DAY_REOPEN,
        dayId: day.tbdId,
        deviceId: caller.deviceId,
        userId: caller.userId,
        srcRefno: isoDateOf(day.tbdBusinessDate),
        reasonId: reason.trsId,
        approvalId: id,
        payload: {
          zNo: day.tbdZNo,
          reopenCount: day.tbdReopenCount + 1,
          closedBy: day.tbdClosedBy,
          closedOn: day.tbdClosedOn?.toISOString() ?? null,
          notes: key.notes?.trim() || null,
        },
      });
      return id;
    });
    return { day: await this.days.get(key), tapId };
  }

  private async assertReopenable(client: Client, day: TillBusinessDay): Promise<void> {
    if ((day.tbdStatus as TillDayStatus) !== TillDayStatus.CLOSED) {
      throwTill(
        TillErrorCode.DAY_NOT_CLOSED,
        `Business day ${isoDateOf(day.tbdBusinessDate)} is ${day.tbdStatus}: only a CLOSED day is reopened`,
        'tbdId',
        { status: day.tbdStatus },
      );
    }
    const later = await client.tillBusinessDay.findFirst({
      where: {
        tbdCompanyId: day.tbdCompanyId,
        tbdBranchId: day.tbdBranchId,
        tbdIsDeleted: false,
        tbdStatus: TillDayStatus.CLOSED,
        tbdBusinessDate: { gt: day.tbdBusinessDate },
      },
      select: { tbdBusinessDate: true },
      orderBy: { tbdBusinessDate: 'asc' },
    });
    if (later) {
      throwTill(
        TillErrorCode.DAY_LATER_CLOSED,
        `Business day ${isoDateOf(later.tbdBusinessDate)} is already closed: ${isoDateOf(day.tbdBusinessDate)} cannot be reopened under it`,
        'tbdId',
        { laterDate: isoDateOf(later.tbdBusinessDate) },
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════

  private async loadDay(client: Client, key: DayKey): Promise<TillBusinessDay> {
    const day = await client.tillBusinessDay.findFirst({
      where: {
        tbdId: key.tbdId,
        tbdAccYear: key.accYear,
        tbdCompanyId: key.companyId,
        tbdBranchId: key.branchId,
        tbdIsDeleted: false,
      },
    });
    if (!day) {
      throwTillNotFound('Business day', 'tbdId', key.tbdId);
    }
    return day;
  }

  private async lockDay(tx: Tx, key: DayKey): Promise<TillBusinessDay> {
    await tx.$queryRaw`
      SELECT tbd_id FROM accounts.till_business_day
       WHERE tbd_id = ${key.tbdId}::uuid AND tbd_acc_year = ${key.accYear}::char(9)
         AND tbd_company_id = ${key.companyId}::uuid AND tbd_branch_id = ${key.branchId}::uuid
         AND tbd_is_deleted = false
         FOR UPDATE`;
    return this.loadDay(tx, key);
  }

  private assertClosable(day: TillBusinessDay): void {
    if ((day.tbdStatus as TillDayStatus) === TillDayStatus.CLOSED) {
      throwTill(
        TillErrorCode.DAY_CLOSED,
        `Business day ${isoDateOf(day.tbdBusinessDate)} is already closed (Z ${day.tbdZNo ?? '-'})`,
        'tbdId',
        { zNo: day.tbdZNo },
      );
    }
  }

  /**
   * The branch's next store Z: one series per branch across the years,
   * serialised by an advisory lock (taken as a column, never in a CTE — PG
   * does not run an unreferenced CTE).
   */
  private async nextZ(tx: Tx, day: TillBusinessDay): Promise<number> {
    await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext(${`till-day-z:${day.tbdBranchId}`})))::int AS n`;
    const [row] = await tx.$queryRaw<{ z: number }[]>`
      SELECT COALESCE(max(tbd_z_no), 0)::int + 1 AS z FROM accounts.till_business_day
       WHERE tbd_company_id = ${day.tbdCompanyId}::uuid AND tbd_branch_id = ${day.tbdBranchId}::uuid`;
    return row.z;
  }

  /** A shipped (or the company's) reason by code — the day close's own FORCE_CLOSE "Day close". */
  private async shippedReason(category: string, code: string, companyId: string): Promise<string> {
    const reason = await this.prisma.tillReason.findFirst({
      where: {
        trsCategory: category,
        trsCode: code,
        trsIsDeleted: false,
        trsIsActive: true,
        OR: [{ trsCompanyId: companyId }, { trsCompanyId: null }],
      },
      orderBy: { trsCompanyId: { sort: 'asc', nulls: 'last' } },
      select: { trsId: true },
    });
    if (!reason) {
      throwTill(
        TillErrorCode.REASON_INVALID,
        `The ${category} reason ${code} is missing (Till Reasons, menu 281)`,
        'reasonId',
      );
    }
    return reason.trsId;
  }

  /**
   * A day-level approver: assertApprover under the event's rule. When the
   * approver is not the caller, their PIN is typed here, so the channel is
   * COUNTER whatever the rule says (remote authority is the approver acting
   * from their own login). A wrong PIN is journalled PIN_FAIL on the day.
   */
  private async dayApprover(
    day: TillBusinessDay,
    caller: TillCaller,
    ask: { event: string; approverId: string; requesterId: string; pin: string | null },
  ) {
    const rule = await this.approval.ruleOrDefault(this.prisma, {
      companyId: day.tbdCompanyId,
      branchId: day.tbdBranchId,
      event: ask.event,
      onDate: isoDateOf(day.tbdBusinessDate),
    });
    const judged = ask.approverId === caller.userId ? rule : { ...rule, tar_channel: 'COUNTER' };
    try {
      const verdict = await this.approval.assertApprover(this.prisma, {
        companyId: day.tbdCompanyId,
        branchId: day.tbdBranchId,
        event: ask.event,
        amount: ZERO,
        rule: judged,
        approverId: ask.approverId,
        requesterId: ask.requesterId,
        pin: ask.pin,
      });
      return { rule, verdict };
    } catch (error: unknown) {
      if (ask.pin?.trim() && tillErrorCodeOf(error) === TillErrorCode.APPROVER_PIN) {
        await this.events.log(this.prisma, {
          companyId: day.tbdCompanyId,
          branchId: day.tbdBranchId,
          accYear: day.tbdAccYear,
          code: TillEventCode.PIN_FAIL,
          dayId: day.tbdId,
          deviceId: caller.deviceId,
          userId: caller.userId,
          srcRefno: isoDateOf(day.tbdBusinessDate),
          payload: { action: ask.event.toLowerCase(), approverId: ask.approverId },
        });
      }
      throw error;
    }
  }
}

/** The RED items that block. */
function redsOf(items: TillCloseCheckItem[]): TillCloseCheckItem[] {
  return items.filter((i) => i.tone === TillCloseCheckTone.RED);
}

function verdictOf(
  day: TillBusinessDay,
  items: TillCloseCheckItem[],
): { canClose: boolean; canCloseWithException: boolean } {
  const open = (day.tbdStatus as TillDayStatus) !== TillDayStatus.CLOSED;
  const reds = redsOf(items);
  return {
    canClose: open && reds.length === 0,
    canCloseWithException:
      open && reds.length > 0 && reds.every((r) => CLOSE_EXCEPTION_CODES.includes(r.code)),
  };
}

/** 409 TILL_DAY_CLOSE_BLOCKED carrying the items. */
function blocked(
  items: TillCloseCheckItem[],
  message: string,
  extra: Record<string, unknown> = {},
): never {
  throwTill(TillErrorCode.DAY_CLOSE_BLOCKED, message, 'tbdId', { ...extra, items });
}
