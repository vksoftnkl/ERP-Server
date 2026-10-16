import { Injectable } from '@nestjs/common';
import { Prisma, type TillBusinessDay } from '@prisma/client';
import { verifySecret } from '../../../common/utils/secret-hash.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { isBankLedger, loadLedgerFacts } from '../../accountsModule/vouchers/voucher-facts';
import { TillContextService, type TillCaller } from '../till-context.service';
import {
  accYearOf,
  assertTillPartitions,
  businessDateNow,
  dateParam,
  isoDateOf,
} from '../till-dates';
import { throwTill, throwTillNotFound, tillErrorCodeOf } from '../till-errors';
import type { TillSettings } from '../till.settings';
import {
  TillApprovalService,
  type ApproverVerdict,
  type TillApprovalRuleRow,
} from './till-approval.service';
import { TillDayService } from './till-day.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService, type SafeRef } from './till-ledger.service';
import { TillMovementService } from './till-movement.service';
import { TillPostingService, type SafeScope } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import {
  CASH_IN_TRANSIT_ROLE,
  CASH_TENDER_TYPE_ID,
  TILL_MENU,
  TillCountKind,
  TillDayStatus,
  TillErrorCode,
  TillEventCode,
  TillMovementKind,
  TillRemitMode,
  TillRemitStatus,
  TillSafeGapOutcome,
  TillVarianceStage,
  TillVarianceTreatment,
  type TillSafeGapTreatment,
} from '../types/till-enum';
import type {
  TillCountLineInput,
  TillRemitConfirmPayload,
  TillRemitPayload,
  TillRemittancePayload,
  TillSafeBalancePayload,
  TillSafeCountPayload,
  TillSafeDecisionPayload,
  TillSafeStatePayload,
} from '../types/till-api.types';

type Tx = Prisma.TransactionClient;
type Client = Tx | PrismaService;
const ZERO = new Prisma.Decimal(0);
const num = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v.toFixed(2)) : 0);

/** The approval rule a safe gap is decided under (47 §1.6). */
const SAFE_VARIANCE = 'SAFE_VARIANCE';
const REMITTANCE = 'REMITTANCE';

/** till_safe as the safe routes read it. */
interface SafeRow {
  tsfId: string;
  tsfCompanyId: string;
  tsfBranchId: string;
  tsfCode: string;
  tsfName: string;
  tsfLedgerId: string;
  tsfInsuredLimit: Prisma.Decimal;
  tsfIsDefault: boolean;
  tsfIsDropSafe: boolean;
  tsfIsActive: boolean;
}

/** What moved through a safe in a window (gross per kind; a void nets its own kind). */
interface SafeFlows {
  handOvers: Prisma.Decimal;
  drops: Prisma.Decimal;
  pickups: Prisma.Decimal;
  transfersIn: Prisma.Decimal;
  receipts: Prisma.Decimal;
  floatIssues: Prisma.Decimal;
  topUps: Prisma.Decimal;
  remittances: Prisma.Decimal;
  transfersOut: Prisma.Decimal;
  payments: Prisma.Decimal;
  exchanges: number;
}

interface LastCount {
  tctId: string;
  tctAccYear: string;
  countedOn: Date;
  countedBy: string;
  witnessBy: string | null;
  counted: Prisma.Decimal;
  expected: Prisma.Decimal | null;
  dayId: string | null;
}

/** One safe's figures now. */
interface SafeState {
  safe: SafeRow;
  lastCount: LastCount | null;
  /** Another active safe of the branch posts to the same ledger: its book is not this safe's alone. */
  ledgerShared: boolean;
  /** ZERO = no count and a shared ledger: the notes' "0 before any count". */
  openingFrom: 'COUNT' | 'BOOK' | 'ZERO';
  opening: Prisma.Decimal;
  flows: SafeFlows;
  inTotal: Prisma.Decimal;
  outTotal: Prisma.Decimal;
  expected: Prisma.Decimal;
  book: Prisma.Decimal;
}

/** The business day a cash-office document books on: today's. */
interface SafeDay {
  tbdId: string;
  accYear: string;
  businessDate: string;
}

/** A decision taken in the same step as the count / the confirm (notes 118 §2). */
interface GapDecision {
  treatment: TillSafeGapTreatment;
  rule: TillApprovalRuleRow;
  verdict: ApproverVerdict;
  reasonId: string;
  /** The difference it was judged on: the transaction refuses if the safe moved meanwhile. */
  judged: Prisma.Decimal;
}

export interface SafeCountInput {
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  safeId: string;
  lines: TillCountLineInput[];
  notes?: string | null;
  witnessId?: string | null;
  witnessPin?: string | null;
  treatment?: TillSafeGapTreatment | null;
  reasonId?: string | null;
  approverPin?: string | null;
}

export interface SafeDecideInput {
  companyId: string;
  branchId: string;
  accYear: string;
  tvrId: string;
  treatment: TillSafeGapTreatment;
  reasonId: string;
  notes?: string | null;
  approverPin?: string | null;
  secondId?: string | null;
  secondPin?: string | null;
}

export interface RemitCreateInput {
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  safeId: string;
  amount: number;
  bankLedgerId: string;
  mode: TillRemitMode;
  bagNo?: string | null;
  sealNo?: string | null;
  citAgency?: string | null;
  slipNo?: string | null;
  slipDate?: string | null;
  lines?: TillCountLineInput[] | null;
  notes?: string | null;
  approverId?: string | null;
  approverPin?: string | null;
}

export interface RemitConfirmCreateInput {
  companyId: string;
  branchId: string;
  accYear: string;
  tcmId: string;
  bankDate: string;
  bankRef: string;
  bankAmount?: number | null;
  treatment?: TillSafeGapTreatment | null;
  reasonId?: string | null;
  notes?: string | null;
  approverPin?: string | null;
  witnessId?: string | null;
  witnessPin?: string | null;
}

/**
 * Notes 118 — the safe (TILL_DESIGN §13 phase 5, S9): its balance, its count,
 * and remittance to the bank. Cash Office (287): VIEW the balance · CREATE a
 * count / a remittance · OVERRIDE decide a safe gap.
 *
 * ── The expected balance ───────────────────────────────────────────────────
 * opening (the last SAFE count; before any, what the safe's ledger holds net
 * of the movements below, so cash held before the till went live is not a gap)
 * + in: hand-overs and drops straight in (receipt NULL) or once RECEIVED (for
 *   what was received, when), pickups, transfers in, back-office cash receipts
 *   posted to its ledger (48 §2.3)
 * − out: float issues, top-ups, remittances, transfers out, back-office cash
 *   payments / expenses from its ledger
 * Exchanges are notes for notes: counted, net zero. Each flow is timed — a
 * movement at its creation and again (the other way) at its void, a received
 * bag at its receipt, a money document at its posting and its cancel — and the
 * window is "after the last count", so a void or a cancel after a count lands
 * after it, as it does in the books. The ledger's own balance (`bookBalance`)
 * sits beside it: any drift between the two shows (a journal on the safe, a gap
 * still undecided).
 *
 * ── A gap ──────────────────────────────────────────────────────────────────
 * Counted − expected, within till.cash_tolerance: posted at once (TVar
 * WITHIN_TOLERANCE against the safe). Beyond it: the SAFE_VARIANCE rule. The
 * user's call (2026-10-15): the one who counts decides it in the same step on
 * their own grant and PIN, and the witness who typed their PIN on the count is
 * the second signature a two-person rule asks for; nobody else's cash is
 * judged, so the rule's no-self flag does not bind. No decision (or no witness
 * on a two-person rule) → PENDING for safes/decide-variance. The rows are
 * till_variance stage SAFE / REMIT with no session (ck_tvr_owner).
 */
@Injectable()
export class TillSafeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly ledger: TillLedgerService,
    private readonly posting: TillPostingService,
    private readonly sessions: TillSessionService,
    private readonly events: TillEventService,
    private readonly approval: TillApprovalService,
    private readonly days: TillDayService,
    private readonly movements: TillMovementService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §1 · the balance
  // ═════════════════════════════════════════════════════════════════════════

  async balance(scope: {
    companyId: string;
    branchId: string;
    safeId?: string | null;
  }): Promise<TillSafeBalancePayload> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const visible = await this.figuresVisible(settings);
    const businessDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const today = { date: businessDate, accYear: accYearOf(businessDate) };

    const safes = await this.prisma.tillSafe.findMany({
      where: {
        tsfCompanyId: scope.companyId,
        tsfBranchId: scope.branchId,
        tsfIsDeleted: false,
        ...(scope.safeId ? { tsfId: scope.safeId } : { tsfIsActive: true }),
      },
      orderBy: [{ tsfIsDefault: 'desc' }, { tsfCode: 'asc' }],
    });
    if (scope.safeId && safes.length === 0) {
      throwTillNotFound(TillErrorCode.SAFE_NOT_FOUND, 'Till safe', 'safeId', scope.safeId);
    }
    const day = await this.prisma.tillBusinessDay.findFirst({
      where: {
        tbdCompanyId: scope.companyId,
        tbdBranchId: scope.branchId,
        tbdAccYear: today.accYear,
        tbdBusinessDate: dateParam(businessDate),
        tbdIsDeleted: false,
      },
      select: { tbdId: true },
    });

    const states = await this.prisma.$transaction(async (tx) => {
      await this.customPlans(tx);
      const out: TillSafeStatePayload[] = [];
      for (const safe of safes) {
        const state = await this.stateOf(tx, safe, today);
        out.push(await this.statePayload(tx, state, visible, day?.tbdId ?? null));
      }
      return out;
    });

    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      businessDate,
      figuresVisible: visible,
      safes: states,
      inTransit: await this.inTransit(this.prisma, scope, businessDate),
    };
  }

  /**
   * A safe's figures now. Book = the ledger's balance today.
   * Before any count the opening is the book less every movement, so the
   * expected balance is the book until the first count — unless another active
   * safe of the branch posts to the same ledger (safes default to the SAFE_CASH
   * role's), when the book is not this safe's alone and the opening is 0.
   */
  private async stateOf(
    client: Client,
    safe: SafeRow,
    today: { date: string; accYear: string },
  ): Promise<SafeState> {
    const last = await client.tillCount.findFirst({
      where: { tctSafeId: safe.tsfId, tctKind: TillCountKind.SAFE, tctIsDeleted: false },
      orderBy: [{ tctCountedOn: 'desc' }, { tctId: 'desc' }],
    });
    const lastCount: LastCount | null = last
      ? {
          tctId: last.tctId,
          tctAccYear: last.tctAccYear,
          countedOn: last.tctCountedOn,
          countedBy: last.tctCountedBy,
          witnessBy: last.tctWitnessBy,
          counted: new Prisma.Decimal(last.tctTotalCounted),
          expected: last.tctExpected === null ? null : new Prisma.Decimal(last.tctExpected),
          dayId: last.tctDayId,
        }
      : null;
    const flows = await this.flowsOf(client, safe, lastCount?.countedOn ?? null);
    const balances = await this.ledger.ledgerBalances(
      client,
      {
        companyId: safe.tsfCompanyId,
        branchId: safe.tsfBranchId,
        accYear: today.accYear,
        upTo: today.date,
      },
      [safe.tsfLedgerId],
    );
    const book = balances.get(safe.tsfLedgerId) ?? ZERO;
    const sharing = await client.tillSafe.count({
      where: {
        tsfCompanyId: safe.tsfCompanyId,
        tsfBranchId: safe.tsfBranchId,
        tsfLedgerId: safe.tsfLedgerId,
        tsfIsActive: true,
        tsfIsDeleted: false,
        tsfId: { not: safe.tsfId },
      },
    });
    const ledgerShared = sharing > 0;
    let opening: Prisma.Decimal;
    if (lastCount) {
      opening = lastCount.counted;
    } else if (ledgerShared) {
      opening = ZERO;
    } else {
      opening = book.minus(netOf(flows));
    }
    const inTotal = inOf(flows);
    const outTotal = outOf(flows);
    return {
      safe,
      lastCount,
      ledgerShared,
      openingFrom: lastCount ? 'COUNT' : ledgerShared ? 'ZERO' : 'BOOK',
      opening,
      flows,
      inTotal,
      outTotal,
      expected: opening.plus(inTotal).minus(outTotal),
      book,
    };
  }

  /** The timed flows of one safe after `after` (all of them when null) — see the class comment. */
  private async flowsOf(
    client: Client,
    safe: { tsfId: string; tsfLedgerId: string },
    after: Date | null,
  ): Promise<SafeFlows> {
    const lower = after ? Prisma.sql`AND f.at > ${after}::timestamptz` : Prisma.empty;
    const [r] = await client.$queryRaw<
      {
        hand_overs: Prisma.Decimal;
        drops: Prisma.Decimal;
        pickups: Prisma.Decimal;
        transfers_in: Prisma.Decimal;
        receipts: Prisma.Decimal;
        float_issues: Prisma.Decimal;
        top_ups: Prisma.Decimal;
        remittances: Prisma.Decimal;
        transfers_out: Prisma.Decimal;
        payments: Prisma.Decimal;
        exchanges: number;
      }[]
    >`
      SELECT COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'CLOSE_HANDOVER'), 0) AS hand_overs,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'DROP'), 0)           AS drops,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'PICKUP'), 0)         AS pickups,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'TRANSFER_IN'), 0)    AS transfers_in,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'MONEY_IN'), 0)       AS receipts,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'FLOAT_ISSUE'), 0)    AS float_issues,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'TOP_UP'), 0)         AS top_ups,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'REMIT'), 0)          AS remittances,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'SAFE_TRANSFER'), 0)  AS transfers_out,
             COALESCE(sum(f.amt) FILTER (WHERE f.cat = 'MONEY_OUT'), 0)      AS payments,
             count(*) FILTER (WHERE f.cat = 'EXCHANGE' AND f.amt > 0)::int   AS exchanges
        FROM (
          -- movements naming the safe, straight in / out: at creation, and back at a void
          SELECT m.tcm_kind::text AS cat, x.at, x.amt
            FROM accounts.till_cash_movement m
           CROSS JOIN LATERAL (VALUES (m.tcm_created_on, m.tcm_amount),
                                      (m.tcm_voided_on, -m.tcm_amount)) AS x(at, amt)
           WHERE m.tcm_safe_id = ${safe.tsfId}::uuid
             AND m.tcm_is_deleted = false
             AND m.tcm_receipt_status IS NULL
             AND m.tcm_kind IN ('CLOSE_HANDOVER', 'DROP', 'PICKUP', 'FLOAT_ISSUE', 'TOP_UP',
                                'REMIT', 'SAFE_TRANSFER', 'EXCHANGE')
             AND x.at IS NOT NULL
          UNION ALL
          -- a hand-over / drop that waited (notes 113): in once received, for what was received
          SELECT m.tcm_kind::text, m.tcm_received_on, m.tcm_received_amount
            FROM accounts.till_cash_movement m
           WHERE m.tcm_safe_id = ${safe.tsfId}::uuid
             AND m.tcm_is_deleted = false
             AND m.tcm_status = 'POSTED'
             AND m.tcm_receipt_status = 'RECEIVED'
          UNION ALL
          SELECT 'TRANSFER_IN', x.at, x.amt
            FROM accounts.till_cash_movement m
           CROSS JOIN LATERAL (VALUES (m.tcm_created_on, m.tcm_amount),
                                      (m.tcm_voided_on, -m.tcm_amount)) AS x(at, amt)
           WHERE m.tcm_to_safe_id = ${safe.tsfId}::uuid
             AND m.tcm_kind = 'SAFE_TRANSFER'
             AND m.tcm_is_deleted = false
             AND x.at IS NOT NULL
          UNION ALL
          -- back-office cash on the safe's ledger (48 §2.3): at posting, and back at a cancel
          SELECT CASE t.td_dr_cr WHEN 'DR' THEN 'MONEY_IN' ELSE 'MONEY_OUT' END, x.at, x.amt
            FROM accounts.acc_tender_detail t
            JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = t.td_voucher_id
           CROSS JOIN LATERAL (VALUES
                 (COALESCE(h.avh_posted_on, h.avh_created_on), t.td_total_amt),
                 (CASE WHEN h.avh_voucher_status = 'CANCELLED' THEN h.avh_status_on END,
                  -t.td_total_amt)) AS x(at, amt)
           WHERE t.td_tender_ledger_id = ${safe.tsfLedgerId}::uuid
             AND t.td_tender_type_id = ${CASH_TENDER_TYPE_ID}::int
             -- notes 126: not the server's labels on the till's own transfers
             -- (TFlt / TDrp / TRcv / CRem) — the movements above count those
             AND t.td_src_doc_type <> 'VOUCHER'
             AND h.avh_is_deleted = false
             AND ((h.avh_voucher_status = 'POSTED' AND t.td_is_deleted = false AND t.td_is_voided = false)
                  OR h.avh_voucher_status = 'CANCELLED')
             AND x.at IS NOT NULL
        ) f
       WHERE true ${lower}`;
    const d = (v: Prisma.Decimal) => new Prisma.Decimal(v ?? 0);
    return {
      handOvers: d(r.hand_overs),
      drops: d(r.drops),
      pickups: d(r.pickups),
      transfersIn: d(r.transfers_in),
      receipts: d(r.receipts),
      floatIssues: d(r.float_issues),
      topUps: d(r.top_ups),
      remittances: d(r.remittances),
      transfersOut: d(r.transfers_out),
      payments: d(r.payments),
      exchanges: r.exchanges ?? 0,
    };
  }

  private async statePayload(
    client: Client,
    state: SafeState,
    visible: boolean,
    todayDayId: string | null,
  ): Promise<TillSafeStatePayload> {
    const { safe, flows, lastCount } = state;
    const show = (v: Prisma.Decimal): number | null => (visible ? num(v) : null);
    const ledger = await client.accLedgerMaster.findUnique({
      where: { ledId: safe.tsfLedgerId },
      select: { ledName: true },
    });
    const counter = lastCount
      ? await client.userMaster.findUnique({
          where: { usrId: lastCount.countedBy },
          select: { usrLoginName: true, usrDisplayName: true },
        })
      : null;
    const [transit] = await client.$queryRaw<{ n: number; amt: Prisma.Decimal | null }[]>`
      SELECT count(*)::int AS n, sum(tcm_amount) AS amt
        FROM accounts.till_cash_movement
       WHERE tcm_safe_id = ${safe.tsfId}::uuid AND tcm_is_deleted = false
         AND tcm_status = 'POSTED' AND tcm_remit_status = ${TillRemitStatus.IN_TRANSIT}`;
    const pending = await client.tillVariance.findMany({
      where: {
        tvrSafeId: safe.tsfId,
        tvrIsDeleted: false,
        tvrStatus: 'OPEN',
        tvrTreatment: TillVarianceTreatment.PENDING,
      },
      select: {
        tvrId: true,
        tvrAccYear: true,
        tvrStage: true,
        tvrVariance: true,
      },
      orderBy: { tvrCreatedOn: 'asc' },
    });
    const limit = new Prisma.Decimal(safe.tsfInsuredLimit ?? 0);
    return {
      safeId: safe.tsfId,
      code: safe.tsfCode,
      name: safe.tsfName,
      ledgerId: safe.tsfLedgerId,
      ledgerName: ledger?.ledName ?? null,
      isDefault: safe.tsfIsDefault,
      isDropSafe: safe.tsfIsDropSafe,
      isActive: safe.tsfIsActive,
      insuredLimit: num(limit),
      overInsured: limit.greaterThan(0) && state.expected.greaterThan(limit),
      ledgerShared: state.ledgerShared,
      openingFrom: state.openingFrom,
      opening: show(state.opening),
      in: visible
        ? {
            handOvers: num(flows.handOvers),
            drops: num(flows.drops),
            pickups: num(flows.pickups),
            transfersIn: num(flows.transfersIn),
            receipts: num(flows.receipts),
            total: num(state.inTotal),
          }
        : null,
      out: visible
        ? {
            floatIssues: num(flows.floatIssues),
            topUps: num(flows.topUps),
            remittances: num(flows.remittances),
            transfersOut: num(flows.transfersOut),
            payments: num(flows.payments),
            total: num(state.outTotal),
          }
        : null,
      exchanges: flows.exchanges,
      expected: show(state.expected),
      bookBalance: show(state.book),
      drift: show(state.book.minus(state.expected)),
      lastCount: lastCount
        ? {
            tctId: lastCount.tctId,
            tctAccYear: lastCount.tctAccYear,
            countedOn: lastCount.countedOn.toISOString(),
            countedBy: lastCount.countedBy,
            countedByName: counter ? counter.usrDisplayName?.trim() || counter.usrLoginName : null,
            witnessBy: lastCount.witnessBy,
            counted: show(lastCount.counted),
            expected: lastCount.expected === null ? null : show(lastCount.expected),
            difference:
              lastCount.expected === null
                ? null
                : show(lastCount.counted.minus(lastCount.expected)),
          }
        : null,
      countedToday: !!todayDayId && lastCount?.dayId === todayDayId,
      inTransit: { count: transit?.n ?? 0, amount: num(new Prisma.Decimal(transit?.amt ?? 0)) },
      pendingGaps: pending.map((p) => ({
        tvrId: p.tvrId,
        tvrAccYear: p.tvrAccYear,
        stage: p.tvrStage as TillVarianceStage,
        variance: num(p.tvrVariance === null ? null : new Prisma.Decimal(p.tvrVariance)),
      })),
    };
  }

  /** CIT remittances the bank has not confirmed, oldest first. */
  private async inTransit(
    client: Client,
    scope: { companyId: string; branchId: string; safeId?: string | null },
    businessDate: string,
  ): Promise<TillRemittancePayload[]> {
    const rows = await client.tillCashMovement.findMany({
      where: {
        tcmCompanyId: scope.companyId,
        tcmBranchId: scope.branchId,
        tcmKind: TillMovementKind.REMIT,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmRemitStatus: TillRemitStatus.IN_TRANSIT,
        ...(scope.safeId ? { tcmSafeId: scope.safeId } : {}),
      },
      include: {
        safe: { select: { tsfName: true } },
        ledger: { select: { ledName: true } },
      },
      orderBy: [{ tcmDocDate: 'asc' }, { tcmCreatedOn: 'asc' }],
    });
    const today = Date.parse(`${businessDate}T00:00:00Z`);
    return rows.map((m) => ({
      tcmId: m.tcmId,
      tcmAccYear: m.tcmAccYear,
      docNo: m.tcmDocNo,
      docDate: isoDateOf(m.tcmDocDate),
      safeId: m.tcmSafeId!,
      safeName: m.safe?.tsfName ?? null,
      mode: m.tcmRemitMode as TillRemitMode,
      status: m.tcmRemitStatus as TillRemitStatus,
      amount: num(m.tcmAmount),
      bankLedgerId: m.tcmLedgerId!,
      bankName: m.ledger?.ledName ?? null,
      bagNo: m.tcmBagNo,
      sealNo: m.tcmSealNo,
      citAgency: m.tcmCitAgency,
      slipNo: m.tcmRefNo,
      slipDate: m.tcmRefDate ? isoDateOf(m.tcmRefDate) : null,
      ageDays: Math.max(0, Math.round((today - m.tcmDocDate.getTime()) / 86_400_000)),
      doneBy: m.tcmDoneBy,
      createdOn: m.tcmCreatedOn.toISOString(),
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §2 · the count
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * A blind count of the safe: the caller never sees what it should hold until
   * the answer. A SAFE till_count of today's business day (its last one is the
   * day's), SAFE_COUNT journalled, and the gap as the class comment says.
   */
  async count(input: SafeCountInput): Promise<TillSafeCountPayload> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const safe = await this.loadSafe(this.prisma, input, { active: true });
    this.assertCashLines(input.lines, 'lines');
    const visible = await this.figuresVisible(settings);
    const businessDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const today = { date: businessDate, accYear: accYearOf(businessDate) };

    // ── who: the witness's PIN, then a decision in the step — before anything is written
    const witnessId = input.witnessId?.trim() || null;
    const witnessVerifiedOn = witnessId
      ? await this.provePerson({
          userId: witnessId,
          pin: input.witnessPin,
          field: 'witnessId',
          pinField: 'witnessPin',
          role: 'witness',
          caller,
          scope: input,
          accYear: today.accYear,
          action: 'safe-count',
        })
      : null;
    let decision: GapDecision | null = null;
    if (input.treatment) {
      const priced = await this.sessions.priceLines(this.prisma, input.companyId, input.lines);
      const counted = priced.reduce((s, l) => s.plus(l.amount), ZERO);
      const peek = await this.prisma.$transaction(async (tx) => {
        await this.customPlans(tx);
        return this.stateOf(tx, safe, today);
      });
      const gap = counted.minus(peek.expected);
      if (gap.abs().greaterThan(settings.cashTolerance)) {
        decision = await this.judgeGap({
          caller,
          scope: input,
          accYear: today.accYear,
          onDate: businessDate,
          treatment: input.treatment,
          reasonId: input.reasonId ?? null,
          pin: input.approverPin ?? null,
          requesterId: caller.userId,
          second: witnessId ? { userId: witnessId } : null,
          gap,
        });
      }
    }

    const done = await this.prisma.$transaction(
      async (tx) => {
        await this.customPlans(tx);
        const day = await this.dayFor(tx, input, settings, caller);
        await this.lockSafe(tx, safe.tsfId);
        const state = await this.stateOf(tx, safe, {
          date: day.businessDate,
          accYear: day.accYear,
        });
        const lines = await this.sessions.priceLines(tx, input.companyId, input.lines);
        const count = await this.sessions.writeSafeCount(tx, {
          kind: TillCountKind.SAFE,
          companyId: input.companyId,
          branchId: input.branchId,
          tenantId: input.tenantId ?? null,
          accYear: day.accYear,
          safeId: safe.tsfId,
          dayId: day.tbdId,
          movementId: null,
          lines,
          expected: state.expected,
          isBlind: !visible,
          caller,
          witnessBy: witnessId,
          notes: input.notes ?? null,
        });
        const gap = count.total.minus(state.expected);
        if (decision && !gap.equals(decision.judged)) {
          throwTill(
            TillErrorCode.SAFE_CHANGED,
            `${safe.tsfName} moved while it was being counted: count it again`,
            'safeId',
          );
        }
        const raised = await this.raiseGap(tx, {
          stage: TillVarianceStage.SAFE,
          safe,
          scope: {
            companyId: input.companyId,
            branchId: input.branchId,
            tenantId: input.tenantId ?? null,
            accYear: day.accYear,
            date: day.businessDate,
          },
          tvrAccYear: day.accYear,
          dayId: day.tbdId,
          countId: count.tctId,
          movement: null,
          expected: state.expected,
          counted: count.total,
          ledgerId: safe.tsfLedgerId,
          label: `Safe ${safe.tsfName}`,
          tolerance: settings.cashTolerance,
          decision,
          requestedBy: caller.userId,
          requestedOn: count.countedOn,
          secondOn: witnessVerifiedOn,
          caller,
          notes: input.notes ?? null,
        });
        await this.events.log(tx, {
          companyId: input.companyId,
          branchId: input.branchId,
          accYear: day.accYear,
          code: TillEventCode.SAFE_COUNT,
          dayId: day.tbdId,
          deviceId: caller.deviceId,
          userId: caller.userId,
          srcDocType: 'TILL_COUNT',
          srcDocId: count.tctId,
          srcRefno: safe.tsfCode,
          amount: count.total,
          approvalId: raised.tapId,
          payload: {
            safeId: safe.tsfId,
            expected: state.expected.toFixed(2),
            counted: count.total.toFixed(2),
            difference: gap.toFixed(2),
            outcome: raised.outcome,
            openingFrom: state.openingFrom,
            blind: !visible,
            witnessBy: witnessId,
            witnessVerifiedOn: witnessVerifiedOn?.toISOString() ?? null,
            tvrId: raised.tvrId,
          },
        });
        await this.refreshDay(tx, day.tbdId, day.accYear);
        return { day, count, state, gap, raised };
      },
      { timeout: 60_000 },
    );

    const numbers = await this.voucherNos([done.raised.voucherId]);
    const after = await this.balance({ ...input, safeId: safe.tsfId });
    return {
      tctId: done.count.tctId,
      tctAccYear: done.day.accYear,
      safeId: safe.tsfId,
      safeName: safe.tsfName,
      tbdId: done.day.tbdId,
      businessDate: done.day.businessDate,
      countedOn: done.count.countedOn.toISOString(),
      counted: num(done.count.total),
      expected: num(done.state.expected),
      difference: num(done.gap),
      outcome: done.raised.outcome,
      tvrId: done.raised.tvrId,
      treatment: done.raised.treatment,
      tapId: done.raised.tapId,
      varianceVoucherId: done.raised.voucherId,
      varianceVoucherNo: done.raised.voucherId
        ? (numbers.get(done.raised.voucherId) ?? null)
        : null,
      witnessBy: witnessId,
      safe: after.safes[0],
    };
  }

  /**
   * A PENDING safe gap (stage SAFE / REMIT) decided later: the caller's grant
   * under SAFE_VARIANCE with their PIN, and on a two-person rule a second
   * person's PIN (`secondId` — anyone but the caller and whoever raised it).
   * The TVar is dated the decision's business day. Cash Office (287) OVERRIDE.
   */
  async decideVariance(input: SafeDecideInput): Promise<TillSafeDecisionPayload> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const peek = await this.pendingGap(this.prisma, input);
    const businessDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const today = { date: businessDate, accYear: accYearOf(businessDate) };
    const requester = await this.requesterOf(this.prisma, peek);
    const secondId = input.secondId?.trim() || null;
    const secondOn = secondId
      ? await this.provePerson({
          userId: secondId,
          pin: input.secondPin,
          field: 'secondId',
          pinField: 'secondPin',
          role: 'second',
          caller,
          scope: input,
          accYear: today.accYear,
          action: 'safe-decide-variance',
        })
      : null;
    const gap = new Prisma.Decimal(peek.tvrCounted).minus(peek.tvrExpected);
    const decision = await this.judgeGap({
      caller,
      scope: input,
      accYear: today.accYear,
      onDate: businessDate,
      treatment: input.treatment,
      reasonId: input.reasonId,
      pin: input.approverPin ?? null,
      requesterId: requester.userId,
      second: secondId ? { userId: secondId } : null,
      gap,
    });
    await assertTillPartitions(this.prisma, today.accYear, 'accYear');

    const done = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT tvr_id FROM accounts.till_variance
         WHERE tvr_id = ${peek.tvrId}::uuid AND tvr_acc_year = ${peek.tvrAccYear}::char(9)
           FOR UPDATE`;
      const tvr = await this.pendingGap(tx, input);
      const safe = await this.loadSafe(
        tx,
        { companyId: input.companyId, branchId: input.branchId, safeId: tvr.tvrSafeId! },
        { active: false },
      );
      const now = new Date();
      const tapId = await this.approval.record(tx, {
        companyId: input.companyId,
        branchId: input.branchId,
        tenantId: tvr.tvrTenantId,
        accYear: tvr.tvrAccYear,
        event: SAFE_VARIANCE,
        sessionId: null,
        counterId: null,
        srcDocType: requester.srcDocType,
        srcDocId: requester.srcDocId,
        srcRefno: requester.srcRefno,
        amount: gap.abs(),
        rule: decision.rule,
        verdict: decision.verdict,
        requestedBy: requester.userId,
        requestedOn: tvr.tvrCreatedOn,
        reasonId: decision.reasonId,
        status: 'APPROVED',
        decidedBy: caller.userId,
        decidedOn: now,
        decidedDeviceId: caller.deviceId,
        decisionNote:
          input.notes?.trim() || `Safe gap ${gap.toFixed(2)} decided: ${input.treatment}`,
        payload: {
          decision: 'APPROVE',
          treatment: input.treatment,
          stage: tvr.tvrStage,
          via: 'safes/decide-variance',
          safeId: safe.tsfId,
          variances: [{ tvrId: tvr.tvrId, variance: gap.toFixed(2) }],
        },
        selfAllowed: true,
        secondOn,
      });
      await tx.tillVariance.update({
        where: { tvrId_tvrAccYear: { tvrId: tvr.tvrId, tvrAccYear: tvr.tvrAccYear } },
        data: {
          tvrTreatment: input.treatment,
          tvrReasonId: decision.reasonId,
          tvrApprovalId: tapId,
          tvrDecidedBy: caller.userId,
          tvrDecidedOn: now,
          tvrNotes: input.notes?.trim() || tvr.tvrNotes,
          tvrModifiedOn: now,
          tvrModifiedBy: caller.actorName,
        },
      });
      const ledgerId =
        (tvr.tvrStage as TillVarianceStage) === TillVarianceStage.REMIT
          ? await this.ledger.roleLedger(tx, CASH_IN_TRANSIT_ROLE, input.companyId, input.branchId)
          : safe.tsfLedgerId;
      const voucherId = await this.posting.postSafeVariance(tx, {
        scope: {
          companyId: input.companyId,
          branchId: input.branchId,
          tenantId: tvr.tvrTenantId,
          accYear: today.accYear,
          date: today.date,
        },
        tvrId: tvr.tvrId,
        tvrAccYear: tvr.tvrAccYear,
        ledgerId,
        label:
          (tvr.tvrStage as TillVarianceStage) === TillVarianceStage.REMIT
            ? `Remittance ${requester.srcRefno ?? ''}`.trim()
            : `Safe ${safe.tsfName}`,
        variance: gap,
        treatment: input.treatment,
        caller,
      });
      await this.events.log(tx, {
        companyId: input.companyId,
        branchId: input.branchId,
        accYear: tvr.tvrAccYear,
        code: TillEventCode.VARIANCE_DECIDED,
        dayId: requester.dayId,
        deviceId: caller.deviceId,
        userId: caller.userId,
        srcDocType: 'TILL_VARIANCE',
        srcDocId: tvr.tvrId,
        srcRefno: requester.srcRefno,
        amount: gap.abs(),
        reasonId: decision.reasonId,
        approvalId: tapId,
        payload: this.decisionPayload(tvr.tvrStage, decision, safe.tsfId, tvr.tvrId, gap),
      });
      return { tvr, safe, tapId, voucherId, now };
    });

    const numbers = await this.voucherNos([done.voucherId]);
    return {
      tvrId: done.tvr.tvrId,
      tvrAccYear: done.tvr.tvrAccYear,
      stage: done.tvr.tvrStage as TillVarianceStage,
      safeId: done.safe.tsfId,
      safeName: done.safe.tsfName,
      expected: num(new Prisma.Decimal(done.tvr.tvrExpected)),
      counted: num(new Prisma.Decimal(done.tvr.tvrCounted)),
      variance: num(gap),
      treatment: input.treatment,
      tapId: done.tapId,
      secondBy: decision.verdict.secondBy,
      varianceVoucherId: done.voucherId,
      varianceVoucherNo: done.voucherId ? (numbers.get(done.voucherId) ?? null) : null,
      decidedOn: done.now.toISOString(),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §3 · remittance
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Cash out of the safe to the bank: staff at the bank (BANK_DEPOSIT, CRem Dr
   * Bank / Cr Safe, DEPOSITED) or a CIT agency (CRem Dr Cash in transit / Cr
   * Safe, IN_TRANSIT until remit-confirm). Never above what the safe should
   * hold. The REMITTANCE rule as set (shipped NEVER): when it asks, `approverId`
   * (left out = the caller, refused as self unless the rule allows it) types
   * their PIN here. Cash Office (287) CREATE.
   */
  async remit(input: RemitCreateInput): Promise<TillRemitPayload> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const safe = await this.loadSafe(this.prisma, input, { active: true });
    const visible = await this.figuresVisible(settings);
    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
    if (!amount.greaterThan(0)) {
      throwTill(TillErrorCode.MOVEMENT_INVALID, 'A remittance is more than 0', 'amount');
    }
    if (!(Object.values(TillRemitMode) as string[]).includes(input.mode)) {
      throwTill(TillErrorCode.MOVEMENT_INVALID, 'mode is BANK_DEPOSIT or CIT', 'mode');
    }
    await this.assertBank(input.companyId, input.bankLedgerId);
    const lines = input.lines ?? [];
    this.assertCashLines(lines, 'lines');
    const businessDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const today = { date: businessDate, accYear: accYearOf(businessDate) };

    // ── the REMITTANCE rule, judged before anything is written
    let approval: {
      rule: TillApprovalRuleRow;
      verdict: ApproverVerdict;
      approverId: string;
    } | null = null;
    const need = await this.approval.assess(this.prisma, {
      companyId: input.companyId,
      branchId: input.branchId,
      event: REMITTANCE,
      onDate: businessDate,
      amount,
    });
    if (need) {
      const rule = await this.approval.ruleOrDefault(this.prisma, {
        companyId: input.companyId,
        branchId: input.branchId,
        event: REMITTANCE,
        onDate: businessDate,
      });
      const approverId = input.approverId?.trim() || caller.userId;
      const judged = approverId === caller.userId ? rule : { ...rule, tar_channel: 'COUNTER' };
      const verdict = await this.withPinFail(
        { scope: input, accYear: today.accYear, caller, pin: input.approverPin, action: 'remit' },
        () =>
          this.approval.assertApprover(this.prisma, {
            companyId: input.companyId,
            branchId: input.branchId,
            event: REMITTANCE,
            amount,
            rule: judged,
            approverId,
            requesterId: caller.userId,
            pin: input.approverPin ?? null,
          }),
      );
      approval = { rule, verdict, approverId };
    }
    const peek = await this.prisma.$transaction(async (tx) => {
      await this.customPlans(tx);
      return this.stateOf(tx, safe, today);
    });
    this.assertWithinBalance(safe, amount, peek.expected, visible);

    const done = await this.prisma.$transaction(
      async (tx) => {
        await this.customPlans(tx);
        const day = await this.dayFor(tx, input, settings, caller);
        await this.lockSafe(tx, safe.tsfId);
        const state = await this.stateOf(tx, safe, {
          date: day.businessDate,
          accYear: day.accYear,
        });
        this.assertWithinBalance(safe, amount, state.expected, visible);
        const transitLedgerId =
          input.mode === TillRemitMode.CIT
            ? await this.ledger.roleLedger(
                tx,
                CASH_IN_TRANSIT_ROLE,
                input.companyId,
                input.branchId,
              )
            : null;
        const [idRow] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;
        const tcmId = idRow.id;
        const now = new Date();
        const tapId = approval
          ? await this.approval.record(tx, {
              companyId: input.companyId,
              branchId: input.branchId,
              tenantId: input.tenantId ?? null,
              accYear: day.accYear,
              event: REMITTANCE,
              sessionId: null,
              counterId: null,
              srcDocType: 'TILL_MOVEMENT',
              srcDocId: tcmId,
              srcRefno: input.slipNo ?? null,
              amount,
              rule: approval.rule,
              verdict: approval.verdict,
              requestedBy: caller.userId,
              requestedOn: now,
              reasonId: null,
              status: 'APPROVED',
              decidedBy: approval.approverId,
              decidedOn: now,
              decidedDeviceId: caller.deviceId,
              decisionNote:
                input.notes?.trim() || `Remittance of ${amount.toFixed(2)} from ${safe.tsfName}`,
              payload: { mode: input.mode, safeId: safe.tsfId, bankLedgerId: input.bankLedgerId },
            })
          : null;
        let countId: string | null = null;
        if (lines.length > 0) {
          const priced = await this.sessions.priceLines(tx, input.companyId, lines);
          const total = priced.reduce((s, l) => s.plus(l.amount), ZERO);
          if (!total.equals(amount)) {
            throwTill(
              TillErrorCode.COUNT_INVALID,
              `The notes counted come to ${total.toFixed(2)}, not the ${amount.toFixed(2)} remitted`,
              'lines',
            );
          }
          countId = (
            await this.sessions.writeSafeCount(tx, {
              kind: TillCountKind.REMIT,
              companyId: input.companyId,
              branchId: input.branchId,
              tenantId: input.tenantId ?? null,
              accYear: day.accYear,
              safeId: safe.tsfId,
              dayId: null,
              movementId: tcmId,
              lines: priced,
              expected: amount,
              isBlind: false,
              caller,
              notes: input.notes ?? null,
            })
          ).tctId;
        }
        const posted = await this.posting.postRemit(tx, {
          scope: {
            companyId: input.companyId,
            branchId: input.branchId,
            tenantId: input.tenantId ?? null,
            accYear: day.accYear,
            date: day.businessDate,
            dayId: day.tbdId,
          },
          safe: this.safeRef(safe),
          amount,
          mode: input.mode,
          bankLedgerId: input.bankLedgerId,
          transitLedgerId,
          caller,
          tcmId,
          bagNo: input.bagNo ?? null,
          sealNo: input.sealNo ?? null,
          citAgency: input.citAgency ?? null,
          slipNo: input.slipNo ?? null,
          slipDate: input.slipDate ?? null,
          countId,
          approvalId: tapId,
          notes: input.notes ?? null,
        });
        await this.refreshDay(tx, day.tbdId, day.accYear);
        return { day, posted, tapId, countId };
      },
      { timeout: 60_000 },
    );

    const after = await this.balance({ ...input, safeId: safe.tsfId });
    return {
      movement: await this.movements.get({
        companyId: input.companyId,
        branchId: input.branchId,
        accYear: done.day.accYear,
        tcmId: done.posted.tcmId,
      }),
      tapId: done.tapId,
      countId: done.countId,
      safe: after.safes[0],
    };
  }

  /**
   * The bank statement shows a CIT remittance: the Contra Dr Bank / Cr Cash in
   * transit for what the bank credited (left out = what was sent), dated the
   * bank date, the row CONFIRMED and REMIT_CONFIRMED journalled. A short (or
   * long) credit is a REMIT-stage gap, judged as a safe count's. Cash Office
   * (287) CREATE; deciding a gap in the step needs OVERRIDE too.
   */
  async confirmRemit(input: RemitConfirmCreateInput): Promise<TillRemitConfirmPayload> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const peek = await this.loadRemit(this.prisma, input);
    this.assertInTransit(peek);
    const businessDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const docDate = isoDateOf(peek.tcmDocDate);
    if (input.bankDate < docDate || input.bankDate > businessDate) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `The bank date is between the day it was sent (${docDate}) and today (${businessDate})`,
        'bankDate',
      );
    }
    const bankYear = accYearOf(input.bankDate);
    await assertTillPartitions(this.prisma, bankYear, 'bankDate');
    const sent = new Prisma.Decimal(peek.tcmAmount);
    const credited =
      input.bankAmount === null || input.bankAmount === undefined
        ? sent
        : new Prisma.Decimal(input.bankAmount).toDecimalPlaces(2);
    const gap = credited.minus(sent);
    const witnessId = input.witnessId?.trim() || null;
    const witnessOn = witnessId
      ? await this.provePerson({
          userId: witnessId,
          pin: input.witnessPin,
          field: 'witnessId',
          pinField: 'witnessPin',
          role: 'witness',
          caller,
          scope: input,
          accYear: peek.tcmAccYear,
          action: 'remit-confirm',
        })
      : null;
    const decision =
      input.treatment && gap.abs().greaterThan(settings.cashTolerance)
        ? await this.judgeGap({
            caller,
            scope: input,
            accYear: peek.tcmAccYear,
            onDate: businessDate,
            treatment: input.treatment,
            reasonId: input.reasonId ?? null,
            pin: input.approverPin ?? null,
            requesterId: caller.userId,
            second: witnessId ? { userId: witnessId } : null,
            gap,
          })
        : null;

    const done = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT tcm_id FROM accounts.till_cash_movement
           WHERE tcm_id = ${peek.tcmId}::uuid AND tcm_acc_year = ${peek.tcmAccYear}::char(9)
             FOR UPDATE`;
        const m = await this.loadRemit(tx, input);
        this.assertInTransit(m);
        const safe = await this.loadSafe(
          tx,
          { companyId: input.companyId, branchId: input.branchId, safeId: m.tcmSafeId! },
          { active: false },
        );
        const transitLedgerId = await this.ledger.roleLedger(
          tx,
          CASH_IN_TRANSIT_ROLE,
          input.companyId,
          input.branchId,
        );
        const scope = {
          companyId: input.companyId,
          branchId: input.branchId,
          tenantId: m.tcmTenantId,
          accYear: bankYear,
          date: input.bankDate,
        };
        const confirmVoucherId = await this.posting.postRemitConfirm(tx, {
          movement: { ...m, tcmAmount: sent },
          scope,
          transitLedgerId,
          bankAmount: credited,
          bankDate: input.bankDate,
          bankRef: input.bankRef.trim(),
          caller,
          notes: input.notes ?? null,
        });
        const raised = await this.raiseGap(tx, {
          stage: TillVarianceStage.REMIT,
          safe,
          scope,
          tvrAccYear: m.tcmAccYear,
          dayId: m.tcmDayId,
          countId: null,
          movement: { tcmId: m.tcmId, docNo: m.tcmDocNo },
          expected: sent,
          counted: credited,
          ledgerId: transitLedgerId,
          label: `Remittance ${m.tcmDocNo}`,
          tolerance: settings.cashTolerance,
          decision,
          requestedBy: caller.userId,
          requestedOn: new Date(),
          secondOn: witnessOn,
          caller,
          notes: input.notes ?? null,
        });
        return { m, confirmVoucherId, raised };
      },
      { timeout: 60_000 },
    );

    const numbers = await this.voucherNos([done.confirmVoucherId, done.raised.voucherId]);
    return {
      tcmId: done.m.tcmId,
      tcmAccYear: done.m.tcmAccYear,
      docNo: done.m.tcmDocNo,
      sent: num(sent),
      credited: num(credited),
      difference: num(gap),
      outcome: done.raised.outcome,
      confirmVoucherId: done.confirmVoucherId,
      confirmVoucherNo: done.confirmVoucherId ? (numbers.get(done.confirmVoucherId) ?? null) : null,
      tvrId: done.raised.tvrId,
      treatment: done.raised.treatment,
      tapId: done.raised.tapId,
      varianceVoucherId: done.raised.voucherId,
      varianceVoucherNo: done.raised.voucherId
        ? (numbers.get(done.raised.voucherId) ?? null)
        : null,
      movement: await this.movements.get({
        companyId: input.companyId,
        branchId: input.branchId,
        accYear: done.m.tcmAccYear,
        tcmId: done.m.tcmId,
      }),
    };
  }

  /**
   * A remittance voided as other movements are (movements/void): its CRem
   * mirrored, the row VOIDED with a MOVEMENT_VOID reason, the day's remitted
   * figure again. Refused once the bank confirmed it, once its business day is
   * CLOSED, and once the safe has been counted since (that count already holds
   * what the remittance left behind). Cash Office (287) OVERRIDE.
   */
  async voidRemit(input: {
    companyId: string;
    branchId: string;
    accYear: string;
    tcmId: string;
    reasonId: string;
    notes?: string | null;
  }): Promise<void> {
    const caller = await this.context.caller();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT tcm_id FROM accounts.till_cash_movement
         WHERE tcm_id = ${input.tcmId}::uuid AND tcm_acc_year = ${input.accYear}::char(9)
           FOR UPDATE`;
      const m = await this.loadRemit(tx, input);
      if (m.tcmStatus !== 'POSTED') {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          `Remittance ${m.tcmDocNo} is already ${m.tcmStatus}`,
          'tcmId',
        );
      }
      if ((m.tcmRemitStatus as TillRemitStatus) === TillRemitStatus.CONFIRMED) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          `Remittance ${m.tcmDocNo} has been confirmed by the bank and is not voided`,
          'tcmId',
          { status: m.tcmRemitStatus ?? '' },
        );
      }
      const day = await tx.tillBusinessDay.findFirst({
        where: { tbdId: m.tcmDayId, tbdAccYear: m.tcmAccYear },
        select: { tbdStatus: true, tbdBusinessDate: true },
      });
      if ((day?.tbdStatus as TillDayStatus | undefined) === TillDayStatus.CLOSED) {
        throwTill(
          TillErrorCode.DAY_CLOSED,
          `Business day ${day ? isoDateOf(day.tbdBusinessDate) : ''} is closed: its remittances stand`,
          'tcmId',
        );
      }
      await this.lockSafe(tx, m.tcmSafeId!);
      const countedSince = await tx.tillCount.findFirst({
        where: {
          tctSafeId: m.tcmSafeId,
          tctKind: TillCountKind.SAFE,
          tctIsDeleted: false,
          tctCountedOn: { gt: m.tcmCreatedOn },
        },
        select: { tctCountedOn: true },
      });
      if (countedSince) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          `The safe was counted at ${countedSince.tctCountedOn.toISOString()}, after ${m.tcmDocNo}: that count stands; post a new movement instead`,
          'tcmId',
        );
      }
      const reason = await tx.tillReason.findFirst({
        where: {
          trsId: input.reasonId,
          trsIsDeleted: false,
          trsIsActive: true,
          trsCategory: 'MOVEMENT_VOID',
          OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
        },
      });
      if (!reason) {
        throwTill(
          TillErrorCode.REASON_INVALID,
          'A void names an active MOVEMENT_VOID reason',
          'reasonId',
        );
      }
      if (reason.trsNeedsNote && !input.notes?.trim()) {
        throwTill(TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
      }
      await this.posting.voidMovement(tx, {
        movement: m,
        session: null,
        dayId: m.tcmDayId,
        companyId: input.companyId,
        branchId: input.branchId,
        reasonId: reason.trsId,
        reasonText: input.notes?.trim()
          ? `${reason.trsName} — ${input.notes.trim()}`
          : reason.trsName,
        caller,
      });
      await this.refreshDay(tx, m.tcmDayId, m.tcmAccYear);
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The day (tbd_safe_*, SAFE_NOT_COUNTED)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The day's safe figures, kept current by every count / remittance and
   * frozen by the day close: `counted` / `expected` over the safes counted that
   * day (each by its last count; `counted` NULL and `expected` the active
   * safes' book at the end of the day when none was), `remitted` = the day's
   * live REMITs, `opening` = the active safes' book at the end of the day
   * before.
   *
   * Notes 122 §6: the book is read AS OF the business date (vouchers by their
   * date), never walked back from now — a day closed late, or a hand-over of
   * the day before posted after this day opened, used to give an opening no
   * safe ever held. So the answer is the same whenever it is worked out, and
   * one day's book closing is the next day's opening. Each safe LEDGER counts
   * once: safes sharing one (the SAFE_CASH role's) share its balance.
   */
  async refreshDay(tx: Tx, tbdId: string, accYear: string): Promise<void> {
    const day = await tx.tillBusinessDay.findUniqueOrThrow({
      where: { tbdId_tbdAccYear: { tbdId, tbdAccYear: accYear } },
    });
    const businessDate = isoDateOf(day.tbdBusinessDate);
    const safes = await this.branchSafes(tx, day);
    const counts = await tx.$queryRaw<
      { counted: Prisma.Decimal; expected: Prisma.Decimal | null }[]
    >`
      SELECT DISTINCT ON (tct_safe_id) tct_total_counted AS counted, tct_expected AS expected
        FROM accounts.till_count
       WHERE tct_day_id = ${day.tbdId}::uuid AND tct_acc_year = ${day.tbdAccYear}::char(9)
         AND tct_kind = ${TillCountKind.SAFE} AND tct_is_deleted = false
       ORDER BY tct_safe_id, tct_counted_on DESC, tct_id DESC`;
    await this.customPlans(tx);
    const bookAt = async (upTo: string): Promise<Prisma.Decimal> => {
      const balances = await this.ledger.ledgerBalances(
        tx,
        {
          companyId: day.tbdCompanyId,
          branchId: day.tbdBranchId,
          accYear: day.tbdAccYear,
          upTo,
        },
        safes.map((s) => s.tsfLedgerId),
      );
      return [...balances.values()].reduce((sum, b) => sum.plus(b), ZERO);
    };
    // The day before 1 April falls outside the year: its legs are none, so the
    // book is the year's opening set — the right answer there too.
    const opening = await bookAt(isoDateOf(new Date(day.tbdBusinessDate.getTime() - 86_400_000)));
    const [remitted] = await tx.$queryRaw<{ amt: Prisma.Decimal | null }[]>`
      SELECT sum(tcm_amount) AS amt FROM accounts.till_cash_movement
       WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
         AND tcm_kind = ${TillMovementKind.REMIT} AND tcm_status = 'POSTED' AND tcm_is_deleted = false`;
    await tx.tillBusinessDay.update({
      where: { tbdId_tbdAccYear: { tbdId: day.tbdId, tbdAccYear: day.tbdAccYear } },
      data: {
        tbdSafeOpening: opening,
        tbdSafeExpected:
          counts.length > 0
            ? counts.reduce((s, c) => s.plus(c.expected ?? 0), ZERO)
            : await bookAt(businessDate),
        tbdSafeCounted: counts.length > 0 ? counts.reduce((s, c) => s.plus(c.counted), ZERO) : null,
        tbdRemitted: new Prisma.Decimal(remitted?.amt ?? 0),
      },
    });
  }

  /**
   * The safes a day close wants counted (notes 118 · SAFE_NOT_COUNTED): every
   * active safe of the branch holding cash now (expected ≠ 0) or that moved
   * cash on the day, with no SAFE count of that day. An empty, idle safe is
   * not asked for.
   */
  async uncountedSafes(
    client: Client,
    day: TillBusinessDay,
  ): Promise<{ safeId: string; name: string }[]> {
    const safes = await this.branchSafes(client, day);
    if (safes.length === 0) {
      return [];
    }
    const counted = await client.tillCount.findMany({
      where: {
        tctDayId: day.tbdId,
        tctAccYear: day.tbdAccYear,
        tctKind: TillCountKind.SAFE,
        tctIsDeleted: false,
      },
      select: { tctSafeId: true },
    });
    const countedIds = new Set(counted.map((c) => c.tctSafeId));
    const moved = await client.$queryRaw<{ safe_id: string }[]>`
      SELECT DISTINCT s.safe_id::text FROM (
        SELECT tcm_safe_id AS safe_id FROM accounts.till_cash_movement
         WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_safe_id IS NOT NULL
        UNION ALL
        SELECT tcm_to_safe_id FROM accounts.till_cash_movement
         WHERE tcm_day_id = ${day.tbdId}::uuid AND tcm_acc_year = ${day.tbdAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_to_safe_id IS NOT NULL) s`;
    const movedIds = new Set(moved.map((r) => r.safe_id));
    const today = { date: isoDateOf(day.tbdBusinessDate), accYear: day.tbdAccYear };
    const out: { safeId: string; name: string }[] = [];
    for (const safe of safes) {
      if (countedIds.has(safe.tsfId)) {
        continue;
      }
      if (
        movedIds.has(safe.tsfId) ||
        !(await this.stateOf(client, safe, today)).expected.isZero()
      ) {
        out.push({ safeId: safe.tsfId, name: safe.tsfName });
      }
    }
    return out;
  }

  /** The safe gaps of a day still PENDING (a count of the day, a remittance of the day). */
  async pendingGapsOfDay(client: Client, day: TillBusinessDay): Promise<number> {
    const [row] = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM accounts.till_variance v
        LEFT JOIN accounts.till_count c
               ON v.tvr_stage = 'SAFE' AND c.tct_id = v.tvr_count_id AND c.tct_acc_year = v.tvr_acc_year
        LEFT JOIN accounts.till_cash_movement m
               ON v.tvr_stage = 'REMIT' AND m.tcm_id = v.tvr_movement_id AND m.tcm_acc_year = v.tvr_acc_year
       WHERE v.tvr_company_id = ${day.tbdCompanyId}::uuid AND v.tvr_branch_id = ${day.tbdBranchId}::uuid
         AND v.tvr_stage IN ('SAFE', 'REMIT') AND v.tvr_is_deleted = false
         AND v.tvr_status = 'OPEN' AND v.tvr_treatment = ${TillVarianceTreatment.PENDING}
         AND COALESCE(c.tct_day_id, m.tcm_day_id) = ${day.tbdId}::uuid`;
    return row?.n ?? 0;
  }

  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The gap of a count / a confirm, as a stage SAFE / REMIT till_variance row
   * with no session: exact → nothing; within tolerance → WITHIN_TOLERANCE,
   * posted; decided in the step → the treatment, a till_approval row, posted;
   * else PENDING with APPROVAL_REQUESTED journalled.
   */
  private async raiseGap(
    tx: Tx,
    input: {
      stage: TillVarianceStage.SAFE | TillVarianceStage.REMIT;
      safe: SafeRow;
      scope: Omit<SafeScope, 'dayId'>;
      tvrAccYear: string;
      dayId: string;
      countId: string | null;
      movement: { tcmId: string; docNo: string } | null;
      expected: Prisma.Decimal;
      counted: Prisma.Decimal;
      ledgerId: string;
      label: string;
      tolerance: Prisma.Decimal;
      decision: GapDecision | null;
      requestedBy: string;
      requestedOn: Date;
      secondOn: Date | null;
      caller: TillCaller;
      notes: string | null;
    },
  ): Promise<{
    outcome: TillSafeGapOutcome;
    tvrId: string | null;
    treatment: TillVarianceTreatment | null;
    tapId: string | null;
    voucherId: string | null;
  }> {
    const { safe, caller } = input;
    const gap = input.counted.minus(input.expected);
    if (gap.isZero()) {
      return {
        outcome: TillSafeGapOutcome.EXACT,
        tvrId: null,
        treatment: null,
        tapId: null,
        voucherId: null,
      };
    }
    const within = gap.abs().lessThanOrEqualTo(input.tolerance);
    const decision = within ? null : input.decision;
    const treatment = within
      ? TillVarianceTreatment.WITHIN_TOLERANCE
      : (decision?.treatment ?? TillVarianceTreatment.PENDING);
    const outcome = within
      ? TillSafeGapOutcome.WITHIN_TOLERANCE
      : decision
        ? TillSafeGapOutcome.DECIDED
        : TillSafeGapOutcome.SENT_FOR_APPROVAL;
    const [idRow] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;
    const tvrId = idRow.id;
    const now = new Date();
    const src =
      input.stage === TillVarianceStage.SAFE
        ? { type: 'TILL_COUNT', id: input.countId!, refno: safe.tsfCode }
        : { type: 'TILL_MOVEMENT', id: input.movement!.tcmId, refno: input.movement!.docNo };

    let tapId: string | null = null;
    if (decision) {
      tapId = await this.approval.record(tx, {
        companyId: input.scope.companyId,
        branchId: input.scope.branchId,
        tenantId: input.scope.tenantId,
        accYear: input.tvrAccYear,
        event: SAFE_VARIANCE,
        sessionId: null,
        counterId: null,
        srcDocType: src.type,
        srcDocId: src.id,
        srcRefno: src.refno,
        amount: gap.abs(),
        rule: decision.rule,
        verdict: decision.verdict,
        requestedBy: input.requestedBy,
        requestedOn: input.requestedOn,
        reasonId: decision.reasonId,
        status: 'APPROVED',
        decidedBy: caller.userId,
        decidedOn: now,
        decidedDeviceId: caller.deviceId,
        decisionNote:
          input.notes?.trim() ||
          `${input.label}: ${input.counted.toFixed(2)} against ${input.expected.toFixed(2)}`,
        payload: {
          decision: 'APPROVE',
          treatment: decision.treatment,
          stage: input.stage,
          via: input.stage === TillVarianceStage.SAFE ? 'safes/count' : 'movements/remit-confirm',
          safeId: safe.tsfId,
          variances: [{ tvrId, variance: gap.toFixed(2) }],
        },
        selfAllowed: true,
        secondOn: input.secondOn,
      });
    }
    await tx.tillVariance.create({
      data: {
        tvrId,
        tvrCompanyId: input.scope.companyId,
        tvrBranchId: input.scope.branchId,
        tvrTenantId: input.scope.tenantId,
        tvrAccYear: input.tvrAccYear,
        tvrSessionId: null,
        tvrStage: input.stage,
        tvrSafeId: safe.tsfId,
        tvrCountId: input.countId,
        tvrMovementId: input.movement?.tcmId ?? null,
        tvrTenderTypeId: CASH_TENDER_TYPE_ID,
        tvrOpenAmount: input.expected,
        tvrExpected: input.expected,
        tvrCounted: input.counted,
        tvrTolerance: input.tolerance,
        tvrTreatment: treatment,
        tvrReasonId: decision?.reasonId ?? null,
        tvrApprovalId: tapId,
        tvrDecidedBy: within || decision ? caller.userId : null,
        tvrDecidedOn: within || decision ? now : null,
        tvrStatus: 'OPEN',
        tvrNotes: input.notes ?? null,
        tvrCreatedBy: caller.actorName,
      },
      select: { tvrId: true },
    });
    let voucherId: string | null = null;
    if (within || decision) {
      voucherId = await this.posting.postSafeVariance(tx, {
        scope: input.scope,
        tvrId,
        tvrAccYear: input.tvrAccYear,
        ledgerId: input.ledgerId,
        label: input.label,
        variance: gap,
        treatment: treatment as TillSafeGapTreatment | TillVarianceTreatment.WITHIN_TOLERANCE,
        caller,
      });
    }
    if (!within) {
      await this.events.log(tx, {
        companyId: input.scope.companyId,
        branchId: input.scope.branchId,
        accYear: input.tvrAccYear,
        code: decision ? TillEventCode.VARIANCE_DECIDED : TillEventCode.APPROVAL_REQUESTED,
        dayId: input.dayId,
        deviceId: caller.deviceId,
        userId: caller.userId,
        srcDocType: 'TILL_VARIANCE',
        srcDocId: tvrId,
        srcRefno: src.refno,
        amount: gap.abs(),
        reasonId: decision?.reasonId ?? null,
        approvalId: tapId,
        payload: decision
          ? this.decisionPayload(input.stage, decision, safe.tsfId, tvrId, gap)
          : {
              event: SAFE_VARIANCE,
              stage: input.stage,
              safeId: safe.tsfId,
              tvrId,
              expected: input.expected.toFixed(2),
              counted: input.counted.toFixed(2),
              variance: gap.toFixed(2),
            },
      });
    }
    return { outcome, tvrId, treatment, tapId, voucherId };
  }

  private decisionPayload(
    stage: string,
    decision: GapDecision,
    safeId: string,
    tvrId: string,
    gap: Prisma.Decimal,
  ): Prisma.InputJsonValue {
    return {
      stage,
      decision: 'APPROVE',
      treatment: decision.treatment,
      event: SAFE_VARIANCE,
      amount: gap.abs().toFixed(2),
      requiredRole: decision.rule.tar_min_role,
      approverRole: decision.verdict.role,
      channel: decision.verdict.channel,
      implicitGrant: decision.verdict.implicit,
      grantId: decision.verdict.grantId,
      secondBy: decision.verdict.secondBy,
      reasonId: decision.reasonId,
      safeId,
      variances: [tvrId],
    };
  }

  /**
   * A gap beyond tolerance decided now: SAFE_VARIANCE, the caller the approver
   * (their grant covering |gap|, their PIN by the rule's channel), the rule's
   * no-self flag not binding (a safe gap judges nobody else's cash), a two-person
   * rule's second signature `second` (its PIN already proven). A wrong approver
   * PIN is journalled PIN_FAIL before the 403.
   */
  private async judgeGap(ask: {
    caller: TillCaller;
    scope: { companyId: string; branchId: string };
    accYear: string;
    onDate: string;
    treatment: TillSafeGapTreatment;
    reasonId: string | null;
    pin: string | null;
    requesterId: string;
    second: { userId: string } | null;
    gap: Prisma.Decimal;
  }): Promise<GapDecision> {
    const rule = await this.approval.ruleOrDefault(this.prisma, {
      companyId: ask.scope.companyId,
      branchId: ask.scope.branchId,
      event: SAFE_VARIANCE,
      onDate: ask.onDate,
    });
    const verdict = await this.withPinFail(
      {
        scope: ask.scope,
        accYear: ask.accYear,
        caller: ask.caller,
        pin: ask.pin,
        action: 'safe-variance',
      },
      () =>
        this.approval.assertApprover(this.prisma, {
          companyId: ask.scope.companyId,
          branchId: ask.scope.branchId,
          event: SAFE_VARIANCE,
          amount: ask.gap.abs(),
          rule,
          approverId: ask.caller.userId,
          requesterId: ask.requesterId,
          pin: ask.pin,
          selfExempt: true,
          second: ask.second,
        }),
    );
    const reason = await this.sessions.varianceReason(this.prisma, {
      companyId: ask.scope.companyId,
      reasonId: ask.reasonId,
      event: SAFE_VARIANCE,
    });
    return { treatment: ask.treatment, rule, verdict, reasonId: reason.trsId, judged: ask.gap };
  }

  /** assertApprover, journalling PIN_FAIL when a typed PIN was wrong. */
  private async withPinFail<T>(
    ctx: {
      scope: { companyId: string; branchId: string };
      accYear: string;
      caller: TillCaller;
      pin: string | null | undefined;
      action: string;
    },
    judge: () => Promise<T>,
  ): Promise<T> {
    try {
      return await judge();
    } catch (error: unknown) {
      if (ctx.pin?.trim() && tillErrorCodeOf(error) === TillErrorCode.APPROVER_PIN) {
        await this.events.log(this.prisma, {
          companyId: ctx.scope.companyId,
          branchId: ctx.scope.branchId,
          accYear: ctx.accYear,
          code: TillEventCode.PIN_FAIL,
          deviceId: ctx.caller.deviceId,
          userId: ctx.caller.userId,
          payload: { action: ctx.action },
        });
      }
      throw error;
    }
  }

  /**
   * A second person at the desk — a count's witness, a decision's second
   * signature: an active user other than the caller, with their till PIN
   * (TILL_WITNESS_* as notes 108's witness; a wrong one journalled PIN_FAIL).
   * Checked before the transaction. Returns when the PIN was checked.
   */
  private async provePerson(ask: {
    userId: string;
    pin: string | null | undefined;
    field: string;
    pinField: string;
    role: 'witness' | 'second';
    caller: TillCaller;
    scope: { companyId: string; branchId: string };
    accYear: string;
    action: string;
  }): Promise<Date> {
    const label = ask.role === 'witness' ? 'The witness' : 'The second signature';
    if (ask.userId === ask.caller.userId) {
      throwTill(TillErrorCode.COUNT_INVALID, `${label} is someone other than you`, ask.field);
    }
    const user = await this.prisma.userMaster.findFirst({
      where: { usrId: ask.userId, usrIsActive: true, usrIsDeleted: false },
      select: { usrLoginName: true, usrPinHash: true },
    });
    if (!user) {
      throwTill(TillErrorCode.COUNT_INVALID, `${label} is not an active user`, ask.field);
    }
    if (!user.usrPinHash) {
      throwTill(
        TillErrorCode.WITNESS_NO_PIN,
        `${user.usrLoginName} has no till PIN: an administrator sets one in User Administration (menu 58)`,
        ask.pinField,
      );
    }
    const pin = ask.pin?.trim() || null;
    if (pin === null) {
      throwTill(
        TillErrorCode.WITNESS_PIN_REQUIRED,
        `${user.usrLoginName} signs with their till PIN`,
        ask.pinField,
      );
    }
    if (!(await verifySecret(pin, user.usrPinHash))) {
      await this.events.log(this.prisma, {
        companyId: ask.scope.companyId,
        branchId: ask.scope.branchId,
        accYear: ask.accYear,
        code: TillEventCode.PIN_FAIL,
        deviceId: ask.caller.deviceId,
        userId: ask.caller.userId,
        payload: { action: ask.action, [ask.field]: ask.userId },
      });
      throwTill(
        TillErrorCode.WITNESS_PIN,
        `${user.usrLoginName}'s till PIN is wrong`,
        ask.pinField,
      );
    }
    return new Date();
  }

  /**
   * Today's business day for a cash-office document: opened if the setting
   * allows (till.day_auto_open), never a CLOSED one — the safe then waits for
   * the next business day.
   */
  private async dayFor(
    tx: Tx,
    scope: { companyId: string; branchId: string; tenantId?: string | null },
    settings: TillSettings,
    caller: TillCaller,
  ): Promise<SafeDay> {
    const businessDate = await businessDateNow(tx, settings.dayCutoff);
    const accYear = accYearOf(businessDate);
    const closed = await tx.tillBusinessDay.findFirst({
      where: {
        tbdCompanyId: scope.companyId,
        tbdBranchId: scope.branchId,
        tbdAccYear: accYear,
        tbdBusinessDate: dateParam(businessDate),
        tbdIsDeleted: false,
        tbdStatus: TillDayStatus.CLOSED,
      },
      select: { tbdId: true },
    });
    if (closed) {
      throwTill(
        TillErrorCode.DAY_CLOSED,
        `Business day ${businessDate} is closed: the safe is counted and remitted on the next business day (or reopen it)`,
        'businessDate',
        { businessDate },
      );
    }
    const day = await this.days.ensureOpenDay(
      tx,
      { companyId: scope.companyId, branchId: scope.branchId, tenantId: scope.tenantId ?? null },
      settings,
      caller,
      'SESSION',
    );
    return { tbdId: day.tbdId, accYear: day.tbdAccYear, businessDate: day.businessDate };
  }

  private async loadSafe(
    client: Client,
    key: { companyId: string; branchId: string; safeId: string },
    opts: { active: boolean },
  ): Promise<SafeRow> {
    const safe = await client.tillSafe.findFirst({
      where: {
        tsfId: key.safeId,
        tsfCompanyId: key.companyId,
        tsfBranchId: key.branchId,
        tsfIsDeleted: false,
      },
    });
    if (!safe) {
      throwTillNotFound(TillErrorCode.SAFE_NOT_FOUND, 'Till safe', 'safeId', key.safeId);
    }
    if (opts.active && !safe.tsfIsActive) {
      throwTill(
        TillErrorCode.SAFE_MISSING,
        `${safe.tsfName} is inactive (Till Safes, menu 280)`,
        'safeId',
      );
    }
    return { ...safe, tsfInsuredLimit: new Prisma.Decimal(safe.tsfInsuredLimit) };
  }

  private async branchSafes(client: Client, day: TillBusinessDay): Promise<SafeRow[]> {
    const rows = await client.tillSafe.findMany({
      where: {
        tsfCompanyId: day.tbdCompanyId,
        tsfBranchId: day.tbdBranchId,
        tsfIsDeleted: false,
        tsfIsActive: true,
      },
      orderBy: { tsfCode: 'asc' },
    });
    return rows.map((s) => ({ ...s, tsfInsuredLimit: new Prisma.Decimal(s.tsfInsuredLimit) }));
  }

  /** Serialises the cash office on one safe: counts, remittances, their voids. */
  private async lockSafe(tx: Tx, safeId: string): Promise<void> {
    await tx.$queryRaw`SELECT tsf_id FROM accounts.till_safe WHERE tsf_id = ${safeId}::uuid FOR UPDATE`;
  }

  /**
   * The reports' `$x IS NULL OR …` predicates (reports/common) go generic and
   * slow after five runs of a prepared statement (memory: prisma generic plans):
   * the balance reads them on every call.
   */
  private async customPlans(tx: Tx): Promise<void> {
    await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
  }

  /** Under till.blind_close only an approver sees what a safe should hold. */
  private async figuresVisible(settings: TillSettings): Promise<boolean> {
    if (!settings.blindClose) {
      return true;
    }
    const office = await this.context.rights(TILL_MENU.CASH_OFFICE);
    if (office.override) {
      return true;
    }
    return (await this.context.rights(TILL_MENU.SESSIONS)).override;
  }

  private assertCashLines(lines: TillCountLineInput[], field: string): void {
    lines.forEach((line, i) => {
      if (line.tenderTypeId !== CASH_TENDER_TYPE_ID) {
        throwTill(TillErrorCode.COUNT_INVALID, 'A safe holds cash', `${field}.${i}.tenderTypeId`);
      }
    });
  }

  private assertWithinBalance(
    safe: SafeRow,
    amount: Prisma.Decimal,
    expected: Prisma.Decimal,
    visible: boolean,
  ): void {
    if (amount.greaterThan(expected)) {
      throwTill(
        TillErrorCode.REMIT_OVER_BALANCE,
        visible
          ? `${safe.tsfName} should hold ${expected.toFixed(2)}: ${amount.toFixed(2)} cannot leave it`
          : `${amount.toFixed(2)} is more than ${safe.tsfName} should hold: count it, or send less`,
        'amount',
      );
    }
  }

  private async assertBank(companyId: string, ledgerId: string): Promise<void> {
    const facts = await loadLedgerFacts(this.prisma, companyId, [ledgerId]);
    const bank = facts.get(ledgerId);
    if (!bank || bank.isDeleted || !bank.isActive || !isBankLedger(bank)) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        'bankLedgerId must be an active ledger under Bank Accounts / Bank OD A/c',
        'bankLedgerId',
      );
    }
  }

  private async loadRemit(
    client: Client,
    key: { companyId: string; branchId: string; accYear: string; tcmId: string },
  ) {
    const m = await client.tillCashMovement.findFirst({
      where: {
        tcmId: key.tcmId,
        tcmAccYear: key.accYear,
        tcmCompanyId: key.companyId,
        tcmBranchId: key.branchId,
        tcmIsDeleted: false,
      },
    });
    if (!m) {
      throwTill(
        TillErrorCode.MOVEMENT_NOT_FOUND,
        `Till movement ${key.tcmId} was not found`,
        'tcmId',
      );
    }
    if ((m.tcmKind as TillMovementKind) !== TillMovementKind.REMIT) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `${m.tcmDocNo} is a ${m.tcmKind}, not a remittance`,
        'tcmId',
      );
    }
    return m;
  }

  private assertInTransit(m: {
    tcmDocNo: string;
    tcmStatus: string;
    tcmRemitMode: string | null;
    tcmRemitStatus: string | null;
  }): void {
    if (
      m.tcmStatus !== 'POSTED' ||
      (m.tcmRemitMode as TillRemitMode) !== TillRemitMode.CIT ||
      (m.tcmRemitStatus as TillRemitStatus) !== TillRemitStatus.IN_TRANSIT
    ) {
      throwTill(
        TillErrorCode.REMIT_NOT_IN_TRANSIT,
        m.tcmStatus !== 'POSTED'
          ? `${m.tcmDocNo} is ${m.tcmStatus}`
          : (m.tcmRemitMode as TillRemitMode) !== TillRemitMode.CIT
            ? `${m.tcmDocNo} was paid into the bank by staff: there is nothing to confirm`
            : `${m.tcmDocNo} has already been confirmed`,
        'tcmId',
        { status: m.tcmRemitStatus ?? m.tcmStatus },
      );
    }
  }

  /** A PENDING safe gap (stage SAFE / REMIT), else 404 / 409 TILL_VARIANCE_NOT_PENDING. */
  private async pendingGap(
    client: Client,
    key: { companyId: string; branchId: string; accYear: string; tvrId: string },
  ) {
    const tvr = await client.tillVariance.findFirst({
      where: {
        tvrId: key.tvrId,
        tvrAccYear: key.accYear,
        tvrCompanyId: key.companyId,
        tvrBranchId: key.branchId,
        tvrIsDeleted: false,
        tvrStage: { in: [TillVarianceStage.SAFE, TillVarianceStage.REMIT] },
      },
    });
    if (!tvr) {
      throwTillNotFound(TillErrorCode.VARIANCE_NOT_FOUND, 'Safe variance', 'tvrId', key.tvrId);
    }
    if (
      tvr.tvrStatus !== 'OPEN' ||
      (tvr.tvrTreatment as TillVarianceTreatment) !== TillVarianceTreatment.PENDING
    ) {
      throwTill(
        TillErrorCode.VARIANCE_NOT_PENDING,
        `This safe gap is already decided (${tvr.tvrTreatment}, ${tvr.tvrStatus})`,
        'tvrId',
        { treatment: tvr.tvrTreatment, status: tvr.tvrStatus },
      );
    }
    return tvr;
  }

  /** Who raised a safe gap — the counter, or who confirmed the remittance — and its source document. */
  private async requesterOf(
    client: Client,
    tvr: {
      tvrStage: string;
      tvrCountId: string | null;
      tvrMovementId: string | null;
      tvrAccYear: string;
    },
  ): Promise<{
    userId: string;
    srcDocType: string;
    srcDocId: string;
    srcRefno: string | null;
    dayId: string | null;
  }> {
    if ((tvr.tvrStage as TillVarianceStage) === TillVarianceStage.SAFE) {
      const count = await client.tillCount.findUniqueOrThrow({
        where: { tctId_tctAccYear: { tctId: tvr.tvrCountId!, tctAccYear: tvr.tvrAccYear } },
        select: { tctId: true, tctCountedBy: true, tctDayId: true },
      });
      return {
        userId: count.tctCountedBy,
        srcDocType: 'TILL_COUNT',
        srcDocId: count.tctId,
        srcRefno: null,
        dayId: count.tctDayId,
      };
    }
    const m = await client.tillCashMovement.findUniqueOrThrow({
      where: { tcmId_tcmAccYear: { tcmId: tvr.tvrMovementId!, tcmAccYear: tvr.tvrAccYear } },
      select: {
        tcmId: true,
        tcmConfirmedBy: true,
        tcmDoneBy: true,
        tcmDocNo: true,
        tcmDayId: true,
      },
    });
    return {
      userId: m.tcmConfirmedBy ?? m.tcmDoneBy,
      srcDocType: 'TILL_MOVEMENT',
      srcDocId: m.tcmId,
      srcRefno: m.tcmDocNo,
      dayId: m.tcmDayId,
    };
  }

  private safeRef(safe: SafeRow): SafeRef {
    return { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName };
  }

  /** avh_voucher_no of each voucher named. */
  private async voucherNos(ids: (string | null)[]): Promise<Map<string, string>> {
    const wanted = ids.filter((id): id is string => !!id);
    if (wanted.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<{ id: string; no: string | null }[]>`
      SELECT avh_voucher_id::text AS id, avh_voucher_no::text AS no
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ANY(${wanted}::uuid[])`;
    return new Map(rows.filter((r) => r.no !== null).map((r) => [r.id, r.no!]));
  }
}

function inOf(f: SafeFlows): Prisma.Decimal {
  return f.handOvers.plus(f.drops).plus(f.pickups).plus(f.transfersIn).plus(f.receipts);
}

function outOf(f: SafeFlows): Prisma.Decimal {
  return f.floatIssues.plus(f.topUps).plus(f.remittances).plus(f.transfersOut).plus(f.payments);
}

function netOf(f: SafeFlows): Prisma.Decimal {
  return inOf(f).minus(outOf(f));
}
